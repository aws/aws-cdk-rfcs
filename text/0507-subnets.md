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

> **Note**
> In all the code snippets in this document, unless otherwise specified, the
> variable `vpc` always refers to an instance of `VpcV2`.

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

`VpcV2` also allows you to define your own subnets:

```ts
const subnet = vpc.addSubnet('subnet', {
  cidrBlock: '10.2.0.0/20',
  availabilityZone: 'us-west-2a'
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
const subnet = vpc.addSubnet('subnet', {
  cidrBlock: '2001:db8:1234:1a00::/60',
  availabilityZone: 'us-west-2a'
});
```

### Routing

By default, `addSubnet()` creates isolated subnets, that only route traffic
to other hosts inside the VPC. To define different routing policies for a
subnet, provide a route table when creating it. For example, to create a
public subnet:

```ts
const publicRouteTable = vpc.addRouteTable('routeTable', {
  routes: [
    // By adding this route, all subnets that use this table become public
    Route.toInternetGateway('0.0.0.0/0'),
  ],
});

const subnet = vpc.addSubnet('publicSubnet', {
  cidrBlock: '10.2.0.0/20',
  availabilityZone: 'us-west-2a',
  routeTable: publicRouteTable,
  mapPublicIpOnLaunch: false, // default: true for public subnets
});

// The following is true
vpc.publicSubnets.includes(subnet);

// As is
vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC}).includes(subnet);
```

If you don't provide a route table when adding a subnet, a new route table
will be automatically created and assigned to it. To add routes to a route
table after it has been created, use the `addRoute()` method:

```ts
subnet.routeTable.addRoute(
  Route.toInternetGateway('0.0.0.0/0'),
);
```

To route traffic through gateway VPC endpoints, use the `Route.
toGatewayEndpoint()` method:

```ts
vpc.addRouteTable('routeTable', {
  routes: [
    // The endpoint will be created if it doesn't exist
    Route.toGatewayEndpoint(GatewayVpcEndpointAwsService.DYNAMODB),
  ],
});
```

To create a route table that sends traffic through interface VPC endpoints:

```ts
const subnet1 = vpc.addSubnet(/*...*/);
const subnet2 = vpc.addSubnet(/*...*/);

vpc.addRouteTable('routeTable', {
  routes: [
    Route.toInterfaceEndpoint(InterfaceVpcEndpointAwsService.ECR_DOCKER, {
      // The endpoint will be created if it doesn't exist,
      // in each of these subnets
      subnets: [subnet1, subnet2],
    }),
  ],
});
```

You can use a public NAT gateway to enable instances in a private subnet to
send outbound traffic to the internet, while preventing the internet from
establishing connections to the instances:

```ts
const elasticIp = new ElasticIp({
  domain: Domain.VPC

  // Other properties, such as networkBorderGroup and publicIpv4Pool,
  // are also available. Omitted here for brevity.
});

// Ideally, we would have an addNatGateway() to ISubnet or just on Subnet,
// that would return IRouter, but this method already exists, with a
// different signature, and only in PublicSubnet. So we have to export
// NatGateway and create it outside.
const natGateway = new NatGateway(vpc, 'NatGateway', {
  subnet: subnet,
  eip: elasticIp,
});

const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    Route.to({
      destination: '0.0.0.0/0',

      // targets must implement the IRouter interface
      target: natGateway,
    }),
  ],
});

const privateSubnet = vpc.addSubnet('privateSubnet', {
  cidrBlock: '10.2.0.0/20',
  availabilityZone: 'us-west-2a',
  routeTable,
});
```

You can also produce the same kind of routing pattern with a NAT instance:

```ts
// Same thing with a NAT instance: we have to create it outside of the subnet.
// NatInstance extends Instance and implements IRouter.
const natInstance = new NatInstance(vpc, 'natinst', {
  instanceType: new ec2.InstanceType('t3.micro'),
  machineImage: new ec2.GenericLinuxImage({
    'us-east-2': 'ami-0f9c61b5a562a16af'
  }),

  // Other properties ommitted
});

const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    Route.to({
      destination: '0.0.0.0/0',
      target: natInstance,
    }),
  ],
});

const privateSubnet = vpc.addSubnet('privateSubnet', {
  cidrBlock: '10.2.0.0/20',
  availabilityZone: 'us-west-2a',
  routeTable,
});
```

For IPv6 traffic, to produce this pattern, you have to use an egress-only
internet gateway:

```ts
const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    // The CIDR provided here must be for IPv6
    Route.toEgressOnlyInternetGateway('::/0'),
  ],
});
```

To route traffic to a VPN Gateway, you can explicitly add a route to the
route table, or you can enable route propagation (or both):

```ts
const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    // Static route to a VPN Gateway. Takes priority over propagated ones
    // Causes VPN gateway to be enabled in the VPC
    Route.toVpnGateway('172.31.0.0/24'),
  ],

  // To make VPN Gateway routes propagate to this route table
  enableVpnGatewayRoutePropagation: true, // default: false
});
```

If you have another VPC that you want to use in a peering connection:

```ts
const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    Route.toPeerVpc({
      vpc: anotherVpc,
      destination: '192.168.0.0/24', // The peer VPC CIDR
    }),
  ],
});
```

Other targets include carrier gateways, transit gateways and network interfaces.
The API to create routes to them follows the same pattern as above.

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

### What is the technical solution (design) of this feature?

See the [proof-of-concept].

### Is this a breaking change?

No.

### What alternative solutions did you consider?

- **VPC patterns**: a new module, similar in spirit to `aws-ecs-patterns`,
  which would provide users with a set of common architectural patterns.
- **VPC builder**: a new interface that would allow users to build a VPC from
  scratch, by adding subnets, route tables, etc. Different implementations
  of this interface would have follow different strategies, such as
  different ways to partition the address space, or different ways to assign
  route tables to subnets. Users would be able to choose from a set of
  existing implementations or create their own.

These solutions would be more flexible than what is currently offered by the
`aws-ec2` module, but would still fall short of what advanced users need.
There is simply too much variation in the way users want to design their VPCs.

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

### Why create a new `VpcV2` construct instead of adding to `Vpc`?

They will serve two separate sets of customers, with different use cases.
For example, `Vpc` creates all the subnets on behalf of the user, while
`VpcV2` will not create any subnet other than the ones requested by the user.

### Why all the `.addXxx()` methods?

To keep the current way of organizing constructs in the tree, in which
everything that is logically part of the VPC is a direct or indirect
descendant of the `Vpc` construct. The exceptions to this rule are
`NatGateway` and `NatInstance`, due to limitations with the `ISubnet`
interface, as explained in the main section.

[IPAM]: https://docs.aws.amazon.com/vpc/latest/ipam/what-it-is-ipam.html

[proof-of-concept]: https://github.com/aws/aws-cdk/blob/otaviom/subnets/packages/aws-cdk-lib/aws-ec2/test/vpc.test.ts#L2357
