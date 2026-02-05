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

### Step 2.1: Read CDK Design Guidelines

**Before reviewing the draft**, fetch the official CDK design guidelines to use as your reference:

```
Repository: aws/aws-cdk
Path: docs/DESIGN_GUIDELINES.md
```

Key sections to check against:
- **Construct interfaces** — Does the RFC follow `IResource` patterns correctly?
- **Import methods** — Are `fromXxxArn()` vs `fromXxxAttributes()` used appropriately?
- **Grant patterns** — Do grant methods follow the standard signatures?
- **Naming conventions** — Do property/method/class names follow CDK conventions?
- **Enums and Enum-like Classes** — Are enums vs static factories used correctly?

> **Setup Note:** This step uses the GitHub MCP server.
> If `GITHUB_TOKEN` is not configured, you can still review but should note that design guideline compliance wasn't verified.

### Step 2.2: Review Against Checklist

Review the draft against this checklist:

### Metadata
- [ ] Author (GitHub username) — **required for submission**
- [ ] One-sentence summary — **required for submission**
- [ ] Tracking issue (link) — *created automatically when PR is opened, can be placeholder*
- [ ] API Bar Raiser — *assigned during review, can be TBD or placeholder*

> **Note:** Only Author and Summary are required before submitting the RFC PR. The tracking issue is created when you open the PR, and the API Bar Raiser is assigned by maintainers during review. Don't flag these as high-priority gaps.

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
- [ ] Import methods match guideline patterns 
- [ ] Grant methods use standard signatures 
- [ ] Property names follow CDK conventions 
- [ ] Enums vs enum-like classes used appropriately
- [ ] Props interfaces are properly structured

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
- The user says "help me add the X section"

**Step 4.1: Research the AWS Resource**

Use MCP tools to gather information before proposing anything:

```
# Search CloudFormation documentation
search_cloudformation_documentation: "AWS::[Service]::[Resource] properties"

# Read the full resource page if needed
read_iac_documentation_page: [URL from search results]

# Search for similar CDK patterns
search_cdk_documentation: "CDK [similar service] L2 construct"
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

Present what you learned and propose an API — but **wait for confirmation**:

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
```markdown
### README
You can create a cluster like this:
```ts
new Cluster(this, 'Cluster', { ... });
```
```

**After (complete):**
```markdown
### README

Amazon MemoryDB is a Redis-compatible, durable, in-memory database. This module provides L2 constructs for MemoryDB clusters.

#### Creating a Cluster

```ts
import * as memorydb from 'aws-cdk-lib/aws-memorydb';

const cluster = new memorydb.Cluster(this, 'MyCluster', {
  vpc,
  aclName: 'open-access',
});

// Access the endpoint
new CfnOutput(this, 'Endpoint', {
  value: cluster.clusterEndpoint.hostname,
});
```

The construct automatically:
- Creates a subnet group from private subnets
- Configures a security group for Redis traffic (port 6379)
- Sets up CloudWatch alarms for memory and CPU
```

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

```markdown
### Is this a breaking change?

Yes. `oldProperty` has been renamed to `newProperty`.

**Migration steps:**
1. Update CDK dependency to version X.Y.Z
2. Replace `oldProperty` with `newProperty` in all constructs
3. Run `cdk diff` to verify no unexpected changes
4. Deploy with `cdk deploy`

**CHANGELOG entry:**
```
feat(service): rename oldProperty to newProperty

BREAKING CHANGE: `oldProperty` has been renamed to `newProperty`.
Update your code by replacing all occurrences.
```
```

---

## Step 5: Final Checklist

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
