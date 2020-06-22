---
feature name: CloudFront redesign
start date: 2020-06-15
rfc pr:
related issue: https://github.com/aws/aws-cdk-rfcs/issues/171
---

# Summary

(Draft) Proposal to redesign the @aws-cdk/aws-cloudfront module.

The current module does not adhere to the best practice naming conventions or ease-of-use patterns
that are present in the other CDK modules. A redesign of the API will allow for friendly, easier
access to common patterns and usages.

This RFC does not attempt to lay out the entire API; rather, it focuses on a complete re-write of
the module README with a focus on the most common use cases and how they work with the new design.
More detailed designs and incremental API improvements will be tracked as part of GitHub Project Board
once the RFC is approved.

---

# README

Amazon CloudFront is a web service that speeds up distribution of your static and dynamic web content, such as .html, .css, .js, and image files, to
your users. CloudFront delivers your content through a worldwide network of data centers called edge locations. When a user requests content that
you're serving with CloudFront, the user is routed to the edge location that provides the lowest latency, so that content is delivered with the best
possible performance.

## Creating a distribution

CloudFront distributions deliver your content from one or more origins; an origin is the location where you store the original version of your
content. Origins can be created from S3 buckets or a custom origin (HTTP server).

An S3 bucket can be added as an origin. If the bucket is configured as a website endpoint, the distribution can use S3 redirects and S3 custom error
documents.

```ts
// Creates a distribution for a S3 bucket.
const myBucket = new s3.Bucket(...);
new Distribution(this, 'myDist', {
  origin: Origin.fromBucket(this, 'myOrigin', myBucket)
});

// Creates a distribution for a S3 bucket that has been configured for website hosting.
const myWebsiteBucket = new s3.Bucket(...);
new Distribution(this, 'myDist', {
  origin: Origin.fromWebsiteBucket(this, 'myOrigin', myBucket)
});
```

Both of the S3 Origin options will automatically create an origin access identity and grant it access to the underlying bucket. This can be used in
conjunction with a bucket that is not public to require that your users access your content using CloudFront URLs and not S3 URLs directly.

Origins can also be created from other resources (e.g., load balancers, API gateways), or from any accessible HTTP server.

```ts
// Creates a distribution for an application load balancer.
const myLoadBalancer = new elbv2.ApplicationLoadBalancer(...);
new Distribution(this, 'myDist', {
  origin: Origin.fromLoadBalancerV2(this, 'myOrigin', myLoadBalancer)
});

// Creates a distribution for an HTTP server.
new Distribution(this, 'myDist', {
  origin: Origin.fromHTTPServer(this, 'myOrigin', {
    domainName: 'www.example.com',
    originProtocolPolicy: OriginProtocolPolicy.HTTPS_ONLY
  })
});
```

## Domain Names and Certificates

When you create a distribution, CloudFront returns a domain name for the distribution, for example: `d111111abcdef8.cloudfront.net`. If you want to
use your own domain name, such as `www.example.com`, you can add an alternate domain name to your distribution.

```ts
new Distribution(this, 'myDist', {
  origin: Origin.fromBucket(myBucket),
  aliases: ['www.example.com']
})
```

CloudFront distributions use a default certificate (`*.cloudfront.net`) to support HTTPS by default. If you want to support HTTPS with your own domain
name, you must associate a certificate with your distribution that contains your domain name. The certificate must be present in the AWS Certificate
Manager (ACM) service in the US East (N. Virginia) region; the certificate may either be created by ACM, or created elsewhere and imported into ACM.

```ts
const myCertificate = new certmgr.DnsValidatedCertificate(this, 'mySiteCert', {
  domainName: 'www.example.com',
  hostedZone,
});
new Distribution(this, 'myDist', {
  origin: Origin.fromBucket(myBucket),
  certificate: myCertificate,
});
```

Note that in the above example the aliases are inferred from the certificate and do not need to be explicitly provided.

## Caching Behaviors

Each distribution has a default cache behavior which applies to all requests to that distribution; additional cache behaviors may be specified for a
given URL path pattern. Cache behaviors allowing routing with multiple origins, controlling which HTTP methods to support, whether to require users to
use HTTPS, and what query strings or cookies to forward to your origin, among other behaviors.

The properties of the default cache behavior can be adjusted as part of the distribution creation. The following example shows configuring the HTTP
methods and viewer protocol policy of the cache.

```ts
const myWebDistribution = new Distribution(this, 'myDist', {
  origin: Origin.fromHTTPServer(this, 'myOrigin', {
    domainName: 'www.example.com',
    originProtocolPolicy: OriginProtocolPolicy.HTTPS_ONLY
  }),
  behavior: {
    allowedMethods: AllowedMethods.ALL,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
  }
});
```

Additional cache behaviors can be specified at creation, or added to the origin(s) after the initial creation. These additional cache behaviors enable
customization for a specific set of resources based on a URL path pattern. For example, we can add a behavior to `myWebDistribution` to override the
default time-to-live (TTL) for all of the images.

```ts
myWebDistribution.origin.addBehavior('/images/*.jpg', {
  viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  defaultTtl: cdk.Duration.days(7),
});
```

## Multiple Origins

A distribution may have multiple origins in addition to the default origin; each additional origin must have (at least) one behavior to route requests
to that origin. A common pattern might be to serve all static assets from an S3 bucket, but all dynamic content served from a web server. The
following example shows how such a setup might be created:

```ts
const myWebsiteBucket = new s3.Bucket(...);
const myMultiOriginDistribution = new Distribution(this, 'myDist', {
  origin: Origin.fromWebsiteBucket(this, 'myOrigin', myBucket),
  additionalOrigins: [Origin.fromLoadBalancerV2(this, 'myOrigin', myLoadBalancer, {
    pathPattern: '/api/*',
    allowedMethods: AllowedMethods.ALL,
    forwardQueryString: true,
  })];
});
```

You can specify an origin group for your CloudFront origin if, for example, you want to configure origin failover for scenarios when you need high
availability. Use origin failover to designate a primary origin for CloudFront plus a second origin that CloudFront automatically switches to when the
primary origin returns specific HTTP status code failure responses. An origin group can be created and specified as the primary (or additional) origin
for the distribution.

```ts
const myOriginGroup = Origin.groupFromOrigins(
  primaryOrigin: Origin.fromLoadBalancerV2(this, 'myOrigin', myLoadBalancer),
  fallbackOrigin: Origin.fromBucket(this, 'myFallbackOrigin', myBucket),
  fallbackStatusCodes: [500, 503]
);
new Distribution(this, 'myDist', { origin: myOriginGroup });
```

The above will create both origins and a single origin group with the load balancer origin falling back to the S3 bucket in case of 500 or 503 errors.

## Lambda@Edge

Lambda@Edge is an extension of AWS Lambda, a compute service that lets you execute functions that customize the content that CloudFront delivers. You
can author Node.js or Python functions in the US East (N. Virginia) region, and then execute them in AWS locations globally that are closer to the
viewer, without provisioning or managing servers. Lambda@Edge functions are associated with a specific behavior and event type. Lambda@Edge can be
used rewrite URLs, alter responses based on headers or cookies, or authorize requests based on headers or authorization tokens.

By default, Lambda@Edge functions are attached to the default behavior:

```ts
const myFunc = new lambda.Function(...);
const myDist = new Distribution(...);
myDist.addLambdaFunctionAssociation({
  functionVersion: myFunc.currentVersion,
  eventType: EventType.VIEWER_REQUEST,
});
```

Lambda@Edge functions can also be associated with additional behaviors, either at behavior creation or after the fact, either by attaching
directly to the behavior, or to the distribution and referencing the behavior.

```ts
// Assigning at behavior creation.
myOrigin.addBehavior('/images/*.jpg', {
  viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  defaultTtl: cdk.Duration.days(7),
  lambdaFunctionAssociations: [{
    functionVersion: myFunc.currentVersion,
    eventType: EventType.VIEWER_REQUEST,
  }]
});

// Assigning after creation.
const myImagesBehavior = myOrigin.addBehavior('/images/*.jpg', ...);
myImagesBehavior.addLambdaFunctionAssociation({
  functionVersion: myFunc.currentVersion,
  eventType: EventType.VIEWER_REQUEST,
});

myDist.addLambdaFunctionAssociation({
  functionVersion: myFunc.currentVersion,
  eventType: EventType.ORIGIN_REQUEST,
  behavior: myImagesBehavior,
});
```

---

# Motivation

The existing aws-cloudfront module doesn't adhere to standard naming convention, lacks convenience methods for more easily interacting with
distributions, origins, and behaviors, and has been in an "experimental" state for years. This proposal aims to bring a friendlier, more ergonic
interface to the module, and advance the module to a GA-ready state.

# Design Summary

The approach will create a new top-level Construct (`Distribution`) to replace the existing `CloudFrontWebDistribution`, as well as new constructs
to represent the other logical resources for a distribution (i.e., `Origin`, `Behavior`). The new L2s will be created in the same aws-cloudfront
module and no changes will be made to the existing L2s to preserve the existing experience. Unlike the existing L2, the new L2s will feature a
variety of convenience methods (e.g., `addBehavior`) to aid in the creation of the distribution, and provide several out-of-the-box defaults for
building distributions off of other resources (e.g., buckets, load balanced services).

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

**_TODO_** - What is important to capture here for this RFC?

# Drawbacks

The primary drawback to this work is one of adoption. The aws-cloudfront module is one of the oldest in the CDK, and is used by many customers.
These changes won't break any of the existing customers, but all existing customers would need to rewrite their CloudFront constructs to take
advantage of the functionality and ease-of-use benefits of the new L2s. For building an entirely new set of L2s to be worth the return on investment,
the improvements to functionality and ergonomics needs to be substantial. Feedback is welcome on how to best capitalize on this opportunity and make
the friendliest interface possible.

# Rationale and Alternatives

> - Why is this design the best in the space of possible designs?
> - What other designs have been considered and what is the rationale for not
>   choosing them?
> - What is the impact of not doing this?

## Flat vs nested origin:behaviors

**_TODO:_** _The behaviors are technically flat, allowing for arbitrary ordering of behaviors across origins. The nested approach here, while it
  generally makes sense, makes this functionality a bit more difficult. Discuss the trade-offs here._

# Adoption Strategy

> If we implement this proposal, how will existing CDK developers adopt it? Is
> this a breaking change? How can we assist in adoption?

**_TODO_**

# Unresolved questions

1. Are `fromBucket` and `fromWebsiteBucket` (potentially) redundant? There isn't enough information
on the `IBucket` interface to determine if the bucket has been configured for static web hosting and
we should treat as such. However, we could have an additional parameter to `fromBucket` trigger this
behavior (e.g., `isConfiguredAsWebsite`?).
2. Does the nested (origin->behavior) model make sense? It's the most straightforward for 99% of use
cases; however, the actual CloudFront (and CloudFormation) model is that there is a single default
behavior and then a list of ordered behaviors, each associated with an origin. This is important in
the case where the order of behaviors matters. For example,
`[{origin-1,'images/*.jpg'},{origin-2,'images/*'},{origin-1,'*.gif'}]`.
If the order of the last two is reversed (all origin behaviors grouped), the outcome changes. Possible
alternatives to "flattening" the relationship would be to expose a property (`behaviorOrder`) to explicitly
set the order. This is most important for the all-in-one scenarios where all origins and behaviors are passed
to the constructor at once. In other scenarios, the order behaviors are created in can be used.
3. Naming question -- `Distribution` seems the most natural name to replace `CloudFrontWebDistribution`; however,
`IDistribution` already exists and doesn't exactly match the desired interface. `IDistribution` is used in the
`aws-s3-deployment` module, which is also experimental. Would it be acceptable to break this interface, given that
all CDK usages are in experimental modules?

# Future Possibilities

One extension point for this redesign is building all-in-one "L3s" on top of the new L2s. One extremely common use case for CloudFront is
to be used as a globally-distributed front on top of a S3 bucket configured for website hosting. One potential L3 for CloudFront would wrap
this entire set of constructs into one easy-to-use construct. For example:

```ts
// Creates the hosted zone, S3 bucket, CloudFront distribution, ACM certificate, and wires everything together.
new StaticWebsiteDistribution(this, 'SiteDistribution', {
  domainName: 'www.example.com',
  source: s3.Source.asset('static-website/'),
});
```

**_TODO_**: Add more examples?
