---
feature name: Experimental APIs Post 1.x
start date: 2020-09-08
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/250
---

# Summary

When CDK v2 is released to General Availability (GA), the main construct library package that we vend will no longer
contain experimental code. Experimental modules, including modules in Developer Preview, will be vended in a separate
package. Experimental APIs will be opt-in. Users will not experience breaking changes in minor releases of the CDK
unless they explicitly opt in by installing an experimental package or by setting a feature flag.

# Motivation

CDK releases contain a combination of stable and experimental features, which has proven to be a pain point for
customers. The aws-cdk package is released frequently, at least once per week and sometimes more, and each release
increments the minor version number (e.g 1.59.0 to 1.60.0). In the planned 2.0 release of CDK, the main focus of the
major version upgrade is to stop packaging modules separately and to include them all in one package called aws-cdk-lib.
This will solve a number of problems related to peer dependencies that make it harder to vend independent libraries
based on the CDK, but it does not address the backwards compatibility problem caused by minor releases with breaking
changes to experimental modules.

The CDK uses an exception to semantic versioning expectations by labeling certain modules as experimental, to allow us
to make breaking changes to those modules in minor version upgrades. There is precedent for this in other open source
projects, but for CDK users, it has been a constant source of pain and frustration. Users who do not carefully read and
understand the documentation simply install packages, copy sample code, make a few tweaks and put the code into
production. When they later upgrade to a new version, they are surprised to find that their code no longer works. The
perception of instability has driven some users away, or caused them to limit their usage of CDK to the fundamental L1
constructs, which do not provide them with the benefits of higher level abstractions.

This RFC proposes that we stop releasing breaking changes in the main packages that we vend that are not hidden by a
feature flag. A user that installs aws-cdk-lib using npm or pip or any other package manager should be confident that
there will be no intentional breaking changes in the 2.x line of releases for its lifetime.

# README

The following section will be removed from the CDK Readme:

> Modules in the AWS Construct Library are designated Experimental while we build them; experimental modules may have
> breaking API changes in any release. After a module is designated Stable, it adheres to semantic versioning, and only
> major releases can have breaking changes. Each module's stability designation is available on its Overview page in the
> AWS CDK API Reference. For more information, see Versioning in the CDK Developer Guide.

The existing contributor guide does not mention experimental code, so the following will be added after the intro
paragraph:

> If you are contributing to a 2.x release, keep in mind that you may not introduce breaking changes to any public
> facing API. Experimental modules are developed in a separate package, and experimental APIs in stable modules are
> hidden behind a feature flag. [link]

# Design Summary

- Before releasing v2 to GA, all experimental code will either be marked as stable or deprecated and removed from the
  packages that we vend, such as aws-cdk and aws-cdk-lib.
- A new folder structure will be created under packages called @aws-cdk-previews. All new modules will begin their
  lifecycle there, and any modules we decide to deprecate for further experimentation will be moved there.
- The new @aws-cdk-previews package will take a peer dependency on @aws-cdk.
- When a module is ready for graduation to GA, in a single commit, the code will be moved to packages/@aws-cdk and the
  metadata tags for stability and maturity will be set to 'stable'.
- A feature flag strategy will be devised to handle experimental APIs within stable modules, or in the core. Runtime
  checks will make sure users who have not opted in do not call experimental APIs.

# Drawbacks

- When we graduate a module, users who have participated in the Developer Preview will have to update their imports to
  make use of the stable version in the main repository.
- For developers who are working on experimental code that has complex dependencies with the core and with other
  modules, development will be more complicated.
- In some cases, experimentation will not be possible. New features introduced to the main repository will have to be
  vetted much more carefully before they are merged, since any public API released as part of v2 will have to be
  supported for the lifetime of the major version.
- The stable package that we vend cannot take dependencies on the experimental package.
- API design for L2 construct libraries will have to take into account the possibility of future additions that are
  implemented in a separate package. This might lead to awkward choices, like making functions public that otherwise
  would have been private.

# Alternatives

Some alternatives to this strategy are:

- Make no changes and continue to experiment in the main release.
  - Improve documentation so that it is more obvious to users that they are importing experimental code.
  - Make it a policy to actually include the name 'experimental' in all experimental APIs.
- Use clever build tricks to hide experimental modules. This might be possible in Typescript, where the type files are
  separate from implementation, but might prove difficult or impossible in other languages such as Python.
- Call the experimental package @aws-cdk-experiments instead of @aws-cdk-previews.

# Adoption Strategy

The hope is that for the majority of users, upgrading from 1.x to 2.x will be as simple as changing import statements at
the top of their source files, rebuilding, and redeploying. This upgrade should not result in any resources being
destroyed and recreated, except in very specific cases where we have made it clear to users, such as with the EKS L2
construct library. The same should be true for users upgrading from the preview package to the stable package as modules
are graduated from Developer Preview to GA.

# Implementation Plan

This section contains examples covering common scenarios:

## 1. A brand new L2, where there was only an L1 before.

- Create a new package in packages/@aws-cdk-previews exactly the same we we would have for v1
- Follow the v1 process for module lifecycle until it's ready to GA
- [How does documentation work for the preview package?]
- To graduate it, move the package to packages/@aws-cdk, set the module stability and maturity to stable, and remove any
  @experimental tags in the doc comments.

## 2. Adding new experimental classes to an existing L2.

An example would be Cognito User Pools, when we want to add additional Identity Pool Providers.

- Create the implementation file and export it.
  - packages/@aws-cdk-previews/cognito/lib/user-pool-idps/OpenIdConnect.ts
- A user that wants to try it would import both the stable and experimental package

```typescript
import * as cognito from '@aws-cdk-lib/aws_cognito';
import * as cognitoPreview from '@aws-cdk-previews/aws_cognito';

const idp = new cognitoPreview.UserPoolIdentityProviderOidc(this, 'OIDC', {...});
const supported = [cognito.UserPoolClientIdentityProvider.custom("MyProviderName")];
const userPoolClient = new cognito.UserPoolClient(...);

```

## 3. Adding a new experimental function to an existing stable class.

TODO

## 4. How to work around stable modules that want to refer to experiments

TODO - stepfunctions-tasks?

## 5. Changing the entire implementation for a core module.

TODO - asset bundling?