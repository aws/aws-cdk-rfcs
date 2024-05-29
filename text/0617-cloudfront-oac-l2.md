# CloudFront Origin Access Control L2

* **Original Author(s)**: @gracelu0
* **Tracking Issue**: [#617](https://github.com/aws/aws-cdk-rfcs/issues/617)
* **API Bar Raiser**: @colifran

[CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html) (OAC) is the recommended way to send authenticated requests to an Amazon S3 origin using IAM service principals. It offers better security, supports server-side encryption with AWS KMS, and supports all Amazon S3 buckets in all AWS regions. 

Currently the `S3Origin` construct automatically creates an Origin Access Identity (OAI) to restrict access to an S3 Origin. However, using OAI is now considered [legacy](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html#private-content-restricting-access-to-s3-oai) and no longer recommended. CDK users who want to use OAC currently have to use the L1 construct `CfnOriginAccessControl`. They need to use escape hatches to attach the OAC to their CloudFront distribution and remove the OAI that is automatically configured. With a CloudFront OAC L2 construct, users will be able to easily set up their CloudFront origins using OAC instead of OAI.

## Working Backwards

### CHANGELOG

`feat(cloudfront): origin access control L2 construct`

### README

# Amazon CloudFront Construct Library
Amazon CloudFront is a web service that speeds up distribution of your static and dynamic web content, such as .html, .css, .js, and image files, to your users. CloudFront delivers your content through a worldwide network of data centers called edge locations. When a user requests content that you're serving with CloudFront, the user is routed to the edge location that provides the lowest latency, so that content is delivered with the best possible performance.

## Creating a Distribution

CloudFront distributions deliver your content from one or more origins; an origin is the location where you store the original version of your content. Origins can be created from S3 buckets or a custom origin (HTTP server). Constructs to define origins are in the `aws-cdk-lib/aws-cloudfront-origins` module.

Each distribution has a default behavior which applies to all requests to that distribution, and routes requests to a primary origin. Additional behaviors may be specified for an origin with a given URL path pattern. Behaviors allow routing with multiple origins, controlling which HTTP methods to support, whether to require users to use HTTPS, and what query strings or cookies to forward to your origin, among other settings.

#### From an S3 Bucket

An S3 bucket can be added as an origin. If the bucket is configured as a website endpoint, the distribution can use S3 redirects and S3 custom error
documents.

```ts
// Creates a distribution from an S3 bucket.
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3Origin(myBucket) },
});
```

The above will treat the bucket differently based on if `IBucket.isWebsite` is set or not. If the bucket is configured as a website, the bucket is
treated as an HTTP origin, and the built-in S3 redirects and error pages can be used. Otherwise, the bucket is handled as a bucket origin and
CloudFront's redirect and error handling will be used.

## Restricting access to an S3 origin

CloudFront provides two ways to send authenticated requests to an Amazon S3 origin: origin access control (OAC) and origin access identity (OAI). OAC is the recommended option and OAI is considered legacy (see [Restricting access to an Amazon S3 Origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)). These can be used in conjunction with a bucket that is not public to require that your users access your content using CloudFront
URLs and not S3 URLs directly.

> Note: OAC and OAI can only be used with an regular S3 bucket origin (not a bucket configured as a website endpoint). 

To setup origin access control for an S3 origin, you can create an `OriginAccessControl`
resource and pass it into the `originAccessControl` property of the origin:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
const oac = new cloudfront.OriginAccessControl(this, 'myS3OAC');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { 
    origin: new origins.S3Origin(myBucket, {
      originAccessControl: oac
    })
  },
});
```
It is recommended to set the `@aws-cdk/aws-cloudfront:useOriginAccessControl` feature flag to `true`, so an OAC will be automatically created instead of an OAI when `S3Origin` is instantiated. If you don't set this feature flag, and OAI will be created and granted access to the underlying bucket.


## Migrating from OAI to OAC

If you are currently using OAI for your S3 origin and wish to migrate to OAC, first set the feature flag `@aws-cdk/aws-cloudfront:useOriginAccessControl` to `true` in `cdk.json`. With this feature flag set, when you create a new `S3Origin` an Origin Access Control will be used instead of Origin Access Identity. You can create and pass in an `OriginAccessControl` or one will be automatically created by default.

For more information, see [Migrating from origin access identity (OAI) to origin access control (OAC)](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html#migrate-from-oai-to-oac).

### Using pre-existing S3 buckets

If you are using an imported bucket for your S3 Origin and want to use OAC, first import the bucket using one of the import methods (`fromBucketName`, `fromBucketArn` or `fromBucketAttributes`). 

The `S3Origin` construct will update the S3 bucket policy to allow CloudFront read-only access. If your bucket previously used OAI, there will be an attempt to remove both the policy statement that allows access to the OAI and the origin access identity itself.

```ts
const bucket = s3.Bucket.fromBucketArn(this, 'MyExistingBucket', 
  'arn:aws:s3:::mybucketname'
);

const oac = new cloudfront.OriginAccessControl(this, 'MyOAC', {
  originAccessControlOriginType: cloudfront.OriginAccessControlOriginType.S3,
});

const distribution = new cloudfront.Distribution(this, 'MyDistribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(bucket, {
      originAccessControl: oac
    })
  }
});
```


# CloudFront Origins for the CDK CloudFront Library

## S3 Bucket

An S3 bucket can be added as an origin. If the bucket is configured as a website endpoint, the distribution can use S3 redirects and S3 custom error
documents.

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3Origin(myBucket) },
});
```

The above will treat the bucket differently based on if `IBucket.isWebsite` is set or not. If the bucket is configured as a website, the bucket is
treated as an HTTP origin, and the built-in S3 redirects and error pages can be used. Otherwise, the bucket is handled as a bucket origin and
CloudFront's redirect and error handling will be used. 

### Restricting access to an S3 Origin

CloudFront provides two ways to send authenticated requests to an Amazon S3 origin: origin access control (OAC) and origin access identity (OAI). OAC is the recommended method and OAI is considered legacy (see [Restricting access to an Amazon Simple Storage Service origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)). Following AWS best practices, it is recommended you set the feature flag `@aws-cdk/aws-cloudfront:useOriginAccessControl` to `true` to use OAC by default when creating new origins.

For an S3 bucket that is configured as a standard S3 bucket origin (not as a website endpoint), when the above feature flag is enabled the `S3Origin` construct will automatically create an OAC and grant it access to the underlying bucket.

> [Note](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html): When you use OAC with S3 bucket origins you must set the bucket's object ownership to Bucket owner enforced, or Bucket owner preferred (only if you require ACLs).

```ts
const myBucket = new s3.Bucket(this, 'myBucket', {
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { 
    origin: new origins.S3Origin(myBucket) // Automatically creates an OAC
  },
});
```

Alternatively, a custom origin access control can be passed to the S3 origin:

```ts
const myBucket = new s3.Bucket(this, 'myBucket');
const myOAC = new cloudfront.OriginAccessControl(this, 'myOAC', {
  description: 'Origin access control for S3 origin',
  originAccessControlOriginType: cloudfront.OriginAccessControlOriginType.S3,
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { 
    origin: new origins.S3Origin(myBucket, {
      originAccessControl: myOAC
    }),
  },
});
```

If the feature flag is not enabled (i.e. set to `false`), an origin access identity will be created by default.

#### Using OAC for a SSE-KMS encrypted S3 origin

If the objects in the S3 bucket origin are encrypted using server-side encryption with AWS Key Management Service (SSE-KMS), the OAC must have permission to use the AWS KMS key. A statement needs to be added to the KMS key policy to give the OAC permission to use the KMS key. 

```ts
const myKmsKey = new kms.Key(this, 'myKMSKey');
const myBucket = new s3.Bucket(this, 'mySSEKMSEncryptedBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: kmsKey,
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { 
    origin: new origins.S3Origin(myBucket) // Automatically creates an OAC
  },
});
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @colifran
```

## Public FAQ

### What are we launching today?

We are launching a new L2 construct `OriginAccessControl` for CloudFront (`aws-cdk-lib/aws-cloudfront`). We are also launching some modifications to the existing `S3Origin` construct in the `aws-cdk-lib/aws-cloudfront-origins` module.

### Why should I use this feature?

With this new feature, you can follow AWS best practices of using IAM service principals to authenticate with your AWS origin. This ensures users only access the content in your AWS origin through your specified CloudFront distribution. OAC also supports new AWS regions launched after December 2022 and S3 origins that use SSE-KMS encryption.

## Internal FAQ

### Why are we doing this?

This feature has been highly requested by the community since August 2022 when Origin Access Control was launched (195 upvotes on the [GitHub issue](https://github.com/aws/aws-cdk/issues/21771)). Although the L1 construct `CfnOriginAccessControl` exists, users currently need to remove the OAI automatically configured by the existing `S3Origin` construct which is a subpar user experience. We want to make it easier for users to follow AWS best practices and secure their CloudFront origins. 

### Why should we _not_ do this?

Users who want to use OAC may have already found workarounds using the L1 construct.

### What is the technical solution (design) of this feature?

This feature will be introduced under a feature flag `@aws-cdk/aws-cloudfront:useOriginAccessControl` as the current default configuration for S3 origins using OAI is still supported.

#### New `OriginAccessControl` L2 Construct

```ts
export interface IOriginAccessControl extends IResource {
  /**
   * The unique identifier of the origin access control.
   * @attribute
   */
  readonly originAccessControlId: string;
}

abstract class OriginAccessControlBase extends Resource implements IOriginAccessControl {
  /**
   * The unique identifier of the origin access control.
   * @attribute
   */
  public abstract readonly originAccessControlId: string;
}

/**
 * Properties for creating a OriginAccessControl resource.
 */
export interface OriginAccessControlProps {
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
   * The type of origin that this origin access control is for.
   * @default s3
   */
  readonly originAccessControlOriginType?: OriginAccessControlOriginType;
  /**
   * Specifies which requests CloudFront signs.
   * @default always
   */
  readonly signingBehavior?: SigningBehavior;
  /**
   * The signing protocol of the origin access control.
   * @default sigv4
   */
  readonly signingProtocol?: SigningProtocol;
}

/**
 * Origin types supported by origin access control.
 */
export enum OriginAccessControlOriginType {
  /**
   * Uses an Amazon S3 bucket origin.
   */
  S3 = 's3',
  /**
   * Uses an AWS Elemental MediaStore origin.
   */
  MEDIASTORE = 'mediastore',
  /**
   * Uses a Lambda function URL origin.
   */
  LAMBDA = 'lambda',
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
 * The signing protocol of the origin access control.
 */
export enum SigningProtocol {
  /**
   * The AWS Signature Version 4 signing protocol.
   */
  SIGV4 = 'sigv4',
}

/**
 * An Origin Access Control.
 * @resource AWS::CloudFront::OriginAccessControl
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cloudfront-originaccesscontrol.html
 */
export class OriginAccessControl extends OriginAccessControlBase {
  /**
   * Imports an origin access control from its id.
   */
  public static fromOriginAccessControlId(scope: Construct, id: string, originAccessControlId: string): IOriginAccessControl {
    class Import extends OriginAccessControlBase {
      public readonly originAccessControlId = originAccessControlId;
      constructor(s: Construct, i: string) {
        super(s, i);

        this.originAccessControlId = originAccessControlId;
      }
    }
    return new Import(scope, id);
  }

  public readonly originAccessControlId: string;
  constructor(scope: Construct, id: string, props: OriginAccessControlProps = {}) {
    super(scope, id);

    const resource = new CfnOriginAccessControl(this, 'Resource', {
      originAccessControlConfig: {
        description: props.description,
        name: props.originAccessControlName ?? this.generateName(),
        signingBehavior: props.signingBehavior ?? SigningBehavior.ALWAYS,
        signingProtocol: props.signingProtocol ?? SigningProtocol.SIGV4,
        originAccessControlOriginType: props.originAccessControlOriginType ?? OriginAccessControlOriginType.S3,
      },
    });

    this.originAccessControlId = resource.attrId;
  }

  private generateName(): string {
    const name = Stack.of(this).region + Names.uniqueId(this);
    if (name.length > 64) {
      return name.substring(0, 32) + name.substring(name.length - 32);
    }
    return name;
  }

}
```
#### New `S3BucketOacOrigin` class

A new class `S3BucketOacOrigin` will implement the `bind()` method to setup the OAC and update the bucket policy. 

In the case where an imported bucket is being used for the S3 origin, calling `bucket.addToResourcePolicy()` will fail to add the policy statement. Existing [workarounds](https://github.com/aws/aws-cdk/issues/6548#issuecomment-869091553) require the user to create a new `BucketPolicy` for the bucket and add the policy statements using `bucketPolicy.document.addStatements()`. However, this overwrites the whole bucket policy instead of appending statements to the existing policy which is a subpar user experience. The proposed solution to this issue is to use a custom resource to retrieve the existing bucket policy and append the OAC policy statement via the `GetBucketPolicy()` and `PutBucketPolicy()` API calls after the CloudFront distribution has been created.

In the case where the S3 bucket uses SSE-KMS encryption (customer-managed key), a circular dependency error occurs when trying to deploy the template. When granting the CloudFront distribution access to use the KMS Key, there is a circular dependency:
- CloudFront distribution references the S3 bucket
- S3 bucket references the KMS key
- KMS Key references the CloudFront distribution

The proposed solution to this issue is to use a custom resource to retrieve and update the KMS key policy after the CloudFront distribution has been created via the `GetKeyPolicy()` and `PutKeyPolicy()` API calls.


```ts
class S3BucketOacOrigin extends cloudfront.OriginBase {
  private originAccessControl!: cloudfront.IOriginAccessControl;

  constructor(private readonly bucket: s3.IBucket, { originAccessControl, ...props }: S3OriginProps) {
    super(bucket.bucketRegionalDomainName, props);
    if (originAccessControl) {
      this.originAccessControl = originAccessControl;
    }
  }

  public bind(scope: Construct, options: cloudfront.OriginBindOptions): cloudfront.OriginBindConfig {
    if (!this.originAccessControl) {
      // Create a new origin access control if not specified
      this.originAccessControl = new cloudfront.OriginAccessControl(scope, 'S3OriginAccessControl');
    }
    const distribution = scope.node.scope as cloudfront.Distribution;
    const distributionId = Lazy.string({ produce: () => distribution.distributionId });
    const oacReadOnlyBucketPolicyStatement = new iam.PolicyStatement(
      {
        sid: 'AllowS3OACAccess',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [this.bucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:${Aws.PARTITION}:cloudfront::${Aws.ACCOUNT_ID}:distribution/${distributionId}`,
          },
        },
      },
    );
    const result = this.bucket.addToResourcePolicy(oacReadOnlyBucketPolicyStatement);

    // Failed to update bucket policy, assume using imported bucket
    if (!result.statementAdded) {
      Annotations.of(scope).addWarningV2('@aws-cdk/aws-cloudfront-origins:updateBucketPolicy', 'Cannot update bucket policy of an imported bucket. Update the policy manually instead.');
      const provider = S3OriginAccessControlBucketPolicyProvider.getOrCreateProvider(scope, S3_ORIGIN_ACCESS_CONTROL_BUCKET_RESOURCE_TYPE,
        {
          description: 'Lambda function that updates S3 bucket policy to allow CloudFront distribution access.',
        });
      provider.addToRolePolicy({
        Action: ['s3:getBucketPolicy', 's3:putBucketPolicy'],
        Effect: 'Allow',
        Resource: [this.bucket.bucketArn],
      });

      new CustomResource(scope, 'S3OriginBucketPolicyCustomResource', {
        resourceType: S3_ORIGIN_ACCESS_CONTROL_BUCKET_RESOURCE_TYPE,
        serviceToken: provider.serviceToken,
        properties: {
          DistributionId: distributionId,
          AccountId: this.bucket.env.account,
          Partition: Stack.of(scope).partition,
          BucketName: this.bucket.bucketName,
          IsImportedBucket: !result.statementAdded,
        },
      });
    }

    if (this.bucket.encryptionKey) {
      const provider = S3OriginAccessControlKeyPolicyProvider.getOrCreateProvider(scope, S3_ORIGIN_ACCESS_CONTROL_KEY_RESOURCE_TYPE,
        {
          description: 'Lambda function that updates SSE-KMS key policy to allow CloudFront distribution access.',
        });
      provider.addToRolePolicy({
        Action: ['kms:PutKeyPolicy', 'kms:GetKeyPolicy', 'kms:DescribeKey'],
        Effect: 'Allow',
        Resource: [this.bucket.encryptionKey.keyArn],
      });

      new CustomResource(scope, 'S3OriginKMSKeyPolicyCustomResource', {
        resourceType: S3_ORIGIN_ACCESS_CONTROL_KEY_RESOURCE_TYPE,
        serviceToken: provider.serviceToken,
        properties: {
          DistributionId: distributionId,
          KmsKeyId: this.bucket.encryptionKey.keyId,
          AccountId: this.bucket.env.account,
          Partition: Stack.of(scope).partition,
        },
      });
    }

    const originBindConfig = super.bind(scope, options);

    // Update configuration to set OriginControlAccessId property
    return {
      ...originBindConfig,
      originProperty: {
        ...originBindConfig.originProperty!,
        originAccessControlId: this.originAccessControl.originAccessControlId,
      },
    };
  }

  /**
   * If you're using origin access control (OAC) instead of origin access identity, specify an empty `OriginAccessIdentity` element.
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-distribution-s3originconfig.html#cfn-cloudfront-distribution-s3originconfig-originaccessidentity
   */
  protected renderS3OriginConfig(): cloudfront.CfnDistribution.S3OriginConfigProperty | undefined {
    return { originAccessIdentity: '' };
  }
}
```


#### `S3Origin` Construct Modifications

The `S3Origin` constructor will need additional logic to determine how to configure the S3 origin (either as website endpoint, using OAI, or using OAC).

```ts
export class S3Origin implements cloudfront.IOrigin {
  private readonly origin: cloudfront.IOrigin;

  constructor(bucket: s3.IBucket, props: S3OriginProps = {}) {
    if (props.originAccessControl && props.originAccessIdentity) {
      throw new Error('Only one of originAccessControl or originAccessIdentity can be specified for an origin.');
    }

    if (bucket.isWebsite) {
      this.origin = new HttpOrigin(bucket.bucketWebsiteDomainName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // S3 only supports HTTP for website buckets
        ...props,
      });
    } else if (props.originAccessIdentity || !FeatureFlags.of(bucket.stack).isEnabled(cxapi.CLOUDFRONT_USE_ORIGIN_ACCESS_CONTROL)) {
      this.origin = new S3BucketOrigin(bucket, props);
    } else {
      this.origin = new S3BucketOacOrigin(bucket, props);
    }
  }

  public bind(scope: Construct, options: cloudfront.OriginBindOptions): cloudfront.OriginBindConfig {
    return this.origin.bind(scope, options);
  }
}
```

#### `Distribution` construct modifications

In the `addOrigin()` method of `Distribution`, we will need to pass the `distributionId` to `origin.bind()` to specify the condition in the policy statement. 

```ts
  private addOrigin(origin: IOrigin, isFailoverOrigin: boolean = false): string {
    const ORIGIN_ID_MAX_LENGTH = 128;

    const existingOrigin = this.boundOrigins.find(boundOrigin => boundOrigin.origin === origin);
    if (existingOrigin) {
      return existingOrigin.originGroupId ?? existingOrigin.originId;
    } else {
      ...
      const distributionId = this.distributionId;
      const originBindConfig = origin.bind(scope, { originId: generatedId, distributionId });
      ...
    }
  }
```

Policy statement with condition referencing `distributionId`:
```
{
    "Version": "2012-10-17",
    "Statement": {
        "Sid": "AllowCloudFrontServicePrincipalReadOnly",
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

This RFC proposes changes to support using OAC with the `Distribution` construct, which is the modern, improved API for creating CloudFront distributions using CDK. `CloudFrontWebDistribution` is the original construct written for working with CloudFront distributions. The CDK docs provide a [section](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront-readme.html#migrating-from-the-original-cloudfrontwebdistribution-to-the-newer-distribution-construct) to help users migrate from `CloudFrontWebDistribution` to `Distribution`, but it is not clearly stated anywhere that `CloudFrontWebDistribution` is deprecated. As OAC L2 support (and other new features) will only be provided for `Distribution` going forward, an official deprecation of `CloudFrontWebDistribution` will be part of this change.

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

> Describe any major open issues that this RFC did not take into account. Once
> the RFC is approved, create GitHub issues for these issues and update this RFC
> of the project board with these issue IDs.

Supporting Origin Access Control for Lambda Function Url origins.

## Appendix

- [Prototype branch](https://github.com/gracelu0/aws-cdk/tree/cloudfront-oac-l2-poc)
