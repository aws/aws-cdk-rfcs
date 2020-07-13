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
  - [01-BASE-TYPES: Removal of base types](#01-base-types-removal-of-base-types)
  - [02-ASPECTS: Changes in Aspects API](#02-aspects-changes-in-aspects-api)
  - [03-DEPENDABLE: Changes to IDependable implementation](#03-dependable-changes-to-idependable-implementation)
  - [04-STACK-ROOT: Stacks as root constructs](#04-stack-root-stacks-as-root-constructs)
  - [05-METADATA-TRACES: Stack traces no longer attached to metadata by default](#05-metadata-traces-stack-traces-no-longer-attached-to-metadata-by-default)
  - [06-NO-PREPARE: The `prepare` hook is no longer supported](#06-no-prepare-the-prepare-hook-is-no-longer-supported)
  - [07-NO-SYNTHESIZE: The `synthesize` hook is no longer supported](#07-no-synthesize-the-synthesize-hook-is-no-longer-supported)
  - [08-VALIDATION: The `validate()` hook is now `node.addValidation()`](#08-validation-the-validate-hook-is-now-nodeaddvalidation)
  - [09-LOGGING: Logging API changes](#09-logging-logging-api-changes)
- [Motivation](#motivation)
- [Design](#design)
  - [01-BASE-TYPES](#01-base-types)
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
  - [Base types](#base-types)
  - [Synthesis](#synthesis)
  - [Prepare](#prepare)


# Release Notes

> This section "works backwards" from the v2.0 release notes in order to
> describe the user impact of this change.

**BREAKING CHANGE**

As part of CDK v2.0, all types related to the *constructs programming model*
have been removed from the AWS CDK and should be used directly from the
[constructs](https://github.com/aws/constructs) library.

For most CDK libraries and apps, you will likely just need change this:

```ts
import { Construct } from '@aws-cdk/core';
```

With this:

```ts
import { Cosntruct } from 'constructs';
```

The following table summarizes the API changes between 1.x and 2.x:

1.x|2.x
------|-----
`@aws-cdk/*` | `aws-cdk-lib` and `constructs@^4`
`import { Construct } from '@aws-cdk/core'` | `import { Construct } from 'constructs'`
`@aws-cdk/core.Construct` | `constructs.Construct`
`@aws-cdk/core.IConstruct` | `constructs.IConstruct`
`@aws-cdk/core.ConstructOrder` | `constructs.ConstructOrder`
`@aws-cdk/core.ConstructNode` | `constructs.Node`
`Construct.isConstruct(x)` | `x instanceof Construct`
`construct.node.applyAspect(aspect)` | `Aspects.of(construct).apply(aspect)`
`@aws-cdk/core.IDependable` | `constructs.IDependable`
`@aws-cdk/core.DependencyTrait` | `constructs.Dependable`
`@aws-cdk.core.DependencyTrait.get(x)` | `constructs.Dependable.of(x)`
`construct.node.dependencies` | Is now non-transitive
`construct.addMetadata()` | Stack trace not attached by default
`ConstructNode.prepare(node)`, `onPrepare()`, `prepare()` | Not supported
`ConstructNode.synthesize(node)`, `onSynthesize()`, `synthesize()` | Not supported
`construct.onValidate()`, `construct.validate()` hooks | Implement `constructs.IValidation` and call `node.addValidation()`
`ConstructNode.validate(node)` | `construct.node.validate()`

The following sections describe all the related breaking changes and details
migration strategies for each change.

## 01-BASE-TYPES: Removal of base types

The following `@aws-cdk/core` types have stand-in replacements in `constructs`:

- The `@aws-cdk/core.Construct` class has been replaced with `constructs.Construct`
- The `@aws-cdk/core.IConstruct` type has been replaced with `constructs.IConstruct`
- The `@aws-cdk/core.ConstructOrder` class has been replaced with `constructs.ConstructOrder`
- The `@aws-cdk/core.ConstructNode` class has been replaced with `constructs.Node`

## 02-ASPECTS: Changes in Aspects API

Aspects are not part of the "constructs" library, and therefore instead of
`construct.node.applyAspect(aspect)` use `Aspects.of(construct).apply(aspect)`.

The `Tag.add(scope, name, value)` API has been removed. To apply AWS tags to a
scope, use:

```ts
Tags.of(scope).add(name, value);
```

## 03-DEPENDABLE: Changes to IDependable implementation

If you need to implement `IDependable`:

- The `@aws-cdk/core.IDependable` type has been replaced with
  `constructs.IDependable`
- The `@aws-cdk/core.DependencyTrait` class has been replaced with
  `constructs.Dependable`
- `@aws-cdk.core.DependencyTrait.get(x)` is now `constructs.Dependable.of(x)`
- `construct.node.dependencies` is now **non-transitive** and returns only the
  dependencies added to the current node.

The method `construct.node.addDependency(otherConstruct)` __did not change__ and
can be used as before.

> TODO: You can use `construct.node.dependencyGraph` to access a rich object
> model for reflecting on the node's dependency graph.

## 04-STACK-ROOT: Stacks as root constructs

It is common in unit tests to use `Stack` as the root of the tree:

```ts
const stack = new Stack();
const myConstruct = new MyConstruct(stack, 'MyConstruct');
// make assertions
```

This is still a supported idiom, but in 2.x these root stacks will have an
implicit `App` parent. This means that `stack.node.scope` will be an `App`
instance, while previously it was `undefined`. The "root" stack will have a
construct ID of `Stack` (unless otherwise specified).

This has implications on the value of `construct.node.path` (it will be prefixed
with `Stack/`) and the value of `construct.node.uniqueId` (and any derivatives
of these two).

This means that as you migrate to v2.x, some unit tests may need to be updated
to reflect this change.

## 05-METADATA-TRACES: Stack traces no longer attached to metadata by default

For performance reasons, the `construct.node.addMetadata()` method will *not*
attach stack traces to metadata entries. You can explicitly request to attach
stack traces to a metadata entry using the `stackTrace` option:

```ts
construct.node.addMetadata(key, value, { stackTrace: true })
```

## 06-NO-PREPARE: The `prepare` hook is no longer supported

The **prepare** hook (`construct.onPrepare()` and `construct.prepare()`) is no
longer supported as it can easily be abused and cause construct tree corruption
when the tree is mutated during this stage.

Consider a design where you mutate the tree in-band, or use `Lazy` values or
Aspects if appropriate.

[TODO examples from the CDK itself]

The `ConstructNode.prepare(node)` method no longer exists. To realize references
& dependencies in a scope call `Stage.of(scope).synth()`.

## 07-NO-SYNTHESIZE: The `synthesize` hook is no longer supported

The `synthesize()` overload (or `onSynthesize()`) is no longer supported.
Synthesis is now implemented only at the app level.

If your use case for overriding `synthesize()` was to emit files into the cloud
assembly directory, you can now find the current cloud assembly output directory
during initialization using `Stage.of(this).outdir`.

The `ConstructNode.synthesize(node)` method no longer exists. However, since now
`Stage.of(scope)` is always defined and returns the enclosing stage/app, you
can can synthesize a construct node through `Stage.of(scope).synth()`.

For additional questions/guidance on how to implement your use case without this
hook, please post a comment on this GitHub issue: [TODO].

## 08-VALIDATION: The `validate()` hook is now `node.addValidation()`

To add validation logic to a construct, use `construct.node.addValidation()`
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

    this.node.addValidation({ validate: () => [ 'validation-error' ] });
  }
}
```

The static method `ConstructNode.validate(node)` is no longer available. You can
use `construct.node.validate()` which only validates the _current_ construct and
returns the list of all error messages returned from calling
`validation.validate()` on all validations added to this node.

## 09-LOGGING: Logging API changes

The `construct.node.addInfo()`, `construct.node.addWarning()` and
`construct.node.Error()` methods are now available under the
`Logging.of(construct)` API:

Instead of:

```ts
construct.node.addWarning('my warning');
```

Use:

```ts
import { Logging } from '@aws-cdk/core';

Logging.of(construct).addWarning('my warning');
```


# Motivation

There are various motivations for this change:

1. Removal of a redundant layer
2. User confusion caused by multiple `Construct` types
3. Inability to compose AWS CDK constructs into other domains
4. Non-intuitive dependency requirement on `constructs`

### 1. Redundant layer

The current compatibility layer does not have any logic in it. It is pure glue
introduced in order to avoid breaking v1.x users. As we release v2.0 we are able
to clean up this layer, and with it, improve maintainability and code hygiene.

### 2. Multiple `Construct` types

The current situation is error-prone since we have two `Construct` classes in
the type closure. For example, when a developer types `"Construct"` and uses
VSCode to _automatically add import statements_, the IDE will actually add an
import for `constructs.Construct`. If they define a custom construct class which
extends this type instead of the `core.Construct` type, it won't be possible to
pass an instance of this class as a scope to AWS CDK constructs such as `Stack`
for example.

### 3. Composability with other domains

The main motivation for this change is to enable composition of AWS CDK
constructs with constructs from other domains.

It is currently impossible to define AWS CDK constructs within a non-AWS-CDK
construct scope.

For example, consider the
[Terrastack](https://github.com/TerraStackIO/terrastack) project or a similar
one, which uses CDK constructs to define stacks through Terraform. Say we want to
use an AWS CDK L2 inside a Terraform stack construct:

```ts
const stack = new terrastack.Stack(...);

// COMPILATION ERROR: `this` is not a `cdk.Construct`.
new s3.Bucket(this, 'my-bucket');
```

Being able to create construct compositions from multiple domains is a powerful
direction for the CDK ecosystem, and this change is required in order to enable
these use case.

### 4. Non-intuitive dependency requirement

As we transition to [monolithic packaging] as part of v2.x, CDK users will have
to take a _peer dependency_ on both the CDK library (`aws-cdk-lib`) and
`constructs`.

> Currently, the AWS CDK also takes `constructs` as a normal dependency (similar
> to all dependencies), but this is about to change with mono-cdk.

The reason `constructs` will also be required (whether we leave the
compatibility layer or not) is due to the fact that all CDK constructs
eventually extend the base `constructs.Construct` class. This means that this
type is part of their public API and therefore a peer dependency is required
(otherwise, there could be incompatible copies of `Construct` in the node
runtime).

See the RFC for [monolithic packaging] for more details.

[monolithic packaging]: https://github.com/aws/aws-cdk-rfcs/blob/master/text/0006-monolothic-packaging.md

# Design

This section analysis the required changes and discusses the implementation
approach and alternatives.

For each change, we added a **What can we do on 1.x?** section which discusses
our strategy for front-loading the change into the 1.x branch to reduce forking
costs and/or alert users of the upcoming deprecation.

This design is based on this [proof of concept](https://github.com/aws/aws-cdk/pull/8962).

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

1. The `import` statement for `import { Construct } from 'construct'` would
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

## 02-ASPECTS

Aspects are actually a form of "prepare" and as such, if they mutate the tree,
their execution order becomes critical and extremely hard to get right. To that
end, we decided to remove them from the `constructs` library as they pose a risk
to the programming model.

However, we are aware that aspects are used in by AWS CDK apps and even 3rd
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
Aspects.of(scope).apply(aspect);
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
in 1.x, but the API to implement `IDependable` has been slightly changed.

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
uses this as the stack name when the stack does not have an ID (see [TODO]).

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

The main side effect of this change is that construct paths in unit tests will
now change. In the above example, `foo.node.path` will change from `MyFoo` to
`Stack/MyFoo`. Additionally, tests for resources that utilized `node.uniqueId`
to generate names will also change given `uniqueId` is based on the path.

Since app-less stacks are only used during tests, this should not have
implications on production code, but it does break some of our test suite.

### What can we do on 1.x?

In order to reduce [merge conflicts](#repository-migration-efforts) between 1.x
and 2.x we considered introducing this change on the 1.x branch prior to forking
off 2.x.

However, this is technically a breaking (behavioral) change for end-users since
`node.path` and `node.uniqueId`, and their derivatives, will change for trees
rooted by a `Stack`, and unit tests will need to be updated.

Therefore we propose to introduce this change as a feature flag over the 1.x
codebase and migrate all of our unit tests (I don't believe we have a way to
enable feature flags for all unit tests, but we can devise one).

This will allow us to update our tests in 1.x and avoid the merge conflicts
forking on 2.x

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
"prepare" logic at the stage level (into [prepare-app.ts](TODO)).

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
`Stage`-level ([TODO: ref]). The main reason was that we needed to "break" the
recursion in various domain-specific points (e.g. stages, nested stacks) which
meant that the generic logic of "traverse the entire tree and call `synthesize`"
did not hold. In `cdk8s`, the support for [TODO: chart dependencies] required
that the name of the output manifest will be determined based on the topologic
order at the app level. Here again, the generic approach failed.

In leu of those failures, we decided that there is no additional value in
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

Participation in synthesis is an "advanced" feature of the CDK framework and se
assume most end-users don't use this directly.

If they need "last minute processing", they would likely use `prepare()` (which
is also being [TODO: removed]) but not `synthesize()`.

The use case of emitting arbitrary files into the cloud assembly directory is
weak. The cloud assembly is a well-defined format, and is currently "closed".
There are no extension points that tools can identify. To that end, just writing
files to the cloud assembly output directory does not make tons of sense. Having
said that, it is still possible to do in the same way we plan for
`AssetStaging`.

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

INTENTIONALLY LEFT BLANK: an implementation plan will be added when the RFC is
scheduled for implementation.

> The implementation plan should analyze all the tasks needed in order to
> implement this RFC, and the planned order of implementation based on
> dependencies and analysis of the critical path.
>
> Either add the plan here or add link which references a separate document
> and/or a GitHub Project Board (and reference it here) which manages the
> execution of your plan.

We will try to front load as much of this change to 1.x in order to reduce the
merge conflict potential.

constructs 4.x

- [x] Migrate to projen
- [x] Branch to 4.x and release as @next
- [x] Reintroduce `c.node` instead of `Node.of(c)`
- [x] Removal of `onPrepare` and `onSynthesize` and all synthesis-related code.
- [x] Reintroduce dependencies
- [x] Change `node.dependencies` to return the list of node dependency (non recursive) and add `node.depgraph` which returns a `Graph` object from cdk8s.
- [x] Stack trace control

CDK changes:

- [x] cfn2ts
- [ ] Consider aliasing in TypeScript to reduce potential merge conflicts.
- [ ] assets/compat.ts
- [ ] Initial prototype: https://github.com/aws/aws-cdk/pull/8962
- [ ] Migration guide in https://github.com/aws/aws-cdk/issues/8909
- [ ] GitHub issue for "synthesize" and "prepare" guidance.
- [ ] Remove the use of "prepare" and "synthesize" in 1.x
- [ ] Implicit `App` for `Stack`s without a scope behind a feature flag and
      enable in our unit tests in 1.x
- [ ] Normalize reference to base types (`cdk.Construct` => `Construct`).
- [ ] Import https://github.com/awslabs/cdk8s/blob/master/packages/cdk8s/src/dependency.ts to "constructs"
- [ ] `constructs` documentation on how to implement centralized synthesis.

## Base types

- [ ] 1.x: Convert all `scope` to use `constructs.Construct` via an `awslint` rule.

## Synthesis

- [ ] 1.x: Implement synthesis changes
- [ ] 1.x: Add deprecation warning if `synthesize()` is implemented

## Prepare

