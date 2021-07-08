# Constructs for Public CloudFormation Extensions

* **Original Author(s):**: @eladb
* **Tracking Issue**: #353
* **API Bar Raiser**: TBD

A set of construct libraries which includes generated constructs for all CloudFormation 
resources and modules published to the public CloudFormation Registry.

## README

The `@cdk-cloudformation-extensions/xxx` construct libraries includes generated strongly-typed "L1" constructs 
for all the public extensions (resources and modules) in the AWS CloudFormation public registry. This library
makes it easier to use public CloudFormation extensions in your CDK apps.

For example, let's say I want to define a GitHub repository using the `TF::GitHub::Repository` resource:

```ts
import { Repository } from '@cdk-cloudformation-extensions/tf-github';

new Repository(this, 'MyRepo', {
  name: 'my-repo',
  description: 'My awesome project',
  licenseTemplate: 'apache-2.0',
});
```

For each namespace (e.g. `TF::GitHub` in the above example) in 
the public CloudFormation Registry, a library is available under 
the scope `@cdk-cloudformation-extensions/NAMESPACE`. This library
includes construct libraries for all the types in that namespace.

New versions of all modules are released daily and include the 
latest versions of all constructs.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are publishing a set of construct libraries (in all JSII languages) which include constructs (and auxiliary types) for 
all the resources and modules in the public CloudFormation registry.

### Why should I use this feature?

This library makes it easier to discover and use CloudFormation extensions in CDK apps.

Previously, in order to use a resource from the CloudFormation registry, you would need to look up the resource documentation
and use the low-level, weakly-typed `CfnResource` class to define it in your CDK app:

```ts
new CfnResource(this, 'MyEksCluster', {
  type: 'AWSQS::EKS::Cluster',

  // weakly-typed!
  properties: {
    name: 'my-new-cluster',
    tags: [ { key: 'foo', value: 'bar' } ],
  },
});
```

With `@cdk-cloudformation-extensions` all public resources and modules will be listed in the **Construct Hub** like any
other construct and by importing the relevant `cdk-cloudformation-extensions` module into their projects, they will be able to
use them via strongly-typed classes. IDEs will show type information and inline help derived from the
extension schema.

```ts
import { Cluster } from '@cdk-cloudformation-extensions/awsqs-eks';

new Cluster(this, 'MyEksCluster', {
  name: 'my-new-cluster',
  tags: [ { key: 'foo', value: 'bar' } ],
});
```

## Internal FAQ

### Why are we doing this?

We are doing this because CDK users would like to be able to use CloudFormation extensions 
(modules, resources) as first-class citizens in CDK code. Extensions and native resource types
should look and feel the same way when defined in CDK apps.

Additionally, we would like to surface CloudFormation extensions in the upcoming Construct Hub
and to that end, if we simply publish a construct library that includes constructs for all the public,
extensions, this library will naturally be discoverable through the Hub.

### Why should we _not_ do this?

We have a longer term plan ([RFC#77](https://github.com/aws/aws-cdk-rfcs/issues/77)) to add 
support for a CLI command called `cdk import` which will allow users to generate L1s from any
registry type just-in-type and add them to their project (this is similar to CDK8s and CDKtf).

### What is the technical solution (design) of this feature?

The idea is to do something similar to what we do with the CloudFormation L1s 
in the AWS CDK and simply publish JSII construct libraries which includes 
statically-generated L1s for all the public registry extensions.

#### Library per type

CloudFormation extensions are semantically versioned. This means that new versions of an extension
may include breaking changes. We also want to allow users to pick up a specific version of an extension.
In light of these constraints, we determined that the best path forward is to publish each extension
as a separate module, with a version that corresponds to the extension version in the CloudFormation
registry. This way, we will have 1:1 alignment and users will have the most freedom.

#### Code Generator

The code generator will be executed daily (e.g. through a GitHub workflow),
query the CloudFormation Registry, and generate L1s for all the types based
on their metadata and schema.

We can use the `ListTypes` API to list all the types in the registry:

```shell
aws cloudformation list-types --visibility=PUBLIC
```

And then for each type, we can use `DescribeType` to retrieve the type information and its schema. 

For example, this command will return the description of the `AWSQS::EKS::Cluster` resource:

```shell
aws cloudformation describe-type --arn arn:aws:cloudformation:us-east-1::type/resource/408988dff9e863704bcc72e7e13f8d645cee8311/AWSQS-EKS-Cluster
```

For reference: the output of this command can be found [here](https://gist.github.com/eladb/bf417c07444027d6954360295df4ee37#file-awsqs-vpc-vpcqs-module-json). 
The parsed `Schema` field can be found [here](https://gist.github.com/eladb/bf417c07444027d6954360295df4ee37#file-awsqs-vpc-vpcqs-module-schema-json).

Now, we need to filter all non-`AWS::` types (the `AWS::` types are actually L1s), and then generate 
an L1 construct for each one. This includes:

1. Generating the construct class that extends `CfnResource`. I think we can use submodules to 
   represent the type namespace (`awsqs.eks` in this case), and the name of the resource as the construct name `Cluster`.
2. Generate an `XxxProps` JSII struct for this construct based on the `Schema` field. 
   This can be done using [`json2jsii`](https://github.com/cdklabs/json2jsii), which is the same 
   tool we use to implemented the `import` command in CDK8s and CDKtf.


### Is this a breaking change?

Nope.

### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

### What alternative solutions did you consider?

#### `cdk import` versus library

As mentioned above, an alternative approach would be to add support for `import` in the CDK CLI. The downsides of this approach (at this point) 
are that (a) it is a bigger investment as it involves a change to the CDK CLI; and (b) the Construct Hub won't be able to surface these
types automatically (we will need some custom support for "imported" types, which is something that we would like to add to the Construct Hub
in the future for all CDK domains).

#### Monolithic versus module per resource

As mentioned above, due to the fact that resource schemas are versioned and we want to allow users to select which
version of the resource they use, we determined that the best approach is to publish a module for each resource.
This has logicical/operational implications that we believe can mostly be mitigated using projen's capabilities to
reason about the project structure and publishing workflows using code.

### What is the high level implementation plan?

TBD

### Are there any open issues that need to be addressed later?

* __Property name conversion__: `json2jsii` converts field names to camelCase to adhere with naming typescript naming conventions. 
  This means that we need to map field names back when we define the `CfnResource`. I think we might want to add a 
  feature to `json2jsii` that will generate conversion functions that can be used to convert back data types to the original schema.

## Appendix

```ts
export class Cluster extends CfnResource {
  constructor(scope: Construct, id: string, props: ClusterProps) {
    super(scope, id, {
      type: 'AWSQS::EKS::Cluster',
      properties: capitalize(props),
    });
  }
}

// ---------------- output of json2jsii:

/**
 * A resource that creates Amazon Elastic Kubernetes Service (Amazon EKS) clusters.
 *
 * @schema ClusterProps
 */
export interface ClusterProps {
  /**
   * A unique name for your cluster.
   *
   * @schema ClusterProps#Name
   */
  readonly name?: string;

  /**
   * Amazon Resource Name (ARN) of the AWS Identity and Access Management (IAM) role. This provides permissions for Amazon EKS to call other AWS APIs.
   *
   * @schema ClusterProps#RoleArn
   */
  readonly roleArn?: string;

  /**
   * Name of the AWS Identity and Access Management (IAM) role used for clusters that have the public endpoint disabled. this provides permissions for Lambda to be invoked and attach to the cluster VPC
   *
   * @schema ClusterProps#LambdaRoleName
   */
  readonly lambdaRoleName?: string;

  /**
   * Desired Kubernetes version for your cluster. If you don't specify this value, the cluster uses the latest version from Amazon EKS.
   *
   * @schema ClusterProps#Version
   */
  readonly version?: string;

  /**
   * Network configuration for Amazon EKS cluster.


   *
   * @schema ClusterProps#KubernetesNetworkConfig
   */
  readonly kubernetesNetworkConfig?: ClusterPropsKubernetesNetworkConfig;

  /**
   * An object that represents the virtual private cloud (VPC) configuration to use for an Amazon EKS cluster.
   *
   * @schema ClusterProps#ResourcesVpcConfig
   */
  readonly resourcesVpcConfig?: ClusterPropsResourcesVpcConfig;

  /**
   * Enables exporting of logs from the Kubernetes control plane to Amazon CloudWatch Logs. By default, logs from the cluster control plane are not exported to CloudWatch Logs. The valid log types are api, audit, authenticator, controllerManager, and scheduler.
   *
   * @schema ClusterProps#EnabledClusterLoggingTypes
   */
  readonly enabledClusterLoggingTypes?: string[];

  /**
   * Encryption configuration for the cluster.
   *
   * @schema ClusterProps#EncryptionConfig
   */
  readonly encryptionConfig?: EncryptionConfigEntry[];

  /**
   * @schema ClusterProps#KubernetesApiAccess
   */
  readonly kubernetesApiAccess?: ClusterPropsKubernetesApiAccess;

  /**
   * ARN of the cluster (e.g., `arn:aws:eks:us-west-2:666666666666:cluster/prod`).
   *
   * @schema ClusterProps#Arn
   */
  readonly arn?: string;

  /**
   * Certificate authority data for your cluster.
   *
   * @schema ClusterProps#CertificateAuthorityData
   */
  readonly certificateAuthorityData?: string;

  /**
   * Security group that was created by Amazon EKS for your cluster. Managed-node groups use this security group for control-plane-to-data-plane communications.
   *
   * @schema ClusterProps#ClusterSecurityGroupId
   */
  readonly clusterSecurityGroupId?: string;

  /**
   * Endpoint for your Kubernetes API server (e.g., https://5E1D0CEXAMPLEA591B746AFC5AB30262.yl4.us-west-2.eks.amazonaws.com).
   *
   * @schema ClusterProps#Endpoint
   */
  readonly endpoint?: string;

  /**
   * ARN or alias of the customer master key (CMK).
   *
   * @schema ClusterProps#EncryptionConfigKeyArn
   */
  readonly encryptionConfigKeyArn?: string;

  /**
   * Issuer URL for the OpenID Connect identity provider.
   *
   * @schema ClusterProps#OIDCIssuerURL
   */
  readonly oidcIssuerUrl?: string;

  /**
   * @schema ClusterProps#Tags
   */
  readonly tags?: ClusterPropsTags[];

}

/**
 * Network configuration for Amazon EKS cluster.


 *
 * @schema ClusterPropsKubernetesNetworkConfig
 */
export interface ClusterPropsKubernetesNetworkConfig {
  /**
   * Specify the range from which cluster services will receive IPv4 addresses.
   *
   * @schema ClusterPropsKubernetesNetworkConfig#ServiceIpv4Cidr
   */
  readonly serviceIpv4Cidr?: string;

}

/**
 * An object that represents the virtual private cloud (VPC) configuration to use for an Amazon EKS cluster.
 *
 * @schema ClusterPropsResourcesVpcConfig
 */
export interface ClusterPropsResourcesVpcConfig {
  /**
   * Specify one or more security groups for the cross-account elastic network interfaces that Amazon EKS creates to use to allow communication between your worker nodes and the Kubernetes control plane. If you don't specify a security group, the default security group for your VPC is used.
   *
   * @schema ClusterPropsResourcesVpcConfig#SecurityGroupIds
   */
  readonly securityGroupIds?: string[];

  /**
   * Specify subnets for your Amazon EKS worker nodes. Amazon EKS creates cross-account elastic network interfaces in these subnets to allow communication between your worker nodes and the Kubernetes control plane.
   *
   * @schema ClusterPropsResourcesVpcConfig#SubnetIds
   */
  readonly subnetIds?: string[];

  /**
   * Set this value to false to disable public access to your cluster's Kubernetes API server endpoint. If you disable public access, your cluster's Kubernetes API server can only receive requests from within the cluster VPC. The default value for this parameter is true , which enables public access for your Kubernetes API server.
   *
   * @schema ClusterPropsResourcesVpcConfig#EndpointPublicAccess
   */
  readonly endpointPublicAccess?: boolean;

  /**
   * Set this value to true to enable private access for your cluster's Kubernetes API server endpoint. If you enable private access, Kubernetes API requests from within your cluster's VPC use the private VPC endpoint. The default value for this parameter is false , which disables private access for your Kubernetes API server. If you disable private access and you have worker nodes or AWS Fargate pods in the cluster, then ensure that publicAccessCidrs includes the necessary CIDR blocks for communication with the worker nodes or Fargate pods.
   *
   * @schema ClusterPropsResourcesVpcConfig#EndpointPrivateAccess
   */
  readonly endpointPrivateAccess?: boolean;

  /**
   * The CIDR blocks that are allowed access to your cluster's public Kubernetes API server endpoint. Communication to the endpoint from addresses outside of the CIDR blocks that you specify is denied. The default value is 0.0.0.0/0 . If you've disabled private endpoint access and you have worker nodes or AWS Fargate pods in the cluster, then ensure that you specify the necessary CIDR blocks.
   *
   * @schema ClusterPropsResourcesVpcConfig#PublicAccessCidrs
   */
  readonly publicAccessCidrs?: string[];

}

/**
 * The encryption configuration for the cluster.
 *
 * @schema EncryptionConfigEntry
 */
export interface EncryptionConfigEntry {
  /**
   * Specifies the resources to be encrypted. The only supported value is "secrets".
   *
   * @schema EncryptionConfigEntry#Resources
   */
  readonly resources?: string[];

  /**
   * @schema EncryptionConfigEntry#Provider
   */
  readonly provider?: Provider;

}

/**
 * @schema ClusterPropsKubernetesApiAccess
 */
export interface ClusterPropsKubernetesApiAccess {
  /**
   * @schema ClusterPropsKubernetesApiAccess#Roles
   */
  readonly roles?: KubernetesApiAccessEntry[];

  /**
   * @schema ClusterPropsKubernetesApiAccess#Users
   */
  readonly users?: KubernetesApiAccessEntry[];

}

/**
 * @schema ClusterPropsTags
 */
export interface ClusterPropsTags {
  /**
   * @schema ClusterPropsTags#Value
   */
  readonly value?: string;

  /**
   * @schema ClusterPropsTags#Key
   */
  readonly key?: string;

}

/**
 * AWS Key Management Service (AWS KMS) customer master key (CMK). Either the ARN or the alias can be used.
 *
 * @schema Provider
 */
export interface Provider {
  /**
   * Amazon Resource Name (ARN) or alias of the customer master key (CMK). The CMK must be symmetric, created in the same region as the cluster, and if the CMK was created in a different account, the user must have access to the CMK.
   *
   * @schema Provider#KeyArn
   */
  readonly keyArn?: string;

}

/**
 * @schema KubernetesApiAccessEntry
 */
export interface KubernetesApiAccessEntry {
  /**
   * @schema KubernetesApiAccessEntry#Arn
   */
  readonly arn?: string;

  /**
   * @schema KubernetesApiAccessEntry#Username
   */
  readonly username?: string;

  /**
   * @schema KubernetesApiAccessEntry#Groups
   */
  readonly groups?: string[];

}
```
