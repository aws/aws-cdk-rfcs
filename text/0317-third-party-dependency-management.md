---
rfc pr: [#xxx](https://github.com/aws/aws-cdk-rfcs/pull/xxx) <-- fill this after you've already created the PR
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/317
---

# CDK third-party dependencies management

The Cloud Development Kit depends on a large collection of open-source third-party libraries.
While leveraging existing libraries that implement functionality needed by the project is obviously immensely useful,
it also requires correctly managing those dependencies, in particular:

1. Quickly reacting when a security vulnerability is discovered in a version of a dependency used by the project.

2. Protecting ourselves against [supply chain attacks](https://en.wikipedia.org/wiki/Supply_chain_attack),
  like [typosquatting](https://www.darkreading.com/vulnerabilities---threats/beware-the-package-typosquatting-supply-chain-attack/a/d-id/1340383),
  malicious package takeovers, etc.

## Current situation

### Dependencies

Right now, our released packages bundle all of their dependencies.

#### CLIs

In our CLI packages (`aws-cdk`, `cdk-assets`, etc.) that are NodeJS-only,
we have a very large dependency closure
(around 180 packages - [see here](https://npmgraph.js.org/?q=aws-cdk)
for the details).

At build time of these packages,
we generate an `npm-shrinkwrap.json` file with the exact version of each dependency
(including transitive ones).
This means a customer installing those packages in a given version will always get all of their dependencies in a specific version
(the one defined in `npm-shrinkwrap.json`) as well.

#### Framework

In our framework packages, we have a much smaller dependency closure,
roughly equal to:

- `yaml@1.10.2`, which has 0 dependencies
- `semver@7.3.5`, which depends on `lru-cache@6.0.0`, which depends on `yalist@4.0.0`
- `jsonschema@1.4.0` (from `@aws-cdk/cloudformation-schema`)
- `punycode@2.1.1` (from `@aws-cdk/aws-cognito`)
- `case@1.6.3` (from `@aws-cdk/aws-codepipeline-actions`)
- `@aws-cdk/core` depends on several packages for bundling: `ignore@5.1.8`, `@balena/dockerignore@1.0.2`, and:
  - `minimatch@3.0.4`, which depends on `brace-expansion@1.1.11`, which depends on `balanced-match@1.02`, `concat-map@0.0.1`
  - `fs-extra@9.1.0`, which depends on `at-least-node@1.0.0`, `jsonfile@6.1.0`, which depends on `universalify@2.0.0`, `graceful-fs@4.2.6`

All of these third-party dependencies are bundled with the released framework packages.
This is a JSII requirement
(otherwise, these 3rd-party dependencies would not be available when using CDK from other languages!).

For framework libraries in non-Node languages,
the only extra dependencies
(in addition to the bundled Node ones)
are generally only the appropriate JSII runtime.
These are updated separately, and are easier for customers to manage,
as non-Node package managers make it easy to override the version of a transitive dependency
like the JSII runtime in case a security vulnerability is found in it.
Because of that, this RFC only focuses on managing Node dependencies.

### Updating

We have a GitHub Action that once a week updates all dependencies in the CDK repository to their latest,
usually minor, version,
using the [`npm-check-updates`](https://www.npmjs.com/package/npm-check-updates) package.

### Summary

Our current situation defends us pretty well against supply-chain attacks,
because of the bundling that we do
(our customers are always pinned to a specific version of a dependency).

Also note that CDK is not susceptible to the attack described in the article
["Researcher hacks over 35 tech firms in novel supply chain attack"](https://www.bleepingcomputer.com/news/security/researcher-hacks-over-35-tech-firms-in-novel-supply-chain-attack),
as the CDK does not use any non-public packages.

The disadvantage of bundling is that it doesn't make it easy for our customers
to upgrade any third-party packages that have been found to have security vulnerabilities -
the customers have to upgrade their CDK package versions in order to get rid of the insecure dependency.
However, since bundling is a requirement forced on us by JSII,
there's nothing we can do to change this situation.

## Suggested actions

I suggest we take the following actions:

### 1. Perform a full audit of all third-party dependencies CDK uses

Our goal should be to minimize the number of third-party dependencies we use.
I suggest we perform an audit of all CDK code,
and when we determine that a given dependency is only used for a small part of the capabilities it offers,
like a single function,
consider vendoring in that functionality into our codebase
(of course, with the proper license and attribution/copyright)
in cases when we deem that appropriate.

### 2. Freeze the list of allowed third-party dependencies

After #1 above is completed,
we should freeze the allowed set of third-party dependencies that we use,
so that adding a new one will fail by default.
I have not found an existing tool to perform that sort of locking,
but I think writing a new `pkglint` rule should be relatively straightforward.
I imagine the list of allowed third-party dependencies will be kept in a file in source control,
so we can update it as time goes by,
and we determine a given new dependency is essential.

### 3. Run a periodic `yarn audit` check

To speed up the feedback cycle between finding out about a
vulnerability in a version of a third-party dependency we use,
and fixing it,
I propose we add a scheduled job that runs `yarn audit` on the CDK repo,
and creates a ticket in our internal system if any vulnerabilities are found by it.

### 4. Build tooling for deprecating unsafe CDK versions

Because of bundling, once a given third-party dependency version is deemed to have a security vulnerability,
all CDK versions using it will always be unsafe.
For that reason, we should deprecate all CDK package versions that have vulnerable dependencies,
and we should do it across all package managers that allow it,
so it's obvious for customers using this CDK version is unsafe.

This is generally a CLI invocation for a single package
(for example, [here are the NPM instructions](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions#deprecating-a-single-version-of-a-package)),
so we will need to build some automation to do this efficiently for the ~200 packages we release across all package managers.
