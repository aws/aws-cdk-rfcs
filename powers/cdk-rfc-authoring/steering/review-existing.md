# Reviewing an Existing RFC Draft

> **Your role:** Identify gaps, suggest improvements, and help strengthen weak sections.
> Work collaboratively — don't rewrite the entire RFC without user input.

---

## Quick Reference

| Step | Goal | Output |
|------|------|--------|
| 1. Get the draft | Have the full RFC content | Draft loaded in context |
| 2. Health check | Identify what's strong vs weak | Assessment shared with user |
| 3. Prioritize | Agree on what to fix first | User picks focus area |
| 4. Improve | Strengthen sections iteratively | Revised sections |
| 5. Final check | Verify RFC is submission-ready | Checklist complete |

---

## Step 1: Get the Draft

Ask the user to share their RFC:

```
Please share your RFC draft — either:
- Paste the content here
- Point me to the file path
- Share the GitHub PR/issue link
```

If they reference a file, read it before proceeding.

---

## Step 2: Health Check

### Step 2.1: Read CDK Design Guidelines (MANDATORY)

> **⚠️ DO NOT SKIP THIS STEP.** You MUST fetch and read the official CDK design guidelines before reviewing any RFC. Skipping this step leads to false positives — flagging correct patterns as issues because you're relying on assumptions instead of the actual guidelines.

**Before reviewing the draft**, fetch the official CDK design guidelines using the GitHub MCP server:

```
Repository: aws/aws-cdk
Path: docs/DESIGN_GUIDELINES.md
```

**Why this is mandatory:**
- The design guidelines are the source of truth for CDK API patterns
- Guidelines evolve — your training data may be outdated
- Many patterns (IRef interfaces, Grants classes, Metrics classes) are non-obvious without reading the docs
- Raising concerns about patterns that are actually correct wastes the user's time

Key sections to check against:
- **Construct interfaces** — Does the RFC follow `IResource` and `IRef` patterns correctly?
- **Import methods** — Are `fromXxxArn()` vs `fromXxxAttributes()` used appropriately?
- **Grant patterns** — Do grant methods follow the standard signatures? (Note: helper classes like `XxxGrants` are the recommended new pattern)
- **Metrics patterns** — Are metrics exposed via helper classes or direct methods?
- **Naming conventions** — Do property/method/class names follow CDK conventions?
- **Enums and Enum-like Classes** — Are enums vs static factories used correctly?

> **Setup Note:** This step uses the GitHub MCP server.
> If `GITHUB_TOKEN` is not configured, explicitly tell the user that design guideline compliance could not be verified and recommend they self-check against the guidelines.

### Step 2.2: Review Against Checklist

Review the draft against this checklist:

### Metadata
- [ ] Author (GitHub username) — **required for submission**
- [ ] One-sentence summary — **required for submission**
- [ ] Tracking issue (link) — *created automatically when PR is opened, can be placeholder*
- [ ] API Bar Raiser — *assigned during review, can be TBD or placeholder*

> **Note:** Only Author and Summary are required before submitting the RFC PR. The tracking issue is created when you open the PR, and the API Bar Raiser is assigned by maintainers during review. Don't flag these as high-priority gaps.

#### Auto-filling Author Field

If the Author field is missing or uses a placeholder, try to fetch the user's GitHub username automatically using the GitHub MCP server before asking them:

```
Use the GitHub MCP server to get the authenticated user's information.
```

If the GitHub MCP server is configured and returns a username, suggest updating the Author field with that username. If it fails or isn't configured, ask the user for their GitHub username directly.

### Working Backwards
- [ ] README section exists
- [ ] Code examples are complete and runnable
- [ ] Examples show minimal AND advanced usage
- [ ] Import methods documented
- [ ] CHANGELOG entry (if user-facing change)
- [ ] PRESS RELEASE (only if major initiative, ~6+ months)

### Public FAQ
- [ ] "What are we launching?" is specific
- [ ] "Why should I use this?" has concrete use cases

### Internal FAQ
- [ ] "Why are we doing this?" explains motivation
- [ ] "Why should we NOT do this?" is honest about downsides
- [ ] "Alternative solutions" has 2-3 options with trade-offs
- [ ] "Is this a breaking change?" has migration path if yes
- [ ] "Project plan" has phases and milestones

### API Design
- [ ] Interfaces have complete type definitions
- [ ] JSDoc comments on all properties
- [ ] Grant methods (if applicable)
- [ ] Metric methods (if applicable)
- [ ] Import methods (fromXxxName, fromXxxAttributes)

### Design Guidelines Compliance
- [ ] Construct interfaces follow recommended pattern
- [ ] IRef interfaces referenced correctly (not defined — see below)
- [ ] Import methods match guideline patterns 
- [ ] Grant methods use standard signatures 
- [ ] Property names follow CDK conventions 
- [ ] Enums vs enum-like classes used appropriately
- [ ] Props interfaces are properly structured

### Understanding IRef Interfaces

> **IMPORTANT:** This guidance is based on the current CDK Design Guidelines. Always read the [CDK Design Guidelines](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md) directly, specifically the "Construct Interface" section. If the guidelines have changed or conflict with this guidance, **follow the official guidelines**, not this document.

**What are IRef interfaces?**

For every L2 resource construct (e.g., `Cluster`), the CDK build system **automatically generates** a reference interface (e.g., `IClusterRef`). This interface contains the minimal identifying properties needed to reference the resource.

**Key points for reviewers:**
- `IRef` interfaces are **autogenerated** — RFCs should reference them (`extends IClusterRef`) but NOT define them
- The main interface (e.g., `ICluster`) extends both `IResource` and `IRef`
- Don't flag missing `IRef` definitions as a gap — they're intentionally absent
- Overlap between the interface and `IRef` is fine and expected

**Correct pattern (reference but don't define):**

```ts
// ✅ CORRECT: Reference IClusterRef without defining it
interface ICluster extends cdk.IResource, IClusterRef {
  readonly clusterArn: string;
  readonly clusterName: string;
  readonly grants: ClusterGrants;
}
```

**Incorrect pattern (don't do this):**

```ts
// ❌ WRONG: Defining IClusterRef manually
interface IClusterRef {
  readonly clusterName: string;
  readonly clusterArn: string;
}
```

**What to check:**
- Interface extends `IResource` and `IXxxRef` ✓
- `IXxxRef` is NOT defined in the RFC ✓
- Interface includes properties the API actually needs (ARN for grants, endpoint for connections, etc.) ✓

---

## Step 3: Share Assessment and Prioritize

After reviewing, share a structured assessment:

```
## RFC Health Check: [RFC Title]

### ✅ Strong Sections
- [Section]: [Why it's good]
- [Section]: [Why it's good]

### 🚨 Missing Sections (require research + proposal)
- [Construct/Resource]: Mentioned in [location] but no README documentation
- [Section]: Required by template but entirely absent

### ⚠️ Sections Needing Work (exist but incomplete)
- [Section]: [What's missing or weak]
- [Section]: [What's missing or weak]

### 📐 Design Guidelines Issues
- [Issue]: [What doesn't align with CDK conventions and how to fix]
- [Issue]: [What doesn't align with CDK conventions and how to fix]

### Recommended Priority
1. [Most critical gap] — [Why it matters]
2. [Second priority] — [Why it matters]
3. [Third priority] — [Why it matters]

Which would you like to tackle first?
```

> **Important:** Distinguish between "missing" (needs research + proposal workflow) and "needs work" (can improve directly).
> Missing sections require the conversational approach in Step 4.
> Design guidelines issues should be flagged even if the section is otherwise complete.

**Wait for user to choose before proceeding.**

---

## Step 4: Improve Sections

Work on the section the user chose. Use the patterns below.

### Adding a Completely Missing Section (e.g., undocumented construct)

> **STOP: Do not generate the missing section immediately.**
> When a section is entirely missing (not just thin), use the conversational research approach.

**When to use this pattern:**
- A construct is mentioned in the RFC but has no README documentation
- A CloudFormation resource is in scope but not covered
- A CLI feature or behavior is referenced but not explained
- A service feature is in scope but not researched
- The user says "help me add the X section"

**Step 4.1: Research the Relevant Area**

Use MCP tools to gather information before proposing anything. Adapt your research based on what the RFC covers:

**For L2 constructs / CloudFormation resources:**

```
# Search CloudFormation documentation
search_cloudformation_documentation: "AWS::[Service]::[Resource] properties"

# Read the full resource page if needed
read_iac_documentation_page: [URL from search results]

# Search for similar CDK patterns
search_cdk_documentation: "CDK [similar service] L2 construct"
```

**For feature additions to existing constructs:**

```
# Search for the specific feature's documentation
aws___search_documentation: "[Service] [feature name] configuration"

# Check CloudFormation support for the feature
search_cloudformation_documentation: "AWS::[Service]::[Resource] [feature property]"

# See how similar features are exposed in other CDK modules
search_cdk_documentation: "CDK [similar feature] pattern"
```

**For CLI changes:**

```
# Search for current CLI behavior and documentation
aws___search_documentation: "AWS CDK CLI [command or area]"

# Search for existing CLI patterns in CDK
search_cdk_documentation: "CDK CLI [related command or feature]"
```

**Step 4.2: Verify Against Design Guidelines**

Before proposing an API, check the CDK design guidelines (fetched in Step 2.1) for:
- Correct interface patterns for this type of resource
- Appropriate import method style
- Standard grant method signatures (if applicable)
- Naming conventions for properties and methods

If you didn't fetch the guidelines earlier, do so now:
```
Repository: aws/aws-cdk
Path: docs/DESIGN_GUIDELINES.md
```

**Step 4.3: Share Findings and Propose**

Present what you learned and propose a design — but **wait for confirmation**. Adapt the format based on the change type:

**For L2 constructs:**

```
I researched AWS::[Service]::[Resource] and found:

**CloudFormation Properties:**
- `PropertyA` (required) — [description]
- `PropertyB` (optional) — [description]
- `PropertyC` (optional) — [description]

**Proposed L2 API:**

```ts
const resource = new service.Resource(this, 'Resource', {
  propertyA: value,
  propertyB: service.OptionType.VALUE,
});
```

**Reasoning:**
- `propertyA` maps directly from CFN (required)
- `propertyB` uses enum-like class following [similar CDK pattern]
- [Note any design guideline patterns being followed]

**Questions before I write this section:**
1. Does this API shape match your intent?
2. Should `propertyC` be included or deferred?
3. Any additional methods needed (e.g., `addX()`, grants)?
```

**For feature additions:**

```
I researched [feature] for [Service] and found:

**Feature Details:**
- [What the feature does]
- [Configuration options and constraints]
- CloudFormation support: [relevant properties]

**Proposed API addition:**

```ts
// How the feature would be exposed on the existing construct
const resource = new service.Resource(this, 'Resource', {
  existingProp: value,
  newFeatureProp: service.FeatureOption.VALUE,
});
```

**Reasoning:**
- [Why this API shape fits the existing construct]
- [Similar patterns in other CDK modules]

**Questions before I write this section:**
1. Does this fit naturally with the existing construct API?
2. Should this be a prop, a method, or both?
3. Any backward compatibility concerns?
```

**For CLI changes:**

```
I researched how the CLI currently handles [area]:

**Current Behavior:**
- [How it works today]
- [Related commands and flags]
- [Known limitations or pain points]

**Proposed Change:**

[Description of the proposed CLI behavior, commands, or flags]

**Reasoning:**
- [Why this change improves the experience]
- [Precedent from similar CLI patterns]

**Questions before I write this section:**
1. Does this match your understanding of the current behavior?
2. Are there backward compatibility concerns with existing scripts?
3. Should this be a new command, a flag, or a config option?
```

**Step 4.4: Wait for User Confirmation**

Do NOT write the section until the user confirms the approach.

**Step 4.5: Write the Final Section**

Once confirmed, write the section in final RFC format (not proposal format):

```markdown
##### [Resource Name]

The `Resource` construct creates a [description].

```ts
const resource = new service.Resource(this, 'Resource', {
  propertyA: value,
});
```

[Explanatory text about what the construct does and any automatic behaviors]
```

Move any design rationale to Internal FAQ → "What alternatives were considered?"

---

### Improving Working Backwards / README

**If code examples are thin or missing (but section exists):**

1. Ask clarifying questions about the intended API
2. Generate complete examples showing:
   - Minimal usage (simplest useful case)
   - Common configurations (2-3 variations)
   - Import patterns (if applicable)
3. Add explanatory text around examples

**Before (thin):**

> ```ts
> new Cluster(this, 'Cluster', { ... });
> ```

**After (complete):**

> Amazon MemoryDB is a Redis-compatible, durable, in-memory database. This module provides L2 constructs for MemoryDB clusters.
>
> ```ts
> import * as memorydb from 'aws-cdk-lib/aws-memorydb';
>
> const cluster = new memorydb.Cluster(this, 'MyCluster', {
>   vpc,
>   aclName: 'open-access',
> });
>
> // Access the endpoint
> new CfnOutput(this, 'Endpoint', {
>   value: cluster.clusterEndpoint.hostname,
> });
> ```
>
> The construct automatically:
> - Creates a subnet group from private subnets
> - Configures a security group for Redis traffic (port 6379)
> - Sets up CloudWatch alarms for memory and CPU

### Improving Internal FAQ — Alternatives

**If only one approach is considered:**

1. Research similar CDK constructs with MCP tools
2. Propose 2-3 alternative approaches
3. Help articulate pros/cons

**Template:**
```markdown
### What alternative solutions were considered?

**Option A: [Name]**
- Approach: [Brief description]
- Pros: [List]
- Cons: [List]

**Option B: [Name]**
- Approach: [Brief description]
- Pros: [List]
- Cons: [List]

**Option C: [Name]**
- Approach: [Brief description]
- Pros: [List]
- Cons: [List]

**Decision:** Option [X] was chosen because [reasoning].
```

### Improving Internal FAQ — Project Plan

**If missing or vague:**

Help break work into phases:

```markdown
### Project Plan

**Phase 1: Core Functionality**
- [Primary construct] with minimal props
- Basic integration tests
- README documentation

**Phase 2: Extended Features**
- [Secondary construct]
- Grant methods
- Metric methods

**Phase 3: Polish**
- Import methods
- Cross-account support
- Additional examples

**Feedback Checkpoints:**
- After Phase 1: Community review of core API
- After Phase 2: Bar raiser review
```

### Fixing Missing Import Methods

**If no way to reference existing resources:**

```ts
// Simple import — when single identifier suffices
static fromClusterName(scope: Construct, id: string, clusterName: string): ICluster;

// Full import — when connections or runtime attributes needed
static fromClusterAttributes(scope: Construct, id: string, attrs: ClusterAttributes): ICluster;

interface ClusterAttributes {
  readonly clusterName: string;
  readonly clusterEndpointAddress?: string;
  readonly clusterEndpointPort?: number;
  readonly securityGroups?: ec2.ISecurityGroup[];
}
```

### Fixing Breaking Changes Without Migration

**If breaking change mentioned but no upgrade path:**

> ### Is this a breaking change?
>
> Yes. `oldProperty` has been renamed to `newProperty`.
>
> **Migration steps:**
> 1. Update CDK dependency to version X.Y.Z
> 2. Replace `oldProperty` with `newProperty` in all constructs
> 3. Run `cdk diff` to verify no unexpected changes
> 4. Deploy with `cdk deploy`

**CHANGELOG entry format:**

```
feat(service): rename oldProperty to newProperty

BREAKING CHANGE: `oldProperty` has been renamed to `newProperty`.
Update your code by replacing all occurrences.
```

---

## Step 5: Final Validation and Checklist

> **⚠️ MANDATORY:** Before telling the user the RFC is ready for submission, you MUST re-fetch and verify against the CDK Design Guidelines.

### Step 5.1: Re-fetch CDK Design Guidelines

Even if you fetched the guidelines in Step 2, fetch them again now:

```
Repository: aws/aws-cdk
Path: docs/DESIGN_GUIDELINES.md
```

**Why re-fetch?**
- During iterative improvements, patterns may have drifted from guidelines
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

### Step 5.3: Content Checklist

Before the RFC is ready for submission, verify:

### Content Complete
- [ ] All template sections filled in
- [ ] No placeholder text remaining
- [ ] Code examples are runnable

### Quality Standards
- [ ] README explains "why" not just "what"
- [ ] At least 2-3 alternatives documented
- [ ] Trade-offs clearly articulated
- [ ] Security considerations addressed

### Process Ready
- [ ] Author identified (required)
- [ ] Project plan has phases
- [ ] Tracking issue placeholder present (will be updated after PR creation)
- [ ] API Bar Raiser placeholder present (will be assigned during review)

### Step 5.4: Report Validation Results

**If you find guideline violations:**

```
## Pre-Submission Validation

I re-checked the RFC against the CDK Design Guidelines and found:

### ⚠️ Issues to Fix
- [Issue]: [What's wrong and what the guidelines say]

### ✅ Validated
- [Pattern]: Matches guidelines

Would you like me to fix these issues before submission?
```

**If no issues found:**

```
## Pre-Submission Validation ✅

I verified the RFC against the CDK Design Guidelines. All patterns match the current guidelines.

The RFC is ready for submission.
```

---

## When the User is Stuck

**If they don't know what to write:**
- Ask targeted questions about what they're trying to solve
- Generate 2-3 options for them to react to

**If they can't choose between options:**
- Articulate trade-offs explicitly
- Show code examples for each option
- Ask "What would your users expect?"

**If they need inspiration:**
- Use MCP tools to find similar CDK constructs
- Reference well-structured RFCs:
  - [RFC 340 (Firehose)](https://github.com/aws/aws-cdk-rfcs/blob/main/text/0340-firehose-l2.md)
  - [RFC 431 (SageMaker)](https://github.com/aws/aws-cdk-rfcs/blob/main/text/0431-sagemaker-l2-endpoint.md)
