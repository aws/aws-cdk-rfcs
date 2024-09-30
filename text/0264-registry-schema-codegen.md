---
rfc pr: [#266](https://github.com/aws/aws-cdk-rfcs/pull/266)
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/264
---

# Generating L1s from CloudFormation Registry Schema

All CloudFormation resource classes are currently generated from the
[CloudFormation Resource Specification]. We will switch to using the
[CloudFormation Resource Type Schema] instead.

[CloudFormation Resource Specification]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-resource-specification.html
[CloudFormation Resource Type Schema]: https://docs.aws.amazon.com/cloudformation-cli/latest/userguide/resource-type-schema.html

# Motivation

The CloudFormation Registry allows publishing new resource types to user's
accounts. Consuming it as an information source is the only way to add CDK
support for resources published privately to the CloudFormation registry (see
issue #77).

At the same time, the Registry's new Type Schema format is richer than the old
Resource Specification format. We will be able to generate better validations
for the set of CloudFormation resources by consuming this information.

CloudFormation will convert between the two versions of specifications, but
the conversion is not (and cannot) be perfect, so we'll be in a better
position to deal with conversion flaws if we are able to consume both
specifications ourselves.

# Differences between specs

The new schema format is a superset of JSON schema.

Here's a rough outline of the additional information that's in the new spec
that didn't use to be in the old one that are simple enough to add support
for:

* Additional type validations
  * Min/max length of strings (also object keys)
  * Regex patterns of strings (also object keys)
  * Allowable enum values
  * Min/max array lengths
  * Whether an array represents a set or sequence
* Properties that must be specified together (`dependencies`).
* Permissions required for the CRUD operations of resources (`permissions`).
* What properties are used to hold secrets/passwords/etc (`writeOnlyProperties`).
* Deprecated properties (`deprecatedProperties`).

There are things that customers are now able to specify that will pose
problems for us:

* Anonymous object types (example: see `AWS::Kendra::DataSource`, `DataSourceToIndexFieldMapping`).
  We will need to invent names for these types, which is going to lead to issues
  if the authors later on decide to rename them.
* Type unions on property types (we used to have *some* support for this but that was based on
  a non-official extension to the spec invented by GoFormation).
* Type unions to encode relationships between properties themselves.

Here are two examples of the latter, one recommendedby the CloudFormation documentation to show
how this feature could be used in theory, and one where this feature is already being used in
practice in the current specification:

As recommended in the doc section [how to encapsulate complex
logic](https://docs.aws.amazon.com/cloudformation-cli/latest/userguide/resource-type-schema.html#resource-type-howto-logic),
developers are expected to define basically the JSON Schema equivalent of:

```text
Cookies :: { forward: 'all' | 'none' } | { forward: 'whitelist'; whitelistedNames: string[] }
```

Or, for example, `AWS::Kendra::DataSource` contains the following definition:

```json
"OneDriveUsers" : {
  "type" : "object",
  "properties" : {
    "OneDriveUserList" : {
      "$ref" : "#/definitions/OneDriveUserList"
    },
    "OneDriveUserS3Path" : {
      "$ref" : "#/definitions/S3Path"
    }
  },
  "oneOf" : [ {
    "required" : [ "OneDriveUserList" ]
  }, {
    "required" : [ "OneDriveUserS3Path" ]
  } ]
},
```

To indicate that *exactly one* of the properties must be specified (note how `properties`
has been factored out and applies to both branches of the `oneOf`).

> This is a weird way to specify it but I imagine it works because if you
> specify both properties you could satisfy both subschemas which is not allowed
> by `oneOf`.

There are also some technical problems with the spec that need to be addressed
(or reckoned with) before we can properly consume the spec:

* The CloudFormation Registry Schema is a confusing superset of JSON Schema,
  as it combines both *properties* and *attributes* in the same type definition.
  There are fields alongside the type definition which tell you which properties
  are actually input properties, and which ones represent output attributes (
  retrievable via `{ Ref }` and `{ Fn::GetAtt }`). Code generators and compatibility
  checkers need to clearly separate these sets of properties out because they
  need to be treated very differently.
* There is currently no good source of information in the CloudFormation Registry
  Schema on attributes that can be `{ Fn::GetAtt }`ed. `readOnlyProperties`
  would seem to represent those, but it does not currently handle the case
  where a `Property` and `Attribute` have the same name. Support for that
  will be forthcoming, but until then we can't reliably switch over.

## SAM Specification

We are also generating L1s for the SAM resource types, which are by now
being used in 60% of all customer stacks.

The SAM specification has been hand-written to mimic the old CloudFormation
specification, but with extensions. This specification is not maintained
by CloudFormation and hence is not being converted to JSON schema by them.

We will need to write our own CloudFormation specification -> JSON Schema
converter to be able to keep on using SAM resources once we switch over.

## Major Components

Implementing support for this requires the following components:

* Centralized spec repository with a way to patch the spec. There *will* be
  breaking changes coming in as updates are released and upstream developers
  make mistakes, and we still need a way of patching around those to unblock
  our build. Since a number of resources are automatically being converted
  from old format to new format, they are missing additional information. We
  can enhance the spec with information obtained from the [cfn-lint] project.
* A tool to two versions of the spec. This is necessary to generate the
  changelog every time we import a new version of the resources. It should be
  able to identify breaking changes, so that we can extend this tool to
  resource developers and they can prevent themselves from accidentally
  releasing breaking changes (reducing churn on downstream systems).
* A tool to generate code the type and resource definitions found
  in the schema. This can mostly be based on `json2jsii`, although we will
  need to extend it somewhat. The tool also needs to generate construct
  classes from the resources themselves, and validation routines from all the
  type information we're getting from the spec that cannot be encoded into
  the jsii type system (string lengths, dependent properties, etc.) This tool
  should be publicly published so it can be used by the CLI and other tools
  to generate construct classe on-demand (see #77).

[cfn-lint]: https://github.com/aws-cloudformation/cfn-python-lint

## High level design

```test
                               ┌────────────────┐          ┌───────────────────┐
                               │                │          │                   │
                        ┌─────▶│    cfnspec     │─────────▶│ cfn-schema-tools  │
┌────────────────┐      │      │                │  bundle  │                   │
│                │      │      └────────────────┘          └───────────────────┘
│    codegen     │──────┤
│                │      │      ┌────────────────┐
└────────────────┘      │      │                │
                        └─────▶│   json2jsii    │
                               │                │
                               └────────────────┘
```

### cfn-schema-tools: Spec Parser and Diff Tool

This is where we load and query the underlying Schema files. We want to do
light transforms from the underlying files to hide the internal details.

For example, resource metadata, input properties and output attributes have
all been mashed into the same JSON-schema-like file, but they are conceptually
different and clearly making the distinction here will make downstream processing
easier (with less duplication of knowledge about schema representation).

The parser comes with a diff tool to compare two versions of the schema and
produce a list of differences. This is necessary to generate the CHANGELOG for
specification changes we import into the CDK.

The diff tool should be extended to classify changes into additive changes
and breaking changes so that the tool can be used by CloudFormation resource
authors. See **Appendix A** for a list of changes that should be considered
breaking.

We add the converter for CloudFormation Specification to CloudFormation
Registry Schema here as well.

### cfnspec: Spec repository

We introduce a new package like the current `@aws-cdk/cfnspec`, which
contains a copy of the resource specification and associated code to query
it.

- This is where we can once again apply patches (either still json-patches or
  a different format).
- This is also where we include information obtained from the cfn-lint
  repository, transform it to JSON schema, and apply it as patches.

For example, useful information we can get from cfn-lint:

* [OnlyOne](https://github.com/aws-cloudformation/cfn-python-lint/blob/main/src/cfnlint/data/AdditionalSpecs/OnlyOne.json),
  mutually exclusive properties in a structure.
* [Inclusive](https://github.com/aws-cloudformation/cfn-python-lint/blob/main/src/cfnlint/data/AdditionalSpecs/Inclusive.json),
  a set of property dependencies.
* [Exclusive](https://github.com/aws-cloudformation/cfn-python-lint/blob/main/src/cfnlint/data/AdditionalSpecs/Exclusive.json),
  properties that preclude each other.

Etc.

### codegen: Code Generation

There are 3 parts of the codebase that are generated from the specification:

- Interfaces representing the input properties to the CloudFormation
  resources (i.e. `CfnBucketProps`, `CfnBucket.LifecycleProps`, etc.). We should be
  able to use `json2jsii` for most of these, although it may need to be extended
  a little to support all use cases. See **Appendix B** for a list of changes.
- Construct classes representing the resources themselves (i.e. `CfnBucket`).
- Routines that will convert back and forth between the programming language
  model and the CloudFormation model (`toCloudFormation()` and `fromCloudFormation()`).
- Validation routines to check that a given set of CloudFormation properties
  matches the schema; in the current implementation these validate types and
  presence of required properties, but the new schema has the ability to express
  mutual exclusion between properties, valid enumeration values, string lengths,
  and more.

We will generate everything to `lib/<module>.generated.ts`, same as the current
code generator.

## Why should we _not_ do this?

We can continue to consume the old resource specification.

We will be beholden to CloudFormation to perform the downconversion from the new
to the old format, we will miss out on additional validations, and we won't
be able to generate resources on-demand.

## What is the high level implementation plan?

- Start by introducing the new spec package, containing only the CloudFormation Registry
  Schema, and start filling out the tools to query the model.
- Start filling out the codegen to generate initial classes, types,
  conversion methods and validators.
- Based on an environment variable, have the build run the old or new codegen.
- Use `jsii-diff`/`jsii-reflect` to compare assemblies built using the old and new codegen,
  and keep iterating until they show no changes (this may take a significant amount of time
  depending on the details).
- Translate the patches we currently have on the old `cfnspec` to equivalent patches on the
  new schema.
- Write the diff tool and have it generate a CHANGELOG on updates.
- Add a spec update task for the new spec, including generation of new packages
  and CHANGELOG generation.
- Run the spec update task as a periodic job.
- Write CloudFormation Specification -> CloudFormation Registry Schema converter and add
  support for SAM.
- Generate extended property validation routines (enum types, string lengths, regex patterns)
- Start incorporating additional model metadata from `cfn-lint`.
- Add an update task to import new specification data from `cfn-lint`.
- Run the `cfnlint` import task as a periodic job.
- Verify that `jsii-diff`/`jsii-reflect` still show no changes when CDK is built using the
  new codegen, and that the build passes successfully.
- Flip over to the new codegen by default.
- Wait for a month to make sure no unexpected errors come in. If they do, revert.
- Remove the legacy codegen and the spec update job.

## Open Issues

There seems to be no proper inventory of `{ Fn::GetAtt }`able attributes of
resources in the new spec. Or there is, but it conflicts with other parts of
the spec. A query on this is outstanding.

## Appendix A: Breaking Changes

The following changes made to the Schema should be considered breaking changes:

1. Property is changed to required.
2. New property is added and is a required property.
3. Mutable property is changed to immutable.
4. Property is removed from resource spec.
5. Type of the property has changed.
6. Property case is modified.

Also:

7. Type name is changed (or an anonymous type is given a name or vice versa).
8. Types of input properties are strengthened.
9. Types of output properties are weakened.
10. A property is removed from the `readOnlyProperties` (`{ Fn::GetAtt }` list).

The following rules are not about changes, but about schemas that are straight-up invalid:

1. A `readOnlyProperty` or `primaryIdentifier` (corresponding to `{ Fn::GetAtt }`able
   or `{ Ref }`able attributes) has a complex type (type must be a scalar or list of scalars).

## Appendix B: Changes to json2jsii

- No line breaks in generated docs
- Needs different doc annotations
- Verify support for complex JSON schema constructs (like `oneOf`, etc).
