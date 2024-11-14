# EKS L2 Re-write

- **Original Author(s)**: @xazhao
- **Tracking Issue**: [#605](https://github.com/aws/aws-cdk-rfcs/issues/605)
- **API Bar Raiser**:

The `eks-v2-alpha` module is a rewrite of the existing `aws-eks` module. This
new iteration leverages native L1 CFN resources, replacing the previous custom
resource approach for creating EKS clusters and Fargate Profiles. Beyond the
resource types change, the module introduces several other breaking changes
designed to better align the L2 construct with its updated implementation. These
modifications collectively enhance the module's functionality and integration
within the AWS ecosystem, providing a more robust and streamlined solution for
managing Elastic Kubernetes Service (EKS) resources.

This RFC primarily addresses the distinctions between the new module and the
original EKS L2 construct. Comprehensive use cases and examples will be
available in the README file of the forthcoming `eks-alpha-v2` module.

Compared to the original EKS module, it has following major changes:

- Use native L1 `AWS::EKS::Cluster` resource to replace custom resource `Custom::AWSCDK-EKS-Cluster`
- Use native L1 `AWS::EKS::FargateProfile` resource to replace custom resource `Custom::AWSCDK-EKS-FargateProfile`
- `Kubectl Handler` will not be created by default. It will only be created if users specify it.
- Deprecate `AwsAuth` construct. Permissions to the cluster will be managed by Access Entry.
- API changes to make them more ergonomic.
- Remove nested stacks

## Working Backwards

## Readme

Note: Full readme is too long for this RFC. This readme is simplified version that only focus on
use cases that are different from the original EKS module. Full readme will be published in
the alpha module.

This library is a rewrite of existing EKS module including breaking changes to 
address some pain points on the existing EKS module. It allows you to define 
Amazon Elastic Container Service for Kubernetes (EKS) clusters. In addition, 
the library also supports defining Kubernetes resource manifests within EKS clusters.


## Quick start

Here is the minimal example of defining an AWS EKS cluster

```
import * as eks from '@aws-cdk/aws-eksv2-alpha';

// provisioning a cluster
const cluster = new eks.Cluster(this, 'hello-eks', {
  version: eks.KubernetesVersion.V1_31,
});
```

## Architecture

```
 +-----------------------------------------------+
 | EKS Cluster      | kubectl |  |
 | -----------------|<--------+| Kubectl Handler |
 | AWS::EKS::Cluster             (Optional)      |
 | +--------------------+    +-----------------+ |
 | |                    |    |                 | |
 | | Managed Node Group |    | Fargate Profile | |
 | |                    |    |                 | |
 | +--------------------+    +-----------------+ |
 +-----------------------------------------------+
    ^
    | connect self managed capacity
    +
 +--------------------+
 | Auto Scaling Group |
 +--------------------+
```

In a nutshell:

- EKS Cluster - The cluster endpoint created by EKS.
- Managed Node Group - EC2 worker nodes managed by EKS.
- Fargate Profile - Fargate worker nodes managed by EKS.
- Auto Scaling Group - EC2 worker nodes managed by the user.
- Kubectl Handler (Optional) - Lambda function for invoking kubectl commands on the
  cluster - created by CDK

## Provisioning cluster
Creating a new cluster is done using the `Cluster` constructs. The only required property is the kubernetes version.
```
new eks.Cluster(this, 'HelloEKS', {
  version: eks.KubernetesVersion.V1_31,
});
```
You can also use `FargateCluster` to provision a cluster that uses only fargate workers.
```
new eks.FargateCluster(this, 'HelloEKS', {
  version: eks.KubernetesVersion.V1_31,
});
```

**Note: Unlike the previous EKS cluster, `Kubectl Handler` will not
be created by default. It will only be deployed when `kubectlProviderOptions`
property is used.**
```
new eks.Cluster(this, 'hello-eks', {
  version: eks.KubernetesVersion.V1_31,
  # Using this property will create `Kubectl Handler` as custom resource handler
  kubectlProviderOptions: {
    kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
  }
});
```
### VPC Support

You can specify the VPC of the cluster using the vpc and vpcSubnets properties:
```
declare const vpc: ec2.Vpc;
new eks.Cluster(this, 'HelloEKS', {
  version: eks.KubernetesVersion.V1_31,
  vpc,
  vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
});
```
If you do not specify a VPC, one will be created on your behalf, which you can then access via cluster.vpc. The cluster VPC will be associated to any EKS managed capacity (i.e Managed Node Groups and Fargate Profiles).

The cluster can be placed inside an isolated VPC. The cluster’s VPC subnets must have a VPC interface endpoint for any AWS services that your Pods need access to. See https://docs.aws.amazon.com/eks/latest/userguide/private-clusters.html
```
const vpc = new ec2.Vpc(this, 'vpc', {
    subnetConfiguration: [
        {
            cidrMask: 24,
            name: 'Private',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
    ]
});

const cluster = new eks.Cluster(this, 'MyMycluster123', {
    version: eks.KubernetesVersion.V1_31,
    vpc,
    vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }]
});
```

### Kubectl Support
You can choose to have CDK create a `Kubectl Handler` - a Python Lambda Function to
apply k8s manifests using `kubectl apply`. This handler will not be created by default.

To create a `Kubectl Handler`, use `kubectlProviderOptions` when creating the cluster.
`kubectlLayer` is the only required property in `kubectlProviderOptions`.
```
new eks.Cluster(this, 'hello-eks', {
  version: eks.KubernetesVersion.V1_31,
  # Using this property will create `Kubectl Handler` as custom resource handler
  kubectlProviderOptions: {
    kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
  }
});

`Kubectl Handler` created along with the cluster will be granted admin permissions to the cluster.
```

## Permissions and Security
Amazon EKS supports three modes of authentication: CONFIG_MAP, API_AND_CONFIG_MAP, and API. 
`ConfigMap` authentication mode has been deprecated by EKS and the recommended mode is API. 
The new EKS L2 will go a step further and only support API authentication mode.
All grant functions in EKS will use Access Entry to grant
permissions to an IAM role/user.

As a result, `AwsAuth` construct in the previous EKS module will not be provided in the new module.
`grant()` functions are introduced to replace the awsAuth. It’s implemented using
Access Entry.

Grant Admin Access to an IAM role
```
cluster.grantAdmin('adminAccess', roleArn, eks.AccessScopeType.CLUSTER);
```
You can also use general `grantAccess()` to attach a policy to an IAM role/user.
See https://docs.aws.amazon.com/eks/latest/userguide/access-policies.html for all access policies
```
# A general grant function is also provided
cluster.grantAccess('adminAccess', roleArn, [
  eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
    accessScopeType: eks.AccessScopeType.CLUSTER,
  }),
]);
```

### Use existing Cluster/Kubectl Handler

This module allows defining Kubernetes resources such as Kubernetes manifests and Helm charts
on clusters that are not defined as part of your CDK app.

There are 2 scenarios here:
1. Import the cluster without creating a new kubectl Handler
```
const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
});
```
This imported cluster is not associated with a `Kubectl Handler`. It means we won't be able to 
invoke `addManifest()` function on the cluster.

To apply a manifest, you need to import the kubectl handler and attach it to the cluster
```
const kubectlProvider = eks.KubectlProvider.fromKubectlProviderArn(this, 'KubectlProvider', {
  functionArn: ''
});

const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
  kubectlProvider: kubectlProvider
});

cluster.addManifest();
```

2. Import the cluster and create a new kubectl Handler
```
const cluster = eks.Cluster.fromClusterWithKubectlProvider(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
  kubectlProviderOptions: {
    kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
  }
});
```
This import function will always create a new kubectl handler for the cluster.

#### Alternative Solution
We can have one single `fromClusterAttributes()` and have different behaviors based on the input.

- Import the cluster without kubectl Handler. It can't invoke AddManifest().
```
const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
});
```
- Import the cluster and create a new kubectl Handler
```
const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
  kubectlProviderOptions: {
    kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
  }
});
```
- Import the cluster/kubectl Handler
```
const kubectlProvider = eks.KubectlProvider.fromKubectlProviderArn(this, 'KubectlProvider', {
  functionArn: ''
});
const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
  kubectlProvider: kubectlProvider
});
```

Note: `fromKubectlProviderAttributes()` is renamed to
`fromKubectlProviderFunctionArn()`.
Before

```
const kubectlProvider = eks.KubectlProvider.fromKubectlProviderAttributes(this, 'KubectlProvider', {
  functionArn,
  kubectlRoleArn: 'arn:aws:iam::123456789012:role/kubectl-role',
  handlerRole,
});
```

After

```
const kubectlProvider = eks.KubectlProvider.fromKubectlProviderArn(this, 'KubectlProvider', {
  functionArn: // Required. ARN of the original kubectl function
});
```

Following parameters are removed:

- kubectlRoleArn
- handlerRole

Reason: when the KubectlProvider was created in another stack, the lambda
execution role already has permissions to access the cluster.

## Migration Path (TBD)

Due to the fact that switching from a custom resource
(Custom::AWSCDK-EKS-Cluster) to a native L1 (AWS::EKS::Cluster) resource
requires cluster replacement, CDK users who need to preserve their cluster will
have to take additional actions.

1. Set the authentication mode of cluster from `AuthenticationMode.CONFIG_MAP`
   to `AuthenticationMode.API_AND_CONFIG_MAP` and deploy
2. Set the authentication mode of cluster from
   `AuthenticationMode.API_AND_CONFIG_MAP` to `AuthenticationMode.API` and
   deploy
3. Set removal policy to RETAIN on the existing cluster (and manifests) and
   deploy.
4. Remove cluster definition from their CDK app and deploy
5. Add new cluster definition using the new constructs(EKSV2).
6. Follow cdk import to import the existing cluster as the new definition.
   1. All relevant EKS resources support import.
   2. AWS::EKS::Cluster
   3. AWS::EKS::FargateProfile
   4. AWS::EKS::Nodegroup
7. Add Manifests.

## Public FAQ

### What are we launching today?

We’re launching a new EKS module `aws-eksv2-alpha`. It's a rewrite of existing
`aws-eks` module with some breaking changes based on community feedbacks.

### Why should I use this feature?

The new EKS module provides faster deployment, less complexity, less cost and
more features (e.g. isolated VPC and escape hatching).

### What's the future plan for existing `aws-eks` module?

- When the new alpha module is published, `aws-eks` module will enter
  `maintenance` mode which means we will only work on bugs on `aws-eks` module.
  New features will only be added to the new `aws-eksv2-alpha` module. (Note:
  this is the general guideline and we might be flexible on this)
- When the new alpha module is stabilized, `aws-eks` module will transition into
  a deprecation phase. This implies that customers should plan to migrate their
  workloads to the new module. While they can continue using the old module for
  the time being, CDK team will prioritize new features/bug fix on the new
  module

## Internal FAQ

### Why are we doing this?

This feature has been highly requested by the community since Feb 2023. The
current implementation using custom resource has some limitations and is harder
to maintain. We can also use this chance to solve some major pain points in the current EKS L2.

Issues will be solved:
- https://github.com/aws/aws-cdk/issues/24059
- https://github.com/aws/aws-cdk/issues/25544
- https://github.com/aws/aws-cdk/issues/24174
- https://github.com/aws/aws-cdk/issues/19753
- https://github.com/aws/aws-cdk/issues/19218

### Why should we _not_ do this?

The migration for customers is not easy and we can't guarantee it's a safe
migration without down time.

### Is this a breaking change?

Yes it's breaking change hence it's put into a new alpha module. A few other
breaking changes are shipped together to make it more ergonomic and aligned with
the new cluster implementation.

### What is the high-level project plan?

- [X] Publish the RFC
- [X] Gather feedback on the RFC
- [ ] Get bar raiser to sign off on RFC
- [ ] Implementation
- [ ] Merge new module
- [ ] Publish migration guide/develop migration tool
- [ ] Stabilize the module once it's ready

### Are there any open issues that need to be addressed later?

TBD

## Appendix

### EKS Cluster Props Difference

Same props

```
readonly version: KubernetesVersion;
readonly vpc: ec2.IVpc;
readonly vpcSubnets: ec2.SubnetSelection[];
readonly albController?: AlbController;
readonly clusterName: string;
readonly coreDnsComputeType?: CoreDnsComputeType;
readonly defaultCapacity?: autoscaling.AutoScalingGroup;
readonly defaultCapacityInstance?: ec2.InstanceType;
readonly defaultCapacityType?: DefaultCapacityType;
readonly endpointAccess: EndpointAccess;
readonly ipFamily?: IpFamily;
readonly prune?: boolean;
readonly role?: iam.IRole;
readonly secretsEncryptionKey?: kms.IKey;
readonly securityGroup?: ec2.ISecurityGroup;
readonly serviceIpv4Cidr?: string;
readonly tags?: { [key: string]: string };
readonly mastersRole?: iam.IRole;
readonly bootstrapClusterCreatorAdminPermissions?: boolean;
```

Props only in old EKS

```
readonly clusterLogging?: ClusterLoggingTypes[];

readonly awscliLayer?: lambda.ILayerVersion;
readonly kubectlEnvironment?: { [key: string]: string };
readonly kubectlLambdaRole?: iam.IRole;
readonly kubectlLayer?: lambda.ILayerVersion;
readonly kubectlMemory?: Size;

readonly outputMastersRoleArn?: boolean;
readonly outputClusterName?: boolean;
readonly outputConfigCommand?: boolean;

readonly authenticationMode?: AuthenticationMode;
readonly clusterHandlerEnvironment?: { [key: string]: string };
readonly clusterHandlerSecurityGroup?: ec2.ISecurityGroup;
readonly onEventLayer?: lambda.ILayerVersion;
readonly clusterHandlerSecurityGroup?: ec2.ISecurityGroup;
```

Props only in new EKS

```
readonly logging?: ClusterLoggingTypes[];
readonly kubectlLayer: lambda.ILayerVersion;
readonly kubectlProviderOptions?: KubectlProviderOptions;
readonly outputInfo?: boolean;
```


KubectlProviderOptions Definition

```
export interface KubectlProviderOptions {
  readonly role?: iam.IRole;
  readonly awscliLayer?: lambda.ILayerVersion;
  readonly kubectlLayer?: lambda.ILayerVersion;
  readonly memory?: Size;
  readonly environment?: { [key: string]: string };
  /**
   * Which subnets should the provider functions be placed in.
   */
  readonly vpcSubnets?: ec2.SubnetSelection;
}
```
