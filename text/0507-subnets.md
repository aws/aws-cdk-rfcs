# Full control over VPC and subnet configuration

* **Original Author(s):**: @otaviomacedo
* **Tracking Issue**: #507
* **API Bar Raiser**: @{BAR_RAISER_USER}

New L2 constructs to allow for greater control over VPC design. Among other
things, these constructs allow users to create and configure subnets in
ways that are not currently possible with the `Vpc` construct.

## Working Backwards

### IP addressing

When you create a VPC, you can provide one or more secondary IP ranges, by
providing them in the CIDR format:

```ts
const vpc = new Vpc(this, 'vpc', {
  // Primary address block
  ipAddresses: IpAddresses.ipv4('10.1.0.0/16'),
});

// The secondary address block must be in the same RFC 1918 range
vpc.addSecondaryAddressBlock(IpAddresses.ipv4('10.2.0.0/16'));

const subnet = vpc.addSubnet({
  cidrBlock: '10.2.0.0/20',
  availabilityZone: 'us-west-2a'
});
```

Or by providing an [IPAM] pool with a netmask length:

```ts
const ipam = new Ipam(stack, 'ipam');
const pool = ipam.publicScope.addPool({
  addressFamily: AddressFamily.IP_V4,
  provisionedCidrs: [IpAddresses.ipv4('10.2.0.0/16')],
});

vpc.addSecondaryAddressBlock(IpAddresses.ipv4Ipam({
  ipamPool: pool,
  netmaskLength: 20
}));
```

If you add more than one subnet to the VPC, the framework validates that there
is no intersection between their address blocks. In addition, if all VPC IP
address blocks (both primary and secondary) are provided as CIDR strings, the
framework validates that each address block of all subnets is within one of the
address blocks of the VPC.

You can also add secondary IPv6 address ranges, in three different ways:

```ts
// 1. Providing an Ipv6 address block. Because IPv6 addresses are all publicly 
// addressable, they must come from an address pool that you brought to AWS 
// (BYOIP). So you must also provide the pool ID:
vpc.addSecondaryAddressBlock(IpAddresses.ipv6({
  cidr: '2001:db8:1234:1a00::/56',

  // The pool of IPs you own. Not to be confused with an IPAM pool ID
  poolId: 'my-ipv6-pool-id',
}));

// 2. Using an IPAM pool:
vpc.addSecondaryAddressBlock(IpAddresses.ipv6Ipam({
  ipamPoolId: pool,
  netmaskLength: 64
}));

// 3. Using an Amazon-provided IPv6 CIDR block:
vpc.addSecondaryAddressBlock(IpAddresses.amazonProvidedIpv6());
```

If you have added a secondary IPv6 block to your VPC, you can then add
subnets with IPv6 ranges as well:

```ts
const subnet = vpc.addSubnet({
  cidrBlock: '2001:db8:1234:1a00::/60',
  availabilityZone: 'us-west-2a'
});
```

### Routing

To create a public subnet:

```ts
const publicRouteTable = vpc.addRouteTable('routeTable', {
  routes: [
    // With no parameters, the destination is the entire VPC CIDR
    Route.local(),

    // By adding this route, all subnets that use this table become public
    Route.to({
      destination: '0.0.0.0/0',
      target: Routers.INTERNET_GATEWAY,
    }),
  ],
});

const subnet = vpc.addSubnet({
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

To create a route table that routes DynamoDB and S3 traffic through VPC
endpoints:

```ts
const routeTable = new RouteTable(this, 'routeTable', {
  routes: [
    Route.DYNAMODB_ENDPOINT,
    Route.S3_ENDPOINT
  ],
});
```

You can use a public NAT gateway to enable instances in a private subnet to
send outbound traffic to the internet, while preventing the internet from
establishing connections to the instances:

```ts
const elasticIp = new ElasticIp({
  domain: Domain.VPC

  // Other properties, such as networkBorderGroup and publicIpv4Pool 
  // are also available. Omitted here for brevity.
});

const natGateway = publicSubnet.addNatGateway({elasticIp});

const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    Route.to({
      destination: '0.0.0.0/0',

      // targets must implement the IRouter interface
      target: natGateway,
    }),
  ],
});

const privateSubnet = vpc.addSubnet({
  cidrBlock: '10.2.0.0/20',
  availabilityZone: 'us-west-2a',
  routeTable,
});
```

You can also create the same kind of routing pattern, but with a NAT instance
instead:

```ts
const natInstance = publicSubnet.addNatInstance({
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
  machineImage: ec2.MachineImage.latestAmazonLinux({
    generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
  }),

  // Other properties ommitted
});

const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    Route.to({
      destination: '0.0.0.0/0',

      // Instance also implements IRouter
      target: natInstance,
    }),
  ],
});

const privateSubnet = vpc.addSubnet({
  cidrBlock: '10.2.0.0/20',
  availabilityZone: 'us-west-2a',
  routeTable,
});
```

For IPv6 traffic, you create this pattern by using an egress-only internet
gateway:

```ts
const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    Route.local('10.0.0.0/16'),
    Route.local('2001:db8:1234:1a00:/64'),

    // The CIDR provided here must be for IPv6
    Route.toEgressOnlyInternetGateway('::/0'),
  ],
});
```

To route traffic to a VPN Gateway, you can either explicitly add a route to the
route table or you can enable route propagation:

```ts
const routeTable = vpc.addRouteTable('routeTable', {
  routes: [
    Route.local('10.0.0.0/16'),

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
    Route.local(),
    Route.toPeerVpc({
      vpc: anotherVpc, // or Vpc.fromLookup(...)
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
actual subnet to pick. On the other hand, if you already have an `ISubnet`
instance where you want to place a component, you can provide it directly.
For example, to create an `ApplicationLoadBalancer`:

```ts
const subnet1 = vpc.addSubnet(/*...*/);
const subnet2 = vpc.addSubnet(/*...*/);

const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
  vpc,
  subnets: [subnet1, subnet2],
});
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new set of L2 constructs that allow more control over subnets and related
concepts, such as routes and route tables.

### Why should I use this feature?

With these constructs, you'll be able to:

- Define your own route tables if the "each subnet has its own table"
  approach doesn't fit your use case.
- Add secondary address ranges to the VPC.
- Define an address block per subnet. As a consequence, you will also be
  able to create asymmetric VPCs, in which different subnets of the same
  type have different sizes.
- Control whether instances launched in public subnets should receive a
  public IPv4 address. In subnets created automatically by the `Vpc`
  construct, they always do.
- Control in which availability zones specifically your subnets will be placed.
- Control in which subnet specifically other resources, such as load
  balancers and EC2 instances, will be placed.

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
control that the construct doesn't afford. We have an open GitHub issue to
track this theme, which has received 116 reactions so far. "CDK should
follow the cloud-formation interface! Do not tie our hands, let
us build. If you want to add a 'convenience' wrapper, do so, but do not
force this on us. CDK is a tool not a prescription for how to build",
complained one user.

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

### What is the technical solution (design) of this feature?

> Briefly describe the high-level design approach for implementing this feature.
>
> As appropriate, you can add an appendix with a more detailed design document.
>
> This is a good place to reference a prototype or proof of concept, which is
> highly recommended for most RFCs.

### Is this a breaking change?

No.

### What alternative solutions did you consider?

> Briefly describe alternative approaches that you considered. If there are
> hairy details, include them in an appendix.

### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

### What is the high-level project plan?

> Describe your plan on how to deliver this feature from prototyping to GA.
> Especially think about how to "bake" it in the open and get constant feedback
> from users before you stabilize the APIs.
>
> If you have a project board with your implementation plan, this is a good
> place to link to it.

### Are there any open issues that need to be addressed later?

No.

### Why all the `.addXxx()` methods?

To keep the current way of organizing constructs in the tree, in which
everything that is logically part of the VPC is a direct or indirect
descendant of the `Vpc` construct.

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.


[IPAM]: https://docs.aws.amazon.com/vpc/latest/ipam/what-it-is-ipam.html