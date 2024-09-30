# Support for importing existing resources into a CDK stack

* **Original Author(s):**: @tomas-mazak
* **Tracking Issue**: #52
* **API Bar Raiser**: @rix0rrr

Allow users to import resources, that were created manually or by different
means, into CDK stacks.

## Working Backwards - README

```
cdk import [STACK]

Import existing resource(s) into the given STACK

Options:
[... standard CDK CLI and CDK CLI `deploy` options ...]
  -o, --create-resource-mapping  If specified, CDK will generate a mapping of
                                 existing physical resources to CDK constructs to
                                 be imported as. The mapping will be written in
                                 the given file path. No actual import operation
                                 will be performed                      [string]
  -m, --resource-mapping         If specified, CDK will use the given file to
                                 map physical resources to CDK resources for
                                 import, instead of interactively asking the
                                 user. Can be run from scripts          [string]
  -f, --force                    Allow importing resources with properties
                                 different from the CDK construct configuration.
                                 This will most likely lead to a stack drift.
      --non-interactive          Suppress all interactive prompts. All
                                 confirmation prompts assume yes, all resources
                                 that can't be identified will be skipped from
                                 import. (default: false if stdin is a TTY, true
                                 otherwise)
```

Sometimes, it is useful to be able to import (enroll/adopt/...) AWS resources,
that were created by different means (manually in AWS console, using different
orchestrator, etc), into a CDK stack. Some resources can simply be deleted and
recreated by CDK, but for others, this is not convenient: Typically stateful
resources like S3 Buckets, DynamoDB tables etc, cannot be easily deleted without
an impact on the service.

To import an existing resource into a CDK stack:

- Add corresponding constructs for the resources to be added in your stack - for
  example, for an S3 bucket, add something like
  `new s3.Bucket(this, 'ImportedS3Bucket', {});` - **no other changes must be
  done to the stack before the import is completed**.
- Run `cdk import` command - if there are multiple stacks in the CDK app, pass a
  specific stack name as an argument.
- If the resource definition contains all information needed for the import,
  this happens automatically (e.g. an `s3.Bucket` construct has an explicit
  `bucketName` set), otherwise, CDK will display an interactive prompt to
  provide neccessary identification information (e.g. the bucket name).
- After `cdk import` reports success, the resource is managed by CDK. Any
  subsequent changes to the construct configuration will be reflected on the
  resource.

### How CDK identifies the physical resources to be imported

CDK will first find the resources that are being added to the stack, by
comparing the template with the currently deployed version. For each resource
that is being added, CDK will try to identify corresponding existing physical
resource.

First, CDK always checks if the construct (resource) properties provide
sufficient information to identify the resource (e.g. if there is an explicit
`bucketName` set for an s3.Bucket construct). In this case, the resource will
automatically be identified.

If the resource cannot be identified by construct properties, CDK behaviour
depends on whether the import operation runs in an _interactive_ or a
_non-interactive_ mode. Interactive mode is the default if CDK cli is run from
an interactive terminal, while non-interactive is the default for script
execution.

In an interactive mode, the user is prompted on command line to provide the
required identifiers (e.g. S3 bucket name) of each newly added resource that
couldn't be automatically identified in previous step. User can either fill in
the prompt or leave it empty to skip the particular resource import.

In a non-interactive mode, user can optionally pass a _resource mapping_
structure (as a JSON file) on command line using `--resource-mapping` argument.
It maps the contruct tree path (in forward slash separated format) to the
required resource identifier, for example:

```json
{
  "MyApplicationStack/MyBucket/Resource": {
    "BucketName": "foo-application-static"
  },
  "MyApplicationStack/Vpc": {
    "VpcId": "vpc-123456"
  }
}
```

The resource mapping file can either be constructed manually or `cdk import`
can be called with `--create-resource-mapping` to create the file using an
interactive prompt. This allows two step workflow:

1. User runs CDK CLI in interactive mode to create the mapping file to be
   modified, peer-reviewed or checked in the version control
2. CDK is run non-interactively to apply the changes (perform the import),
   possibly by a CI/CD toolchain

Resources that weren't identified automatically or by provided resource mapping
will be omitted from import (skipped).

CDK import logic considers a resource _identified_ as long as it has a non-empty
value for all required identification properties. For CloudFormation import
operation to succeed, the resource with such properties must both exist and must
not belong to another CloudFormation stack. CDK will not perform any validation
of the provided values - it will pass them to CloudFormation and in case of an
error, propagates it back to the user.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @rix0rrr
```

## Public FAQ

### What are we launching today?

New CDK CLI sub-command `cdk import` that works just like `cdk deploy` but for
newly added constructs in the stack, instead of creating new AWS resources, it
attempts to import corresponding existing resources.

### Why should I use this feature?

When an already existing AWS resource needs to be brought under CDK management
the most convenient way of achieving this is using this feature (`cdk import`).

There are serveral use cases for importing resources into CDK stacks:

- **IaC adoption:** Resources were created manually using AWS Console / CLI
  originally. As the project got more complex, the team opts for
  infrastructure-as-code approach using CDK. To be able to organize the existing
  resources in CDK stacks without recreation, the import feature is needed.
- **CDK migration:** The team uses an infrastructure-as-code tool such as
  Terraform, Pulumi or plain CloudFormation and chooses to migrate onto CDK. To
  perform a smooth migration without resources recreation, it is important to:
  1. make the original IaC orchestrator "abandon" the resource - remove it
     from its orchestration without physically removing the resource
  2. "import" the resource in a CDK stack
- **App refactoring:** The team already uses CDK but a major refactor is needed
  and the resources need to be reorganized between stacks. Same two steps are
  required: The resources first need to be abandoned by their original stacks
  (by removing corresponding constructs from the stack definition with removal
  policy of "RETAIN"). Then, the resources are imported in their destination
  stack using `cdk import`.

## Internal FAQ

### Why are we doing this?

This solution is exposing an existing [CloudFormation resource
import](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import.html)
feature in a CDK native way. CDK's goal is to provide convenient abstraction
over sometimes complex CloudFormation aspects and this new feature is aligned
with this goal. Additionally, other IaC orchestrators' also provide a
corresponding feature, for example:

* [terraform import](https://www.terraform.io/cli/import)
* [pulumi import](https://www.pulumi.com/docs/guides/adopting/import/#pulumi-import-command)

### Why should we _not_ do this?

The feature might be considered independent enough to provide a separate tool
for it (e.g. `cdk-import` node package).

### What is the technical solution (design) of this feature?

* [Proof-of-Concept PR](https://github.com/aws/aws-cdk/pull/17666)

The solution leverages CloudFormation resource import API. The API is very
similar to the regular deploy API, consisting of ChangeSet creation and
ChangeSet execution actions.

* ChangeSet of type `IMPORT` is created (for deploy it is `CREATE` or
  `UPDATE`)
* on ChangeSet creation, an additional structure has to be passed with the
  action, an array of [ResourceToImport](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_ResourceToImport.html)
  structures to instruct CloudFormation what actual existing resources to
  import as corresponding logical resources in the template
* ChangeSet is executed as on regular deployment

The solution is leveraging existing wrappers around ChangeSet creation and
execution in `aws-cdk` codebase, extending them with the options required for
importing.

Following characteristics/limitations of the API pose a challenge to the
solution:

#### Inconsistent resource identifiers between resource types

In the ResourceToImport structure, each type of resource is identified by a set
of resource properties (typically of length 1 - by a single property). The
property name is different between different resource types (e.g. `BucketName`
for S3 buckets, or `VpcId` for VPCs).

To be able to put the structure together, the import logic must be able to
identify the required properties and then look up the values. For some
resources, this can be automatically looked up from the CDK construct
configuration (e.g. an S3 bucket having specific `bucketName` configured) but
for some resources, the code has to rely on user input.

To address this, the solution is divided into two steps:

##### Physical resource identification

First, identify what properties must be looked up/asked for for each resource to
be imported. This information can be obtained by executing CloudFormation API
action `GetTemplateSummary` with the new template. The action returns the
property names used as "import identifiers" for each resource type used in the
template.

For each new resource (one that isn't present in the currently deployed
template), look up the values for the "import identifiers". First, look up the
resource (CDK construct) configuration. If not explicitly defined, interactively
prompt user to provide the value.

Based on command line flags, the compiled "resource mapping" structure is either
passed on to the next phase, or written to the specified file.

##### Import execution

Based on command line flags, this phase either reads "resource mapping" from the
specified file, or it will be passed the resource mapping directly from the
previous phase.

First, the sanity checks are performed (check that there are no
delete/update-type changes in the template, see below) and then the change set
is created. By default, the change set is also executed (can be changed by
passing `--no-execute` flag just like with regular deploy).

#### Cannot import and create/change resources in the same changeset

CloudFormation API doesn't allow any non-import changes in the template for
import operation. This is a challenge for CDK, as:

* `CDKMetadata` resource changes on each synthesis, so the import operation
  never succeeds with the unmodified template. To resolve this, this solution
  doesn't pass the newly synthesized template to the import operation - instead,
  the currently deployed template is fetched and only the resources to be imported
  are added to it (copied over from the new template), producing an interim
  _import template_.
* High-level constructs produce multiple underlying CloudFormation resources
  and only some of those might need to be imported - the rest might need to
  be created (e.g. `ec2.Vpc()` might require VPC being imported, but subnets
  being created). Furthermore, CDK can't automatically determine what
  resources to import and what to create. For this to behave correctly, the
  solution will prompt user for each resource - whether it should be imported
  or not. If not, the resource is omitted (not added to the import template).
  The remaining (not imported) resources can be created by a subsequent
  `cdk deploy` command.

#### An explicit DeletionPolicy must be set on imported resources

CloudFormation import API requires all imported resources to have specified
explicit DeletionPolicy. CDK satisfies this requirement for typical stateful
resources (e.g. S3 buckets), but not _all_ resources (e.g. VPCs). The solution
will inject a `DeletionPolicy` with a value of `Delete` (CloudFormation's
default) in the import template for all resources without `DeletionPolicy` set
by CDK.

This manipulation will only happen during the import operation and therefore it
is not persistent. On the next deploy, the property is dropped. However, as
`Delete` is the default value, semantically the template doesn't change.
According to the testing, CloudFormation will allow dropping the explicit policy
post-import.

#### CloudFormation doesn't check the physical resource's configuration

If a physical resource identified by the provided identifiers does not exist,
the import operation (change set creation) will fail with clear-enough message.
However, if the resource does exist, but it's actual configuration doesn't match
the CloudFormation configuration, import operation succeeds and *not update*
the resource, causing the stack to be drifted. This can be left to the user
to handle (manually checking the config prior to the import or running drift
detection after the import), but for convenience, this solution uses
CloudControl API to look up the physical resource and validate its configuration
against the CDK (CloudFormation) desired configuration. Unless `--force` option
is specified on command line, import will fail on any inconsistency found.

### Is this a breaking change?

No.

### What alternative solutions did you consider?

Since there is no other way of getting existing resources under CloudFormation
management without replacement, but the CloudFormation resource import API,
alternative approaches are pretty much limitted to:

* not providing the feature at all as it is already possible to use CDK only to
  synthesize the CloudFormation template and then use CloudFormation Console/CLI
  to perform the import (some manual template updates are needed though) and
* providing this feature outside of main CDK CLI - e.g. as a separate Node.JS
  package.

### What are the drawbacks of this solution?

This solution is only a CDK layer on top of CloudFormation resource import
feature and so it introduces the import feature's inherent issues in CDK, like:

* CloudFormation doesn't check if the configuration of the physical resource
  being imported matches the CloudFormation configuration of the corresponding
  logical resource. Such import succeeds and leads to a drifted stack (to some
  extent, the solution does validations on CDK level to minimise the risk).
* Multiple resources can be imported in one IMPORT change set, but no other
  changes are allowed - resources cannot be created or modified. This is
  tricky to achieve with CDK's higher level constructs that produce multiple
  CFN resources of which only some might need to be imported. The solution
  will remove all new resources that are not to be imported from the template,
  so the import operation can succeed, however, the deployed stack will not
  be up to date with the CDK configuration after the import operation, another
  `deploy` is needed.

### What is the high-level project plan?

The RFC will be implemented in following stages:

#### 1. Interactive import

Basic wrapper around the CloudFormation Import API, `cdk import` CLI command
with only basic options. Interactive prompts for resource identification. Use
of the default credentials (same as `cdk deploy`) for all API calls. A simple
[PoC Draft PR](https://github.com/aws/aws-cdk/pull/17666) was created in the
main `aws-cdk` repository that implements this stage.

#### 2. Non-interactive import

Extend the CLI interface to allow passing "resource mapping" hints on command
line, instead of the interactive prompts. Secondly, provide a helper to
create the "resource mapping" file based on user input (interactive). This
stage allows splitting the import workflow into prepare and execute phases,
possibly using CI/CD

#### 3. Using the lookup role

Run read-only operations using the lookup role from CDK Toolkit stack instead
of the default credentials.

#### 4. Leverage Cloud Control API to improve user experience

By using Cloud Control API, the CLI interface can be relatively easily extended
to provide much better user experience, see
[possible future expansions](#possible-future-expansions) section.

### Are there any open issues that need to be addressed later?

Not known at the time of writing

## Appendix

### Possible future expansions

This proposal prioritizes implementation simplicity over user comfort
(deliberately). For example, if a user needs to import a VPC, they will be
prompted to type in a VPC ID, a value that is AWS-generated and must be first
retrieved from Console/CLI. It would be much nicer to retrieve the list of VPCs
in the target account and display to the user (including the Name tag) to choose
from.

Moreover, it would be of a great benefit to do pre-import validations in CDK
(Does the physical resource exist? Does it not belong to another CloudFormation
stack? Is the resource configuration consistent with the actual state?).

However, such features would be difficult to implement and might require
resource type-specific logic. Using [Cloud Control API](https://aws.amazon.com/blogs/aws/announcing-aws-cloud-control-api/)
might avoid using service-specific APIs, but some resource type specific code
might still be needed.

It might be considered to release such convenience features iteratively
per resource type, beginning with the most frequently used types.

This proposal also only concerns with a single CDK stack at a time - the PoC
code fails if multilpe stacks are matched. For the app stacks refactoring
use case it would be beneficial to support batch operations (same import flow
on multiple stacks) and a _move operation_ - single command to remove a
resource from one stack and import it into another).

### Links

* [CloudFormation resource import - introductory blog post](https://aws.amazon.com/blogs/aws/new-import-existing-resources-into-a-cloudformation-stack/)
* [CloudFormation resource import API](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import.html)
* [AWS Cloud Control API - introductory blog post](https://aws.amazon.com/blogs/aws/announcing-aws-cloud-control-api/)
