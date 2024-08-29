# CloudFront Origin Access Control L2

* **Original Author(s)**: @gracelu0
* **Tracking Issue**: [#617](https://github.com/aws/aws-cdk-rfcs/issues/617)
* **API Bar Raiser**: @comcalvi

[CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
(OAC) is the recommended way to send authenticated requests
to an Amazon S3 origin using IAM service principals.
It offers better security, supports server-side encryption with AWS KMS,
and supports all Amazon S3 buckets in all AWS regions (OAC is not supported in China and GovCloud regions).

CloudFront provides OAC for restricting access to four types of origins: S3 origins, Lambda function URL origins, Elemental MediaStore
origins, and Elemental MediaPackage v2 origins.
This RFC is scoped to adding OAC for S3 origins.
See [Extending support to other origin types](#extending-support-to-other-origin-types) and
[Adding `OriginAccessControl` support for other origin types](#adding-originaccesscontrol-support-for-other-origin-types) for how we would add support
for other origin types.

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

To set up an origin using a standard S3 bucket, use the `S3BucketOrigin` class. The bucket
is handled as a bucket origin and
CloudFront's redirect and error handling will be used. It is recommended to use `S3BucketOrigin.withOriginAccessControl()` to configure OAC for your origin.

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(myBucket) },
});
```

>Note: `S3Origin` has been deprecated. Use `S3BucketOrigin` for standard S3 origins and `S3StaticWebsiteOrigin` for static website S3 origins.

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
replace the `S3Origin` construct (now deprecated) with `S3BucketOrigin.withOriginAccessControl()` which automatically
creates and sets up a OAC for you.
The OAI will be deleted as part of the
stack update. This migration will not cause resource replacement. Run `cdk diff` before deploying to verify the
changes to your stack.

Existing setup using OAI and `S3Origin`:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3Origin(myBucket) },
});
```

Updated setup using `S3BucketOrigin.withOriginAccessControl()`:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(myBucket) },
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
buckets in all AWS Regions, Amazon S3 server-side encryption with AWS KMS (SSE-KMS), and dynamic requests (PUT and DELETE) to Amazon S3. Additionally,
OAC provides stronger security posture with short term credentials,
and more frequent credential rotations as compared to OAI.
(see [Restricting access to an Amazon S3 Origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)).
OAI and OAC can be used in conjunction with a bucket that is not public to
require that your users access your content using CloudFront URLs and not S3 URLs directly.

> Note: OAC and OAI can only be used with an regular S3 bucket origin (not a bucket configured as a website endpoint).

The `S3BucketOrigin` class supports creating a S3 origin with OAC, OAI, and no access control (using your bucket access settings) via
the `withOriginAccessControl()`, `withOriginAccessIdentity()`, and `withBucketDefaults()` methods respectively.

Setup an S3 origin with origin access control as follows:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(myBucket) // Automatically creates an OAC
  },
});
```

You can also pass in a custom S3 origin access control:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
const oac = new cloudfront.S3OriginAccessControl(this, 'MyOAC', { signing: cloudfront.Signing.SIGV4_NO_OVERRIDE });
const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(
  bucket, { originAccessControl: oac }
)
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: s3Origin
  },
});
```

An existing S3 origin access control can be imported using the `fromOriginAccessControlId` method:

```ts
const importedOAC = cloudfront.S3OriginAccessControl.fromOriginAccessControlId(this, 'myImportedOAC', {
  originAccessControlId: 'ABC123ABC123AB',
});
```

Setup an S3 origin with origin access identity (legacy) as follows:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessIdentity(myBucket) // Automatically creates an OAI
  },
});
```

You can also pass in a custom S3 origin access identity:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
const myOai = new cloudfront.OriginAccessIdentity(this, 'myOAI', {
  comment: 'My custom OAI'
});
const s3Origin = origins.S3BucketOrigin.withOriginAccessIdentity(bucket, {
  originAccessIdentity: myOai
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: s3Origin
  },
});
```

To setup an S3 origin with no access control:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withBucketDefaults(myBucket)
  },
});
```

#### Using OAC for a SSE-KMS encrypted S3 origin

If the objects in the S3 bucket origin are encrypted using server-side encryption with
AWS Key Management Service (SSE-KMS), the OAC must have permission to use the AWS KMS key.
Setting up an S3 origin using `S3BucketOrigin.withOriginAccessControl()` will automatically add the statement to the KMS key policy
to give the OAC permission to use the KMS key.
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
    origin: origins.S3BucketOrigin.withOriginAccessControl(myBucket) // Automatically grants Distribution access to `myKmsKey`
  },
});
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[x] Signed-off by API Bar Raiser @comcalvi
```

## Public FAQ

### What are we launching today?

We are launching a new L2 construct `S3OriginAccessControl` for CloudFront (`aws-cdk-lib/aws-cloudfront`) to support OAC for S3 origins. We are also
deprecating the existing `S3Origin` construct in the `aws-cdk-lib/aws-cloudfront-origins` module and replacing it with `S3StaticWebsiteOrigin` and
`S3BucketOrigin` to provide a more transparent user experience.

### Why should I use this feature?

With this new feature, you can follow AWS best practices of using IAM service principals to authenticate with your AWS origin. This ensures users only
access the content in your AWS origin through your
specified CloudFront distribution. OAC also supports all S3 buckets in all AWS regions and S3 origins that use SSE-KMS encryption.

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

This feature is a set of new classes: `OriginAccessControl`, `S3BucketOrigin` and
`S3StaticWebsiteOrigin`. OAI still needs to be supported as
OAC is not available in China regions.

#### New `OriginAccessControl` L2 Construct

The OAC class for each origin type will extend a base class `OriginAccessControlBase` and set the value of `originAccessControlOriginType` accordingly.
`S3OriginAccessControlProps` has an additional property `originAccessLevels`
to give the user flexibility for the level of
permissions (combination of READ, WRITE, DELETE) to grant OAC.

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

export enum AccessLevel {
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

/**
 * Properties for creating a Origin Access Control resource.
 */
export interface S3OriginAccessControlProps extends OriginAccessControlBaseProps {
  /**
   * The level of permissions granted in the bucket policy and key policy (if applicable)
   * to the CloudFront distribution.
   * @default AccessLevel.READ
   */
  readonly originAccessLevels?: AccessLevel[];
}

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
   * Sign only if the viewer request doesn't contain the Authorization header
   * using the AWS Signature Version 4 signing protocol.
   */
  public static readonly SIGV4_NO_OVERRIDE = new Signing(SigningProtocol.SIGV4, SigningBehavior.NO_OVERRIDE);
  /**
   * Do not sign any origin requests.
   */
  public static readonly NEVER = new Signing(SigningProtocol.SIGV4, SigningBehavior.NEVER);

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
 * @internal
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
The implementation would be analagous for MediaStore and MediaPackageV2 OACs, with
each subclass setting the corresponding value of `originAccessControlOriginType`.
This would be `OriginAccessControlOriginType.MEDIASTORE` and `OriginAccessControlOriginType.MEDIAPACKAGEV2` respectively.

#### Deprecating `S3Origin` class

The `S3Origin` class currently represents an origin that is backed by an S3 bucket, whether it is a standard bucket or a static website endpoint.
`S3OriginProps` includes a property `originAccessIdentity` which is only applicable to a standard bucket, but the user can still specify an OAI even
if they have a bucket configured as a static website endpoint. Internally, an `HttpOrigin` is created for static website endpoints and `S3BucketOrigin`
for standard buckets. These each have their own configurations for the `Origin` [property](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-distribution-origin.html)
which are `CustomOriginConfig` and `S3OriginConfig` respectively.

This class couples two separate origin types which creates a confusing user experience and makes it harder to maintain. Additionally,
the `S3Origin` class currently creates an OAI by default for standard S3 bucket origins. We would have to maintain this default for backwards compatibility,
even though it is no longer the best AWS practice.

The proposal is to deprecate `S3Origin` and replace it with two classes: `S3StaticWebsiteOrigin` for static website endpoints and
`S3BucketOrigin` for standard S3 bucket origins.

#### S3 Bucket Origin

The `S3BucketOrigin` class will be an abstract class used to set up standard S3 bucket origins with various access control options: OAI, OAC and
no origin access control (uses S3 bucket configuration only). The proposal is to create separate public static functions `withOriginAccessIdentity()`,
`withOriginAccessControl()`, and `withBucketDefaults()` for OAI, OAC and no origin access controls respectively. Each function instantiates its own
class which implements the `bind()` method. The `bind()` method binds the origin to the
associated Distribution, configuring the `Origin` [property](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-distribution-origin.html)
and granting permissions to the S3 bucket. Since each origin access resource updates
the bucket policy and `S3OriginConfig` property differently, this reduces coupling and provides more flexibility if there are future changes to S3 bucket
origins. It also ensures users can only configure either OAI or OAC on their origin—configuring both is not allowed and will fail during deployment.

* `S3BucketOrigin` — abstract base class

```ts
interface S3BucketOriginBaseProps extends cloudfront.OriginProps {}

interface S3BucketOriginWithOACProps extends S3BucketOriginBaseProps {
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

interface S3BucketOriginWithOACProps extends S3BucketOriginBaseProps {
  /**
  * An optional Origin Access Identity
  * @default - an Origin Access Identity will be created.
  */
  readonly originAccessIdentity?: cloudfront.IOriginAccessIdentity;
}

abstract class S3BucketOrigin extends cloudfront.OriginBase {
  public static withOriginAccessControl(bucket: IBucket, props?: S3BucketOriginWithOACProps): cloudfront.IOrigin {
    return new class extends S3BucketOrigin {
      public bind(scope: Construct, options: cloudfront.OriginBindOptions): cloudfront.OriginBindConfig {
        // Create OAC, update bucket policy and return bind configuration
      }
    }();
  }

  public static withOriginAccessIdentity(bucket: IBucket, props?: S3BucketOriginWithOAIProps): cloudfront.IOrigin {
    return new class extends S3BucketOrigin {
      public bind(scope: Construct, options: cloudfront.OriginBindOptions): cloudfront.OriginBindConfig {
        // Setup OAI and return bind configuration
      }
    }();
  }

  public static withBucketDefaults(bucket: IBucket, props?: cloudfront.OriginProps): cloudfront.IOrigin {
    return new class extends S3BucketOrigin {
      constructor() {
        super({bucket, ...props});
      }
    }();
  }

  constructor(props: S3OriginBaseProps) {
    super(props.bucket.bucketRegionalDomainName, props);
  }

  protected _bind(scope: Construct, options: cloudfront.OriginBindOptions): cloudfront.OriginBindConfig {
    return super.bind(scope, options);
  }

  protected renderS3OriginConfig(): cloudfront.CfnDistribution.S3OriginConfigProperty | undefined {
    return { originAccessIdentity: '' };
  }
}
```

For setting up OAC, when the S3 bucket uses SSE-KMS encryption (customer-managed key),
a circular dependency error occurs when trying to deploy the template. When granting
the CloudFront distribution access to use the KMS Key by updating the key policy, there is a circular dependency:

- CloudFront distribution references the S3 bucket
- S3 bucket references the KMS key
- KMS Key references the CloudFront distribution

This issue exists because the key policy is defined by the `KeyPolicy` property and is not currently supported as a
separation CloudFormation resource (i.e. AWS::KMS::KeyPolicy). There is an open GitHub feature request to CloudFormation for `AWS::KMS::KeyPolicy`
but no near future plans to support.

We could write a custom resource to support `AWS::KMS::KeyPolicy` functionality. It would retrieve and update the KMS key policy after the CloudFront
distribution has been created via the `GetKeyPolicy()` and `PutKeyPolicy()` API calls. However, custom resources result in increased maintenance cost
(for us and the customer). When `AWS::KMS::KeyPolicy` is supported, the risks of migrating from the custom resource to use it include
behavioural changes due to implementation differences, resource replacement, service downtime, and more. The risks outweigh the benefits of
simplifying the setup process for the user. Thus the proposed solution as part of this launch is to document workarounds for this circular dependency
issue which may require some manual work from the user.

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

#### Extending support to other origin types

##### Lambda Function URLs

`FunctionUrlOrigin` construct exists for creating Lambda Function URL origins.
To support OAC, we would need to add optional prop `originAccessControl` to `FunctionUrlOriginProps`. As well, we would need to add and implement a
`bind` method to grant the Distribution permission and configure the `originAccessControlId` property.

To create a distribution with Lambda Function URL origin and OAC:

```ts
const fn = new lambda.Function(this, 'Function', {
  code: lambda.Code.fromInline('exports.handler = async () => { return "Hello from Lambda!"; }'),
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_18_X,
});
const fnUrl = fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.AWS_IAM });
const lambdaDist = new cloudfront.Distribution(this, 'LambdaDistribution', {
  defaultBehavior: {
    origin: new origins.FunctionUrlOrigin(fnUrl, {
      originAccessControl: new cloudfront.LambdaOriginAccessControl(this, 'MyLambdaOAC')
    }),
  },
});
```

##### MediaStore containers

No L2s exist for MediaStore nor a MediaStore origin currently. [HttpOrigin](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.HttpOrigin.html)
is the generic class for creating a HTTP server where the user is required to pass in the domain name. It also implements function `renderCustomOriginConfig()`
which configures the `CustomOriginConfig` property for Distribution.

Implementing the L2s for
[MediaStore resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_MediaStore.html) should be a prerequisite for
creating a new MediaStore origin class.

A class for MediaStore origins could be implemented as below (using the L1 in this example). It extends `HttpOrigin` and passes the container endpoint
to the HttpOrigin constructor:

```ts
interface MediaStoreOriginProps extends HttpOriginProps { }

class MediaStoreOrigin extends HttpOrigin {

  constructor(container: mediastore.CfnContainer, props: MediaStoreOriginProps = {}) {
    super(container.attrEndpoint, { ...props });
  }
}
```

Creating a Distribution with MediaStore origin and OAC:

```ts
const mediastoreDist = new cloudfront.Distribution(this, 'MediaStoreDistribution', {
  defaultBehavior: {
    origin: new origins.MediaStoreOrigin(container, {
      originAccessControl: new cloudfront.MediaStoreOriginAccessControl(this, 'MediaStoreOAC')
    }),
  },
});
```

##### MediaPackageV2 channels

Similar to MediaStore containers, no L2s exist for MediaPackageV2 nor MediaPackageV2 origins currently.

Implementing the L2s for
[MediaPackageV2 resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_MediaPackageV2.html) should be a prerequisite for
creating a new MediaPackageV2 origin class.

Getting the domain name for the MediaPackageV2 origin is a bit more complicated than for the other origin types.
The domain name for MediaPackageV2 origin endpoints is the prefix of the manifest URL, e.g. given the manifest URL
`https://fc1i33.egress.a7b7cc.mediapackagev2.us-east-1.amazonaws.com/out/v1/my-oac-channel/channel/my-endpoint/my-manifest.m3u8`,
the domain name is `https://fc1i33.egress.a7b7cc.mediapackagev2.us-east-1.amazonaws.com`.

For the [OriginEndpoint](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-mediapackagev2-originendpoint.html) CloudFormation
resource, there are multiple relevant [return values](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-mediapackagev2-originendpoint.html#aws-resource-mediapackagev2-originendpoint-return-values)
that could be used to get the domain name (depending on how the origin is configured): `DashManifestUrls`, `HlsManifestUrls`,
or `LowLatencyHlsManifestUrls`. The implementation details are out of scope
for this RFC.

A class for MediaPackageV2 origins could be
implemented as below (using the L1 in this example). It extends `HttpOrigin` and passes the origin endpoint to the HttpOrigin constructor:

```ts
interface MediaPackageV2OriginProps extends HttpOriginProps { }

class MediaPackageV2Origin extends HttpOrigin {

  constructor(originEndpoint: mediapackagev2.CfnOriginEndpoint, props: MediaPackageV2OriginProps = {}) {
    const endpointUrl = getUrlFromOriginEndpoint(originEndpoint);
    super(endpointUrl, { ...props });
  }
}
```

Creating a Distribution with MediaPackageV2 origin and OAC:

```ts
const mediapackageV2Dist = new cloudfront.Distribution(this, 'MediaPackageV2Distribution', {
  defaultBehavior: {
    origin: new origins.MediaPackageV2Origin(originEndpoint, {
      originAccessControl: new cloudfront.MediaPackageV2OriginAccessControl(this, 'MediaPackageV2OAC')
    }),
  },
});
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

#### Deprecating `CloudFrontWebDistribution`

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
