# Aurora Serverless v2 support

* **Original Author(s):**: @pahud
* **Tracking Issue**: #470
* **API Bar Raiser**: @{BAR_RAISER_USER}

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

>
> * **README**: If this is a new feature, write the README section which
>   describes this new feature. It should describe the feature and walk users
>   through usage examples and description of the various options and behavior.
>

## Aurora Serverless v2 support

Aurora Serverless v2 is an on-demand, autoscaling configuration for Amazon Aurora. Aurora Serverless v2 helps to automate the processes of monitoring the workload and adjusting the capacity for your databases. Capacity is adjusted automatically based on application demand. 
Read [Using Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html) for more details.

### Using Aurora Serverless v2 for existing provisioned workloads

Aurora Serverless v2 allows you to add one or more Aurora Serverless v2 DB instances to the existing cluster as reader DB instances.

```ts
declare const vpc: ec2.Vpc;
const cluster = new rds.DatabaseCluster(this, 'Database', {
  ...
});
cluster.addServerlessInstance('InstanceId', {...})
```

### Using Aurora Serverless v2 for new provisioned workloads

To create a provisioned cluster with serverless instances only, specify `instances` to 0.

```ts
declare const vpc: ec2.Vpc;
const cluster = new rds.DatabaseCluster(this, 'Database', {
  ...
  // do not create any provisioned instances with this cluster
  instances: 0,
});
cluster.addServerlessInstance('InstanceA', {...});
cluster.addServerlessInstance('InstanceB', {...});
```

To create a provisioned cluster with a serverless writer and a provisioned reader:

```ts
declare const vpc: ec2.Vpc;
const cluster = new rds.DatabaseCluster(this, 'Database', {
  ...
  // do not create any provisioned instances with this cluster
  instances: 0,
});
const writer = cluster.addServerlessInstance('Writer', {...});
const reader = cluster.addProvisionedInstance('Reader', {...});
// ensure the reader is created after the writer
reader.node.addDependency(writer);
```

To create a provisioned cluster with a provisioned writer and a serverless reader:

```ts
declare const vpc: ec2.Vpc;
const cluster = new rds.DatabaseCluster(this, 'Database', {
  ...
  // do not create any provisioned instances with this cluster
  instances: 0,
});
const writer = cluster.addProvisionedInstance('Writer', {...});
const reader = cluster.addServerlessInstance('Reader', {...});
// ensure the reader is created after the writer
reader.node.addDependency(writer);
```

### Converting from provisioned DB cluster

If you have an existing DB cluster previously provisioned with `DatabaseCluster` construct with provisioned instances only. To covert your provisioned writer to a serverless writer, you need add one or more Aurora Serverless v2 reader DB instances to an existing provisioned cluster and perform a failover to one of the Aurora Serverless v2 DB instances. For the entire cluster to use Aurora Serverless v2 DB instances, remove any provisioned writer DB instances after promoting the Aurora Serverless v2 DB instance to the writer. Read the [doc](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.upgrade.html#aurora-serverless.comparison-requirements) for more details.


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

We are launching the Aurora Serverless v2 support for `aws-rds` that allows users to add serverless instances to existing provisioned clusters or create a new provisioned cluster with serverless instances(writer and readers) only.

### Why should I use this feature?

1. I have a provisoned RDS cluster with a privionsed writer instance only and I'd like to add a serverless instance as the reader in this cluster.
2. I have a provisoned RDS cluster with provisioned write and reader and I'd like to add a second reader instance as serverless.
3. I'd like to create a new provisioned RDS cluster with serverless writer and reader(s) only.

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

According to the [document](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.requirements.html#aurora-serverless-v2.requirements.capacity-range) an Aurora cluster must have a [ServerlessV2ScalingConfiguration](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-rds-dbcluster.html#cfn-rds-dbcluster-serverlessv2scalingconfiguration) attribute before you can add any DB instances that use the `db.serverless` DB instance class. For CDK users adding serverless instances into the existing cluster previously created in CDK, we will add a default `ServerlessV2ScalingConfiguration` with minimal required values to satisfy this requirement if they do not specify this in the construct props.

We will create the `addServerlessInstance()` and `addProvisionedInstance()` construct method for the `DatabaseCluster` that allows customers to add serverless or provisioned instances.


```ts
/**
 * Options to create a serverless v2 instance for Aurora Serverless v2.
 *
 */
export interface ServerlessInstanceOptions {
  /**
   * The instance engine of the instance.
   */
  readonly engine: IInstanceEngine;
}

/**
 * Options to create a provisioned instance for Aurora Serverless v2.
 */
export interface ProvisionedInstanceOptions {
  /**
   * The instance engine of the instance.
   */
  readonly engine: IInstanceEngine;
  /**
   * The instance type of the instance.
   */
  readonly instanceType: ec2.InstanceType;
}

/**
 * Add a serverless instance into the cluster.
 */
public addServerlessInstance(id: string, options: ServerlessInstanceOptions): IDatabaseInstance {
  return new DatabaseInstance(this, id, {
    vpc: this.props.instanceProps.vpc,
    serverlessV2InstanceType: ServerlessV2InstanceType.SERVERLESS,
    clusterIdentifier: this.clusterIdentifier,
    engine: options.engine,
  });
}
/**
 * Add a provisioned instance into the cluster.
 */
public addProvisionedInstance(id: string, options: ProvisionedInstanceOptions): IDatabaseInstance {
  return new DatabaseInstance(this, id, {
    vpc: this.props.instanceProps.vpc,
    serverlessV2InstanceType: ServerlessV2InstanceType.PROVISIONED,
    instanceType: options.instanceType,
    clusterIdentifier: this.clusterIdentifier,
    engine: options.engine,
  });
}
```


### Is this a breaking change?

> If the answer is no. Otherwise:
>
> Describe what ways did you consider to deliver this without breaking users?
>
> Make sure to include a `BREAKING CHANGE` clause under the CHANGELOG section with a description of the breaking
> changes and the migration path.

### What alternative solutions did you consider?

Another alternative is to create a new L2 construct rather than using the existing `DatabaseCluster`. Having a new L2 is great when customers are creating a new cluster with one or multiple serverless instances, however, this does not help exising clusters created by `DatabaseCluster` construct to add serverless instances.

### What are the drawbacks of this solution?

If customers are creating a provisioned cluster with serverless writer/reader only, they need to create this cluster with `instances: 0` before they can `addServerlessInstance()` from this cluster. This seems a little bit strange but the benefit is that we can use the existing `DatabaseCluster` L2 construct rather than creating a new one.

If customers has already created a cluster with provisoned instances(e.g. `instances: 2`) and planning to convert any of them from provisioned to serverless, it would be difficult to do that in CDK as the `DatabaseCluster` costruct does not allow you to do that. Customers would have to covert them from CLI/SDK/console instead.

For cluster that requires a serverless writer and one or multiple provisoned readers, customers will have to ensure the dependency as below:

```ts
declare const vpc: ec2.Vpc;
const cluster = new rds.DatabaseCluster(this, 'Database', {
  ...
  // do not create any provisioned instances with this cluster
  instances: 0,
});
const writer = cluster.addServerlessInstance('WriterInstance', {...})
const reader = cluster.addProvisionedInstance('ReaderInstance', {...})
// ensure the reader will be created after the writer
reader.node.addDependency(writer)
```

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
