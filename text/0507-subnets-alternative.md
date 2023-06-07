Using the new set of L2 constructs, you can achieve the same outcome of the 
`Vpc` construct like this, for one particular availability zone:

```ts
const vpc = new VpcV2(this, 'vpc');

// Public group
const internetGateway = new InternetGateway(this, 'igw');

const publicDefaultRoute = new Route(this, 'publicDefaultRoute', {
  destination: new Ipv4Cidr('0.0.0.0/0'),
  target: internetGateway,
});

const publicRouteTable = new RouteTable(this, 'publicRouteTable', {
  routes: [
    publicDefaultRoute,
  ],
});

const publicSubnet = new Subnet(this, 'publicSubnet', {
  vpc,
  routeTable: publicRouteTable,
  cidrBlock: new Ipv4Cidr('10.0.0.0/24'),
  availabilityZone: Fn.select(0, fn.getAzs()), // or directly, 'us-west-2a'
});

const elasticIp = new ElasticIp(this, 'eip', {
  domain: Domain.VPC,
});

const natGateway = new NatGateway(this, 'NatGateway', {
  subnet: subnet,
  eip: elasticIp,
});


// Private group
const privateRouteTable = new RouteTable(this, 'privateRouteTable', {
  routes: [
    defaultRoute,
  ],
});

const privateSubnet = new Subnet(this, 'privateSubnet', {
  vpc,
  routeTable: privateRouteTable,
  cidrBlock: new Ipv4Cidr('10.0.1.0/24'),
  availabilityZone: Fn.select(0, fn.getAzs()), // or directly, 'us-west-2a'
});

const privateDefaultRoute = new Route(this, 'privateDefaultRoute', {
  destination: new Ipv4Cidr('0.0.0.0/0'),
  target: natGateway,
});
```

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