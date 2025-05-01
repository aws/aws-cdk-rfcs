# CDK Construct Upgrade Support

- **Original Author(s):**: @GavinZZ
- **Tracking Issue**: #715
- **API Bar Raiser**: @iliapolo

A new migration framework in the CDK CLI and construct library that helps developers migrate from
older construct libraries to modern, fully supported alternatives that incorporate the latest
features and best practices.

## Motivation

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

To address this, CDK team develops a construct upgrade framework designed to simplify adoption while
minimizing risks. This approach combines guided documentation, automated validations, and deployment
safeguards to ensure a controlled transition.

## Proposed Solution

In a high-level overview, for each supported migration, the construct upgrade framework provides:

- A comprehensive, step-by-step migration guide enabling users to transition from legacy constructs/modules
to their modern equivalents. Migration guide follows a standardized structure that includes dependency changes,
behavioral analysis, risk assessments, and rollback instructions. This ensures consistency, clarity, and safety
across construct migration. See [Appendix A](#appendix-a-migration-guide) for a detailed breakdown of the proposed
migration guide format.

- A new CDK CLI command `cdk construct-upgrade --unstable=construct-upgrade` to validate code changes and
execute deployments safely. For more details on the CLI usage, please visit [CLI Settings](#settings)

```sh
cdk construct-upgrade --unstable=construct-upgrade [stacks] \
  --target [id] \
  [OPTIONS]
```

With the initial release of the CDK construct upgrade tool, developers would use the migration guide to
update their CDK code, replacing legacy constructs (e.g., Table) with modern equivalents (e.g., TableV2).

After updating the code to use the new construct, users would use the CDK CLI command `cdk construct-upgrade --unstable=construct-upgrade`
to validates the existing CDK stack and environment, ensuring they are ready for migration. The tool flags any
blockers, such as CloudFormation drift. Additionally, it analyzes the CloudFormation change set and validates
any library-specific configurations. See [Construct Upgrade Validations](#construct-upgrade-validations) for a detailed breakdown of the validations.

In the initial release of the CDK construct upgrade tool, VPC-related constructs upgrade from `aws-cdk-lib/aws-ec2`
to `@aws-cdk/aws-ec2-alpha` and `Table` to `TableV2` in `aws-cdk-lib/aws-dynamodb` come with enhanced
construct-specific validations and comprehensive migration guides provided by the CDK team to ensure
safe deployment. These two construct upgrades are so-called `fully supported` construct upgrade.

We aim to gradually increase the number of `fully supported` constructs. The tool is also designed to be open
and pluggable, allowing users to support other construct migrations by incorporating their own custom
validations. This flexibility enables users to extend the tool to cover additional constructs that may not
yet be officially supported with custom validations, see [Custom Validations](#custom-validations).

## User Experience: Walkthrough of Construct Upgrade Process

Below is a common upgrade scenario to demonstrate how the CDK Construct Upgrade framework helps developers
safely migrate their infrastructure. Consider a DynamoDB table deployed to CloudFormation using the legacy
`Table` construct:

```ts
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'MyTable', {
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      replicationRegions: ['us-west-2'],
    });
  }
}
```

CDK team provides a comprehensive migration guide that includes construct property mappings
(e.g., replicationRegions → replicas), code snippets, common migration scenarios, and etc.
To upgrade to TableV2 construct, first update your CDK code following the migration guide:

```ts
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.TableV2(this, 'MyTable', {
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      tableName: 'DemoStack-MyTable794EDED1-11W4MR8VZ0UPE',
      replicas: [
        {
          region: 'us-west-2',
        }
      ]
    });
  }
}
```

Now, validate the construct upgrade using the CDK CLI:

> Note that the flag `--unstable=construct-upgrade` is necessary to indicate that
> it's an experiemntal feature that users are using.

```sh
cdk construct-upgrade --unstable=construct-upgrade --target aws-cdk-lib.aws-dynamodb.TableV2
```

CDK runs the set of validations required and produce the following report:

```s
Performing construct upgrade validation...

⚠️  Note: This is an experimental feature

Validations:
✅ No CloudFormation drift detected
✅ Change set analysis complete
✅ Retain policies configured
✅ Construct-specific validations passed

Do you wish to proceed with this upgrade? [y/N]
```

If you answer `y` for yes, the CLI will proceed to deploy and show the progress as the deployment
is executed:

```s
Performing construct upgrade...

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

### Drift Detection Failure Example

If a CloudFormation drift is detected, the CLI will show:

```s
Performing construct upgrade validation...

⚠️  Note: This is an experimental feature

Validations:
❌ CloudFormation drift detected
  │ Resource: AWS::DynamoDB::Table MyTable794EDED1
  │ Actual changes found:
  └   • BillingMode: "PAY_PER_REQUEST" => "PROVISIONED"
✅ Change set analysis complete
✅ Retain policies configured
✅ Construct-specific validations passed

Error: Construct upgrade validation failed
Please resolve the drift before proceeding with the upgrade.
For more information about handling drift, visit: 'https://docs.aws.amazon.com/cdk/v2/guide/drift'
```

### Change Set Validation Failure Example

If the change set analysis detects the new table is not being imported, the CLI will show:

```s
Performing construct upgrade validation...

⚠️  Note: This is an experimental feature

Validations:
✅ No CloudFormation drift detected
❌ Change set analysis failed
  │ Resources: MyGlobalTable794EDED1 (AWS::DynamoDB::GlobalTable)
  │ Change Set:
  └  • Action: 'Add' (expected: 'Import')
✅ Retain policies configured
✅ Construct-specific validations passed

Error: Construct upgrade validation failed
```

### Retain Policies Failure Example

Here's the error output example for when retain policies validation fails:

```s
Performing construct upgrade validation...

⚠️  Note: This is an experimental feature

Validations:
✅ No CloudFormation drift detected
✅ Change set analysis complete
❌ Retain policies validation failed
  │ Resource: MyTable794EDED1 (AWS::DynamoDB::Table)
  └   • RemovalPolicy: 'Delete' (expected: 'Retain')
✅ Construct-specific validations passed

Error: Construct upgrade validation failed
```

#### Construct-specific Validation Failure Example

If construct-specific validation fails, the CLI will show:

```s
Performing construct upgrade validation...

⚠️  Note: This is an experimental feature

Validations:
✅ No CloudFormation drift detected
✅ Change set analysis complete
✅ Retain policies configured
❌ Construct-specific validations failed
  │ Resources: MyGlobalTable794EDED1 (AWS::DynamoDB::GlobalTable)  │ 
  │ Property 'TableName' is required for import but was not specified
  └   • TableName: undefined (expected: 'DemoStack-MyTable794EDED1-11W4MR8VZ0UPE')

Error: Construct upgrade validation failed
```

### User Experience: Visual Workflow

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
||                       |         | ┌──────────────────┐  ||                                 
||           |           |         | │  Retain Policy   |  ||
||           |           |         | |    validation    |  ||                                   
||           |           |         | └──────────────────┘  ||
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

## Settings

You have a few settings available to control the behavior of the new CDK CLI command
for construct upgrade feature.

```sh
cdk construct-upgrade --unstable=construct-upgrade [stacks] \
    --target [id] \
    [OPTIONS]
```

Arguments:

- CDK stack ID (Optional)
    The construct ID of the CDK stack from your app to synthesize.

Options:

- --target (Required):
  The target construct and module you want to upgrade to. For example, `aws-cdk-lib.aws-dynamodb.TableV2` or `@aws-cdk/aws-ec2.VpcV2`
  For fully supported construct upgrades, we can short hand it to `TableV2` or `VpcV2`.
- --dry-run (Optional)
  This flag is default to false. When the flag is set to true, the CLI acts as dry-run and will only trigger validation.
- --require-approval (Optional)
  Specify what security-sensitive changes require manual approval.
    - any-change – Manual approval required for any change to the stack.
    - broadening – Manual approval required if changes involve a broadening of permissions or security group rules.
    - never – Approval is not required.
  Valid values: any-change, broadening, never
  Default value: broadening
- --skip-validation (Optional)
  Default to false. Use as users' own risk to by pass the validations step.
- --custom-analysis (Optional)
  When user provides a custom JavaScript file for validation, more will be explained in [Custom Validations](#custom-validations)
- Other global options like --quiet, --help, etc

## Construct Upgrade Strategies

The CDK construct upgrade framework employs two different strategies for migrating resources, automatically
selecting the appropriate approach based on the `--target` construct. CDK CLI uses a context variable to
determine the mapping between upgrade targets and their corresponding strategies.

### In-place Migration

This strategy is suitable for constructs where changes do not involve custom resource
removal or introduction of new underlying resource types. It leverages the CloudFormation stack refactoring
feature to maintain resource continuity.

Currently, users must specify a `refactor.json` file that maps logical ID changes from the old construct to the new one.
If construct upgrade validations are successful, the command continues to execute and deploy the CDK stack using CloudFormation
stack refactor feature, which helps retain existing resources while applying the necessary infrastructure updates.

> Future Enhancement: CDK team is developing a [built-in refactor feature](https://github.com/aws/aws-cdk-rfcs/pull/705)
> that will eliminate the need for manual refactor.json files. The mapping will be automatically inferred
> from the construct tree and paths. Once implemented, this process will be fully automated.

### Retain-Remove-Import Migration

This strategy is employed when significant changes occur in the underlying resource, such as transitioning from
a custom resource to a native L1 resource or resource property (e.g., Table to TableV2 migration). The CDK construct upgrade
framework handles this process through several automated steps:

- Validation of `RemovalPolicy.RETAIN` on the original construct to prevent accidental resource deletion.
- Execution of the `cdk construct-upgrade` command, which performs necessary validations.
- If validations pass, automatic triggering of deployment using CDK's import feature to link existing resources
to the new construct definition.

This approach preserves the state and data of existing resources while updating the infrastructure to use the
modernized construct.

## Construct Upgrade Validations

Validations will ensure that user’s existing CDK stack and environment area ready for migration, flagging
blockers like CloudFormation drift. Additionally, it validates that the migrated code is safe to deploy without
causing downtime or replacement through CloudFromation template comparison and change set analysis. Here is a
complete list of validations that CDK performs.

### Drift Detection

One of the validation workflow is to trigger CloudFormation drift detection for the CDK stacks. This feature
is generic and can be applied to all CDK users. It will be an added functionality in the `cdk diff` command
through the option `cdk diff --detect-drift`. The command will return the drift detection results in a format
similar to and along with the current `cdk diff` output.

> Note that this command will not fail if drift is detected. This is intentional, as `cdk diff` is meant to
> provide information about changes and is designed to be status-agnostic.

Sample output of `cdk diff --detect-drift` command is as follows:

```sh
$ cdk diff --detect-drift

Drifts
[~] AWS::Lambda::Function MyFunction drifted
[~] AWS::DynamoDB::Table MyTable drifted

Resources
[-] AWS::DynamoDB::Table MyTable orphan
[+] AWS::DynamoDB::GlobalTable MyTable import
```

The new `cdk construct-upgrade` CLI command will implicitly call the `cdk diff --detect-drift` command as part of
its validation process. To avoid being overly restrictive, the validation will primarily focus on the main resources
change. The main resources can be determined based on the `--target` option. Since `--target` accepts a fully qualified
name (FQN) of a construct, i.e. `aws-cdk-lib.aws-dynamodb.TableV2`, we can infer the corresponding CloudFormation
resource type with prefix (e.g., `AWS::DynamoDB`) from the FQN as the main resources.

Drift detection is important to ensure construct upgrade safety by preventing accidental deployment issues when
the CDK construct state does not match the actual deployed resource state. Without detecting drift, upgrades may
unintentionally remove manual configurations made through the AWS Console, potentially triggering resource
replacements, data loss, or availability downtime.

> **Known Limitation**: When performing construct upgrade on a specific DynamoDB table in a stack containing multiple tables,
> the drift detection validation will check all table resources in the stack, not just the target table. We plan to improve
> this functionality in the future to scope drift detection to only the resources being upgraded.

#### Re-bootstrap required

Before using the `cdk diff --detect-drift` command you need to ensure that the necessary permissions are granted
to the environment. Specifically, drift detection permissions are required in the bootstrap stack to perform
the validation correctly. Here is a list of required permissions:

```yaml
- cloudformation:DetectStackDrift
- cloudformation:DetectStackResourceDrift
- cloudformation:DescribeStackDriftDetectionStatus
```

To add these required permissions, run the following command target environment:

```sh
cdk bootstrap
```

This step is crucial as it will configure the environment with the correct permissions,
enabling the validation and migration process to proceed smoothly.

### CloudFormation Change Set Analysis

Another validation is to validate CloudFormation change set diff. The current `cdk diff` command implicitly calls
CloudFormation change set creation, providing high-level details such as "add", "delete", "modify", "import",
and etc. like the following:

```s
[-] AWS::DynamoDB::Table MyTable orphan
[+] AWS::DynamoDB::GlobalTable MyTable add
```

For `In-Place Migration` strategy, change set analysis is not required as CloudFormation stack refactoring enforces that
the refactor operations don't allow new resource creations, resource deletions, or changes to resource configurations,
see [Stack refactoring limitations](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stack-refactoring.html#stack-refactoring-limits).

For the `Retain-Remove-Import Migration` strategy, we will introduce an additional option `--import` in the
`cdk diff` command which will create a change set with `import` change set type. `import` change set type is a
feature supported by CloudFormation to indicate if a resource is being imported instead of being created. This
is achieved when two resource refers to the same physical ID to a resource in the account.

```sh
$ cdk diff --import

[
  {
    "type": "Resource",
    "resourceChange": {
      "action": "Import", # NOTE THAT THIS SHOWS "Import"
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
      "policyAction": "Retain", # Note that this is "Retain"
      "action": "Remove",
      "logicalResourceId": "MyTable794EDED1",
      "physicalResourceId": "DemoStack-MyTable794EDED1-11W4MR8VZ0UPE",
      "resourceType": "AWS::DynamoDB::Table",
      "scope": [],
      "details": [],
      "beforeContext": "..."
    }
  }
]
```

The `construct-upgrade` CLI command will implicitly call `cdk diff --import` which will create an `import`
type change set as above and it will validate if the main resources change action is `Import` instead of `Add`.

There may be future enhancement that we add to the change set validation, please see
[Appendix D: Change Set Analysis Future Enhancements](#appendix-d-change-set-analysis-future-enhancements).

### [In-Place Migration Only] Path Metadata Validation

In In-Place migrations, we leverage the CloudFormation stack refactoring feature, which imposes a limitation:
no changes to resource configurations are allowed, including updates to the Metadata section of any resource.

A common issue arises when users migrate a construct across modules (i.e. `@aws-cdk.aws-ec2-alpha.VpcV2` vs
`aws-cdk-lib.aws-ec2.Vpc`). Even if the resource properties remain the same, construct path differences result
in different `aws:cdk:path` metadata values.

```yaml
# VPC V1 - aws-cdk-lib.aws-ec2.Vpc
vpcpublicSubnetSubnet1RouteTable155F8E2E:
  Type: AWS::EC2::RouteTable
  Properties:
    ...
  Metadata:
    aws:cdk:path: CdkMigrationStack/vpc/publicSubnetSubnet/RouteTable

# VPC V2 - @aws-cdk/aws-ec2-alpha.VpcV2
vpcpublicSubnetSubnet1RouteTable155F8E2E:
  Type: AWS::EC2::RouteTable
  Properties:
    ...
  Metadata:
    aws:cdk:path: CdkMigrationStack/publicSubnet/RouteTable/RouteTable
```

This metadata change alone would cause the `In-Place migration` to fail, since CloudFormation treats it as
a configuration change and block the stack refactoring.

To streamline this experience, the `cdk construct-upgrade` CLI will detect such cases. If path metadata
is present in the output template and the chosen migration strategy is `In-Place migration`, the CLI will
prompt the user:

```sh
Detected path metadata in the synthesized CloudFormation template, which is not compatible with CloudFormation
stack refactoring. CDK will deploy your stack with path metadata disabled using: cdk deploy --no-path-metadata

Would you like to proceed? (y/n)
```

If the user confirms by selecting "y", the tool will proceed to run `cdk deploy` with `--no-path-metadata` flag
to update existing stack without path metadata fields.

> Future Enhancement: CloudFormation team is aware of this issue and is planning to work on an update to ignore
> Metadata changes during the stack refactor.

### [Retain-Remove-Import Migration Only] Retain Policy Validation

For Retain-Remove-Import migrations, it's crucial to ensure that the `RemovalPolicy.RETAIN` deletion policy
is applied correctly to the migrated resources in the deployed stack. The process will block the migration
if the `RETAIN` deletion policy is missing and ask users to deploy their V1 stack by setting `RETAIN` for
deletion policy.

We aim to improve this process by making this a streamlined process in the framework. During `cdk construct-upgrade`
CLI command, if we detect that the retain policy is not enabled, we can do the following:

Prompt the user with a message like:

```sh
Detected AWS::DynamoDB::Table with logical ID 'MyTable' does not have 'RETAIN' set as the deletion policy.
CDK will deploy your stack with the deletion policy set to RETAIN on 'MyTable'.

Would you like to proceed (y/n)?
```

If the user confirms by selecting "y", the migration will proceed to retrieve the deployed CloudFormation
stack template, modify the `MyTable` resource in the template by setting `DeletionPolicy: Retain` and deploy
the stack template.

### Custom validations

Custom validations ensure that the construct upgrade process adheres to best practices with custom
configurations. The `cdk diff` command is extended to support a new `--custom-analysis` option, which accepts
a JavaScript file implementing a predefined `Rules` interface. This provided file files allow both
the CDK team and end-users to define and enforce additional rules during the diff process, enabling safer
and more opinionated construct upgrade paths. When the `--custom-analysis` option is specified, the CLI
will `require()` the input file, instantiate the `Rules` object, and invoke the custom rules specified.

```js
export interface DiffAnalysis {
  /**
   * The version of the Rules interface used. This will be used by
   * the plug-in host to handle version changes.
   */
  version: '1';

  /**
   * When defined, this function is invoked right after the rules has been loaded,
   * so that the plug-in is able to initialize itself and be picked by `cdk diff`
   * command in the invocation.
   */
  init?: (host: IPluginHost) => void;
}

export interface DiffValidation {
  public execute(context: DiffContext);
}
```

For example, when migrating `Table` to `TableV2` for DynamoDB, the construct upgrade
validates that custom resource deletions do not affect replica tables by setting `SkipReplicaDeletion`
properties in the V1 template, that `DeletionProtection` is enabled and `TableName` property is set in
V2 template.

An example of CLI command usage is as fllows:

```sh
$ cdk diff --custom-analysis demo-analysis.ts
```

An example of CDK built-in custom validation file content is as follows:

```ts
// demo-analysis.ts
import { IRules, Rules } from '@aws-cdk/cli-custom-rules';

class DemoDiffValidation implements DiffValidation {
  execute(context: DiffContext) {
    const v1Template = context.deployedTemplate;
    const v2Template = context.newTemplate;
    const changeSet = context.changeSet;

    // Fail validation when `SkipReplicaDeletion` is not set on the deployed template
    Object.entries(v1Template.Resources).forEach((item) => {
      const [logicalId, resource] = item;
      if (resource.Type === 'Custom::DynamoDBReplica') {
        if (!resource.SkipReplicaRegion) {
          // throw error
        }
      }
    })

    // Fail validation when `TableName` is not provided
    Object.entries(v2Template.Resources).forEach((item) => {
      const [logicalId, resource] = item;
      if (resource.Type === 'AWS::DynamoDB::GlobalTable') {
        if (!resource.TableName) {
          // throw error
        }
      }
    })
  }
}

export default class DemoDiffAnalysis implements DiffAnalysis {
  public readonly version = '1';

  public init(host: IRules) {
    host.registerCustomRules(new DemoDiffValidation());
  }
}
```

The construct upgrade CLI will first load a core ruleset distributed by the CDK team. Additional
user-defined rules can be layered on by passing extra files to `--custom-analysis` flag, which will be merged
into the validation process. This ensures users can opt into project-specific validations
or even validations for not-yet-fully supported constructs while benefiting from official guidance.

Here is some future enhancements that we would make to the custom validations, see
[Appendix E: Custom Validation Future Enhancement](#appendix-e-custom-validation-future-enhancements).

## CI/CD Integration

Enterprise developers often lack production AWS credentials, making pre-deployment
validations (e.g., drift detection, change set analysis) impossible in production environments.

At development time, here is how it works for common enterprise scenarios. Assuming developers have upgrade
their CDK stack code to use new construct. They can use `dry-run` feature which will allow users to
run the validations on the test/dev account without deploying.

```sh
$ cdk construct-upgrade --unstable=construct-upgrade --target aws-cdk-lib.aws-dynamodb.TableV2 --dry-run
Performing construct upgrade validation...

⚠️  Note: This is an experimental feature

Validations:
✅ No CloudFormation drift detected
✅ Change set analysis complete
✅ Retain policies configured
✅ Construct-specific validations passed
```

Depending on the deployment workflow and environment constraints, there are two common enterprise
patterns:

1. CI/CD-driven Deployment:
For teams with access to CI/CD and production environments, developers commit the upgraded CDK stack
code to version control. The CI/CD pipeline runs `cdk construct-upgrade` as part of the deployment process.
Validations are performed automatically before deployment. If any validation fails, the deployment is blocked.
This approach streamlines deployment, reduces coordination overhead, and ensures migration safety by
preventing changes from reaching production unless validations pass.

2. Ops-led Deployment:
The development team upgrades the source code and runs validations in a dev/test environment using `--dry-run`.
The development team provides the source code with validation output to the operations team. The ops team
reviews the validation output, runs the migration in each production region, and deploys the changes.
Once migration is complete, the development team commits and pushes the updated source code to trigger CI/CD,
which is an no-op at this point.

Alternatively, the development team can upgrade the source code, commit and push the changes with CI/CD pipelines
deployment temporarily disabled. The operations team runs the migration in each production region and validates
deployment success. The development team re-enables CI/CD to roll out the changes through the normal pipeline.

**Known Limitation**: CI/CD-driven deployment has limitations when using pipeline systems that don't easily allow
command configurations (e.g., CDK L3 Pipeline construct where deployments rely on CloudFormation actions rather
than direct CDK CLI commands).

In these systems, implementing the CI/CD-driven deployment would require:

- Blocking the CI system while adding the `cdk construct-upgrade` command
- Committing the change to trigger the upgrade validation
- Unblocking the CI system and preventing new commits during the process
- Removing the upgrade command from CI pipeline configuration after completion

This process is cumbersome and typically requires administrative permissions to modify the CI system. Given
these challenges, we recommend using Ops-led deployment for teams with complex pipeline setups until a more
elegant solution is developed in the future updates.

## Rollback

After performing the execution step in the stack, the CLI will proceed with the deployment
(assuming that is your choice). If the deployment fails, and CloudFormation rolls it back which
will bring the resources back to their original states.

## Programmatic access

The same migration feature is also available in the CDK toolkit library:

```typescript
declare const toolkit: Toolkit;
declare const cx: ICloudAssemblySource;

// Or, if you just want to cosntruct upgrade the stacks:
await toolkit.constructUpgrade(cx);
```

## Limitations and failure modes

### In-Place Migration Strategy

This strategy utilizes the CDK/CloudFormation refactoring feature and inherits its limitations. It experiences
the [same limitations](https://github.com/aws/aws-cdk-rfcs/blob/otaviom/refactoring-support/text/0162-refactoring-support.md#pipelines-with-version-superseding)
as described in the CDK Refactoring RFC. Primarily, these limitations affect pipelines with version superseding,
potentially causing issues in complex deployment scenarios.

### Retain-Remove-Import Migration Strategy

This strategy relies on the CDK import feature, which requires importing resources through their physical names.
For DynamoDB tables, users must define the `TableName` property in the construct. In CI/CD pipelines, where physical
names vary across accounts and regions, users need to maintain a JSON file mapping accounts to table physical names.

### Non-Fully Supported Constructs

For constructs not fully supported by the upgrade process, if the construct upgrade doesn't support CloudFormation stack
refactoring and the construct properties don't allow setting physical IDs, the upgrade process is not supported. This
limitation may affect a range of constructs and require manual intervention or alternative upgrade paths.

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

### Appendix B: VPC related migration example

Suppose your CDK application has a single stack, called `MyStack`, containing a
`aws-ec2.Vpc` construct. Now you want to migrate existing stack to use the latest
`aws-ec2-alpha.VpcV2` which offers more advanced features and better DX:

```ts
# User existing stack
this.vpc = new cdk.aws_ec2.Vpc(this, 'vpcv1', {
    ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
    ipProtocol: ec2.IpProtocol.DUAL_STACK,
    availabilityZones: ['us-west-1a'], // Only using one AZ
    natGateways: 0, // Only 1 NAT Gateway
    natGatewaySubnets: {
      subnetType: ec2.SubnetType.PUBLIC, // NAT Gateway in a public subnet
    },
    createInternetGateway: false, // Creating Internet Gateway
    subnetConfiguration: [
    {
        name: 'publicSubnet',
        subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
        cidrMask: 24,
    }
    ],
    restrictDefaultSecurityGroup: false, // Allow unrestricted access to default security group
});
```

Step 1: redefine the stack using ec2-alpha module following guide

```ts
this.vpc = new ec2alpha.VpcV2(this, 'vpc', {
    primaryAddressBlock: ec2alpha.IpAddresses.ipv4('10.0.0.0/16'),
    secondaryAddressBlocks: [ec2alpha.IpAddresses.amazonProvidedIpv6({
    cidrBlockName: 'amazonProvided',
    })]
});

const publicSubnet = new ec2alpha.SubnetV2(this, 'publicSubnet', {
    ipv4CidrBlock: new ec2alpha.IpCidr('10.0.0.0/24'),
    ipv6CidrBlock: new ec2alpha.IpCidr(cdk.Fn.select(0, cdk.Fn.cidr(
    cdk.Fn.select(0, this.vpc.ipv6CidrBlocks), 1, '64'))),
    availabilityZone: 'us-west-1a',
    subnetType: ec2.SubnetType.PUBLIC,
    assignIpv6AddressOnCreation: true,
    vpc: this.vpc,
});
```

Step 2: build refactor.json file

```json
[
    {
        "Source": {
            "StackName": <stack-name>,
            "LogicalResourceId": "vpcv1A85508D7"
        },
        "Destination": {
            "StackName": <stack-name>,
            "LogicalResourceId": "vpcA2121C38"
        }
    },
    {
        "Source": {
            "StackName": <stack-name>,
            "LogicalResourceId": "vpcv1ipv6cidr87175A16"
        },
        "Destination": {
            "StackName": <stack-name>,
            "LogicalResourceId": "vpcamazonProvided373FDA5C"
        }
    },
    ......
]
```

Step 3: run `cdk construct-upgrade --unstable=construct-upgrade --target @aws-cdk.aws-ec2-alpha.VpcV2`

CDK will run validations described in the [Construct Upgrade Validations](#construct-upgrade-validations) section
on current stack status, compare the current and new CFN template files, analyze dependency changes, analyze
CloudFormation change set, validate retain policies (if applies), validate stack refactor JSON file (if applies), and etc.

> Note that this is just for demo purpose, the final output of the CLI command may look differently.

```sh
Construct Upgrade Validation
  Status: SUCCESS
  Subreports:
    DriftDetectionSubreport: PASS
      └ No drift is detected
    ChangeSetSubreport: PASS
    StackRefactoringSubreport: PASS
    DeletionPolicySubreport: PASS
    CustomValidationSubreport: PASS

Do you wish deploy these changes (y/n)?
```

Once the `Status` from the validation output status is `SUCCESS`, this implies that CDK has
validated the code changes that no stateful resource replacement or service downtime would
happen and is ready to proceed to the actual deployment step. If you answer `y` for yes,
the CLI will show the progress as the deployment is executed:

```sh
Updating stack...

2:03:17 PM | REFACTOR_IN_PROGRESS   | AWS::EC2::VPC 
2:03:17 PM | REFACTOR_IN_PROGRESS   | AWS::EC2::Subnet
2:03:17 PM | REFACTOR_COMPLETE   | AWS::EC2::VPC 
2:03:17 PM | REFACTOR_COMPLETE   | AWS::EC2::VPC  

✅  Stack deployment complete
```

### Appendix D: Change Set Analysis Future Enhancements

For the `Retain-Remove-Import` Migration strategy, the current change set analysis validates that the main resources
are of type import. This validation is sufficient for DynamoDB Table migrations. However, it is not comprehensive
enough for future support of constructs like EKS, where certain resources—such as `aws-eks.KubernetesManifest` — must
be strictly protected from any changes. To support such scenarios, we plan to introduce a separate context configuration
that maintains a list of resource types on which updates are explicitly prohibited in future updates.

### Appendix E: Custom Validation Future Enhancements

For fully supported construct upgrades, the `cdk construct-upgrade` CLI command includes built-in, construct-specific
validations — for example, ensuring that `TableName` is explicitly set or that `SkipReplicaDeletion` is configured as
true for Table construct.

When users run:

```sh
cdk construct-upgrade --unstable=construct-upgrade --target aws-cdk-lib.aws-dynamodb.TableV2
```

The tool fetches and applies these custom validations, which are planned to store in the `aws-cdk-cli` repository in the
initial launch. However, this tight coupling means that releasing new supported upgrades requires changes and a release
from the CLI repository.

To address this, we may consider to decouple validation logic from the CLI by introducing a separate open-source repository dedicated
to storing construct-specific validation files in a future update. During execution, the CLI will dynamically retrieve and
apply the appropriate validation files from this repository, enabling faster iteration and broader community contributions.

This change is entirely transparent to users and does not impact how they use the `cdk construct-upgrade` command.

### Appendix F: Alternative Proposed Solution

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