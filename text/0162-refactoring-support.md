# CDK Refactoring Support

- **Original Author(s):**: @otaviomacedo
- **Tracking Issue**: #162
- **API Bar Raiser**: @{BAR_RAISER_USER}

## Working Backwards

AWS CloudFormation identifies resources by their logical ID. As a consequence,
if you change the logical ID of a resource after it has been deployed,
CloudFormation will create a new resource with the new logical ID and possibly
delete the old one. In any case, for stateful resources, this may cause
interruption of service or data loss.

Historically, the advice has been to avoid changing logical IDs of resources.
However, this is not always possible, or goes against good engineering
practices. For example, you may have duplicated code across different CDK
applications, and you want to consolidate it into a single reusable construct
(usually referred to as an L3 construct). The very introduction of a new root
for the construct will lead to the renaming of the logical IDs of the resources
in that subtree. You may also need to move resources around in the tree to make
it more readable, or even between stacks to better isolate concerns. Not to
mention accidental renames, which are bound to happen.

With the recent launch of CloudFormation's stack refactoring API, the CDK now
automatically detects these cases, and refactors the stack on your behalf. This
brings more flexibility for developers, and reduces the risk of accidental
changes that lead to resource renaming.

### How it works

When you run `cdk deploy`, the CLI will compare the template in the cloud
assembly with the template in the deployed stack. If it detects that a resource
has been renamed, it will automatically perform the refactoring, and then
proceed with the deployment.

For example, suppose your CDK application has a single stack, called `MyStack`,
containing an S3 bucket, a CloudFront distribution and a Lambda function. The
construct tree (L1 resources omitted for brevity) looks like this:

    App
    └ MyStack
      └ Bucket
      └ Distribution
      └ Function

Now suppose you want to make the following changes:

- Rename the bucket from `Bucket` to the more descriptive `Origin`.
- Create a new L3 construct called `Website` that groups the bucket and the
  distribution, to make this pattern reusable in different applications.
- Move the `Website` construct to a new stack called `Web`, for better
  separation of concerns.
- Rename the original stack to `Service`, to better reflect its new specific
  role in the application.

The construct tree now looks like this:

    App
    └ Web
      └ Website
        └ Origin
        └ Distribution
    └ Service
      └ Function

Even though none of the resources have changed, their paths have
(`MyStack/Bucket/Resource` to `Web/Website/Origin/Resource` etc.) Since the CDK
computes the logical IDs of the resources based on their path in the tree, all
three resources will have different logical IDs in the synthesized template.

If you run `cdk deploy` now, the CLI will detect this change and automatically
refactor the stacks, by default. You will see the following output:

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
understand this, consider the following example, where there are two identical
resources, called `Queue1` and `Queue2`, in the same stack:

    App
    └ Stack
      └ Queue1
      └ Queue2

If they get renamed to, let's say, `Queue3` and `Queue4`,

    App
    └ Stack
      └ Queue3
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

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

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

On a very high level, this is what the refactoring algorithm does:

First, it lists all the stacks (both local and deployed). Then it builds an
index of all resources from all stacks. This index maps the _content_ address
(hash) of each resource to all the _location_ addresses (stack name + logical
ID) they can be found in. Resources that have different locations in new stacks
compared to the old ones are considered to have been moved. For each of those,
it creates a mapping from the old location to the new one.

Since the CloudFormation API expects not only the mapping, but also the
templates in their final states, we need to compute those as well. This is done
by applying all the mappings locally, essentially simulating what CloudFormation
will eventually do. For example, if a mapping says that a resource has moved
from stack A with name Foo to stack B with name Bar, we will remove Foo from the
template for stack A, and add a new resource called Bar to the template for
stack B.

At this point, if there is any ambiguity (more than one source or more than one
destination for a given mapping), it stops and asks the user whether they want
to proceed.

Assuming there were no ambiguities, or the user wants to proceed anyway, it is
ready to call the API to actually perform the refactor, using the mappings and
templates built previously.

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

> Describe any problems/risks that can be introduced if we implement this RFC.

### What is the high-level project plan?

> Describe your plan on how to deliver this feature from prototyping to GA.
> Especially think about how to "bake" it in the open and get constant feedback
> from users before you stabilize the APIs.
>
> If you have a project board with your implementation plan, this is a good
> place to link to it.

### Are there any open issues that need to be addressed later?

> Describe any major open issues that this RFC did not take into account. Once
> the RFC is approved, create GitHub issues for these issues and update this RFC
> of the project board with these issue IDs.

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.

