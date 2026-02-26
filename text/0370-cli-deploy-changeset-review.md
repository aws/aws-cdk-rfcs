# Enhanced CLI Deploy Approval With Change Set Review

* **Original Author(s):**: @stevehodgkiss, @orien
* **Tracking Issue**: #370
* **API Bar Raiser**: @{BAR_RAISER_USER}

This feature enhances the existing `--require-approval=any-change` option to show all stack changes (not just
security changes). It integrates CloudFormation change set creation and review to provide users with an accurate
preview of what will be applied before deployment execution.

Modern cloud infrastructure contains critical stateful resources—databases, persistent storage, message queues, and
other systems that hold valuable data and maintain complex state. Engineers deploying changes to these environments
carry significant responsibility: a single misunderstood deployment can lead to data loss, service outages, or
security vulnerabilities that affect customers and business operations. While Infrastructure as Code provides
repeatability and version control, it doesn't eliminate the fundamental need for engineers to understand precisely
what changes will be applied before execution. Tooling must bridge this gap by providing clear, accurate previews
of deployment impact—especially for stateful resources where "undo" isn't always possible. This enhancement ensures
that engineers have the complete information they need to make informed decisions about infrastructure changes.

## Working Backwards

### CHANGELOG

* **feat(cli)**: enhance `--require-approval=any-change` to show all stack changes instead of only security changes
* **feat(cli)**: integrate CloudFormation change set creation and display when using `--require-approval=any-change`
  with standard (non-hotswap) deployments

The `cdk deploy --require-approval=any-change` command now shows all changes to the stack, not just security-related
changes. For standard CloudFormation deployments, it creates a change set, displays both the template diff and the
change set details, and prompts for approval before executing it. This process provides users with the most accurate
preview of what changes will actually be applied.

```bash
# Review all changes before deploying (enhanced behavior)
cdk deploy --require-approval=any-change MyStack

# Existing security-only behavior unchanged
cdk deploy --require-approval=broadening MyStack

# No change set review with hotswap (template diff only)
cdk deploy --require-approval=any-change --hotswap MyStack
```

### README

#### Enhanced Change Approval

The `--require-approval=any-change` option has been enhanced to provide comprehensive change review:

##### Standard Deployments (without --hotswap)

When using standard CloudFormation deployments, `--require-approval=any-change` now:

1. **Shows All Changes**: Displays template diffs for all resource changes, not just security changes
2. **Creates Change Set**: Automatically creates a CloudFormation change set for an accurate deployment preview
3. **Combined Display**: Shows both template diff and change set information
4. **Accurate Resource Impact**: Displays physical resource changes, replacements, and dependencies
5. **Requires Approval**: Prompts for confirmation before executing the change set

##### Example Output

```
$ cdk deploy --require-approval=any-change ExampleProjectStack

✨  Synthesis time: 2.07s

ExampleProjectStack: start: Building ExampleProjectStack Template
ExampleProjectStack: success: Built ExampleProjectStack Template
ExampleProjectStack: start: Publishing ExampleProjectStack Template (111111111111-ap-southeast-2-a1178ad2)
ExampleProjectStack: success: Published ExampleProjectStack Template (111111111111-ap-southeast-2-a1178ad2)
ExampleProjectStack: creating CloudFormation changeset...
Changeset arn:aws:cloudformation:ap-southeast-2:111111111111:changeSet/cdk-change-set-1758811656501/c607dcdd-994d-47b1-81ea-cbc8d17f6ccf
created and waiting in review for manual execution (--no-execute)
Stack ExampleProjectStack
Resources
[~] AWS::SQS::Queue ExampleProjectQueue ExampleProjectQueue0324465D replace
 ├─ [+] QueueName (requires replacement)
 │   └─ new-custom-name
 └─ [~] VisibilityTimeout
     ├─ [-] 301
     └─ [+] 300

Do you wish to deploy these changes (y/n)? y
ExampleProjectStack: deploying... [1/1]
Executing existing change set cdk-change-set-1758811656501 on stack ExampleProjectStack

 ✅  ExampleProjectStack

✨  Deployment time: 73.13s

Stack ARN:
arn:aws:cloudformation:ap-southeast-2:111111111111:stack/ExampleProjectStack/06bd8930-9a19-11f0-a13f-0a8d18d6260b

✨  Total time: 75.2s
```

##### Hotswap Deployments

When using `--require-approval=any-change` with `--hotswap`, the behavior is enhanced:

- Shows template diff for all changes (previously only showed security changes)
- No change set creation (hotswap bypasses CloudFormation)
- Proceeds with hotswap deployment after approval

##### Existing Options Unchanged

- `--require-approval=never`: No approval required (default)
- `--require-approval=broadening`: Only security-broadening changes require approval (unchanged behavior)

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching enhanced functionality for the existing `--require-approval=any-change` flag. This enhancement makes
the flag show all stack changes (not just security changes) and integrates CloudFormation change set creation for
standard deployments. Users get both template diff information and accurate change set details, showing exactly what
CloudFormation will execute.

### Why should I use this feature?

The enhanced `--require-approval=any-change` addresses several use cases:

1. **Complete Change Visibility**: See all changes to your stack, not just security changes
2. **Accurate Deployment Preview**: Change sets show the actual changes CloudFormation will make, including parameter
   updates that don't appear in template diffs
3. **Resource Replacement Detection**: Change sets indicate when resources will be replaced, preventing data loss
4. **Production Safety**: Required approval step prevents accidental, destructive deployments
5. **Compliance**: Manual review process for infrastructure changes
6. **Parameter-Only Deployments**: Visibility into CloudFormation parameter changes that trigger resource updates

This feature is particularly valuable for production environments and teams with change management requirements.

## Internal FAQ

### Why are we doing this?

The current `--require-approval=any-change` option is misleading; it shows only security-related changes, not all
changes, as the name implies. This misnomer affects both standard and hotswap deployments. Users who want to review
all changes before deployment don't have a good option. Additionally, template diffs don't show the complete picture
of what CloudFormation will actually do:

1. **Parameter Changes**: CloudFormation parameter updates that trigger resource changes don't show in template diffs
2. **Resource Replacement**: Template diffs don't indicate when resources will be replaced vs. updated in-place
3. **Dependency Changes**: Order of operations and dependencies are not visible in template diffs
4. **Physical Resource Impact**: Template diffs show logical changes but not physical resource impacts

CloudFormation change sets provide definitive information about what will actually happen during deployment. The
[original implementation attempt](https://github.com/aws/aws-cdk/pull/15494) demonstrated the value of this approach.

### Why should we _not_ do this?

This change modifies existing behavior, which could be disruptive:

1. **Behavior Change**: `--require-approval=any-change` currently only shows security changes; expanding to all changes
   could be unexpected
2. **Performance Impact**: Creating change sets adds latency to the deployment process
3. **Hotswap Incompatibility**: Change sets cannot work with hotswap deployments, creating an inconsistent user experience
4. **API Dependencies**: Additional CloudFormation API calls and potential rate limiting
5. **Complexity**: More code paths to maintain and test

However, these concerns are mitigated by the fact that the current behavior is already misleading (the name suggests
all changes, but only shows security changes), and the performance impact only affects users who explicitly opt into
the approval process.

### What is the technical solution (design) of this feature?

The implementation enhances the existing `--require-approval` logic with change set integration:

#### High-Level Flow

1. **Synthesis**: Standard CDK app synthesis to generate CloudFormation templates
2. **Approval Check**: Determine if approval is required based on `--require-approval` value
3. **Template Diff**: Generate template diff showing all changes (enhanced from current security-only logic)
4. **Deployment Type Check**:
   - For hotswap deployments: show template diff and proceed with existing approval flow
   - For standard deployments: continue to change set creation
5. **Change Set Creation**: Call CloudFormation `CreateChangeSet` API
6. **Combined Display**: Show both template diff and change set information
7. **User Approval**: Interactive prompt for confirmation
8. **Change Set Execution**: Call `ExecuteChangeSet` API on approval

#### Key Components

1. **Enhanced DiffAnalyzer**: Modify existing logic to detect all changes instead of only security changes
2. **ChangeSetCreator**: New component to create and describe CloudFormation change sets
3. **CombinedDisplayFormatter**: Format both template diff and change set information
4. **ApprovalPrompt**: Enhanced to handle both template diff and change set approval

#### Change Set Integration

- **Automatic Creation**: Change sets are created automatically for `--require-approval=any-change` on standard
  deployments
- **Naming Convention**: `cdk-deploy-change-set-{timestamp}` to avoid conflicts
- **Cleanup**: Change sets are automatically deleted after successful execution or on cancellation
- **Error Handling**: Graceful fallback to template diff only if change set creation fails

### Is this a breaking change?

This is technically a breaking change in behavior, but it aligns with user expectations:

**Breaking aspects**:

- `--require-approval=any-change` will now show all changes instead of only security changes (affects both standard and hotswap deployments)
- Additional latency due to change set creation for standard deployments
- Different approval prompts that include change set information for standard deployments
- Hotswap deployments will show template diffs for all changes instead of only security changes

**Mitigation**:

- The current behavior is misleading - users expect "any-change" to mean all changes
- Users explicitly opt into this behavior with the flag
- Existing `--require-approval=broadening` behavior remains unchanged
- Performance impact only affects users who choose to use approval

**Migration path**:

- Users who want the old security-only behavior should use `--require-approval=broadening`
- Documentation will clearly explain the enhanced behavior

### What alternative solutions did you consider?

#### 1. Add New `--require-approval=all-changes` Option

Add a new option value instead of changing existing behavior.
**Rejected**: Would leave the misleading `any-change` option unchanged and create confusion between `any-change` and
`all-changes`.

#### 2. Create Separate `--review-changeset` Flag

Add a separate flag specifically for change set review.
**Rejected**: Creates fragmented functionality; approval and change set review are closely related concerns that should
be unified.

#### 3. Always Create Change Sets for Any Approval

Create change sets for all `--require-approval` modes.
**Rejected**: Unnecessary overhead for security-only approval workflows.

#### 4. Only Show Change Sets, Remove Template Diff

Show only change set information without template diff.
**Rejected**: Template diffs provide valuable context about CDK-level changes that complement change set physical
resource information.

### What are the drawbacks of this solution?

1. **Behavioral Breaking Change**: Existing `--require-approval=any-change` users will see different behavior
2. **Performance Impact**: Change set creation adds 5-15 seconds to the deployment process
3. **Inconsistent Experience**: Different behavior between hotswap and standard deployments
4. **Additional API Calls**: More CloudFormation API usage and potential throttling
5. **Complexity**: More code paths and error handling scenarios
6. **User Confusion**: Users may not understand why some deployments show change sets and others don't

### What is the high-level project plan?

#### Phase 1: Core Implementation

- Modify existing `--require-approval=any-change` logic to show all changes instead of security-only
- Implement change set creation for standard (non-hotswap) deployments
- Add a combined display of template diff and change set information
- Update approval prompt to handle change set confirmation

#### Phase 2: Polish & Integration

- Implement change set cleanup on success/failure
- Add comprehensive error handling for change set creation failures
- Optimize display formatting for large change sets
- Add a configuration option in `cdk.json` for change set timeout

#### Phase 3: Documentation & Migration

- Update CLI help text and documentation
- Create a migration guide for users affected by the behavior change
- Add examples and best practices
- Performance optimization based on usage patterns

### Are there any open issues that need to be addressed later?

1. **User Communication**: How to best communicate the behavior change to existing users
2. **Change Set Cleanup**: Automatic cleanup strategy for failed or cancelled deployments
3. **Large Change Sets**: Optimal display format for deployments with hundreds of resources
4. **Nested Stacks**: Change set behavior with nested stack deployments
5. **Performance Optimization**: Caching strategies to reduce change set creation time
6. **Error Recovery**: Fallback strategies when change set creation fails
7. **Configuration**: Options to disable change set creation for specific environments

## Appendix

### CloudFormation Change Set API Reference

- [`CreateChangeSet`](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_CreateChangeSet.html):
  Create a change set for deployment preview
- [`DescribeChangeSet`](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_DescribeChangeSet.html):
  Get detailed change set information
- [`ExecuteChangeSet`](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_ExecuteChangeSet.html):
  Execute approved changes
- [`DeleteChangeSet`](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_DeleteChangeSet.html):
  Clean up change sets after execution or cancellation

### Current vs Enhanced Behavior

| Scenario | Current Behavior | Enhanced Behavior |
| -------- | ---------------- | ----------------- |
| `--require-approval=any-change` (standard deploy) | Shows only security changes, direct deploy | Shows all changes + change set, execute change set |
| `--require-approval=any-change` (hotswap) | Shows only security changes, hotswap deploy | Shows all changes, hotswap deploy |
| `--require-approval=broadening` | Shows security changes, direct deploy | **Unchanged** |
| `--require-approval=never` | No approval, direct deploy | **Unchanged** |

### Hotswap Compatibility

Hotswap deployments bypass CloudFormation entirely, making them incompatible with change sets:

- **With hotswap**: Template diff shows all changes, approval prompt, then hotswap deployment (no change set)
- **Without hotswap**: Template diff + change set details, approval prompt, then change set execution

### Migration Guide

**For users currently using `--require-approval=any-change`:**

**Before (current behavior):**

- Only security-related changes are shown in the template diff
- Direct CloudFormation deployment (standard) or hotswap deployment
- Fast deployment after approval

**After (enhanced behavior):**

- All changes shown in template diff (security + non-security)
- **Standard deployments**: Change set creation and review + template diff
- **Hotswap deployments**: Enhanced template diff showing all changes (no change set)
- Slightly slower for standard deployments due to the change set creation
- More accurate preview of deployment impact

**If you want the old behavior:**

Use `--require-approval=broadening`, which maintains the current security-only focus.

### Example Scenarios

#### Scenario 1: Lambda Function Update

```bash
# Template shows: Lambda function code change
# Change set shows: UpdateFunctionCode API call, no replacement
# User sees: Both perspectives for complete understanding
```

#### Scenario 2: RDS Parameter Change

```bash
# Template shows: No visible changes (parameter-only update)
# Change set shows: Database replacement required due to parameter change, ALL DATA WILL BE LOST
# User sees: Critical information that template diff cannot provide
```

#### Scenario 3: Security Group Modification

```bash
# Template shows: Security group rule changes
# Change set shows: Which EC2 instances will be affected by the change
# User sees: Both logical and physical impact of the change
```
