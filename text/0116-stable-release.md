---
feature name: stable-release
start date: 2020-06-24
rfc pr: 
related issue: #116
---

# Summary

Releasing a build of the CDK that contains only stable APIs.

> This document is very much a work in progress. My thoughts haven't completely solidified yet. This document is based on an intuition -- this attempt at writing the intuition down convincingly is what is driving the design 🤓

# README

For users that want to be sure they are only depending on stable APIs, and want to be able to upgrade their CDK dependencies fearlessly, we are releasing a version of the CDK that only contains stable APIs.

It is now *impossible* to accidentally depend on an experimental API.

# Motivation

The CDK contains both stable and experimental APIs (in this discussion, an API is a class, interface, property, method, or a method argument) The experimental APIs are important to the continued evolution of the CDK, and allows us to offer features to users early and gather design feedback.

For an example of how effective this phase of the API lifecycle can be, just look at CDK's public beta period. For more than a year, CDK was available to users but the developers were free to change the APIs as they discovered usage patterns and limitations. When CDK finally stabilized, it had become noticeably better than if we were forced to commit to the initial APIs directly.

At the same time, the presence of experimental APIs poses a problem to users. They may not be aware that an API they are using is experimental, and are subsequently frustrated when the API changes in a new release and their code stops working.

The problem is one of communcation. In fact, a good initial pass at improving the situation for users could be to clearly mark experimental APIs as such. Where do we put such a communcation though? In the docs? If so, what would prompt a user to go look up the stability of their API? Potentially in the docstrings would be a better location, but not all IDEs show the docstrings by default, and there is still the risk of user oversight.

Entirely in the spirit the CDK, can we do one better using tool support? Can we find a technological solution so that using experimental APIs cannot be accidental but becomes a conscious action, and users are not blindsided by it?

# Opt-in or opt-out?

This plan was originally framed as an "experimental build", but in this RFC is framed as a "stable build". 

Those are just two sides of the same coin, and the framing only represents the difference from the default, and a part of the rollout plan.

As we are introducing this, whatever the current major release of the CDK is, it will still contain experimental APIs. Since we cannot break backwards compatibility within the major release, the "additive" feature of this release will have to be a **stable** build that omits the experimental APIs, effectively making the feature opt-out.

At the next major CDK release version, we can switch the roles of the builds. The stable build can become the default and the **experimental** build comes the additional release, so that using experimental APIs becomes an opt-in for users (which is the more desirable end situation).

Nevertheless, in this RFC we will continue to call it the **stable build** (since from the technical point of view that is the build that needs additional processing done to produce it).

# Requirements

1. The solution needs to work for all languages CDK is targeting. Those are:
   * TypeScript
   * JavaScript
   * Java
   * C#
   * Python
2. It should be possible to add experimental APIs (methods, properties, arguments) into stable APIs.
3. People using the stable build should be able to switch to the experimental features (if they need them) without too much work.
4. Conversely, if an experimental feature is stabilized, people using the experimental feature should not have to update their code at all. That is, API signatures should only change because there are actual changes done to them, not because of process/paperwork.
5. Stable APIs should be allowed to depend on experimental APIs for their implementation. "Experimental" does *not* mean "not production quality", it means "production quality but the signature may change". 
6. A CDK user should be able to use two construct libraries A and B at the same time, even if one depends on the stable CDK build and another depends on the experimental build.

# The obvious alternatives

#### Separate modules

The first obvious solution is to put experimental APIs in a separate module from stable ones. 

Let's say we have: 

```
cdk-stable          Stable APIs only
cdk-experimental    Experimental APIs only
```

Doing this would violate requirements (2), (4) and (5). A class can only live in one package, so it won't be possible to have mixed experimental and stable APIs in a single class. Stabilization would mean the class would have to move. `cdk-stable` would not be able to use anything from `cdk-experimental` as presumable experimental would already depend on stable for types.

#### Static Annotations

Another obvious alternative would be to mark APIs in some way so that IDEs and compilers can tell you when you are using experimental. Obviously this requires the presence of an IDE and/or compiler in the first place, and so won't be applicable to all languages, so that already makes this a weak contender.

Language support for triggering warnings on API usage:

* TypeScript: as far as I can tell, no support in TSC. We could build an eslint plugin, but that requires all consumers to use eslint to be effective.
* JavaScript: no compiler. We could build an eslint plugin, but that requires all consumers to use eslint to be effective.
* Java: nothing standardized, but we can define our own annotation and provide an annotation processor to do what we need.
* C#: same as Java.
* Python: no support at all, not even in MyPy.

#### Dynamic Annotations

Instead of static annotations with tool support, we could have the jsii kernel emit warnings when experimental APIs are being used, unless silenced using a config file.

This would require running TypeScript and JavaScript calls through the jsii kernel as well, though.

# Basic Idea

We automatically generate two build flavors from every CDK release.

* One with all APIs
* One with experimental APIs removed from the public API signature (the stable build).

By picking one build or the other, users can decide to restrict themselves to the stable API surface or include experimental APIs.

This would manifest itself differently for every language:

* TypeScript: we remove non-stable APIs from the emitted .d.ts files, TSC will error if they are used.
* JavaScript: there is IDE support for looking at .d.ts files for autocomplete hints (at least VSCode comes with this and random blog posts suggest that more IDEs support this), so the IDE will not suggest experimental members in its autocomplete. That's the best we can do, there will be no actual error and trying to access experimental members will just succeed.
* Java/C#/Python: jsii can choose to not generate proxies for the experimental APIs, and trying to use them will result in a compile-time failure (Java/C#) or a runtime failure (Python).

# Detailed Design

The big question is how we are going to package and distribute the two builds so that the requirements mentioned above are still satisfied.

```
┌─────────────────────────────────────────────────────────────────────┐
│                             IN PROGRESS                             │
└─────────────────────────────────────────────────────────────────────┘
```

This is where the "RFC" part of RFC comes in! I actually have no recommendation/final design yet!

This doc is in progress, and I'm reasoning through the various design options live! 

## Constraints

Some constraints that restrict the solution we can pick, that have been on my mind and I need to write down. They may or may not impact the final solution, but I need to see them written out before I can evaluate that :).

#### There is no such thing as logical dependencies in NPM-land.

In NPM, only concrete dependencies exist. That is, if a class or type is being referenced via:

```
import { Stack } from '@aws-cdk/core';
```

There is literally NO WAY for any other package than the literal NPM package `@aws-cdk/core` to provide that `Stack` class. Any other package will not have the correct name, and so will not lead to the correct `node_modules` structure so that this import will work as written. In particular, there is no way for example to specify a dependency `"@aws-cdk/core-stable"` and still have NPM create the `node_modules/@aws-cdk/core` directory on disk that Node.js expects to find.

In contrast, in a language like Java, a class is used as:

```
import software.amazon.awscdk.core.Stack;
```

And this logical class reference can be satisfied by any concrete package, whether it be `software.amazon.awscdk:core-stable` or `software.amazon.awscdk:core-experimental`.

**NOTE**: NPM 6.9.0 has added support for [package aliases](https://github.com/npm/rfcs/blob/latest/implemented/0001-package-aliases.md) which makes it possible to do this. This *might* be sufficient, althoug the RFC states that this will only apply one level deep. This probably means that if you `npm install @aws-cdk/core@npm:@aws-cdk/core-stable` and you have a dependency that transitively peerDepends on `@aws-cdk/core-experimental`, NPM will probably warn that the peerDependency is not satisfied.

## Language-specific end states

The toughest requirement to tackle is probably (6): being able to combine packages that depend on stable and experimental CDK versions in a single closure tree. Let's agree on an example setup to facilitate talking about this situation.

* **app** is our application
  * **app**'s developer just wants to do their day job and doesn't have time to keep up with the CDK ecosystem, and so she wants to use only stable APIs, provided by a conceptual **cdk-stable** package.
* **app** uses **tps-reports**, which also depends on **cdk-stable**.
* **app** also uses **fnc.io**
  * **fnc.io** in turn uses experimental CDK APIs (a dependency on **cdk-experimental**), because its developer likes living on the cutting edge and doesn't mind updating her source code every week.

*Crucially*, at runtime, **fnc.io** will need to be able to call functions that the developer of **app** does not have access to.

> For jsii languages, it shouldn't matter whether **tps-reports** and **fnc.io** are written in the target language or in jsii. The case where the libraries are written in non-jsii languages is the most restrictive though, so if we can make it work for that case, the other one will definitely also work.

#### Java (Maven)

[Maven scopes](https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html#Dependency_Scope) allow us to separate runtime and compile-time dependencies, so that we can use the **cdk-experimental** package at runtime, while only using the **cdk-stable** package at compile time.

The POMs of the respective packages will look like this:

```
app's pom.xml
    <dependency>
      <artifactId>cdk-stable</artifactId>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <artifactId>cdk-experimental</artifactId>
      <scope>runtime</scope>
    </dependency>

tps-report's pom.xml
    <dependency>
      <artifactId>cdk-stable</artifactId>
      <scope>provided</scope>
    </dependency>

fnc.io's pom.xml
    <dependency>
      <artifactId>cdk-experimental</artifactId>
      <scope>provided</scope>
    </dependency>
```

#### C# (NuGet) -- NEED HELP WITH THIS SECTION

In .NET, [reference assemblies](https://docs.microsoft.com/en-us/dotnet/standard/assembly/reference-assemblies) describe an assembly's surface area without containing its implementation.

A reference assembly containing only the stable APIs, and a runtime assembly containing the full API surface seem like they would do the trick.

I don't know enough about C# and NuGet to say how this would work in practice though. 

#### Python (pip)

Python has no compilation step, so there is no way to specify different packages between compilation and runtime.

TBW.

#### TypeScript/JavaScript (npm)

TBW.

# Drawbacks

Code samples people find on the internet may not work. 

We need 2 different API docsets, clearly distinguished.

Doesn't help Python/JavaScript users.



> Why should we _not_ do this? Please consider:
>
> - implementation cost, both in term of code size and complexity
> - whether the proposed feature can be implemented in user space
> - the impact on teaching people how to use CDK
> - integration of this feature with other existing and planned features
> - cost of migrating existing CDK applications (is it a breaking change?)
>
> There are tradeoffs to choosing any path. Attempt to identify them here.

# Rationale and Alternatives

> - Why is this design the best in the space of possible designs?
> - What other designs have been considered and what is the rationale for not
>   choosing them?
> - What is the impact of not doing this?

# Adoption Strategy

> If we implement this proposal, how will existing CDK developers adopt it? Is
> this a breaking change? How can we assist in adoption?

# Unresolved questions

> - What parts of the design do you expect to resolve through the RFC process
>   before this gets merged?
> - What parts of the design do you expect to resolve through the implementation
>   of this feature before stabilization?
> - What related issues do you consider out of scope for this RFC that could be
>   addressed in the future independently of the solution that comes out of this
>   RFC?

# Future Possibilities

> Think about what the natural extension and evolution of your proposal would be
> and how it would affect CDK as whole. Try to use this section as a tool to more
> fully consider all possible interactions with the project and ecosystem in your
> proposal. Also consider how this fits into the roadmap for the project.
>
> This is a good place to "dump ideas", if they are out of scope for the RFC you
> are writing but are otherwise related.
>
> If you have tried and cannot think of any future possibilities, you may simply
> state that you cannot think of anything.

# Implementation Plan

INTENTIONALLY LEFT BLANK: an implementation plan will be added when the RFC is
scheduled for implementation.

> The implementation plan should analyze all the tasks needed in order to
> implement this RFC, and the planned order of implementation based on
> dependencies and analysis of the critical path.
>
> Either add the plan here or add link which references a separate document
> and/or a GitHub Project Board (and reference it here) which manages the
> execution of your plan.
