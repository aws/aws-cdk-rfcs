# CDK Refactoring Support

- **Original Author(s):**: @otaviomacedo
- **Tracking Issue**: #162
- **API Bar Raiser**: @{BAR_RAISER_USER}

An improvement to the CDK CLI `deploy` command, to protect against replacement
of resources that had their logical IDs modified. The CLI now detects these
cases automatically, and refactors the stack before the actual deployment.

## Working Backwards

AWS CloudFormation identifies resources by their logical ID. As a consequence,
if you change the logical ID of a resource after it has been deployed,
CloudFormation will create a new resource with the new logical ID and possibly
delete the old one. In any case, for stateful resources, this may cause
interruption of service or data loss, or both.

Historically, the advice has been to avoid changing logical IDs of resources.
However, this is not always possible, or goes against good engineering
practices. For example, you may have duplicated code across different CDK
applications, and you want to consolidate it into a single reusable construct
(usually referred to as an L3 construct). The very introduction of a new node
for the L3 construct in the construct tree will lead to the renaming of the
logical IDs of the resources in that subtree. You may also need to move
resources around in the tree to make it more readable, or even between stacks to
better isolate concerns. Not to mention accidental renames, which have also
impacted customers in the past.

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
construct tree (L1 resources omitted for brevity) looks like this:

    App
    └ MyStack
      ├ Bucket
      ├ Distribution
      └ Function

Now suppose you want to make the following changes, after having deployed it to
your AWS account:

- Rename the bucket from `Bucket` to the more descriptive name `Origin`.
- Create a new L3 construct called `Website` that groups the bucket and the
  distribution, to make this pattern reusable in different applications.
- Move the `Website` construct to a new stack called `Web`, for better
  separation of concerns.
- Rename the original stack to `Service`, to better reflect its new specific
  role in the application.

The construct tree now looks like this:

    App
    ├ Web
    │  └ Website
    │    ├ Origin
    │    └ Distribution
    └ Service
      └ Function

Even though none of the resources have changed, their paths have
(from `MyStack/Bucket/Resource` to `Web/Website/Origin/Resource` etc.) Since the
CDK computes the logical IDs of the resources based on their path in the tree,
all three resources will have different logical IDs in the synthesized template,
compared to what is already deployed.

If you run `cdk deploy` now, by default the CLI will detect this change and
automatically refactor the stacks. You will see the following output:

    Refactoring...
    Creating stack refactor...

     Prg | Time       | Status               | Resource Type                 | Old Logical ID               | New Logical ID               
     ----|------------|----------------------|-------------------------------|------------------------------|-----------------------------
     0/3 | 2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::S3::Bucket               | MyStack.Bucket5766466B       | Web.Bucket843D52FF           
     0/3 | 2:03:17 PM | REFACTOR_IN_PROGRESS | AWS::CloudFront::Distribution | MyStack.DistributionE3BB089E | Web.Distribution7142E1F1     
     1/3 | 2:03:18 PM | REFACTOR_COMPLETE    | AWS::S3::Bucket               | MyStack.Bucket5766466B       | Web.Bucket843D52FF           
     1/3 | 2:03:18 PM | REFACTOR_IN_PROGRESS | AWS::Lambda::Function         | MyStack.FunctionA5EA2BD8     | Service.Function8F0BB69B     
     2/3 | 2:03:19 PM | REFACTOR_COMPLETE    | AWS::CloudFront::Distribution | MyStack.DistributionE3BB089E | Web.DistributionE3BB089E 
     3/3 | 2:03:20 PM | REFACTOR_COMPLETE    | AWS::Lambda::Function         | MyStack.FunctionA5EA2BD8     | Service.FunctionA5EA2BD8     
    
    ✅  Stack refactor complete

In case you do want to replace the resources, you can override this default
behavior and skip the refactoring, by passing the `--skip-refactoring` flag to
the CLI, or by configuring this setting in the `cdk.json` file:

```json
{
  "app": "...",
  "skipRefactoring": true
}
```

### Ambiguity

In some cases, the CLI may not be able to automatically refactor the stack. To
understand this, consider the following example, where there are two _identical_
resources, called `Queue1` and `Queue2`, in the same stack:

    App
    └ Stack
      ├ Queue1
      └ Queue2

If they get renamed to, let's say, `Queue3` and `Queue4`,

    App
    └ Stack
      ├ Queue3
      └ Queue4

Then the CLI will not be able to establish a 1:1 mapping between the old and new
names. In this case, it will ask you to confirm the changes:

    Resource Name Changes
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

    If these changes were intentional, and you want to proceed with the
    resource replacements, please confirm below.

    Do you wish to deploy these changes (y/n)?

To skip this prompt, pass the `--ignore-ambiguous-renaming` flag to the CLI, or
configure this setting in the `cdk.json` file:

```json
{
  "app": "...",
  "ignoreAmbiguousRenaming": true
}
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to
the RFC pull request):

```

[ ] Signed-off by API Bar Raiser @xxxxx

```

## Public FAQ

### What are we launching today?

An improvement to the CDK CLI `deploy` command, to protect against replacement
of resources that had their logical IDs modified. The CLI now detects these
cases automatically, and refactors the stack before the actual deployment.

### Why should I use this feature?

If you ever find yourself needing to do one of the following, you will benefit
from stack refactoring support:

- Moving constructs between different stacks, either in the same or to a
  different CDK application.
- Moving constructs within the same stack. This could be just for organization
  purposes, or to create reusable components.
- Renaming a stack.
- Renaming a construct, intentionally or by mistake.

### Can the CLI help me resolve ambiguity when refactoring resources?

Not at the moment. One of the tenets behind this feature is that it should work
in any environment, including CI/CD pipelines, where there is no user to answer
questions. Although we could easily extend this feature to include ambiguity
resolution for the interactive case, it wouldn't transfer well to the
non-interactive case. If you are interested in an in-depth explanation of the
problem and a possible solution, check Appendix A.

## Internal FAQ

### Why are we doing this?

This feature was initially requested back in May 2020. It is one of the top 5
most up-voted RFCs, with 94 thumbs-up. Despite being almost 5 years old, it has
continued to be highly discussed and debated for almost 5 years by CDK customers
and the community. The solution we currently provide, the `renameLogicalId`
method, is perceived by customers as a workaround, adding unnecessary cognitive
load for developers. Code refactoring is a fundamental job-to-be-done that
developers expect to be supported natively by the tool.

In addition to this, the recent launch of CloudFormation's stack refactoring API
made it possible to support refactoring on the service side. We are building on
top of that API to bring a seamless experience to CDK users.

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

### What is the technical solution (design) of this feature?

High level description of the algorithm:

First, it lists all the stacks: both local and deployed. Then it builds an index
of all resources from all stacks. This index maps the _content_ address
(physical ID or digest) of each resource to all the _location_ addresses (stack
name + logical ID) they can be found in. Resources that have different locations
in new stacks compared to the old ones are considered to have been moved. For
each of those, it creates a mapping from the old location to the new one.

Since the CloudFormation API expects not only the mappings, but also the
templates in their final states, we need to compute those as well. This is done
by applying all the mappings locally, essentially emulating what CloudFormation
will eventually do. For example, if a mapping says that a resource has moved
from stack A with name Foo, to stack B with name Bar, we will remove Foo from
the template for stack A, and add a new resource called Bar to the template for
stack B.

At this point, if there is any ambiguity (more than one source or more than one
destination for a given mapping), it stops and asks the user whether they want
to proceed.

Assuming there were no ambiguities, or the user wants to proceed anyway, it is
ready to call the API to actually perform the refactor, using the mappings and
templates computed previously.

As every AWS API call, refactoring is restricted to a given environment
(account and region). Given that one CDK app can have stacks for multiple
environments, the CLI will group the stacks by environment and perform the
refactoring separately in each one. Trying to move resources between stacks that
belong in different environments will result in an error.

### Is this a breaking change?

No.

### What alternative solutions did you consider?

> Briefly describe alternative approaches that you considered. If there are
> hairy details, include them in an appendix.

### What are the drawbacks of this solution?

See the open issues section below.

### What is the high-level project plan?

See https://github.com/orgs/aws/projects/272.

### Are there any open issues that need to be addressed later?

This improved deployment experience actually consists of two separate steps,
behind the scenes: refactoring followed by deployment. And the whole workflow is
controlled by the CLI. As a result, this is not an atomic operation: it is
possible that the refactoring step succeeds, but before the CLI has a chance to
deploy, it gets interrupted, for whatever reason (computer crash, network
failures, etc.) In this case, the user will be left with a stack that is neither
in the original state nor in the desired state.

In particular, the logical ID won't match the CDK construct path, stored in the
resource's metadata. This has consequences for the CloudFormation console, which
will show a Tree view that is not consistent with the Flat view.

Some possible solutions to consider, from more specific to more general:

- CloudFormation to ignore changes in the `Metadata[aws:cdk:path]` resource
  attribute in refactor operations.
- CloudFormation to allow resource additions and deletions in refactor
  operations.
- Two-phase commit. The CLI could create the refactor and the changeset, and
  then have a new command to execute both in a single atomic operation (let's
  say, a `executeChangeSetAndRefactor()`).

Since all these solutions depend on changes on the CloudFormation side, and this
edge case is unlikely to happen, we are going to address it later.

## Appendix

### A. Ambiguity

The only safe way to resolve ambiguity in cases such as renaming multiple
identical resources, is to ask the developer what their intent is. But what if
the developer is not present to answer questions (in a CI/CD pipeline, for
instance)? A necessary condition in this case is that the developer's intent has
been captured earlier, encoded as a mapping between resource locations, and
stored somewhere.

But this is not sufficient. Note that every mapping is created from a pair of
source and target states, out of which the ambiguities arose. To be able to
safely carry a mapping over to other environments, two additional conditions
must be met:

1. The source state on which a mapping is applied must be the same as the source
   state where the mapping was captured.
2. The target state used to create the mapping should indeed be what the user
   wants as a result.

I am using the abstract term "state" here, but how could such a state be
instantiated in practice? Let's consider some options and see how they can fail
to satisfy the conditions above.

First, we need to establish a point when the mapping is created (and the
developer is involved to resolve possible ambiguities). Let's call this the
"decision point". As a first attempt, let's try to use every deployment in the
development cycle as the decision point. In this solution, the development
account is the source state, and the cloud assembly to be deployed is the target
state. If any ambiguities were resolved, they are saved in a mapping file, under
version control. On every deployment, to other environments, the mapping file is
used to perform the refactoring.

This sounds like it could work, but if the development environment is not in the
same state as the one where the mapping is applied, condition 1 is violated. And
if the developer fails, for whatever reason, to run a deployment against their
environment before commiting a change to the version control system (which I
will henceforth assume is Git), condition 2 is violated.

Since we are talking about Git, what about using each commit as a decision
point? In this case, the source and target states would come from the
synthesized cloud assemblies in the previous and current commit, respectively.
We still have a mapping file, containing ambiguity resolutions, which are added
to the commit, using a Git hook. For this solution to work, we need an
additional constraint: that every revision produces a valid cloud assembly,
which can also be enforced with a Git hook.

Let's evaluate this solution in terms of the two conditions above. Because the
developer doesn't have a choice anymore of which target state to use (or target
state, for that matter), condition 2 is satisfied. But remember that the scope
of the mapping file is the difference between two consecutive revisions. If the
developer's local branch is multiple commits ahead of the revision that was
deployed to production, the source state in production is not the same as the
one in the mapping file, violating condition 1.

#### Making history

An improvement we can make is to implement an event sourcing system. Instead of
storing a single mapping between two states, we store the whole history of the
stacks. A **history** is a chain of **events** in chronological order. An event
is a set of operations (create, update, delete, and refactor) on a set of
stacks.

The decision point remains the same, but now we append a new event to a version
controlled history file on every commit. This event includes all creates,
updates and deletes, plus all refactors, whether they were automatically
detected or manually resolved.

As with any event sourcing system, if we want to produce a snapshot of the
stacks at a given point in time, all we need to do is replay the events in
order, up to that point. We are now ready to state the key invariant of this
system:

> **Invariant**: For every revision `r`, the cloud assembly synthesized from
> `r` is equal to the snapshot at `r`.

In other words, the current state should be consistent with the history that led
up to that state.

One final piece to add to the system: every environment should also have its own
history file, which should also maintain a similar invariant (through CFN hooks,
for example). Having all this in place, we can execute the following algorithm
on every deployment:

    ---------------------------------
      Key: 
        H(E): environment history
        H(A): application history
        LCA: lowest common ancestor
    ---------------------------------

    if H(E) is a prefix of H(A):
      Compute the diff between H(A) and H(E);
      Extract the mapping from the diff;
      Apply the mapping to the stacks in the environment;
      Deploy;
    else:
      Compute the diff from the LCA of H(A) and H(E);
      Extract the mapping from the diff;
      if the mapping is empty or the override flag is on:
        Deploy;
      else:
        Error: source state doesn't match the mapping.

For example, suppose the histories at play are (`*` denotes the current state):

    H(E) = e1 ◄── e2*
    H(A) = e1 ◄── e2 ◄── e3 ◄── e4

Then the diff between them is `e3 ◄── e4`. If these events contain any refactor,
we just apply them, and then deploy the application. The resulting environment
history is the merge of the two:

    H(E) = e1 ◄── e2 ◄── e3 ◄── e4*

Now suppose the histories involved are:

    H(E) = e1 ◄── e2 ◄── e3*
    H(A) = e1 ◄── e2 ◄── e4 ◄── e5

In this case, `H(E)` is not a prefix of `H(A)`, but they share a common
ancestor. Their LCA is `e2`. Computing the diff from there we get `e4 ◄── e5`.
If there are no refactors to apply from this diff, we can go ahead and deploy
the application. Again, the new state results from the merge of `H(E)` and
`H(A)`:

    H(E) = e1 ◄── e2 ◄── e3         
                   ▲                  
                   │                  
                   └──── e4 ◄── e5*

By default, if there are refactors to be done, this is considered an error,
because we can't guarantee that the refactor makes sense (let alone that this
was the developer's intent). But the application developer can decide to accept
the risk of replacement beforehand, by setting an override flag, in which case
we go ahead and deploy, but skip the refactoring step. The resulting history of
the environment is the same as in the diagram above.

#### The future

Once we have a system like this in place, we can expand the scope to which the
automatic refactoring applies. Consider the case in which you want to rename a
certain resource and, at the same time, make some minor changes, such as  
adding or updating a couple of properties. This is another ambiguous case,
because it's not clear what the intent is: update with rename, or replacement?
But with the history system, we can detect such cases, interact with the
developer, and store the decision in the history.

Since this historical model contains all the information about the state of the
stacks in an environment, it could also be used for other purposes. For example,
development tools could use the history to provide a "time machine" feature,
that allows developers to see the state of the infrastructure at any point in
time. CloudFormation itself could build on that, and provide a way to roll back
or forward to another state. Potentially, this could also help with drift
resolution (or prevention).