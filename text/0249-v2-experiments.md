---
feature name: Experimental APIs Post 1.x
start date: 2020-09-08
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/250
---

# Summary

When CDK version `2.0` is released to General Availability (GA), the main
Construct Library package that we vend will no longer contain unstable code.
Unstable modules, including modules in Developer Preview, will be vended
separately. Users will not experience breaking changes in minor releases of the
CDK unless they explicitly opt-in to using unstable APIs.

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

## 1. Unstable code should require clear, explicit opt-in

It should be absolutely obvious to a CDK customer when they are opting in to
using an unstable API. From experience, we have determined that including that
information in the `ReadMe` file of a module, or in the inline code
documentation available in an editor/IDE, does not meet the criteria of
"absolutely obvious".

If a customer is not aware of the stable vs unstable distinction, that means
they're using _only_ stable APIs, and that they will not be broken with minor
version CDK releases.

## 2. The CDK team can still perform API experiments

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

## 1. No unstable code in the main mono-CDK modules

Because of a combination of how `aws-cdk-lib` will be depended on by third-party
libraries (through peer dependencies), and the goals of ths RFC, it will no
longer be possible to vend unstable code as part of `aws-cdk-lib`'s main modules
(so, modules that are marked "stable" will no longer have the capability to have
unstable APIs inside of them).

We will need to add validations to our build scripts that make sure this rule is
never broken.

### Why can't we vend unstable code in mono-CDK stable modules?

This paragraph explains why it's not possible to vend unstable code in the
mono-CDK main modules. If you're already convinced that that's true, feel free
to skip to the next section.

<details>
Imagine we could ship unstable code in `aws-cdk-lib`.
The following scenario would then be possible:

Let's say we have a third-party library, `my-library`, that vends `MyConstruct`.
It's considered stable by its author. However, inside the implementation of
`MyConstruct`, it uses an experimental construct, `SomeExperiment`, from
mono-CDK's S3 module. It's just an implementation detail, though; it's not
reflected in the API of `MyConstruct`.

`my-library` is released in version `2.0.0`, and it has a peer dependency on
`aws-cdk-lib` version `2.10.0` (with a caret, so `"aws-cdk-lib": "^2.10.0"`).

Some time passes, enough that `aws-cdk-lib` is now in version `2.20.0`. A CDK
customer wants to use `my-library` together with the newest and shiniest
`aws-cdk-lib`,`2.20.0`, as they need some recently released features. However,
incidentally, in version `2.12.0` of `aws-cdk-lib`, `SomeExperiment` was broken
-- which is fine, it's an experimental API. Suddenly, the combination of
`my-library` `2.0.0` and `aws-cdk-lib` `2.20.0` will fail for the customer at
runtime, and there's basically no way for them to unblock themselves other than
pinning to version `2.11.0` of `aws-cdk-lib`, which was exactly the problem
mono-CDK was designed to prevent in the first place.

</details>

## 2. Separate unstable code from mono-CDK main modules

As a consequence of the above point, we need to move all unstable code out of
the mono-CDK main modules.

There a few possible options where the unstable code can be moved. They all have
their advantages and disadvantages.

**Note**: I purposefully don't mention the issue of how should this decision
affect the number of Git repositories the CDK project uses. I consider that an
orthogonal concern to this one, and more of an implementation detail. The number
of Git repositories is also a two-way door, unlike the package structure
decision, which I believe cannot be changed without bumping the major version of
CDK.

### Option 1: sub-package of `aws-cdk-lib`

In this option, we would use the namespacing features of each language to vend a
separate namespace for the experimental APIs. The customer would have to
explicitly opt-in by using a language-level import of a namespace with
"experimental" in the name.

For example, let's imagine that the Cognito library had both stable and unstable
APIs. They would both reside in the same package, `aws-cdk-lib`, but not in the
same namespace:

```ts
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cognito_preview from 'aws-cdk-lib/experimental/aws-cognito';

const idp = new cognito_preview.UserPoolIdentityProviderOidc(this, 'OIDC', { ... });
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);
```

Advantages:

- It's possible for stable module to depend on unstable ones. This is something
  that's used pretty commonly in the CDK today:

  ```
  ⚠️  Stable package '@aws-cdk/aws-applicationautoscaling' depends on unstable package '@aws-cdk/aws-autoscaling-common'
  ⚠️  Stable package '@aws-cdk/aws-autoscaling' depends on unstable package '@aws-cdk/aws-autoscaling-common'
  ⚠️  Stable package '@aws-cdk/aws-elasticloadbalancingv2-actions' depends on unstable package '@aws-cdk/aws-cognito'
  ⚠️  Stable package '@aws-cdk/aws-events-targets' depends on unstable package '@aws-cdk/aws-batch'
  ⚠️  Stable package '@aws-cdk/aws-lambda' depends on unstable package '@aws-cdk/aws-efs'
  ⚠️  Stable package '@aws-cdk/aws-route53-patterns' depends on unstable package '@aws-cdk/aws-cloudfront'
  ⚠️  Stable package '@aws-cdk/aws-route53-targets' depends on unstable package '@aws-cdk/aws-cloudfront'
  ⚠️  Stable package '@aws-cdk/aws-route53-targets' depends on unstable package '@aws-cdk/aws-cognito'
  ⚠️  Stable package '@aws-cdk/aws-stepfunctions-tasks' depends on unstable package '@aws-cdk/aws-batch'
  ⚠️  Stable package '@aws-cdk/aws-stepfunctions-tasks' depends on unstable package '@aws-cdk/aws-glue'
  ```

- It's possible for unstable modules to depend on other unstable modules. This
  is also something that's common today in the CDK:

  ```
  ℹ️️  Unstable package '@aws-cdk/aws-appsync' depends on unstable package '@aws-cdk/aws-cognito'
  ℹ️️  Unstable package '@aws-cdk/aws-backup' depends on unstable package '@aws-cdk/aws-efs'
  ℹ️️  Unstable package '@aws-cdk/aws-backup' depends on unstable package '@aws-cdk/aws-rds'
  ℹ️️  Unstable package '@aws-cdk/aws-cloudfront-origins' depends on unstable package '@aws-cdk/aws-cloudfront'
  ℹ️️  Unstable package '@aws-cdk/aws-docdb' depends on unstable package '@aws-cdk/aws-efs'
  ℹ️️  Unstable package '@aws-cdk/aws-s3-deployment' depends on unstable package '@aws-cdk/aws-cloudfront'
  ℹ️️  Unstable package '@aws-cdk/aws-ses-actions' depends on unstable package '@aws-cdk/aws-ses'
  ```

Disadvantages:

- Might be considered less explicit, as a customer never says they want to
  depend on a package containing unstable APIs, or with `0.x` for the version.
- If a third-party package depends on an unstable API in a non-obvious way (for
  example, only in the implementation of a construct, not in its public API),
  that might break for customers when upgrading to a version of `aws-cdk-lib`
  that has broken that functionality compared to the `aws-cdk-lib` version the
  third-party construct is built against (basically, the same scenario from
  above that explains why we can no longer have unstable code in stable mono-CDK
  modules). None of the options solve the problem of allowing third-party
  libraries to safely depend on experimental Construct Library code; however,
  the fact that all experimental code in this variant is shipped in
  `aws-cdk-lib` makes this particular problem more likely to manifest itself.
- Graduating a module to stable will be a breaking change for customers. We can
  mitigate this downside by keeping the old unstable module around, but that
  leads to duplicated classes in the same package.

### Option 2: separate single unstable package

Instead of vending the unstable modules together with the stable ones, we can
vend a second mono-CDK, `aws-cdk-lib-experiments` (actual name can be changed
before release of course). A customer will have to explicitly depend on
`aws-cdk-lib-experiments`, which will be released in version `0.x` to make it
even more obvious that this is unstable code. `aws-cdk-lib-experiments` would
have a caret peer dependency on `aws-cdk-lib`.

So, the above Cognito example would look like this:

```ts
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cognito_preview from 'aws-cdk-lib-experiments/aws-cognito';

const idp = new cognito_preview.UserPoolIdentityProviderOidc(this, 'OIDC', { ... });
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);
```

Advantages:

- Very explicit (customer has to add a dependency on a package with
  "experiments" in the name and version `0.x`).
- It's possible for unstable modules to depend on other unstable modules.

Disadvantages:

- It's not possible for stable modules to depend on unstable ones. This has
  serious side implications:
  - All unstable modules that have stable dependents today will have to be
    graduated before `v2.0` is released.
  - Before a module is graduated, all of its dependencies need to be graduated.
  - It will not be possible to add new dependencies on unstable modules to
    stable modules in the future (for example, that's a common need for
    StepFunction Tasks).
- Graduating a module to stable will be a breaking change for customers. We can
  mitigate this downside by keeping the old unstable module around, but that
  leads to duplicated classes.

### Option 3: separate multiple unstable packages

In this option, each experimental library will be vended as a separate package.
Each would have the name "experiments" in it (possible naming convention:
`@aws-cdk-lib-experiments/aws-<service>`), and would be released in version
`0.x` to make it absolutely obvious this is unstable code. Each package would
declare a caret peer dependency on `aws-cdk-lib`.

So, the above Cognito example would be:

```ts
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cognito_preview from '@aws-cdk-lib-experiments/aws-cognito';

const idp = new cognito_preview.UserPoolIdentityProviderOidc(this, 'OIDC', { ... });
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);
```

Advantages:

- Very explicit (customer has to add a dependency on a package with
  "experiments" in the name and version `0.x`).
- This is closest to the third-party CDK package experience our customers will
  have.

Disadvantages:

- It's not possible for stable modules to depend on unstable ones (with the same
  implications as above).
- It's not possible for unstable modules to depend on other unstable modules, as
  doing that brings us back to the dependency hell that mono-CDK was designed to
  solve.
- Graduating a module to stable will be a breaking change for customers. We can
  mitigate this downside by keeping the old unstable package around, but that
  leads to duplicated classes.

### Option 4: separate V3 that's all unstable

In this option, we will fork the CDK codebase and maintain 2 long-lived
branches: one for version `2.x`, which will be all stable, and one for version
`3.x`, which will be all unstable.

So, the above Cognito example would be (assuming the dependency on
`"aws-cdk-lib"` is in version `"3.x.y"`):

```ts
import * as cognito from 'aws-cdk-lib/aws-cognito';

const idp = new cognito.UserPoolIdentityProviderOidc(this, 'OIDC', { ... });
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);
```

Advantages:

- It's possible for unstable modules to depend on other unstable modules.

Disadvantages:

- It's not possible for stable modules to depend on unstable ones (with the same
  implications as above).
- Does not make it obvious to customers that this is unstable (`3.x` is
  considered stable in semantic versioning).
- We are going from "some code is stable, some is unstable" to "all of this is
  unstable", which seems to be against the customer feedback we're hearing
  that's the motivation for this RFC.
- Two long-lived Git branches will mean constant merge-hell between the two, and
  since `3.x` has free rein to change anything, there will be a guarantee of
  constant conflicts between the two.
- Fragments the mono-CDK third-party library community into two.
- Very confusing when we want to release the next major version of the CDK (I
  guess we go straight to `4.x`...?).
- The fact that all code in `3.x` is unstable means peer dependencies don't work
  (see above for why).
- Graduating a module to stable will be a breaking change for customers. We can
  mitigate this downside by keeping the old unstable package around, but that
  leads to duplicated classes between the 2 versions.

## 3. Extra unstable precautions

This chapter discusses additional precautions we can choose to implement to
re-inforce goal #1 above. These are orthogonal to the decision on how to divide
the stable and experimental modules (meaning, we could implement any of these
with each of the options above).

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

We can modify JSII to force a certain naming convention for unstable code, for
example to add a specific prefix or suffix to all unstable APIs.

Advantages:

- Should fulfill goal #1 - it will be impossible to use an unstable API by
  accident.

Disadvantages:

- Will force some pretty long and ugly names on our APIs.
- Graduating a module will require a lot of code changes from our customers to
  remove the prefix/suffix.
- Requires changes in JSII.
