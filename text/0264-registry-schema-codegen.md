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

Here are extensions that are now possible that will pose problems for us:

* Anonymous object types (example: see `AWS::Kendra::DataSource`, `DataSourceToIndexFieldMapping`).
  We will need to invent names for these types, which is going to lead to issues
  if the authors later on decide to rename them.
* Type unions on property types (we used to have *some* support for this but that was based on
  a non-official extension to the spec invented by GoFormation).
* Type unions to encode relationships between properties themselves.

Examples of the latter:

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

### Spec repository

We introduce a new package like `@aws-cdk/cfnspec`, which contains a copy of
the resource specification and associated code to query it.

- This is where we can once again apply patches (either still json-patches or
  a different format).
- This is also where we include information obtained from the cfn-lint
  repository, transform it to JSON schema, and apply it as patches.

For example, useful information we can get from cfn-lint:

* [OnlyOne](https://github.com/aws-cloudformation/cfn-python-lint/blob/master/src/cfnlint/data/AdditionalSpecs/OnlyOne.json),
  mutually exclusive properties in a structure.
* [Inclusive](https://github.com/aws-cloudformation/cfn-python-lint/blob/master/src/cfnlint/data/AdditionalSpecs/Inclusive.json),
  a set of property dependencies.
* [Exclusive](https://github.com/aws-cloudformation/cfn-python-lint/blob/master/src/cfnlint/data/AdditionalSpecs/Exclusive.json),
  properties that preclude each other.

Etc.

### Diff Tool

WIP

### Code Generation

WIP

## Why should we _not_ do this?

We can continue to consume the old resource specification.

We will be beholden to CloudFormation to perform the downconversion from the new
to the old format, we will miss out on additional validations, and we won't
be able to generate resources on-demand.

## What is the high level implementation plan?

WIP

## Open Issues

There seems to be no proper inventory of `{ Fn::GetAtt }`able attributes of
resources in the new spec. Or there is, but it conflicts with other parts of
the spec. A query on this is outstanding.

## Appendix: Breaking Changes

1. property is changed to required.
2. new property is added and is a required property.
3. mutable property is changed to immutable.
4. property is removed from resource spec.
5. type of the property has changed.
6. property case is modified.

Also:

7. Type name is changed (or an anonymous type is given a name or vice versa).

## Appendix: Changes to json2jsii

- No line breaks in generated docs
- Needs different doc annotations
- Need to be able to filter properties out