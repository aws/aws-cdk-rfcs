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

Policy as code tools are integrated with CDK through a plugin mechanism. In order to add policy enforcement for a
specific tool you need to first specify the plugin to use. You can do this by importing the plugin and applying it to a
stage. For example, to add a CloudFormation Guard validation to a stage you would do the following:

```ts
import { CfnGuardValidator } from '@aws-cdk/cfn-guard-validator';

// globally for the entire app (an app is a stage)
const app = new App({
  validationPlugins: [
    new CfnGuardValidator(),
  ],
});

// only apply to a particular stage
const prodStage = new Stage(app, 'ProdStage', {
  validationPlugins: [...],
});
```

The details of how to configure the plugin will be specific to each
plugin. For example, a plugin could have a `rules` property which
allows the user to specify where the validation rules are located.

The validation performed by the CDK at synth time can be bypassed by
developers, and can therefore not be relied on as the sole mechanism
of validation in large organizations. Some other mechanism to validate
the same rule set more authoritatively should be set up independently,
like CloudFormation Hooks or AWS Config. Nevertheless, CDK's ability
to evaluate the rule set during development is still useful as it will
improve detection speed and developer productivity.

The goal of CDK Policy Validation is to minimize the amount of set up needed
during development, and make it as easy as possible. For example, a typical
workflow could be:

* Developer writes a CDK application without the correct validations config.
* Developer deploys non-compliant stacks.
* Deployment guardrails catch these violations, and instruct the developer to add a validations property to their
  application.

#### Alternative

```ts
const app = new App();
Policy.of(app).add(new CfnGuardValidator());
```

### Validation Report

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
╚═══════════╧════════════════════════╝

(Violations)

Ensure S3 Buckets are encrypted with a KMS CMK (1 occurrences)

  Occurrences:
  
    - Construct Path: MyStack/MyCustomL3Construct/Bucket
    - Stack Template Path: ./cdk.out/MyStack.template.json
    - Creation Stack:
        └──  MyStack (MyStack)
             │ Library: aws-cdk-lib.Stack
             │ Library Version: 2.50.0
             │ Location: Object.<anonymous> (/home/hallcor/tmp/cdk-tmp-app/src/main.ts:25:20)
             └──  MyCustomL3Construct (MyStack/MyCustomL3Construct)
                  │ Library: N/A - (Local Construct)
                  │ Library Version: N/A
                  │ Location: new MyStack (/home/hallcor/tmp/cdk-tmp-app/src/main.ts:15:20)
                  └──  Bucket (MyStack/MyCustomL3Construct/Bucket)
                       │ Library: aws-cdk-lib/aws-s3.Bucket
                       │ Library Version: 2.50.0
                       │ Location: new MyCustomL3Construct (/home/hallcor/tmp/cdk-tmp-app/src/main.ts:9:20)
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

By default, the report will be printed in a human-readable format. If you want a
report in JSON format, use the `synth()` method:

```ts
app.synth({
  validationReportFormat: ValidationFormat.JSON
});
```

### Plugins

The CDK core framework is responsible for registering and invoking plugins and
then displaying the formatted validation report. The responsibility of the
plugin is to act as the translation layer between the CDK framework and the
policy validation tool. Responsibilities of the plugin may include things like:

- Bundling or installing the policy tool (cfn-guard, opa, etc)
- Bundling or fetching the rules to evaluate. 
- Invoking the policy tool, parsing the output, and returning a
  `ValidationReport` to the framework
- Handling exemptions
- Providing contextual information to the policy tool

A plugin can be created in any language supported by CDK. If you are creating a
plugin that might be consumed by multiple languages then it is recommended
that you create the plugin in `TypeScript` so that you can use JSII to publish
the plugin in each CDK language.

#### Developing Plugins

If you need to develop your own policy validation plugin, either because one
does not exist for your policy tool or because and existing plugin does not meet
your use case, you start by creating a class that implements the
`IValidationPlugin` interface from `aws-cdk-lib`.

```ts
export interface IValidationPlugin {
/**
   * The name of the plugin that will be displayed in the validation
   * report
   */
  readonly name: string;

  /**
   * The method that will be called by the CDK framework to perform
   * validations. This is where the plugin will evaluate the CloudFormation
   * templates for compliance and report and violations
   */
  validate(context: ValidationContext): ValidationReport;

  /**
   * This method returns whether or not the plugin is ready to execute
   */
  isReady(): boolean;
}
```

Using `cfn-guard` as an example policy tool, you could create a cfn-guard plugin.

```ts
export class CfnGuardValidator implements IValidationPlugin {
  public readonly name = 'cfn-guard-validator';
  constructor() {}

  /**
   * Check if cfn-guard is installed and can be executed
   */
  public isReady(): boolean {
    const { status } = spawnSync('cfn-guard', ['--version'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env },
    });
    return status === 0;
  }

  public validate(context: ValidationContext): ValidationReport {
    // execute the cfn-guard cli and get the JSON response from the tool
    const cliResultJson = executeCfnGuardCli();

    // parse the results and return the violations format
    // that the framework expects
    const violations = parseGuardResults(cliResultJson);

    // construct the report and return it to the framework
    // this is a vastly over simplified example that is only
    // meant to show the structure of the report that is returned
    return {
      pluginName: this.name,
      success: false,
      violations: [{
        ruleName: violations.ruleName,
        recommendation: violations.recommendation,
        fix: violations.fix,
        violatingResources: [{
          resourceName: violations.resourceName,
          locations: violations.locations,
          templatePath: violations.templatePath,
        }],
      }],
    };
  }
}
```

#### Handling Exemptions

If your organization has a mechanism for handling exemptions, it can be
implemented as part of the validator plugin.

An example scenario to illustrate a possible exemption mechanism:

* An organization has a rule that public S3 Buckets are not allowed, _except_
  for under certain scenarios.
* A developer is creating an S3 Bucket that falls under one of those scenarios
  and requests and exemption (create a ticket for example).
* Security tooling knows how to read from the internal system that registers
  exemptions

In this scenario the developer would request an exception in the internal system
and then will need some way of "registering" that exception. Adding on to the
guard plugin example, you could create a plugin that handles exemptions by
filtering out the violations that have a matching exemption in an internal
ticketing system.

```ts
export class CfnGuardValidator implements IValidationPlugin {
  public readonly name = 'cfn-guard-validator';
  constructor() {}

  /**
   * Check if cfn-guard is installed and can be executed
   */
  public isReady(): boolean {...}

  public validate(context: ValidationContext): ValidationReport {
    // execute the cfn-guard cli and get the JSON response from the tool
    const cliResultJson = executeCfnGuardCli();

    // parse the results and return the violations format
    // that the framework expects
    const violations: ValidationReport = parseGuardResults(cliResultJson);

    // filter the list of violations by filtering out
    // the violations that have exemptions
    return this.filterExemptions(violations);
  }

  private filterExemptions(violations: ValidationReport): ValidationReport {
    const filteredViolations = violations.violations.filter(violation => {
      if (violationIsExemptInTicketingSystem) return false
      return true;
    });

    return {
      ...violations,
      violations: filteredViolations,
    };
  }
}
```


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

There are many tools in the market that allow customers to define these policies. Taking a set of CloudFormation 
templates and a set of policies, these tools check whether any template violates any policy and report the 
violations to the user accordingly. This launch allows users to integrate one or more of these tools in the CDK 
synthesis flow, so that, if their application produces a non-compliant CloudFormation template, they get the 
feedback immediately.

### Why should I use this feature?

Your productivity as a CDK application developer will increase by getting quicker feedback on whether your 
application complies with the policies defined for your whole organization. Instead of waiting for your deployment 
pipeline to detect that some template is non-compliant, you can get this feedback immediately, every time you 
synthesize the CDK application. If your application is not compliant, the CLI will report error messages, how to fix 
the issues (depending on the integrated tool) and the offending construct.

## Internal FAQ

### Why are we doing this?

One of the recurring complaints about the CDK from large enterprise customers is that it generates many resources
implicitly. While this is the original intent of the CDK, it also creates a challenge from a security and compliance
standpoint; the generated resource definitions might not satisfy the rules defined by the central operations teams,
which, at best, creates delays — as a result of development rework if the issues are caught before deployment — and, at
worst, may expose the customer to attacks or lawsuits.

By integrating policy-as-code tools in the synthesis flow, we give the confidence that these customers need to adopt the
CDK at a larger scale.

### What is the technical solution (design) of this feature?

See [Appendix A - High level design](#appendix-a-high-level-design).

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
* If an application is synthesized without using the CDK CLI, it’s not subject to policy validation.

#### CloudFormation hooks integration

Instead of integrating with each policy tool individually, we have considered the option of developing a single
mechanism, that would integrate with CloudFormation hooks.

As mentioned before, one of the aspects that are out of scope for this RFC is the enforcement of the policies at 
deployment time. Having said that, most CloudFormation customers use CloudFormation hooks for this. A 
CloudFormation hook works by invoking a Lambda function before or after a resource is created, updated or deleted. 
The function handler implements a contract that allows the function to report back to CloudFormation whether the 
operation should proceed, for each resource.

The idea was to implement, in the CDK, a similar mechanism. It would invoke a Lambda function that satisfies the 
hook contract and, based on the outcome, decide whether to proceed with the synthesis. In particular, if the 
function responded by reporting a validation failure, the synthesis would fail. For the CDK to know which functions 
should be invoked would be a matter of configuration.

The main benefit of this solution is that, from the CDK standpoint, the implementation of these Lambda functions 
don't matter. For example, customers could use any tool they want to implement the validation logic; they could 
use a single Lambda function or multiple functions; they could deploy different rules for different sets of accounts 
etc. All these decisions have to be made and implemented by the central teams anyway. And whatever changes are made 
later regarding policy validation (other than changing the target functions themselves) would not require any 
changes on the CDK application side.

However, the Lambda functions invoked by CloudFormation hooks are not deployed to the customer’s account, but to an
account owned by AWS. As a result, those functions can only be invoked by the CloudFormation hook itself, which 
makes this solution infeasible.

### What are the drawbacks of this solution?

In many cases, plugins will need a third party tool installed on the developer's computer, such as a CLI. These tools
are installed and managed separately from the CDK. This isn't a drawback — in fact, this separation of concerns is
necessary for this feature to be extensible — but it places an extra burden on plugin authors. A developer of a CDK
application that uses a given plugin may not have the necessary tools installed beforehand, when they synthesize the app
for the first time. Plugin authors must then make sure that developers can install these tools with as little friction
as possible to deliver a good user experience.

Another drawback relates to programming languages. If an organization wants validations to apply to all languages in 
the company, they have to set up a jsii publishing pipeline (assuming the plugin they want to use is not yet 
available in multiple languages, from their respective package managers). The alternative solution to implement this 
feature in the CLI would not require this additional setup, as the plugin would only need to be vended and consumed 
as a node package.

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

All plugins should implement the same interface, defined in the `core` library (provisionally called `IValidationPlugin`
here). This interface defines a common set of inputs and outputs that each plugin should conform to.

Zero or more plugins may be added to the CDK application's `App` instance. At some point during synthesis (
see [Appendix B - Implementation details](#appendix-b-implementation-details) for
some possibilities) the framework will pass the generated CloudFormation template to all the plugins, collect the output
and print the results. If there is any blocking violation an exception will be thrown, causing the synthesis to fail.

### Appendix B - Implementation details

There are at least two different places where we can hook the validation logic in the synthesis flow.

#### **Option 1: part of stack synthesizer** (Not selected)

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

#### **Option 2: Separate phase after synthesis** (Selected)

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
