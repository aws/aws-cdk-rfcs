# Batch Graduation

* **Original Author(s):**: @comcalvi
* **Tracking Issue**: #
* **API Bar Raiser**: @

This proposes a new set of L2 constructs for the aws-batch module.

[Existing (experimental) L2 API docs](https://docs.aws.amazon.com/cdk/api/v1/docs/aws-batch-readme.html)
[CloudFormation resource reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_Batch.html)

## Batch Overview

Batch has four resources:

* `ComputeEnvironment`
  * Can be `managed` or `unmanaged`
    * `managed` can use EC2 or Fargate resources
    * `unmanaged` can only use EC2 resources.
  * Can use EC2 or Fargate
    * Each of these can be regular or SPOT type.
    * EC2 can then specify EKS or ECS.
  * ImageId has been deprecated!
    * Likely in favor of EC2Configuration
    * see [API Ref](https://docs.aws.amazon.com/batch/latest/APIReference/API_ComputeResource.html)
  * Subnets work with any managed ComputeEnvironment, but you cannot use Local Zones with Fargate
* `JobDefinition`
  * Can be `multinode` or `container`
    * `container`s can be ECS or EKS
  * Can run on EC2 or Fargate resources
    * `multinode` only runs on EC2
      * does not work on spot instances!
    * `container` can use EC2 or Fargate
* `JobQueue`
  * This just uses a `ComputeEnvironment` with an order
    * Why not add the order to the `ComputeEnvironment`? `ComputeEnvironment`s can be reused across different `JobQueue`s.
* `SchedulingPolicy`
  * The only type of `SchedulingPolicy` is a `FairsharePolicy`
  * These let you define Job shares, which associate a Job with a `weightFactor`.
    The `weightFactor` is inversely correlated with the compute resources that are assigned to a particular Job

`ComputeEnvironment`s are used by `JobQueue`s to run incoming Jobs.
When a user submits a job to a `JobQueue`, the `JobQueue` chooses one of its available `ComputeEnvironment`s to run the job.
Jobs are defined by `JobDefinition`s, which are of type either `multinode` or `container`.
`multinode` jobs are only compatible with `ComputeEnvironment`s that use `managed` ec2 instances,
whereas `container` jobs are compatible with any type of `ComputeEnvironment`.

`SchedulingPolicy`s are used by `JobQueues` to decide which resources to allocate to which Jobs.

## Use Cases & Examples

### Cost Optimization

#### Spot Instances

Spot instances are significantly discounted EC2 instances that can be reclaimed at any time by AWS.
Workloads that are fault-tolerant or stateless can take advantage of spot pricing.
To use spot spot instances, set `spot` to `true` on a managed Ec2 or Fargate Compute Environment:

```ts
import * as batch from 'aws-cdk-lib/aws-batch';

new batch.FargateComputeEnvironment(this, 'myFargateComputeEnv', {
  spot: true,
});
```

Batch allows you to specify the percentage of the on-demand instance that the current spot price
must be to provision the instance using the `spotBidPercentage`.
This defaults to 100%, which is the recommended value.
This value cannot be specified for `FargateComputeEnvironment`s
and only applies to `ManagedEc2ComputeEnvironment`s.
The following code configures a Compute Environment to only use spot instances that
are at most 20% the price of the on-demand instance price:

```ts
import * as batch from 'aws-cdk-lib/aws-batch';

new batch.MangedEC2ComputeEnvironment(this, 'myEc2ComputeEnv', {
   spot: true,
   spotBidPercentage: 20,
});
```

For stateful or otherwise non-interruption-tolerant workflows, omit `spot` or set it to `false` to only provision on-demand instances.

#### Choosing Your Instance Types

Batch allows you to choose the instance types or classes that will run your workload.
This example configures your `ComputeEnvironment` to use only the `M5AD.large` instance:

```ts
new batch.ManagedEC2ComputeEnvironment(this, 'myEc2ComputeEnv', {
  instanceTypes: [ec2.InstanceType.of(ec2.InstanceClass.M5AD, ec2.InstanceSize.LARGE)],
});
```

Batch allows you to specify only the instance class and to let it choose the size, which you can do like this:

```
computeEnv.addInstanceClass(ec2.InstanceClass.M5AD);

// Or, specify it on the constructor:
new batch.ManagedEC2ComputeEnvironment(this, 'myEc2ComputeEnv', {
  instanceClasses: [ec2.InstanceClass.A1],
});
```

If you specify no instance types or classes then it will default to `InstanceType.OPTIMAL`,
which tells Batch to pick an instance from the C4, M4, and R4 instance families.
*Note*: Batch does not allow specifying instance types or classes with different architectures.
For example, `InstanceClass.A1` cannot be specified alongside `InstanceClass.OPTIMAL`,
because `A1` uses ARM and `OPTIMAL` uses x86_64.
You can specify both `InstanceType.OPTIMAL` alongside several different instance types in the same compute environment:

```ts
const computeEnv = new batch.ManagedEC2ComputeEnvironment(this, 'myEc2ComputeEnv', {
  instanceTypes: [batch.InstanceType.of(ec2.InstanceClass.M5AD, ec2.InstanceSize.LARGE)],
});

computeEnv.addInstanceType(batch.InstanceType.OPTIMAL);

// Note: this is equivalent to specifying

computeEnv.addInstanceClass(ec2.InstanceClass.C4);
computeEnv.addInstanceClass(ec2.InstanceClass.M4);
computeEnv.addInstanceClass(ec2.InstanceClass.R4);
```

#### Allocation Strategies

| Allocation Strategy     | Optimized for      | Downsides                     |
| ----------------------- | -------------      | ----------------------------- |
| BEST_FIT                | Cost               | May limit throughput          |
| BEST_FIT_PROGRESSIVE    | Throughput         | May increase cost             |
| SPOT_CAPACITY_OPTIMIZED | Least interruption | Only useful on Spot instances |

Batch provides different Allocation Strategies to help it choose which instances to provision.
If your workflow tolerates interruptions, you should enable `spot` on your `ComputeEnvironment`
and use `SPOT_CAPACITY_OPTIMIZED` (this is the default is `spot` is enabled).
This will tell Batch to choose the instance types from the ones you’ve specified that have
the most spot capacity available to minimize the chance of interruption.
This means that to get the most benefit from your spot instances,
you should allow Batch to choose from as many different instance types as possible.

If your workflow does not tolerate interruptions and you want to minimize your costs,
use `AllocationStrategy.BEST_FIT`.
This will choose the lowest-cost instance type that fits all the jobs in the queue.
If instances of that type are not available,
the queue will not choose a new type; instead, it will wait for the instance to become available.
This can stall your `Queue`, with your compute environment only using part of its max capacity
(or none at all) until the `BEST_FIT` instance becomes available.

If you are running a workflow that does not tolerate interruptions and you want to maximize throughput,
you can use `AllocationStrategy.BEST_FIT_PROGRESSIVE`.
This is the default Allocation Strategy if `spot` is `false` or unspecified.
This strategy will examine the Jobs in the queue and choose whichever instance type meets the requirements
of the jobs in the queue and with the lowest cost per vCPU, just as `BEST_FIT`.
However, if not all of the capacity can be filled with this instance type,
it will choose a new next-best instance type to run any jobs that couldn’t fit into the `BEST_FIT` capacity.
To make the most use of this allocation strategy,
it is recommended to use as many instance classes as is feasible for your workload.
This example shows a `ComputeEnvironment` that uses `BEST_FIT_PROGRESSIVE`
with `InstanceType.OPTIMAL` and `InstanceClass.M5` instance types:

```ts
const computeEnv = new batch.ManagedEC2ComputeEnvironment(this, 'myEc2ComputeEnv', {
  instanceTypes: [batch.InstanceType.OPTIMAL],
  instanceClasses: [ec2.InstanceClass.M5],
});
```

This example shows a `ComputeEnvironment` that uses `BEST_FIT` with `InstanceType.OPTIMAL` instances:

```ts
const computeEnv = new batch.ManagedEC2ComputeEnvironment(this, 'myEc2ComputeEnv', {
  allocationStrategy: AllocationStrategy.BEST_FIT,
});
```

*Note*: `allocationStrategy` cannot be specified on Fargate Compute Environments.

### Controlling vCPU allocation

With a managed `ComputeEnvironment`, you can specify the maximum and minimum vCPUs it can have at any given time.
You cannot do this with an unmanaged `ComputeEnvironment`, because you must provision and manage the instances yourself;
that is, Batch will not scale them up and down as needed. This example shows how to configure these properties:

```ts
new batch.ManagedEC2ComputeEnvironment(this, 'myEc2ComputeEnv', {
  instanceClasses: [ec2.InstanceClass.A1],
  minvCpus: 10,
  maxvCpus: 100,
});
```

This means that the `ComputeEnvironment` will always maintain 10 vCPUs worth of instances,
even if there are no Jobs in the queues that link to this `ComputeEnvironment`.

### Sharing a ComputeEnvironment between multiple JobQueues

Multiple `JobQueue`s can share the same `ComputeEnvironment`.
If multiple Queues are attempting to submit Jobs to the same `ComputeEnvironment`,
Batch will pick the Job from the Queue with the highest priority.
This example creates two `JobQueue`s that share a `ComputeEnvironment`:

```ts
const sharedComputeEnv = new batch.FargateComputeEnvironment(this, 'spotEnv', {
  spot: true,
});

const lowPriorityQueue = new batch.JobQueue(this, 'JobQueue', {
   priority: 1,
});

const highPriorityQueue = new batch.JobQueue(this, 'JobQueue', {
   priority: 10,
});

lowPriorityQueue.addComputeEnvironment(sharedComputeEnv, 1);
highPriorityQueue.addComputeEnvironment(sharedComputeEnv, 1);
```

### Fairshare Scheduling

Batch `JobQueue`s execute Jobs submitted to them in FIFO order unless you specify a `SchedulingPolicy`.
FIFO queuing can cause short-running jobs to be starved while long-running jobs fill the compute environment.
To solve this, Jobs can be associated with a share.

Shares consist of a `shareIdentifier` and a `weightFactor`, which is inversely correlated with the vCPU allocated to that share identifier.
When submitting a Job, you can specify it's `shareIdentifier` to associate that particular job with that share.
Let's see how the scheduler uses this information to schedule jobs.

For example, if there are two shares defined as follows:

| Share Identifier | Weight Factor |
| ---------------- | ------------- |
| A                | 1             |
| B                | 1             |

The weight factors share the following relationship:

```
BvCpus / 1 = AvCpus / 1
```

where `BvCpus` is the number of vCPUs allocated to jobs with share identifier `'B'`.
We need to find `B_vCpus` and `A_vCpus`. We can multiply both sides of the above equation by `1` to get:

```
BvCpus = AvCpus
```

We don't know what `BvCpus` is, but we know that each `'B'` job needs 64 vCpus. We also know that each `'A'` job needs 32 vCpus.
So let's define a two new values, `AJobRequirement` and `BJobRequirement`, set to 32 and 64, respectively. Now we have:

```
BvCpus = BJobRequirement * numBJobs
AvCpus = AJobRequirement * numAJobs
```

where `numBJobs` is the number of jobs with share identifier `'B'` that will be scheduled and
`numAJobs` is the number of jobs with share identifier `'A'` that will be scheduled.

With these new definitions we can write our equality as:

```
BvCpus = AvCpus =>
BJobRequirement * numBJobs = AJobRequirement * numAJobs
64 * numBJobs = 32 * numAJobs =>
2 * numBJobs = numAJobs =>
numAJobs = 2 * numBJobs
```

This means that the scheduler will schedule two `'A'` jobs for each `'B'` job.

You can control the weight factors to change these ratios, but note that
weight factors are inversely correlated with the vCpus allocated to the corresponding share.
This example illustrates the impact this has on scheduling:

| Share Identifier | Weight Factor |
| ---------------- | ------------- |
| A                | 0.5           |
| B                | 1             |

The weight factors share the following relationship:

```
BvCpus / 1 = AvCpus / 0.5 =>
2 * BvCpus = AvCpus
```

Following similar algebra as above:

```
2 * BvCpus = AvCpus =>
2 * BJobRequirement * numBJobs = AJobRequirement * numAJobs =>
2 * 64 * numBJobs = 32 * numAJobs =>
128 * numBJobs = 32 * numAJobs =>
4 * numBJobs = numAJobs =>
numAJobs = 4 * numBJobs
```

This means that for each `'B'` job, the scheduler will schedule four (4) `'A'` jobs.

If the `weightFactor`s were reversed instead:

| Share Identifier | Weight Factor |
| ---------------- | ------------- |
| A                | 1             |
| B                | 0.5           |

The weight factors share the following relationship:

```
BvCpus / 0.5 = AvCpus / 1 =>
BvCpus = 2 * AvCpus
```

Following similar algebra as above:

```
BvCpus = 2 * AvCpus =>
BJobRequirement * numBJobs = 2 * AJobRequirement * numAJobs =>
64 * numBJobs = 2 * 32 * numAJobs =>
64 * numBJobs = 64 * numAJobs =>
numBJobs = numAJobs
```

This means that for each `'B'` job, the scheduler will schedule one (1) `'A'` job.

The second example would be configured like this:

```ts
const fairsharePolicy = new FairshareSchedulingPolicy(this, 'myFairsharePolicy');

fairsharePolicy.addShare({
  shareIdentifier: 'A',
  weightFactor: 1,
});

fairsharePolicy.addShare({
  shareIdentifier: 'B',
  weightFactor: 0.5,
});

new batch.JobQueue(this, 'JobQueue', {
  priority: 1,
  fairsharePolicy,
});
```

Note: The scheduler will only consider the current usage of the compute environment unless you specify `shareDecay`.
For example, a `shareDecay` of 5 minutes in the above example means that at any given point in time, twice as many `'A'` jobs
will be scheduled for each `'B'` job, but only for the past 5 minutes. If `'B'` jobs run longer than 5 minutes, then
the scheduler is allowed to put more than two `'A'` jobs for each `'B'` job, because the usage of those long-running
`'B'` jobs will no longer be considered after 5 minutes. `shareDecay` linearly decreases the usage of
long running jobs for calculation purposes. eg if share decay is 60 seconds,
then jobs that run for 30 seconds have their usage considered to be only 50% of what it actually is,
but after a whole minute the scheduler pretends they don't exist for fairness calculations.

The following code specifies a `shareDecay` of 5 minutes:

```ts
const fairsharePolicy = new FairshareSchedulingPolicy(this, 'myFairsharePolicy', {
   shareDecay: Duration.minutes(5),
});
```

If you have high priority jobs that should always be executed as soon as they arrive,
you can define a `computeReservation` to specify the percentage of the
maximum vCPU capacity that should be reserved for shares that are *not in the queue*.
The actual reserved percentage is defined by Batch as:

```
 (computeReservation/100)^ActiveFairShares
```

where `ActiveFairShares` is the number of shares for which there exists
at least one job in the queue with a unique share identifier.

This is best illustrated with an example.
Suppose there three shares with share identifiers `A`, `B` and `C` respectively
and we specify the `computeReservation` to be 75%. The queue is currently empty,
and no other shares exist.

There are no active fair shares, since the queue is empty.
Thus (75/100)^0 = 1 = 100% of the maximum vCpus are reserved for all shares.

A job with identifier `A` enters the queue.

The number of active fair shares is now 1, hence
(75/100)^1 = .75 = 75% of the maximum vCpus are reserved for all shares that do not have the identifier `A`;
for this example, this is `B` and `C`,
(but if jobs are submitted with a share identifier not covered by this fairshare policy, those would be considered just as `B` and `C` are).

Now a `B` job enters the queue. The number of active fair shares is now 2,
so (75/100)^2 = .5625 = 56.25% of the maximum vCpus are reserved for all shares that do not have the identifier `A` or `B`.

Now a second `A` job enters the queue. The number of active fair shares is still 2,
so the percentage reserved is still 56.25%

Now a `C` job enters the queue. The number of active fair shares is now 3,
so (75/100)^3 = .421875 = 42.1875% of the maximum vCpus are reserved for all shares that do not have the identifier `A`, `B`, or `C`.

If these are no other shares that your jobs can specify, this means that 42.1875% of your capacity will never be used!

Now, `A`, `B`, and `C` can only consume 100% - 42.1875% = 57.8125% of the maximum vCpus.
Note that the this percentage is **not** split between `A`, `B`, and `C`.
Instead, the scheduler will use their `weightFactor`s to decide which jobs to schedule;
the only difference is that instead of competing for 100% of the max capacity, jobs compete for 57.8125% of the max capacity.

This example specifies a `computeReservation` of 75% that will behave as explained in the example above:

```ts
const fairsharePolicy = new FairshareSchedulingPolicy(this, 'myFairsharePolicy', {
  computeReservation: 75,
  shares: [
    { id: 'A' },
    { id: 'B' },
    { id: 'C' },
  ],
});
```

You can specify a `priority` on your `JobDefinition`s to tell the scheduler to prioritize certain jobs that share the same share identifier.

### Configuring Job Retry Policies

Certain workflows may result in Jobs failing due to intermittent issues.
Jobs can specify retry policies to respond to different failures with different actions.
There are three different ways information about the way a Job exited can be conveyed;

* `exitCode`: the exit code returned from the process executed by the container. Will only match non-zero exit codes.
* `reason`: any middleware errors, like your Docker registry being down.
* `statusReason`: infrastructure errors, most commonly your spot instance being reclaimed.

For most use cases, only one of these will be associated with a particular action at a time.
To specify common `exitCode`s, `reason`s, or `statusReason`s, use the corresponding value from
the `Reason` class. This example shows some common failure reasons:

```ts
const jobDefn = new batch.EcsJobDefinition(this, 'JobDefn', {
   containerDefinition: new batch.ContainerDefinition(this, 'containerDefn', {
    image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest'),
    memoryLimitMiB: 2048,
    compatibility: Compatibility.EC2, // specify FARGATE for Fargate workflows
  }),
  attempts: 5,
  retryStrategies: [{
    action: Action.EXIT,
    reason: Reason.NON_ZERO_EXIT_CODE,
  }],
});

jobDefn.addRetryStrategy({
  action: Action.RETRY,
  reason: Reason.SPOT_INSTANCE_RECLAIMED,
});

jobDefn.addRetryStrategy({
   action: Action.EXIT,
   reason: Reason.CANNOT_PULL_CONTAINER,
});

jobDefn.addRetryStrategy({
  action: Action.RETRY,
  reason: Reason.custom({
    onExitCode: '40*',
    onReason: 'some reason',
  }),
});
```

When specifying a custom reason,
you can specify a glob string to match each of these and react to different failures accordingly.
Up to five different retry strategies can be configured for each Job,
and each strategy can match against some or all of `exitCode`, `reason`, and `statusReason`.
You can optionally configure the number of times a job will be retried,
but you cannot configure different retry counts for different strategies; they all share the same count.
If multiple conditions are specified in a given retry strategy,
they must all match for the action to be taken; the conditions are ANDed together, not ORed.

### Running single-container ECS workflows

Batch can jobs on ECS or EKS. ECS jobs can defined as single container or multinode.
This examples creates a `JobDefinition` that runs a single container with ECS:

```ts
const jobDefn = new batch.EcsJobDefinition(this, 'JobDefn', {
  containerDefinition: new batch.ContainerDefinition(this, 'containerDefn', {
    image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest'),
    memoryLimitMiB: 2048,
    compatibility: Compatibility.EC2, // specify FARGATE for Fargate workflows
  }),
});
```

For workflows that need persistent storage, batch supports mounting `Volume`s to the container.
You can both provision the volume and mount it to the container in a single operation:

```ts
jobDefn.addVolume({
  name: 'myVolume',
  efsVolumeConfiguration: {
    fileSystem: myFileSystem
  },
  containerPath: '/Volumes/myVolume',
});
```

### Running Kubernetes Workflows

Batch also supports running workflows on EKS. The following example creates a `JobDefinition` that runs on EKS:

```ts
const eksContainer = new batch.EksContainerDefinition(this, 'myEksContainer', {
   image: ContainerImage.fromRegistry('my-registry/my-image:latest'),
});

const eksPod = new batch.EksPod(this, 'myEksPod', {
   containers: [eksContainer],
});

new batch.EksJobDefinition(this, 'myEksJobDefn', {
   pod: eksPod,
});

// alternative using convienience methods:
const pod = new batch.EksPod(this, 'myEksPod');
const jobDefn = new batch.EksJobDefinition(this, 'myEksJobDefn', {
  pod,
});

jobDefn.addContainer('myEksContainer', { // adds to the Pod
  image: ecs.ContainerImage.fromRegistry('my-registry/my-image:latest'),
});
```

You can mount `Volume`s to these containers in a single operation:

```ts
jobDefn.addEmptyDirVolume({
  name: 'emptyDir',
  mountPath: '/Volumes/emptyDir',
});
jobDefn.addHostPathVolume({
  name: 'hostPath',
  hostPath: '/sys',
  mountPath: '/Volumes/hostPath',
});
jobDefn.addSecretVolume({
  name: 'secret',
  optional: true,
  mountPath: '/Volumes/secret',
});
```

### Running Distributed Workflows

Some workflows benefit from parallellization and are most powerful when run in a distributed environment,
such as certain numerical calculations or simulations. Batch offers `MultiNodeJobDefinition`s,
which allow a single job to run on multiple instances in parallel, for this purpose.
Message Passing Interface (MPI) is often used with these workflows.
You must configure your containers to use MPI properly,
but Batch allows different nodes running different containers to communicate easily with one another.
You must configure your containers to use certain environment variables that Batch will provide them,
which lets them know which one is the main node, among other information.
For an in-depth example on using MPI to perform numerical computations on Batch,
see this [blog post](https://aws.amazon.com/blogs/compute/building-a-tightly-coupled-molecular-dynamics-workflow-with-multi-node-parallel-jobs-in-aws-batch/)
In particular, the environment variable that tells the containers which one is the main node can be configured on your `MultiNodeJobDefinition` as follows:

```ts
const multiNodeJob = new batch.MultiNodeJobDefinition(this, 'JobDefinition', {
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.A1, ec2.InstanceSize.LARGE),
  containers: [
    new MultiNodeContainer(this, 'mainMPIContainer', {
      startNode: 0,
      endNode: 5,
      image: ecs.ContainerImage.fromRegistry('yourregsitry.com/yourMPIImage:latest'),
      memoryLimitMiB: 2048,
    }),
  ],
});

// convenience method
multiNodeJob.addContainer(this, 'secondContanerType', {
  startNode: 6,
  endNode: 10,
  image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest'),
  memoryLimitMiB: 2048,
});
```

If you need to set the control node to an index other than 0, specify it in directly:

```ts
const multiNodeJob = new batch.MultiNodeJobDefinition(this, 'JobDefinition', {
  mainNode: 5,
});
```

### Pass Parameters to a Job

Batch allows you define parameters in your `JobDefinition`, which can be referenced in the container command. For example:

```
new batch.EcsJobDefinition(this, 'JobDefn', {
  parameters: { echoParam: 'foobar' },
  containerDefinition: new batch.ContainerDefinition(this, 'containerDefn', {
    image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest'),
    memoryLimitMiB: 2048,
    compatibility: Compatibility.EC2,
    command: [
      'echo',
      'Ref::echoParam',
    ],
  }),
});
```

## API

* `ManagedEc2ComputeEnvironment`
  * Requires an L2 for `CfnPlacementGroup` in aws-ec2
  * Or, we could use a `placementGroupArn` instead, but that’s sub-par
* `UnmanagedEc2ComputeEnvironment`
* `FargateComputeEnvironment`
* `MultinodeJobDefinition`
* `ContainerJobDefinition`
* `JobQueue`
* `SchedulingPolicy`

```ts
new ManagedEc2ComputeEnvironment(this, 'myEc2Env', {
  images: [BatchMachineImage.of(ec2MachineImage, BatchImageType.ECS)], // required
  name: 'specifiedName', // optional, defaults to CFN generated name
  replaceComputeEnvironment: false, //optional, defaults to false
  spot: true, // optional, defaults to false
  enabled: true, // optional, defaults to true
  updateTimeout: cdk.Duration.minutes(30), // optional, defaults to 30 (CFN default)
  terimnateOnUpdate: false, // optional, defaults to false (CFN default)
  allocationStrategy: batch.AllocationStrategy.SPOT_CAPACITY_OPTIMIZED, // optional (not spot exclusive)
  spotBidPercentage: 20, // optional (Spot exclusive)
  desiredvCpus: 3, // optional: default???
  instanceTypes: [ec2.InstanceType.of(ec2.InstanceClass.M5AD, ec2.InstanceSize.LARGE)], // optional, defaults to ['Instance.OPTIMAL']
  instanceRole: myRole, // optional, creates it if not supplied
  serviceRole: myServiceRole, // optional, defaults to undefined (batch recommended default)
  launchTemplate: myLaunchTemplate // optional, defaults to undefined
  maxvCpus: 5, // optional, defaults to 256
  minvCpus: 1, // optional, defaults to 0 (required on ec2 envs, even though the docs say it's optional)
  placementGroup: myPlacementGroup, // optional: defaults to no placementgroup
  securityGroups: [mySecurityGroup1, mySecurityGroup2], // optional, defaults to newly created
  vpcSubnets: myEc2SubnetSelection, // optional: defaults to newly created
  updateToLatestImageVersion: true // optional, defaults to true
  eksClusterNamespace: batch.clusterNamespace.from(cluster, 'namespace');
});

new UnmanagedEc2ComputeEnvironment(this, 'myEc2Env', {
  name: 'specifiedName', // optional, defaults to CFN generated name
  replaceComputeEnvironment: false, //optional, defaults to false
  enabled: true, // optional, defaults to true
  updateTimeout: cdk.Duration.minutes(30), // optional, defaults to 30 (CFN default)
  terimnateOnUpdate: false, // optional, defaults to false (CFN default)
  serviceRole: myServiceRole, // optional, creates it if not supplied (batch recommended default)
  updateToLatestImageVersion: true // optional, defaults to true
  unmanagedvCpus: undefined // TODO: asked service team why ComputeResources can be specified on UNMANAGED env
  eksClusterNamespace: batch.clusterNamespace.from(cluster, 'namespace');
});

new FargateComputeEnvironment(this, 'myFargateEnv', {
  name: 'specifiedName', // optional, defaults to CFN generated name
  replaceComputeEnvironment: false, //optional, defaults to false
  enabled: true, // optional, defaults to true
  spot: true, // optional, defaults to false
  updateTimeout: cdk.Duration.minutes(30), // optional, defaults to 30 (CFN default)
  terimnateOnUpdate: false, // optional, defaults to false (CFN default)
  serviceRole: myServiceRole, // optional, defaults to undefined (batch recommended default)
  maxvCpus: 10, // optional, defaults to 256
  securityGroups: [mySecurityGroup1, mySecurityGroup2], // optional, defaults to newly created
  vpcSubnets: myEc2SubnetSelection, // optional: defaults to newly created
  updateToLatestImageVersion: false, // optional, defaults to false (CFN default)
  eksClusterNamespce: batch.clusterNamespace.from(cluster, 'namespace');
});

new EcsJobDefinition(this, 'myContainerJob', {
  taskDefinition: myEcsTaskDefinition, // required
  name: 'myJob', // optional, defaults to CFN generated name
  parameters: { foo: 'bar' }, // optional, defaults to none
  // platform: batch.Platform.EC2_AND_FARGATE, // optional, defaults to EC2 (CFN default)
  fargatePlatformVersion: batch.FargatePlatformVersion.LATEST, // optional, defaults to LATEST
  propogateTags: true, // optional, defaults to false (CFN default)
  retryAttempts: 5, // optional, defaults to 1
  retryStrategy: [new RetryStrategy({// optional, defaults to none
    action: batch.Action.RETRY, // ACTION, required
    onExitCode: '40*', // optional, defaults to none (onExitCode)
    onReason: 'error: *', // optional, defaults to none (onReason)
    onStatusReason: 'reason: *', // optional, defaults to none (onStatusReason)
  })],
  schedulingPriority: 4, // optional, defaults to none
  timeout: cdk.Duration.seconds(10),
  jobRole: myRole, // optional, defaults to none
});

new EksJobDefinition(this, 'myEksJob', {
  name: 'myJob', // optional, defaults to CFN generated name
  parameters: { foo: 'bar' }, // optional, defaults to none
  platform: batch.Platform.EC2_AND_FARGATE, // optional, defaults to EC2 (CFN default)
  propogateTags: true, // optional, defaults to false (CFN default)
  retryAttempts: 5, // optional, defaults to 1
  retryStrategy: new RetryStrategy({// optional, defaults to none
    action: Action.RETRY, // ACTION, required
    onExitCode: '40*', // optional, defaults to none (onExitCode)
    onReason: 'error: *', // optional, defaults to none (onReason)
    onStatusReason: 'reason: *', // optional, defaults to none (onStatusReason)
  }),
  schedulingPriority: 4, // optional, defaults to none
  timeout: cdk.Duration.seconds(10), // optional, defaults to none
  pod: new batch.EksPod(this, 'myEksPod', { // required
    containers: [
      new batch.EksContainerDefinition(this, 'myEksContainer', {
        image: ecs.ContainerImage.fromRegistry('my-registry/my-image:latest'),
        volumes: [new batch.EmptyDirVolume()], // optional, automatically adds to the pod
      });
    ],
  });
});

new MultiNodeJobDefinition(this, 'myMultiNodeJob', {
  mainNode: 0, // required
  containers: [ // optional
    new MultiNodeContainer(
      startNode: 0,
      endNode: 5,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.A1, ec2.InstanceSize.LARGE), // required,
      TaskDefinition: new ecs.TaskDefinition(this, 'ECSTask', {
        compatibility: ecs.Compatibility.EC2,
      }).addContainer('myContainer', {
        image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest'),
        memoryLimitMiB: 2048,
      }),
    ),
  ],
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.A1, ec2.InstanceSize.LARGE), // required,
  name: 'myJob', // optional, defaults to CFN generated name
  parameters: { foo: 'bar' }, // optional, defaults to none
  propogateTags: true, // optional, defaults to false (CFN default)
  retryAttempts: 5, // optional, defaults to 1
  retryStrategy: new RetryStrategy({// optional, defaults to none
    action: Action.RETRY, // ACTION, required
    onExitCode: '40*', // optional, defaults to none (onExitCode)
    onReason: 'error: *', // optional, defaults to none (onReason)
    onStatusReason: 'reason: *', // optional, defaults to none (onStatusReason)
  }),
  schedulingPriority: 4, // optional, defaults to none
  timeout: cdk.Duration.seconds(10), // optional, defaults to none
});

new JobQueue(this, 'myJobQueue', {
  orderedComputeEnvironment: OrderedComputeEnvironment.of(myComputeEnv, 10), // required
  priority: 10, // required
  name: 'myJobQueueName', // optional, defaults to CFN generated name
  enabled: true, // optional, defaults to true
  schedulingPolicy: mySchedulingPolicy, // optional, defaults to none
});

new FairshareSchedulingPolicy(this, 'mySchedulingPolicy', {
  computeReservation: 20, // optional, defaults to none
  shareDecaySeconds: 20, // optional, defaults to none
  shares: [{ // optional, defaults to none
    shareIdentifier: 'foo', // optional, defaults to none
    weightFactor: 5, // optional, defaults to none
  }],
  name: 'myPolicyName', // optional, defaults to generated by CFN
});
```

```ts
// public ec2 members
export class PlacementGroup {
   // TODO
}

export class IMachineImage {
   // ...
   keyPairName: string,
}

// public batch members
// ComputeEnvironment
export interface IBatchMachineImage {
   image: ec2.IMachineImage;
  imageType: BatchMachineImageType;
  imageKubernetesVersion?: string;
}

export enum BatchMachineImageType {
   ECS_AL2 = 'ECS_AL2',
  ECS_AL2_NVIDIA = 'ECS_AL2_NVIDIA',
  EKS_AL2 = 'EKS_AL2',
  EKS_AL2_NVIDIA = 'EKS_AL2_NVIDIA',
}

export enum AllocationStrategy {
  BEST_FIT = 'BEST_FIT',
  BEST_FIT_PROGRESSIVE = 'BEST_FIT_PROGRESSIVE',
  SPOT_CAPACITY_OPTIMIZED = 'SPOT_CAPACITY_OPTIMIZED',
}

// JobDefinition
enum Compatibility {
   EC2 = ['EC2'],
  FARGATE = ['FARGATE'],
  EC2_AND_FARGATE = ['EC2', 'FARGATE'],
}

interface RetryStrategy {
   readonly retry: boolean;
  readonly onExitCode?: string;
  readonly onReason?: string;
  readonly onStatusReason?: string;
}

enum ImagePullPolicy {
  ALWAYS = 'Always';
  IF_NOT_PRESENT = 'IfNotPresent';
  NEVER = 'Never';
}

// private stuff
enum Ec2ComputeEnvironmentType {
   ON_DEMAND = 'EC2',
  SPOT = 'SPOT',
}

enum FargateComputeEnvironmentType {
  ON_DEMAND = 'FARGATE',
  SPOT = 'FARGATE_SPOT',
}
```

### Migration Plan

Removing all of the existing L2 constructs and forcing people to migrate to the new construct is not a great customer experience.
We should deprecate the existing construct,
move it to a different repository but still publish it under the same name, and leave it there until the new API is stable.
I propose we leave the new API as experimental until Q3 and graduate it then.

### Differences Between the Existing API and this Proposal

Existing API consists of:

* `JobDefinition`
  * It only supports the ECS variant, as the only required property it has it mapped directly to `ContainerProperties`.
    Specifying `ContainerProperties` prevents you from specifying `EksProperties` or `NodeRangeProperties`,
    meaning the existing construct does not support either of these (even with escape hatches).
* `ComputeEnvironment`
  * No distinction in type between EC2 and Fargate. The result is this massive amount of
    [runtime error checking](https://github.com/aws/aws-cdk/blob/main/packages/%40aws-cdk/aws-batch/lib/compute-environment.ts#L487-538) for Fargate
  * All of that runtime error checking could be removed with an EC2 type and a Fargate type.
* `JobQueue`
  * No support for `FairshareSchedulingPolicy`, so they can’t be added to a `JobQueue` easily.

Existing API does not have `FairsharechedulingPolicys`.

## Public FAQ

### What are we launching today?

We are launching a new set of L2 constructs for Batch (`aws-cdk-lib/aws-batch`).
These new constructs will fully support Batch within the CDK.

### Why should I use this feature?

Efficiently run your batch computing jobs without managing servers.
Use cases include machine learning and high-performance computing.
CDK provides seamless integrations with your existing infrastructure
and simplifies configuration of your resources.

## Internal FAQ

### Why are we doing this?

We are graduating alpha modules to build trust with our customers.
Batch is a highly-requested module for stabilization, but the existing experimental
constructs do not cover many of the use cases that batch supports and extending them
will result in a subpar customer experience.

### Why should we *not* do this?

Our existing alpha module has customers today. This new API will be substantially
different, which will require them to understand the new API to migrate.

### What is the technical solution (design) of this feature?

#### Compute Environment

* `IComputeEnvironment` and `ComputeEnvironmentBase` -- abstract base class and interface

```ts
interface IComputeEnvironment extends cdk.IResource, iam.Grantable, cdk.ITaggable {
  readonly name?: string;
  readonly serviceRole?: iam.IRole;
  readonly enabled?: boolean;
  readonly maxvCpus?: number; //note: becomes unmanageVCPUs on unmanaged, maxvCPUs on managed

  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
}

interface ComputeEnvironmentProps {
  readonly name?: string;
  readonly serviceRole?: iam.IRole;
  readonly enabled?: boolean;
  readonly maxvCpus?: number; //note: becomes unmanagedvCPUs on unmanaged, maxvCPUs on managed
}

abstract class ComputeEnvironmentBase implements IComputeEnvironment {
  constructor(readonly props: ComputeEnvironmentProps = {}) {}
}
```

* `IUnmanagedComputeEnvironment` and `UnmanagedComputeEnvironmentBase` -- interface to define and deploy Batch Unmanaged Compute Environments

```ts
interface IUnmanagedComputeEnvironment extends IComputeEnvironment {}

interface UnmanagedComputeEnvironmentProps extends ComputeEnvironmentProps {}

abstract class UnmanagedComputeEnvironmentBase extends ComputeEnvironmentBase implements IUnmanagedComputeEnvironment {
  constructor(readonly props: UnmanagedComputeEnvironmentProps = {}) {}
}
```

* `IUnmanagedEc2ComputeEnvironment` -- interface to define and deploy Batch Unmanaged Compute Environments (can only use ec2)

```ts
interface IUnmanagedEc2ComputeEnvironment extends IUnmanagedComputeEnvironment {}

interface UnmanagedEc2ComputeEnvironmentProps extends UnmanagedComputeEnvironmentProps {}

abstract class UnmanagedEc2ComputeEnvironmentBase extends UnmanagedComputeEnvironmentBase implements IUnmanagedEc2ComputeEnvironment {
  constructor(readonly props: UnmanagedEc2ComputeEnvironmentProps = {}) {}
}
```

* `IManagedComputeEnvironment` -- interface to define and deploy Batch Managed Compute Environments

```ts
interface IManagedComputeEnvironment extends IComputeEnvironment {
  readonly replaceComputeEnvironment?: boolean;
  readonly updateTimeout?: Duration;
  readonly terimnateOnUpdate?: boolean;
  readonly securityGroups?: ec2.ISecurityGroup[];
  readonly subnets?: ec2.ISubnet[];
  readonly updateToLatestImageVersion?: boolean;
}

interface ManagedComputeEnvironmentProps extends ComputeEnvironmentProps {
  readonly replaceComputeEnvironment?: boolean;
  readonly updateTimeout?: Duration;
  readonly terimnateOnUpdate?: boolean;
  readonly securityGroups?: ec2.ISecurityGroup[];
  readonly subnets?: ec2.ISubnet[];
  readonly updateToLatestImageVersion?: boolean;
}

abstract class ManagedComputeEnvironmentBase extends ComputeEnvironmentBase implements IManagedComputeEnvironment {
  constructor(readonly props: ManagedComputeEnvironmentProps = {}) {}
}
```

* `IManagedEc2ComputeEnvironment` -- interface to define and deploy Batch Managed Compute Environments

```ts
interface IManagedEc2ComputeEnvironment extends IManagedComputeEnvironment {
  readonly images?: IBatchMachineImage[];
  readonly allocationStrategy?: AllocationStrategy;
  readonly spotBidPercentage?: number;
  readonly spot?: boolean;
  readonly desiredvCpus?: number;
  readonly instanceTypes?: InstanceType[];
  readonly instanceRole?: iam.IRole;
  readonly launchTemplate?: ec2.ILaunchTemplate;
  readonly minvCpus?: number;
  readonly placementGroup?: ec2.IPlacementGroup;
}

interface IBatchMachineImage {
  image: ec2.IMachineImage;
  imageType: BatchMachineImageType;
  imageKubernetesVersion?: string;
}

enum BatchMachineImageType {
  ECS_AL2 = 'ECS_AL2',
  ECS_AL2_NVIDIA = 'ECS_AL2_NVIDIA',
  EKS_AL2 = 'EKS_AL2',
  EKS_AL2_NVIDIA = 'EKS_AL2_NVIDIA',
}

enum InstanceType extends ec2.InstanceType {
  OPTIMAL = 'optimal',
}

enum AllocationStrategy {
  BEST_FIT = 'BEST_FIT',
  BEST_FIT_PROGRESSIVE = 'BEST_FIT_PROGRESSIVE',
  SPOT_CAPACITY_OPTIMIZED = 'SPOT_CAPACITY_OPTIMIZED',
}

interface ManagedEc2ComputeEnvironmentProps extends ComputeEnvironmentProps {
  readonly images?: IBatchMachineImage[];
  readonly allocationStrategy?: AllocationStrategy;
  readonly spotBidPercentage?: number;
  readonly spot?: boolean;
  readonly desiredvCpus?: number;
  readonly instanceTypes?: InstanceType[];
  readonly instanceClasses?: ec2.InstanceClass[];
  readonly instanceRole?: iam.IRole;
  readonly launchTemplate?: ec2.ILaunchTemplate;
  readonly minvCpus?: number;
  readonly placementGroup?: ec2.IPlacementGroup;
}

class ManagedEc2ComputeEnvironment extends ManagedComputeEnvironmentBase implements IManagedEc2ComputeEnvironment {
  constructor(readonly props: ManagedEc2ComputeEnvironmentProps = {}) {}
  public addInstanceType() {}
  public addInstanceClass() {}
}
```

* `IEksComputeEnvironment` -- interface to define and deploy Batch EKS Compute Environments

```ts
interface IEksComputeEnvironment extends IManagedEc2ComputeEnvironment {
  readonly eksCluster: eks.ICluster,
  readonly kubernetesNamespace: string,
}

interface EksComputeEnvironmentProps extends ManagedEc2ComputeEnvironmentProps {}

class EksComputeEnvironment extends ManagedEc2ComputeEnvironment implements IEksComputeEnvironment {
  constructor(readonly props: EksComputeEnvironmentProps = {}) {}
}
```

* `IFargateComputeEnvironment` -- interface to define and deploy Batch Managed Fargate Compute Environments

```ts
interface IFargateComputeEnvironment extends IManagedComputeEnvironment {}

interface FargateComputeEnvironmentProps extends ComputeEnvironmentProps {}

class FargateComputeEnvironment extends ManagedComputeEnvironmentBase implements IFargateComputeEnvironment {
  constructor(readonly props: FargateComputeEnvironmentProps = {}) {}
}
```

#### JobDefinition

* `IJobDefinition`

```ts
interface IJobDefinition extends cdk.IResource, iam.Grantable, cdk.ITaggable {
  name?: string;
  parameters?: { [key:string]: any };
  propogateTags?: boolean;
  retryAttempts?: number;
  retryStrategies?: RetryStrategy[];
  schedulingPriority?: number;
  timeout?: Duration;

  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
}

interface JobDefinitionProps {
  name?: string;
  parameters?: { [key:string]: any };
  propogateTags?: boolean;
  retryAttempts?: number;
  retryStrategies?: RetryStrategy[];
  schedulingPriority?: number;
  timeout?: Duration;
}

class RetryStrategy {
  public readonly action: Action;
  public readonly onExitCode: string;
  public readonly onStatusReason: string;
  public readonly onReason: string;

  constructor(action: Action, onExitCode: string, onStatusReason: string, onReason: string) {}
  addRetryStrategy() {}
}

enum Action {
  EXIT = 'EXIT';
  RETRY = 'RETRY';
}

abstract class JobDefinitionBase implements IJobDefinition {
  constructor(readonly props: JobDefinitionProps = {}) {}
}
```

* `IEcsJobDefinition`

```ts
interface IEcsJobDefinition extends IJobDefinition {
  containerDefinition: EcsContainerDefinition
  fargatePlatformVersion?: FargatePlatformVersion
  compatibility?: Compatibility
}

class EcsContainerDefinition {
  command?: string
  environments?: Array<{ [key:string]: string }>
  executionRoleArn?: iam.IRole
  fargateVersion?: FargateVersion
  image: ContainerImage
  jobRoleArn?: iam.IRole
  linuxParameters?: LinuxParameters
  logDriver?: LogDriver
  disableNetworking?: boolean
  priveleged?: boolean
  readonlyRootFileSystem?: boolean
  cpu: number
  gpuCount?: number
  secrets?: { [key: string]: Secret }
  user?: string

  addUlimit(...Ulimit[])
  addVolume(...EcsVolume[])
  addMountedVolume(..MountedEcsVolume[])
}

enum FargateVersion {
// TODO

}

interface Ulimit {
  hardLimit: number;
  name: UlimitName;
  softLimit: number;
}

enum UlimitName {
  //TODO
}

interface MountedEcsVolume {
  name: string;
  efsVolumeConfiguration?: EfsVolumeConfiguration;
  host?: string;
  containerPath: string;
  readOnly: boolean;
}

interface EfsVolumeConfiguration {
  fileSystemId: string;
  rootDirectory?: string;
  transitEncryption?: string;
  transitEncryptionPort?: number;
  authorizationConfig?: AuthorizationConfig;
}

interface AuthorizationConfig {
  accessPointId?: string;
  iam?: string;
}

interface EcsJobDefinitionProps {
  containerDefinition: EcsContainerDefinition
  fargatePlatformVersion?: FargatePlatformVersion
  compatibility?: Compatibility
}

class EcsJobDefinition implements IEcsJobDefinition {
  constructor(readonly props: EcsJobDefinitionProps = {}) {}
}
```

* `IEksJobDefinition`

```ts
interface IEksJobDefinition extends IJobDefinition {
  pod: batch.IEksPod;
  platform?: Platform;
}

enum Platform {
  // TODO
}

class EksPod {
  containers: batch.EksContainerDefinition[]
  dnsPolicy?: DnsPolicy
  useHostNetwork?: boolean
  serviceAccount?: string

  addContainer(batch.EksContainerDefinition)
}

class EksContainerDefinition {
  image: string
  args?: string[]
  command?: string[]
  env?: { [key:string]: string }
  imagePullPolicy?: ImagePullPolicy
  name?: string
  resources?: EksContainerResources
  priveleged?: boolean
  readonlyFileSystem?: boolean
  runAsGroup?: number
  runAsRoot?: boolean
  runAsUser?: number
  volumes?: EksVolume[]

  addVolume(...EksVolume[])
}

// TODO: need props for all of these smaller classes
// TODO: EksContainerResources has no definition
abstract class EksVolume {
  name: string;
  mountPath?: string;
  readonly?: boolean;
}

class EmptyDirVolume extends EksVolume {
  medium?: MediumType;
  sizeLimit?: number;
}

class HostPathVolume extends EksVolume {
  path: string;
}

class SecretPathVolume extends EksVolume {
  secret: string;
  optional?: boolean;
}

interface EksJobDefinitionProps {
  pod: batch.IEksPod;
  platform?: Platform;
}

class EksJobDefinition implements IEksJobDefinition {
  constructor(readonly props: EksJobDefinitionProps = {}) {}
}
```

* `IMultiNodeJobDefinition`

```ts
interface IMultiNodeJobDefinition extends IJobDefinition {
  containers: MultiNodeContainer[];
  mainNode: number;
  instanceType: InstanceType;
}

interface MultiNodeContainer {
  startNode: number;
  endNode: number;
  container: ContainerDefinition;
}

interface MultiNodeJobDefinitionProps {
  containers: MultiNodeContainer[];
  mainNode: number;
  instanceType: InstanceType;
}

class MultiNodeJobDefinition implements IMultiNodeJobDefinition {
  constructor(readonly props: MultiNodeJobDefinitionProps = {}) {}

  public addContainer(...containers: MultiNodeContainer[]) {}
}
```

#### JobQueue

* `IJobQueue`

```ts
interface IJobQueue extends cdk.IResource, iam.Grantable, cdk.ITaggable {
  priority: number
  name?: string
  enabled?: boolean
  schedulingPolicy?: SchedulingPolicy
  computeEnvironments: OrderedComputeEnvironment[]
}

interface JobQueueProps {
  priority: number
  name?: string
  enabled?: boolean
  schedulingPolicy?: ISchedulingPolicy
  computeEnvironments: OrderedComputeEnvironment[]
}

interface OrderedComputeEnvironment {
  computeEnvironment: IComputeEnvironment;
  order: number;
}

class JobQueue implements IJobQueue {
  constructor(readonly props: JobQueueProps = {}) {}

  addComputeEnvironment(computeEnvironment: ComputeEnvironment, order: number)
}
```

#### SchedulingPolicy

* `ISchedulingPolicy`

```ts
interface ISchedulingPolicy extends cdk.IResource, iam.Grantable, cdk.ITaggable {
}

interface SchedulingPolicyProps {
}

class SchedulingPolicyBase implements ISchedulingPolicy {
  constructor(readonly props: SchedulingPolicyProps = {}) {}
}
```

* `IFairshareSchedulingPolicy`

```ts
interface IFairshareSchedulingPolicy extends ISchedulingPolicy {
  readonly computeReservation?: number;
  readonly shareDecay?: Duration;
  readonly shares?: Share[];
}

interface FairshareSchedulingPolicyProps {
  readonly computeReservation?: number;
  readonly shareDecay?: Duration;
  readonly shares?: Share[];
}

interface Share {
  id: string;
  weight: number;
}

class FairshareSchedulingPolicy implements IFairshareSchedulingPolicy {
  constructor(readonly props: FairshareSchedulingPolicyProps = {}) {}

  addShare(id: string, weight: number) {}
}
```

### Is this a breaking change?

No, because we will continue to make the old API available. Their existing
code will not be compatible with the new API.

### What alternative solutions did you consider?

We could expand the coverage of the existing design to cover all the missing use cases.
Supporting these additional use cases without redesigning the API requires
us to provide a subpar customer experience because the existing API suffers from the same
problem as the CloudFormation resource; there are too many logically distinct resources
lumped into a single type. Many properties are always silently ignored or rejected by CloudFormation
depending on which other properties are specified (12 on a single resource, among many others).

### What are the drawbacks of this solution?

The new API is substantially different from the old one, which means migration will not be free.

### What is the high-level project plan?

Once this RFC is approved, implementation will begin and will be completed by Q1.

### Are there any open issues that need to be addressed later?

No.

## Appendix

### L2 props → L1 props

#### abstract class ComputeEnvironment

```
name?: string -> ComputeEnvironmentName
serviceRole?: iam.IRole -> ServiceRole
replaceComputeEnvironment?: boolean -> ReplaceComputeEnvironment
enabled?: boolean -> State
updateTimeout?: Duration -> UpdatePolicy.JobExecutionTimeoutMinutes
terimnateOnUpdate?: boolean -> UpdatePolicy.TerminateJobsOnUpdate
maxvCpus?: number -> ComputeResources.MaxvCpus
securityGroups?: ec2.ISecurityGroup[] -> ComputeResources.SecurityGroupIDs
subnets?: ec2.ISubnet[] -> ComputeResources.Subnets
updateToLatestImageVersion?: boolean -> ComputeResources.UpdateToLatestImageVersion
eksClusterWithNamespace -> EksConfiguration
```

#### ManagedEc2ComputeEnvironment

```
images?: IBatchMachineImage[] -> ComputeResources.Ec2Configuration, ComputeResources.Ec2Configuration
allocationStrategy?: AllocationStrategy -> ComputeResources.AllocationStrategy
spotBidPercentage?: number -> ComputeResources.BidPercentage
spot?: boolean -> ComputeResources.Type
desiredvCpus?: number -> ComputeResources.DesiredvCpus
instanceTypes?: ec2.InstanceType[] -> ComputeResources.InstanceTypes
instanceRole?: iam.IRole -> ComputeResources.InstanceRole
launchTemplate?: ec2.ILaunchTemplate -> ComputeResources.LaunchTemplate
minvCpus?: number -> ComputeResources.MinvCpus
placementGroup?: ec2.IPlacementGroup -> ComputeResources.PlacementGroup
```

#### UnmanagedEc2ComputeEnvironment

```
unmanagedvCpus?: number -> UnmanagedvCpus
```

#### FargateComputeEnvironment

```
// has no extra props
```

#### abstract class JobDefinition

```
name?: string -> JobDefinitionName
parameters?: { [key:string]: any } -> Parameters
propogateTags?: boolean -> PropogateTags
retryAttempts?: number -> RetryStrategy.Attempts
retryStrategy?: RetryStrategy -> RetryStrategy.EvaluateOnExit
schedulingPriority?: number -> SchedulingPriority
timeout?: Duration -> Timeout
```

#### EcsJobDefinition extends JobDefinition

```
containerDefinition: EcsContainerDefinition -> ContainerProperties
fargatePlatformVersion?: Batch.FargatePlatformVersion -> ContainerProperties.FargatePlatformConfiguration
compatibility?: Compatibility -> PlatformCapabilities

// no addContainer() because this is a single-node only job type
```

#### EcsContainerDefinition

```
command?: string -> ContainerProperties.Command
environments?: Array<{ [key:string]: string }> -> ContainerProperties.Environment
executionRoleArn?: iam.IRole -> ContainerProperties.ExecutionRoleArn
fargateVersion?: FargateVersion -> ContainerProperties.FargatePlatformConfiguration
image: ContainerImage -> ContainerProperties.Image, ContainerProperties.ResourceRequirements.MEMORY
// InstanceType is not applicable to single-node ECS jobs. All node ranges must use the same instance type, so configure it there
jobRoleArn?: iam.IRole -> ContainerProperties.JobRoleArn,
linuxParameters?: LinuxParameters -> ContainerProperties.LinuxParameters
logDriver?: LogDriver -> ContainerProperties.LogConfiguration
// Memory is deprecated in favor of ResourceRequirements
// mountpoints added via addMountPoint() or addMountVolume()
disableNetworking?: boolean -> ContainerProperties.NetworkConfiguration
priveleged?: boolean -> ContainerProperties.Priveleged
readonlyRootFileSystem?: boolean -> ContainerProperties.ReadonlyRootFileSystem
// image covers ContainerProperties.ResourceRequirements.MEMORY
cpu: number -> ContainerProperties.ResourceRequirements.VCPU
gpuCount?: number -> ContainerProperties.ResourceRequirements.GPU
secrets?: { [key: string]: Secret } -> ContainerProperties.Secrets
// Ulimits are added via addUlimit()
user?: string -> ContainerProperties.User
// Vcpus is deprecated in favor of ResourceRequirements
// Volumes are added via addVolume() or addMountedVolume()

addMountPoint(...MountPoint[]) -> MountPoints
addUlimit(...Ulimit[]) -> Ulimits
addVolume(...EcsVolume[]) -> Volumes
addMountedVolume(..MountedEcsVolume[]) -> MountPoints, Volumes
```

#### ContainerImage

```
see https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_aws-ecs.ContainerImage.html
```

#### MountPoint

```
containerPath: string
readOnly: boolean
sourceVolume: string
```

#### Ulimit

```
hardLimit: number
name: UlimitName
softLimit: number
```

#### UlimitName

```
see https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_aws-ecs.UlimitName.html
```

#### EcsVolume

```
name: string
efsVolumeConfiguration?: EfsVolumeConfiguration
host?: string -> Host.SourcePath
```

#### EfsVolumeConfiguration

```
fileSystemId: string
rootDirectory?: string
transitEncryption?: string
transitEncryptionPort?: number
authorizationConfig?: AuthorizationConfig
```

#### AuthorizationConfig

```
accessPointId?: string
iam?: string
```

#### MountedEcsVolume

```
name: string
efsVolumeConfiguration?: EfsVolumeConfiguration
host?: string
containerPath: string
readOnly: boolean
```

#### EksJobDefinition extends JobDefinition

```
pod: batch.IEksPod -> EksProperties
platform?: Platform -> PlatformCapabilities
```

### EksPod

```
containers: batch.EksContainerDefinition[] -> Containers, Volumes (container volumes will be added to these pod Volumes)
dnsPolicy?: DnsPolicy -> DnsPolicy
useHostNetwork?: boolean -> HostNetwork
serviceAccount?: string -> ServiceAccountName

addContainer(batch.EksContainerDefinition) -> Containers, Volumes (container volumes will be added to these pod Volumes)
```

#### EksContainerDefinition

```
image: string -> Image
args?: string[] -> Args
command?: string[] -> Command
env?: { [key:string]: string } -> Env
imagePullPolicy?: ImagePullPolicy -> ImagePullPolicy
name?: string -> Name
resources?: EksContainerResources -> Resources
priveleged?: boolean -> SecurityContext.Priveleged
readonlyFileSystem?: boolean -> SecurityContext.ReadOnlyFileSystem
runAsGroup?: number -> SecurityContext.RunAsGroup
runAsRoot?: boolean -> SecurityContext.RunAsNonRoot
runAsUser?: number -> SecurityContext.RunAsUser
volumes?: Volume[] -> VolumeMounts

addVolume(...Volume[]) -> VolumeMounts
```

#### abstract class EksVolume

```
name: string -> Name
mountPath?: string -> MountPath
readonly?: boolean -> ReadOnly
```

#### EmptyDirVolume extends EksVolume

```
medium?: MediumType -> Medium
sizeLimit?: number -> SizeLimit
```

#### HostPathVolume extends EksVolume

```
path: string -> Path
```

#### SecretVolume extends EksVolume

```
secretName: string,
optional?: boolean,
```

#### MultiNodeJobDefinition extends JobDefinition

```
containers: MultiNodeContainer[] -> NodeProperties.NodeRangeProperties
mainNode: number -> NodeProperties.MainNode
instanceType: NodeProperties.NodeRangeProperties.Container.InstanceType
// FargatePlatformConfiguration doesn't apply to multinode
```

#### MultiNodeContainer

```
startNode: number -> NodeProperties.NodeRangeProperties.TargetNodes, NodeProperties.NumNodes
endNode: number -> NodeProperties.NodeRangeProperties.TargetNodes, NodeProperties.NumNodes
container: ecs.ContainerDefinition -> NodeProperties.NodeRangeProperties.Container
```

#### JobQueue

```
//ComputeEnvironmentOrder // can't mix fargate and ec2, added via addComputeEnvironment()
 priority: number -> Priority
name?: string -> JobQueueName
enabled?: boolean ->  State
schedulingPolicy?: SchedulingPolicy -> SchedulingPolicyArn
computeEnvironments: OrderedComputeEnvironment[] -> ComputeEnvironmentOrder

addComputeEnvironment(computeEnvironment: ComputeEnvironment, order: number) -> ComputeEnvironmentOrder
```

#### FairshareSchedulingPolicy extends SchedulingPolicyBase

```
computeReservation?: number -> FairsharePolicy.ComputeReservation
shareDecay?: Duration -> FairsharePolicy.ShareDecaySeconds
shares?: Share[] -> FairsharePolicy.ShareDistribution
```

#### Share

```
id: string -> ShareIdentifier
weight: number -> WeightFactor
```

#### Batch::JobDefinition ← ECS::TaskDefinition

```
ContainerProperties: {
  Command: ContainerDefinitions.Command,
  Environment: ContainerDefinition.Environment,
  ExecutionRoleArn: ExecutionRoleArn,
  FargatePlatformConfiguration: ?????
  Image: ContainerDefinition.Image,
  InstanceType: ????? // only used in multinode
  JobRoleArn: TaskRoleArn,
  LinuxParameters: ContainerDefinition.LinuxParameters,
  LogConfiguration: ContainerDefinition.LogCongifuration,
  Memory: ContainerDefinition.Memory,
  MountPoints: ContainerDefinition.MountPoints,
  NetworkConfiguration.AssignPublicIp: ContainerDefinition.DisableNetworking,
  Priveleged: ContainerDefinition.Priveleged,
  ReadonlyRootFilesystem: ContainerDefinition.ReadonlyRootFilesystem,
  ResourceRequirements: ???????
  Secrets: ContainerDefinition.Secrets,
  Ulimits: ContainerDefinition.Ulimits,
  User: ContainerDefinition.User,
  Vcpu: deprecated, use ResourceRequirements instead
  Volumes: Volumes,
}

Platform: RequiresCompatibilities
```
