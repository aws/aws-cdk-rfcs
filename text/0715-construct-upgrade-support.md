# CDK Construct Upgrade Support

- **Original Author(s):**: @GavinZZ
- **Tracking Issue**: #715
- **API Bar Raiser**: @iliapolo

A new migration framework in the CDK CLI and construct library that helps developers migrate from
older construct libraries to modern, fully supported alternatives that incorporate the latest
features and best practices.

## Overview and Motivation

As the AWS Cloud Development Kit (CDK) evolves, we continuously deliver new features,
performance optimizations, and reliability improvements. To maintain backward compatibility
while enabling forward progress, the CDK team uses structured versioning strategies for critical updates.

A common pattern involves releasing versioned constructs or modules (e.g., V2 variants)
that coexist with their predecessors. For example:

* The `@aws-cdk/aws-ec2-alpha` alpha module introduces the modernized `VpcV2`, `SubnetV2`, and other
new construct, designed to succeed the original Vpc related constructs in `aws-cdk-lib/aws-ec2`.
* The `TableV2` construct in `aws-cdk-lib/aws-dynamodb` replaces legacy Table implementations
while retaining API compatibility.

These updates unlock enhanced capabilities. Construct upgrade between variants, however, often requires
code changes that could trigger CloudFormation resource replacements (e.g., NAT gateways being
recreated, DynamoDB global tables being recreated). Recreation of resources leads to data loss for
stateful resources, and can lead to loss of availability for others.

To address this, the CDK introduces Migration Support — a combination of guided workflows and
automated safeguards designed to ensure safe adoption of new constructs while preserving existing
infrastructure. This framework enables developers to upgrade seamlessly with minimal risk to
production environments.

## Proposed Solution

The CDK team develops a construct upgrade framework designed to simplify adoption while minimizing
risks. This approach combines guided documentation, automated validations, and deployment safeguards
to ensure a controlled transition.

In a high-level overview, for each supported migration, the construct upgrade framework provides:

- A comprehensive, step-by-step migration guide enabling users to transition from legacy constructs/modules
to their modern equivalents.
- A new CDK CLI command `cdk construct-upgrade --unstable=construct-upgrade` to validate code changes and
execute deployments safely.

Note that each migration guide follows a standardized structure that includes dependency changes, behavioral
analysis, risk assessments, and rollback instructions. This ensures consistency, clarity, and safety across
all migrations. See [Appendix A](#appendix-a-migration-guide) for a detailed breakdown of the proposed migration
guide format.

With the initial release of the CDK construct upgrade tool, developers would use the migration guide to
update their CDK code, replacing legacy constructs (e.g., Table) with modern equivalents (e.g., TableV2).

After updating the code to use the new construct, users would use the CDK CLI command `cdk construct-upgrade --unstable=construct-upgrade`
to validates the existing CDK stack and environment, ensuring they are ready for migration. The tool flags any
warnings or blockers, such as CloudFormation drift, and cross-compares the old and new CloudFormation templates.
It analyzes the CloudFormation change set and validates any library-specific configurations. See
[Construct Upgrade Validations](#construct-upgrade-validations) for a detailed breakdown of the validations.

Users choose to run the `cdk construct-upgrade --unstable=construct-upgrade` CLI command with the `--dry-run` option to perform validation
described to produce the result into stdout. If the `--dry-run` option is not specified, the CLI command will
perform validation and proceed with CloudFormation deployment if the validations are successful.

Alternatively, users can use `cdk deploy --unstable=construct-upgrade` option to validate their construct upgrade
changes before deployment.

```sh
# This will validate and deploy the construct upgrade changes
cdk construct-upgrade [stack] --unstable=construct-upgrade --target aws-cdk-lib.aws-dynamodb.TableV2

# Alternatively, this can be separated into multi-step process
cdk construct-upgrade [stack] --unstable=construct-upgrade --target aws-cdk-lib.aws-dynamodb.TableV2 --dry-run
cdk deploy --unstable=construct-upgrade --target aws-cdk-lib.aws-dynamodb.TableV2
```

In the initial release of the CDK construct upgrade tool, the CLI supports migration of constructs across modules,
with generic validation logic applicable to all supported constructs. However, VPC-related constructs from
`aws-cdk-lib/aws-ec2` to `@aws-cdk/aws-ec2-alpha` and `Table` to `TableV2` in `aws-cdk-lib/aws-dynamodb` come
with enhanced construct-specific validations and comprehensive migration guides provided by the CDK team to
ensure safe deployment. Additionally, the tool is designed to be open and pluggable, allowing users to support other
construct migrations by incorporating their own custom validations. This flexibility enables users to extend
the tool to cover additional constructs that may not yet be officially supported with construct-specific validations.

### Construct Upgrade Strategies

Depending on the construct or module being migrated, the deployment step differs. The framework automatically
selects one of two migration strategies based on the resources being migrated:

1. In-place Migration - This strategy is suitable for constructs where the changes do not involve resource
removal or introduction of new underlying resource types (e.g., constructs that are compatible with
CloudFormation's stack refactoring).

Users are expected to refactor their current CDK stack to use V2 constructs, ensuring that the resource
configuration matches by following the migration guide. Users must then specify a `refactor.json` file, which
is needed for the CloudFormation stack refactoring feature to map logical ID changes from the old construct to
the new one. This file helps ensure that CloudFormation can track the logical resource IDs during the
migration process, avoiding issues with resource recreation.

> Note that CDK team is working on a [cdk refactor feature](https://github.com/aws/aws-cdk-rfcs/pull/705)
> to support CloudFormation Stack refactoring with CDK CLI. Once implemented, we will onboard to use CDK
> refactor feature instead and users do not need to manually create the `refactor.json` file and will be
> inferred based on the construct tree and paths.

Next users can run the new CLI command `cdk construct-upgrade --unstable=construct-upgrade` to proceeds with validations. If validations
are successful, this CLI command continues to execute and deploy the CDK stack using CloudFormation stack refactor
command (or CDK refactor command if available). It triggers the stack refactoring operation, which
helps to retain the existing resources and applies the necessary updates to the infrastructure.

2. Retain-Remove-Import Migration - This approach is used when the underlying resource has significant changes,
such as transitioning from a custom resource to a native L1 resource, as seen in the migration from `Table` to
`TableV2`. For this type of migration, users need to ensure that `RemovalPolicy.RETAIN` is set on the V1 construct
in the stack to prevent the deletion of the resource during the migration. The `RemovalPolicy.RETAIN` ensures that
the existing resource is retained by CloudFormation, avoiding accidental deletion when the CDK stack is updated.

If the retain policy is not already set, users must first deploy the retain policy change to ensure that
CloudFormation will retain the resource during the migration process. It's a good practice to keep the stateful
resources retained by default. Once this step is completed, users can continue to follow the migration guide and modify
their CDK stack code to remove the old construct and replace it with the new one (e.g., replacing the legacy
`Table` with the new `TableV2` construct).

Once the code migration is complete, user can run the CLI command `cdk construct-upgrade --unstable=construct-upgrade` which will do the
validations. If validations are successful, this new CLI command will trigger `cdk deploy --import-existing-resources`
implicitly. The `--import-existing-resources` flag is used to leverage the CDK import feature, which allows
users to import existing resources back into the CDK stack. This ensures that any orphaned resources
(e.g., existing DynamoDB tables and replicas) are correctly linked to the new construct definition, preserving
their state and data while updating the infrastructure to use the modernized construct.

This strategy is necessary for cases where resources like `Table` have undergone significant changes in their
underlying architecture, such as moving from a custom resource implementation to a native L1 implementation.
These changes cannot be safely handled through in-place migration because they involve a change in resource
types and properties, potentially leading to resource deletion and recreation, which would disrupt production
environments. The Retain-Remove-Import strategy ensures that the existing resource is retained and its state
is preserved while enabling the migration to the new construct with minimal risk.

### Construct Upgrade Validations

Validations will ensure that user’s existing CDK stack and environment area ready for migration, flagging
blockers like CloudFormation drift. Additionally, validate that the migrated code is safe to deploy without
causing downtime or replacement through CloudFromation template comparison and change set analysis. Here is a
complete list of validations that CDK performs:

#### Drift Detection

One of the validation workflow is to trigger CloudFormation drift detection for the CDK stacks. This feature
is generic and can be applied to all CDK users. It will be an added functionality in the `cdk diff` command
through the option `cdk diff --detect-drift`. The command will return the drift detection results in a format
similar to the current `cdk diff` output.

> Note that this command will not fail if drift is detected. This is intentional, as `cdk diff` is meant to
> provide information about changes and is designed to be status-agnostic.

The new `cdk construct-upgrade` CLI command will implicitly call the `cdk diff --detect-drift` command as part of
its validation process. This ensures that any drift in the CloudFormation stacks is detected and reported,
preventing issues that might arise during the construct upgrade workflow.

> Note that drifts can exist in a stack for unrelated resources (while not recommended), we will provide a
> way for users to skip the drift detection change on unrelated resources through the use of `--ignore-unrelated`
> flag in `cdk construct-upgrade --unstable=construct-upgrade` CLI command, see [CLI Settings](#settings)

#### CloudFormation Change Set Analysis

Another validation is to validate CloudFormation change set diff. The `cdk diff` command implicitly calls
CloudFormation change set creation, providing high-level details such as "add", "delete", "modify", "import",
and etc. like the following:

```md
[-] AWS::DynamoDB::Table MyTable orphan
[+] AWS::DynamoDB::GlobalTable MyTable
```

To build on this, we are introducing a new `--json` flag to the `cdk diff` command like `cdk diff --json` which
will return the full JSON changes in the change set diff.

```json
[
  {
    "Type": "Resource",
    "ResourceChange": {
      "Action": "Add", // "Modify" | "Remove" | "Import"
      "LogicalResourceId": "someLogicalId",
      "PhysicalResourceId": "somePhysicalId",
      "ResourceType": "AWS::Module::Resource",
      "Replacement": "True", // "False" | "Conditional",
      "Scope": ["Properties"],
      "BeforeContext": "{\"someJSON\": 1010}",
      "AfterContext": "{\"hindsight\": 2020}"
    }
  },
  ......
]
```

The new `cdk construct-upgrade --unstable=construct-upgrade --target [target]` CLI command will implicitly
invoke `cdk diff --json` to retrieve a detailed CloudFormation change set in JSON format. To avoid being
overly restrictive, the validation will primarily focus on the main resources change. The main resources
can be determined based on the `--target` option. See [CLI Settings](#settings).

The details of this validation differs for each migration strategy but regardless of the migration strategy, this
validation step is necessary.

For `In-Place Migration` strategy, `construct-upgrade` CLI command will retrieve the JSON format change set, ensure
no unintended modifications are present and validate that each `Remove` action on main resources has a corresponding
`Add` of the same resource type. Additionally validate that the `beforeContext` and `afterContext` values for each
`Remove` and `Add` pair are identical, as CloudFormation stack refactors prohibit configuration changes.

For the `Retain-Remove-Import Migration` strategy, we will introduce an additional option `--import` in the
`cdk diff` command like `cdk diff --json --import` which will create a change set on the existing stack with
`import` change set type. An example is as follows:

```json
{
  "type": "Resource",
  "resourceChange": {
    "action": "Import", // NOTE THAT THIS SHOWS "IMPORT"
    "logicalResourceId": "MyTable794EDED1",
    "physicalResourceId": "DemoStack-MyTable794EDED1-11W4MR8VZ0UPE",
    "resourceType": "AWS::DynamoDB::GlobalTable",
    "replacement": "True",
    "scope": [],
    "details": [],
    "afterContext": "..."
  }
},
{
  "type": "Resource",
  "resourceChange": {
    "policyAction": "Delete",
    "action": "Remove",
    "logicalResourceId": "MyTable794EDED1",
    "physicalResourceId": "DemoStack-MyTable794EDED1-11W4MR8VZ0UPE",
    "resourceType": "AWS::DynamoDB::Table",
    "scope": [],
    "details": [],
    "beforeContext": "..."
  }
},
```

The `construct-upgrade` CLI command will implicitly call `cdk diff --json --import` which will create an `IMPORT`
change set as above and it will validate if the main resources' action is `Import` instead of `Add`. Note that
auxiliary resources—such as IAM roles, policies, or custom resources may be added or removed as part of
construct upgrade, and will not be strictly validated.

#### [In-Place Migration Only] CloudFormation stack refactoring Validation

For in-place migrations, the construct-upgrade CLI command ensures the correctness of logical ID mappings
defined in `refactor.json` by validating against the deployed V1 template and synthesized V2 template.

```json
[
    {
        "Source": {
            "StackName": "<stack-name>",
            "LogicalResourceId": "vpcv1A85508D7"
        },
        "Destination": {
            "StackName": "<stack-name>",
            "LogicalResourceId": "vpcA2121C38"
        }
    },
    {
        "Source": {
            "StackName": "<stack-name>",
            "LogicalResourceId": "vpcv1ipv6cidr87175A16"
        },
        "Destination": {
            "StackName": "<stack-name>",
            "LogicalResourceId": "vpcamazonProvided373FDA5C"
        }
    },
    ......
]

The validation begins by verifying that every source LogicalId in `refactor.json` corresponds to a resource
in the deployed V1 template, while every target LogicalId maps to a resource in the synthesized V2 template.

Orphaned entries — such as unmapped logical IDs or resources missing from either template — will block the upgrade.
Resource types must also align: for example, a resource in V1 template of type `AWS::EC2::VPC` can only map to
a resource in V2 template of a compatible type (e.g., `AWS::EC2::VPCV2`).

This validation is specific to the context of construct upgrade framework and will be implemented as part of
`cdk construct-upgrade` CLI command.

> Note that CDK team is working on a [cdk refactor feature](https://github.com/aws/aws-cdk-rfcs/pull/705)
> to support CloudFormation Stack refactoring with CDK CLI. Once implemented, we will onboard to use CDK
> refactor feature instead and users do not need to manually create the `refactor.json` file and will be
> inferred based on the construct tree and paths. This step is still needed to validate the inferred
> refactor.json file by CDK.

#### [Retain-Remove-Import Migration Only] Retain Policy Validation

For Retain-Remove-Import migrations, it's crucial to ensure that the `RemovalPolicy.RETAIN` deletion policy
is applied correctly to the migrated resources in the stack, especially for resources like DynamoDB tables.
The process will block the migration if the `RETAIN` deletion policy is missing and ask users to deploy their
V1 stack by setting `RETAIN` for deletion policy.

In the future update, we aim to improve this process by making this a streamlined process in the framework.
During `cdk construct-upgrade` CLI command, if we detect that the retain policy is not enabled, we can
do the following:

Prompt the user with a message like:

```sh
Detected AWS::DynamoDB::Table with logical ID 'MyTable' does not have RETAIN set as the deletion policy.
CDK will deploy your stack with the deletion policy set to RETAIN on 'MyTable'.

Would you like to proceed (y/n)?
```

If the user confirms by selecting "y", the migration will proceed to retrieve the deployed CloudFormation
stack template, modify the `MyTable` resource in the template by setting `DeletionPolicy: Retain` and deploy
the stack template. Once the deployment is successful, it will proceed with the usual flow to continue
with validations as well as execution and deployment.

#### Custom validations

Custom validations ensure that the construct upgrade process adheres to best practices with custom
configurations. For example, when migrating `Table` to `TableV2` for DynamoDB, the CDK team provides
validations to ensure that custom resource deletions do not affect replica tables, that `TableName` and
`SkipReplicaDeletion` properties are correctly set, and that `DeletionProtection` is enabled for safety.

These CDk-provided validations are part of the `cdk construct-upgrade` CLI command and will be triggered
based on the target migrated module.

To enhance flexibility, the framework will also allow users to implement their own custom validations.
Users can specify a file or code to containing custom validation logic. This capability allows users
to define validation rules for constructs that are not yet officially supported by the CDK, making
the tool more adaptable and extensible.

> The implementation detail of custom validation is not determined. Some potential solutions for custom
> validations are as follows:
>
> 1. we can introduce of the `cdk construct-ugprade --custom-validations <file>` can be either a custom
> third party file to be supplied to CDK to enable the custom validation
> 2. Introduce new feature in a similar way to the current Aspect feature like the following
> `Validators.of(myConstruct).add(new SomeValidations(...));`. We can have predefined custom validation
> logics to check the `DeletionPolicy` and `TableName` and etc. Users can build their own custom
> validation classes and this can be generic feature applied to `cdk diff`, `cdk synth` commands.

### Visual Workflow

```
┌───────────────────────────────────────────────────────────┐
|               Manual Workflow from Users                  |
|                                                           |
|                ┌─────────────────────┐                    |
|                │  Follow Migration   │                    |
|                │        Guide        │                    |
|                └─────────────────────┘                    |
|                           │                               |
|            ┌──────────────┴──────────────┐                |
|            ▼                             ▼                |
| ┌─────────────────────┐       ┌─────────────────────┐     |
| │   Human refactor    │       │Other refactor method│     |
| │                     │       │      like LLM       │     |
| └─────────────────────┘       └─────────────────────┘     |
|            │                             │                |
|            └──────────────┬──────────────┘                |
|                           |                               |
└───────────────────────────|───────────────────────────────┘
                            |
┌───────────────────────────|───────────────────────────────┐
|                Automated Workflow by CDK CLI              | 
|                           |                               |
|                           ▼                               |
|                ┌─────────────────────┐                    |
|                │ Validate CFN drift  │                    |
|                │                     │                    |
|                └─────────────────────┘                    |
|                           |                               |
|                           ▼                               |
|                ┌─────────────────────┐                    |
|                │   CFN Change set    |                    |
|                |       analysis      │                    |
|                └─────────────────────┘                    |               
|                           |                               |
|                           ▼                               |
|                ┌─────────────────────┐                    |
|                │ Custom Validations  |                    |
|                |                     │                    |
|                └─────────────────────┘                    │
|                           │                               |
|           ┌───────────────┴───────────────┐               |
|           ▼                               ▼               |
|┌───────────────────────┐         ┌───────────────────────┐|   
|│  Stack Refactoring    |         | Retain-Remove-Import  ||   
||       Strategy        |         │        Strategy       ||   
|| ┌───────────────────┐ |         | ┌──────────────────┐  ||                                 
|| │ CFN stack refactor| |         | │  Retain Policy   |  ||
|| |    validation     | |         | |    validation    |  ||                                   
|| └───────────────────┘ |         | └──────────────────┘  ||
||           │           |         |            │          ||    
||           ▼           |         |            ▼          ||    
|| ┌───────────────────┐ |         |┌─────────────────────┐||                                 
|| │ Execute Stack     | |         |│     Execute         |||  
|| |    refactoring    | |         || Retain-Remove-Import||| 
|| └───────────────────┘ |         |└─────────────────────┘|| 
|└───────────────────────┘         └───────────────────────┘|
|           │                               │               | 
|           └───────────────────────────────┘               |
|                          |                                |
|                          ▼                                |
|               ┌─────────────────────┐                     |
|               │        Done         │                     |
|               │                     │                     |
|               └─────────────────────┘                     |
└───────────────────────────────────────────────────────────┘
```

### Examples

Suppose your CDK application has a single stack, called `MyStack`, containing a
DynamoDB `Table` construct with replica. Now you want to migrate to use existing
stack to use the latest construct `TableV2` which offers more advanced features
to define table replica configurations.

```ts
const table = new dynamodb.Table(this, 'MyTable', {
  partitionKey: {
    name: 'PK',
    type: AttributeType.STRING,
  },
  tableName: 'MyTable',
  replicationRegions: ['us-west-2']
});
```

CDK provides a DynamoDB table migration guide that guides users on the code migration
processes. Assuming users follow the migration guide correctly and update their CDK code
to use `TableV2` construct.

In case of DynamoDB Table migration, the new CDK code would become:

```ts
const table = new TableV2(this, 'MyTable', {
  partitionKey: {
    name: 'PK',
    type: AttributeType.STRING,
  },
  tableName: 'MyTable',
  deletionProtection: true,
  replicas: [
    {
      region: 'us-west-2',
    }
  ]
});
```

> Note that directly deploying the above CDK would cause CloudFormation
> to delete your existing table and create a new one, due to differences in logical IDs
> and resource types.

The next step is to run the CDK CLI command `cdk construct-upgrade`. This command
will trigger the validation process to make sure the changes are valid and safe to deploy.
This migration will use the `Retain-Remove-Import` migration strategy because the underlying
resource type has changed from `AWS::DynamoDBB::Table` to `AWS::DynamoDB::GlobalTable`.

```sh
cdk construct-upgrade --unstable=construct-upgrade --target aws-cdk-lib.aws-dynamodb.TableV2
```

CDK will run validations on current stack status, compare the current and new CFN
template files, analyze dependency changes, analyze CloudFormation change set, validate retain
policies (if applies), validate stack refactor JSON file (if applies), and etc.

```sh
Resources

[-] AWS::DynamoDB::Table MyTable orphan
[+] AWS::DynamoDB::GlobalTable MyTable import
[-] AWS::IAM::ManagedPolicy destroy
[-] Custom::DynamoDBReplica destroy
[-] AWS::CloudFormation::NestedStack destroy

Construct Upgrade Validation
  Status: SUCCESS
  Subreports:
    DriftDetectionSubreport: PASS
    ResourceMappingSubreport: PASS
    ChangeSetSubreport: PASS
    StackRefactoringSubreport: PASS
    DeletionPolicySubreport: PASS

Do you wish deploy these changes (y/n)?
```

Once the `Status` from the validation output status is `SUCCESS`, this implies that CDK has
validated the code changes that no stateful resource replacement or service downtime would
happen and is ready to proceed to the actual deployment step. If you answer yes, the CLI will
show the progress as the deployment is executed:

```sh
Updating stack...

2:03:17 PM | IMPORT_IN_PROGRESS   | AWS::DynamoDB::GlobalTable          | MyStack/MyGlobalTable35835197E/Resource
2:03:17 PM | IMPORT_COMPLETE      | AWS::DynamoDB::GlobalTable          | MyStack/MyGlobalTable35835197E/Resource
2:03:19 PM | DELETE_IN_PROGRESS   | Custom::DynamoDBReplica             | MyStack/MyTableReplicauswest285A33668/Resource
2:03:19 PM | DELETE_IN_PROGRESS   | AWS::IAM::ManagedPolicy             | MyStack/MyTableManagedPolicyXXXXXXX/Resource
2:03:19 PM | DELETE_IN_PROGRESS   | AWS::CloudFormation::NestedStack    | MyStack/ReplicaProviderNestedStack/Resource
2:03:19 PM | DELETE_IN_PROGRESS   | AWS::DynamoDB::Table                | MyStack/MyTable794EDED1/Resource
2:03:21 PM | DELETE_COMPLETE      | Custom::DynamoDBReplica             | MyStack/MyTableReplicauswest285A33668/Resource
2:03:22 PM | DELETE_COMPLETE      | AWS::IAM::ManagedPolicy             | MyStack/MyTableManagedPolicyXXXXXXX/Resource
2:03:22 PM | DELETE_COMPLETE      | AWS::CloudFormation::NestedStack    | MyStack/ReplicaProviderNestedStack/Resource
2:03:19 PM | DELETE_COMPLETE      | AWS::DynamoDB::Table                | MyStack/MyTable794EDED1/Resource

✅  Stack deployment complete
```

> For CI/CD use cases, you can streamline deployments by using the `--require-approval never`
> option with the CDK CLI to bypass manual approval prompts.

Alternatively, you can validate the construct upgrade changes as part of a deployment, by
running the following command `cdk deploy --unstable=construct-upgrade`. You will be shown the
same table as above.

### Re-bootstrap required

Before using the `cdk construct-upgrade` command or `cdk deploy --unstable=construct-upgrade`
commadn you need to ensure that the necessary permissions are granted to the environment.
Specifically, drift detection permissions are required in the bootstrap stack to perform
the validation correctly. Here is a list of required permissions:

```yaml
- cloudformation:DetectStackDrift
- cloudformation:DetectStackResourceDrift
- cloudformation:DescribeStackDriftDetectionStatus
```

To add these required permissions, run the following command for every target environment:

```sh
cdk bootstrap
```

This step is crucial as it will configure the environment with the correct permissions,
enabling the validation and migration process to proceed smoothly.

### CI/CD Integration

Enterprise developers often lack production AWS credentials, making pre-deployment
validations (e.g., drift detection, change set analysis) impossible in production environments.

At development time, here is how it works for common enterprise scenarios. Developers have upgrade
their CDK stack code to use new construct. They can use `dry-run` feature which will allow users to
run the validations on the test/dev account without deploying.

```md
Construct Upgrade Validation
  Status: SUCCESS
  Subreports:
    DriftDetectionSubreport: PASS
    ResourceMappingSubreport: PASS
    ChangeSetSubreport: PASS
    StackRefactoringSubreport: PASS
    DeletionPolicySubreport: PASS
```

Depending on the deployment workflow and environment constraints, there are two common enterprise
patterns:

1. Ops-led Deployment:
The development team upgrades the source code and runs validations in a dev/test environment using
`--dry-run`. The development team zipped up the source code with the validation output to the
operations team. The ops team reviews the validation output, runs the migration in each production
region, and deploys the changes. Once migration is complete, the development team commits and pushes
the updated source code to trigger CI/CD.

Alternatively, the development team upgrades the source code and commits it with CI/CD pipelines
temporarily disabled. The operations team runs the migration in each production region and validates
deployment success. The development team re-enables CI/CD to roll out the changes through the normal
pipeline.

2. CI/CD-driven Deployment:
For teams with access to CI/CD and production environments, developers commit the upgraded CDK stack
code to version control. The CI/CD pipeline runs `cdk construct-upgrade` as part of the deployment
process. Validations are performed automatically before deployment. If any validation fails, the deployment
is blocked. This approach streamlines deployment, reduces coordination overhead, and ensures migration
safety by preventing changes from reaching production unless validations pass.

> However, there are limitations on CDK Pipelines where deployments rely on CloudFormation actions and
> do not directly involve CDK CLI commands like `cdk deploy` or `cdk construct-upgrade`.
>
> In these systems, the CI/CD-driven deployment process would not work as expected without considerable
> configuration changes. In such cases, introducing the CLI command to the pipeline would require:
>
> 1. Blocking the CI system while the cdk construct-upgrade command is added.
> 2. Committing the change to trigger the upgrade validation.
> 3. Unblocking the CI system and ensuring no new commits are pushed during this process.
> 4. Once complete, removing the upgrade command from the CI pipeline configuration.
>
> This process is cumbersome, and it would likely require administrative permissions to modify the CI
> system, which may not be feasible for all developers due to security policies. This creates friction
> n the workflow, making it a less-than-ideal solution for CI/CD-driven deployments.
>
> At this point, this scenario is a challenging problem without an elegant solution. It is something
> we may revisit in the future, but currently, we suggest using other patterns or workflows (such as
> Ops-led deployment) for teams with more complex pipeline setups.

### Settings

You have a few settings available to control the behavior of the new CDK CLI command
for construct upgrade feature.

```sh
cdk construct-upgrade [stacks] \
    --target [id] \
    [OPTIONS]
```

Arguments:

- CDK stack ID (Optional)
    The construct ID of the CDK stack from your app to synthesize.

Options:

- --source (Optional):
    The construct module to upgrade from. For example, `aws-cdk-lib.aws-dynamodb.Table`.
    If omitted, the CLI will assume your source module based on the `target` option.
- --target (Required):
    The construct module you want to upgrade to. For example, `aws-cdk-lib.aws-dynamodb.TableV2`.
    This is the destination construct for migration.
- --dry-run (Optional)
    This flag is default to false. When the flag is set to true, the CLI acts as dry-run
    and will only trigger validation.
- --ignore-unrelated (Optional)
    This flag is default to false. Validations performed by `cdk construct-upgrade` ensure that
    all changes in the stack are relevant to the migration being performed. For instance, when
    migrating a DynamoDB table, any changes in other resources (like Lambda functions) are flagged,
    even though they may be entirely unrelated to the migration.
    The introduction of this flag allows for more flexible validations during the migration process.
    When used, it loosens the validation criteria to focus only on the changes directly related to
    the migrated resource. This is not a recommended behaviour but allow developers to continue
    with daily feature work while migrating.
- Other options that are common to CDK CLI like --quiet, --help, etc

All these settings are also available in the `cdk.json` file:

```json
{
  "app": "...",
  "migration": {
    "source": "aws-cdk-lib.aws-ec2.Vpc",
    "target": "aws-cdk-lib.aws-dynamodb.TableV2",
    "dryRun": false,
    "ignoreUnrelated":false,
    ...
  }
}
```

### Rollback

After performing the execution step in the stack, the CLI will proceed with the deployment
(assuming that is your choice). If the deployment fails, and CloudFormation rolls it back which
will bring the resources back to their original states.

### Programmatic access

The same migration feature is also available in the CDK toolkit library:

```typescript
declare const toolkit: Toolkit;
declare const cx: ICloudAssemblySource;

// To execute possible refactors as part of the deploy operation:
await toolkit.deploy(cx, {
  constructUpgrade: true
});

// Or, if you just want to cosntruct upgrade the stacks:
await toolkit.constructUpgrade(cx);
```

## Alternative Proposed Solution

Instead of introducing a new command like `cdk construct-upgrade`, we could enhance
the existing `cdk diff` command by integrating both generic and custom validations,
along with strategy-specific checks. This would allow us to leverage the familiarity
of `cdk diff` command while providing comprehensive validation capabilities for
construct upgrades.

For generic validations such as drift detection and change set analysis, we would
introduce new options within the `cdk diff` command. Currently, `cdk diff` does not
return any status code or fail the CLI if certain conditions are met. To address this,
we would add options like `cdk diff --reject-drift` and `cdk diff --reject-update`,
which would trigger these validations and return an error code if any issues are
detected, ultimately failing the CLI when necessary.

To trigger drift detection, users would run `cdk diff --reject-drift`. This would
initiate drift detection on the stack, and if any drift is found, the command would
fail, notifying the user of the discrepancy between the deployed stack and the CDK code.

Similarly, for change set analysis, users would execute `cdk diff --reject-change`.
This would create and describe a CloudFormation change set and return an error if
any changes are detected between the current and the new stack configuration, alerting
the user about potential unintended modifications.

For the Retain-Remove-Import migration strategy, specifically with DynamoDB tables
we need to ensure that the removal policy is set to `RETAIN` to prevent unintended
resource deletions. To perform this validation, users would use a check like
`cdk diff --reject-replacement <resource-name>`. This option would verify that resources
are not being replaced unintentionally, thus safeguarding against data loss or other
issues during migration.

Custom validations would be incorporated into the `cdk diff` command in a manner similar
to the initial proposal. This would enable users to specify custom validation logic
for their specific use cases. They could do this by providing a file path containing
custom validation rules via the `cdk diff --custom-validation <file-path>` option.
Additionally, predefined custom validations from CDK could be invoked by specifying
the resource, such as `cdk diff --custom-validation aws-dynamodb.TableV2`.

To simplify the experience and aggregate multiple checks into a single command,
we could introduce a comprehensive protection option. For example, running
`cdk diff --protect aws-dynamodb.Table` would trigger a suite of validations that
includedrift detection, change set analysis, and removal policy checks, all in
one command. This would offer users a streamlined approach to ensure their stack
is safe and compliant with best practices before deployment.

### Pros and Cons: Initial vs Alternative Proposed Solution

Pros of the initial Proposed Solution:

- Separation of Concerns: The solution adds useful functionality to `cdk diff` without overloading
  it with specific options like `--reject-drift`. The generic drift operation is more reusable by
  CDK users.
- Simplified UX: The `cdk construct-upgrade` command streamlines the process, handling validation
  and deployment with one command.
- Clear Focus: A dedicated command for construct upgrades keeps the tool focused and easy to use.
  With a specific command, error handling and feedback are more actionable and tailored to the
  migration process.

Cons of the initial Proposed Solution:

- Additional Maintenance: Introducing a new command adds extra maintenance overhead.

> This maintenance overhead is mitigated by the introduction of custom validations that can be
> introduced by CDK users. See [Custom Validations](#custom-validations). This allows users
> to supply their own set of validations for any construct migrations that are not yet
> supported by CDK team.

- Misleading Name: The CLI name `construct-upgrade` is misleading in the intial Milestone because
  CDK does not actually make any code changes for users but requiring users to do the code
  migration to use V2 constructs. All the CLI does is validate and deploy the changes safely.

> This can be mitigated by renaming the CLI command to something more aligned with its actual
> functionality, such as `cdk validate-construct-upgrade, cdk vcu`.

### Limitations and failure modes

As we have seen, there are two migration strategies, `In-Place migration` strategy and
`Retain-Remove-Import` strategy.

For `In-Place migration` strategy, it will use CDK/CFN refactoring feature, so it will experience
the [same limitation](https://github.com/aws/aws-cdk-rfcs/blob/otaviom/refactoring-support/text/0162-refactoring-support.md#pipelines-with-version-superseding)
as described in the CDK Refactoring RFC.

For `Retain-Remove-Import` migration strategy, because we use `CDK import` feature,
it requires importing through resource physical names. In case of DynamoDB
table, users need to define the `TableName` property in the construct. In CI/CD
pipeline, the physical names vary in different accounts and regions. Users would
need to maintain a JSON file that maps accounts and the table physical names.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to
the RFC pull request):

[ ] Signed-off by API Bar Raiser @@iliapolo

## Public FAQ

### What are we launching today?

A new developer experience for CDK users, that allows them to validate their
migrated CDK code and deploy the changes seamlessly without causing resource
replacement or service downtime. This new experience is available in the CDK CLI `deploy`
and `upgrade` commands, as well as in the toolkit library.

### Why should I use this feature?

CDK will maintain old constructs like `aws-cdk-lib.aws-dynamodb.Table` and `aws-cdk-lib.aws-ec2.Vpc`
with security fixes only. If CDK users want to use the new and latest features, we highly
recommend users to migrate to the V2 constructs or modules for long term maintainability.
This feature provides a safe and semi-automated method for the migration.

## Internal FAQ

### Why are we doing this?

A number of CDK customers have requested this feature. CDK construct upgrade support
will show customer obsession by offering customers a safe and monitored method
for migrations and it will increase the adoption rate for new constructs and modules
as CDK will gradually reduce the level of supports for the outdated constructs and modules
to eventually Keep-The-Light-On mode.

### Is this a breaking change?

No. Depending on the migration strategies used, the CLI will either update the resource in place
using CloudForamtion/CDK stack refactoring feature or use CDK import feature to retain existing
resource, remove it from stack, and import it back into stack. Also, this
feature will initially be launched in experimental mode, and users must
acknowledge this by passing the `--unstable=construct-upgrade` flag.

### What is the high-level project plan?

#### Milestone 1

Milestone 1 is the initial, experimental release of CDK miconstruct upgrade feature. This goal of this
milestone is to combine s guided documentation, automate validations, and deployment safeguards
to ensure a controlled transition. We expect users to follow the documentation and do the
code migration process themselves.

##### Phase 1 (validation)

This phase will ensure through the automated migration tool that user’s existing CDK stack and
environment area ready for migration, flagging warnings and blockers like CloudFormation drift.
Additionally, validate that the migrated code is safe to deploy without causing downtime or replacement
through CloudFromation template comparison and change set analysis.

High-level tasks are:

1. Drift Detection  
    1. Trigger CloudFormation drift detection for the CDK applications.
    2. Report as blockers if there are drifts.
2. Environment Validation
    1. Verify CDK and AWS CLI versions meet minimum migration requirements.
    2. Report as blockers if CLI versions are below the minimum version (to support CloudFormation stack refactoring and etc.)
3. Resource Mapping Validation
    1. Verify logical ID and resource config consistency between old and are templates.
    2. Block the process if errors are identified
4. CloudFormation Change Set Analysis
    1. Analyze change set diffs to detect unintended property changes
    2. Validate Add/Remove actions map 1:1 for each LogicalResourceId.
    3. Ensure deleted (V1) and added (V2) resources have identical configurations.
    4. Block the process if errors are identified
5. [In-Place Migration Only] CloudFormation stack refactoring Validation for Migration Path
    1. Validate `refactor.json` aligns with CloudFormation’s stack refactoring rules (e.g., logical ID mappings).
    2. Validate items in stack refactor action list are valid.
    3. Block the process if errors are identified
6. [Retain-Remove-Import Migration Only] Retain Policy Validation
    1. Verify `RETAIN` deletion policies exist for the given migrated module in the stack
    2. Block the process if errors are identified
7. Any other module specific validations, e.g. for Table migration
    1. Verify if custom resource deletion does not delete the replica tables (through a L2 prop)
    2. Verify if properties like `TableName` for DynamoDB table construct is specified and Replica property exists
    3. Verify if properties like `DeletionProtection` for DynamoDB table is configured for safety

##### Phase 2 (execution)

Deploy the migrated stack using the migration tool if validations are completed successfully.
This phase differs depends on the module being migrated due to different migration approaches for Table and VPC.

High-level tasks:

1. Support In-Place migration execution
2. Support Retain-Remove-Import migratione execution

#### Milestone 2

Milestone 2 will be a future release to help automate the code migration process as well.
This is still under investigation and may or may not be included in the CDK construct upgrade support.

### Will this tool support every future V1 to V2 construct?

The CDK construct upgrade tool is designed to support common and high-impact migration scenarios for widely adopted
constructs and modules. While we aim to expand coverage over time, we cannot guarantee support for every
future V1-to-V2 migration path due to variations in technical complexity and resource constraints.

## Appendix

### Appendix A: Migration Guide

A maintainer will need to analyze code changes including behavioral change, potential resource replacement,
default value changes, etc. between the old and new construct library, and draft a standardized example-driven
migration guide. A migration guide should follow a standardized structure and will include the following sections:

- Dependency and Import Change: Instruction on the new construct module dependency and import paths.
- Property & Method Mapping: Feature parity table to compare of old/new construct’s property and methods.
- Change Analysis: Code and behavioral differences and infrastructure risks (e.g., resource replacements).
- Stack Refactoring JSON: Instruction on how to create and what to include in the stack refactor file if needed
- Retain and Import Resources: Instruction on retain certain construct and use CDK import feature if needed
- Examples: Annotated code snippets for common use cases.
- Risks and limitations: List risks and limitations on the migration approach
- Rollback steps: Provide the rollback process if anything goes wrong in between
