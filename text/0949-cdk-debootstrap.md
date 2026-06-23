# `cdk debootstrap` — Reverse CDK Bootstrap

* **Original Author(s):**: @sanjanaravikumar-az
* **Tracking Issue**: [#949](https://github.com/aws/aws-cdk-rfcs/issues/949)
* **API Bar Raiser**: @rix0rrr

There is no supported way to reverse `cdk bootstrap`. Users who stop using CDK
in an account/region, or need to re-bootstrap with a different configuration
must manually empty S3 buckets, delete ECR images, and remove the CloudFormation
stack. This is an error-prone process and leads to broken states.

## Working Backwards

### CHANGELOG

```
feat(cli): add `cdk debootstrap` command to reverse CDK bootstrap
```

### README

#### `cdk debootstrap`

Removes the CDK bootstrap stack and all associated resources from an AWS
environment that get created when `cdk bootstrap` is run.

##### Usage

When you want to remove bootstrap resources from your account, run:

```console
$ cdk debootstrap aws://123456789012/us-east-1
```

If you want to multi-select environments interactively (discovers bootstrapped
environments and presents a picker):

```console
$ cdk debootstrap
```

##### What it does

`cdk debootstrap` performs a complete teardown of the CDKToolkit CloudFormation
stack in a specified environment:

1. Empties the S3 staging bucket (all object versions)
2. Deletes all images in the ECR container assets repository
3. Deletes the CDKToolkit CloudFormation stack (which cascades IAM roles, KMS
   key, SSM parameter)
4. Deletes the orphaned S3 bucket (left behind due to its
   `DeletionPolicy: Retain`)

##### Confirmation prompts

The command displays two sequential prompts before any destructive action.

**Prompt 1 - Dependency warning** :

This is shown when there are dependent stacks found.

```
⚠️  The following stacks use this bootstrap and will no longer be deployable or destroyable via CDK:
  - MyAppStack
  - MyOtherStack

Do you want to continue? (y/N):
```

**Prompt 2 - Final confirmation**:

This prompt will always be shown unless the user uses `--yes`

```
This will permanently delete all assets in the staging bucket and ECR repository.
The bootstrap stack can be re-created with `cdk bootstrap`, but stored assets cannot be recovered.

You are about to destroy the CDK bootstrap stack in:
  Account : 123456789012
  Region  : us-east-1
  Stack   : CDKToolkit (qualifier: hnb659fds)

Are you sure you want to proceed? (y/N):
```

`--force` skips the dependency check entirely. `--yes` skips all interactive
prompts.

##### Flags

| Flag | Description |
| --- | --- |
| `--force` | Skip the dependency check entirely |
| `--yes` | Skip all interactive prompts (global flag) |
| `--qualifier` | Target a non-default bootstrap stack (default: `hnb659fds`) |
| `--toolkit-stack-name` | Override the default stack name `CDKToolkit` |
| `--profile` | AWS named profile to use |

##### Idempotency

The command is safe to re-run after partial failure. You can run it to pick up where you left off - for example, if the stack is already gone but the bucket still exists, it skips to bucket cleanup.

##### Examples

Remove bootstrap from a specific environment:

```console
$ cdk debootstrap aws://123456789012/us-east-1
```

Interactive mode (discover and pick environments):

```console
$ cdk debootstrap
```

Skip dependency check and all prompts (for CI):

```console
$ cdk debootstrap aws://123456789012/us-east-1 --force --yes
```

Remove a non-default bootstrap stack:

```console
$ cdk debootstrap aws://123456789012/us-east-1 --qualifier myqualifier
```

---

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new CDK CLI command, `cdk debootstrap`, that provides a supported way to
completely remove the CDK bootstrap stack and all its resources from an AWS
environment.

### Why should I use this feature?

`cdk debootstrap` should be used when:

- You are done using CDK in an account/region and want to remove all CDK
  infrastructure
- You need to remove an old bootstrap before re-bootstrapping with a different
  qualifier, trust relationships, or permissions boundary
- You are recycling sandbox/workshop accounts among users and need to return
  them to a clean state
- You need a clean-room environment for integration testing (0-to-100%
  validation)
- You got into a broken bootstrap state (e.g., manually deleted the bucket)
  and need a full reset

## Internal FAQ

### Why are we doing this?

[GitHub Issue #643](https://github.com/aws/aws-cdk-cli/issues/643) has been
open since 2018 and was escalated to P1. Users who attempted manual teardown
ended up with broken states - deleting the bucket without deleting the stack,
or the stack without the bucket and would get locked out of their environment.

### Why should we _not_ do this?

- **Risk of accidental data loss**: Users could destroy bootstrap infrastructure
  that active CDK applications depend on, making those applications
  unmanageable. Unlike `cdk destroy` which is application scoped,
  `cdk debootstrap` affects every CDK deployment in that account/region/qualifier
  combination.

This risk is mitigated by the dependency detection warning and the two
confirmation prompts.

### What is the technical solution (design) of this feature?

**Command:** `cdk debootstrap` is a new top-level CLI command mirroring the
`deploy`/`destroy` pairing.

**Environment selection:** `cdk debootstrap` supports three modes:

- `cdk debootstrap` - discovers bootstrapped environments and presents a picker
  for you to select which one(s) to destroy
- `cdk debootstrap aws://123456789012/us-east-1` - targets that environment
  directly
- `cdk debootstrap aws://123456789012/us-east-1 --force` - skips dependency
  check

**Environment discovery:** When no arguments are provided, the command discovers
bootstrapped environments by:

1. If running in an app directory (there is a `cdk.json`), resolve environments
   from the app's stacks
2. For each environment, check for a CDKToolkit stack via `DescribeStacks` using
   the qualifier's stack name pattern
3. Present the environments that have a bootstrap stack as a multi-select picker

**Dependency detection:** CDK stacks reference bootstrap resources by
deterministic naming convention, so we can detect them by the following steps:

1. Call `DescribeStacks` to list all stacks in the account/region
2. Match each stack's `RoleARN` field against the pattern
   `cdk-${Qualifier}-cfn-exec-role-${Account}-${Region}`
3. Check stack parameters and template body for references to the bootstrap
   bucket - `cdk-${Qualifier}-assets-${Account}-${Region}` and ECR repo -
   `cdk-${Qualifier}-container-assets-${Account}-${Region}`
4. If there is a match that means that stack depends on this bootstrap

This catches all CDK-deployed stacks. Non-CDK stacks that happen to use
bootstrap roles as their execution role would also be caught, since the role
names are CDK-specific and not discoverable without reading the bootstrap
template.

**Termination protection:** If the bootstrap stack has termination protection
enabled, the command aborts with a clear message asking you to disable it
first.

**Deletion sequence:**

1. Discover bootstrap stack via `ToolkitInfo.lookup()`
2. Check for dependent stacks (`DescribeStacks` + role ARN pattern matching +
   bucket/ECR name matching)
3. Check termination protection
4. Prompt for confirmation - includes dependency warning and final confirmation
5. Empty all S3 buckets in the stack by resource type via `GetTemplate`, not
   hardcoded logical IDs
6. Delete all ECR repository images by resource type
7. Delete the CloudFormation stack: CDKToolkit
8. Delete the orphaned S3 bucket(s) as retained due to
   `DeletionPolicy: Retain`

**S3 versioned bucket emptying (step 5):** The staging bucket has versioning
enabled. Running `deleteObjects` on current versions is insufficient because
every version of every object and all delete markers must be deleted. This
implementation calls `listObjectVersions` to enumerate all version IDs, and
then `deleteObjects` with explicit version IDs in batches of 1000 with 50
parallel workers. The existing `GarbageCollector.readBucketInBatches()` already
handles this pattern.

**Idempotency:** Each step checks current state. If the stack is gone but an
orphaned bucket still exists, re-running skips to bucket cleanup. We check to
see if the orphaned bucket exists by running `HeadBucket` using the
deterministic name.

**Prompts:** The command issues up to two sequential prompts before any
destructive action:

- **Prompt 1 - Dependency warning** : If dependent stacks are detected, it
  lists the affected stacks and asks "Do you want to continue?"
- **Prompt 2 - Final confirmation**: Shows what will be deleted, asks "Are you
  sure?"

**Flags:**

- `--force` skips the dependency check entirely
- `--yes` auto-answers all interactive prompts
- `--qualifier` targets non-default bootstrap stacks

**Reusable code:** The implementation reuses existing toolkit-lib primitives:

- `ToolkitInfo.lookup()` for stack discovery
- `GarbageCollector.parallelDeleteS3()` and `readBucketInBatches()` for S3
  emptying
- `destroyStack()` for CloudFormation stack deletion
- The `cdk destroy` confirmation pattern for user prompting

### Is this a breaking change?

No. This is a new command that does not affect existing behavior. The existing
`cdk bootstrap` behavior is unchanged.

### What alternative solutions did you consider?

**`cdk bootstrap --destroy`:** Adds a flag to the existing command. This flag
wouldn't just modify a command's behavior, but invert it. Also,
`cdk bootstrap --destroy --force` is three flags deep and is awkward from a UX
perspective.

### What are the drawbacks of this solution?

- **Cross-account visibility:** If Account B deploys into Account A using A's
  bootstrap roles through the `--trust` flag, then deleting A's bootstrap means
  B would not be able to deploy into A anymore. We can detect that
  `TrustedAccounts` is configured and warn, but cannot proactively notify
  Account B.
- **Custom bootstrap templates:** Whoever bootstrapped with a custom template
  may have additional resources with `DeletionPolicy: Retain` that we can't
  clean up. We identify these via `GetTemplate` and warn them.
- **Race conditions:** If someone runs `cdk deploy` concurrently with
  `cdk debootstrap`, the deployment will fail. This requires operational
  coordination.

### What is the high-level project plan?

1. **Implementation in toolkit-lib:** Add `bootstrapDestroy()` method to the
   Toolkit class, implementing the deletion sequence with dependency detection
   and idempotency.
2. **CLI wiring:** Add `cdk debootstrap` command definition, argument parsing,
   and routing to toolkit-lib.
3. **Testing:** Unit tests for each step, integration tests for the full
   sequence (happy path, partial failure re-run, dependent stacks warning).
4. **Documentation:** Add `cdk debootstrap` to CLI reference docs, update
   bootstrap documentation to reference the teardown path.

### Are there any open issues that need to be addressed later?

- **Cross-account notification:** A mechanism to warn trusted accounts when a
  bootstrap stack they depend on is about to be destroyed.
- **Interactive picker without `cdk.json`:** The interactive picker resolves
  environments from the app's stacks (same as `cdk bootstrap`). Without a
  `cdk.json`, the command requires explicit environment arguments. Whether to
  support environment discovery outside of an app context - by scanning
  configured regions for example - is a future consideration.

## Appendix

### Known Limitations

| Limitation | Detail |
| --- | --- |
| Cross-account bootstrap | If Account B deploys into Account A using A's bootstrap roles, destroying A's bootstrap breaks B's ability to deploy into A. A warning is printed if `TrustedAccounts` is configured. |
| Custom bootstrap templates | Resources are enumerated by type (`AWS::S3::Bucket`, `AWS::ECR::Repository`) via `GetTemplate`. Resources with `DeletionPolicy: Retain` are identified and a warning is printed that they will be orphaned. |
| S3 Object Lock | If the bucket has Object Lock enabled, deletion will fail. You must remove Object Lock manually before retrying. |
| KMS key deletion delay | AWS enforces a 7–30 day waiting period. The key is scheduled for deletion but remains pending. |
| Large buckets | Emptying millions of objects may take 10–30 minutes. Recovery from mid-step failure is via idempotent re-run. |
| Race conditions | Concurrent `cdk deploy` will fail as resources are removed. Operational coordination required. |
