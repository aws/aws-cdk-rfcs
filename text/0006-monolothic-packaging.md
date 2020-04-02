---
feature name: monolithic-packaging
start date: 2020-02-13
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/122
related issue: #6
---

# Summary

This RFC proposes to distribute the AWS CDK as a single module instead of 150+
modules in order to allow third-party CDK modules to declare their dependency on
the AWS CDK as a peer dependency.

# Motivation

The AWS CDK is currently released as 150+ modules, one for every AWS service and
a few framework modules. These models have complex interdependencies. For
example, the **aws-ecs** module depends on **core**, **aws-iam**, **aws-ecr**,
**aws-ec2** and more modules to do its work. In fact, it depends on 40 other
modules (check out the [graph](http://npm.broofa.com/?q=@aws-cdk/aws-ecs)). This
means that when a user wishes to use the **aws-ecs** module, their package
manager needs to fetch all 40 dependencies.

## Why we need to use peer dependencies?

Most of the modules also accept objects from dependent modules as inputs. For
example, when an `s3.Bucket` is defined, users can pass in a `kms.Key` object
for encryption. 

In npm, it is possible for two modules to co-exist in the dependency graph in
different versions, but this capability is hazardous in our case. For example,
say the **aws-s3** module depends on **aws-kms@2.0** and the consumer uses
**aws-kms@1.0** (npm allows that!). When a user passes a `kms.Key` to the
bucket, the object received by the S3 module is from the 1.0 version, but they
expect 2.0 and might break if it, e.g. tries to use APIs that were changed,
deleted or removed between the versions. The same can happen between minor
versions (i.e. the S3 module uses a new feature).

In npm, to ensure that there is a single instance of a module in the graph, the
**aws-s3** module needs to declare the **aws-kms** module as a "peer
dependency".

However, peer dependencies are not automatically installed. They must be
explicitly installed by the end consumer. In our example, the implicationis that
if an application takes a dependency on **aws-s3**, it **MUST ALSO** add a
direct dependency on **aws-kms**. Otherwise, the **aws-s3** module will not be
able to resolve the **aws-kms** dependency at runtime.

## Implications of peer dependencies

If we modeled all the CDK dependencies as peers (as they should be), it means,
for example, that if an app uses the **aws-ecs** module, the app will have to
explicitly install all the 40 transitive dependencies.

The other **critical** implication of using peer dependencies is that adding a peer
dependency to a module in in fact **A BREAKING CHANGE**. Any direct or indirect
consumer of this module will have to explicitly install the new dependency.
This, according to semantic versioning, requires a major version bump.

## What are we doing today?

The current situation is that CDK modules use normal dependencies in order to
force npm to install them automatically but this creates unwanted friction for
end-users and impossible situation for authors of third-party libraries.

When a new CDK version is released, end-users often run into issues caused by
mismatching module versions in their graph and need to manually nuke their
`node_modules` directory and make sure all their CDK modules use the exact same
version number.

The implication for library authors is that if they model their CDK dependencies
as peer dependencies, they risk the implications of peer dependencies as
described above, such as needing to perform a major version bump every time a
new dependency is added.

## What are we proposing to do?

This RFC proposes to release the entire AWS CDK as a single, monolithic module
(aka "monocdk"). 

By releasing the CDK as a monolithic module, we can avoid the implications of
peer dependencies across first-party modules (because there is only one module)
*and* enable third-party libraries to safely declare the CDK as a peer
dependency (because any consumer of this library will surely have the CDK
defined as a direct dependency).

In addition to the peer dependency issue described above the "hyper modular"
design results in poor ergonomics when it comes to declaring and installing
dependencies. Since users are required to explicitly install a module for each
service they use, even simple projects end up with dozens of direct CDK
dependencies. A single CDK module solves this problem as well.

# Basic Example

The AWS CDK will be shipped as a single module which includes the core types and
the entire AWS Construct Library.

This means that a 3rd-party library will declare its dependency on the CDK via a
single module `aws-cdk-lib`:

```json
{
  "name": "your-awesome-lib",
  "peerDependencies": {
    "aws-cdk-lib": "^2.12.0",
    "constructs": "^2.0.0"
  }
}
```

> The `constructs` module includes the core programming model of the CDK and
> released as a separate library. Since all CDK applications and libraries will
> need to use directly reference `constructs` (since they need types from it),
> it is safe to assume that all end-consumers will have a direct dependency on
> `constructs` as well.

An app that consume this library will depend on the third-party library and will
also depend `aws-cdk-lib`:

```json
{
  "name": "my-awesome-app",
  "dependencies": {
    "aws-cdk-lib": "2.89.0",
    "constructs": "1.77.0",
    "your-awesome-lib": "^2.0.0"
  }
}
```

In JavaScript/TypeScript code, import statements that use the CDK will now look
like this:

```ts
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

// ...
export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new s3.Bucket(this, ...);
    new dynamodb.Table(this, ...);
  }
}
```

Alternatively, users can also import submodules like so:

```ts
import { aws_s3, aws_dynamodb } from 'aws-cdk-lib';
```

# Design Summary

The general approach proposed by this RFC is to ship the core types and the
entire AWS Construct Library as a single module for all languages.

This will dramatically simplify how users declare their compatibility with the
AWS CDK, and I would argue it is also more aligned with our user's mental model
(see [Rational](#rationale-and-alternatives) beflow).

# Detailed Design

The [monocdk-experiment](https://www.npmjs.com/package/monocdk-experiment)
module implements this approach by consolidating **all** `@aws-cdk/*` modules
into a single npm package during the build phase of the repo.

The monolithic module will be organized into **submodules** that match 1:1 the
current module system we have for the AWS CDK. These submodules will be
implemented using typescript **namespaced exports** (see [jsii
PR](https://github.com/aws/jsii/pull/1297)).

* All `@aws-cdk/core` types will be exported without a namespace (root) ([PR #7007](https://github.com/aws/aws-cdk/pull/7007)).
* Hyphens in the current module names will be converted to underscores (`aws-s3` => `aws_s3`).
* The package will be organized to support "barrel imports" ([PR #6996](https://github.com/aws/aws-cdk/pull/6996))

## Module Names

### TypeScript/JavaScript

Package name:

* **Module**: `aws-cdk-lib`

Usage:

```ts
// core imports
import { Stack, App } from 'aws-cdk-lib';

// submodule imports
import * as s3 from 'aws-cdk-lib/aws-s3';
// or
import { aws_s3 } from 'aws-cdk-lib';
```

Migration path:

* Update `package.json` and remove all dependencies on `@aws-cdk/xyz` and add `aws-cdk-lib`.
* Replace `"@aws-cdk"` with `"aws-cdk-lib"` in all source files.

### Java

Package name:

* **Group ID**: `software.amazon.awscdk`
* **Artifact ID**: `aws-cdk-lib`

Usage:

```java
import software.amazon.awscdk.core.Stack; // hopefully (see "remaining work")
import software.amazon.awscdk.services.ec2.Vpc;
```

Migration path:

* Update `pom.xml` and replace all existing dependencies with the monolithic module.
* No change required in source files

Open issues:

* Will core types will have to go under `software.amazon.awscdk` instead of
  `software.amazon.awscdk.core`? This depends if submodule renaming will support
  specifying the per-language names for the root module.

### .NET

Package name:

 * **Namespace**: `Amazon.CDK`
 * **Package ID**: `Amazon.CDK.Lib` (sadly `Amazon.CDK` is taken by v1.0 core)

Usage:

```csharp
using Amazon.CDK;
using Amazon.CDK.AWS.S3;
```

### Python

Package name:

* **dist-name**: `aws-cdk-lib` or `aws-cdk`
* **module name**: `aws_cdk` or `aws_cdk_lib` (to preserve current usage?)

Usage:

```py
from aws_cdk import (
    core,
    aws_lambda,
    aws_dynamodb,
    aws_events,
    aws_events_targets,
)
```

Migration path:

* All `aws-cdk.xxx` dependencies will be removed from `requirements.txt` and replaced with `aws-cdk-lib`.
* No change in code usage, unless we decide to rename the module to `aws_cdk_lib`.

Open issues:

* Should we use `aws-cdk-lib` or `aws-cdk` as the distName?
* Should we use `aws_cdk` as the module name to preserve compatibility or rename to `aws_cdk_lib`?

## Issues with Specific Modules

### cx-api, cloud-assembly-schema and asset-schema

These modules are used to coordinate the protocol between the CDK apps and the
CLI. Today, both the CLI and the framework are dynamically linked against this
module (it is defined in `dependencies`). Once we ship the CDK as a single
monolithic module, we will need to decide how to coordinate the protocol.

The proposed solution is to continue to vend these modules as separate modules,
but also incorporate them statically into the mono-cdk (like we do for every
other module). This means that the mono-cdk will have a *copy* of this protocol,
while the CLI will take a runtime dependency on them. These protocols have a
separate versioning model, to ensure that the outputs of the framework are
compatible with the CLI.

### @aws-cdk/assert

The `@aws-cdk/assert` library cannot currently be bundled into the monolithic
module because it is not jsii-comptiable and transitively depends on about 29
unwanted modules (see [graph](http://npm.broofa.com/?q=@aws-cdk/assert)). We
have a plan to redesign it as a jsii module, but until then, we will have to
continue to vend it separately.

That is not an issue. For the prototype, this module is vended under
`@monocdk-experiment/assert`. It's the same content, just takes a dependency on
`monocdk-experiment`.

[PR](https://github.com/awslabs/aws-delivlib/pull/245) with the migration of
aws-delivlib to monocdk.

### @aws-cdk/aws-s3-deployment

The current size of this module is
[~13MiB](https://arve0.github.io/npm-download-size/#@aws-cdk%2faws-s3-deployment),
which is basically the majority of the content in the monocdk-experiment
([14.7MiB](https://arve0.github.io/npm-download-size/#monocdk-experiment)).

The main reason is that this module includes a a Lambda bundle that contains a
copy of the AWS CLI. The deployment resource provider leverages `aws s3 sync`,
which is the most reliable S3 syncing method we know of.

To address this, we are proposing to introduce to extract the AWS CLI into an
AWS Lambda layer and release it as part of the AWS CDK. See
[comment](https://github.com/aws/aws-cdk-rfcs/issues/39#issuecomment-593092612)
in the [RFC tracking issue](https://github.com/aws/aws-cdk-rfcs/issues/39) for
public artifacts.

# Drawbacks

## Module Size

The current size of the single module (1.26.0 of the prototype) is
([14.7MiB](https://arve0.github.io/npm-download-size/#monocdk-experiment)).

We don't consider this a major issue, especially the AWS CDK is primarily used
in build environments and not in memory/disk-sensitive runtime environments such
as the browser or AWS Lambda. Even for AWS Lambda, a 14.7MiB framework is not an
issue.

Having said that, the fact that we are bundling the entire construct library as
a single module will eventually pose a size limitation, and we should make sure
we don't exceed a reasonable size.

To that end, we should:

- Add a size limit per module which will fail build.
- Support publishing pubic artifacts to S3 during release (see
  [mini-RFC](https://github.com/aws/aws-cdk-rfcs/issues/39#issuecomment-593092612)).
- Devise better guidelines as to what goes into the framework and what doesn't.
  Generally, we should mostly accomodate L2s and avoid L3s to reduce the chance
  for proliferation.

In the future, we can consider minifying the code to reduce it's footprint or send users to [bundlephobia](https://bundlephobia.com/result?p=monocdk-experiment).

## This is a breaking change

This will require major AWS CDK version bump (2.0.0) with all the implications.

We can offer tools for migrating users from the old-style imports to the new
style. The prototype ships with `@monocdk-experiment/rewrite-imports` which
automatically rewrites `import` statements (usage: `npx
@monocdk-experiment/rewrite-imports **/*.ts`). Still a bit flacky but quite
useful. If we allow imports like this `aws-cdk-lib/aws-s3` then this tools is
even easier to write.

# Rationale and Alternatives

Monolithic packaging is basically the only way forward:

1. **Peer dependencies are the only way to model dependencies** inside the CDK and
   between third-party libraries and the CDK itself (see [Motivation](#motivation)).
2. **Adding a new peer dependency is a breaking change**, which we and
   third-party library vendors simply cannot afford.

Any other setup where we vend more than a single module will fall into these two
traps, and therefore we stipulate that's the only viable approach to solve the
problems described above.

There is also a conceptual rationale: our users think of the AWS CDK as a
"standard library" (or a "framework"), and not as another library that they
depend on to build their applications (like the AWS SDK for example). When users
write CDK libraries and apps they don't think of the AWS CDK as yet another
library that they use, they think of the AWS CDK as the foundation of their app.

We can draw the analogy to other standard libraries like the Node.js SDK, the
JDK, the .NET Framework. When users write libraries or apps in any of these
environments, they expect these standard libraries and runtimes to be brought in
by their consumers. In Node.js, for example, there is a special attribute in
`package.json` that basically defines the "peer Node.js dependency" (called
`engines`). I would argue that if a vendor publishes a 3rd-party construct
library, what they *really* want to say is "I am compatible with CDK >= 1.23.0".
Then, the decision about which actual CDK version is being used is left to the
app level.

## Alternatives Considered

We considered a few alternatives, but eventually realized that the only viable
approach is a single module (see [Rational](#rationale-and-alternatives) above).

We looked into:

1. **Tooling**: vending additional tooling (e.g. `cdk install`) that will make
   hyper-modular peer dependencies a better experience (i.e. it will
   automatically install all transitive dependencies for you). This option was
   rejected due to the breaking nature of additional peers.
2. **Meta-package**: keep the hyper modularity but also ship a meta-package that
   will either just take a dependency on all modules. The main benefit is this
   approach it will technically allow the interoperability of the two models.
   Libraries can still take granular peer dependencies while apps will depend on
   the meta package. This option was rejected because third-parties will still
   have to peer-depend on the mono-cdk, which will force all consumers to depend
   on mono-cdk, and then there is no use or value to the hyper-modules.
3. **A few modules**: we also considered the option to organize the CDK into a
   few modules based on some organization (i.e. framework, serverless,
   databases, etc). This alternative was rejected since it does not actually
   address the major problems we are trying to solve (peer dependency changes
   are still breaking).

# Adoption Strategy

This will be discussed as part of the RFC for CDK 2.0. 

General recommendations:

- Release `aws-cdk-lib` as a pre-release of v2.0 in tandem with continuing to
  work on the 1.x version line.
- Release migration tooling (see
  [@monocdk-experiment/rewrite-imports](https://preview.npmjs.com/package/@monocdk-experiment/rewrite-imports)).

# Remaining Work

- **Analytics**: We lose per-module analytics which means we will to move to report
  analytics at the construct level.
- **Reference documentation** needs to also support submodules/namespaces and
  use the submodule's README file.
- **Submodule renaming**: to preserve imports in some languages (i.e.
  Java/.NET), we need to be able to explicitly specify the "coordinates" of
  submodules in each language. For example, the S3 module is exported under the
  `aws_s3` module in mono-cdk, but we want it's types to be defined under the
  `software.amazon.awscdk.services.s3` Java package, so we need a way to specify
  this mapping somehow. This might be a problem for the "core" types which are exported without a submodule in the mono-cdk, but in Java they are currently
  under `software.amazon.awscdk.core`.
- See open issues per language.
- Add module size protection during build.

# Future Possibilities

- After this is released we should consider if we want to reorganize our source
  repository differently. It is critical to maintain the dependency graph to
  ensure architectural layers are preserved, but we don't have to use
  npm/lerna/package.json dependencies anymore.
