# Vending experimental modules in v2

## What is [option 6](https://github.com/aws/aws-cdk-rfcs/blob/neta/option-6/text/0249-v2-experiments.md#option-6-api-previews)?

Option 6 defines "API Previews", these are non final APIs that will be added to
`aws-cdk-lib` using a special naming scheme, e.g `grantWritePre1`, if there is a
need to introduce a non backward compatible change to an API in preview, it will
be deprecated and replaced by a new API, e.g `granWritePre2`. When the API is
ready, all of its preview versions will be deprecated, and the final version
will be introduced, e.g `granWrite`. Deprecated APIs will only be removed in
major version release.

## Releasing (very) unstable modules separately from `aws-cdk-lib`

While option 6 allows adding an entire module as "in preview", some modules
might be better suited to be released separately from `aws-cdk-lib`, using a
version that allows introducing breaking changes in a semver compliant way, e.g
`0.x`. After the GA of v2, this can help us and the community to release new
modules that are in a very early stage of development. Before v2 GA, we need to
decide the fate of every v1 unstable module.

## How should unstable module be released?

There are two options:

1. All bundled in a single experimental package. e,g `aws-cdk-lib-experiments`.
2. As individual modules. Every module will be released with its own version.

Both options were actually suggested in the original RFC as
[option 2](https://github.com/aws/aws-cdk-rfcs/blob/neta/option-6/text/0249-v2-experiments.md#option-2-separate-single-unstable-package),
and
[option 3](https://github.com/aws/aws-cdk-rfcs/blob/neta/option-6/text/0249-v2-experiments.md#option-3-separate-multiple-unstable-packages).

The purpose of this doc is to discuss the advantages and disadvantage of the two
options, **when compared to each other.**

This question has be discussed in length over the RFC PR, this doc attempts to
summarize the arguments raised by several reviewers. You can read the full
discussion
[here](https://github.com/aws/aws-cdk-rfcs/pull/279#discussion_r553581183).

The advantages of vending as one module:

1. Easy for unstable module to depend on other unstable modules.
2. Easier solution from a build tools perspective. A single separate monorepo,
   using the same tools from our main repo.
3. Easier for community contributors to create new L2s. No need to create a new
   repo.

The advantages of vending as separate modules:

1. The same experience as any other 3rd party library.
2. Easier for 3rd parties to contribute modules, which we can first incubate
   outside our repo.
3. This advantage is easier to describe as a disadvantage of the other option.
   Bundling all unstable module together means that a single release may include
   breaking changes to multiple modules. In order to use a new feature added to
   one module, users must accept breaking changes across all modules they are
   consuming. These breaking changes might include change to an already deployed
   infrastructure, e.g resource replacement, which users will be hesitant to
   accept. By separating to individual modules, we reduce the blast radius of
   every update. This was meticulously described in this PR
   [comment](https://github.com/aws/aws-cdk-rfcs/pull/279#discussion_r553846887):

> **If we decide to break APIs between releases, then monopackaging is worse
> than granular packaging**

> That's because you don't get to pick and choose versions anymore.

> Let's introduce some notation so that we can be precise about this. We have
> APIs `A` and `B` and they have backwards incompatible revisions (`A1`, `A2`,
> `A3`, ...). Furthermore, let's say that if we leave old copies of the API in
> place in new releases of a library (but `@deprecated`), we're going to write
> that as `(A1) + A2` (in this case, `A1` is deprecated but still in the
> library, and `A2` is also in there²).

> Let's say these are the releases of `cdk-experiments-change`:
>
> | cdk-experiments-change@0.1.0 | cdk-experiments-change@0.2.0 | cdk-experiments-change@0.3.0 |
> | ---------------------------- | ---------------------------- | ---------------------------- |
> | `A1 + B1`                    | `A2 + B1`                    | `A2 + B2`                    |

> First we change `A`, then we change `B`.

> Now, assume that we have an application or library, doesn't really matter
> which, that's happily consuming `A1`. They are on library version `0.1.0`, and
> all is swell.

> Now `B2` just got a feature that they want to use while staying on `A1` for
> the `A` API but... that's impossible! There's no package version that supplies
> `A1 + B2`.

> And this is _potentially_ fine, you can just update your code to migrate from
> `A1` -> `A2` instead as well, right? No big deal.

> It becomes more hairy once we start mixing in libraries that you may not have
> control over. Different scenario:

> Maybe you are an application that uses a library that hard-locked you to
> `0.1.0` because it uses `B1` (and you can't know whether `0.2.0` will still
> have `B1` or not, so you have to minor-version-lock). But now the app wants to
> use `A2`. We're in the scenario that there's there _is_ a version that
> supplies `A2 + B1`, and yet you're **still not able to take it** because your
> library dependency locked you into a version of the CDK lib.

```
app —[ uses L1 ]⟶ lib@1.0.0 —[ uses B1 ]⟶ cdk-experiments-change@0.1.0
app —[ uses B2 ]⟶ cdk-experiments-change@0.2.0                    **** CONFLICT ****
```

> Bottom line:

> **Building ecosystems around in-place broken APIs get _worse_ if we tie those
> APIs together in releases.**

**Should unstable modules be allowed to depends on other unstable modules?**

Two observations:

1. In both options, stable modules can not depend on unstable modules.
2. Due to the above, in order to graduate a module and add it to `aws-cdk-lib`,
   we will have to graduate all of its dependencies.

We know from our current dependency tree, that unstable modules depending on
other unstable modules is a valid use case. From the 35 unstable modules we
currently have, ~3 of them depends on other unstable modules.

**If we release unstable modules separately can they depend on each other?**

Yes. Unstable module can depend on other unstable modules using
`peerDependencies`.

The main concern raised in the PR was that doing so will result in "the same
dependency hell monocdk was meant to solve". As commented on the PR, this is not
the case. The problem of v1 was using dependencies where we should have been
using peerDependencies. Dependencies will lead to multiple copies of a library,
peerDependencies will not. You will get an installation error if you match
incorrectly. The reason we used dependencies in v1 was usability, if we hadn't,
users would have been forced to install hundreds of `peerDependencies`
themselves. This is mitigated by npm7, which auto install `peerDependencies`.
Additionally, it is unlikely that post v2 we will release hundreds of unstable
modules, so even for pre npm7 users, installing `peerDependencies` will be
manageable.
