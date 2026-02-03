# S3 Vectors L2 Construct

* **Original Author(s):**: @{AUTHOR}
* **Tracking Issue**: #867 (https://github.com/aws/aws-cdk-rfcs/issues/867)
* **API Bar Raiser**: @{BAR_RAISER_USER}

This RFC proposes graduating the existing S3 Vectors L2 constructs from the
`@cdklabs/generative-ai-cdk-constructs` library into an alpha package in the
AWS CDK repository. The constructs reduce the need to manually wire S3 Vectors
resources and IAM policies by providing an intent-based API with sensible
defaults, grant methods, and encryption handling—improving the experience for
teams building semantic search and AI applications on S3 Vectors.

## Working Backwards

A quick comparison between L1 (CloudFormation) and L2 S3 Vectors constructs:

1. **Quick and easy creation of resources**
   - Vector buckets, vector indexes, and bucket policies are created with minimal
     code and sensible defaults (e.g., SSE-S3, auto-generated names).
   - L2 hides CloudFormation resource naming and property wiring.

2. **Encryption and key management**
   - Default SSE-S3 or optional SSE-KMS with auto-created or customer-managed
     KMS keys.
   - L2 automatically grants the S3 Vectors service principal
     (`indexing.s3vectors.amazonaws.com`) the necessary KMS permissions for
     background operations when using KMS encryption.

3. **Grant methods for IAM**
   - `VectorBucket`: `grantRead()`, `grantWrite()`, `grantDelete()` with optional index-level scoping.
   - `VectorIndex`: `grant()` for specific actions (e.g., `s3vectors:QueryVectors`, `s3vectors:PutVectors`).
   - Grant methods automatically include KMS permissions when the bucket or index uses KMS encryption.

4. **Resource-based policies**
   - `addToResourcePolicy()` on buckets; `VectorBucketPolicy` construct for full policy documents.
   - Bucket policy is created on first `addToResourcePolicy()` call.

5. **Import and sharing**
   - Static factory methods: `fromVectorBucketArn`, `fromVectorBucketName`, `fromVectorBucketAttributes`; same pattern for `VectorIndex`.
   - Bucket and index references can be passed across stacks.

6. **Lifecycle and cleanup**
   - Configurable removal policy; `autoDeleteObjects` (buckets) uses a custom
     resource to delete indexes before bucket deletion so the bucket can be
     destroyed when it contains indexes.

**CHANGELOG**:

```text
feat(s3vectors): S3 Vectors L2 construct (alpha)

Introduce alpha package @aws-cdk/aws-s3vectors-alpha with L2 constructs for
Amazon S3 Vectors: VectorBucket, VectorIndex, and VectorBucketPolicy. These
constructs provide intent-based APIs, grant methods, encryption handling, and
import factories for building semantic search and AI applications.
```

**README**:

Amazon S3 Vectors delivers purpose-built, cost-optimized vector storage for
semantic search and AI applications. With S3-level elasticity and durability
and sub-second query performance, S3 Vectors is ideal for applications that need
to build and grow vector indexes. This construct library provides L2 constructs
to manage S3 Vectors resources: **Vector Bucket**, **Vector Index**, and
**Vector Bucket Policy**.

S3 Vectors consists of:

- **Vector buckets** – A bucket type for storing and querying vectors.
- **Vector indexes** – Organize vector data within a bucket; similarity queries run against indexes.
- **Vectors** – Stored in indexes (e.g., embeddings); optional metadata for filtering.

### Vector Bucket

Vector buckets are optimized for long-term vector storage with sub-second search.
Data is always encrypted at rest (default SSE-S3; optional SSE-KMS). Bucket
encryption cannot be changed after creation.

#### VectorBucket Properties

<!-- markdownlint-disable MD060 -->
| Name                 | Type                     | Required  | Description                                      |
| -------------------- | ------------------------ | --------- | ------------------------------------------------ |
| `vectorBucketName`   | `string`                 | No        | Custom bucket name. Omitted: CFN generates.     |
| `encryption`         | `VectorBucketEncryption` | No        | S3_MANAGED (default) or KMS.                     |
| `encryptionKey`      | `kms.IKey`               | No        | Customer KMS key when encryption is KMS.         |
| `autoDeleteObjects`  | `boolean`                | No        | Custom resource deletes indexes before bucket.   |
| `removalPolicy`      | `cdk.RemovalPolicy`      | No        | RETAIN (default) or DESTROY with autoDeleteObjects.  |
<!-- markdownlint-enable MD060 -->

#### Basic Vector Bucket Creation

```ts
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket');
```

With custom name:

```ts
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket', {
  vectorBucketName: 'my-custom-bucket-name',
});
```

#### Encryption

**SSE-S3 (default):**

```ts
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket', {
  encryption: s3vectors.VectorBucketEncryption.S3_MANAGED,
});
```

**SSE-KMS (auto-created key):**

```ts
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket', {
  encryption: s3vectors.VectorBucketEncryption.KMS,
});
```

**SSE-KMS (customer-managed key):**  
When using a customer-managed KMS key, the construct grants the S3 Vectors
service principal (`indexing.s3vectors.amazonaws.com`) the required permissions
(e.g., `kms:Decrypt`) for background operations.

```ts
const myKmsKey = new kms.Key(this, 'MyKey', {
  description: 'KMS key for S3 Vectors bucket',
  enableKeyRotation: true,
});

const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket', {
  encryption: s3vectors.VectorBucketEncryption.KMS,
  encryptionKey: myKmsKey,
});
```

#### Bucket Permissions

**Resource-based policy:**  
A bucket policy is created on the first call to `addToResourcePolicy()`.

```ts
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket');
vectorBucket.addToResourcePolicy(
  new iam.PolicyStatement({
    actions: ['s3vectors:GetVectorBucket', 's3vectors:ListIndexes'],
    resources: [vectorBucket.vectorBucketArn],
    principals: [new iam.AccountRootPrincipal()],
  })
);
```

**Grant methods:**  
Grant read/write/delete to principals; optionally scope to specific index names.
KMS permissions are added automatically when the bucket uses KMS encryption.

```ts
declare const myLambda: lambda.Function;
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket');

vectorBucket.grantRead(myLambda);
vectorBucket.grantRead(myLambda, ['index-1', 'index-2']);
vectorBucket.grantWrite(myLambda);
vectorBucket.grantDelete(myLambda, ['index-1']);
```

#### Bucket Deletion

With `RemovalPolicy.DESTROY`, the bucket is deleted only if it has no indexes.
Use `autoDeleteObjects: true` to delete all indexes (via custom resource)
before deleting the bucket.

```ts
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket', {
  autoDeleteObjects: true,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

#### Importing Vector Buckets

```ts
// By ARN
const imported = s3vectors.VectorBucket.fromVectorBucketArn(
  this, 'Imported', 'arn:aws:s3vectors:us-east-1:123456789012:bucket/my-bucket-name'
);

// By name
const imported = s3vectors.VectorBucket.fromVectorBucketName(
  this, 'Imported', 'my-bucket-name'
);

// By attributes
const imported = s3vectors.VectorBucket.fromVectorBucketAttributes(
  this, 'Imported', {
    vectorBucketArn: 'arn:aws:s3vectors:us-east-1:123456789012:bucket/my-bucket-name',
    creationTime: '2024-01-01T00:00:00Z',
  }
);
```

### Vector Index

Vector indexes live inside a vector bucket and store vectors for similarity
search. You specify dimension (1–4096), distance metric (Cosine or Euclidean),
and optionally non-filterable metadata keys and index-level encryption.

#### VectorIndex Properties

<!-- markdownlint-disable MD060 -->
| Name                        | Type                        | Required | Description                                 |
| --------------------------- | --------------------------- | -------- | ------------------------------------------- |
| `vectorBucket`              | `IVectorBucket`             | Yes      | The vector bucket that contains this index. |
| `dimension`                 | `number`                    | Yes      | Vector dimension (1–4096). Match model.    |
| `distanceMetric`            | `VectorIndexDistanceMetric` | No       | COSINE (default) or EUCLIDEAN.              |
| `dataType`                  | `VectorIndexDataType`       | No       | FLOAT_32 (default, only option today).      |
| `nonFilterableMetadataKeys` | `string[]`                  | No       | Keys (1–10) stored but not for filter.      |
| `encryption`                | `VectorIndexEncryption`     | No       | Inherit or S3_MANAGED or KMS.               |
| `encryptionKey`             | `kms.IKey`                  | No       | Customer KMS key when index encryption KMS. |
<!-- markdownlint-enable MD060 -->

Index names (if specified) must be 3–63 characters, lowercase letters/numbers/
dots/hyphens, and start/end with letter or number. If not specified,
CloudFormation generates a name.

#### Basic Vector Index Creation

```ts
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket');
const vectorIndex = new s3vectors.VectorIndex(this, 'MyVectorIndex', {
  vectorBucket,
  dimension: 128,
});
```

#### Distance Metric and Data Type

```ts
const cosineIndex = new s3vectors.VectorIndex(this, 'CosineIndex', {
  vectorBucket,
  dimension: 128,
  distanceMetric: s3vectors.VectorIndexDistanceMetric.COSINE,
});

const euclideanIndex = new s3vectors.VectorIndex(this, 'EuclideanIndex', {
  vectorBucket,
  dimension: 128,
  distanceMetric: s3vectors.VectorIndexDistanceMetric.EUCLIDEAN,
});

const withDataType = new s3vectors.VectorIndex(this, 'WithDataType', {
  vectorBucket,
  dimension: 128,
  dataType: s3vectors.VectorIndexDataType.FLOAT_32,
});
```

#### Non-filterable Metadata Keys

Metadata keys (1–10 per index, 1–63 chars, naming rules as index names) that
are stored and retrieved but not used for filtering:

```ts
const vectorIndex = new s3vectors.VectorIndex(this, 'MyVectorIndex', {
  vectorBucket,
  dimension: 128,
  nonFilterableMetadataKeys: ['originalText', 'sourceUrl', 'timestamp'],
});
```

#### Index Encryption

Index can use SSE-S3 or SSE-KMS; when using KMS, the construct grants the S3
Vectors service principal the needed key permissions.

```ts
const vectorIndex = new s3vectors.VectorIndex(this, 'MyVectorIndex', {
  vectorBucket,
  dimension: 128,
  encryption: s3vectors.VectorIndexEncryption.KMS,
  encryptionKey: myKmsKey,
});
```

#### Index Permissions

```ts
declare const myLambda: lambda.Function;
vectorIndex.grant(myLambda, 's3vectors:GetIndex', 's3vectors:QueryVectors', 's3vectors:PutVectors');
```

KMS permissions are included when the index uses KMS encryption.

#### Importing Vector Indexes

```ts
const imported = s3vectors.VectorIndex.fromVectorIndexArn(
  this, 'Imported',
  'arn:aws:s3vectors:us-east-1:123456789012:bucket/my-bucket/index/my-index'
);

const byName = s3vectors.VectorIndex.fromVectorIndexName(
  this, 'ByName', 'my-bucket-name', 'my-index-name'
);

const byAttrs = s3vectors.VectorIndex.fromVectorIndexAttributes(this, 'ByAttrs', {
  vectorIndexArn: 'arn:aws:s3vectors:us-east-1:123456789012:bucket/my-bucket/index/my-index',
  creationTime: '2024-01-01T00:00:00Z',
});
```

### Vector Bucket Policy

Attach resource-based policies to vector buckets for cross-account or fine-grained access.

#### Basic Usage

```ts
const vectorBucket = new s3vectors.VectorBucket(this, 'MyVectorBucket');
const policy = new s3vectors.VectorBucketPolicy(this, 'MyBucketPolicy', {
  bucket: vectorBucket,
});

policy.document.addStatements(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['s3vectors:GetVectorBucket', 's3vectors:ListIndexes'],
    resources: [vectorBucket.vectorBucketArn],
    principals: [new iam.AccountRootPrincipal()],
  })
);
```

#### Providing a Policy Document

```ts
const policyDoc = new iam.PolicyDocument({
  statements: [
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3vectors:GetVectorBucket'],
      resources: [vectorBucket.vectorBucketArn],
      principals: [new iam.AnyPrincipal()],
    }),
  ],
});

const policy = new s3vectors.VectorBucketPolicy(this, 'MyBucketPolicy', {
  bucket: vectorBucket,
  document: policyDoc,
});
```

Policies can reference both bucket ARN and index ARNs (e.g., `${vectorBucket.vectorBucketArn}/index/*`). Removal policy can be set on the policy resource.

### Additional Resources

- [Amazon S3 Vectors User Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html)
- [Data protection and encryption in S3 Vectors](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-data-encryption.html)
- [S3 Vectors access management](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-access-management.html)
- [S3 Vectors limitations and restrictions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-limitations.html)

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching an **alpha package** in the AWS CDK repository that provides
L2 constructs for **Amazon S3 Vectors**. The package includes:

- **VectorBucket** – Create and manage S3 Vectors buckets with encryption
  (SSE-S3 or SSE-KMS), grant methods, resource policies, and import factories.
- **VectorIndex** – Create and manage vector indexes inside a bucket (dimension,
  distance metric, non-filterable metadata, optional index-level encryption)
  with grant methods and import factories.
- **VectorBucketPolicy** – Attach IAM policy documents to vector buckets for
  cross-account and resource-based access control.

The APIs are published as an alpha package (e.g., `@aws-cdk/aws-s3vectors-alpha`)
so we can iterate on feedback before stabilizing. The constructs are already
implemented and documented in `@cdklabs/generative-ai-cdk-constructs`; this RFC
covers graduating them into the CDK repo as an alpha module.

### Why should I use this feature?

- **Semantic search and RAG** – Store embeddings in S3 Vectors and run similarity
  queries with minimal infra code; use grant methods to give Lambdas or other
  principals read/write/query access.
- **Encryption and compliance** – Use SSE-S3 by default or SSE-KMS (with auto or
  customer-managed keys); the constructs handle service-principal KMS
  permissions for background indexing.
- **Cross-stack and import** – Reference existing buckets/indexes via ARN,
  name, or attributes and pass them between stacks.
- **Consistent CDK patterns** – Same patterns as other L2 resources (grants,
  policies, removal policy, auto-delete) so teams already using CDK can adopt
  S3 Vectors quickly.

## Internal FAQ

### Why are we doing this?

S3 Vectors is a purpose-built service for vector storage and similarity search.
Customers building RAG and semantic search need CDK support that matches the
rest of the Construct Library: intent-based APIs, grant methods, encryption
defaults, and clear lifecycle behavior. The constructs already exist in the
cdklabs generative-ai library; graduating them into an alpha package in the CDK
repo aligns ownership with the rest of the CDK ecosystem, enables standard
release and versioning, and sets the path to GA (e.g., into `aws-cdk-lib`) after
alpha feedback.

### Why should we _not_ do this?

- **Niche adoption** – If S3 Vectors adoption stays low, maintaining a dedicated
  alpha package may not be justified; we could keep recommending the cdklabs
  package instead.
- **API churn** – If we expect large API changes, keeping the constructs only in
  cdklabs until the API stabilizes might reduce churn for CDK repo consumers.

We still recommend graduating: the implementation is mature, the surface area
is well-scoped (bucket, index, policy), and having an alpha package in-repo
gives clearer signals and a single place to collect feedback before GA.

### What is the technical solution (design) of this feature?

- **Source of truth** – Use the existing implementation and API from
  `@cdklabs/generative-ai-cdk-constructs` (S3 Vectors module) as the reference.
  No functional redesign; focus on repo layout, package naming, and lifecycle.
- **Package** – Add a new alpha package in the AWS CDK monorepo (e.g.,
  `packages/@aws-cdk/aws-s3vectors-alpha` or under an existing alpha namespace).
  Package is marked experimental/alpha in `package.json` and README.
- **API surface** – Export `VectorBucket`, `VectorIndex`, `VectorBucketPolicy`,
  and the supporting enums/types (e.g., `VectorBucketEncryption`,
  `VectorIndexDistanceMetric`, `VectorIndexDataType`, `VectorIndexEncryption`).
  Preserve grant methods, import factories, and encryption/KMS grant behavior.
- **Dependencies** – Depend on `aws-cdk-lib` (and optionally other alpha
  packages if needed). No new runtime dependencies.
- **Testing and docs** – Migrate or mirror unit/integration tests from the
  cdklabs library; ensure README and docstrings reflect the alpha package and
  point to S3 Vectors user guide where appropriate.
- **L1 alignment** – L2 constructs wrap the relevant CloudFormation resources
  (e.g., `AWS::S3Vectors::VectorBucket`, `AWS::S3Vectors::VectorIndex`, bucket
  policy resource). Ensure property and physical-name mapping stays consistent
  with the CloudFormation resource spec.

### Is this a breaking change?

No. This is an additive alpha package. No changes to
`aws-cdk-lib` or existing stable packages.

The plan is to later deprecate the S3 Vectors subset of the cdklabs package in favor of
the CDK alpha/GA module, we would do that in a separate decision with a clear
migration path and BREAKING CHANGE note in the cdklabs changelog.

### What alternative solutions did you consider?

Using L1 constructs for each feature individually was considered.
However, this approach requires extensive code to provision resources and lacks the abstraction benefits of L2 constructs.

### What are the drawbacks of this solution?

None

### What is the high-level project plan?

1. **RFC and API bar raiser sign-off** – Get this RFC approved and API signed off.
2. **Create alpha package in CDK repo** – Add package under the chosen name
   (e.g., `@aws-cdk/aws-s3vectors-alpha`), wire build/test/lint and jsii for
   all supported languages.
3. **Migrate or reimplement** – Either copy the implementation from cdklabs
   (with proper attribution/license) or reimplement to the same API surface.
   Prefer migration to reduce risk and preserve behavior.
4. **Tests and docs** – Port tests; add/update README and docstrings for the
   alpha package; ensure examples run with the new package.
5. **Publish alpha** – Publish to npm (and other package managers) as
   alpha/experimental; announce in CDK changelog and relevant channels.
6. **Gather feedback** – Use GitHub issues and community feedback to iterate on
   API and behavior. Document known limitations and roadmap in the package README.
7. **Stabilize for GA (future)** – Once stable, follow the Construct Library
   module lifecycle (RFC 0107) to propose moving from alpha to GA (e.g., into
   `aws-cdk-lib` or a stable submodule), with a separate RFC if needed. We will then deprecate
   the cdklabs version.

### Are there any open issues that need to be addressed later?

- **Package naming** – Final name of the alpha package (e.g.,
  `@aws-cdk/aws-s3vectors-alpha` vs another naming scheme) to be confirmed
  during implementation.
- **cdklabs deprecation** – Deprecate the S3 Vectors subset
  in `@cdklabs/generative-ai-cdk-constructs` in favor of the CDK alpha/GA
  package; to be decided after alpha has been available and migration path is
  clear.
- **L1 resource availability** – Ensure CloudFormation resource types
  (`AWS::S3Vectors::*`) are available in the regions where we document S3
  Vectors; document or gate if needed for preview regions.

## Appendix

None at this time. Detailed API (method signatures, prop types) can be taken
from the existing [S3 Vectors documentation](https://github.com/awslabs/generative-ai-cdk-constructs)
and the AWS S3 Vectors User Guide.
