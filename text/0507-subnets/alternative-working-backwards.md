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
