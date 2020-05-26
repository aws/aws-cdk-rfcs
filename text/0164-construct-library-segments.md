---
feature name: Construct Library Segments
start date: 26/05/2020
rfc pr: [#169](https://github.com/aws/aws-cdk-rfcs/pull/169)
related issue: [#164](https://github.com/aws/aws-cdk-rfcs/issues/164)
---

# Summary

For AWS services that offer multiple solutions under the same umbrella or variants of the same solution for different
use cases, define a new primitive called 'segment' that slices the construct library along these lines.

Segments will be identified by the module owners as part of initial scoping work of the module. They can also be
identified during the implementation phase of the construct library when new information is available.

Stability will be tracked and publicized for each segment, instead of for the entire construct library.

# Background

The CDK construct libraries are developed and shipped by the CDK core team aimed at providing high-level construct
coverage for AWS services.

Each construct library has a piece of metadata called 'stability' associated with them. This indicates and sets the
expectation to customers on whether they should expect the APIs or current experience of break. Having a period with
no backwards compatibility promise gives the CDK team valuable customer feedback on API ergonomics early on.

Construct libraries go through a lifecycle indicated by their stability. They usually start off as 'experimental',
when in active development, finally making their way to 'stable'. Construct libraries marked 'stable' will
not undergo backwards incompatible changes. Learn more at [Construct Library Module
Lifecycle](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0107-construct-library-module-lifecycle.md).

The current stability of each construct library is published to library's documentation landing page.
See [landing page for EC2](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ec2-readme.html) which is a stable
library and [landing page for APIGatewayV2](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigatewayv2-readme.html)
which is an 'experimental' library (as of this when this document is written).

Besides stability metadata for entire construct libraries, it is possible in the CDK to attach stability metadata
to specific constructs and to specific APIs within a construct.

# Motivation

AWS services, in terms of their control plane surface area, come in all shapes and sizes.
On one end are services like S3, SQS and CloudTrail that come with a single resource to be configured and a handful
of properties. On the other end, are services like EC2, API Gateway, Cognito and Step Functions that come with a
significant number of resource types and/or with a large number of properties with complex combination of valid values.

Let's start with a few examples of AWS services with large surface areas, and how they are organized under the hood.

* Consider the service, Amazon Cognito. It consists of two completely separate products - [User
Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) and [Identity
Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-identity.html) - that are packed together as
a single AWS product. They have two entirely separate sets of CloudFormation resource types that do not interact with
each other, and the user experience on the AWS console are completely separated.

* Consider another service, Amazon API Gateway V2. Unlike Cognito, on the surface, it has a single set of
CloudFormation resource types. but under the hood, it consists of 2 separate product variants - [HTTP
APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html) and [Websocket
APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html) - where specific
properties and values for these properties are only available to specific product variants.

* Consider a third service, AWS Step Functions. Unlike the other two, this service offers only two CloudFormation
resource types but it comes with a ton of options. The service offers [integrations with 10 other AWS
services](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-service-integrations.html) with an average
of 3.2 APIs per AWS service that it can integrate with.

By applying a single stability label on the construct library for these AWS services, a couple of problems around
'one-size-fit-all' arise.

The large surface area, in these cases, along with a single stability value make it difficult to record progress and
announce availability of some parts of the construct library.
If the `aws-apigatewayv2` module is announced as 'Developer Preview', it may imply to the customer, incorrectly, that
both product variants are in that state. There is no way to send *clear and coherent message* to the customer that
only the HTTP API variant is in 'Developer Preview' and not Websocket APIs.

Similar arguments can be applied to the other construct libraries. In the case of Step Functions, new service
integrations are continuously released and their CDK implementations at different levels of maturity.
Announcing that the `aws-stepfunctions-tasks` module as 'stable' may be misinterpreted to imply that all service
integrations are 'stable'.

A secondary problem that arises from this is one of tracking. The [AWS CDK
roadmap](https://github.com/aws/aws-cdk/blob/master/ROADMAP.md) contains tracking issues for each of the construct
libraries, encouraging customers to '+1' on issues that they would like supported in the CDK. The goal behind this
is to use this as a signal for prioritization. For services with large surface area, this signal is ambiguous and does
not precisely communicate the customer's wish.

The last problem is one of internal measurements. Currently, progress on AWS service coverage via the CDK construct
libraries is measured as the number of construct libraries at a specific stability. This makes it difficult
to measure progress when working on AWS services with large surface area, and may create the feeling of little
or no progress. This can also create a perverse incentive to prioritize easier construct libraries first, instead of
ones with most value to customers.

# Design

To address the above problems, we introduce the idea of a 'segment'. A construct library is sliced into segments that
can be modeled as separate, decoupled experience of using the service via the CDK. Each segment should make sense on
its own to the customer from its API and ergonomics.

Let's apply this to the three examples we had above -

* *Amazon Cognito:* This construct library will have two segments - *user pool* and *identity pool*.
Amazon Cognito service publicizes these as entirely separate sets of use cases - from separate documentation,
to entirely separate experiences on the AWS console and entirely separate sets of CloudFormation resource types.

* *Amazon API Gateway V2:* This construct library will have two segments - *http api* and *websocket api*.
Unlike the previous example, the line here is a little more vague. While the product guide [documents
them](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html) separately, their experiences on the
AWS console is not as separate, and they use the same set of CloudFormation resource types.
The CDK construct library defines two sets of constructs - `HttpApi` and `WebsocketApi` - to provide the best
ergonomics.

* *AWS Step Functions:* This construct library will have one segment for each AWS service integration.

Once segments are identified, their individual availablilities and stabilities can be announced and publicized
separately. Roadmaps, metrics and goals can be updated to track progress by segment.

Every construct library today is already, informally, split into two segments -
*CFN-Resources* and *CDK Constructs*. As part of this change, these two will be grandfathered in as two segments.

## Segment identification

There are no clear set of rules that can be devised on what constitutes a segment and what does not. It is an output of
software design, for knowledge of the service's use cases, high software judgement and ergonomic art are key
ingredients.

However, here are some guidelines that can help -

* Each segment in a construct library should stand on its own. It should make sense to use one segment without having to
use the other for some valid use cases.

* As a corollary to the previous point, picking the set (or a subset) of unimplemented features of the underlying AWS
service does not constitute a segment.

* Segments should have a certain minimum size - it can range from a single CloudFormation resource type with
a large number of properties to the entire surface area of the AWS service. Taking the approach of one segment per
CloudFormation resource type is definitely not the correct slicing.

There can be exceptions to these rules. An example is AWS Step Functions in our above example. The entire service is
represented by a single CloudFormation resource type, but we have chosen to slice each AWS service integration as its
own segment.

All construct libraries for new AWS services (i.e., no high level construct support) start off with two segments -
*CFN Resources* and *CDK Constructs*. This is sufficient for many, if not most, construct libraries throughout their
lifecycle.

Additional segments are identified as part of initial scoping and planning for the construct library, usually by
area owners. Segments can also be identified when new information is available or design choices are made during
implementation; this is by design.

# Adoption

The landing page of a construct library module will list the list of segments and their current stability.
For example, the landing page for the `aws-cognito` module would look something like -

| Segment | Maturity |
| --- | --- |
| CFN Resources | Stable |
| User Pool | Developer Preview |
| Identity Pool | Experimental |

The [AWS CDK roadmap](https://github.com/aws/aws-cdk/blob/master/ROADMAP.md) will no longer track, via tracking issues,
entire construct libraries. It will instead have tracking issues for each segment.

The [construct library lifecycle](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0107-construct-library-module-lifecycle.md)
will be adjusted to incorporate segments and will track the lifecycle of each segment.

All metrics, and any current and future goals around construct library stability will be tracked around segments.

# Drawbacks

The primary drawback of segments is the ambiguity overhead built into its identification.

Unlike construct libraries, which are clearly split by AWS service, engineers need to understand the service,
plan the library's ergonomics, and finally understand segments before they can be identified. This can lead to abuse
of segments, caused by misunderstanding.

This risk can be mitigated by performing basic upfront design work on the construct library. This activity is bound to
have other positive side-effects to construct library work and estimations.

Another mitigation is that segments do not change the code or packaging structure in anyway. This allows for us to
change our mind and re-organize segments if we get it wrong. In fact, adding new segments, or splitting segments
based on new information is by design.

# Alternatives

## Construct, API and property level stability

The CDK has the ability to mark stability (experimental or stable) at different levels - for the entire construct
library, for a specific construct, for a specific API in a construct or for a specific property in a `Props` or
`Options` struct.

When this already exists, it is natural to consider if marking the stability of constructs that are not ready as
'experimental' is sufficient. As an example, in the `aws-apigatewayv2` construct library, the library itself may be
marked as 'stable' but the `WebsocketApi` and associated constructs may be marked 'experimental'.

The drawback of this approach is that marking a few constructs, or half of all constructs in a worse case, as
'experimental' is at best confusing to the user. A user who is constrained to only use stable APIs will have to check
with their IDE or the documentation every time they use a construct, an API in a construct or a property.
This is impractical.

## Split the library

Carrying over from the previous section, another option is to split the library when new segments are identified.
In the case of `aws-cognito`, the library will be split into `aws-cognito-userpool` and `aws-cognito-identitypool`.
In the case of `aws-apigatewayv2`, the library will be split into `aws-apigatewayv2-http` and `aws-apigatewayv2-websocket`.

Take two scenarios to dive into how an implementation of this would potentially look -

**Scenario 1:** Segments are identified before any high level constructs have been developed for the construct library.

At this point, the only contents of the original construct library (such as, `aws-cognito` or `aws-apigatewayv2`) are
the autogenerated CFN Resource constructs. The most important decision here is to identify where they will be homed.

Splitting them across the new segmented packages will vary drastically by the underlying service (i.e., they may use
completely different CloudFormation resource types or choose to share them), so that's not a good option.
The simpler solution is to leave them in the original package. The sole responsibility of the original
package will now be to home the CFN Resource constructs.

**Scenario 2:** Segments identified after some high level constructs have been implemented.

This is likely the more common scenario, given increasing community contributions, and lack of, or any miss in upfront
planning.

A decision needs to be made on how these high level constructs are homed, with least customer disruption.

Depending on the implementation, there may be a way to cut the code such that the bulk of the implementation moves to
the new (segment) home while some basic interfaces and proxies remain in the original package for backwards
compatibility. This may not be possible in many cases, and wholesale lift-and-shift may need to be employed.

Let us say, that it is possible to slice the code in a way that the constructs in the original package
(now marked 'deprecated') proxy to their counterparts. As an example, a skeleton `UserPool` construct in `aws-cognito`
proxies into `UserPool` construct homed in `aws-cognito-userpool`. They would, in turn, depend on the underlying
CFN Resource constructs that are homed back in `aws-cognito` (as per *Scenario 1* above), creating a cyclic dependency.

Further, such a change will be distasteful to the customer if it was applied to a 'stable' module.
The construct will be 'stable' one day and 'deprecated' the next, only for the sake of code organization.

These scenarios illustrate the complexity that arise with trying to shift code between packages. The cost of segmenting
needs to be smaller, simpler and far less risky.

# Unresolved questions

Identify if a completely different solution or a variant of '[Split the library](#split-the-library)' that is
significantly cheaper and simpler.
