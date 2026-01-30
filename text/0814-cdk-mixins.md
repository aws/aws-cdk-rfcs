# CDK Mixins: Composable Abstractions for AWS Resources

* **Original Author(s):**: @kornherm
* **Tracking Issue**: #814
* **API Bar Raiser**: @rix0r

CDK Mixins are composable, reusable abstractions that can be applied to any construct (L1, L2 or custom).
They are breaking down the traditional barriers between construct levels,
allowing customers to mix and match sophisticated features without being locked into specific implementations.

## Working Backwards

### README: CDK Mixins

CDK Mixins provide a new, advanced way to add functionality through composable abstractions.
Unlike traditional L2 constructs that bundle all features together, Mixins allow you to pick and choose exactly the capabilities you need for constructs.

#### Key Benefits

CDK Mixins offer a well-defined way to build self-contained constructs features.
Mixins are applied during or after construct construction.

* **Universal Compatibility**: Apply the same abstractions to L1 constructs, L2 constructs, or custom constructs
* **Composable Design**: Mix and match features without being locked into specific implementations
* **Cross-Service Abstractions**: Use common patterns like encryption across different AWS services
* **Escape Hatch Freedom**: Customize resources in a safe, typed way while keeping the abstractions you want

Mixins are an _addition_, _not_ a replacement for construct properties.
By itself, they cannot change optionality of properties or change defaults.

#### Basic Usage

Mixins are applied to constructs using the new `.with()` method.
This method exists on all `Constructs` using the `constructs` module.

```typescript
// Apply mixins fluently
const l1Bucket = new s3.CfnBucket(scope, "MyL1Bucket")
  .with(new EncryptionAtRest())
  .with(new AutoDeleteObjects());

// Apply multiple mixins to with
const l2Bucket = new s3.Bucket(scope, "MyL2Bucket")
  .with(new EncryptionAtRest(), new AutoDeleteObjects());

// Works with even with any constructs, even custom ones
const customBucket = new AcmeBucket(scope, "MyCustomBucket")
  .with(new EncryptionAtRest())
  .with(new AutoDeleteObjects());
```

The AWS Construct Library `aws-cdk-lib` also offers an alternative form: `Mixins.of()`.
This form allows additional, advanced configuration of Mixin application.

```typescript
import * as s3 from "aws-cdk-lib/aws-s3";
import { Mixins, AutoDeleteObjects, EncryptionAtRest } from "aws-cdk-lib/mixins";

// Basic: Apply mixins to any construct, calls can be chained
const bucket = new s3.CfnBucket(scope, "MyBucket");
Mixins.of(bucket)
  .apply(new EncryptionAtRest())
  .apply(new AutoDeleteObjects());

// Basic: Or multiple Mixins passed to apply
Mixins.of(bucket)
  .apply(new EncryptionAtRest(), new AutoDeleteObjects());

// Advanced: Apply to constructs matching a selector, e.g. match by ID
Mixins.of(
  scope,
  ConstructSelector.byId(/.*-prod-.*/) 
).apply(new ProductionSecurityMixin());

// Advanced: Require a mixin to be applied to every node in the construct tree
Mixins.of(stack)
  .apply(new TaggingMixin())
  .requireAll();
```

#### Building Mixins

Mixins are simple classes that implement the `IMixin` interface:

```ts
interface IMixin {
  /** Check if this mixin can be applied to the given construct */
  supports(construct: IConstruct): boolean;
  
  /** Apply the mixin to the construct */
  applyTo(construct: IConstruct): void;
}
```

We recommend to implement Mixins at the L1 level and to have them target a specific resource construct.
This way, the same Mixin can be applied to constructs from all levels.

When applied, the `.supports()` method is used to decided if a Mixin can be applied to a given construct.
Depending on the application method (see below), the Mixin is then applied, skipped or an error is thrown.

```ts
bucketAccessLogsMixin.supports(bucket); // true
bucketAccessLogsMixin.supports(queue); // false
```

User created Mixins should extend the abstract `Mixin` base class:

```typescript
import { Mixin } from "aws-cdk-lib/mixins";
import * as s3 from "aws-cdk-lib/aws-s3";

// Simple mixin that enables versioning
class EnableVersioning extends Mixin {
  supports(construct: IConstruct): construct is s3.CfnBucket {
    return s3.CfnBucket.isCfnBucket(construct);
  }

  applyTo(bucket: IConstruct) {
    bucket.versioningConfiguration = {
      status: "Enabled"
    };
    return bucket;
  }
}
```

It's also possible to build cross-service Mixins that can be applied to multiple different resources.
We recommend to first implement a Mixin for each resource type, and then combine them together into such a cross-service Mixin:

```ts
class PointInTimeBackup extends Mixin {
  // declares support for multiple resource types
  supports(construct: IConstruct): boolean {
    return s3.CfnBucket.isCfnBucket(construct)
      || ddb.CfnGlobalTable.isCfnGlobalTable(construct);
  }

  // use if conditionals or a switch block to pick to specific Mixin to apply
  applyTo(construct: IConstruct) {
    if (s3.CfnBucket.isCfnBucket(construct)) {
      construct.with(new BucketVersioning());
    } else if (ddb.CfnGlobalTable.isCfnGlobalTable(construct)) {
      construct.with(new TablePointInTimeRecovery());
    }
  }
}
```

##### `supports()`

Returns whether a given construct is supported by the Mixin.

With this API, Mixins can be introspected for their applicability without being executed. One use cases is `Mixins.of(...).mustApply(...)`:
It allows us to declare and check that a Mixin must be applied to a set of constructs.

##### `applyTo()`

Applies the modifications of the Mixin to the target construct.

#### How Mixins are applied

Each construct has a `with()` method and Mixins will be applied to all nodes of the construct.
Sometimes more control is needed.
Especially when authoring construct libraries, it may be desirable to have full control over the Mixin application process.
Think of the L3 pattern again: How can you encode the rules to which Mixins may or may not be applied in your L3?
This is where `Mixins.of()` and the `MixinApplicator` class come in.
They provide more complex ways to select targets, apply Mixins and set expectations.

##### Mixin application on construct trees

When working with construct trees like Stacks (as opposed to single resources),
`Mixins.of()` offers a more comprehensive API to configure how Mixins are applied.
By default, Mixins are applied to all supported constructs in the tree:

```ts
// Apply to all constructs in a scope
Mixins.of(scope).apply(new EncryptionAtRest());
```

Optionally, you may select specific constructs:

```ts
import { ConstructSelector } from "aws-cdk-lib/mixins";

// Apply to a given L1 resource or L2 resource construct
Mixins.of(
  bucket,
  ConstructSelector.cfnResource() // provided CfnResource or a CfnResource default child
).apply(new EncryptionAtRest());

// Apply to all resources of a specific type
Mixins.of(
  scope,
  ConstructSelector.resourcesOfType(s3.CfnBucket.CFN_TYPE_NAME)
).apply(new EncryptionAtRest());

// Alternative: select by CloudFormation resource type name
Mixins.of(
  scope,
  ConstructSelector.resourcesOfType("AWS::S3::Bucket")
).apply(new EncryptionAtRest());

// Apply to constructs matching a pattern
Mixins.of(
  scope,
  ConstructSelector.byId(/.*-prod-.*/) 
).apply(new ProductionSecurityMixin());

// The default is to apply to all constructs in the scope
Mixins.of(
  scope,
  ConstructSelector.all() // pass through to IConstruct.findAll()
).apply(new ProductionSecurityMixin());
```

#### Mixins that must be used

Sometimes you need assertions that a Mixin has been applied to certain set of constructs.
`Mixins.of(...)` keeps track of Mixin applications and this report can be used to create assertions.

It comes with two convenience helpers:
Use `requireAll()` to assert the Mixin will be applied to all selected constructs.
If a construct is in the selection that is not supported by the Mixin, this will throw an error.
The `requireAny()` helper will assert the Mixin was applied to at least one construct from the selection.
If the Mixin wasn't applied to any construct at all, this will throw an error.

Both helpers will only check future calls of `apply()`.
Set them before calling `apply()` to take effect.

```ts
Mixins.of(scope, selector)
  // Assert Mixin was applied to all constructs in the selection
  .requireAll()
  // Or assert Mixin was applied to at least one construct in the selection
  // .requireAny()
  .apply(new EncryptionAtRest());

// Get an application report for manual assertions
const report = Mixins.of(scope).apply(new EncryptionAtRest()).report;
```

This report also allows you to create custom assertions.

#### Validation

Mixins have two distinct phases: Initialization and application.
During initialization only the Mixin's input properties are available, but during application we also have access the target construct.

Mixins should validate their properties and targets as early as possible.
During initialization validate all input properties.
Then during application validate any target dependent pre-conditions or interactions with Mixin properties.

Like with constructs, Mixins should _throw an error_ in case of unrecoverable failures and use _annotations_ for recoverable ones.
It is best practices to collect errors and throw as a group whenever possible.
Mixins can attach _[lazy validators](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md#attaching-lazy-validators)_ to the target construct.
Use this to ensure a certain property is met at end of an app's execution.

```ts
class EncryptionAtRest extends Mixin {
  constructor(props: EncryptionAtRest = {}) {
    // Validate Mixin props at construction time
    if (props.bucketKey && props.algorithm === 'aws:kms:dsse') {
      throw new Error("Cannot use S3 Bucket Key and DSSE together");
    }
  }

  applyTo(bucket: s3.CfnBucket): s3.CfnBucket {
    // Validate pre-conditions on the target, throw if error is unrecoverable
    if (!bucket.bucketEncryption) {
      throw new Error("Bucket encryption not configured");
    }

    // Validate properties are met after app execution
    bucket.addValidation({
      validate: () => this.bucketEncryption?.serverSideEncryptionConfiguration?.[0]?.serverSideEncryptionByDefault?.sseAlgorithm !== "aws:kms"
        ? ['This bucket must use aws:kms encryption.']
        : []
      }
    });

    bucket.bucketEncryption = {
      serverSideEncryptionConfiguration: [{
        bucketKeyEnabled: true,
        serverSideEncryptionByDefault: {
          sseAlgorithm: "aws:kms"
        }
      }]
    };
    return bucket;
  }
}
```

#### Resource-Specific Mixins

Each AWS service provides mixins tailored to its specific capabilities:

```typescript
// S3-specific mixins
const bucket = new s3.CfnBucket(scope, "Bucket")
  .with(new AutoDeleteObjects())
  .with(new ComplianceLogging())
  .with(new CfnBucketPropsMixin({ 
    someNewFeatureConfig: { settingOne: "value1" } 
  }));
```

#### Cross-Service Mixins

Some Mixins implement common patterns that can be used across different AWS services:

```typescript
// Same mixin works across different resource types
const bucket = new s3.CfnBucket(scope, "Bucket")
  .with(new EncryptionAtRest());

const logGroup = new logs.CfnLogGroup(scope, "LogGroup")
  .with(new EncryptionAtRest());

const table = new dynamodb.CfnTable(scope, "Table")
  .with(new EncryptionAtRest());
```

These Mixins can also be used to bulk apply on a construct tree:

```typescript
import { EncryptionAtRest, Mixins, ConstructSelector } from "aws-cdk-lib/mixins";

// Apply encryption to all encryptable (and supported) resources
Mixins.of(scope).apply(new EncryptionAtRest());
```

#### Using Mixins with L1 Constructs

With Mixins we can use abstractions with L1 constructs:

```typescript
// L1 with enterprise-grade settings
const bucket = new s3.CfnBucket(scope, "EnterpriseBucket")
  .with(new EncryptionAtRest())
  .with(new AutoDeleteObjects())
  .with(new ComplianceLogging())
  .with(new CostOptimization());

// Access day-one AWS features with abstractions
const bucketWithLatestFeature = new s3.CfnBucket(scope, "LatestBucket")
  .with(new CfnBucketPropsMixin({ 
    // New CloudFormation property available immediately
    newAwsFeature: { enabled: true }
  }))
  .with(new EncryptionAtRest());

// Related feature: Helper classes like Grants provide L2-like convenience
new BucketGrants(bucket).grantRead(role);
const eventPattern = new BucketEvents(bucket).onObjectCreated();
```

#### Using Mixins with L2 Constructs

Mixins extend L2 constructs with additional capabilities while preserving existing functionality:

```typescript
// Existing L2 usage continues to work unchanged
const standardBucket = new s3.Bucket(scope, "StandardBucket", {
  autoDeleteObjects: true,
  encryption: s3.BucketEncryption.S3_MANAGED
});

// Add new capabilities with mixins
const enhancedBucket = new s3.Bucket(scope, "EnhancedBucket", {
  autoDeleteObjects: true
}).with(new ComplianceAuditing())
  .with(new CostOptimization())
  .with(new CfnBucketPropsMixin({ 
    // Access new CloudFormation features not yet in L2
    newFeature: { enabled: true }
  }));

// Mix L2 properties with mixin capabilities
const hybridBucket = new s3.Bucket(scope, "HybridBucket", {
  versioned: true,
  lifecycleRules: [/* ... */]
}).with(new AdvancedMonitoring())
  .with(new SecurityCompliance());
```

#### Mixin Composition and Conflicts

Mixins are applied in declaration order. Later Mixins override earlier ones:

```typescript
// Last mixin wins for conflicting properties
const bucket = new s3.CfnBucket(scope, "Bucket")
  .with(new EncryptionAtRest({ algorithm: "AES256" }))
  .with(new EncryptionAtRest({ algorithm: "aws:kms" })); // KMS wins
```

This is expected and desired behavior.
We recommend that Mixins are always applied and do not attempt to "check" if a value has been configured already.
In the context of Mixins, constructs should be considered mutable and applying a Mixin should always have an effect.
When Mixins become to "clever", it will be much harder for users to understand what effect a certain Mixin has.
This aligns with the principle of least surprise.

#### Mixins and Aspects

Mixins and Aspects are similar concepts and both are implementations of the [visitor pattern](https://en.wikipedia.org/wiki/Visitor_pattern).
They crucially differ in their time of application:

- Mixins are always applied _immediately_, they are a tool of _imperative_ programming.
- Aspects are applied _after_ all other code during the synthesis phase, this makes them _declarative_.

Both Mixins and Aspects have valid use cases and complement each other.
We recommend to use Mixins to _make changes_, and to use Aspects to _validate behaviors_.
Aspects may also be used when changes need to apply to _future additions_, for examples in custom libraries.

Since their implementation is very similar, Mixins and Aspects can be converted from each other:

```ts
// Applies an Aspect immediately
const taggingMixin = Shims.mixinFromAspect(new TaggingAspect({ Environment: "prod" }));
Mixins.of(scope).apply(taggingMixin);

// Delays application of a Mixin to the synthesis phase
const encryptionAspect = Shims.aspectFromMixin(new EncryptionAtRest());
Aspects.of(scope).add(encryptionAspect);
```

When shimming Mixin to Aspect, the Mixin will automatically only be applied to supported constructs (via `supports()`).
Going from an Aspect to a Mixin, the Aspect will be applied to every node.
However a concrete Aspect might implement a custom filter.

#### Mixins in the `construct` module

Mixins are a new fundamental feature of the Constructs Programming Model (CPM).
As such, the Mixin interface `IMixin` and the `.with()` method are introduced to to the `constructs` package.

The standard implementation of `.with()` is deliberately simple and forgiving.
Mixins are applied to all nodes in the construct's tree that support the Mixin.
No errors are thrown or warnings are

```ts
class Construct implements IConstruct {
  
  // ...

  public with(...mixins: IMixin[]): void {
    for (const c of this.node.findAll()) {
      for (const m of mixins) {
        if (m.supports(this)) {
          m.applyTo(this);
        }
      }
    }
  }
}
```

Note that `Mixins.of()` (aka the `MixinApplicator`) and `ConstructSelector` are _not_ included in the `constructs` module.
Instead, they are features provided by the AWS CDK Construct library.
In future, we might publish a version of them as part of `constructs` or a helper package.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @rix0r
```

## Public FAQ

### What are we launching today?

We are launching CDK Mixins, a new composable abstraction system for AWS CDK that allows any high-value feature to work with
any construct level (L1, L2, or custom).
This includes a core mixin framework, resource-specific mixins for major AWS services, cross-service mixins for common patterns,
and automatic generation capabilities for new AWS features.

### Why should I use this feature?

CDK Mixins solve three critical problems:

1. **Freedom of Choice**: Use sophisticated abstractions without being locked into specific L2 implementations
2. **Day-One Coverage**: Access new AWS features immediately through auto-generated mixins while keeping your existing abstractions
3. **Composability**: Mix and match exactly the features you need without inheriting unwanted behaviors

This is particularly valuable for enterprise customers, some of which report the need to customize uo to 90% of used constructs.
Mixins allows them to keep using highly customized constructs, while still benefitting from AWS-maintained abstractions.

### How are Mixins different than Aspects?

**Mixins** are **imperative** - you explicitly choose what to add to each construct:

```typescript
// Imperative: explicitly add encryption to this specific bucket
const bucket = new s3.CfnBucket(scope, "Bucket")
  .with(new EncryptionAtRest());
```

**Aspects** are **declarative** - you define rules that apply automatically based on patterns:

```typescript
// Declarative: all constructs in scope get tagged automatically
Aspects.of(scope).add(new TaggingAspect({ Environment: "prod" }));
```

With mixins, you make explicit decisions about each construct's capabilities.
With aspects, you set policies that the CDK applies automatically during synthesis.
Mixins give you precise control and type safety, while aspects provide broad governance and compliance enforcement.

### What does this mean for L2s? Are L2s going away?

No! L2 constructs remain important and will continue to be developed. Mixins complement L2s by:

* **Extending L2 capabilities**: Add features not yet available in L2s
* **Enabling customization**: Use parts of L2 functionality without full commitment
* **Accelerating development**: Provide abstractions for new AWS features before L2 support
* **Future L2 architecture**: New L2s may be built using mixins for better modularity

L2s will continue to provide:

* Curated, opinionated defaults for common use cases
* Integrated multi-resource patterns
* Comprehensive documentation and examples
* Stable APIs for production workloads

### How are Mixins different to Property Injection aka CDK Blueprints?

Property injection is a feature to change the default behavior of constructs.
Users use this feature by adding so called "Blueprint" to their.
Often this handled for the user by using an internal `AcmeApp` (instead of `cdk.App`).

Mixins however are not added automatically.
Instead they are a way to scope and build abstractions.
Users may use Mixins directly,
or they will be using them indirectly through a company provided L2 `AcmeBucket` that uses Mixins as an implementation detail.

Blueprints and Mixins can be used together in the same app.
A Blueprint will chang the defaults for any given constructs.
Users can still apply Mixins to add features and make changes.

## Internal FAQ

### Why is it called CDK Mixins?

[Mixin](https://en.wikipedia.org/wiki/Mixin) is a well-established term in object-oriented programming.
CDK Mixins are applying this principle to the Construct Programming Model.
While this implementation does not min _callable_ functionality into a class,
it does mix _usable_ functionality (by an end user) into a construct.

Aspects also borrowed their name from an established concept ([aspect-oriented programming](https://en.wikipedia.org/wiki/Aspect-oriented_programming)),
but doesn't even implement it.
Mixins will be much closer to what the term is commonly understood at.
There's also potential for a future extension to actually return objects that can exhibit extended functionality.

We also considered Modifiers, but that decided against it as too generic.

### Why are we doing this?

The current CDK architecture forces customers into an "all-or-nothing" choice between sophisticated L2 abstractions and comprehensive AWS coverage.
This creates three "treadmill" problems:

1. **Coverage Treadmill**: We must provide L2s for all AWS services
2. **Completeness Treadmill**: Each L2 must support every feature of the underlying resource
3. **Customization Treadmill**: We must support all possible customizations

These treadmills are unsustainable given AWS's pace of innovation (2,000+ features annually vs. 5 new CDK modules per year).

### Why should we _not_ do this?

The primary risk is that Mixins allow the _internal state of L1s to get out sync from an owning L2_.
For example, an L2 `Bucket` might have a property `isEncrypted` to indicate the encryption status of the bucket.
Today, this property would typically be set as an input by the user and stored for later reference.
This works, because the underlying L1 `CfnBucket` was hidden from the user as an implementation detail.
Mixins now offer an official way to change the encryption status of the L1 without updating the parent L2.

Depending on how Mixins will be adopted, this could be an acceptable consequence.
The situation already exists today with overrides and other low-level escape hatches, although it is not very common.
Our intended mitigation for this issue are construct reflections:
Instead of relying on input values, properties can be derived from the state of the construct tree.
A value like `isEncrypted` can be represented as a query of the configuration of the underlying L1, e.g. "Is `ServerSideEncryptionByDefault` set?"
Construct reflection is not part of this proposal, but something we are actively investigating.

Additionally, Mixins add new _complexity and fragmentation_ to the ecosystem.
Having another abstraction layer could confuse developers.
Multiple ways to achieve the same outcome might split the community and what is considered a best practice.
We mitigate this with updated guidance, soft enforcement through linter rules and full backwards compatibility.

### What is the technical solution (design) of this feature?

The solution proposed in this RFC has three key components:

1. **Mixin Interface**: Definition of a Mixin
2. **Mixin application**: A `.with(mixins)` method to apply Mixins and allows composing functionality
3. **Advanced features**: Construct selector and application report to support advanced use cases.

However no design can exists outside its context.
This RFC heavily depends on three other components that have recently been developed in the AWS Construct Library:

1. **Addressable Resources**: Shared interfaces between L1s and L2s for interoperability
2. **Resource Traits**: Common interfaces (like `IEncryptable`) that enable cross-service abstractions. Mixins can use this to ascertain support.
3. **Automatic Generation**: More automated generation from AWS service specifications. Some Mixins will be generated like this.

### Is this a breaking change?

No. This is a purely additive change that maintains full backward compatibility.
Existing L2 constructs continue to work unchanged, and mixins provide additional capabilities on top of the current system.

### What alternative solutions did you consider?

#### 1. Enhanced L1 Constructs (RFC 655)

**Approach**: Improve L1s with better defaults, validation, and helper methods.

**Pros**:

* Simpler mental model - no new abstraction layer
* Backward compatible improvements
* Lower maintenance overhead

**Cons**:

* Still requires full L2 development for sophisticated features
* Doesn't solve the composability problem
* Limited cross-service abstraction capabilities

**Why Mixins Are Better**: Mixins provide the sophisticated features of enhanced L1s
while enabling composition and cross-service patterns that enhanced L1s cannot achieve.

#### 2. Modular L2 Redesign

**Approach**: Rebuild L2s as composable modules instead of monolithic constructs.

**Pros**:

* Clean architectural separation
* Type-safe composition
* Familiar L2 patterns

**Cons**:

* Massive breaking change to existing ecosystem
* Years of migration effort required
* Abandons existing L2 investments

**Why Mixins Are Better**: Mixins achieve modular composition without breaking changes, allowing gradual adoption while preserving existing L2 value.

#### 3. Expanded Aspects Usage

**Approach**: Use existing Aspects for all cross-cutting concerns and governance.

**Pros**:

* No new concepts to learn
* Existing pattern with proven usage
* Declarative policy enforcement

**Cons**:

* Aspects are synthesis-time only - no immediate reflection possible
* Poor TypeScript integration and IDE support
* Difficult to compose multiple aspects predictably
* No built-in support for imperative, construct-specific customization

**Why Mixins Are Better**: Mixins provide immediate application with full type safety, while aspects remain better for declarative policies.
The RFC shows how they can interoperate when needed.

#### 4. Status Quo with Incremental L2 Improvements

**Approach**: Continue current approach with faster L2 development.

**Pros**:

* No architectural changes required
* Leverages existing team expertise
* Predictable development model

**Cons**:

* Cannot solve the fundamental treadmill problems
* Still forces all-or-nothing choices for customers
* Doesn't address day-one AWS feature access
* Scales poorly with AWS's innovation pace

**Why Mixins Are Better**: Mixins break the treadmill cycle by enabling sophisticated abstractions without requiring complete L2 coverage,
allowing customers to access new AWS features immediately while keeping desired abstractions.

#### Trade-off Summary

| Approach     | Composability | Breaking Changes | Day-1 Features | Development Effort |
| ------------ | ------------- | ---------------- | -------------- | ------------------ |
| Enhanced L1s | Limited       | None             | Partial        | Medium             |
| Modular L2s  | High          | Major            | No             | Very High          |
| More Aspects | Medium        | None             | No             | Low                |
| Status Quo   | None          | None             | No             | High (ongoing)     |
| **Mixins**   | **High**      | **None**         | **Yes**        | **Medium**         |

Mixins uniquely provide high composability and day-one feature access without breaking changes, making them the optimal solution for the identified problems.

### What are the drawbacks of this solution?

1. **Learning Curve**: Developers need to understand a new abstraction pattern
2. **API Surface**: More APIs to document and maintain

### Are there any open issues that need to be addressed later?

1. **Performance Impact**: Need to measure runtime overhead of mixin composition
2. **Discoverability**: Ensure users can discover applicable mixins
3. **Documentation Strategy**: Develop clear patterns for documenting mixin combinations
4. **Mixin helpers**: Composing mixins together into bigger pieces
5. **Testing Strategy**: Define testing approaches for mixin abstractions

## Appendix

### Appendix A: Mixin Implementation Pattern

```typescript
// Core mixin interface
interface IMixin{
  supports(construct: IConstruct): boolean;
  applyTo(construct: IConstruct): IConstruct;
}

// Example implementation
class EncryptionAtRest implements IMixin {
  supports(construct: IConstruct): construct is s3.CfnBucket {
    return construct instanceof s3.CfnBucket;
  }

  applyTo(bucket: s3.CfnBucket): s3.CfnBucket {
    bucket.bucketEncryption = {
      serverSideEncryptionConfiguration: [{
        bucketKeyEnabled: true,
        serverSideEncryptionByDefault: {
          sseAlgorithm: "aws:kms"
        }
      }]
    };
    return bucket;
  }
}

// Mixin application framework
class MixinApplicator {
  static of(scope: IConstruct, selector?: ConstructSelector): MixinApplicator {
    return new MixinApplicator(scope, selector);
  }

  constructor(
    private readonly scope: IConstruct,
    private readonly selector: ConstructSelector = ConstructSelector.all()
  ) {}

  apply(mixin: IMixin): this {
    const constructs = this.selector.select(this.scope);
    for (const construct of constructs) {
      if (mixin.supports(construct)) {
        mixin.applyTo(construct);
        const errors = mixin.validate?.(construct) ?? []; // or should we validate first for all than apply?
        if (errors.length > 0) {
          throw new ValidationError(`Mixin validation failed: ${errors.join(', ')}`);
        }
      }
    }
    return this;
  }

  mustApply(mixin: IMixin): this {
    const constructs = this.selector.select(this.scope);
    for (const construct of constructs) {
      if (!mixin.supports(construct)) {
        throw new ValidationError(`Mixin ${mixin.constructor.name} could not be applied to any constructs`);
      }
      const errors = mixin.validate?.(construct) ?? []; // or should we validate first for all than apply?
      if (errors.length > 0) {
        throw new ValidationError(`Mixin validation failed: ${errors.join(', ')}`);
      }
    }
    return this;
  }
}
```

### Appendix B: ConstructSelector Implementation

```typescript
// Construct selection framework
abstract class ConstructSelector {
  abstract select(scope: IConstruct): IConstruct[];

  static all(): ConstructSelector {
    return new AllConstructsSelector();
  }

  static cfnResource(): ConstructSelector {
    return new CfnResourceSelector();
  }

  static resourcesOfType(type: string): ConstructSelector {
    return new ResourceTypeSelector(type);
  }

  static byId(pattern: RegExp): ConstructSelector {
    return new IdPatternSelector(pattern);
  }
}

class AllConstructsSelector extends ConstructSelector {
  select(scope: IConstruct): IConstruct[] {
    const result: IConstruct[] = [];
    const visit = (node: IConstruct) => {
      result.push(node);
      for (const child of node.node.children) {
        visit(child);
      }
    };
    visit(scope);
    return result;
  }
}

class CfnResourceSelector extends ConstructSelector {
  select(scope: IConstruct): IConstruct[] {
    if (scope instanceof CfnResource) {
      return [scope];
    }
    // Find default child that is a CfnResource
    const defaultChild = scope.node.defaultChild;
    if (defaultChild instanceof CfnResource) {
      return [defaultChild];
    }
    return [];
  }
}

class ResourceTypeSelector extends ConstructSelector {
  constructor(private readonly type: string | Function) {
    super();
  }

  select(scope: IConstruct): IConstruct[] {
    const result: IConstruct[] = [];
    const visit = (node: IConstruct) => {
      if (typeof this.type === 'string') {
        if (node instanceof CfnResource && node.cfnResourceType === this.type) {
          result.push(node);
        }
      } else {
        if (node instanceof this.type) {
          result.push(node);
        }
      }
      for (const child of node.node.children) {
        visit(child);
      }
    };
    visit(scope);
    return result;
  }
}
```

### Appendix C: Cross-Service Trait Example

```typescript
// Common trait for encryptable resources
interface IEncryptable extends IConstruct {
  encryptionKey?: kms.IKey;
  setEncryption(config: EncryptionConfig): void;
}

// Cross-service mixin
class EncryptionAtRest implements IMixin {
  supports(construct: IConstruct): construct is IEncryptable {
    return 'setEncryption' in construct; // or explicit list of resources if auto-genned
  }

  applyTo(resource: IEncryptable): IEncryptable {
    resource.setEncryption({
      algorithm: "aws:kms",
      bucketKeyEnabled: true
    });
    return resource;
  }
}
```
