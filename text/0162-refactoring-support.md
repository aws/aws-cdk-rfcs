# CDK Refactoring Support

- **Original Author(s):**: @otaviomacedo
- **Tracking Issue**: #162
- **API Bar Raiser**: @rix0rrr

An improvement to the CDK CLI and toolkit library, to protect against
replacement of resources when they change location. The Toolkit now detects this
case, and automatically refactors the stack before the actual deployment.

## Working Backwards

AWS CloudFormation identifies resources by their logical ID. As a consequence,
if you change the logical ID of a resource after it has been deployed,
CloudFormation will create a new resource with the new logical ID and possibly
delete the old one. For stateful resources, this may cause interruption of
service or data loss, or both.

Historically, we have advised developers to avoid changing logical IDs. However,
this is sometimes impractical or conflicts with good software engineering
practices. For instance, you may want to consolidate duplicated code across
different CDK applications into a single reusable construct (often called an L3
construct). Introducing a new node for the L3 construct in the construct tree
will rename the logical IDs of the resources in that subtree.

Also, you might need to move resources within the tree for better readability or
between stacks to isolate concerns. Accidental renames have also caused issues
for customers in the past. Perhaps even worse, if you depend on a third-party
construct library, you are not in control of the logical IDs of those resources.
If the library changes the logical IDs from one version to another, you will be
affected without any action on your part.

To address all these problems, the CDK CLI now automatically detects these
cases, and refactors the stack on your behalf, using the new CloudFormation
stack refactoring API. This brings more flexibility for developers, and reduces
the risk of accidental changes that lead to resource renaming.

### How it works

When you run `cdk deploy`, the CLI will compare the templates in the cloud
assembly with the templates in the deployed stack. If it detects that a resource
has been moved or renamed, it will automatically perform the refactoring, and
then proceed with the deployment.

For example, suppose your CDK application has a single stack, called `MyStack`,
containing an S3 bucket, a CloudFront distribution and a Lambda function. The
construct tree looks like this (L1 constructs omitted for brevity):

    App
    └─ MyStack
       ├─ Bucket
       ├─ Distribution
       └─ Function

Now suppose you make the following changes, after having deployed it to your AWS
account:

- Rename the bucket from `Bucket` to the more descriptive name `Origin`.
- Create a new L3 construct called `Website` that groups the bucket and the
  distribution, to make this pattern reusable in different applications.
- Move the web-related constructs (now under the `Website` L3) to a new stack
  called `Web`, for better separation of concerns.
- Rename the original stack to `Service`, to better reflect its new specific
  role in the application.

The refactored construct tree looks like this:

    App
    ├─ Web
    │  └─ Website
    │     ├─ Origin
    │     └─ Distribution
    └─ Service
       └─ Function

Even though none of the resources have changed, their paths have
(from `MyStack/Bucket/Resource` to `Web/Website/Origin/Resource` etc.) Since the
CDK computes the logical IDs of the resources from their path in the tree, all
three resources will have their logical IDs changed. Without refactoring
support, all three resources would be replaced.

With refactoring support, if you run `cdk deploy` after making these changes, by
default the CLI will detect these changes and present you with a selection
prompt:

    The following resources were moved or renamed:

    ┌───────────────────────────────┬───────────────────────────────┬──────────────────────────┐
    │ Resource Type                 │ Old Logical ID                │ New Logical ID           │
    ├───────────────────────────────┼───────────────────────────────┼──────────────────────────┤
    │ AWS::S3::Bucket               │ MyStack.Bucket5766466B        │ Web.Bucket843D52FF       │
    ├───────────────────────────────┼───────────────────────────────┼──────────────────────────┤
    │ AWS::CloudFront::Distribution │ MyStack.DistributionE3BB089E  │ Web.Distribution7142E1F1 │
    ├───────────────────────────────┼───────────────────────────────┼──────────────────────────┤
    │ AWS::Lambda::Function         │ MyStack.FunctionA5EA2BD8      │ Service.Function8F0BB69B │
    └───────────────────────────────┴───────────────────────────────┴──────────────────────────┘

    ? What do you want to do? (Use arrow keys)
    ❯ Execute the refactor and deploy
      Deploy without refactoring (will cause resource replacement)
      Quit

If you choose to refactor and deploy, the CLI will show the progress as the
refactor is executed:

    Refactoring...
    Creating stack refactor...

     0/3 | 2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::S3::Bucket               | MyStack.Bucket5766466B       | Web.Bucket843D52FF           
     0/3 | 2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::CloudFront::Distribution | MyStack.DistributionE3BB089E | Web.Distribution7142E1F1     
     1/3 | 2:03:18 PM | REFACTOR_COMPLETE    | AWS::S3::Bucket               | MyStack.Bucket5766466B       | Web.Bucket843D52FF           
     1/3 | 2:03:18 PM | REFACTOR_IN_PROGRESS | AWS::Lambda::Function         | MyStack.FunctionA5EA2BD8     | Service.Function8F0BB69B     
     2/3 | 2:03:19 PM | REFACTOR_COMPLETE    | AWS::CloudFront::Distribution | MyStack.DistributionE3BB089E | Web.DistributionE3BB089E 
     3/3 | 2:03:20 PM | REFACTOR_COMPLETE    | AWS::Lambda::Function         | MyStack.FunctionA5EA2BD8     | Service.FunctionA5EA2BD8     
    
    ✅  Stack refactor complete

If you pass any filters to the `deploy` command, the refactor will work on those
stacks plus any other stacks the refactor touches. For example, if you choose to
only deploy stack A, and a resource was moved from stack A to stack B, the
refactor will involve both stacks. But even if there was a rename in, let's say,
stack C, it will not be refactored.

If you want to execute only the automatic refactoring, use the `cdk refactor`
command. The behavior is basically the same as with `cdk deploy`: it will detect
whether there are refactors to be made, ask for confirmation if necessary
(depending on the flag values), and refactor the stacks involved. But it will
stop there and not proceed with the deployment. If you only want to see what
changes would be made, use the `--dry-run` flag.

To perform refactoring, the CLI needs new permissions in the bootstrap stack.
Before using this feature, run `cdk bootstrap` for every target environment, to
add these new permissions.

Please note that the same CDK application can have multiple stacks for different
environments. In that case, the CLI will group the stacks by environment and
perform the refactoring separately in each one. So, although you can move
resources between stacks, both stacks involved in the move must be in the same
environment. Trying to move resources across environments will result in an
error.

### Settings

The behavior of the refactoring feature can be controlled by a few settings.

For both `deploy` and `refactor`:

- `--export-mapping=<FILE>`: writes the mapping to a file. The file can be used
  later to apply the same refactors to other environments.
- `--import-mapping=<FILE>`: use the mapping from a file, instead of computing
  it. The file can be generated using the `--export-mapping` option.
- `--dry-run`: shows on stdout what would happen, but doesn't execute.
- `--unstable=refactor`: enables the feature. If the flag is not set, the
  command fails with an error message explaining that the feature is
  experimental.

For `deploy` only:

- `--refactoring-action=[ACTION]`: the action to take in case there is a
  refactor to be made. Possible values for `ACTION` are:
    - `confirm`: ask the user what to do. This is the scenario described in the
      **How it works** section.
    - `refactor`: automatically refactor and deploy.
    - `quit`: stop with a non-zero exit code.
    - `skip`: deploy without refactoring. This is the default value.

All these settings are also available in the `cdk.json` file:

```json
{
  "app": "...",
  "refactor": {
    "refactoringAction": "confirm",
    "exportMapping": "output.json",
    "dryRun": true
  }
}
```

### Explicit mapping

Although the CLI will automatically refactor only what is unambiguous, you may
still need to have more control over the refactoring process. Companies usually
have stringent policies on how changes are made to the production environment,
for example. One such policy is that every change must be explicitly declared in
some sort of code, including refactors.

In a situation like this, you can import and export mapping files. Here is how
it works: at development time, you made a change that the CLI detected as a
refactor. Since you want that refactor to be propagated to other environments,
you export the mapping file, with the command
`cdk refactor --export-mapping=file.json`.

There are at least two possible paths from here, depending on the company's
policies:

1. You send the exported file to an operations team, who will review it. If
   approved, they manually run the command
   `cdk refactor --import-mapping=file.json` on every protected environment in
   advance (i.e., before your changes get deployed to those environments). When
   you import a mapping, the CLI won't try to detect refactors.
2. The `--apply-mapping` option is also available for the `deploy` command. So
   you can commit the mapping file to version control, and configure the CLI to
   use apply it on every deployment. This is a more convenient option, because
   it requires less coordination between different roles, but the mapping file
   must be removed from the repository once the refactor has been applied.
   Otherwise, the next deployment will fail.

In general, if the protected environment is not in the same state as the
environment where the mapping was generated, the `refactor --apply-mapping`
command will fail.

### Rollback

After refactoring the stack, the CLI will proceed with the deployment
(assuming that is your choice). If the deployment fails, and CloudFormation
rolls it back, the CLI will execute a second refactor, in reverse, to bring the
resources back to their original locations.

If you don't want the CLI to perform the rollback refactor, you can use the
`--no-rollback` flag, which also controls the rollback behavior of the
deployment.

### Ambiguity

Imagine a person walking down the street, and someone takes two snapshots of
them, a few seconds apart. When you look at the snapshots, you can tell that
it's the _same person_ at different places, rather than two different people.
You are justified in this conclusion because the person's features (face,
clothes, height, etc.) are exactly the same in both photographs. But if, instead
of one person walking, you have a pair of identical twins, wearing the same
clothes, you won't be able to tell which one is which, from one photo to the
next.

The same principle applies here: you can think of stack name + logical ID as a
place, and the resource properties as its "personal" features. If a resource has
different properties before and after a potential deployment, the best we can do
is assume they are different resources. If the properties are the same from one
point in time to the other, they very likely are the same resource (although the
developer still has the last word on this). But if there are two resources that
have the same properties in the same stack, they are like the twin siblings
case: there's no way to tell them which is which in case they both move to a
different stack or get renamed.

Indistinguishable resources in this sense are said to be _equivalent_ (see
Appendix A for a more formal definition). In the unlikely event that two or more
equivalent resources move, the CLI won't be able to proceed. For example,
suppose you have two queues in the same stack, named `Queue1` and `Queue2`, with
the same properties, and without a user defined physical ID:

    App
    └─ Stack
       ├─ Queue1
       └─ Queue2

If they get renamed to, let's say, `Queue3` and `Queue4`,

    App
    └─ Stack
       ├─ Queue3
       └─ Queue4

then the CLI will not be able to establish a 1:1 mapping between the old and new
names. In this case, it will show you the ambiguity, and stop the deployment:

    Ambiguous Resource Name Changes
    ┌───┬──────────────────────┐
    │   │ Resource             │
    ├───┼──────────────────────┤
    │ - │ Stack.Queue1A4198146 │
    │   │ Stack.Queue2B0BA5D32 │
    ├───┼──────────────────────┤
    │ + │ Stack.Queue3C7606C37 │
    │   │ Stack.Queue4D681F510 │
    └───┴──────────────────────┘

    If you want to take advantage of automatic resource refactoring, avoid 
    renaming or moving multiple identical resources at the same time.

    If you want to provide an explicit mapping, use the --import-mapping option.

As the message suggests, you can use the `--import-mapping` option as a way to
resolve ambiguities.

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

In case of ambiguity, the toolkit will throw an `AmbiguityError`:

```typescript
try {
  await toolkit.refactor(cxSource);
} catch (e) {
  if (e instanceof AmbiguityError) {
    // Handle ambiguity
  } else {
    throw e;
  }
}
```

---


Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to
the RFC pull request):

```

[ ] Signed-off by API Bar Raiser @rix0rrr

```

## Public FAQ

### What are we launching today?

A new developer experience for CDK users, that allows them to change the
location of a construct (stack plus logical ID) without causing resource
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

## Internal FAQ

### Why are we doing this?

This feature was initially requested in May 2020. It is one of the top 5 most
up-voted RFCs, with 94 thumbs-up. Despite being almost 5 years old, it has
continued to be highly discussed and debated by CDK customers and the community.
The solution we currently provide, the `renameLogicalId` method, is perceived by
customers as a workaround, adding unnecessary cognitive load for developers.
Code refactoring is a fundamental job-to-be-done that developers expect to be
supported natively by the tool.

In addition to this, the recent launch of CloudFormation's stack refactoring API
made it possible to support refactoring on the service side. We are building on
top of that API to bring a seamless experience to CDK users.

### Why should we _not_ do this?

The main attraction of this feature is also, in a way, its greatest deterrent:
that the refactoring happens automatically, and that the CLI makes decisions
that the user may not even be aware they need to make (accidental renames, for
example). This may cause anxiety for some users, who might not understand what
exactly is happening, and what the consequences are. We can mitigate this risk
with good documentation and careful interaction design.

### What is the technical solution (design) of this feature?

High level description of the algorithm:

First, list all the stacks: both local and deployed. Then build an index of all
resources from all stacks. This index maps the _content_ address (physical ID or
digest) of each resource to all the _location_ addresses (stack name + logical
ID) they can be found in.

Resources that have different locations before and after, are considered to have
been moved. For each of those, create a mapping from the source (the currently
deployed location) to the destination (the new location, in the local template).
Example:

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

Since the CloudFormation API expects not only the mappings, but also the
templates in their final states, we need to compute those as well. This is done
by applying all the mappings locally, essentially emulating what CloudFormation
will eventually do. For example, if a mapping says that a resource has moved
from stack `A` with name `Foo`, to stack `B` with name `Bar`, we will remove
`Foo` from the template for stack `A`, and add a new resource called `Bar` to
the template for stack `B`.

At this point, if there is any ambiguity (more than one source or more than one
destination for a given mapping), stop and ask the user whether they want to
proceed.

Assuming there were no ambiguities, or the user wants to proceed anyway, it is
ready to call the API to actually perform the refactor, using the mappings and
templates computed previously.

### Is this a breaking change?

No. By default, the CLI will skip refactoring on deployment. The user must
explicitly enable it by passing a value other than `skip` to the
`--refactoring-action` (or `refactoringAction` in `cdk.json`) option. Also, this
feature will initially be launched as experimental, and the user must
acknowledge this by passing the `--unstable=refactor` flag.

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
construct tree and construct IDs. And, just like `renameLogicalId`, it could be
perceived as a workaround. However, we are open to implementing this as an
additional feature if enough customers indicate their preference for it.

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
- Implement ambiguity detection.
- Implement the display of the ambiguities to the user.
- Add physical ID to resource equivalence.

#### Phase 2 (application)

Once the detection of all cases is implemented in phase 1, we are ready to
implement the application of the changes.

High-level tasks:

- Add new permissions to the bootstrap stack.
- Implement the actual refactoring.
- Implement rollback.
- Implement the progress bar to display the refactoring progress.
- Implement feature flags.
- Handle cross-stack references.
- Add the refactor step to the `deploy` command.
- Write a blog post.

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

    d(resource) = hash(type + physicalId)                       , if physicalId was defined by the user
                = hash(type + properties + dependencies.map(d)) , otherwise

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

### B. Handling of settings

Pseudocode for `deploy`:

    // either from CLI option or config file
    switch (refactoring action): 
        case quit:
            Stop with non-zero exit code;

        case refactor:
            m = getMapping();
            if (not --dry-run):
                Apply m;
                Deploy;

        case skip or null:
            Deploy;

        case confirm:
            m = getMapping().
            if (not --dry-run):
                Ask user what to do;
                switch (user's choice):
                    case quit:
                        Stop with non-zero exit code;
                    case refactor: 
                        Apply m;
                        Deploy;
                    case skip:
                        Deploy;

    function getMapping():
        if (not --unstable=refactor):
            Fail with a specific error message;

        if (--import-mapping):
            m = mapping from the file;
        else:
            m = compute the mapping;

        Render m to stdout;

        if (--export-mapping):
            Write m to the file;

        return m;

The pseudocode for the `refactor` command is simply:

    m = getMapping();
    if (not --dry-run):
        Apply m;

[pulumi-aliases]: https://www.pulumi.com/docs/iac/concepts/options/aliases/

[equivalence relation]: https://en.wikipedia.org/wiki/Equivalence_relation