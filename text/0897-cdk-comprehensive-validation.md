# CDK Comprehensive Validation RFC

* **Original Author(s):**: @kaizencc
* **Tracking Issue**: #897
* **API Bar Raiser**: @rix0rr

We will shift left failures that occur during AWS CloudFormation deployment.
We will validate as much as possible offline during cdk synth
and supplement with validation that occurs at the beginning of cdk deploy.

Today, validation happens when your CDK app is built at synth time
and when your CFN ChangeSet is created at deploy time (by default).
We will add a offline validation hook to shift left failures
that previously surface during AWS CloudFormation Deployment;
this will supplement the "online" validation that CFN Early Validation provides.

CDK Comprehensive Validation will also be offered as a standalone command,
cdk validate, where you can perform both offline and online validation.

## Working Backwards

### Blog Post



### README

#### cdk validate

```
cdk validate [STACKS..] [—offline] [—online]
```

You can use cdk validate to run offline and online validation against a CDK stack or app.

This synthesizes a CFN template and verifies it against offline rules, such as:

* Lambda Function Architecture values must be one of: x86_64, arm64, got: x64_86

It also generates (without executing) a CFN changeset to check against online rules, such as:

* Resource of type `AWS::S3::Bucket` with identifier MyBucket already exists

The output looks like this:

```bash
> cdk validate MyAppStack

Stack MyAppStack
 // Annotation Warnings
 [warning] [suppressable] ThroughputNotSupported: The throughput property is not supported
           on EC2 instances. Use a Launch Template instead.
           (at Resources/MyEc2Instance)

 // Offline Warnings
 [warning] [suppressable] UseLatestVersion: Node.js 16 runtime is deprecated.
           Consider upgrading to Node.js 20 or later
           (at Resources/MyLambdaFunction)

 // Annotation Errors
 [error] [blocker] MyOwnError: Bucket versioning is not enabled
         (at Resources/MyBucket)

 // Construct Library Errors
 [error] [blocker] DurationAmountsCannotNegative: Duration amounts cannot be negative.
         Received: -1 (at Resources/MyLambdaFunction)

 // Offline Errors
 [error] [suppressable] InvalidArchitectureValue: Allowed values: x86_64, arm64.
         Received: "x64_86" (at Resources/MyLambdaFunction)

 // Online Errors
 [error] [suppressable] ResourceExists: Resource already exists (at Resources/MyS3Bucket)

Found 4 errors, 2 warnings.
```

> Note that, if there are Construct Library errors then synthesis fails and the other types 
> of errors will not surface. Online and Offline errors will be suppressable as we can
> generate a CloudFormation template and do not want to block users in case we are wrong.

A warning is always suppressable. Suppressable errors indicate issues that we believe will 
fail CloudFormation Deployment, but since we can synthesize a CloudFormation template, we
will not stand in the way. An error that is a blocker fails the synthesis step and there
is no CloudFormation template that can be deployed.

You can optionally specify either `--offline` or `--online`
to perform that specific type of validation.

#### Suppressing Warnings

Warnings in the CDK are meant to communicate best practices and must be acknowledgeable.
Warnings can come from Annotations or Offline Validations.

Annotation Warnings can be suppressed in code:

```ts
Annotations.of(myConstruct).acknowledgeWarning(
  'my-library:Construct:someWarning',
);
```

Offline Validations can similarly be suppressed in code:

```ts
Validations.of(myConstruct).acknowledge(
  'my-construct:UseLatestVersion',
);
```

Because CDK users see a unified list of warnings from cdk validate,
we cannot expect them to differentiate between Annotation and Offline Validation warnings.
Therefore, Validations.of will also be able to handle Annotation warning suppression
and will become the unified way to suppress warnings in CDK.
Acknowledging warnings via Annotations will be deprecated.

We will also expose additional syntactic sugar to allow for more robust suppression.
To start, we will support `acknowledgeAllWarnings` and `acknowledgeRules`.

```ts
Validations.of(myConstruct).acknowledgeAllWarnings();
Validations.of(myConstruct).acknowledgeRules([
  'UseLatestVersion',
  'InvalidArchitectureValue',
]);
```

#### Validating custom rule sets

Custom rules can be written in a policy language like Rego.
For example, the InvalidArchitectureValue rule is defined as follows:

```rego
package cfn

deny[msg] {
    resource := input.Resources[name]
    resource.Type == "AWS::Lambda::Function"
    arch := resource.Properties.Architectures[_]
    not arch_valid(arch)
    msg := sprintf(
      "InvalidArchitectureValue: Allowed values: x86_64, arm64. Received: \"%s\" (at Resources/%s)",
      [arch, name]
    )
}

arch_valid("x86_64")
arch_valid("arm64")
```

Custom rules are loaded via file/directory path specified in `cdk.json` or with the `--custom-rules` option. Custom rules can also be loaded in directly to the CDK App in the `Validations` construct:

```ts
Validations.of(myStack).addRules({
  sources: ['org/my-custom-rules', 'org/my-specific-rule.rego'],
});
```

Rules with the `.rego` file extension will be automatically loaded into the validation for
that CDK stack or app.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

Today, we are announcing CDK Comprehensive Validation,
which shifts deployment failures left by catching misconfigurations
before they reach AWS CloudFormation deployment.
Whether you are deploying infrastructure yourself
or relying on an AI agent to build and deploy on your behalf,
slow feedback from CloudFormation failures disrupts your deployment lifecycle.

The AWS CDK CLI already surfaces CloudFormation Early Validation results during cdk deploy,
catching errors during changeset creation before your changeset is executed.
With this launch, we are adding a new offline validation hook
that runs immediately after synthesis during cdk synth,
supplementing the online validation that Early Validation provides.
Together with the existing app-level validation
that runs when your CDK constructs are built,
this gives both human developers and AI agents
three layers of defense against deployment failures.

### Why should I use this feature?

You automatically get the benefits of Offline Validation during cdk synth,
making you more confident that your ensuing cdk deploy will succeed.
You can integrate the cdk validate command into your AI workflows
as a success gate for rapid agentic cycles.

## Internal FAQ

### Why are we doing this?

Moving eventual errors earlier in the development cycle is always a good idea.
This speeds up deployment time for humans and AI agents alike.
cdk validate combines CDK's validations from different sources under one umbrella
and will become the one-stop shop for agentic workflows to validate their work,
up to 90% faster than a full cdk deploy.

### Why should we not do this?

We should not do this if validation bloats the time of cdk synth,
as we have a parallel goal of lowering the average cdk synth time.
We also need to be careful that the errors we surface are not false positives,
where the CloudFormation deployment actually succeeds but we return an error —
this can be somewhat mitigated by providing an ergonomic suppression mechanism.

### What is the technical solution (design) of this feature?

The solution adds an Offline Validation layer to the CDK synthesis pipeline
and introduces a new cdk validate CLI command that unifies all validation output.

```mermaid
block-beta
    columns 16

    block:synth["cdk synth"]:6
        columns 1
        space
    end
    block:deploy["cdk deploy"]:10
        columns 1
        space
    end

    A1["Build CDK App"]:4
    space:2
    A2["Build/Publish\nAssets"]:2
    A3["Create CFN\nChangeSet"]:4
    A4["Deploy CFN\nChangeSet"]:4

    space
    V1["CDK Construct\nLibrary Validation"]:2
    space
    V2["Offline\nValidation\n(NEW)"]:2
    space:3
    V4["CFN Early\nValidation"]:2
    space:2
    V5["CFN Deploy-Time\nErrors"]:2

    style synth fill:#2c3e50,stroke:#333,color:#fff
    style deploy fill:#2c3e50,stroke:#333,color:#fff
    style V1 fill:#f0c040,stroke:#333,color:#000
    style V2 fill:#2ecc71,stroke:#333,color:#fff
    style V4 fill:#f0c040,stroke:#333,color:#000
    style V5 fill:#d44,stroke:#333,color:#fff
    style A1 fill:#555,stroke:#333,color:#fff
    style A2 fill:#555,stroke:#333,color:#fff
    style A3 fill:#555,stroke:#333,color:#fff
    style A4 fill:#555,stroke:#333,color:#fff
```

Validations:

* [Existing] [cdk synth] Construct Library Validation — handwritten errors that occur during synthesis
* [New] [cdk synth] Offline Validation — synthesized CloudFormation Template
  is evaluated against both base and custom rules
* [Existing] [cdk deploy] CFN Early Validation — CFN changesets are validated
* [Existing] [cdk deploy] CFN Deploy-Time Errors — Errors that occur during CFN deployment

Offline Validation Engine:

Runs a policy engine against the synthesized CloudFormation template json/yaml.
The engine will handle intrinsics natively. The engine requirements include:

* default rule set
* support for custom rule sets written in a policy language like Rego
* executes during cdk synth automatically,
  adding under 1 second of additional time to cdk synth
* finds both errors and warnings, where warnings can be suppressed.

cdk validate command:

A new CLI command that runs all validation layers in a single invocation:

```
cdk validate [STACKS..] [—offline] [—online]
```

Suppression Mechanism:

* [Existing] Annotation warning suppressions in typescript
* [New] Offline validation warnings in typescript —
  must be piped into the Offline Validation Engine.

Custom Rule Mechanism:

Custom rules are written in Rego and placed in a configurable directory
that can be piped into the Offline Validation Engine.

### Is this a breaking change?

No

### What alternative solutions did you consider?

1. Rely solely on CFN Early Validation: rejected because it requires a CFN changeset
   and that happens too late in the deployment process.
2. Extend CDK construct library validation: rejected because it is a treadmill,
   and L1 level users to not get access to L2 level validations.

### What are the drawbacks of this solution?

1. Synth time: Adding offline validation to cdk synth increases synthesis time.
   This conflicts with the parallel goal of reducing average synth time.
   Needs careful benchmarking and opt-out.
2. False positives: If offline rules flag something that CloudFormation would actually accept,
   users get blocked unnecessarily.
   The suppression mechanism mitigates this
   but adds cognitive overhead to determine if the error is real.

### What is the high-level project plan?

The project can be split into three parts:

* Integrate with a validation tool that has the ability to suppress rules
  and express new rule sets
* Create a mechanism for suppressing errors/warnings
* standardize output from all locations where we report errors/warnings, including:
  * code-level errors
  * annotation warnings and errors
  * offline warnings and errors
  * CFN Early Validation errors
