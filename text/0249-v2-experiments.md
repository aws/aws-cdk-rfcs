---
rfc pr: [#xxx](https://github.com/aws/aws-cdk-rfcs/pull/xxx) <-- fill this after you've already created the PR
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/249
---

# CDKv2 Experiments

As part of the CDK v2 release, the CDK is adopting a new method of creating, developing, and releasing new L2
constructs. CDK v1 intermixed stable modules and constructs alongside experimental constructs, confusing customers and
breaking semver semantics.

For CDK v2, the main CDK artifact (`aws-cdk-lib`) will contain only stable, consistent APIs
and constructs that adhere to backwards compatibility. Customers can consume any APIs from `aws-cdk-lib` and have
confidence that no breaking changes will be introduced (without a major version bump).

All current and new CDK modules
being developed — and not yet stable — it will be released as its own separate artifact, and versioned appropriately
according to semver.

In addition, this RFC introduces a new standard method for previewing new APIs within `aws-cdk-lib`.

## Working Backwards

Given the breadth of this change, several Working Backwards artifacts are presented here, each targeting a different
aspect of the customer experience when consuming experimental APIs from either `aws-cdk-lib` or one of the new
alpha modules.

### Release Notes

The following is a hypothetical snippet from the CDK v2 Release Notes:

> Starting with version 2.0.0 of the AWS CDK, all modules and members vended
> as part of the main CDK library (`aws-cdk-lib`) will always be stable; we are
> committing to never introduce breaking changes in a non-major bump.
>
> One of the most common feedback we hear from customers is that they love how
> fast new features are added to the AWS CDK, we love it to. In v1, the
> mechanism that allowed us to add new features quickly was marking them as
> "experimental". Experimental features were not subject to semantic versioning,
> and we allowed breaking changes to be introduced in these APIs. This is the
> other most common feedback we hear from customers - breaking changes are not
> ok.
>
> **Introducing API Previews**
>
> To make sure we can keep adding features fast, while keeping our commitment to
> not release breaking changes, we are introducing a new model - API Previews.
> APIs that we want to get in front of developers early, and are not yet
> finalized, will be added to the AWS CDK with a specific suffix: `BetaX`. APIs
> with the preview suffix will never be removed, instead they will be deprecated
> and replaced by either the stable version (without the suffix), or by a newer
> preview version. For example, assume we add the method
> `grantAwesomePowerBeta1`:
>
> ```ts
> /**
>  * This methods grants awesome powers
>  */
> grantAwesomePowerBeta1();
> ```
>
> Times goes by, we get feedback that this method will actually be much better
> if it accept a `Principal`. Since adding a required property is a breaking
> change, we will add `grantAwesomePowerBeta2()` and deprecate
> `grantAwesomePowerBeta1`:
>
> ```ts
> /**
> * This methods grants awesome powers to the given principal
> *
> * @param grantee The principal to grant powers to
> */
> grantAwesomePowerBeta2(grantee: iam.IGrantable)
>
> /**
> * This methods grants awesome powers
> * @deprecated use grantAwesomePowerBeta2
> */
> grantAwesomePowerBeta1()
> ```
>
> When we decide its time to graduate the API, the latest preview version will
> be deprecated and the final version - `grantAwesomePower` will be added.
>
> **Alpha modules**
>
> Writing the perfect API is hard, some APIs will require many iterations of
> breaking changes before they can be finalized, others may need a long bake
> time, and some both. This is especially true when writing new constructs.
> To that end, new services and L2s will be initially released
> as independent modules, each with their own prerelease versions. When an
> alpha module is ready for prime time it will be added to `aws-cdk-lib`. Check
> out our contribution guide for more details.

### Developer Guide

The following is a snippet from the Developer Guide targeted at how to install and use the new alpha modules:

> **Installing the Alpha CDK Modules**
>
> Alpha CDK modules are denoted with an alpha identifier, to clearly identify them as pre-production. The following examples will walk
> through installing the module for a hypothetical AWS service called FooBar.
>
> *Typescript/Javascript*
>
> ```sh
> npm install @aws-cdk/aws-foobar-alpha
> ```
>
> *Python*
>
> ```sh
> pip install aws-cdk.aws-foobar-alpha
> ```
>
> *Java*
>
> Add the following to the `<dependencies>` container of pom.xml.
>
> ```xml
> <dependency>
>     <groupId>software.amazon.awscdk</groupId>
>     <artifactId>foobar-alpha</artifactId>
>     <version>${version}</version>
> </dependency>
> ```
>
> *Dotnet*
>
> ```sh
> dotnet add package Amazon.CDK.AWS.FooBar.Alpha
> ```
>
> *Go*
>
> ```sh
> go get github.com/aws/aws-cdk-go/awscdk/v2/awsfoobaralpha
> ```
>
> **Using the Alpha CDK Modules**
>
> The following examples show how to import the FooBar service into your code. Imports for the core library and S3 are shown for comparison.
>
> *Typescript/Javascript*
>
> ```ts
> import { App, Stack } from 'aws-cdk-lib';
> import { aws_s3 as s3 } from 'aws-cdk-lib';
> import * as foobar from '@aws-cdk/aws-foobar-alpha';
> ```
>
> *Python*
>
> ```python
> from aws_cdk import App, Stack
> from aws_cdk import aws_s3 as s3
> from aws_cdk import aws_foobar_alpha as foobar
> ```
>
> *Java*
>
> ```java
> import software.amazon.awscdk.App;
> import software.amazon.awscdk.Stack;
> import software.amazon.awscdk.services.s3.Bucket;
> import software.amazon.awscdk.services.foobar.alpha.FooBarConstruct;
> ```
>
> *Dotnet*
>
> ```csharp
> using Amazon.CDK;
> using Amazon.CDK.AWS.S3;
> using Amazon.CDK.AWS.FooBar.Alpha;
> ```
>
> *Go*
>
> ```go
> import (
>   "github.com/aws/aws-cdk-go/awscdk"
>   "github.com/aws/aws-cdk-go/awscdk/v2/awss3"
>   "github.com/aws/aws-cdk-go/awscdk/v2/awsfoobaralpha"
> )
> ```
>
> **Versioning**
>
> Alpha modules are released separately from `aws-cdk-lib`, but their versioning mirrors that of `aws-cdk-lib`.
> For each release of `aws-cdk-lib` (e.g., `2.x.y`), the latest version of all of the alpha modules will also be
> released, with a corresponding `alpha` pre-release version (e.g., `2.x.y-alpha.0`). Generally, using versions
> of alpha modules that match the `aws-cdk-lib` version ensures compatibility; however, you can also use a newer
> version of `aws-cdk-lib` than the version of the alpha modules, allowing you to get new features from `aws-cdk-lib`
> without needing to also take on new (potentially breaking) changes from the alpha modules.

### CHANGELOG & Release Notes

The main V2 Changelog (`CHANGELOG.v2.md`) will include only changes from stable modules, in the standard format. A
separate Changelog (`CHANGELOG.v2.alpha.md`) will be created to track all changes to alpha modules.

**CHANGELOG.v2.md:**

```md
## [2.1.0](https://github.com/aws/aws-cdk/compare/v2.0.0...v2.1.0) (2022-01-01)

### Features

* **bar:** new fizzbuzz support ([#999999](https://github.com/aws/aws-cdk/issues/999999)) (b01dface), closes [#999998](https://github.com/aws/aws-cdk/issues/999998)
* **foo:** more buzzing on the fizzes  ([#999994](https://github.com/aws/aws-cdk/issues/999999)) (deadb33f), closes [#999993](https://github.com/aws/aws-cdk/issues/999993)

### Bug Fixes

* **core:** transmorgrifier sometimes clones subject ([#999991](https://github.com/aws/aws-cdk/issues/15313)) (0ddba11), closes [#999990](https://github.com/aws/aws-cdk/issues/999990)
```

**CHANGELOG.v2.alpha.md:**

```md
## [2.1.0-alpha.0](https://github.com/aws/aws-cdk/compare/v2.0.0-alpha.0...v2.1.0-alpha.0) (2022-01-01)

### BREAKING CHANGES
* **newbar:** default answer to life, universe and everything changed from 41 to 42.

### Features

* **newbar:** add support for adding foos ([#999999](https://github.com/aws/aws-cdk/issues/999999)) (b01dface), closes [#999998](https://github.com/aws/aws-cdk/issues/999998)

### Bug Fixes

* **newbar:** answer to life has off-by-one error ([#999991](https://github.com/aws/aws-cdk/issues/15313)) (0ddba11), closes [#999990](https://github.com/aws/aws-cdk/issues/999990)
```

**Github Release Notes:**

The release notes (e.g., <https://github.com/aws/aws-cdk/releases/tag/v2.0.0-rc.19>) for each release will contain the combined notes for both
stable and alpha modules, clearly delineated.

```md
# [v2.1.0]
---
## aws-cdk-lib
### Features
* **bar:** new fizzbuzz support ([#999999](https://github.com/aws/aws-cdk/issues/999999)) (b01dface), closes [#999998](https://github.com/aws/aws-cdk/issues/999998)
* **foo:** more buzzing on the fizzes  ([#999994](https://github.com/aws/aws-cdk/issues/999999)) (deadb33f), closes [#999993](https://github.com/aws/aws-cdk/issues/999993)

### Bug Fixes
* **core:** transmorgrifier sometimes clones subject ([#999991](https://github.com/aws/aws-cdk/issues/15313)) (0ddba11), closes [#999990](https://github.com/aws/aws-cdk/issues/999990)

--
## Alpha Modules (v2.1.0-alpha.0)
### BREAKING CHANGES
* **newbar:** default answer to life, universe and everything changed from 41 to 42.

### Features
* **newbar:** add support for adding foos ([#999999](https://github.com/aws/aws-cdk/issues/999999)) (b01dface), closes [#999998](https://github.com/aws/aws-cdk/issues/999998)

### Bug Fixes
* **newbar:** answer to life has off-by-one error ([#999991](https://github.com/aws/aws-cdk/issues/15313)) (0ddba11), closes [#999990](https://github.com/aws/aws-cdk/issues/999990)
```

## FAQ

### *Can I take a dependency on just a single alpha module?*

Yes! Each of the alpha modules are independently published and versioned, so you can install and use only the
alpha module(s) you need for your infrastructure. All other modules (via `aws-cdk-lib`) will offer stable APIs that
will not change in backwards-incompatible ways.

### *Can I mix module versions (i.e., upgrade only one)?*

Yes, since each alpha module is its own published package, each can be separately upgraded. You can upgrade to
receive new features in one module without needing to upgrade other unrelated alpha modules.

Note that in some cases, alpha modules have dependencies on each other (e.g., `aws-apigatewayv2` and
`aws-apigatewayv2-integrations`); in these cases both modules may need to be upgraded simultaneously.

### *Do the alpha modules need to be at the same version as aws-cdk-lib?*

No, unlike CDK v1 independent modules, the v2 alpha modules do not need to exactly match each other or the main
aws-cdk-lib. Each alpha module declares a dependency on a minimum version of aws-cdk-lib required for it to
function; as long as that requirement is satisfied, different versions can be installed. For example, you may have
`aws-cdk-lib@2.4.0` installed with `@aws-cdk/foobar-alpha@2.2.0-alpha.0` and `@aws-cdk/fizzbuzz-alpha@2.3.1-alpha.0`.

### *Can I safely update an alpha module without receiving breaking changes?*

Not automatically. Check the CHANGELOG for notices of breaking changes to the alpha modules.

### *Where can I view the docs for the alpha modules?*

The docs for the alpha modules are available on the CDK API documentation website,
<https://docs.aws.amazon.com/cdk/api/latest/>.

### *Where can I see what’s changed for each of the modules?*

An aggregated Changelog is published for all of the alpha modules, located alongside the primary Changelog, and
linked to from our GitHub artifacts (see <https://github.com/aws/aws-cdk/releases>).

## Internal FAQ

### *How do we tag releases in the repository?*

We rely on the V2 tags to determine the differences that are part of this release. We do not add tags specifically for
the alpha modules, as the versioning for alpha modules is always incremented at the same time as the V2 versions.

### *Where will the V2 Changelogs be stored?*

The existing `CHANGELOG.v2.md` Changelog, at the root of the repo, will remain unchanged. The new `CHANGELOG.v2.alpha.md`
file will be stored alongside it, also at the root of the repo. Both Changelogs will only be present on the `v2-main`
branch of the repo.

### *What is the relationship between the aws-cdk-lib version and alpha module versions?*

At publishing time, the alpha modules will be given a dependency on the current (corresponding) `aws-cdk-lib` version.
For example, `@aws-cdk/aws-foobar-alpha@2.2.0-alpha.0` will have a dependency on `aws-cdk-lib@2.2.0`. This automatic
version bump is the simplest to implement and requires the lowest amount of extra testing infrastructure to verify
correctness. The alternative -- manually bumping the dependent `aws-cdk-lib` version based on a set of criteria --
was deemed too complex to be feasible.

## Appendix

### Appendix A: Goals

These are the goals of this RFC, in order from most to least important:

1. Using CDK APIs that don't guarantee backwards-compatibility should require clear, explicit opt-in

    It should be absolutely obvious to a CDK customer when they are opting in to
    using an API that might have backwards-incompatible changes in the future. From
    experience, we have determined that including that information in the `ReadMe`
    file of a module, or in the inline code documentation available in an
    editor/IDE, does not meet the criteria of "absolutely obvious".

1. We want to foster a vibrant ecosystem of third-party CDK packages

    In our estimation, the CDK cannot be successful without growing an expansive
    collection of third-party packages that provide reusable Constructs on various
    levels of abstraction. Changing to vending the Construct Library as a monolithic
    package is one part of making that possible; we should make sure our approach to
    alpha modules and new experimental code also takes this into account.

1. The CDK team can still perform API experiments

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

1. Using alpha modules should be easy

    Our development methodology is highly dependent on feedback from the community
    before finalizing APIs. To encourage users to use and provide feedback on
    experimental APIs, we should make them easy to use.

### Appendix B: Previous RFC

This is the second version of this RFC. A previous version was reviewed and approved, and can be found here:
<https://github.com/aws/aws-cdk-rfcs/blob/master/text/0249-v2-experiments.expired.md>.
The original version is more implementation- and trade-off focused, whereas this RFC focused on the working-backwards artifacts.
