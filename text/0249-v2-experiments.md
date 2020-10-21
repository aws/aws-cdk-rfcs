---
feature name: Experimental APIs Post 1.x
start date: 2020-09-08
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/250
---

# Summary

When CDK version `2.0` is released to General Availability (GA),
the single monolithic Construct Library package we vend will no longer allow breaking changes in its main modules.
Unstable modules, which include both modules that are Experimental, and in Developer Preview, will be vended separately.
Users will not experience breaking changes in minor releases of the CDK unless they explicitly opt-in to using unstable APIs.

# Motivation

CDK releases contain a combination of stable and unstable features, which has
proven to be a pain point for customers. The AWS CDK packages are released
frequently -- at least once per week, sometimes more -- and each release
increments the minor version number (e.g. `1.59.0` to `1.60.0`). In the planned
`2.0` release of CDK, the main focus of the major version upgrade is to stop
packaging modules separately and to include them all in one package called
`aws-cdk-lib`. This will solve a number of problems related to peer dependencies
that make it harder to vend third-party libraries based on the CDK, but it does
not address the backwards compatibility problem caused by minor releases
containing breaking changes to unstable APIs.

The CDK uses an exception to semantic versioning by labeling certain APIs (and
entire modules) as unstable, to allow us to make breaking changes to those APIs
in minor version upgrades. There is precedent for this in other open source
projects, but for CDK users, it has been a constant source of pain and
frustration. Users who do not carefully read and understand the documentation
simply install packages, copy sample code, make a few tweaks and put the code
into production. When they later upgrade to a new version, they are surprised to
find that their code no longer works. The perception of instability has driven
some users away, or caused them to limit their usage of CDK to the fundamental
L1 constructs, which do not provide them with the benefits of higher-level
abstractions.

This RFC proposes that we stop releasing breaking changes in the main package we
vend. A user that installs `aws-cdk-lib` using NPM or `pip` or any other package
manager should be confident there will be no breaking changes in the `2.x` line
of releases for its lifetime.

# Goals

These are the goals of this RFC, in order from most to least important:

## 1. Using CDK APIs that don't guarantee backwards-compatibility should require clear, explicit opt-in

It should be absolutely obvious to a CDK customer when they are opting in to using an API
that might have backwards-incompatible changes in the future.
From experience, we have determined that including that information in the `ReadMe` file of a module,
or in the inline code documentation available in an editor/IDE,
does not meet the criteria of "absolutely obvious".

If a customer is not aware of the stable vs unstable distinction, that means
they're using _only_ stable APIs, and that they will not be broken with minor
version CDK releases.

## 2. We want to foster a vibrant ecosystem of third-party CDK packages

In our estimation, the CDK cannot be successful without growing an expansive collection of third-party packages
that provide reusable Constructs on various levels of abstraction.
Changing to vending the Construct Library as a monolithic package is one part of making that possible;
we should make sure our approach to unstable code also takes this into account.

## 3. The CDK team can still perform API experiments

We believe that one of the reasons for CDK's success is the ability to release
functionality quickly into the hands of customers, to get their feedback. The
ability to release experiments is crucial for that speed; if every single
released API decision carried with it the absolute burden of being 100%
backwards compatible, that would slow the pace of CDK innovation considerably
(especially third-party contributions), and would lengthen the feedback loop
from our customers on the quality of the proposed APIs.

For those reasons, we consider it essential for the CDK team to retain the
capability to perform experiments with our APIs (of course, only those that are
clearly marked as such).

# Proposed changes

To achieve the goals of this RFC, we propose the following changes:

## 1. No more breaking changes in the main mono-CDK modules

Because of a combination of how `aws-cdk-lib` will be depended on by third-party libraries
(through peer dependencies), and the goals of this RFC,
it will no longer be possible to make breaking changes to code inside `aws-cdk-lib`'s main modules.

(See Appendix A below for a detailed explanation why that is)

We will still retain the ability to mark APIs as `@experimental` in `aws-cdk-lib` main modules,
but the meaning of that marker will change considerably compared to `1.x`.
It will be an indication to customers that this API is still in the process of being baked,
and it might be a bad idea (especially for more conservative customers) to use it in production yet.
However, an API marked `@experimental` cannot ever be changed in a backwards-incompatible way;
it can be marked `@deprecated`, but it will not be removed until the next major version of the CDK.

We will need to change the backwards-compatibility validations in our build scripts to make sure they cover `@experimental` APIs as well.

## 2. Separate "breakable" code from mono-CDK main modules

As a consequence of the above point,
we need to move all code that doesn't guarantee backwards-compatibility out of the mono-CDK main modules.

There a few possible options where this "breakable" code can be moved.
They all have their advantages and disadvantages.

**Note #1**: I purposefully don't mention the issue of how should this decision
affect the number of Git repositories the CDK project uses. I consider that an
orthogonal concern to this one, and more of an implementation detail. The number
of Git repositories is also a two-way door, unlike the package structure
decision, which I believe cannot be changed without bumping the major version of
CDK.

**Note #2**: the options are numbered after the historical order in which they were proposed,
not in the order they appear in the document.
Check out Appendix C for the options with the missing numbers --
they were considered, but discarded by the team as not viable.

### Option 2: separate single unstable package

Instead of vending the unstable modules together with the stable ones, we can
vend a second mono-CDK, `aws-cdk-lib-experiments` (actual name can be changed
before release of course). A customer will have to explicitly depend on
`aws-cdk-lib-experiments`, which will be released in version `0.x` to make it
even more obvious that this is unstable code. `aws-cdk-lib-experiments` would
have a caret peer dependency on `aws-cdk-lib`.

Example using stable and unstable Cognito APIs:

```ts
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cognito_preview from 'aws-cdk-lib-experiments/aws-cognito';

const idp = new cognito_preview.UserPoolIdentityProviderOidc(this, 'OIDC', { ... });
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);
```

Advantages:

1. Very explicit (customer has to add a dependency on a package with
  "experiments" in the name and version `0.x`).
2. It's possible for unstable modules to depend on other unstable modules
  (see Appendix B for data on how necessary that is for the CDK currently).

Disadvantages:

1. It's not possible for stable modules to depend on unstable ones
  (see Appendix B for data on how necessary that is for the CDK currently).
  This has serious side implications:
  - All unstable modules that have stable dependents today will have to be
    graduated before `v2.0` is released.
  - Before a module is graduated, all of its dependencies need to be graduated.
  - It will not be possible to add new dependencies on unstable modules to
    stable modules in the future (for example, that's a common need for
    StepFunction Tasks).
2. Graduating a module to stable will be a breaking change for customers. We can
  mitigate this downside by keeping the old unstable module around, but that
  leads to duplicated classes.

### Option 3: separate multiple unstable packages

In this option, each experimental library will be vended as a separate package.
Each would have the name "experiments" in it (possible naming convention:
`@aws-cdk-lib-experiments/aws-<service>`), and would be released in version
`0.x` to make it absolutely obvious this is unstable code. Each package would
declare a caret peer dependency on `aws-cdk-lib`.

Example using stable and unstable Cognito APIs:

```ts
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cognito_preview from '@aws-cdk-lib-experiments/aws-cognito';

const idp = new cognito_preview.UserPoolIdentityProviderOidc(this, 'OIDC', { ... });
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);
```

Advantages:

1. Very explicit (customer has to add a dependency on a package with
  "experiments" in the name and version `0.x`).
2. This is closest to the third-party CDK package experience our customers will
  have.

Disadvantages:

1. It's not possible for stable modules to depend on unstable ones
  (see Appendix B for data on how necessary that is for the CDK currently),
  with the same implications as above.
2. It's not possible for unstable modules to depend on other unstable modules
  (see Appendix B for data on how necessary that is for the CDK currently),
  as doing that brings us back to the dependency hell that mono-CDK was designed to solve.
3. Graduating a module to stable will be a breaking change for customers. We can
  mitigate this downside by keeping the old unstable package around, but that
  leads to duplicated classes.

### Option 5: superset/subset releases

Instead of *splitting* the stable and experimental APIs into two different
packages, we release two builds of the same source code, where the *experimental*
build is a superset of the *stable* build.

This can be done automatically, by using jsii to strip out experimental APIs
from the **public interface** of the stable release. The implementation
(`.js` files) will be the same in both releases, so stable APIs in
`aws-cdk-lib` can safely use experimental APIs internally (though not in
their public API surfaces).

**How does stripping APIs from the public work?**

| TypeScript            | JavaScript | Java, Python, C#, Go            |
|-----------------------|------------|---------------------------------|
| Stripped from `.d.ts` | N/A        | No bindings generated by `jsii` |

In TypeScript, the compiler will prevent usage of APIs that are not
advertised in the `.d.ts` files. Users will be able to bypass this guarantee
by using `as any` though.

For JavaScript, an IDE will (hopefully¹) not autocomplete APIs missing from
the `.d.ts` files; otherwise nothing prevents users from calling them. On the
other hand, JavaScript devs are by definition required to read the docs, so
they can't miss the *experimental* banners displayed there.

For jsii client languages, the bindings for experimental APIs will simply not
exist so there's no way to work around that (though we'll have to check
whether for example Python makes it possible to pass struct values that
aren't in the declared API surface).

¹) A *smart enough* IDE could discover those APIs by parsing the JavaScript
directly, or by doing dynamic execution and runtime inspection of objects. This
was already being done before TypeScript existed, I did not survey the current
landscape of IDEs to figure out which ones use what techniques to provide
autocomplete for users.

**What about experimental struct properties**

We also commonly use `@experimental` to indicate experimental struct
properties for `Props` types.

There will be code that users can write that will pass a props object that
technically contains non-advertised, experimental properties. Without
additional runtime support the object constructor will happily interpret the
presence of those properties and make decisions based off of them.

An example in TypeScript:

```ts
// Construct
interface StableConstructProps {
  readonly stableProp: string;

  /** @experimental */
  readonly experimentalProp: string;
}

class StableConstruct {
  constructor(scope: Construct, id: string, props: StableConstructProps) {
    super(scope, id);
    if (props.experimentalProp) {
      console.log('Experimental features activated!');
    }
  }
}

//----------------------------------------------------------------------
// THE FOLLOWING CLIENT CODE IS USING THE STABLE BUILD
//
// As far as this client code is aware, StableConstructProps looks like this:
//
//     interface StableConstructProps {
//        readonly stableProp: string;
//     }

const props = {
  stableProp: 'foo',
  experimentalProp: 'bar',
};

// Even though we're using "stable mode", the following code still
// prints 'Experimental features activated!'.
//
// The call below is allowed because 'typeof props' is a superset of StableConstructProps.
new StableConstruct(this, 'Id', props);

// In contrast the call below would NOT be allowed:
new StableConstruct(this, 'Id', {
  stableProp: 'foo',
  experimentalProp: 'bar',
});
```

We would need runtime support (`if (props.experimentalProp && IN_EXPERIMENTAL_MODE) { ... }`)
to detect and prevent this, or accept it.

The example above is for TypeScript; it obviously also holds for JavaScript, and *might*
hold for jsii languages in certain cases.

**Vending**

There are a number of different ways we can choose to distinguish the two builds.
See Appendix D for an evaluation of all the possibilities.

- Distinguish by package name
  - Can't be used in **pip**: there's no way to have an app that uses the experimental
    library work with a library that uses the stable library (no way to prevent the
    transitive dependency package with a different name from being installed).
- Distinguish by prerelease tag
  - **NuGet**: if a library depends on `>=1.60.0` and an app tries to satisfy that with
    `1.60.0-experimental`, even though this will functionally work, package
    managers will complain because in semver `1.60.0-experimental < 1.60.0`.
    NuGet completely errors out on this and fails the "restore" operation.
    **npm** and **pip** merely complain.
  - **Maven**: does not recognize prerelease tags. This means that *apps* can't
    have an open-ended version range since they might accidentally pick up experimental
    versions (a Maven range of `[1.60.0, 2.0.0)` *will* match `1.61.0-experimental`).
    This might not be a problem as this is rarely done in practice (since Maven doesn't
    have a lock file, the `pom` itself serves as the lock file).
- Distinguish by major version
  - Very similar to prerelease tags, except we don't depend on Package Manager's support
    for prerelease tags; all PMs support major versions.

Even though there are downsides, the prerelease tag is the least bad of the
alternatives and the one that's (probably) easiest to explain.

We have to work around the version ordering problem though, by making sure
the experimental version sorts after the stable version. We can either use
the minor or the patch version:

```shell
# Experimental uses minor bump
1.60.0 < 1.61.0-experimental

# Experimental uses (fake) patch bump
1.60.0 < 1.60.100-experimental
```

**Summary**

Advantages:

1. Stable code can depend on unstable code.
2. Stabilizing code will not be a breaking change for customers.
3. Stabilizing code will be a simple operation for CDK developers (remove an annotation).
4. No additional management overhead of multiple packages.
5. It's possible for unstable modules to depend on other unstable modules.

Disadvantages:

1. Stable/experimental versioning scheme is not based on any well-known industry
   standard, we're going to have to clearly explain it to people.
2. Requires changes to jsii
3. Requires changes to the docs to make switching between editions possible
4. Protection not offered for JavaScript users, can be bypassed in TypeScript; although
   something is to be said for it being the same with `private` fields today.

## 3. Extra unstable precautions

This chapter discusses additional precautions we can choose to implement to re-inforce goal #1 above.
These are orthogonal to the decision on how to divide the stable and unstable modules
(meaning, we could implement any of these with each of the options above).

These could be added to either `@experimental` APIs in stable modules,
to all APIs in unstable modules, or both.

### Require a feature flag for unstable code

In this variant, we would add a runtime check into all unstable APIs that
immediately fails with an exception if the following context is missing:

```json
{
  "context": {
    "@aws-cdk:allowExperimentalFeatures": true
  }
}
```

Note that `cdk init` will create a project with this context value set to
`false`.

To avoid the manual and error-prone process of adding this check to every single
unstable API, we will need to modify JSII so that it recognizes the
`@xperimental` decorator, and adds this check during compilation.

Advantages:

- Changing the context flag will be an explicit opt in from the customer to
  agree to use unstable APIs.

Disadvantages:

- This will force setting the flag also for transitive experimental code (for
  example, when an unstable API is used as an implementation detail of a
  construct, but not in its public interface), which might be confusing.
- Since there is a single flag for all unstable code, setting it once might hide
  other instances of using unstable code, working against stated goal #1.
- Requires changes in JSII.

### Force a naming convention for unstable code

We can modify `awslint` to force a certain naming convention for unstable code,
for example to add a specific prefix or suffix to all unstable APIs.

Advantages:

- Should fulfill goal #1 - it will be impossible to use an unstable API by
  accident.
- Does not require changes in JSII, only in `awslint`.

Disadvantages:

- Will force some pretty long and ugly names on our APIs.
- Graduating a module will require a lot of code changes from our customers to
  remove the prefix/suffix.

# Appendix A - why can't we break backwards compatibility in the code of mono-CDK main modules?

This section explains why it will not be possible to break backwards compatibility of any API inside the stable modules of mono-CDK.

Imagine we could break backwards compatibility in the code of the  `aws-cdk-lib` main modules.
The following scenario would then be possible:

Let's say we have a third-party library, `my-library`, that vends `MyConstruct`.
It's considered stable by its author.
However, inside the implementation of `MyConstruct`,
it uses an experimental construct, `SomeExperiment`, from mono-CDK's S3 module.
It's just an implementation detail, though; it's not reflected in the API of `MyConstruct`.

`my-library` is released in version `2.0.0`,
and it has a peer dependency on `aws-cdk-lib` version `2.10.0`
(with a caret, so `"aws-cdk-lib": "^2.10.0"`).

Some time passes, enough that `aws-cdk-lib` is now in version `2.20.0`.
A CDK customer wants to use `my-library` together with the newest and shiniest `aws-cdk-lib`,`2.20.0`,
as they need some recently released features.
However, incidentally, in version `2.15.0` of `aws-cdk-lib`,
`SomeExperiment` was broken -- which is fine, it's an experimental API.
Suddenly, the combination of `my-library` `2.0.0` and `aws-cdk-lib` `2.20.0`
will fail for the customer at runtime,
and there's basically no way for them to unblock themselves other than pinning to version `2.14.0` of `aws-cdk-lib`,
which was exactly the problem mono-CDK was designed to prevent in the first place.

# Appendix B - modules depending on unstable modules

This section contains the snapshot of the interesting dependencies between Construct Library modules as of writing this document.

## Stable modules depending on unstable modules

```
⚠️  Stable module '@aws-cdk/aws-applicationautoscaling' depends on unstable module '@aws-cdk/aws-autoscaling-common'
⚠️  Stable module '@aws-cdk/aws-autoscaling' depends on unstable module '@aws-cdk/aws-autoscaling-common'
⚠️  Stable module '@aws-cdk/aws-elasticloadbalancingv2-actions' depends on unstable module '@aws-cdk/aws-cognito'
⚠️  Stable module '@aws-cdk/aws-events-targets' depends on unstable module '@aws-cdk/aws-batch'
⚠️  Stable module '@aws-cdk/aws-lambda' depends on unstable module '@aws-cdk/aws-efs'
⚠️  Stable module '@aws-cdk/aws-route53-patterns' depends on unstable module '@aws-cdk/aws-cloudfront'
⚠️  Stable module '@aws-cdk/aws-route53-targets' depends on unstable module '@aws-cdk/aws-cloudfront'
⚠️  Stable module '@aws-cdk/aws-route53-targets' depends on unstable module '@aws-cdk/aws-cognito'
⚠️  Stable module '@aws-cdk/aws-stepfunctions-tasks' depends on unstable module '@aws-cdk/aws-batch'
⚠️  Stable module '@aws-cdk/aws-stepfunctions-tasks' depends on unstable module '@aws-cdk/aws-glue'
```

## Unstable modules depending on other unstable modules

```
ℹ️️  Unstable module '@aws-cdk/aws-appsync' depends on unstable module '@aws-cdk/aws-cognito'
ℹ️️  Unstable module '@aws-cdk/aws-backup' depends on unstable module '@aws-cdk/aws-efs'
ℹ️️  Unstable module '@aws-cdk/aws-backup' depends on unstable module '@aws-cdk/aws-rds'
ℹ️️  Unstable module '@aws-cdk/aws-cloudfront-origins' depends on unstable module '@aws-cdk/aws-cloudfront'
ℹ️️  Unstable module '@aws-cdk/aws-docdb' depends on unstable module '@aws-cdk/aws-efs'
ℹ️️  Unstable module '@aws-cdk/aws-s3-deployment' depends on unstable module '@aws-cdk/aws-cloudfront'
ℹ️️  Unstable module '@aws-cdk/aws-ses-actions' depends on unstable module '@aws-cdk/aws-ses'
```

# Appendix C - discarded solutions to problem #2

These potential solutions to problem #2 were discarded by the team as not viable.

## Option 1: separate submodules of `aws-cdk-lib`

In this option, we would use the namespacing features of each language to vend a separate namespace for the experimental APIs.
The customer would have to explicitly opt-in by using a language-level import of a namespace with "experimental" in the name.

Example using stable and unstable Cognito APIs:

```ts
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cognito_preview from 'aws-cdk-lib/experimental/aws-cognito';

const idp = new cognito_preview.UserPoolIdentityProviderOidc(this, 'OIDC', { ... });
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);
```

Advantages:

1. It's possible for stable module to depend on unstable ones
  (see Appendix B for data on how necessary that is for the CDK currently)
2. It's possible for unstable modules to depend on other unstable modules
  (see Appendix B for data on how necessary that is for the CDK currently).

Disadvantages:

1. Might be considered less explicit, as a customer never says they want to
  depend on a package containing unstable APIs, or with `0.x` for the version.
2. If a third-party package depends on an unstable API in a non-obvious way (for
  example, only in the implementation of a construct, not in its public API),
  that might break for customers when upgrading to a version of `aws-cdk-lib`
  that has broken that functionality compared to the `aws-cdk-lib` version the
  third-party construct is built against (basically, the same scenario from
  above that explains why we can no longer have unstable code in stable mono-CDK
  modules). None of the options solve the problem of allowing third-party
  libraries to safely depend on unstable Construct Library code; however,
  the fact that all unstable code in this variant is shipped in
  `aws-cdk-lib` makes this particular problem more likely to manifest itself.
3. Graduating a module to stable will be a breaking change for customers. We can
  mitigate this downside by keeping the old unstable module around, but that
  leads to duplicated classes in the same package.

**Verdict**: discarded because disadvantage #2 was considered a show-stopper.

## Option 4: separate V3 that's all unstable

In this option, we will fork the CDK codebase and maintain 2 long-lived
branches: one for version `2.x`, which will be all stable, and one for version
`3.x`, which will be all unstable.

Example using stable and unstable Cognito APIs:
(assuming the dependency on `"aws-cdk-lib"` is in version `"3.x.y"`):

```ts
import * as cognito from 'aws-cdk-lib/aws-cognito';

const idp = new cognito.UserPoolIdentityProviderOidc(this, 'OIDC', { ... });
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);
```

Advantages:

1. It's possible for unstable modules to depend on other unstable modules
  (see Appendix B for data on how necessary that is for the CDK currently).

Disadvantages:

1. It's not possible for stable modules to depend on unstable ones (with the same
  implications as above).
2. Does not make it obvious to customers that this is unstable (`3.x` is
  considered stable in semantic versioning).
3. We are going from "some code is stable, some is unstable" to "all of this is
  unstable", which seems to be against the customer feedback we're hearing
  that's the motivation for this RFC.
4. Two long-lived Git branches will mean constant merge-hell between the two, and
  since `3.x` has free rein to change anything, there will be a guarantee of
  constant conflicts between the two.
5. Fragments the mono-CDK third-party library community into two.
6. Very confusing when we want to release the next major version of the CDK (I
  guess we go straight to `4.x`...?).
7. The fact that all code in `3.x` is unstable means peer dependencies don't work
  (see above for why).
8. Graduating a module to stable will be a breaking change for customers. We can
  mitigate this downside by keeping the old unstable package around, but that
  leads to duplicated classes between the 2 versions.

**Verdict**: discarded as a worse version of option #5.

# Appendix D - Alternatives for identifying stable/experimental builds

We have the following options to pick from:

- Different package names (`aws-cdk-lib` vs `aws-cdk-lib-experimental`).
- Pre-release version tag
- Different major versions

We need to evaluate all of these, for each package manager, on the following criteria:

- Can applications depend on an upwards unbounded range of *stable* builds? (important)
- Can an application using the *experimental* build use a library using the *stable* build? (important)
  - Without the package manager complaining (preferably)
- Can a library declare a tool-checked dependency on a specific *experimental* version? (preferably)

We have ruled out the requirement that an application using *stable*
may transparently use a library using *experimental*. We will disallow this
as it's not feasible. We're trying to achieve the following compatibility
matrix:

| .                | Stable App        | Experimental App         |
|------------------|-------------------|--------------------------|
| Stable Lib       | floating versions | lib floating, app pinned |
| Experimental Lib | -                 | pinned versions          |

> NOTE: in the following sections, I'll be using the terms "stable app", "experimental app",
> "stable lib" and "experimental lib" as stand-ins for the more accurate but much
> longer "app that depends on stable CDK", "app that depends on experimental CDK",
> etc.

## Different package names

We would vend two different package names, for example:

- `aws-cdk-lib`
- `aws-cdk-lib-experimental`

The tl;dr of this section is as follows. Read below for details.

| .     | Stable apps | Experimental app uses Stable lib | ...without complaints | Lib advertises Experimental |
|-------|-------------|----------------------------------|-----------------------|-----------------------------|
| NPM   | yes         | with package aliases             | yes                   | no                          |
| Maven | yes         | with excluded dependencies       | yes                   | yes                         |
| pip   | yes         | no                               | -                     | no                          |
| NuGet | yes         | no                               | no                    | yes                         |
| Go    | ?           | ?                                |                       | ?                           |

**NPM**

In NPM-based languages (JavaScript and TypeScript), the package name appears
in source code (in the `require()` statement). If we changed the library
name, we wouldn't be able to use a library that uses stable code (it would
contain `require('aws-cdk-lib')`) in an application that uses experimental
code:

```js
//------------- LIBRARY THAT USES STABLE ---------------
// package.json
{
  "peerDependencies": {
    "aws-cdk-lib": "^1.60.0"
  }
}

// index.ts
import * as cdk from 'aws-cdk-lib';  // <- locally perfectly sane

//------------- APPLICATION THAT USES EXPERIMENTAL AND THIS LIB ---------------
// package.json
{
  "devDependencies": {
    "lib-that-uses-stable": "^1.2.3",
    "aws-cdk-lib-experimental": "1.60.0"
  }
}

// app.ts
import * as cdk from 'aws-cdk-lib-experimental'; // <- locally perfectly sane
```

Well oops. Turns out we can't have a library that depends on `aws-cdk-lib` in an
application that uses `aws-cdk-lib-experimental`; NPM will complain about the missing
`peerDependency`, and the `require('aws-cdk-lib')` call will just fail at runtime.

NPM 6.9.0 (released May 2019) introduces a feature that helps with this:
[package
aliases](https://github.com/npm/rfcs/blob/latest/implemented/0001-package-aliases.md)
which allows installing a package under a different name, so we could install
`aws-cdk-lib-experimental` under the name `aws-cdk-lib`. The application `package.json`
will now look like this:

```js
//------------- APPLICATION THAT USES EXPERIMENTAL AND STABLE LIB ---------------
// package.json
{
  "devDependencies": {
    "lib-that-uses-stable": "^1.2.3",
    "aws-cdk-lib": "npm:aws-cdk-lib-experiments@1.60.0",
  }
}

// app.ts
import * as cdk from 'aws-cdk-lib';
```

So that's cool.

What would a construct library that depends on an experimental build look
like, and could we use that in the same application?

An experimental library would declare this:

```json
{
  "peerDependencies": {
      "aws-cdk-lib": "1.60.0"
      // Note: ideally you'd like to express "aws-cdk-lib-experiments": "1.60.0" here, but
      // if you do that "npm ls" will complain about an unmet peer dependency
  },
  "devDependencies": {
      "aws-cdk-lib": "npm:aws-cdk-lib-experiments@1.60.0"
  }
}
```

This will all work as intended and put code in the right places.

However, we lose the tool-checked dependency on experimental: from NPM's
point of view the library depends on *stable* CDK (whereas we want it to
declare that it depends on *experimental* CDK). It's only notes in the README
that can inform the consumer otherwise.

**Maven**

No need to change the sources when using a stable library with an
experimental app, as the namespaces and class names will be the same.

Using a stable library in an experimental app can be done in two ways:

* The library uses the `provided` dependency flavor (similar to `peerDependencies` in NPM).
  Requires the app to bring the right version of CDK.
* The app that wants to use the *experimental* build uses dependency exclusions
  to remove the dependency on the *stable* build (looks like this is necessary for
  every stable library individually)

https://maven.apache.org/guides/introduction/introduction-to-optional-and-excludes-dependencies.html#

**pip**

No need to change the sources when using a stable library with an
experimental app, as the namespaces and class names will be the same.

`pip` transitively fetches from the library's `setup.py`, and there's no way
to override that.

Our only option around that is to have stable libraries not declare any CDK
dependency in `setup.py`, but then we also lose the ability for libraries to
specify their dependency version, which is not really acceptable.

Effectively, this seems to be a no-go.

**.NET Core/NuGet**

No need to change the sources when using a stable library with an
experimental app, as the namespaces and class names will be the same.

...pending responses from .NET SDK team...

**Go**

???

## Prerelease tags

We would vend the experimental build under a prerelease tag, for example:

- `aws-cdk-lib@1.60.0`
- `aws-cdk-lib@1.60.0-experimental`

We could get rid of some of the ordering and warning problems by making sure the
experimental version semver-orders *after* the stable version:

- `aws-cdk-lib@1.60.100-experimental`
- `aws-cdk-lib@1.61.0-experimental`

But that is most likely just going to break people's heads so let's not even try.

| .     | Stable apps        | Experimental app uses Stable lib | ...without complaints | Lib advertises Experimental |
|-------|--------------------|----------------------------------|-----------------------|-----------------------------|
| NPM   | yes                | yes                              | no                    | yes                         |
| Maven | no but that's okay | yes                              | yes                   | yes                         |
| pip   | yes                | yes                              | no                    | yes                         |
| NuGet | yes                | with bumped patch version        | yes                   | yes                         |
| Go    | ?                  | ?                                | ?                     | ?                           |

**NPM**

Stable ranges: yes, `^1.60.0` does not include `1.61.1-experimental`.

Experimental app uses stable lib: can be done, the lib only uses a peerDependency. `npm ls` will complain about
a missing peerDependency though.

**Maven**

Stable ranges: no, `[1.60.0,)` *will* include `1.61.1-experimental`. However,
this might not be an issue as `pom.xml` typically serves as the lock file and
people will not build applications with open-ended ranges in the pom file.

If we *wanted* to, we could vend as `1.60.0-experimental-SNAPSHOT`; snapshot
versions will not match a range unless specifically requested. However,
`SNAPSHOT` versions are not intended for this, they are intended to indicate
mutability and bypass caches: every configurable time period (by default,
every day but can be every build, and snapshots can also be disabled
altogether) the `SNAPSHOT` version will be fetchd again, as it is assumed to
be mutable.

Maven uses a "closest to root wins" dependency model, so the application can
substitute an experimental version in place of the declared stable
compatibility.

It will not complain about incompatible versions unless you really *really*
ask for it.

**pip**

Stable ranges: yes, `>=1.60.0` will not match version `1.60.1-experimental` [ref](https://pip.pypa.io/en/stable/reference/pip_install/#pre-release-versions)

Experimental app uses stable lib: `pip` allows overriding transitive dependencies using `requirements.txt`, but it will complain
while doing so:

Example (I tried with different packages):

```text
awscli 1.18.158 has requirement s3transfer<0.4.0,>=0.3.0, but you'll have s3transfer 0.2.0 which is incompatible.
```

**NuGet**

PJ Pittle from the .NET team has confirmed for us that NuGet will complain and **error out** if we use:

- Library depends on CDK `>= 1.60.0`
- App uses CDK `1.60.0-experimental`

(Because of semver ordering.)

The only solution seems to be to make sure that the experimental version sorts after the stable version.

## Different major versions

We would vend the experimental build under a prerelease tag, for example:

- `aws-cdk-lib@2.60.0`
- `aws-cdk-lib@3.60.0` (odd ranges are experimental)

Or:

- `aws-cdk-lib@2.60.0`
- `aws-cdk-lib@102.60.0` (100+ versions are experimental)

| .     | Stable apps | Experimental app uses Stable lib | ...without complaints | Lib advertises Experimental |
|-------|-------------|----------------------------------|-----------------------|-----------------------------|
| NPM   | yes         | yes                              | yes                   | yes                         |
| Maven | yes         | yes                              | yes                   | yes                         |
| pip   | yes         | no                               | -                     | yes                         |
| NuGet | yes         | yes                              | ?                     | yes                         |
| Go    | ?           | ?                                | ?                     | ?                           |

**NPM**

Mostly like pre-release tags, except libraries using stable can explicitly declare they're usable
with both stable and experimental ranges by using multiple `peerDependency` ranges:

```json
{
  "peerDependencies": {
    "aws-cdk-lib": "^2.60.0 ^102.60.0"
  }
}
```

This would suppress the warning you would otherwise get for a non-compatible version.

**Maven**

Like pre-release tags, except we don't get the mixing in of pre-release versions with
regular versions.

**pip**

Like pre-release tags.

**NuGet**

Like pre-release tags.

**Go**

?