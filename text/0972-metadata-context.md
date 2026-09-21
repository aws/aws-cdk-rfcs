# Structured Design Context in Synthesized Templates

* **Original Author(s):** @satyakigh
* **Tracking Issue**: #972
* **API Bar Raiser**: TBD

AWS Cloud Development Kit (AWS CDK) applications contain information about why each
resource exists. That information includes reasoning, hard rules that must remain true,
and how safely each resource can change. It often lives only in source comments,
the hierarchy of CDK constructs, or the author's knowledge, and is lost when the `cdk synth`
command generates a CloudFormation template. This RFC adds three application programming
interfaces (APIs) to `aws-cdk-lib`:
`ResourceMetadataContext`, `TemplateMetadataContext`, and `MetadataContextMixin`. They add
structured design information under the dedicated
`com.aws.cloudformation.Context` metadata key. People and automated tools, including
consoles, command-line tools, and artificial intelligence systems, can then use the
author's intent instead of guessing.

## Working Backwards

### CHANGELOG

```text
feat(core): embed structured design context in generated templates (MetadataContext)
```

### README

#### Metadata Context

The metadata-context APIs add structured design information that CloudFormation stores but
does not enforce under the
`com.aws.cloudformation.Context` key in generated CloudFormation templates. The information
can include reasoning, hard rules, change-safety guidance, and source and confidence.
People and automated tools that inspect a deployed template can
therefore use the author's intent instead of guessing it.

Two classes write the same documented template fields: `ResourceMetadataContext` writes
information on individual resources, and `TemplateMetadataContext` writes information once
for the whole template. `MetadataContextMixin` is a CDK Mixin, which is an API applied
directly to selected low-level `CfnResource` objects. API property names are the field names
of the published
[CloudFormation Metadata Context schema](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema),
so code and template use one vocabulary.

Add resource-level information to a construct scope with `ResourceMetadataContext`. A scope
is a node in the CDK construct hierarchy. By default, the information is written to the
scope's *primary resource*: the CloudFormation resource reached by following CDK's
`defaultChild` property. For example, the primary resource of an Amazon Simple Queue
Service (Amazon SQS) `sqs.Queue` construct is its `AWS::SQS::Queue` resource. Automatically created helper resources, such as AWS Identity
and Access Management (IAM) roles, policies, and log-retention custom resources, are not
selected by default.

```ts
declare const queue: sqs.Queue;

ResourceMetadataContext.of(queue).add({
  why: 'buffer order events asynchronously; 14-day retention meets compliance requirements',
  must: ['VisibilityTimeout must be at least six times the Lambda timeout to avoid duplicate processing'],
  mutable: ContextMutability.CHANGE_WITH_CONSTRAINTS,
  mutability: {
    QueueName: ContextMutability.MUST_NEVER_CHANGE,
  },
});
```

This renders a `com.aws.cloudformation.Context` block on the `AWS::SQS::Queue` resource. See
[Appendix A](#appendix-a---cloudformation-context-template-field-reference) for the full
field reference.

```json
{
  "Type": "AWS::SQS::Queue",
  "Metadata": {
    "com.aws.cloudformation.Context": {
      "why": "buffer order events asynchronously; 14-day retention meets compliance requirements",
      "must": [
        "VisibilityTimeout must be at least six times the Lambda timeout to avoid duplicate processing"
      ],
      "mutable": "change-with-constraints",
      "mutability": {
        "QueueName": "must-never-change"
      }
    }
  }
}
```

No `trust` block appears because the caller did not provide one. The `trust` field is
optional, and CDK never adds it automatically (see *Source and confidence* below).
`mutable` is `change-with-constraints`, and the governing rule is recorded in
`must`: `VisibilityTimeout` must remain at least six times the Lambda timeout.
`change-with-constraints` means a value may change only while its stated rules remain true;
using that value without a corresponding `must` rule gives the reader no useful guidance.

##### Resource context quality

Every top-level field is optional in the advisory schema, and CDK adds no requirements on
top of it: a resource block may contain any subset of the fields, blank strings and empty
arrays are structurally valid, and an empty declaration is a harmless no-op rather than an
emitted empty block. The following are recommendations, not enforced rules. Give each
significant resource that receives Context a `why` so a later reader knows why it exists,
and omit Context entirely for a trivial resource whose purpose is already obvious from its
type and name. Add `must` only when violating the rule would break correctness,
availability, security, data integrity, or a required dependency; never invent a rule
merely to populate the field.

Pair `must-never-change` or `change-with-constraints` with a `must` entry that states the
rule behind the restriction, so a reader sees why a value is constrained; the schema does
not require it. A `trust` block describes the source of other content, so it reads best
alongside a `why` or `must`, but using it alone is valid. Individual declarations may omit
`why` or `must` when another applicable declaration supplies them, and no template-level
field is required either.

##### Propagation is explicit

`add()` targets only the scope's primary resource; it does not automatically apply the
information to descendant constructs. A declaration must match at least one resource, or
template generation fails.

CDK finds the primary resource by following `defaultChild` repeatedly, not once. When a
construct's `defaultChild` is another construct rather than a `CfnResource`, CDK follows
that construct's `defaultChild` in turn, and continues until the chain reaches a
`CfnResource`. For example, `cloudfront.experimental.EdgeFunction` designates its internal
`lambda.Function` as its `defaultChild`, and `lambda.Function` designates its
`AWS::Lambda::Function`. A declaration on the `EdgeFunction` therefore lands on the
`AWS::Lambda::Function` and still skips the function's generated IAM role, because the role
is not on the chain. Most L2 constructs designate a `defaultChild`, so the default works for
them without options.

Whether the default works for a higher-level (L3) construct depends on whether that
construct declares a `defaultChild`:

* An L3 that designates one, as `EdgeFunction` does, behaves like an L2: the declaration
  lands on the `CfnResource` at the end of the chain.
* An L3 that does not, such as `ecs_patterns.ApplicationLoadBalancedFargateService`, a plain
  grouping `Construct`, or a `Stack`, has no primary resource. `add()` with no options then
  selects nothing, and template generation fails with an error that names the construct and
  lists the alternatives: target a child construct, or set `propagate: true` (optionally
  with a `propagationFilter`). The chain also ends without a match when it
  reaches a construct that has no `defaultChild`.
* A construct with both a `Resource` and a `Default` child has an ambiguous `defaultChild`.
  The `constructs` library throws when it is read (`Cannot determine default child for
  <path>. There is both a child with id "Resource" and id "Default"`), and template
  generation fails with that error.

Authors of L3 constructs can opt in to the default by setting `this.node.defaultChild` to
the construct or resource that best represents the pattern. The *Helper resources* section
below shows the L3 options in code.

To reach more than the primary resource, set `propagate: true`. Propagation applies the
declaration to every resource beneath the scope, helpers included; a `PropagationFilter`
narrows it by resource type:

```ts
declare const stack: Stack;
declare const queue: sqs.Queue;

// 1. Default: only the scope's primary resource.
ResourceMetadataContext.of(queue).add({
  why: 'buffers webhook events for asynchronous processing',
});

// 2. Propagate to every resource beneath the scope, helper resources included.
ResourceMetadataContext.of(stack).add({
  deps: ['NetworkStack'],
}, {
  propagate: true,
});

// 3. Propagate only to resources of a specific type. The queue above also receives
//    this declaration.
ResourceMetadataContext.of(stack).add({
  must: ['delivery settings must preserve in-flight messages'],
}, {
  propagate: true,
  propagationFilter: PropagationFilter.includeResourceTypes(['AWS::SQS::Queue']),
});

// 4. Propagate to everything except resources of a specific type.
ResourceMetadataContext.of(stack).add({
  must: ['execution roles must keep the organization permissions boundary'],
}, {
  propagate: true,
  propagationFilter: PropagationFilter.excludeResourceTypes(['AWS::Lambda::Function']),
});
```

A `propagationFilter` requires `propagate: true`; `add()` throws otherwise, because default
targeting already selects exactly one resource. A filter that excludes every candidate fails
template generation like any other declaration that matches nothing.

When several declarations apply to one resource, CDK combines them. For fields that hold
one value (`why`, `mutable`, and `trust`), the declaration closest to the
resource takes precedence. For array fields (`must` and `deps`),
CDK combines the entries and removes duplicates. For `mutability`, CDK combines the
maps and uses the closest declaration for each property name.

Propagation crosses a `NestedStack` boundary because a nested stack remains part of
the same generated application. It does not cross a `Stage`, which is a separate CDK cloud
assembly and must declare its own context.

Propagation is always explicit. Repeating the same block on many
resources can make that information appear more important than other facts and can place a
rule on resources it does not govern. If information applies to the whole template, move it
to `TemplateMetadataContext` instead. As a guideline, move information to template level
when it would otherwise be repeated on more than about three resources.

Template level here means `TemplateMetadataContext`, not the template's built-in
`Description`. The two serve different readers: `Description` is one short, unstructured
string (at most 1,024 bytes) that CloudFormation shows in the console stack list and
returns from `DescribeStacks`, so it works best as a one-line statement of what the stack is.
`TemplateMetadataContext` holds the structured fields `arch`, `must`, `ref`, and `owner`,
which are returned only inside the template body (`GetTemplate`) and answer how the system
is shaped, which rules apply everywhere, and where supporting material lives. Avoid repeating
the `Description` text in `arch`, and keep rules out of `Description`. See *Template-level
context* below for a side-by-side comparison.

To exclude information inherited from an ancestor construct, set
`inheritAncestorContext: false` on its own `add()`. The following example refers to a
customer managed key in AWS Key Management Service (AWS KMS):

```ts
declare const legacyBucket: s3.Bucket;

// This legacy bucket is exempt from the customer managed AWS KMS key requirement.
ResourceMetadataContext.of(legacyBucket).add({
  why: 'legacy public assets; migration tracked separately; approved encryption exception',
}, {
  inheritAncestorContext: false,
});
```

##### Helper resources

Default targeting skips automatically created helper resources. `lambda.Function` creates an
`AWS::Lambda::Function`, an `AWS::IAM::Role`, and optionally a dead-letter queue; `add()`
follows `defaultChild` to the function and leaves the helpers unchanged. Helpers that the L2
exposes as constructs can be targeted through it:

```ts
declare const lambdaFunction: lambda.Function;

// Applies to the AWS Lambda function, not its generated AWS IAM role.
ResourceMetadataContext.of(lambdaFunction).add({
  why: 'processes order events from an Amazon SQS queue and ignores previously processed events',
});

// A helper the L2 exposes; set when the function was created with a dead-letter queue.
if (lambdaFunction.deadLetterQueue) {
  ResourceMetadataContext.of(lambdaFunction.deadLetterQueue).add({
    why: 'stores failed order-processing invocations for later recovery',
  });
}
```

To target only an L2's helpers, propagate from the L2 and exclude the primary resource's
type; everything left beneath the L2 is a helper.

```ts
declare const lambdaFunction: lambda.Function;

// Everything the function creates except the function itself: role, policies, log group.
ResourceMetadataContext.of(lambdaFunction).add({
  deps: ['OrderProcessorFunction'],
}, {
  propagate: true,
  propagationFilter: PropagationFilter.excludeResourceTypes(['AWS::Lambda::Function']),
});
```

For a multi-resource construct with no `defaultChild`, `add()` with no options fails rather
than silently dropping the information. Target a child construct, or propagate with a type
filter. For a pattern that creates a load balancer, a service, and supporting resources:

```ts
declare const service: Construct; // e.g. an ecs_patterns.ApplicationLoadBalancedFargateService

// Apply this rule only to the Application Load Balancer created by the construct.
ResourceMetadataContext.of(service).add({
  must: ['Application Load Balancer idle timeout must be at least the backend read timeout'],
}, {
  propagate: true,
  propagationFilter: PropagationFilter.includeResourceTypes(['AWS::ElasticLoadBalancingV2::LoadBalancer']),
});
```

##### Source and confidence

Use the optional `trust` field to record where information came from and how confident the
producer is that it is correct. When `trust` is present, both `src` and `conf` are
required. CDK never supplies them automatically. The `why` field must contain the actual
reasoning; source details belong in `trust`:

```ts
declare const queue: sqs.Queue;

ResourceMetadataContext.of(queue).add({
  why: 'retry buffer for an unreliable dependent payments service',
  trust: {
    src: ContextTrustSource.INFER,
    conf: ContextTrustConfidence.LOW,
    cite: 'service/handler.ts:87',
    note: 'derived from retry behavior; no explicit design note was found',
  },
});
```

```json
{
  "Metadata": {
    "com.aws.cloudformation.Context": {
      "why": "retry buffer for an unreliable dependent payments service",
      "trust": {
        "src": "infer",
        "conf": "low",
        "cite": "service/handler.ts:87",
        "note": "derived from retry behavior; no explicit design note was found"
      }
    }
  }
}
```

The four sources are `AUTHORED` (a person wrote or explicitly confirmed the information),
`COMMENT` (taken from a source comment), `COMMIT` (taken from version-control history), and
`INFER` (a tool concluded it from code structure or behavior without an explicit statement).
`src` holds one value. When more than one fits, people and tools alike choose by this
precedence:

1. `AUTHORED` whenever a person wrote or explicitly confirmed the text, even if it
   originated in a comment, a commit message, or a tool's inference. Human confirmation is
   the strongest evidence; record the original evidence in `cite` (the comment's file and
   line, or the commit identifier) and, when useful, in `note`.
2. Otherwise, the most direct evidence: `COMMENT` when the text was copied or lightly
   rephrased from a source comment; `COMMIT` when it came from version-control history.
3. `INFER` when the tool combined evidence or reasoned from code structure or behavior
   without an explicit statement, even if a comment or commit contributed. Name the
   contributing evidence in `cite` and `note`.

For example, a tool that lifts `why` from a comment writes `src: COMMENT` and
`cite: 'lib/queue.ts:42'`; when the author reviews and accepts it, `src` becomes `AUTHORED`
and `cite` stays. Three of the four values exist for automated producers, where `src` matters
most: a reader must be able to tell tool-derived Context from Context a person stands behind.
A person writing Context directly in CDK code can omit `trust`, because the reviewed source
already shows who wrote it. The Agent Toolkit's CloudFormation and CDK skills will be
updated to carry the same rule (see *Follow-ups*). See
[Appendix A](#appendix-a---cloudformation-context-template-field-reference) for the
`trust` object.

##### Mixin form

`MetadataContextMixin` is a CDK Mixin for applying the same resource-level fields directly
to selected `CfnResource` objects. Use `.with()` for one resource, or
`Mixins.of(scope).apply()` to apply the Mixin to every matching resource under a scope. The
same merge rules described above apply.

```ts
declare const cfnQueue: sqs.CfnQueue;
declare const stack: Stack;

cfnQueue.with(new MetadataContextMixin({
  why: 'stores audit events that must remain unchanged',
  mutable: ContextMutability.MUST_NEVER_CHANGE,
  must: ['never shorten retention below 14 days'],
}));

Mixins.of(stack).apply(new MetadataContextMixin({
  deps: ['NetworkStack'],
}));
```

##### Conflict with manually added context

`com.aws.cloudformation.Context` is a normal metadata key, so callers can also write it
directly with `CfnResource.addMetadata()`. If manually added information and a metadata-
context API target the same resource and key, template generation fails instead of silently
overwriting the caller's information:

```ts
declare const queue: sqs.Queue;

// Information added directly through the low-level metadata API.
(queue.node.defaultChild as sqs.CfnQueue).addMetadata(
  'com.aws.cloudformation.Context',
  { why: 'manually added information' },
);

// The metadata-context API also targets the same resource and key.
ResourceMetadataContext.of(queue).add({ why: 'declared through the metadata-context API' });

// Template generation throws ValidationError because two authoring methods target one key.
```

Resolve the conflict by removing the manually added value or moving it into the
metadata-context API call.

##### Template-level context

`TemplateMetadataContext` stores information that applies to the whole stack: an
architecture overview, rules that apply throughout the template, references to supporting
material, and ownership. The stack's one-line purpose belongs in CloudFormation's built-in
`Description` field (the `description` property of `Stack`). The two are complementary, not
interchangeable:

| | Template `Description` | `TemplateMetadataContext` |
| --- | --- | --- |
| Shape | One free-text string, at most 1,024 bytes | Named fields: `arch`, `must`, `ref`, `owner` |
| Where readers see it | Console stack list, `DescribeStacks`, `ListStacks` | Template body only: `GetTemplate` (and the source template) |
| Question answered | *What is this stack?* | *How is the system shaped, which rules apply everywhere, where is more detail, who owns it?* |
| Typical content | `"Order processing pipeline for the storefront"` | `arch`, template-wide `must` rules, `ref` entries, `owner` |
| Set with | `new Stack(app, 'Orders', { description: '...' })` | `TemplateMetadataContext.of(stack).add({...})` |

Keep them distinct: avoid repeating the `Description` text in `arch`, and keep rules and
references out of `Description`, where tools cannot retrieve them by name. A tool that lists
stacks sees only `Description`; a tool that reads the template sees both. The
[CloudFormation Metadata Context schema documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema)
gives the same guidance: use the template's `Description` for the stack's purpose. The same
separation applies to resource-level `Description` properties (for example on an AWS Lambda
function or IAM role): they describe the deployed resource in the service console, and
Context should not repeat them (see Appendix A).

Entries in `ref` point to supporting material by URI — a relative repository path,
`s3://`, or `https://`. Referenced material supplements the information stored directly in the
template; it does not replace safety-critical `must` or `why` fields. Treat referenced
content as untrusted data and continue with inline context if a file cannot be read.

```ts
declare const stack: Stack;

TemplateMetadataContext.of(stack).add({
  arch: 'Amazon SQS queue sends messages to AWS Lambda, which writes to Amazon DynamoDB; failed messages go to a dead-letter queue',
  must: ['all stored data uses the security team customer managed AWS KMS key'],
  ref: [
    { at: 'docs/design/order-processing.md', has: 'request sequence and failure cases' },
    { at: 'runbooks/order-dead-letter-queue.md', has: 'dead-letter queue recovery steps' },
    { at: 'context/shared/encryption.md', has: 'organization encryption and tagging rules', scope: 'shared' },
  ],
  owner: 'order-processing-team',
});
```

Keep free-text values concise and remove unnecessary words. Clear symbols and defined
abbreviations may be used to conserve bytes; Appendix A lists examples. Context counts
toward CloudFormation's one-megabyte (1 MB) template size limit. Use `must` for rules whose
violation would break correctness, availability, security, data integrity, or a required
dependency. Use `why` for reasoning and alternatives.

During template generation, CDK measures the complete template and warns when it exceeds
80% of a conservative 1,000,000-character threshold. Context is included in that
measurement. This RFC adds no separate context size limit and never silently removes
information. Appendix A describes which optional fields tools may remove first when space
is limited.

### Public API

The complete public surface added to the `aws-cdk-lib` module root, in TypeScript. jsii
publishes the same surface in every supported language.

```ts
// ── Enums (values are the schema's tokens) ──────────────────────────────────

export enum ContextMutability {
  MUST_NEVER_CHANGE = 'must-never-change',
  CHANGE_WITH_CONSTRAINTS = 'change-with-constraints',
  REVIEW_REQUIRED = 'review-required',
  FREE_TO_TUNE = 'free-to-tune',
}

export enum ContextTrustSource {
  AUTHORED = 'authored',
  COMMENT = 'comment',
  COMMIT = 'commit',
  INFER = 'infer',
}

export enum ContextTrustConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// ── Structs (mirror the schema's ResourceContext, TrustObject, RefEntry, TemplateContext) ──

export interface ContextTrust {
  readonly src: ContextTrustSource;
  readonly conf: ContextTrustConfidence;
  readonly cite?: string;
  readonly note?: string;
}

export interface ContextRef {
  readonly at: string;
  readonly has?: string;
  readonly scope?: string;
}

export interface ResourceContextProps {
  readonly why?: string;
  readonly must?: string[];
  readonly mutable?: ContextMutability;
  readonly mutability?: { [propertyName: string]: ContextMutability };
  readonly trust?: ContextTrust;
  readonly deps?: string[];
}

export interface TemplateContextProps {
  readonly arch?: string;
  readonly must?: string[];
  readonly ref?: ContextRef[];
  readonly owner?: string;
}

// ── Targeting ───────────────────────────────────────────────────────────────

export interface ResourceMetadataContextOptions {
  /** Target every CfnResource beneath the scope instead of only its primary resource. @default false */
  readonly propagate?: boolean;
  /** Narrows propagation by CloudFormation resource type. Requires `propagate: true`. @default - every resource */
  readonly propagationFilter?: PropagationFilter;
  /** Inherit context merged from ancestor scopes. @default true */
  readonly inheritAncestorContext?: boolean;
  /** Priority of the underlying aspect. @default AspectPriority.MUTATING */
  readonly priority?: number;
}

export class PropagationFilter {
  public static includeResourceTypes(resourceTypes: string[]): PropagationFilter;
  public static excludeResourceTypes(resourceTypes: string[]): PropagationFilter;
  private constructor(...);
}

// ── Entry points ────────────────────────────────────────────────────────────

export class ResourceMetadataContext {
  public static of(scope: IConstruct): ResourceMetadataContext;
  public add(context: ResourceContextProps, options?: ResourceMetadataContextOptions): void;
  private constructor(...);
}

export class TemplateMetadataContext {
  public static of(stack: Stack): TemplateMetadataContext;
  public add(context: TemplateContextProps): void;
  private constructor(...);
}

export class MetadataContextMixin extends Mixin {
  constructor(context: ResourceContextProps);
  public supports(construct: IConstruct): construct is CfnResource;
  public applyTo(construct: IConstruct): void;
}
```

Behavior summary:

* `ResourceMetadataContext.of(scope).add()` targets the scope's primary resource by default
  (the scope itself when it is a `CfnResource`, otherwise the `CfnResource` at the end of
  its `defaultChild` chain). With `propagate: true` it targets every `CfnResource` beneath
  the scope, crossing `NestedStack` but never `Stage` boundaries, narrowed by an optional
  `PropagationFilter`. A `propagationFilter` without `propagate: true` throws at `add()`.
  A declaration that matches no resource fails template generation.
* Declarations merge ancestor-to-resource: the closest declaration wins for `why`, `mutable`,
  and `trust`; `must` and `deps` are unioned and de-duplicated; `mutability` merges per
  property. `inheritAncestorContext: false` discards ancestor context for that scope.
* `TemplateMetadataContext.of(stack).add()` merges repeated calls: later `arch` and `owner`
  win; `must` and `ref` accumulate. A `ref` with only `at` renders as a bare string.
* `MetadataContextMixin` applies only to `CfnResource` and delegates to
  `ResourceMetadataContext.of(resource).add(context)`.
* Validation: when `trust` is present, `src` and `conf` are required; a `mutability` entry
  must not repeat `mutable`; a `ref` entry requires `at`. Manually added
  `com.aws.cloudformation.Context` metadata colliding with an API-produced block fails
  template generation.

---

Ticking the box below indicates that the API Bar Raiser, the reviewer responsible for
public API consistency, approved this RFC (the `status/api-approved` label was applied to the
RFC pull request):

```text
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new `aws-cdk-lib` capability: two context classes, a propagation filter, and one resource
Mixin that add structured design information to the `Metadata` sections of generated CloudFormation
templates.

* `ResourceMetadataContext.of(scope).add(props, options?)` adds information to a resource.
  The information can include reasoning, hard rules, change-safety guidance, source and
  confidence, and dependencies.
  By default, CDK writes it to the scope's primary resource. `propagate: true` applies it
  to every resource beneath the scope, a `PropagationFilter` narrows that by CloudFormation
  resource type, and `inheritAncestorContext: false` excludes information inherited from
  ancestor constructs.
* `TemplateMetadataContext.of(stack).add(props)` writes an architecture overview, rules
  that apply throughout the template, references, and ownership once at template level.
* `MetadataContextMixin` applies resource-level information directly to selected
  `CfnResource` objects with `.with()`, or to every matching resource under a scope with
  `Mixins.of(scope).apply()`. It uses the same validation, merge, template-field, and
  conflict behavior as `ResourceMetadataContext`.

The dedicated `com.aws.cloudformation.Context` metadata key contains a fixed set of
resource fields (`why`, `must`, `mutable`, `mutability`, `trust`, `deps`)
and template fields (`arch`, `must`, `ref`, `owner`). The TypeScript API uses the same
names. This is ordinary CloudFormation `Metadata`: it is stored with the stack, has no effect on
running resources, and is available through the existing `GetTemplate` and
`DescribeStackResource` operations. No CloudFormation service change is required.

### Why should I use this feature?

Because the generated template is the one file that reliably reaches everyone who later
works with the infrastructure. Six months later, an engineer or artificial intelligence
assistant often has the deployed template and live stack, but not the source repository,
design document, or original author.

Concrete situations this feature addresses:

* **Reviewing changes safely** - `must` and per-property `mutability` identify properties
  that are important to correct operation. For example, before reducing
  `VisibilityTimeout`, a reviewer sees the rule that it must remain at least six times the
  Lambda timeout to avoid duplicate processing.
* **Operations and incident response** - `why` and `must` preserve information that
  would otherwise remain undocumented: why the resource exists and which rules must
  remain true. A reader can use those fields before
  changing retry or timeout settings.
* **Infrastructure changes made by artificial intelligence** - tools that read templates
  through `GetTemplate` or `DescribeStackResource` can use documented intent. A request to
  raise a Lambda timeout may conflict with a documented service-level agreement or with a
  queue visibility timeout. `must` exposes those rules before the tool makes a
  change that is valid in isolation but wrong for the system.
* **Shared organizational information** - template-level `ref` entries can point to shared
  encryption or tagging rules without copying them into every template. The `trust` field
  identifies who or what supplied information and how confident the producer is, helping a
  reader decide how much to rely on it.

These are measured results, not only expectations. The alternatives were evaluated on the
same CloudFormation update tasks. Most of the improvement came from supplying design
information in any form. Structured `com.aws.cloudformation.Context` keeps that information
in the deployed template, unlike source comments, and lets tools retrieve fields by name.
Tools explicitly instructed to use the fields performed best. Appendix B provides the
numbers and limitations.

Existing applications do not require a person to annotate every resource manually. A
companion authoring tool is being developed to read existing AWS CDK or CloudFormation
source, comments, version-control history, tests, and related service code. It then proposes
`ResourceMetadataContext` calls, or `com.aws.cloudformation.Context` values for templates
written directly, including source information in `trust`. A person
reviews that derived information before it becomes part of the application; automatic
derivation is not part of the core API.

If you already maintain design context in READMEs or wikis, this feature does not replace
them - it puts the *operationally relevant* subset where every consumer of the deployed
stack can actually find it.

## Internal FAQ

### Why are we doing this?

**Generated templates lose design information.** AWS CDK source contains useful intent in
the construct hierarchy, source comments, higher-level construct properties, and code-review
discussion. The generated template contains CloudFormation resources but does not preserve
most of that intent. `aws:cdk:path` records where a resource came from in the construct
hierarchy, not why it exists. As a result, console users, people reviewing proposed
CloudFormation changes, incident
responders, people comparing deployed resources with the template, and artificial
intelligence tools see what is deployed but not why it was designed that way.

**Artificial intelligence tools make the missing information more important.** These tools
are increasingly asked to modify deployed infrastructure. They read templates through
`GetTemplate` and `DescribeStackResource`, but cannot see relationships between resources,
required retention periods, or team service-level agreements that were never recorded in
the template. They can therefore make a change that is valid for one resource but wrong for
the system. The problem is missing information, not careless behavior.

**The claim was tested.** The evaluation compared four conditions on the same CloudFormation update
tasks: no added design information; design information in source-template comments; structured
`com.aws.cloudformation.Context` fields; and the same structured fields read by a tool that
was explicitly instructed how to use them. Tasks that required information absent from the
template performed worst without added information. Supplying information in either
comments or structured fields produced most of the improvement. Appendix B gives the
results and explains their limits.

The test also considered source comments. Comments performed well when present, nearly
matching structured metadata. However, AWS CDK does not promise to preserve source comments
when it generates a template. Generated JavaScript Object Notation (JSON) has no comments unless another tool copies
them into template data. A reader using `GetTemplate` therefore cannot depend on source
comments. Structured metadata remains in the deployed template and exposes named fields.
A future best-effort comment-copying tool could produce those fields, but it is not part of
this API.

**AWS CDK is the right place to write this information.** AWS CDK users write constructs,
not the generated CloudFormation template, so they need an AWS CDK API. The construct
hierarchy also provides useful targeting: `defaultChild` identifies the primary resource
and avoids automatically created helpers, while one `add()` call with `propagate: true`
and a resource-type filter can cover matching resources anywhere below a construct. Because AWS CDK generates many
production CloudFormation templates, adding the API to AWS CDK makes the feature broadly
available.

**AWS CDK already writes metadata.** It writes `aws:cdk:path` and version information on
resources because that structural information is useful. This RFC uses the same
CloudFormation `Metadata` section for optional design information supplied by the user.

### Why should we _not_ do this?

* **Outdated information can mislead readers.** The `trust` field shows who or
  what supplied information and confidence, but cannot determine
  whether the information is still current. Keeping it beside the AWS CDK code means both
  can be reviewed in the same change, but does not guarantee updates.
* **This adds public APIs to `aws-cdk-lib`.** The change adds four classes, three
  sets of allowed values, and five interfaces (see *Public API* above). jsii, the tool AWS CDK uses to generate libraries for
  other programming languages, publishes these APIs in every supported language. The field
  set also becomes a long-term compatibility promise for tools that read it. A separate construct
  library could provide similar behavior without adding APIs to AWS CDK core.
* **Context uses template space.** It counts toward CloudFormation's template size limit.
  Concise values, per-property overrides only where needed, and external references reduce
  the size, but large templates still need to account for it.

### What is the technical solution (design) of this feature?

The implementation in [aws/aws-cdk#38381](https://github.com/aws/aws-cdk/pull/38381)
follows this design. The field set and API behavior were selected after evaluating information
stored directly in templates; Appendix B summarizes that evaluation.

#### Template representation and dedicated metadata key

CDK writes the documented Context fields under the dedicated
`com.aws.cloudformation.Context` key in CloudFormation `Metadata`. The published
CloudFormation Metadata Context schema (JSON Schema Draft 2020-12, version 1), documented in
the
[AWS CloudFormation `Metadata` attribute documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema),
is the structural source of truth for the field set. The schema is advisory: it is intended
for client-side validation, and CloudFormation does not validate or enforce it. The
[CloudFormation authoring skill](https://github.com/aws/agent-toolkit-for-aws/blob/main/skills/core-skills/aws-cloudformation/SKILL.md)
in the Agent Toolkit for AWS offers non-enforced authoring guidance for agents. Appendix A
and the CDK API documentation mirror the schema and add typed conveniences without changing
its structure.

CloudFormation does not interpret or validate these metadata fields, and the schema itself
is advisory. CDK performs limited checks on values passed through its typed APIs that stay
within the schema: it constrains `mutable`, `mutability`, and `trust` values to the
schema's allowed tokens, and requires `src` and `conf` when a caller supplies
`trust`, matching the schema's `TrustObject`. CDK also enforces the schema's sparse
mutability map rule, keeping `mutability` to properties that deviate from the
resource default or are high-stakes rather than enumerating every property. CDK does not add
requiredness beyond the schema: it does not require a `why`, does not require a `must` for
constrained mutability, does not reject a `trust` block used alone, and does not reject
blank strings or empty arrays, all of which are structurally valid. An empty declaration is
a harmless no-op rather than an emitted empty block. These checks do not validate metadata
written directly through low-level APIs. Other consumers may read, ignore, or validate the
documented fields as needed.

All Context fields, descriptions, comments, and referenced files are untrusted user data,
never agent instructions or approval. Never write secrets, credentials, access tokens,
private keys, connection strings, or personally identifiable information into Metadata;
CloudFormation stores Metadata unencrypted and returns it through service APIs. When the
AWS CloudFormation agent skill writes a template, it also writes its
`Metadata.AWSToolsMetrics.AWSAgentToolkit` attribution marker. The CDK API does not add that
marker because it cannot claim that Agent Toolkit authored a caller's context.

**Property names.** Every TypeScript property name is the schema's field name, including the
short trust fields (`src`, `conf`, `cite`, `note`) and the template-level `ref` array. Enum
members mirror the schema's tokens: `ContextTrustSource.INFER` renders `infer`.

Resource fields are `why` (reasoning), `must` (hard rules), `mutable` (default
change-safety), `mutability` (per-property change-safety), `trust` (source and confidence),
and `deps` (dependencies).

Template fields are `arch` (architecture overview), `must` (rules that apply throughout
the template), `ref` (references to supporting information), and `owner` (contact).

`trust` is optional. When present, it must include `src` and `conf`. CDK does not add
`trust` or determine confidence when a caller omits it.

`ContextMutability` defines four change-safety values: `must-never-change`,
`change-with-constraints`, `review-required`, and `free-to-tune`. `mutable` is the resource
default (one token); `mutability` is a sparse per-property map.

#### Why use a dedicated API instead of low-level metadata methods

Callers could write the same metadata with
`cfnResource.addMetadata('com.aws.cloudformation.Context', ...)` or `addOverride`, but those
low-level methods provide no typed fields, allowed-value checks, required `trust` checks,
primary-resource selection, propagation with type filters, or generated documentation in
every supported language. The dedicated classes provide those behaviors and require callers
to request propagation explicitly. The conflict rule prevents direct metadata and
the dedicated APIs from silently overwriting each other.

#### How declarations are stored and applied

`ResourceMetadataContext.of(scope).add(context, options?)` performs three actions:

1. It stores the declaration in metadata on the selected construct node. An empty
   declaration adds nothing and is treated as a harmless no-op; blank strings and empty
   arrays are structurally valid and are preserved as given.
2. It registers `MetadataContextAspect`. A CDK Aspect is an object that visits constructs
   while CDK generates a template. The default priority is `AspectPriority.MUTATING`, and
   callers can change it with `options.priority`.
3. It registers a validation for that declaration. The Aspect records whether at least one
   `CfnResource` matched. After the visit completes, validation fails template generation if
   the declaration matched no resources.

Before processing a resource, the Aspect clears metadata calculated during any previous
template generation. It then examines ancestor constructs from the root of the current CDK
output group to the resource. A `Stage` starts a separate output group, called a cloud
assembly, so declarations above the nearest `Stage` are excluded. The Aspect combines every
applicable declaration in ancestor-to-resource order; this fixed order makes the result
independent of the order in which callers invoked `add()`. It then writes the result under
`com.aws.cloudformation.Context`.

The merge rules are:

* For fields that hold one value (`why`, `mutable`, and `trust`), the
  declaration closest to the resource takes precedence.
* For array fields (`must` and `deps`), CDK combines entries and
  removes duplicates.
* For `mutability`, CDK combines the maps and uses the closest declaration for each
  property name.

**Conflict with directly written metadata.** A value written directly under
`com.aws.cloudformation.Context` remains unchanged unless a metadata-context API also
targets the same resource. If both methods target the same key, template generation fails
instead of merging or overwriting the caller's information. The error identifies the
construct and tells the caller to use only one method.

#### Selecting resources

A resource is *primary* for a scope when the path from that scope to the resource follows
each construct's `defaultChild` property at every step. The chain may pass through
intermediate constructs: if a construct's `defaultChild` is another construct, that
construct's `defaultChild` is followed next, until a `CfnResource` is reached. For example,
this selects the `AWS::SQS::Queue` created by `sqs.Queue`, and selects the
`AWS::Lambda::Function` two levels below `cloudfront.experimental.EdgeFunction` (whose
`defaultChild` is a `lambda.Function`), while skipping generated roles, policies,
log-retention resources, and custom-resource providers. A construct that declares no
`defaultChild`, such as most L3 patterns, a plain grouping `Construct`, or a `Stack`, has no
primary resource. A construct with both a `Resource` and a `Default` child has an ambiguous
`defaultChild`; the `constructs` library throws when it is read, and template generation
fails with that error.

Each `add()` call can select resources as follows:

* With no options, select only the scope's primary resource.
* With `propagate: true`, select every `CfnResource` beneath the scope, helper and primary
  alike, including resources in a `NestedStack`. A `Stage` is a separate cloud assembly, so
  propagation never crosses a `Stage`; declare context inside each Stage.
* With `propagationFilter`, narrow a propagated declaration by resource type:
  `PropagationFilter.includeResourceTypes([...])` keeps only the listed types;
  `excludeResourceTypes([...])` drops them. `PropagationFilter` is a class with static
  factories so new filter kinds can be added without changing the options interface. A filter
  requires `propagate: true`; `add()` throws otherwise.
* Use `inheritAncestorContext: false` to ignore declarations from ancestor constructs.

Helpers are reached by propagating from an L2 while excluding its primary resource's type,
or by targeting an exposed helper construct such as `lambdaFunction.deadLetterQueue`.

After the Aspect has visited the final construct hierarchy, CDK validates each declaration
separately. Template generation fails if a declaration selects no resources. This includes
a missing primary resource, an empty propagation scope, a filter that excludes every
candidate, or candidates that exist only in another `Stage`. The error identifies the
construct and explains how to select a valid target.

The default selects narrowly because automatically applying text to many resources can
repeat information and attach rules to resources they do not govern. Information that
applies throughout a template belongs in `TemplateMetadataContext`; as a guideline, use
template-level information when the same text would otherwise appear on more than about
three resources.

#### Template-level information

`TemplateMetadataContext.of(stack).add()` combines repeated calls for one stack and writes
the result to the template's `Metadata` section. For `arch` and `owner`, later
calls take precedence. CDK combines `must` and `ref` arrays. A reference containing only
`at` is written as a string; references with `has` or `scope` are written as objects.

#### Mixin behavior

`MetadataContextMixin` applies only to `CfnResource`. Its `applyTo()` method calls
`ResourceMetadataContext.of(resource).add(...)`. Therefore `.with()` selects one low-level
resource, while `Mixins.of(scope).apply()` selects every matching low-level resource under
the scope. All declarations use the same merge and conflict rules.

#### Outside this RFC

This RFC covers information supplied explicitly through the AWS CDK APIs. During template
generation, the library does not inspect source comments, version-control history, tests,
service code, or deployed resources. Automatically deriving `why` or `deps` is not part of
this API because derived information can be wrong and some dependencies are visible only
after later template-processing steps. A separate authoring tool may propose API calls and
use `trust` to identify evidence and confidence without changing these field
definitions.

#### Finding the documentation

Readers identify these fields by the dedicated `com.aws.cloudformation.Context` key, which
appears in applicable `GetTemplate` and `DescribeStackResource` responses. The published
CloudFormation Metadata Context schema, documented in the
[AWS CloudFormation `Metadata` attribute documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema),
is the structural source of truth for the field set. The
[CloudFormation authoring skill](https://github.com/aws/agent-toolkit-for-aws/blob/main/skills/core-skills/aws-cloudformation/SKILL.md)
in the Agent Toolkit for AWS offers non-enforced authoring guidance. The `aws-cdk-lib`
README, public API reference, and Appendix A mirror the schema's field definitions.
CloudFormation does not validate metadata fields against the schema.

Printing a documentation notice every time `cdk synth` writes context was considered and
rejected: repeated notices would distract authors, and command output does
not reach a person or tool that later reads the deployed template through `GetTemplate`.
The metadata key and linked AWS CloudFormation documentation provide the long-term
reference.

### Is this a breaking change?

No supported AWS CDK API changes behavior unless a caller uses the new APIs:

* Applications that do not call `ResourceMetadataContext` or `TemplateMetadataContext`
  generate the same templates as before, including metadata written directly by callers.
* The conflict rule applies only when a caller uses a new API and also writes the same
  `com.aws.cloudformation.Context` key directly on the same resource.
* Other metadata keys remain unchanged. CloudFormation does not use Context fields to
  create or update resources.

### What alternative solutions did you consider?

1. **A separate Aspect or construct library.** A library outside `aws-cdk-lib` could write
   the metadata, but callers would lose the shared typed fields, `defaultChild` selection,
   generated APIs in all supported languages, and consistent Mixin and Aspect priorities.
   A core API provides one documented format and consistent behavior.
2. **Copying source comments automatically.** A prototype uses a resource's recorded source
   location to read the preceding comment, rejects comments that merely repeat the code, and
   writes useful reasoning to `why`. This could reduce manual work. It is not included in
   the first release because compiled applications require mapping generated code back to
   source, comment syntax differs across supported languages, and weak comments can produce
   incorrect information. A future tool can call `ResourceMetadataContext` with
   `trust.src = COMMENT` after these problems are addressed.
3. **Existing `Description` properties.** Some higher-level constructs expose a
   `description` property that becomes a CloudFormation resource property. A caller could
   encode JSON in that string, but CloudFormation and consoles would still show one string,
   the field has length limits, and it would mix a short description with reasoning and
   safety rules. Many resource types have no Description property. Consumers should read an
   existing Description where available and use Context only for information it cannot
   express.
4. **Tags.** Tags are attached to deployed resources, but they allow only a limited number
   of short key/value pairs. They are also used by billing, cost allocation, and access
   policies, where design explanations do not belong. Encoding a JSON object in a tag would
   make it difficult for people and tools to read individual fields.
5. **Files in the CDK cloud assembly instead of the template.** CDK could write information
   to `manifest.json` or `tree.json`, which are generated beside the template. Those files
   are not stored with the deployed stack, so console users and tools calling `GetTemplate`
   would not receive the information.
6. **A new CloudFormation template section or service feature.** CloudFormation could add
   validation and dedicated read operations, but that requires a service change before
   customers can use the feature. `Metadata` already stores user-defined information and
   works without changing the service (see Appendix C).

### What are the drawbacks of this solution?

* **Template size.** Context counts toward CloudFormation's 1 MB template limit. CDK
  already warns when a generated template exceeds 80% of a conservative
  1,000,000-character threshold. Concise values, only necessary per-property entries, and
  external references reduce size. Tools may remove optional fields in the order documented
  in Appendix A, but must retain safety-critical `must` entries and any `ref` needed to find
  information moved outside the template.
* **Information can become outdated.** Keeping Context beside reviewed AWS CDK source and
  recording source and confidence can help a reader judge it, but cannot ensure that it is
  updated.
* **CloudFormation does not validate Context.** CDK validates values supplied through the
  new APIs, and other consumers may perform their own checks, but metadata written directly
  can contain invalid fields or values.
* **Automated tools can write unsupported claims.** A tool should use
  `src: INFER`, an appropriate `conf`, and a `cite` for derived information,
  but the API cannot prevent a caller from incorrectly claiming `AUTHORED`.
* **Combining declarations requires rules.** Callers must learn that the closest
  single-value declaration takes precedence, while arrays are combined and duplicates are
  removed. The tests define these behaviors.

### What is the high-level project plan?

The RFC and implementation are reviewed together so maintainers can compare the proposal
with working code. The first release includes `ResourceMetadataContext`,
`TemplateMetadataContext`, `MetadataContextMixin`, declaration storage, Aspect processing,
resource selection, template-level merging, validation, tests, and README documentation.
The implementation is available in
[aws/aws-cdk#38381](https://github.com/aws/aws-cdk/pull/38381).

#### Bake period

A preview phase before the API becomes part of `aws-cdk-lib` was considered. A bake period
is most valuable when a release is the moment a format becomes a commitment, or when a later
change to that format could break what customers have already deployed. Neither applies
here, so the first release goes directly into `aws-cdk-lib`:

* **The field set is already public.** The schema is owned by CloudFormation and is already
  published as version 1 of the
  [CloudFormation Metadata Context schema](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema)
  (`$id` ending in `metadata-context/v1.json`), and the
  [CloudFormation authoring skill](https://github.com/aws/agent-toolkit-for-aws/blob/main/skills/core-skills/aws-cloudformation/SKILL.md)
  in the Agent Toolkit for AWS already writes it. CDK mirrors that published field set, so a
  CDK preview period would not change the schema.
* **The schema is advisory, and nothing validates it.** CloudFormation does not validate or
  enforce `Metadata` content, and the schema describes itself as intended for client-side
  validation only. A future schema version therefore cannot cause a deployment failure or
  reject an existing template; a reader that knows a newer version simply sees fewer fields
  on older templates. Templates generated today remain valid.
* **Schema evolution is additive on the CDK side.** If CloudFormation publishes a new schema
  version, CDK can follow with new optional properties or values while existing properties
  keep writing the same template keys. That is an ordinary non-breaking change to
  `aws-cdk-lib`.

A runtime feature flag is likewise unnecessary because applications generate no additional
context unless they call a new API. The APIs ship as stable once the pre-merge requirements
below are met.

### Are there any open issues that need to be addressed later?

#### Requirements before merging

* **Public documentation.** Review Appendix A, examples, selection rules, merge rules, and
  the `aws-cdk-lib` API documentation against the *Public API* section. The published
  CloudFormation Metadata Context schema, documented in the
  [AWS CloudFormation `Metadata` attribute documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema),
  is the structural source of truth. CloudFormation does not validate metadata against it.
* **Public API approval.** The API Bar Raiser must approve the surface listed in *Public
  API* (four classes, three enums, five interfaces) and apply the `status/api-approved`
  label to the RFC pull request. The API is then released as stable; see *Bake period*.

#### Follow-ups

* **Agent Toolkit skills.** Two skills in the
  [Agent Toolkit for AWS](https://github.com/aws/agent-toolkit-for-aws) need updates:
  * The
    [CloudFormation authoring skill](https://github.com/aws/agent-toolkit-for-aws/blob/main/skills/core-skills/aws-cloudformation/SKILL.md)
    already writes `com.aws.cloudformation.Context`; add the `src` precedence rule from
    *Source and confidence*, so agents writing templates directly apply the same rule as CDK
    authors.
  * The
    [CDK skill](https://github.com/aws/agent-toolkit-for-aws/blob/main/skills/core-skills/aws-cdk/SKILL.md)
    has no Context guidance today; add `ResourceMetadataContext`, `TemplateMetadataContext`,
    and `MetadataContextMixin` usage, the targeting rules (`propagate`, `PropagationFilter`),
    and the same `src` precedence rule, so agents generating CDK code emit Context through the
    API rather than raw `addMetadata()` calls.
* **Testing with authors and readers.** Exercise the API on real stacks with the companion
  authoring tool and at least one tool that reads Context, and feed gaps back as additive
  changes (new optional properties or filters).

#### Future enhancements

* **Finding dependencies automatically.** Today, callers write `deps` themselves.
  CloudFormation references such as `Fn::ImportValue` could identify some dependencies
  between stacks or resources, but those references are available only after later template
  processing and are not included in this release.
* **Finding change-safety automatically.** CloudFormation resource-type schemas identify
  properties whose changes replace a resource. CDK could use that authoritative information
  to suggest `must-never-change` for selected properties.
* **Additional propagation filters.** `PropagationFilter` offers `includeResourceTypes` and
  `excludeResourceTypes`. Because it is a class with static factories, filters can be added
  without changing the options interface: one that selects only primary resources (each
  construct's `defaultChild` chain), or one that selects a related dead-letter queue,
  execution role, or log group that the parent construct does not expose.
* **Applying related information automatically.** A future API could copy appropriate
  information from a primary resource to a related helper, such as from a function to its
  log group or from a queue to its dead-letter queue.
* **Properties on higher-level constructs.** Frequently used higher-level constructs could
  accept a `context` property directly, for example
  `new sqs.Queue(this, 'Q', { context: {...} })`, instead of requiring a separate
  `ResourceMetadataContext.of()` call. It is excluded from the first release so the
  standalone API can be adopted first.

## Appendix

### Appendix A - CloudFormation Context template field reference

The published CloudFormation Metadata Context schema (JSON Schema Draft 2020-12, version 1),
documented in the
[AWS CloudFormation `Metadata` attribute documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema),
is the structural source of truth for the field set. This appendix and the public CDK API
documentation mirror it. The
[CloudFormation authoring skill](https://github.com/aws/agent-toolkit-for-aws/blob/main/skills/core-skills/aws-cloudformation/SKILL.md)
in the Agent Toolkit for AWS adds non-enforced authoring guidance. Every top-level field is
optional in both the Resource Context and Template Context blocks; neither defines a
top-level required array, so any subset of fields is structurally valid. `TrustObject`, when
present, requires `src` and `conf`; the object form of a `ref` entry requires `at`. The
schema sets no `minLength` or `minItems`, so blank strings and empty arrays are valid, and
all object definitions disallow additional fields. The CDK property names are identical to
the template field names below.

Resource-level (`Resources.<LogicalId>.Metadata["com.aws.cloudformation.Context"]`):

| Field | Type | Required | Meaning | Example |
| ----- | ---- | -------- | ------- | ------- |
| `why` | text | no | Purpose, important configuration choices, and rejected alternatives. | `"retry buffer for an unreliable payments service"` |
| `must` | array of text | no | Rules whose violation would break correctness, availability, security, data integrity, or a required dependency. | `["VisibilityTimeout must be at least six times the Lambda timeout"]` |
| `mutable` | `ContextMutability` | no | Default change-safety for the resource. | `"change-with-constraints"` |
| `mutability` | object | no | Change-safety for properties that differ from the resource default or are especially important. | `{ "QueueName": "must-never-change" }` |
| `trust` | object | no | Source and confidence; see the trust fields below. | see the trust table |
| `deps` | array of text | no | Stacks, resources, or services this resource relies on. | `["NetworkStack"]` |

`ContextMutability` allows four values: `must-never-change`,
`change-with-constraints`, `review-required`, and `free-to-tune`.
For `must-never-change` and `change-with-constraints`, pair the level with a `must` entry
that states the rule behind the restriction so readers can see it; this is a recommendation,
not a schema requirement.

`trust` object fields:

| Field | Type | Required | Meaning | Example |
| ----- | ---- | -------- | ------- | ------- |
| `src` | allowed value | yes, when `trust` is present | One of `authored`, `comment`, `commit`, or `infer`. | `"infer"` |
| `conf` | allowed value | yes, when `trust` is present | One of `high`, `medium`, or `low`. | `"low"` |
| `cite` | text | no | Location of supporting evidence, such as a file and line, web address, or commit identifier. | `"service/handler.ts:87"` |
| `note` | text | no | Additional explanation about the source or confidence. | `"no explicit design note"` |

The four allowed sources are:

* `authored` - a person wrote or explicitly confirmed the information.
* `comment` - the information came from a source comment.
* `commit` - the information came from version-control history.
* `infer` - a tool concluded the information from code structure or behavior without an
  explicit statement.

`src` holds one value. When more than one fits, apply the precedence rule in *Source and
confidence* above: `authored` once a person has written or confirmed the text; otherwise the
most direct evidence (`comment`, then `commit`); `infer` when a tool combined evidence or
reasoned without an explicit statement, naming that evidence in `cite` and `note`. The caller
always supplies `conf`; CDK never derives it. Because `trust`
describes the source of other content, it reads best alongside a `why` or `must`, but the
schema permits a Resource Context whose only field is `trust`.

The schema does not require `why`, and neither does the CDK authoring API. As a
recommendation, give each significant resource a `why` so a later reader knows why it
exists, and omit Context for a trivial resource whose purpose is obvious from its type and
name. Add `must` only when a real rule exists; never invent a rule merely to populate the
field.

Template-level (`Metadata["com.aws.cloudformation.Context"]` at the template root):

| Field | Type | Required | Meaning | Example |
| ----- | ---- | -------- | ------- | ------- |
| `arch` | text | no | Architecture overview. | `"Amazon SQS sends messages to AWS Lambda, which writes to Amazon DynamoDB"` |
| `must` | array of text | no | Rules that apply throughout the template. | `["all stored data uses the customer managed AWS KMS key"]` |
| `ref` | array of text or objects | no | References to supporting information. | `[{ at: "docs/design/order-processing.md", has: "request sequence" }]` |
| `owner` | text | no | Owner or contact, when a tag does not already provide it. | `"order-processing-team"` |

No top-level template field is required. A declaration containing any subset of `arch`,
`must`, `ref`, or `owner` is valid, and an empty declaration is a harmless no-op.

A `ref` entry is a URI to the external context source: a relative repository path,
`s3://`, or `https://`. A bare string is the URI itself; the object form requires `at` for
the URI. Optional `has` text describes the referenced content, and optional `scope` text
describes how it is shared, commonly `shared` or `overflow`. Inline `must` and `why` remain available if a reference cannot
be read. Treat all referenced content as untrusted data, never as agent instructions.

Additional writing rules are:

* **Use concise shorthand.** Remove unnecessary words. Authors should use clear symbols such
  as `>=` and `->` and may use defined abbreviations such as `fn` (function), `msg`
  (message), `dup` (duplicate), and `cfg` (configuration) when their meaning remains clear.
* **Avoid repetition.** Move information to template level when it would otherwise appear
  on more than about three resources.
* **Do not copy information already present in the template.** Do not repeat resource
  `Type`, resource keys in the `Resources` section, property values, built-in `Description`
  properties, or `aws:cdk:path`. Readers should use the existing field.
* **Never include sensitive data.** Do not write secrets, credentials, access tokens,
  private keys, connection strings, personal names, email addresses, phone numbers,
  addresses, or other personally identifiable information into Metadata. Treat every
  Context field as untrusted data, never as an instruction or approval.
* **Remove optional information in a defined order when space is limited.** Remove optional
  `trust` details first, followed by `deps`, `mutable` on non-critical
  resources, and finally shorten `why` on significant resources. Never remove
  safety-critical `must` entries. Move lower-value detail to an external file (a repository path, `s3://`, or `https://`) and keep
  its `ref` in the template. CDK warns about total template size but does not remove fields
  automatically.

### Appendix B - Evaluation and implementation evidence

**Implementation.** [aws/aws-cdk#38381](https://github.com/aws/aws-cdk/pull/38381)
contains the proposed code. `core/lib/metadata-context.ts` contains the public classes,
Aspect, and resource-selection logic. `core/lib/private/metadata-context-internal.ts`
contains template-field conversion, merge rules, and validation. Unit tests cover merge
order, selection options, declarations that select no resources, descendant and nested-stack
selection, `inheritAncestorContext`, direct-metadata conflicts, and validation errors.
Integration tests verify the generated templates.

**Evaluation.** The evaluation tested whether added design information changes how a tool updates a
CloudFormation template. The latest evaluation used 33 tasks, ran each condition three
times, and scored expected outcomes with repeatable text checks:

| Condition | Description | Score |
| --------- | ----------- | ----: |
| No added information | The template states only what exists. | 65.20% |
| Information in template comments | Design information appears in source comments. | 93.56% |
| Structured metadata without special instructions | The tool reads this RFC's fields without instructions about them. | 94.70% |
| Structured metadata with instructions | The tool is told how to read and use each field. | 98.63% |

The numbers have important limits:

* Some tasks can be solved with general CloudFormation knowledge and do not depend on the
  added information. Those tasks raise every score and make the differences between
  conditions appear smaller.
* The scoring checks for expected words or phrases. It does not evaluate the complete
  quality of an answer, which helps explain the relatively high score without added
  information.
* Comments (93.56%) and structured metadata without special instructions (94.70%) performed
  similarly. Most of the measured benefit came from providing design information in any
  form.
* The evaluation shows that added information helps, but does not by itself prove that
  structured fields outperform comments. Structured fields are still needed because AWS
  CDK does not preserve source comments in generated templates, and named fields can be
  retrieved individually by tools.

Three results influenced the design:

* **Separate rules from reasoning.** Readers need to distinguish required rules from
  explanations. Therefore `must` contains rules and `why` contains reasoning or rejected
  alternatives.
* **Store resource-specific information on the resource.** A rule beside the resource being
  changed is easier to find than text at the top of a large template. Information that
  applies throughout the template remains at template level.
* **Information advises; it does not enforce.** A reader may identify a conflicting rule
  yet still follow an explicit request. Enforcement belongs in policy checks and review of
  proposed CloudFormation changes, not metadata.

### Appendix C - Why use CloudFormation `Metadata`

CloudFormation `Metadata` accepts user-defined keys, stores them with the template, and
does not interpret them while creating resources. CloudFormation already uses Metadata for
`AWS::CloudFormation::Interface`, and AWS CDK uses it for `aws:cdk:path`. The dedicated
`com.aws.cloudformation.Context` key identifies this field set without reserving the rest of
the Metadata section.

The Context field set does not allow additional fields. A tool that needs different
structured data should use a separate metadata key rather than adding fields to Context.
For example, a data-classification tool can store its information beside Context:

```json
"Metadata": {
  "com.aws.cloudformation.Context": {
    "why": "buffers webhook events for asynchronous processing"
  },
  "com.example.dataclass": {
    "containsSensitiveData": true,
    "retention": "7 years"
  }
}
```

The two tools can read their own keys without changing each other's data, and no
CloudFormation service change is required.

Context counts toward CloudFormation template size limits: approximately 51 kilobytes when
the template body is sent directly and one megabyte when it is stored in Amazon S3. Concise values,
only necessary per-property entries, template-level information for repeated facts, and
external references reduce size. `DescribeStackResource` returns resource-level Context,
and `GetTemplate` returns both resource-level and template-level Context.

### Appendix D - Relationship to existing AWS CDK metadata

AWS CDK already writes `aws:cdk:path` on every resource to record its location in the
construct hierarchy, and writes version information for reporting. The
`com.aws.cloudformation.Context` key does not replace those values and must not repeat the
construct path, construct type, resource identifier, or property values. `aws:cdk:path`
answers where the resource came from; Context explains why it exists and how safely it can
change.
