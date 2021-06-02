---
rfc pr: [#xxx](https://github.com/aws/aws-cdk-rfcs/pull/xxx) <-- fill this after you've already created the PR
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/328
---

# Polyglot Assert

The `@aws-cdk/assert` module is only available to javascript users.

The new polyglot assert module - `@aws-cdk/assertv2` - provides the same set of functionalities
to users in all CDK supported languages.

## Working Backwards

### CHANGELOG

**feat:** announcing assertv2: the assert library is now available in all CDK supported languages.

### README

<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

> NOTE: This module contains *beta APIs*.
>
> All beta symbols are suffixed with the `Beta<n>`. When we have backwards
> incompatible change, we will create a new symbol with a `Beta<n+1>` suffix
> and deprecate the `Beta<n>` symbol.
----
This module allows asserting the contents of CloudFormation templates.

To run assertions based on a CDK `Stack`, start off with -

```ts
const stack = new cdk.Stack(...)
...
const inspect = StackAssertionsBeta1.fromStackBeta1(stack);
```

Alternatively, assertions can be run on an existing CloudFormation template -

```ts
const file = '/path/to/file';
const inspect = StackAssertionsBeta1.fromTemplateFileBeta1(file);
```

#### Full Template Match

The simplest assertion would be to assert that the template matches a given
template.

```ts
inspect.assertMatchTemplateBeta1({
  Resources: {
    Type: 'Foo::Bar',
    Properties: {
      Baz: 'Qux',
    },
  },
});
```

#### Counting Resources

This module allows asserting the number of resources of a specific type found
in a template.

```ts
inspect.assertResourceCountBeta1('Foo::Bar', 2);
```

#### Resource Matching

Beyond resource counting, the module also allows asserting that a resource with
specific properties are present.

The following code asserts that the `Properties` section of a resource of type
`Foo::Bar` contains the specified properties -

```ts
inspect.assertResourceBeta1('Foo::Bar', {
  Foo: 'Bar',
  Baz: 5,
  Qux: [ 'Waldo', 'Fred' ],
});
```

The same method allows asserting the complete definition of the 'Resource'
which can be used to verify things other sections like `DependsOn`, `Metadata`,
`DeletionProperty`, etc.

```ts
inspect.assertResourceBeta1('Foo::Bar', {
  Properties: { Foo: 'Bar' },
  DependsOn: [ 'Waldo', 'Fred' ],
}, {
  part: ResourcePartBeta1.COMPLETE_BETA1,
});
```

## FAQ

### What are we launching today?

Today, we are launching a new jsii module called `@aws-cdk/assertv2`, that allows
CDK users to run assertions on the synthesized CloudFormation template.

This module is available to users in all CDK supported languages.

### Why should I use this feature?

You should use this feature if you would like to ensure that your CDK constructs
and CDK applications render expected CloudFormation resources and properties.

### How is this different from the existing `assert` module?

The two modules provide the same set of features. However, the existing module
was only available to javascript users.
The new version launched today is available to users of all CDK supported
languages available today and any that we will support in the future.

### How do I get started?

This module is available in the languages as per the table below -

| Language              | Pkg Manager | Package                                     |
| --------------------- | ------------|-------------------------------------------- |
| typescript/javascript | npm         | `@aws-cdk/assertv2`                         |
| Java                  | Maven       | `software.amazon.awscdk.assertv2`           |
| Python                | PyPI        | `aws-cdk.assertv2`                          |
| .NET                  | NuGet       | `Amazon.CDK.AssertV2`                       |
| Go                    | -           | `github.com/aws/aws-cdk-go/awscdk/assertv2` |

### Is this feature available in the AWS CDK v2?

This module is available in both the AWS CDK v1 and v2, just like all of our other
modules.

In CDKv2, this module will be available as part of `aws-cdk-lib`.
The import statement you will need to use is -

```ts
import { assertv2 as assert } from 'aws-cdk-lib';
```

Read more about `aws-cdk-lib` at
https://github.com/aws/aws-cdk/tree/master/packages/aws-cdk-lib#readme.

### Why are all the APIs suffixed with the `Beta1` suffix?

We have promised that there will be no backwards incompatible or breaking changes
to our APIs in `aws-cdk-lib` as part of the AWS CDK v2.

However, this module is still under development and is a developer preview release,
where we are collecting feedback from users and performing necessary improvements.

When an API needs to be modified in backwards incompatible ways, we will create a
new API with a new suffix (`Beta2`, etc.). The old APIs will continue to be work but
will be marked as deprecated.

When the module is ready for prime time, we will publish the APIs without the 'Beta'
suffix and mark all 'Beta' APIs as deprecated.

## Internal FAQ

### Why are we doing this?

We have received a lot of requests and feedback from users that they would like to use
our 'assert' library in the languages of their choice, primarily Python users.

### Why should we _not_ do this?

None.

### What changes are required to enable this change?

The high level design is to create a new jsii module in the AWS CDK monorepo -
`@aws-cdk/assertv2` - that exposes the APIs proposed above.

The implementation of this module would simply be a scaffold around the existing
`assert` library.

To build this scaffold, we will 'vendor in' the libraries `assert-internal`,
`cloudformation-diff` and `cfnspec`.

See [Appendix A](#appendix-a) for the design and rationale.

Prototype / Implementation: https://github.com/aws/aws-cdk/pull/14952.

### Is this a breaking change?

This is not a breaking change.

### What are the drawbacks of this solution?

1. Ideally, the dependencies, `assert`, `cloudformation-diff` and `cfnspec`
   are all available to be consumed as regular dependencies but are not,
   since they are part of the same monorepo.

   Instead, the design 'vendors in' these dependencies, i.e., copies over
   the source code and rewrites imports, thereby increasing tech debt.

2. Any new feature or bug fix to the new assert module needs to be performed
   both in the old assert module and new. This can lead to weird/complicated
   implementation, since they both follow different design patterns.

3. The 'jest' friendly interfaces that were previously available are no longer
   available.
   Users previously using -

   ```ts
   expect(stack).toHaveResource('Foo::Bar', { ... });
   ```

   will now have to use

   ```ts
   const assertions = StackAssertions.fromStack(stack);
   assertions.assertResource('Foo::Bar', { ... });
   ```

### What alternative solutions did you consider?

See [Appendix B](#appendix-b) for alternatives.

### What is the high level implementation plan?

The implementation plan is fairly simple.

- Implement and release the new assert module.
- Migrate modules to use the new assert module.

### Are there any open issues that need to be addressed later?

> Describe any major open issues that this RFC did not take into account. Once
> the RFC is approved, create GitHub issues for these issues and update this RFC
> of the project board with these issue IDs.

## Appendix A - Detailed Design

### Key Requirement

The **key requirement** for the design choices is *dogfooding*.
The new assert APIs must be usable from within the AWS CDK, and over time,
all CDK modules that use the old assert module should be migrated to the new one.

This is crucial to keep the assert library active and maintained.
This is reinforced by the old assert library which, over time, has evolved with
new features added to it.

### Ship Vehicle

The assert library works on `Stack` which is a construct available in `@aws-cdk/core`
(or `aws-cdk-lib` in v2). Hence, takes a dependency on this construct.

Given this and working backwards from the key requirement, the new assert module
must be part of the AWS CDK monorepo.

### Dependencies

The main dependencies of the new assert module are the existing `assert` module,
which in turn mainly depend on `cloudformation-diff` and `cfnspec`. 
The latter two are required to display human readable diffs, around what resources
are different and how IAM permissions have changed.

All three of these modules are pure typescript, and not jsii modules, whereas the
new assert module is a jsii module.
jsii only allows other jsii modules as regular dependencies, and any non jsii module
should be [bundled](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#bundleddependencies).

However, all three modules are within the AWS CDK monorepo and the tooling of `yarn`,
`lerna` and `npm` do not support bundling modules that are within the monorepo.

For this reason, we have gone with the option to 'vendor in' these modules by copying
the source directly into the new assert module with some minor adjustments.

### CDK v2 Availability

In CDK v2, `aws-cdk-lib` only packages stable modules. Modules marked experimental
are published as a separate module. There is a strict requirement imposed by the
`aws-cdk-lib` packaging mechanism that it cannot depend on any of the experimental
modules.

To adhere to these constraints, the new assert module is marked as 'stable' and
we will use the experimental API feature, i.e., suffix all APIs with `Beta<n>`.

## Appendix B - Alternatives

### Alternative 1 - Remove the dependency on `Stack`

If we removed the dependency of the assert library on `Stack`, then we can release
this module separately from the monorepo, and consume it in the AWS CDK as any other
`devDependency`.

However, this will unearth more problems.

Firstly, the dependency on `Stack` really comes from the original 'assert' module.
Removing this is not trivial and is a breaking change on the old assert library.

Further, doing so will spoil the API ergnomoics of the assert module, even though it
will remain usable.

Moreover, we are still left with dependencies on `cloudformation-diff` and `cfnspec`
which are part of the monorepo. A set up like this will leave us in a situation where
we are using older versions of these packages in the dependency closure, even though
the latest version is present in the monorepo.

### Alternative 2 - Bundle the dependencies

As mentioned in the original design, the existing tooling of `yarn`, `lerna` and
`npm` do not support bundling packages that are part of the monorepo.

We can build such tooling ourselves, but this will be more tooling we will need to
maintain.
