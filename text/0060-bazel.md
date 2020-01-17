---
feature name: bazel
start date: 2020-01-16
rfc pr: (leave this empty)
related issue: 0060
---

# Summary

This proposal is for migrating the build system to [Bazel](https://bazel.build/), as it solves
many if not all of the deficiencies of the current system. This involves adding Bazel resources and rules to the repository to manage
build and test workflows, and bringing the team up to speed on how to use them.

# Motivation

The CDK currently uses a combination of [Lerna](https://lerna.js.org/), [Yarn Workspaces](https://yarnpkg.com/lang/en/docs/workspaces/), 
and Bash scripts to orchestrate build and test workflows. This has several advantages for managing a monorepo structure, but can also
be very slow, difficult to work with and extend, and hard to parallelize amongst the team (ie when one unrelated resource changes, the
whole project still needs to be rebuilt). 

# Basic Example

Instead of running `bash build.sh` or `npm run build` on a subpackage, an engineer would simply run `bazel build <path-to-resource>` or
`bazel test <path-to-resource`. Running a specific Bazel rule (for instance orchestrating a release) is also straightforward, with
`bazel run <path-to-resource>.<action>`.

# Design Summary

In order to setup Bazel, the Bazel-specific rules and resources need to be added to the repository. This means adding `BUILD.bazel` files
to each subpackage, and then building custom rules around some of the internals of the project (e.g. CFN to TS).

# Detailed Design

The structure of adding Bazel to a project is quite simple. Represented below is a tree of the files
needed for a standard project

```
BAZEL.build
package.json
|packages|
  BUILD.bazel
  |apigateway|
    BUILD.bazel
    package.json
    apigateway.ts
    index.ts
WORKSPACE <-- Bazel project definition, only needed once
yarn.lock
```

The `BUILD` files themselves are quite simple, since Bazel has rules built-in for compiling a TypeScript library and for
running JavaScript tests. We would need to write custom rules in the 
[Skylark language](https://docs.bazel.build/versions/master/skylark/language.html) to perform custom operations like
building TypeScript definitions from CloudFormation definition files. This is relatively straightforward since the tooling
for this exists in TypeScript already, and Skylark is a subset of Python.

Example `BUILD.bazel` file, assuming `cdk_library` is a Bazel rule that calls `ts_library` with another rule that performs 
TS transformation:
```
load("//tools:defaults.bzl", "cdk_library", "pkg_npm")

package(default_visibility = ["//visibility:public"])

cdk_library(
    name = "aws-amazonmq",
    scope = ["AWS::AmazonMQ"],
    outputs = ["lib/amazonmq.generated.ts"],
    srcs = glob(["lib/**/*.ts"]),
    deps = [
        "//packages/@aws-cdk/cdk",
    ],
)

pkg_npm(
    name = "npm_package",
    srcs = [
      "package.json",
    ],
    tags = [
        "release-with-framework",
    ],
    deps = [
        ":aws-amazonmq",
    ],
)
```

The `pkg_npm` rule is also built-in to Bazel, and bundles a package based on given sources, along with other needed files like a package.json.
Note that the `cdk_library` rule is only needed for packages that have a CFN to TS transformation. If that's not needed, it's simply a `ts_library` rule.

# Drawbacks

There are two main drawbacks to migrating to Bazel:

1. Lack of familiarity with Bazel amongst the team
1. Relative newness of Bazel in the JavaScript/TypeScript ecosystem

For the first point, the current system has the advantage of being a glorified monorepo wrapper around NPM. Bazel,
on the other hand, has a completely different semantic structure. While using it is straightforward for the most part,
understanding how it works and more importantly how to extend it (by writing custom rules, for example) is not.

For the second point, while Bazel has had its 1.0 release, that release was relatively recent, and there is still much
work to be done in the space. For instance, Bazel does not currently supported nested package.json dependencies when
constructing its own dependency tree. While the nested files can exist, their dependencies would have to be deduped to
the root package.json file in order for everything to be setup properly by Bazel.

# Rationale and Alternatives

## Rationale
* Bazel is incremental, meaning that only the changed aspects of the project and its dependencies need to be rebuilt
* Bazel caches all of its builds, making it much faster than the current solution
* Bazel allows for hermiticity and reproducability since it runs in a sandbox
* Bazel is highly extensible, meaning custom rules can be written solely in TypeScript/JavaScript as opposed to Bash, but
still incorporated easily into the toolchain

## Alternatives
* Remain with the current build system, but incorporate [lerno](https://github.com/aws/aws-cdk/pull/5359)

# Adoption Strategy

The Bazel rules can be added in parallel with current efforts by the team. None of the resources involved would
overwrite or interfere with the current project structure, so adding files would not interfere with developer flow.
Switching over to Bazel could also be opt-in as people want to try it, with the legacy system in place to manage
releases and for developers to fallback on if needed.

The rules for each subpackage would need to be added, along with the general rules for the project. All of the Bazel
dependencies would be added to the top-level package.json, in addition to the nested dependencies from all of the
subpackages. There should not be too many, since most of the "dependencies" are simply other CDK subpackages.

# Unresolved questions

* Will the project structure of the CDK remain stable over time, or will it move to a singular import?

# Future Possibilities

* We could setup Remote Build Execution (RBE) using a fleet on EC2 or ECS, further speeding up the team's builds
* We could enable remote caching for our CI to speed up our CI builds, in addition to local builds
