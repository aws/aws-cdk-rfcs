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
customization on a specific set of resources based on a URL path pattern. For example, we can add a behavior to `myWebDistribution` to override the
default time-to-live (TTL) for all of the images.

```ts
myWebDistribution.origin.addBehavior('/images/*.jpg', {
  viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  defaultTtl: cdk.Duration.days(7),
})
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
viewer, without provisioning or managing servers. Lambda@Edge functions are associated with a specific behavior and

**TODO:** Design the Lambda@Edge API.

---

# Motivation

> Why are we doing this? What use cases does it support? What is the expected
> outcome?

**_TODO_**

# Design Summary

> Summarize the approach of the feature design in a couple of sentences. Call out
> any known patterns or best practices the design is based around.

**_TODO_**

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

# Rationale and Alternatives

> - Why is this design the best in the space of possible designs?
> - What other designs have been considered and what is the rationale for not
>   choosing them?
> - What is the impact of not doing this?

## Flat vs nested origin:behaviors

**TODO:** The behaviors are technically flat, allowing for arbitrary ordering of behaviors across origins. The nested approach here, while it
  generally makes sense, makes this functionality a bit more difficult. Discuss trade-offs.

# Adoption Strategy

> If we implement this proposal, how will existing CDK developers adopt it? Is
> this a breaking change? How can we assist in adoption?

**_TODO_**

# Unresolved questions

> - What parts of the design do you expect to resolve through the RFC process
>   before this gets merged?
> - What parts of the design do you expect to resolve through the implementation
>   of this feature before stabilization?
> - What related issues do you consider out of scope for this RFC that could be
>   addressed in the future independently of the solution that comes out of this
>   RFC?

**_TODO_**

## Future Possibilities

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

**_TODO - Discuss "L3s" like StaticWebsiteDistribution that are all-in-one._**
