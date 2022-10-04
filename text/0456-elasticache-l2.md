# Amazon ElastiCache L2

* **Original Author(s):**: @dbartholomae
* **Tracking Issue**: #456
* **API Bar Raiser**: @corymhall

The `aws-elasticache` construct library allows you to create Amazon ElastiCache 
data stores with just a few lines of code. As with most construct libraries,
you can also easily define permissions and metrics using a simple API.

The amount of effort needed to create these resources is about the same as doing
it using the AWS console, sometimes even less due to easier set up of VPC connectivity.

## Working Backwards

### CHANGELOG

`feat(elasticache): RedisReplicationGroup L2`

### README

---

# Amazon ElastiCache Construct Library

[Amazon ElastiCache](https://aws.amazon.com/elasticache/) is a fully managed,
in-memory caching service supporting flexible, real-time use cases. You can use
ElastiCache for caching, which accelerates application and database performance,
or as a primary data store for use cases that don't require durability like
session stores, gaming leaderboards, streaming, and analytics. ElastiCache is
compatible with Redis and Memcached.

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk)
project. It allows you to define ElastiCache Redis replication groups.

## Constructs

### Defining a RedisReplicationGroup

In order to define a `RedisReplicationGroup` (Redis (cluster mode disabled)),
you must specify the vpc to run the instance in.

```ts
import * as elasticache from '@aws-cdk/aws-elasticache';
import * as ec2 from '@aws-cdk/aws-ec2';

const vpc = new ec2.Vpc(this, 'Vpc');
new elasticache.RedisReplicationGroup(this, "RedisReplicationGroup", {
  engineVersion: elasticache.RedisEngineVersion.VER_6_2,
  vpc,
});
```

The above example implicitly defines the following resources:

- A `VPC` with private subnets.
- A `SubnetGroup` for all private subnets of the Vpc.
- A `SecurityGroup` in the Vpc.
- A `ReplicationGroup` with the security group attached, one shard with a Redis 
  engine version 6.2 of size `cache.t2.micro`.

### Defining a RedisClusterReplicationGroup

A `RedisClusterReplicationGroup` is similar to a `RedisReplicationGroup`, but
with multiple shards. The documentation calls them "Redis (cluster mode enabled)".
The main difference is that a `RedisClusterReplicationGroup` requires a
`numNodeGroups` to be set to a value of 2 or higher. Only `RedisClusterReplicationGroup`s
can have `automaticFailoverEnabled` and exposes a `configurationEndpoint`,
but cannot have a `snapshottingClusterId` set.

### Other constructs

The following resources are used but will not be exposed:

- SubnetGroup: Created based on the given vpcs subnets
- ParameterGroup: Created based on the engineVersion and whether cluster-mode is enabled

This RFC does not yet cover:

- CacheCluster
- GlobalReplicationGroup
- SecurityGroup
- User
- UserGroup

## Metrics

ElastiCache provides metrics that enable you to monitor your clusters.
You can access these metrics through CloudWatch. ElastiCache provides both
host-level metrics (for example, CPU usage) and metrics that are specific to
the cache engine software (for example, cache gets and cache misses).
These metrics are measured and published for each Cache node in 60-second
intervals.

CDK provides methods for accessing metrics with default configuration,
such as `metricCPUUtilization`, and `metricMemory`. CDK also provides a generic
`metric` method that can be used to produce metric configurations for any [metric
provided by Amazon ElastiCache for Redis](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/CacheMetrics.Redis.html).

## Granting application access to a RedisReplicationGroup

While ElastiCache manages rights to change the ElastiCache infrastructure via
IAM, it does not implement read and write permission management the same way.
Instead, it mainly relies on ensuring network boundaries, with an optional
`AUTH` token that can be required for each request. In newer versions, there is
also Role-Based Access Control and Access Control Lists as an option to
authenticate.

### Infrastructure management access

IAM roles, users or groups which need to manage the ElastiCache resources should
be granted IAM permissions.

Any object that implements the `IGrantable` interface (i.e., has an associated principal)
can be granted permissions to a `RedisReplicationGroup` by calling:

- `grant(principal, ...actions)` - grants the principal permission to a custom
  set of actions

```ts
import * as iam from '@aws-cdk/aws-iam';
const lambdaRole = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});

// Give the role permissions to describe cache clusters
replicationGroup.grant(lambdaRole, 'elasticache:DescribeCacheClusters');
```

### Network access

Any object that implements the `IConnectable` interface can be given access to
the primary endpoint of a Redis Replication Group via

```ts
import * as elasticache from '@aws-cdk/aws-elasticache';
declare const vpc: ec2.Vpc;
declare const loadBalancer: elbv2.ApplicationLoadBalancer;

const replicationGroup = new elasticache.RedisReplicationGroup(this, "RedisReplicationGroup", {
  engineVersion: elasticache.RedisEngineVersion.VER_6_2,
  vpc,
});
replicationGroup.allowPrimaryAccessFrom(loadBalancer);
```

Similarly, there are `allowReaderAccessFrom` and (for `RedisClusterReplicationGroup`)
`allowConfigurationAccessFrom`. These give access to the respective endpoints
on their respective ports.

### Auth token

You can use a Secret to set an AuthToken and share it with other services:

```ts
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as elasticache from '@aws-cdk/aws-elasticache';

declare const vpc: ec2.Vpc;

const authToken = new Secret(this, 'Secret');
const replicationGroup = new elasticache.RedisReplicationGroup(this, "RedisReplicationGroup", {
  engineVersion: elasticache.RedisEngineVersion.VER_6_2,
  authToken: authToken.secretValue,
  vpc,
});
```

For security reasons, you cannot assign a string to the authToken prop.
See the documentation on `SecretValue` for more details.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

- [ ] Signed-off by API Bar Raiser @corymhall

## Public FAQ

### What are we launching today?

We are launching the `RedisReplicationGroup` L2 construct for the
Amazon ElastiCache CDK module (`@aws-cdk/aws-elasticache`). This launch supports
Amazon ElastiCache Redis replication groups (distributed in-memory data store
or cache environment) within the CDK.

### Why should I use this feature?

Setting up AWS ElastiCache with AWS CDK minimizes work needed to provide access
to other services and manage distributed in-memory data store or cache
environments in the cloud.

## Internal FAQ

### Why are we doing this?

There is a community offer to support with implementation right now.

The [tracking Github issue for the module](https://github.com/aws/aws-cdk/issues/6908) is
in the top 10 upvoted issues (+123) with [previous approaches to implement an L2](https://github.com/aws/aws-cdk/issues/8196)
that were abandoned.

Setting up a CacheCluster requires setting up separate SubnetGroups that could
actually be fully automated away in CDK. Managing VPCs and SecurityGroups
becomes significant easier compared to manual setup or setup with CloudFormation.

### Why should we *not* do this?

The API design is based on one customer implementation only, so it might be
missing insights from other use cases.

There are currently not enough resources to implement the full design, only
part of it. Implementing the rest of the design later on might lead to
information loss between now and then.

### What is the technical solution (design) of this feature?

- `IEndpoint` -- interface to manage addresses and ports

  ```ts
    interface IEndpoint {
      address: string;
      port: number;
    }
  ```

- `IRedisReplicationGroup` -- interface for defined and imported ReplicationGroups
  (cluster mode disabled)

  ```ts
  interface IRedisReplicationGroup extends
      // Since RedisReplicationGroup will extend Resource
      cdk.IResource,
      // To open network conns between ElastiCache and services that should access it
      ec2.IConnectable {
    readonly primaryEndpoint: IEndpoint;
    readonly readerEndpoint: IEndpoint;
    allowReaderAccessFrom(peer: IConnectable, description?: string): void;
    allowPrimaryAccessFrom(peer: IConnectable, description?: string): void;
    grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
    metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    // Some canned metrics as well like `metricCPUUtilization`
  }
  ```

- `IRedisClusterReplicationGroup` -- interface for defined and imported ReplicationGroups
  (cluster mode enabled)

  ```ts
  interface IRedisClusterReplicationGroup extends IRedisReplicationGroup {
    readonly configurationEndpoint: IEndpoint;
    allowConfigurationAccessFrom(peer: IConnectable, description?: string): void;
  }
  ```

- `RedisReplicationGroupBase` -- abstract base ReplicationGroup class with some helper
  props/methods

  ```ts
  enum CacheNodeType {
    M6G_LARGE = 'cache.m6g.large',
    // ...
  }
  
  enum RedisEngineVersion {
    VER_6_2 = '6.2',
    // ...
  }

  interface RedisReplicationGroupBaseProps {
    engineVersion: RedisEngineVersion,
    // Used to define whether cluster mode is enabled or not
    numNodeGroups: number,

    authToken?: SecretValue,
    transitEncryptionEnabled?: boolean,

    kmsKey?: IKey,
    atRestEncryptionEnabled?: boolean,

    // This also automatically sets dataTieringEnabled
    cacheNodeType?: CacheNodeType,

    // By default derived from the node id in the stack
    replicationGroupDescription?: string,
    autoMinorVersionUpgrade?: boolean,
    multiAzEnabled?: boolean,
    notificationTopic?: ITopic,
    numCacheClusters?: number,
    port?: number,
    preferredCacheClusterAZs?: string[],
    replicasPerNodeGroup?: number,
    replicationGroupId?: string,
  
    // Names that are reserved to be implemented over time
    globalReplicationGroup: IGlobalReplicationGroup,
    logDeliveryConfigurations: ILogDeliveryConfiguration[],
    nodeGroupConfiguration: INodeGroupConfiguration,
    preferredMaintenanceWindow: IPreferredMaintenanceWindow,
    primaryClusterId: string,
    snapshot: ISnapshot,
    userGroups: UserGroup[]
  }
  abstract class RedisReplicationGroupBase implements IRedisReplicationGroup,
      // Since RedisReplicationGroup will extend Resource
      cdk.IResource,
      // To open network conns between ElastiCache and services that should access it
      ec2.IConnectable,
      // RedisReplicationGroup allows tagging
      cdk.ITaggable {
    public readonly clusterEnabled: boolean;
    constructor(protected readonly props: RedisReplicationGroupBaseProps = {}) {}
    grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {};
    allowPrimaryAccessFrom(peer: IConnectable, description = "Redis access"): void {};
    allowReaderAccessFrom(peer: IConnectable, description?: string): void {};
    metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {};
    // Some canned metrics as well like `metricCPUUtilization`
  }
  ```

#### Other modules

No other modules are affected.

### Is this a breaking change?

No.

### What are the drawbacks of this solution?

No problems or risks of implementing this feature as a whole, though the design outlined
above may have drawbacks, as detailed below in "alternative solutions".

### What alternative solutions did you consider?

1. Have fewer default parameters and more required parameters.
   This would make the resource harder to use but might prevent situations
   where the user is relying on defaults without understanding them. The choice
   of default parameters tries to minimize these risks.
2. Implement `RedisReplicationGroup` and `RedisClusterReplicationGroup` as a
   single construct. This is closer to the interface given by CloudFormation,
   but is less intuitive, as both the inputs and outputs differ between
   Redis (cluster mode enabled) and Redis (cluster mode disabled).

### What is the high level implementation plan?

The first implementation will focus on Redis replication groups and related
resources only, which will be tested with a beta customer.

There is no timeline for implementing the other resources, but the library
should give structure so that other resources can be implemented with less
effort than before when needed.

### Are there any open issues that need to be addressed later?

The implementation only covers Redis replication groups. The rest of the
implementation needs to be handled later.
