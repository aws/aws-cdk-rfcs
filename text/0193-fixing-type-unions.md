---
feature name: fixing-type-unions
start date: 2020-07-06
rfc pr: 194
related issue: 193
---

# Summary

_Type unions_ is a feature of the TypeScript language that allows typing values as "one of several candidate types". This is achieved by specifying a
`|`-delimited list of candidate types (e.g: `Foo | Bar`). While this feature is common in dynamic languages (**TypeScript**, **Python**, ...), it is
almost always absent from statically typed languages (**Java**, **C#**, ...). In those languages, the impossibility to represent _type unions_
natively results in degraded developer experience due to the reduced fidelity of the generated typings.

This RFC proposes to introduce new features in the _jsii_ compiler to support generation of additional code that will allow statically typed languages
to benefit from the flexibility of type unions without having to endure the experience degradations they are currently exposed to.

# Release Notes

## For the _jsii_ project

Use of **TypeScript** _type unions_ on any visible APIs (`public` or `protected` members of `export`ed types) within _jsii libraries_ must be named
through the use of an exported type alias, and all those visible APIs must refer to the union using the alias:

```ts
export type ShinyUnion = Foo | Bar | Baz;

export interface FancyProps {
  readonly union: ShinyUnion;
}
```

This aliasing offers multiple benefits for library authors and users alike:

- _Type unions_ are no longer repeated in multiple locations, so that new candidates can be added in a single location
- Better code can be generated to support _type union_ APIs in languages without native support for type unions (most statically typed languages, such
  as **C#**, **Go**, **Java**, ...)
- Safer code can be authored, since _type unions_ no longer have to be frowned upon: all unsafe usage of **TypeScript**'s `as any` to force a `Lazy`
  value can be replaced with a safer API using a _type union_ with `IResolvable`

An important thing to keep in mind is that changing the type of a parameter to a _type union_ is a breaking change for those languages that do not
natively support _type unions_. The `jsii-diff` tool can be used to automatically check that you incurred no such breakage on an API that was declared
`@stable`. If you need to change a `@stable` API to support _type unions_ when it previously accepted only a single type, the easiest solution is to
deprecate the current `@stable` API and introduce a new one that accepts or returns the _type union_.

## For the _AWS CDK_

APIs of the CDK for **Java** and **.NET** where the **TypeScript** version is declared using **type unions** (e.g:
`CfnBucket.LoggingConfigurationProperty | IResolvable`) have been updated to offer better type fidelity compared to the **TypeScript** version.

For all affected parameters, an additional overload is available, accepting a named _union-like_ class:

```java
CfnBucket.Builder.create(this, "MyBucket")
  // ...
  .loggingConfiguration(LoggingConfigurationPropertyValue.fromIResolvable(lazyValue))
  // ...
  .build();
```

This _union-like_ type is also returned from methods instead of `Object`:

```java
final CfnBucket bucket = createBucket();

// Attempt getting the value as an `IResolvable` instance (returns null if the instance is *definitely not* an IResolvable).
@Nullable
final IResolvable value = bucket.getLoggingConfiguration().asIResolvable();
```

This API increases the ability for static stype checking to identify programming errors, allowing developers using those languages to confidently
write safe code.

# Motivation

Existing use-cases are documented [in annex](#existing-use-cases).

## Problems with the current implementation

While Dynamic languages typically support _type unions_ without problems, statically typed languages such as **C#**, **Go** and **Java** lack native
support for those types. The resulting developer experience degradations are detailed in this section, with a **Java** example based on the use-case
examples listed above where possible.

### Return values cannot be accurately typed

When a method or property returns a _type union_, statically typed languages are simply unable to express that and must instead fall-back to the
generic common super-type (e.g: `java.lang.Object` in **Java**):

```java
public class CfnFunction {
  // ...
  public interface EventSourceProperty {
    // ...
    public Object getProperties();
    // ...
  }
  // ...
}
```

This makes it more difficult for **Java** developers to write _correct_ and _safe_ code, since static type analysis cannot help identifying issues.
Mistakes will typically result in a `ClassCastException` being thrown. This is also a degradation in the documentation experience, since the type
signature of methods is no longer accurate.

### Type-safe overloads cannot always be generated

Since most statically typed languages support _overloads_ (although **Go** does not) we are often able to leverage overloads to provide type-safe
entry points, for example in the **Java** fluent builders:

```java
public class CfnFunction {
  // ...
  public interface Builder extends Builder<CfnFunction> {
    // ....
    public Builder properties(final S3EventProperty value);
    public Builder properties(final SNSEventProperty value);
    public Builder properties(final SQSEventProperty value);
    public Builder properties(final KinesisEventProperty value);
    public Builder properties(final DynamoDBEventProperty value);
    public Builder properties(final ApiEventProperty value);
    public Builder properties(final ScheduleEventProperty value);
    public Builder properties(final CloudWatchEventEventProperty value);
    public Builder properties(final CloudWatchLogsEventProperty value);
    public Builder properties(final IoTRuleEventProperty value);
    public Builder properties(final AlexaSkillEventProperty value);
    public Builder properties(final EventBridgeRuleEventProperty value);
    public Builder properties(final IResolvable value);
  }
  // ...
}
```

A similar pattern is used for methods, where an overload must be generated for each possible combination of _type union_ candidates. This can be
problematic if a method accepts multiple _union-typed_ parameters, as this can lead to an explosion of overloads (although this is not a common
use-case and is mostly a stylistic concern).

Certain statically typed languages are however unable to express certain combinations of _type union_ candidates because of the way _generics_ (while
_generics_ are not supported in _jsii_ libraries, they are typically used in code generation for emitting _collection_ types such as `List<T>` and
`Map<String, T>`) are _[reified][reification]_.

The exact impact of this issue is largely language dependent, for example, the **Java** compiler uses _[type erasure]_ as it's _[reification]_
mechanism:

| Source Code      | Erasure |
| ---------------- | ------- |
| `List<T>`        | `List`  |
| `Map<String, T>` | `Map`   |

This means that the following hypothetical interface:

```ts
export interface IErasureProblem {
  demonstration(list: string[] | number[]): void;
}
```

Cannot be expressed in a satisfactory way in **Java**:

```java
public interface IErasureProblem {
  public void demonstration(final List<String> list);

  // error: name clash: demonstration(List) and demonstration(List) have the same erasure
  public void demonstration(final List<Integer> list);
}
```

Instead, it must be rendered as:

```java
public interface IErasureProblem {
  public void demonstration(final List<?> list);
}
```

[reification]: https://en.wikipedia.org/wiki/Reification_(computer_science)
[type erasure]: https://docs.oracle.com/javase/tutorial/java/generics/erasure.html

### Impossible to express collections of a _type union_

Similar to the issue with generating method overrides, there is no way in statically typed languages to express a collection of a _type union_.

```java
public class CfnAlias {
  // ...
  public interface AliasRoutingConfigurationProperty {
    // ...
    public interface Builder extends Builder<AliasRoutingConfigurationProperty> {
      // ...
      // Impossible to express Array<CfnAlias.VersionWeightProperty | cdk.IResolvable> in java
      public Builder additionalVersionWeights(final List<?> value);
      public Builder additionalVersionWeights(final IResolvable value);
      // ...
    }
    // ...
  }
  // ...
}
```

### Bugs in the Kernel

Currently, the _jsii Kernel_ protocol requires each object instance is annotated with exactly one type, and this type is expected to match the dynamic
type of the instance. Concretely, this means the value returned from **Javascript** to **Java** via a return type annotated as a _type union_ is
expected to be one of the union candidates.

While this poses no problems in the case of unions of classes known to _jsii_ (those classes that are exported from a _jsii library_, and hence have
an assigned _jsii FQN_) can be annotated with their _real_ dynamic type without problems. However in the case where the returned value is an object
literal (either a struct literal, or an anonymous interface implementation), the **Javascript** runtime provides no way to determine which struct or
interface of the _type union_ candidates is implemented by the value.

Taking the example of `AWS::SAM::Function`'s `events` property, the union of possible event sources types only includes structs, and one of the
candidates, `AlexaSkill` has no required properties, meaning _any_ object actually satisfies it's specification.

In those cases, the current _jsii kernel_ will actually annotate _all_ instances with the first candidate type it investigates (regardless of whether
the instance conforms to it's specification or not). While schema validation could be performed to only use a particular option if the instance
conforms to it's schema, it would not allow solving the ambiguity around items without any required property (rejecting the presence of additional
property would make the runtime validation stricter than what the **TypeScript** language does). Additionally, it is impossible to differentiate
method implementations from one another at run-time, since the **Javascript** runtime does not retain type information for method arguments and return
types (making homonymous methods impossible to tell apart).

## Requirements

The ideal situation is one where developers enjoy the same features and type safety from any programming language, regardless of it's dynamic or
statically typed nature. This means a solution needs to satisfy the following requirements:

- _Type unions_ can be returned in a type-safe manner from methods and properties
- _Type unions_ can be instantiated & passed into methods or assigned to properties in a type-safe manner
- _Type unions_ can be used as the element type of collections (_map_, _list_)
- _Type unions_ can be received as parameters of native method orverrides (when a **Javascript** method or property is overridden from a class in
  another language)

On the other hand, a solution may involve generating code that is substantially different from one language to the other. This means statically typed
languages can leverage additional generated code in order to satisfy the requirements mentioned above without introducing unwanted boilerplate in
dynamic languages that do not need that.

# Design Summary

This feature is designed in such a way that it can be gradually rolled out into codebases, so that AWS CDK v1 customers can start to benefit from the
enhanced type safety features it offers to statically typed languages.

First, the _jsii assembly_ schema needs to be augmented so that it can represent _type unions_ as part of a library's exported type system. This
introduces a new type `kind`, and those will coexist with _classes_, _interfaces_ and _enums_ within the `types` section of the assembly. The required
information is straight forward:

| Property           | Type                                 | Required     | Description                                         |
| ------------------ | ------------------------------------ | ------------ | --------------------------------------------------- |
| `name`             | `string`                             | **Required** | The unqualified name of the union type              |
| `fqn`              | `string`                             | **Required** | The _jsii_ fully-qualified name of the type         |
| `kind`             | `@jsii/spec.TypeKind.NamedUnionType` | **Required** | The type kind discriminator                         |
| `assembly`         | `string`                             | **Required** | The name of the assembly containing the union type  |
| `types`            | `@jsii/spec.TypeReference[]`         | **Required** | The _jsii_ fully-qualified names of candidate types |
| `namespace`        | `string`                             |              | The namespace in which the union type is declared   |
| `docs`             | `@jsii/spec.Docs`                    |              | Any documentation attached to the union type        |
| `locationInModule` | `@jsii/spec.SourceLocation`          |              | The source location of the type alias declaration   |

The `jsii` compiler will then be modified in order to locate and process exported _union type_ alias declarations, such as:

```ts
export type UnionType = CandidateA | CandidateB;
```

In order to ensure ability to generate stable code for _union-like_ types in statically typed languages, the possible _candidate types_ of an aliased
_type union_ must however be restricted (through `jsii` compile-time validation) to prevent name collisions:

- all candidates **must** have distinct _unqalified names_:

  ```ts
  // Invalid: both types have the unqualified name `Construct`
  export type InvalidUnion = cdk.Construct | constructs.Construct;
  ```

- no candidate type can have a name starting with `ListOf` or `MapOf` followed by an upper-case letter:

  ```ts
  // Invalid: ListOfFoo would collide with generated union-like accessors for `Foo[]`
  export type InvalidUnion = ListOfFoo | Bar;
  ```

  - A warning could be emitted whenever any type is given a name prefixed with `ListOf` or `MapOf` to inform users that those types will not be
    useable in type unions (so they will not _discover_ about this limitation only when they attempt to create a union including the type)

In order to preserve backwards-compatbility, and to retain ability to use this new feature against the current CDK v1 codebase, the `jsii` compiler
will **not require** that _type unions_ are aliased. It will continue processing inline (i.e: not aliased) _type unions_ and generating code for those
in the way it currently does. Only aliased _type unions_ will trigger emission of _union-like_ types.

Once this done, the `cfn2ts` tool, which is used in the CDK to generate _CloudFormation Resources_ (also known as _L1 constructs_) will be modified so
that it emits aliased _type unions_ for any properties **introduced after** the latest release of AWS CDK v1. This behavior can be achieved by storing
a list of all properties found in the CloudFormation Resource Specification at the time of that release, and branching code-generation based on
whether the property is in the list or not.

In order to gradually enahnce the developer experience in statically typed languages, a new `awslint` rule will be introduced to prohibit introduction
of new inline _type unions_. Exceptions will be added for all existing APIs.

## Generating _union-like_ types

Code generation needs to be changed in `jsii-pacmak` so that languages without native support for _type unions_ (**C#**, **Go**, and **Java**) have
additional _union-like_ types emitted. The proposed API for a union such as `export type UnionType = Foo | Map<Bar> | Baz[]` in each currently
supported statically typed language is the following (subject ot change):

- In **C#**

  ```csharp
  // UnionType.cs
  public sealed class UnionType {
    public static UnionType FromFoo(Foo value) { /* ... */ }
    public static UnionType FromMapOfBar(IReadOnlyDictionary<Bar> value) { /* ... */ }
    public static UnionType FromListOfBaz(IReadOnlyList<Baz> value) { /* ... */ }

    public Foo? Foo { get; }
    public IReadOnlyDictionary<Bar>? MapOfBar { get; }
    public IReadOnlyList<Baz>? ListOfBaz { get; }

    // Private constructor ensures all initialization happens though the factories
    private UnionType(/*...*/) { /*...*/ }
  }
  ```

- In **Go**:

  > :construction: TBD

- In **Java**:

  ```java
  // UnionType.java
  public abstract class UnionType {
    public static UnionType fromFoo(Foo value) {
      return new UnionType.FooUnionType(value);
    }
    public static UnionType fromMapOfBar(Map<String, Bar> value) {
      return new UnionType.MapOfBarUnionType(value);
    }
    public static UnionType fromListOfBaz(Baz... value) {
      return fromListOfBaz(Arrays.asList(value));
    }
    public static UnionType fromListOfBaz(List<Baz> value) {
      return new UnionType.ListOfBaz(value);
    }

    public @Nullable Foo asFoo() { return null; }
    public @Nullable Map<String, Bar> asMapOfBar() { return null; }
    public @Nullable List<Baz> asListOfBaz() { return null; }

    // Private constructor ensures all initialization happens through the factories
    private UnionType(/* ... */) { /* ... */ }

    private static final class FooUnionType extends UnionType { /*...*/ }
    private static final class MapOfBarUnionType extends UnionType { /*...*/ }
    private static final class ListOfBazUnionType extends UnionType { /*...*/ }
  }
  ```

The _jsii Kernel_ will need adjustments in order to better support those types. The generated libraries will provide a new argument to the _jsii
kernel_'s `load` API if it's code was generated with `--union-like-types` enabled. This way, the kernel will be bale to reference the declared _type
union_'s information when annotating instances that are passed from **Javascript** to the host application, removing all ambiguity regarding which
type is serialized.

# Drawbacks

This approach may allow developers in statically typed languages to cause _undefined behavior_ to occur if they are not provided with a way to
validate whether a _union-like_ instancs is of a candidate type or not. Without such an API, developers may use an invalid `as<TypeName>` accessor and
retrive a proxy that may behave unexpectedly. This behavior is however identical to what happens in **TypeScript** when developers use `as any` to
evade type checking.

# Rationale and Alternatives

Improving support for _type unions_ appears to be the best way going forward, as complete removal of type unions has proven to be challenging from an
API design pespective: it tends to make the experience significantly worse for dynamic languages (as boilerplate-heavy patterns must be leveraged as a
replacement for _type unions_), and would reduce the flexibility in language-specific code generation for _union-like_ types (as those would be bound
to the **TypeScript** API). Full support of _type unions_ as a type kind in the _jsii type model_ achieves better outcomes:

- it ensures consistency around _union-like_ types
- it does not degrade the developer experience in languages with _native type_ union support
- it requires significantly less effort from library authors

# Adoption Strategy

Leveraging aliased _type unions_ in all existing CDK APIs would be a breaking change for all statically typed bindings. As such, the initial rollout
will start as early as possible in AWS CDK v1, however existing APIs will not be updated to leverage aliased _type unions_, preserving all existing
APIs.

If the solution is ready on time, it may be possible to update all existing APIs to aliased _type unions_ as part of the [AWS CDK v2] release,
although this is not a hard requirement: those APIs that are currently (in AWS CDK v1) unusable in **C#** and **Java** can be intentionally updated
outside of the context of a new major version, since existing code is already broken.

[aws cdk v2]: https://github.com/aws/aws-cdk-rfcs/issues/79

# Unresolved questions

- Are there type union patterns that will be problematic when generating union-like types?
- Are there better API patterns we could leverage in various languages?

# Future Possibilities

It will be possible in the future to make the `jsii` compiler **require** aliased _type unions_, ensuring the best possible experience for developers
in static languages. This can either be introduced in the current version of `jsii` though a new option (e.g: `--strict=type-union`); alternatively, a
new major version could be released that does **not** support inline _type unions_ at all.

As `jsii` gained the ability to track _type aliases_, more use for type aliasing can be considered valid. In particular, certain aliasing can be
leveraged to disambiguate class names in certain contexts. For example, when renaming a class as part of a refactoring, a `@deprecated` type alias can
be provided as a way to maintain compatibility with the old name at very little cost.

# Implementation Plan

- [ ] Implement support for aliased _type unions_ in `jsii`
- [ ] Implement _union-like_ type emission in `jsii-pacmak`
  - [ ] in **C#**
  - [ ] in **Java**
  - [ ] in **Go**
- [ ] Maje `jsii-diff` aware of aliased _type-unions_ (changing from inline to aliased, or back, is a breaking change)
- [ ] Generate type aliases for new properties in `cfn2ts`
- [ ] Implement `awslint` rule to prevent introduction of new un-aliased _type unions_

---

# Annex 1

Usage of type unions on types outsode of the _CloudFormation Resources_ as of _July 7, 2020_, obtained by scanning `monocdk-experiment` using
`jsii-reflect`:

```
monocdk-experiment.aws_apigateway.JsonSchema
  -> PROPERTY: contains?: monocdk-experiment.aws_apigateway.JsonSchema | Array<monocdk-experiment.aws_apigateway.JsonSchema>
  -> PROPERTY: items?: monocdk-experiment.aws_apigateway.JsonSchema | Array<monocdk-experiment.aws_apigateway.JsonSchema>
  -> PROPERTY: type?: monocdk-experiment.aws_apigateway.JsonSchemaType | Array<monocdk-experiment.aws_apigateway.JsonSchemaType>

monocdk-experiment.aws_appsync.BaseResolverProps
  -> PROPERTY: pipelineConfig?: monocdk-experiment.aws_appsync.CfnResolver.PipelineConfigProperty | monocdk-experiment.IResolvable

monocdk-experiment.aws_appsync.ExtendedDataSourceProps
  -> PROPERTY: dynamoDbConfig?: monocdk-experiment.aws_appsync.CfnDataSource.DynamoDBConfigProperty | monocdk-experiment.IResolvable
  -> PROPERTY: elasticsearchConfig?: monocdk-experiment.aws_appsync.CfnDataSource.ElasticsearchConfigProperty | monocdk-experiment.IResolvable
  -> PROPERTY: httpConfig?: monocdk-experiment.aws_appsync.CfnDataSource.HttpConfigProperty | monocdk-experiment.IResolvable
  -> PROPERTY: lambdaConfig?: monocdk-experiment.aws_appsync.CfnDataSource.LambdaConfigProperty | monocdk-experiment.IResolvable
  -> PROPERTY: relationalDatabaseConfig?: monocdk-experiment.aws_appsync.CfnDataSource.RelationalDatabaseConfigProperty | monocdk-experiment.IResolvable

monocdk-experiment.aws_appsync.LogConfig
  -> PROPERTY: excludeVerboseContent?: boolean | monocdk-experiment.IResolvable

monocdk-experiment.cloud_assembly_schema.ArtifactManifest
  -> PROPERTY: properties?: monocdk-experiment.cloud_assembly_schema.AwsCloudFormationStackProperties | monocdk-experiment.cloud_assembly_schema.AssetManifestProperties | monocdk-experiment.cloud_assembly_schema.TreeArtifactProperties | monocdk-experiment.cloud_assembly_schema.NestedCloudAssemblyProperties

monocdk-experiment.cloud_assembly_schema.MetadataEntry
  -> PROPERTY: data?: string | monocdk-experiment.cloud_assembly_schema.FileAssetMetadataEntry | monocdk-experiment.cloud_assembly_schema.ContainerImageAssetMetadataEntry | Array<monocdk-experiment.cloud_assembly_schema.Tag>

monocdk-experiment.cloud_assembly_schema.MissingContext
  -> PROPERTY: props: monocdk-experiment.cloud_assembly_schema.AmiContextQuery | monocdk-experiment.cloud_assembly_schema.AvailabilityZonesContextQuery | monocdk-experiment.cloud_assembly_schema.HostedZoneContextQuery | monocdk-experiment.cloud_assembly_schema.SSMParameterContextQuery | monocdk-experiment.cloud_assembly_schema.VpcContextQuery | monocdk-experiment.cloud_assembly_schema.EndpointServiceAvailabilityZonesContextQuery
```

The script used to extract this dataset is the following:

```ts
import * as chalk from 'chalk';
import * as reflect from 'jsii-reflect';

const typeSystem = new reflect.TypeSystem();
typeSystem.load(process.argv[2]).then((_assembly) => {
  const unionUsages = [
    ...typeSystem.methods.filter(
      (method) => method.returns?.type?.unionOfTypes != null || method.parameters.some((param) => param.type.unionOfTypes != null),
    ),
    ...typeSystem.properties.filter((prop) => prop.type.unionOfTypes != null),
  ].reduce((acc, elt) => {
    const key = elt.definingType.fqn;
    acc[key] = acc[key] ?? [];
    acc[key].push(elt);
    return acc;
  }, {} as Record<string, Array<reflect.Method | reflect.Property>>);

  for (const [type, uses] of Object.entries(unionUsages)) {
    if (type.includes('.Cfn')) {
      continue;
    }

    console.log(chalk.blueBright(type));
    for (const use of uses) {
      let description: string;
      if (reflect.isMethod(use)) {
        const params = use.parameters.map((param) => {
          let typeIfNeeded: string = param.optional ? '?' : '';
          if (param.type.unionOfTypes != null) {
            typeIfNeeded += `: ${chalk.redBright(param.type.toString())}`;
          }
          return `${chalk.gray(param.name)}${typeIfNeeded}`;
        });
        const returnType =
          use.returns.type.unionOfTypes != null ? chalk.redBright(use.returns.type.toString()) : chalk.greenBright(use.returns.type.toString());
        description = `METHOD:   ${chalk.gray(use.name)}(${params.join(', ')}): ${returnType}`;
      } else {
        description = `PROPERTY: ${chalk.gray(use.name)}${use.optional ? '?' : ''}: ${chalk.redBright(use.type)}`;
      }
      console.log(`  -> ${description}`);
    }
    console.log('');
  }
});
```

# Annex 2

## Existing use-cases

_Type unions_ are a very useful feature in API designs within the CDK, as they offer the flexibility required in order to allow users to specify
values either using immediate values (available at synthesis time) or lazy values (either resolved later during the synthesis process, or within the
provisioning engine during deployment). For example, consider the following props interface (trimmed for brevity):

```ts
// @aws-cdk/aws-s3/lib/s3.generated.ts
export interface CfnBucketProps {
  // ...
  readonly accelerateConfiguration?: CfnBucket.AccelerateConfigurationProperty | cdk.IResolvable;
  // ...
}
export namespace CfnBucket {
  // ...
  export interface AccelerateConfigurationProperty {
    // ...
    readonly accelerationStatus: string;
    // ...
  }
}
```

In certain cases, _type unions_ also need to be expressed in collection contexts (particularly _lists_):

```ts
// @aws-cdk/aws-lambda/lib/lambda.generated.ts
export namespace CfnAlias {
  // ...
  export interface AliasRoutingConfigurationProperty {
    // ...
    readonly additionalVersionWeights: Array<CfnAlias.VersionWeightProperty | cdk.IResolvable> | cdk.IResolvable;
    // ...
  }
  // ...
}
```

Additionally, the [CloudFormation Registry Schema] is a subset of [JSON Schema Draft-07][json-schema-draft-07], which allows for properties to have
multiple valid value types, which is naturally expressed in the form of a _type union_ in **TypeScript**. This is already anecdotically used in the
[AWS Serverless Application Model], where the [`AWS::Serverless::Function` Events] property leverages a _type union_ of multiple possible event types,
and the `S3EventProperty` candidate also supports specifying values as a scalar or array (a developer experience improvement in languages where _type
unions_ are available):

```ts
// @aws-cdk/aws-sam/lib/sam.generated.ts
export namespace CfnFunction {
  // ...
  export interface EventSourceProperty {
    // ...
    readonly properties:
      | CfnFunction.S3EventProperty
      | CfnFunction.SNSEventProperty
      | CfnFunction.SQSEventProperty
      | CfnFunction.KinesisEventProperty
      | CfnFunction.DynamoDBEventProperty
      | CfnFunction.ApiEventProperty
      | CfnFunction.ScheduleEventProperty
      | CfnFunction.CloudWatchEventEventProperty
      | CfnFunction.CloudWatchLogsEventProperty
      | CfnFunction.IoTRuleEventProperty
      | CfnFunction.AlexaSkillEventProperty
      | CfnFunction.EventBridgeRuleEventProperty
      | cdk.IResolvable;
    // ...
  }
  // ...
  export interface S3EventProperty {
    // ...
    readonly events: string[] | string | cdk.IResolvable;
    // ...
  }
}
```

[cloudformation registry schema]: https://docs.aws.amazon.com/cloudformation-cli/latest/userguide/resource-type-schema.html
[json-schema-draft-07]: https://json-schema.org/draft-07/json-schema-release-notes.html
[aws serverless application model]: https://github.com/awslabs/serverless-application-model
[`aws::serverless::function` events]:
  https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html#sam-function-events
