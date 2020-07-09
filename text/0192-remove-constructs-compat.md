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
[construct-compat.ts]: https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/core/lib/construct-compat.ts

# Table of Contents

- [Summary](#summary)
- [Table of Contents](#table-of-contents)
- [Release Notes](#release-notes)
  - [Removal of base types](#removal-of-base-types)
  - [Changes in Aspects API](#changes-in-aspects-api)
  - [Changes to IDependable implementation](#changes-to-idependable-implementation)
  - [Stacks as root constructs](#stacks-as-root-constructs)
  - [Stack traces no longer attached to metadata by default](#stack-traces-no-longer-attached-to-metadata-by-default)
  - [Lifecycle hooks removal](#lifecycle-hooks-removal)
  - [Summary](#summary-1)
- [Motivation](#motivation)
- [Design](#design)
  - [Removal of the base types (`cdk.Construct`, `cdk.IConstruct`, ...)](#removal-of-the-base-types-cdkconstruct-cdkiconstruct-)
  - [Removal of "synthesize"](#removal-of-synthesize)
  - [Removal of "prepare"](#removal-of-prepare)
  - [Validation changes](#validation-changes)
  - [Stack trace settings](#stack-trace-settings)
  - [Info/warning/error message metadata key changes](#infowarningerror-message-metadata-key-changes)
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


# Release Notes

> This section "works backwards" from the v2.0 release notes in order to
> describe the user impact of this change.

**BREAKING CHANGE**

As part of CDK v2.0, all types related to the *constructs programming model*
have been removed from the AWS CDK and should be used directly from the
[constructs](https://github.com/aws/constructs) library.

For the majority of CDK libraries and apps, you will simply need to add
`constructs@^4` to your `package.json` and replace:

```ts
import { Construct } from '@aws-cdk/core';
```

with:

```ts
import { Cosntruct } from 'constructs';
```

The following sections describe all the breaking changes related to this
project:

## Removal of base types

The following `@aws-cdk/core` types have stand-in replacements "constructs":

- The `@aws-cdk/core.Construct` class has been replaced with `constructs.Construct`
- The `@aws-cdk/core.IConstruct` type has been replaced with `constructs.IConstruct`
- The `@aws-cdk/core.ConstructOrder` class has been replaced with `constructs.ConstructOrder`
- The `@aws-cdk/core.ConstructNode` class has been replaced with `constructs.Node`
- `Construct.isConstruct(x)` should be replaced with `x instanceof Construct`.

## Changes in Aspects API

Aspects are not part of the "constructs" library, and therefore instead of
`construct.node.applyAspect(aspect)` use `Aspects.of(construct).apply(aspect)`.

To apply AWS tags to a scope, prefer `Tag.add(scope, name, value)`.

> TODO: should we change to `Tags.of(scope).add(name, value)`?

## Changes to IDependable implementation

The method `construct.node.addDependency(otherConstruct)` did not change, and it
is likely the primary usage, and therefore most users won't be impacted.

If you need to implement `IDependable`, read on:

- The `@aws-cdk/core.IDependable` type has been replaced with `constructs.IDependable`
- The `@aws-cdk/core.DependencyTrait` class has been replaced with `constructs.Dependable`
- `@aws-cdk.core.DependencyTrait.get(x)` is now `constructs.Dependable.of(x)`
- `construct.node.dependencies` is now **non-transitive** and returns only the dependencies added to the current node.

> TODO: You can use `construct.node.dependencyGraph` to access a rich object
> model for reflecting on the node's dependency graph.

## Stacks as root constructs

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

## Stack traces no longer attached to metadata by default

For performance reasons, the `construct.addMetadata()` method will *not* attach
stack traces to metadata entries. You can explicitly request to attach metadata
by passing `{ stackTrace: true }` as the the 3rd argument to `addMetadata()`.

## Lifecycle hooks removal

The "constructs" library intentionally does not include support for `prepare()`
and `synthesize()` as life-cycle hooks. As our understanding of the CDK evolved,
we realized that these activities are domain-specific and should be implemented
at the application scope (in the AWS CDK, this is the `Stage`/`App`).

To that end, one of the major changes of v2.x is removal of support for the
`prepare()` and `synthesize()` hooks. In most cases, an alternative solution is
easy to come by.

> TODO: create a github issue for consultation around this topic

### Prepare

The **prepare** hook (`construct.onPrepare()` and `construct.prepare()`) is no
longer supported as it can be abused easily and cause construct tree corruption.

The `ConstructNode.prepare(node)` method no longer exists. To prepare an app or
a stage, simply call `app.synth()` or `stage.synth()`.

To obtain the top-level app stage from any construct, you can use:

```ts
const stage = Stage.of(construct);
stage.synth();
```

Consider a design where you mutate the tree in-band (preferable), or use `Lazy`
values or Aspects if appropriate.

### Synthesis

The **synthesis** hook (`construct.onSynthesize()` and `construct.synthesize()`)
is no longer supported. Synthesis is now implemented only at the app level.

The `ConstructNode.synthesize(node)` method no longer exists. To prepare an app
or a stage, simply call `app.synth()` or `stage.synth()`.

To write files into the cloud assembly directory, use `Stage.of(this).outdir`.

### Validation

Validation is still supported, but instead of a protected base class method it
is defined through an interface called `constructs.IValidation`.

Practically this means that if you wish to implement validation for a custom
construct, implement the `IValidation` interface and change your `validate`
method from `protected` to `public`.

The static method `ConstructNode.validate(node)` is no longer available. You can
use `construct.node.validate()` which only validates the _current_ construct and
returns the list of error messages (whether or not the construct implements
`IValidation`).

## Summary

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
`construct.onValidate()`, `construct.validate()` hooks | Implement `constructs.IValidation`
`ConstructNode.validate(node)` | `construct.node.validate()`

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
import for `constructs.Construct`, which is _not_ the type they need. Using the
wrong type will fail during compilation (similar error as above).

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

As we transition to
[monolithic packaging]
as part of v2.x, CDK users will have to take a _peer dependency_ on both the CDK
library (`aws-cdk-lib`) and `constructs`.

The reason `constructs` will also be required (whether leave the compatibility
layer or not) is due to the fact that all CDK constructs eventually extend the
base `constructs.Construct` class. This means that this type is part of their
public API and therefore a peer dependency is required (otherwise, there could
be incompatible copies of `Construct` in the node runtime).

See the RFC for [monolithic packaging] for more details.

[monolithic packaging]: https://github.com/aws/aws-cdk-rfcs/blob/master/text/0006-monolothic-packaging.md

# Design

This section analysis the required changes and discusses the implementation
approach and alternatives.

This design is based on this [proof of concept](https://github.com/aws/aws-cdk/pull/8962).

## Removal of the base types (`cdk.Construct`, `cdk.IConstruct`, ...)

Once `construct-compat.ts` is removed from `@aws-cdk/core`, all CDK code (both
the framework itself and user code) would need to be changed to use the types
from `constructs`.

Since the APIs are similar in almost all cases, this is a simple mechanical
change as shown in the [release notes](#release-notes).

The main concern for the CDK codebase is maintaining this change alongside a 1.x
branch until we switch over to 2.x. Since this change includes modifications to
all `import` sections in almost all of our files, merge conflicts are imminent.

Possible solutions:
1. Take the hit and resolve the conflicts manually every time. These are
   mechanical fixes and easy to do.
2. Add some automation using eslint to fix these merge conflicts.
3. Perform the change on the 1.x codebase such that the soon-to-be-moved types
   are imported separately from other types of `@aws-cdk/core`. This will
   violate an eslint rule, but we can disable it for the time being.

We can start with #1 for a while and see how bad it is. If it is, we can try to
introduce some automation or back-porting.

Something that we can definitely do on 1.x is replace all the variants such as
`core.Construct` and `cdk.Construct` to just `Construct`. This will slightly
help.


## Removal of "synthesize"

Version 4.x of the `constructs` library does not contain a lifecycle hook for
synthesis.

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


### Using stacks as roots for unit tests

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

Since unit tests sometimes use "incremental tests" for synthesized templates,
and `stage.synth()` would reuse the synthesized output if called twice, we will
also need to introduce a `stage.synth({ forceResynth: true })` option. This will
be the default behavior when using `expect(stack)` or `SynthUtils.synth()`.

The main side effect of this change is that construct paths in unit tests will
now change. In the above example, `foo.node.path` will change from `MyFoo` to
`Stack/MyFoo`. Additionally, tests for resources that utilized `node.uniqueId`
to generate names will also change given `uniqueId` is based on the path.

Since app-less stacks are only used during tests, this should not have
implications on production code, but it does break some of our test suite.

### Should we do this on 1.x?

In order to reduce [merge conflicts](#repository-migration-efforts) between 1.x
and 2.x we propose to introduce this change on the 1.x branch prior to forking
off 2.x.

However, this could be perceived as a breaking change by end-users since
`node.path` and `node.uniqueId`, and their derivatives, will change for trees
rooted by a `Stack` and unit tests will need to be updated.

Therefore we propose to introduce this change as a feature flag over the 1.x codebase and enable it in our unit tests (I don't believe we have a way to enable feature flags for all unit tests, but we can devise one).

This will allow us to update our tests in 1.x and avoid the merge conflicts
forking on 2.x

----




constructs 4.x:

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

- [ ] Require `app` when defining a `Stack`.
- [ ] assets/compat.ts





## Removal of "prepare"

The "prepare" hook was removed from constructs since it is a very fragile API.
Since the tree can be mutated during prepare, the order of `prepare` invocations
becomes critical, and almost impossible to get right without a rich model of
relationships between these "prepare" calls.

The prepare hook was used in the CDK in a few cases:
1. Resolution of references across stacks and nested stacks
2. Resolution of dependencies between constructs across stacks
3. Calculation of logical IDs based on hashes of other resources (API GW
   Deployment, Lambda Version).

The first two use cases have already been addressed by centralizing the "prepare" logic at the stage level (into [prepare-app.ts](TODO)).

The 3rd item can be addressed using `Lazy` tokens (see
[example](https://github.com/aws/aws-cdk/pull/8962/files#diff-51d435d71a31c2607f923fc4d96cac56R140)),
and will be addressed on 1.x prior to the 2.x fork.

## Validation changes

Since construct validation is quite rare, in constructs 4.x, the `validate()` protected method was removed to clean up the namespace. The alternative is to implement an interface `IValidation` with a similar method.

The breaking change is that users who implemented `validate()` would need to
implement `IValidation` and change their `validate()` method from `protected` to
`public`.

## Stack trace settings

Since stack traces are not attached to metadata entries by default in constructs
4.x, we will need to pass `stackTrace: true` for `CfnResource`s. This will
preserve the deploy-time stack traces which are very important for users.

Other metadata entries will not get stack traces by default, and that's a
reasonable change.

When stack traces are disabled (either through the CDK context or through
`CDK_STACK_TRACE_DISABLE`), we will need to set the appropriate context key in
`App` so that this will propagate to "constructs".

## Info/warning/error message metadata key changes

The construct metadata keys for `addInfo()`, `addWarning()` and `addError()` are
`aws:cdk:info`, etc. These are not the keys used by default in "constructs"
since the library is not part of the AWS CDK.

To address this, the "constructs" library allows customizing these keys through a settings module. We will need to add that configuration to the `App` level so this behavior will be preserved.

Alternatively, we can consider also modifying the CLI to accept the new keys as
well, but since these are weakly coupled, it may introduce unwanted breakage,
without much need.

We recommend the first approach.

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

As a general rule, software layers which do not provider value to users should
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

- [ ] Initial prototype: https://github.com/aws/aws-cdk/pull/8962
- [ ] Migration guide in https://github.com/aws/aws-cdk/issues/8909
- [ ] GitHub issue for "synthesize" and "prepare" guidance.
- [ ] Remove the use of "prepare" and "synthesize" in 1.x
- [ ] Implicit `App` for `Stack`s without a scope behind a feature flag and
      enable in our unit tests in 1.x
- [ ] Normalize reference to base types (`cdk.Construct` => `Construct`).