---
rfc pr: [#266](https://github.com/aws/aws-cdk-rfcs/pull/266)
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/77
---

# On-Demand import of Resources

Not all L1 resources need to be vended via the AWS Construct Library. The
user can generate constructs on demand based on imported type definitions
from a variety of sources.

## Working Backwards

### README

The AWS Construct Library ships with CloudFormation resources and
higher-level resources for all of AWS' services. Using the built-in
classes gives you the advantage of IDE AutoComplete and type checking
when defining them.

There are more kinds of resources and even complete applications you can
deploy via CloudFormation. These include:

- Applications from the Serverless Application Repository
- Applications from the AWS Service Catalog
- Non-AWS resources, or your own custom resources registered to your account
  in the AWS CloudFormation Registry.

The CloudFormation resources available from these locations are not in the
AWS Construct Libray because they're (1) not managed by AWS and (2) the
list that's available to you depends on the configuration of your account.

However, you can get the same benefits of AutoComplete and type checking on
these resources as well by **importing** them into your CDK project.

Importing is done by running the `cdk import` command. The exact syntax of
the command depends on the type of resource you're trying to import.

```shell
# To import from the CloudFormation Registry, pass the type name:
$ cdk import cloudformation Datadog::Monitors::Monitor
# ...or pass an entire scope:
$ cdk import cloudformation Datadog::Monitors

# To import applications from the Serverless Application Repository, pass the ARN:
$ cdk import sar arn:aws:serverlessrepo:us-east-1:464622532012:applications/Datadog-Log-Forwarder

# To import applications from the Service Catalog, pass the product ID
$ cdk import servicecatalog prod-wxkgnkcrznu5i
# ...or don't pass anything to import all available products
$ cdk import servicecatalog
```

`cdk import` will create a set of source files for you in the `imports/` directory,
which you should commit to version control. After that, you can use them in your
application as usual.

If you want to update to the latest version of the definition, you can run the same
`cdk import` command again. It will show you the changes to the the resource, before
asking you to confirm to overwrite the existing source files.

If you happen to be working in Java, C#, Python or Go, `cdk import` will build a
jsii bundle from the generated sources and automatically generate the corresponding
binding sources as well.

The same workflow applies if you are the vendor of 3rd party constructs that
are available via the CloudFormation registry. You can use `cdk import` to
generate L1s, completement them with L2s and vend them both together in a
construct library to your customers.

## FAQ

### What are we launching today?

A new subcommand to the CLI that will perform the necessary AWS calls to
import resource schemas on demand from 3 additional resource sources, and
generate constructs from those definitions.

### Why should I use this feature?

You can use this feature to gain the same IDE support for CloudFormation
resources that are specific to your account as exists for those that are
available to all AWS accounts.

## Internal FAQ

### Why are we doing this?

To power up the CDK and enable its use in more scenarios.

To smoothly interoperate with other CloudFormation abstraction mechanisms that exist
so customers don't have to choose.

### Why should we _not_ do this?

Customers can achieve the end result already, albeit in an untyped way, by
instantiating the `CfnResource` construct directly with a big bag of strings.

The target market might not be large enough to justify the effort.

It might confuse our users even more about what CloudFormation abstraction mechanisms
they are *supposed* to use.

### What changes are required to enable this change?

We need to be able to parse and diff and generate code based on JSON Schema
sources (see #264). The tool that we use to generate this code (a la `cfn2ts`)
needs to be public.

To support SAR and Service Catalog, we convert the API responses into JSON
schema so that we can codegen using the same tool; the class generation
needs some customization as well.

A new CLI subcommand gets added, which performs two major functions:

- Import a schema from somewhere, convert to JSON schema if necessray.
- Use the schema to perform code generation for the CloudFormation resource sources
  in the project directory.
  - It needs to be able to detect (in some way) what programming language the
    current project is in (TypeScript, Java, ...), and if a non-TypeScript
    language is detected `jsii-srcmak` can be used to build a local jsii
    package for the generated resources.

`jsii-srcmak` needs to be brought into maintenance of the CDK project.

### Is this a breaking change?

No.

### What are the drawbacks of this solution?

Nothing dramatic. We may have to figure out how to deal with upgrades in an
automatic way. Would be good if we could auto-refresh all previously imported
constructs (would probably look like writing a config file containing the
ids/ARNs of all imported resources).

### What alternative solutions did you consider?

Public SAR applications could be vended on our end via a library.

For privately published applications there is nothing else we can really do other
than generate code on-demand.

### What is the high level implementation plan?

1. Add the CLI feature for CloudFormation registry resources and TypeScript users only.
   This should be fairly trivial as it's mostly just exposing the code we already have
   in place for CDK L1 generation via a CLI interface.
2. This can be released and previewed already.
3. During developer preview, we add in support for other languages.
4. During developer preview, add in support for additional schema sources.
   First SAR, then Service Catalog.

### Are there any open issues that need to be addressed later?

Do we want to support `fromCloudFormation()` (used by `@aws-cdk/cfn-include`)
for these resources? The implementation of `cfn-include` will become quite a
lot trickier if we do.

## Appendix

### CloudFormation Registry

All available types are available via API:

```shell
$ aws cloudformation list-types --visibility PUBLIC
$ aws cloudformation describe-type --arn arn:aws:cloudformation:eu-west-1::type/resource/AWS-CloudFront-RealtimeLogConfig
...Output contains a CloudFormation Registry schema, which is a superset of JSON Schema...
```

Types discovered this way map directly to an L1.

### Serverless Application Repository

The API is not documented on the AWS Docs website, but available via the AWS CLI:

```shell
# As far as I am aware there is no way to search except by using the console

# Get access to a single SAR template, given its ARN
$ aws serverlessrepo get-application --application-id arn:aws:serverlessrepo:us-east-1:464622532012:applications/Datadog-Log-Forwarder
```

We obtain the schema by parsing the template.

Applications discovered this way map to the following CloudFormation template:

```yaml
Resources:
  DatadogLogForwarder:
    Type: AWS::Serverless::Application
    Properties:
      Location:
        ApplicationId: arn:aws:serverlessrepo:us-east-1:464622532012:applications/Datadog-Log-Forwarder
        SemanticVersion: 2.4.1
```

### Service Catalog

Service Catalog allows system administrators to define applications using CloudFormation
and control what IAM identities in what accounts are allowed to deploy them.

There are standard "portfolios" with built-in templates (AWS QuickStarts, AWS Solutions solutions, reference
architectures etc)

```shell
# List all products made accessible to us by an admin
$ aws servicecatalog search-products

# Get the schema
$ aws servicecatalog describe-product --id prod-wxkgnkcrznu5i
$ aws servicecatalog describe-provisioning-artifacts --product-id prod-wxkgnkcrznu5i --provisioning-artifact-id pa-sa7esaptaxllk
$ aws servicecatalog describe-provisioning-parameters --product-id prod-wxkgnkcrznu5i --provisioning-artifact-id pa-sa7esaptaxllk --path-id XXXX
```

We obtain the schema by parsing the output of `DescribeProvisioningParameters`.

Applications discovered this way map to the following CloudFormation template:

```yaml
Resources:
  MongoDB:
    Type: AWS::ServiceCatalog::CloudFormationProvisionedProduct
    Properties:
      ProductId: prod-wxkgnkcrznu5i
      ProvisioningArtifactId: pa-sa7esaptaxllk
      ProvisioningParameters:
        - ....
```
