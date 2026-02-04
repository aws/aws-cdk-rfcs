# Amazon MemoryDB L2 Construct Library

* **Original Author(s):**: @alvazjor
* **Tracking Issue**: #{TRACKING_ISSUE}
* **API Bar Raiser**: @{BAR_RAISER}

This RFC proposes a new L2 construct library for Amazon MemoryDB, providing
high-level abstractions for creating MemoryDB clusters, users, and access
control lists (ACLs). The library simplifies VPC integration, encryption
configuration, and access management while following CDK security best practices.

## Working Backwards

### CHANGELOG

`feat(memorydb): L2 constructs for Cluster, User, and Acl`

### README

---

# Amazon MemoryDB Construct Library

[Amazon MemoryDB](https://docs.aws.amazon.com/memorydb/latest/devguide/what-is-memorydb.html)
is a fully managed, Valkey and Redis OSS-compatible, in-memory database service that
delivers ultra-fast performance with multi-AZ durability. MemoryDB stores your entire
dataset in memory, enabling microsecond read and single-digit millisecond write latencies.

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk)
project. It allows you to define MemoryDB clusters, users, and access control lists.

## Table of Contents

- [Cluster](#cluster)
  - [Engine Selection](#engine-selection)
  - [Node Types](#node-types)
  - [Sharding and Replication](#sharding-and-replication)
  - [VPC Configuration](#vpc-configuration)
  - [Encryption](#encryption)
  - [Notifications](#notifications)
  - [Importing Existing Clusters](#importing-existing-clusters)
- [Access Control](#access-control)
  - [Users](#users)
  - [Access Strings](#access-strings)
  - [ACLs](#acls)
  - [Importing Existing Users](#importing-existing-users)
- [Connecting to the Cluster](#connecting-to-the-cluster)
- [Monitoring](#monitoring)

## Cluster

To create a MemoryDB cluster, you must specify an engine, VPC, ACL, and node type:

```ts
import * as memorydb from '@aws-cdk/aws-memorydb-alpha';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const vpc = new ec2.Vpc(this, 'Vpc');

// Create a secret for the user password
const secret = new secretsmanager.Secret(this, 'UserSecret');

// Create a user with password authentication
const user = memorydb.User.withPassword(this, 'User', {
  userName: 'admin-user',
  accessString: memorydb.AccessString.fullAccess(),
  secret,
});

const acl = new memorydb.Acl(this, 'Acl', {
  users: [user],
});

const cluster = new memorydb.Cluster(this, 'Cluster', {
  engine: memorydb.Engine.VALKEY_7_2,
  vpc,
  acl,
  nodeType: memorydb.NodeType.T4G_SMALL,
});
```

The above example creates:

- A MemoryDB cluster running Valkey 7.2 with a single shard and no replicas
- A subnet group spanning the VPC's private subnets
- A security group allowing inbound traffic on port 6379
- A MemoryDB user with password authentication (stored in Secrets Manager)
- An ACL associating the user with the cluster

### Engine Selection

MemoryDB supports both Valkey and Redis OSS engines. You must explicitly choose an engine:

```ts
// Valkey 7.2 (recommended for new workloads - 30% lower cost)
new memorydb.Cluster(this, 'ValkeyCluster', {
  engine: memorydb.Engine.VALKEY_7_2,
  // ...
});

// MemoryDB 7.3 (supports Multi-Region)
new memorydb.Cluster(this, 'MultiRegionCluster', {
  engine: memorydb.Engine.MEMORYDB_7_3,
  // ...
});

// Redis OSS 6.2
new memorydb.Cluster(this, 'RedisCluster', {
  engine: memorydb.Engine.REDIS_OSS_6_2,
  // ...
});

// Custom engine version (escape hatch for new versions)
new memorydb.Cluster(this, 'CustomCluster', {
  engine: memorydb.Engine.of('valkey', '7.2'),
  // ...
});
```

Available engines:
- `VALKEY_7_2` - Valkey 7.2.6 (recommended for new workloads)
- `MEMORYDB_7_3` - MemoryDB 7.3 (Multi-Region support)
- `MEMORYDB_7_1` - MemoryDB 7.1 (vector search support)
- `MEMORYDB_7_0` - MemoryDB 7.0 (Functions, Sharded Pub/Sub)
- `REDIS_OSS_6_2` - Redis OSS 6.2 (ACLs, JSON support)
- `Engine.of(engine, version)` - Escape hatch for newer versions

### Node Types

MemoryDB offers various node types optimized for different workloads:

```ts
// Memory-optimized (R7g family)
nodeType: memorydb.NodeType.R7G_LARGE,

// General purpose (T4g family) - good for dev/test
nodeType: memorydb.NodeType.T4G_SMALL,

// Or specify a custom node type string
nodeType: memorydb.NodeType.of('db.r7g.xlarge'),
```

### Sharding and Replication

Configure the number of shards and replicas for your cluster:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  engine: memorydb.Engine.VALKEY_7_2,
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  numShards: 3,           // Data partitioning (default: 1)
  numReplicasPerShard: 2, // High availability (default: 0)
});
```

- **Shards**: Partition your data across multiple nodes for horizontal scaling
- **Replicas**: Add read replicas per shard for high availability and read scaling

### VPC Configuration

By default, the cluster is placed in the VPC's private subnets. You can customize this:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  engine: memorydb.Engine.VALKEY_7_2,
  vpc,
  acl,
  nodeType: memorydb.NodeType.T4G_SMALL,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  },
  securityGroups: [existingSecurityGroup],
});
```

### Encryption

MemoryDB supports encryption at rest using AWS KMS and encryption in transit using TLS.

```ts
import * as kms from 'aws-cdk-lib/aws-kms';

const key = new kms.Key(this, 'Key');

const cluster = new memorydb.Cluster(this, 'Cluster', {
  engine: memorydb.Engine.VALKEY_7_2,
  vpc,
  acl,
  nodeType: memorydb.NodeType.T4G_SMALL,
  encryptionKey: key,  // Encryption at rest (default: AWS managed key)
  tlsEnabled: true,    // Encryption in transit (default: true)
});
```

### Notifications

Subscribe to cluster events using Amazon SNS:

```ts
import * as sns from 'aws-cdk-lib/aws-sns';

const topic = new sns.Topic(this, 'ClusterEvents');

const cluster = new memorydb.Cluster(this, 'Cluster', {
  engine: memorydb.Engine.VALKEY_7_2,
  vpc,
  acl,
  nodeType: memorydb.NodeType.T4G_SMALL,
  snsTopic: topic,
});
```

### Importing Existing Clusters

Import an existing cluster by ARN:

```ts
const cluster = memorydb.Cluster.fromClusterArn(
  this,
  'ImportedCluster',
  'arn:aws:memorydb:us-east-1:123456789012:cluster/my-cluster',
);
```

Or import with specific attributes:

```ts
const cluster = memorydb.Cluster.fromClusterAttributes(this, 'ImportedCluster', {
  clusterName: 'my-cluster',
  clusterEndpointAddress: 'clustercfg.my-cluster.xxxxxx.memorydb.us-east-1.amazonaws.com',
  clusterEndpointPort: 6379,
  securityGroups: [existingSecurityGroup],
});
```

## Access Control

MemoryDB uses Access Control Lists (ACLs) to manage user permissions. Every cluster
requires an ACL, which contains one or more users.

### Users

MemoryDB supports two authentication modes: password-based and IAM. Use the appropriate
static factory method to create users:

**Password Authentication:**

```ts
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const secret = new secretsmanager.Secret(this, 'UserSecret');

const user = memorydb.User.withPassword(this, 'User', {
  userName: 'app-user',
  accessString: memorydb.AccessString.fullAccess(),
  secret,
});
```

**IAM Authentication:**

```ts
const user = memorydb.User.withIamAuthentication(this, 'User', {
  userName: 'iam-user',
  accessString: memorydb.AccessString.fullAccess(),
});
```

### Access Strings

The `accessString` defines user permissions using Redis ACL syntax. Use the `AccessString`
class for type-safe access string creation:

```ts
// Full access to all commands and keys
memorydb.AccessString.fullAccess()
// Produces: "on ~* &* +@all"

// Read-only access to all keys
memorydb.AccessString.readOnly()
// Produces: "on ~* &* -@all +@read +@connection"

// Read-only access to specific key pattern
memorydb.AccessString.readOnly('cache:*')
// Produces: "on ~cache:* &* -@all +@read +@connection"

// Write access to specific key pattern
memorydb.AccessString.writeOnly('session:*')
// Produces: "on ~session:* &* -@all +@write +@connection"

// Custom access string for advanced use cases
memorydb.AccessString.fromString('on ~app:* &* -@all +@read +@write -@dangerous')
```

Access string syntax reference:
- `on` / `off` - User is active/inactive
- `~pattern` - Key patterns the user can access
- `&*` - Pub/Sub channel patterns
- `+@category` - Allow command category
- `-@category` - Deny command category

### ACLs

Group users into an ACL and associate it with clusters:

```ts
const secret = new secretsmanager.Secret(this, 'AdminSecret');

const adminUser = memorydb.User.withPassword(this, 'AdminUser', {
  userName: 'admin',
  accessString: memorydb.AccessString.fullAccess(),
  secret,
});

const appUser = memorydb.User.withIamAuthentication(this, 'AppUser', {
  userName: 'app',
  accessString: memorydb.AccessString.readOnly('app:*'),
});

const acl = new memorydb.Acl(this, 'Acl', {
  users: [adminUser, appUser],
});
```

For development or testing, you can use the built-in open-access ACL:

```ts
// ⚠️ Not recommended for production - grants full access without authentication
const cluster = new memorydb.Cluster(this, 'DevCluster', {
  engine: memorydb.Engine.VALKEY_7_2,
  vpc,
  acl: memorydb.Acl.openAccess(),
  nodeType: memorydb.NodeType.T4G_SMALL,
});
```

### Importing Existing Users

Import an existing user by ARN:

```ts
const user = memorydb.User.fromUserArn(
  this,
  'ImportedUser',
  'arn:aws:memorydb:us-east-1:123456789012:user/my-user',
);
```

## Connecting to the Cluster

The cluster implements `IConnectable`, making it easy to allow connections from other resources:

```ts
import * as lambda from 'aws-cdk-lib/aws-lambda';

const fn = new lambda.Function(this, 'Function', {
  // ...
  vpc,
});

// Allow the Lambda function to connect to the cluster
cluster.connections.allowFrom(fn, ec2.Port.tcp(6379));

// Or use the convenience method
cluster.grantConnect(fn);
```

Access cluster endpoint information:

```ts
// Cluster endpoint for client connections
const endpoint = cluster.clusterEndpoint;
console.log(`${endpoint.address}:${endpoint.port}`);
```

## Monitoring

MemoryDB publishes metrics to CloudWatch. Access them using the `metric*` methods:

```ts
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

// CPU utilization across all nodes
const cpuMetric = cluster.metricCPUUtilization();

// Memory usage
const memoryMetric = cluster.metricDatabaseMemoryUsagePercentage();

// Create an alarm
new cloudwatch.Alarm(this, 'HighCPU', {
  metric: cpuMetric,
  threshold: 80,
  evaluationPeriods: 3,
});
```

Available metrics:
- `metricCPUUtilization()`
- `metricDatabaseMemoryUsagePercentage()`
- `metricNetworkBytesIn()`
- `metricNetworkBytesOut()`
- `metricCurrConnections()`
- `metricNewConnections()`
- `metricCommandsProcessed()`
- `metricKeyspaceHits()`
- `metricKeyspaceMisses()`

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching a new L2 construct library for Amazon MemoryDB as an alpha module
(`@aws-cdk/aws-memorydb-alpha`). This includes three constructs:

- `Cluster` - A MemoryDB cluster with VPC integration, encryption, and monitoring
- `User` - A MemoryDB user with password or IAM authentication
- `Acl` - An access control list that groups users and defines cluster access

### Why should I use this feature?

If you need an ultra-fast, durable in-memory database for use cases like session stores,
leaderboards, real-time analytics, or caching with durability requirements, MemoryDB is
an excellent choice. This L2 library makes it significantly easier to:

- **Reduce boilerplate**: Create a production-ready cluster in ~10 lines vs 100+ lines of L1/CloudFormation
- **Integrate with VPC**: Automatic subnet group and security group creation
- **Secure by default**: TLS enabled, passwords stored in Secrets Manager, explicit ACL required
- **Connect services**: Use `grantConnect()` and `IConnectable` for easy Lambda/ECS integration
- **Monitor**: Built-in CloudWatch metric methods

## Internal FAQ

### Why are we doing this?

MemoryDB currently has no L2 support in CDK. Users must use L1 constructs, which requires:
- Manual subnet group creation
- Manual security group configuration
- No type safety for node types or engine versions
- No integration with `IConnectable` or `IGrantable`
- Manual IAM and KMS setup

This creates friction for adopting MemoryDB and leads to copy-paste boilerplate across projects.

### Why should we _not_ do this?

- **Maintenance burden**: Another L2 module to maintain
- **Service evolution**: MemoryDB is actively adding features (multi-region, vector search) that may require API changes
- **Overlap with ElastiCache**: Some users may confuse MemoryDB with ElastiCache; however, they serve different purposes (durability vs pure caching)

### What is the technical solution (design) of this feature?

The module introduces three constructs:

**`Cluster`** (`ICluster`)
- Wraps `AWS::MemoryDB::Cluster` and `AWS::MemoryDB::SubnetGroup`
- Implements `IConnectable` for security group management
- Exposes `clusterEndpoint` for connection information
- Provides `metric*` methods for CloudWatch integration
- Provides `grantConnect()` for easy security group rules

**`User`** (`IUser`)
- Wraps `AWS::MemoryDB::User`
- Supports password (with Secrets Manager) and IAM authentication
- Exposes `userArn` and optional `secret` properties

**`Acl`** (`IAcl`)
- Wraps `AWS::MemoryDB::ACL`
- Associates users with clusters
- Provides `Acl.openAccess()` static method for the built-in open ACL

**Enum-like classes:**
- `Engine` - Available engine versions with `of()` escape hatch
- `NodeType` - Instance types with `of()` escape hatch
- `AccessString` - Access string helpers with `fromString()` escape hatch

### Is this a breaking change?

No. This is a new module with no existing L2 constructs.

### What alternative solutions did you consider?

**1. Direct inclusion in `aws-cdk-lib`**

Rejected because new L2 constructs should start as alpha modules (`@aws-cdk/aws-memorydb-alpha`)
to allow API iteration based on user feedback before stabilization. Once the API is proven,
the module will graduate to `aws-cdk-lib`.

**2. Shared constructs with ElastiCache**

Rejected because MemoryDB and ElastiCache have different resource models, use cases, and
CloudFormation resources. Sharing would create confusing abstractions.

**3. Auto-create ACL with default user**

Rejected in favor of requiring explicit ACL. This follows security-first principles and
avoids implicit resource creation that users may not expect.

**4. Default to open-access ACL**

Rejected because it's a security risk. Users who want open access can explicitly use
`Acl.openAccess()`.

**5. Auto-generate passwords in Secrets Manager**

Rejected in favor of requiring users to provide their own secret. This gives users full
control over secret rotation, naming, and lifecycle. It also avoids implicit resource
creation and makes the password source explicit in the code.

**6. Conditional props for authentication type**

Rejected in favor of static factory methods (`User.withPassword()`, `User.withIamAuthentication()`).
This provides compile-time type safety — password users must provide a secret, IAM users cannot.
Conditional props like "if authenticationType is PASSWORD, then secret is required" are
error-prone and harder to validate.

### What are the drawbacks of this solution?

- **More boilerplate than ElastiCache L2**: Requiring explicit ACL adds ~5 lines vs a hypothetical "just works" default
- **SubnetGroup not exposed**: Users cannot create standalone subnet groups (deferred to future RFC)
- **ParameterGroup not included**: Custom parameter groups require L1 (deferred to future RFC)

### What is the high-level project plan?

| Phase | Scope | Timeline |
|-------|-------|----------|
| 1 | Core constructs: Cluster, User, Acl | Week 1 |
| 2 | Testing, documentation, examples | Week 2 |

**Out of scope for this RFC (future work):**
- `ParameterGroup` L2
- `SubnetGroup` standalone L2
- Multi-region cluster support
- Snapshot management

### Are there any open issues that need to be addressed later?

1. **Additional AccessString helpers**: We're launching with `fullAccess()`, `readOnly()`, `writeOnly()`, and `fromString()`. Additional helpers (e.g., `noAccess()`, category-specific methods) can be added based on user feedback
2. **Multi-region**: MemoryDB Multi-Region is a newer feature that warrants its own RFC

## Appendix

### Appendix A: Full Interface Definitions

```ts
/**
 * Represents a MemoryDB cluster.
 */
interface ICluster extends IResource, IConnectable {
  /** The name of the cluster */
  readonly clusterName: string;
  
  /** The ARN of the cluster */
  readonly clusterArn: string;
  
  /** The endpoint for connecting to the cluster */
  readonly clusterEndpoint: Endpoint;
  
  /** Grant the given identity connection access to the cluster */
  grantConnect(grantee: IGrantable): Grant;
  
  /** Return the given named metric for this cluster */
  metric(metricName: string, props?: MetricOptions): Metric;
}

interface ClusterProps {
  /** The engine to run on the cluster (required) */
  readonly engine: Engine;
  
  /** The VPC to place the cluster in (required) */
  readonly vpc: IVpc;
  
  /** The ACL to associate with the cluster (required) */
  readonly acl: IAcl;
  
  /** The node type for the cluster nodes (required) */
  readonly nodeType: NodeType;
  
  /** The name of the cluster */
  readonly clusterName?: string;
  
  /** Number of shards in the cluster (default: 1) */
  readonly numShards?: number;
  
  /** Number of replicas per shard (default: 0) */
  readonly numReplicasPerShard?: number;
  
  /** Subnet selection for the cluster (default: private subnets) */
  readonly vpcSubnets?: SubnetSelection;
  
  /** Security groups for the cluster */
  readonly securityGroups?: ISecurityGroup[];
  
  /** KMS key for encryption at rest */
  readonly encryptionKey?: IKey;
  
  /** Enable TLS encryption in transit (default: true) */
  readonly tlsEnabled?: boolean;
  
  /** SNS topic for cluster notifications */
  readonly snsTopic?: ITopic;
  
  /** Enable automatic minor version upgrades (default: true) */
  readonly autoMinorVersionUpgrade?: boolean;
  
  /** The weekly maintenance window */
  readonly maintenanceWindow?: string;
  
  /** The port number for the cluster (default: 6379) */
  readonly port?: number;
}

/**
 * Represents a MemoryDB user.
 */
interface IUser extends IResource {
  /** The name of the user */
  readonly userName: string;
  
  /** The ARN of the user */
  readonly userArn: string;
}

/**
 * Properties for creating a user with password authentication.
 */
interface PasswordUserProps {
  /** The name of the user (required) */
  readonly userName: string;
  
  /** Access string defining permissions (required) */
  readonly accessString: AccessString;
  
  /** Secret containing the password (required) */
  readonly secret: ISecret;
}

/**
 * Properties for creating a user with IAM authentication.
 */
interface IamUserProps {
  /** The name of the user (required) */
  readonly userName: string;
  
  /** Access string defining permissions (required) */
  readonly accessString: AccessString;
}

/**
 * A MemoryDB user.
 */
class User extends Resource implements IUser {
  /** Create a user with password authentication */
  static withPassword(scope: Construct, id: string, props: PasswordUserProps): User;
  
  /** Create a user with IAM authentication */
  static withIamAuthentication(scope: Construct, id: string, props: IamUserProps): User;
  
  /** Import an existing user by ARN */
  static fromUserArn(scope: Construct, id: string, userArn: string): IUser;
}

/**
 * Access string configuration for MemoryDB users.
 */
class AccessString {
  /** Full access to all commands and keys: "on ~* &* +@all" */
  static fullAccess(): AccessString;
  
  /** Read-only access, optionally restricted to a key pattern */
  static readOnly(keyPattern?: string): AccessString;
  
  /** Write-only access, optionally restricted to a key pattern */
  static writeOnly(keyPattern?: string): AccessString;
  
  /** Create from a custom access string */
  static fromString(accessString: string): AccessString;
  
  /** The access string value */
  readonly value: string;
}

/**
 * Represents a MemoryDB ACL.
 */
interface IAcl extends IResource {
  /** The name of the ACL */
  readonly aclName: string;
  
  /** The ARN of the ACL */
  readonly aclArn: string;
}

interface AclProps {
  /** The name of the ACL */
  readonly aclName?: string;
  
  /** Users to include in the ACL (required) */
  readonly users: IUser[];
}

/**
 * A MemoryDB ACL.
 */
class Acl extends Resource implements IAcl {
  /** Reference the built-in open-access ACL (not recommended for production) */
  static openAccess(): IAcl;
  
  /** Import an existing ACL by ARN */
  static fromAclArn(scope: Construct, id: string, aclArn: string): IAcl;
}

/**
 * MemoryDB engine versions.
 */
class Engine {
  /** Valkey 7.2.6 - recommended for new workloads */
  static readonly VALKEY_7_2: Engine;
  
  /** MemoryDB 7.3 - Multi-Region support */
  static readonly MEMORYDB_7_3: Engine;
  
  /** MemoryDB 7.1 - vector search support */
  static readonly MEMORYDB_7_1: Engine;
  
  /** MemoryDB 7.0 - Functions, Sharded Pub/Sub */
  static readonly MEMORYDB_7_0: Engine;
  
  /** Redis OSS 6.2 - ACLs, JSON support */
  static readonly REDIS_OSS_6_2: Engine;
  
  /** Specify a custom engine and version (escape hatch for new versions) */
  static of(engine: string, version: string): Engine;
  
  /** The engine name (valkey or redis) */
  readonly engineName: string;
  
  /** The engine version */
  readonly engineVersion: string;
}

/**
 * MemoryDB node types.
 */
class NodeType {
  /** db.t4g.small */
  static readonly T4G_SMALL: NodeType;
  
  /** db.t4g.medium */
  static readonly T4G_MEDIUM: NodeType;
  
  /** db.r7g.large */
  static readonly R7G_LARGE: NodeType;
  
  /** db.r7g.xlarge */
  static readonly R7G_XLARGE: NodeType;
  
  // ... additional node types
  
  /** Specify a custom node type (escape hatch) */
  static of(nodeType: string): NodeType;
  
  /** The node type string */
  readonly nodeType: string;
}
```

### Appendix B: CloudFormation Resource Mapping

| CDK Construct | CloudFormation Resource |
|---------------|------------------------|
| `Cluster` | `AWS::MemoryDB::Cluster`, `AWS::MemoryDB::SubnetGroup` |
| `User` | `AWS::MemoryDB::User` |
| `Acl` | `AWS::MemoryDB::ACL` |
