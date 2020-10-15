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
