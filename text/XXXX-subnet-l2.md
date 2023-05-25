## IP addressing

IPv4:

[//]: # (TODO: Comment on the static factory methods in IpAddresses. Some are new, others are renamings of existing ones )

```ts
const vpc = new Vpc(this, 'vpc', {
    // Primary address block
    ipAddresses: IpAddresses.ipv4('10.1.0.0/16'),
});

// Providing an IPv4 CIDR:
vpc.addSecondaryAddressBlock(IpAddresses.ipv4('10.2.0.0/16'));

// Using an IPAM pool:
vpc.addSecondaryAddressBlock(IpAddresses.ipv4IpamAllocation({
    ipamPoolId: 'ipam-pool-0b8108cf759ba18b0',
    netmaskLength: 16
}));

const subnet = vpc.addSubnet({
    cidrBlock: '10.2.0.0/20',
    availabilityZone: 'us-west-2a'
});
```

If more than one subnet is added to the VPC, the framework validates that there
is no intersection between their address blocks. In addition, if all VPC IP
address blocks (both primary and secondary) are provided as CIDR strings, the
framework validates that the address blocks of all subnets are within one of the
address blocks of the VPC.

IPv6:

```ts
// Providing an IPv6 CIDR block. In this case, these IP addresses must
// come from an address pool that you brought to AWS. So you must also provide
// the pool ID:
vpc.addSecondaryAddressBlock(IpAddresses.ipv6({
    cidr: '2001:db8:1234:1a00::/56',

    // The pool of IPs you own (BYOIP). Not to be confused with an IPAM pool ID
    poolId: 'my-ipv6-pool-id',
}));

// Using an IPAM pool:
vpc.addSecondaryAddressBlock(IpAddresses.ipv6IpamAllocation({
    ipamPoolId: 'ipam-pool-0b8108cf759ba18b0',
    netmaskLength: 64
}));

// Using an Amazon-provided IPv6 CIDR block:
vpc.addSecondaryAddressBlock(IpAddresses.amazonProvidedIpv6());
```

```ts
const subnet = vpc.addSubnet({
    cidrBlock: '2001:db8:1234:1a00::60',
    availabilityZone: 'us-west-2a'
});
```

[//]: # (TODO: look into availabilityZone vs. availabilityZoneId)

## Routing

To create a public subnet:

```ts
const publicRouteTable = vpc.addRouteTable('routeTable', {
    routes: [
        // With no parameters, the destination is the entire VPC CIDR
        Route.local(),
        
        // By adding this route, all subnets that use this table become public
        Route.to({
            destination: '0.0.0.0/0',
            routable: Routables.INTERNET_GATEWAY,
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
vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }).includes(subnet);
```

To create a route table that routes DynamoDB and S3 traffic through VPC
endpoints.

```ts
const routeTable = new RouteTable(this, 'routeTable', {
    routes: [Route.DYNAMODB_ENDPOINT, Route.S3_ENDPOINT],
});
```

To add a NAT Gateway to a public subnet and route traffic to it from a 
private subnet:

```ts
const elasticIp = new ElasticIp({
    domain: Domain.VPC

    // Other properties, such as networkBorderGroup and publicIpv4Pool 
    // are also available. Omitted here for brevity.
});

const natGateway = publicSubnet.addNatGateway({ elasticIp });

const routeTable = vpc.addRouteTable('routeTable', {
    routes: [
        Route.local('100.64.1.0/24'),
        Route.to({
            destination: '192.168.0.0/16',
            
            // NatGateway implements IRoutable
            routable: natGateway
        }),
    ],
});

const privateSubnet = vpc.addSubnet({
    cidrBlock: '10.2.0.0/20',
    availabilityZone: 'us-west-2a',
    routeTable,
});

```

To route traffic to a VPN Gateway:

```ts
const routeTable = vpc.addRouteTable('routeTable', {
    routes: [
        Route.local('10.0.0.0/16'),
        
        // Static route to a VPN Gateway
        Route.to({
            destination: '172.31.0.0/24',
            
            // VpnGateway implements IRoutable. 
            // vpc.enableVpnGateway() must have been called before
            routable: vpc.vpnGateway
        }),
    ],

    // To make VPN Gateway routes propagate to this route table
    enableVpnGatewayRoutePropagation: true, // default: false
});

const privateSubnet = vpc.addSubnet({
    cidrBlock: '10.2.0.0/20',
    availabilityZone: 'us-west-2a',
    routeTable,
});

```

[//]: # (TODO: How do add an EC2 instance)

## Using subnets with other components

[//]: # (TODO: Usage with Elastic Load Balancer)


## Internal FAQ

### Why all the `.addXxx()` methods?
To set the VPC as the scope of all the constructs associated with it. This 
is already being done currently and we want to keep it that way.
