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

## Working Backwards

This RFC primarily addresses the distinctions between the new module and the
original EKS L2 construct. Comprehensive use cases and examples will be
available in the README file of the forthcoming `eks-alpha-v2` module.

It's important to note that any features of the existing EKS construct not
explicitly mentioned in this RFC will remain unchanged and function as they do
in the current implementation. This approach ensures clarity on the
modifications while maintaining continuity for unaffected features.

## Quick start

Here is the minimal example of defining an AWS EKS cluster

```
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31';

// provisioning a cluster
const cluster = new eksv2.Cluster(this, 'hello-eks', {
  version: eks.KubernetesVersion.V1_31,
});
```

Note: Compared to the previous L2, `kubectlLayer` property is required now The
reason is if we set a default version, that version will be outdated one day and
updating default version at that time will be a breaking change.

## Architecture

```
 +-----------------------------------------------+
 | EKS Cluster      | kubectl |  |
 | -----------------|<--------+| Kubectl Handler |
 | AWS::EKS::Cluster                             |
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
- Kubectl Handler - Lambda function for invoking kubectl commands on the
  cluster - created by CDK

### Difference from original EKS L2

1. `Kubectl Handler` will only be created when you pass in `kubectlProviderOptions` property. By default, it will not create the custom resource. 
```
const cluster = new eks.Cluster(this, 'hello-eks', {
  version: eks.KubernetesVersion.V1_31,
  kubectlProviderOptions: {
    kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
  }
});
```
2. ClusterHandler is removed in the new implementation because it uses native L1
resource `AWS::EKS::Cluster` to create the EKS cluster resource.
 3. Along with
resource change, following properties on Cluster construct are removed:

-  clusterHandlerEnvironment
- clusterHandlerSecurityGroup
- clusterHandlerSecurityGroup
- onEventLayer

## Resource Provisioning

This change is not directly visible in API or construct props, but in
implementation details. Two custom resources will be replaced with native CFN L1
resources:

- `Custom::AWSCDK-EKS-Cluster` will be replaced with `AWS::EKS::Cluster`
- `Custom::AWSCDK-EKS-FargateProfile` will be replaced with
  `AWS::EKS::FargateProfile`

The resource type change will be reflected in cdk synth output template.

## Authentication

`ConfigMap` authentication mode has been deprecated by EKS and the recommend
mode is API. The new EKS L2 will go a step further and only support API
authentication mode. All grant functions in EKS will use Access Entry to grant
permissions to an IAM role/user.

`AwsAuth` construct was developed to manage mappings between IAM users/roles to
Kubernetes RBAC configuration through ConfigMap. It’s exposed with awsAuth
attribute of cluster construct. With the deprecation of `ConfigMap` mode,
AwsAuth construct and the attribute are removed in the new EKS module.

`grant()` function are introduced to replace the awsAuth. It’s implemented using
Access Entry.

### Difference from original EKS L2

Before using awsAuth

```
cluster.awsAuth.addMastersRole(role);
```

After using Access Entry

```
cluster.grantAdmin('adminAccess', roleArn, eks.AccessScopeType.CLUSTER);

# A general grant function is also provided
cluster.grantAccess('adminAccess', roleArn, [
  eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
    accessScopeType: eks.AccessScopeType.CLUSTER,
  }),
]);
```

## Cluster Configuration

### New Feat: Create EKS Cluster in an isolated VPC

To create a EKS Cluster in an isolated VPC, vpc endpoints need to be set for
different AWS services (EC2, S3, STS, ECR and anything the service needs). See https://docs.aws.amazon.com/eks/latest/userguide/private-clusters.html for more details.

```
const vpc = new ec2.Vpc(this, 'vpc', {
    subnetConfiguration: [
        {
            cidrMask: 24,
            name: 'Private',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
    ],
    gatewayEndpoints: {
        S3: {
            service: ec2.GatewayVpcEndpointAwsService.S3,
        },
    },
});
vpc.addInterfaceEndpoint('stsEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.STS,
    open: true,
});

vpc.addInterfaceEndpoint('ec2Endpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.EC2,
    open: true,
});

vpc.addInterfaceEndpoint('ecrEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.ECR,
    open: true,
});

vpc.addInterfaceEndpoint('ecrDockerEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    open: true,
});

const cluster = new eks.Cluster(this, 'MyMycluster123', {
    version: eks.KubernetesVersion.V1_31,
    authenticationMode: eks.AuthenticationMode.API,
    vpc,
    vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }]
});
```

### Use existing Cluster/Kubectl Handler

KubectlProvider is a lambda function that CDK deploys alongside the EKS cluster
in order to execute kubectl commands against the cluster.

A common scenarios is that users create a CDK app that deploys the EKS cluster,
which is then imported in other apps in order to deploy resources onto the
cluster.

To deploy manifest on imported clusters, you can decide whether to create `kubectl Handler` by using `kubectlProviderOptions` property.

1. Import the cluster without kubectl Handler. It can't invoke AddManifest().
```
const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
});
cluster.addManifest(); # X - not working
```

2. Import the cluster and create a new kubectl Handler
```
const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster-name',
  kubectlProviderOptions: {
    kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
  }
});

```

3. Import the cluster/kubectl Handler
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
to maintain. EKS L2 is a widely used module and we should rewrite it.

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
