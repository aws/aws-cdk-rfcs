# Full control over VPC and subnet configuration

* **Original Author(s):**: @otaviomacedo
* **Tracking Issue**: #507
* **API Bar Raiser**: @rix0rrr

New L2 constructs to allow for greater control over VPC design. Among other
things, these constructs allow users to create and configure subnets in
ways that are not currently possible with the `Vpc` construct.

## Working Backwards

The `VpcV2` is a new construct, that creates an AWS VPC. Compared to `Vpc`,
it makes fewer assumptions and allows for more control over how you
structure your VPC, subnets and related resources, such as NAT Gateways and
VPC Endpoints.

### IP addressing

With `VpcV2`, in addition to the mandatory primary IP block, you can have one or
more secondary IP blocks, by providing them in the CIDR format:

```ts
const vpc = new VpcV2(this, 'vpc', {
  primaryAddressBlock: IpAddresses.ipv4('10.0.0.0/16'),
  secondaryAddressBlocks: [
    // The secondary address blocks must be in the same RFC 1918 range as
    // the primary address block
    IpAddresses.ipv4('10.1.0.0/16'),
    IpAddresses.ipv4('10.2.0.0/16'),
  ],
});
```

Or by providing an [IPAM] pool with a netmask length:

```ts
const ipam = new Ipam(stack, 'ipam');
const pool = ipam.publicScope.addPool({
  addressFamily: AddressFamily.IP_V4,
  provisionedCidrs: ['10.2.0.0/16'],
});

const vpc = new VpcV2(this, 'vpc', {
  primaryAddressBlock: IpAddresses.ipv4('10.0.0.0/16'),
  secondaryAddressBlocks: [
    IpAddresses.ipv4Ipam({
      ipamPool: pool,
      netmaskLength: 20,
    }),
  ],
});
```

You can also add secondary IPv6 address blocks, in three different ways:

```ts
// 1. Using an Ipv6 address block. Because IPv6 addresses are all publicly
// addressable, they must come from an address pool that you own and brought to
// AWS (BYOIP). So you must also provide the pool ID:
IpAddresses.ipv6({
  cidr: '2001:db8:1234:1a00::/56',

  // The pool of IPs you own. Not to be confused with an IPAM pool ID
  poolId: 'my-ipv6-pool-id',
});

// 2. Using an IPAM pool:
IpAddresses.ipv6Ipam({
  ipamPool: pool,
  netmaskLength: 64
});

// 3. Using an Amazon-provided IPv6 CIDR block:
IpAddresses.amazonProvidedIpv6();
```

### Defining your own subnets

You can define your subnets with `SubnetV2`:

```ts
const subnet = new SubnetV2(this, 'subnet', {
  vpc,
  cidrBlock: new Ipv4Cidr('10.0.0.0/24'),
  availabilityZone: Fn.select(0, fn.getAzs()), // or directly, 'us-west-2a'
});
```

If you add more than one subnet to the VPC, the framework validates that there
is no intersection between their address blocks. In addition, if all VPC IP
address blocks (both primary and secondary) are provided as CIDR strings, the
framework validates that each address block of all subnets is within one of the
address blocks of the VPC.

If you have added a secondary IPv6 block to your VPC, you can then add
subnets with IPv6 ranges as well:

```ts
const subnet = new SubnetV2(this, 'subnet', {
  vpc,
  cidrBlock: new Ipv6Cidr('2001:db8:1234:1a00::/60'),
  availabilityZone: Fn.select(0, fn.getAzs()), // or directly, 'us-west-2a'
});
```

### Routing

To define a public subnet, create a route table with a route to an Internet
gateway:

```ts
const internetGateway = new InternetGateway(this, 'igw');

const publicDefaultRoute = new Route(this, 'publicDefaultRoute', {
  destination: new Ipv4Cidr('0.0.0.0/0'),

  // targets implement IRouter
  target: internetGateway,
});

const publicRouteTable = new RouteTable(this, 'publicRouteTable', {
  routes: [publicDefaultRoute],
});

const publicSubnet = new Subnet(this, 'publicSubnet', {
  vpc,
  routeTable: publicRouteTable,
  cidrBlock: new Ipv4Cidr('10.0.0.0/24'),
  availabilityZone: Fn.select(0, fn.getAzs()), // or directly, 'us-west-2a'
});
```

You can place a NAT Gateway in this subnet:

```ts
const elasticIp = new ElasticIp(this, 'eip', {
  domain: Domain.VPC,
});

const natGateway = new NatGateway(this, 'NatGateway', {
  subnet: publicSubnet,
  eip: elasticIp,
});
```

To define a private subnet with egress-only access to the Internet, you need
a route to the NAT Gateway that was placed in the public subnet:

```ts
const privateDefaultRoute = new Route(this, 'privateDefaultRoute', {
  destination: new Ipv4Cidr('0.0.0.0/0'),
  target: natGateway,
});

const privateRouteTable = new RouteTable(this, 'privateRouteTable', {
  routes: [privateDefaultRoute],
});

const privateSubnet = new Subnet(this, 'privateSubnet', {
  vpc,
  routeTable: privateRouteTable,
  cidrBlock: new Ipv4Cidr('10.0.1.0/24'),
  availabilityZone: Fn.select(0, fn.getAzs()), // or directly, 'us-west-2a'
});
```

For IPv6 traffic, to produce this pattern, you have to use an egress-only
internet gateway:

```ts
const egressOnlyInternetGateway = new EgressOnlyInternetGateway(this, 'gw');

const privateDefaultRoute = new Route(this, 'privateDefaultRoute', {
  destination: new Ipv4Cidr('::/0'),
  target: egressOnlyInternetGateway,
});
```

To route traffic through gateway VPC endpoints:

```ts
const dynamoDbEndpoint = new GatewayVpcEndpoint(this, 'endpoint', {
  vpc,
  service: GatewayVpcEndpointAwsService.DYNAMODB,
});

const route = new Route(this, 'route', {
  destination: GatewayVpcEndpointAwsService.DYNAMODB.name,
  target: dynamoDbEndpoint,
});

const routeTable = new RouteTable(this, 'routeTable', {
  routes: [route],
});
```

To create a route table that sends traffic through interface VPC endpoints:

```ts
const subnet1 = vpc.addSubnet(/*...*/);
const subnet2 = vpc.addSubnet(/*...*/);

const dockerEndpoint = new InterfaceVpcEndpoint(this, 'EcrDockerEndpoint', {
  vpc,
  service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
  subnets: {
    subnets: [subnet1, subnet2],
  },
});

const route = new Route(this, 'route', {
  destination: InterfaceVpcEndpointAwsService.ECR_DOCKER.name,
  target: dockerEndpoint,
});
```

To route traffic to a VPN Gateway, you can explicitly add a route to the
route table, or you can enable route propagation (or both):

```ts
// Because VpnGateway doesn't do much
const vpnGateway = new VpnGatewayV2(this, 'VpnGateway', {
  vpc,
});

const route = new Route(this, 'route', {
  destination: new Ipv4Cidr('172.31.0.0/24'),
  target: vpnGateway,
});
```

If you have another VPC that you want to use in a peering connection:

```ts
const route = new Route(this, 'route', {
  destination: new Ipv4Cidr('192.168.0.0/24'), // The peer VPC CIDR
  target: anotherVpc,
});
```

Other targets include carrier gateways, transit gateways and network interfaces.
The API to create routes to them follows the same pattern as above.

### Creating higher-level abstractions

From these building blocks, you can assemble any VPC pattern you want and
encapsulate them in custom higher-level constructs (L3s). For example,
suppose you create a new construct called `MySubnetGroup` with the public
and private subnets above (and their ancillary constructs such as route
tables etc.) You can then replicate this group across all availability
zones:

```ts
// This filter does a lookup and produces a list of availability zones 
// according to your deny-list
const azs = AzFilter.excludeIds(['use1-az1']);

const ipProvider = IpAddresses.ipv4('10.0.0.0/20');
azs.forEach((az, i) => {
  new MySubnetGroup(this, `group${i}`, {
    // This value is passed to the availabilityZone property of Subnet
    az,

    // You can call ipAddresses.allocateSubnetsCidr() to get chunks of this 
    // space allocated to each subnet
    ipAddresses: ipProvider,
  });
})
```

Consider the `publicSubnet` object created above. Then the following two
statements are true:

```ts
vpc.publicSubnets.includes(subnet);
vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC}).includes(subnet);
```

Note that, once you access `.publicSubnets` or `selectSubnets()`, you are no
longer allowed to create a subnet in this VPC. Otherwise, the same query
would return different results in different parts of the application, a
surprising behavior, that can cause confusion.

### Using subnets with other components

When you create a component that needs to be placed in a subnet, you can
provide a subnet selection, which informs the `Vpc` construct which
actual subnet to pick. For example, to create an `ApplicationLoadBalancer`:

```ts
const subnet1 = vpc.addSubnet(/*...*/);
const subnet2 = vpc.addSubnet(/*...*/);

const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
  vpc,
  vpcSubnets: {
    subnets: [subnet1, subnet2],
  },
});
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @rix0rrr
```

## Public FAQ

### What are we launching today?

A new set of L2 constructs that allow more control over subnets and related
concepts, such as routes and route tables.

### Why should I use this feature?

With this new API, you'll be able to:

- Define your own route tables if the "each subnet has its own table"
  strategy doesn't fit your use case.
- Add secondary address ranges to the VPC.
- Define an address block per subnet. As a consequence, you will also be
  able to create asymmetric VPCs, in which different subnets of the same
  type have different sizes.
- Control whether instances launched in public subnets should receive a
  public IPv4 address. In subnets created automatically by the `Vpc`
  construct, they always do.
- Control in which availability zones specifically your subnets will be placed.

## Internal FAQ

### Why are we doing this?

Network design is complex, even with the abstractions provided by AWS. There
are many decisions that beginners struggle to get right, or don't even care
about in the first place.

The `Vpc` L2 construct was designed to lower this entry barrier by exposing a
simple interface to users, and doing the heavy lifting behind the scenes. By
creating a `Vpc` with no additional properties, for example, the framework
synthesizes 33 CloudFormation resources of 9 different types. This default
behavior incorporates recommended VPC design practices (e.g., one NAT
gateway per availability zone). And, to a certain extent, this behavior can
be customized: number of availability zones, types of subnet groups and
subnet size within a group are some of the things users can control.

While this is ideal for beginners, more advanced users need a level of
control that the construct doesn't afford. We have an open
[GitHub issue](https://github.com/aws/aws-cdk/issues/5927) to track this theme,
which has received 116 reactions so far. In the top-rated comment in that issue,
one user complains: "CDK should follow the cloud-formation interface! Do not
tie our hands, let us build. If you want to add a 'convenience' wrapper, do
so, but do not force this on us. CDK is a tool not a prescription for how to
build", a point that was further elaborated by another user: "I have been
given a design brief that details out exact subnets, IP address ranges, NACL,
Routing etc. CDK does not allow the user to follow such a brief".

### Why should we _not_ do this?

This API is for advanced users, who need to override the default
configuration provided by the framework, and understand the consequences of
doing so.

An argument against implementing this API is that it would give users a tool
that allows them to implement bad patterns, from a security, availability
and cost standpoints. For example, users might accidentally add an internet
route to an otherwise private subnet, exposing sensitive resources, such as
databases, to the outside world.

### Is this a breaking change?

No.

### What alternative solutions did you consider?

We have considered an
[alternative API](./0507-subnets/alternative-working-backwards.md), in which
most of the constructs are created by calling `VpcV2` methods (e.g.,
`addSubnet()`).

### What is the high-level project plan?

1. Implement the whole API described in this document.
2. Launch it in a separate construct library, in Developer Preview mode.
3. When it meets the exit criteria (3 months bake time, at least 2000
   stacks and no P0 bugs), move all the new API over to the `aws-ec2` module.

### Are there any open issues that need to be addressed later?

No.

### Why is a new temporary module being introduced?

For large experimental APIs like this, it's a good idea to clearly mark them
as such. Although we have other mechanisms for this, like adding `BetaN`
prefixes, this intention is better by a separate module marked as
Experimental or Developer Preview.

### Why create new `V2` constructs?

The current constructs are very opinionated, with a lot of behavior  
defined in the constructor (which makes it impossible to turn those 
behaviors off), and with an API that is hard to add to without making 
breaking changes (e.g., `Subnet`).

[IPAM]: https://docs.aws.amazon.com/vpc/latest/ipam/what-it-is-ipam.html
