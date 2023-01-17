# Aurora Serverless v2 support

* **Original Author(s):**: @pahud
* **Tracking Issue**: #470
* **API Bar Raiser**: @vinayak-kukreja

Allow users to create Amazon Aurora Serverless v2 instances with the `aws-rds` module.

## Working Backwards

> This section should contain one or more "artifacts from the future", as if the
> feature was already released and we are publishing its CHANGELOG, README,
> CONTRIBUTING.md and optionally a PRESS RELEASE. This is the most important
> section of your RFC. It's a powerful thought exercise which will challenge you
> to truly think about this feature from a user's point of view.
>
> Choose *one or more* of the options below:
>
> * **CHANGELOG**: Write the changelog entry for this feature in conventional
>   form (e.g. `feat(eks): cluster tags`). If this change includes a breaking
>   change, include a `BREAKING CHANGE` clause with information on how to
>   migrate. If migration is complicated, refer to a fictional GitHub issue and
>   add its contents here.

feat(rds): Aurora Serverless v2 support

## Use Cases

1. To create a new Aurora Serverless v2 cluster with one writer only. This writer could be either serverless or provisioned instance:

- serverless writer
- provisioned writer

2. To create a new Aurora Serverless v2 cluster with one writer and one reader as serverless or provisoined. This could be:

- serverless writer + serverless reader
- serverless writer + provisioned reader
- provisioned writer + serverless reader
- provisioned writer + provisioned reader

3. To create a new Aurora Serverless v2 cluster with one writer and multiple readers. This could be:

- serverless writer + all serverless readders
- serverless writer + all provisioned readers
- serverless writer + mixed readers
- provisioned writer + all serverless readers
- provisioned writer + all provisioned readers
- provisioned writer + mixed readers

>
> * **README**: If this is a new feature, write the README section which
>   describes this new feature. It should describe the feature and walk users
>   through usage examples and description of the various options and behavior.
>

## Aurora Serverless v2 support

Aurora Serverless v2 is an on-demand, autoscaling configuration for Amazon Aurora.
Aurora Serverless v2 helps to automate the processes of monitoring the workload and
adjusting the capacity for your databases. Capacity is adjusted automatically based on
application demand. Read
[Using Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)
for more details.

### Create a new cluster

Use `DatabaseClusterV2` to create a new cluster with Aurora Serverless V2 support.
You may specify the `writer` and `readers` instances with the cluster. The instances
could be either serverless or privisioned.

```ts
new rds.DatabaseClusterV2(stack, 'cluster', {
  engine,
  vpc,
  // writer(serverless)
  writer: { serverless: true },
  readers: [
    // reader 1(provisioned)
    { instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE) },
    // reader 2(serverless)
    { serverless: true },
  ],
});
```

> * **PRESS RELEASE**: If this is a major feature (~6 months of work), write the
>   press release which announces this feature. The press release is a single
>   page that includes 7 paragraphs: (1) summary, (2) problem, (3) solution, (4)
>   leader quote, (5) user experience, (6) customer testimonial and (7) one
>   sentence call to action.

---

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

We are launching the Aurora Serverless v2 support for `aws-rds` that allows users to
create a new cluster with Serverless v2 support and define serverless or provisioned
`writer` and `readers` in the new `DatabaseClusterV2` construct.

### Why should I use this feature?

1. I need to create a cluster with Aurora serverless v2 support.
2. I need to create the writer as well as the readers with this cluster.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

The existing `aws-rds` module is missing the Aurora Serverless v2 support and we are adding this support into this module.

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

### What is the technical solution (design) of this feature?

We are creating a new `DatabaseClusterV2` L2 construct by extending the `DatabaseClusterBase` class.
Users that opt-in serverless v2 enabled clusters should use this class to create a new cluster
as well as writer and reader instances, which could be serverless, porivioned or mixed.

The only required props of `DatabaseClusterV2` are `engine: rds.IClusterEngine` and `vpc: ec2.IVpc`.
We evaluate the `engine` and check if it's compatible with the serverless v2 and throw if necessary.
The `vpc` prop is required in the `InstanceProps` for the old `DatabaseCluster` but we don't need the
whole `InstanceProps`. We just need the `vpc: ec2.IVpc`.

We need an interface for `writer` and `readers` and they can be either provisioned or serverless and the
default is provisioned.

For a `serverless` instance, the minimal required property would be `serverless: true` since the default
is provisioned while for a provisioned instanced the default could be just `{}` but you can optionally
specify custom `instanceType` which is not required in `serverless`.

While this new construct addresses the requirement for new clusters with serverless v2 support,
existing clusters previously created with `DatabaseCluster` construct will not be able to enable the
serverless v2 support or add any serverless instances into the existing cluster with the new construct.
To address this concern, we should update the existing `DatabaseCluster` by adding help methods such as
`addServerlessInstance()` and `addProvisionInstance()`. The existing clusters should be updated by manually
adding the `serverlessV2Config` property which is mandatory for the serverless v2 cluster.

### Is this a breaking change?

No. As `DatabaseClusterV2` is a new construct, there's no breaking change for that.

> If the answer is no. Otherwise:
>
> Describe what ways did you consider to deliver this without breaking users?
>
> Make sure to include a `BREAKING CHANGE` clause under the CHANGELOG section with a description of the breaking
> changes and the migration path.

### What alternative solutions did you consider?

This RFC addresses two primary senarios for CDK users either creating a new cluster with serverless v2 support or
modifying the existing one to enable the serverless v2 support. We will split this into multiple small pull requests
to address those two cases.

Another alternative to consider is to create a new construct to sastify both cases and eventually deprecate
the original `DatabaseCluster`.

### What are the drawbacks of this solution?

No major drawbacks of this solution as this is a new construct with no breaking changes and targeting
serverless v2 clusters only.

### What is the high-level project plan?

1. We will first create a PR for this new construct.
2. Depends on users feedback, optionally create another PR to modify the existing `DatabaseCluster`
construct to allow existing clusters enable the serverless v2 support.

### Are there any open issues that need to be addressed later?

> Describe any major open issues that this RFC did not take into account. Once
> the RFC is approved, create GitHub issues for these issues and update this RFC
> of the project board with these issue IDs.

## Appendix

1. [Using Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html) from Aurora User Guide.
2. [AWS::RDS::DBCluster](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-rds-dbcluster.html) from cloudformation.
3. [feat(aws-rds): support Aurora Serverless v2 cluster and instances #22446](https://github.com/aws/aws-cdk/pull/22446)
previous closed PR with discussion.
