# CloudFront Origin Access Control L2

* **Original Author(s)**: @gracelu0
* **Tracking Issue**: [#617](https://github.com/aws/aws-cdk-rfcs/issues/617)
* **API Bar Raiser**: @TheRealAmazonKendra

[CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
(OAC) is the recommended way to send authenticated requests
to an Amazon S3 origin using IAM service principals.
It offers better security, supports server-side encryption with AWS KMS,
and supports all Amazon S3 buckets in all AWS regions, including opt-in Regions launched after December 2022.

Currently the `S3Origin` construct automatically creates an Origin Access Identity (OAI)
to restrict access to an S3 Origin. However, using OAI is now considered
[legacy](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html#private-content-restricting-access-to-s3-oai)
and no longer recommended.
CDK users who want to use OAC currently have to use the L1 construct `CfnOriginAccessControl`.
They need to use escape hatches to attach the OAC to their CloudFront distribution and remove
the OAI that is automatically configured. With a CloudFront OAC L2 construct,
users will be able to easily set up their CloudFront origins using OAC instead of OAI.

## Working Backwards

### CHANGELOG

`feat(cloudfront): s3 origin access control L2 construct`

### README

# Amazon CloudFront Construct Library

Amazon CloudFront is a web service that speeds up distribution of your static and
dynamic web content, such as .html, .css, .js, and image files, to your users.
CloudFront delivers your content through a worldwide network of data centers called
edge locations. When a user requests content that you're serving with CloudFront,
the user is routed to the edge location that provides the lowest latency, so that
content is delivered with the best possible performance.

## Creating a Distribution

CloudFront distributions deliver your content from one or more origins; an origin is
the location where you store the original version of your content. Origins can be
created from S3 buckets or a custom origin (HTTP server). Constructs
to define origins are in the `aws-cdk-lib/aws-cloudfront-origins` module.

Each distribution has a default behavior which applies to all requests to that
distribution, and routes requests to a primary origin. Additional behaviors may
be specified for an origin with a given URL path pattern. Behaviors allow routing
with multiple origins, controlling which HTTP methods to support, whether to require
users to use HTTPS, and what query strings or cookies to forward to your origin, among other settings.

# CloudFront Origins for the CDK CloudFront Library

## S3 Bucket

An S3 bucket can be used as an origin. An S3 bucket origin can either be configured as a standard bucket or as a website endpoint (see [Use an S3 Bucket](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html#using-s3-as-origin)).

### Standard S3 Bucket

To set up an origin using a standard S3 bucket, use the `S3BucketOriginWithOAI`, `S3BucketOriginWithOAC`, or `S3BucketOriginPublic` classes. The bucket
is handled as a bucket origin and
CloudFront's redirect and error handling will be used.

### S3 Bucket Configured as a Website Endpoint

To set up an origin using a S3 bucket configured as a website endpoint, use the `S3StaticWebsiteOrigin` class. When the bucket is configured as a
website endpoint, the bucket is treated as an HTTP origin,
and the distribution can use built-in S3 redirects and S3 custom error pages.

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3StaticWebsiteOrigin(myBucket) },
});
```

## Migrating from OAI to OAC

If you are currently using OAI for your S3 origin and wish to migrate to OAC,
replace the `S3Origin` construct with `S3BucketOriginWithOAC`. You can create and pass in an `S3OriginAccessControl` or one will be automatically
created by default.
The OAI will be deleted as part of the
stack update. The logical IDs of the resources managed by
the stack will be unchanged. Run `cdk diff` before deploying to verify the
changes to your stack.

Existing setup using OAI and `S3Origin`:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3Origin(myBucket) },
});
```

Updated setup using `S3BucketOriginWithOAC`:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3BucketOriginWithOAC(myBucket) },
});
```

For more information, see [Migrating from origin access identity (OAI) to origin access control (OAC)](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html#migrate-from-oai-to-oac).

### Using pre-existing S3 buckets

If you are using an imported bucket for your S3 Origin and want to use OAC,
you will need to update
the S3 bucket policy manually. CDK apps cannot modify the configuration of imported constructs. After deploying the distribution, add the following
policy statement to your
S3 bucket to allow CloudFront read-only access
(or additional permissions as required):

```
{
    "Version": "2012-10-17",
    "Statement": {
        "Sid": "GrantOACAccessToS3",
        "Effect": "Allow",
        "Principal": {
            "Service": "cloudfront.amazonaws.com"
        },
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::<S3 bucket name>/*",
        "Condition": {
            "StringEquals": {
                "AWS:SourceArn": "arn:aws:cloudfront::111122223333:distribution/<CloudFront distribution ID>"
            }
        }
    }
}
```

> Note: If your bucket previously used OAI, you will need to manually remove the policy statement
that gives the OAI access to your bucket from your bucket policy.

### Restricting access to an S3 Origin

CloudFront provides two ways to send authenticated requests to an Amazon S3 origin:
origin access control (OAC) and origin access identity (OAI).
OAI is considered legacy due to limited functionality and regional
limitations, whereas OAC is recommended because it supports All Amazon S3
buckets in all AWS Regions, including opt-in Regions launched after
December 2022, Amazon S3 server-side encryption with AWS KMS (SSE-KMS), and dynamic requests (PUT and DELETE) to Amazon S3. Additionally, OAC provides
stronger security posture with short term credentials,
and more frequent credential rotations as compared to OAI.
(see [Restricting access to an Amazon S3 Origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)).
OAI and OAC can be used in conjunction with a bucket that is not public to
require that your users access your content using CloudFront URLs and not S3 URLs directly.

> Note: OAC and OAI can only be used with an regular S3 bucket origin (not a bucket configured as a website endpoint).

To setup origin access control for an S3 origin, you can create an `S3OriginAccessControl`
resource and pass it into the `originAccessControl` property of the origin:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
const oac = new cloudfront.S3OriginAccessControl(this, 'myS3OAC');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: new origins.S3BucketOriginWithOAC(myBucket, {
      originAccessControl: oac
    })
  },
});
```

If you use `S3BucketOriginWithOAC` and do not pass in an OAC, one will automatically be created for you and attached to the distribution.

```ts
const myBucket = new s3.Bucket(this, 'myBucket', {
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { 
    origin: new origins.S3BucketOriginWithOAC(myBucket) // Automatically creates an OAC
  },
});
```

You can also customize the S3 origin access control:

```ts
const myOAC = new cloudfront.S3OriginAccessControl(this, 'myOAC', {
  description: 'Origin access control for S3 origin',
  signing: cloudfront.Signing.SIGV4_NEVER
});
```

An existing S3 origin access control can be imported using the `fromOriginAccessControlId` method:

```ts
const importedOAC = cloudfront.S3OriginAccessControl.fromOriginAccessControlId(this, 'myImportedOAC', {
  originAccessControlId: 'ABC123ABC123AB',
});
```

#### Using OAC for a SSE-KMS encrypted S3 origin

If the objects in the S3 bucket origin are encrypted using server-side encryption with
AWS Key Management Service (SSE-KMS), the OAC must have permission to use the AWS KMS key.
The `S3BucketOriginWithOAC` construct will automatically add the statement to the KMS key policy to give the OAC permission to use the KMS key.
For imported keys, you will need to manually update the
key policy yourself as CDK apps cannot modify the configuration of imported resources.

```ts
const myKmsKey = new kms.Key(this, 'myKMSKey');
const myBucket = new s3.Bucket(this, 'mySSEKMSEncryptedBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: kmsKey,
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { 
    origin: new origins.S3BucketOriginWithOAC(myBucket) // Automatically grants Distribution access to `myKmsKey`
  },
});
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @TheRealAmazonKendra
```

## Public FAQ

### What are we launching today?

We are launching a new L2 construct `OriginAccessControl` for CloudFront (`aws-cdk-lib/aws-cloudfront`). We are also deprecating the existing `S3Origin`
construct in the `aws-cdk-lib/aws-cloudfront-origins` module and replacing it with `S3StaticWebsiteOrigin`, `S3BucketOriginWithOAI`, `S3BucketOriginWithOAC`,
and `S3BucketOriginPublic` to provide a more transparent user experience.

### Why should I use this feature?

With this new feature, you can follow AWS best practices of using IAM service principals to authenticate with your AWS origin. This ensures users only
access the content in your AWS origin through your
specified CloudFront distribution. OAC also supports new opt-in AWS
regions launched after December 2022 and S3 origins that use SSE-KMS encryption.

## Internal FAQ

### Why are we doing this?

This feature has been highly requested by the community since August 2022 when Origin Access Control was launched (195 upvotes on the
[GitHub issue](https://github.com/aws/aws-cdk/issues/21771)). Although the L1 construct `CfnOriginAccessControl` exists, users currently need to remove
the OAI automatically configured by the existing `S3Origin`
construct which is a subpar user experience. We want
to make it easier for users to follow AWS best practices and
secure their CloudFront origins.

### Why should we _not_ do this?

Users who want to use OAC may have already found workarounds using the L1 construct.

### What is the technical solution (design) of this feature?

This feature is a set of new classes: `OriginAccessControl`, `S3BucketOriginWithOAI`, `S3BucketOriginWithOAC`, `S3BucketOriginPublic` and
`S3StaticWebsiteOrigin`. OAI still needs to be supported as
OAC is not available in China regions.

#### New `OriginAccessControl` L2 Construct

The OAC class for each origin type will extend a base class `OriginAccessControlBase` and set the value of `originAccessControlOriginType` accordingly.

```ts
/**
 * Represents a CloudFront Origin Access Control
 */
export interface IOriginAccessControl extends IResource {
  /**
   * The unique identifier of the origin access control.
   * @attribute
   */
  readonly originAccessControlId: string;
}

/**
 * Common properties for creating a Origin Access Control resource.
 */
export interface OriginAccessControlBaseProps {
  /**
   * A description of the origin access control.
   * @default - no description
   */
  readonly description?: string;
  /**
   * A name to identify the origin access control. You can specify up to 64 characters.
   * @default - a generated name
   */
  readonly originAccessControlName?: string;
  /**
   * Specifies which requests CloudFront signs and the signing protocol.
   * @default SIGV4_ALWAYS
   */
  readonly signing?: Signing;
}

/**
 * Properties for creating a Origin Access Control resource.
 */
export interface S3OriginAccessControlProps extends OriginAccessControlBaseProps {}

/**
 * Origin types supported by Origin Access Control.
 */
export enum OriginAccessControlOriginType {
  /**
   * Uses an Amazon S3 bucket origin.
   */
  S3 = 's3',
  /**
   * Uses a Lambda function URL origin.
   */
  LAMBDA = 'lambda',
  /**
   * Uses an AWS Elemental MediaStore origin.
   */
  MEDIASTORE = 'mediastore',
  /**
   * Uses an AWS Elemental MediaPackage v2 origin.
   */
  MEDIAPACKAGEV2 = 'mediapackagev2',
}

/**
 * Options for which requests CloudFront signs.
 * Specify `always` for the most common use case.
 */
export enum SigningBehavior {
  /**
   * Sign all origin requests, overwriting the Authorization header
   * from the viewer request if one exists.
   */
  ALWAYS = 'always',
  /**
   * Do not sign any origin requests.
   * This value turns off origin access control for all origins in all
   * distributions that use this origin access control.
   */
  NEVER = 'never',
  /**
   * Sign origin requests only if the viewer request
   * doesn't contain the Authorization header.
   */
  NO_OVERRIDE = 'no-override',
}

/**
 * The signing protocol of the Origin Access Control.
 */
export enum SigningProtocol {
  /**
   * The AWS Signature Version 4 signing protocol.
   */
  SIGV4 = 'sigv4',
}

/**
 * Options for how CloudFront signs requests.
 */
export class Signing {
  /**
   * Sign all origin requests using the AWS Signature Version 4 signing protocol.
   */
  public static readonly SIGV4_ALWAYS = new Signing(SigningProtocol.SIGV4, SigningBehavior.ALWAYS);
  /**
   * Do not sign any origin requests.
   */
  public static readonly SIGV4_NEVER = new Signing(SigningProtocol.SIGV4, SigningBehavior.NEVER);
  /**
   * Sign only if the viewer request doesn't contain the Authorization header
   * using the AWS Signature Version 4 signing protocol.
   */
  public static readonly SIGV4_NO_OVERRIDE = new Signing(SigningProtocol.SIGV4, SigningBehavior.NO_OVERRIDE);

  /**
   * The signing protocol
   */
  public readonly protocol: SigningProtocol;
  /**
   * Which requests CloudFront signs.
   */
  public readonly behavior: SigningBehavior;

  public constructor(protocol: SigningProtocol, behavior: SigningBehavior) {
    this.protocol = protocol;
    this.behavior = behavior;
  }
}

/**
 * An Origin Access Control.
 * @resource AWS::CloudFront::OriginAccessControl
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cloudfront-originaccesscontrol.html
 */
export abstract class OriginAccessControlBase extends Resource implements IOriginAccessControl {
  /**
   * The Id of the origin access control
   * @attribute
   */
  public abstract readonly originAccessControlId: string;

  protected validateOriginAccessControlName(name: string) {
    if (!Token.isUnresolved(name) && name.length > 64) {
      throw new Error(`Origin access control name must be 64 characters or less, '${name}' has length ${name.length}`);
    }
  }
}

/**
 * An Origin Access Control for Amazon S3 origins.
 */
export class S3OriginAccessControl extends OriginAccessControlBase {
  /**
   * Imports an S3 origin access control from its id.
   */
  public static fromOriginAccessControlId(scope: Construct, id: string, originAccessControlId: string): IOriginAccessControl {
    class Import extends Resource implements IOriginAccessControl {
      public readonly originAccessControlId = originAccessControlId;
      public readonly originAccessControlOriginType = OriginAccessControlOriginType.S3;
    }
    return new Import(scope, id);
  }

  public readonly originAccessControlId: string;

  constructor(scope: Construct, id: string, props: S3OriginAccessControlProps = {}) {
    super(scope, id);

    // Check if origin access control name is 64 characters or less
    if (props.originAccessControlName) {
      this.validateOriginAccessControlName(props.originAccessControlName);
    }

    const resource = new CfnOriginAccessControl(this, 'Resource', {
      originAccessControlConfig: {
        description: props.description,
        name: props.originAccessControlName ?? Names.uniqueResourceName(this, {
          maxLength: 64,
        }),
        signingBehavior: props.signing?.behavior ?? SigningBehavior.ALWAYS,
        signingProtocol: props.signing?.protocol ?? SigningProtocol.SIGV4,
        originAccessControlOriginType: OriginAccessControlOriginType.S3,
      },
    });

    this.originAccessControlId = resource.attrId;
  }
}
```

#### Adding `OriginAccessControl` support for other origin types

To extend OAC support to other origin types, e.g. Lambda function URL, we can create a new subclass (e.g. `LambdaOriginAccessControl`) that extends
`OriginAccessControlBase`. The subclass should set the value of `originAccessControlOriginType` accordingly, e.g. to
`OriginAccessControlOriginType.LAMBDA` for a Lambda Function Url OAC.

#### Deprecating `S3Origin` class

The `S3Origin` class currently represents an origin that is backed by an S3 bucket, whether it is a standard bucket or a static website endpoint.
`S3OriginProps` includes a property `originAccessIdentity` which is only applicable to a standard bucket, but the user can still specify an OAI even
if they have a bucket configured as a static website endpoint. Internally, an `HttpOrigin` is created for static website endpoints and `S3BucketOrigin`
for standard buckets. These each have their own configurations for the `Origin` [property](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-distribution-origin.html)
which are `CustomOriginConfig` and `S3OriginConfig` respectively.

This class couples two separate origin types which creates a confusing user experience and makes it harder to maintain. Additionally,
the `S3Origin` class currently creates an OAI by default for standard S3 bucket origins. We would have to maintain this default for backwards compatibility,
even though it is no longer the best AWS practice.

The proposal is to deprecate `S3Origin` and replace it with several classes: `S3StaticWebsiteOrigin` for static website endpoints and
`S3BucketOriginWithOAI`, `S3BucketOriginWithOAC`, or `S3BucketOriginPublic` for standard S3 bucket origins.

#### S3 Bucket Origin

The `S3BucketOrigin` class will be an abstract class used to set up standard S3 bucket origins with various access control options: OAI, OAC and
public access. Each access control option will have its own subclass which implements the `bind()` method. The `bind()` method binds the origin to the
associated Distribution, configuring the `Origin` [property](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-distribution-origin.html)
and granting permissions to the S3 bucket. The proposal is to create separate subclasses for OAI, OAC and public access because they update the bucket
policy and `S3OriginConfig` property differently. This reduces coupling and provides more flexibility if there are future changes to S3 bucket
origins. It also ensures users can only configure either OAI or OAC on their origin—configuring both is not allowed and will fail during deployment.

* `S3BucketOrigin` — abstract base class

```ts
interface S3OriginBaseProps extends cloudfront.OriginProps {
  readonly bucket: IBucket;
}

abstract class S3BucketOrigin extends cloudfront.OriginBase {
  constructor(props: S3OriginBaseProps) {
    super(props.bucket.bucketRegionalDomainName, props);
  }

  protected renderS3OriginConfig(): cloudfront.CfnDistribution.S3OriginConfigProperty | undefined {
    return { originAccessIdentity: '' };
  }
}
```

* `S3BucketOriginPublic` — subclass to define a S3 origin with public access

```ts
interface S3BucketOriginPublicProps extends S3OriginBaseProps {}

class S3BucketOriginPublic extends S3BucketOrigin {
  constructor(props: S3OriginBaseProps) {
    super(props);
  }
}
```

* `S3BucketOriginWithOAI` — subclass to define a S3 origin with OAI

```ts
interface S3BucketOriginWithOAIProps extends S3OriginBaseProps {
  /**
  * An optional Origin Access Identity
  * @default - an Origin Access Identity will be created.
  */
  readonly originAccessIdentity?: cloudfront.IOriginAccessIdentity;
}

class S3BucketOriginWithOAI extends S3BucketOrigin {
  constructor(props: S3BucketOriginWithOAIProps) {}

  public bind(scope: Construct, options: cloudfront.OriginBindOptions): cloudfront.OriginBindConfig {}
}
```

* `S3BucketOriginWithOAC` — subclass to define a S3 origin with OAC

```ts
interface S3BucketOriginWithOACProps extends S3OriginBaseProps {
  /**
  * An optional Origin Access Control
  * @default - an Origin Access Control will be created.
  */
  readonly originAccessControl?: cloudfront.IOriginAccessControl;

  /**
   * The level of permissions granted in the bucket policy and key policy (if applicable)
   * to the CloudFront distribution.
   * @default AccessLevel.READ
   */
  readonly originAccessLevels?: AccessLevel[];
}

enum AccessLevel {
  /**
   * Grants 's3:GetObject' permission to OAC
   */
  READ = 'READ',
  /**
   * Grants 's3:PutObject' permission to OAC
   */
  WRITE = 'WRITE',
  /**
   * Grants 's3:DeleteObject' permission to OAC
   */
  DELETE = 'DELETE',
}

class S3BucketOriginWithOAC extends S3BucketOrigin {
  constructor(props: S3BucketOriginWithOACProps) {}

  public bind(scope: Construct, options: cloudfront.OriginBindOptions): cloudfront.OriginBindConfig {}
}
```

An additional property `originAccessLevels` will be added to `S3BucketOriginWithOACProps`
to give the user flexibility for the level of
permissions (combination of READ, WRITE, DELETE) to grant OAC.

In the case where the S3 bucket uses SSE-KMS encryption (customer-managed key),
a circular dependency error occurs when trying to deploy the template. When granting
the CloudFront distribution access to use the KMS Key, there is a circular dependency:

- CloudFront distribution references the S3 bucket
- S3 bucket references the KMS key
- KMS Key references the CloudFront distribution

The proposed solution to this issue is to use a custom resource
to retrieve and update the KMS key policy after the CloudFront
distribution has been created via the `GetKeyPolicy()` and `PutKeyPolicy()` API calls.

#### S3 Static Website Origin

* `S3StaticWebsiteOrigin` — class to create origins for S3 bucket configured as a website endpoint

```ts
interface S3StaticWebsiteOriginProps extends HttpOriginProps {
  readonly bucket: IBucket;
}

class S3StaticWebsiteOrigin extends HttpOrigin {
  constructor(props: S3StaticWebsiteOriginProps) {
    super(props.bucket.bucketWebsiteDomainName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // S3 only supports HTTP for website buckets
      ...props,
    });
  }
}
```

#### `Distribution` construct modifications

In the `addOrigin()` method of `Distribution`, we will need to pass the `distributionId` to `origin.bind()` to specify the condition in the policy
statement below.

```ts
  private addOrigin(origin: IOrigin, isFailoverOrigin: boolean = false): string {
    const ORIGIN_ID_MAX_LENGTH = 128;

    const existingOrigin = this.boundOrigins.find(boundOrigin => boundOrigin.origin === origin);
    if (existingOrigin) {
      return existingOrigin.originGroupId ?? existingOrigin.originId;
    } else {
      ...
      const distributionId = this.distributionId;
      const originBindConfig = origin.bind(scope, { originId: generatedId, distributionId: Lazy.string({ produce: () => this.distributionId }) });
      ...
    }
  }
```

Policy statement to grant Distribution access to S3 origin with condition referencing `distributionId`:

```
{
    "Version": "2012-10-17",
    "Statement": {
        "Sid": "GrantOACAccessToS3",
        "Effect": "Allow",
        "Principal": {
            "Service": "cloudfront.amazonaws.com"
        },
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::<S3 bucket name>/*",
        "Condition": {
            "StringEquals": {
                "AWS:SourceArn": "arn:aws:cloudfront::111122223333:distribution/<CloudFront distribution ID>"
            }
        }
    }
}
```

### Deprecating `CloudFrontWebDistribution`

This RFC proposes changes to support using OAC with the `Distribution` construct, which is the modern, improved API for creating CloudFront
distributions using CDK. `CloudFrontWebDistribution` is the original construct
written for working with CloudFront distributions.
The CDK docs provide a
[section](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront-readme.html#migrating-from-the-original-cloudfrontwebdistribution-to-the-newer-distribution-construct)
to help users migrate from `CloudFrontWebDistribution` to `Distribution`,
but it is not clearly stated anywhere that `CloudFrontWebDistribution` is deprecated. As OAC L2 support (and other new features) will only be provided
for `Distribution` going forward, an official deprecation of `CloudFrontWebDistribution` will be part of this change.

### Is this a breaking change?

No, this is not a breaking change. This is a new feature and configuring S3 origins using OAI will still be supported.

### What is the high-level project plan?

- [ ] Create prototype for design
- [ ] Gather feedback on the RFC
- [ ] Get bar raiser to sign off on RFC
- [ ] Implement the construct in a separate repository
- [ ] Make pull request to aws-cdk repository
- [ ] Iterate and respond to PR feedback
- [ ] Merge new construct and related changes

### Are there any open issues that need to be addressed later?

No.

## Appendix

- [Prototype branch](https://github.com/gracelu0/aws-cdk/tree/oac-l2)
