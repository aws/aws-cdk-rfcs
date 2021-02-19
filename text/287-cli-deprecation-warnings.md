---
rfc pr: [#290](https://github.com/aws/aws-cdk-rfcs/pull/290)
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

### Contributing guide

To deprecate any element (class, interface, property, function, etc.)
in the CDK, you need to make two changes:

1. Add a `@deprecated` tag to the documentation block of the element.
2. Add a `@deprecated` decorator (from the `@aws-cdk/core` module) to the element itself.

(There is a linter rule that makes sure both elements are always present,
in case you add one, but forget the other)

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

I see three reasons why we might not want to implement this feature:

1. Deprecated elements are already highlighted by virtually any editor/IDE.
  In my experience, customers are diligent in moving away from deprecated APIs,
  so this feature might not provide much value.
2. We risk overloading customers with warnings,
  training them to ignore our output if there's too much of it.
  A warning must be read in order to be effective, after all.
3. Depending on the exact solution chosen
  (see discussion below),
  we might not be able to distinguish from the user's code using a deprecated API,
  and from our own libraries using deprecated APIs.
  Which means a user might get warnings that they will be unable to get rid of
  (because they're coming from code that they don't control).

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
While this approach has many interesting advantages:

* Allows us to discover some tricky deprecated elements,
  like enum values, or deprecated types used only in type declarations,
  that will be difficult to do with only runtime reporting.
* Would prevent reporting warnings for deprecated usages outside the customer's code
  (for example, in our own libraries).

While those advantages are considerable,
I still think the downsides outweigh them:

* We would have to write a separate parser for each language supported by the CDK.
* This additional parsing could have an adverse impact on the performance of CDK commands.
* It's not obvious this analysis can even be performed at all in the case of dynamically-typed languages like JavaScript or Python.

If we agree that we don't want the above solution,
then the only avenue we have left is injecting some extra code in the deprecated elements during compilation of the TypeScript code into JavaScript.
There are two ways we can do that: through the TypeScript compiler directly,
or by modifying JSII (which is discussed as an alternative below).

##### 2.1. TypeScript decorators

We can use [TypeScript decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
to enhance the runtime JavaScript code with our custom logic.
We can add an `awslint` rule that enforces that every element with the `@deprecated`
JSDoc tag also needs to have the `@deprecated` decorator present.
While decorators are still considered an experimental feature,
our init templates and JSII enable them in `tsconfig.json`,
which means the vast majority of our customers will have them enabled as well.

The main advantage of this solution is that changes are needed only in the CDK project.

### Is this a breaking change?

No.

### What are the drawbacks of this solution?

1. It won't be possible to reliably get the module the deprecated element belongs to
  (only the name of the element) --
  the decorator is simply a JavaScript function defined in `core`,
  and doesn't have (easy) access to the information on what module a given object it's called on belongs to.
2. TypeScript does not allow decorators on interfaces
  (neither on the interface directly, nor on any of its properties).
  This means we will not be able to register warnings for structs, or struct properties.

### What alternative solutions did you consider?

The alternative solution to `2.1` is to modify JSII to add a capability to it that allows injecting some code when compiling every deprecated element.
It would involve writing a TypeScript transform,
that adds some code whenever the deprecated element is accessed.
Nick did a similar change in PR [#2348](https://github.com/aws/jsii/pull/2348)
to add runtime version information to all JSII-compiled classes.

Advantages of this solution:

* Doing it in JSII will make it easy to record the module the given element is in.
* Doing it in JSII allows this functionality to be used by other JSII projects,
  like `cdk8s`, or `cdktf`.

Disadvantages of this solution:

* Because the code adding the warning for the deprecated elements will be CDK-specific,
  it will be pretty awkward to correctly pass what exactly that code should be from CDK to JSII
  (and, additionally, that code will most likely be slightly different for each type --
  class, method, property, etc. --
  of deprecated element we support).
* Requires coordination between the JSII and CDK projects
  (merging a JSII PR, waiting for a release, updating CDK to use the new version, etc.),
  which typically lengthens the total development time.

### What is the high level implementation plan?

The high-level implementation plan depends on the solution chosen:

1. If we decide to modify JSII,
  we will have to start with a PR to that project first,
  then update CDK to the latest JSII after it's released,
  and then work on the CDK side after that.

2. If we decide to go with TypeScript decorators,
  all of the changes should fit comfortably in a single PR to the CDK project.

### Are there any open issues that need to be addressed later?

No.
