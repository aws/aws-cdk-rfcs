---
feature name: appsync-mapping-template-object-model
start date: 2020-06-16
rfc pr: https://github.com/aws/aws-cdk-rfcs/pull/177
related issue: https://github.com/aws/aws-cdk-rfcs/issues/175
---

# Summary

AppSync Mapping Templates apply complex transformations to incoming GraphQL
requests and to the responses from the data sources. They are written in the Velocity Template Language (VTL).

AppSync enhances the VTL with additional contextual objects, exposing utilities related to
GraphQL (such as the request arguments) or to the wider AWS ecosystem (such as the DynamoDB response or the Cognito identity of the authenticated user).

In the CDK, as well as in the console, the templates are written as raw strings.
This document proposes an object model for VTL, enhanced with AppSync's
utilities. The goal is to provide a strongly-typed interface that prevents
common errors, aids discoverability, and provides syntatic sugar for dealing
with data sources.

This document assumes familiarity with the AppSync developers guide.

An implementation of this model is in
[duarten/appsync-mapping-templates](https://github.com/duarten/appsync-mapping-templates),
with packages published
[here](https://www.npmjs.com/package/app-sync-mapping-template-model).

# Motivation

This is a Mapping Template written as a string, mapping a request to a DynamoDB Put Item operation.

```velocity
{
  "version": "2017-02-28",
  "operation": "PutItem",
  "key": {
    "todoid": { "S": "$context.arguments.todoid" },
    "commentid": { "S": "$util.autoId()" }
  },
  "attributeValues" : $util.dynamodb.toMapValuesJson($ctx.args)
}
```

Notice the issues:

1. It contains boilerplate, like specifying the type of operation or the API version;
2. It requires knowing the request format, since there's no API to guide developers;
3. Utilities are likewise not discoverable, like `$util.autoId()`.

The CDK already provides a better infrastructure for this (to which I contributed), as we can write:

```ts
MappingTemplate.dynamoDbPutItem(
  PrimaryKey.partition("todoid").is("todoid").sort("commentid").auto(),
  Values.projecting()
);
```

Notice, however, that it doesn't help discovering some of the utilities
AppSync exposes.

There's also a bug, which is that it assumes `"todoid"` must come from the
GraphQL payload, but we could wish to pass in a variable (defined with the
`#set` directive).

Finally, the fluent interface, which I like, is at odds with how the CDK exposes
configuration in other modules, which is through Javascript object syntax.

# Basic Example

A holistic solution to these problems would look like:

```ts
Api.requestTemplate((r) => {
  const id = r.variable("ENTITY#" + r.util.autoId());
  r.if(r.ctx.identity.groups.contains(r.literal("admins")).not(), () => {
    r.util.unauthorized();
  });
  r.dynamoDb.transactWriteItems(
    r.dynamoDb.transaction.putItem({
      tableName: "mytable",
      key: {
        pk: id,
        sk: r.ctx.arg("arg"),
      },
    }),
    r.dynamoDb.transaction.putItem({
      tableName: "mytable",
      key: {
        pk: id,
        sk: "group",
      },
      attributeValues: {
        projecting: mt.ctx.args(),
        values: {
          name: mt.ctx.arg("name"),
          ts: r.util.time.nowEpochMilliSeconds(),
        },
      },
    })
  );
});
```

# Design Summary

We provide an object model for [VTL References](https://velocity.apache.org/engine/1.7/vtl-reference.html#references),
on top of which we implement the AppSync utilities, such as access to the
GraphQL arguments.

A template is produced by a user function that takes in a
`TemplateBuilder` object and returns nothing. The `TemplateBuilder` object
exposes the object model, which incrementally builds the template.

The entry point is a global `Api` object (better name wanted), which receives
that template-producing function either through the `requestTemplate` method
or through the `responseTemplate` method. We distinguish between requests and
responses because AppSync exposes different utilities for each.

The core abstraction is the `MappingTemplate`, similar to the one that exists today:

```ts
export abstract class MappingTemplate {
  public abstract renderTemplate(
    version: MappingTemplateVersion,
    indentation: number
  ): string;

  public static from(
    mt: (version: MappingTemplateVersion, indent: number) => string
  ): MappingTemplate {
    return new (class extends MappingTemplate {
      public renderTemplate(
        version: MappingTemplateVersion,
        indent: number
      ): string {
        return mt(version, indent);
      }
    })();
  }
}
```

We enhance it with the AppSync version, and with a pretty-print mechanism.

The `from` method represents an escape hatch, which can be used to create any
template.

# Detailed Design

The cornerstone of the design is the Reference hierarchy, which represent VTL references.
A reference is a variable, a method, or a property (shorthand for a method).
They have relational and arithmatic operators.

```ts
abstract class Reference extends MappingTemplate {
  public quiet(): this;
  public invoke(method: string, ...args: unknown[]): Method;
  public access(k: string): VariableOrProperty;

  // Relational operators
  public eq(other: unknown): Reference;
  public ne(other: unknown): Reference;

  // Arithmatic operators
  public add(other: unknown): Reference;
  public sub(other: unknown): Reference;
}
```

A reference is of type `string`, `number`, `boolean`, `array`, or `map`. Methods
can be invoked on references, and properties can be accessed. While we don't
propose it here, we note that it's possible to do type checking (at runtime): we
know the signatures of the AppSync utilities, and we know the underlying Java types
of the VTL types.

Note that we use the top type `unknown` for arguments to `invoke` and to the operators.
This allows users to use literal values in the native language instead of having
to use the `Reference` wrapper `Literal`.

Although we would like to write code as normally as possible, because we can't
rely on operator overload, we have to spell out the operators and define them as
instance methods of `Reference`.

Each subtype of Reference (i.e., `VariableOrProperty`, `Method`, and `Literal`)
knows how to render itself as a VTL string.

## AppSync Utilities

AppSync utilities are built on top of `References`. Consider the `context`
object:

```ts
class Context {
    readonly ctx: Reference
    public constructor(protected readonly builder: TemplateBuilder) {
        this.ctx = new VariableOrProperty(this.builder, "ctx")
    }

    public args(): Reference {
        return this.ctx.access("args")
    }

    // ...
}
```

It encapsulates a reference to the `ctx` object, and properties like
`args` are implemented as accesses. We use the same approach for other objects,
like `util`.

Like we mentioned before, we could enrich these objects with type information,
which is currently erased.

Finally, we note that with access to generics, we could provide a better API to
access, for example, the GraphQL request arguments, but since they are forbidden
by JSII, we don't discuss that approach.

## Data Sources

Data sources render JSON objects specific to a particular AWS service. They are
written as specific `MappingTemplates`, outside of the `Reference` model.

The `MappingTemplate` for the DynamoDB `putItem` operation can be modeled as:

```ts
class DynamoDbRequestUtils {
    public constructor(readonly builder: TemplateBuilder) {}

    public putItem(props: PutItemProps): void
}
```

`putItem` uses the `TemplateBuilder` to append `MappingTemplate`s to the current
template.

Note how it receives an object with the properties for the operation. This
allows us to leverage the host language to perform validation and compile and
deploy time, which before was only possible to do at execution time, in the
cloud.

We can take this further and enhance our object model with validation. The
`TemplateBuilder` could, for example, prevent multiple DynamoDB operations to be
created outside the scope of a batch or transaction (and in those cases, it
could validate how many operations were being included in the batch or
transaction).

## Directives and Evaluation Model

There are three stages during the evaluation of a template in the proposed
model:

1) a reference is created, which can represent a variable, a property access,
   or a method call;
2) a `MappingTemplate` is added to a template tree;
   this can be due to an action on a reference (such as consuming a method
   call) or because we produced the template for a data source;
3) the `MappingTemplates` are transformed, sequentially, into strings.

The difference between 1 and 2 is interesting. In 1 we create a
`MappingTemplate`, but don't specify in which __tree__ it should be contained:
whether in the tree of a loop, or whether in the main body of the
template. In 2 we are effectively specifying the place where that
`MappingTemplate` should appear in the emitted string, which is calculated in
the last step.

For example, consider the following template:

```ts
const start = r.literal(0)
const end = r.literal(5)
r.foreach([start.to(end)], i => {
    myMap.put(i, `${i}foo`)
})
```

There are two `Reference`s, `start` and `end`, which are used to produce a third
`Reference` through the VTL range operator, which we call `to`. Nothing happens
when that `Reference` is created; it is only when it is passed to the `foreach`
function that it gets added to the tree of the `foreach`, itself contained in
the main list of the current template.

The control-flow directives, like `foreach`, are accessed through the
`TemplateBuilder`, like everything else.

# Drawbacks

The only drawback I see is the maintenance burden this entails, since we're
talking about a large API surface. Other than that, I think it improves
significantly the status quo, and someone (me) is already doing parts of the
work.

This could be implemented as an external library; there could be many of
those, each with its own model. However, I think the CDK should have an
ergonomic solution for this problem, to minimize the bugs and frustration
involved in writing the templates as strings and also to foster knowledge
sharing through an official approach.

# Rationale and Alternatives

We could think of alternative designs, such as enhancing the current fluent
interface, although that has the disadvantage of being out of tune with
respect to the rest of the CDK.

Another approach would be to a more functional interface, at the expense of
some nesting. For example:

```typescript
withVariables({ id: `"ENTITY#" + ${autoId()}`, ts: now() }, ({ id, ts }) =>
  sequence(
    ensureUserIsAdmin(),
    dynamoDbTransactWriteItems(...),
  )
)

```

Again, just the API would change. I think the implementation benefits from
the intermediate representation that we propose.

# Adoption Strategy

The AppSync API is experimental and thus breaking changes such as this one,
while inconvenient, are allowed.

# Unresolved questions

Maybe this API is too generic and there is some common pattern to templates
that we could explore to provide some more structure. For example, if
templates follow a pattern where they perform:

1. Input validation
2. Variable declaration
3. Transformations
4. Operation execution

Then we could leverage this to provide a more constrained API, such that we
wouldn't even need to perform validation steps. It could very well be the
case that this turns out to be too restrictive, but there's a case to be made
that it's easier to generalize a public API than it is to later restrict it.

# Future Possibilities

API Gateway also relies on templates. Although less powerful, they could
probably benefit from following this design.

We can also envision high-level APIs for HTTP data sources, such as AWS Athena,
to be built on top of this object model, without them having to be built into
AWS AppSync.
