# The `jsii` compiler (and `jsii-rosetta`) to follow TypeScript versioning

* **Original Author(s)**: @RomainMuller
* **Tracking Issue**: #374

This RFC proposes to change the versioning scheme of the `jsii` compiler and
`jsii-rosetta` to stop conforming to [semantic versioning][semver], and instead
use the `major.minor` version of the [TypeScript] compiler it is built on.

Other packages (such as `jsii-pacmak`, `@jsii/spec`, ...) are not affected by
this proposal and will continue to conform to [semantic versioning][semver].

## Working Backwards

### Release Notes entry

```md
Starting with this release, the `jsii` compiler and `jsii-rosetta` will no
longer conform to [semantic versioning][semver]. Instead, its `major.minor`
version will match that of the [TypeScript] compiler it uses (the [TypeScript]
compiler does not conform to [semantic versioning][semver]). New features will
only be introduced on the `jsii` release line that targets the latest
[TypeScript] compiler.

Users may need to modify they code when upgrading from one `major.minor` release
line to another (addressing [TypeScript] language evolutions and `jsii` feature
evolutions). While upgrading to the latest release line of `jsii` helps minimize
the effort required for these updates, the release strategy allows developers to
do so on their own schedule.

This change is made to allow developers to benefit from the latest and greatest
features of the [TypeScript] language without requiring the entire ecosystem to
make the switch at the same time.

Other packages in the jsii toolchain (such as `jsii-pacmak`, `@jsii/spec`, and
others) are not affected by this change and will continue to follow [semantic
versioning][semver] as they currently do.

BREAKING CHANGE: In order to allow developers to use the latest & greatest
features of TypeScript, the `jsii` compiler and `jsii-rosetta` no longer follow
semantic versioning. Instead, releases are made in-line with those of the
`typescript` compiler, which does not follow semantic versioning. We recommend
you upgrade your `devDependency` on `jsii` to use a tilde range (e.g: `~4.7.0`)
to be able to control when you migrate to future [TypeScript] language versions.
```

### `README.md` for the `jsii` compiler

````md
In order to allow developers to access and leverage the latest and greatest of
*TypeScript* language features, `jsii` compiler releases follow the `typescript`
package releases. For example, `jsii` version `4.3.x` is built on top of version
`4.3.x` of the `typescript` compiler.

> IMPORTANT: The `typescript` package does not follow semantic versioning.
> Minor releases of the `typescript` compiler almost always include syntax
> breaking changes together with new language features. Since `jsii` releases in
> line with `typescript` minor lines, `jsii` does not adhere to semantic
> versioning either.

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
    "jsii": "~4.7.0",
    // ...
  },
  // ...
}
```
````

### `README.md` for the `jsii-rosetta` package

````md
In order to allow developers to access and leverage the latest and greatest of
*TypeScript* language features, `jsii-rosetta` releases follow the `typescript`
package releases. For example, `jsii-rosetta` version `4.3.x` is built on top of
version `4.3.x` of the `typescript` compiler.

> IMPORTANT: The `typescript` package does not follow semantic versioning.
> Minor releases of the `typescript` compiler almost always include syntax
> breaking changes together with new language features. Since `jsii-rosetta`
> releases in line with `typescript` minor lines, `jsii-rosetta` does not adhere
> to semantic versioning either.

The `jsii-rosetta` release notes for the initial release on each new
*major.minor* line will include a link to the corresponding TypeScript release
notes entry, and a description of any `jsii` breaking changes that may have been
introduced with the release.

When using `jsii-rosetta` in a project, we recommend pinning the dependency on
`jsii-rosetta` to the desired minor version line (which corresponds to the
`typescript` release line), using a `~` SemVer range:

```js
{
  // ...
  "devDependencies": {
    // ...
    "jsii-rosetta": "~4.7.0",
    // ...
  },
  // ...
}
```
````

## Public FAQ

> This section should include answers to questions readers will likely ask about
> this release. Similar to the "working backwards", this section should be
> written in a language as if the feature is now released.
>
> The template includes a some common questions, feel free to add any questions
> that might be relevant to this feature or omit questions that you feel are not
> applicable.

### What are we launching today?

We are announcing a change in versioning strategy for the `jsii` compiler and
`jsii-rosetta`. Starting today, new releases of the `jsii` and `jsii-rosetta`
packages will use the same `major.minor` version as the [TypeScript] compiler
they are built on. Other packages in the jsii toolchain (`jsii-pacmak`,
`@jsii/spec`, ...) are unaffected by this change.

Since the [TypeScript] compiler does not conform to [SemVer], future releases of
the `jsii` compiler will not conform to [SemVer] either. In line with the
[TypeScript] compiler versioning scheme, breaking changes may be introduced in
any new release that updates the `major` or `minor` version, but **not** when
only the `patch` level changed.

This change enables `jsii` users to benefit from the latest and greatest
features introduced in the [TypeScript] language as well as from performance
improvements and bug fixes introduced in recent versions of [TypeScript],
without requiring the entire ecosystem to update compiler versions at the same
time.

### Why should I use this feature?

The new `jsii` versioning strategy gives developers more control over the
[TypeScript] language version they are developing, without forcing an update
schedule on them.

Developers are free to decide when it is appropriate for them to upgrade their
`jsii` dependency to a new `major.minor` version line, bringing in new
[TypeScript] language features as well as performance improvements and bug
fixes.

### Do I need to use the same `jsii` version as my dependencies?

The `jsii` compiler makes the due dilligence to ensure the artifacts produced
(in particular, the `.d.ts` declarations files and the `.jsii` assemblies)
remain compatible with previous versions, so that consumers of libraries need
not update at the same time as their dependencies.

### What happens to `jsii` v1?

Version `1.0.0` of the `jsii` compiler was released over two years ago (in
February 2020), and will transition to the *Maintenance* tier of the
[AWS SDKs and Tools maintenance policy][aws-policy] 6 months after this release.

During this initial 6 months period, `jsii` will continue to receive full
support, including bug fixes and feature support, as it has in the past two
years.

Once it enters the *Maintenance* tier, it will only receive fixes for critical
bugs and security issues. The `v1` release line will remain in *Maintenace* for
12 months, after which it will transition into the *End-of-Life* tier.

### What is the support policy for these new releases?

Starting with release `4.7.0`, new features will only be added to the *current*
release line (the *latest* `major.minor` stream), which corresponds to the
currently active [TypeScript] release line.

Critical bug fixes and security patches will be provided for previous release
lines for 12 months, which covers 3 or 4 previous lines. Features will not be
back-ported to non-current release lines.

Previous release lines will be considered *end-of-life* 12 months after they
were superceded by a new *current* line.

## Internal FAQ

### How will we maintain backwards compatibility?

The change only affects the [TypeScript] compiler version used internally by the
`jsii` compiler and the versioning scheme for the `jsii` package itself.

The compiler will continue to emit `.jsii` assemblies that conform to the schema
defined in the `@jsii/spec` package, which will hence continue to be compatible
with all other tools part of the jsii toolchain (including `jsii-pacmak`, ...).

In order to maximize compatibility between [TypeScript] compiler versions, and
since [TypeScript] occasionally introduces backwards-incompatible syntax changes
(additions, modifications) to the declarations files (`.d.ts`), the `jsii`
compiler will proactively produce down-leveled declarations files targeting
[TypeScript] compiler versions used by previous (not yet *end-of-life*) releases
of `jsii`. This can be achieved using the [`downlevel-dts`][downlevel-dts]
utility. Failure to do so may make it impossible to use a library compiled with
a given release of `jsii` in a project that is still using an older release,
which would be akin to forcing dependents to upgrade at the same pace as their
dependencies (which is undersiable).

### Why are we doing this?

Before this change, `jsii` users had been stuck with [TypeScript] `3.9` for a
very long time, due to the introduction of several breaking changes in the
language specification: upgrading the [TypeScript] compiler that `jsii` builds
on would cause existing code to break.

In order to allow each package author to decide for themselves without hinging
on their dependencies' choices, or influencing their dependents, we are making
it possible for every developer to decide when they want to migrate to a new
version of the [TypeScript] language, by following [TypeScript]'s versioning for
the compiler, and continuing to perform coordinated releases of every other
package in the toolchain (those are unaffected by this change).

The `jsii-rosetta` package also internally uses the [TypeScript] compiler that
needs to be compatible with the [TypeScript] language level used by the project.
Developers hence need to also be able to control which [TypeScript] version is
being used by `jsii-rosetta` if they want to use this.

Using the same `major.minor` version as the [TypeScript] compiler makes it easy
for developers to identify which [TypeScript] language features are available to
them or not. As the [TypeScript] compiler does not conform to [semantic
versioning][semver], this implies `jsii` and `jsii-rosetta` also need to stop
conforming to it.

### Why should we _not_ do this?

[Semantic versioning][semver] is the dominant versioning scheme in the
JavaScript world, and diverging from it might break assumptions customers make
when consuming packages from [npm](npmjs.com).

Following [TypeScript] versions means releasing new `major.minor` releases (that
may include breaking changes) more often than is currently done (the
[TypeScript] maintainers typically declare a new `major.minor` line four
times per year: in February, May, August and November respectively). This is a
lot more release lines than other AWS products offer, and it would not be
reasonable to uphold the [AWS SDKs and Tools maintenance policy][aws-policy],
as it requires offering full support (features and bug fixes) for "Generally
Available" releases for a minimum of 24 months (this would require providing
full support for 8 different releases, and back-porting automation is likely to
be difficult due to the amount of breaking changes in the [TypeScript] compiler
API between releases). Diverging from this [policy][aws-policy] is a significant
change that customers may not expect.

### What is the technical solution (design) of this feature?

The proposed delivery plan for this feature is as follows:

* Communicate about the upcoming change in new releases on the `v1` release
  line, including a planned timeline for the initial release of the `v4.7` line,
  and language about the departure from [SemVer].

* **Optional:** Separate the `jsii` compiler from the rest of packages in the
  jsii toolchain into separate repositories. This would make it easier to
  release the `jsii` compiler separately from other parts of the toolchain that
  follow a different versioning scheme.

  - Move other packages to a new mono-repository (or to several new individual
    package repositories), e.g: `github.com/aws/jsii-toolchain`.

  - Make the `github.com/aws/jsii` repository by a single-package repository.

* Update the *release* automation to use the [TypeScript] compiler version's
  `major.minor` level, and only update the `patch` level on new releases.

* Upgrade the [TypeScript] compiler internally used by `jsii` to the current
  `latest` release of the `typescript` package.

* Make the `jsii` compiler transparently prepare down-leveled declarations files
  to ensure backwards-compatibility of compiler outputs with previous releases
  of `jsii`. This can be done using the [`downlevel-dts`][downlevel-dts] package
  to produce declarations files compatible with [TypeScript] `3.9`, and adding
  a `typesVersions` key to the `package.json` file of packages.

  - See proof-of-concept: [`aws/jsii#3501`][aws/jsii-3501]

* Release the initial `jsii` release on the `4.7` line (for practical reasons,
  we will disregard [TypeScript] releases between `3.9` and the _current_
  version when this proposal is implemented, which at time of writing is `4.7`).

* Formally announce that the `v1` release line of `jsii` will move into the
  *Maintenance* tier of the [AWS SDKs and Tools maintenance policy][aws-policy]
  in 6 months, and explain the policy that is applicable to newer releases.

* **6 months later:** Formally announce that the `v1` release line of `jsii` is
  entering the *Maintenance* tier of the [AWS SDKs and Tools maintenance
  policy][aws-policy], and will continue to receive critical bug and security
  fixes for 12 months before transitioning to *end-of-life*, and repeat the
  maintenance policy that new releases will benefit from.

* **12 months later:** Formally announce that the `v1` release line of `jsii` is
  transitioning to *end-of-life* and will no longer receive any updates. Repeat
  the maintenance policy that is applicable to newer releases.

### Is this a breaking change?

This is not a breaking change in the traditional sense, however this is a
significant change in versioning schemes used for the `jsii` compiler, and a
departure from the [AWS SDKs and Tools maintenance policy][aws-policy].

As such, this warrants ample communication with our customer base to avoid they
are caught by surprise, or have broken expectations.

### What alternative solutions did you consider?

#### Bring-your-own TypeScript version

One of the main rationales for this change is to enable the use of new
TypeScript releases without forcing the enitre package ecosystem to make the
change at the same time (due to language-breaking changes).

An option to address this would be to allow customers to "bring their own"
TypeScript compiler, by making it a `peerDependency`. This however comes with
a significant challenge: the TypeScript compiler API is not stable between
TypeScript releases. Addressing this would require maintaining an adapter layer
for each supported version of the TypeScript compiler, and this would require
tremendous efforts, in particular as there appears to be no way in TypeScript
to re-export a `namespace` including all the type declarations it contains, as
`typeof ts` (assuming `ts` is the TypeScript compiler namespace) only represents
entities with a run-time value, and none of the interfaces it contains. The
consequence of this is that writing an adapter for a particular [TypeScript]
version requires wrapping all useful functions of the compiler API and
re-delcaring the types they use, which represents hundreds if not thousands of
lines of code for each supported version.

#### Only de-couple the `jsii` package version, but stick with [SemVer]

It would technically be possible to de-couple the `jsii` package from the rest
of the toolchain's versioning, and to issue a new `jsii` major version each time
we update the [TypeScript] compiler it internally uses. This would however make
it difficult for customers to understand the relationship between `jsii` major
releases and the [TypeScript] language level they support.

Using the same version number prefix (`major.minor`) as the [TypeScript]
compiler makes the relationship clear and removes the need to maintain separate
documentation for customers to understand what they are upgrading to.

#### Release a different package for each supported [TypeScript] version

The release model used by `cdk8s-plus` involves releasing a different package
for each version of the underlying resources (e.g: `cdk8s-plus-22` targets
version 22 of the resources). A similar model could be used for `jsii`, where a
package named `jsii-4.7` could be released for the compiler that builds on
[TypeScript] `4.7.x`.

This release pattern however creates an opportunity for supply-chain attacks as
a malicious party could release `jsii-4.10` ahead of us and possibly exploit
unsuspecting users.

The attack vector can be mitigated by scoping the packages since npm scopes
provide ownership guarantees, which would require releasing
`@jsii/typescript-4.7`. However this approach makes it more difficult for
customers to know when a new release of the compiler is available, since
dependency maintenance automation will only look for new versions of the same
package.

### What are the drawbacks of this solution?

This solution is a stark departure from versioning schemes and maintenance
policies used by AWS on open-source products. It implies offering critical bug
fixes and security updates for up to 5 different release lines (1 current, and
3 to 4 previous), which might require significant effort.

Following the [TypeScript] `major.minor` reduces our ability to introduce
breaking changes to the `jsii` compiler, as these must be timed together with
[TypeScript] `major.minor` release timelines. However, since [TypeScript]
releases a new `major.minor` line 4 times a year, this is not a blocker, but
will require careful planning.

Breaking changes that could be tempting to introduce in new `major.minor`
release lines include:

- Upgrading default severity of some diagnostic messages to `ERROR`
- Adding new compile-time validations
- Dropping support for a recently end-of-life `node` version (this happens once
  or twice a year)
- Dropping support for a particular TypeScript language version (for example,
  [DefinitelyTyped] packages only support TypeScript compilers that are less
  than 2 years old)
- Changing configuration file syntax, format, default values or required entries
- Addressing a security issue that requires breaking existing code

[DefinitelyTyped]: https://github.com/DefinitelyTyped/DefinitelyTyped#support-window

### What is the high-level project plan?

Item                                      | Estimation | Notes
------------------------------------------|------------|--------
Initial communication                     | 1 day      |
**Optional:** Break mono-repository out   | 5 days     |
Have `jsii` down-level `.d.ts`            | 5 days     | [`aws/jsii#3501`][aws/jsii-3501]
Update release automation                 | 2 days     |
Update contributor guide                  | 1 day      |
Update jsii documentation                 | 2 days     |
Update [TypeScript] dependency            | 5 days     |
Initial Release                           | 1 day      |
Update `projen`'s  `JsiiProject` defaults | 1 day      |
Migrate `aws-cdk` to new `jsii` release   | 10 days    | Via a pre-release
Validate ConstructHub support             | 3 days     |
Maintenance Announcement                  | 1 day      |
Move to Maintenance                       | 1 day      |
Move to end-of-life                       | 1 day      |

### Are there any open issues that need to be addressed later?

[semver]: https://semver.org/spec/v2.0.0.html
[TypeScript]: https://www.typescriptlang.org
[aws-policy]: https://docs.aws.amazon.com/sdkref/latest/guide/maint-policy.html
[downlevel-dts]: https://www.npmjs.com/package/downlevel-dts
[aws/jsii-3501]: https://github.com/aws/jsii/pull/3501
