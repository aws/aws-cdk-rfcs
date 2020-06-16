---
feature name: CloudFront redesign
start date: 2020-06-15
rfc pr:
related issue: https://github.com/aws/aws-cdk-rfcs/issues/171
---

# Summary

(Draft) Proposal to redesign the @aws-cdk/aws-cloudfront module.

The current module could be enhanced to be friendlier and less error-prone.

# README

Example usages:

## Use case #1 - Simple S3-bucket distribution

Creates a distribution based on an S3 bucket, and sets up an origin access identity so the
distribution can access the contents of the bucket (if non-public).

**Before:**

```ts
new CloudFrontWebDistribution(this, 'dist', {
  originConfigs: [{
    s3OriginSource: {
      s3BucketSource: myBucket,
      originAccessIdentity: OriginAccessIdentity.fromOriginAccessIdentityName(this, 'oai', 'distOAI'),
    },
    behaviors: [{ isDefaultBehavior: true }],
  }]
});
```

**After:**

```ts
new Distribution(this, 'dist', {
  origins: [Origin.fromS3Bucket(myBucket)],
});
```

## Use case #2 - S3-bucket distribution with a Lamda@Edge function

Creates a distribution based on an S3 bucket, and adds a Lambda function as a Lambda@Edge association
to origin responses.

**Before:**

```ts
new CloudFrontWebDistribution(this, 'dist', {
  originConfigs: [{
    s3OriginSource: {
      s3BucketSource: myBucket,
      originAccessIdentity: OriginAccessIdentity.fromOriginAccessIdentityName(this, 'oai', 'distOAI'),
    },
    behaviors: [{
      isDefaultBehavior: true,
      lambdaFunctionAssociations: [{
        lambdaFunction: myFunctionVersion,
        eventType: LambdaEdgeEventType.ORIGIN_RESPONSE,
      }]
    }],
  }]
});
```

**After:**

```ts
const myBucketOrigin = Origin.fromS3Bucket(myBucket);
new Distribution(this, 'dist', {
  origins: [myBucketOrigin],
  edgeFunctions: [{
    lambdaFunctionVersion: myFunctionVersion,
    eventType: LambdaEdgeEventType.ORIGIN_RESPONSE,
    origin: myBucketOrigin,
  }],
});
```

## Use Case #3 - S3 bucket distribution with certificate and custom TTL

**Before:**

```ts
new CloudFrontWebDistribution(this, 'dist', {
  originConfigs: [{
    s3OriginSource: {
      s3BucketSource: myBucket,
      originAccessIdentity: OriginAccessIdentity.fromOriginAccessIdentityName(this, 'oai', 'distOAI'),
    },
    behaviors: [{
      isDefaultBehavior: true,
      defaultTtl: Duration.minutes(10),
    }],
  }],
  viewerCertificate: ViewerCertificate.fromAcmCertificate(myCertificate),
});
```

**After:**

```ts
new Distribution(this, 'dist', {
  origins: [Origin.fromS3Bucket(myBucket)],
  behaviors: [{defaultTtl: Duration.minutes(10)}],
  certificate: myCertificate,
});
```

## Use case #4 - Complicate multi-origin setup with multiple behaviors per origin and a Lambda@Edge function

Stress test. This is what the config looks like with more stuff. An S3 bucket origin with the default and
one custom behavior, and a LoadBalancedFargateService origin that is HTTPS only.

**Before:**

```ts
new CloudFrontWebDistribution(this, 'dist', {
  originConfigs: [{
    s3OriginSource: {
      s3BucketSource: websiteBucket,
      originAccessIdentity: OriginAccessIdentity.fromOriginAccessIdentityName(this, 'oai', 'distOAI'),
    },
    behaviors: [
      { isDefaultBehavior: true },
      {
        forwardedValues: { queryString: true },
        pathPattern: 'images/*.jpg',
      }
    ],
  },
  {
    customOriginSource: {
      domainName: lbFargateService.loadBalancer.loadBalancerDnsName,
      originProtocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
    },
    behaviors: [{ isDefaultBehavior: true }],
  }],
});
```

**After:**

```ts
const myBucketOrigin = Origin.fromS3Bucket(myBucket);
new Distribution(this, 'dist', {
  origins: [
    myBucketOrigin,
    Origin.fromApplicationLoadBalancer(lbFargateService.loadBalancer),
  ],
  behaviors: [{
    origin: myBucketOrigin,
    forwardedValues: { queryString: true },
    pathPattern: 'images/*.jpg',],
  },
});
```

# Motivation

> Why are we doing this? What use cases does it support? What is the expected
> outcome?

***TODO***

# Design Summary

> Summarize the approach of the feature design in a couple of sentences. Call out
> any known patterns or best practices the design is based around.

***TODO***

# Detailed Design

> This is the bulk of the RFC. Explain the design in enough detail for somebody
> familiar with CDK to understand, and for somebody familiar with the
> implementation to implement. This should get into specifics and corner-cases,
> and include examples of how the feature is used. Any new terminology should be
> defined here.
>
> Include any diagrams and/or visualizations that help to demonstrate the design.
> Here are some tools that we often use:
>
> - [Graphviz](http://graphviz.it/#/gallery/structs.gv)
> - [PlantText](https://www.planttext.com)

Proposed interfaces:

```ts
export interface DistributionProps {
  origins?: Origin[];
  behaviors?: Behavior[];
  edgeFunctions?: LambdaEdgeFunction[];
  aliases?: string[];
  comment?: string;
  defaultRootObject?: string;
  enableIpV6?: boolean;
  httpVersion?: HttpVersion;
  priceClass?: PriceClass;
  viewerProtocolPolicy?: ViewerProtocolPolicy;
  webACLId?: string;
  errorConfigurations?: ErrorConfiguration[];
  loggingBucket?: IBucket;
  loggingIncludeCookies?: boolean;
  loggingPrefix?: string;
  certificate?: certificatemanager.ICertificate;
  sslMinimumProtocolVersion?: SslProtocolVersion;
  sslSupportMethod?: SslSupportMethod;
  geoLocations?: string[]; // Is there a CDK element for country codes?
  geoRestrictionType?: GeoRestrictionType;
}

export interface BaseOriginProps {
  domainName: string,

  connectionAttempts?: int,
  connectionTimeoutSeconds?: int,
  id?: string,
  originCustomHeaders?: { [key: string]: string },
  originPath?: string,
}

...
```

# Drawbacks

> Why should we _not_ do this? Please consider:
>
> - implementation cost, both in term of code size and complexity
> - whether the proposed feature can be implemented in user space
> - the impact on teaching people how to use CDK
> - integration of this feature with other existing and planned features
> - cost of migrating existing CDK applications (is it a breaking change?)
>
> There are tradeoffs to choosing any path. Attempt to identify them here.

***TODO***

* There is a significant user base that consumes the existing interface. Despite being marked as
'experimental', CloudFront is one of the oldest modules in the CDK and is relied on by many customers.
Any breaking changes to the existing interface(s) will need to be carefully considered.

# Rationale and Alternatives

> - Why is this design the best in the space of possible designs?
> - What other designs have been considered and what is the rationale for not
>   choosing them?
> - What is the impact of not doing this?

***TODO***

# Adoption Strategy

> If we implement this proposal, how will existing CDK developers adopt it? Is
> this a breaking change? How can we assist in adoption?

***TODO*** - Great question!

# Unresolved questions

> - What parts of the design do you expect to resolve through the RFC process
>   before this gets merged?
> - What parts of the design do you expect to resolve through the implementation
>   of this feature before stabilization?
> - What related issues do you consider out of scope for this RFC that could be
>   addressed in the future independently of the solution that comes out of this
>   RFC?

***TODO***

# Future Possibilities

> Think about what the natural extension and evolution of your proposal would be
> and how it would affect CDK as whole. Try to use this section as a tool to more
> fully consider all possible interactions with the project and ecosystem in your
> proposal. Also consider how this fits into the roadmap for the project.
>
> This is a good place to "dump ideas", if they are out of scope for the RFC you
> are writing but are otherwise related.
>
> If you have tried and cannot think of any future possibilities, you may simply
> state that you cannot think of anything.

***TODO***
