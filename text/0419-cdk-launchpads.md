# CDK Launchpads

## Working Backwards

CDK Launchpads is a new functionality of the CDK project.
It is geared primarily towards platform or system administrators in enterprise settings who are responsible for managing
the AWS environments that are then used by application developers to deploy CDK applications into.

Launchpads can be thought of as an extension of the
[`cdk bootstrap` command](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html).
The bootstrap command creates a set of resources -- S3 Bucket with a KMS Key, ECR Repository, several IAM Roles, etc. --
that allow CDK applications to be deployed into a given AWS account and region.
Launchpads are extensions of those bootstrap Stacks.
They contain (by default) the same set of resources,
but also add several features that are not available in the bootstrap command, such as:

1. Ability to define compliance rules.
  It is impossible to deploy a CDK application to the given environment if it breaks any compliance rule defined in the Launchpad.
2. Easy customization of the bootstrap resources, like adding lifecycle policies to the ECR repository,
  changing the names of the generated Roles, or any other customization needed.
  With the existing bootstrap command,
  the only way these customizations are supported is by providing your own CloudFormation template.
3. Extending the predefined set of bootstrap resources with additional resources.
  Common examples are VPC networks, IAM Roles or Permission Boundaries, or Security Groups.
  These shared resources can then be easily referenced from CDK code by developers working in a given Launchpad
  (see below for details).
4. Launchpads integrate with AWS organizations,
  allowing easy creation of new accounts that have the given Launchpad provisioned when the account is created,
  alleviating the need for running any command, including `cdk bootstrap`, manually.
5. Launchpads can be configured to use a given Managed Policy as a Permission Boundary for all CDK applications deployed into the given environment.

Using Launchpads does not require any knowledge of the CDK --
in fact, it does not require knowing a programming language at all!

The functionality of CDK Launchpads can be accessed in three different ways:

1. Through a dedicated CLI, `cdk-launchpad`. This is a self-contained program
  (does not have any dependencies -- for example, it does not depend on NodeJS)
  that can be installed using the idiomatic package managers for a given platform
  (`apt-get install cdk-launchpad` on Ubuntu Linux, `yum install cdk-launchpad` on CentOS Linux,
  `brew install cdk-launchpad` on MacOS, etc.).
2. Through the existing CDK CLI, using the `cdk launchpad` sub-command.
3. Through the AWS Console, which now contains a new section dedicated to CDK,
  which in turn contains options for managing your Launchpads.

### Basic commands

> **Note**: in this section, I show the commands only for the stand-alone CLI, `cdk-launchpad ...`.
> The same commands would work in the CDK CLI without the dash (`cdk launchpad ...`),
> but I'm only showing the standalone version for brevity.

#### 1. `init json/yaml/cdk [ts/js/java/python/csharp/go]`

Similar to the `cdk init` command,
this command creates a skeleton that allows you get started with customizing your Launchpad.
It supports both the JSON/YAML and CDK ways of customizing Launchpads (see below).

#### 2. `new`

Creates a new Launchpad in the given account and region.
By default, the command will include a wizard that will guide the user through the options:

```shell
$ cdk-launchpad new

Welcome! This wizard will guide you through creating a new Launchpad in the environment.
To start, let's make sure we're operating in the correct AWS account and region:

Environment - account: 123, region: eu-west-2

Does this look correct? [Y/N] Y

Looks like the environment aws://123/eu-west-2 doesn't have any existing Launchpads.

Do you want to customize the qualifier used? [default: hnb659fds]:
...
```

Alternatively, the `new` command can be customized directly, instead of going through the wizard;
see "Customizing the Launchpad" below.

#### 3. `diff`

Allows you to see what differences would be applied if you updated your Launchpad.
Useful to run before `update` to confirm the changes are what you expect.

#### 4. `update`

This command attempts to update an existing Launchpad.
In the case it's the default CDK bootstrap Launchpad, it will simply update it to the latest version.
The `update` command can be customized directly, same as the `new` command;
see "Customizing the Launchpad" below.

#### 5. `status`

Shows the current status of any Launchpads defined in the given environment.

This invocation will use the current AWS credentials in the console:

```shell
$ cdk-launchpad status

Environment - account: 123, region: us-east-1
1 Launchpad found:
1 | default CDK bootstrap Stack | version: 10   (UP-TO-DATE)
```

You can also check a specific account and region, using a profile defined in your AWS config files:

```shell
$ cdk-launchpad status —profile acc-456 aws://456/eu-west-2

Environment - account: 456, region: eu-west-2
1 Launchpad found:
1 | legacy (V1) CDK bootstrap Stack
    Run `cdk-launchpad update` to upgrade it to the newest version.
```

### Ways of customizing the Launchpad

The default Launchpad contains the same resources as the `cdk bootstrap` command (in version 2) creates.
A CDK Launchpad can be customized with the following additional options:

1. Compliance rules.
2. Additional resources (deployed using CloudFormation, CDK, or in any other way, and simply referenced by the Launchpad).
3. Modifications to the CDK bootstrap resources (using either CloudFormation templates or CDK).
4. Setting IAM Permission Boundaries used by all applications deployed into a given environment.

There are two ways of customizing a Launchpad: using JSON/YAML files, or using CDK code.

#### Customizing the Launchpad with JSON/YAML files

This option of customizing the Launchpad is geared primarily towards platform administrators
who don't want to use a programming language (and thus, CDK code) to customize their Launchpads.
Using a JSON or YAML file in a specific format allows customizing all aspects of the Launchpad,
without the need to write a single line of code.

The JSON file has the basic structure (the YAML file is very similar):

```json
{
  "launchpad": {
    ...
  }
}
```

We show examples of different parts of the JSON file in each of the sections below.

You apply the changes using the JSON/YAML file by passing the file as an argument to the Launchpad commands,
for example `cdk-launchpad update my-launchpad.json/my-launchpad.yaml`.

Deploying the Launchpads through a pipeline will also be supported with
[CDK Pipelines](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html).

#### Customizing the Launchpad with CDK code

It's also possible to customize the Launchpad using CDK code.
In that scenario, the Launchpad is basically a CDK application, and you execute the Launchpads CLI commands,
like `cdk-launchpad update`, inside of it, similarly like you execute CDK CLI commands inside your CDK application.

A CDK application for a Launchpad has a very similar structure to a "regular" CDK application,
but the classes used are slightly different (the example is in TypeScript):

```ts
import * as lpads from '@aws-cdk/cdk-launchpads';

const launchpad = new lpads.Launchpad();
new lpads.StandardCdkBootstrap(launchpad, 'CdkBootstrap', {
  // options to customize the CDK bootstrap can be passed here...
});

// additional things can be changed in the Launchpad here...

launchpad.synth();
```

This CDK application will synthesize to the JSON configuration mentioned above,
similarly like "regular" CDK applications synthesize to CloudFormation templates.

We will show details of customizing the Launchpad using CDK code in each of the sections below.

### Launchpad features

#### Compliance

Compliance rules allow administrators to restrict what kind of AWS resources can be deployed in a given environment.
They can be used both for security purposes,
but also for things like checking whether a given application conforms to the AWS Well-Architected principles.

Launchpads allow defining compliance rules using the
[CFN Guard 2.0 tool](https://github.com/aws-cloudformation/cloudformation-guard).
Those compliance rules are then deployed as
[CloudFormation Hooks](https://docs.aws.amazon.com/cloudformation-cli/latest/userguide/hooks.html),
which means it's impossible to deploy a CDK application into a given environment that violates any compliance rule defined for it.

When importing the Launchpad into your CDK app (see below),
the Compliance rules get imported as well,
meaning they will be evaluated at `synth` time in addition to at deploy time,
to provide developers the quickest possible feedback loop on whether their apps are compliant or not.

Compliance rules can be defined in JSON/YAML directly:

```json
{
  "launchpad": {
    "compliance": {
      "cfn-guard": [
        {
          "common": [
            "let s3_buckets = Resources.[ Type == /S3::Bucket/ ]"
          ],
          "rules": {
            "s3_bucket_name_encryption_check": {
              "$when": "%s3_buckets !empty",
              "%s3_buckets": {
                "Properties": {
                  "BucketName": "== /^MyCompanyPrefix/",
                  "BucketEncryption.ServerSideEncryptionConfiguration[]": {
                    "ServerSideEncryptionByDefault.SSEAlgorithm": "IN ['aws:KMS']"
                  }
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

Or you can reference a file on disk that contains the Guard rules:

```json
{
  "launchpad": {
    "compliance": {
      "cfn-guard": [
        "file:my-guard-rules.guard",
        "dir:my-other-guard-rules"
      ]
    }
  }
}
```

Using CDK, you can either write them directly in the construct's body,
or again reference a file on disk:

```ts
new lpads.CfnGuardComplianceRules(launchpad, 'Compliance', {
  rules: [
    lpads.CfnGuardRules.fromString(`
      let s3_buckets = Resources.[ Type == /S3::Bucket/ ]

      # Skip the checks if there are no S3 buckets present
      rule s3_bucket_name_encryption_check when %s3_buckets !empty {
        %s3_buckets {
          Properties {
            # common prefix
            BucketName == /^MyCompanyPrefix/

            # encryption MUST BE on
            BucketEncryption.ServerSideEncryptionConfiguration[*] {
              # only KMS
              ServerSideEncryptionByDefault.SSEAlgorithm IN ["aws:KMS"]
            }
          }
        }
      }
    `),
    lpads.CfnGuardRules.fromFile('my-guard-rules.guard'),
  ],
});
```

Or use a special dialect of the CDK that allows creating CFN Guard Rules programmatically:

```ts
import * as cfn_guard from '@aws-cdk/cfn-guard';

const s3Buckets = new cfn_guard.Variable(launchpad, 's3_buckets', cfn_guard.Query.resources({
  type: guard.Expr.matches(/S3::Bucket/),
}));
new lpads.CfnGuardComplianceRules(launchpad, 'Compliance', {
  rules: lpads.CfnGuardRules.fromObjects(
    new cfn_guard.Rule(launchpad, 's3_bucket_name_encryption_check', {
      when: cfn_guard.Expr.not(cfn_guard.Expr.empty(s3Buckets)),
      expr: cfn_guard.Query.properties({
        'BucketName': cfn_guard.Expr.matches(/^MyCompanyPrefix/),
        'BucketEncryption.ServerSideEncryptionConfiguration[*]': cfn_guard.Expr.in(
          'ServerSideEncryptionByDefault.SSEAlgorith', ['aws:KMS'],
        ),
      }),
    }),
  ),
});
```

#### Customizing the base bootstrap resources

The default set of resources that get created by the `cdk bootstrap` command can be customized using the Launchpad.

It can be done both using JSON/YAML:

```json
{
  "launchpad": {
    "bootstrap": {
      "patch": {
        "description": "Turn off image scanning on push",
        "operations": [
          {
            "op": "replace",
            "path": "/Resources/ContainerAssetsRepository/Properties/ImageScanningConfiguration/ScanOnPush",
            "value": false
          }
        ]
      }
    }
  }
}
```

And CDK code:

```ts
new lpads.StandardCdkBootstrap(launchpad, 'CdkBootstrap', {
  imageRepository: lpdas.CdkBootstrapImageRepository.default({
    scanOnPush: false, // default: true
  }),
});
```

The `cdk-launchpad` command contains a validator that makes sure any changes you make to the bootstrap template are correct,
and satisfy the minimal requirements needed by CDK in order to still deploy using those bootstrap resources.

#### Adding new bootstrap resources

You can also add new resources to the Launchpad that you want to be shared between all applications deployed into this environment.
Application developers can then easily import these resources into their CDK applications.

You can add the new resources using JSON/YAML files:

```json
{
  "launchpad": {
    "resources": {
      "cfn": {
        "Resources": {
          "PermissionBoundaryPolicy": {
            "Type": "AWS::IAM::ManagedPolicy",
            "Properties": {
              "PolicyDocument": {
                "Statement": [
                  {
                    "Action": "iam",
                    "Effect": "Deny",
                    "Resource": "*"
                  }
                ],
                "Version": "2012-10-17"
              },
              "Description": "The managed policy used as the permission boundary"
            }
          }
        }
      },
      "export": {
        "permissionBoundaryPolicy": {
          "Ref": "PermissionBoundaryPolicy"
        }
      }
    }
  }
}
```

And also with CDK, using the same CDK libraries that are used for applications:

```ts
import * as iam from 'aws-cdk-lib/aws-iam';

const managedPolicy = new iam.ManagedPolicy(launchpad, 'Boundary', {
  statements: [
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ['iam:'],
      resources: [''],
    }),
  ],
});
// surface this resource to application developers using this Launchpad
// (see below)
launchpad.export(managedPolicy);
```

#### IAM Permission Boundaries

Launchpads allow setting a given Managed Policy as the Permissions Boundary to be used by every application deployed into a given environment.

You can do it through JSON/YAML:

```json
{
  "launchpad": {
    "iam": {
      "permissionBoundary": {
        "Ref": "PermissionBoundaryPolicy"
      }
    }
  }
}
```

Or in CDK code:

```ts
launchpad.setPermissionBoundaryPolicy(managedPolicy);
```

### Importing the Launchpad in CDK code

Once a Launchpad has been deployed by the administrators,
application developers can import it using the
[`cdk-import` tool](https://github.com/cdklabs/cdk-import)
(whose functionality will be incorporated into the main CDK CLI in the future).

Executing the following command:

```shell
$ cdk-import launchpad -l typescript
```

Will generate code in your project that you then use in your CDK app definition:

```ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import launchpad from '../build';

const app = new cdk.App({
    launchpad: launchpad, // adds the appropriate Permission Boundary automatically
});
const stack = new cdk.Stack(app, 'MyStack');
const fn = new lambda.Function(stack, 'MyLambda', {
  code: new lambda.Code.fromAsset('lambda-code'),
  handler: 'index.handler',
  runtime: lambda.Runtime.PYTHON_3_9,
  // refer to a resource defined in the Launchpad
  role: launchpad.Resources.functionRole,
});
```

Additionally, importing the Launchpad in that way will produce a warning during `cdk deploy`
if the version of the Launchpad in your environment is older than the current latest version of the Launchpad,
and will ask you to update.

### Integrating Launchpads with AWS Organizations

Launchpads will integrate with AWS Organizations.
When creating a new account using the AWS Console for Organizations,
you'll be able to specify which Launchpad that account should use.
This means the account will be provisioned ready for CDK deployments from the start -
there will be no need for any manual actions, like running `cdk bootstrap`.

## Public FAQ

### What are we launching today?

We are launching CDK Launchpads,
a product that allows platform administrators in enterprise environments to easily configure AWS environments for deploying CDK applications.

### Why should I use this feature?

You should use this feature if you're a platform administrator who is responsible in your company/organization for the management of AWS environments,
and your organization is either already using CDK for application development,
or is considering it.

### Can you write custom handlers for compliance rules?

Currently, this RFC does not allow for this capability — only rules written using the CFN Guard 2.0 dialect are supported.

### What are some potential failure modes?

1. Trying to import a Launchpad into your code that doesn’t exist --
  results in an error from the `cdk-import` command.
2. Removing resources (either through the AWS Console, or using the AWS APIs) from an existing Launchpad --
  breaks the Launchpad.
3. Trying to run `cdk bootstrap` in an environment with a custom Launchpad --
  will overwrite the Launchpad with the default bootstrap Stack.
  We can try to modify the `cdk bootstrap` command to try and detect that situation, and fail
  (and maybe still allow it with a `--force` option).

## Internal FAQ

### Why are we doing this?

We are doing this to make it easier for platform administrators to enable application developers to use CDK in their organization.

### Why should we *not* do this?

1. This RFC describes a very big and ambitious set of features, spanning multiple UIs, AWS services, and tools.

    It is also pretty ambiguous in places (for example, the AWS Organizations integration, and the CloudFormation compliance piece).

    Given that, this project is certain to require a large effort from our team.
    However, we are not 100% certain the features provided here will be enough to unblock customers who cannot use the CDK today.
    That's why the implementation plan (see below) contains a Beta period.

    Because of its size, scope and ambiguity, the project also has a high degree of risk.

2. For the restricted security aspect of this RFC, the CDK L2 and higher constructs often create IAM Roles.
  Because many compliance policies don't allow this, the mechanisms to enforce this on construct authors are fairly ambiguous,
  not clear how to implement, and pose another risk.
3. Integrating with AWS Organizations, and having a presence in the AWS Console,
  will require owning server-side components.
  Maintaining them will put additional strain on the CDK team.

### What is the technical solution (design) of this feature?

This is a good question, but outside the scope of this document, considering how big the proposed functionality is.

### Is this a breaking change?

No.

### What alternative solutions did you consider?

The alternative is to not create a big project like Launchpads,
but tackle each aspect (compliance, bootstrapping, shared resources, etc.)
separately, as its own project.

### What are the drawbacks of this solution?

We will be introducing both a lot of complexity to the already complex CDK CLI,
and also a separate CLI that we will have to maintain.

It might also require the CDK team to own new server-side components,
like a new AWS Console, and a new service that integrates with AWS Organizations.

### What is the high-level project plan?

Since this is quite a big and ambiguous project,
the project plan is a little more detailed than usual.

The plan is divided into the following milestones:

#### Milestone 1: alpha version of automated bootstrapping

In the first version of the Launchpads functionality,
we want to automate the setup of new accounts in an AWS Organization,
eliminating the need for running `cdk bootstrap` manually,
while validating that the approach works before we invest more into it --
so, we will not have any server-side components the CDK team owns at this stage of the project.

To achieve this goal, we will allow administrators to define a StackSet, using CDK constructs
(similarly to the [`ProductStack` class](https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_aws-servicecatalog.ProductStack.html)
in the ServiceCatalog Construct Library).
We will also create construct(s) that represent the CDK bootstrap resources,
and allow customizing them.

In order to automatically bootstrap new accounts that get added to a given Organization,
we will use the [CDK Pipelines library](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html).
The StackSet will live in a separate Stack, deployed to the primary account.
Any time a new account is added, a CloudWatch Event will trigger the pipeline,
then a CodeBuild job in the pipeline will use the Organizations API to find out all accounts that belong to it,
and finally will update the StackSet resource to deploy Stack instances to each account in the organization
(that update to the StackSet resource will be done by simply deploying the CloudFormation Stack it belongs to,
with the changed property listing all the organization's accounts).

#### Milestone 2: alpha version of Compliance -- CFN Guard integration

Concurrently with milestone 1 above, we should start working on the compliance piece.
As the first step, we should integrate CFN Guard 2.0 with CDK more tightly,
so it's possible to evaluate Guard rules at CDK synthesis time,
without the explicit need to run the two commands (CDK and Guard) separately.

#### 3. Beta period

After 1. and 2. above are done, we should run a Beta,
working closely with a group (around 10) of customers,
making sure the features being developed cover their usecases.
For customers who operate in restricted IAM environments,
we want to verify that automated bootstrapping of developer accounts unblocks them from using CDK,
and if it doesn't -- we need to work with them on additional Launchpad features that will.

#### Milestone 4: Compliance -- integration with CFN Hooks

After the Beta (or possibly during it), once we have the basic integration between CDK and CFN Guard done,
we should start working on making sure the Guard rules are also evaluated at deploy time,
not only at synthesis time.

In this milestone, we should only allow rules to be either verbatim included as a string,
or referenced from a file, in CDK code --
the CDK dialect for defining rules will come later.

#### Milestone 5: Code generation from the Launchpad

Concurrently with the Compliance work, we should start modifying the `cdk-import`
tool to allow it to generate CDK code based on the Launchpad definition.

#### Milestone 6: non-CDK customizations

After the base functionality has been created and validated,
we should now start catering to customers who don't want to use CDK to define their Launchpads:

1. Create the separate `cdk-launchpad` CLI,  and add the necessary commands to it.
2. Allow the Launchpad customizing using JSON/YAML files.
3. Add the capabilities of `cdk-launchpad` also to the CDK CLI.

#### Milestone 7: Compliance -- Guard rules CDK dialect

In this milestone, we develop the CDK dialect for defining CFN Guard rules.

#### Milestone 8: server-side AWS Organizations integration

In this milestone, we finally start developing server-side components.
The first one allows integrating with AWS Organizations,
so that we don't need a pipeline for the automatic bootstrapping functionality.

#### Milestone 9: CDK Console

In the final stage of the project, we develop a separate AWS Console for CDK.
This allows us to integrate with Organizations with a nice GUI,
and also opens the door for more visualizations,
like showing your Launchpads in the Console,
without having to use a CLI for that purpose.

#### Milestone 10: CDK service

To take the ideas in this RFC to its logical conclusion,
we can imagine turning this capability from a client-side tool to a managed AWS service.
And that point, the `cdk-launchpad` CLI would become redundant,
replaced with the AWS CLI, or the various AWS SDKs available in the different languages,
and creating and customizing Launchpads would be completely owned by this service.

### Are there any open issues that need to be addressed later?

Yes. This is a high-level RFC that does not go into much detail as far as the implementation goes.
We will most likely need additional, shorter RFCs to disambiguate the bigger areas of this proposal,
such as:

1. Compliance.
2. Bootstrapping, and integration with AWS Organizations.
3. Shared resources, and restricted security environments.
