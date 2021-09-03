# Garbage Collection for Assets

* **Original Author(s):**: @eladb, @kaizen3031593
* **Tracking Issue**: #64
* **API Bar Raiser**: @nlynch

The asset garbage collection CLI will identify and/or delete orphaned CDK assets, 
resulting in smaller bucket/repo size and less cost for customers.

## Working Backwards

**CHANGELOG**: 
  - feat(cli): implement `cdk gc --list`  and `cdk gc`

**Help**:

```shell
➜ cdk gc --help
cdk gc [ENVIRONMENT...]

Finds and deletes all orphaned S3 and ECR assets in the ENVIRONMENT

Options:
  -l, --list              lists, rather than deletes, all orphaned assets
  -t, --type=[s3|ecr]     filters for type of asset
    
Examples:
  cdk gc
  cdk gc aws://ACCOUNT/REGION
  cdk gc --list --type=s3   
```

**README**: 

The `cdk gc` command reduces the size of your s3 asset bucket and your ecr asset 
repository by identifying and deleting orphaned assets. The command will enter the
specified environment or all environments in the CDK app and determine assets that can be safely deleted. Only assets that are no longer referenced by a CDK template are deleted. You can also list orphaned assets using the `--list` option or filter for a specific type of asset using `--type`.


#### Usage:

This command will garbage collect all orphaned assets in all environments that belong to the current CDK app (if `cdk.json` exists):

```shell
cdk gc
```

This command will list all orphaned assets in all environments that belong to the current CDK app:

```shell
cdk gc --list
```

This command will garbage collect orphaned assets in the specified environment:

```shell
cdk gc aws://ACCOUNT/REGION
``` 

This command will list orphaned s3 assets in the specified environment. The options for `--type` are `s3` or `ecr`:
```shell
cdk gc aws://ACOUNT/REGION --type=s3
```

---

# 

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

> This section should include answers to questions readers will likely ask about
> this release. Similar to the "working backwards", this section should be
> written in a language as if the feature is now released.
>
> The template includes a some common questions, feel free to add any questions
> that might be relevant to this feature or omit questions that you feel are not
> applicable.

### What are we launching today?

The `cdk gc` command features, with support for garbage collection of orphaned s3 and ecr assets.

### Why should I use this feature?

Currently orphaned assets are left in the s3 bucket or ecr repository and contribute additional cost for customers. This feature provides a swift way to identify and delete unutilized assets.

### How does the command identify orphaned assets?

I have not settled on a plan, so feel free to suggest. My initial thoughts are that at deploy time, each CDK app needs only 2 "versions" of an asset, the "new" one to deploy, and the "old" one to replace. After a successful deployment, we no longer need the "old" assets, but if the deployment fails, we revert back to the "old" asset. I imagine we can implement some sort of tag on each asset at deploy time and update based on which are new and which are old. Then, `cdk gc` can run a lambda that removes all assets with the "old" tag.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

As customers continue to adopt the CDK and grow their CDK applications over time, their asset buckets/repositories grow as well. At least one customer has [reported](https://github.com/aws/aws-cdk-rfcs/issues/64#issuecomment-897548306) 0.5TB of asets in their staging bucket. Most of these assets are orphaned and can be safely removed. 

### Why should we _not_ do this?

There is risk of removing assets that are in use, providing additional pain to the customer. See [this](https://github.com/aws/aws-cdk-rfcs/issues/64#issuecomment-833758638) github comment.

### What is the technical solution (design) of this feature?

> Briefly describe the high-level design approach for implementing this feature.
>
> As appropriate, you can add an appendix with a more detailed design document.
>
> This is a good place to reference a prototype or proof of concept, which is
> highly recommended for most RFCs.

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
