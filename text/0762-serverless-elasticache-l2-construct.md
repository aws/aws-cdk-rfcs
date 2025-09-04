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
new ServerlessCache(this, 'DefaultCache', {
    vpc: vpc, 
});
```

Optional override example (a cache using all possible properties):

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

new ServerlessCache(this, 'FullCache', {
    engine: CacheEngine.REDIS_DEFAULT,
    serverlessCacheName: 'full-test-cache',
    description: 'Test cache with all properties',
    cacheUsageLimits: {
        dataStorageMinimumSize: Size.gibibytes(1),
        dataStorageMaximumSize: Size.gibibytes(10),
        ecpuPerSecondMinimum: 1000,
        ecpuPerSecondMaximum: 5000
    },
    backup: {
      // either create a new cache
      dailySnapshotTime: SnapshotSchedule.at(3, 0),
      snapshotRetentionLimit: 7,
      finalSnapshotName: 'full-cache-final-snapshot',
      // or restore data from other cache
      snapshotArnsToRestore: [
        'arn:aws:elasticache:us-east-1:123456789012:snapshot:my-snapshot-1'
      ] 
    },
    vpc: vpc,
    vpcSubnets: {
      subnetType: SubnetType.PRIVATE_WITH_EGRESS
    },
    securityGroups: [ securityGroup ],
    userGroup: userGroup,
    kmsKey: cacheKey,
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
export interface ServerlessCacheProps {
  /** 
   * The cache engine combined with the version. 
   * Enum options: VALKEY_DEFAULT, VALKEY_7, VALKEY_8, REDIS_DEFAULT, MEMCACHED_DEFAULT
   * The default options bring the latest versions available.
   * 
   * @default when not provided, the default engine would be Valkey, latest version available
   */  
  readonly engine?: CacheEngine;
  /** 
   * Name for the serverless cache. 
   * @default automatically generated name by Resource
   */ 
  readonly serverlessCacheName?: string;
  /**
   * A description of the purpose of the Serverless Cache.
   * @default none
   */
  readonly description?: string;
  /**
   * Usage limits for the cache.
   *
   * Allows setting minimum and maximum values for data storage (1-5000 GB)
   * and ECPU per second (1000-15000000).
   *
   * @default no usage limits are set
   */       
  readonly cacheUsageLimits?: CacheUsageLimitsProperty;
  /**
   * Backup and snapshot configuration.
   *
   * Includes daily snapshot time, retention limit (1-35 days),
   * final snapshot name, and snapshot ARNs to restore from.
   * 
   * @default no automatic backup configuration is set
   */   
  readonly backup?: BackupSettings;
  /**
   * KMS encryption key for the cache.
   *
   * @default AWS owned KMS key
   */
  readonly kmsKey?: kms.IKey;
  /**
   * The VPC in which to create the serverless cache.
   */
  readonly vpc: ec2.IVpc;
  /**
   * Where to place the cache within the VPC.
   *
   * @default currently all subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection;
  /**
   * Security Group to assign to this cache.
   *
   * @default create new security group
   */
  readonly securityGroups?: ec2.ISecurityGroup[];
  /**
   * The user group associated with the serverless cache.
   *
   * @default none
   */
  readonly userGroup?: IUserGroup;
}
```

#### Serverless Cache Properties & Methods

```ts
export interface IServerlessCache extends IResource, ec2.IConnectable {
  /**
   * Attributes
   */
  readonly engine: CacheEngine;
  readonly serverlessCacheName: string;
  readonly snapshotArnsToRestore?: string[];
  readonly kmsKey?: kms.IKey;
  readonly vpc: ec2.IVpc;
  readonly subnets?: ec2.ISubnet[];
  readonly securityGroups?: ec2.ISecurityGroup[];
  readonly userGroupId?: string;


  readonly serverlessCacheArn: string;
  
  /**
   * Grant methods
   */
  grantConnect(grantee: iam.IGrantable): iam.Grant;
  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;

  /**
   * Metrics methods
   */
  metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricCacheHits(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricCacheMisses(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricCacheHitRate(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricNetworkBytesIn(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricNetworkBytesOut(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricActiveConnections(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricSuccessfulWriteRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricSuccessfulReadRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
}
```

#### User

Required fields example:

```ts
new User(this, 'User1', {
    userId: 'test-user-1'
});
```

Optional override example (a user with all possible properties):

```ts
new User(this, 'User2', {
    engine: UserEngine.REDIS,
    userId: 'test-user-2',
    userName: 'testuser2',
    accessControl: AccessControl.accessString('on ~* +@read -@write'),
    authentication: Authentication.password(SecretValue.secretsManager('password1234567891011')) 
});
```

#### User Construct Props

```ts
export interface UserProps {
  /**
   * The user engine.
   * Enum options: VALKEY, REDIS
   * 
   * @default when not provided, the default engine would be Valkey
   */
  readonly engine?: UserEngine;
  /**
   * The user's unique identifier.
   */
  readonly userId: string;
  /**
   * The user's name.
   *
   * @default when not provided, it uses the userId as the userName
   */
  readonly userName?: string;
  /**
   * Authentication configuration for the user.
   *
   * Supports password-based, IAM, or no-password authentication types.
   *
   * @default IAM authentication
   */
  readonly authentication?: Authentication;
  /**
   * Access control configuration defining user permissions.
   *
   * For now, only one predefined method is supported: AccessControl.fromAclString() for custom ACL syntax.
   * If a better approach is not discovered, the following methods could be implemented in the future:
   * AccessControl.readOnly(), AccessControl.fullAccess(), AccessControl.safeAccess().
   *
   * @default user has no permissions (off -@all)
   * (I didn't do anything for this. Cloud Formation does this if this field remains undefined when creating the CfnUser.
   * Should I do something else??)
   */
  readonly accessControl?: AccessControl;
}
```

#### User Properties & Methods

```ts
export interface IUser extends IResource {
  readonly userId: string;
  // I don't put here userName and authentication because I won't know how to set them in the import methods 
  // (They can't be known from the arn and I would need to make assumptions -> wrong approach)

  readonly userArn: string;
}
```

#### UserGroup

Creation example:

```ts
const userGroup = new UserGroup(this, 'UserGroup', {
    userGroupId: 'user-group',
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
export interface UserGroupProps {
  /** 
   * The user group engine. 
   * Enum options: VALKEY, REDIS
   * 
   * @default when not provided, the default engine would be Valkey
   */ 
  readonly engine?: UserEngine;
  /**
   * The user group's unique identifier.
   */  
  readonly userGroupId: string;
  /**
   * The list of users that belong to the user group.
   *
   * @default no users are included in the group
   */
  readonly users?: IUser[];
}
```

#### UserGroup Properties & Methods

```ts
export interface IUserGroup extends IResource {
  readonly engine: UserEngine;
  readonly userGroupId: string;
  readonly users?: IUser[];

  readonly userGroupArn: string;

  /**
   * Add a user to this user group.
   *
   * @param user The user to add to the group
   */ 
  addUser(user: IUser): void;
}
```

### Objects Details

#### CacheUsageLimitsProperty

This class defines the usage limits for a `ServerlessCache` instance.
It allows setting limits for both data storage and ECPU (ElastiCache Processing Units) consumption.

```ts
/**
 * Usage limits configuration for ServerlessCache.
 * */ 
 export interface CacheUsageLimitsProperty {
  /**
   * Minimum value for data storage (1 GB).
   */      
  readonly dataStorageMinimumSize?: Size,
  /**
   * Maximum value for data storage (5000 GB).
   */  
  readonly dataStorageMaximumSize?: Size,
  /**
   * Minimum value for ECPU per second (1000).
   */    
  readonly ecpuPerSecondMinimum?: number,
  /**
   * Maximum value for ECPU per second (15000000).
   */  
  readonly ecpuPerSecondMaximum?: number
}
```

#### SnapshotSchedule

This class splits a time string into hours and minutes, providing a more user-friendly way to specify snapshot schedules
instead of handling raw time string formats.

```ts
/**
 * Schedule for daily snapshots.
 *
 * @example dailySnapshotTime: SnapshotSchedule.at(15, 45) // 3:45 PM
 */
export class SnapshotSchedule {
  /**
   * Create a schedule at a specific hour and minute.
   *
   * @param hour Hour of the day (0-23)
   * @param minute Minute of the hour (0-59)
   * @returns A new SnapshotSchedule instance
   *
   * @throws Error if hour is not between 0-23 or minute is not between 0-59
   */       
  public static at(hour: number, minute: number): SnapshotSchedule {
    return new SnapshotSchedule(hour, minute);
  }

  private constructor(
      /** 
       * Hour of the day (0-23) 
       */ 
      public readonly hour: number,
      /** 
       * Minute of the hour (0-59) 
       */  
      public readonly minute: number
  ) {
    if (hour < 0 || hour > 23) {
      throw new Error('Hour must be between 0 and 23');
    }
    if (minute < 0 || minute > 59) {
      throw new Error('Minute must be between 0 and 59');
    }
  }

  /**
   * Format as HH:MM string for CloudFormation.
   *
   * @returns Time string in HH:MM format (e.g., "03:30", "15:45")
   */   
  public toTimeString(): string {
    return `${this.hour.toString().padStart(2, '0')}:${this.minute.toString().padStart(2, '0')}`;
  }
}
```

#### BackupSettings

This class defines the configuration for backup and snapshot management in the `ServerlessCache` construct.

```ts
/**
 * Backup and snapshot configuration for ServerlessCache.
 */ 
export interface BackupSettings {
  /**
   * Daily snapshot time (hour and minutes).
   */    
  readonly dailySnapshotTime?: SnapshotSchedule,
  /**
   * Number of days to retain snapshots (1-35).
   */    
  readonly snapshotRetentionLimit?: number,
  /**
   * Name for the final snapshot when cache is deleted.
   */            
  readonly finalSnapshotName?: string,
   /**
    * ARNs of snapshots to restore from.
    */  
  readonly snapshotArnsToRestore?: string[]
}
```

#### Authentication

This class defines the authentication configuration for a `User`, supporting
`password-based`, `IAM`, or `no-password` authentication types.
Provides type-safe authentication methods that prevent configuration errors.
Each authentication type enforces its own requirements (password authentication requires 1-2 passwords, while IAM and no-password types cannot accept passwords).

```ts
/**
 * Authentication configuration for ElastiCache users.
 * @example Authentication.password('password1234567891011')
 * @example Authentication.iam()
 * @example Authentication.noPassword()
 */  
export abstract class Authentication {
  /**
   * Create password-based authentication.
   *
   * @param passwords One or two passwords for the user (1-2 passwords allowed)
   * @returns Password authentication instance
   *
   * @throws Error if no passwords or more than 2 passwords are provided
   */ 
  public static password(...passwords: SecretValue[]): Authentication {
    if (passwords.length === 0 || passwords.length > 2) {
      throw new Error('Password authentication requires 1-2 passwords');
    }
    return new PasswordAuthentication(passwords);
  }
  
  /**
   * Create no-password authentication.
   *
   * @returns No-password authentication instance
   */    
  public static noPassword(): Authentication {
    return new NoPasswordAuthentication();
  }

  /**
   * Create IAM-based authentication.
   *
   * @returns IAM authentication instance
   */      
  public static iam(): Authentication {
    return new IamAuthentication();
  }
  
  /**
   * Convert authentication configuration to CloudFormation format.
   *
   * @internal This method is used internally by the CDK construct.
   */
  public abstract convertToCloudFormation(): any;
}
```

#### PasswordAuthentication

This class stores user credentials and converts them to the appropriate
`CloudFormation` format for `ElastiCache` user configuration.

```ts
/**
 * Password-based authentication implementation that stores user credentials.
 */
class PasswordAuthentication extends Authentication {
  /**
   * Creates password authentication with the provided credentials.
   *
   * @param passwords Array of 1-2 passwords for the user
   */  
  constructor(public readonly passwords: SecretValue[]) {
    super();
  }

  /**
   * Converts password authentication to CloudFormation format.
   *
   * @returns CloudFormation authentication configuration object
   */    
  public convertToCloudFormation() {
    return {
      authenticationMode: {
        Type: 'password',
        Passwords: this.passwords.map(p => p.unsafeUnwrap())
      },
      noPasswordRequired: false,
      passwords: undefined  
    };
  }
}
```

#### NoPasswordAuthentication

This class configures `ElastiCache` users to access the cache without requiring any password credentials.

```ts
/**
 * No-password authentication implementation that allows access without credentials.
 */  
class NoPasswordAuthentication extends Authentication {
  /**
   * Converts no-password authentication to CloudFormation format.
   *
   * @returns CloudFormation authentication configuration object
   */     
  public convertToCloudFormation() {
    return {
      authenticationMode: {
        Type: 'no-password-required'
      },
      noPasswordRequired: true,
      passwords: undefined
    };
  }
}
```

#### IamAuthentication

This class implements `AWS Identity and Access Management` for secure, role-based access
to ElastiCache resources without storing passwords.

```ts
/**
 * IAM-based authentication implementation that uses AWS Identity and Access Management.
 */ 
class IamAuthentication extends Authentication {
  /**
   * Converts IAM authentication to CloudFormation format.
   *
   * @returns CloudFormation authentication configuration object
   */  
  public convertToCloudFormation() {
    return {
      authenticationMode: {
        Type: 'iam'
      },
      noPasswordRequired: false,
      passwords: undefined
    };
  }
}
```

#### AccessControl

This class provides type-safe access control methods that define user permissions
for Redis/Valkey commands and key patterns using `ACL syntax`.

```ts
/**
 * Access control configuration for ElastiCache users.
 *
 * @example AccessControl.accessString('on ~app:* +@read +@write -@dangerous')
 */       
export abstract class AccessControl {
  /**
   * Create access control from custom ACL string.
   *
   * @param accessString Redis/Valkey ACL syntax string
   * @returns Access control configuration
   */  
  public static accessString(accessString: string): AccessControl {
    return new AccessControlString(accessString);
  }

  /**
   * @internal Used by CDK construct to generate CloudFormation properties
   */
  public abstract readonly accessString: string;
}
```

#### AccessControlString

This class provides access control implementation that stores `ACL string` configuration.

```ts
/**
 * Access control implementation that stores ACL string configuration.
 */ 
class AccessControlString extends AccessControl {
  public readonly accessString: string;

  /**
   * Creates access control with the provided ACL string.
   *
   * @param accessString Redis/Valkey ACL syntax string
   */   
  constructor(accessString: string) {
    super();
    this.accessString = accessString;
  }
}
```

### Enums Details

The enums in this construct are intended to provide a way to reduce deployment time errors.
Many of the L1 constructs will accept string however there are only certain valid options.

#### CacheEngine

This enum defines the supported cache engines together with the available versions matching the UI behavior.

```ts
/**
 * Supported cache engines together with available versions.
 */  
export enum CacheEngine {
  /**
   * Valkey engine, latest verison available
   */
  VALKEY_DEFAULT = 'valkey',
  /**
   * Valkey engine, version 7
   */
  VALKEY_7 = 'valkey_7',
  /**
   * Valkey engine, version 8
   */
  VALKEY_8 = 'valkey_8',
  /**
   * Redis engine, latest verison available
   */ 
  REDIS_DEFAULT = 'redis',
  /**
   * Memcached engine, latest verison available
   */
  MEMCACHED_DEFAULT = 'memcached',
}
```

#### UnitType

This enum defines the unit of measurement for data storage in the `ServerlessCache` construct. Currently, it only includes gigabytes,
but it's structured as an enum to allow for potential future expansions.

```ts
/**
 * Unit types for usage limits.
 */   
export enum UnitType {
  /**
   * Gigabytes
   */ 
  GIGABYTES = 'GB'
}
```

#### UserEngine

This enum defines the supported engines needed for `User` and `UserGroup` configuration
(only Redis and Valkey; Memcached doesn’t support users/userGroups).

```ts
/**
 * Supported ElastiCache engines for users and user groups.
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
