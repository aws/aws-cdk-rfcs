---
feature name: Migration Path For EKS Developer Preview
start date: 2020-08-26
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/245
related issue: https://github.com/aws/aws-cdk-rfcs/issues/244
---

# Summary

This RFC proposes a migration path for existing users following the upcoming transition of the `aws-eks` module
from *Experimental* to *Developer Preview*.

# Motivation

As part of transitioning the `aws-eks` module to *Developer Preview*, we need to introduce a few breaking changes that require
users to replace their existing clusters.

This poses a major interruption that might need extra planning from the user's side. Because of this, even though the module is
currently `experimental`, we want users to be able to replace clusters at their own pace. To that end, we need to come up
with some migration strategy.

# Design Summary

The main idea is to spin off to a new module. The old module will still be active, but will not receive updates that
require cluster replacement. The new module will be called `aws-eks-next`, to resemble the common practice of
using an `@next` tag to indicate pre-releases.

This will allow existing user to remain unaffected, while giving us a chance to incrementally introduce and validate these intrusive changes.
When we feel comfortable with the stability and feature set of `aws-eks-next`, we promote it to `aws-eks` and rename the
old module to `aws-eks-experimental`.

After the promotion takes place, users will automatically receive the version that will replace their clusters, even though
they didn't opt-in for it. To prevent that, we will put the usage of the new module behind a feature flag that users will
have to explicitly enable.

# README

There are two relevant points in time that we need to address.

## Pre Promotion

*Both `aws-eks` and `aws-eks-next` exist.*

README for `aws-eks` will include the following notice:

> This module will eventually be replaced by the [`aws-eks-next`](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-eks-next) module.
> This change will require you to replace your existing clusters.
> Since we know this kind of operation is highly intrusive, we will still be supporting the current module under the `aws-eks-experimental` name.
> This way, you can choose to migrate at your own pace, and plan out the cluster replacement as needed.

README for `aws-eks-next` will include the following notice:

> This module is a pre-release for the next version of the EKS Construct Library.
>
> ![#f03c15](https://via.placeholder.com/15/f03c15/000000?text=+) **Note: Use with caution.
> Migrating to this module from `aws-eks` will require you to replace your clusters, and may require additional
> cluster replacements in the future. Once this module is promoted to a release, changes that require cluster replacement will no longer be introduced.**

## Post Promotion

*`aws-eks` is now the new version, and `aws-eks-experimental` is the old one.*

README for `aws-eks-experimental` will include the following notice:

> This module is now deprecated in favor of [`aws-eks`](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-eks-next).
>
> Note that migrating to [`aws-eks`](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-eks-next) will
> require you to replace your existing clusters.

README for `aws-eks` will include the following notice:

> **Note: Migrating to this module from [`aws-eks-experimental`](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-eks-experimental)
> will require you to replace your existing clusters.

# Implementation Plan

1. Duplicate the current `aws-eks` module into an `aws-eks-next` module and push to master.
2. Implement the feature flag protection for using the new module.
3. Incrementally implement the required changes for cluster replacement onto the `aws-eks-next` module.
In addition, continuously port changes from `aws-eks` into `aws-eks-next` and release `aws-eks-next` in the normal CDK release.
4. Rename and deprecate `aws-eks` to `aws-eks-experimental` and rename `aws-eks-next` to `aws-eks`.

# Rationale and Alternatives

## Rename `eks.Cluster`

Instead of spinning off to a new module, we can spin off to a new construct.

That is, rename the current `eks.Cluster` to `eks.ExperimentalCluster` and implement everything we need in `eks.Cluster`.
We have actually already done this once with `eks.LegacyCluster`.

The benefit here is that users won't need to change dependencies. However, this change would also require a name change and
duplication of any class that interacts with `eks.Cluster` since those classes may not work with both `eks.Cluster` and `eks.ExperimentalCluster`.
It might also require changes to transitive types that don't directly depend on the the cluster.

This approach feels more fragile and doesn't provide much value since the user would still incur a breaking change.
It would just be in the form of a class name change, instead of a module name change.

## Rename old module

Instead of renaming the new module, we can create a staging branch that will both rename the existing module to `aws-eks-experimental`, and implement
all changes into a new duplicated `aws-eks` module. When we are done, we merge the staging branch and release `aws-eks`
as the new version, and `aws-eks-experimental` as the old version.

This has the benefit of avoiding the rename at the end of the process. However, this doesn't have any affect on the user.
As far as the user is concerned, a rename of the existing `aws-eks` module will happen exactly once, when the developer
preview is published, regardless of which approach.

The problem with this approach tough is the fact it accumulates many unpublished changes and releases them all at once.
While we won't be advocating for users to use the `aws-eks-next` module, it still gives us the option to use it ourselves exactly like customers would.

# Adoption Strategy

During the development of the `aws-eks-next` module, users are not expected to switch over to it. If some users choose to anyway,
we will make our intentions and plan for this module very clear, as already mentioned in the [README](#README) section.

Once development is finalized, and we promote `aws-eks-next` to `aws-eks`, the expected user experience is as such.

Since the current `aws-eks` module is guarded with a feature flag, upon upgrade, **ALL** users will receive the following message:

```console
The aws-eks module has undergone a name change, to use the previously named aws-eks module, please change your imports and dependencies to use aws-eks-experimental.
If you'd like to use the new aws-eks module, add the following key to your cdk.json file: "@aws-cdk/aws-eks:dev-preview: true".
```

The user will then choose to either change imports to point to the `aws-eks-experimental` module, and continue working without interruption.
Or, add the necessary feature flag to `cdk.json` and continue with the new module which will replace the cluster.

# Unresolved questions

- The current approach creates a strange quick where post promotion, we are left we a deprecated library called `aws-eks-experimental`.
This library isn't actually experimental, in the sense that it won't actually break since we stop touching it. Can we come up
with a different name? Perhaps `aws-eks-heritage`? (`legacy` is taken :\)

# Future Possibilities

Hopefully, this little exercise can turn into a well defined mechanism.
If we take the current approach and expand it to follow *"Each intrusive change will spin off to a new module"* And come up with
some sort of naming pattern for old modules, this might work as a general approach.
