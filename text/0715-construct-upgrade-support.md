# CDK Construct Upgrade Guide

- **Original Author(s):**: @GavinZZ
- **Tracking Issue**: #715
- **API Bar Raiser**: @iliapolo

A construct upgrade guide for the CDK that assists developers in upgrading from older construct
libraries to modern, fully supported alternatives. This guide includes CLI validations to ensure
the safety of construct upgrade changes.

## Motivation

As the AWS Cloud Development Kit (CDK) evolves, we continuously deliver new features,
performance optimizations, and reliability improvements. To maintain backward compatibility
while enabling forward progress, the CDK team uses structured versioning strategies for critical
updates.

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

To address this, this construct upgrade guide demonstrates the workflow for safely upgrading constructs
through guided documentation, validation commands, and deployment commands. This ensures users can execute
construct upgrades in a controlled and safe manner.

## Working Backward

When upgrading CDK constructs, CDK users follow these steps using our construct upgrade guides and CDK CLI
commands:

- **Review Migration Guide:** Developers start by reading CDK-provided comprehensive migration guide for
their specific construct upgrade (e.g., DynamoDB Table to TableV2). The details of individual migration
guide is out of scope of this RFC.
- **Update CDK Constructs:** Developers update their CDK stack to V2 variants of the constructs following the
construct upgrade guide.
- **Validate Changes:** Developers run CDK CLI commands to validate their code changes.
- **Execute Changes:** Developers run the corresponding execute command in CDK CLI to deploy the changes.

### Working Backward: DynamoDB Table Upgrade Example

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

**Step 1:**: CDK users follow the construct upgrade guide provided by CDK team and upgrade to TableV2 construct:

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

**Step 2:**: CDK users follow the construct upgrade guide to validate code changes by running the
CDK CLI commands below:

```s
# exit with 1 if CloudFormation drift is detected for resource type AWS::DynamoDB::Table
# exit with 0 otherwise
$ cdk drift --rejectAWS::DynamoDB::Table

Stack DemoStack
✅ No CloudFormation drift detected

# exit with 1 if resources types AWS::DynamoDB::Table and Custom::DynamoDBReplica are deleted, OR
# exit with 1 if resources type AWS::DynamoDB::GlobalTable are not imported
# exit with 0 otherwise
$ cdk diff --retain AWS::DynamoDB::Table,Custom::DynamoDBReplica --import AWS::DynamoDB::GlobalTable

Stack DemoStack
✅ There were no differences
```

**Step 3:**: CDK users follow the construct upgrade guide to deploy the changes by running the
CDK CLI command below:

```s
$ cdk deploy --import-existing-resources

Performing deployment...

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

#### CDK Drift Detection Failures

If a CloudFormation drift is detected on `AWS::DynamoDB::Table` resource, the CLI will show:

```s
$ cdk drift --rejectAWS::DynamoDB::Table

Stack DemoStack
Resource: AWS::DynamoDB::Table MyTable794EDED1
  └ • BillingMode: "PAY_PER_REQUEST" (expected: "PROVISIONED")
```

> To fail CloudFormation drift for any drift in the stack, users can run:
>
> ```sh
> cdk drift
> ```

#### CDK Diff Failures

**Example 1:** If the change set analysis detects the new table is not being imported (by setting the `TableName` property
on the construct), the CLI will show:

```s
$ cdk diff --retain AWS::DynamoDB::Table,Custom::DynamoDBReplica --import AWS::DynamoDB::GlobalTable

Resources
[+] AWS::DynamoDB::GlobalTable MyGlobalTable MyGlobalTable794EDED1
  └ • Action: 'add' (expected: 'import')

✨  Number of stacks with differences: 1
```

**Example 2:** If the change set analysis detects the table construct is not being retained, the CLI will show:

```s
$ cdk diff --retain AWS::DynamoDB::Table,Custom::DynamoDBReplica --import AWS::DynamoDB::GlobalTable

Resources
[+] AWS::DynamoDB::Table MyTable MyTable794EDED1
  └ • PolicyAction: 'remove' (expected: 'retain')

✨  Number of stacks with differences: 1
```

### Working Backward: VPC Upgrade Example

Consider a VPC and related resources deployed to CloudFormation using the legacy `Vpc` construct
in `us-east-2` region:

```ts
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export const PUBLIC_SUBNET_NAME = 'public-subnet-test-cyberark1'
export const VPC_NAME = 'test-vpc-cyberark'

export class DemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'vpc', {
      vpcName: VPC_NAME,
      ipAddresses: ec2.IpAddresses.cidr(`10.0.0.0/16`),
      availabilityZones: [AZ],
      subnetConfiguration: [
        {
          name: PUBLIC_SUBNET_NAME,
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
      restrictDefaultSecurityGroup: false,
    });
  }
}
```

**Step 1:**: CDK users follow the construct upgrade guide provided by CDK team and upgrade to
use constructs from `@aws-cdk/aws-ec2-alpha` modules:

```ts
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ec2alpha from '@aws-cdk/aws-ec2-alpha';

export const PUBLIC_SUBNET_NAME = 'public-subnet-test-cyberark1'
export const VPC_NAME = 'test-vpc-cyberark'

export class DemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2alpha.VpcV2(this, 'vpc', {
      vpcName: VPC_NAME,
      primaryAddressBlock: ec2alpha.IpAddresses.ipv4(`${CIDR_BLOCK_PREFIX}.0.0/${VPC_CIDR_MASK}`),
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    const internetgw = new ec2alpha.InternetGateway(this, 'igw', {
      vpc: this.vpc,
    });

    const publicSN = new ec2alpha.SubnetV2(this, PUBLIC_SUBNET_NAME, {
      vpc: this.vpc,
      availabilityZone: AZ,
      ipv4CidrBlock: new ec2alpha.IpCidr(`${CIDR_BLOCK_PREFIX}.0.0/${SUBNET_CIDR_MASK}`),
      subnetType: ec2.SubnetType.PUBLIC,
      mapPublicIpOnLaunch: true,
      subnetName: PUBLIC_SUBNET_NAME,
    });
    cdk.Tags.of(publicSN).add('Name', `${this.stackName}/vpc/public-subnet-test-cyberark1Subnet1`);

    new ec2alpha.Route(this, 'public-route', {
      routeTable: publicSN.routeTable,
      destination: "0.0.0.0/0",
      target: new ec2alpha.RouteTargetType({ gateway: internetgw })
    });
    cdk.Tags.of(publicSN.routeTable).add('Name', `${this.stackName}/vpc/public-subnet-test-cyberark1Subnet1`);
  }
}
```

**Step 2:**: CDK users follow the construct upgrade guide to validate code changes by running the
CDK CLI commands below:

```s
$ cdk drift --rejectAWS::EC2::*

Stack DemoStack
✅ No CloudFormation drift detected
```

**Step 3:**: CDK users follow the construct upgrade guide to deploy the changes by running the
CDK CLI command below:

```s
$ cdk refactor --unstable=refactor

The following resources were moved or renamed:
┌───────────────────────────────┬────────────────────────────────────┬───────────────────────────────────┐
│ Resource Type                 │ Old Construct Path                 │ New Construct Path                │
├───────────────────────────────┼────────────────────────────────────┼───────────────────────────────────┤
│ AWS::EC2::InternetGateway     │ Stack/vpc/IGW                      │ Stack/igw/IGW                     │
├───────────────────────────────┼────────────────────────────────────┼───────────────────────────────────┤
│ AWS::EC2::Subnet              │ Stack/vpc/SubnetName/Subnet        │ Stack/SubnetName/Subnet           │
├───────────────────────────────┼────────────────────────────────────┼───────────────────────────────────┤
│ AWS::EC2::RouteTable          │ Stack/vpc/RouteTable/RouteTabl     │ Stack/RouteTable                  │
├───────────────────────────────┼────────────────────────────────────┼───────────────────────────────────┤
│ ......                        │ ......                             │ ......                            │
├───────────────────────────────┼────────────────────────────────────┼───────────────────────────────────┤
│ AWS::EC2::Route               │ Stack/vpc/Route/DefaultRoute       │ Stack/public-route/Route          │
└───────────────────────────────┴────────────────────────────────────┴───────────────────────────────────┘

Do you wish to refactor these resources (y/n)?
```

If you answer yes, the CLI will show the progress as the refactor is executed:

```s
Creating stack refactor...

2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::EC2::VPC                       | MyStack/vpc/Resource
2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::EC2::Subnet                    | MyStack/vpc/test-public-subnet/Resource
2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::EC2::Subnet                    | MyStack/vpc/test-private-subnet/Resource
......
2:03:17 PM | REFACTOR_COMPLETE    | AWS::EC2::VPC                       | MyStack/vpc/Resource
2:03:17 PM | REFACTOR_COMPLETE    | AWS::EC2::Subnet                    | MyStack/vpctest-public-subnet/Resource
2:03:17 PM | REFACTOR_COMPLETE    | AWS::EC2::Subnet                    | MyStack/vpctest-private-subnet/Resource   

✅  Stack refactor complete
```

### Working Backward: Visual Workflow

A visual representation of the the two construct upgrade workflows is described below:

```
┌───────────────────────────────────────────────────────────┐
|               Construct Upgrade Workflow                  |
|                                                           |
|                ┌─────────────────────┐                    |
|                │    CDK V1 Stack     │                    |
|                └──────────┬──────────┘                    |
|                           │ follow migration guide        |
|            ┌──────────────┴──────────────┐                |
|            ▼                             ▼                |
| ┌─────────────────────┐       ┌─────────────────────┐     |
| │   Human refactor    │       │Other refactor method│     |
| │                     │       │      like LLM       │     |
| └─────────────────────┘       └─────────────────────┘     |
|            │                             │                |
|            └──────────────┬──────────────┘                |
|                           |                               |
|                           ▼                               |
|                ┌─────────────────────┐                    |
|                │     CDK V2 Stack    │                    |
|                └──────────┬──────────┘                    |
|                           | "cdk drift" CLI command       |
|                           ▼                               |
|                ┌─────────────────────┐                    |
|                │ CDK Drift Detection │                    |
|                └──────────┬──────────┘                    |
|                           | "cdk diff" CLI command        |
|                           ▼                               |
|                ┌─────────────────────┐                    |
|                │  CDK Diff Analysis  │                    |
|                └──────────┬──────────┘                    |
|                           | follow migration guide        |
|           ┌───────────────┴───────────────┐               |
|           ▼                               ▼               |
|  ┌───────────────────┐          ┌─────────────────────┐   |                                 
|  │   CDK Refactor    |          │     CDK Import      |   |  
|  └───────────────────┘          └─────────────────────┘   | 
|           │                               │               | 
|           └───────────────────────────────┘               |
|                          |                                |
|                          ▼                                |
|               ┌─────────────────────┐                     |
|               │        Done         │                     |
|               └─────────────────────┘                     |
└───────────────────────────────────────────────────────────┘
```

## Construct Upgrade Strategies

As we've seen from the above [Working Backward](#working-backward) examples and the [Visual Workflow](#working-backward-visual-workflow),
there are two strategies employed to execute and deploy the upgraded construct stack: CDK Import strategy and CDK Refactor
strategy.

### CDK Refactor Strategy

For construct upgrades that maintain the same underlying CloudFormation resource types, CDK users can leverage the CDK
refactor feature, which uses CloudFormation stack refactoring under the hood. This strategy works because:

- The underlying CloudFormation resource types remain the same (e.g., AWS::EC2::VPC)
- No additional resources need to be created or deleted

The refactor strategy is safer because CloudFormation stack refactoring operations don't allow new resource creations,
resource deletions, or changes to resource configurations.

### CDK Import strategy

For construct upgrades that involve changing the underlying resource type (e.g., `AWS::DynamoDB::Table` to `AWS::DynamoDB::GlobalTable`)
or removing custom resources (e.g., DynamoDB replica custom resources), CDK users need to use the CDK import strategy.

This strategy requires:

- Setting `RemovalPolicy.RETAIN` on the original resources to prevent accidental deletion
- Specifying physical names (e.g., `tableName`) to import existing resources

## CI/CD Integration

Enterprise developers often lack production AWS credentials, making pre-deployment
validations (e.g., drift detection, change set analysis) impossible in production environments.

At development time, here is how it works for common enterprise scenarios. Assuming developers have upgrade
their CDK stack code to use new construct. They can run the following commands to validate changes.

```sh
$ cdk drift --rejectAWS::DynamoDB::Table
$ cdk diff --retain AWS::DynamoDB::Table,Custom::DynamoDBReplica --import AWS::DynamoDB::GlobalTable
```

Depending on the deployment workflow and environment constraints, there are two common enterprise
patterns:

1. **CI/CD-driven Deployment**:
For teams with access to CI/CD and production environments, developers commit the upgraded CDK stack
code to version control. The CI/CD pipeline runs the following as part of the deployment process:

```sh
# Run validations and store exit code
cdk drift --rejectAWS::DynamoDB::Table && cdk diff --retain AWS::DynamoDB::Table,Custom::DynamoDBReplica --import AWS::DynamoDB::GlobalTable

if [ $? -eq 0 ]; then
    echo "Validation passed. Proceeding with deployment..."
    cdk deploy --import-existing-resources # `cdk refactor --unstable=refactor` for VPC constructs upgrade
else
    echo "Validation failed. Deployment blocked."
    exit 1
fi
```

This approach streamlines deployment, reduces coordination overhead, and ensures migration safety by
preventing changes from reaching production unless validations pass.

2. **Ops-led Deployment**:
The development team upgrades the source code and runs above validations in a dev/test environment.
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

In these systems, implementing the CI/CD-driven deployment would be challenging, we recommend using Ops-led
deployment for teams with this setup until a more elegant solution is developed in the future updates.

## Rollback

There are two types of rollback scenarios to consider:

### Automatic Rollback During Deployment

If deployment fails, CloudFormation automatically rolls back all changes, returning resources to their original
state. For example:

```sh
$ cdk deploy --import-existing-resources # OR 'cdk refactor --unstable=refactor'

2:03:10 PM | IMPORT_IN_PROGRESS     | AWS::DynamoDB::Table | MyTable
2:03:10 PM | IMPORT_FAILED          | AWS::DynamoDB::Table | MyTable
2:03:17 PM | ROLLBACK_IN_PROGRESS   | AWS::DynamoDB::Table | MyTable
2:03:19 PM | ROLLBACK_COMPLETE      | AWS::DynamoDB::Table | MyTable
```

### Manual Rollback After Successful Deployment

If users need to roll back after a successful upgrade, the process depends on the strategy used:

#### For CDK Import Strategy

1. Retain the V2 construct resources:

```ts
const tableV2 = new dynamodb.TableV2(this, 'MyTable', {
  removalPolicy: RemovalPolicy.RETAIN,
  // ... other configurations
});
```

2. Switch back to V1 construct and import the retained resources:

```ts
const table = new dynamodb.Table(this, 'MyTable', {
  tableName: 'existing-table-name', // Name of the retained table
  // ... other configurations
});
```

3. Validate and deploy the changes using the same set of commands as before.

```sh
$ cdk drift ... && cdk diff ...
$ cdk deploy --import-existing-resources
```

#### For CDK Refactor Strategy

1. Revert the CDK code to its original state and deploy:

```ts
// Revert from VpcV2 back to Vpc
const vpc = new ec2.Vpc(this, 'MyVpc', {
  // Original configurations
});
```

2. Validate and deploy the changes using the same set of commands as before.

```sh
$ cdk drift ... && cdk diff ...
$ cdk refactor --unstable=refactor
```

## Programmatic access

The same migration feature is also available in the CDK toolkit library:

```typescript
declare const toolkit: Toolkit;
declare const cx: ICloudAssemblySource;

await toolkit.drift(cx);
await toolkit.drift(cx, "AWS::DynamoDB::Table");

await toolkit.diff(cx, {
  retain: ["AWS::DynamoDB::Table"],
  import: "AWS::DynamoDB::GlobalTable"
});
```

## Re-bootstrap required

Before using the `cdk drift` command you need to ensure that the necessary permissions are granted
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

This step is crucial as it will configure the environment with the correct permissions.

## Proposed CLI Commands API

The construct upgrade guide introduces new commands and new options to existing commands to CDK CLI:

### CDK Drift Command

Detects drift in CloudFormation resources. The following CLI command prints a drift report.
Exit with 1 if drift is detected, exit with 0 otherwise.

```sh
cdk drift <stack-id> --reject <resource-type>
```

Argument:

stack-id: Optional. Specifies which stack(s) to check for drift.

Options:

- --reject [resource-type]: Optional. When specified, exit with 1 if drift is detected in th resource type.

### CDK Diff Command

Extends the existing `cdk diff` command with new options to validate resource retain and import. The command
prints the diff report. When used with existing `--fail` flag, The command prints the diff report and exits
with 1 if validation fails, exits with 0 otherwise.

```sh
cdk diff <stack-id> --retain <resource-type> --import <resource-type>
```

Argument:

stack-id: Optional. Specifies which stack(s) to validate.

Options:

- --retain [resource-type]: Optional. Validates specified resource types have `Retain` policy action in the
change set output.
- --import [resource-type]: Optional. Validates specified resource types have `Import` action in the change set
output.

## Alternative CLI Commands API Designs

We considered several alternative API designs for the construct upgrade validation commands. Here are the key
alternatives we evaluated:

### Construct-specific Upgrade Validation

Instead of separate drift and change set validations, we could provide a single, construct-specific validation option:

```sh
#Validate Table to TableV2 upgrade
cdk diff --validate-upgrade=dynamodb

# Validate Vpc to VpcV2 upgrade
cdk diff --validate-upgrade=vpc
```

This approach would implicitly:

- Run drift detection for relevant resource types
- Validate retention policies
- Verify import configurations
- Check construct-specific requirements for any future supports

Pros:

- Simple, intuitive API for construct upgrades
- Encapsulates all necessary validations
- Construct-aware defaults (knows which resources to check)
- Reduces command complexity for users
- Better developer experience for common upgrade paths

Cons:

- Less flexible for validations unrelated to construct upgrade
- Code changes required to support future construct upgrades
- Requires maintaining mapping of construct types to CFN type to validate the retain and import

### CDK Construct Path-based Validation

Instead of specifying CloudFormation resource types, we could use CDK construct paths to identify resources.

Check drift for specific constructs:

```ts
cdk drift --reject MyStack/MyTable
```

Validate changes for specific constructs:

```ts
cdk diff --retain MyStack/Table --import MyStack/MyNewTable
```

Pros:

- Can target specific construct instances rather than all resources of a type
- Uses familiar CDK construct paths instead of CloudFormation resource types
- Can handle constructs that create multiple underlying resources, i.e. `MyStack/MyTable` includes:
  - MyStack/MyTable/Resource
  - DemoStack/MyTable/SourceTableAttachedManagedPolicy-DemoStackawscdkawsdynamodbReplicaProviderOnEventHandlerServiceRole36487EE8

Cons:

- Requires users to manually identify and specify construct paths
- Not possible to validate resources from stacks deployed without `aws:cdk:path` metadata
- May be confusing when constructs create multiple resources
- Construct path may be long and messy

**Recommendation:** We chose to use CloudFormation resource types instead of construct paths because:

- More reliable - doesn't depend on metadata
- Works with all existing deployments
- Clearer mapping to actual resources being changed
- Consistent with CloudFormation's drift detection model

### Dedicated Change Set Validation Command

Instead of extending the cdk diff command, we considered creating a new dedicated command for change
set validation:

```sh
cdk validate-change-set --retain AWS::DynamoDB::Table --import AWS::DynamoDB::GlobalTable
```

Pros:

- Clear, single-purpose command
- More explicit about the validation intent

Cons:

- Introduces another command to the CLI
- Potentially duplicates some diff functionality

**Recommendation:** We chose to extend existing `cdk diff` command instead of creating a new command because:

- Maintains CLI simplicity
- Leverages existing change set generation
- Reduces cognitive load for users

## Limitations and failure modes

### Limitation: In-Place Migration Strategy

This strategy utilizes the CDK/CloudFormation refactoring feature and inherits its limitations. It experiences
the [same limitations](https://github.com/aws/aws-cdk-rfcs/blob/otaviom/refactoring-support/text/0162-refactoring-support.md#pipelines-with-version-superseding)
as described in the CDK Refactoring RFC. Primarily, these limitations affect pipelines with version superseding,
potentially causing issues in complex deployment scenarios.

### Limitation: Retain-Remove-Import Migration Strategy

This strategy relies on the CDK import feature, which requires importing resources through their physical names.
For DynamoDB tables, users must define the `TableName` property in the construct. In CI/CD pipelines, where physical
names vary across accounts and regions, users need to maintain a JSON file mapping accounts to table physical names.

1. Create a JSON file (e.g., table-names.json) with the physical names:

```json
{
  "dev": "DevStack-MyTable794EDED1-11W4MR8VZ0UPE",
  "prod": "ProdStack-MyTable794EDED1-22X5NS9WA1VPF"
}
```

2. Read from this file during stack synthesis:

```ts
const tableNames = JSON.parse(fs.readFileSync('./table-names.json', 'utf8'));

const table = new dynamodb.TableV2(this, 'MyTable', {
  // ... other properties ...
  tableName: tableName['prod'],
});
```

> Important: The tableName property is required for the upgrade process and cannot be removed afterward, as CloudFormation will
> treat its removal as a resource replacement. This limitation exists because the CFN import feature only allows imports with
> no subsequent resource updates or deletions and does not allow import the same resource in the same stack and there is no
> trivial workaround.

A workaround would be either store the value of the `tableName` in a static json file like above or store it in
AWS Systems Manager Parameter Store if users must not input a hardcoded value.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to
the RFC pull request):

[ ] Signed-off by API Bar Raiser @@iliapolo

## Public FAQ

### What are we launching today?

Added functionality to CDK CLI, that allows them to validate their CDK code and deploy
the changes seamlessly without causing resource replacement or service downtime.

### Why should I use this feature?

CDK will maintain old constructs like `aws-cdk-lib.aws-dynamodb.Table` and `aws-cdk-lib.aws-ec2.Vpc`
with security fixes only in the future. If CDK users want to use the new and latest features, we highly
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

No

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
