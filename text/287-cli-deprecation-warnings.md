---
rfc pr: [#xxx](https://github.com/aws/aws-cdk-rfcs/pull/xxx) <-- fill this after you've already created the PR
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/287
---

# CDK CLI deprecation warnings

If an element in the CDK Construct Library (class, interface, property, function) is deprecated,
using it inside a CDK application should produce a warning in the CDK CLI for all commands that perform synthesis
(`cdk synth`, `cdk diff`, `cdk deploy`, etc.).

This is done in order to aid the migration from `V1` of the CDK to `V2`
(where all deprecated elements from `V1` will be removed).

## Working Backwards

### CHANGELOG

feat(cli): warn about usages of deprecated Construct Library elements

### README

When using any element (class, interface, property, function) that is deprecated in the Construct Library,
you will receive a warning when performing any CLI operation that performs synthesis
(`cdk synth`, `cdk diff`, `cdk deploy`, etc.) that looks similar to:

```
[Warning at /TestStack/IncludeTemplate] The API @aws-cdk/core.CfnInclude is deprecated:
  please use the CfnInclude class from the cloudformation-include module instead.
  This API will be removed in the next major release
```

## FAQ

### What are we launching today?

In the newest release of the AWS CDK command-line interface,
any usage of a deprecated element  (class, interface, property, function)
in your CDK code will result in a warning being printed in the console output.

### Does this mean my code will stop working after this change?

No! This feature only adds warnings to the CLI,
it does not result in any code that was previously working to now fail.

Note that if you want to migrate to `V2` of the CDK,
which we strongly recommend,
you will have to handle all the warnings that this feature emits,
as all deprecated elements in `V1` will be removed from `V2`,
and thus no longer available to be used by your code.

## Internal FAQ

### Why are we doing this?

We are doing this to help customers have a smoother migration from `V1` to `V2` of the CDK.

### Why should we _not_ do this?

I see two reasons why we might not want to implement this feature:

1. Deprecated elements are already highlighted by virtually any editor/IDE.
  In my experience, customers are diligent in moving away from deprecated APIs,
  so this feature might not provide much value.
2. We risk overloading customers with warnings,
  training them to ignore our output if there's too much of it.
  A warning must be read in order to be effective, after all.

### What changes are required to enable this change?

One of the core tenets behind this RFC is that we want to avoid the need to add any code to the deprecated elements manually.
Just deprecating the element should automatically trigger the warnings,
without requiring any other code changes to the element being deprecated.

There are two high-level components of this change:

#### 1. Communication between the framework and the CLI

Since we want to show the warnings when the CLI invokes synthesis,
we need to communicate between the framework (where those deprecated usages happen)
and the CLI (where the warnings will be shown).
The natural way to do that is through the Cloud Assembly.

We already have a facility for adding messages to the construct tree's metadata
(through the Node class in the `constructs` library),
which are then [collected into the Stack Cloud Assembly artifact type](https://github.com/aws/aws-cdk/blob/34a921b9667402b6d90731f1fd9e3de1ef27f8bf/packages/%40aws-cdk/core/lib/stack-synthesizers/_shared.ts#L63-L101),
which the [CLI later renders](https://github.com/aws/aws-cdk/blob/34a921b9667402b6d90731f1fd9e3de1ef27f8bf/packages/aws-cdk/lib/api/cxapp/cloud-assembly.ts#L175-L216).
We should in all likelihood re-use that mechanism.

Note, however, that that requires access to the construct tree,
which we don't necessarily have in a trivial way from all contexts
(for example, for an access to a deprecated property of a struct interface).
Which means we will need to add some mechanism to `core`
that allows elements to register warnings with without necessarily having access to a construct,
and which then will be gathered by synthesis and added to the resulting Cloud Assembly
(parented below a certain construct, perhaps the `App`?).
This also means we most likely won't be able to link the usage of the deprecated element to a particular `Stack`
that it was used in.

#### 2. Adding metadata when using deprecated elements

The second element of this change is to actually add the appropriate metadata when any deprecated element is used.

Before we dive into the possible solutions,
I think it's worth it to talk about what solutions we _don't_ want,
as that will strongly inform how we approach the problem.

I think we can rule out any solution that requires parsing the customer's source code in search for usages of deprecated elements.
The downsides of this approach include:

* We would have to write a separate parser for each language supported by the CDK.
* This additional parsing could have an adverse impact on the performance of CDK commands.

If we agree that we don't want the above solution,
then the only avenue we have left is injecting some extra code in the deprecated elements during compilation of the TypeScript code into JavaScript.
There are two ways we can do that: through JSII, or purely through the TypeScript compiler.

##### 2.1. Modifying JSII

We could modify JSII to add a capability to it that allows injecting some code when compiling every deprecated element.
It would involve writing a TypeScript transform,
that adds some code whenever the deprecated element is accessed.
Nick did a similar change in PR [#2348](https://github.com/aws/jsii/pull/2348)
to add runtime version information to all JSII-compiled classes.

Advantages:

* Doing it in JSII wil make it easy to record the module the given element is in.

Disadvantages:

* Because the code adding the warning for the deprecated elements will be CDK-specific,
  it will be pretty awkward to correctly pass what exactly that code should be from CDK to JSII
  (and, additionally, that code will most likely be slightly different for each type --
  class, method, property, etc. --
  of deprecated element we support).
* Requires coordination between the JSII and CDK projects
  (merging a JSII PR, waiting for a release, updating CDK to use the new version, etc.),
  which typically lengthens the total development time.

##### 2.2. TypeScript decorators

We can use [TypeScript decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
to enhance the runtime JavaScript code with our custom logic.
We can add an `awslint` rule that enforces that every element with the `@deprecated`
JSDoc tag also needs to have the `@deprecated` decorator present.
While decorators are still considered an experimental feature,
our init templates and JSII enable them in `tsconfig.json`,
which means the vast majority of our customers will have them enabled as well.

Advantages:

* Changes are needed only in the CDK project.

Disadvantages:

* It won't be possible to reliably get the module the deprecated element belongs to
  (only its name).

**My recommendation**: TypeScript decorators.

### Is this a breaking change?

No.

### What are the drawbacks of this solution?

The drawback of this solution is that we will overwhelm our customers with warnings,
and train them to ignore the output of `cdk` commands because of that.

### What alternative solutions did you consider?

The alternative is to do nothing,
and rely on editors/IDEs to warn customers of using deprecated features.

### What is the high level implementation plan?

The high-level implementation plan depends on the method chosen:

1. If we decide to modify JSII,
  we will have to start with a PR to that project first,
  then update CDK to the latest JSII after it's released,
  and then work on the CDK side after that.

2. If we decide to go with TypeScript decorators,
  all of the changes should fit comfortably in a single PR to the CDK project.

### Are there any open issues that need to be addressed later?

No.
