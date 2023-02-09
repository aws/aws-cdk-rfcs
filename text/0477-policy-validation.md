# CDK Policy validation

* **Original Author(s):**: @otaviomacedo, @corymhall
* **Tracking Issue**: <https://github.com/aws/aws-cdk-rfcs/issues/477>
* **API Bar Raiser**: @iliapolo

Allows users to validate that their CDK application complies with infrastructure policies at synthesis time. Integrates
with third party policy-as-code tools, such as CloudFormation Guard, OPA and Checkov.

## Working Backwards

### Policy Validation

It is possible to use policy as code tools such
as [CloudFormation Guard](https://docs.aws.amazon.com/cfn-guard/latest/ug/what-is-guard.html)
or [OPA](https://www.openpolicyagent.org/) to evaluate the compliance of CDK applications.

CDK Policy Validation should never be used as a deployment gate or as the enforcement layer. It should instead be
thought of as developer enablement. This is not a tool that organizations should use to ensure developers actually
configure the validations. What prevents them from simply omitting it, or making a mistake? Well, nothing really, when
developers are writing applications, there's always going to be some setup they need to do. The goal of CDK Policy
Validation is to minimize it, and make it as easy as possible. For example, a typical workflow could be:

* Developer writes a CDK application without the correct validations config.
* Developer deploys non-compliant stacks.
* Deployment guardrails catch these violations, and instruct the developer to add a validations property to their
  application.
* Developer adds the validations property, and avoids these violations going forward.

Policy as code tools are integrated with CDK through a plugin mechanism so in order to add policy enforcement for a
specific tool you need to first specify the plugin to use. This can be done by importing the plugin and applying it to a
scope.

```ts
// globally for the entire app (an app is a stage)
import { CfnGuardValidator } from '@aws-cdk/cfn-guard-validator';

const app = new App({
  validationPlugins: [
    new CfnGuardValidator({
      rules: [
        Rules.fromAsset('../my-local-rules'),
        Rules.fromDownload('https://somelocation.com', {
          auth: {},
        }),
        Rules.fromS3(s3Location),
        Rules.fromRequest('https://someendpoint.com'),
        ],
      options: {
        someOption: "value",
      },
    }),
  ],
});

// only apply to a particular stage
const prodStage = new Stage(app, 'ProdStage', {
  validationPlugins: [...],
});
```

#### Alternative

```ts
const app = new App();
Validations.of(app).add(new CfnGuardValidator());
```

When you synthesize the CDK app the validator plugins will be called and the results will be printed.

```text
$ cdk synth

Validation Report (CfnGuardValidator)
-------------------------------------

(Summary)

╔═══════════╤════════════════════════╗
║ Status    │ failure                ║
╟───────────┼────────────────────────╢
║ Plugin    │ CfnGuardValidator      ║
╟───────────┼────────────────────────╢
║ Version   │ 1.3.4                  ║
╟───────────┼────────────────────────╢
║ Customize │ (policy location.      ║
║ policy    │                        ║
╚═══════════╧════════════════════════╝

(Violations)

Ensure S3 Buckets are encrypted with a KMS CMK (2 occurrences)

  Occurrences:
  
    - Construct Path: cdk-app/MyStack/Bucket/Resource
    - Stack Template Path: ./cdk.out/MyStack.template.json
    - Creation Stack: [
        'new Bucket (/home/hallcor/tmp/cdk-tmp-app/node_modules/aws-cdk-lib/aws-s3/lib/bucket.js:1:12889)',
        'new MyStack (/home/hallcor/tmp/cdk-tmp-app/src/main.ts:9:20)',
      ]
    - Resource Name: my-bucket
    - Locations:
      > BucketEncryption/ServerSideEncryptionConfiguration/0/ServerSideEncryptionByDefault/SSEAlgorithm

  Recommendation: Missing value for key `SSEAlgorithm` - must specify `aws:kms`
  How to fix:
    > Using override `app.findChild('my-bucket').addPropertyOverride('SSEAlgorithm', 'aws:kms');`
    > Add to construct properties for `cdk-app/MyStack/Bucket`
      `encryption: BucketEncryption.KMS`

  
Validation failed. See above reports for details
```

### Adding Exemptions/Suppressions

> Prior art: [cdk-nag](https://github.com/cdklabs/cdk-nag).

There may be cases where you would like to suppress a certain rule. To do so you must specify the rule to suppress and
the reason for the suppression.

A suppression can be added for all resources under a construct scope. For
example to add suppressions for an entire stack.

```ts
import { Stack, Validations } from 'aws-cdk-lib';

const stack = new Stack(app, 'DevStack');
Validations.of(stack).addSuppression({
  rule: 'S3BucketEncryption'
  reason: 'Dev environment buckets do not have to be encrypted'
});
```

They can also be added for specific resources.

```ts
class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    const bucket = new Bucket(this, 'MyBucket');
    Validations.of(bucket).addSuppression({
      rule: 'S3BucketEncryption',
      reason: 'This bucket does not require encryption because xyz',
    });
  }
}
```

Each plugin will determine how the suppressions are handled for the specific tool used, but the CDK will also synthesize
the suppressions into the template metadata.

```json
{
  "Resources": {
    "MyBucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": {...},
      "Metadata": {
        "cdk_validations": {
          "rules_to_suppress": [
            "rule": "S3BucketEncryption",
            "reason": 'This bucket does not require encryption because xyz'
          ]
        }
      }
    }
  }
}
```

This behavior can be disabled by providing the `validationMetadata: false` property.

```ts
new App({
  validationMetadata: false,
});
```

**Example of how CFN Guard rules handle suppression:**
<https://github.com/aws-cloudformation/aws-guard-rules-registry/blob/main/rules/aws/amazon_s3/s3_bucket_server_side_encryption_enabled.guard>

Rule snippet:

```text
let s3_buckets_server_side_encryption = Resources.*[ Type == 'AWS::S3::Bucket'
  Metadata.guard.SuppressedRules not exists or
  Metadata.guard.SuppressedRules.* != "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"
]
```

The CFN Guard plugin would then generate that metadata in the template

```json
{
  "Resources": {
    "MyBucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": {
        ...
      },
      "Metadata": {
        "guard": {
          "SuppressedRules": [
            "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"
          ]
        },
        "cdk_validations": {
          "rules_to_suppress": [
            "rule"
            :
            "S3BucketEncryption",
            "reason"
            :
            "This bucket does not require encryption because xyz"
          ]
        }
      }
    }
  }
}
```

### Creating a plugin

A plugin can be created in any language supported by CDK. If you are creating a plugin that might be consumed by
multiple languages then it is recommended that you create the plugin in `TypeScript` so that you can use JSII to publish
the plugin in each CDK language.

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```text
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new feature in the AWS CDK, that allows users to validate their CDK applications against externally defined policies.
These policies are constraints on the properties and shape of the resources that can be created in an AWS account. For
instance, a policy may specify that all S3 buckets should be encrypted using a customer managed KMS key, and that the
KMS key, in turn, must have certain policies attached to it.

There are many tools in the market that allow customers to define these policies using a domain specific language (DSL)
or a library written in a general purpose programming language. Taking a set of CloudFormation templates and a set of
policies, these tools check whether any template violates any policy and report the violations to the user accordingly.
This launch allows users to integrate one or more of these tools in the CDK synthesis flow, so that, if their
application produces a non-compliant CloudFormation template, they get the feedback immediately.

### Why should I use this feature?

By validating the generated CloudFormation template at synthesis time, the CLI increases your productivity as an
application developer. Instead of waiting hours for your changes to go through a pipeline and then be blocked because
some template is non-compliant, you can get this feedback immediately, every time you synthesize the cloud assembly. If
your application is not compliant, the CLI will report error messages, how to fix the issues (depending on the
integrated tool) and the offending construct.

## Internal FAQ

### Why are we doing this?

One of the recurring complaints about the CDK from large enterprise customers is that it generates many resources
automatically. While this is the original intent of the CDK, it also creates a challenge from a security and compliance
standpoint; the generated resource definitions might not satisfy the rules defined by the central operations teams,
which, at best, creates delays — as a result of development rework if the issues are caught before deployment — and, at
worst, may expose the customer to attacks or lawsuits.

By integrating policy-as-code tools in the synthesis flow, we give the confidence that these customers need to adopt the
CDK at a larger scale.

### What is the technical solution (design) of this feature?

See [Appendix A - High level design](https://quip-amazon.com/lDPqAisXjVP6#temp:C:CaFafef0ee17e804c3bb00434ff5).

### Is this a breaking change?

No.

### What alternative solutions did you consider?

We have considered two alternative solutions:

#### Validation in the CLI

With this solution, the validation would be done in the CLI, rather than in the framework. With this approach, users
would configure the validation plugins using a config file (cdk.json would be a natural candidate):

```json
"validations": {
    "package": "cdk-cfn-guard",
    "class": "CfnFuardValidation",
    "version": "1.2.3"
}
```

The CLI would read this file, load the appropriate plugins either from the filesystem or directly from NPM, and call
them to get a validation report.

We eventually discarded this option for the following reasons:

* All plugins would have to be written in TypeScript/JavaScript for them to be consumable by the CLI.
* The CLI lacks contextual information that would be useful for tracing the problem back to where it was defined.
* If an application is synthesized without using the CDK CLI, it’s not subject to policy validation.

#### CloudFormation hooks integration

Instead of integrating with each policy tool individually, we have considered the option of developing a single
mechanism, that would integrate with CloudFormation hooks. The idea was to invoke the Lambda function underlying a
CloudFormation hook and interpret its results in a similar way CloudFormation, that is, by failing synthesis if the
function reported a validation failure.

However, the Lambda functions invoked by CloudFormation hooks are not deployed to the customer’s account, but to an
account owned by AWS. This makes this solution not feasible.

### What are the drawbacks of this solution?

In many cases, plugins will need a third party tool installed on the developer's computer, such as a CLI. These tools
are installed and managed separately from the CDK. This isn't a drawback — in fact, this separation of concerns is
necessary for this feature to be extensible — but it places an extra burden on plugin authors. A developer of a CDK
application that uses a given plugin may not have the necessary tools installed beforehand, when they synthesize the app
for the first time. Plugin authors must then make sure that developers can install these tools with as little friction
as possible to deliver a good user experience.

### What is the high-level project plan?

The first release of this feature will include integration with CloudFormation Guard. To make sure that our design is
not tied to a specific vendor, we will also work on a prototype for the integration with a second policy checking tool (
TBD). As usual with new CDK features, policy checking at synth time will be marked as experimental while we collect
feedback from the community, fix bugs and stabilize the API. Once it’s promoted to stable, we’ll go back to the
integration prototype and release it as a second officially supported integration.

### Are there any open issues that need to be addressed later?

No.

## Appendix

### Appendix A - High level design

![Class diagram for policy validation](https://github.com/aws/aws-cdk-rfcs/blob/otaviom/rfc-0477/images/policy-validation/validation.png?raw=true)

The main abstraction of the model is that of a validation plugin. A plugin encapsulates a piece of logic that includes
one or more of these activities:

* Loading policy files from a central location.
* Calling a REST API to perform the validation.
* Shelling out to a third-party CLI.
* Interpreting the output of the policy-as-code tool and converting it to a common format that the framework can work
  with.

All plugins should implement the same interface, defined in the `core` library (provisionally called `ValidationPlugin`
here). This interface defines a common set of inputs and outputs that each plugin should conform to.

Zero or more plugins may be added to the CDK application's `App` instance. At some point during synthesis (
see [Appendix B - Implementation details](https://quip-amazon.com/lDPqAisXjVP6#temp:C:CaF0a4aad817a2a4fa9ab60206e2) for
some possibilities) the framework will pass the generated CloudFormation template to all the plugins, collect the output
and print the results. If there is any blocking violation an exception will be thrown, causing the synthesis to fail.

### Appendix B - Implementation details

There are at least two different places where we can hook the validation logic in the synthesis flow.

#### **Option 1: part of stack synthesizer**

When you add a plugin to an app it gets added in a way that it can be accessed by the synthesizer.
Currently the call to `synthesizeTemplate` will call the stack method `_synthesizeTemplate` which actually writes the
stack template file to disk. We could continue to do this and have the plugins read from disk or we could just pass the
object to the plugin. My assumption is that most tools will require some template on disk anyway.

```ts
// exerpt from DefaultStackSynthesizer
export class DefaultStackSynthesizer {
  public synthesize(session: ISynthesisSession): void {
    ...
    const templateAssetSource = this.synthesizeTemplate(session, ...); // already exists
    this.validator.validate(templateAssetSource); // new
    ...
  }
}
```

#### **Option 2: Separate phase after synthesis**

```ts
export function synthesize(root: IConstruct, options: SynthesisOptions = {}): cxapi.CloudAssembly {
  // add the TreeMetadata resource to the App first
  injectTreeMetadata(root);
  // we start by calling "synth" on all nested assemblies (which will take care of all their children)
  synthNestedAssemblies(root, options);

  invokeAspects(root);

  injectMetadataResources(root);

  // resolve references
  prepareApp(root);

  // give all children an opportunity to validate now that we've finished prepare
  if (!options.skipValidation) {
    validateTree(root);
  }

  // in unit tests, we support creating free-standing stacks, so we create the
  // assembly builder here.
  const builder = Stage.isStage(root)
    ? root._assemblyBuilder
    : new cxapi.CloudAssemblyBuilder(options.outdir);

  // next, we invoke "onSynthesize" on all of our children. this will allow
  // stacks to add themselves to the synthesized cloud assembly.
  synthesizeTree(root, builder, options.validateOnSynthesis);

  invokeValidationPlugins(); // do validations after synthesis has completed.

  return builder.buildAssembly();
}
```

### Appendix C — Examples of tool outputs

See below some example results from some of the policy-as-code tools available in the market. These tools have the
option to output the results in a structured format (such as JSON), but we’re showing the pretty-printed version here to
make it easier for the reader to focus on the content.

#### CloudFormation Guard

```text
Resource = bucket43879C71 {
  Type      = AWS::S3::Bucket
  CDK-Path  = CfnGuardDemoStack/bucket/Resource
  Rule = s3_bucket_versioning {
    ALL {
      Check =  VersioningConfiguration EXISTS   {
        Message = Bucket versioning is not configured (i.e. disabled).
        RequiredPropertyError {
          PropertyPath = /Resources/bucket43879C71/Properties[L:4,C:17]
          MissingProperty = VersioningConfiguration
          Reason = Could not find key VersioningConfiguration inside struct at path /Resources/bucket43879C71/Properties[L:4,C:17]
          Code:
                2. "Resources": {
                3.  "bucket43879C71": {
                4.   "Type": "AWS::S3::Bucket",
                5.   "Properties": {
                6.    "BucketEncryption": {
                7.     "ServerSideEncryptionConfiguration": [
        }
      }
    }
  }
```

#### Checkov

```text
Check: CKV_AWS_116: "Ensure that AWS Lambda function is configured for a Dead Letter Queue(DLQ)"
        FAILED for resource: AWS::Lambda::Function.MyFunction3BAA72D1
        File: /cdk.out/CheckovDemoStack.template.json:37-59
        Guide: https://docs.bridgecrew.io/docs/ensure-that-aws-lambda-function-is-configured-for-a-dead-letter-queue-dlq

                37 |   "MyFunction3BAA72D1": {
                38 |    "Type": "AWS::Lambda::Function",
                39 |    "Properties": {
                40 |     "Code": {
                41 |      "ZipFile": "foobar"
                42 |     },
                43 |     "Role": {
                44 |      "Fn::GetAtt": [
                45 |       "MyFunctionServiceRole3C357FF2",
                46 |       "Arn"
                47 |      ]
                48 |     },
                49 |     "Handler": "/Users/otaviom/pac-demo/checkov-demo/lib/handler",
                50 |     "ReservedConcurrentExecutions": 100,
                51 |     "Runtime": "nodejs16.x"
                52 |    },
                53 |    "DependsOn": [
                54 |     "MyFunctionServiceRole3C357FF2"
                55 |    ],
                56 |    "Metadata": {
                57 |     "aws:cdk:path": "CheckovDemoStack/MyFunction/Resource"
                58 |    }
                59 |   },

```

#### cfn-nag

```text
------------------------------------------------------------------------------------------------------------------------
| WARN W10
|
| Resource: ["myDist9DB766F3"]
| Line Numbers: [65]
|
| CloudFront Distribution should enable access logging
------------------------------------------------------------
| WARN W70
|
| Resource: ["myDist9DB766F3"]
| Line Numbers: [65]
|
| Cloudfront should use minimum protocol version TLS 1.2
------------------------------------------------------------
| WARN W35
|
| Resource: ["bucket43879C71"]
| Line Numbers: [4]
|
| S3 Bucket should have access logging configured
------------------------------------------------------------
| WARN W41
|
| Resource: ["bucket43879C71"]
| Line Numbers: [4]
|
| S3 Bucket should have encryption option set

Failures count: 0
Warnings count: 4
```

#### KICS (using OPA as the query engine)

```text
Files scanned: 1
Parsed files: 1
Queries loaded: 501
Queries failed to execute: 0

------------------------------------

SQS With SSE Disabled, Severity: MEDIUM, Results: 1
Description: Amazon Simple Queue Service (SQS) queue should protect the contents of their messages using Server-Side Encryption (SSE)
Platform: CloudFormation

        [1]: ../../path/OpaDemoStack.template.json:5

                004:    "Type": "AWS::SQS::Queue",
                005:    "Properties": {
                006:     "VisibilityTimeout": 300



Results Summary:
HIGH: 0
MEDIUM: 1
LOW: 0
INFO: 0
TOTAL: 1

Results saved to file /path/results.json
Generating Reports: Done
Scan duration: 12.5407447s
```
