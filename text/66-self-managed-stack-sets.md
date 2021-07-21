---
rfc pr: [#347](https://github.com/aws/aws-cdk-rfcs/pull/347)
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/66
---

# CDK Self Managed Stack Set Support

As a CDK user, I would like to define stack set infrastructure through native CDK constructs,
 and create/update self-managed stack sets through CDK deploy command.

* **Original Author(s):** @linsona
* **Tracking Issue**: #66
* **API Bar Raiser**: @skinny85

## Working Backwards

### CHANGELOG

* feat(assembly): add stack set artifact type and schema
* feat(core): add `StackSet` construct
* feat(cli): CLI commands like `deploy` now support stack sets
* feat(bootstrap): add IAM Roles for performing CDK stack set deployments

### README

The `cdk.StackSet` construct in CDK defines AWS resources in a stack set and stack set
 configuration/deployment preferences.
 This is different from the `cdk.CfnStackSet` construct, which requires a CloudFormation stack that then deploys a CloudFormation stack set.
 The `cdk.StackSet` construct creates the stack set directly if it does not exist,
or updates a stack set and existing stack set instances while monitoring the stack set operation.

#### Prerequisites

To enable the use of self managed stack sets two roles must exist:

* **Stack Set Administration Role:** Role in the parent account, which is used by CloudFormation to assume the stack set execution role in the child account.
* **Stack Set Execution Role:** Role in the child accounts, which allows the stack set administration role in parent account to assume,
and perform the stack set instance deployment.

There are a few methods to creating the stack set roles:

1. CDK Bootstrap with default stack set roles
   * Bootstrap parent account
      * `cdk bootstrap aws://11111111111/us-east-1 --stack-set`
      * The region here is where the stack set will be created in the parent account.
   * Bootstrap child account
      * `cdk bootstrap aws://22222222222/us-east-1
            --stack-set
            --trust 11111111111
            --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess`
      * The child account **must** be bootstrapped to the same region where the parent account is bootstrapped.
      Although bootstrapping must be in the same region,
      stack set instances can still be provisioned in any region of the same AWS partion in the child account.
   * Specifying custom qualifier:
      * `cdk bootstrap aws://11111111111/us-east-1 --qualifier xyz`
      * `cdk bootstrap aws://22222222222/us-east-1
            --trust 11111111111
            --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
            --qualifier xyz`
      * Qualifier must match in both the parent and child accounts.
2. Manually create roles
   * AWS Guide: [Grant self-managed permissions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacksets-prereqs-self-managed.html)
      * The AWS documentation will guide you through creating the Stack Set Administration role for the parent account,
      and the Stack Set Execution roles for the child accounts.
   * The administration role and execution role name should be specified as part of the StackSet properties.

#### Usage

To define a stack set, extend the core construct `StackSet`.
Then define AWS resources in the same way as defining resources for stacks.
Compared to the `Stack` construct, the `StackSet` core construct has different properties specific to StackSets.
The properties define the configuration of the stack set and the preferences used for update operations.

**Example:**

```ts
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';

class PocStackSet extends cdk.StackSet {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackSetProps) {
        super(scope, id, props);

        new iam.Role(this, 'ExampleRole', {
          assumedBy: new iam.ServicePrincipal('s3.amazonaws.com')
        });
    }
}

// Using default cdk bootstrap stack set roles and default qualifier
new PocStackSet(app, 'poc-stack-set-1', {
  faultTolerancePercentage: 10,
  maxConcurrentPercentage: 10,
  regionConcurrencyType: cdk.StackSetRegionConcurrency.PARALLEL,
  //...
});

// Using default cdk bootstrap stack set roles with custom qualifier
new PocStackSet(app, 'poc-stack-set-2', {
  qualifier: 'xyz',
  faultTolerancePercentage: 10,
  maxConcurrentPercentage: 10,
  regionConcurrencyType: cdk.StackSetRegionConcurrency.PARALLEL,
  //...
});

// Using customized stack set roles
new PocStackSet(app, 'poc-stack-set-3', {
  administrationRoleName: 'AWSCloudFormationStackSetAdministrationRole',
  executionRoleName: 'AWSCloudFormationStackSetExecutionRole',
  faultTolerancePercentage: 10,
  maxConcurrentPercentage: 10,
  regionConcurrencyType: cdk.StackSetRegionConcurrency.PARALLEL,
  //...
});
```

**Deploy Stack Set:**

To deploy the stack set, the CLI command remains the same: `cdk deploy poc-stack-set`.
If the stack set **does not exist**, then CDK will create the stack set directly in CloudFormation.
If the stack set **does exist**,
then the stack set itself will be updated as well as all **existing** stack set instances.

**Creating Stack Set Instances:**

Before creating stack set instances, child accounts should be bootstrapped (or custom stack set roles created) and the initial stack set deployed.
Stack set instances can be added to the stack set by console/cli/api by specifying the child account id and region.
Future stack set deployments though CDK will update the stack set itself, and all existing stack set instances.

## FAQ

### What are we launching today?

The core construct StackSet, which will enable users to define stack sets directly from CDK.
A new Cloud Assembly artifact type for stack sets. CLI changes to enable deploying stack sets through CDK.

### Why should I use this feature?

This core constuct directly creates a CloudFormation stack set vs. provisioning a single stack that deploys a stack set.
The deployment also updates the stack set, updates existing stack set instances, and monitors the stack set operation.

### What is supported?

* Self Manged Stack Sets
  * Create, Update, and Update Existing Stack Set Instances directly through CDK

### What is not supported?

* Service Managed Stack Sets
* Stack Set Instance Add/Remove through CDK
* Stack Set Deletion
  * Stack Set deletion will not be included due complexities with collecting/deleting stack set instances before deleting the stack set itself
* CDK Assets (CDK File Assets/CDK Docker Assets)
  * CDK Assets will not be include in the iteration due to complexities around asset permissioning accross accounts and regions

## Internal FAQ

### Why are we doing this?

Today, CDK does not support the creation and updating of CloudFormation stack sets directly.
This solution would also enable deploying to existing stack sets with low effort.

CDK does provide the `cdk.CfnStackSet` construct, which could accomplish similar behavior.
The difference is that the `cdk.CfnStackSet` construct is a resource in a single CloudFormation stack with the resource type `AWS::CloudFormation::StackSet`,
where stack provisions the actual stack set.
This requires a 1:1 mapping of parameters and tags that need to be passed from the stack to the stack set.
Customer can deploy to existing stack sets, but requires some migration steps.
The customer would need to create a new stack,
and import the stack set into the resource `AWS::CloudFormation::StackSet`.

### Why should we _not_ do this?

We might not want to do this since CDK does provide the `cdk.CfnStackSet` construct, which could accomplish similar behavior.
The intermdiate stack may not be ideal for some customers, and may require large migration effort for customers who manage many stacksets.

### What changes are required to enable this change?

To enable this feature, we would need to introduce:

* A `StackSet` construct for customers to extend
* A new assembly/artifact type for the Cloud Assembly
* A new stack set synthesizer
  * A new stack set synthesizer is required to emit new stack set artifact and properties to the CloudAssembly
* Deployment code that creates/updates stack sets using AWS CloudFormation APIs

### Is this a breaking change?

No.

### What are the drawbacks of this solution?

The handling of CDK assets is more complex than a normal stack CDK app.
Stack set instances are deployed independently from CDK context, and exist in different accounts/regions.
This is dicussed more in the design details.

### What alternative solutions did you consider?

An alternative is the usage of `cdk.CfnStackSet`, which is not ideal for customers with existing stack sets since there is significant migration effort.

### What is the high level implementation plan?

* Update default boostrap template to include default stack set roles
* Create `StackSet` core construct
* Create StackSet artifact type in the Cloud Assembly
* Create StackSet Synthesizer
* Update CLI to collect StackSet artifact types in addition to Stacks
* Add deployment code for creating/updating stack sets

### Are there any open issues that need to be addressed later?

* CDK asset handling
* Future support for service managed stack sets
* Future support for delete stack set
* CDK Pipelines

## Appendix

### CDK Bootstrap CLI Changes

To support stack sets,
a stack set administration role should be created in the parent account and a stack set execution role should be created in the child accounts.
To make this process easier, default roles have been added to the default bootstrap template. (Bootstrapping steps describe in the README section).

**CLI Changes:**

* Update bootstrap CLI to include new flag `--stack-set`
  * If this flag is present, the bootstrap stack will create the stack set roles.
  * The bootstrap CLI will deploy the stack with the parameter `EnableCreateStackSetRoles` set to `true`.
* Update bootstrap CLI to generate administration role arns from the `--trust` argument
  * If the flag `--stack-set` and `--trust` argument is present,
  the bootstrap CLI will generate default stack set administration role arns.
  * The bootstrap CLI will deploy the stack with the parameter `TrustedStackSetAdminArns` set to a comma delimited list of the role arns.
  This adds the stack set administration role arns to the assume role policy of the stack set execution role.
  * Since the stack set execution role may have a large scope of permissions in the child account,
  stack set administration role arns are used instead of account ids.
  This scopes the assume role policy to specific roles versus any IAM entity in the parent account.

### CDK Bootstrap Template Changes

```yaml
Parameters:
  # ...
  EnableCreateStackSetRoles:
    Description: Flag to create stack set roles
    Default: false
    Type: String
    AllowedValues: [true, false]
  TrustedStackSetAdminArns:
    Description: List of stack set administration role arns that are trusted to
      assume the stack set execution role
    Default: ''
    Type: CommaDelimitedList
  # ...
Conditions:
  # ...
  CreateStackSetRoles:
    Fn::Not:
      - Fn::Equals:
          - 'false'
          - Ref: EnableCreateStackSetRoles
  HasTrustedStackSetAdminArns:
    Fn::Not:
      - Fn::Equals:
          - ''
          - Fn::Join:
              - ''
              - Ref: TrustedStackSetAdminArns
  # ...
Resources:
  # ...
  CloudFormationStackSetAdministrationRole:
    Condition: CreateStackSetRoles
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Action: sts:AssumeRole
            Effect: Allow
            Principal:
              Service: cloudformation.amazonaws.com
        Version: '2012-10-17'
      Policies:
        - PolicyName:
            Fn::Sub: cdk-${Qualifier}-stack-set-admin-role-policy-${AWS::AccountId}-${AWS::Region}
          PolicyDocument:
            Statement:
              - Action:
                  - sts:AssumeRole
                Resource:
                  - Fn::Sub: "arn:aws:iam::*:role/cdk-${Qualifier}-stack-set-exec-role-${AWS::Region}"
                Effect: Allow
            Version: '2012-10-17'
      RoleName:
        Fn::Sub: cdk-${Qualifier}-stack-set-admin-role-${AWS::AccountId}-${AWS::Region}
  CloudFormationStackSetExecutionRole:
    Condition: CreateStackSetRoles
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Action: sts:AssumeRole
            Effect: Allow
            Principal:
              AWS:
                Fn::GetAtt: CloudFormationStackSetAdministrationRole.Arn
          - Fn::If:
              - HasTrustedStackSetAdminArns
              - Action: sts:AssumeRole
                Effect: Allow
                Principal:
                  AWS:
                    Ref: TrustedStackSetAdminArns
              - Ref: AWS::NoValue
      ManagedPolicyArns:
        Fn::If:
          - HasCloudFormationExecutionPolicies
          - Ref: CloudFormationExecutionPolicies
          - Fn::If:
            - HasTrustedAccounts
            # The CLI will prevent this case from occurring
            - Ref: AWS::NoValue
            # The CLI will advertise that we picked this implicitly
            - - Fn::Sub: "arn:${AWS::Partition}:iam::aws:policy/AdministratorAccess"
      RoleName:
        # Role name does not contain account id since it must be identical across child accounts
        Fn::Sub: cdk-${Qualifier}-stack-set-exec-role-${AWS::Region}
  # ...
```
