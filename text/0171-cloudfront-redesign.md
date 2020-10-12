---
feature name: CloudFront redesign
start date: 2020-06-15
? rfc pr
related issue: https://github.com/aws/aws-cdk-rfcs/issues/171
---

# Summary

Proposal to redesign the @aws-cdk/aws-cloudfront module.

The current module does not adhere to the best practice naming conventions or
ease-of-use patterns that are present in the other CDK modules. A redesign of
the API will allow for friendly, easier access to common patterns and usages.

This RFC does not attempt to lay out the entire API; rather, it focuses on a
complete re-write of the module README with a focus on the most common use cases
and how they work with the new design. More detailed designs and incremental API
improvements will be tracked as part of GitHub Project Board once the RFC is
approved.

---

# README

Amazon CloudFront is a web service that speeds up distribution of your static
and dynamic web content, such as .html, .css, .js, and image files, to your
users. CloudFront delivers your content through a worldwide network of data
centers called edge locations. When a user requests content that you're serving
with CloudFront, the user is routed to the edge location that provides the
lowest latency, so that content is delivered with the best possible performance.

## Creating a distribution

CloudFront distributions deliver your content from one or more origins; an
origin is the location where you store the original version of your content.
Origins can be created from S3 buckets or a custom origin (HTTP server).

### From an S3 Bucket

An S3 bucket can be added as an origin. If the bucket is configured as a website
endpoint, the distribution can use S3 redirects and S3 custom error documents.

```ts
import * as cloudfront from '@aws-cdk/aws-cloudfront';

// Creates a distribution for a S3 bucket.
const myBucket = new s3.Bucket(...);
new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromBucket(myBucket),
});

// Equivalent to the above
const myBucket = new s3.Bucket(...);
cloudfront.Distribution.forBucket(this, 'myDist', myBucket);

// Creates a distribution for a S3 bucket that has been configured for website hosting.
const myWebsiteBucket = new s3.Bucket(...);
new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromWebsiteBucket(myBucket),
});

// Equivalent to the above
const myBucket = new s3.Bucket(...);
cloudfront.Distribution.forWebsiteBucket(this, 'myDist', myBucket);
```

Both of the S3 Origin options will automatically create an origin access
identity and grant it access to the underlying bucket. This can be used in
conjunction with a bucket that is not public to require that your users access
your content using CloudFront URLs and not S3 URLs directly.

### From an HTTP endpoint

Origins can also be created from other resources (e.g., load balancers, API
gateways), or from any accessible HTTP server.

```ts
// Creates a distribution for an application load balancer.
const myLoadBalancer = new elbv2.ApplicationLoadBalancer(...);
new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromLoadBalancerV2(myLoadBalancer),
});

// Creates a distribution for an HTTP server.
new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromHttpServer({
    domainName: 'www.example.com',
    protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
  })
});
```

## Domain Names and Certificates

When you create a distribution, CloudFront returns a domain name for the
distribution, for example: `d111111abcdef8.cloudfront.net`. If you want to use
your own domain name, such as `www.example.com`, you can add an alternate domain
name to your distribution.

```ts
new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromBucket(myBucket),
  aliases: ['www.example.com'],
});
```

CloudFront distributions use a default certificate (`*.cloudfront.net`) to
support HTTPS by default. If you want to support HTTPS with your own domain
name, you must associate a certificate with your distribution that contains your
domain name. The certificate must be present in the AWS Certificate Manager
(ACM) service in the US East (N. Virginia) region; the certificate may either be
created by ACM, or created elsewhere and imported into ACM.

```ts
const myCertificate = new certmgr.DnsValidatedCertificate(this, 'mySiteCert', {
  domainName: 'www.example.com',
  hostedZone,
});
new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromBucket(myBucket),
  certificate: myCertificate,
});
```

Note that in the above example the aliases are inferred from the certificate and
do not need to be explicitly provided.

## Behaviors

Each distribution has a default behavior which applies to all requests to that
distribution; additional behaviors may be specified for a given URL path
pattern. Behaviors allow routing with multiple origins, controlling which HTTP
methods to support, whether to require users to use HTTPS, and what query
strings or cookies to forward to your origin, among others.

The properties of the default behavior can be adjusted as part of the
distribution creation. The following example shows configuring the HTTP methods
and viewer protocol policy of the cache.

```ts
const myWebDistribution = new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromLoadBalancerV2(myLoadBalancer, {
    allowedMethods: AllowedMethods.ALL,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  }),
});
```

Additional cache behaviors can be specified at creation, or added to the
origin(s) after the initial creation. These additional cache behaviors enable
customization for a specific set of resources based on a URL path pattern. For
example, we can add a behavior to `myWebDistribution` to override the default
time-to-live (TTL) for all of the images.

```ts
myWebDistribution.origin.addBehavior('/images/*.jpg', {
  viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  defaultTtl: cdk.Duration.days(7),
});
```

## Multiple Origins

A distribution may have multiple origins in addition to the default origin; each
additional origin must have (at least) one behavior to route requests to that
origin. A common pattern might be to serve all static assets from an S3 bucket,
but all dynamic content served from a web server. The following example shows
how such a setup might be created:

```ts
const myWebsiteBucket = new s3.Bucket(...);
const myMultiOriginDistribution = new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromWebsiteBucket(myBucket),
  additionalOrigins: [
    cloudfront.Origin.fromLoadBalancerV2(myLoadBalancer, {
      pathPattern: '/api/*',
      allowedMethods: AllowedMethods.ALL,
      forwardQueryString: true,
    }),
  ],
});
```

## Origin Groups

You can specify an origin group for your CloudFront origin if, for example, you
want to configure origin failover for scenarios when you need high availability.
Use origin failover to designate a primary origin for CloudFront plus a second
origin that CloudFront automatically switches to when the primary origin returns
specific HTTP status code failure responses. An origin group can be created and
specified as the primary (or additional) origin for the distribution.

```ts
const myOriginGroup = cloudfront.Origin.fromOriginGroup({
  primaryOrigin: cloudfront.Origin.fromLoadBalancerV2(myLoadBalancer),
  fallbackOrigin: cloudfront.Origin.fromBucket(myBucket),
  fallbackStatusCodes: [500, 503],
});
new cloudfront.Distribution(this, 'myDist', { origin: myOriginGroup });
```

The above will create both origins and a single origin group with the load
balancer origin falling back to the S3 bucket in case of 500 or 503 errors.

## Lambda@Edge

Lambda@Edge is an extension of AWS Lambda, a compute service that lets you
execute functions that customize the content that CloudFront delivers. You can
author Node.js or Python functions in the US East (N. Virginia) region, and then
execute them in AWS locations globally that are closer to the viewer, without
provisioning or managing servers. Lambda@Edge functions are associated with a
specific behavior and event type. Lambda@Edge can be used rewrite URLs, alter
responses based on headers or cookies, or authorize requests based on headers or
authorization tokens.

The following shows a Lambda@Edge function added to the default behavior and
triggered on every request.

```ts
const myFunc = new lambda.Function(...);
new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromBucket(myBucket, {
    edgeFunctions: [{
      functionVersion: myFunc.currentVersion,
      eventType: EventType.VIEWER_REQUEST,
    }],
  }),
});
```

Lambda@Edge functions can also be associated with additional behaviors, either
at behavior creation (associated with the origin) or after behavior creation.

```ts
// Assigning at behavior creation.
myOrigin.addBehavior('/images/*.jpg', {
  viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  defaultTtl: cdk.Duration.days(7),
  edgeFunctions: [{
    functionVersion: myFunc.currentVersion,
    eventType: EventType.VIEWER_REQUEST,
  }]
});

// Assigning after creation.
const myImagesBehavior = myOrigin.addBehavior('/images/*.jpg', ...);
myImagesBehavior.addEdgeFunction({
  functionVersion: myFunc.currentVersion,
  eventType: EventType.VIEWER_REQUEST,
});
```

---

# Motivation

The existing aws-cloudfront module doesn't adhere to standard naming convention,
lacks convenience methods for more easily interacting with distributions,
origins, and behaviors, and has been in an "experimental" state for years. This
proposal aims to bring a friendlier, more ergonomic interface to the module, and
advance the module to a GA-ready state.

# Design Summary

The approach will create a new top-level Construct (`Distribution`) to replace
the existing `CloudFrontWebDistribution`, as well as new constructs to represent
the other logical resources for a distribution (i.e., `Origin`, `Behavior`). The
new construct is optimized for the most common use cases of creating a
distribution with a single origin and behavior. The new L2s will be created in
the same aws-cloudfront module and no changes will be made to the existing L2s
to preserve the existing experience. Unlike the existing L2, the new L2s will
feature a variety of convenience methods (e.g., `addBehavior`) to aid in the
creation of the distribution, and provide several out-of-the-box defaults for
building distributions off of other resources (e.g., buckets, load balanced
services).

# Detailed Design

The design creates one new resource (`Distribution`) and two new classes
(`Origin` and `Behavior`) to replace the current `CloudFrontWebDistribution`
construct. Each of these new classes comes with helper methods (e.g.,
`addBehavior`) to make assembling more complex distributions easier, as well as
factory constructors to make it easier to build common Origin and Behavior
patterns (e.g., `Origin.fromBucket`).

The following is an incomplete, but representative, listing of the API:

```ts
class Distribution extends BaseDistribution {
  static fromDistributionAttributes(
    scope: Construct,
    id: string,
    attributes: DistributionAttributes,
  ): IDistribution;

  static forBucket(scope: Construct, id: string, bucket: IBucket): Distribution;
  static forWebsiteBucket(
    scope: Construct,
    id: string,
    bucket: IBucket,
  ): Distribution;

  constructor(scope: Construct, id: string, props: DistributionProps) {}

  addOrigin(options: OriginOptions): Origin;
}

class Origin {
  static fromBucket(
    bucket: s3.IBucket,
    behaviorOptions?: BehaviorProps,
  ): Origin;
  static fromWebsiteBucket(
    bucket: s3.IBucket,
    behaviorOptions?: BehaviorProps,
  ): Origin;
  static fromLoadBalancerV2(
    loadBalancer: elbv2.ApplicationLoadBalancer,
    behaviorOptions?: BehaviorProps,
  ): Origin;
  static fromHttpServer(
    options: ServerOriginOptions,
    behaviorOptions?: BehaviorProps,
  ): Origin;
  static fromOriginGroup(options: OriginGroupOptions): Origin;

  constructor(props: OriginProps) {}

  addBehavior(pathPattern: string, options: BehaviorOptions): Behavior;
}

class Behavior {
  constructor(props: BehaviorProps) {}

  addEdgeFunction(options: EdgeFunctionOptions): EdgeFunction;
}
```

## Nested structure and relationships

The `Distribution` has one top-level origin and behavior, which aligns to how
the vast majority of customers use CloudFront today (based on public CDK
examples). Customers can add additional origins (and origin groups) and
behaviors, which are modeled as `additionalOrigins` and `additionalBehaviors`,
respectively. Each origin may have multiple behaviors associated with it, so the
relationship is modeled such that behaviors are added to origins. However, an
authoritative list of behaviors is kept on the distribution to preserve
ordering. This is done similarly to how ECS clusters keep track of Fargate
profiles as they are created and associated with the cluster. In the below
example, the '/api/\*' behavior for the load balancer origin will be ordered
first, then the '/api/errors/\*' behavior on the bucket.

```ts
const myWebsiteBucket = new s3.Bucket(...);
const myMultiOriginDistribution = new cloudfront.Distribution(this, 'myDist', {
  origin: cloudfront.Origin.fromWebsiteBucket(this, 'myOrigin', myBucket),
  additionalOrigins: [
    cloudfront.Origin.fromLoadBalancerV2(this, 'myOrigin', myLoadBalancer, {
      pathPattern: '/api/*',
      allowedMethods: AllowedMethods.ALL,
      forwardQueryString: true,
    }),
  ];
});
myMultiOriginDistribution.origin.addBehavior('/api/errors/*', ...);
```

This approach was chosen as the simplest pattern to work with for the majority
of customers that don't add multiple origins and behaviors, while still giving
those power users control over behavior ordering, albeit implicitly. See the
Rationale and Alternatives section for a discussion of other ways this was
considered.

**Implementation Note:** The relationships as-is are modeled with one-way
connections; Distributions know about Origins, but Origins have no references to
Distributions, for example. This design makes the initial creation much simpler
for users, but makes having a per-Distribution ordered list of Behaviors
impossible. To correct this, the Origin will need some form of reference to the
Distribution, either at creation or when being associated with the Distribution.
The current (inelegant) proposal is for the Origin to expose a method
(`_attachDistribution`) which is called by the Distribution to create the
relationship. Feedback on this approach (or more elegent proposals) are welcome.

## Interaction with other L2s

The existing @aws-cdk/aws-cloudfront module is used in three other modules of
the CDK: (1) aws-route53-patterns, (2) aws-route53-targets, and (3)
aws-s3-deployment.

1. In aws-route53-patterns, the CloudFrontWebDistribution is used internally to
   the HttpsRedirect class; no CloudFront properties or classes are exposed to
   the consumer. This usage can be swapped out when the new L2s are ready
   without impact to customers.
2. In aws-route53-targets, the CloudFrontTarget constructor takes a
   CloudFrontWebDistribution as the sole parameter. This usage could actually be
   replaced with an IDistribution, and then work for both Distribution and
   CloudFrontWebDistribution. I _believe_ this is a backwards-compatible change;
   please correct me if I'm wrong.
3. In aws-s3-deployment, BucketDeploymentProps has an optional IDistribution
   member, which does not need to be changed.

## Comparison with the existing API

The primary drawback of this work is that an existing CloudFront L2 already
exists and is in wide use. To justify the creation of a new API, this section
provides examples of what the user experience of common (and some uncommon) use
cases will be before and after the redesign.

### Use Case #1 - S3 bucket origin

The simplest use case is to have a single S3 bucket origin, and no customized
behaviors.

**Before:**

```ts
new CloudFrontWebDistribution(this, 'MyDistribution', {
  originConfigs: [
    {
      s3OriginSource: { s3BucketSource: sourceBucket },
      behaviors: [{ isDefaultBehavior: true }],
    },
  ],
});
```

**After:**

```ts
new cloudfront.Distribution(this, 'MyDistribution', {
  origin: cloudfront.Origin.fromBucket(sourceBucket),
});
```

### Use Case #2 - S3 bucket origin with certificate and custom behavior

This example keeps the same bucket, but adds one custom behavior and a
certificate.

**Before:**

```ts
new CloudFrontWebDistribution(this, 'MyDistribution', {
  originConfigs: [
    {
      s3OriginSource: { s3BucketSource: sourceBucket },
      behaviors: [
        { isDefaultBehavior: true },
        {
          pathPattern: 'images/*',
          defaultTtl: cdk.Duration.days(7),
        },
      ],
    },
  ],
  viewerCertificate: ViewerCertificate.fromAcmCertificate(myCertificate),
});
```

**After:**

```ts
const dist = new cloudfront.Distribution(this, 'MyDistribution', {
  origin: cloudfront.Origin.fromBucket(sourceBucket),
  certificate: myCertificate,
});
dist.origin.addBehavior('images/*', { defaultTtl: cdk.Duration.days(7) });
```

### Use Case #3 - Multi-origin, multi-behavior distribution with a Lambda@Edge function

Both S3 and LoadBalancedFargateService origins, custom behaviors, and a Lambda
function to top it all off.

**Before:**

```ts
new CloudFrontWebDistribution(this, 'dist', {
  originConfigs: [
    {
      customOriginSource: {
        domainName: lbFargateService.loadBalancer.loadBalancerDnsName,
        protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
      },
      behaviors: [
        {
          isDefaultBehavior: true,
          allowedMethods: CloudFrontAllowedMethods.ALL,
          forwardedValues: { queryString: true },
          lambdaFunctionAssociations: [
            {
              lambdaFunction: myFunctionVersion,
              eventType: LambdaEdgeEventType.ORIGIN_RESPONSE,
            },
          ],
        },
      ],
    },
    {
      s3OriginSource: {
        s3BucketSource: sourceBucket,
        originAccessIdentity: OriginAccessIdentity.fromOriginAccessIdentityName(
          this,
          'oai',
          'distOAI',
        ),
      },
      behaviors: [{ pathPattern: 'static/*' }],
    },
  ],
});
```

**After:**

```ts
const dist = new cloudfront.Distribution(this, 'MyDistribution', {
  origin: cloudfront.Origin.fromLoadBalancerV2(lbFargateService.loadBalancer, {
    allowedMethods: AllowedMethods.ALL,
    forwardQueryString: true,
    edgeFunctions: [
      {
        function: myFunctionVersion,
        eventType: EventType.ORIGIN_RESPONSE,
      },
    ],
  }),
});
dist.addOrigin(cloudfront.Origin.fromBucket(sourceBucket), {
  pathPattern: 'static/*',
});
```

# Drawbacks

The primary drawback to this work is one of adoption. The aws-cloudfront module
is one of the oldest in the CDK, and is used by many customers. These changes
won't break any of the existing customers, but all existing customers would need
to rewrite their CloudFront constructs to take advantage of the functionality
and ease-of-use benefits of the new L2s. For building an entirely new set of L2s
to be worth the return on investment, the improvements to functionality and
ergonomics needs to be substantial. Feedback is welcome on how to best
capitalize on this opportunity and make the friendliest interface possible.

# Rationale and Alternatives

This RFC aims to take one of the older modules in the CDK and update it to the
current set of design standards. By introducing secondary resource creation
methods, factories for common L2-based origins, and flattening some of the
top-level nested properties, we can offer an easier-to-use experience.

The interface aims to make it easiest for the 90%+ use cases of having a single
origin based on an S3 bucket (or other CDK construct), with a single default
behavior, optionally slightly customized; it accomplishes this by exposing a
single top-level `origin` and `behavior` and making us of factory methods to
construct origins from buckets, load balancers, and other common origins. Beyond
that straightforward use-case, the decision was made to represent the behaviors
as members of origins, as each behavior must be associated with an origin. This
introduces one area of cognitive complexity in terms of behavior ordering.

Behaviors are ordered and precedence is used to determine how to route requests
to origin(s). For example, origin #1 could have custom behaviors with path
patterns of 'images/\*.jpg' and '\*.gif', and origin #2 could have a behavior on
'images/\*'. Depending on the ordering, a request for 'images/foo.gif' may
either be routed to origin #1 or #2. The approach taken ties behavior precedence
to order of creation. An alternative would be to expose a flat list of
behaviors, and allow the user to manipulate that list to change precedence.
Ultimately, this was discarded as an overly- complex interface with diminishing
benefits. However, feedback is welcome on a more elegant way to give users
control of behavior ordering.

# Adoption Strategy

Once created, the new L2s can be used by existing CDK developers for new use
cases, or by converting their existing CloudFrontWebDistribution usages to the
new cloudfront.Distribution resource.

# Unresolved questions

1. What level of breaking changes are acceptable for the existing
   `IDistribution` and `CloudFrontWebDistribution` resources? Notably, the
   `IDistribution` interface should extend `IResource`, and
   `CloudFrontWebDistribution` changed from extending `Construct` to `Resource`.
   Is this worth it, given the breaking changes to existing consumers? The
   alternative is to leave both `IDistribution` and `CloudFrontWebDistribution`
   as-is, and have `Distribution` directly extend `Resource`.
2. Related to the above, should the current (CloudFrontWebDistribution)
   construct be marked as "stable" to indicate we won't be making future updates
   to it? Any other suggestions on how we message the "v2" on the README to
   highlight the new option to customers?
3. Any better patterns for associating the Origin with the Distribution than
   something like the proposed `_attachDistribution`?

# Future Possibilities

One extension point for this redesign is building all-in-one "L3s" on top of the
new L2s. One extremely common use case for CloudFront is to be used as a
globally-distributed front on top of a S3 bucket configured for website hosting.
One potential L3 for CloudFront would wrap this entire set of constructs into
one easy-to-use construct. For example:

```ts
// Creates the hosted zone, S3 bucket, CloudFront distribution, ACM certificate, and wires everything together.
new StaticWebsiteDistribution(this, 'SiteDistribution', {
  domainName: 'www.example.com',
  source: s3.Source.asset('static-website/'),
});
```

This would be relatively easy to piece together from the existing constructs,
and would follow the patterns of the aws-s3-deployment module to deploy the
assets.
