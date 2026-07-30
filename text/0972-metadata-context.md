# Structured Design Context in Synthesized Templates (Metadata.Context)

* **Original Author(s):** @satyakigh
* **Tracking Issue**: #972
* **API Bar Raiser**: TBD

CDK apps know *why* every resource exists - the rationale, invariants, and operational
knowledge live in source comments, construct structure, and the author's head - but none
of it survives `cdk synth`. This RFC adds a `MetadataContext` API to `aws-cdk-lib` that
embeds structured, advisory design context into the `Metadata.Context` sections of
synthesized CloudFormation templates, so that humans and automated tools (consoles, CLIs,
AI agents) operating on the deployed stack later can act on the author's intent instead
of guessing it.

## Working Backwards

### CHANGELOG

```text
feat(core): embed structured design context in synthesized templates (MetadataContext)
```

### README

#### Metadata Context

The `MetadataContext` class embeds structured, advisory context into the
`Metadata.Context` sections of synthesized CloudFormation templates.
It captures the *why* behind your infrastructure - rationale, hard
invariants, change-safety, provenance and operational hints - so that humans
and automated tools working with the deployed template later can act on the
author's intent instead of guessing it.

Add resource-level context on any construct scope. It is rendered onto the
scope's *primary* resources (the `defaultChild` chain of each construct),
skipping incidental helper resources like auto-created IAM policies:

```ts
declare const queue: sqs.Queue;

MetadataContext.of(queue).add({
  why: 'buffer order events async; 14d retention = compliance window',
  must: ['VisTimeout >= 6x fn timeout, else dup on retry'],
  mutable: ContextMutability.CHANGE_WITH_CONSTRAINTS,
  mutability: {
    QueueName: ContextMutability.MUST_NEVER_CHANGE,
  },
  ops: 'check ApproxAgeOfOldestMsg before cutting VisTimeout',
  failureModes: ['retry 3x w/ exp backoff before DLQ'],
});
```

This renders a `Metadata.Context` block on the `AWS::SQS::Queue` resource:

```json
{
  "Type": "AWS::SQS::Queue",
  "Metadata": {
    "Context": {
      "why": "buffer order events async; 14d retention = compliance window",
      "must": ["VisTimeout >= 6x fn timeout, else dup on retry"],
      "mutable": "change-with-constraints",
      "mutability": { "QueueName": "must-never-change" },
      "ops": "check ApproxAgeOfOldestMsg before cutting VisTimeout",
      "failureModes": ["retry 3x w/ exp backoff before DLQ"]
    }
  }
}
```

Context added on an outer scope cascades to all primary resources beneath it
with nearest-wins semantics: scalar fields (`why`, `mutable`, `trust`, `ops`)
from scopes closer to a resource override outer scopes, while list fields
(`must`, `gaps`, `deps`, `failureModes`) accumulate and de-duplicate. Like
`Tags`, context crosses stack boundaries - adding context on a scope that
contains a `NestedStack` also stamps the primary resources inside the nested
stack's template:

```ts
declare const stack: Stack;
declare const queue: sqs.Queue;

// Applies to every primary resource in the stack
MetadataContext.of(stack).add({
  must: ['all data encrypted w/ security-team CMK'],
});

// More specific context for one resource; inherits the stack-level `must`
MetadataContext.of(queue).add({
  why: 'buffers webhook events for async processing',
});
```

Use the options to widen or narrow targeting:

```ts
declare const stack: Stack;

// Stamp context onto every resource, including helper resources
MetadataContext.of(stack).add({
  deps: ['NetworkStack'],
}, {
  applyToAllResources: true,
});

// Only apply to specific resource types
MetadataContext.of(stack).add({
  ops: 'drain queue before changing',
}, {
  includeResourceTypes: ['AWS::SQS::Queue'],
});
```

Record where context came from and how much to trust it with the `trust`
field - useful when context is produced by tooling rather than authored by
the resource owner. When omitted, `source` defaults to `AUTHORED` and
`confidence` to `MEDIUM`:

```ts
declare const queue: sqs.Queue;

MetadataContext.of(queue).add({
  why: 'inferred from retry wrapper in api/handler.ts',
  trust: {
    source: ContextTrustSource.INFERRED,
    confidence: ContextTrustConfidence.LOW,
    citation: 'api/handler.ts:87',
    note: 'no explicit doc found',
  },
});
```

Context can also be applied as a Mixin. `MetadataContextMixin` attaches a
context block imperatively to exactly the constructs you target - via
`.with()` on a single L1 resource, or in bulk via `Mixins.of()`. Context
applied by the Mixin takes precedence over context cascaded from enclosing
scopes (scalar fields win; list fields are unioned):

```ts
declare const stack: Stack;
declare const cfnResource: CfnResource;

// Single resource via .with()
cfnResource.with(new MetadataContextMixin({
  why: 'append-only audit trail buffer',
  mutable: ContextMutability.MUST_NEVER_CHANGE,
  must: ['never shorten retention below 14d (audit requirement)'],
}));

// Bulk application to every CloudFormation resource in a scope
Mixins.of(stack).apply(new MetadataContextMixin({
  deps: ['NetworkStack'],
}));
```

Template-level context holds cross-cutting facts stated once per stack: the
architecture overview, template-wide invariants, pointers to external shared
context, and ownership. The stack's purpose itself belongs in the native
CloudFormation `Description` (the `description` prop of `Stack`):

```ts
declare const stack: Stack;

MetadataContext.of(stack).addToTemplate({
  arch: 'SQS buffer -> Lambda -> DynamoDB; DLQ for poison msgs',
  must: ['all data encrypted w/ security-team CMK'],
  refs: [
    {
      at: 's3://org-iac-ctx/shared/encryption.ctx.yaml',
      has: 'org CMK + tagging rules',
      scope: 'shared',
    },
  ],
  owner: 'order-processing@example.com',
});
```

Keep free-text values terse - drop articles and use symbols (`->`, `>=`,
`w/`) - since context competes with resources for the CloudFormation 1 MB
template size limit. Prefer `must` for binding rules whose violation breaks
something, and `why` for reasoning and rejected alternatives.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```text
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new capability in `aws-cdk-lib` core: the `MetadataContext` class and the
`MetadataContextMixin`, which embed structured, machine-readable design context into the
`Metadata` sections of synthesized CloudFormation templates.

* `MetadataContext.of(scope).add(props, options?)` - declares resource-level context
  (rationale, hard invariants, change-safety, provenance, operational hints, known gaps,
  dependencies, failure modes) on any construct scope. At synthesis time the context is
  rendered as a `Metadata.Context` block on the scope's primary resources, cascading like
  `Tags` with nearest-wins merge semantics.
* `MetadataContext.of(scope).addToTemplate(props)` - declares template-level context
  (architecture overview, cross-cutting invariants, external context references,
  ownership) rendered once as a top-level `Metadata.Context` block.
* `MetadataContextMixin` - the same resource-level context applied imperatively to
  exactly the constructs you target, via `.with()` or `Mixins.of(scope).apply()`.

The emitted wire format follows the `Metadata.Context` v1 vocabulary - a small, closed
set of fields (`why`, `must`, `mutable`, `mutability`, `trust`, `ops`, `gaps`, `deps`,
`failureModes` at resource level; `arch`, `must`, `ref`, `owner` at template level)
designed to be terse, advisory, and consumable by both humans and automated tooling. The
context is plain CloudFormation `Metadata`: it deploys with the stack, has no runtime
effect, and is retrievable with the standard `GetTemplate` and `DescribeStackResource`
APIs - no new service support required.

### Why should I use this feature?

Because the synthesized template is the only artifact that reliably reaches everyone who
touches your infrastructure after you. The engineer (or, increasingly, the AI agent) who
modifies your stack six months from now often has the template and the live stack - not
your source repository, your design doc, or you.

Concrete situations this feature addresses:

* **Safe change review** - `must` and `mutability` tell a reviewer (human or automated)
  which properties are load-bearing before they approve a change. Example: an operator
  about to lower `VisibilityTimeout` sees
  `must: ["VisTimeout >= 6x fn timeout, else dup on retry"]` in the template itself.
* **Operational handoff and incident response** - `why`, `ops` and `failureModes` carry
  the on-call knowledge that normally lives in tribal memory: what the resource is for,
  what to check before touching it, and what the failure/recovery paths are.
* **AI-assisted infrastructure operations** - agents that read templates via
  `GetTemplate`/`DescribeStackResource` act on documented intent instead of inferring it.
  An agent asked to "raise the Lambda timeout to 10s" cannot know that a documented SLA
  caps it lower, or that a queue's visibility timeout is coupled to it - unless the
  template says so. `must` and `ops` are what turn a locally-valid edit into a correct
  one.
* **Organizational context at scale** - template-level `ref` entries point to shared
  context files (e.g. org-wide encryption rules) without repeating them in every
  template, and `trust` distinguishes human-authored context from tool-inferred context
  so consumers can weight it appropriately.

These are not just expectations. We benchmarked the alternatives against each other - no
embedded context, context as source comments, and structured `Metadata.Context` - on the
same CloudFormation update tasks. Structured context consistently produced the best
outcomes, and it is the only one of those approaches that survives synthesis and is
retrievable from a deployed stack.

If you already maintain design context in READMEs or wikis, this feature does not replace
them - it puts the *operationally binding* subset where every consumer of the deployed
stack can actually find it.

## Internal FAQ

### Why are we doing this?

**The deployment artifact is where design context dies today.** CDK's programming model
concentrates rich intent at authoring time: construct hierarchy, source comments, L2/L3
prop choices, code review discussion. Synthesis flattens all of it into L1 resources.
What survives is `aws:cdk:path` (structural, not semantic) and whatever `Description`
properties happen to exist. Every downstream consumer of the template - CloudFormation
console users, change-set reviewers, incident responders, drift investigators, and now AI
agents - works from an artifact that says *what* is deployed but never *why*.

**Agentic tooling makes the gap acute.** AI agents are increasingly asked to modify
deployed infrastructure. They retrieve templates through `GetTemplate` and
`DescribeStackResource` and make changes that are locally valid but globally wrong: they
cannot see cross-resource coupling rules, compliance retention windows, or team SLAs that
never made it into the template. The failure is not that the agent is careless - it is
that the artifact it reads does not contain the constraint it needs to respect.

**We benchmarked that claim rather than assuming it.** Before settling the API we compared
four ways of carrying design context on the same CloudFormation update tasks: no embedded
context, context as source-file comments, structured `Metadata.Context`, and structured
context read by tooling that understands the vocabulary. Context-free templates fared worst
on the tasks whose correct answer depended on knowledge the template did not contain;
structured context produced the largest improvement; context-aware tooling improved on that
again. Appendix B has the comparison.

The benchmark also settled the obvious objection, which is that this is what comments are
for. Comments did score well - where they exist. But they are unavailable to CDK users:
synthesized JSON carries no comments, and no comment in CDK source survives to the
template. They are equally unavailable to *any* consumer retrieving a deployed template
through `GetTemplate`, regardless of how it was authored. Structured metadata is the only
form of this that survives synthesis and deployment, which is what makes it the right
target for CDK.

**CDK is uniquely positioned to populate it.** CDK users do not author the template — they
author constructs, and the template is generated. So the authoring surface has to exist in
CDK, and the construct tree makes it a better place to put one: a single `add()` call on a
scope covers an entire subtree of primary resources, and `defaultChild` chains give precise
targeting so rationale lands on the resources users actually declared, not on synthesized
plumbing. CDK is where most production templates come from, so it is where this belongs.

**Precedent exists in CDK itself.** CDK already injects metadata into every resource
(`aws:cdk:path`, analytics metadata) because structural information was judged valuable
enough to embed by default. This RFC extends the same channel to *semantic* information,
opt-in, under user control.

### Why should we _not_ do this?

* **Stale context is worse than no context.** Rationale written once and never updated
  actively misleads the consumers it was meant to help. Co-location in reviewed CDK source
  and the `trust`/`gaps` fields reduce the risk but do not remove it.
* **This is new public API surface in core.** A class, three enums and five interfaces in
  `aws-cdk-lib` are inherited by every jsii language binding, and the field vocabulary
  becomes a contract downstream tooling pins to. An external construct library could
  deliver the same behavior with no core commitment (see alternatives).
* **Context consumes the template size budget.** Context competes with resources for
  CloudFormation's template size limit. Terse conventions, sparse `mutability` overrides
  and `ref` externalization mitigate this, but large stacks must budget consciously.

### What is the technical solution (design) of this feature?

The design below is implemented as written — see
[aws/aws-cdk#38381](https://github.com/aws/aws-cdk/pull/38381) for the code it describes.
The field vocabulary and the authoring model were settled first, by evaluating context
embedded in templates directly (see appendix B); this section covers how CDK produces it.

#### Wire format: a small, advisory vocabulary

The emitted shape follows a small, versioned vocabulary (`Metadata.Context` v1), defined by
this RFC: the field reference in appendix A and the CDK types below are its normative
description. It is *advisory* — nothing enforces it. CloudFormation ignores it, and any
consumer that chooses to read or validate it does so on its own. CDK
renders the wire format (`trust.src`, `trust.conf`, `trust.cite`, bare-string `ref` entries
when only a URI is present) from idiomatic, fully-spelled TypeScript property names
(`trust.source`, `trust.confidence`, `trust.citation`).

Resource-level fields: `why` (rationale), `must` (hard invariants), `mutable`
(resource-default change-safety), `mutability` (sparse per-property override map),
`trust` (provenance: source/confidence/citation/note), `ops` (pre-change operational
hint), `gaps` (declared unknowns), `deps` (cross-stack/resource dependencies),
`failureModes` (failure/recovery paths).

Template-level fields: `arch` (system shape), `must` (cross-cutting invariants), `ref`
(pointers to external shared/overflow context), `owner` (contact).

Change-safety uses a closed four-level enum: `must-never-change`,
`change-with-constraints`, `review-required`, `free-to-tune`. In the CDK API this is the
`ContextMutability` enum; the schema's single-value-or-map union was deliberately split
into two props (`mutable` for the resource default, `mutability` for the per-property
map) because jsii does not support union types.

#### Declaration model: facade + staged node metadata + one rendering aspect

`MetadataContext.of(scope).add(context, options?)` does two things:

1. **Stages** the entry as construct-node metadata (type `aws:cdk:metadata-context`) on
   the scope, after eager validation (an empty context block or blank list entries throw
   immediately at the `add()` call, not later at synthesis).
2. **Registers** a single rendering aspect (`MetadataContextAspect`, internal) on the
   scope's aspect list if not already present, at `AspectPriority.MUTATING` by default
   (overridable via `options.priority`).

At visit time the aspect walks each `CfnResource`'s ancestor scopes root → leaf,
collecting staged entries whose targeting options match, and merges them so that entries
closer to the resource win. Because merge order derives from the construct tree rather
than from aspect registration order, the semantics are deterministic regardless of how
many scopes declared context or in what order `add()` was called - the same reasoning
that led Tags to a single-visitor design. Finally the merged block is written with
`CfnResource.addMetadata('Context', ...)`; any pre-existing `Metadata.Context` written
directly by the user takes precedence over cascaded context.

Merge semantics, field by field:

* Scalars (`why`, `mutable`, `trust`, `ops`): nearest scope wins.
* Lists (`must`, `gaps`, `deps`, `failureModes`): accumulate across scopes, de-duplicated.
* `mutability` map: per-key merge; nearest scope wins per property name.

#### Primary-resource targeting

By default, context lands only on *primary* resources: a resource is primary relative to
the applied scope when every construct on the path between them that designates a
`defaultChild` designates an ancestor of this resource. This selects the
`AWS::SQS::Queue` inside an `sqs.Queue` while skipping incidental helpers (auto-created
IAM roles/policies, log-retention custom resources, provider-framework functions) that
L2/L3 constructs synthesize - so rationale is not stamped onto plumbing the user never
declared. Plain grouping constructs without a `defaultChild` are transparent. Stack nodes
are structural boundaries, not L2 wrappers: `NestedStack`'s `defaultChild` (its embedding
`AWS::CloudFormation::Stack` resource) does not gate the walk, so context cascades into
nested-stack templates exactly like `Tags` does.

Targeting is tunable per `add()` call: `applyToAllResources: true` disables the primary
filter, and `includeResourceTypes` / `excludeResourceTypes` filter by CloudFormation
type, mirroring the `Tags` options surface.

#### Template-level context

`addToTemplate()` merges into `stack.templateOptions.metadata.Context` directly (no
aspect needed): `arch`/`owner` from later calls win, `must` entries and `ref`s
accumulate. `ref` entries render as bare URI strings when only `at` is present, keeping
templates terse.

#### Mixin form

`MetadataContextMixin` wraps the same staging path for the Mixins API: `supports()` gates
on `CfnResource`, `applyTo()` delegates to `MetadataContext.of(construct).add(...)`.
Because staging directly on the resource is by definition the nearest scope, mixin
context naturally takes precedence over cascaded context under the standard merge rules -
no special-casing required.

#### What is explicitly out of scope for this RFC

This RFC covers **explicit authoring only**: context that a developer states in CDK code.
Automatically deriving context from other sources — inferring `why` from code, or
populating `deps` by analysing the resolved template — is not part of this API commitment.
Any such mechanism is heuristic, and an API contract should not rest on a heuristic. If
derivation is added later it layers on top of this declaration model without changing it,
and the `trust` field already exists so derived context can identify itself as such
(`src: infer`) rather than masquerading as authored.

### Is this a breaking change?

No. The feature is purely additive and opt-in:

* No context is emitted unless `MetadataContext.of(...).add(...)`, `addToTemplate(...)`,
  or the mixin is called. Synthesized output for existing apps is byte-identical.
* `Metadata.Context` is advisory data in a namespace CloudFormation ignores; it has no
  deployment-behavior effect. CloudFormation explicitly permits arbitrary `Metadata`
  keys.
* Users who already write a resource-level `Metadata.Context` key manually (via
  `cfnResource.addMetadata('Context', ...)`) keep working: the rendering aspect merges
  cascaded context *under* explicit resource metadata, so their values win.

### What alternative solutions did you consider?

1. **A standalone Aspect/construct library (no core changes).** The behavior is achievable
   outside core: `CfnResource.addMetadata()` already writes arbitrary keys, so an Aspect in
   a third-party package could render the same blocks. Rejected as the end state for three
   reasons: discoverability (an adoption feature buried in a third-party package reaches a
   fraction of users), duplication (every language ecosystem needs bindings that core gets
   for free via jsii), and integration (the `Mixins` form, `AspectPriority` defaults, and
   eventual L2 integration points all live in core). The external path remains open to
   anyone — the API proposed here does not preclude it.
2. **Reusing existing `Description` properties.** Many L2s expose `description` props
   that render as first-class resource properties. These are complementary, not
   sufficient: only some resource types have them, they conflate "what it does" with
   "why it exists", and they cannot carry structure (invariants, per-property
   change-safety, provenance). The vocabulary's anti-field rules direct consumers to read
   `Description` properties in place rather than duplicating them into context.
3. **Tags.** Tags reach the deployed resources (not just the template) but are
   key-value-flat, tightly length-limited, count-limited, and propagate to billing and
   IAM surfaces where design prose does not belong.
4. **Cloud-assembly metadata (out-of-band) instead of template metadata.** Writing
   context into `manifest.json`/`tree.json` keeps templates untouched, but the cloud
   assembly does not travel with the deployed stack - the consumers this feature targets
   (console users, agents calling `GetTemplate` on a live stack) never see it.
5. **A new top-level template section or CloudFormation service feature.** Strictly more
   powerful (server-side validation, dedicated retrieval APIs) and strictly slower. `Metadata` is
   the extension point CloudFormation already provides, and it requires no service
   change to adopt (appendix C).

### What are the drawbacks of this solution?

* **Template size pressure.** Context counts against the 1 MB template limit. Mitigated
  by the terse-shorthand convention, sparse `mutability` overrides, the hoist rule
  (cross-cutting context stated once at template level), and `ref` externalization - but
  pathological over-annotation is possible. The vocabulary spec includes a documented
  drop order (shed `trust`/`ops`/`failureModes` first, never drop `must`) for tooling
  that trims under pressure.
* **Drift risk.** Context that is not maintained alongside the resources it describes can
  mislead. Partially mitigated by co-location in reviewed CDK source and by `trust`
  provenance; not eliminable.
* **No server-side contract.** CloudFormation will not validate the blocks; garbage in,
  garbage out. The enforcement ceiling is client-side: the synth-time checks in this
  proposal, plus whatever validation a consumer chooses to apply.
* **Fabrication by tooling.** As AI tools begin *writing* CDK code, they may generate
  confident-sounding context. The `trust` field exists precisely so generated context can
  self-identify (`src: infer`, low confidence, citation) — but the API cannot force
  honesty, and a caller is free to claim `authored`.
* **Merge-semantics complexity.** Nearest-wins plus accumulate-and-dedupe plus explicit
  overrides is more to learn than a flat key-value store. The rules mirror `Tags`
  precedence where possible, and the unit-test suite pins them down.

### What is the high-level project plan?

The RFC is published alongside the implementation so maintainers can validate the direction
against working code. The API arrives in one increment: `MetadataContext` (facade, staged
metadata, rendering aspect, primary-resource targeting, template-level merge) together with
`MetadataContextMixin`, plus validation, unit and integration tests, and the `aws-cdk-lib`
README section. The code is available for review at
[aws/aws-cdk#38381](https://github.com/aws/aws-cdk/pull/38381).

The feature ships under the standard core review bar: it is small, purely additive, and has
no feature-flag interaction. Nothing about it needs to bake behind an experimental gate,
because emitting no context is the default and existing synthesized output is unchanged.

### Are there any open issues that need to be addressed later?

* **`deps` is authored, not derived.** A user must state cross-stack dependencies
  explicitly. Deriving them from the resolved template (for example by detecting
  `Fn::ImportValue`) would remove that burden, but it needs a synthesis stage later than
  aspects and is not proposed here.
* **Mutability derivation.** Per-property change-safety could be partially derived from
  CloudFormation resource-type schemas (`UpdateType: Immutable` → `must-never-change`),
  reducing authoring burden using non-heuristic data. A natural follow-on.
* **L2 integration points.** Whether high-value L2s should accept a `context` prop
  directly (e.g. `new sqs.Queue(this, 'Q', { context: {...} })`) rather than requiring
  the `MetadataContext.of()` call is intentionally left out of v1 to keep the surface
  minimal while the vocabulary settles.

## Appendix

### Appendix A - Metadata.Context v1 field reference

Resource-level (`Resources.<LogicalId>.Metadata.Context`):

| Field | Type | Meaning |
| ------- | ------ | --------- |
| `why` | string | Rationale - purpose, notable config choices, rejected alternatives. Non-binding. |
| `must` | string[] | Hard invariants; violating any entry breaks something (data loss, outage, security, corruption, coupling). |
| `mutable` | enum | Resource-default change-safety: `must-never-change` \| `change-with-constraints` \| `review-required` \| `free-to-tune`. |
| `mutability` | map\<property, enum\> | Sparse per-property overrides; only properties deviating from the default or high-stakes. |
| `trust` | object | Provenance: `src` (`authored`\|`comment`\|`commit`\|`infer`), `conf` (`high`\|`medium`\|`low`), optional `cite`, `note`. |
| `ops` | string | What to check before modifying this resource. |
| `gaps` | string[] | Declared unknowns - honest beats fabricated. |
| `deps` | string[] | Cross-stack/cross-resource producer dependencies. |
| `failureModes` | string[] | Failure/recovery paths (retries, timeouts, DLQs, circuit breakers). |

Template-level (top-level `Metadata.Context`):

| Field | Type | Meaning |
| ------- | ------ | --------- |
| `arch` | string | High-level shape/pattern of the system. |
| `must` | string[] | Cross-cutting invariants stated once (DRY). |
| `ref` | (string \| object)[] | Pointers to external shared/overflow context: `at` (URI), optional `has` (hint), `scope`. |
| `owner` | string | Owner/contact, if not already a tag. |

Conventions carried by the companion specification: free-text values use terse
telegraphic shorthand; the hoist rule moves context repeated on more than ~3 resources up
to template level; anti-field rules forbid restating anything the template already
expresses (`Type`, logical IDs, property values, `Description` properties, `aws:cdk:path`);
a tiered drop order governs trimming near the 1 MB limit (shed `trust`, `ops`,
`failureModes`, `gaps`, `deps` first; `must` and template `ref` are never dropped).

### Appendix B - Benchmark and implementation evidence

**Implementation.** The API proposed in this RFC is open as
[aws/aws-cdk#38381](https://github.com/aws/aws-cdk/pull/38381):
`core/lib/metadata-context.ts` (public surface + rendering aspect + primary-resource walk),
`core/lib/private/metadata-context-internal.ts` (wire-format rendering, merge, validation),
and `core/lib/mixins/metadata-context-mixin.ts`. The unit-test suite covers merge
precedence, targeting options, nested-stack cascade, mixin precedence and validation
errors; snapshot-verified integration tests cover both the aspect and mixin paths.

**Benchmark.** The motivating claim - that embedded context changes what a template
consumer actually does - was benchmarked rather than asserted.
Four approaches to carrying design context were compared on the same CloudFormation update
tasks:

1. **No embedded context** — the control: the template states what exists, nothing more.
2. **Context as source-file comments** — the strongest non-structured baseline.
3. **Structured `Metadata.Context`** — the approach this RFC proposes.
4. **Structured `Metadata.Context` plus context-aware tooling** — consumers that understand
   the vocabulary rather than merely reading it as text.

The control performed worst, and by the widest margin on exactly the tasks whose correct
answer depended on knowledge absent from the template. Structured context produced the
largest single improvement over it; context-aware tooling improved on that again. Comments
scored well, but only in the one place they exist — the source file — which is why they are
not a viable answer for CDK or for anything reading a deployed template.

**What the benchmark taught us about the design.** Three findings shaped this proposal:

* **The binding/explanatory split earns its keep.** Consumers need to know which statements
  are invariants and which are reasoning. Collapsing them into one prose field makes the
  invariants unfindable, which is why `must` and `why` are separate fields with an explicit
  decision rule rather than a single `description`.
* **Context must be findable per resource, not per template.** Cross-cutting prose at the
  top of a template gets read past; a rule attached to the resource being edited does not.
  Hence resource-level blocks, with a hoist rule for the genuinely cross-cutting minority.
* **Context informs decisions; it does not enforce them.** Given a documented constraint, a
  consumer is far more likely to *surface* it than to *obey* it when a request conflicts
  with it directly. This is the honest limit of the feature and the reason the RFC frames
  `Metadata.Context` as advisory: enforcement belongs to policy validation and change-set
  review, not to metadata.

### Appendix C - Why `Metadata` is the right carrier

`Metadata` is the extension point CloudFormation already provides for
consumer-defined content: the section accepts arbitrary keys, is ignored by the
provisioning engine, and is already used this way by
`AWS::CloudFormation::Interface` (Console form layout) and by CDK itself
(`aws:cdk:path`). Choosing it means this feature needs no CloudFormation service change.

The relevant public constraints are the template size quotas - the template body is capped
when passed inline and higher when passed by S3 URL - so context competes with resources
for one shared budget. That is the motivation for the vocabulary's terseness conventions,
the sparse `mutability` override rule, the hoist rule for cross-cutting context, and `ref`
externalization. Both retrieval paths for the embedded context are existing public APIs:
resource-level blocks come back from `DescribeStackResource`, and both levels are present
in `GetTemplate` output.

### Appendix D - Relationship to existing CDK metadata

CDK already writes structural metadata into synthesized templates: `aws:cdk:path` on
every resource (construct-tree location) and version-reporting analytics. The
`Metadata.Context` key is additive alongside these; the vocabulary's anti-field rules
explicitly forbid duplicating them (no path, no construct type, no logical id inside
context). Where `aws:cdk:path` answers "where in the source tree did this come from",
`Metadata.Context` answers "why does it exist and how safely can it change" - the two are
complementary layers of the same idea: the synthesized artifact should carry enough of
the authoring-time model for downstream consumers to act correctly.
