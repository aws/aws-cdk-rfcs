# Amazon S3 Files L2 Constructs

* **Original Author(s):**: @Adonca2203
* **Tracking Issue**: #929
* **API Bar Raiser**: @leonmk-aws

This RFC proposes an alpha package in the AWS CDK repository providing
L2 constructs for Amazon S3 Files: `FileSystem` and `AccessPoint`
resources with VPC mount target management, IAM role automation, and
resource policies. The constructs will be published as
`@aws-cdk/aws-s3files-alpha` to allow API iteration before graduating
to `aws-cdk-lib`.

## Working Backwards

**CHANGELOG**:

`feat(s3files): S3 Files L2 constructs (alpha)`

**README**:

# Amazon S3 Files Construct Library

```ts
import * as s3files from '@aws-cdk/aws-s3files-alpha';
```

[Amazon S3 Files](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files.html)
allows customers to access data in existing S3 general purpose buckets
as a POSIX-compliant file system using NFSv4. Data is lazily imported
from S3 when read through the file system, and modified files are
automatically exported back to the bucket after a short idle period.

## File System

Create an S3 Bucket backed by a File System:

```ts
declare const vpc: ec2.Vpc;
declare const bucket: s3.Bucket;

const fileSystem = new s3files.FileSystem(this, 'MyFileSystem', {
  bucket,
  vpcConfiguration: {
    vpc,
    vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  },
});
```

The construct automatically:

* Creates mount targets in the specified subnets
* Creates a security group for NFS traffic (port 2049)
* Creates an IAM role with S3 bucket/object permissions and
  EventBridge permissions for the S3 Files service
* Sets `AcceptBucketWarning: true` on the CFN resource.
## Encryption

Encrypt the file system with a customer-managed KMS key:

```ts
declare const vpc: ec2.Vpc;
declare const bucket: s3.Bucket;
declare const key: kms.Key;

const fileSystem = new s3files.FileSystem(this, 'MyFileSystem', {
  bucket,
  vpcConfiguration: {
    vpc,
    vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  },
  kmsKey: key,
});
```

When a KMS key is provided, the auto-created IAM role automatically
includes `kms:GenerateDataKey`, `kms:Encrypt`, `kms:Decrypt`,
`kms:ReEncryptFrom`, and `kms:ReEncryptTo` permissions scoped to the
key via the S3 ViaService condition.

## Synchronization Configuration

Control how data is imported from S3 and when cached data expires:

```ts
declare const vpc: ec2.Vpc;
declare const bucket: s3.Bucket;

const fileSystem = new s3files.FileSystem(this, 'MyFileSystem', {
  bucket,
  vpcConfiguration: {
    vpc,
    vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  },
  prefix: 'data/',
  synchronizationConfiguration: {
    importDataRules: [{
      prefix: '/',
      sizeLessThan: Size.gibibytes(1),
      trigger: s3files.ImportDataRuleTrigger.ON_FILE_ACCESS,
    }],
    expirationDataRule: {
      daysAfterLastAccess: Duration.days(30),
    },
  },
});
```

## Granting Access

Use the grants facade to authorize principals for NFS client
operations:

```ts
declare const fileSystem: s3files.FileSystem;
declare const lambdaFunction: lambda.Function;

// Read-only mount access
fileSystem.grants.read(lambdaFunction);

// Read and write access
fileSystem.grants.readWrite(lambdaFunction);

// Root access (mount + write + root)
fileSystem.grants.rootAccess(lambdaFunction);
```

The grants facade can also be instantiated from an L1 or imported
resource:

```ts
const grants = s3files.FileSystemGrants.fromFileSystem(fileSystem);
grants.read(lambdaFunction);
```

## Metrics

Use the metrics facade to create CloudWatch metric objects:

```ts
declare const fileSystem: s3files.FileSystem;

const readOps = fileSystem.metrics.metric('DataReadIOBytes');
```

## File System Policy

Add a resource policy to control NFS access. A `CfnFileSystemPolicy`
resource is automatically created on the first call to
`addToResourcePolicy`:

```ts
declare const fileSystem: s3files.FileSystem;
declare const accessPoint: s3files.AccessPoint;

fileSystem.addToResourcePolicy(new iam.PolicyStatement({
  actions: ['s3files:ClientMount'],
  principals: [new iam.AnyPrincipal()],
  conditions: {
    StringEquals: {
      's3files:AccessPointArn': accessPoint.accessPointArn,
    },
  },
}));
```

## Access Points

An access point is an application-specific view into a file system
that applies a POSIX user/group and a file system path to any request
made through the access point:

```ts
declare const fileSystem: s3files.FileSystem;

const accessPoint = fileSystem.addAccessPoint('AccessPoint', {
  path: '/lambda',
  createAcl: {
    ownerUid: '1000',
    ownerGid: '1000',
    permissions: '755',
  },
  posixUser: {
    uid: '1000',
    gid: '1000',
  },
});
```

## Importing Existing Resources

```ts
declare const securityGroup: ec2.SecurityGroup;

const fileSystem = s3files.FileSystem.fromFileSystemAttributes(
  this, 'ImportedFs', {
    fileSystemArn:
      'arn:aws:s3files:us-east-1:123456789012:file-system/fs-12345678',
    securityGroup,
  },
);

const accessPoint = s3files.AccessPoint.fromAccessPointId(
  this, 'ImportedAp', 'fsap-12345678',
);
```

---

Ticking the box below indicates that the public API of this RFC has
been signed-off by the API bar raiser (the `status/api-approved` label
was applied to the RFC pull request):

```
[ ] Signed-off by API Bar Raiser @leonmk-aws
```

## Public FAQ

### What are we launching today?

An **alpha package** (`@aws-cdk/aws-s3files-alpha`) in the AWS CDK
repository that provides L2 constructs for Amazon S3 Files. This
includes `FileSystem` and `AccessPoint` constructs that abstract the
underlying CloudFormation resources (`AWS::S3Files::FileSystem`,
`AWS::S3Files::MountTarget`, `AWS::S3Files::AccessPoint`,
`AWS::S3Files::FileSystemPolicy`) and provide a high-level,
intent-driven API. The package is published as alpha to allow API
iteration before graduating to `aws-cdk-lib`.

### Why should I use this feature?

Without these L2 constructs, users must manually:

* Create the `CfnFileSystem` and wire up the S3 bucket ARN and IAM
  role ARN
* Create an IAM role with the correct trust policy for
  `elasticfilesystem.amazonaws.com` with source account/ARN conditions
* Attach 5+ IAM policy statements covering S3 bucket, S3 object, KMS,
  and EventBridge permissions
* Create `CfnMountTarget` resources for each subnet with security
  group references
* Create `CfnAccessPoint` resources with POSIX user and root directory
  configuration
* Manage `CfnFileSystemPolicy` resources separately

The L2 constructs reduce this to a few lines of code with sensible
defaults and automatic IAM policy generation.

## Internal FAQ

### Why are we doing this?

Amazon S3 Files is a new AWS service that provides POSIX file system
access to S3 buckets via NFSv4. The CloudFormation resources
(`AWS::S3Files::FileSystem`, `AWS::S3Files::MountTarget`,
`AWS::S3Files::AccessPoint`, `AWS::S3Files::FileSystemPolicy`) require
significant boilerplate to use correctly — particularly around IAM role
creation with the correct trust policy, S3/KMS/EventBridge permissions,
and VPC/subnet/security group wiring. An L2 construct dramatically
simplifies the user experience.

### Why should we _not_ do this?

* The S3 Files service is new and the CloudFormation resource model may
  evolve, requiring breaking changes to the L2 API.

### What is the technical solution (design) of this feature?

Provide `FileSystem` and `AccessPoint` L2 constructs that closely
mirror the CFN resource model but automate IAM role creation, mount
target management, and security group wiring.

* **FileSystem** — Accepts a bucket and VPC configuration.
  Automatically creates an IAM role with the correct trust policy and
  S3/EventBridge/KMS permissions, creates mount targets in specified
  subnets, and creates a security group for NFS traffic. Supports lazy
  `CfnFileSystemPolicy` creation via `addToResourcePolicy()`.
* **AccessPoint** — Created via `fileSystem.addAccessPoint()` or
  standalone. Configures POSIX user/group and root directory path.
* **Import methods** —
  `FileSystem.fromFileSystemAttributes()` and
  `AccessPoint.fromAccessPointId()` for referencing existing resources.

### Is this a breaking change?

No. This is a new alpha package (`@aws-cdk/aws-s3files-alpha`) with no
existing API surface.

### What alternative solutions did you consider?

**Option A: Thin wrapper (chosen)** — Provide `FileSystem` and
`AccessPoint` L2 constructs that closely mirror the CFN resource model
but automate IAM role creation, mount target management, and security
group wiring.

* Pros: Familiar to EFS users, minimal abstraction gap, easy to
  maintain as service evolves
* Cons: Users still need to understand VPC/subnet concepts

**Option B: High-level "S3FilesMount" construct** — A single construct
that creates the file system, access point, and mount configuration in
one step.

* Pros: Simplest possible API for common use cases
* Cons: Too opinionated, doesn't serve diverse compute use cases
  (Lambda, ECS, EC2), harder to compose

**Option C: L1 only (no L2)** — Rely on the auto-generated L1
constructs.

* Pros: Zero maintenance burden
* Cons: Poor user experience — requires 50+ lines of IAM policy
  boilerplate per file system

**Decision:** Option A was chosen because it follows established CDK
patterns, serves all use cases, and provides the highest-value
automation (IAM role creation) without being overly opinionated.

### What are the drawbacks of this solution?

* The API surface is similar to `aws-efs` but not identical, which
  could cause confusion for users familiar with EFS constructs.

### What are the differences from EFS L2 Construct?

* `S3Files` requires an S3 Bucket so this field is required to create
  the resource unlike EFS.
* S3Files uses a nested `vpcConfiguration` object (containing `vpc`,
  `vpcSubnets`, `securityGroup`, `ipAddressType`) whereas EFS accepts
  `vpc` and `vpcSubnets` as top-level props. Both use
  `ec2.SubnetSelection` for subnet specification.

### What is the high-level project plan?

Phase 1 - Alpha Package (current):

* `FileSystem` L2 with VPC mount targets, IAM role automation,
  resource policy support
* `AccessPoint` L2 with POSIX user and root directory configuration
* `FileSystem.fromFileSystemAttributes()` and
  `AccessPoint.fromAccessPointId()` import methods
* Unit tests and integration test
* Publish as `@aws-cdk/aws-s3files-alpha`

Phase 2 - GA (future):

* Graduate to `aws-cdk-lib/aws-s3files` after alpha feedback and API
  stabilization

### Are there any open issues that need to be addressed later?

* Final alpha package naming convention to be confirmed during
  implementation.

## Appendix

### CloudFormation Resources Covered

| CFN Resource | L2 Construct | Notes |
| --- | --- | --- |
| `AWS::S3Files::FileSystem` | `FileSystem` | Core resource with IAM role automation |
| `AWS::S3Files::MountTarget` | Created automatically by `FileSystem` | One per subnet in VPC configuration |
| `AWS::S3Files::AccessPoint` | `AccessPoint` | Created via `addAccessPoint()` or standalone |
| `AWS::S3Files::FileSystemPolicy` | Created automatically by `addToResourcePolicy()` | Lazy creation on first policy statement |

### API Surface

#### Interfaces

* `IFileSystem` - extends `IResource`, `IFileSystemRef`,
  `ec2.IConnectable`, `iam.IResourceWithPolicyV2`
  * `readonly grants: FileSystemGrants`
  * `readonly metrics: FileSystemMetrics`
* `IAccessPoint` - extends `IAccessPointRef`, `IResource`

#### Grants Facade (`FileSystemGrants`)

Auto-generated from `grants.json`. Defined grants:

| Method | Actions |
| --- | --- |
| `read` | `s3files:ClientMount` |
| `readWrite` | `s3files:ClientMount`, `s3files:ClientWrite` |
| `rootAccess` | `s3files:ClientMount`, `s3files:ClientWrite`, `s3files:ClientRootAccess` |

#### Enums

* `ImportDataRuleTrigger` - `ON_DIRECTORY_FIRST_ACCESS`,
  `ON_FILE_ACCESS`
* `IpAddressType` - `IPV4_ONLY`, `IPV6_ONLY`, `DUAL_STACK`

```ts
/**
 * Trigger type for import data rules.
 */
export enum ImportDataRuleTrigger {
  /**
   * Import data whenever a directory is first accessed.
   */
  ON_DIRECTORY_FIRST_ACCESS = 'ON_DIRECTORY_FIRST_ACCESS',

  /**
   * Import data whenever a file is accessed.
   */
  ON_FILE_ACCESS = 'ON_FILE_ACCESS',
}

/**
 * IP address type for mount targets.
 */
export enum IpAddressType {
  /**
   * IPv4 only.
   */
  IPV4_ONLY = 'IPV4_ONLY',

  /**
   * IPv6 only.
   */
  IPV6_ONLY = 'IPV6_ONLY',

  /**
   * Dual-stack (IPv4 and IPv6).
   */
  DUAL_STACK = 'DUAL_STACK',
}
```

#### Props Interfaces

* `VpcConfiguration` - vpc (required), vpcSubnets (required), securityGroup,
  ipAddressType

```ts
/**
 * Configuration for mount targets in a VPC.
 */
export interface VpcConfiguration {
  /**
   * The VPC to create mount targets in.
   */
  readonly vpc: ec2.IVpc;

  /**
   * Selection of subnets to place mount targets in.
   * Only create mount targets in subnets where clients
   * will connect from.
   */
  readonly vpcSubnets: ec2.SubnetSelection;

  /**
   * Security group for the mount targets in this VPC.
   *
   * @default - a new security group is created
   */
  readonly securityGroup?: ec2.ISecurityGroup;

  /**
   * The IP address type for the mount targets.
   *
   * @default IpAddressType.IPV4_ONLY
   */
  readonly ipAddressType?: IpAddressType;
}
```

* `FileSystemProps` - bucket (`s3.IBucket`), vpcConfiguration,
  role (`iam.IRole`), kmsKey (`kms.IKey`), prefix,
  synchronizationConfiguration, fileSystemPolicy,
  removalPolicy

```ts
/**
 * Properties for creating an S3 Files FileSystem.
 */
export interface FileSystemProps {
  /**
   * The S3 bucket that backs this file system.
   */
  readonly bucket: s3.IBucket;

  /**
   * VPC configuration for mount targets.
   */
  readonly vpcConfiguration: VpcConfiguration;

  /**
   * IAM role assumed by the S3 Files service to access
   * the bucket on behalf of the file system.
   *
   * @default - a new role is created with required policies
   */
  readonly role?: iam.IRole;

  /**
   * The KMS key used for encryption.
   *
   * @default - the bucket's own encryption configuration
   * is used
   */
  readonly kmsKey?: kms.IKey;

  /**
   * S3 key prefix to scope the file system to within
   * the bucket.
   *
   * @default - the entire bucket
   */
  readonly prefix?: string;

  /**
   * Synchronization configuration controlling data import
   * and expiration.
   *
   * @default - no synchronization configuration
   */
  readonly synchronizationConfiguration?:
    SynchronizationConfiguration;

  /**
   * Resource policy to attach at creation. Additional
   * policies can be added with `addToResourcePolicy` later.
   *
   * @default - none
   */
  readonly fileSystemPolicy?: iam.PolicyDocument;

  /**
   * The removal policy to apply to the file system.
   *
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;
}
```

* `Acl` - Access Point POSIX permissions

```ts
/**
 * Permissions as POSIX ACL.
 */
export interface Acl {
  /**
   * Specifies the POSIX user ID to apply to the
   * RootDirectory. Accepts values from 0 to 2^32
   * (4294967295).
   */
  readonly ownerUid: string;

  /**
   * Specifies the POSIX group ID to apply to the
   * RootDirectory. Accepts values from 0 to 2^32
   * (4294967295).
   */
  readonly ownerGid: string;

  /**
   * Specifies the POSIX permissions to apply to the
   * RootDirectory, in the format of an octal number
   * representing the file's mode bits.
   */
  readonly permissions: string;
}
```

* `AccessPointOptions` - createAcl, path, posixUser (used by
  `addAccessPoint()`)

```ts
/**
 * Options for creating an AccessPoint via addAccessPoint().
 */
export interface AccessPointOptions {
  /**
   * Specifies the POSIX IDs and permissions to apply when
   * creating the access point's root directory. If the root
   * directory specified by `path` does not exist, the file
   * system creates the root directory and applies the
   * permissions specified here. If the specified `path` does
   * not exist, you must specify `createAcl`.
   *
   * @default - None. The directory specified by `path`
   * must exist.
   */
  readonly createAcl?: Acl;

  /**
   * Specifies the path on the file system to expose as the
   * root directory to NFS clients using the access point to
   * access the file system.
   *
   * @default '/'
   */
  readonly path?: string;

  /**
   * The full POSIX identity, including the user ID, group
   * ID, and any secondary group IDs, on the access point
   * that is used for all file system operations performed
   * by NFS clients using the access point.
   *
   * @default - user identity not enforced
   */
  readonly posixUser?: PosixUser;
}
```

* `AccessPointProps` - extends `AccessPointOptions`, adds fileSystem

```ts
/**
 * Properties for the AccessPoint.
 */
export interface AccessPointProps extends AccessPointOptions {
  /**
   * The file system to create the access point on.
   */
  readonly fileSystem: IFileSystemRef;
}
```

* `FileSystemAttributes` - securityGroup, fileSystemId,
  fileSystemArn, used for imports

```ts
/**
 * Properties that describe an existing S3 Files file system.
 */
export interface FileSystemAttributes {
  /**
   * The security group of the file system.
   */
  readonly securityGroup: ec2.ISecurityGroup;

  /**
   * The file system ID.
   *
   * @default - determined based on fileSystemArn
   */
  readonly fileSystemId?: string;

  /**
   * The file system ARN.
   *
   * @default - determined based on fileSystemId
   */
  readonly fileSystemArn?: string;
}
```

* `AccessPointAttributes` - accessPointId, accessPointArn,
  fileSystem, used for imports

```ts
/**
 * Attributes for importing an AccessPoint.
 */
export interface AccessPointAttributes {
  /**
   * The ID of the access point.
   * One of this, or `accessPointArn` is required.
   *
   * @default - determined based on accessPointArn
   */
  readonly accessPointId?: string;

  /**
   * The ARN of the access point.
   * One of this, or `accessPointId` is required.
   *
   * @default - determined based on accessPointId
   */
  readonly accessPointArn?: string;

  /**
   * The file system associated with this access point.
   *
   * @default - no file system
   */
  readonly fileSystem?: IFileSystemRef;
}
```

* `SynchronizationConfiguration` - importDataRules,
  expirationDataRule

```ts
/**
 * Configuration for data import and expiration behavior.
 */
export interface SynchronizationConfiguration {
  /**
   * Rules controlling how data is imported from S3.
   * Must contain between 1 and 10 rules, and exactly one
   * rule must have a root prefix ('/').
   *
   * @default - service defaults
   */
  readonly importDataRules?: ImportDataRule[];

  /**
   * Rule controlling when cached data expires.
   * CFN requires exactly one expiration rule.
   *
   * @default - service defaults
   */
  readonly expirationDataRule?: ExpirationDataRule;
}

/**
 * Rule controlling how data is imported from S3.
 */
export interface ImportDataRule {
  /**
   * The S3 prefix pattern for this rule.
   * Must match pattern `^(|.*/)$`.
   */
  readonly prefix: string;

  /**
   * Maximum object size to import.
   * Objects larger than this are not imported.
   *
   * @default - no size limit
   */
  readonly sizeLessThan?: Size;

  /**
   * The trigger that causes data to be imported.
   *
   * @default ImportDataRuleTrigger.ON_DIRECTORY_FIRST_ACCESS
   */
  readonly trigger?: ImportDataRuleTrigger;
}

/**
 * Rule controlling when cached data expires.
 */
export interface ExpirationDataRule {
  /**
   * Number of days after last access before cached data
   * expires. Must be a whole number of days between 1
   * and 365.
   */
  readonly daysAfterLastAccess: Duration;
}
```
