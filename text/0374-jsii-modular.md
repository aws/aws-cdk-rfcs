# Modular jsii

* **Original Author(s)**: @RomainMuller
* **Tracking Issue**: #374
* **API Bar Raiser**: @{BAR_RAISER_USER}

This RFC proposes to unlock (de-couple) the versions of all jsii packages
(i.e: compiler, code generators, runtimes, tools and libraries) in order to
enable introduction of new major versions of any of these packages without
necessarily incurring a new major version of all other packages.

In order to make it easier to operate with de-coupled package versions, this RFC
further proposes we break the [aws/jsii](https://github.com/aws/jsii) mono-repo
into multiple single-package repositories.

## Working Backwards

### Release Notes entry

```md
Future releases of the *jsii* package constellation will no longer follow an
all-at-once version increment strategy. Instead, each individual package will be
released under their own version line. It is hence no longer necessary to ensure
the version of all *jsii* packages in a product's dependency are aligned on the
exact same release. For example, it is now possible to have a dependency on the
`jsii` compiler at `4.3.0` while using `jsii-pacmak` at `1.35.0`, which
previously would have led to a fatal error when executing `jsii-pacmak`.

BREAKING CHANGE: In order to allow developers to use the latest & greatest
features of TypeScript, the `jsii` compiler no longer follows semantic
versioning. Instead, releases are made in-line with those of the `typescript`
compiler, which does not follow semantic versioning. The TypeScript compiler
releases new language features (and often, syntax breaking changes) on each new
*major.minor* release. Future `jsii` releases will share the major and minor
version numbers with the `typescript` release they are built on (e.g: `jsii`
releases in the `4.3.x` line are built on top of series `4.3.x` of the
`typescript` compiler).
```

### `CONTRIBUTING` guides

Each new repository will get a fresh `CONTRIBUTING.md` guide that includes the
following blurb (except for the repository for `@jsii/jsii-spec`):

```md
This package is part of the *jsii* constellation. It is essential for this
package to consistently produce or consume `.jsii` assemblies according to the
specification defined by the [`@jsii/spec` package][@jsii/spec].

[@jsii/spec]: https://github.com/aws/jsii-spec
```

The `CONTRIBUTING.md` guide for the `@jsii/spec` package will have the following
blurb instead:

```md
This package defines the shared interface between each package of the *jsii*
constellation. Changes made to this package must always be backwards compatible:
a new major version of `@jsii/spec` must retain the ability to correctly process
assemblies that were accepted by previous major versions.
```

### `README.md` for the `jsii` compiler

````md
In order to allow developers to access and leverage the latest and greatest of
*TypeScript* language features, `jsii` compiler releases follow the `typescript`
package releases. For example, `jsii` version `4.3.x` is built on top of version
`4.3.x` of the `typescript` compiler.

> IMPORTANT: As `typescript` package does not follow semantic versioning.
> Minor releases of the `typescript` compiler almost always include syntax
> breaking changes together with new language features. Since `jsii` now
> releases in line with `typescript` minor lines, `jsii` no longer adheres to
> semantic versioning.

The `jsii` release notes for the initial release on each new *major.minor* line
will include a link to the corresponding TypeScript release notes entry, and a
description of any `jsii` breaking changes that may have been introduced with
the release.

When setting up a `jsii` project, we recommend pinning the dependency on the
`jsii` compiler to the desired minor version line (which corresponds to the
`typescript` release line), using a `~` SemVer range:

```js
{
  // ...
  "devDependencies": {
    // ...
    "jsii": "~4.3.1",
    // ...
  },
  // ...
}
```
````

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

> This section should include answers to questions readers will likely ask about
> this release. Similar to the "working backwards", this section should be
> written in a language as if the feature is now released.
>
> The template includes a some common questions, feel free to add any questions
> that might be relevant to this feature or omit questions that you feel are not
> applicable.

### What are we launching today?

We are announcing a change in versioning strategy for the *jsii* constellation
of packages, which opens the way for an increased pace of innovation in the
*jsii* ecosystem:

- Each package of the constellation now has it's own, independent version
  number, and only gets a new release when a change was introduced;
- The `jsii` compiler now follows the `typescript`  compiler version number,
  allowing developers to easily leverage improvements in the *TypeScript*
  language and compiler performance;
- The `@jsii/spec` package guarantees all releases of packages in the
  constellation remain inter-operable going forward.

### Why should I use this feature?

The new versioning strategy allows developers to have greater control over the
*jsii* tools they use. It allows developers to benefit from improvements to the
*TypeScript* language (and compiler performance) faster, by allowing them to
upgrade their project on their own timeline - in the same way they would be able
to do for a "pure" *TypeScript* project.

Since all parts of the *jsii* constellation are inter-operable with all major
releases of the *jsii* packages, developers are able to opt into new and
improved code-generation features of `jsii-pacmak` on their own schedule (i.e:
when they release a new major version of their library) without requiring all
their dependencies and dependents use the same version of `jsii-pacmak`.

## Internal FAQ

### Why are we doing this?

We are doing this to reduce the friction involved in making major changes to any
of the *jsii* constellation of packages. This will allow breaking changes to be
introduced in parts of the ecosystem without bumping the major version of the
rest of packages.

This will improve our pace of innovation, as we will hence be able to introduce
a new major version of any part of the ecosystem wihtout necessarily requiring
all downstream consumers to migrate all at once.

For example, this allows the `jsii` compiler to be upgraded to a new release
line of `typescript` without forcing every downstream consumer to also accept
the syntax breaking changes at the same time. Instead, consumers will be free
to take on a new release line of `jsii` independently from their dependencies as
well as from their consumers.

Separating the mono-repository into multiple repositories will help ensure we
maintain backwards compatibility between individual packages, and reduce the
risk of creating codependent packages (different repositories need to be
released independenlty, so dependencies can only flow in an asyclic manner).
This will also make it easier for new contributors to approach *jsii*, as they
will be able to focus strictly on one package, instead of having the entire
constellation in their working set.

### Why should we _not_ do this?

Breaking up the mono-repository into multiple independent repositories will come
at a higher maintenance cost than having a single repository. The act of moving
code around will also require some time to be invested: there are currently
co-dependent relationships between certain packages (`jsii-pacmak` has a local
develooment dependency on the runtimes, and on the `jsii-calc` packages, etc...)
that will need to be broken. Additionally, some checks currently enforce that
all tools used to work on an assembly are on the same version line, which will
no longer be the case.

### What is the technical solution (design) of this feature?

The first component of implementing this RFC is to migrate code for various
tools and libraries to their own repository:

- `@jsii/spec` and `jsii-reflect` (those can be combined as they have similar
  purpose)
- `jsii`
- `jsii-pacmak`
- `jsii-rosetta`
- `@jsii/kernel` and `@jsii/runtime` (which could be combined into a single
  package)
- Each individual `@jsii/*-runtime` package (and related tests)

Those new repositories could be created within the `aws` GitHub organization, or
alternatively a new organization could be created (the `jsii` name is already in
use as a GitHub organization).

The second component of this RFC is changing the release strategy for the `jsii`
compiler so that it follows `typescript` version lines (`major.minor`), and
ensuring other downstream consumers of `.jsii` assemblies do not attempt to
enforce version consistency using the `jsiiVersion` field.

### Is this a breaking change?

This is not a breaking change in the traditional sense: all existing code will
continue to work with the current release lines of all packages in the
ecosystem. However, the new versioning strategy of `jsii` is a departure from
Semantic Versioning, which will be accompanied with a major version change (from
`1.x` to `4.3.x` - matching the current `typescript` release line). This is to
be noted in the release ntoes.

### What alternative solutions did you consider?

An alternative to de-coupled versioning is to time breaking changes in the
*jsii* constellation with new major releases of the root consumer libraries
(`constructs`, `aws-cdk-lib`, ...), however this forgets to account for the
existence of other consumers of *jsii* which do not depend on these libraries,
and may hence not have the same drive to release a new major version at that
time. Additionally, such major releases are expected to be infrequent as they
represent a major burden on the community, meaning our ability to release
improvements to *jsii* packages would be severely limited.

It would also be possible to unlock versions in the mono-repository, in order to
allow each packages to include breaking changes when necessary. However, this
makes it all too easy to inadvertently break backwards compatibility, as it is
so tempting to introduce the fix for a breaking change in the same PR as the
breaking change itself. Using several repositories makes this much less likely.

### What are the drawbacks of this solution?

This solution will increase the number of repositories that have to be monitored
for issues and feature requests, as well as for new contributions from members
of the community.

It might also make the project as a whole more difficult to navigate, as it will
be spread over multiple packages, instead of being in a centralized location.

### What is the high-level project plan?

1. Determine the new repository naming scheme (which GitHub organization do we
   use to host the repositories, what is the exact partition plan)
1. Extract the code for the `jsii` compiler, and start releasing with a
   `major.minor` matching those of the underlying `typescript` release
1. Extract the code for the `jsii-pacmak` tool
1. Extract the code for the `@jsii/runtime` and `@jsii/kernel` packages
1. Extract the code for each `@jsii/*-runtime` package
1. Extract the remaining tools

### Are there any open issues that need to be addressed later?

- What GitHub organzaition or naming scheme will be used for these?
