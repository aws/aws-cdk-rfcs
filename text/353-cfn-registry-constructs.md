# Constructs for Public CloudFormation Extensions

* **Original Author(s):**: @eladb
* **Tracking Issue**: #353
* **API Bar Raiser**: @rix0rrr

A set of construct libraries which includes generated constructs for all CloudFormation
resources and modules published to the public CloudFormation Registry.

## README

The `@cdk-cloudformation-extensions/xxx` scope includes construct libraries with generated strongly-typed "L1" constructs
for all the public extensions (resources and modules) in the AWS CloudFormation public registry. This library
makes it easier to use public CloudFormation extensions in your CDK apps.

For example, let's say I want to define a GitHub repository using the `TF::GitHub::Repository` resource:

```ts
import { CfnRepository } from '@cdk-cloudformation-extensions/tf-github-repository';

new CfnRepository(this, 'MyRepo', {
  name: 'my-repo',
  description: 'My awesome project',
  licenseTemplate: 'apache-2.0',
});
```

For each type (e.g. `TF::GitHub::Repository` in the above example) in
the public CloudFormation Registry, a module is available under
the scope `@cdk-cloudformation-extensions/NAMESPACE-TYPE`. This library
includes a construct class and all the relevant data types for this
type.

The module version corresponds to the version of the type schema
in the public registry.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are publishing a set of construct libraries (in all JSII languages) which include constructs (and auxiliary types) for
all the resources and modules in the public CloudFormation registry.

### Why should I use this feature?

This library makes it easier to discover and use CloudFormation extensions in CDK apps.

Previously, in order to use a resource from the CloudFormation registry, you would need to look up the resource documentation
and use the low-level, weakly-typed `CfnResource` class to define it in your CDK app:

```ts
new CfnResource(this, 'MyEksCluster', {
  type: 'AWSQS::EKS::Cluster',

  // weakly-typed!
  properties: {
    name: 'my-new-cluster',
    tags: [ { key: 'foo', value: 'bar' } ],
  },
});
```

With `@cdk-cloudformation-extensions` all public resources and modules will be listed in the **Construct Hub** like any
other construct and by importing the relevant `cdk-cloudformation-extensions` module into their projects, they will be able to
use them via strongly-typed classes. IDEs will show type information and inline help derived from the
extension schema.

```ts
import { CfnCluster } from '@cdk-cloudformation-extensions/awsqs-eks-cluster';

new CfnCluster(this, 'MyEksCluster', {
  name: 'my-new-cluster',
  tags: [ { key: 'foo', value: 'bar' } ],
});
```

## Internal FAQ

### Why are we doing this?

We are doing this because CDK users would like to be able to use CloudFormation extensions
(modules, resources) as first-class citizens in CDK code. Extensions and native resource types
should look and feel the same way when defined in CDK apps.

Additionally, we would like to surface CloudFormation extensions in the upcoming Construct Hub
and to that end, if we simply publish a construct library that includes constructs for all the public,
extensions, this library will naturally be discoverable through the Hub.

### Why should we _not_ do this?

We have a longer term plan ([RFC#77](https://github.com/aws/aws-cdk-rfcs/issues/77)) to add
support for a CLI command called `cdk import` which will allow users to generate L1s from any
registry type just-in-type and add them to their project (this is similar to CDK8s and CDKtf).

### What is the technical solution (design) of this feature?

The idea is to do something similar to what we do with the CloudFormation L1s
in the AWS CDK and simply publish JSII construct libraries which includes
statically-generated L1s for all the public registry extensions.

#### Package per type

CloudFormation extensions are semantically versioned. This means that new versions of an extension
may include breaking changes. We also want to allow users to pick up a specific version of an extension.
In light of these constraints, we determined that the best path forward is to publish each extension (type)
as a separate module, with a version that corresponds to the extension version in the CloudFormation
registry. This way, we will have 1:1 alignment and users will have the most freedom.

There are currently 44 public types (resources & modules), but we expect this
list to substantially grow. If this dramatically scales (to thousands of
packages) and we hit any limitations of package managers (e.g. account/scope
limits), we can shard the solution (multiple accounts, multiple scopes, etc).

#### Naming Scheme

> *This is still not finalized. From a CDK user standpoint, I am not sure if they should really
> care if these are CloudFormation registry extensions or just normal CDK libraries. Consider a user
> that goes to Construct Hub and searches for "mongodb". They find this library, import it and use it.
> As far as they are concerned, they just used a construct library. The fact that this is an L1 type
> and not some L2/L3 is an implementation details, isn't it. So I am not sure that the semantics which
> involves "CloudFormation" or "extensions" or "types" is not a leak in the abstraction*.

We will use the following naming scheme:

* **npm**: 
  * Package name: `@cdk-cloudformation-types/<name-kebab-case>` (e.g. `cdk-cloudformation-types/mongodb-atlas-project`)
* **Maven Central**:
  * Group ID: `io.github.cdklabs.cdk_cloudformation_types`
  * Artifact ID: `<name-kebab-case>` (e.g. `mongodb-atlas-project`)
  * Java Package: `io.github.cdklabs.cdk_cloudformation_types.<name_snake_case>` (e.g. `io.github.cdklabs.cdk_cloudformation.mongodb_atlas_project`)
* **PyPI**:
  * Distribution name: `cdk-cloudformation-types-<name-kebab-case>` (e.g. `cdk-cloudformation-types-mongodb-atlas-project`)
  * Module: `cdk_cloudformation_types_<name_snake_case>` (e.g. `cdk_cloudformation_types_mongodb_atlas_project`)
* **NuGet**:
  * Package ID: `Cdklabs.CdkCloudFormationTypes.<NamePascalCase>` (e.g. `Cdklabs.CdkCloudFormationTypes.MongodbAtlasProject`)
  * .NET Namespace: `Cdklabs.CdkCloudFormationTypes.<NamePascalCase>` (e.g. `Cdklabs.CdkCloudFormationTypes.MongodbAtlasProject`)

Alternatives:
* `@cdk-types/mongodb-atlas-project`
* `@cdk-cfn/mongodb-atlas-project`
* `@cdkcfn/mongodb-atlas-project`
* `@awscdk/mongodb-atlas-project`
* `@cfn/mongodb-atlas-project`
* `@cfn/cdk-mongodb-atlas-project`
* `@cloudformation/cdk-mongodb-atlas-project`
* `@cfntypes/mongodb-atlas-project`
* `@cloudformation-registry/mongodb-atlas-project`
* `@cfn-registry/cdk-mongodb-atlas-project`
* `@cfn-types/cdk-mongodb-atlas-project`



#### Versioning

To allow users to select which extension schema version to use, the version of
each package will be based on the schema version of the extension.

We will prefer to use the full schema version (MAJOR.MINOR.PATCH), but if we
will need to publish a security patch, we should be able to bump the PATCH
number as needed.

#### Code Generator

The code generator will be executed daily (e.g. through a GitHub workflow),
query the CloudFormation Registry, and generate L1s for all the types based
on their metadata and schema.

The code generator is implemented as a separate tool called
[`cdk-import`](https://github.com/cdklabs/cdk-import).

We can use the `ListTypes` API to list all the types in the registry (excluding native AWS resources):

```shell
aws cloudformation list-types --visibility=PUBLIC | grep -v "AWS::"
```

And then for each type, we can use `DescribeType` to retrieve the type information and its schema.

For example, this command will return the description of the `AWSQS::EKS::Cluster` resource:

```shell
aws cloudformation describe-type --arn arn:aws:cloudformation:us-east-1::type/resource/408988dff9e863704bcc72e7e13f8d645cee8311/AWSQS-EKS-Cluster
```

For reference: the output of this command can be found [here](https://gist.github.com/eladb/bf417c07444027d6954360295df4ee37#file-awsqs-vpc-vpcqs-module-json).
The parsed `Schema` field can be found [here](https://gist.github.com/eladb/bf417c07444027d6954360295df4ee37#file-awsqs-vpc-vpcqs-module-schema-json).

Now, we need to filter all non-`AWS::` types (the `AWS::` types are actually L1s), and then generate
an L1 construct for each one. This includes:

1. Generating the construct class that extends `CfnResource`. I think we can use submodules to
   represent the type namespace (`awsqs.eks` in this case), and the name of the resource as the construct name `Cluster`.
2. Generate an `XxxProps` JSII struct for this construct based on the `Schema` field.
   This can be done using [`json2jsii`](https://github.com/cdklabs/json2jsii), which is the same
   tool we use to implemented the `import` command in CDK8s and CDKtf.

### Is this a breaking change?

Nope.

### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

### What alternative solutions did you consider?


#### `cdk import` versus library

As mentioned above, an alternative approach would be to add support for `import`
in the CDK CLI, which is inline with how other CDKs implement this functionality
(`import` in CDK8s and `get` in CDKtf). The `import` experience offers a "just
in time" option that the pre-published library option does not, but also
increases the cognitive load for users since they will need to understand how
`import` works.

The downsides of the `import` approach (at this point) are that (a) it is a
bigger investment as it involves a change to the CDK CLI; and (b) the Construct
Hub won't be able to surface these types automatically (we will need some custom
support for "imported" types, which is something that we would like to add to
the Construct Hub in the future for all CDK domains).

To make sure this path is possible in the future, the code generator will be
implemented as a separate tool called `cdk-import`, which we can later integrate
into the CDK CLI.

#### Monolithic versus module per resource

As mentioned above, due to the fact that resource schemas are versioned and we want to allow users to select which
version of the resource they use, we determined that the best approach is to publish a generated module for each resource.

### What is the high level implementation plan?

* [ ] Implement [`cdk-import`](https://github.com/cdklabs/cdk-import) as a command-line tool that generates L1 constructs for registry extensions.
* [ ] Create a mono-repo-style project using projen that utilizes `cdk-import` to generate a module for each registry resource.
* [ ] Created a scheduled job which generates the modules periodically (should probably run against `us-east-1`)

### Are there any open issues that need to be addressed later?

* ~__Property name conversion__~ (resolved by [cdklabs/json2jsii#480](https://github.com/cdklabs/json2jsii/pull/480)): `json2jsii` converts field names to camelCase to adhere with naming typescript naming conventions.
  This means that we need to map field names back when we define the `CfnResource`. I think we might want to add a
  feature to `json2jsii` that will generate conversion functions that can be used to convert back data types to the original schema.
