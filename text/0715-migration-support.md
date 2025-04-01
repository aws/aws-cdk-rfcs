# CDK Migration Support

- **Original Author(s):**: @GavinZZ
- **Tracking Issue**: #715
- **API Bar Raiser**: @iliapolo

An improvement to the CDK CLI and CDK construct library, to support developers in
migrating their CDK applications from supported V1 constructs/modules to the
latest V2 constructs/modules. An example

## Working Backwards

As the AWS Cloud Development Kit (CDK) evolves, we continuously deliver new features,
performance optimizations, and reliability improvements. To maintain backward compatibility
while enabling forward progress, the CDK team uses structured versioning strategies for critical updates.

A common pattern involves releasing versioned constructs or modules (e.g., V2 variants)
that coexist with their predecessors. For example:

* The `@aws-cdk/aws-ec2-alpha` alpha module introduces the modernized `VpcV2` construct,
designed to succeed the original Vpc in `aws-cdk-lib/aws-ec2`
* The `TableV2` construct in `aws-cdk-lib/aws-dynamodb` replaces legacy Table implementations
while retaining API compatibility

While these updates unlock enhanced capabilities, migrating between versions often requires code changes
that may inadvertently trigger CloudFormation resource replacements
(e.g., NAT gateways being recreated, DynamoDB global tables being reconfigured). For stateful production
resources, this poses availability risks and operational complexity.

To address this, the CDK team plans to introduce Migration Support – a combination of guided workflow
and automated safeguards that enable safe adoption of new constructs while preserving existing infrastructure.

### How it works

The CDK team plans to develop a migration framework for new construct and module versions, designed to
simplify adoption while minimizing risks. This approach combines guided documentation, automated validations,
and deployment safeguards to ensure a controlled transition.

In a high-level overview, for each supported migration, we provide:

1. A comprehensive, step-by-step migration guide enabling users to transition from legacy constructs/modules
to their modern equivalents.
2. A CDK CLI command `cdk upgrade` to validate code changes and execute deployments safely.

As of the initial release of CDK migration tool, we expect users to follow the migration guide to refactor
their CDK code, replacing legacy constructs (e.g., Table) with modern equivalents (e.g., TableV2). Users
retain flexibility in implementation—modifications can be applied manually or through AI-assisted code
transformation tools (e.g., LLMs).

After the code modification to use the new construct, CDK CLI command `cdk upgrade` will help validate
existing CDK stack and environment area ready for migration, flagging warnings and blockers like CloudFormation
drift. Additionally, CDK CLI command will cross compare the old and new CloudFormation generated
template, analyze CloudFormation change set.

Once users run `cdk upgrade` CLI command, it will save a `upgrade.context.json` file locally
to store the latest validation status. Once every check is successful, users can re-trigger
`cdk upgrade` CLI command and it will automatically deduce from `upgrade.context.json` file
that validation is complete and needs to proceed with actual execution and deployment step.

In the initial release of CDK migration tool, we target to support VPC related constructs migration
from `aws-cdk-lib/aws-ec2` to `@aws-cdk/aws-ec2-alpha` as well as `Table` to `TableV2` construct
migration in `aws-cdk-lib/aws-dynamodb`. We will gradually include more construct or module
migration in the future.

#### Migration Strategies

Depending on the construct or module being migrated, the deployment step differs. There are two
main migrations strategies:

1. In-place Migration - This approach requires users to refactor current stack with CDK code to
use V2 constructs and make sure the resource configuration matches by following the migration guide.
Users then needs to specify the `refactor.json` file for CloudFormation stack refactoring feature to
map logical ID changes. Then apply CloudFormation stack refactor feature by calling
`aws cloudformation execute-stack-refactor --stack-refactor-id <id>` to proceed migration.

2. Retain-Remove-Import Migration - This approach expects users to have `RemovalPolicy.RETAIN` set
on the V1 construct in the stack. Users also need to configure table construct so that the custom resource
deletion does not delete the stateful resources. If not already set, deploy the retain policy change. Then
users can start to modify their CDK stack code locally to remove the migrated construct from the stack and
update CDK stack using V2 construct with the same configurations. Replace any reference to the old construct
with the new construct. Call `cdk deploy --import-existing-resources`. The flag `--import-existing-resources`
will use CDK import internally and link to the orphan Table and replica resources to the new definition.

> The reason that constructs like `TableV2` cannot use the safer and easier In-place migration approach is
> because of the custom resources used in the old construct and new construct uses native L1s. Resource
> removal and addition is not supported by CloudFormation stack refactoring.

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
const table = new TableV2(this, 'MyGlobalTable', {
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

The next step is to run the CDK CLI command `cdk upgrade`. This command
will trigger the validation process to make sure the changes are valid and safe to deploy.

```sh
cdk upgrade --unstable=migrate --migration-id dynamodb --dry-run
```

CDK will do a dry-run validation on current stack status, compare the current and new CFN
template files, analyze dependency changes, analyze CloudFormation change set, validate retain
policies (if applies), validate stack refactor JSON file, and etc.

The output of the validation will be shown in the CLI output as well as in a context file,
`upgrade.context.json` file. A sample output is shown below:

```json
{
  "migrationStatus": "Blocked", // or "Ready"
  "Result": {
    "stackDriftValidation": { "status": "PASS", "details": [...] },
    "resourceValidation": { "status": "PASS", "details": [...] },
    "dependencyGraphValidation": { "status": "WARNING", "details": [...] },
    "changeSetValidation": { "status": "ERROR", "details": [...] },
    "stackRefactoringValidation": { "status": "NOT_RUN" },
    "deletionPolicyValidation": { "status": "NOT_RUN" },
  }
}
```

Once the `migrationStatus` from the validation output is `Ready`, this implies that CDK has
validated the code changes that no stateful resource replacement or service downtime would
happen and is ready to proceed to the actual deployment step.

To execute the migration, run `cdk upgrade --unstable=migrate --migration-id dynamodb`.
The CLI will show you the changes it is going to make, and ask for your confirmation:

```sh
Resources

[-] AWS::DynamoDB::Table MyTable orphan
[-] AWS::IAM::ManagedPolicy destroy
[-] Custom::DynamoDBReplica destroy
[-] AWS::CloudFormation::Stack destroy
[+] AWS::DynamoDB::GlobalTable MyGlobalTable add

Do you wish migrate these resources (y/n)?
```

If you answer yes, the CLI will show the progress as the refactor is executed:

```sh
Migrating...
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

You can also migrate the resources as part of a deployment, by running `cdk
deploy --import-existing-resources`. You will be shown the same table as above.

### Enterprise and CI/CD Pipeline

Enterprise developers often lack production AWS credentials, making pre-deployment
validations (e.g., drift detection, change set analysis) impossible in production environments.

At development time, here is how it works for common enterprise scenarios. Developers have upgrade
their CDK stack code to use V2 construct. They can use `dry-run` feature which will allow users to
run the validations on the test/dev account without deploying.

There are at least two possible paths forward, depending on the circumstances:

1. Developers can send the output validation file to an operations team, who will review it. If
approved, they manually dry run the validations on every protected environment in advance
(i.e., before your changes get deployed to those environments).
2. Commit the upgraded CDK stack code to version control, and configure your pipeline to run the new
CDK CLI command `cdk upgrade`. This is a more convenient option, as it requires less coordination between
different roles and will fail to deploy if any errors happen at validations. `cdk upgrade` will
do validation prior to deployment.

### Settings

You have a few settings available to control the behavior of the CDK CLI command 
for migration feature.

```sh
cdk upgrade [stack-id] \
    --module [vpc, dynamodb] \
    [OPTIONS]
```

Arguments:

- CDK stack ID (Optional)
    The construct ID of the CDK stack from your app to synthesize.

Options:

- --migration-id (Required)
    specify the migration target. Valid values are [vpc, dynamodb]
- --dry-run (Optional)
    This flag is default to false. When the flag is set to true, the CLI acts as dry-run
    and will only trigger validation. The output of the validations will be presented to users
    in the log and be written into `upgrade.context.json` file.
- --strict (Optional)  
    Treats validation warnings as errors.  
- --context-file (Optional)
    specify custom context file instead of default `upgrade.context.json`
- --accept-violations (Optional)
    Specify this flag to override and ignore any failures or errors in the validations. Use
    at users’ own risk.
- --abort (Optional)
    Abort the migration and discard the upgrade.context.json context file.
- Other options that are common to CDK CLI like --quiet, --help, etc

All these settings are also available in the `cdk.json` file:

```json
{
  "app": "...",
  "migration": {
    "migrationId": "dynamodb",
    "dryRun": true,
    "contextFile": "upgrade.context.json",
    "acceptViolation": false,
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
  importExistingResources: true
});

// Or, if you just want to refactor the stacks:
await toolkit.upgrade(cx);
```

### Limitations and failure modes

As we have seen, there are two migration strategies, In-Place migration strategy
and Retain-Remove-Import strategy.

For In-Place migration strategy, it will use CDK/CFN refactoring feature, so it
will experience the [same limitation](https://github.com/aws/aws-cdk-rfcs/blob/otaviom/refactoring-support/text/0162-refactoring-support.md#pipelines-with-version-superseding) as described in the CDK Refactoring RFC.

For Retain-Remove-Import migration strategy, because we use `CDK import` feature,
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

### What if I incorrectly migrate a stack?

The CLI offers mechanisms to prevent accidental bugs, such as dry runs and a
number of validations that will be performed with the CLI command. Nevertheless,
mistakes can happen.

If you're migrating using In-Place migration approach, then
CloudFormation stack refactoring feature will perform additional validations and
rollback automatically. If you accidentally migrate a stack, you can run the CLI with
inverse mapping file `refactor.json` to bring the resources back to their original state.

If you're migrating using Retain-Remove-Import migration approach, then CloudFormation
deployment will rollback the stack for you automatically if things go wrong. If you
want to switch back to V1 construct from V2 cosntruct, you can do this by retaining
V2 resource, remove it from stack and import it using V1 CDK code.

## Internal FAQ

### Why are we doing this?

A number of CDK customers have requested this feature. CDK migration support
will show customer obsession by offering customers a safe and monitored method
for migrations and it will increase the adoption rate for new constructs and modules
as CDK will gradually reduce the level of supports for the outdated constructs and modules
to eventually Keep-The-Light-On mode.

### Is this a breaking change?

No. Depending on the migration strategies used, the CLI will either update the resource in place
using CloudForamtion/CDK stack refactoring feature or use CDK import feature to retain existing
resource, remove it from stack, and import it back into stack. Also, this
feature will initially be launched in experimental mode, and users must
acknowledge this by passing the `--unstable=migrate` flag.

### What is the high-level project plan?

#### Milestone 1

Milestone 1 is the initial, experimental release of CDK migration feature. This goal of this
milestone is to combine s guided documentation, automate validations, and deployment safeguards
to ensure a controlled transition. We expect users to follow the documentation and do the
code migration process themselves.

##### Phase 1 (dry-run)

This phase will ensure through the automated migration tool that user’s existing CDK stack and
environment area ready for migration, flagging warnings and blockers like CloudFormation drift.
Additionally, validate that the migrated code is safe to deploy without causing downtime or replacement
through CloudFromation template comparison and change set analysis.

High-level tasks:

1. Drift Detection  
2. Environment Validation
3. Resource Mapping Validation
4. Dependency Graph Validation
5. CloudFormation Change Set Analysis
6. [In-Place Migration Only] CloudFormation stack refactoring Validation for Migration Path
7. [Retain-Remove-Import Migration Only] Retain Policy Validation
8. Any other module specific validations

##### Phase 2 (execution)

Deploy the migrated stack using the migration tool if validations are completed successfully.
This phase differs depends on the module being migrated due to different migration approaches for Table and VPC.

High-level tasks:

1. Support In-Place migration execution
2. Support Retain-Remove-Import migratione execution

#### Milestone 2

Milestone 2 will be a future release to help automate the code migration process as well.
This is still under investigation and may or may not be included in the CDK migration support.
