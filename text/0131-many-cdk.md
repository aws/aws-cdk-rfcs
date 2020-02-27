---
feature name: many-cdk
start date: 2020-02-26
rfc pr:
related issue: #131
---

<!-- replace the blockquoted sections with your content -->
# Summary

Instead of publishing packages on a 1:1 basis of CloudFormation namespace to CDK package, the CDK should switch to a
many-to-one basis of CloudFormation namespace to CDK package. This is an alternative to the MonoCDK (#6 and #122) proposal
which supports an all-to-one ratio of namespaces to packages.

More specifically, the CDK should more closely model the CloudFormation experience as it is today. A single package
representing all generated L1 constructs should be bundled together. This represents a direct migration from someone
using CloudFormation to the CDK without introducing _any_ new dependencies other than the L1 package and the core utilities.
Then, the L2 constructs should be grouped according to their categorization. This allows users constructing their stacks
to more logically approach the services they will need to use, while omitting the ones they don't.

# Motivation

As of the first draft of this RFC, there are currently 132 separate packages published under the scope `@aws-cdk/aws-XXX`.
This creates a dependency hell for CDK users hoping to construct the same level of infrastructure they would get with
dependency-less CloudFormation. Further, as identified in the MonoCDK proposal, maintaining version parity between 
dependencies can also lead to unexpected headaches for end-users in ecosystems that have less-than-perfect dependency 
resolution systems.

The MonoCDK proposal is simple: consolidate all of the above dependencies into one package that can be consumed. However,
this leads to a package that is over 45MB in size, which is actually larger than the latest version of the AWS SDK. While
the SDK has a dynamic purpose and has been identified as essential for loading in the Lambda runtime, the CDK is not. This
does not mean that there isn't a use case for the CDK to be used in that or other space-constrained environments.

Further, the MonoCDK proposal claims that the new single dependency will resolve the dependency issue commonly seen in
NPM and Python environments. However, in NPM as one example, if PackageA takes a dependency on MonoCDK-2.0, but PackageB
takes a dependency on MonoCDK-1.0, the conflict identified in the RFC will still exist. The issue may be lessened, but it
is certainly not removed, and should not be a strong motivator for the proposal as compared to this one.

The resources that the CDK represents are already logically grouped together in at least one place: the AWS Console. There,
25 distinct categories are identified, most with multiple resources listed. The main categories number less than ten in terms
of common usage. In other NPM ecosystems, like Angular and React, this number of co-dependencies is considered tolerable.

# Basic Example

The new package structure for the CDK would be as follows:
```
// L0 packages
@aws-cdk/core
@aws-cdk/cx-api

// L1 package
@aws-cdk/cfn

// L2 packages
@aws-cdk/analytics
@aws-cdk/compute
@aws-cdk/database
@aws-cdk/devtools
@aws-cdk/management
@aws-cdk/networking
@aws-cdk/security
@aws-cdk/storage
...
```

The above consists of the top-level categories listed on the AWS Console (e.g. most popular). More could be added,
but it is unlikely a user would need all 25 (at least not to start).

# Design Summary

To accomplish this, we would need to migrate all of the L2 constructs out of their current distributions. Then, we would
need to consolidate all L1 constructs and deprecate the existing subpackages.

This would be straightforward since the constructs themselves won't change, just the dependencies. While MonoCDK would
have a user only install one new dependency, this would realistically only add at most six or seven for the average app,
and likely less.

# Detailed Design

Each new scope under ManyCDK would contain all of the L2 modules currently supported by the CDK for each of its subresources.
For instance, `@aws-cdk/storage` would contain L2 constructs for S3, EFS, FSx, S3 Glacier, Storage Gateway, and AWS Backup.

Imports would remain the same as if they were from the current scoped packages, e.g. `import {Bucket} from '@aws-cdk/storage';`

Installation for these packages would remain a one line command, e.g. in tutorials:
```bash
npm i -D @aws-cdk/core @aws-cdk/cfn @aws-cdk/compute @aws-cdk/security @aws-cdk/storage
```

Alternatively, we could create a utility that makes this process easier (but still manageable post-install compared to the
current appraoch):
```bash
cdk add lambda // Adds support for Lambda L2 by finding its category and installing dependencies
cdk add compute // Adds the compute category dep and its dependencies
```

# Drawbacks

* Users still need to install many packages
* This does not resolve how the install process is managed, and could harm discoverability. At least with the current
system, you just match the service to the namespace
* It's more difficult than MonoCDK in terms of migration and usage for end users (although we can probably build tools
to help here)

# Rationale and Alternatives

This design is preferable to the MonoCDK approach because it allows users to remain in control of which resources they
consume. As the scale and complexity if L2 constructs is only slated to grow over the course of the CDK's roadmap, this
becomes even more critical.

Compared to the current approach, this is vastly preferable, since 132 dependencies is untenable, especially as AWS only
continues to grow.

One alternative is to do this _and_ MonoCDK! With the adoption of a new build system and with improvements to JSII, the
sources for ManyCDK could be dynamically combined at build-time to create a singular target that then gets cross-published.

# Adoption Strategy

This is _technically_ a breaking change, though users of the existing packages will not notice any issues since they will
simply stop being published.

The rollout should be straightforward: publish the L1 package first since it is generated from a singular source and does
not need to be updated by hand if a bug fix is pushed for an L2 construct, etc. Then, in bursts, migrate the L2 constructs
out of their respective packages to the new overarching package, and then deprecate the old packages. This would create a mild
incongruity in naming conventions only (since some packages with be `@aws-cdk/aws-XXX` and some with be just `@aws-cdk/XXX`).

We can assist by providing comprehensive deprecation messages in the old packages. Since it will be a many-to-one migration, it
should be a relatively straightforward process. We could create a migration utility that renames the namespaces, much like
the one developed for the [MonoCDK proposal](https://www.npmjs.com/package/@monocdk-experiment/rewrite-imports).

# Unresolved questions

* What would the limit be for resources under a package scope? We follow the AWS Console here, but should we?
* Should we publish versioning guidance to package authors using the CDK? Further, should the CDK Core print a warning
if it detects CDK under `dependencies` as opposed to `peerDependencies`?
* If we don't have L2 constructs for an entire category, will this create a negative user impression compared to the
current model or MonoCDK?

# Future Possibilities

I really like the idea of both ManyCDK and MonoCDK. The former being for limited use cases, and the latter for people who
just want the damn thing to work.

My example borrows on the AWS Console's categorization of resources, but maybe we can come up with a better one? My goal
was to make discoverability the priority, and it's pretty easy for someone to just open the console and say "yes, I need
this resource and it's under this category -> NPM install".

I didn't touch much on experimental modules, but this would pretty much force the issue of either a) putting experimental
modules/APIs inside the stable packages themselves; or b) publishing experimental versions (e.g. 1.0.0-exp). But a dedicated
experimental module would not work because then it would just have to take dependencies on everything else anyway.
