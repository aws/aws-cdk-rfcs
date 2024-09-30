---
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/330
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/328
---

# Polyglot Assert

The `@aws-cdk/assert` module is only available to javascript users.

The new polyglot assert module - `@aws-cdk/assertions` - provides the same set of
functionalities to users in all CDK supported languages.

## Working Backwards

### CHANGELOG

**feat:** announcing assertions: the assert library is now available in all CDK supported languages.

### README

This module allows asserting the contents of CloudFormation templates.

To run assertions based on a CDK `Stack`, start off with -

```ts
import { Stack } from '@aws-cdk/core';
import { TemplateAssertions } from '@aws-cdk/assertions';

const stack = new cdk.Stack(...)
...
const assert = TemplateAssertions.fromStack(stack);
```

Alternatively, assertions can be run on an existing CloudFormation template -

```ts
const template = fs.readFileSync('/path/to/template/file');
const assert = TemplateAssertions.fromTemplate(template);
```

#### Full Template Match

The simplest assertion would be to assert that the template matches a given
template.

```ts
// In typescript
assert.assertTemplateMatches({
  Resources: {
    Type: 'Foo::Bar',
    Properties: {
      Baz: 'Qux',
    },
  },
});
```

```java
// In Java, using text blocks and Gson
import com.google.gson.Gson;

String json = """
  {
    "Resources": {
      "Type": "Foo::Bar",
      "Properties": {
        "Baz": false
      }
    }
  } """;

Map expected = new Gson().fromJson(json, Map.class);
assert.assertTemplateMatches(expected);
```

```py
# In Python
import json

assertion.assert_template_matches({
  'Resources': {
    'Type': 'Foo::Bar',
    'Properties': {
      'Baz': False
    }
  }
})
```

#### Counting Resources

This module allows asserting the number of resources of a specific type found
in a template.

```ts
assert.assertResourceCountIs('Foo::Bar', 2);
```

#### Resource Matching

Beyond resource counting, the module also allows asserting that a resource with
specific properties are present.

The following code asserts that the `Properties` section of a resource of type
`Foo::Bar` contains the specified properties -

```ts
// In typescript
assert.assertHasResource('Foo::Bar', {
  Foo: 'Bar',
  Baz: 5,
  Qux: [ 'Waldo', 'Fred' ],
});
```

```java
// In Java, using text blocks and Gson
import com.google.gson.Gson;

String json = """
  {
    "Foo": "Bar",
    "Baz": 5,
    "Qux": [ "Waldo", "Fred" ],
  } """;

Map expected = new Gson().fromJson(json, Map.class);
assert.assertHasResource("Foo::Bar", expected);
```

```py
# In Python
import json

assertion.assert_has_resource('Foo::Bar', {
  'Foo': 'Bar',
  'Baz': 5,
  'Qux': [ 'Waldo', 'Fred' ],
})
```

The same method allows asserting the complete definition of the 'Resource'
which can be used to verify things other sections like `DependsOn`, `Metadata`,
`DeletionProperty`, etc.

```ts
// In typescript
assert.assertHasResource('Foo::Bar', {
  Properties: { Foo: 'Bar' },
  DependsOn: [ 'Waldo', 'Fred' ],
}, {
  part: ResourcePart.COMPLETE,
});
```

```java
// In Java, using text blocks and Gson
import com.google.gson.Gson;

String json = """
  {
    "Properties": { "Foo": "Bar" },
    "DependsOn": [ "Waldo", "Fred" ],
  } """;

Map expected = new Gson().fromJson(json, Map.class);
assert.assertHasResource("Foo::Bar", expected,
  new AssertResourceOptions.Builder().part(ResourcePart.COMPLETE).build());
```

```py
# In Python
import json

expected = """
  {
    "Properties": { "Foo": "Bar" },
    "DependsOn": [ "Waldo", "Fred" ],
  } """;

assertion.assert_has_resource('Foo::Bar', json.loads(expected),
  assertion.AssertResourceOptions(part=ResourcePart.COMPLETE))
```

## FAQ

### What are we launching today?

Today, we are launching a new jsii module called `@aws-cdk/assertions`, that allows
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

| Language              | Pkg Manager | Package                                       |
| --------------------- | ------------|---------------------------------------------- |
| typescript/javascript | npm         | `@aws-cdk/assertions`                         |
| Java                  | Maven       | `software.amazon.awscdk.assertions`           |
| Python                | PyPI        | `aws-cdk.assertions`                          |
| .NET                  | NuGet       | `Amazon.CDK.Assertions`                       |
| Go                    | -           | `github.com/aws/aws-cdk-go/awscdk/assertions` |

### Is this feature available in the AWS CDK v2?

This module is available in both the AWS CDK v2, just like the other CDK modules.

Initially, this will be an experimental module. During this period, this module
will be available under the package name `@aws-cdk/assertions` (or as identified
in the table above) with the versioning scheme - `2.0.0-alpha.X` (or `0.x.y`,
decided in a different RFC).

Once this module is generally available, it will be available as part of `aws-cdk-lib`,
and the import statement you will need to use is -

```ts
import { assertions } from 'aws-cdk-lib';
```

Read more about `aws-cdk-lib` at
<https://github.com/aws/aws-cdk/tree/main/packages/aws-cdk-lib#readme> and about the
CDK module lifecycle at
<https://github.com/aws/aws-cdk-rfcs/blob/main/text/0107-construct-library-module-lifecycle.md>.

## Internal FAQ

### Why are we doing this?

We have received a lot of requests and feedback from users that they would like to use
our 'assert' library in the languages of their choice, primarily Python users.

### Why should we _not_ do this?

None.

### What changes are required to enable this change?

The high level design is to create a new jsii module in the AWS CDK monorepo -
`@aws-cdk/assertions` - that exposes the APIs proposed above.

The implementation of this module would simply be a scaffold around the existing
`assert` library.

To build this scaffold, we will 'vendor in' the libraries `assert-internal`,
`cloudformation-diff` and `cfnspec`.

See [Appendix A](#appendix-a---detailed-design) for the design and rationale.

Prototype / Implementation: <https://github.com/aws/aws-cdk/pull/14952>.

### Is this a breaking change?

This is not a breaking change.

### What are the drawbacks of this solution?

1. Ideally, the dependencies, `assert`, `cloudformation-diff` and `cfnspec`
   are all available to be consumed as regular dependencies but are not,
   since they are part of the same monorepo.

   Instead, the design 'vendors in' these dependencies, i.e., copies over
   the source code and rewrites imports, thereby increasing tech debt.

2. Any new feature or bug fix to the new assert module that require changes
   to the API needs to be performed both in the old assert module and new.
   This can lead to weird/complicated implementation, since they both follow
   different design patterns.

3. The 'jest' friendly interfaces that were previously available are no longer
   available.
   Users previously using -

   ```ts
   expect(stack).toHaveResource('Foo::Bar', { ... });
   ```

   will now have to use

   ```ts
   const assertions = TemplateAssertions.fromStack(stack);
   assertions.assertResource('Foo::Bar', { ... });
   ```

4. With the current solution, the `@aws-cdk/assertions` module must be part
   of the monocdk. It cannot be reorganized and released as-is into a
   separate repository.

   See [Appendix A](#appendix-a---detailed-design) for more details.

### What are the mitigations and/or long term plans to address these concerns?

Once this module reaches general availability, we will deprecate the old 'assert'
module. At that point, all of its source code can now be made as part of the new
'assert' module.

The dependencies on 'cloudformation-diff' and 'cfnspec' will need to be carefully
evaluated and a decision made on whether to lift-and-shift the relevant code, or
to move these out of the monorepo as independent modules.

Friendly interfaces for popular testing frameworks such as jest, nunit, junit, etc.
can be built as separate modules specific to those languages (not jsii modules)
on top of the new 'assert' library.
If necessary, this can be owned and maintained by the CDK team, but probably more
suited for the community to pick up and build as third party modules.

### What alternative solutions did you consider?

See [Appendix B](#appendix-b---alternatives) for alternatives.

### What is the high level implementation plan?

The implementation plan is fairly simple.

- Implement and release the new assert module.
- Migrate modules to use the new assert module.

### Are there any open issues that need to be addressed later?

None.

## Appendix A - Detailed Design

### Key Requirement

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

The 'assertion' module will be marked as 'experimental' and released as any other
experimental API.
This 'assertion' module would only be a `devDependencies` from other CDK modules,
and hence will not be recognized as a dependenecy of `aws-cdk-lib`.

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
