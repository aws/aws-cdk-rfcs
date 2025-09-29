# Serverless ElastiCache, User and UserGroup - L2 Constructs - RFC

* **Original Author**: @maramure
* **Tracking Issue**: [#762](https://github.com/aws/aws-cdk-rfcs/issues/762)
* **API Bar Raiser**: @otaviomacedo

> [Amazon ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html) is an AWS web service
> that makes it easy to set up, manage, and scale a distributed in-memory data store or cache environment in the cloud.
> It provides a high-performance, scalable, and cost-effective caching solution.
> At the same time, it helps remove the complexity associated with deploying and managing a distributed cache environment.
>
> The L2 Construct delivers a high-level abstraction over AWS Serverless ElastiCache (together with its needed constructs: User and UserGroup)
> using AWS CDK, aimed at simplifying the development of Serverless Redis/Valkey or Memcached caching processes
> with sensible defaults and extensibility. It enables developers to quickly provision
> secure, performant caching layers without needing to dive into the low-level configuration details of ElastiCache.
> The construct encapsulates best practices around VPC networking, subnet group configuration,
> encryption, and IAM policies, significantly reducing the time it takes to get a cache system up and running in production-ready environments.

## Working Backwards

**README:**

### Constructs

#### Serverless Cache

Required fields example:

```ts
new ServerlessCache(this, 'ServerlessCache', {
  vpc: vpc,
});
```

Optional override example (a cache using all possible construct props):

```ts
const vpc = new ec2.Vpc(this, 'Vpc', {
    subnetConfiguration: [
        {
            name: 'Public',
            subnetType: SubnetType.PUBLIC,
        },
        {
            name: 'Private',
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
    ],
});

const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
    vpc,
});

const key = new kms.Key(this, 'Key', {});

new ServerlessCache(this, 'ServerlessCache', {
  engine: CacheEngine.REDIS_LATEST,
  serverlessCacheName: 'serverless-cache-test',
  description: 'Test cache with all properties',
  cacheUsageLimits: {
    dataStorageMinimumSize: Size.gibibytes(1),
    dataStorageMaximumSize: Size.gibibytes(10),
    requestRateLimitMinimum: 1000,
    requestRateLimitMaximum: 5000
  },
  backup: {
    // either create a new cache
    backupTime: events.Schedule.cron({ minute: '0', hour: '4' }),
    backupRetentionLimit: 7,
    backupNameBeforeDeletion: 'serverless-cache-before-deletion',
    // or restore data from other cache
    backupArnsToRestore: [
      'arn:aws:elasticache:us-east-1:123456789012:snapshot:my-snapshot-1'
    ]
  },
  kmsKey: key,
  vpc: vpc,
  vpcSubnets: {
    subnetType: SubnetType.PRIVATE_WITH_EGRESS
  },
  securityGroups: [ securityGroup ],
  userGroup: userGroup,
});
```

Connection with other services example (creating a lambda function and giving it both network access and IAM permissions to access the cache):

```ts
const linkedCache = new ServerlessCache(this, 'LinkedCache', {
    vpc: vpc,
    ...
});
    
const lambdaFunction = new Function(this, 'Function', {
    vpc: vpc,
    environment: {
      LINKED_CACHE_ENDPOINT: linkedCache.serverlessCacheEndpointAddress,
      LINKED_CACHE_PORT: linkedCache.serverlessCacheEndpointPort,
    },
    ...
});

linkedCache.connections.allowDefaultPortFrom(lambdaFunction);

linkedCache.grantConnect(lambdaFunction);
```

#### Serverless Cache Construct Props

```ts
/**
 * Properties for defining a ServerlessCache
 */
export interface ServerlessCacheProps {
  /**
   * The cache engine combined with the version
   * Enum options: VALKEY_DEFAULT, VALKEY_7, VALKEY_8, REDIS_DEFAULT, MEMCACHED_DEFAULT
   * The default options bring the latest versions available.
   *
   * @default when not provided, the default engine would be Valkey, latest version available (VALKEY_DEFAULT)
   */
  readonly engine?: CacheEngine;
  /**
   * Name for the serverless cache
   *
   * @default automatically generated name by Resource
   */
  readonly serverlessCacheName?: string;
  /**
   * A description for the cache
   *
   * @default - No description
   */
  readonly description?: string;
  /**
   * Usage limits for the cache
   *
   * @default - No usage limits
   */
  readonly cacheUsageLimits?: CacheUsageLimitsProperty;
  /**
   * Backup configuration
   *
   * @default - No backups configured
   */
  readonly backup?: BackupSettings;
  /**
   * KMS key for encryption
   *
   * @default - Service managed encryption (AWS owned KMS key)
   */
  readonly kmsKey?: kms.IKey;
  /**
   * The VPC to place the cache in
   */
  readonly vpc: ec2.IVpc;
  /**
   * Which subnets to place the cache in
   *
   * @default - Private subnets with egress
   */
  readonly vpcSubnets?: ec2.SubnetSelection;
  /**
   * Security groups for the cache
   *
   * @default - A new security group is created
   */
  readonly securityGroups?: ec2.ISecurityGroup[];
  /**
   * User group for access control
   *
   * @default - No user group
   */
  readonly userGroup?: IUserGroup;
}
```

#### Serverless Cache Properties & Methods

```ts
/**
 * Represents a Serverless ElastiCache cache
 */
export interface IServerlessCache extends IResource, ec2.IConnectable {
  /**
   * The cache engine used by this cache
   */
  readonly engine?: CacheEngine;
  /**
   * The name of the serverless cache
   *
   * @attribute
   */
  readonly serverlessCacheName: string;
  /**
   * The ARNs of backups restored in the cache
   */
  readonly backupArnsToRestore?: string[];
  /**
   * The KMS key used for encryption
   */
  readonly kmsKey?: kms.IKey;
  /**
   * The VPC this cache is deployed in
   */
  readonly vpc?: ec2.IVpc;
  /**
   * The subnets this cache is deployed in
   */
  readonly subnets?: ec2.ISubnet[];
  /**
   * The security groups associated with this cache
   */
  readonly securityGroups?: ec2.ISecurityGroup[];
  /**
   * The user group associated with this cache
   */
  readonly userGroup?: IUserGroup;
  /**
   * The ARN of the serverless cache
   *
   * @attribute
   */
  readonly serverlessCacheArn: string;

  /**
   * Grant connect permissions to the cache
   */
  grantConnect(grantee: iam.IGrantable): iam.Grant;
  /**
   * Grant the given identity custom permissions
   */
  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;

  /**
   * Return the given named metric for this cache
   */
  metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for cache hit count
   */
  metricCacheHitCount(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for cache miss count
   */
  metricCacheMissCount(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for cache hit rate
   */
  metricCacheHitRate(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for data stored in the cache
   */
  metricDataStored(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for ECPUs consumed
   */
  metricProcessingUnitsConsumed(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for network bytes in
   */
  metricNetworkBytesIn(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for network bytes out
   */
  metricNetworkBytesOut(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for active connections
   */
  metricActiveConnections(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for write request latency
   */
  metricWriteRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for read request latency
   */
  metricReadRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
}
```

#### User

The user authentication system has three types (IAM, Password, and No-Password),
with each type implemented as a separate construct extending the `UserBase` class.

Required fields examples:

```ts
new IamUser(this, 'IamUser', {
  userId: 'test-iam-user',
  accessControl: AccessControl.fromAccessString('on ~* +@read')
});

new PasswordUser(this, 'PasswordUser', {
  userId: 'test-password-user',
  accessControl: AccessControl.fromAccessString('on ~* +@read'),
  passwords: SecretValue.secretsManager('password1234567891011')
});

new NoPasswordUser(this, 'NoPasswordUser', {
  userId: 'test-no-password-user',
  accessControl: AccessControl.fromAccessString('on ~* +@read')
});
```

Optional override examples (a user with all possible construct props):

```ts
new IamUser(this, 'IamUser', {
  engine: UserEngine.VALKEY,
  userId: 'test-iam-user',
  userName: 'test-iam-user',
  accessControl: AccessControl.fromAccessString('on ~* +@read')
});

new PasswordUser(this, 'PasswordUser', {
  engine: UserEngine.REDIS,
  userId: 'test-password-user',
  userName: 'test-password-user-name',
  accessControl: AccessControl.fromAccessString('on ~app:* +@read +@write'),
  passwords: SecretValue.secretsManager('password1234567891011')
});

new NoPasswordUser(this, 'NoPasswordUser', {
  engine: UserEngine.REDIS,
  userId: 'test-no-password-user',
  userName: 'test-no-password-user-name',
  accessControl: AccessControl.fromAccessString('on ~* +@all')
});
```

An `IamUser` needs separate permissions to connect to the cache.

```ts
declare const user: IamUser;
declare const serverlessCache: ServerlessCache;
declare const role: iam.Role;

/**
 * Grant "elasticache:Connect" action permissions to role.
 */
user.grantConnect(role);
serverlessCache.grantConnect(role);
```

#### User Construct Props

```ts
/**
 * Properties for defining an ElastiCache base user.
 */
export interface UserBaseProps {
  /**
   * The engine type for the user.
   * Enum options: UserEngine.VALKEY, UserEngine.REDIS.
   *
   * @default UserEngine.VALKEY.
   */
  readonly engine?: UserEngine;
  /**
   * The ID of the user.
   */
  readonly userId: string;
  /**
   * Access control configuration for the user.
   */
  readonly accessControl: AccessControl;
}
```

```ts
/**
 * Properties for defining an ElastiCache user with IAM authentication.
 */
export interface IamUserProps extends UserBaseProps {
  /**
   * The name of the user.
   *
   * @default - Same as userId.
   */
  readonly userName?: string;
}
```

```ts
/**
 * Properties for defining an ElastiCache user with password authentication.
 */
export interface PasswordUserProps extends UserBaseProps {
  /**
   * The name of the user.
   *
   * @default - Same as userId.
   */
  readonly userName?: string;
  /**
   * The passwords for the user.
   * Password authentication requires using 1-2 passwords.
   */
  readonly passwords: SecretValue[];
}
```

```ts
/**
 * Properties for defining an ElastiCache user with no password authentication.
 */
export interface NoPasswordUserProps extends UserBaseProps {
  /**
   * The name of the user.
   *
   * @default - Same as userId.
   */
  readonly userName?: string;
}
```

#### User Properties

```ts
/**
 * Represents an ElastiCache base user.
 */
export interface IUser extends IResource {
  /**
   * The user's ID.
   *
   * @attribute
   */
  readonly userId: string;
  /**
   * The engine for the user.
   */
  readonly engine?: UserEngine;
  /**
   * The user's name.
   *
   * @attribute
   */
  readonly userName?: string;
  /**
   * The user's ARN.
   *
   * @attribute
   */
  readonly userArn: string;
}
```

#### UserGroup

Required fields example (Valkey user groups can be created with 0 users;
Redis user groups need to contain a user with the user name "default"):

```ts
new UserGroup(this, 'UserGroup', {});
```

Creation example using all possible construct props:

```ts
const userGroup = new UserGroup(this, 'UserGroup', {
    userGroupName: 'user-group',
    engine: UserEngine.VALKEY,
    users: [user1, user2]
});

userGroup.addUser(user3);

new ServerlessCache(this, 'UserGroupCache', {
    userGroup: userGroup,
    ...
});
```

#### UserGroup Construct Props

```ts
/**
 * Properties for defining an ElastiCache UserGroup
 */
export interface UserGroupProps {
  /**
   * Enforces a particular physical user group name.
   * @default <generated>
   */
  readonly userGroupName?: string;
  /**
   * The engine type for the user group
   * Enum options: UserEngine.VALKEY, UserEngine.REDIS
   *
   * @default UserEngine.VALKEY
   */
  readonly engine?: UserEngine;
  /**
   * List of users inside the user group
   *
   * @default - no users
   */
  readonly users?: IUser[];
}
```

#### UserGroup Properties & Methods

```ts
/**
 * Represents an ElastiCache UserGroup
 */
export interface IUserGroup extends IResource {
  /**
   * The name of the user group
   *
   * @attribute
   */
  readonly userGroupName: string;
  /**
   * The engine type for the user group
   */
  readonly engine?: UserEngine;
  /**
   * List of users in the user group
   */
  readonly users?: IUser[];
  /**
   * The ARN of the user group
   *
   * @attribute
   */
  readonly userGroupArn: string;
  /**
   * Add a user to this user group
   *
   * @param user The user to add
   */
  addUser(user: IUser): void;
}
```

### Objects Details

#### CacheUsageLimitsProperty

This class defines the usage limits for a ServerlessCache instance.
It allows setting limits for both data storage and request rate (ElastiCache Processing Units) consumption.

```ts
/**
 * Usage limits configuration for ServerlessCache
 */
export interface CacheUsageLimitsProperty {
  /**
   * Minimum data storage size (1 GB)
   *
   * @default - No minimum limit
   */
  readonly dataStorageMinimumSize?: Size;
  /**
   * Maximum data storage size (5000 GB)
   *
   * @default - No maximum limit
   */
  readonly dataStorageMaximumSize?: Size;
  /**
   * Minimum request rate limit (1000 ECPUs per second)
   *
   * @default - No minimum limit
   */
  readonly requestRateLimitMinimum?: number;
  /**
   * Maximum request rate limit (15000000 ECPUs per second)
   *
   * @default - No maximum limit
   */
  readonly requestRateLimitMaximum?: number;
}
```

#### BackupSettings

This class defines the configuration for backup management in the ServerlessCache construct.

```ts
/**
 * Backup configuration for ServerlessCache
 */
export interface BackupSettings {
  /**
   * Automated daily backup UTC time
   *
   * @default - No automated backups
   */
  readonly backupTime?: events.Schedule;
  /**
   * Number of days to retain backups (1-35)
   *
   * @default - Backups are not retained
   */
  readonly backupRetentionLimit?: number;
  /**
   * Name for the final backup taken before deletion
   *
   * @default - No final backup
   */
  readonly backupNameBeforeDeletion?: string;
  /**
   * ARNs of backups from which to restore data into the new cache
   *
   * @default - Create a new cache with no existing data
   */
  readonly backupArnsToRestore?: string[];
}
```

#### AccessControl

This class provides type-safe access control methods that define user permissions
for Redis/Valkey commands and key patterns using `ACL syntax`.

```ts
/**
 * Access control configuration for ElastiCache users.
 */
export abstract class AccessControl {
  /**
   * Create access control from an access string.
   *
   * @param accessString The access string defining user permissions.
   */
  public static fromAccessString(accessString: string): AccessControl {
    return new AccessControlString(accessString);
  }

  /**
   * The access string that defines user's permissions.
   */
  public abstract readonly accessString: string;
}
```

#### AccessControlString

This class provides access control implementation that stores `ACL string` configuration.

```ts
/**
 * Access control implementation using a raw access string.
 */
class AccessControlString extends AccessControl {
  /**
   * The access string that defines user's permissions.
   */
  public readonly accessString: string;

  constructor(accessString: string) {
    super();
    this.accessString = accessString;
  }
}
```

### Enums Details

The enums in this construct are intended to provide a way to reduce deployment time errors.
Many of the L1 constructs will accept strings however there are only certain valid options.

#### CacheEngine

This enum defines the supported cache engines together with the available versions matching the UI behavior.

```ts
/**
 * Supported cache engines together with available versions.
 */
export enum CacheEngine {
  /**
   * Valkey engine, latest major version available, minor version is selected automatically
   */
  VALKEY_LATEST = 'valkey',
  /**
   * Valkey engine, major version 7, minor version is selected automatically
   */
  VALKEY_7 = 'valkey_7',
  /**
   * Valkey engine, major version 8, minor version is selected automatically
   */
  VALKEY_8 = 'valkey_8',
  /**
   * Redis engine, latest major version available, minor version is selected automatically
   */
  REDIS_LATEST = 'redis',
  /**
   * Redis engine, major version 7, minor version is selected automatically
   */
  REDIS_7 = 'redis_7',
  /**
   * Memcached engine, latest major version available, minor version is selected automatically
   */
  MEMCACHED_LATEST = 'memcached',
}
```

#### DataStorageUnit

This enum defines the unit of measurement for data storage in the `ServerlessCache` construct. Currently, it only includes gigabytes,
but it's structured as an enum to allow for potential future expansions.

```ts
/**
 * Unit types for data storage usage limits
 */
export enum DataStorageUnit {
  /**
   * Gigabytes
   */
  GIGABYTES = 'GB',
}
```

#### UserEngine

This enum defines the supported engines needed for `User` and `UserGroup` configuration
(only Redis and Valkey; Memcached doesn’t support users/userGroups).

```ts
/**
 * Engine type for ElastiCache users and user groups
 */
export enum UserEngine {
  /**
   * Valkey engine
   */
  VALKEY = 'valkey',

  /**
   * Redis engine
   */
  REDIS = 'redis',
}
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @otaviomacedo
```

## Public FAQ

### What are we launching today?

> Amazon ElastiCache - new AWS CDK L2 Construct

### Why should I use this construct?

> This CDK L2 Construct can be used to deploy Amazon Serverless ElastiCache for Redis/Valkey and Memcached.
> Serverless ElastiCache automatically handles capacity provisioning and management, providing a fully managed solution
> that scales automatically with your application's demands.
> This construct simplifies the deployment by managing the essential components:
> Serverless Cache Configuration, Users, and User Groups.
> You can easily create serverless caches with proper access controls, without dealing with the complexity of
> managing individual cache nodes or capacity planning.
>
> Key benefits:
>
> * It simplifies the deployment of Serverless ElastiCache instances with built-in security controls
> * It provides streamlined user and access management for your cache resources
> * It ensures consistent deployment patterns across your applications
> * Allows you to integrate serverless caching within your infrastructure as code
> * Reduces time to implement and configure Serverless ElastiCache
> * Provides a straightforward interface for both Redis/Valkey and Memcached implementations
> * Enables rapid deployment of production-ready caching solutions
>
> This construct is particularly valuable for teams looking to implement serverless caching
> while maintaining security best practices, especially in microservices and serverless architectures
> where managing traditional cache clusters would be overhead.

### How is this different from using CFN/Terraform/CloudControl API?

> This L2 construct differs significantly from raw CloudFormation by providing type safety with compile-time validation
> and intelligent defaults like auto-creating security groups, eliminating verbose template configurations.
> Compared to Terraform, it offers seamless integration with the AWS CDK ecosystem and built-in CloudWatch metrics
> methods without additional setup. Unlike the CloudControl API, it provides higher-level abstractions
> focused on developer intent and validates configurations at synthesis time to prevent deployment failures.
> The overall value proposition is reducing ElastiCache setup from many lines of infrastructure code to fewer lines
> while preventing common misconfigurations through built-in validations and intelligent defaults.

## Internal FAQ

### Why are we doing this?

> * To provide a CDK native interface for Amazon Serverless ElastiCache
> * To provide a way to deploy Serverless ElastiCache deterministically,
> with proper user access controls and security configurations out of the box

### Is this a breaking change?

> No, this is not a breaking change.
> It's a new L2 construct that provides new functionality without affecting existing implementations.

### What is not in scope?

> Cluster-Mode ElastiCache resources and their associated components are not in scope for this effort.
> Developers should use existing methods or L1 constructs to create these resources.
> Specifically, the following resources are excluded:
>
> Cache Node Management Resources:
>
> * `CfnCacheCluster` (CacheCluster): Traditional node-based cache clusters
> * `CfnReplicationGroup` (ReplicationGroup): For Redis/Valkey replication
> * `CfnGlobalReplicationGroup` (GlobalReplicationGroup): For global Redis/Valkey deployments
> * `CfnParameterGroup` (ParameterGroup): For controlling the parameters of a cache cluster
>
> Network and Security Resources:
>
> * `CfnSubnetGroup` (SubnetGroup): Serverless ElastiCache takes a list of subnets directly during creation (does not use a subnet group resource)
> * `CfnSecurityGroup` (SecurityGroup): Can be imported directly from EC2
> * `CfnSecurityGroupIngress` (SecurityGroupIngress): Can also be imported directly from EC2
>
> The rationale for these exclusions:
>
> * The project scope is specifically focused on Serverless ElastiCache implementation
> * Traditional node-based resources would significantly expand the project scope
> * Some L1 constructs don't expose meaningful/configurable properties for L2 abstraction
> * Security and networking components can be better managed through existing AWS constructs
>
> Developers can still use L1 constructs to implement these resources if needed.
> The focus remains on providing a streamlined experience for Serverless ElastiCache deployment
> while maintaining clear boundaries around the project scope.

### What are the drawbacks of this solution?

> * Best practices and common use cases are still emerging
> * Feature set may evolve significantly over time
> * Not suitable for users requiring fine-grained control over cache nodes
