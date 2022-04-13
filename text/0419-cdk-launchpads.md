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

1. Through a dedicated CLI, `cdk-lpads`. This is a self-contained program
  (does not have any dependencies -- for example, it does not depend on NodeJS)
  that can be installed using the idiomatic package managers for a given platform
  (`apt-get install cdk-lpads` on Ubuntu Linux, `yum install cdk-lpads` on CentOS Linux,
  `brew install cdk-lpads` on MacOS, etc.).
2. Through the existing CDK CLI, using the `cdk lpads` sub-command.
3. Through the AWS Console, which now contains a new section dedicated to CDK,
  which in turn contains options for managing your Launchpads.

### Basic commands

> **Note**: in this section, I show the commands only for the stand-alone CLI, `cdk-lpads ...`.
> The same commands would work in the CDK CLI without the dash (`cdk lpads ...`),
> but I'm only showing the standalone version for brevity.

#### 1. `status`

Shows the current status of any Launchpads defined in the given environment.

This invocation will use the current AWS credentials in the console:

```shell
$ cdk-lpads status

Environment - account: 123, region: us-east-1
1 Launchpad found:
1 | default CDK bootstrap Stack | version: 10   (UP-TO-DATE)
```

You can also check a specific account and region, using a profile defined in your AWS config files:

```shell
$ cdk-lpads status —profile acc-456 aws://456/eu-west-2

Environment - account: 456, region: eu-west-2
1 Launchpad found:
1 | legacy (V1) CDK bootstrap Stack
    Run `cdk-lpads update` to upgrade it to the newest version.
```

#### 2. `new`

Creates a new Launchpad in the given account and region.
By default, the command will include a wizard that will guide the user through the options:

```shell
$ cdk-lpads new

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

#### 3. `update`

This command attempts to update an existing Launchpad.
In the case it's the default CDK bootstrap Launchpad, it will simply update it to the latest version.
The `update` command can be customized directly, same as the `new` command;
see "Customizing the Launchpad" below.

#### 4. `diff`

Allows you to see what differences would be applied if you updated your Launchpad.
Useful to run before `update` to confirm the changes are what you expect.

#### 5. `init json/yaml/cdk [ts/js/java/python/csharp/go]`

Similar to the `cdk init` command,
this command creates a skeleton that allows you get started with customizing your Launchpad.
It supports both the JSON/YAML and CDK ways of customizing Launchpads (see below).

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
for example `cdk-lpads update my-launchpad.json/my-launchpad.yaml`.

Deploying the Launchpads through a pipeline will also be supported with
[CDK Pipelines](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html).

#### Customizing the Launchpad with CDK code

It's also possible to customize the Launchpad using CDK code.
In that scenario, the Launchpad is basically a CDK application, and you execute the Launchpads CLI commands,
like `cdk-lpads update`, inside of it, similarly like you execute CDK CLI commands inside your CDK application.

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

Compliance rules can be defined in JSON/YAML directly:

```json
{
  "launchpad": {
    "compliance": {
      "cfn-guard": {
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
    }
  }
}
```

Using CDK, you can either write them directly in the construct's body:

```ts
new lpads.CfnGuardComplianceRules(launchpad, 'Compliance', {
  rules: lpads.CfnGuardRules.fromString(`
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
});
```

Or use a special dialect of the CDK that allows creating CFN Guard Rules programmatically:

```ts
import * as cguard '@aws-cdk/launchpad-cfn-guard';

const s3Buckets = new cguard.Variable(launchpad, 's3_buckets', cguard.Query.resources({
  type: guard.Expr.matches(/S3::Bucket/),
}));
new lpads.CfnGuardComplianceRules(launchpad, 'Compliance', {
  rules: lpads.CfnGuardRules.fromObjects(
    new guard.Rule(launchpad, 's3_bucket_name_encryption_check', {
      when: cguard.Expr.not(cguard.Expr.empty(s3Buckets)),
      expr: guard.Query.properties({
        'BucketName': cguard.Expr.matches(/^MyCompanyPrefix/),
        'BucketEncryption.ServerSideEncryptionConfiguration[*]': cguard.Expr.in(
          'ServerSideEncryptionByDefault.SSEAlgorith', ['aws:KMS']
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

The `cdk-lpads` command contains a validator that makes sure any changes you make to the bootstrap template are correct,
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
// (seee below)
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
import Launchpad from '../build';

const app = new cdk.App({
    launchpad: Launchpad, // adds the appropriate Permission Boundary automatically
});
const stack = new cdk.Stack(app, 'MyStack');
const fn = new lambda.Function(stack, 'MyLambda', {
  code: new lambda.Code.fromAsset('lambda-code'),
  handler: 'index.handler',
  runtime: lambda.Runtime.PYTHON_3_9,
  // refer to a resource defined in the Launchpad
  role: Launchpad.Resources.functionRole,
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

### What is the high-level project plan?

1. Create the separate `cdk-lpads` CLI,  and add the necessary commands to it.
2. Concurrently:

    - work on the integration with AWS Organizations
    - work on the compliance rules (CFN Guard + CFN Hooks)
        * first, only in the text format
        * then, develop the CDK dialect for defining the rules using code

3. Allow the Launchpad customizing using JSON/YAML files.
4. Launch a Beta, working closely with a group (around 10) of customer, making sure the features being developed cover their usecases --
  for example, customers who operate in resticted IAM environments can now use CDK in them.
5. Develop the CDK libraries for customizing the Launchpad in code.
6. Perform the necessary AWS Console changes.
7. Add the capabilities of `cdk-lpads` also to the CDK CLI.

### Are there any open issues that need to be addressed later?

Yes. This is a high-level RFC that does not go into much detail as far as the implementation goes.
We will most likely need additional, shorter RFCs to disambiguate the bigger areas of this proposal,
such as:

1. Compliance.
2. Bootstrapping, and integration with AWS Organizations.
3. Shared resources, and restricted security environments.