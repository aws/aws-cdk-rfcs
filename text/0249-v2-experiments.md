---
feature name: Experimental APIs Post 1.x
start date: 2020-09-08
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/250
---

# Summary

When CDK v2 is released to General Availability (GA), the main release branch will no longer contain experimental code.
All experimental code, including modules in Developer Preview, will be developed in a separate repository.

# Motivation

CDK releases contain a combination of stable and experimental features, which has proven to be a pain point for
customers. The aws-cdk package is released frequently, at least once per week and sometimes more, and each release
increments the minor version number (e.g 1.59.0 to 1.60.0). In the planned 2.0 release of CDK, the main focus of the
major version upgrade is to stop packaging modules separately and to include them all in one package called aws-cdk-lib.
This will solve a number of problems related to peer dependencies that make it harder to vend independent libraries
based on the CDK, but it does not address the backwards compatibility problem caused by minor releases with breaking
changes to experimental modules. The current 2.0 plan does not include any consideration for the backwards compatibility
issue.

The CDK uses an exception to semantic versioning expectations by labeling certain modules as experimental, to allow us
to make breaking changes to those modules in minor version upgrades. There is precedent for this in other open source
projects, but for CDK users, it has been a constant source of pain and frustration. Users who do not carefully read and
understand the documentation simply install packages, copy sample code, make a few tweaks and put the code into
production. When they later upgrade to a new version, they are surprised to find that their code no longer works. The
perception of instability has driven some users away, or caused them to limit their usage of CDK to the fundamental L1
constructs, which do not provide them with the benefits of higher level abstractions.

This RFC proposes that we stop experimenting in the main repository. To keep the implementation simple and to avoid
possible inadvertent breakages, especially considering the need to convert from Typescript into a variety of languages,
we should not use any clever techniques to simply hide the experiments. The code should be all stable. A user that
installs aws-cdk-lib using npm or pip or any other package manager should be confident that there will be no intentional
breaking changes in the 2.x line of releases for its lifetime.

# README

The following section will be removed from the CDK Readme:

> Modules in the AWS Construct Library are designated Experimental while we build them; experimental modules may have
> breaking API changes in any release. After a module is designated Stable, it adheres to semantic versioning, and only
> major releases can have breaking changes. Each module's stability designation is available on its Overview page in the
> AWS CDK API Reference. For more information, see Versioning in the CDK Developer Guide.

The existing contributor guide does not mention experimental code, so the following will be added after the intro
paragraph:

> If you are contributing to a 2.x release, keep in mind that you may not introduce breaking changes to any public
> facing API. Experimental modules are developed in a separate repository. [link]

The new aws-cdk-previews repository will have the following Readme:

> This repository contains experimental code related to the AWS Cloud Development Kit (AWS CDK). CDK is an open-source
> software development framework to define cloud infrastructure in code and provision it through AWS CloudFormation.
> Please refer to the main repository here [link]. [TODO...]

The contributor guide can be copied from the main repository, since the toolchain for building the preview repository
will be basically the same.

# Design Summary

- Upon release of v2.0 to GA, all experimental modules will be automatically marked as stable (in fact, the metadata in
  the code regarding stability can be removed, since everything will be stable). This means that the opportunity for the
  team and for the community to influence the shape of existing experimental APIs is between now and then. Once we go
  GA, we have to live with our design decisions.
- Any APIs that cannot be graduated with confidence in time for the v2 release will be deprecated in 1.x, removed from
  the v2 branch, and moved to the preview repository. This option should be minimized, since some customers may have
  deployed production stacks that depend on these APIs.
- Create a new repository called aws-cdk-previews that will be the new home for experimental development and developer
  preview releases. The packages in this repository will be vended in the same way that 1.x packages are vended today,
  in a variety of languages, with metadata that draws a line between new experiments and more mature developer preview
  packages. This repo will take a dependency on the core CDK package just like any other independent library. This
  avoids the complications associated with experimenting on a fork or a branch of the main repository. The repository
  will be clearly marked as experimental.
- When a package in the preview repository has reached maturity and is ready for GA, it will be copied into the main
  repo and made a part of CDK 2. The module in the preview repository will then be marked as deprecated with clear
  documentation to point users to the new stable version in the main repository. The lifecycle of experimental modules
  in the preview repository will be exactly the same as it is currently in 1.x, with the same metadata markers in the
  code.
- The contributor guide for the CDK will be modified so that users know where to introduce new experimental code.
- If it becomes absolutely necessary to add a new feature to v2 that would be a breaking change for users, the feature
  will be hidden behind a feature flag. The code path will not be accessible without a specific opt-in by the user.

# Drawbacks

- In several places in the current 1.x CDK branch, stable modules refer to or contain experimental code. This will no
  longer be possible after the release of v2.
- When we graduate a module, users who have participated in the Developer Preview will have to update their imports to
  make use of the stable version in the main repository.
- For developers who are working on experimental code that has complex dependencies with the core and with other
  modules, development will be more complicated.
- In some cases, experimentation will not be possible. New features introduced to the main repository will have to be
  vetted much more carefully before they are merged, since any public API released as part of v2 will have to be
  supported for the lifetime of the major version.

# Alternatives

Some alternatives to this strategy are:

- Make no changes and continue to experiment in the main release.
  - Improve documentation so that it is more obvious to users that they are importing experimental code.
  - Make it a policy to actually include the name 'experimental' in all experimental APIs.
- Use clever build tricks to hide experimental modules. This might be possible in Typescript, where the type files are
  separate from implementation, but might prove difficult or impossible in other languages such as Python.
- Use runtime checks. Calling an experimental API would throw an exception which can be silenced by flipping a flag
  ALLOW_EXPERIMENTAL=1.

# Adoption Strategy

The hope is that for the majority of users, upgrading from 1.x to 2.x will be as simple as changing import statements at
the top of their source files, rebuilding, and redeploying. This upgrade should not result in any resources being
destroyed and recreated, except in very specific cases where we have made it clear to users, such as with the EKS L2
construct library. The same should be true for users upgrading from the preview repository to the stable repository as
modules are graduated from Developer Preview to GA.

# Unresolved questions

- One debated decision was related to the preview repository. Should it be a single repository or should each new module
  get its own repository? Separate repositories are attractive because it gives us a way to demonstrate a canonical way
  to develop an independent construct library. But using a single repository is much simpler logistically.

# Future Possibilities

- As of now, there are no known major breaking changes planned beyond what is already in v2 that would warrant a v3 in
  the near future.

# Implementation Plan
