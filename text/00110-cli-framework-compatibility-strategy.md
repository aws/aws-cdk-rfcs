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

The main concept proposed is the introduction of the *cloud-assembly-schema* package. This package will
comprise only of the interfaces that define the communication between the framework and the CLI (or any other consumer for that matter).

Following are the main mechanism we will implement:

- *JSII* compatibility checks on the *cloud-assembly-schema* package.
- Decouple schema version from module version.
- CLI regression tests.

At a high level, we define the expected customer experience when upgrading either of the two CDK components:

- CLI upgrades are compatible. New CLI versions should work with older framework versions, and all existing functionality is preserved.

    > By *functionality*, we mean that the CLI is able to properly interpret older frameworks and perform the
    necessary actions to support the existing behavior.

- Framework upgrades are comptabile **unless** the *cloud-assembly-schema* has changed, in which case, we will
require the user to upgrade the CLI as well.

    > We will treat every change to the schema as a "breaking" one, [details](#schema-changes) below.

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
To facilitate this, we added the
[`upgradeAssemblyManifest`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/versioning.ts#L60) function.

Thats not to say that what we currently have can't work. But the fact that we are getting it wrong almost
every time, implies that we should re-think the process, as well as the assumptions that lead to it.

## Validate Compatibility

We want to make sure we have sufficient testing in place that validate we don't introduce any accidental CLI compatibility breakage.

**Currently, the only way for us to detect these types of problems is by noticing them in the code review process.**

# Design Summary

Assuming we adopt the new compatibility model, all we have to do is come up with a validation mechanism for the following breakage scenarios:

## Breaking changes to *cloud-assembly-schema*

Probably the most prominent scenario for causing breakage is pushing an incompatible change to the *cloud-assembly-schema* itself.
This can, for example, be the removal of a property.

> See concrete [example](#rename-target-property-in-containerImageAssetMetadataEntry).

The proposed solution for this case is to run API compatibility checks using `jsii-diff`.
We would treat *cloud-assembly-schema* as a regular `jsii` module that needs to maintain compatibility to its consumers, which is the CLI.

This will make sure that when the CLI pulls in new versions of *cloud-assembly-schema* (on upgrades), it will properly consume older cloud assemblies.

## Breaking changes in CLI

Another way to break CLI upgrades, is to simply change the CLI in a breaking way. This can, for example, be a change to the docker build command.

> See concrete [example](#remove---target-from-docker-build-command).

The proposed solution for this case is to run standard regression tests. That is, run old CLI integration
tests on the latest code (Framework and CLI).

This will make sure that old CLI functionality is still working, assuming of course it was covered by our integration tests.

In addition, we will also run regression tests using new CLI code and **previous** framework version.
This will ensure that existing CLI functionality does not rely on new framework capabilities.

> See concrete [example](#change-artifact-metadata-type-value)

### Exclusions

Sometimes we might need to introduce an intentional breaking change, for example for security concerns.
This breaking change might cause one of the previous integration tests to fail, which is actually ok.
We therefore need an escape hatch that allows us to disable specific tests during the execution of those regression tests.

To that end, we will implement an exlusions mechanism:

```typescript
[
  {
    "test": "test-cdk-iam-diff.sh",
    "version": "1.30.0",
    "justification": "iam policy generation has changed in version > 1.30.0 because..."
  }
]
```

Developers will be able to add entries to this list, which will cause the suite to skip those tests.

# Detailed Design

There are 2 mechanisms we need to implement:

## Cloud Assembly Schema Compatibility Checks

We need to make sure the objects that make up what we refer to as the *cloud-assembly-schema*, do not change in a breaking way.
We should be able to leverage `jsii` to accomplish this. For example, this is an excerpt from the `.jsii` spec of the *cx-api* module:

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

In addition, according to our new compatibility model, we need to make sure the user gets the correct error
when the CLI version is smaller than the `Cloud-Assembly` version.

The plan therefore is as follows:

### Step 1: Create a separate package called *cloud-assembly-schema*

This package will provide:

#### (1) Object Model

- MetadataEntry
- RuntimeInfo
- AssemblyManifest
- ArtifactManifest
- ...
- ...

These are the interfaces that will be later used by the CLI. Running compatibility checks on them will ensure:

1. Rename/Remove properties is not allowed.
2. Changing the type of a property is not allowed.
3. Making an optional property required is not allowed.
4. Adding a required property is not allowed.

##### (2) Serialization

The package will provide serialization methods:

```typescript
/**
 * Save manifest to file.
 *
 * @param manifest - manifest.
 */
public static save(manifest: AssemblyManifest, filePath: string) {}

/**
 * Load manifest from file.
 *
 * @param manifest - manifest.
 */
public static load(filePath: string): AssemblyManifest {}

/**
 * Get the schema version.
 */
public static version(): string {}

```

These methods will make sure `jsii` enforces the proper compatibility checks on those interfaces.

> Note: The existence of the `load` method will also enforce output posture compatibility checks.
> Essentially this means that we will not be able to make a required field optional.
> This might sound non intuitive, but actually makes sense. These interfaces are exposed to our customers,
> who might programtically access their properties. We wouldn't want user code to break because a property now might be `undefined`.

This new package also has to be **stable**. This is ok, it actually makes perfect sense for it to be stable as it
represents the structural contract the `cloud-assembly-schema` needs to adhere to.

#### (3) Json Schema

We will create a standard [*json-schema*](https://json-schema.org/), that will be generated from the `typescript` interfaces.
The schema file will be versioned separately from the module version, and consumers will be able to use it
to validate cloud assemblies that they are interacting with.

For example:

```json
"AssemblyManifest": {
    "description": "A manifest which describes the cloud assembly.",
    "type": "object",
    "properties": {
        "version": {
            "description": "Protocol version",
            "type": "string"
        },
        "artifacts": {
            "description": "The set of artifacts in this assembly. (Default - no artifacts.)",
            "type": "object",
            "additionalProperties": {
                "$ref": "#/definitions/ArtifactManifest"
            }
        },
```



#### Step 2: Validate Schema Version

The highest schema version that the CLI can accept, is the schema version that it was shipped with.
This version is exposed via the static `version` method in the *cloud-assembly-package*.

If the CLI encounteres assemblies with a higher version, it should reject them.

To enforce this, we will add a validation in the CLI, immediately after we de-serialize the `Cloud-Assembly`:

> Note that the de-serialization will always work because we cannot push breaking changes to the schema.

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

// reject assemblies created with a higher version than what we expect.
if (Schema.version() < assembly.version) {
    throw new Error(`Cloud assembly schema version mismatch...`);
}
```

This implies that the `version` in `manifest.json` will no longer be the value of `CLOUD_ASSEMBLY_VERSION`,
it will simply be the version of schema that was used to create it.

To actually validate this behavior, we add a unit test for the `exec.ts` file.

#### Step 3: Remove [`versioning.ts`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/versioning.ts)

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

As already mentioned, *cloud-assembly-schema* API breakage is not the only thing that can go wrong.
This is to ensure that we don't introduce breaking changes to the CLI itself. The plan here is fairly straight forward:

```console
git checkout v${LATEST_PUBLISHED_VERSION}
npm install /path/to/aws-cdk
npm install /path/to/packages/*
cd packages/aws-cdk
yarn integ-cli
```

> Not to be taken literally, commands just illustrate intent

# Rationale

## Schema Changes

Imagine that we add an **optional** property to one of the interfaces, and change the CLI to use this new property (in a backwards compatible way of course).
One might argue that existing CLI versions are still able to deploy those new assemblies, they will simply ignore the new property.

However, how will they know the nature of this new property? Deploying such a cloud assembly implies ignoring some instructions
that might be critical to the assembly as a whole.

For this reason, we treat **any** change to the schema as a "breaking" change, not just changes that break the format validation.
This breaking change will be communicated as a `major` version bump of the schema.

# Adoption Strategy

Adoption of this strategy should be rather seamless for developers. The changes a developer would need to incorporate,
will be guided by failing tests. Hopefully, the process will not require any memorization (or even documentation).

Having said that, this RFC can be a good reference documentation that provides rational for every step in the process.

# Future Possibilities

## Cleanup *cx-api*

Separating *cloud-assembly-schema* stuff from *cx-api*, opens the door for doing a thorough cleanup. I think *cx-api* was initially
regarded as the place for *cloud-assembly-schema*, though it currently contains a lot of other stuff. We should do an overview of the
code inside *cx-api*, and move it to the appropriate place.

### CLI API Compatibility Checks

If we think about it, in the same way that the framework exposes a protocol to the CLI, the CLI in turn exposes a protocol to the end user.
For example, all the CLI command line options, are part of this protocol. The compatibility requirements on those options
are essentially the same as those of properties in the *cloud-assembly-schema* object model.

We could model those options in an object model, and run compatibility checks on that model. This will ensure we don't accidentally
remove an option or make one required, for example.

### Integration tests for *cx-api*

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

This is a concrete example on how things can break when we introduce changes to the *cx-api*.

1. Rename `target` in [`ContainerImageAssetMetadataEntry`](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/cx-api/lib/assets.ts#L74) to `buildTarget`.
2. Perform necessary changes in CLI and fix all relevant tests.

Our current CLI backwards compatibility tests will not detect this because:

- We don't run CLI integration tests on old assemblies that use `ContainerImageAssetMetadataEntry`.
- We only run `cdk synth`, but this problem would be reviled in `cdk deploy`.

However, what will happen is the new CLI will ignore the `target` property that might exist in old cloud-assemblies,
resulting in the breakage of this feature.

Note that we didn't mention wether or not the developer remembered to bump the version of *cloud-assembly-schema*.
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

1. For some reason, we decide to rename the
[`aws:cdk:asset`](https://github.com/aws/aws-cdk/blob/b52b43ddfea0398b3f6e05002bf5b97bc831d1a7/packages/%40aws-cdk/cx-api/lib/assets.ts#L1) marker.
2. Perform necessary changes and fix all relevant tests.

This type of change is forbidden, because it means new CLI versions will not work with cloud assemblies that are created by older framework versions.

However, nothing will catch this breaking change because:

- The tests were explicitly changed to the support the removal of this feature.
- API compatibility is still intact, nothing in the structure of `manifest.json` changed, just the values.
- Even the regression tests we talked about wont catch this because they always use new framework versions that create
cloud assemblies that are compatible with new cli versions.

In order to reject this type of change, we need to run the regression suite, but using older framework versions.
