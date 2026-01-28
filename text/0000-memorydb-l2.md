# Amazon MemoryDB L2 Constructs

* **Original Author(s):**: @alvazjor
* **Tracking Issue**: #{TRACKING_ISSUE_NUMBER}
* **API Bar Raiser**: @{BAR_RAISER_USER}

*Creating a MemoryDB cluster with proper authentication and VPC placement requires verbose L1 constructs and manual wiring; this RFC introduces L2 constructs for Cluster, User, and Acl that provide sensible defaults, VPC integration, and grant methods for a streamlined developer experience.*

## Working Backwards

### README

#### Amazon MemoryDB Construct Library

Amazon MemoryDB is a durable, in-memory database service that delivers ultra-fast performance. It is compatible with Redis and Valkey, offering microsecond read latency, single-digit millisecond write latency, and Multi-AZ durability. MemoryDB stores your entire dataset in memory and uses a distributed, Multi-AZ transactional log to provide durability, fast recovery, and data persistence.

This module provides L2 constructs for the core MemoryDB resources:

- `Cluster` — The main MemoryDB cluster resource
- `User` — A user for authentication
- `Acl` — An Access Control List that groups users and controls cluster access

#### Cluster

A `Cluster` represents a MemoryDB cluster deployed in your VPC. The cluster is composed of one or more shards, each with a primary node and optional replica nodes.

###### Basic Usage

To create a MemoryDB cluster, you need to provide a VPC, node type, and an ACL:

```ts
import * as memorydb from 'aws-cdk-lib/aws-memorydb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

const vpc = new ec2.Vpc(this, 'Vpc');

// Create a user and ACL for authentication
const user = new memorydb.User(this, 'User', {
  userName: 'my-user',
  accessString: memorydb.AccessString.FULL_ACCESS,
  authenticationMode: {
    type: memorydb.AuthenticationType.PASSWORD,
    passwords: [SecretValue.unsafePlainText('my-password-123456')], // Use Secrets Manager in production
  },
});

const acl = new memorydb.Acl(this, 'Acl', {
  users: [user],
});

// Create the cluster
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
});
```

When you provide a `vpc`, the construct automatically:
- Creates a `SubnetGroup` using the VPC's private subnets (by default)
- Creates a `SecurityGroup` that allows no inbound traffic (you control access via `connections`)

###### Choosing Subnets

By default, the cluster is placed in the VPC's private subnets. You can customize this with `vpcSubnets`:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  },
});
```

###### Engine Selection

MemoryDB supports Redis OSS and Valkey engines. Valkey is the default and is priced 30% lower:

```ts
// Use Valkey (default - latest version)
const valkeyCluster = new memorydb.Cluster(this, 'ValkeyCluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  engineVersion: memorydb.EngineVersion.VALKEY_7_3,
});

// Use Redis OSS
const redisCluster = new memorydb.Cluster(this, 'RedisCluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  engineVersion: memorydb.EngineVersion.REDIS_7_1,
});

// Use a custom or newer version not yet in the enum
const customCluster = new memorydb.Cluster(this, 'CustomCluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  engineVersion: memorydb.EngineVersion.of('valkey', '8.0'),
});
```

###### Shards and Replicas

Configure the cluster topology with `numShards` and `numReplicasPerShard`:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  numShards: 3,           // Data partitioned across 3 shards
  numReplicasPerShard: 2, // 2 read replicas per shard for HA
});
```

###### Encryption

TLS encryption in transit is enabled by default. To configure encryption at rest with a customer-managed KMS key:

```ts
import * as kms from 'aws-cdk-lib/aws-kms';

const key = new kms.Key(this, 'Key');

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  encryptionKey: key,     // Encryption at rest
  tlsEnabled: true,       // Encryption in transit (default)
});
```

###### Maintenance and Snapshots

Configure maintenance windows and automatic snapshots:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  maintenanceWindow: 'sun:05:00-sun:06:00',  // Weekly maintenance window (UTC)
  snapshotWindow: '03:00-04:00',              // Daily snapshot window (UTC)
  snapshotRetentionLimit: 7,                  // Keep snapshots for 7 days
});
```

###### SNS Notifications

Receive notifications about cluster events:

```ts
import * as sns from 'aws-cdk-lib/aws-sns';

const topic = new sns.Topic(this, 'ClusterEvents');

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  snsTopic: topic,
});
```

###### Security Groups

By default, a security group is created with no inbound rules. Use `connections` to grant access:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
});

// Allow access from a Lambda function
declare const fn: lambda.Function;
cluster.connections.allowFrom(fn, ec2.Port.tcp(6379), 'Allow Lambda access');

// Or provide your own security groups
const sg = new ec2.SecurityGroup(this, 'ClusterSG', { vpc });
const clusterWithSg = new memorydb.Cluster(this, 'ClusterWithSG', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
  securityGroups: [sg],
});
```

###### Cluster Endpoint

Access the cluster endpoint for connecting your application:

```ts
const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
});

// Use in environment variables, SSM parameters, etc.
new CfnOutput(this, 'ClusterEndpoint', {
  value: cluster.clusterEndpoint.address,
});

new CfnOutput(this, 'ClusterPort', {
  value: cluster.clusterEndpoint.port.toString(),
});
```

###### Importing Existing Clusters

Import an existing cluster by name (limited functionality — no `connections` or endpoint access):

```ts
const importedCluster = memorydb.Cluster.fromClusterName(this, 'ImportedCluster', 'my-existing-cluster');
```

For full functionality including `connections` and endpoint, use `fromClusterAttributes()`:

```ts
const importedCluster = memorydb.Cluster.fromClusterAttributes(this, 'ImportedCluster', {
  clusterName: 'my-existing-cluster',
  clusterEndpointAddress: 'clustercfg.my-existing-cluster.xxxxxx.memorydb.us-east-1.amazonaws.com',
  clusterEndpointPort: 6379,
  securityGroups: [
    ec2.SecurityGroup.fromSecurityGroupId(this, 'ClusterSG', 'sg-12345678'),
  ],
});

// Now you can use connections
declare const fn: lambda.Function;
importedCluster.connections.allowFrom(fn, ec2.Port.tcp(6379));

// And access the endpoint
new CfnOutput(this, 'Endpoint', { value: importedCluster.clusterEndpoint.address });
```

##### User

A `User` represents a MemoryDB user for authentication. Users are associated with ACLs to control access to clusters.

###### Password Authentication

Create a user with password authentication:

```ts
const user = new memorydb.User(this, 'User', {
  userName: 'app-user',
  accessString: memorydb.AccessString.FULL_ACCESS,
  authenticationMode: {
    type: memorydb.AuthenticationType.PASSWORD,
    passwords: [SecretValue.unsafePlainText('my-secure-password-123')],
  },
});
```

For production, use Secrets Manager:

```ts
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const secret = new secretsmanager.Secret(this, 'UserPassword', {
  generateSecretString: {
    excludePunctuation: true,
    passwordLength: 20,
  },
});

const user = new memorydb.User(this, 'User', {
  userName: 'app-user',
  accessString: memorydb.AccessString.FULL_ACCESS,
  authenticationMode: {
    type: memorydb.AuthenticationType.PASSWORD,
    passwords: [secret.secretValue],
  },
});
```

###### IAM Authentication

Create a user with IAM authentication (no password required):

```ts
const user = new memorydb.User(this, 'IamUser', {
  userName: 'iam-user',
  accessString: memorydb.AccessString.FULL_ACCESS,
  authenticationMode: {
    type: memorydb.AuthenticationType.IAM,
  },
});
```

###### Access String

The `accessString` controls what commands and keys the user can access. Use the `AccessString` class for common patterns:

```ts
// Full access (admin)
const adminUser = new memorydb.User(this, 'Admin', {
  userName: 'admin',
  accessString: memorydb.AccessString.FULL_ACCESS,
  authenticationMode: { type: memorydb.AuthenticationType.PASSWORD, passwords: [password] },
});

// Read-only access
const readOnlyUser = new memorydb.User(this, 'ReadOnly', {
  userName: 'reader',
  accessString: memorydb.AccessString.READ_ONLY,
  authenticationMode: { type: memorydb.AuthenticationType.PASSWORD, passwords: [password] },
});

// Write access (no admin commands)
const writeUser = new memorydb.User(this, 'Writer', {
  userName: 'writer',
  accessString: memorydb.AccessString.WRITE_ACCESS,
  authenticationMode: { type: memorydb.AuthenticationType.PASSWORD, passwords: [password] },
});

// Custom access string for advanced use cases (Redis ACL syntax)
const limitedUser = new memorydb.User(this, 'Limited', {
  userName: 'limited',
  accessString: memorydb.AccessString.of('on ~app:* &* +@all'), // Only keys starting with "app:"
  authenticationMode: { type: memorydb.AuthenticationType.PASSWORD, passwords: [password] },
});
```

###### Importing Existing Users

```ts
const importedUser = memorydb.User.fromUserName(this, 'ImportedUser', 'existing-user');
```

#### Acl (Access Control List)

An `Acl` groups users together and is associated with clusters to control access.

###### Creating an ACL

```ts
const user1 = new memorydb.User(this, 'User1', {
  userName: 'user1',
  accessString: memorydb.AccessString.FULL_ACCESS,
  authenticationMode: { type: memorydb.AuthenticationType.PASSWORD, passwords: [password1] },
});

const user2 = new memorydb.User(this, 'User2', {
  userName: 'user2',
  accessString: memorydb.AccessString.READ_ONLY,
  authenticationMode: { type: memorydb.AuthenticationType.PASSWORD, passwords: [password2] },
});

const acl = new memorydb.Acl(this, 'Acl', {
  users: [user1, user2],
});
```

###### Adding Users to an ACL

You can add users after ACL creation:

```ts
const acl = new memorydb.Acl(this, 'Acl');

const user = new memorydb.User(this, 'User', {
  userName: 'my-user',
  accessString: memorydb.AccessString.FULL_ACCESS,
  authenticationMode: { type: memorydb.AuthenticationType.PASSWORD, passwords: [password] },
});

acl.addUser(user);
```

###### Default Open Access ACL

MemoryDB provides a default `open-access` ACL that allows unauthenticated access. This is useful for development but not recommended for production:

```ts
// Import the default open-access ACL (not recommended for production)
const openAccessAcl = memorydb.Acl.fromAclName(this, 'OpenAccess', 'open-access');

const devCluster = new memorydb.Cluster(this, 'DevCluster', {
  vpc,
  acl: openAccessAcl,
  nodeType: memorydb.NodeType.T4G_SMALL,
});
```

###### Importing Existing ACLs

```ts
const importedAcl = memorydb.Acl.fromAclName(this, 'ImportedAcl', 'my-existing-acl');
```

##### Connecting to the Cluster

###### From a Lambda Function

```ts
import * as lambda from 'aws-cdk-lib/aws-lambda';

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
});

const fn = new lambda.Function(this, 'Handler', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda'),
  vpc,
  environment: {
    MEMORYDB_ENDPOINT: cluster.clusterEndpoint.address,
    MEMORYDB_PORT: cluster.clusterEndpoint.port.toString(),
  },
});

// Grant network access
cluster.connections.allowFrom(fn, ec2.Port.tcp(6379));
```

###### From an ECS Service

```ts
import * as ecs from 'aws-cdk-lib/aws-ecs';

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
});

const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef');
const container = taskDefinition.addContainer('app', {
  image: ecs.ContainerImage.fromRegistry('my-app'),
  environment: {
    REDIS_URL: `rediss://${cluster.clusterEndpoint.address}:${cluster.clusterEndpoint.port}`,
  },
});

const service = new ecs.FargateService(this, 'Service', {
  cluster: ecsCluster,
  taskDefinition,
});

// Grant network access
cluster.connections.allowFrom(service, ec2.Port.tcp(6379));
```

##### Importing Existing Resources

All constructs support importing existing resources created outside of CDK:

```ts
// Import existing user
const user = memorydb.User.fromUserName(this, 'ImportedUser', 'my-user');

// Import existing ACL
const acl = memorydb.Acl.fromAclName(this, 'ImportedAcl', 'my-acl');

// Import cluster by name (limited functionality)
const simpleCluster = memorydb.Cluster.fromClusterName(this, 'SimpleImport', 'my-cluster');

// Import cluster with full functionality (connections + endpoint)
const fullCluster = memorydb.Cluster.fromClusterAttributes(this, 'FullImport', {
  clusterName: 'my-cluster',
  clusterEndpointAddress: 'clustercfg.my-cluster.xxxxxx.memorydb.us-east-1.amazonaws.com',
  clusterEndpointPort: 6379,
  securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(this, 'SG', 'sg-12345678')],
});

// Use imported ACL with a new cluster
const newCluster = new memorydb.Cluster(this, 'NewCluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
});
```

Note: `fromClusterName()` provides limited functionality — no `connections` or endpoint access. Use `fromClusterAttributes()` when you need to manage security group rules or access the endpoint.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching L2 constructs for Amazon MemoryDB in the `aws-cdk-lib/aws-memorydb` module. This includes:

- `Cluster` — A high-level construct for creating MemoryDB clusters with VPC integration, automatic security group management, and sensible defaults
- `User` — A construct for creating MemoryDB users with password or IAM authentication
- `Acl` — A construct for creating Access Control Lists that group users and control cluster access

These constructs provide a streamlined developer experience compared to the existing L1 constructs, with automatic SubnetGroup creation, security group management via `connections`, and type-safe interfaces.

### Why should I use this feature?

**Before (L1 constructs):**
```ts
// Verbose, manual wiring required
const subnetGroup = new memorydb.CfnSubnetGroup(this, 'SubnetGroup', {
  subnetGroupName: 'my-subnet-group',
  subnetIds: vpc.privateSubnets.map(s => s.subnetId),
});

const securityGroup = new ec2.SecurityGroup(this, 'SG', { vpc });

const user = new memorydb.CfnUser(this, 'User', {
  userName: 'my-user',
  accessString: 'on ~* &* +@all',
  authenticationMode: { type: 'password', passwords: ['...'] },
});

const acl = new memorydb.CfnACL(this, 'ACL', {
  aclName: 'my-acl',
  userNames: [user.userName!],
});

const cluster = new memorydb.CfnCluster(this, 'Cluster', {
  clusterName: 'my-cluster',
  nodeType: 'db.r7g.large',
  aclName: acl.aclName!,
  subnetGroupName: subnetGroup.subnetGroupName!,
  securityGroupIds: [securityGroup.securityGroupId],
  tlsEnabled: true,
});
```

**After (L2 constructs):**
```ts
// Clean, type-safe, automatic wiring
const user = new memorydb.User(this, 'User', {
  accessString: memorydb.AccessString.FULL_ACCESS,
  authenticationMode: { type: memorydb.AuthenticationType.PASSWORD, passwords: [password] },
});

const acl = new memorydb.Acl(this, 'Acl', { users: [user] });

const cluster = new memorydb.Cluster(this, 'Cluster', {
  vpc,
  acl,
  nodeType: memorydb.NodeType.R7G_LARGE,
});

// Easy security group management
cluster.connections.allowFrom(myLambda, ec2.Port.tcp(6379));
```

**Use cases addressed:**
- In-memory caching for web applications
- Session stores with durability requirements
- Real-time leaderboards and analytics
- Vector search for AI/ML workloads (RAG, semantic caching)
- Pub/Sub messaging with persistence

## Internal FAQ

### Why are we doing this?

- MemoryDB has no L2 constructs today — only auto-generated L1s exist
- MemoryDB is a popular service for Redis/Valkey-compatible workloads requiring durability
- L1 usage requires significant boilerplate: manual SubnetGroup creation, security group wiring, string-based references between resources
- The `connections` pattern used by RDS, OpenSearch, and other database constructs is missing
- Community requests for MemoryDB L2s exist (reference GitHub issues when available)

### Why should we _not_ do this?

- Users can use L1 constructs directly — they work, just verbose
- Third-party constructs may exist on Construct Hub (though none are widely adopted)
- Maintenance burden for the CDK team
- MemoryDB API surface is relatively stable, reducing urgency

However, the benefits outweigh these concerns: MemoryDB is a core AWS database service, and the L2 patterns (VPC integration, `connections`, type-safe props) significantly improve developer experience.

### What is the technical solution (design) of this feature?

#### Cluster

```ts
export interface ClusterProps {
  /** VPC to deploy the cluster in. Required. */
  readonly vpc: ec2.IVpc;

  /** ACL to associate with the cluster. Required. */
  readonly acl: IAcl;

  /** Node type for the cluster. Required. */
  readonly nodeType: NodeType;

  /** Cluster name. Auto-generated if not provided. */
  readonly clusterName?: string;

  /** Which subnets to use. Default: private subnets. */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /** Security groups. Default: a new security group is created. */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /** Number of shards. Default: 1. */
  readonly numShards?: number;

  /** Number of replicas per shard. Default: 1. */
  readonly numReplicasPerShard?: number;

  /** Engine version. Default: VALKEY_7_3. */
  readonly engineVersion?: EngineVersion;

  /** Port. Default: 6379. */
  readonly port?: number;

  /** Enable TLS. Default: true. */
  readonly tlsEnabled?: boolean;

  /** KMS key for encryption at rest. */
  readonly encryptionKey?: kms.IKey;

  /** Parameter group name. */
  readonly parameterGroupName?: string;

  /** Maintenance window (e.g., 'sun:05:00-sun:06:00'). */
  readonly maintenanceWindow?: string;

  /** Snapshot window (e.g., '03:00-04:00'). */
  readonly snapshotWindow?: string;

  /** Snapshot retention in days. */
  readonly snapshotRetentionLimit?: number;

  /** SNS topic for notifications. */
  readonly snsTopic?: sns.ITopic;

  /** Enable auto minor version upgrade. Default: true. */
  readonly autoMinorVersionUpgrade?: boolean;

  /** Description. */
  readonly description?: string;
}

export interface ICluster extends cdk.IResource, ec2.IConnectable {
  readonly clusterArn: string;
  readonly clusterName: string;
  readonly clusterEndpoint: Endpoint;
}

/**
 * Attributes for importing an existing MemoryDB cluster.
 */
export interface ClusterAttributes {
  /** The cluster name. */
  readonly clusterName: string;

  /** The cluster endpoint address. */
  readonly clusterEndpointAddress: string;

  /** The cluster endpoint port. Default: 6379. */
  readonly clusterEndpointPort?: number;

  /** Security groups associated with the cluster. Required for connections. */
  readonly securityGroups?: ec2.ISecurityGroup[];
}

export class Cluster extends cdk.Resource implements ICluster {
  /**
   * Import a cluster by name only.
   * Limited functionality: no connections or endpoint access.
   */
  public static fromClusterName(scope: Construct, id: string, clusterName: string): ICluster;

  /**
   * Import a cluster with full attributes.
   * Provides full functionality including connections and endpoint.
   */
  public static fromClusterAttributes(scope: Construct, id: string, attrs: ClusterAttributes): ICluster;

  public readonly clusterArn: string;
  public readonly clusterName: string;
  public readonly clusterEndpoint: Endpoint;
  public readonly connections: ec2.Connections;

  constructor(scope: Construct, id: string, props: ClusterProps);
}

/**
 * MemoryDB engine versions.
 * 
 * This is an enum-like class that combines engine type and version,
 * ensuring only valid combinations are used.
 */
export class EngineVersion {
  //----- Valkey -----
  /** Valkey 7.3 (latest) */
  public static readonly VALKEY_7_3 = new EngineVersion('valkey', '7.3');
  /** Valkey 7.2 */
  public static readonly VALKEY_7_2 = new EngineVersion('valkey', '7.2');

  //----- Redis OSS -----
  /** Redis OSS 7.1 (latest Redis) */
  public static readonly REDIS_7_1 = new EngineVersion('redis', '7.1');
  /** Redis OSS 7.0 */
  public static readonly REDIS_7_0 = new EngineVersion('redis', '7.0');
  /** Redis OSS 6.2 */
  public static readonly REDIS_6_2 = new EngineVersion('redis', '6.2');

  /**
   * Create a custom engine version.
   * Use this for versions not yet defined in the enum.
   * 
   * @param engine The engine type ('valkey' or 'redis')
   * @param version The engine version (e.g., '7.3')
   */
  public static of(engine: string, version: string): EngineVersion {
    return new EngineVersion(engine, version);
  }

  /** The engine type ('valkey' or 'redis') */
  public readonly engine: string;

  /** The engine version (e.g., '7.3') */
  public readonly version: string;

  private constructor(engine: string, version: string) {
    this.engine = engine;
    this.version = version;
  }
}

export interface Endpoint {
  readonly address: string;
  readonly port: number;
}

/**
 * MemoryDB node types.
 * 
 * This is an enum-like class to allow for future node types without breaking changes.
 */
export class NodeType {
  //----- Memory-optimized (R7g) -----
  /** db.r7g.large - 2 vCPUs, 16 GiB memory */
  public static readonly R7G_LARGE = new NodeType('db.r7g.large');
  /** db.r7g.xlarge - 4 vCPUs, 32 GiB memory */
  public static readonly R7G_XLARGE = new NodeType('db.r7g.xlarge');
  /** db.r7g.2xlarge - 8 vCPUs, 64 GiB memory */
  public static readonly R7G_2XLARGE = new NodeType('db.r7g.2xlarge');
  /** db.r7g.4xlarge - 16 vCPUs, 128 GiB memory */
  public static readonly R7G_4XLARGE = new NodeType('db.r7g.4xlarge');
  /** db.r7g.8xlarge - 32 vCPUs, 256 GiB memory */
  public static readonly R7G_8XLARGE = new NodeType('db.r7g.8xlarge');
  /** db.r7g.12xlarge - 48 vCPUs, 384 GiB memory */
  public static readonly R7G_12XLARGE = new NodeType('db.r7g.12xlarge');
  /** db.r7g.16xlarge - 64 vCPUs, 512 GiB memory */
  public static readonly R7G_16XLARGE = new NodeType('db.r7g.16xlarge');

  //----- Memory-optimized with data tiering (R6gd) -----
  /** db.r6gd.xlarge - 4 vCPUs, 32 GiB memory, with data tiering */
  public static readonly R6GD_XLARGE = new NodeType('db.r6gd.xlarge');
  /** db.r6gd.2xlarge - 8 vCPUs, 64 GiB memory, with data tiering */
  public static readonly R6GD_2XLARGE = new NodeType('db.r6gd.2xlarge');
  /** db.r6gd.4xlarge - 16 vCPUs, 128 GiB memory, with data tiering */
  public static readonly R6GD_4XLARGE = new NodeType('db.r6gd.4xlarge');
  /** db.r6gd.8xlarge - 32 vCPUs, 256 GiB memory, with data tiering */
  public static readonly R6GD_8XLARGE = new NodeType('db.r6gd.8xlarge');

  //----- General-purpose (T4g) -----
  /** db.t4g.small - 2 vCPUs, 2 GiB memory (burstable) */
  public static readonly T4G_SMALL = new NodeType('db.t4g.small');
  /** db.t4g.medium - 2 vCPUs, 4 GiB memory (burstable) */
  public static readonly T4G_MEDIUM = new NodeType('db.t4g.medium');

  /**
   * Create a custom node type.
   * Use this for node types not yet defined in the enum.
   */
  public static of(nodeType: string): NodeType {
    return new NodeType(nodeType);
  }

  /** The node type string (e.g., 'db.r7g.large') */
  public readonly name: string;

  private constructor(name: string) {
    this.name = name;
  }

  /** Returns the node type string */
  public toString(): string {
    return this.name;
  }
}
```

**Internal behavior:**
- Creates `CfnSubnetGroup` from `vpc` and `vpcSubnets`
- Creates `SecurityGroup` if not provided
- Generates `clusterName` using `Names.uniqueResourceName()` if not provided
- Sets `tlsEnabled: true` by default

#### User

```ts
export interface UserProps {
  /** User name. Auto-generated if not provided. */
  readonly userName?: string;

  /** Access string defining permissions (Redis ACL rules). */
  readonly accessString: AccessString;

  /** Authentication mode. */
  readonly authenticationMode: AuthenticationMode;
}

export interface AuthenticationMode {
  readonly type: AuthenticationType;
  readonly passwords?: cdk.SecretValue[];
}

export enum AuthenticationType {
  PASSWORD = 'password',
  IAM = 'iam',
}

/**
 * Access string for MemoryDB users.
 * 
 * Defines what commands and keys a user can access using Redis ACL syntax.
 */
export class AccessString {
  /** Full access to all keys, channels, and commands. */
  public static readonly FULL_ACCESS = new AccessString('on ~* &* +@all');

  /** Read-only access to all keys and channels. */
  public static readonly READ_ONLY = new AccessString('on ~* &* +@read');

  /** Write access to all keys and channels (excludes admin commands). */
  public static readonly WRITE_ACCESS = new AccessString('on ~* &* +@write');

  /**
   * Create a custom access string.
   * Use Redis ACL syntax: https://redis.io/docs/management/security/acl/
   * 
   * @param accessString The Redis ACL access string (e.g., 'on ~app:* &* +@all')
   */
  public static of(accessString: string): AccessString {
    return new AccessString(accessString);
  }

  /** The access string value */
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Returns the access string */
  public toString(): string {
    return this.value;
  }
}

export interface IUser extends cdk.IResource {
  readonly userArn: string;
  readonly userName: string;
}

export class User extends cdk.Resource implements IUser {
  public static fromUserName(scope: Construct, id: string, userName: string): IUser;

  public readonly userArn: string;
  public readonly userName: string;

  constructor(scope: Construct, id: string, props: UserProps);
}
```

#### Acl

```ts
export interface AclProps {
  /** ACL name. Auto-generated if not provided. */
  readonly aclName?: string;

  /** Users to add to the ACL. */
  readonly users?: IUser[];
}

export interface IAcl extends cdk.IResource {
  readonly aclArn: string;
  readonly aclName: string;
}

export class Acl extends cdk.Resource implements IAcl {
  public static fromAclName(scope: Construct, id: string, aclName: string): IAcl;

  public readonly aclArn: string;
  public readonly aclName: string;

  constructor(scope: Construct, id: string, props?: AclProps);

  /** Add a user to this ACL. */
  public addUser(user: IUser): void;
}
```

### Is this a breaking change?

No. This RFC introduces new constructs in a module that currently has no L2s. Existing L1 usage is unaffected.

### What alternative solutions did you consider?

1. **Minimal L2 — Cluster only, no VPC integration**
   - Pros: Simpler, faster to implement
   - Cons: Users still need to manually create SubnetGroup, no `connections` pattern
   - Rejected: Doesn't solve the main pain points

2. **Full L2 — Include SubnetGroup and ParameterGroup as separate constructs**
   - Pros: Maximum flexibility for sharing resources across clusters
   - Cons: Larger scope, longer timeline
   - Deferred: Can be added later without breaking changes

3. **Accept strings for ACL/User references (e.g., `aclName: string | IAcl`)**
   - Pros: Easier migration from L1
   - Cons: Less type-safe, inconsistent with CDK patterns
   - Rejected: Interfaces only is cleaner

**Chosen approach:** Cluster with VPC integration (creates SubnetGroup internally), User, and Acl as L2 constructs. SubnetGroup and ParameterGroup can be passed by name for advanced use cases, with full L2 support deferred.

### What are the drawbacks of this solution?

- **SubnetGroup sharing:** Users who want to share a SubnetGroup across multiple clusters must use the L1 `CfnSubnetGroup` or wait for a follow-up RFC
- **ParameterGroup L2:** Not included — users pass `parameterGroupName` string
- **MultiRegionCluster:** Not included — requires separate RFC due to complexity
- **Limited import functionality:** Imported clusters cannot use `connections` for security group management

### What is the high-level project plan?

1. **Phase 1: Core Implementation** (2-3 weeks)
   - Implement `Cluster`, `User`, `Acl` constructs
   - Unit tests for all constructs
   - Integration with VPC, KMS, SNS

2. **Phase 2: Integration Tests** (1 week)
   - Deploy real clusters in test account
   - Verify endpoint connectivity
   - Test import functionality

3. **Phase 3: Documentation** (1 week)
   - README with examples
   - API documentation
   - Migration guide from L1

4. **Phase 4: Feedback & Stabilization** (ongoing)
   - Release as experimental (alpha) initially
   - Gather community feedback
   - Address issues before GA

### Are there any open issues that need to be addressed later?

- **SubnetGroup L2 construct** — For users who need to share subnet groups across clusters
- **ParameterGroup L2 construct** — For users who need to share parameter configurations
- **MultiRegionCluster L2 construct** — Complex multi-region active-active setup
- **Metrics integration** — CloudWatch metrics helper methods
- **Grant methods** — `grantConnect()` for IAM-based access (if applicable beyond security groups)

## Appendix

### Appendix A: CloudFormation Resource Reference

| L2 Construct | CloudFormation Resource | Notes |
|--------------|------------------------|-------|
| Cluster | AWS::MemoryDB::Cluster | Main resource |
| User | AWS::MemoryDB::User | Authentication |
| Acl | AWS::MemoryDB::ACL | Access control |
| (internal) | AWS::MemoryDB::SubnetGroup | Created by Cluster when VPC provided |
| (deferred) | AWS::MemoryDB::ParameterGroup | Users pass name for now |
| (deferred) | AWS::MemoryDB::MultiRegionCluster | Future RFC |

### Appendix B: API Design Details

*Add detailed interface definitions, class diagrams, or additional design notes here as needed.*
