# CloudFront Origin Access Control L2

* **Original Author(s)**: @gracelu0
* **Tracking Issue**: [#491](https://github.com/aws/aws-cdk-rfcs/issues/491)
* **API Bar Raiser**: @colifran

[CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html) (OAC) is the recommended way to send authenticated requests to an Amazon S3 origin using IAM service principals. It offers better security, supports server-side encryption with AWS KMS, and supports all Amazon S3 buckets in all AWS regions. 

Currently the `S3Origin` construct automatically creates an Origin Access Identity (OAI) to restrict access to an S3 Origin. However, using OAI is now considered legacy and no longer recommended. CDK users who want to use OAC currently have to use the L1 construct `CfnOriginAccessControl`. They need to use escape hatches to attach the OAC to their CloudFront distribution and remove the OAI that is automatically configured. With a CloudFront OAC L2 construct, users will be able to set up their CloudFront origins using OAC instead of OAI in a much cleaner, simpler way.

## Working Backwards

### CHANGELOG

`feat(cloudfront): origin access control L2 construct`

### README

# Amazon CloudFront Construct Library
Amazon CloudFront is a web service that speeds up distribution of your static and dynamic web content, such as .html, .css, .js, and image files, to your users. CloudFront delivers your content through a worldwide network of data centers called edge locations. When a user requests content that you're serving with CloudFront, the user is routed to the edge location that provides the lowest latency, so that content is delivered with the best possible performance.

## Creating a Distribution

CloudFront distributions deliver your content from one or more origins; an origin is the location where you store the original version of your content. Origins can be created from S3 buckets or a custom origin (HTTP server). Constructs to define origins are in the aws-cdk-lib/aws-cloudfront-origins module.

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
CloudFront's redirect and error handling will be used. In the latter case, the Origin will create an origin access control and grant it access to the
underlying bucket. This can be used in conjunction with a bucket that is not public to require that your users access your content using CloudFront
URLs and not S3 URLs directly.

## Restricting access to an S3 origin

## Migrating from OAI to OAC

# CloudFront Origins for the CDK CloudFront Library


This library contains convenience methods for defining origins for a CloudFront distribution. You can use this library to create origins from
S3 buckets, Elastic Load Balancing v2 load balancers, or any other domain name.

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
CloudFront's redirect and error handling will be used. In the latter case, the Origin will create an **origin access control** and grant it access to the
underlying bucket. This can be used in conjunction with a bucket that is not public to require that your users access your content using CloudFront
URLs and not S3 URLs directly. Alternatively, a custom origin access control can be passed to the S3 origin in the properties.






---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

> This section should include answers to questions readers will likely ask about
> this release. Similar to the "working backwards", this section should be
> written in a language as if the feature is now released.
>
> The template includes a some common questions, feel free to add any questions
> that might be relevant to this feature or omit questions that you feel are not
> applicable.

### What are we launching today?

> What exactly are we launching? Is this a new feature in an existing module? A
> new module? A whole framework? A change in the CLI?

We are launching a new L2 construct `OriginAccessControl` for CloudFront (`aws-cdk-lib/aws-cloudfront`). We are also launching some modifications to the existing `S3Origin` construct in the `aws-cdk-lib/aws-cloudfront-origins` module.

### Why should I use this feature?

Use Origin Access Control to restrict access to your AWS origin so that it's not publicly accessible. This ensures users only access the content in your AWS origin through your specified CloudFront distribution. OAC is recommended instead of OAI for its latest security best practices and support in new AWS regions.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

This feature has been highly requested by the community, since Origin Access Control has been available since August 2022. Although the L1 construct `CfnOriginAccessControl` exists, users need to remove the OAI automatically configured by the existing `S3Origin` construct which is a subpar user experience.

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

Users have already found workarounds using the L1 construct.

### What is the technical solution (design) of this feature?

> Briefly describe the high-level design approach for implementing this feature.
>
> As appropriate, you can add an appendix with a more detailed design document.
>
> This is a good place to reference a prototype or proof of concept, which is
> highly recommended for most RFCs.

See prototype branch here


### Is this a breaking change?

No, this is not a breaking change. This is a new feature and the existing setup using OAI will still be supported.

### What alternative solutions did you consider?

> Briefly describe alternative approaches that you considered. If there are
> hairy details, include them in an appendix.



### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

Existing customers who wish to migrate from OAI to OAC will need to update their CDK code. Customers who are using the L1 construct for OAC will also need to make changes to their CDK code to use the new L2 construct.

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

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.
