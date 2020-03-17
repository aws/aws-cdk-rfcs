---
feature name: cli-framework-compatibility-strategy
start date: February 2nd, 2020
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/111
related issue: https://github.com/aws/aws-cdk-rfcs/issues/110
---

<!-- replace the blockquoted sections with your content -->
# Summary

This RFC addresses compatibility concerns for developing different parts of the CDK.

It details exactly what compatibility promises we should be advertising to our customers,
as well as proposes technical mechanisms for validating those promises are upheld.

At a high level, we define the expected customer experience when upgrading either of the two CDK components:

- CLI upgrades are compatible. New CLI versions should work with older framework versions, and all existing functionality is preserved.
- Framework upgrades are incompatible. We will require the user to upgrade the CLI as well.

This will eventually lead the user to always have a setup where `CLI >= Framework`.

# Motivation

The motivation behind this RFC is three-fold:

## Confusing Upgrade Process

Currently, the upgrade process for our users can be a bit complicated/confusing.

We generally don't require users to upgrade their CLI when they upgrade the framework.

However, sometimes, we introduce features in the framework that rely on new CLI capabilities.
When this happens, we bump the cx-protocol version, forcing (all) users to upgrade their CLI as well, even those who don't use the new feature.

Things get much worse, if we forget to bump the cx-protocol version (which we do sometimes).
In this case, the user will not receive the upgrade instruction, and will rightfully assume the new feature simply works.
While in reality, this can either cause unexpected errors or non-working features.

We want to come up with a consistent model that users can rely on.

## Simplify CX Protocol Versioning

Recently, we have had a few customer impacting issues that relate to our cx-protocol.

- [aws/aws-cdk: A newer version of the CDK CLI (>= 1.21.0) is necessary to interact with this app](https://github.com/aws/aws-cdk/issues/5986)
- [aws/aws-cdk: CDK CLI can only be used with apps created by CDK >= 1.10.0](https://github.com/aws/aws-cdk/issues/4294)

A major contributing factor to those issues, is that the ergonomics of introducing breaking changes (cx-protocol version bump), are not very good:

- It requires us to **remember** to bump the cx-protocol version when we introduce incompatible changes.
- In order for newer CLI version to support older framework, we do a *synthetic* manifest upgrade. This is also something we need to **remember**.

There are also some quirky implementation details, in [`versioning.ts`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/versioning.ts):

```typescript
const toolkitVersion = parseSemver(CLOUD_ASSEMBLY_VERSION);
```

The CLI version takes the value of the latest cx-protocol version, and not the actual CLI version.


```typescript

// if framework > cli, we require a newer cli version
if (semver.gt(frameworkVersion, toolkitVersion)) {
  throw new Error(`A newer version of the CDK CLI (>= ${frameworkVersion}) is necessary to interact with this app`);
}

// if framework < cli, we require a newer framework version
if (semver.lt(frameworkVersion, toolkitVersion)) {
  throw new Error(`The CDK CLI you are using requires your app to use CDK modules with version >= ${CLOUD_ASSEMBLY_VERSION}`);
}
```

This code (and comments) is contradictory to our current compatibility model, where we actually attempt to support two way compatibility.
To facilitate this, we added the [`upgradeAssemblyManifest`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/versioning.ts#L60) function.

Thats not to say that what we currently have can't work. But the fact that we are getting it wrong almost every time, implies that we should re-think the process, as well as the assumptions that lead to it.

## Validate Compatibility

We want to make sure we have sufficient testing in place that validate we don't introduce any accidental CLI compatibility breakage.

**Currently, the only way for us to detect these types of problems is by noticing them in the code review process.**

# Design Summary

Assuming we adopt the new compatibility model, all we have to do is come up with a validation mechanism for the following breakage scenarios:

## Breaking changes in CX Protocol

Probably the most prominent scenario for causing breakage is pushing an incompatible change to the cx-protocol itself.
This can, for example, be the removal of a property.

> See concrete [example](#rename-target-property-in-containerImageAssetMetadataEntry).

The proposed solution for this case is to run API compatibility checks using `jsii-diff`.
We would treat `cx-api` as a regular `jsii` module that needs to maintain compatibility to its consumers, which is the CLI.

This will make sure that when the CLI pulls in new versions of `cx-api` (on upgrades), it will properly consume older cloud assemblies.

In addition to the API itself, cx-protocol can break other contracts, such as file system locations.

> See concrete [example](#rename-target-property-in-containerImageAssetMetadataEntry).

## Breaking changes in CLI

Another way to break CLI upgrades, is to simply change the CLI in a breaking way. This can, for example, be a change to the docker build command.

> See concrete [example](#remove---target-from-docker-build-command).

The proposed solution for this case is to run standard regression tests. That is, run old CLI integration tests on the latest code (Framework and CLI).

This will make sure that old CLI functionality is still working, assuming of course it was covered by our integration tests.

In addition, we will also run regression tests using new CLI code and previous framework versions. This will ensure that existing CLI functionality does not rely on new framework capabilities.

> See concrete [example](#change-artifact-metadata-type-value)

# Detailed Design

There are 2 mechanisms we need to implement:

## API Compatibility Checks

We need to make sure the objects that make up what we refer to as the `cx-protocol`, do not change in a breaking way.
We should be able to leverage `jsii` to accomplish this. For example, this is an excerpt from the `.jsii` spec of the `cx-api` module:

```json
"name": "ContainerImageAssetMetadataEntry",
"properties": [
    {
        "abstract": true,
        "docs": {
            "stability": "experimental",
            "summary": "Path on disk to the asset."
        },
        "immutable": true,
        "locationInModule": {
            "filename": "lib/assets.ts",
            "line": 48
        },
        "name": "path",
        "type": {
            "primitive": "string"
        }
    }
]
```

This means that, if we remove the `path` property from `ContainerImageAssetMetadataEntry`, jsii should produce an error, and indeed:

```console
❯ yarn compat
PROP @aws-cdk/cx-api.ContainerImageAssetMetadataEntry.path: has been removed [removed:@aws-cdk/cx-api.ContainerImageAssetMetadataEntry.path]
```

Currently, the `cx-api` module contains a lot of stuff that aren't strictly related to the protocol.

> For example, `AssemblyBuildOptions`, which is used during synthesis by the framework. It is not used by the CLI (nor it should).

This creates clutter, and might also cause issues with applying `jsii` compatibility checks.

In addition, according to our new compatibility model, we need to make sure the user gets the correct error
when the CLI version is smaller than the `Cloud-Assembly` version.

The plan therefore is as follows:

### Step 1: Create a separate package called `cx-protocol`

This package will provide:

#### (1) Object Model

- MetadataEntry
- RuntimeInfo
- AssemblyManifest
- ArtifactManifest
- ...
- ...

These are the objects that will be later used by the CLI. Running compatibility checks on them **should** ensure:

1. Rename/Remove properties is not allowed.
2. Changing the type of a property is not allowed.
3. Making an optional property required is not allowed.
4. Adding a required property is not allowed.

> The `jsii` compatibility checker currently doesn't actually provide us with all those requirements. It validates interfaces only with relation to their
> usage, in either argument or return values of methods. This means that, for example, number 4 is allowed,
> because the `ContainerImageAssetMetadataEntry` is not used as a function argument in `cx-api`.
> In order to achieve this, we will either need to enhance the `jsii` checker, or refactor our code.
In any case, we stipulate the necessary changes will be done.

##### (2) Serialization

The package will provide serialization methods:

```typescript
/**
 * Save manifest to to file.
 *
 * @param manifest - manifest.
 */
public static save(manifest: AssemblyManifest, filePath: string) {}
```

This method will make sure `jsii` enforces the proper compatibility checks on those interfaces.

This new package also has to be **stable**. This is ok, it actually makes perfect sense for it to be stable as it
represents the structural contract the `cloud-assembly-schema` needs to adhere to.

#### Step 2: Change CLI dependencies

The CLI should only depend on the new `cx-protocol` package, and **not** on the `cx-api` package.

This means that when users install new versions of the CLI, they also get a new version of `cx-protocol`,
but since `cx-protocol` is backwards compatible, there is no risk of breaking API.

> The CLI currently depends on parts of `cx-api` that don't strictly relate to the proposed `cx-protocol` object model.
> Analysis of those dependencies has yet to be done. Ideally, we would be able to move that code away from `cx-api` and into the CLI itself. Perhaps even at the expense of some duplication if that code is being used in the framework as well.
> In any case, I don't think this will be a blocker for the design.

#### Step 3: Validate CLI `>=` Framework

To make sure we enforce that the CLI version will always be `>=` than the framework version, we will add a
validation in the CLI, immediately after we de-serialize the `Cloud-Assembly`:

in `exec.ts`

```typescript
var assembly;

if (await fs.pathExists(app) && (await fs.stat(app)).isDirectory()) {
    debug('--app points to a cloud assembly, so we by pass synth');
    assembly = new cxapi.CloudAssembly(app);
} else {
    debug('--app points to an executable, let the framework do its thing');
    await exec();
    assembly = new cxapi.CloudAssembly(outdir);
}

if (versionNumber() < assembly.version) {
    throw new Error(`A newer version of the CDK CLI (>= ${assembly.version}) is necessary to interact with this app`);
}
```

This implies that the `version` in `manifest.json` will no longer be the value of `CLOUD_ASSEMBLY_VERSION`,
it will simply be the version of the package itself. It also means, that we can completely get rid of this constant,
and of the separation we have in the code between `cx-protocol` version and our package versions.

> See a [quirk](#Quirk---CDK-Synth) that is caused by this.

To actually validate this behavior, we add an integration test:

\+ `test-cli-throws-on-new-framework.sh`

```bash

LATEST_PUBLISHED_VERSION=$(node -p 'require("package.json").version')
NEXT_VERSION=$(bump_minor ${LATEST_PUBLISHED_VERSION})

# create the cloud assembly
cdk synth

# patch it to simulate a later version
sed -i "s/${LATEST_PUBLISHED_VERSION}/${NEXT_VERSION}/g" cdk.out/manifest.json

# deploy the existing patched app, this should throw
out=$(cdk -a cdk.out deploy)

assert ${out} == "A newer version of the CDK CLI (>= ${NEXT_VERSION}) is necessary to interact with this app"
```

> This test feels a bit overly complex, though it probably accurately simulates a user upgrading the framework only.
> Perhaps we can transform this to a unit test, though its not trivial.

#### Step 4: Remove [`versioning.ts`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/versioning.ts)

Given all the above steps, we don't need the functionality provided
by [`versioning.ts`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/versioning.ts).
Lets dive deep into why is that exactly.

##### Schema Evolution

The schema in `manifest.json` might be incomplete/different with regards to the expectation of new CLI versions.

For example, the CLI might assume that a `newProperty` will always exist in the manifest,
because it was added as a required property in new schema versions.
In order for the new CLI version to not fail on older schemas, where `newProperty` doesn't exist,
we perform whats called a *schema evolution*.

That is, we read the **old** schema, and add the necessary properties (with some default values) in order for
it to look exactly like the **new** schema would. This enables the CLI to essentially not be aware of any schema version expect for the last one.

This is done in the [`upgradeAssemblyManifest`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/versioning.ts#L60) function.

We stipulate that this is no longer needed. The compatibility checks will make sure we don't add a required property,
or do any change that enables the CLI to rely on the structure of the new schemas. This will actually also be enforced by
the compiler itself. For example, if we add a property, it has to be optional (because of the compatibility checks),
and if its optional, the CLI has to, at compile time, treat the `undefined` scenario, hence, supporting earlier schemas that didn't have this property.

Removing this mechanism will mean that instead of, theoretically, having only place consider older versions of the schema,
we will now have multiple places in the code that should be aware of it. But thats ok, because its enforced by the compiler,
and it also provides better context and granularity for doing that so called evolution.

Also, in reality, we don't actually do any evolution. All we do is synthetically upgrade the schema version,
without adding or modifying any properties.

This brings us to the next item.

##### Compatibility Validation

This is done in the [`verifyManifestVersion`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/versioning.ts#L39) function,
and contains two validations:

1. **Framework cannot be bigger than CLI.**

   We have already [described](#step-3-validate-cli--framework) how to handle this validation.

2. **CLI cannot be bigger than Framework.**

   This validation is actually misleading, since we do support CLI > Framework. The way its currently implemented is by doing
   the aforementioned evolution. But, if the evolution is not necessary anymore, than this validation is not necessary anymore.
   Which makes sense, since we do support this scenario.

### CLI Regression Tests

The second major mechanism we need to implement is CLI regression tests.

As already mentioned, `cx-protocol` API breakage is not the only thing that can go wrong.
This is to ensure that we don't introduce breaking changes to the CLI itself. The plan here is fairly straight forward:

```console
git checkout v${LATEST_PUBLISHED_VERSION}
npm install /path/to/aws-cdk
npm install /path/to/packages/*
cd packages/aws-cdk
yarn integ-cli
```

> Not to be taken literally, commands just illustrate intent

# Drawbacks

The only drawback I can think of is that we will be forcing users to upgrade their CLI when they upgrade their framework.
This is an additional action that they didn't have to take until now. However, calling this a *drawback* is debatable,
since it actually does provide a more consistent behavior than we have now. In any case, we don't consider this a sufficiently serious issue.

# Rationale and Alternatives

## New Compatibility Model

As we realized by now, this RFC proposes a significant change to our compatibility model.
Instead of attempting to have new framework versions support old CLI versions,
we will now require that CLI `>=` Framework. Forcing users to upgrade their CLI every time they upgrade their framework.

### Why is it OK to enforce this requirement?

- We want to migrate most of the functionality to the framework. Making CLI upgrades especially safe.
- As an educated guess, we think users tend to upgrade the CLI before upgrading the framework.
- We sometimes require that even now, and we haven't seen any backlash due to that.

#### Why is it **NOT** OK to enforce this requirement?

- It is a bit intrusive. Even though we currently sometimes do it, we usually don't. And this would mean
users get a slightly less smooth upgrade experience.

## Validating CLI `>=` Framework

There is a different approach to achieve this than the one [described](#step-3-validate-cli--framework).

The idea is that, instead of having the CLI do this validation, we make the framework validate this.
We use the fact that the CLI already passes its version to the framework as an env variable.

in `cloud-assembly.ts`

```typescript
constructor(directory: string) {

    // some code

    const manifest = JSON.parse(fs.readFileSync(path.join(directory, MANIFEST_FILE), 'UTF-8'));

    const cliVersion = process.env.CLI_VERSION_ENV

    if (cliVersion && semver.gt(manifest.version, cliVersion)) {
        throw new Error(`A newer version of the CDK CLI (>= ${assembly.version}) is necessary to interact with this app`);
    }

    // some more code
}
```

Then, testing this, becomes as simple as writing another unit test in `cloud-assembly.test.ts`. However, this might be one of those rare
cases where simplicity of the test doesn't imply the design is correct.

This approach doesn't seem right because:

1. This code can be executed outside the context of the CLI, which is why we need the `if (cliVersion)` statement.
2. The `process.env.CLI_VERSION_ENV` is only available when the CLI invokes the `app` for synthesis.
But what about when `app` points to an already existing `Cloud-Assembly`? In this case, the CLI doesn't execute any process,
and simply creates an instance of `CloudAssembly` immediately.

As far as relationships go as well, it doesn't really make sense for the framework to be aware of the CLI. It should only be the other way around.

For these reasons, this approach was abandoned.

# Adoption Strategy

Adoption of this strategy should be rather seamless for developers. The changes a developer would need to incorporate,
will be guided by failing tests. Hopefully, the process will not require any memorization (or even documentation).

Having said that, this RFC can be a good reference documentation that provides rational for every step in the process.

# Future Possibilities

## Cleanup `cx-api`

Separating `cx-protocol` stuff from `cx-api`, opens the door for doing a thorough cleanup. I think `cx-api` was initially regarded as the place for `cx-protocol`,
though it currently contains a lot of other stuff. We should do an overview of the code inside `cx-api`, and move it to the appropriate place.

### CLI API Compatibility Checks

If we think about it, in the same way that the framework exposes a protocol to the CLI, the CLI in turn exposes a protocol to the end user.
For example, all the CLI command line options, are part of this protocol. The compatibility requirements on those options
are essentially the same as those of properties in the `cx-protocol` object model.

We could model those options in an object model, and run compatibility checks on that model. This will ensure we don't accidentally
remove an option or make one required, for example.

### `cx-protocol` integration tests

Like already [mentioned](#change-artifact-metadata-type-value), the fact that
the cx protocol itself will remain API comptabile, doesn't necessarily mean
that it can't break new CLI versions.

Another compatibility layer we can add, is run snapshot testing, similair to what we do with our construct libraries.
There, we make sure the CloudFormation template remains the same, here,
we make sure the `manifest.json` remains the same (values wise).

These types of tests however are somewhat volatile because we can accidentally push a snapshot change that is in fact breaking.
API compatibility checks on the other do not have this vulunerability
because we don't have control on the compatibility rules themselves.

# Appendix

## Rename target property in `ContainerImageAssetMetadataEntry`

This is a concrete example on how things can break when we introduce changes to the `cx-api`.

1. Rename `target` in [`ContainerImageAssetMetadataEntry`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/assets.ts#L74) to `buildTarget`.
2. Perform necessary changes in CLI and fix all relevant tests.

Our current CLI backwards compatibility tests will not detect this because:

- We don't run CLI integration tests on old assemblies that use `ContainerImageAssetMetadataEntry`.
- We only run `cdk synth`, but this problem would be reviled in `cdk deploy`.

However, what will happen is the new CLI will ignore the `target` property that might exist in old cloud-assemblies,
resulting in the breakage of this feature.

Note that we didn't mention wether or not the developer remembered to bump the version of `cx-protocol`.
Thats because it doesn't matter, CLI upgrades should work regardless.

## Remove `--target` from docker build command

1. For some reason, we decide to stop passing `--target` to the docker build command.
2. Perform necessary changes and fix all relevant tests.

This type of change is forbidden, because it removes an existing CLI capability.

However, nothing will catch this breaking change because:

- The tests were explicitly changed to the support the removal of this feature.
- API compatibility is still intact, the CLI is simply not using it as expected.

Running regression tests, i.e, running previous integration tests, will catch this because we had a test that checks the `--target` feature (hopefully).

## Change artifact metadata type value

1. For some reason, we decide to rename the [`aws:cdk:asset`](https://github.com/aws/aws-cdk/blob/b52b43ddfea0398b3f6e05002bf5b97bc831d1a7/packages/%40aws-cdk/cx-api/lib/assets.ts#L1) marker.
2. Perform necessary changes and fix all relevant tests.

This type of change is forbidden, because it means new CLI versions will not work with cloud assemblies that are created by older framework versions.

However, nothing will catch this breaking change because:

- The tests were explicitly changed to the support the removal of this feature.
- API compatibility is still intact, nothing in the structure of `manifest.json` changed, just the values.
- Even the regression tests we talked about wont catch this because they always use new framework versions that create cloud assemblies that are compatible with new cli versions.

In order to reject this type of change, we need to run the regression suite, but using older framework versions.



## Quirk - CDK Synth

This illustrates a quirk that can happen because of the new proposed compatibility model.

Consider the following:

```console
npm install aws-cdk@1.23.0
npm install @aws-cdk/aws-s3@1.24.0
cdk synth
A newer version of the CDK CLI (>= 1.24.0) is necessary to interact with this app
```

The message makes sense, but actually, synthesis worked, and `cdk.out` was created. Which also makes sense.
The validation is do is against the `manifest.version` value, therefore we have to first create the `Cloud-Assembly`, and only then validate.

Not sure its an actual problem, but it does kind of feel weird.

On one hand we are saying the CLI doesn't work with newer framework versions, on the other hand, it did,
because it invoked the framework which created `cdk.out`...

Perhaps we should say that only *cdk deploy* cannot operate on new framework versions, but maybe all other commands aren't really affected?

The flow would then be:

```console
npm install aws-cdk@1.23.0
npm install @aws-cdk/aws-s3@1.24.0
cdk synth
cdk deploy
A newer version of the CDK CLI (>= 1.24.0) is necessary to deploy this app
```

This seems to make more sense.
