---
feature name: remove-constructs-compat
start date: 2020-07-05
rfc pr: (leave this empty)
related issue: [#192](https://github.com/aws/aws-cdk-rfcs/issues/192)
---

# Summary

As part of our effort to broaden the applicability of the CDK's programming
model to other domains such as [Kubernetes](https://cdk8s.io), we have extracted
the base `Construct` class (and a few related types) to an independent library
called [constructs](https://github.com/aws/constructs).

To preserve backwards compatibility in AWS CDK 1.x, a "compatibility layer"
([construct-compat.ts]) has been added to the AWS CDK. This layer served as an
API shim so that CDK code will continue to function without change.

As part [AWS CDK v2.0], we plan to remove this redundant layer and make some
improvements to a few APIs in "constructs" based on our learnings from CDK v1.x
and new projects such as CDK for Kubernetes.

This RFC describes the motivation, implications and plan for this project.

[AWS CDK v2.0]: https://github.com/aws/aws-cdk-rfcs/issues/156
[construct-compat.ts]: https://github.com/aws/aws-cdk/blob/fcca86e82235387b88371a0682cd0fc88bc1b67e/packages/%40aws-cdk/core/lib/construct-compat.ts

# Table of Contents

- [Summary](#summary)
- [Table of Contents](#table-of-contents)
- [Release Notes](#release-notes)
  - [00-DEPENDENCY: Declare a dependency on "constructs"](#00-dependency-declare-a-dependency-on-constructs)
  - [01-BASE-TYPES: Removal of base types](#01-base-types-removal-of-base-types)
  - [10-CONSTRUCT-NODE: `myConstruct.node` is now `myConstrct.construct`](#10-construct-node-myconstructnode-is-now-myconstrctconstruct)
  - [02-ASPECTS: Changes in Aspects API](#02-aspects-changes-in-aspects-api)
  - [03-DEPENDABLE: Changes to IDependable implementation](#03-dependable-changes-to-idependable-implementation)
  - [04-STACK-ROOT: Stacks as root constructs](#04-stack-root-stacks-as-root-constructs)
  - [05-METADATA-TRACES: Stack traces no longer attached to metadata by default](#05-metadata-traces-stack-traces-no-longer-attached-to-metadata-by-default)
  - [06-NO-PREPARE: The `prepare` hook is no longer supported](#06-no-prepare-the-prepare-hook-is-no-longer-supported)
  - [07-NO-SYNTHESIZE: The `synthesize` hook is no longer supported](#07-no-synthesize-the-synthesize-hook-is-no-longer-supported)
  - [08-VALIDATION: The `validate()` hook is now `node.addValidation()`](#08-validation-the-validate-hook-is-now-nodeaddvalidation)
  - [09-LOGGING: Logging API changes](#09-logging-logging-api-changes)
- [Motivation](#motivation)
  - [1. Redundant layer](#1-redundant-layer)
  - [2. Multiple `Construct` types](#2-multiple-construct-types)
  - [3. Composability with other domains](#3-composability-with-other-domains)
  - [4. Non-intuitive dependency requirement](#4-non-intuitive-dependency-requirement)
- [Design](#design)
  - [00-DEPENDENCY](#00-dependency)
  - [01-BASE-TYPES](#01-base-types)
  - [10-CONSTRUCT-NODE](#10-construct-node)
  - [02-ASPECTS](#02-aspects)
  - [03-DEPENDABLE](#03-dependable)
  - [04-STACK-ROOT](#04-stack-root)
  - [05-METADATA-TRACES](#05-metadata-traces)
  - [06-NO-PREPARE](#06-no-prepare)
  - [07-NO-SYNTHESIZE](#07-no-synthesize)
  - [08-VALIDATION](#08-validation)
  - [09-LOGGING](#09-logging)
- [Drawbacks](#drawbacks)
  - [User migration effort](#user-migration-effort)
  - [CDK codebase migration efforts](#cdk-codebase-migration-efforts)
  - [Staging of the 2.x fork](#staging-of-the-2x-fork)
- [Rationale and Alternatives](#rationale-and-alternatives)
  - [Alternatives considered](#alternatives-considered)
- [Adoption Strategy](#adoption-strategy)
- [Unresolved questions](#unresolved-questions)
- [Future Possibilities](#future-possibilities)
- [Implementation Plan](#implementation-plan)
  - [Preparation of 1.x](#preparation-of-1x)
  - [constructs 10.x](#constructs-10x)
  - [2.x Work](#2x-work)

# Release Notes

> This section "works backwards" from the v2.0 release notes in order to
> describe the user impact of this change.

**BREAKING CHANGE**: As part of CDK v2.0, all types related to the *constructs
programming model* have been removed from the AWS CDK and should be used
directly from the [constructs](https://github.com/aws/constructs) library.

For most CDK libraries and apps, you will likely just need change this:

```ts
import { Construct } from '@aws-cdk/core';
```

With this:

```ts
import { Construct } from 'constructs';
```

Additionally, The `node` property in `Construct` is now called `construct`. This
means, for example, order to find the `path` of a construct `foo`, use:

```ts
foo.construct.path // instead of `foo.node.path`
```

---

The following table summarizes the API changes between 1.x and 2.x. The
following sections describe all the related breaking changes and details
migration strategies for each change.

1.x|2.x
------|-----
`@aws-cdk/*` | `aws-cdk-lib` and `constructs@^4`
`import { Construct } from '@aws-cdk/core'` | `import { Construct } from 'constructs'`
`@aws-cdk/core.Construct` | `constructs.Construct`
`@aws-cdk/core.IConstruct` | `constructs.IConstruct`
`@aws-cdk/core.ConstructOrder` | `constructs.ConstructOrder`
`@aws-cdk/core.ConstructNode` | `constructs.Node`
`myConstruct.node` | `myConstruct.construct`
`myConstruct.node.applyAspect(aspect)` | `Aspects.of(myConstruct).add(aspect)`
`@aws-cdk/core.IDependable` | `constructs.IDependable`
`@aws-cdk/core.DependencyTrait` | `constructs.Dependable`
`@aws-cdk.core.DependencyTrait.get(x)` | `constructs.Dependable.of(x)`
`myConstruct.`node.dependencies` | Is now non-transitive
`myConstruct.`addMetadata()` | Stack trace not attached by default
`ConstructNode.prepareTree()`, `node.prepare()`, `onPrepare()`, `prepare()` | Not supported, use aspects instead
`ConstructNode.synthesizeTree()`, `node.synthesize()`, `onSynthesize()`, `synthesize()` | Not supported
`myConstruct.`onValidate()`, `myConstruct.`validate()` hooks | Implement `constructs.IValidation` and call `myConstruct.construct.addValidation()`
`ConstructNode.validate(node)` | `myConstruct.construct.validate()`


## 00-DEPENDENCY: Declare a dependency on "constructs"

As part of migrating your code to AWS CDK 2.0, you will need to declare a
dependency on the `constructs` library (in addition to the `aws-cdk-lib` library
which now includes the entire AWS CDK).

For libraries, this should be a peer dependency, similarly to your dependency on
the AWS CDK. You will likely also want to declare those as `devDependencies` in
order to be able to run tests in your build environment.

To increase interoperability of your library, the recommendation is to use the
lowest possible __caret__ version:

```json
{
  "peerDependencies": {
    "aws-cdk-lib": "^2.0.0",
    "constructs": "^10.0.0"
  },
  "devDependencies": {
    "aws-cdk-lib": "^2.0.0",
    "constructs": "^10.0.0"
  }
}
```

For apps, you should declare these as direct dependencies, and you would
normally want to use the highest version available:

```json
{
  "dependencies": {
    "aws-cdk-lib": "^2.44.0",
    "constructs": "^10.787.0"
  }
}
```

NOTE: Due to it's foundational nature, the `constructs` library is committed to
never introduce breaking changes. Therefore, it's version will be `10.x`.

## 01-BASE-TYPES: Removal of base types

The following `@aws-cdk/core` types have stand-in replacements in `constructs`:

- The `@aws-cdk/core.Construct` class has been replaced with `constructs.Construct`
- The `@aws-cdk/core.IConstruct` type has been replaced with `constructs.IConstruct`
- The `@aws-cdk/core.ConstructOrder` class has been replaced with `constructs.ConstructOrder`
- The `@aws-cdk/core.ConstructNode` class has been replaced with `constructs.Node`

See [examples](https://github.com/aws/aws-cdk/pull/9056/commits/e4dff913d486592b1899182e9a928765553654fa).

## 10-CONSTRUCT-NODE: `myConstruct.node` is now `myConstrct.construct`

The `node` property of `Construct` was removed in favor of a property named
`construct` in order to improve discoverability of the construct API and reduce
the chance for naming conflicts with generated APIs (see
[hashicorp/terraform-cdk#230](https://github.com/hashicorp/terraform-cdk/pull/230)).

For example, to add a dependency to a construct:

Before:

```ts
c1.node.addDependency(c2);
```

After:

```ts
c1.construct.addDependency(c2);
```

## 02-ASPECTS: Changes in Aspects API

Aspects are not part of the "constructs" library, and therefore instead of
`construct.node.applyAspect(aspect)` use `Aspects.of(construct).add(aspect)`.

The `Tag.add(scope, name, value)` API has been removed. To apply AWS tags to a
scope, use:

```ts
Tags.of(scope).add(name, value);
```

See [examples](https://github.com/aws/aws-cdk/pull/9056/commits/e4dff913d486592b1899182e9a928765553654fa).

## 03-DEPENDABLE: Changes to IDependable implementation

If you need to implement `IDependable`:

- The `@aws-cdk/core.IDependable` type has been replaced with
  `constructs.IDependable`
- The `@aws-cdk/core.DependencyTrait` class has been replaced with
  `constructs.Dependable`
- `@aws-cdk.core.DependencyTrait.get(x)` is now `constructs.Dependable.of(x)`
- `c.construct.dependencies` is now **non-transitive** and returns only the
  dependencies added to the current node.

The method `c.construct.addDependency(otherConstruct)` __did not change__ and
can be used as before.

> You can use the new `c.construct.dependencyGraph`  to access a rich object
> model for reflecting on the node's dependency graph.

See [examples](https://github.com/aws/aws-cdk/pull/9056/commits/e4dff913d486592b1899182e9a928765553654fa).

## 04-STACK-ROOT: Stacks as root constructs

It is common in unit tests to use `Stack` as the root of the tree:

```ts
const stack = new Stack();
const myConstruct = new MyConstruct(stack, 'MyConstruct');
// make assertions
```

This is still a supported idiom, but in 2.x these root stacks will have an
implicit `App` parent. This means that `stack.construct.scope` will be an `App`
instance, while previously it was `undefined`. The "root" stack will have a
construct ID of `Default` unless otherwise specified.

Please note that this also means that the value of `construct.path` for all
constructs in the tree would now have a `Default/` prefix (if it was `Foo/Bar`
it will now be `Default/Foo/Bar`).

> In contrast, the value of `construct.uniqueId` will _not_ change because `Default`
> is a special ID that is ignored when calculating unique IDs (this feature
> already exists in 1.x).

## 05-METADATA-TRACES: Stack traces no longer attached to metadata by default

For performance reasons, the `c.construct.addMetadata()` method will *not*
attach stack traces to metadata entries. Stack traces will still be associated
with all `CfnResource` constructs and can also be added to custom metadata using
the `stackTrace` option:

```ts
c.construct.addMetadata(key, value, { stackTrace: true })
```

See [examples](https://github.com/aws/aws-cdk/pull/9056/commits/e4dff913d486592b1899182e9a928765553654fa).

## 06-NO-PREPARE: The `prepare` hook is no longer supported

The **prepare** hook (`construct.onPrepare()` and `construct.prepare()`) is no
longer supported as it can easily be abused and cause construct tree corruption
when the tree is mutated during this stage.

Consider a design where you mutate the tree in-band, or use `Lazy` values or
Aspects if appropriate.

See [examples](https://github.com/aws/aws-cdk/pull/9056/commits/3d4fcb5ab72ca0777f3abfa2c4aa10e0d7deba6b).

Although we recommend that you rethink the use of "prepare", you can use this
idiom to implement "prepare" using aspects:

```ts
Aspects.of(this).add({ visit: () => this.prepare() });
```

The `ConstructNode.prepare(node)` method no longer exists. To realize references
& dependencies in a scope call `Stage.of(scope).synth()`.

## 07-NO-SYNTHESIZE: The `synthesize` hook is no longer supported

The `synthesize()` overload (or `onSynthesize()`) is no longer supported.
Synthesis is now implemented only at the app level.

If your use case for overriding `synthesize()` was to emit files into the cloud
assembly directory, you can now find the current cloud assembly output directory
during initialization using `Stage.of(this).outdir`.

See [examples](https://github.com/aws/aws-cdk/pull/9056/commits/02b45b50c27fffae1bfbc4f61f6adc1f8fd92672).

The `ConstructNode.synthesize(node)` method no longer exists. However, since now
`Stage.of(scope)` is always defined and returns the enclosing stage/app, you
can can synthesize a construct node through `Stage.of(scope).synth()`.

For additional questions/guidance on how to implement your use case without this
hook, please post a comment on [this GitHub issue](https://github.com/aws/aws-cdk/issues/8909).

## 08-VALIDATION: The `validate()` hook is now `node.addValidation()`

To add validation logic to a construct, use `c.construct.addValidation()`
method instead of overriding a protected `validate()` method:

Before:

```ts
class MyConstruct extends Construct {
  protected validate(): string[] {
    return [ 'validation-error' ];
  }
}
```

After:

```ts
class MyConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.construct.addValidation({ validate: () => [ 'validation-error' ] });
  }
}
```

The static method `ConstructNode.validate(node)` is no longer available. You can
use `c.construct.validate()` which only validates the _current_ construct and
returns the list of all error messages returned from calling
`validation.validate()` on all validations added to this node.

## 09-LOGGING: Logging API changes

The `construct.node.addInfo()`, `construct.node.addWarning()` and
`construct.node.Error()` methods are now available under the
`Logging.of(construct)` API:

Instead of:

```ts
myConstruct.node.addWarning('my warning');
```

Use:

```ts
import { Logging } from '@aws-cdk/core';

Logging.of(construct).addWarning('my warning');
```

See [examples](https://github.com/aws/aws-cdk/pull/9056/commits/e4dff913d486592b1899182e9a928765553654fa).

# Motivation

There are various motivations for this change:

1. Removal of a redundant layer
2. User confusion caused by multiple `Construct` types
3. Inability to compose AWS CDK constructs into other domains
4. Non-intuitive dependency requirement on `constructs`

## 1. Redundant layer

The current compatibility layer does not have any logic in it. It is pure glue
introduced in order to avoid breaking v1.x users. As we release v2.0 we are able
to clean up this layer, and with it, improve maintainability and code hygiene.

## 2. Multiple `Construct` types

The current situation is error-prone since we have two `Construct` classes in
the type closure. For example, when a developer types `"Construct"` and uses
VSCode to _automatically add import statements_, the IDE will actually add an
import for `constructs.Construct`. If they define a custom construct class which
extends this type instead of the `core.Construct` type, it won't be possible to
pass an instance of this class as a scope to AWS CDK constructs such as `Stack`
for example.

## 3. Composability with other domains

The main motivation for this change is to enable composition of AWS CDK
constructs with constructs from other domains.

It is currently impossible to define AWS CDK constructs within a non-AWS-CDK
construct scope.

For example, consider the [CDK for
Terraform](https://github.com/hashicorp/terraform-cdk) or a similar project,
which uses constructs to define stacks through Terraform.

We are currently working with HashiCorp to enable the following use case in the
Terraform CDK:

```ts
import * as cdktf from 'cdktf';        // <=== Terraform CDK
import * as s3 from '@aws-cdk/aws-s3'; // <=== AWS CDK

const stack = new cdktf.TerraformStack(...);

// COMPILATION ERROR: `this` is of type `constructs.Construct` and not a `@aws-cdk/core.Construct`.
new s3.Bucket(this, 'my-bucket');
```

In order to enable this usage, we will need `s3.Bucket` to accept any object
that implements `constructs.Construct` as its `scope`. At the moment, this will
fail compilation with the error above, because the `scope` in `s3.Bucket` is
`core.Construct`.

Being able to create compositions from multiple CDK domains is a powerful
direction for the CDK ecosystem, and this change is required in order to enable
these use case.

## 4. Non-intuitive dependency requirement

As we transition to [monolithic packaging] as part of v2.x, CDK users will have
to take a _peer dependency_ on both the CDK library (`aws-cdk-lib`) and
`constructs`.

> Currently, the AWS CDK also takes `constructs` as a normal dependency (similar
> to all dependencies), but this is about to change with mono-cdk.

The reason `constructs` will have to be defined as a peer-dependency of the AWS
CDK, whether we leave the compatibility layer or not, is due to the fact that
all AWS CDK constructs eventually extend the base `constructs.Construct` class.
This means that this type is part of their public API, and therefore must be
defined as a peer dependency (otherwise, there could be incompatible copies of
`Construct` in the dependency closure).

The removal of the compatibility layer means that now anyone who uses the AWS
CDK will need to explicitly use the `constructs.Construct` type (even for
trivial apps), and therefore it would "make sense" for them to take a dependency
on the `constructs` library.

See the RFC for [monolithic packaging] for more details.

[monolithic packaging]: https://github.com/aws/aws-cdk-rfcs/blob/master/text/0006-monolothic-packaging.md

# Design

This section analysis the required changes and discusses the implementation
approach and alternatives.

For each change, we added a **What can we do on 1.x?** section which discusses
our strategy for front-loading the change into the 1.x branch to reduce forking
costs and/or alert users of the upcoming deprecation.

This design is based on this [proof of concept](https://github.com/aws/aws-cdk/pull/9056).

## 00-DEPENDENCY

In order to enable composability with other CDK domains (Terraform, Kubernetes),
all constructs must use the same version of the `Construct` base class.

As long as all libraries in a closure take a __peer dependency__ on a compatible
version of `constructs`, the npm package manger will include a single copy of
the library, and therefore all constructs will derive from the same `Construct`
(and more importantly, accept the same `Construct` for `scope`).

Practically this means that we can never introduce a major version of
`constructs` because any major version will require a new major version of all
CDKs, and that is impossible to require or coordinate given the decentralized
nature of the ecosystem.

We propose to take a commitment to __never introduce breaking changes in
"constructs"__. This implies that we will never introduce another major version.
To symbolize that to users, we will use the major version `10.x`.

## 01-BASE-TYPES

Once `construct-compat.ts` is removed from `@aws-cdk/core`, all CDK code (both
the framework itself and user code) would need to be changed to use the types
from `constructs`.

Since the APIs are similar in almost all cases, this is a simple mechanical
change as shown in the [release notes](#release-notes).

### What can we do on 1.x?

The main concern for the CDK codebase is maintaining this change alongside a 1.x
branch until we switch over to 2.x. Since this change includes modifications to
all `import` sections in almost all of our files, merge conflicts are imminent.

To reduce these costs, we propose to modify the `scope` argument on all  1.x to
accept `constructs.Construct` instead of `core.Construct`.

This will provide the following benefits (enforced by an `awslint` rule):

1. The `import` statement for `import { Construct } from 'constructs'` would
   already exist which will reduce merge conflicts.
2. It will unlock composition of framework constructs into other domains (e.g.
   it will be possible to pass an AWS CDK L2 to a terraform stack).

Note that we will *not* change the base classes to `constructs.Construct`
because it is technically (and practically) a breaking API change (we must maintain
the invariant that "`s3.Bucket` is a `core.Construct`".

The remaining change in 2.x will be to update any base classes to use
`constructs.Construct` but this is actually not very prevalent in the framework
code because the majority of constructs actually extend `core.Resource`.

Alternatives considered:

- **Do nothing in 1.x**: will incur an ongoing maintenance cost of the 1.x -> 2.x
  merge conflicts.
- **Automatic merge resolution and import organization**: requires research and
  development, not necessarily worth it.

## 10-CONSTRUCT-NODE

Since we won't be able to release additional major versions of the
"constructs" library (in order to ensure interoperability between domains is always
possible), we need to closely examine the API of this library.

In particular, the API of the `Construct` class, which is the base of all
constructs in all CDKs, should be as small as possible in order not to "pollute"
domain-specific APIs introduced in various domains.

In many cases (cdk8s, cdktf), constructs are *generated* on-demand from
domain-specific API specifications. In such cases, we need to ensure that the
API in `Construct` does not conflict with generated property names or methods.

The current API of `Construct` in the base class (2.x, 3.x) only includes a
few protected `onXxx` methods (`onPrepare`, `onValidate` and
`onSynthesize`). Those methods will be removed in 10.x
([prepare](#06-no-prepare) and [synthesize](#07-no-synthesize) are no longer
supported and [validate](#08-validation) will be supported through
`addValidation()`).

In AWS CDK 1.x the construct API is available under `myConstruct.node`. This
API has been intentionally removed when we extracted "constructs" from the AWS CDK
in order to allow the compatibility layer in AWS CDK 1.x to use the same property name
and expose the shim type (jsii does not allow changing the type of a property in a subclass). 

The base library currently offers `Node.of(scope)` as an alternative - but this API is cumbersome
to use and not discoverable. In evidence, in CDK for Terraform, they chose to offer [`constructNode`]
in `TerraformElement` as a sugar for `Node.of()`.

[`constructNode`]: https://github.com/hashicorp/terraform-cdk/blob/5becfbc699180adfe920dec794200bbf56dda0a7/packages/cdktf/lib/terraform-element.ts#L21

Another downside of `Node.of()` is that it means that the `IConstruct` interface
is now an empty interface, which is a very weak type in TypeScript due to
structural typing (it's structurally identical to `any`).

As we evaluate this use case for constructs 10.x, we would like to restore the
ability to access the construct API from a property of `Construct`, and use that
property as the single marker that represents a construct type (`IConstruct`).

To reduce the risk of naming conflicts (e.g. see [Terraform CDK
issue](https://github.com/hashicorp/terraform-cdk/pull/230)) between `node` and
domain-specific APIs, we propose to introduce this API under the name
`construct` (of type `Node`).

This has a few benefits:

1. It's semantically signals that "this is the construct API".
2. The chance for conflicts with domain-specific names is low ("construct" is not prevalent).
3. We can introduce this API while deprecating `node` in AWS CDK 1.x.

The main downside is that it is **a breaking change** in AWS CDK 2.x. There is
likely quite a lot of code out there (a [few
hundred](https://github.com/search?q=cdk+node.addDependency++extension%3Ats&type=Code&ref=advsearch&l=&l=)
results for an approximated GitHub code search).

> We also considered the name `constructNode` as an alternative but there is no
> additional value in the word "node" being included, especially given the type
> is `Node`.

### What can we do in 1.x

As mentioned above, since this is a new name for this property, we can
technically introduce it in 1.x and announce that `node` is deprecated. This
will allow users to migrate to the new API before 2.x is released and hopefully
will reduce some of the friction from the 2.x migration.

To encourage users to migrate, we will consider introducing this deprecation
through a runtime warning message (as well as the @deprecated API annotation).

## 02-ASPECTS

Aspects are actually a form of "prepare" and as such, if they mutate the tree,
their execution order becomes critical and extremely hard to get right. To that
end, we decided to remove them from the `constructs` library as they pose a risk
to the programming model.

However, we are aware that aspects are used by AWS CDK apps and even 3rd
party libraries such as [cdk-watchful](https://github.com/eladb/cdk-watchful).

Therefore, we propose to continue to support aspects in 2.x, with the goal of
rethinking this programming model for a future major version. One future
direction is to turn aspects into "reactive" so that they subscribe to tree
events and react in-band during initialization, and not as a separate phase.

Since aspects are no longer part of the base programming model, we need a way to
apply aspects to scopes for AWS CDK apps. To do that, we propose to use the
"trait" pattern, which is becoming a common idiom for offering APIs over CDK
scopes:

```ts
Aspects.of(scope).add(aspect);
```

The major downside of this change is discoverability, but
`construct.node.applyAspect` is not necessarily more discoverable. We will make
sure documentation is clear.

We will use this opportunity to normalize the tags API and change it to use the same
pattern: `Tags.of(x).add(name, value)`.

### What can we do on 1.x?

- We will migrate the 1.x branch to `Aspects.of(x)` and add a deprecation
  warning to `this.node.applyAspect()`.
- Introduce `Tags.of(x).add()` and add a deprecation warning to `Tag.add()`.

## 03-DEPENDABLE

The `constructs` library supports dependencies through `node.addDependency` like
in 1.x, but the API to implement `IDependable` has been changed.

The `constructs` library also introduces `DependencyGroup` which is a mix
between `CompositeDependable` and `ConcreteDependable`.

### What can we do on 1.x?

It should be possible to migrate the 1.x codebase to use the new APIs without
any breaking changes to users.

## 04-STACK-ROOT

If we move staging of assets to the initialization phase, it means we need to
know at that time where is the cloud assembly output directory. As mentioned
above, in production this information is available from the enclosing `Stage`.

This works in production but introduces a minor issue with unit tests which use
a `Stack` as the root construct. This is a very common pattern in the CDK
codebase today:

```ts
const stack = new Stack();
const foo = new MyFoo(stack, 'MyFoo');

expect(stack).to(haveResource('AWS::Foo'));
```

In such cases, assets will not work because the output directory is only
determined later (in the `expect` call).

One alternative would be to simply modify these unit tests so that stacks are no
longer used as roots (basically add `new App()` as the scope). This approach
would require a change in many unit tests across the code base with no clear
value to users.

We propose to modify the `Stack` construct such that if a stack is created
without an explicit `scope`, an `App` instance will automatically be created and
used as it's scope.

```ts
const stack = new Stack();
assert(stack.node.scope instanceof App); // previously it was `undefined`
```

Since only the root construct may have an empty ID, we will also need to assign
an ID. We propose to use `"Stack"` since we already have fallback logic that
uses this as the stack name when the stack does not have an ID (see
[stack.ts](https://github.com/aws/aws-cdk/blob/8c0142030dce359591aa76fe314f19fce9eddbe6/packages/%40aws-cdk/core/lib/stack.ts#L920)).

This change will allow us to remove any special casing we have for stacks in the
testing framework and throughout the synthesis code path (we have quite a lot of
that), because we will be able to assume that `Stage.of(construct.node.root)` is
never `undefined` and has a `synth()` method which returns a cloud assembly.

Unit tests sometimes use "incremental tests" for synthesized templates. For
example:

```ts
const stack = new Stack();
const c1 = new MyConstruct(stack, 'c1', { foos: [ 'bar' ] });
expect(stack).toHaveResource('AWS::Resource', {
  Foos: [ 'bar' ]
});

// now add a "foo" and verify that the synthesized template contains two items
c1.addFoo('baz');
expect(stack).toHaveResource('AWS::Resource', {
  Foos: [ 'bar', 'baz' ]
});
```

Since `stage.synth()` (which is called by `expect(stack)`) would reuse the
synthesized output if called twice, we will also need to introduce a
`stage.synth({ force: true })` option. This will be the default behavior when
using `expect(stack)` or `SynthUtils.synth()`.

### Preserving unique IDs using an ID of `Default`

A side effect of adding a `App` parent to "root" stacks is that we now have an
additional parent scope for all constructs in the tree. The location of the
construct in the tree is taken into account when calculating `node.path` and
`node.uniqueId`.

Since `uniqueId` is used in several places throughout the AWS Construct Library
to allocate names for resources, and we have multiple unit tests that expect
these values, we will use the ID `Default` for the root stack.

The `uniqueId` algorithm in the constructs library (see [reference]()) ignores
any node with the ID `Default` for the purpose of calculating the unique ID,
which allows us to perform this change without breaking unique IDs.

We will accept the fact that `node.path` is going to change for this specific
use case (only relevant in tests).

### Alternative considered

#### Alternative 1: Breaking unique IDs

We explored the option of fixing all these test expectations throughout the CDK
code base and back port this change over the 1.x behind a feature flag in order
to reduce the potential merge conflicts between 1.x and 2.x.

The downsides of this approach are:

1. This is technically a breaking (behavioral) change for end-users since
   `node.path` and `node.uniqueId`, and their derivatives, will change for trees
   rooted by a `Stack`, and unit tests will need to be updated.
1. We currently don't have a way to implicitly run all our unit tests behind a
   feature flag, and it is not a trivial capability to add.

#### Alternative 2: `node.relocate()`

We also explored the option of introducing an additional capability to
constructs called `node.relocate(newPath)` which allows modifying the path of a
scope such that all child scopes will automatically be "relocated" to a new
path. This would have allowed avoiding the breakage in `node.path` but would
have also introduced several other idiosyncrasies and potential violations of
invariants such as the fact that a path is unique within the tree.

### What can we do on 1.x?

We will introduce this change over the 1.x branch as-is, acknowledging that we
are technically breaking the behavior of `node.path` in unit tests which use
`Stack` as the root. Since we are not breaking `uniqueId`, we expect this to be
tolerable over the 1.x branch.

## 05-METADATA-TRACES

Since stack traces are not attached to metadata entries by default in constructs
4.x, we will need to pass `stackTrace: true` for `CfnResource`s. This will
preserve the deploy-time stack traces which are very important for users.

Other metadata entries will not get stack traces by default, and that's a
reasonable behavioral change.

### What can we do on 1.x?

No need to introduce over 1.x as the change is very local to `CfnResource` and
therefore can be applies over 2.x without risk.

## 06-NO-PREPARE

The "prepare" hook was removed from constructs since it is a very fragile API.
Since the tree can be mutated during prepare, the order of `prepare` invocations
becomes critical, and almost impossible to get right without a rich model of
relationships between these "prepare" calls.

The prepare hook was used in the CDK in a few cases:

1. Resolution of references across stacks and nested stacks
2. Resolution of dependencies between constructs across stacks
3. Calculation of logical IDs based on hashes of other resources (API GW
   Deployment, Lambda Version).

The first two use cases have already been addressed by centralizing the
"prepare" logic at the stage level (into [prepare-app.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/core/lib/private/prepare-app.ts)).

### What can we do on 1.x?

- The 3rd item can be addressed using `Lazy` tokens (see
  [example](https://github.com/aws/aws-cdk/pull/8962/files#diff-51d435d71a31c2607f923fc4d96cac56R140)),
  and will be addressed on 1.x prior to the 2.x fork.
- We will also add a deprecation warning on 1.x which will identify constructs
  that implement "prepare" and refer users to a GitHub issue for details and
  consultation.

## 07-NO-SYNTHESIZE

Version 4.x of the `constructs` library does not contain a lifecycle hook for
synthesis as described [above](#the-synthesize-hook-is-no-longer-supported).

### Motivation

The reason this is not available at the base class is because the abstraction
did not "hold water" as the AWS CDK evolved and new CDKs emerged.  In the AWS
CDK, we eventually ended up with a centralized synthesis logic at the
`Stage`-level
([synthesis.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/core/lib/private/synthesis.ts)).
The main reason was that we needed to "break" the recursion in various
domain-specific points (e.g. stages, nested stacks) which meant that the generic
logic of "traverse the entire tree and call `synthesize`" did not hold. In
`cdk8s`, the support for [chart
dependencies](https://github.com/awslabs/cdk8s/blob/ef95b9ffce8a39200e028c2fe8acc55a9915161c/packages/cdk8s/src/app.ts#L39)
required that the name of the output manifest will be determined based on the
topologic order at the app level. Here again, the generic approach failed.

In lieu of those failures, we decided that there is no additional value in
actually offering a synthesis mechanism at the `constructs` level. Each
CDK-domain implements synthesis at the "right" level. This does not mean that
specific domains can't offer a decentralized approach (i.e. call a method called
"synthesize" on all constructs in the tree), it just means that this is not
provided at the base `Construct` class.

### Implications on CDK code base

In the AWS CDK itself, `synthesize()` was used in three locations:

1. `Stack` - creates a CFN template and adds itself to the cloud assembly manifest.
2. `AssetStaging` - stages an asset into the cloud assembly.
3. `TreeMetadata` - creates `tree.json` with information about the construct tree.

For `Stack` and `TreeMetadata`, we will convert the generic `synthesize()`
method to `_synthesizeTemplate()` and `_synthesizeTree()` and will call them
from the centralized synthesis function.

The `AssetStaging` construct does not really need to wait until synthesis in
order to stage the asset. In fact, all the information required already exists
during initialization. The only missing information is the cloud assembly output
directory, and this information is actually known during initialization (we know
this as soon as the CDK app is created). Therefore, the solution for
`AssetStaging` is to move the staging logic to the constructor and use
`Stage.of(this).outdir` to find the output directory of the current stage.

### Implications on end-users

Participation in synthesis is an "advanced" feature of the CDK framework and we
assume most end-users don't use this directly.

If they need "last minute processing", they can add an aspect to the node which
will be applied before synthesis (the alternative to "prepare").

The use case of emitting arbitrary files into the cloud assembly directory is
weak. The cloud assembly is a well-defined format, and is currently "closed".
There are no extension points that tools can identify.

To that end, just writing files to the cloud assembly output directory does not
make tons of sense. Yet, if there is still a use case for writing files during
initialization, it is possible to find out the output directory through
`Stage.of(scope).outdir`. This is how asset staging will be implemented.

### What can we do on 1.x?

1. The framework changes should be done on the 1.x branch as they are non-breaking.
2. We will also add a deprecation notice that identifies the existence of a
   `synthesize()` method on a construct (during synthesis) and warns users that
   this hook will no longer be available in 2.x, offering a GitHub issue for
   details consultation.

## 08-VALIDATION

Since construct validation is quite rare and we want to encourage users to
validate in entry points, in constructs 4.x, the `validate()` protected method
was removed and `node.addValidation()` can be used to add objects that implement
`IValidation`.

An error will be thrown if a `validate()` method is found on constructs with
instructions on how to implement validation in 2.x.

### What can we do on 1.x?

We can introduce this change over the 1.x as long as we continue to support
`validate()` alongside a deprecation warning with instructions on how to migrate
to the new API.

## 09-LOGGING

We decided that logging is not generic enough to include in `constructs`. It
emits construct metadata that is very CLI specific (e.g. `aws:cdk:warning`) and
currently there is no strong abstraction.

To continue to enable logging, we will utilize the `Logging.of(x).addWarning()` pattern.

### What can we do on 1.x?

We can introduce this change on 1.x and add a deprecation warning.

# Drawbacks

## User migration effort

The main drawback from users' point of view is the introduction of the
aforementioned breaking changes as part of the transition to CDK 2.0. As
mentioned above, for the majority of users, the migration will be trivial and
mechanical (import from "constructs" instead of "@aws-cdk/core").

The removal of the "prepare" and "synthesize" hooks may require users to rethink
their design in very advanced scenarios. We will create a GitHub issue to
consult users on alternative designs.

## CDK codebase migration efforts

The AWS CDK codebase itself utilizes all of these APIs, and the migration effort
is quite substantial.

Having said that, the majority of this work is already complete and a branch is
being maintained with these changes as a pre-cursor to the v2.x fork.

## Staging of the 2.x fork

Since this change involves modifications to the CDK's source code, it may cause
merge conflicts as during the period in which we need to forward-port or
back-port code between the v1.x branch and the v2.x branches.

The key would be to continuously merge between the branches.

# Rationale and Alternatives

As a general rule, software layers which do not provide value to users should
not exist. The constructs compatibility layer was added as solution for
maintaining backwards compatibility within the v1.x version line while we
extract `constructs` into an independent library.

Redundant layers are expensive to maintain and are prone to idiosyncrasies as
they evolve over time (for example, a CDK engineer may be tempted to add an
AWS-specific feature in this layer, making it harder to clean up later).

If we consider the various [reasons](#drawbacks) not to take this change, the
main reason would be to simplify the [migration for users from 1.x to
2.x](#user-migration-effort). The major version 2.x is already required to
introduce monolithic packaging, and this change, for most users, is likely to be
trivial (see [above](#breaking-changes)). Therefore, we believe this is probably
not the correct motivation to reject this proposal.

The [repository migration](#repository-migration-efforts) efforts and
[co-existence of 2.x/1.x](#co-existence-of-2x1x) are both one-off costs this
proposal suggests ways to reduce the chance for merge conflicts across these
branches.

## Alternatives considered

At a high-level, we may consider to postpone this change to v3.x or to never
take it, leaving this compatibility layer in place for eternity.

If we examine the various [motivations](#motivation) for this change, we may
come up with various alternatives, all of which eventually cause a breaking
change to our users.

For example, we considered only changing the type of the `scope` argument to all
CDK constructs to use `constructs.Construct`, while the base class will still
extend `cdk.Construct`. This will likely confuse users who design their own
constructs as they won't know which construct to extend, the two base classes
will slowly diverge from each other as both layers evolve.

Another alternative is to rename `cdk.Construct` to something like
`AwsConstruct`. This, would take up most of the cost of this change (which is
the CDK codebase change and merge risks against the fork).

Postponing to v3.x will leave us with the set exact set of problems, only with a more mature ecosystem which is harder to migrate off of.

The [Design](#design) section describes alternatives for various aspects of this
project.

# Adoption Strategy

See [Release Notes](#release-notes).

# Unresolved questions

- [ ] Automation of `import` conflict resolution.

> - What parts of the design do you expect to resolve through the RFC process
>   before this gets merged?
> - What parts of the design do you expect to resolve through the implementation
>   of this feature before stabilization?
> - What related issues do you consider out of scope for this RFC that could be
>   addressed in the future independently of the solution that comes out of this
>   RFC?

# Future Possibilities

> Think about what the natural extension and evolution of your proposal would be
> and how it would affect CDK as whole. Try to use this section as a tool to more
> fully consider all possible interactions with the project and ecosystem in your
> proposal. Also consider how this fits into the roadmap for the project.
>
> This is a good place to "dump ideas", if they are out of scope for the RFC you
> are writing but are otherwise related.
>
> If you have tried and cannot think of any future possibilities, you may simply
> state that you cannot think of anything.

# Implementation Plan

## Preparation of 1.x

We will try to front load as much of this change to 1.x in order to reduce the
merge conflict potential.

To that end, we will continuously merge from "master" into [the POC
branch](https://github.com/aws/aws-cdk/pull/9056) and slowly back port changes
from it into `master` as much as possible. The goal is the minimize the changes
between master and the POC branch which will be merged into the 2.x branch once
created.

- [01-BASE-TYPES](#01-base-types)
  - [ ] Normalize reference to base types (`cdk.Construct` => `Construct`).
  - [ ] Use an `awslint` rule to modify the `scope` argument on all 1.x to
    accept `constructs.Construct` instead of `core.Construct`
- [10-CONSTRUCT-NODE](#10-construct-node)
  - [ ] Introduce `c.construct` as an alias to `c.node`
  - [ ] Deprecate `c.node` (with a warning message)
  - [ ] Replace all `c.node` with `c.construct`.
- [02-ASPECTS](#02-aspects)
  - [ ] Introduce `Aspects.of(x)` and deprecate `applyAspect`
  - [ ] Introduce `Tags.of()` and deprecate `Tag.add()`
- [03-DEPENDABLE](#03-dependable)
  - [ ] Introduce `Dependable` as an alias to `DependencyTrait`, introduce
    `DependencyGroup`
- [04-STACK-ROOT](#04-stack-root)
  - [ ] Introduce `node.relocate()` in constructs 3.x
  - [ ] Implement implicit `App` for root `Stack`s, relocated to "".
- [05-METADATA-TRACES](#05-metadata-traces)
  - N/A
- [06-NO-PREPARE](#06-no-prepare)
  - [ ] Back port [this
    commit](https://github.com/aws/aws-cdk/pull/9056/commits/3d4fcb5ab72ca0777f3abfa2c4aa10e0d7deba6b)
    to master
  - [ ] Add a deprecation warning if `onPrepare()` or `prepare()` is identified
    on a construct during synthesis
- [07-NO-SYNTHESIZE](#07-no-synthesize)
  - [ ] Back port the changes related to synthesis from [this
    commit](https://github.com/aws/aws-cdk/pull/9056/commits/02b45b50c27fffae1bfbc4f61f6adc1f8fd92672)
  - [ ] Add a deprecation warning if `onSynthezize()` or `synthesize()` is
    declared on a construct
- [08-VALIDATION](#08-validation)
  - [ ] Introduce `node.addValidation()` and deprecate `validate()` and
    `onValidate()` by back porting [this
    commit](https://github.com/aws/aws-cdk/pull/9056/commits/42bd929aa36dc97ae39b15b77cf1f69d754c4a92)
    to master
- [09-LOGGING](#09-logging)
  - [ ] Introduce `Logging.of()` deprecate `node.addWarning/error/info`.

## constructs 10.x

[This branch](https://github.com/aws/constructs/pull/133) is the staging branch
for constructs 10.x.

- [00-DEPENDENCY](#00-dependency)
  - [ ] Document API compatibility assurance and the 10.x version number.
- [01-BASE-TYPES](#01-base-types)
  - [x] Reintroduce `Construct.isConstruct()`.
- [10-CONSTRUCT-NODE](#10-construct-node)
  - [ ] Reintroduce `construct.construct` instead of `Node.of(construct)`
- [02-ASPECTS](#02-aspects)
  - [x] Remove aspects (`IAspect` and `node.applyAspect`).
- [03-DEPENDABLE](#03-dependable)
  - [x] Reintroduce dependencies (`IDependable`, `Dependable`,
    `DependencyGroup`)
  - [x] Change `node.dependencies` to return the list of node dependency (non
    recursive) and add `node.depgraph` which returns a `Graph` object from
    cdk8s.
  - [x] Change `addDependency` to accept `IDependable` instead of `IConstruct`.
  - [x] Return only local dependencies in `node.dependencies`
  - [ ] Migrate [DependencyGraph](https://github.com/awslabs/cdk8s/blob/master/packages/cdk8s/src/dependency.ts) from cdk8s into `constructs`.
- [04-STACK-ROOT](#04-stack-root)
  - N/A
- [05-METADATA-TRACES](#05-metadata-traces)
  - [x] Do not emit stack traces in `addMetadata` (`{ stackTrace: true }`).
- [06-NO-PREPARE](#06-no-prepare)
  - [x] Removal of `onPrepare` and `node.prepare()`
- [07-NO-SYNTHESIZE](#07-no-synthesize)
  - [x] Removal of `onSynthesize` and `node.synthesize()`
  - [ ] Expose `lock()` and `unlock()`.
- [08-VALIDATION](#08-validation)
  - [ ] Introduce `IValidation`, `addValidation()` and `node.validate()`.
- [09-LOGGING](#09-logging)
  - [x] Remove `node.addWarning()`, `node.addError()`, ...

## 2.x Work

- [ ] Once the 2.x branch will be created, we will merge the remaining changes
  from the POC branch into it.
- [ ] Write a migration guide with guidance on `synthesize` and `prepare` in
  <https://github.com/aws/aws-cdk/issues/8909>
- [ ] Updates to Developer Guide (add 2.x section)
- [ ] Updates to READMEs across the library (add 2.x section)
