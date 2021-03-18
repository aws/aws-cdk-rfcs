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
[WARNING] The API @aws-cdk/core.CfnInclude is deprecated:
  please use the CfnInclude class from the cloudformation-include module instead.
  This API will be removed in the next major release
```

There is also an environment variable `DEPRECATED` that you can use to change the behavior of this feature:

* Setting that environment variable to the value `quiet` will silence these warnings
  (they will no longer be printed to the stderr stream).
* Setting that environment variable to the value `error` will instead fail with an exception when any deprecated element is used.
* Setting that environment variable to the value `warn` is the same as the default behavior
  (the warnings will be printed to the stderr stream,
  but will not cause errors).

#### When exactly will this warning be shown?

In general, this warning will be shown when executing any member
(by which I mean function (static or standalone), constructor, method,
or field (static or instance))
from the AWS CDK Construct Library that is either:

* Deprecated itself;
* Belongs to a class or interface that is deprecated;
* Has an argument that is of an interface type with a deprecated property,
  and that property has been passed when calling the member.

In particular, this means the warnings will not be printed for:

* Any elements in your own code which are either explicitly deprecated,
  or override any deprecated members from the Construct Library.
* Any code that invokes deprecated members,
  but that is itself not actually invoked when running CDK synthesis.
* Using any deprecated members without actually invoking them
  (for example, using a deprecated type only in a type declaration).

### Contributing guide

To deprecate an element (class, interface, property, function, etc.) in the CDK,
you need to add the `@deprecated` JSDoc tag to the documentation block of that element.
This will change the generated JavaScript code to make it emit a warning to the standard error stream whenever that element is invoked.

## FAQ

### What are we launching today?

In the newest release of the AWS CDK Construct Library,
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

If you want to make sure your code does not use any deprecated APIs,
and thus is ready for migrating to CDK `V2`,
you can set the `DEPRECATED` environment variable to the value `error`,
which will make any CDK command that invokes synthesis
(`cdk synth`, `cdk deploy`, `cdk diff`, etc.)
fail with an exception if any deprecated element is used.

## Internal FAQ

### Why are we doing this?

We are doing this to help customers have a smoother migration from `V1` to `V2` of the CDK.

### Why should we _not_ do this?

I see four reasons why we might not want to implement this feature:

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
4. Depending on the exact solution chosen
  (see discussion below),
  there might be edge cases where something is deprecated,
  but we won't be able to report a particular pattern of its usage.
  Some examples include:
    * Using deprecated types only in type declarations.
    * Static constants (which includes enums).
    * Deprecated elements declared in the code, but not actually executed during synthesis.

### What changes are required to enable this change?

There are two high-level components of this change:

#### 1. Changes to JSII

We will add a feature to JSII that adds the warning code to the emitted JavaScript for deprecated elements.
It will be off by default, and will have to be activated explicitly to affect the emitted JavaScript code.

#### 2. Using the changed JSII

Once we have modified JSII and released a new version of it,
we will need to use it in the CDK,
and start compiling CDK with the new option turned on.

We should also modify our CDK test infrastructure to run with the `DEPRECATED`
environment variable set to `error` by default,
to prevent our own code from using deprecated APIs which would cause warnings to be shown to users.
We should come up with a nice API that allows individual tests that are explicitly checking deprecated API(s)
as regression tests to make the value of that environment variable `quiet` easily.

### Is this a breaking change?

No.

### What are the drawbacks of this solution?

1. Requires changes to JSII.
2. Does not allow distinguishing between the customer using deprecated APIs,
  and the library code using deprecated APIs.
  We can alleviate this problem by making the value of the `DEPRECATED` environment variable `error` by default in our tests,
  which will be a forcing function for us to stop using deprecated APIs in the Construct Library.
3. We only report APIs actually hit during a particular execution of the code
  (while missing statically declared but not actually invoked deprecated elements -
  note though that IDEs/editors still warn about them).

### What alternative solutions did you consider?

There are many alternatives that were considered,
but were, for various reasons, discarded:

#### 1. Manual code for emitting the warnings

Instead of modifying JSII,
we could simply write the code inside the TypeScript APIs "manually",
emitting warnings for any deprecated elements being used.

This has the advantage of being the simplest solution,
but has been discarded because of the large effort,
and the fact that there's no way for us to verify that code has been added
(and added correctly).

#### 2. TypeScript decorators

We can use [TypeScript decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
to enhance the runtime JavaScript code with our custom logic.
We can add an `awslint` rule that enforces that every element with the `@deprecated`
JSDoc tag also needs to have the `@deprecated` decorator present.
While decorators are still considered an experimental feature,
our init templates and JSII enable them in `tsconfig.json`,
which means the vast majority of our customers will have them enabled as well.

The main advantage of this solution is that changes are needed only in the CDK project.

Disadvantages of this solution:

1. It won't be possible to reliably get the module the deprecated element belongs to (only the name of the element) --
  the decorator is simply a JavaScript function defined in `@aws-cdk/core`,
  and doesn't have (easy) access to the information on what module a given object it's called on belongs to.
2. TypeScript does not allow decorators on interfaces (neither on the interface directly, nor on any of its properties).
  This means we will not be able to register warnings for structs, or struct properties.
3. We won't be able to register warnings for accessing deprecated static constants
   (this includes enums).
4. We only report APIs actually hit during a particular execution of the code
   (while missing statically declared but not actually invoked deprecated elements).

#### 3. Rely on language-specific deprecation warning mechanisms

JSII emits deprecated elements with the correct language-specific mechanisms in place
(for example, the `@Deprecated` annotation for Java).
We could simply piggyback on those,
instead of writing our own.

Advantages of this solution:

1. Minimal development effort on our side.
2. Compared to runtime analysis, allows listing of all deprecated API usages in the code base,
  not the just ones that happen to be executed during a particular run.

Disadvantages of this solution:

1. TypeScript in VSCode (our most popular language/IDE combination)
   does not by default show a complete list of deprecated API usages:
   it will only show strikethroughs on identifiers you happen to be looking at.
   Getting a complete list of deprecated APIs requires installing and configuring `eslint`.
2. TypeScript currently does not properly detect deprecation of properties in object literals,
   and deprecation of properties (props) is very important for our project.
   Even though it will properly detect them while autocompleting,
   and there is an issue about it on the TypeScript bug tracker,
   we cannot rely on them fixing this in a reasonable time frame.
3. There is nothing out of the box for this in Python
  (we would have to change JSII and write our own decorator,
  which would have the same disadvantages as the TypeScript decorators solution).

#### 4. Parse the customer's code

We could create a parser and type-checker for each language the CDK supports,
and use that to discover any cases of using deprecated elements.

Advantages of this solution:

1. Allows us to discover some tricky deprecated elements,
  like enum values, or deprecated types used only in type declarations,
  that will be difficult to do with only runtime reporting.
2. Would prevent reporting warnings for deprecated usages outside the customer's code
  (for example, in our own libraries).
3. Compared to runtime analysis, allows listing of all deprecated API usages in the code base,
  not the just ones that happen to be executed during a particular run.

Disadvantages of this solution:

1. We would have to write a separate parser and type-checker for each language supported by the CDK.
2. This additional parsing could have an adverse impact on the performance of CDK commands.
3. It's not obvious this analysis can even be performed at all in the case of dynamically-typed languages like JavaScript or Python.

### What is the high level implementation plan?

The high-level implementation plan is:

1. Make the changes in JSII
  (will probably be a single PR),
  and release a new version once those are merged in.
  Effort estimate (development + code review): 2 weeks.

2. Set the new option during building CDK,
  make sure the tests use the `DEPRECATED` environment variable set to `error`,
  and provide an API for tests to opt-out of that on a case-by-case basis.
  Effort estimate (development + code review): 1 week.

### Are there any open issues that need to be addressed later?

No.

### Are there any things that need to be paid attention to during implementation?

1. We need to check all arguments of all functions that have struct types,
  and add code checking whether any of the deprecated struct properties have been passed.
  This must include doing this recursively for nested structs as well.
2. It's very likely internal (starting with `_`)
  API elements should be excluded from emitting these warnings.
3. It would be ideal if each API element only emitted the warning once ,
  when it was first invoked - as opposed to doing it every time it was invoked.
4. The message displayed in the console should include the deprecation message specified in the code.
5. If a class is deprecated, the warnings should most likely be added to every API element of that class,
  whether that element is explicitly deprecated or not.
