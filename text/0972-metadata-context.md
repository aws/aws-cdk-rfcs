# Structured Design Context in Synthesized Templates

* **Original Author(s):** @satyakigh
* **Tracking Issue**: #972
* **API Bar Raiser**: TBD

AWS Cloud Development Kit (AWS CDK) applications contain information about why each
resource exists. That information includes reasoning, hard rules that must remain true,
and operational instructions. It often lives only in source comments,
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
can include reasoning, hard rules, change-safety guidance, source and confidence, and
operational instructions. People and automated tools that inspect a deployed template can
therefore use the author's intent instead of guessing it.

Two classes write the same documented template fields: `ResourceMetadataContext` writes
information on individual resources, and `TemplateMetadataContext` writes information once
for the whole template. `MetadataContextMixin` is a CDK Mixin, which is an API applied
directly to selected low-level `CfnResource` objects.

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
  defaultMutability: ContextMutability.CHANGE_WITH_CONSTRAINTS,
  propertyMutability: {
    QueueName: ContextMutability.MUST_NEVER_CHANGE,
  },
  ops: 'check ApproximateAgeOfOldestMessage before reducing VisibilityTimeout',
});
```

This renders a `com.aws.cloudformation.Context` block on the `AWS::SQS::Queue` resource.
The API uses descriptive property names (`defaultMutability`, `propertyMutability`) that
map to the shorter template field names (`mutable`, `mutability`); see
[Appendix A](#appendix-a---cloudformation-context-template-field-reference) for the
full field reference and name mapping.

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
      },
      "ops": "check ApproximateAgeOfOldestMessage before reducing VisibilityTimeout"
    }
  }
}
```

No `trust` block appears because the caller did not provide one. The `trust` field is
optional, and CDK never adds it automatically (see *Source and confidence* below).
`defaultMutability` is `change-with-constraints`, and the required rule is recorded in
`must`: `VisibilityTimeout` must remain at least six times the Lambda timeout.
`change-with-constraints` means a value may change only while its stated rules remain true;
using that value without a corresponding `must` rule gives the reader no useful guidance.

##### Resource context quality

Every top-level field remains optional in the advisory schema. The authoring guidance is
stricter: each significant resource that receives Context must have a non-empty `why` in
its final merged block. Omit Context entirely for a trivial resource whose purpose is
already obvious from its type and name. Add `must` only when violating the rule would break
correctness, availability, security, data integrity, or a required dependency; never invent
a rule merely to populate the field.

`must-never-change` and `change-with-constraints`, whether used as a resource default or for
a property, require at least one non-empty `must` in the final merged block. `trust` cannot
be used alone. Individual declarations may omit `why` or `must` when another applicable
declaration supplies them. Template context does not require `must`; `arch`, `ref`, or
`owner` alone are valid.

##### Propagation is explicit

`add()` targets only the scope's primary resource; it does not automatically apply the
information to descendant constructs. A declaration must match at least one resource after
targeting options and resource-type filters are applied, or template generation fails with
a clear error. To apply one block to descendants of a multi-resource CDK construct, a grouping construct, or a
`Stack`, set
`applyToDescendants: true`:

```ts
declare const stack: Stack;
declare const queue: sqs.Queue;

// Declared on the Stack but limited to primary Amazon SQS queue resources.
ResourceMetadataContext.of(stack).add({
  ops: 'drain the queue before changing delivery settings',
}, {
  applyToDescendants: true,
  includeResourceTypes: ['AWS::SQS::Queue'],
});

// Information for one queue; it also receives the applicable Stack declaration above.
ResourceMetadataContext.of(queue).add({
  why: 'buffers webhook events for asynchronous processing',
});
```

When several declarations apply to one resource, CDK combines them. For fields that hold
one value (`why`, `defaultMutability`, `trust`, and `ops`), the declaration closest to the
resource takes precedence. For array fields (`must`, `gaps`, and `deps`),
CDK combines the entries and removes duplicates. For `propertyMutability`, CDK combines the
maps and uses the closest declaration for each property name.

`applyToDescendants` crosses a `NestedStack` boundary because a nested stack remains part of
the same generated application. It does not cross a `Stage`, which is a separate CDK cloud
assembly and must declare its own context.

Applying information to descendants is always explicit. Repeating the same block on many
resources can make that information appear more important than other facts and can place a
rule on resources it does not govern. If information applies to the whole template, move it
to `TemplateMetadataContext` instead. As a guideline, move information to template level
when it would otherwise be repeated on more than about three resources.

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

##### Targeting helper resources

The default primary-resource filter skips automatically created helper resources. An AWS
Lambda function is a useful example: `lambda.Function` creates both an
`AWS::Lambda::Function` and an `AWS::IAM::Role`. `add()` follows the `defaultChild` property
to the `AWS::Lambda::Function` and leaves the generated role unchanged:

```ts
declare const lambdaFunction: lambda.Function;

// Applies to the AWS Lambda function, not its generated AWS IAM role.
ResourceMetadataContext.of(lambdaFunction).add({
  why: 'processes order events from an Amazon SQS queue and ignores previously processed events',
  ops: 'check the dead-letter queue depth before increasing the timeout',
});
```

When a helper resource is available as a construct, target it directly instead of applying
context to every descendant. For example, a function's dead-letter queue can record why it
exists and how to operate it:

```ts
declare const deadLetterQueue: sqs.Queue;

ResourceMetadataContext.of(deadLetterQueue).add({
  why: 'stores failed order-processing invocations for later recovery',
  ops: 'inspect the failed message and fix the processor before returning messages to the source queue',
});
```

To include all helper resources, set `applyToAllResources: true`. This disables the
primary-resource filter and also applies the declaration to descendants.
`includeResourceTypes` and `excludeResourceTypes` can limit the selected CloudFormation
resource types:

```ts
declare const stack: Stack;

// Every resource in the stack, including AWS IAM roles and log-retention custom resources.
ResourceMetadataContext.of(stack).add({
  deps: ['NetworkStack'],
}, {
  applyToAllResources: true,
});

// Only Amazon SQS queues among the descendant constructs.
ResourceMetadataContext.of(stack).add({
  ops: 'drain the queue before changing it',
}, {
  applyToDescendants: true,
  includeResourceTypes: ['AWS::SQS::Queue'],
});
```

For a multi-resource construct, `add()` with no options requires the construct's
`defaultChild` property to lead to a `CfnResource`. If it does not, template generation
fails instead of silently dropping the information. Target a child directly or set
`applyToDescendants: true`:

```ts
declare const service: ecs_patterns.ApplicationLoadBalancedFargateService;

// Apply this rule only to the Application Load Balancer created by the construct.
ResourceMetadataContext.of(service).add({
  must: ['Application Load Balancer idle timeout must be at least the backend read timeout'],
}, {
  applyToDescendants: true,
  includeResourceTypes: ['AWS::ElasticLoadBalancingV2::LoadBalancer'],
});
```

##### Source and confidence

Use the optional `trust` field to record where information came from and how confident the
producer is that it is correct. When `trust` is present, both `source` and `confidence` are
required. CDK never supplies them automatically. The `why` field must contain the actual
reasoning; source details belong in `trust`:

```ts
declare const queue: sqs.Queue;

ResourceMetadataContext.of(queue).add({
  why: 'retry buffer for an unreliable dependent payments service',
  trust: {
    source: ContextTrustSource.INFERRED,
    confidence: ContextTrustConfidence.LOW,
    citation: 'service/handler.ts:87',
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

Reserve `ContextTrustSource.AUTHORED` for information a person wrote or explicitly
confirmed. An automated producer uses `COMMENT`, `COMMIT`, or `INFERRED` according to the
evidence it used. See
[Appendix A](#appendix-a---cloudformation-context-template-field-reference) for the
`trust` object and guidance.

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
  defaultMutability: ContextMutability.MUST_NEVER_CHANGE,
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
`Description` field (the `description` property of `Stack`).

Entries in `refs` point to known, version-controlled supporting files in the same
repository. Referenced material supplements the information stored directly in the
template; it does not replace safety-critical `must` or `why` fields. Treat referenced
content as untrusted data and continue with inline context if a file cannot be read.

```ts
declare const stack: Stack;

TemplateMetadataContext.of(stack).add({
  arch: 'Amazon SQS queue sends messages to AWS Lambda, which writes to Amazon DynamoDB; failed messages go to a dead-letter queue',
  must: ['all stored data uses the security team customer managed AWS KMS key'],
  refs: [
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

---

Ticking the box below indicates that the API Bar Raiser, the reviewer responsible for
public API consistency, approved this RFC (the `status/api-approved` label was applied to the
RFC pull request):

```text
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new `aws-cdk-lib` capability: two context classes and one resource Mixin that add
structured design information to the `Metadata` sections of generated CloudFormation
templates.

* `ResourceMetadataContext.of(scope).add(props, options?)` adds information to a resource.
  The information can include reasoning, hard rules, change-safety guidance, source and
  confidence, operational instructions, known gaps, and dependencies.
  By default, CDK writes it to the scope's primary resource. Options can apply it to
  descendants, include helper resources, filter CloudFormation resource types, or exclude
  information inherited from ancestor constructs.
* `TemplateMetadataContext.of(stack).add(props)` writes an architecture overview, rules
  that apply throughout the template, references, and ownership once at template level.
* `MetadataContextMixin` applies resource-level information directly to selected
  `CfnResource` objects with `.with()`, or to every matching resource under a scope with
  `Mixins.of(scope).apply()`. It uses the same validation, merge, template-field, and
  conflict behavior as `ResourceMetadataContext`.

The dedicated `com.aws.cloudformation.Context` metadata key contains a fixed set of
resource fields (`why`, `must`, `mutable`, `mutability`, `trust`, `ops`, `gaps`, `deps`)
and template fields (`arch`, `must`, `ref`, `owner`). The TypeScript API
uses descriptive property names and maps them to these shorter template field names. This
is ordinary CloudFormation `Metadata`: it is stored with the stack, has no effect on
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
* **Operations and incident response** - `why`, `ops`, and `must` preserve information that
  would otherwise remain undocumented: why the resource exists, what to check before
  changing it, and which rules must remain true. A reader can use those fields before
  changing retry or timeout settings.
* **Infrastructure changes made by artificial intelligence** - tools that read templates
  through `GetTemplate` or `DescribeStackResource` can use documented intent. A request to
  raise a Lambda timeout may conflict with a documented service-level agreement or with a
  queue visibility timeout. `must` and `ops` expose those rules before the tool makes a
  change that is valid in isolation but wrong for the system.
* **Shared organizational information** - template-level `ref` entries can point to shared
  encryption or tagging rules without copying them into every template. The `trust` field
  identifies who or what supplied information and how confident the producer is, helping a
  reader decide how much to rely on it.

These are measured results, not only expectations. We evaluated the alternatives on the
same CloudFormation update tasks. Most of the improvement came from supplying design
information in any form. Structured `com.aws.cloudformation.Context` keeps that information
in the deployed template, unlike source comments, and lets tools retrieve fields by name.
Tools explicitly instructed to use the fields performed best. Appendix B provides the
numbers and limitations.

Existing applications do not require a person to annotate every resource manually. A
companion authoring tool is being developed to read existing AWS CDK or CloudFormation
source, comments, version-control history, tests, and related service code. It then proposes
`ResourceMetadataContext` calls, or `com.aws.cloudformation.Context` values for templates
written directly, including source information in `trust` and unknowns in `gaps`. A person
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

**We tested the claim.** We compared four conditions on the same CloudFormation update
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
hierarchy also provides useful targeting: one `add()` call with `applyToDescendants` can
cover primary resources below a construct, while `defaultChild` identifies the primary
resource and avoids automatically created helpers. Because AWS CDK generates many
production CloudFormation templates, adding the API to AWS CDK makes the feature broadly
available.

**AWS CDK already writes metadata.** It writes `aws:cdk:path` and version information on
resources because that structural information is useful. This RFC uses the same
CloudFormation `Metadata` section for optional design information supplied by the user.

### Why should we _not_ do this?

* **Outdated information can mislead readers.** The `trust` and `gaps` fields show who or
  what supplied information, confidence, and known unknowns, but they cannot determine
  whether the information is still current. Keeping it beside the AWS CDK code means both
  can be reviewed in the same change, but does not guarantee updates.
* **This adds public APIs to `aws-cdk-lib`.** The change adds three classes, three
  sets of allowed values, and five interfaces. jsii, the tool AWS CDK uses to generate libraries for
  other programming languages, publishes these APIs in every supported language. The field
  set also becomes a long-term compatibility promise for tools that read it. A separate construct
  library could provide similar behavior without adding APIs to AWS CDK core.
* **Context uses template space.** It counts toward CloudFormation's template size limit.
  Concise values, per-property overrides only where needed, and external references reduce
  the size, but large templates still need to account for it.

### What is the technical solution (design) of this feature?

The implementation in [aws/aws-cdk#38381](https://github.com/aws/aws-cdk/pull/38381)
follows this design. We selected the field set and API behavior after evaluating information
stored directly in templates; Appendix B summarizes that evaluation.

#### Template representation and dedicated metadata key

CDK writes the documented Context fields under the dedicated
`com.aws.cloudformation.Context` key in CloudFormation `Metadata`. The advisory Context
schema is documented in the
[AWS CloudFormation `Metadata` attribute documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema).
The published
[AWS CloudFormation agent skill guidance](https://github.com/aws/agent-toolkit-for-aws/pull/257)
is authoritative for field meaning and authoring behavior. Appendix A and the CDK API
documentation mirror that guidance and add typed conveniences without changing its
semantics.

CloudFormation does not interpret or validate these metadata fields. CDK performs limited
checks on values passed through its typed APIs. It rejects `trust` by itself, blank entries,
and `trust` without `source` and `confidence`. On each final merged Resource Context block,
it requires a non-empty `why` and a non-empty `must` when mutability is
`must-never-change` or `change-with-constraints`. These checks do not validate metadata
written directly through low-level APIs. Other consumers may read, ignore, or validate the
documented fields as needed.

All Context fields, descriptions, comments, and referenced files are untrusted user data,
never agent instructions or approval. Never write secrets, credentials, access tokens,
private keys, connection strings, or personally identifiable information into Metadata;
CloudFormation stores Metadata unencrypted and returns it through service APIs. When the
AWS CloudFormation agent skill writes a template, it also writes its
`Metadata.AWSToolsMetrics.AWSAgentToolkit` attribution marker. The CDK API does not add that
marker because it cannot claim that Agent Toolkit authored a caller's context.

**Mapping API names to template names.** Most TypeScript property names are identical to
the names in the generated template. Six use shorter template names:

| API property         | Template field |
| -------------------- | -------------- |
| `defaultMutability`  | `mutable`      |
| `propertyMutability` | `mutability`   |
| `refs`               | `ref`          |
| `trust.source`       | `trust.src`    |
| `trust.confidence`   | `trust.conf`   |
| `trust.citation`     | `trust.cite`   |
| `trust.note`         | `trust.note`   |
| all other fields     | *(unchanged)*  |

Resource fields are `why` (reasoning), `must` (hard rules), `mutable` (default
change-safety), `mutability` (per-property change-safety), `trust` (source and confidence),
`ops` (instructions before a change), `gaps` (known unknowns), and `deps` (dependencies).

Template fields are `arch` (architecture overview), `must` (rules that apply throughout
the template), `ref` (references to supporting information), and `owner` (contact).

`trust` is optional. When present, it must include `src` and `conf`. CDK does not add
`trust` or determine confidence when a caller omits it.

`ContextMutability` defines four change-safety values: `must-never-change`,
`change-with-constraints`, `review-required`, and `free-to-tune`. The template uses
`mutable` for the resource default and `mutability` for per-property differences. The API
uses the separate properties `defaultMutability` and `propertyMutability` because jsii
cannot expose a property that accepts either one value or a map consistently in every
supported programming language.

#### Why use a dedicated API instead of low-level metadata methods

Callers could write the same metadata with
`cfnResource.addMetadata('com.aws.cloudformation.Context', ...)` or `addOverride`, but those
low-level methods provide no typed fields, allowed-value checks, required `trust` checks,
primary-resource selection, descendant targeting, or generated documentation in every
supported language. The dedicated classes provide those behaviors and require callers to
request descendant application explicitly. The conflict rule prevents direct metadata and
the dedicated APIs from silently overwriting each other.

#### How declarations are stored and applied

`ResourceMetadataContext.of(scope).add(context, options?)` performs three actions:

1. It stores the declaration in metadata on the selected construct node. It immediately
   rejects an empty declaration or blank array entry.
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

* For fields that hold one value (`why`, `defaultMutability`, `trust`, and `ops`), the
  declaration closest to the resource takes precedence.
* For array fields (`must`, `gaps`, and `deps`), CDK combines entries and
  removes duplicates.
* For `propertyMutability`, CDK combines the maps and uses the closest declaration for each
  property name.

**Conflict with directly written metadata.** A value written directly under
`com.aws.cloudformation.Context` remains unchanged unless a metadata-context API also
targets the same resource. If both methods target the same key, template generation fails
instead of merging or overwriting the caller's information. The error identifies the
construct and tells the caller to use only one method.

#### Selecting resources

A resource is *primary* for a scope when the path from that scope to the resource follows
each construct's `defaultChild` property. For example, this selects the
`AWS::SQS::Queue` created by `sqs.Queue` and skips generated roles, policies,
log-retention resources, and custom-resource providers.

Each `add()` call can select resources as follows:

* With no options, select only the scope's primary resource.
* With `applyToDescendants: true`, select primary resources under descendant constructs,
  including resources in a `NestedStack`. A `Stage` is a separate cloud assembly, so
  selection never crosses a `Stage`; declare context inside each Stage.
* With `applyToAllResources: true`, include helper resources as well as primary resources,
  while still stopping at a `Stage`.
* Use `includeResourceTypes` or `excludeResourceTypes` to limit CloudFormation resource
  types.
* Use `inheritAncestorContext: false` to ignore declarations from ancestor constructs.

After the Aspect has visited the final construct hierarchy, CDK validates each declaration
separately. Template generation fails if a declaration selects no resources. This includes
a missing primary resource, an empty descendant selection, filters that exclude every
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
calls take precedence. CDK combines `must` and `refs` arrays. A reference containing only
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
use `trust` and `gaps` to identify evidence and uncertainty without changing these field
definitions.

#### Finding the documentation

Readers identify these fields by the dedicated `com.aws.cloudformation.Context` key, which
appears in applicable `GetTemplate` and `DescribeStackResource` responses. The advisory
schema is documented in the
[AWS CloudFormation `Metadata` attribute documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema).
The published
[AWS CloudFormation agent skill guidance](https://github.com/aws/agent-toolkit-for-aws/pull/257)
is authoritative for field meaning and authoring behavior. The `aws-cdk-lib` README, public
API reference, and Appendix A mirror its field definitions and behavior. CloudFormation
does not validate metadata fields.

We considered printing a documentation notice every time `cdk synth` writes context. We
decided against it because repeated notices would distract authors, and command output does
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
   `trust.source = COMMENT` after these problems are addressed.
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
  recording source and uncertainty can help a reader judge it, but cannot ensure that it is
  updated.
* **CloudFormation does not validate Context.** CDK validates values supplied through the
  new APIs, and other consumers may perform their own checks, but metadata written directly
  can contain invalid fields or values.
* **Automated tools can write unsupported claims.** A tool should use
  `source: INFERRED`, an appropriate confidence, and a citation for derived information,
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

A runtime feature flag is unnecessary because applications generate no additional context
unless they call a new API. The APIs should be considered stable only after the criteria
below are met.

### Are there any open issues that need to be addressed later?

#### Requirements before declaring the API stable

* **Public documentation.** Review Appendix A, examples, selection rules, merge rules, and
  the `aws-cdk-lib` API documentation with the public API. The advisory schema is documented
  in the
  [AWS CloudFormation `Metadata` attribute documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema).
  The companion agent skills, including the published
  [AWS CloudFormation guidance](https://github.com/aws/agent-toolkit-for-aws/pull/257),
  define authoring behavior for agents. CloudFormation does not validate metadata against
  the schema.
* **Testing with authors and readers.** The companion authoring tool and at least one tool
  that reads Context must use the fields on real stacks. This confirms that the fields and
  selection behavior are sufficient before they become a long-term compatibility promise.
* **Public API approval.** The API Bar Raiser must approve both classes,
  `MetadataContextMixin`, options, allowed-value types, and interfaces, and apply the
  `status/api-approved` label to the RFC pull request.

#### Future enhancements

* **Finding dependencies automatically.** Today, callers write `deps` themselves.
  CloudFormation references such as `Fn::ImportValue` could identify some dependencies
  between stacks or resources, but those references are available only after later template
  processing and are not included in this release.
* **Finding change-safety automatically.** CloudFormation resource-type schemas identify
  properties whose changes replace a resource. CDK could use that authoritative information
  to suggest `must-never-change` for selected properties.
* **Selecting helper resources by relationship.** Today, callers can target an exposed
  helper construct directly or use `applyToAllResources` for every helper. A future option
  could select only a related dead-letter queue, execution role, or log group, even when the
  parent construct does not expose it directly.
* **Applying related information automatically.** A future API could copy appropriate
  information from a primary resource to a related helper, such as from a function to its
  log group or from a queue to its dead-letter queue.
* **Properties on higher-level constructs.** Frequently used higher-level constructs could
  accept a `context` property directly, for example
  `new sqs.Queue(this, 'Q', { context: {...} })`, instead of requiring a separate
  `ResourceMetadataContext.of()` call. This is excluded from the first release while the
  field set is still being evaluated.

## Appendix

### Appendix A - CloudFormation Context template field reference

The advisory schema is documented in the
[AWS CloudFormation `Metadata` attribute documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-metadata.html#aws-attribute-metadata-context-schema).
The published
[AWS CloudFormation agent skill guidance](https://github.com/aws/agent-toolkit-for-aws/pull/257)
is authoritative for authoring behavior. This appendix and the public CDK API documentation
mirror the schema fields and that guidance. Although every top-level field is structurally
optional in the schema, authoring guidance requires a non-empty `why` in each final Resource
Context block and CDK rejects `trust` alone. Template Context requires at least one
non-empty field but does not require `must`. "API property" is the TypeScript name;
"Template field" is the name written to the template.

Resource-level (`Resources.<LogicalId>.Metadata["com.aws.cloudformation.Context"]`):

| Template field | API property | Type | Required | Meaning | Example |
| -------------- | ------------ | ---- | -------- | ------- | ------- |
| `why` | `why` | text | no | Purpose, important configuration choices, and rejected alternatives. | `"retry buffer for an unreliable payments service"` |
| `must` | `must` | array of text | no | Rules whose violation would break correctness, availability, security, data integrity, or a required dependency. | `["VisibilityTimeout must be at least six times the Lambda timeout"]` |
| `mutable` | `defaultMutability` | `ContextMutability` | no | Default change-safety for the resource. | `"change-with-constraints"` |
| `mutability` | `propertyMutability` | object | no | Change-safety for properties that differ from the resource default or are especially important. | `{ "QueueName": "must-never-change" }` |
| `trust` | `trust` | object | no | Source and confidence; see the trust fields below. | see the trust table |
| `ops` | `ops` | text | no | Checks to perform before changing the resource. | `"check ApproximateAgeOfOldestMessage first"` |
| `gaps` | `gaps` | array of text | no | Information known to be missing. | `["throughput at ten times normal load is unverified"]` |
| `deps` | `deps` | array of text | no | Stacks, resources, or services this resource relies on. | `["NetworkStack"]` |

`ContextMutability` allows four values: `must-never-change`,
`change-with-constraints`, `review-required`, and `free-to-tune`.
`must-never-change` and `change-with-constraints` require a non-empty `must` entry in the
final merged Resource Context so readers can see the rule behind the restriction. `review-required` and
`free-to-tune` do not require `must`.

`trust` object fields:

| Template field | API property | Type | Required | Meaning | Example |
| -------------- | ------------ | ---- | -------- | ------- | ------- |
| `src` | `source` | allowed value | yes, when `trust` is present | One of `authored`, `comment`, `commit`, or `infer`. | `"infer"` |
| `conf` | `confidence` | allowed value | yes, when `trust` is present | One of `high`, `medium`, or `low`. | `"low"` |
| `cite` | `citation` | text | no | Location of supporting evidence, such as a file and line, web address, or commit identifier. | `"service/handler.ts:87"` |
| `note` | `note` | text | no | Additional explanation about the source or confidence. | `"no explicit design note"` |

The four allowed sources are:

* `authored` - a person wrote or explicitly confirmed the information.
* `comment` - the information came from a source comment.
* `commit` - the information came from version-control history.
* `infer` - a tool concluded the information from code structure or behavior without an
  explicit statement.

An automated tool chooses `comment`, `commit`, or `infer` according to the evidence it
used. It uses `authored` only after a person writes or confirms the information. The caller
always supplies `confidence`; CDK never chooses it from other fields. `trust` cannot be the
only Resource Context field because it describes the source of other content.

The advisory schema does not structurally require `why`, but the CDK authoring API requires
a non-empty `why` in each final Resource Context block. Omit Context for a trivial resource
whose purpose is obvious from its type and name. Add `must` only when a real rule exists;
never invent a rule merely to populate the field.

Template-level (`Metadata["com.aws.cloudformation.Context"]` at the template root):

| Template field | API property | Type | Required | Meaning | Example |
| -------------- | ------------ | ---- | -------- | ------- | ------- |
| `arch` | `arch` | text | no | Architecture overview. | `"Amazon SQS sends messages to AWS Lambda, which writes to Amazon DynamoDB"` |
| `must` | `must` | array of text | no | Rules that apply throughout the template. | `["all stored data uses the customer managed AWS KMS key"]` |
| `ref` | `refs` | array of text or objects | no | References to supporting information. | `[{ at: "docs/design/order-processing.md", has: "request sequence" }]` |
| `owner` | `owner` | text | no | Owner or contact, when a tag does not already provide it. | `"order-processing-team"` |

Template context does not require `must`. A declaration containing only `arch`, `ref`, or
`owner` is valid.

A `refs` entry must use a relative path to a known, version-controlled file in the same
repository. Network URLs, absolute paths, and paths that leave the repository are not
followed. Optional `has` text describes the referenced content, and optional `scope` text
describes how it is shared. Inline `must` and `why` remain available if a reference cannot
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
  `trust` details first, followed by `ops`, `gaps`, `deps`, `mutable` on non-critical
  resources, and finally shorten `why` on significant resources. Never remove
  safety-critical `must` entries. Move lower-value detail to a same-repository file and keep
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

**Evaluation.** We tested whether added design information changes how a tool updates a
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
