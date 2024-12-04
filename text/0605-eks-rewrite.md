# EKS L2 Re-write

- **Original Author(s)**: @xazhao
- **Tracking Issue**: [#605](https://github.com/aws/aws-cdk-rfcs/issues/605)
- **API Bar Raiser**: @iliapolo

The `eks-v2-alpha` module is a rewrite of the existing `aws-eks` module. This
new iteration leverages native L1 CFN resources, replacing the previous custom
resource approach for creating EKS clusters and Fargate Profiles. Beyond the
resource types change, the module introduces several other breaking changes
designed to better align the L2 construct with its updated implementation. These
modifications collectively enhance the module's functionality and integration
within the AWS ecosystem, providing a more robust and streamlined solution for
managing Elastic Kubernetes Service (EKS) resources.

This RFC primarily focus on API changes in the new module. The project plan about the new module
e.g. how does it co-exists with the current EKS module is out of scope and will be decided later.

Comprehensive use cases and examples will be available in the README file of the forthcoming `eks-v2-alpha` module.

Compared to the original EKS module, it has the following major changes:

- Use native L1 `AWS::EKS::Cluster` resource to replace custom resource `Custom::AWSCDK-EKS-Cluster`
- Use native L1 `AWS::EKS::FargateProfile` resource to replace custom resource `Custom::AWSCDK-EKS-FargateProfile`
- `Kubectl Handler` will not be created by default. It will only be created if users specify it.
- Remove `AwsAuth` construct. Permissions to the cluster will be managed by Access Entry.
- Remove the limit of 1 cluster per stack
- Remove nested stacks
- API changes to make them more ergonomic.

With the new EKS module, customers can deploy an EKS cluster without custom resources.

## Working Backwards

## Readme

Note: Full readme is too long for this RFC. This readme is simplified version that only focus on
use cases that are different from the original EKS module. Full readme will be published in
the alpha module.

This library is a rewrite of existing EKS module including breaking changes to
address some pain points on the existing EKS module including:

- Can't deploy EKS cluster without custom resources
- The stack uses nested stacks
- Can't create multiple cluster per stack
- Can't use escape hatches

It allows you to define Amazon Elastic Container Service for Kubernetes (EKS) clusters. In addition,
the library also supports defining Kubernetes resource manifests within EKS clusters.

## Quick start

Here is the minimal example of defining an AWS EKS cluster

```
import * as eks from '@aws-cdk/aws-eks-v2-alpha';

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
- Kubectl Handler (Optional) - Custom resource (i.e Lambda Function) for invoking kubectl commands on the
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

If you do not specify a VPC, one will be created on your behalf, which you can then access via cluster.vpc.
The cluster VPC will be associated to any EKS managed capacity (i.e Managed Node Groups and Fargate Profiles).

The cluster can be placed inside an isolated VPC. The cluster’s VPC subnets must have a VPC interface endpoint
for any AWS services that your Pods need access to. See https://docs.aws.amazon.com/eks/latest/userguide/private-clusters.html

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

const cluster = new eks.Cluster(this, 'Mycluster', {
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

There are 3 scenarios here:

1. Import the cluster without creating a new kubectl Handler

```
const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
});
```

This imported cluster is not associated with a `Kubectl Handler`. It means we won't be able to
invoke `addManifest()` function on the cluster.

2. Import the cluster and the kubectl Handler

```
const kubectlProvider = eks.KubectlProvider.fromKubectlProviderArn(this, 'KubectlProvider', {
  functionArn: ''
});

const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster',
  kubectlProvider
});
```

3. Import the cluster and create a new kubectl Handler

```
const kubectlProvider = new eks.KubectlProvider(this, 'KubectlProvier', {
  clusterName: 'my-cluster',
});

const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster',
  kubectlProvider
});
```

## Migration Guide

**This is a general guideline. After migrating to the new construct, run `cdk diff` to make sure no unexpected changes.**
**If you encounter any issues during the migration, please open a Github issue at [CDK repo](https://github.com/aws/aws-cdk)**

**Prerequisite:** Exposed removal policy in the current EKS Cluster construct so that customers can remove
the cluster definition from CDK app without actual deleting the cluster.

Tracking issue: https://github.com/aws/aws-cdk/issues/25544

Due to the fact that switching from a custom resource
(Custom::AWSCDK-EKS-Cluster) to a native L1 (AWS::EKS::Cluster) resource
requires cluster replacement, CDK users who need to preserve their cluster will
have to take additional actions.

1. **Set removal policy to RETAIN on the existing cluster and deploy (this feature will be added later).**

   To make sure the cluster is not being deleted, set the removal policy to `RETAIN` on the cluster.
   It will keep EKS related resources from being deleted when we clean up previous EKS constructs in the stack.

   ```
    new eks.Cluster(this, 'hello-eks', {
      ...
      removalPolicy: RemovalPolicy.RETAIN,
    });
   ```

2. **Change the authentication mode of cluster from `CONFIG_MAP` to `API`.**

   Since the new EKS module will only support `API` authentication mode, you will need to migrate your cluster to `API` mode.

   This is a two steps change. First you need to change `CONFIG_MAP` to `API_AND_CONFIG_MAP` to enable access entry.
   Then for all mappings in aws-auth ConfigMap, you can migrate to access entries.
   After this migration is done, change `API_AND_CONFIG_MAP` to `API` to disable `ConfigMap`.

3. **Remove cluster definition from their CDK app and deploy.**

4. **Add new cluster definition using the new constructs(eks-v2-alpha).**

5. **User `cdk import` to import the existing cluster as the new definition.**
   `cdk import` will ask you for id/arn/name for EKS related resources. It may include following:
    - `AWS::EKS::Cluster`
    - `AWS::EKS::FargateProfile`
    - `AWS::EKS::Nodegroup`
    - `AWS::EKS::AccessEntry`

6. **After `cdk import`, running `cdk diff` to see if there's any unexpected changes.**

## Public FAQ

### What are we launching today?

We’re launching a new EKS alpha module `aws-eks-v2-alpha`. It's a rewrite of existing
`aws-eks` module with some breaking changes to address pain points in `aws-eks` module.

### Why should I use this feature?

The new EKS alpha module has following benefits:

- faster deployment
- option to not use custom resource
- remove limitations on the previous EKS module (isolated VPC, 1 cluster limit per stack etc)

## Internal FAQ

### Why are we doing this?

This feature has been highly requested by the community since Feb 2023. The
current implementation using custom resource has some limitations and is harder
to maintain. We can also use this chance to solve some major pain points in the current EKS L2.

Issues will be solved with the new module:

- https://github.com/aws/aws-cdk/issues/24059 (Custom Resource)
- https://github.com/aws/aws-cdk/issues/25544 (Custom Resource related)
- https://github.com/aws/aws-cdk/issues/24174 (Custom Resource related)
- https://github.com/aws/aws-cdk/issues/19753 (ConfigMap)
- https://github.com/aws/aws-cdk/issues/19218 (ConfigMap)
- https://github.com/aws/aws-cdk/issues/31942 (One cluster per stack limit)

### Why should we _not_ do this?

Some customer might be happy with the current EKS module and don't need to migrate to the new module.
Therefore, we should write a blog post/tool to help the migration.

### Is this a breaking change?

Yes it's breaking change hence it's put into a new alpha module. A few other
breaking changes are shipped together to make it more ergonomic and aligned with
the new cluster implementation.

### Are there any open issues that need to be addressed later?

N/A

## Appendix

### EKS Cluster Props Difference

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
readonly clusterLogging?: ClusterLoggingTypes[];

readonly kubectlProviderOptions?: KubectlProviderOptions; # new property

readonly outputMastersRoleArn?: boolean; # will be removed
readonly outputClusterName?: boolean; # will be removed
readonly outputConfigCommand?: boolean; # will be removed
readonly authenticationMode?: AuthenticationMode; # will be removed
readonly clusterHandlerEnvironment?: { [key: string]: string }; # will be removed
readonly clusterHandlerSecurityGroup?: ec2.ISecurityGroup; # will be removed
readonly onEventLayer?: lambda.ILayerVersion; # will be removed
readonly clusterHandlerSecurityGroup?: ec2.ISecurityGroup; # will be removed

readonly awscliLayer?: lambda.ILayerVersion; # move to kubectlProviderOptions
readonly kubectlEnvironment?: { [key: string]: string }; # move to kubectlProviderOptions
readonly kubectlLambdaRole?: iam.IRole; # move to kubectlProviderOptions
readonly kubectlLayer?: lambda.ILayerVersion; # move to kubectlProviderOptions
readonly kubectlMemory?: Size; # move to kubectlProviderOptions
```

### KubectlProviderOptions Definition

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
