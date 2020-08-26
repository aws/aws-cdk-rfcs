---
feature name: Migration Path For Intrusive Changes
start date: 2020-08-26
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/245
related issue: https://github.com/aws/aws-cdk-rfcs/issues/244
---

# Summary

When we introduce breaking changes to `experimental` libraries that require resource replacements,
or in general are considered highly intrusive, we should provide a clear migration path.

This RFC proposes a protocol for introducing such changes.

> **More than an actual RFC, this should be treated as somewhat of a thought experiment that will eventually evolve to an actual mechanism.**

> For the sake of discussion, this RFC will specifically refer to the `aws-eks` module as an example.

# Motivation

The EKS module is currently in `experimental` state, as we push to `developer-preview`, we need to introduce networking changes that
require cluster replacement. We'd like for users to be able to use the current module without interruption, and choose to replace their cluster at their own pace.

# Design Summary

The main idea is to spin off to a new module that introduces all the breaking changes at once. The old module will be effectively locked, and won't receive any updates apart from **p0** bug fixes.

Its essentially the same as rolling out a new major version, but since all
modules are versioned together, we do this by changing the module name, and not the version.

Since the final module we mark as `stable` should be called `aws-eks`, we rename the current module to `aws-eks-experimental`, and move forward with the new one as `aws-eks`.

This also means that we need to somehow detect current users of `aws-eks`. Otherwise, user's won't know they need to change their dependency. This can be done with a feature flag.

# README

When such a change is introduced to the module, we will add the following notice to its README.

> This library has been deprecated in favor of the `aws-eks` module. This module will not receive updates apart from critical bug fixes. Note that transitioning to `aws-eks` might incur changes that require cluster replacement.

The new module, which is now `aws-eks`, will include the following notice in its README.

> If you are transitioning to this module from `aws-eks-experimental`, you might incur changes that require cluster replacements.

# Implementation Plan

1. Rename current module to `aws-eks-experimental`.
2. Create a staging branch `eks-dev-preview` which contains `aws-eks` as a copy of `aws-eks-experimental`.
3. Implement necessary changes onto the `eks-dev-preview` branch.
4. Merge `eks-dev-preview` to master.

# Rationale and Alternatives

- Instead of renaming the current module, we can rename the new module. So we will have `aws-eks-dev-preview`. This would prevent the need for the detection of old module usages in the new module code. The problem here is that eventually we would need to rename it, and the `aws-eks` module will be taken, so we would need to rename that as well, winding up in the same situation, except we now broke the old module again, after we promised not to.

# Adoption Strategy

When users upgrade their version of `aws-eks`, they will now receive the new intrusive version. This version will detect that the user had previously been using the old `aws-eks` (which is now `aws-eks-experimental`) module, and display the following error:

```console
The aws-eks module has undergone a name change, to use the previously named aws-eks module, please change your imports and dependencies to use aws-eks-experimental. If you'd like to use the new aws-eks module, add the following key to your cdk.json file: "@aws-cdk/aws-eks:migratedFromExperimental: true".
```

The user will then choose to either change imports to point to the `aws-eks-experimental` module, and continue working without interruption. Or, add the necessary feature flag to `cdk.json` and continue with the new module which will most likely replace the cluster.

# Unresolved questions

- How will this work with monocdk?

# Future Possibilities

Hopefully, this little exercise will turn into a well defined mechanism. If we take the current approach and expand it to follow:

*"Each intrusive change will spin off to a new module"*

And come up with some sort of naming pattern for old modules, this might work as a general approach.
