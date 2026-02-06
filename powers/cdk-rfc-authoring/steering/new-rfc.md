# Creating a New RFC

> **STOP: Do not generate a full RFC document until you complete Phase 1 and 2.**
> This workflow is conversational. Each phase requires user input before proceeding.

---

## Quick Reference

| Phase | Goal | Gate to Next Phase |
|-------|------|-------------------|
| 1. Discovery | Understand what the user wants to build | User answers all essential questions |
| 2. Research | Learn the AWS service (L2s only) | User confirms scope of resources to include |
| 3. Skeleton | Generate RFC structure with proposals | User has a document to react to |
| 4. Drafting | Iterate section-by-section | User approves each section |

---

## Phase 1: Discovery

**Your goal:** Understand the RFC scope before writing anything.

### Step 1.1: Get GitHub Username (if available)

Before asking questions, try to automatically fetch the user's GitHub username using the GitHub MCP server:

```
Use the GitHub MCP server to get the authenticated user's information.
This will allow you to pre-fill the author field in the RFC metadata.
```

If the GitHub MCP server is configured and returns a username, store it for later use when generating the RFC skeleton.

If the GitHub MCP server is not configured or fails, you'll ask the user for their GitHub username in Step 3 when generating the skeleton.

### Questions to Ask

Ask these questions and **wait for answers**:

1. What AWS service or CDK area does this target?
2. What type of change is this?
   - New L2 construct module → Go to Phase 2
   - Feature addition to existing construct → Skip to Phase 3
   - CLI change → Skip to Phase 3
   - Other → Clarify before proceeding
3. What user pain point does this solve?
4. What's the scope? (single construct, full module, multi-phase initiative)
5. Are there existing GitHub issues or discussions?

### Reference Documents

Point users to these if they're unfamiliar with the process:

- **RFC Template:** `0000-template.md` in workspace or [aws-cdk-rfcs](https://github.com/aws/aws-cdk-rfcs)
- **RFC Process:** [README.md](https://github.com/aws/aws-cdk-rfcs/blob/main/README.md)
- **CDK Design Guidelines:** [DESIGN_GUIDELINES.md](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md)

> **Setup Note:** This power uses the GitHub MCP server to fetch the CDK design guidelines.
> Ensure `GITHUB_TOKEN` environment variable is set with a valid GitHub personal access token.

### Metadata Fields

When filling in the RFC header:

| Field | Required for PR? | Notes |
|-------|------------------|-------|
| **Author** | ✅ Yes | Your GitHub username |
| **Summary** | ✅ Yes | One-sentence description of the change |
| **Tracking Issue** | ❌ No | Leave as placeholder (`#{TRACKING_ISSUE}`); created when PR is opened |
| **API Bar Raiser** | ❌ No | Leave as TBD or placeholder; assigned by maintainers during review |

> Don't block on tracking issue or bar raiser — these are filled in after you submit the PR.

---

## Phase 2: Service Research (New L2 Constructs Only)

> **Skip this phase** if the RFC is a feature addition, CLI change, or non-L2 work.

**Your goal:** Learn the AWS service so you can propose informed API designs.

### Step 2.1: Search AWS Documentation

Use `aws___search_documentation` to find:
- Service overview and key concepts
- Terminology the RFC should use
- Common user workflows

**Example query:** `"Amazon DataSync concepts overview"`

### Step 2.2: Search CloudFormation Resources

Use `search_cloudformation_documentation` to find:
- All `AWS::ServiceName::*` resources
- Required vs optional properties
- Resource relationships

**Example query:** `"AWS::DataSync Task resource properties"`

### Step 2.3: Search CDK Patterns

Use `search_cdk_documentation` to find:
- Similar L2 constructs for API patterns
- Naming conventions
- Integration patterns (IAM, VPC, KMS)

**Example query:** `"CDK EventBridge Pipes L2 construct"`

### Step 2.4: Read CDK Design Guidelines

**This step is critical for API design.** Use the GitHub MCP to fetch the official CDK design guidelines:

```
Repository: aws/aws-cdk
Path: docs/DESIGN_GUIDELINES.md
```

Key sections to review for L2 constructs:
- **Construct interfaces** — Understand the `IResource` and auto-generated `IRef` patterns
- **Import methods** — When to use `fromXxxArn()` vs `fromXxxAttributes()`
- **Grant patterns** — How to implement `grantRead()`, `grantWrite()`, etc.
- **Naming conventions** — Property names, method names, class names
- **Enums and Enum-like Classes** - When to use actual enums or static factories (enum-like approach)

### Understanding IRef Interfaces (Critical for RFCs)

> **IMPORTANT:** This guidance is based on the current CDK Design Guidelines. Always read the [CDK Design Guidelines](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md) directly, specifically the "Construct Interface" section. If the guidelines have changed or conflict with this guidance, **follow the official guidelines**, not this document.

**What are IRef interfaces?**

For every L2 resource construct (e.g., `Cluster`), the CDK build system **automatically generates** a reference interface (e.g., `IClusterRef`). This interface contains the minimal identifying properties needed to reference the resource.

**Key points:**
- `IRef` interfaces are **autogenerated** — you don't define them in your RFC
- You **reference** them (e.g., `extends IClusterRef`) but don't define their contents
- The CDK determines what properties go in `IRef` based on CloudFormation specs
- You don't know what properties `IRef` will contain
- The main interface (e.g., `ICluster`) extends both `IResource` and `IRef`

**In your RFC interfaces:**

```ts
// ✅ DO: Reference ITableRef but don't define it
interface ITable extends cdk.IResource, ITableRef {
  /** The ARN of the table. @attribute */
  readonly tableArn: string;
  /** The name of the table. @attribute */
  readonly tableName: string;
  readonly grants: TableGrants;
}

// ❌ DO NOT: Define ITableRef yourself
interface ITableRef {  // Don't do this!
  readonly tableName: string;
  readonly tableArn: string;
}
```

**How to design your interface:**

Design your interface as if you were only extending `IResource` directly. Include properties based on what your API design actually needs:

- Include a property if your construct's API needs it (e.g., ARN for grants, endpoint for connections)
- Don't include a property if it's never used elsewhere in your design
- Don't make assumptions about what `IRef` provides

**Example:**

```ts
// ✅ DO: Include properties your API actually uses
interface ITable extends cdk.IResource, ITableRef {
  /** The ARN of the table. @attribute */
  readonly tableArn: string;  // Needed for IAM grants
  /** The name of the table. @attribute */
  readonly tableName: string;  // Needed for references
  readonly grants: TableGrants;  // Uses tableArn internally
}

// ✅ ALSO FINE: Only include what you need
interface IBucket extends cdk.IResource, IBucketRef {
  /** The ARN of the bucket. @attribute */
  readonly bucketArn: string;  // Only property the API needs
}
```

The key is to design based on your API's actual requirements. `IRef` will provide whatever it provides, and there may be overlap with your interface properties — that's fine and expected.

### Step 2.5: Confirm Scope with User

**Before generating the skeleton**, share your findings and ask:

```
I found these CloudFormation resources for [Service]:
- AWS::[Service]::[Resource1] — [one-line description]
- AWS::[Service]::[Resource2] — [one-line description]
- AWS::[Service]::[Resource3] — [one-line description]

Questions:
1. Which of these should be L2 constructs in this RFC?
2. Are any out of scope or deferred for a future RFC?
3. Should we start with core resources only, or cover everything?
```

**Wait for confirmation before proceeding.**

---

## Phase 3: Skeleton Generation

**Your goal:** Create a starting point for discussion, not a finished draft.

### Core Principle

> **Propose, don't commit.**
> Every API suggestion should include reasoning, references, and questions.
> The user drives design decisions; you provide options and expertise.

### Step 3.1: Read the Template

Read `0000-template.md` to get the current RFC structure. Do not hardcode sections — the template is the source of truth.

### Step 3.2: Generate Skeleton with Proposals

For each section, add:
- **Working Backwards:** Initial API proposals with code examples
- **FAQ sections:** Contextual guidance placeholders

### How to Write Proposals

> **Important:** The proposal format below is for **conversation with the user**, not the final RFC.
> Once the user approves a proposal, you must rewrite it in clean README format (see Phase 4).

Every proposal needs three parts:

1. **Code example** — Show the proposed API
2. **Reasoning** — Explain why this design (with references)
3. **Questions** — Invite the user to shape the decision

**Proposal format (for discussion only — do not leave this in the final RFC):**

````markdown
#### Creating a [Resource]

**Proposed API:**

```ts
const resource = new service.Resource(this, 'Resource', {
  requiredProp: someValue,
  optionalProp: service.OptionType.VALUE,
});
```

**Reasoning:**
- `requiredProp` is required because [explanation]
- `optionalProp` as an enum-like class follows the Lambda `Runtime` pattern

**References:**
- [AWS::[Service]::[Resource] docs](url) — CloudFormation properties
- [Lambda Runtime](url) — pattern we're following

**Questions:**
- Should `optionalProp` have a default value?
- Should we accept strings for flexibility or only enums for safety?
````

> ⚠️ **This format must be transformed** before the RFC is complete.
> The "Proposed API:", "Reasoning:", "References:", and "Questions:" labels are scaffolding for discussion.
> See "When User Accepts a Proposal" in Phase 4 for the transformation.

**Bad proposal format (don't do this):**

````markdown
#### Creating a [Resource]

```ts
const resource = new service.Resource(this, 'Resource', {
  requiredProp: someValue,
});
```

This creates a resource.
````

The bad format presents the API as decided, leaving no room for discussion.

### Placeholder Formatting

Use *italic text* for guidance placeholders — they're visible in markdown preview.

Do NOT use HTML comments — they're invisible and easy to miss.

---

## Phase 4: Iterative Drafting

**Your goal:** Work through sections collaboratively until each is complete.

### The Loop

For each section:

1. **User reacts** — Do they accept, modify, or reject the proposal?
2. **Discuss if needed** — Explore alternatives together
3. **Get confirmation** — Explicit "yes" before finalizing
4. **Write final version** — Remove proposal scaffolding
5. **Check for gaps** — Ask if anything is missing

### Start with Working Backwards

Always start here — it forces concrete API decisions:

1. Minimal example first (simplest useful resource)
2. Optional features next (common configurations)
3. Import methods last (what attributes are needed?)

### When User Accepts a Proposal

**This is when you transform from proposal format to final RFC format.**

The proposal scaffolding ("Proposed API:", "Reasoning:", "Questions:") was for discussion — it does not belong in the final RFC.

**Transformation steps:**
1. Remove all proposal labels (Proposed API, Reasoning, References, Questions)
2. Write as documentation — as if the feature already exists
3. Move design rationale to Internal FAQ → "What alternatives were considered?"
4. Keep the code examples, but without the "proposed" framing

**Before (proposal format — for discussion):**
````markdown
**Proposed API:**

```ts
const task = new datasync.Task(this, 'Task', {
  source: datasync.S3Location.fromBucket(bucket),
  destination: datasync.EfsLocation.fromFileSystem(efs),
});
```

**Reasoning:** `source`/`destination` follows EventBridge Pipes pattern.

**Questions:** Should we use longer property names?
````

**After (final RFC format — for the document):**
````markdown
The `Task` construct defines a data transfer between source and destination locations.

```ts
const task = new datasync.Task(this, 'Task', {
  source: datasync.S3Location.fromBucket(bucket),
  destination: datasync.EfsLocation.fromFileSystem(efs),
});
```

This creates a DataSync task that transfers data from S3 to EFS.
````

**Where does the reasoning go?**

Move it to Internal FAQ under "What alternative solutions were considered?":

```markdown
### What alternative solutions were considered?

**Property naming:** We considered `sourceLocation`/`destinationLocation` but chose 
`source`/`destination` for conciseness, following the EventBridge Pipes pattern.
```

### When User Wants Changes

Ask clarifying questions:
- "What would you change about this?"
- "Here's an alternative: [code]. Does this match what you're thinking?"
- "That differs from [similar service]. Is that intentional?"

### When User is Unsure

Help them decide:
- "Trade-offs: Option A gives X but loses Y. Option B is the opposite."
- "Let me show both with code — which feels more natural?"
- "What would users expect based on similar AWS services?"

---

## Phase 5: Final Validation Before Submission

> **⚠️ MANDATORY:** Before telling the user the RFC is ready for submission, you MUST re-fetch and verify against the CDK Design Guidelines.

**Your goal:** Catch any design guideline violations that may have been introduced during drafting.

### Step 5.1: Re-fetch CDK Design Guidelines

Even if you fetched the guidelines earlier, fetch them again now:

```
Repository: aws/aws-cdk
Path: docs/DESIGN_GUIDELINES.md
```

**Why re-fetch?**
- During iterative drafting, patterns may have drifted from guidelines
- You may have made assumptions without checking
- This is the last chance to catch issues before the user submits

### Step 5.2: Validate Against the Guidelines

Read through the fetched guidelines and check every interface, method, and pattern in the RFC against what the guidelines actually say. Do not rely on your training data or assumptions — the guidelines are the source of truth.

Key areas to validate (check the guidelines for current patterns):
- Construct interface structure
- Import method signatures
- Grant and metric patterns
- Enum vs enum-like class usage
- Props interface structure

### Step 5.3: Report Any Issues Found

If you find guideline violations:

```
## Pre-Submission Validation

I re-checked the RFC against the CDK Design Guidelines and found:

### ⚠️ Issues to Fix
- [Issue]: [What's wrong and what the guidelines say]

### ✅ Validated
- [Pattern]: Matches guidelines

Would you like me to fix these issues before submission?
```

If no issues found:

```
## Pre-Submission Validation ✅

I verified the RFC against the CDK Design Guidelines. All patterns match the current guidelines.

The RFC is ready for submission.
```

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Thin sections (1-2 sentences) | Expand with concrete details and examples |
| Missing code examples | Generate complete, runnable examples |
| Vague APIs | Define full interfaces with types and JSDoc |
| Only one approach considered | Document 2-3 alternatives with trade-offs |
| Breaking change without migration | Add explicit upgrade steps |
| No project plan | Break into phases with milestones |
