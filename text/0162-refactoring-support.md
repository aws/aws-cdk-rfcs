# CDK Refactoring Support

- **Original Author(s):**: @otaviomacedo
- **Tracking Issue**: #162
- **API Bar Raiser**: @rix0rrr

An improvement to the CDK CLI and toolkit library, to support developers in
refactoring their CDK applications. Renaming constructs or moving them across
stacks does not require resource replacement anymore. The CLI will detect these
cases and help you refactor the stack before the actual deployment.

## Working Backwards

AWS CloudFormation identifies resources by their logical IDs. As a consequence,
if you change the logical ID of a resource after it has been deployed,
CloudFormation will create a new resource, with the new logical ID, and possibly
delete the old one. For stateful resources, this may cause interruption of
service or data loss, or both.

Since the CDK generates logical IDs from construct IDs, our current advice to
developers is to avoid changing construct IDs, to prevent this problem. But this
is sometimes impractical, or conflicts with good software engineering practices.
For instance, you may want to consolidate duplicated code from different CDK
applications into a single reusable construct (an "L3 construct"). But, by
introducing a new node for the L3 construct in the construct tree, all L1
resources underneath that L3 will have their logical IDs changed.

Also, you might need to move resources within the tree for better readability,
or between stacks to isolate concerns. Accidental renames have also caused
issues for customers in the past. Perhaps even worse, if you depend on a
third-party construct library, you are not in control of the logical IDs of
those resources. If the library changes the logical IDs from one version to
another, you will be affected without any action on your part.

To address all these problems, the CDK CLI now automatically detects these
cases, and, with your supervision, uses the new CloudFormation stack refactoring
API to move the resources around.

### How it works

Suppose your CDK application has a single stack, called `MyStack`, containing an
S3 bucket, a CloudFront distribution and a Lambda function. The construct tree
looks like this (L1 constructs omitted for brevity):

```
App
└─ MyStack
   ├─ Bucket
   ├─ Distribution
   └─ Function
```

And suppose you make the following changes, after having deployed it to your AWS
account:

- Rename the bucket from `Bucket` to the more descriptive name `Origin`.
- Move the bucket and the distribution under a new L3 construct called
  `Website`, to make this pattern reusable in different applications.
- Move the web-related constructs (now under the `Website` L3) to a new stack
  called `Web`, for better separation of concerns.
- Rename the original stack to `Service`, to better reflect its new specific
  role in the application.

The refactored construct tree looks like this:

```
App
├─ Web
│  └─ Website
│     ├─ Origin
│     └─ Distribution
└─ Service
   └─ Function
```

Even though none of the resources has changed, their paths have (from
`MyStack/Bucket` to `Web/Website/Origin` etc.) Since the CDK computes the
logical IDs of the resources from their path in the tree, all three resources
will have their logical IDs changed.

From your perspective, the changes above are mere moves and renames, but what
CloudFormation sees is the deletion of old resources and the creation of new
ones. By opting in to the CDK refactoring support, the CDK CLI will work on your
behalf to notify CloudFormation of your intention.

To execute a refactor, run `cdk refactor --unstable=refactor`. The CLI will show
you the changes it is going to make, and ask for your confirmation:

```
The following resources were moved or renamed:

┌───────────────────────────────┬───────────────────────────────┬───────────────────────────────────┐
│ Resource Type                 │ Old Construct Path            │ New Construct Path                │
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────────┤
│ AWS::S3::Bucket               │ MyStack/Bucket/Resource       │ Web/Website/Origin/Resource       │
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────────┤
│ AWS::CloudFront::Distribution │ MyStack/Distribution/Resource │ Web/Website/Distribution/Resource │
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────────┤
│ AWS::Lambda::Function         │ MyStack/Function/Resource     │ Service/Function/Resource         │
└───────────────────────────────┴───────────────────────────────┴───────────────────────────────────┘

Do you wish refactor these resources (y/n)?
```

If you answer yes, the CLI will show the progress as the refactor is executed:

```
Refactoring...
Creating stack refactor...

 0/3 | 2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::S3::Bucket               | MyStack/Bucket/Resource       | Web/Website/Origin/Resource           
 0/3 | 2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::CloudFront::Distribution | MyStack/Distribution/Resource | Web/Website/Distribution/Resource     
 1/3 | 2:03:18 PM | REFACTOR_COMPLETE    | AWS::S3::Bucket               | MyStack/Bucket/Resource       | Web/Website/Origin/Resource           
 1/3 | 2:03:18 PM | REFACTOR_IN_PROGRESS | AWS::Lambda::Function         | MyStack/Function/Resource     | Service/Function/Resource     
 2/3 | 2:03:19 PM | REFACTOR_COMPLETE    | AWS::CloudFront::Distribution | MyStack/Distribution/Resource | Web/Website/Distribution/Resource 
 3/3 | 2:03:20 PM | REFACTOR_COMPLETE    | AWS::Lambda::Function         | MyStack/Function/Resource     | Service/Function/Resource     

✅  Stack refactor complete
```

The same mapping shown in the table above will also be printed as part of the
output of the `diff` command:

```
Resources
[≡] AWS::SQS::Queue MyStack/Bucket/Resource -> Web/Website/Origin/Resource
[≡] AWS::CloudFront::Distribution MyStack/Distribution/Resource -> Web/Website/Distribution/Resource
[≡] AWS::Lambda::Function MyStack/Function/Resource -> Service/Function/Resource
```

You can also refactor the resources as part of a deployment, by running `cdk
deploy --refactoring-action=refactor --unstable=refactor`. You will be shown the
same table as above, but a different set of options to choose from:

```
? What do you want to do? (Use arrow keys)  
❯ Execute the refactor and deploy  
  Deploy without refactoring (will cause resource replacement)  
  Quit
```

A few things to note about this feature:

- If you pass any filters to the `deploy` command, the refactor will work on
  those stacks plus any other stacks the refactor touches. For example, if you
  choose to only deploy stack A, and a resource was moved from stack A to stack
  B, the refactor will involve both stacks. But if there was a rename in, let's
  say, stack C, it will not be refactored. The same set of filters is available
  for the `refactor` command.
- To perform refactoring, the CLI needs new permissions in the bootstrap stack.
  Before using this feature, run `cdk bootstrap` for every target environment,
  to add these new permissions.
- A given CDK application can have multiple stacks, for different environments.
  In that case, the CLI will group the stacks by environment and perform the
  refactoring separately in each one. So, although you can move resources
  between stacks, both stacks involved in the move must be in the same
  environment. Trying to move resources across environments will result in an
  error.

### Explicit mapping

#### Refactor file

The previous section describes the case in which the CLI automatically computes
the mappings, by comparing the current and proposed states. But if you don't
want this automatic detection to happen, you can provide your own mapping, via a
_refactor file_.

The refactor file contains a map of current locations to new locations. When
provided, this file serves as an allow-list: instead of computing the mapping,
it will try to perform all the refactors in the list, and nothing else. The keys
refer to existing locations; their corresponding values refer to the new
locations they should be moved to. Both keys and values should follow the
pattern `"<stack name>.<logical ID>"`:

```json
{
  "StackA.OldName": "StackB.NewName",
  "StackC.Foo": "StackC.Bar"
}
```

You can pass this mapping to the CLI via the `--refactor-mapping` option to both
`deploy` and `refactor` commands.

This is a regular JSON file, that you can write yourself. But to make it
convenient for you, every time the CLI computes a mapping, it will automatically
generate a refactor file at the root of your CDK application, with a timestamp
in the name. Example: `.refactor-2025-04-03_12-05-49.json`. You can use these
files as a starting point to edit the mapping, combine multiple mappings into
one, split mappings into multiple files, etc.

#### Skip file

You can also do the opposite: pass a _skip file_, that represents a deny-list.
If provided, this will tell the CLI to exclude those locations from the mapping
it computed:

```
["StackA.Foo", "StackB.Bar"]
```

This is useful when there are resources that you intentionally want to be
replaced, despite the CLI detecting it as part of a refactor.

If both are provided, the refactor file takes precedence.

### Settings

There are a few settings you can use to control the behavior of the refactoring
feature.

For both `deploy` and `refactor`:

- `--refactor-mapping=<FILE>`: use the mapping from a file, instead of computing
  it.
- `--skip-refactoring=<FILE>`: removes the elements listed in the file from the
  computed mapping.
- `--unstable=refactor`: used to acknowledge that this feature is experimental.
  If the flag is not set, and the CLI would try to perform some refactor, the
  command fails with an error message explaining why.

For `deploy` only:

- `--refactoring-action=[ACTION]`: the action to take in case there is a
  refactor to be made (either computed automatically or provided via a mapping
  file). Possible values for `ACTION` are:
  - `refactor`: automatically refactor and deploy.
  - `skip`: deploy without refactoring. Default value on non-interactive mode.
  - `fail`: exit with non-zero status code.
  - `ask`: ask the user what to do. Default value on interactive mode.

For `refactor` only:

- `--dry-run`: print the mapping to the console, but do not apply it.
- `--force`: go ahead with refactoring, without prompting the user.

All these settings are also available in the `cdk.json` file:

```json
{
  "app": "...",
  "refactor": {
    "refactoringAction": "refactor",
    "dryRun": true
  }
}
```

### Rollback

During the execution of a `deploy` command, the CLI will do the refactor and
then proceed to the actual deployment (assuming the right set of flags). If the
deployment fails, and CloudFormation rolls it back, the CLI will execute a
second refactor, in reverse, to bring the resources back to their original
locations.

If you don't want the CLI to perform the rollback refactor, you can use the
`--no-rollback` flag, which also controls the rollback behavior of the
deployment.

### Programmatic access

The same refactoring feature is also available in the CDK toolkit library:

```typescript
declare const toolkit: Toolkit;
declare const cx: ICloudAssemblySource;

// To execute possible refactors as part of the deploy operation:
await toolkit.deploy(cx, {
  refactoring: RefactoringMode.EXECUTE_AND_DEPLOY
});

// Or, if you just want to refactor the stacks:
await toolkit.refactor(cx);
```

### Skipping classes of constructs

In the CDK construct library there are some constructs that rely on
CloudFormation's behavior to force the replacement of resources. API Gateway's
`Deployment` and Lambda's `Version` are two examples of this strategy. By
default, the CLI will detect these changes as refactors and not replacements. We
have already seen a mechanism to override this: skip files. But it would be too
inconvenient to have to maintain skip files and remembering to update it every
time the logical ID changes.

To solve this, CDK constructs can be automatically excluded by calling the new
method `Stack.skipRefactoring(constructToBeSkipped)`. By calling this method,
you are signalling to the CLI, via the cloud assembly, that the corresponding
CloudFormation resource should (logically) be added to the skip file. Normally,
this method will be called from the constructor of the class itself:
`Stack.skipRefactoring(this)`.

### Limitations and failure modes

#### Pipelines with version superseding

As we have seen, it is possible to automatically apply a refactor in a
non-interactive environment, such as a CI/CD pipeline. And, in particular, you
can specify the mapping explicitly, via a mapping file, version-controlled along
with the rest of your CDK application.

However, this set-up only works if all versions are deployed. In a CI/CD
pipeline, versions may be skipped for various reasons. In such cases, the
mapping files may become outdated, assuming a source state that is no longer
accurate. Here are some examples:

**Scenario 1**: Some version of your CDK application creates a resource with a
certain logical ID, that a later refactor references. But that version was
skipped, and consequently the resource was never deployed. The refactor, then,
references something that doesn't exist, which results in a CLI error, blocking
the pipeline:

```
Action:   [Create "A"]  [Rename "A" to "B"]
               │             │      
Time:      ────┼─────────────┼────────────>
               │             │      
Deployed?      No            Yes
                      ("A" doesn't exist)
```

**Scenario 2**: Due to skipped deployments, the refactor may end up referring to
logical IDs that refer to different resources than intended. Suppose that, at
some point, you had a resource called "A". In subsequent versions, "A" was
deleted, and then replaced with a different resource that happened to also be
named "A". If a mapping file references "A", the intention would be the most
recent resource. But the resource that is found is the old one. In this case,
the refactor will happen, but with a different result than intended:

```
Action:   [Create "A"]  [Delete "A"]  [Create diff. "A"]  [Rename "A" to "B"]
               │             │          │                     │
Time:      ────┼─────────────┼──────────┼─────────────────────┼─────────────>
               │             │          │                     │
Deployed?     Yes            No         No                   Yes
                                                 (Applies to wrong resource)
```

Keeping refactor files both in sync with the state of the CDK app, and also
consistent with the states where it will be applied is a difficult problem. We
recommend that you use refactor files sparingly, only in cases that automatic
refactoring doesn't cover, such as ambiguity (see next section).

#### Ambiguity

You may find yourself in the very unlikely situation in which two or more
resources have the same type and properties, and they are moved or renamed at
the same time. Since there are at least two valid ways to map the old IDs to the
new ones, the CLI can't guarantee that it will make the right choice, according
to your intention.

For instance, you may have two S3 buckets with identical sets of properties, and
logical IDs `FinancialData` and `CustomerData`. You want to rename them to
`FinancialReports` and `CustomerInfo`, respectively. But the CLI could end up
doing the opposite, so that, after the refactor, the bucket that contains
financial reports would have the logical ID `CustomerData`, and vice versa.

Even though all the resources involved in this scenario would remain unchanged,
we have decided to err on the side of caution and not perform the refactor. If,
as the result of computing a refactor, the CLI detects such a case of ambiguity,
it will fail with an error message explaining the situation.

If you still want to perform a refactor, you have to explicitly provide the
mapping. There are two ways to do this: you can either create a refactor file
from scratch, or you can pass another command line option to only override the
ambiguous part of the mapping.

For example, if the CLI detects that there are two resources in `StackA`, `X`
and `Y`, that are identical, and both were renamed to `Y` and `Z`, you can tell
it exactly which mapping you want:

```
cdk refactor --map StackA.X:StackA.Z --map StackA.Y:StackA.W
```

The CLI will then apply this mapping, along with all other non-ambiguous
mappings, it has computed.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to
the RFC pull request):

```

[x] Signed-off by API Bar Raiser @rix0rrr

```

## Public FAQ

### What are we launching today?

A new developer experience for CDK users, that allows them to change the
location of a construct (stack and/or logical ID) without causing resource
replacement. This new experience is available in the CDK CLI `deploy`
and `refactor` commands, as well as in the toolkit library.

### Why should I use this feature?

If you ever find yourself doing one of the following, you will benefit from
stack refactoring support:

- Renaming constructs, either intentionally or by mistake.
- Moving constructs within the construct tree. This could be just for better
  organization, or to create reusable components.
- Moving constructs between different stacks.
- Renaming stacks.
- Upgrading dependencies on construct libraries.

### What if I incorrectly refactor a stack?

The CLI offers mechanisms to prevent accidental refactoring, such as dry runs,
interactive mode, and refactor and skip files. Nevertheless, mistakes can
happen. The first thing to be aware of is that refactors don't affect the
resources themselves. Thus, an incorrect refactor will not cause any immediate
problems other than logical IDs that don't match the intent of the resources
they refer to. (Although, in the long run, this confusion may lead to other
mistakes).

The second thing is that refactors can be always be reverted. As mentioned
before, the CLI generates a timestamped refactor file every time it executes a
refactor. If you want to undo a refactor done by mistake, use the option
`--revert`:

```shell
cdk refactor --revert=file.json --unstable=refactor
```

## Internal FAQ

### Why are we doing this?

This feature was initially requested in May 2020. It is one of the top 5 most
up-voted RFCs, with 97 thumbs-up. Despite being almost 5 years old, it has
continued to be highly discussed and debated by CDK customers and the community.
The solution we currently provide, the `renameLogicalId` method, is perceived by
customers as a workaround, adding unnecessary cognitive load for developers.
Code refactoring is a fundamental job-to-be-done that developers expect to be
supported natively by the tool.

In addition to this, the recent launch of CloudFormation's stack refactoring API
made it possible to support refactoring on the service side. We are building on
top of that API to bring a seamless experience to CDK users.

### Why should we _not_ do this?

The main attraction of this feature is the automatic computation of mappings, by
comparing the deployed state with the synthesized state. If approved, this
mapping is then applied to the CloudFormation stack. This may cause anxiety for
some users, who might not understand what exactly is happening, and what the
consequences are. We can mitigate this risk with good documentation and careful
interaction design.

### What is the technical solution (design) of this feature?

There are a few aspects of the solution that deserve attention:

- The core concept underlying this feature is the notion of equivalence between
  resources. This is explained in Appendix A.
- The computation of a mapping, given the difference between what is deployed
  and what has just been synthesized. The location of a resource is defined as
  the combination of its logical ID and the stack where it is declared. The
  algorithm for this is described in Appendix B.
- How the CLI handles the various settings available to the user. This is
  treated in Appendix C.
- Cross-stack references. This is an especially complex case, in which resources
  that are being referenced from outside its stack, and they are moved to
  another stack. This involves more than just one API call. Appendix D describes
  the steps to accomplish the goal.

### Is this a breaking change?

No. By default, on non-interactive mode, the CLI will skip refactoring on
deployment. The user must explicitly enable it by passing a value other than
`skip` to the `--refactoring-action` (or `refactoringAction` in `cdk.json`)
option. Also, this feature will initially be launched in experimental mode, and
users must acknowledge this by passing the `--unstable=refactor` flag.

### What alternative solutions did you consider?

The most straightforward alternative is to implement a simple wrapper around the
CloudFormation API, and have the user provide all the parameters: which
resources to move from which stack to which stack. But the CDK CLI can provide a
better experience by automatically detecting these cases, and interacting with
the user when necessary.

A possible variation of the solution presented in this RFC is to do something
similar to resource lookup: for every environment where the application could be
deployed to, the CLI would have configured in a file what refactors have to be
done. The entries to this file could be automatically generated by some CLI
command, run individually in each environment. But this solution requires a lot
more work and coordination among the parties involved (developers,
administrators, security engineers, etc.), and is more error-prone: failure to
record a refactor in the file could lead to inconsistencies between the
environments, and even unintended resource replacements.

Customers have also suggested aliases, using [Pulumi's model][pulumi-aliases] as
inspiration. This feature would be similar to the `renameLogicalId` function,
but operating on a higher level of abstraction, by taking into account the
construct tree and construct IDs. Despite the abstraction awareness, however, it
would suffer from the same perceived crudeness of `renameLogicalId`. In any
event, we are open to implementing this as an additional feature if enough
customers indicate their preference for it.

### What are the drawbacks of this solution?

See the open issues section below.

### What is the high-level project plan?

#### Phase 1 (dry-run)

In this phase we are going to implement the detection of resource moves, and
show the user what changes are going to be made. The only new command available
at this phase is `cdk refactor --dry-run`. Execution of this command without the
`--dry-run` flag will result in an error.

High-level tasks:

- Implement resource equivalence without physical ID.
- Implement the computation of mappings.
- Implement the display of the mappings to the user.
- Implement refactor file support.
- Implement skip file support.
- Add refactors to the diff command.
- Add physical ID to resource equivalence.
- Update the documentation.

#### Phase 2 (application)

Once the detection of all cases is implemented in phase 1, we are ready to
implement the application of the changes.

High-level tasks:

- Add new permissions to the bootstrap stack.
- Implement the actual refactoring.
- Implement rollback.
- Implement the progress bar to display the refactoring progress.
- Handle cross-stack references.
- Add the refactor step to the `deploy` command.
- Write a blog post.
- Update the documentation.

#### Phase 3 (similarity)

This is a research phase. We are going to investigate the possibility of
matching resources that are not identical property-wise, but are similar enough
that they may indicate a move. See Appendix E for more details.

### Are there any open issues that need to be addressed later?

This improved deployment experience actually consists of two separate steps,
behind the scenes: refactoring followed by deployment. And the whole workflow is
controlled by the CLI. As a result, this is not an atomic operation: it is
possible that the refactoring step succeeds, but before the CLI has a chance to
deploy the changes, it gets interrupted (computer crash, network failures, etc.)
In this case, the user will be left with a stack that is neither in the original
nor in the desired state.

In particular, the logical ID won't match the CDK construct path, stored in the
resource's metadata. This has consequences for the CloudFormation console, which
will show a Tree view that is not consistent with the Flat view.

Possible solutions to consider, from more specific to more general:

- CloudFormation to ignore changes in the `Metadata[aws:cdk:path]` resource
  attribute in refactor operations.
- CloudFormation to allow resource additions and deletions in refactor
  operations.
- Two-phase commit. The CLI could create the refactor and the changeset, and
  then have a new command to execute both in a single atomic operation (let's
  say, a `executeChangeSetAndRefactor()`).

Since all these options depend on changes on the CloudFormation side, and this
edge case is unlikely to happen, we are going to address it later.

## Appendix

### A. Equivalence between resources

To detect which resources should be refactored, we need to indentify which
resources have only changed their location, but have remained "the same", in
some sense. This can be made precise by defining an [equivalence relation] on
the set of resources.

Before that, let's define a digest function, `d`:

```
d(resource) = hash(type + physicalId)                       , if physicalId is defined
            = hash(type + properties + dependencies.map(d)) , otherwise
```

where `hash` is a cryptographic hash function. In other words, if a resource has
a physical ID, we can use the physical ID plus its type to uniquely identify
that resource. In this case, the digest can be computed from these two fields
alone. A corollary is that such resources can be renamed and have their
properties updated at the same time, and still be considered equivalent.

Otherwise, the digest is computed from its type, its own properties (that is,
excluding properties that refer to other resources), and the digests of each of
its dependencies.

The digest of a resource, defined recursively this way, remains stable even if
one or more of its dependencies gets renamed. Since the resources in a
CloudFormation template form a directed acyclic graph, this function is
well-defined.

The equivalence relation then follows directly: two resources `r1` and `r2`
are equivalent if `d(r1) = d(r2)`.

### B. Matching algorithm

High level description:

First, list all the stacks: both local and deployed. Then build an index of all
resources from all stacks. This index maps the _content_ address (physical ID or
digest) of each resource to all the _location_ addresses (stack name + logical
ID) they can be found in. The content address is computed using the digest
function described in the previous section.

Resources that have different locations before and after, are considered to have
been moved. For each of those, create a mapping from the source (the currently
deployed location) to the destination (the new location, in the local template).
Example:

```
// Keys are the content address of the resources
// Values are the location addresses
{ 
  "5e19886121239b7a": { // Moved and renamed -> goes to mapping
    "before": ["stack1/logicalId1"],
    "after": "["stack2/logicalId2"]
  },    
  "24ad8195002086b6": { // Removed -> ignored 
    "before": ["stack1/logicalId3"]
  },
  "07266c4dd0146e8a": { // Unchanged -> ignored 
    "before": ["stack1/logicalId4"]
    "after": ["stack1/logicalId4"]
  }
}
```

Since the CloudFormation API expects not only the mappings, but also the
templates in their final states, we need to compute those as well. This is done
by applying all the mappings locally, essentially emulating what CloudFormation
will eventually do. For example, if a mapping says that a resource has moved
from stack `A` with name `Foo`, to stack `B` with name `Bar`, we will remove
`Foo` from the template for stack `A`, and add a new resource called `Bar` to
the template for stack `B`.

We are now ready to call the API to actually perform the refactor, using the
mappings and templates computed previously.

### C. Handling of settings

#### Command: `refactor` (non-interactive case)

```mermaid
flowchart LR
    mapping{Refactor file present?}
    empty{Empty mapping?}
    dryrun{--dry-run?}
    compute[Compute mapping]
    use[Use mapping]
    print[Print mapping]
    mapping ---|No| compute
    mapping ---|Yes| use
    compute --- empty
    use --- empty
    empty ---|Yes| Exit
    empty ---|No| print
    print --- dryrun
    dryrun ---|Yes| Exit
    dryrun ---|No| Refactor
    Refactor --- Exit
```

#### Command: `refactor` (interactive case)

```mermaid
flowchart LR
    mapping{Refactor file present?}
    empty{Empty mapping?}
    dryrun{--dry-run?}
    force{--force?}
    compute[Compute mapping]
    use[Use mapping]
    print[Print mapping]
    ask[Ask user]
    mapping ---|No| compute
    mapping ---|Yes| use
    compute --- empty
    use --- empty
    empty ---|Yes| Exit
    empty ---|No| print
    print --- dryrun
    dryrun ---|Yes| Exit
    dryrun ---|No| force
    force ---|Yes| Refactor
    force ---|No| ask
    ask ---|Yes| Refactor
    ask ---|No| Exit
    Refactor --- Exit
```

#### Command: `deploy` (non-interactive case)

```mermaid
flowchart LR
    skip{--action == SKIP or null}
    action{--action}
    mapping{Refactor file present?}
    empty{Empty mapping?}
    compute[Compute mapping]
    use[Use mapping]
    print[Print mapping]
    skip ---|Yes| Deploy
    skip ---|No| mapping
    mapping ---|No| compute
    mapping ---|Yes| use
    compute --- empty
    use --- empty
    empty ---|Yes| Deploy
    empty ---|No| print
    print --- action
    action ---|REFACTOR| Refactor
    action ---|FAIL or ASK| Fail
    Refactor --- Deploy
```

#### Command: `deploy` (interactive case)

```mermaid
flowchart LR
    skip{--action == SKIP}
    action{--action}
    mapping{Refactor file present?}
    empty{Empty mapping?}
    compute[Compute mapping]
    use[Use mapping]
    ask[Ask user]
    print[Print mapping]
    skip ---|Yes| Deploy
    skip ---|No| mapping
    mapping ---|No| compute
    mapping ---|Yes| use
    compute --- empty
    use --- empty
    empty ---|Yes| Deploy
    empty ---|No| print
    print --- action
    action ---|REFACTOR| Refactor
    action ---|FAIL| Fail
    action ---|ASK or null| ask
    ask ---|REFACTOR| Refactor
    ask ---|QUIT| Fail
    ask ---|SKIP| Deploy
    Refactor --- Deploy
```

### D. Cross-stack references

Consider the case where there are three stacks: `Consumer`, `Producer1` and
`Producer2`. There is a bucket in `Producer1` that is referenced by a function
in `Consumer`. And you move the bucket to the stack `Producer2`:

```
         ┌───────────────────┐          ┌───────────────────┐              
         │ Consumer          │          │ Producer1         │             
         │                   │          │                   │              
         │      ┌─────────┐  │  before  │ ┌────────┐        │              
         │      │function │─ ─ ─ ─ ─ ─ ─ >│ bucket │        │
         │      └─────────┘  │          │ └────────┘        │              
         └───────────│───────┘          └───────────────────┘              
                     │                  ┌───────────────────┐              
                     │                  │ Producer2         │              
                     │                  │                   │              
                     │                  │ ┌────────┐        │              
                     └───────────────────>│ bucket │        │              
                                after   │ └────────┘        │              
                                        └───────────────────┘
```

In the CloudFormation templates, this is represented by an exported output in
`Producer1`, which is referenced by an `Fn::ImportValue` in `Consumer`. What
ultimately needs to happen is that the exported output in `Producer1` must be
removed, and a new one must be added in `Producer2`. The `Fn::ImportValue` in
`Consumer` must be updated to point to the new output.

This is instance of the deadly embrace problem: we can't do this in a single
step because it would create a dangling reference (and therefore CloudFormation
would reject it). The solution is also similar to what we suggest for solving
the deadly embrace, but is done automatically here:

1. Update the value of the output in `Producer1` to the hard-coded physical ID
   of the bucket.
2. Call the refactor API to move the bucket from `Producer1` to `Producer2`,
   preserving the old output in `Producer1` while creating a new output in
   `Producer2`, that references the bucket.
3. Update the `Fn::ImportValue` in `Consumer` to point to the new output in
   `Producer2`.
4. Remove the output in `Producer1`.

### E. Similarity between resources

There are cases in which developers may wish to move a resource, and, at the
same time, modify some of its properties. Indeed, this may not even be a choice.
Some CDK constructs (`ec2.Vpc` and `ec2.VpcV2` to name a couple), add tags to
the underlying resource that are based on the construct path. Intuitively,
developers would expect that small changes like this would be taken into account
by the matching algorithm.

The current proposal, however, does not solve this problem, because it uses a
digest function to compare resources. As such, given two resources, they are
considered either equivalent or not, with no middle ground.

So we need a more flexible way of comparing resources. Instead of requiring them
to be exactly the same, we need to know whether two resources are "similar
enough". To achieve this, we need a few things:

- **A distance function**. To generalize the notion of strict equality to a more
  flexible notion of similarity, we need to come up with a distance function,
  that is, a function that takes two resources as input, and produces a number
  as output. The higher the number, the more different the resources are.
- **A threshold for the distance**. This is a cut-off value that we can use to
  decide whether two resources are similar enough to be candidates for
  refactoring. It will depend on the distance function we choose and also on
  experimentation.
- **Graph isomorphism**. Since we will not have a digest anymore to quickly find
  pairs of equivalent nodes between two resource graphs, we have to use the
  graph structure itself to find possible pairs (which the digest function also
  incorporates implicitly). Slightly more formally, we need to find
  an [isomorphism] between two (sub-)graphs: a one-to-one function that maps
  nodes in one graph to nodes in the other, such that the overall structure is
  preserved. Only pairs of nodes that are part of the isomorphism will have
  their distances calculated.
- **Improved UX**. Since we are now working with similarities, there is more
  room for incorrect matches. We need to provide a way for the user to choose
  among the potential matches, possibly in multiple passes, until the final
  mapping is produced.

All this takes a bit of research and prototyping. Since this would be a
generalization of the current proposal, rather than a completely different
solution, we don't need to implement it straight away. So we will leave it to
phase 3 to do this research, and possibly implement it.

[pulumi-aliases]: https://www.pulumi.com/docs/iac/concepts/options/aliases/

[equivalence relation]: https://en.wikipedia.org/wiki/Equivalence_relation

[isomorphism]: https://en.wikipedia.org/wiki/Graph_isomorphism
