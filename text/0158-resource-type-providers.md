---
feature name: resource-type-providers
start date: 2020-06-07
rfc pr: [#170](https://github.com/aws/aws-cdk-rfcs/issues/170)
related issue: [#158](https://github.com/aws/aws-cdk-rfcs/issues/158)
---

# Summary

With the AWS CloudFormation registry being publicly available (news [here](https://aws.amazon.com/about-aws/whats-new/2019/11/now-extend-aws-cloudformation-to-model-provision-and-manage-third-party-resources/)), we now have an alternative to CloudFormation custom resources. The main benefit being how they can be easily packaged and shared while the compute is being fully managed by AWS CloudFormation.

# Background

A few reference documentation to help with the discussion:
* CloudFormation custom resources: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html
* CloudFormation resource types: https://docs.aws.amazon.com/cloudformation-cli/latest/userguide/resource-types.html
* Explanation of difference between custom resource and resource types: https://aws.amazon.com/blogs/mt/managing-resources-using-aws-cloudformation-resource-types/

# Motivation

The motivation behind this RFC are:

## Reduce Footprint

As describe in CDK documentation [here](https://docs.aws.amazon.com/cdk/api/latest/docs/core-readme.html#custom-resource-providers), the resources implemented using the custom resource provider framework will have a large footprint. This means that provider framework itself will deploy many AWS resources to the customer account.

By moving those resources (lambdas, etc) to the AWS CloudFormation service itself, we will simplify the management for the customer by hidding the complexity.


## Separate Providers Source Code from CDK

Right now the custom resource providers source code is somewhat coupled with the @aws-cdk itself. It means that the whole CI/CD pipeline for CDK project will be triggered whenever you make any change to the provider's source code.

With the resource types approach, their source code will have their own development lifecycle. They could/should even be moved away from the main @aws-cdk libray folder so they can be separately versioned and packaged. Another important point is that the provider framework will also not be managed by the CDK community anymore, but by the support library provided by the CloudFormation team (more information [here](https://github.com/aws-cloudformation/cloudformation-cli#supported-plugins)).


## Share CloudFormation native resource

Because of the nature of the custom resources developed within the CDK project, they are not easily shared among CloudFormation natively.

On the other hand, the main purpose of resource type is to be native to CloudFormation. So other people will be able to consume the resource types even if they are not currently using CDK.


# Basic Example



# Design Summary



# Detailed Design



# Drawbacks

* Resource types are not widely adopted yet
* TypeScript (Node.js) plugin is not being supported by AWS

# Rationale and Alternatives



# Adoption Strategy



# Unresolved questions



# Future Possibilities

With the possibility of making the CDK resource types public (probably in the future), the way the versions of the multiples resources will be managed by the CDK team. Therefore, the customer would not even have to worry about registering them, but just consume it. Possibly, they would be able to consume different resource versions in a single account.
