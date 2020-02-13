---
feature name: monolithic-packaging
start date: 2020-02-13
rfc pr: (leave this empty)
related issue: #6
---

# Summary

> Brief description of the feature.

The CDK consists of 100+ packages, one for every AWS service and then some, with
complex interdependencies. For example, the aws-ecs package depends on core,
aws-iam, aws-ecr, aws-ec2 and more packages to do its work. In fact, it depends
on 23 other packages. This means that when a user wishes to use the aws-ecs
module, their package manager needs to fetch all 23 dependencies.

**This proposal suggests to bundle and release the AWS CDK as a single monolithic
module. This means that the way users consume the CDK will change in a breaking
way.**

- [Summary](#summary)
- [Motivation](#motivation)
  - [3rd-party Construct Libraries](#3rd-party-construct-libraries)
  - [Poor Ergonomics](#poor-ergonomics)
- [Basic Example](#basic-example)
- [Design Summary](#design-summary)
- [Detailed Design](#detailed-design)
  - [Prototype](#prototype)
  - [TODO](#todo)
- [Drawbacks](#drawbacks)
- [Rationale and Alternatives](#rationale-and-alternatives)
  - [Alternatives Considered](#alternatives-considered)
- [Adoption Strategy](#adoption-strategy)
- [Unresolved questions](#unresolved-questions)
- [Future Possibilities](#future-possibilities)
- [Appendix](#appendix)
  - [Peer Dependencies in npm](#peer-dependencies-in-npm)

# Motivation

## 3rd-party Construct Libraries

When a 3rd-party construct library declares it's dependency on the AWS CDK as
["peer dependencies"](https://nodejs.org/es/blog/npm/peer-dependencies) (see
[Appendix](#peer-dependencies-in-npm) for details). 

This means that consumers of a 3rd-party construct library are expected to
**directly** install all transitive dependencies. 

For example, if someone publishes a 3rd-party construct library `foo` that uses the `@aws-cdk/aws-ecs`, the consumers of this library will not only have to take a dependency on `foo`, but also on `@aws-cdk/aws-ecs` **and all it's transitive dependencies** (i.e. 23 additional dependencies).

This is an unacceptable user experience with our current tools.

## Poor Ergonomics

In addition to the peer npm dependency issue described above, due to the fact
that CDK is "hyper modular", in all languages, we have poor ergonomics when it
comes to declaring dependencies. Since users are required to explicitly install
a module for each service they use, even simple projects end up with dozens of
direct CDK dependencies.

# Basic Example

The AWS CDK will be shipped as a single module that includes the core types and the entire AWS Construct Library.

This means that a 3rd-party library will declare it's dependency on the CDK via a single module `aws-cdk-lib` (name to be decided):

```json
{
  "name": "your-awesome-lib",
  "peerDependencies": {
    "aws-cdk-lib": "^2.12.0",
    "constructs": "^1.0.0"
  }
}
```

> The `constructs` module includes the core programming model of the CDK, which we plan to extract into a separate library.

And that's it. Apps that consume this library will depend on it and will also
depend on the CDK:

```json
{
  "name": "my-awesome-app",
  "dependencies": {
    "aws-cdk-lib": "2.89.0",
    "constructs": "1.77.0",
    "your-awesome-lib": "^1.0.0"
  }
}
```

In JavaScript code, import statements that use the CDK will now look like this:

```ts
import { aws_s3, aws_dynamodb } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// ...
export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new aws_s3.Bucket(this, ...);
    new aws_dynamodb.Table(this, ...);
  }
}
```

> TODO: other languages

# Design Summary

The general approach proposed by this RFC is to ship the core types and the
entire AWS Construct Library as a single module for all languages.

This will dramatically simplify how users declare their compatibility with the
AWS CDK, and I would argue it is also more aligned with our user's mental model (see [Rational](#rationale-and-alternatives) beflow).

# Detailed Design

## Prototype

See [monocdk-experiment](https://www.npmjs.com/package/monocdk-experiment).

## TODO

- [ ] We lose per-module analytics which means we will to move to report
  analytics at the construct level.
- [ ] We jsii to support the concept of "submodules". I believe this is easier
  than arbitrary namespaces which we decided not to support in jsii. One thing to consider for example, is where do submodule README files go.
- [ ] `constructs`
- [ ] How do we deal with `cx-api`?
- [ ] `@aws-cdk/assert` library. Do we have to do the assert library rewrite as a jsii module (we want to do that anyway!).
- [ ] Rewrite all example code (see [cdk-rewrite-mono-import](https://github.com/rix0rrr/cdk-rewrite-mono-imports)).
- [ ] Reference documentation needs to also support submodules/namespaces and use the submodule's README file.

# Drawbacks

- [ ] In JavaScript/TypeScript code will always be fully qualified
  (`aws_s3.Bucket` instead of `Bucket`) due to limitations of the `import` tool.
- [ ] The size of the single module will be large (~50MiB) which can create issues of using the CDK in non-standard environments such as from a Lambda function.
- [ ] Breaking change

# Rationale and Alternatives

I believe our users think of the AWS CDK as a "standard library" (or a
"framework") and not as another library that they depend on to build their
applications (like the AWS SDK for example). When users create CDK libraries and
apps they don't think of the AWS CDK as yet another library that they use, they
think of the AWS CDK as the foundation of their app.

We can draw the analogy to other standard libraries like the Node.js SDK, the
JDK, the .NET Framework. When users write Node.js libraries or apps they don't "depend" on the Node.js SDK, they actually "peer depend" on it (it is expressed via a special `engines` section in `package.json` but for all intents and purposes it's behaves like a peer dependency).

I would argue that if a vendor publishes a 3rd-party construct library, what they *really* want to say is "I am compatible with CDK >= 1.23.0". Then, the decision about which actual CDK version is being used is left to the app level.

## Alternatives Considered

### Tooling

TODO: we considered building additional tooling (e.g. `cdk install`) that will make hyper-modular peer dependencies sane.

### Meta-package

This approach proposes that we keep the hyper modularity but also ship a meta-package that will either just take a dependency on all modules (like `decdk` is doing today) or also "re-export" all the types.

The main benefit is that it will technically allow the interoperability of the
two modes. Libraries can still take granular peer dependencies while apps will
depend on the meta package.

TODO: we need to check if in JavaScript it is possible to avoid the re-export and only create a module that brings in all the other modules as dependencies. The answer is probably "depends on the package manager". Yarn pre-2.0 for example would hoist all the transitive deps so it would "just work", but post 2.0 they actually disallow that.

# Adoption Strategy

TODO

# Unresolved questions

TODO

# Future Possibilities

TODO

# Appendix

## Peer Dependencies in npm

> Based on a whitepaper by [@rix0rrr](https://github.com/rix0rrr).

Most languages (Java, Python, .NET) only support a single instance of a module
at runtime. This means that if two modules declare that they take a dependency
on a third module, the dependency manager will resolve a common version and
fetch it.

Contrary to most languages, the Node.js ecosystem supports the co-existence of
multiple versions of a module at runtime (since `node_modules` first searched as
a relative path). This is problematic for the CDK case since CDK modules often
expose types from other modules in their API (e.g. an `s3.Bucket` accepts a
`kms.Key` as an option).

The ultimate root cause of the issues we are encountering is a specific feature of the NPM package manager, one that both encourages a package ecosystem that “just works” with minimal maintenance and versioning problems, as well one that significantly simplifies the package manager:

_Packages can appear multiple times in the dependency graph, at different versions._

It simplifies the package manager because the package manager does not have to resolve version conflicts to arrive at a single version that will work across the entire dependency tree, and report a usable error if fails to do so. In the presence of version ranges, this is an open research problem, which NPM conveniently sidesteps.

### The Feature

As an example, a package *tablify* could depend on a package called *leftpad* at version 2.0, while the application using *tablify* could be using *leftpad* at an older and incompatible version 1.0. The following dependency graph is a valid NPM dependency graph:

```
app (1.0)
+-- tablify (1.0)
|   +-- leftpad (2.0)
+-- leftpad (1.0)
```

Loading dependencies is done in NPM by calling  require("leftpad") or import { ... } from "leftpad". If this statement is executed in a source file of *app*, it will load *leftpad@1.0*, and if it is executed in a source file of *tablify* it will load *leftpad@2.0*.

> The feature of multiple package copies that get loaded in a context-sensitive way is not a common one. The only other package manager that I know of that supports this is Rust’s package manager, Cargo. Most other package managers require all packages to occur a single time in the dependency closure. To do so, I believe most employ a conflict resolution mechanism that boils down to “version specification closest to the root wins” (feel free to add counterexamples to an appendix if I got this wrong).
### The Problem

All is well with this strategy of keeping multiple copies of a package in the dependency tree, as long as no types “escape” from the boundary of the package’s mini-closure. In the typical case of *tablify* and *leftpad*, [one can reasonably assume that] all values going in and out of the libraries are types from the standard, shared runtime (in this case *strings*), and the only thing being depended upon is a specific behavior provided by the library.

However, let’s say that *leftpad* contains a class called Paddable that *tablify* accepts in its public interface, and that the interface of the class had undergone a breaking change between version 1 and 2 (in JavaScript):

```ts
// --------------- leftpad 2.0 ---------------------------
class Paddable {
  constructor(s) { ... }
  padLeft(n) { ... } 
}
// --------------- tablify 1.0 ---------------------------
// Expected: Array<Array<Paddable>>
function tablify(rows) {
  return rows.map(row => row.map(cell => cell.padLeft(10));
}
// --------------- leftpad 1.0 ---------------------------
class Paddable {
  constructor(s) { ... }
  
  // Oops, forgot to camelCase, rectified in version 2.0
  padleft(n) { ... } 
}
// --------------- app 1.0 ---------------------------
import { Paddable } from 'leftpad';
import { tablify } from 'tablify';
const p = new Paddable('text');
tablify([[p]]);
```
In this code sample, a *Paddable@1* gets constructed and passed to a function which expects to be able to use it as a *Paddable@2*, and the code explodes. 
Every individual package here was locally correct, but the combination of package versions didn’t work.
### TypeScript to the rescue
The CDK uses TypeScript, and the TypeScript compiler actually protects against this issue. If we actually typed the *tablify* function as
```ts
import { Paddable } from 'leftpad';
function tablify(rows:* *Array<Array<Paddable>>) { 
  ...
}
```
The TypeScript compiler would correctly resolve that type to Array<Array<Paddable@2>>, and refuse to compile the calling of *tablify* with an argument of type Array<Array<Paddable@1>>, because of the detected incompatibility between the types.
_TypeScript will refuse to compile if types of multiple copies of a package are mixed(*)._
> (*) This is true for classes, where it will do nominal typing. For interfaces, TypeScript will do structural typing, which means any object that has members matching an interface definition is considered to implement that interface, whether it has been declared to implement it or not, and so a class from one copy of a library may be considered to implement an interface from a different copy.
Here is an example for a compiler error caused by a dependency mix:
```
Unable to compile TypeScript: bin/app.ts(10,36): error TS2345:
Argument of type 'import("node_modules/@aws-cdk/core/lib/app").App' is not assignable to parameter of type 'import("node_modules/my-module/node_modules/@aws-cdk/core/lib/app").App'. 
Types have separate declarations of a private property '_assembly'.
```
### Implications on CDK
This situation arises the following use cases:
* User wants to use an older version than the latest published one (rollback).
* User is using a 3rd-party construct library.
Let’s look at these in turn.
#### User wants to use an old version
The first one, colloquially called “rollback” is easy to understand and seemingly has a simple solution, so let’s look at it first. This situation comes up when the user is in one of 2 situations:
* CDK team has just (accidentally) released a buggy version and they want to roll back to an older version.
* CDK team has just released a breaking change (valid in experimental modules) and the user is not prepared to invest the effort yet to migrate, so they want to stay at an older version.
For an example, let’s say CDK has just released version *1.13.0* but the user wants to stay at *1.12.0*. The only way they have to achieve this is to control the versions in their own app’s *package.json*, so they write:
```json
"dependencies": {
  "@aws-cdk/aws-ecs": "1.12.0",
  "@aws-cdk/core": "1.12.0",
}
```
The lack of a caret makes it a fixed version, indicating they really want *1.12.0* and not “at least *1.12.0*” (which would resolve to *1.13.0* in this situation). However, because of the transitive caret dependency the complete dependency graph would look like this:
```
app@1.0.0      -> aws-ecs==1.12.0, core==1.12.0
aws-ecs@1.12.0 -> core^1.12.0
=== { core@1.13.0 is available } ===> 
app
+-- core@1.12.0
+-- aws-ecs@1.12.0
    +-- core@1.13.0
```
The dependency tree ends up with 2 versions of *core* in it, and we end up in a broken state.
THE OBVIOUS SOLUTION to this is to get rid of the transitive caret dependency, and make intra-CDK dependencies fixed version (*==1.12.0, ==1.13.0, etc*).. This puts all control over the specific version that gets pulled in in the hands of the user:
```
app@1.0.0      -> aws-ecs==1.12.0, core==1.12.0
aws-ecs@1.12.0 -> core==1.12.0
=== { core@1.13.0 is available, but not selected }===> 
app
+-- core@1.12.0
+-- aws-ecs@1.12.0
```
This works fine for the CDK, but breaks in the face of 3rd party construct
libraries that still use a caret dependency (see the next section).
#### User is using 3rd party construct library
The previously discussed solution works fine for first-party libraries, because
they are all authored, versioned, tested and released together.
One of the stated goals of the CDK however is to foster an ecosystem of 3rd
party construct libraries. These construct libraries are going to depend on the
1st party CDK packages the same way the packages depend on each other, and so
they run into the same issues:
* If a 3rd-party library uses a caret dependency, then effectively all consumers
  of the package are forced to always be on the latest CDK version (or the
  dependency tree will end up in a broken state).
* If a 3rd-party library uses a fixed version dependency on CDK then:
    * The consumer must use the same fixed version dependency on CDK, because if
      they use a caret dependency the tree will end up in a broken state.
    * The 3rd-party library author is forced to release an update every time the
      CDK releases an update (which is every week, or even more often). The
      users of the 3rd party library will not be able to migrate to the new CDK
      version until the author does so.
These conditions will make it exceedingly onerous to maintain or consume a 3rd
party library, requiring manual action every week for authors or be locked into
old versions for consumers if and when authors fail to update. 
_If library writing is not a “pit of success” condition, I don’t see how any 3rd
party library ecosystem will ever evolve._
Given that according to this analysis, 3rd party library authors should neither
use caret dependencies nor fixed version dependencies, the only remaining
conclusion is that they shouldn’t use dependencies at all.