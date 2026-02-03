# Amazon MemoryDB L2 Construct

* **Original Author(s):** @{AUTHOR}
* **Tracking Issue:** #{TRACKING_ISSUE}
* **API Bar Raiser:** @{BAR_RAISER}

> Amazon MemoryDB currently lacks L2 constructs, forcing developers to use verbose L1 constructs
> with no integration to other CDK constructs like VPC, IAM, or KMS. This RFC introduces L2
> constructs for MemoryDB that provide sensible defaults, type safety, and seamless integration
> with the CDK ecosystem.

## Working Backwards

### README

---

#### Amazon MemoryDB Construct Library

<!--BEGIN STABILITY BANNER-->
---

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development.
> They are subject to non-backward compatible changes or removal in any future version.

---
<!--END STABILITY BANNER-->

[Amazon MemoryDB](https://docs.aws.amazon.com/memorydb/latest/devguide/what-is-memorydb.html) is a fully managed,
Valkey and Redis OSS-compatible, in-memory database service that delivers ultra-fast performance with
multi-AZ durability.

This module provides L2 constructs for creating MemoryDB clusters with proper VPC integration,
user authentication, and access control.

##### Cluster

The `Cluster` construct creates a MemoryDB cluster in your VPC.

```ts
import * as memorydb from '@aws-cdk/aws-memorydb-alpha';

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
});
```

The construct requires `vpc`, `engine`, and `nodeType` — there are no hidden defaults for these critical choices.
Sensible defaults are applied for topology (1 shard, 1 replica), networking (private subnets), and security (TLS enabled).

Full configuration example:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  securityGroups: [mySecurityGroup],
  
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.R7G_LARGE,
  
  clusterName: 'my-cluster',
  numShards: 2,
  numReplicasPerShard: 1,
  port: 6379,
  description: 'My MemoryDB cluster',
  
  acl: myAcl,
  tlsEnabled: true,
  autoMinorVersionUpgrade: true,
  
  encryptionKey: myKmsKey,
  notificationTopic: mySnsTopic,
});
```

---

##### Engine

The `Engine` class defines supported engine types and versions:

```ts
export class Engine {
  public static readonly VALKEY_7_2 = new Engine('valkey', '7.2');
  public static readonly VALKEY_8_0 = new Engine('valkey', '8.0');
  
  public static readonly REDIS_6_2 = new Engine('redis', '6.2');
  public static readonly REDIS_7_0 = new Engine('redis', '7.0');
  public static readonly REDIS_7_1 = new Engine('redis', '7.1');
  
  public static of(engine: string, version: string): Engine {
    return new Engine(engine, version);
  }
  
  private constructor(
    public readonly engineName: string,
    public readonly engineVersion: string,
  ) {}
}
```

Use `Engine.of()` as an escape hatch for new versions before CDK updates.

---

##### NodeType

The `NodeType` class provides type-safe node type selection with common options as static properties,
plus an escape hatch for new or uncommon types.

```ts
nodeType: memorydb.NodeType.T4G_SMALL
nodeType: memorydb.NodeType.R7G_LARGE
nodeType: memorydb.NodeType.R7G_XLARGE

// Escape hatch for new/uncommon types
nodeType: memorydb.NodeType.of('db.r7g.16xlarge')
```

```ts
export class NodeType {
  public static readonly T4G_SMALL = new NodeType('db.t4g.small');
  public static readonly T4G_MEDIUM = new NodeType('db.t4g.medium');
  public static readonly R7G_LARGE = new NodeType('db.r7g.large');
  public static readonly R7G_XLARGE = new NodeType('db.r7g.xlarge');
  public static readonly R7G_2XLARGE = new NodeType('db.r7g.2xlarge');
  // ... more types
  
  public static of(nodeType: string): NodeType {
    return new NodeType(nodeType);
  }
  
  private constructor(public readonly name: string) {}
  
  public toString(): string {
    return this.name;
  }
}
```

---

##### Connecting to the Cluster

The cluster implements `IConnectable`, allowing easy security group management:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
});

const lambdaFn = new lambda.Function(this, 'Handler', {
  vpc,
  // ...
});

// Allow Lambda to connect to the cluster
cluster.connections.allowDefaultPortFrom(lambdaFn);

// Access endpoint for configuration
new CfnOutput(this, 'Endpoint', {
  value: cluster.clusterEndpoint.hostname,
});
```

---

##### IAM Integration

Grant IAM principals permission to connect to the cluster:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
});

const lambdaFn = new lambda.Function(this, 'Handler', { vpc, ... });

// Grant IAM permissions to connect
cluster.grantConnect(lambdaFn);

// For custom actions
cluster.grant(lambdaFn, 'memorydb:Connect');
```

---

##### KMS Encryption

Encrypt data at rest with a customer-managed KMS key:

```ts
const key = new kms.Key(this, 'Key', {
  enableKeyRotation: true,
});

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.R7G_LARGE,
  encryptionKey: key,
});
```

The construct automatically grants necessary KMS permissions to the MemoryDB service.
If `encryptionKey` is not provided, AWS manages encryption with a service-owned key.

---

##### SNS Notifications

Receive cluster event notifications via SNS:

```ts
const topic = new sns.Topic(this, 'ClusterEvents');

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
  notificationTopic: topic,
});

topic.addSubscription(new subscriptions.EmailSubscription('ops@example.com'));
```

Events include failover, configuration changes, maintenance, and more.

---

##### Users

The `User` construct creates a MemoryDB user for authentication. MemoryDB supports two authentication types:
password-based and IAM authentication.

Password authentication:

```ts
// Password from Secrets Manager (recommended)
const user = new memorydb.User(this, 'User', {
  userName: 'app-user',
  accessString: memorydb.AccessString.fullAccess(),
  authenticationMode: memorydb.AuthenticationMode.password(
    secretsmanager.Secret.fromSecretNameV2(this, 'Password', 'my-password')
  ),
});

// Multiple passwords for rotation (up to 2)
const userWithRotation = new memorydb.User(this, 'RotatingUser', {
  userName: 'rotating-user',
  accessString: memorydb.AccessString.readWrite('app:*'),
  authenticationMode: memorydb.AuthenticationMode.password(
    secretsmanager.Secret.fromSecretNameV2(this, 'Password1', 'password-1'),
    secretsmanager.Secret.fromSecretNameV2(this, 'Password2', 'password-2'),
  ),
});

// Custom access string for advanced use cases
const restrictedUser = new memorydb.User(this, 'RestrictedUser', {
  userName: 'restricted-user',
  accessString: memorydb.AccessString.of('on ~cache:* +get +set +del -@dangerous'),
  authenticationMode: memorydb.AuthenticationMode.password(secret),
});
```

IAM authentication (Phase 2):

```ts
const iamUser = new memorydb.User(this, 'IamUser', {
  userName: 'iam-user',
  accessString: memorydb.AccessString.readOnly(),
  authenticationMode: memorydb.AuthenticationMode.iam(),
});

iamUser.grantConnect(lambdaFn);
```

---

##### AuthenticationMode

```ts
export class AuthenticationMode {
  public static password(...passwords: secretsmanager.ISecret[]): AuthenticationMode {
    return new AuthenticationMode('password', passwords);
  }
  
  public static iam(): AuthenticationMode {
    return new AuthenticationMode('iam', []);
  }
  
  private constructor(
    public readonly type: string,
    public readonly passwords: secretsmanager.ISecret[],
  ) {}
}
```

---

##### AccessString

The `AccessString` class provides type-safe helpers for common permission patterns,
plus an escape hatch for custom ACL strings.

```ts
accessString: memorydb.AccessString.fullAccess(),           // on ~* +@all
accessString: memorydb.AccessString.readOnly(),             // on ~* +@read
accessString: memorydb.AccessString.readWrite(),            // on ~* +@read +@write

// With key pattern prefix
accessString: memorydb.AccessString.readOnly('app:*'),      // on ~app:* +@read
accessString: memorydb.AccessString.readWrite('cache:*'),   // on ~cache:* +@read +@write

// Custom access string (escape hatch)
accessString: memorydb.AccessString.of('on ~* +@read +@write -@dangerous'),
```

```ts
export class AccessString {
  public static fullAccess(): AccessString {
    return new AccessString('on ~* +@all');
  }
  
  public static readOnly(keyPattern: string = '*'): AccessString {
    return new AccessString(`on ~${keyPattern} +@read`);
  }
  
  public static readWrite(keyPattern: string = '*'): AccessString {
    return new AccessString(`on ~${keyPattern} +@read +@write`);
  }
  
  public static of(accessString: string): AccessString {
    return new AccessString(accessString);
  }
  
  private constructor(public readonly value: string) {}
  
  public toString(): string {
    return this.value;
  }
}
```

---

##### Access Control Lists (ACLs)

The `Acl` construct groups users and associates them with clusters. Every MemoryDB cluster
requires an ACL to control access.

```ts
const appUser = new memorydb.User(this, 'AppUser', {
  userName: 'app-user',
  accessString: memorydb.AccessString.readWrite(),
  authenticationMode: memorydb.AuthenticationMode.password(appSecret),
});

const adminUser = new memorydb.User(this, 'AdminUser', {
  userName: 'admin-user',
  accessString: memorydb.AccessString.fullAccess(),
  authenticationMode: memorydb.AuthenticationMode.password(adminSecret),
});

const acl = new memorydb.Acl(this, 'Acl', {
  aclName: 'my-acl',
  users: [appUser, adminUser],
});

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
  acl,
});
```

Adding users after creation:

```ts
const acl = new memorydb.Acl(this, 'Acl', {
  users: [user1],
});

acl.addUser(user2);
acl.addUser(user3);
```

Default ACL behavior:

```ts
// Explicit ACL (recommended for production)
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
  acl: myAcl,
});

// Uses default "open-access" ACL when acl not specified
const devCluster = new memorydb.Cluster(this, 'DevCluster', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
});
```

> ⚠️ **Security Warning:** The default `open-access` ACL allows any client with network access
> to execute all commands without authentication. Always use a custom ACL with authenticated
> users for production workloads.

Importing existing ACLs:

```ts
const importedAcl = memorydb.Acl.fromAclName(this, 'ImportedAcl', 'my-acl');

const importedByArn = memorydb.Acl.fromAclArn(
  this, 'ImportedByArn',
  'arn:aws:memorydb:us-east-1:123456789012:acl/my-acl'
);
```

---

##### Subnet Groups

Subnet groups are managed internally by the `Cluster` construct. You specify the VPC and
subnet selection, and the cluster handles subnet group creation automatically.

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
});

// Default: uses private subnets if vpcSubnets not specified
const clusterWithDefaults = new memorydb.Cluster(this, 'ClusterDefaults', {
  vpc,
  engine: memorydb.Engine.VALKEY_8_0,
  nodeType: memorydb.NodeType.T4G_SMALL,
});
```

---

##### Importing Existing Resources

```ts
const importedCluster = memorydb.Cluster.fromClusterArn(
  this, 'ImportedByArn', 
  'arn:aws:memorydb:us-east-1:123456789012:cluster/my-cluster'
);

const importedByName = memorydb.Cluster.fromClusterName(
  this, 'ImportedByName',
  'my-cluster'
);

// Import with full attributes (when you need endpoint, security groups, etc.)
const importedWithAttrs = memorydb.Cluster.fromClusterAttributes(this, 'ImportedFull', {
  clusterName: 'my-cluster',
  clusterEndpointAddress: 'my-cluster.xxxxx.memorydb.us-east-1.amazonaws.com',
  port: 6379,
  securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(this, 'SG', 'sg-12345')],
});

const importedAcl = memorydb.Acl.fromAclName(this, 'ImportedAcl', 'my-acl');

const importedUser = memorydb.User.fromUserName(this, 'ImportedUser', 'my-user');
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new experimental CDK module (`@aws-cdk/aws-memorydb-alpha`) providing L2 constructs for
Amazon MemoryDB. This initial release includes:

- `Cluster` — Create MemoryDB clusters with VPC integration
- `User` — Define users with password authentication
- `Acl` — Group users for access control

### Why should I use this feature?

If you're deploying MemoryDB with CDK today, you're using L1 constructs (`CfnCluster`, etc.)
which require verbose configuration and don't integrate with other CDK constructs.

This L2 module provides:
- **Sensible defaults** — Get a working cluster with just a VPC
- **Type safety** — Enums for engine versions and node types prevent deployment errors
- **VPC integration** — `IConnectable` support for security group management
- **Secure credentials** — Native Secrets Manager integration for passwords

## Internal FAQ

### Why are we doing this?

MemoryDB is a popular AWS service for in-memory caching with durability, but CDK users
must use L1 constructs with no abstractions. This creates friction and increases the
chance of misconfiguration.

### Why should we _not_ do this?

- MemoryDB and ElastiCache have overlapping use cases — users might be confused about which to use
- The service is still evolving (Valkey support, Multi-Region) — APIs may need to change

### Is this a breaking change?

No. This is a new alpha module with no existing users.

### What alternative solutions were considered?

**Engine selection:**
- *Alternative considered:* Default to Valkey 8.0 as AWS-recommended engine
- *Decision:* No default — user must explicitly choose engine. Different workloads have different compatibility requirements (Redis OSS for existing apps, Valkey for new/cost-sensitive workloads)

**Node type selection:**
- *Alternative considered:* Default to a small node type like `t4g.small`
- *Decision:* No default — user must explicitly choose. Cost and performance vary significantly, and wrong defaults could lead to unexpected bills or performance issues

**ACL default behavior:**
- *Alternative considered:* Require explicit ACL (fail if not provided)
- *Decision:* Default to `open-access` ACL with clear security warning. This matches MemoryDB's native behavior and simplifies development/testing, while documentation warns against production use

**SubnetGroup as public construct:**
- *Alternative considered:* Expose `SubnetGroup` as a standalone L2 construct
- *Decision:* Keep subnet group as internal implementation detail. Most users just want to specify VPC + subnet selection. Explicit `SubnetGroup` construct deferred to future RFC if demand exists

**AccessString API:**
- *Alternative considered:* Raw string only (no helper methods)
- *Decision:* Provide helper methods (`fullAccess()`, `readOnly()`, `readWrite()`) for common patterns plus `of()` escape hatch. Covers 80% of use cases with type safety while allowing advanced Redis ACL users full flexibility

### What are the drawbacks of this solution?

- Alpha module means API instability
- Deferred features (ParameterGroup, KMS, IAM auth, metrics) limit advanced use cases initially

### What is the high-level project plan?

**Phase 1 (This RFC):**
- `Cluster` with VPC integration and `IConnectable`
- `User` with password authentication
- `Acl` for access control
- Subnet group managed internally by `Cluster`
- AWS integrations: KMS encryption, SNS notifications, IAM grants
- Basic import methods

**Phase 2 (Future RFC):**
- `ParameterGroup` for engine tuning
- IAM authentication for users
- CloudWatch metrics methods (`metricCPUUtilization()`, etc.)
- Snapshot/backup configuration
- Maintenance window configuration
- Explicit `SubnetGroup` construct (if needed)

**Phase 3 (Future RFC):**
- `MultiRegionCluster` support
- Data tiering for r6gd nodes
- IPv6/dual-stack networking

### Are there any open issues that need to be addressed later?

- IAM authentication support for users
- CloudWatch metrics methods (`metricCPUUtilization()`, etc.)
- Snapshot/backup configuration
- Maintenance window configuration
- Multi-Region cluster support
- Data tiering for r6gd nodes

## Appendix

### CloudFormation Resources Covered

| CFN Resource | L2 Construct | Phase |
|--------------|--------------|-------|
| `AWS::MemoryDB::Cluster` | `Cluster` | 1 |
| `AWS::MemoryDB::User` | `User` | 1 |
| `AWS::MemoryDB::ACL` | `Acl` | 1 |
| `AWS::MemoryDB::SubnetGroup` | *(internal)* | 1 |
| `AWS::MemoryDB::ParameterGroup` | `ParameterGroup` | 2 |
| `AWS::MemoryDB::MultiRegionCluster` | `MultiRegionCluster` | 3 |

### Interface Definitions

#### ICluster

```ts
/**
 * Represents a MemoryDB Cluster.
 */
export interface ICluster extends IResource, ec2.IConnectable, iam.IGrantable {
  /**
   * The name of the cluster.
   * @attribute
   */
  readonly clusterName: string;
  
  /**
   * The ARN of the cluster.
   * @attribute
   */
  readonly clusterArn: string;
  
  /**
   * The cluster endpoint for connecting to the cluster.
   */
  readonly clusterEndpoint: Endpoint;
  
  /**
   * The VPC where the cluster is deployed.
   */
  readonly vpc?: ec2.IVpc;
  
  /**
   * The KMS key used for encryption at rest, if any.
   */
  readonly encryptionKey?: kms.IKey;
  
  /**
   * Grant the given identity permissions to connect to the cluster.
   */
  grantConnect(grantee: iam.IGrantable): iam.Grant;
  
  /**
   * Grant the given identity custom permissions.
   */
  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
}
```

#### ClusterProps

```ts
/**
 * Properties for creating a MemoryDB Cluster.
 */
export interface ClusterProps {
  /**
   * The VPC to place the cluster in.
   */
  readonly vpc: ec2.IVpc;
  
  /**
   * Which subnets to place the cluster in.
   * @default - Private subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection;
  
  /**
   * Security groups for the cluster.
   * @default - A new security group is created
   */
  readonly securityGroups?: ec2.ISecurityGroup[];
  
  /**
   * The engine type and version for the cluster.
   */
  readonly engine: Engine;
  
  /**
   * The node type for the cluster.
   */
  readonly nodeType: NodeType;
  
  /**
   * The name of the cluster.
   * @default - Auto-generated
   */
  readonly clusterName?: string;
  
  /**
   * The number of shards in the cluster.
   * @default 1
   */
  readonly numShards?: number;
  
  /**
   * The number of replicas per shard.
   * @default 1
   */
  readonly numReplicasPerShard?: number;
  
  /**
   * The port number for the cluster.
   * @default 6379
   */
  readonly port?: number;
  
  /**
   * A description of the cluster.
   * @default - No description
   */
  readonly description?: string;
  
  /**
   * The Access Control List to associate with the cluster.
   * @default - A default ACL allowing open access is created
   */
  readonly acl?: IAcl;
  
  /**
   * Whether to enable TLS encryption in transit.
   * @default true
   */
  readonly tlsEnabled?: boolean;
  
  /**
   * Whether to automatically upgrade to new minor versions.
   * @default true
   */
  readonly autoMinorVersionUpgrade?: boolean;
  
  /**
   * The KMS key for encryption at rest.
   * @default - AWS managed encryption
   */
  readonly encryptionKey?: kms.IKey;
  
  /**
   * SNS topic for cluster event notifications.
   * @default - No notifications
   */
  readonly notificationTopic?: sns.ITopic;
}
```

#### Endpoint

```ts
/**
 * Represents a cluster endpoint.
 */
export interface Endpoint {
  /**
   * The hostname of the endpoint.
   */
  readonly hostname: string;
  
  /**
   * The port of the endpoint.
   */
  readonly port: number;
}
```

#### ClusterAttributes

```ts
/**
 * Attributes for importing an existing MemoryDB Cluster.
 */
export interface ClusterAttributes {
  /**
   * The name of the cluster.
   */
  readonly clusterName: string;
  
  /**
   * The endpoint address of the cluster.
   * @default - endpoint is not available on imported cluster
   */
  readonly clusterEndpointAddress?: string;
  
  /**
   * The port of the cluster.
   * @default 6379
   */
  readonly port?: number;
  
  /**
   * The security groups associated with the cluster.
   * @default - no security groups (connections not available)
   */
  readonly securityGroups?: ec2.ISecurityGroup[];
}
```

#### IUser

```ts
/**
 * Represents a MemoryDB User.
 */
export interface IUser extends IResource {
  /**
   * The name of the user.
   * @attribute
   */
  readonly userName: string;
  
  /**
   * The ARN of the user.
   * @attribute
   */
  readonly userArn: string;
}
```

#### UserProps

```ts
/**
 * Properties for creating a MemoryDB User.
 */
export interface UserProps {
  /**
   * The name of the user.
   * Must begin with a letter and contain only lowercase letters, numbers, and hyphens.
   */
  readonly userName: string;
  
  /**
   * Access permissions for the user.
   * Use AccessString helper methods or AccessString.of() for custom strings.
   * @default AccessString.of('off') - user is disabled
   */
  readonly accessString?: AccessString;
  
  /**
   * The authentication mode for the user.
   */
  readonly authenticationMode: AuthenticationMode;
}
```

#### AccessString

```ts
/**
 * Access control string for MemoryDB users using Redis ACL syntax.
 */
export class AccessString {
  /** Full access to all keys and commands: on ~* +@all */
  public static fullAccess(): AccessString;
  
  /** Read-only access: on ~<keyPattern> +@read */
  public static readOnly(keyPattern?: string): AccessString;
  
  /** Read and write access: on ~<keyPattern> +@read +@write */
  public static readWrite(keyPattern?: string): AccessString;
  
  /** Create from a custom Redis ACL string */
  public static of(accessString: string): AccessString;
  
  /** The ACL string value */
  public readonly value: string;
}
```

#### AuthenticationMode

```ts
/**
 * Authentication mode for MemoryDB users.
 */
export class AuthenticationMode {
  /**
   * Password-based authentication.
   * @param passwords 1-2 secrets containing passwords (supports rotation)
   */
  public static password(...passwords: secretsmanager.ISecret[]): AuthenticationMode;
  
  /**
   * IAM-based authentication (Phase 2).
   */
  public static iam(): AuthenticationMode;
  
  /** The authentication type ('password' or 'iam') */
  public readonly type: string;
  
  /** The password secrets (empty for IAM auth) */
  public readonly passwords: secretsmanager.ISecret[];
}
```

#### IAcl

```ts
/**
 * Represents a MemoryDB Access Control List.
 */
export interface IAcl extends IResource {
  /**
   * The name of the ACL.
   * @attribute
   */
  readonly aclName: string;
  
  /**
   * The ARN of the ACL.
   * @attribute
   */
  readonly aclArn: string;
  
  /**
   * Add a user to this ACL.
   */
  addUser(user: IUser): void;
}
```

#### AclProps

```ts
/**
 * Properties for creating a MemoryDB Access Control List.
 */
export interface AclProps {
  /**
   * The name of the ACL.
   * Must begin with a letter and contain only lowercase letters, numbers, and hyphens.
   * @default - Auto-generated
   */
  readonly aclName?: string;
  
  /**
   * The users to add to this ACL.
   * @default - No users
   */
  readonly users?: IUser[];
}
```
