---
feature name: Migration Path For EKS Developer Preview
start date: 2020-08-26
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/245
related issue: https://github.com/aws/aws-cdk-rfcs/issues/244
---

# Summary

This RFC proposes a migration path for existing users following the upcoming transition of the `aws-eks` module from *Experimental* to *Developer Preview*.

# Motivation

As part of transitioning the `aws-eks` module to *Developer Preview*, we need to introduce a few breaking changes that require users to replace their existing clusters.

This poses a major interruption that might need extra planning from the user's side. Because of this, even though the module is currently `experimental`, we want users to be able to replace clusters at their own pace. To that end, we need to come up with some migration strategy.

# Design Summary

The main idea is to spin off to a new module that introduces all the breaking changes at once. The old module will be effectively locked, and won't receive any updates apart from **p0** bug fixes.
Its essentially the same as rolling out a new major version, but since all
modules are versioned together, we do this by changing the module name, and not the version.

Since the final module we mark as `stable` should be called `aws-eks`, we rename the current module to `aws-eks-experimental`, and move forward with the new one as `aws-eks`.

This means that upon upgrade, existing users of `aws-eks` will now receive the developer preview version, which will naively replace their clusters. To avoid that, we need the code to detect this situation and provide clear instructions to the user.

# README

In the old module, which is now `aws-eks-experimental`, we will add the following notice to the README.

> This module has been deprecated in favor of the `aws-eks` module. This module will not receive updates apart from critical bug fixes. Note that transitioning to `aws-eks` might incur changes that require cluster replacement.

In the new module, which is now `aws-eks`, we will add the following notice to the README.

> If you are transitioning to this module from `aws-eks-experimental`, you might incur changes that require cluster replacements.

# Implementation Plan

1. Rename current module to `aws-eks-experimental` on the master branch.

    - This will be released with a BREAKING CHANGE notice and cause users to change their dependency.

2. Create a staging branch `eks-dev-preview` which contains `aws-eks` as a copy of `aws-eks-experimental`.

    - This will be a long living branch we will branch out of to and merge to.

3. Implement necessary changes onto the `eks-dev-preview` branch.

    - We branch out of the `aws-dev-preview` branch to separate feature branches so that we can review the changes.

4. Merge `eks-dev-preview` to master.

    - This merge is the release of the developer preview module.

# Rationale and Alternatives

### Rename `eks.Cluster`

Instead of spinning off to a new module, we can spin off to a new construct.

That is, rename the current `eks.Cluster` to `eks.ExperimentalCluster` and implement everything we need in `eks.Cluster`. We have actually already done this once with `eks.LegacyCluster`.

The benefit here is that users won't need to change dependencies. However, this change would also require a name change and duplication of any class that interacts with `eks.Cluster` since those classes may not work with both `eks.Cluster` and `eks.ExperimentalCluster`.

This approach feels more fragile and doesn't provide much value since the user would still incur a breaking change. It would just be in the form of a class name change, instead of a module name change.

### Rename new module

Instead of renaming the current module, we can rename the new module to `aws-eks-dev-preview`. This would prevent the need for the detection of old module usages in the new module code.

The problem here is that eventually we would need to rename `aws-eks-dev-preview` to `aws-eks`, which will be taken. So we would need to rename `aws-eks` as well, winding up in the same situation, except we now broke the old module again, after we promised not to.

# Adoption Strategy

When users upgrade their version of `aws-eks`, they will now receive the new intrusive version. This version will detect that the user had previously been using the old `aws-eks` (which is now `aws-eks-experimental`) module, and display the following error:

```console
The aws-eks module has undergone a name change, to use the previously named aws-eks module, please change your imports and dependencies to use aws-eks-experimental.
If you'd like to use the new aws-eks module, add the following key to your cdk.json file: "@aws-cdk/aws-eks:dev-preview: true".
```

The user will then choose to either change imports to point to the `aws-eks-experimental` module, and continue working without interruption. Or, add the necessary feature flag to `cdk.json` and continue with the new module which will replace the cluster.

# Future Possibilities

Hopefully, this little exercise can turn into a well defined mechanism. If we take the current approach and expand it to follow:

*"Each intrusive change will spin off to a new module"*

And come up with some sort of naming pattern for old modules, this might work as a general approach.
