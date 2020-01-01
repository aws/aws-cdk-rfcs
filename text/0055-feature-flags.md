---
feature name: feature-flags start date: rfc pr:
https://github.com/aws/aws-cdk/pull/5017 related issue:
https://github.com/awslabs/aws-cdk-rfcs/issues/55
---

# Summary

Feature flags will allow us to introduce new breaking behavior which is disabled
by default (so existing projects will not be affected) but enabled automatically
for new projects created through `cdk init`.

# Motivation

Sometimes (hopefully rarely) we want to introduce new breaking behavior because
we believe this is the correct default behavior for the CDK. The problem, of
course, is that breaking changes are only allowed in major versions and those
are rare.

# Basic Example

For example, the AWS CDK had a bug
([#4925](https://github.com/aws/aws-cdk/pull/4925)) where it was impossible to
use the same physical stack name for multiple stacks, even if they were
targeting different regions despite the fact that this is technically possible
(and sometimes desired).

If multiple stacks can have the same physical name, we need another way to
identify stacks uniquely (e.g. when selecting stacks in various CLI commands
like `cdk deploy X`). To that end, we introduced the concept of an **artifact
ID**. In most cases, artifact IDs will be the same as stack names, so the common
behavior will stay the same. However, in some cases, the current behavior would
break.

If we introduced this fix without a feature flag, it means that current users
may break. Therefore, we introduced this feature under a feature flag named
`@aws-cdk/core:enableStackNameDuplicates`.

This feature is disabled by default, which means that the behavior for existing
projects would remain the same (along with the limitation of course), but new
projects would have the flag automatically enabled in their `cdk.json` file.

# Approach

The basic idea is that new breaking behavior will always be disabled by default
and only enabled when a certain CDK context parameter is set. If not enabled,
the system will continue to behave exactly like it used to without breaking any
existing projects.

When we release a new major version of the AWS CDK, we will flip this behavior
or completely remove the legacy behavior.

In order for new projects to pick up this new behavior automatically, we will
modify `cdk init` to inject the set of feature flags into the generated
`cdk.json` file. This means that the new project will have the latest behavior,
but projects that were created prior to the introduction of this feature will
have the same legacy behavior based on the set of capabilities that were
available at the time of the project's creation. This list will be cleaned up
every time we release a major version of course.

Using fine-grained flags will allow users of old projects to pick up specific
new behaviors by manually adding the specific keys to their `cdk.json` file,
without risking breakage in other unexpected areas.

# Detailed Design


Context keys for feature flags will be listed in `cx-api/lib/features.ts` and
will take the form: `<module>:<feature>`. 

For example:

- `@aws-cdk/core:enableStackNameDuplicates`
- `@aws-cdk/aws-cloudformation:doNotCapitalizeCustomResourcePropertyNames`.

Using the module name will allow easy tracing of the code that consumes this
flag.

The configuration for which feature flags should be enabled for new projects
will be under `cx-api/lib/future.ts` and will be encoded as a simple context
hash that will be injected by `cdk init` to all `cdk.json` files generated for
new projects.

We will mandate that when a feature or bug fix is introduced under a feature
flag, the CHANGELOG will include:

- The suffix `(under feature flag)` in the title.
- A `BREAKING CHANGES` paragraph will be added which describes the *new*
  behavior but disclaims that it will only apply to new projects created through
  `cdk init`. It will also indicate the context key this flag uses for users who
  wish to enable it manually in their project.

Since feature flags can have implications on framework behavior, we need to ask
users to include the list of enabled features in bug reports. At a minimum, we
can request that they paste a copy of their `cdk.json` and `cdk.context.json`,
but a better experience would be to include this information in the output of
`cdk doctor` and request users to include this output in bug reports.

# Drawbacks

There are a few concerns this capability raises. These concerns are mostly
emphasized in the situation where we have a proliferation of feature flags. If
we end up with less than 5 feature flags before we bump a major version (and
eradicate all existing flags), then I believe these drawbacks are not
substantial. If we end up with dozens of flags, all of these will become an
issue.

Therefore, the main mitigation is to make sure we don't abuse this capability
and only introduce feature flags when all creative and genuine attempts to avoid
a breaking change were exhausted.

## Discoverability

If users wish to enable a flag in an existing project, they need a way to find
out which flag to enable in their `cdk.json` and how.

This drawback will be mitigated by:

- [ ] Adding a documentation section about feature flags in the developer guide,
  pointing to the `cx-api/lib/features.ts` file as an index of feature flags.
- [x] Announce the feature flag ID in our release notes under `BREAKING CHANGE:
  (under feature flag)`.

## Testing

A feature flag is a system-level degree of freedom. Theoretically, every flag
introduces another dimension in our entire test matrix. Without extensive
tooling, it will be impossible to actually run our entire test suite against all
permutations of feature flags.

Unit tests across the framework will normally continue to define apps with all
feature flags disabled (this is the default). In the case where a test depends
on a feature flag being enabled, it will explicitly enable it when the `App`
construct is defined through it's `context` option.

The feature itself will be tested in both enabled and disabled mode.

In the meantime, we will not introduce tooling for matrix coverage due to it's
complexity and impact on build times and contributor experience. As long as we
don't have a proliferation of flags, I believe this is a reasonable trade-off.

## Support

When an issue is raised, we need to be able to reproduce it. Since feature flags
can implicitly change how the CDK behaves, we need to know which features are
enabled.

To mitigate this risk we will:

- [ ] Add feature flags to `cdk doctor` and update bug report template
  accordingly to request users to run `cdk doctor`.

# Rationale and Alternatives

We considered an alternative of "bundling" new capabilities under a single flag
that specifies the CDK version which created the project, but this means that
users won't have the ability to pick and choose which capabilities they want to
enable in case they need them but don't want to take the risk of unexpected
changes.
 
The downside of the fine-grained approach is that it could result in a "blowing
up" new `cdk.json` files in case there will be many new breaking capabilities
between major releases. But this is hypothetical and even if this list ends up
with 20 features before we release the next major version, I still think the
benefits outweigh the risks of the alternative approach.

# Adoption Strategy

Most CDK users will likely not need to know about feature flags. Projects
created before a feature flag was introduced will continue to behave in the same
way and new projects created through `cdk init` will automatically get all new
behaviors.

The contributor experience for using feature flags will be documented in the
contribution guide and will involve the following steps:

1. Seek the approval of a core team member that a feature flag can be used.
   * If the feature in question is being planned via an RFC, and the feature
     flag is contained in the proposal, core team member approval should include
     the feature flag.
   * If the feature is being tracked in a single issue without an RFC, approval
     should be indicated in this issue.
2. Define a new const under
   [cx-api/lib/features.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/cx-api/lib/features.ts)
   with the name of the context key that **enables** this new feature (for
   example, `ENABLE_STACK_NAME_DUPLICATES`). The context key should be in the
   form `module.Type:feature` (e.g. `@aws-cdk/core:enableStackNameDuplicates`).
3. Use `node.tryGetContext(cxapi.ENABLE_XXX)` to check if this feature is
   enabled in your code. If it is not defined, revert to the legacy behavior.
4. Add your feature flag to
   [cx-api/lib/future.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/cx-api/lib/future.ts).
   This map is inserted to generated `cdk.json` files for new projects created
   through `cdk init`.
5. In your PR title (which goes into CHANGELOG), add a `(behind feature flag)`
   suffix. e.g:
    ```
    fix(core): impossible to use the same physical stack name for two stacks (under feature flag)
    ```
5. Under `BREAKING CHANGES`, add a prefix `(under feature flag)` and the name of
   the flag in the postfix. For example:

    ```
    BREAKING CHANGE: (under feature flag) template file names for new projects created 
    through "cdk init" will use the template artifact ID instead of the physical stack 
    name to enable  multiple stacks to use the same name (feature flag: @aws-cdk/core:enableStackNameDuplicates)
    ```

# Unresolved questions

I believe the biggest unresolved question is how many feature flags we will end
up with until the next major version bump. We introduced a bit of process to
require that feature flags will be approved by two core team members, and we
will closely monitor this and reevaluate if we see a proliferation of flags.

# Future Possibilities

As a general rule, using a feature flag should be last resort in the case where
it is impossible to implement backwards compatibility. A feature flag is likely
to get less usage and therefore mature slower, so it's important to make sure we
don't abuse this pattern.

Still, a valid concern is that we end up with too many feature flags between
major releases (I would say >20 is too many), in which case it might be required
to offer additional tools to manage and discover them.

Here are a few ideas that came up as we designed this. All of these can be
implemented on top of the proposed mechanism, and should be considered if needed
in the future (as well as any other idea of course):

- Introduce a CLI command to list all flags and enable/disable them in your
  `cdk.json`.
- Aggregate all flags in groups so it will be easier to enable many of them.
- Define a flag that will allow users to say "I want all feature up until a
  certain CDK version" (basically enables all features that were available when
  the version was releases).

