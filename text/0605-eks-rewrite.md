# EKS L2 Re-write

* **Original Author(s)**: @xazhao
* **Tracking Issue**: [#605](https://github.com/aws/aws-cdk-rfcs/issues/605)
* **API Bar Raiser**: 

eks-v2-alpha is a re-write of existing aws-eks module. It uses native L1 CFN resource instead of custom resource to create EKS cluster and Fargate Profile. This re-write provides a better customer experience including faster deployment, less complexity/cost and more features like escape hatching and better VPC support. It also require less maintenance compare to the existing module. 

## Working Backwards
This construct library is a re-write of `aws-eks` library. The new construct library uses the native L1 resource AWS::EKS::Cluster to provision a EKS cluster instead of relying on custom resource in old aws-eks library.

This RFC is focus on difference between the new module and original EKS L2. Detailed use case will be published in the README of new eks-alpha-v2 module. If a feature of existing EKS construct is not included in this RFC, it will be same as existing EKS construct.

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

* EKS Cluster - The cluster endpoint created by EKS.
* Managed Node Group - EC2 worker nodes managed by EKS.
* Fargate Profile - Fargate worker nodes managed by EKS.
* Auto Scaling Group - EC2 worker nodes managed by the user.
* Kubectl Handler - Lambda function for invoking kubectl commands on the cluster - created by CDK

### Difference from original EKS L2

ClusterHandler is removed in the new implementation because it uses native L1 resource AWS::EKS::Cluster to create the EKS cluster resource. Along with resource change, following properties on Cluster construct are removed:

* clusterHandlerEnvironment
* clusterHandlerSecurityGroup
* clusterHandlerSecurityGroup
* onEventLayer

## Resource Provisioning
This change is not directly visible in API or construct props, but in implementation details. Two custom resources will be replaced with native CFN L1 resources:

* `Custom::AWSCDK-EKS-Cluster` will be replaced with `AWS::EKS::Cluster`
* `Custom::AWSCDK-EKS-FargateProfile` will be replaced with `AWS::EKS::FargateProfile`

The resource type change will be reflected in cdk synth output template.

## Authentication
`ConfigMap` authentication mode has been deprecated by EKS and the recommend mode is API. The new EKS L2 will go a step further and only support API authentication mode. All grant functions in EKS will use Access Entry to grant permissions to an IAM role/user. 

`AwsAuth` construct was developed to manage mappings between IAM users/roles to Kubernetes RBAC configuration through ConfigMap. It’s exposed with awsAuth attribute of cluster construct. With the deprecation of `ConfigMap` mode, AwsAuth construct and the attribute are removed in the new EKS module.

`grant()` function are introduced to replace the awsAuth. It’s implemented using Access Entry.

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
To create a EKS Cluster in an isolated VPC, vpc endpoints need to be set for different AWS services (EC2, S3, STS, ECR and anything the service needs).
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

### Logging Configuration
Logging property is renamed from clusterLogging to logging since there is only one logging property in the construct.

Before
```
const cluster = new eks.Cluster(this, 'Cluster', {
  // ...
  version: eks.KubernetesVersion.V1_31,
  clusterLogging: [
    eks.ClusterLoggingTypes.API,
    eks.ClusterLoggingTypes.AUTHENTICATOR,
  ],
});
```
After
```
const cluster = new eks.Cluster(this, 'Cluster', {
  version: eks.KubernetesVersion.V1_31,
  logging: [
    eks.ClusterLoggingTypes.API,
    eks.ClusterLoggingTypes.AUTHENTICATOR,
  ],
});
```

### Output Configuration
A new property `outputInfo` will replace the current 3 output properties. Although 3 separate output properties provide customization on output configuration, it increased the cognitive load and doesn’t provide a clean usage. The proposal here is to have one single flag to control all of them.

Before
```
const cluster = new eks.Cluster(this, 'Cluster', {
  version: eks.KubernetesVersion.V1_31,
   outputMastersRoleArn: true,
  outputClusterName: true,
  outputConfigCommand: true,
});
```
After
```
const cluster = new eks.Cluster(this, 'Cluster', {
  version: eks.KubernetesVersion.V1_31,
  outputInfo: true,
});
```

### Kubectl Handler Configuration
KubectlProvider is a lambda function that CDK deploys alongside the EKS cluster in order to execute kubectl commands against the cluster. 

A common scenarios is that users create a CDK app that deploys the EKS cluster, which is then imported in other apps in order to deploy resources onto the cluster. 

Difference

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

* kubectlRoleArn
* handlerRole

 `fromKubectlProviderAttributes()` is renamed to `fromKubectlProviderFunctionArn()`. 

Reason: when the KubectlProvider was created in another stack, the lambda execution role already has permissions to access the cluster.

Besides that, KubectlProvider specific properties are moved into KubectlProviderOptions to better organize properties.
```
export interface KubectlProviderOptions {
  readonly role?: iam.IRole;
  readonly awscliLayer?: lambda.ILayerVersion;
  readonly kubectlLayer?: lambda.ILayerVersion;
  readonly memory?: Size;
  readonly environment?: { [key: string]: string };
  /**
   * Wich subnets should the provider functions be placed in.
   */
  readonly vpcSubnets?: ec2.SubnetSelection;
}
```

Before
```
new eks.Cluster(this, 'MyCluster', {
  version: eks.KubernetesVersion.V1_31,
  kubectlMemory: Size.gibibytes(4),
  kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
  kubectlEnvironment: {
    'http_proxy': 'http://proxy.myproxy.com',
  },
  kubectlRole: iam.Role.fromRoleArn(this, 'MyRole', 'arn:aws:iam::123456789012:role/lambda-role');
});
```
After
```
new eks.Cluster(this, 'MyCluster', {
  version: eks.KubernetesVersion.V1_31,
  kubectlProviderOptions: {
    memory: Size.gibibytes(4),
    kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
    environment: {
      'http_proxy': 'http://proxy.myproxy.com',
    },
    role: iam.Role.fromRoleArn(this, 'MyRole', 'arn:aws:iam::123456789012:role/lambda-role');
});
```

## Migration Path
Note: We can't guarantee it's a safe migration.

Due to the fact that switching from a custom resource (Custom::AWSCDK-EKS-Cluster) to a native L1 (AWS::EKS::Cluster) resource requires cluster replacement, CDK users who need to preserve their cluster will have to take additional actions.

1. Set the authentication mode of cluster from `AuthenticationMode.CONFIG_MAP` to `AuthenticationMode.API_AND_CONFIG_MAP` and deploy
2. Set the authentication mode of cluster from `AuthenticationMode.API_AND_CONFIG_MAP` to `AuthenticationMode.API` and deploy
3. Set removal policy to RETAIN on the existing cluster (and manifests) and deploy.
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

We’re launching a new EKS module `aws-eksv2-alpha`. It's a rewrite of existing `aws-eks` module with some breaking changes based on community feedbacks.

### Why should I use this feature?

The new EKS module provides faster deployment, less complexity, less cost and more features (e.g. isolated VPC and escape hatching).

### What's the future plan for existing `aws-eks` module?

- When the new alpha module is published, `aws-eks` module will enter `maintainence` mode which means we will only work on bugs on `aws-eks` module. New features will only be added to the new `aws-eksv2-alpha` module. (Note: this is the general guideline and we might be flexible on this)
- When the new alpha module is stablized, `aws-eks` module will enter `deprecation` mode which means customers should migrate to the new module. They can till use the old module but we will not invest on features/bug fixes on it.

## Internal FAQ

### Why are we doing this?
This feature has been highly requested by the community since Feb 2023. The current implementation using custom resource has some limitations and is harder to maintain. EKS L2 is a widely used module and we should rewrite it.

### Why should we _not_ do this?
The migration for customers is not easy and we can't guarantee it's a safe migration without down time.

### Is this a breaking change?

Yes it's breaking change hence it's put into a new alpha module. A few other breaking changes are shipped together to make it more ergonomic and aligned with the new cluster implementation.

### What is the high-level project plan?
- [ ] Publish the RFC
- [ ] Gather feedback on the RFC
- [ ] Get bar raiser to sign off on RFC
- [ ] Create the new eksv2 alpha module and implementation
- [ ] Make pull request to aws-cdk repository
- [ ] Iterate and respond to PR feedback
- [ ] Merge new module

### Are there any open issues that need to be addressed later?

TBD

## Appendix
#### EKS Cluster Props Difference
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
readonly kubectlProviderOptions?: KubectlProviderOptions;
readonly outputInfo?: boolean;
```
