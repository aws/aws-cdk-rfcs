---
feature name: cloudformation-registry-l1s
start date: 2020-07-10
rfc pr: (leave this empty)
related issue: 197
---

# Summary

The [CloudFormation Registry] provides a richer representation of available _CloudFormation resources_: the registry
schema uses [JSON Schema] (draft 07) to describe the acceptable values of properties, which is both more expressive and
easier to process than the schema of the legacy [CloudFormation Resource Specification].

This RFC proposes to change the source of schema informations used by `cfn2ts` in order to leverage the new and enhanced
schemas available in the [CloudFormation Registry], in order to provide a more robust experience ot our users. This
would also have the side benefit of reducing the amount of time needed for new resources to become available in the CDK,
since the [CloudFormation Registry] specifications are the master of record for this information.

[cloudformation registry]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-type-schemas.html
[cloudformation resource specification]:
  https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-resource-specification.html
[json schema]: https://json-schema.org/draft-07/json-schema-release-notes.html

# README

> Work backwards from the README: pretend that this feature is already implemented and write the README section. It will
> help you think about your proposal from a user experience point of view. If a README format does not make sense for
> your proposal, write a "Press Release" which announces your new feature instead.

# Motivation

> Why are we doing this? What use cases does it support? What is the expected outcome?

# Design Summary

> Summarize the approach of the feature design in a couple of sentences. Call out any known patterns or best practices
> the design is based around.

# Detailed Design

The [`json2jsii`] tool provides facilities to generate _jsii structs_ from JSON Schema specifications, providing the
basic building block for this migration. It might need to be changed (updated or forked) in order to generate code that
is closer to the current output of `cfn2ts`, although if this RFC is implemented as part of [CDK v2], some amount of
breaking change would be acceptable.

[`json2jsii`]: https://github.com/aws/json2jsii
[cdk v2]: https://github.com/aws/aws-cdk-rfcs/issues/79

# Drawbacks

While the [CloudFormation Resource Specification] document contains deep-links to the documentation pages, the
[CloudFormation Registry] schemas have been observed to generally not include documentation URLs, even though the
[meta-schema] supports a high-level URL. This means generating CloudFormation Resource classes from the [CloudFormation
Registry] requires either losing the ability to reference the official documentation for most (if not all) resources, or
cross-referecing the [CloudFormation Resource Specification] to extract the documentation URLs.

[meta-schema]:
  https://docs.aws.amazon.com/cloudformation-cli/latest/userguide/resource-type-schema.html#schema-properties-writeonlyproperties

# Rationale and Alternatives

> - Why is this design the best in the space of possible designs?
> - What other designs have been considered and what is the rationale for not choosing them?
> - What is the impact of not doing this?

# Adoption Strategy

This change is expected to be executed in such a way that it is transparent to end users: the change will be invisible
to users of higher level constructs (also known as _L2+_), and since we intend on preserving the exising CloudFormation
Resource classes' API, users of those will not need to alter their code in order to upgrade to the new classes.

# Unresolved questions

- Can we generate documentation deep-links based solely on the resource type and property (or attribute) name?
- Can we reliably generate forward-compatible jsii structs from JSON schema?
  - For example, can we avoid breaking the API if some property type changes to become a union of the previous type and
    some other type

# Future Possibilities

Tools that allow generating classes from the [CloudFormation Registry] schemas can be exposed to users, allowing them to
generate code for third-party CloudFormation Resources they have access to, which offer the same ergonomics as those
provided as part of the AWS Construct Library. This reduces the effort needed in order to get minimal support for
type-safe provisioning of such custom resources, and also helps with bootstrapping higher level constructs using those
third-party resources (without those, developers need to directly defer into the framework-level `CfnResource` class,
which does not provide any type-checking guarantees).

# Implementation Plan

INTENTIONALLY LEFT BLANK: an implementation plan will be added when the RFC is scheduled for implementation.

> The implementation plan should analyze all the tasks needed in order to implement this RFC, and the planned order of
> implementation based on dependencies and analysis of the critical path.
>
> Either add the plan here or add link which references a separate document and/or a GitHub Project Board (and reference
> it here) which manages the execution of your plan.
