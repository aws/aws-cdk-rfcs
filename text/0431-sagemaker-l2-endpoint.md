SageMaker Model Hosting L2 Constructs

* **Original Author(s):** @petermeansrock, @mattmcclean, @l2yao, @jetterdj, @foxpro24, @rangoju
* **Tracking Issue**: #431
* **API Bar Raiser**: *TBD*

This feature supports the creation of Amazon SageMaker real-time inference hosted endpoints using a
new set of L2 constructs for the `Endpoint`, `EndpointConfig`, and `Model` CloudFormation resources.

## Working Backwards

### CHANGELOG

`feat(sagemaker): add model hosting L2 constructs`

### README

---

# Amazon SageMaker Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

> All classes with the `Cfn` prefix in this module ([CFN Resources]) are always stable and safe to use.
>
> [CFN Resources]: https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development.
> They are subject to non-backward compatible changes or removal in any future version. These are
> not subject to the [Semantic Versioning](https://semver.org/) model and breaking changes will be
> announced in the release notes. This means that while you may use them, you may need to update
> your source code when upgrading to a newer version of this package.

---

<!--END STABILITY BANNER-->

Amazon SageMaker provides every developer and data scientist with the ability to build, train, and
deploy machine learning models quickly. Amazon SageMaker is a fully-managed service that covers the
entire machine learning workflow to label and prepare your data, choose an algorithm, train the
model, tune and optimize it for deployment, make predictions, and take action. Your models get to
production faster with much less effort and lower cost.

## Installation

Install the module:

```console
$ npm i @aws-cdk/aws-sagemaker
```

Import it into your code:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
```

## Model

To create a machine learning model with Amazon Sagemaker, use the `Model` construct. This construct
includes properties that can be configured to define model components, including the model inference
code as a Docker image and an optional set of separate model data artifacts. See the [AWS
documentation](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-marketplace-develop.html)
to learn more about SageMaker models.

### Single Container Model

In the event that a single container is sufficient for your inference use-case, you can define a
single-container model:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
import * as path from 'path';

const image = sagemaker.ContainerImage.fromAsset(path.join('path', 'to', 'Dockerfile', 'directory'));
const modelData = sagemaker.ModelData.fromAsset(path.join('path', 'to', 'artifact', 'file.tar.gz'));

const model = new sagemaker.Model(this, 'PrimaryContainerModel', {
  containers: [
    {
      image: image,
      modelData: modelData,
    }
  ]
});
```

### Inference Pipeline Model

An inference pipeline is an Amazon SageMaker model that is composed of a linear sequence of multiple
containers that process requests for inferences on data. See the [AWS
documentation](https://docs.aws.amazon.com/sagemaker/latest/dg/inference-pipelines.html) to learn
more about SageMaker inference pipelines. To define an inference pipeline, you can provide
additional containers for your model:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

declare const image1: sagemaker.ContainerImage;
declare const modelData1: sagemaker.ModelData;
declare const image2: sagemaker.ContainerImage;
declare const modelData2: sagemaker.ModelData;
declare const image3: sagemaker.ContainerImage;
declare const modelData3: sagemaker.ModelData;

const model = new sagemaker.Model(this, 'InferencePipelineModel', {
  containers: [
    { image: image1, modelData: modelData1 },
    { image: image2, modelData: modelData2 },
    { image: image3, modelData: modelData3 }
  ],
});
```

### Container Images

Inference code can be stored in the Amazon EC2 Container Registry (Amazon ECR), which is specified
via `ContainerDefinition`'s `image` property which accepts a class that extends the `ContainerImage`
abstract base class.

#### Asset Image

Reference a local directory containing a Dockerfile:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
import * as path from 'path';

const image = sagemaker.ContainerImage.fromAsset(path.join('path', 'to', 'Dockerfile', 'directory'));
```

#### ECR Image

Reference an image available within ECR:

```typescript
import * as ecr from '@aws-cdk/aws-ecr';
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const repository = ecr.Repository.fromRepositoryName(this, 'Repository', 'repo');
const image = sagemaker.ContainerImage.fromEcrRepository(repository, 'tag');
```

### Model Artifacts

If you choose to decouple your model artifacts from your inference code (as is natural given
different rates of change between inference code and model artifacts), the artifacts can be
specified via the `modelData` property which accepts a class that extends the `ModelData` abstract
base class. The default is to have no model artifacts associated with a model.

#### Asset Model Data

Reference local model data:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
import * as path from 'path';

const modelData = sagemaker.ModelData.fromAsset(path.join('path', 'to', 'artifact', 'file.tar.gz'));
```

#### S3 Model Data

Reference an S3 bucket and object key as the artifacts for a model:

```typescript
import * as s3 from '@aws-cdk/aws-s3';
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const bucket = new s3.Bucket(this, 'MyBucket');
const modelData = sagemaker.ModelData.fromBucket(bucket, 'path/to/artifact/file.tar.gz');
```

## Model Hosting

Amazon SageMaker provides model hosting services for model deployment. Amazon SageMaker provides an
HTTPS endpoint where your machine learning model is available to provide inferences.

### Endpoint Configuration

By using the `EndpointConfig` construct, you can define a set of endpoint configuration which can be
used to provision one or more endpoints. In this configuration, you identify one or more models to
deploy and the resources that you want Amazon SageMaker to provision. You define one or more
production variants, each of which identifies a model. Each production variant also describes the
resources that you want Amazon SageMaker to provision. If you are hosting multiple models, you also
assign a variant weight to specify how much traffic you want to allocate to each model. For example,
suppose that you want to host two models, A and B, and you assign traffic weight 2 for model A and 1
for model B. Amazon SageMaker distributes two-thirds of the traffic to Model A, and one-third to
model B:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

declare const modelA: sagemaker.Model;
declare const modelB: sagemaker.Model;

const endpointConfig = new sagemaker.EndpointConfig(this, 'EndpointConfig', {
  instanceProductionVariants: [
    {
      model: modelA,
      variantName: 'modelA',
      initialVariantWeight: 2.0,
    },
    {
      model: modelB,
      variantName: 'variantB',
      initialVariantWeight: 1.0,
    },
  ]
});
```

### Endpoint

When you create an endpoint from an `EndpointConfig`, Amazon SageMaker launches the ML compute
instances and deploys the model or models as specified in the configuration. To get inferences from
the model, client applications send requests to the Amazon SageMaker Runtime HTTPS endpoint. For
more information about the API, see the
[InvokeEndpoint](https://docs.aws.amazon.com/sagemaker/latest/dg/API_runtime_InvokeEndpoint.html)
API. Defining an endpoint requires at minimum the associated endpoint configuration:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

declare const endpointConfig: sagemaker.EndpointConfig;

const endpoint = new sagemaker.Endpoint(this, 'Endpoint', { endpointConfig });
```

### AutoScaling

To enable autoscaling on the production variant, use the `autoScaleInstanceCount` method:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

declare const endpointConfig: sagemaker.EndpointConfig;

const endpoint = new sagemaker.Endpoint(this, 'Endpoint', { endpointConfig });
const productionVariant = endpoint.findInstanceProductionVariant('variantName');
const instanceCount = productionVariant.autoScaleInstanceCount({
  maxCapacity: 3
});
instanceCount.scaleOnInvocations('LimitRPS', {
  maxRequestsPerSecond: 30,
});
```

For load testing guidance on determining the maximum requests per second per instance, please see
this [documentation](https://docs.aws.amazon.com/sagemaker/latest/dg/endpoint-scaling-loadtest.html).

### Metrics

To monitor CloudWatch metrics for a production variant, use one or more of the metric convenience
methods:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

declare const endpointConfig: sagemaker.EndpointConfig;

const endpoint = new sagemaker.Endpoint(this, 'Endpoint', { endpointConfig });
const productionVariant = endpoint.findInstanceProductionVariant('variantName');
productionVariant.metricModelLatency().createAlarm(this, 'ModelLatencyAlarm', {
  threshold: 100000,
  evaluationPeriods: 3,
});
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[x] Signed-off by API Bar Raiser @conroyka
```

## Public FAQ

### What are we launching today?

We are launching the first set of L2 constructs for the SageMaker module, introducing the `Endpoint`
construct alongside its dependencies `EndpointConfig` and `Model`. Together, these constructs enable
customers to deploy a machine learning model to an Amazon SageMaker-hosted endpoint which can be
used for real-time inference via SageMaker's `InvokeEndpoint` API.

### Why should I use this feature?

SageMaker hosting for real-time inference provides a fully-managed, auto-scalable solution to
customers wishing to deploy machine learning models behind an interactive endpoint.

## Internal FAQ

### Why are we doing this?

The [tracking GitHub issue for the module](https://github.com/aws/aws-cdk/issues/6870) has 48 +1s,
so there appears to be sufficient public demand for higher-level constructs above the existing L1s.

As SageMaker models are composed of an algorithm (expressed as a Docker image) and data (expressed
as an S3 object), the CDK's support for image and file assets would allow a customer to fully
specify their endpoints' AWS infrastructure and resource dependencies solely using the CDK.

Assets aside, a multi-variant, auto-scalable, CloudWatch-monitored endpoint within a VPC can be
specified in just under 100 lines of code [using the proposed L2 CDK constructs][endpoint-cdk] which
[generates a 1000+ line CloudFormation template][endpoint-cfn]. Producing an equivalent template
using the existing SageMaker L1 constructs can prove challenging for customers as they have to
stitch together the L1 SageMaker attributes (e.g., production variant names) to L2 constructs from
other modules (e.g., CloudWatch, Application Auto Scaling) leaving room for manual error.

[endpoint-cdk]: https://github.com/petermeansrock/aws-cdk/blob/43afc4259954c4b3708cf2b867cec6690e744423/packages/@aws-cdk/aws-sagemaker/test/integ.endpoint.ts
[endpoint-cfn]: https://github.com/petermeansrock/aws-cdk/blob/43afc4259954c4b3708cf2b867cec6690e744423/packages/@aws-cdk/aws-sagemaker/test/endpoint.integ.snapshot/aws-cdk-sagemaker-endpoint.template.json

### Why should we _not_ do this?

In the time since the original PR for these constructs was authored in 2020, SageMaker has expanded
its feature set to include [Amazon SageMaker Pipelines][sagemaker-pipelines], a CI/CD offering for
training and deploying models. This offering directs customers to SageMaker Studio for interacting
with their pipeline, which itself can be programmatically manipulated using the SageMaker Python
SDK. Given the user experience difference between these new SageMaker products and other AWS
infrastructure-as-code solutions (e.g., CloudFormation and the CDK), it's unclear how broader
adoption of SageMaker CDK constructs aligns with the SageMaker product vision.

[sagemaker-pipelines]: https://aws.amazon.com/sagemaker/pipelines/

### What is the technical solution (design) of this feature?

The proposed design has been fully implemented in
[CDK PR #20113](https://github.com/aws/aws-cdk/pull/20113). Each of the following sections lays out
the proposed interfaces needed for each L2 construct along with any supporting classes.

#### Model

- `IModel` -- interface for defined and imported models

  ```ts
  export interface IModel extends cdk.IResource, iam.IGrantable, ec2.IConnectable {
    /**
     * Returns the ARN of this model.
     *
     * @attribute
     */
    readonly modelArn: string;

    /**
     * Returns the name of this model.
     *
     * @attribute
     */
    readonly modelName: string;

    /**
     * The IAM role associated with this Model.
     */
    readonly role?: iam.IRole;

    /**
     * Adds a statement to the IAM role assumed by the instance.
     */
    addToRolePolicy(statement: iam.PolicyStatement): void;
  }
  ```

- `ModelProps` -- configuration for defining a `Model`

  ```ts
  export interface ModelProps {
    /**
     * The IAM role that the Amazon SageMaker service assumes.
     *
     * @default - a new IAM role will be created.
     */
    readonly role?: iam.IRole;

    /**
     * Name of the SageMaker Model.
     *
     * @default - AWS CloudFormation generates a unique physical ID and uses that ID for the model's
     * name.
     */
    readonly modelName?: string;

    /**
     * The VPC to deploy model containers to.
     *
     * @default - none
     */
    readonly vpc?: ec2.IVpc;

    /**
     * The VPC subnets to use when deploying model containers.
     *
     * @default - none
     */
    readonly vpcSubnets?: ec2.SubnetSelection;

    /**
     * The security groups to associate to the Model. If no security groups are provided and 'vpc' is
     * configured, one security group will be created automatically.
     *
     * @default - A security group will be automatically created if 'vpc' is supplied
     */
    readonly securityGroups?: ec2.ISecurityGroup[];

    /**
     * Specifies the container definitions for this model, consisting of either a single primary
     * container or an inference pipeline of multiple containers.
     *
     * @default - none
     */
    readonly containers?: ContainerDefinition[];

    /**
     * Whether to allow the SageMaker Model to send all network traffic
     *
     * If set to false, you must individually add traffic rules to allow the
     * SageMaker Model to connect to network targets.
     *
     * Only used if 'vpc' is supplied.
     *
     * @default true
     */
    readonly allowAllOutbound?: boolean;
  }
  ```

- `ModelBase` -- abstract base definition class shared by defined and imported models

  ```ts
  abstract class ModelBase extends cdk.Resource implements IModel {
    /**
     * Returns the ARN of this model.
     * @attribute
     */
    public abstract readonly modelArn: string;
    /**
     * Returns the name of the model.
     * @attribute
     */
    public abstract readonly modelName: string;
    /**
     * Execution role for SageMaker Model
     */
    public abstract readonly role?: iam.IRole;
    /**
     * The principal this Model is running as
     */
    public abstract readonly grantPrincipal: iam.IPrincipal;
    /**
     * An accessor for the Connections object that will fail if this Model does not have a VPC
     * configured.
     */
    public get connections(): ec2.Connections { ... }
    /**
     * The actual Connections object for this Model. This may be unset in the event that a VPC has not
     * been configured.
     * @internal
     */
    protected _connections: ec2.Connections | undefined;

    /**
     * Adds a statement to the IAM role assumed by the instance.
     */
    public addToRolePolicy(statement: iam.PolicyStatement) { ... }
  }
  ```

- `Model` -- defines a SageMaker model (with helper methods for importing a model)

  ```ts
  export class Model extends ModelBase {
    /**
     * Imports a Model defined either outside the CDK or in a different CDK stack.
     * @param scope the Construct scope.
     * @param id the resource id.
     * @param modelName the name of the model.
     */
    public static fromModelName(scope: Construct, id: string, modelName: string): IModel { ... }

    /**
     * Imports a Model defined either outside the CDK or in a different CDK stack.
     * @param scope the Construct scope.
     * @param id the resource id.
     * @param attrs the attributes of the model to import.
     */
    public static fromModelAttributes(scope: Construct, id: string, attrs: ModelAttributes): IModel { ... }

    /**
     * Returns the ARN of this model.
     * @attribute
     */
    public readonly modelArn: string;
    /**
     * Returns the name of the model.
     * @attribute
     */
    public readonly modelName: string;
    /**
     * Execution role for SageMaker Model
     */
    public readonly role?: iam.IRole;
    /**
     * The principal this Model is running as
     */
    public readonly grantPrincipal: iam.IPrincipal;
    private readonly subnets: ec2.SelectedSubnets | undefined;

    constructor(scope: Construct, id: string, props: ModelProps = {}) { ... }
  }
  ```

##### Container Definition

When defining a model above, the `ContainerDefinition` interface encapsulates both the specification
of model inference code as a `ContainerImage` and an optional set of artifacts as `ModelData`. The
image is specified as a Docker registry path while the model artifacts must be stored in S3.

- `ContainerDefinition` -- describes the container, as part of model definition above

  ```ts
  export interface ContainerDefinition {
    /**
     * The image used to start a container.
     */
    readonly image: ContainerImage;

    /**
     * A map of environment variables to pass into the container.
     *
     * @default - none
     */
    readonly environment?: {[key: string]: string};

    /**
     * Hostname of the container.
     *
     * @default - none
     */
    readonly containerHostname?: string;

    /**
     * S3 path to the model artifacts.
     *
     * @default - none
     */
    readonly modelData?: ModelData;
  }
  ```

###### Container Image

The following interface and abstract class provide mechanisms for configuring a container image.
These closely mirror [analogous entities from the ECS module][ecs-image] but, rather than `bind`-ing
upon an ECS task definition, instead operate upon a SageMaker model.

[ecs-image]: https://github.com/aws/aws-cdk/blob/572b52c45a9eb08b62a0f9cc6520c1722089bae6/packages/@aws-cdk/aws-ecs/lib/container-image.ts

- `ContainerImageConfig` -- the configuration for creating a container image

  ```ts
  export interface ContainerImageConfig {
    /**
     * The image name. Images in Amazon ECR repositories can be specified by either using the full registry/repository:tag or
     * registry/repository@digest.
     *
     * For example, 012345678910.dkr.ecr.<region-name>.amazonaws.com/<repository-name>:latest or
     * 012345678910.dkr.ecr.<region-name>.amazonaws.com/<repository-name>@sha256:94afd1f2e64d908bc90dbca0035a5b567EXAMPLE.
     */
    readonly imageName: string;
  }
  ```

- `ContainerImage` -- abstract class defining `bind` contract for images alongside static factory
  methods to enable different sources (e.g., image in ECR repository, local Dockerfile)

  ```ts
  export abstract class ContainerImage {
    /**
     * Reference an image in an ECR repository
     */
    public static fromEcrRepository(repository: ecr.IRepository, tag: string = 'latest'): ContainerImage { ... }

    /**
     * Reference an image that's constructed directly from sources on disk
     * @param directory The directory where the Dockerfile is stored
     * @param options The options to further configure the selected image
     */
    public static fromAsset(directory: string, options: assets.DockerImageAssetOptions = {}): ContainerImage { ... }

    /**
     * Called when the image is used by a Model
     */
    public abstract bind(scope: Construct, model: Model): ContainerImageConfig;
  }
  ```

###### Model Data

Analogous to the above pairing of `ContainerImageConfig` and `ContainerImage`, the following
interface and abstract class provide mechanisms for customers to specify the source of their model
artifacts, either in an S3 bucket or a local file asset.

- `ModelDataConfig` -- the configuration needed to reference model artifacts

  ```ts
  export interface ModelDataConfig {
    /**
     * The S3 path where the model artifacts, which result from model training, are stored. This path
     * must point to a single gzip compressed tar archive (.tar.gz suffix).
     */
    readonly uri: string;
  }
  ```

- `ModelData` -- model data represents the source of model artifacts, which will ultimately be
  loaded from an S3 location

  ```ts
  export abstract class ModelData {
    /**
     * Constructs model data which is already available within S3.
     * @param bucket The S3 bucket within which the model artifacts are stored
     * @param objectKey The S3 object key at which the model artifacts are stored
     */
    public static fromBucket(bucket: s3.IBucket, objectKey: string): ModelData { ... }

    /**
     * Constructs model data that will be uploaded to S3 as part of the CDK app deployment.
     * @param path The local path to a model artifact file as a gzipped tar file
     * @param options The options to further configure the selected asset
     */
    public static fromAsset(path: string, options: assets.AssetOptions = {}): ModelData { ... }

    /**
     * This method is invoked by the SageMaker Model construct when it needs to resolve the model
     * data to a URI.
     * @param scope The scope within which the model data is resolved
     * @param model The Model construct performing the URI resolution
     */
    public abstract bind(scope: Construct, model: IModel): ModelDataConfig;
  }
  ```

#### Endpoint Configuration

- `IEndpointConfig` -- the interface for a SageMaker EndpointConfig resource

  ```ts
  export interface IEndpointConfig extends cdk.IResource {
    /**
     * The ARN of the endpoint configuration.
     *
     * @attribute
     */
    readonly endpointConfigArn: string;
    /**
     * The name of the endpoint configuration.
     *
     * @attribute
     */
    readonly endpointConfigName: string;
  }
  ```

- `EndpointConfigProps` -- construction properties for a SageMaker EndpointConfig

  ```ts
  export interface EndpointConfigProps {
    /**
     * Name of the endpoint configuration.
     *
     * @default - AWS CloudFormation generates a unique physical ID and uses that ID for the
     * endpoint configuration's name.
     */
    readonly endpointConfigName?: string;

    /**
     * Optional KMS encryption key associated with this stream.
     *
     * @default - none
     */
    readonly encryptionKey?: kms.IKey;

    /**
     * A list of instance production variants. You can always add more variants later by calling
     * {@link EndpointConfig#addInstanceProductionVariant}.
     *
     * @default - none
     */
    readonly instanceProductionVariants?: InstanceProductionVariantProps[];
  }
  ```

- `EndpointConfig` -- defines a SageMaker EndpointConfig (with helper methods for importing an
  endpoint config)

  ```ts
  export class EndpointConfig extends cdk.Resource implements IEndpointConfig {
    /**
     * Imports an EndpointConfig defined either outside the CDK or in a different CDK stack.
     * @param scope the Construct scope.
     * @param id the resource id.
     * @param endpointConfigName the name of the endpoint configuration.
     */
    public static fromEndpointConfigName(scope: Construct, id: string, endpointConfigName: string): IEndpointConfig { ... }

    /**
     * The ARN of the endpoint configuration.
     */
    public readonly endpointConfigArn: string;
    /**
     * The name of the endpoint configuration.
     */
    public readonly endpointConfigName: string;

    constructor(scope: Construct, id: string, props: EndpointConfigProps = {}) { ... }

    /**
     * Add instance production variant to the endpoint configuration.
     *
     * @param props The properties of a production variant to add.
     */
    public addInstanceProductionVariant(props: InstanceProductionVariantProps): void { ... }

    /**
     * Get instance production variants associated with endpoint configuration.
     */
    public get instanceProductionVariants(): InstanceProductionVariant[] { ... }

    /**
     * Find instance production variant based on variant name
     * @param name Variant name from production variant
     */
    public findInstanceProductionVariant(name: string): InstanceProductionVariant { ... }
  }
  ```

##### Production Variants

To accommodate A/B testing of model behaviors, an endpoint config supports the specification of
multiple production variants. Each variant's weight determines the traffic distribution to itself
relative to the other configured variants.

- `ProductionVariantProps` -- common construction properties for all production variant types (e.g.,
  instance, serverless) (note, not exported)

  ```ts
  interface ProductionVariantProps {
    /**
     * Determines initial traffic distribution among all of the models that you specify in the
     * endpoint configuration. The traffic to a production variant is determined by the ratio of the
     * variant weight to the sum of all variant weight values across all production variants.
     *
     * @default 1.0
     */
    readonly initialVariantWeight?: number;
    /**
     * The model to host.
     */
    readonly model: IModel;
    /**
     * Name of the production variant.
     */
    readonly variantName: string;
  }
  ```

- `InstanceProductionVariantProps` -- construction properties for an instance production variant

  ```ts
  export interface InstanceProductionVariantProps extends ProductionVariantProps {
    /**
    * The size of the Elastic Inference (EI) instance to use for the production variant. EI instances
    * provide on-demand GPU computing for inference.
    *
    * @default - none
    */
    readonly acceleratorType?: AcceleratorType;
    /**
    * Number of instances to launch initially.
    *
    * @default 1
    */
    readonly initialInstanceCount?: number;
    /**
    * Instance type of the production variant.
    *
    * @default - ml.t2.medium instance type.
    */
    readonly instanceType?: InstanceType;
  }
  ```

- `ProductionVariant` -- represents common attributes of all production variant types (e.g.,
  instance, serverless) once associated to an EndpointConfig (note, not exported)

  ```ts
  interface ProductionVariant {
    /**
     * Determines initial traffic distribution among all of the models that you specify in the
    * endpoint configuration. The traffic to a production variant is determined by the ratio of the
    * variant weight to the sum of all variant weight values across all production variants.
    */
    readonly initialVariantWeight: number;
    /**
     * The name of the model to host.
    */
    readonly modelName: string;
    /**
     * The name of the production variant.
    */
    readonly variantName: string;
  }
  ```

- `InstanceProductionVariant` -- represents an instance production variant that has been associated
  with an `EndpointConfig`

  ```ts
  export interface InstanceProductionVariant extends ProductionVariant {
    /**
    * The size of the Elastic Inference (EI) instance to use for the production variant. EI instances
    * provide on-demand GPU computing for inference.
    *
    * @default - none
    */
    readonly acceleratorType?: AcceleratorType;
    /**
    * Number of instances to launch initially.
    */
    readonly initialInstanceCount: number;
    /**
    * Instance type of the production variant.
    */
    readonly instanceType: InstanceType;
  }
  ```

- `AcceleratorType` -- enum-like class of supported Elastic Inference (EI) instance types for
  SageMaker instance-based production variants; EI instances provide on-demand GPU computing for
  inference

  ```ts
  export class AcceleratorType {
    /**
     * ml.eia1.large
     */
    public static readonly EIA1_LARGE = AcceleratorType.of('ml.eia1.large');

    /* Additional supported accelerator types */

    /**
     * Builds an AcceleratorType from a given string or token (such as a CfnParameter).
     * @param acceleratorType An accelerator type as string
     * @returns A strongly typed AcceleratorType
     */
    public static of(acceleratorType: string): AcceleratorType;

    /**
     * Return the accelerator type as a string
     * @returns The accelerator type as a string
     */
    public toString(): string;
  }
  ```

- `InstanceType` -- enum-like class of supported instance types for SageMaker instance-based
  production variants

  ```ts
  export class InstanceType {
    /**
     * ml.c4.2xlarge
     */
    public static readonly C4_2XLARGE = InstanceType.of('ml.c4.2xlarge');

    /* Additional supported instance types */

    /**
     * Builds an InstanceType from a given string or token (such as a CfnParameter).
     * @param instanceType An instance type as string
     * @returns A strongly typed InstanceType
     */
    public static of(instanceType: string): InstanceType;
  }
  ```

#### Endpoint

- `IEndpoint` -- the interface for a SageMaker Endpoint resource

  ```ts
  export interface IEndpoint extends cdk.IResource {
    /**
     * The ARN of the endpoint.
     *
     * @attribute
     */
    readonly endpointArn: string;
    /**
     * The name of the endpoint.
     *
     * @attribute
     */
    readonly endpointName: string;

    /**
     * Permits an IAM principal to invoke this endpoint
     * @param grantee The principal to grant access to
     */
    grantInvoke(grantee: iam.IGrantable): iam.Grant;
  }
  ```

- `EndpointProps` -- construction properties for a SageMaker endpoint

  ```ts
  export interface EndpointProps {

    /**
     * Name of the endpoint.
     *
     * @default - AWS CloudFormation generates a unique physical ID and uses that ID for the
     * endpoint's name.
     */
    readonly endpointName?: string;

    /**
     * The endpoint configuration to use for this endpoint.
     */
    readonly endpointConfig: IEndpointConfig;
  }
  ```

- `EndpointBase` -- abstract base definition class shared by defined and imported endpoints

  ```ts
  abstract class EndpointBase extends cdk.Resource implements IEndpoint {
    /**
     * The ARN of the endpoint.
     *
     * @attribute
     */
    public abstract readonly endpointArn: string;

    /**
     * The name of the endpoint.
     *
     * @attribute
     */
    public abstract readonly endpointName: string;

    /**
     * Permits an IAM principal to invoke this endpoint
     * @param grantee The principal to grant access to
     */
    public grantInvoke(grantee: iam.IGrantable) { ... }
  }
  ```

- `Endpoint` -- defines a SageMaker endpoint (with helper methods for importing an endpoint)

  ```ts
  export class Endpoint extends EndpointBase {
    /**
     * Imports an Endpoint defined either outside the CDK or in a different CDK stack.
     * @param scope the Construct scope.
     * @param id the resource id.
     * @param endpointName the name of the endpoint.
     */
    public static fromEndpointName(scope: Construct, id: string, endpointName: string): IEndpoint { ... }

    /**
     * The ARN of the endpoint.
     *
     * @attribute
     */
    public readonly endpointArn: string;
    /**
     * The name of the endpoint.
     *
     * @attribute
     */
    public readonly endpointName: string;

    constructor(scope: Construct, id: string, props: EndpointProps) { ... }

    /**
     * Get instance production variants associated with endpoint.
     */
    public get instanceProductionVariants(): IEndpointInstanceProductionVariant[] { ... }

    /**
     * Find instance production variant based on variant name
     * @param name Variant name from production variant
     */
    public findInstanceProductionVariant(name: string): IEndpointInstanceProductionVariant { ... }
  }
  ```

##### Endpoint Production Variants

When monitoring or auto-scaling real-time inference endpoints, both CloudWatch and Application Auto
Scaling operate at the level of endpoint name + variant name. For this reason, once a variant has
been attached to an endpoint, this RFC allows customers to retrieve
`IEndpointInstanceProductionVariant` object instances from their endpoint for the purposes of
referencing CloudWatch metrics or an Application Auto Scaling `BaseScalableAttribute`.

- `IEndpointProductionVariant` -- represents the features common to all production variant types
  (e.g., instance, serverless) that have been associated with an endpoint (note, not exported)

  ```ts
  interface IEndpointProductionVariant {
    /**
     * The name of the production variant.
     */
    readonly variantName: string;
    /**
     * Return the given named metric for Endpoint
     *
     * @default - sum over 5 minutes
     */
    metric(namespace: string, metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  }
  ```

- `IEndpointInstanceProductionVariant` -- represents an instance production variant that has been
  associated with an endpoint

  ```ts
  export interface IEndpointInstanceProductionVariant extends IEndpointProductionVariant {
    /**
     * Metric for the number of invocations
     *
     * @default - sum over 5 minutes
     */
    metricInvocations(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for the number of invocations per instance
     *
     * @default - sum over 5 minutes
     */
    metricInvocationsPerInstance(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for model latency
     *
     * @default - average over 5 minutes
     */
    metricModelLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for overhead latency
     *
     * @default - average over 5 minutes
     */
    metricOverheadLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for the number of invocations by HTTP response code
     *
     * @default - sum over 5 minutes
     */
    metricInvocationResponseCode(responseCode: InvocationHttpResponseCode, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for disk utilization
     *
     * @default - average over 5 minutes
     */
    metricDiskUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for CPU utilization
     *
     * @default - average over 5 minutes
     */
    metricCpuUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for memory utilization
     *
     * @default - average over 5 minutes
     */
    metricMemoryUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for GPU utilization
     *
     * @default - average over 5 minutes
     */
    metricGpuUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Metric for GPU memory utilization
     *
     * @default - average over 5 minutes
     */
    metricGpuMemoryUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    /**
     * Enable autoscaling for SageMaker Endpoint production variant
     *
     * @param scalingProps EnableScalingProps
     */
    autoScaleInstanceCount(scalingProps: appscaling.EnableScalingProps): ScalableInstanceCount;
  }

  class EndpointInstanceProductionVariant implements IEndpointInstanceProductionVariant { ... }
  ```

### Is this a breaking change?

No.

### What alternative solutions did you consider?

1. In the [earliest PR][earliest-pr] attempting to add SageMaker L2 constructs to the CDK, the
   author did not create an `EndpointConfig` construct, instead hiding the resource's creation
   behind `Endpoint` (to which production variants could be added). Although a simplifier, this
   prevents customers from reusing configuration across endpoints. For this reason, an explicit
   L2 construct for endpoint configuration was incorporated into this RFC. This enables use-cases
   like the following:
    1. Producer A exposes ten endpoints, each unique to a different consumer (let's label these B
       thru K).
    1. Each of these endpoints could use one of, say, three endpoint configs (let's label these 1
       thru 3) based on the features needed by each consumer.
    1. Consumer B's endpoint is currently associated with endpoint config 1.
    1. At some later point, consumer B wants to leverage a new feature, so in collaboration with the
       consumer, producer A updates B's endpoint to reference endpoint config 3. As a result,
       without switching endpoints, consumer B was able to begin using the features enabled via the
       pre-built, shared endpoint config 3.

[earliest-pr]: https://github.com/aws/aws-cdk/pull/2888

### What are the drawbacks of this solution?

Since production variants are configured via the `EndpointConfig` construct while the monitoring and
auto-scaling of a deployed production variant is only possible once the `EndpointConfig` has
been associated to an `Endpoint` (i.e., the dimension for most SageMaker model hosting metrics
consists of endpoint name and production variant name), this RFC proposes the implementation of the
function `Endpoint.findProductionVariant(string)`, the [return value for
which](#endpoint-production-variants) contains `metric*` and `autoScaleInstanceCount` helper methods
as demonstrated in the [README](#metrics). Although not necessarily a drawback, this separation of
configuration-time and deploy-time APIs appears to be a novel pattern for the CDK, and thus, has the
potential to be confusing to customers.

### What is the high-level project plan?

As the proposed design has been fully implemented in
[CDK PR #20113](https://github.com/aws/aws-cdk/pull/20113), the delivery timeline of the
implementation of this RFC will be contingent upon the scope of changes requested by reviewers. For
baking, the L2 constructs for this module would be marked as experimental, leaving room for further
adjustments prior to marking the APIs as stable.

### Are there any open issues that need to be addressed later?

#### Feature Additions

The following list describes at a high-level future additions that can be made to the L2 constructs
to enable SageMaker features not yet covered by this RFC but are already supported via
CloudFormation. For the purposes of this RFC, this list should be reviewed to ensure that the
proposed APIs are appropriately extensible in order to support these use-cases.

1. `AWS::SageMaker::EndpointConfig` features:
    1. [Serverless Inference][serverless-inference]: By default, upon endpoint deployment,
       SageMaker will provision EC2 instances (managed by SageMaker) for hosting purposes. To shield
       customers from the complexity of forecasting fleet sizes, the `ServerlessConfig` attribute
       was added to the `ProductionVariant` CloudFormation structure of an endpoint config resource.
       This configuration removes the need for customers to specify instance-specific settings
       (e.g., instance count, instance type), abstracting the runtime compute from customers, much
       in the same way Lambda does for its customers. In preparation for the addition of this
       feature into the CDK, all concrete production variant related classes and attributes have
       been prefixed with the string `[Ii]nstance` to designate that they are only associated with
       instance-based hosting. When later adding serverless support to the SageMaker module,
       `[Ss]erverless`-prefixed analogs can be created with attributes appropriate for the use-case
       with appropriate plumbing to the L1 constructs. Note, there are a [number of features which
       do not yet work with serverless variants][serverless-exclusions], so it may be necessary to
       incorporate a number of new synthesis-time checks or compile-time contracts to guard against
       mixing incompatible features. For example, as [discussed with the bar
       raiser][design-conversation], alongside the proposed `EndpointConfigProps` attribute
       `instanceProductionVariants?: InstanceProductionVariantProps[]`, a new mutually exclusive
       attribute `serverlessProductionVariant?: ServerlessProductionVariantProps` (as only a single
       variant is supported with serverless inference) could be added with a synthesis-time check
       confirming that the customer hasn't configured both instance-based and serverless production variants.
    1. [Asynchronous Inference][async-inference]: By default, a deployed endpoint is synchronous:
       a customer issues an InvokeEndpoint operation to SageMaker with an attached input payload and
       the resulting response contains the output payload from the endpoint. To instead support
       asynchronous invocation, the `AsyncInferenceClientConfig` CloudFormation attribute was added
       to the endpoint config resource. To interact with an asynchronous endpoint, a customer issues
       an InvokeEndpointAsync operation to SageMaker with an attached input location in S3;
       SageMaker asynchronously reads the input from S3, invokes the endpoint, and writes the output
       to an S3 location specified within the `AsyncInferenceClientConfig` attribute. As [discussed
       with the RFC bar raiser here][design-conversation], there are a few ways to tackle the
       addition of this functionlity. One option is to add attribute(s) to the L2 endpoint config
       construct to support asynchronous inference along with synthesis-time error handling to
       catch configuration conflicts (e.g., asynchronous endpoints are only capable of supporting
       a single instance-based production variant today). Alternatively, an `AsyncEndpointConfig`
       subclass of `EndpointConfig` could be introduced to provide a better compile-time contract
       to customers (while still implementing the generic functionality within `EndpointConfig`).
       Either way, the proposed contracts would only undergo backward-compatible changes.
    1. [Model Monitoring][model-monitor]: For the purposes of monitoring model performance, the
       `DataCaptureConfig` CloudFormation attribute was added which allows customers to configure a
       sampling rate of input and/or output endpoint requests that SageMaker should publish to an S3
       destination. This functionlity is a side-effect of normal endpoint operation and has no
       bearing on other construct APIs, meaning its addition should be confined to new attribute(s)
       on the endpoint config construct.
1. `AWS::SageMaker::Endpoint` features:
    1. [Retention of Variant Properties][retain-variant-properties]: Once an endpoint has been
       deployed, the desired instance count and desired weight can be dynamically adjusted _per
       production variant_ without changing the backing endpoint config resource. These changes can
       either be made automatically via Application Auto Scaling or manually by the customer via
       the SageMaker UpdateEndpointWeightsAndCapacities operation. After making such changes, by
       default, when updating a SageMaker endpoint to use a new endpoint config resource (such as
       when making a CloudFormation change an endpoint config that results in resource replacement),
       the desired instance count and desired weight is reset to match the new endpoint config
       resource. To bypass this resetting of variant properties, the `RetainAllVariantProperties`
       boolean flag was added to the endpoint resource, which when set to true, will not reset these
       variant properties. In addition to this field, `ExcludeRetainedVariantProperties` was also
       added to the endpoint resource to allow for selective retention of variant properties (e.g.,
       keeping the desired instance count while resetting the desired weight). As the default
       behavior is already in place (no retention), adding the functionality should consist of
       incorporating new attribute(s) on the Endpoint L2 construct's props interface and plumbing
       it through to the underlying L1 resource definition.
    1. [Deployment Guardrails][deployment-guardrails]: By default, when updating an endpoint,
       SageMaker uses an all-at-once blue/green deployment strategy: a new fleet is provisioned
       with the new approrpriate configuration, and upon successful provisioning, the traffic is
       flipped and the old fleet is terminated. To augment this functionality, the
       `DeploymentConfig` attribute was added to the Endpoint resource which now allows (1) the
       specification of a CloudWatch alarm for auto-rollback and (2) additional deployment policies
       beyond all-at-once, including canary and linear deployment strategies (along with more fine-
       grained timing settings). Adding this functionlity should consist of incorporating new
       attribute(s) on the Endpoint L2 construct's props interface and plumbing it through to the
       underlying L1 resource definition. This work should also include support for the
       `RetainDeploymentConfig` boolean flag which controls whether to reuse the previous deployment
       configuration or use the new one. Note, there are a number of [SageMaker features which
       prevent the use of deployment configuration][deployment-guardrails-exclusions], so defending
       against combinations of features may improve the customer experience with the Endpoint
       construct.
1. `AWS::SageMaker::Model` features:
    1. [Multi-Model Endpoints][multi-model]: By default (and as [described in the technical solution
       above](#model-data)), SageMaker expects the model data URL on each container to point to an
       S3 object containing a gzipped tar file of artifacts, which will be automatically extracted
       upon instance provisioning. To support colocation of multiple logical models into a single
       container, the `Mode` attribute was added to the `ContainerDefinition` CloudFormation
       structure to either explicit configure `SingleModel` mode (the default) or `MultiModel` mode.
       In multi-model mode, SageMaker now expects the customer configured model data URL to point to
       an S3 path under which multiple gzipped tar files exist. When invoking a multi-model
       endpoint, the client invoking the endpoint must specify the target model representing the
       exact S3 path suffix pointing to a specific gzipped tar file. To accommodate this feature,
       the proposed `ModelData.fromAsset` API should be adjusted to support zip file assets capable
       of containing one or more gzipped tar files within them. Even though the code need not be
       aware of `.tar.gz` files specifically, it might prove a better customer experience to at
       least put up guard rails to prevent zip file assets from being used in single model mode
       where as multi-model mode could be more permissive.
    1. [Direct Invocation of Multi-Container Endpoints][multi-container]: By default (and as
       [described in the proposed README](#inference-pipeline-model)), when a customer specifies
       multiple containers for a model, the containers are treated as an inference pipeline (also
       referred to as a serial pipeline). This means that the containers are treated as an ordered
       list, wherein the output of one container at runtime is passed as input to the next. Only the
       output from the last container is surfaced to the client invoking the model. To support a
       different invocation paradigm, the `InferenceExecutionConfig` structure was added to the
       model CloudFormation resource which allows customers to either explicitly configure `Serial`
       invocation mode (the default, as an inference pipeline) or the new `Direct` invocation mode.
       When using direct mode, a client invoking an endpoint must specify a container to target with
       their request; SageMaker then invokes only that single container. As SageMaker exposes a new
       dimension for CloudWatch metrics specific to each directly-invokable container, other than
       exposing a new inference execution mode attribute on the `Model` construct, this feature
       would likely also warrant the addition of a `findContainer(containerHostName: string)` method
       to [`IEndpointProductionVariant`](#endpoint-production-variants) which will return a new
       interface on which additional `metric*` APIs are present for generating CloudWatch metrics
       against the dimension consisting of endpoint, variant, and container combined.
    1. [Private Docker Registries][private-docker]: The `ImageConfig` type was added to the existing
       `ContainerDefinition` CloudFormation structure in order for customers to specify that a
       VPC-connected Docker registry will act as the source of the container's image (as opposed to
       ECR which acts as the default platform repository). This new type also contains an optional
       `RepositoryAuthConfig` nested structure in order to specify the ARN of a Lambda function
       capable of serving repository credentials to SageMaker. In order to deliver this
       functionality in a backward-compatible way, inspiration can be taken from [ECS's
       `ContainerImage.fromRegistry` API][container-image-from-registry] (note though, ECS sources
       credentials from Secrets Manager rather than Lambda) in order to make the following
       additions to the SageMaker module:
         1. Add attributes to `ContainerImageConfig` to support the specification of a non-platform
            repository along with an optional Lambda function ARN.
         1. Implement a new, non-exported `RegistryImage` subclass of `ContainerImage` whose
            constructor takes an optional Lambda `IFunction` instance for generating a
            `ContainerImageConfig` instance with the appropriate Lambda function ARN for serving
            credentials.
         1. On `ContainerImage`, add a new static `fromRegistry` method which takes a props object
            consisting of an optional Lambda `IFunction` instance. This method acts as a simple
            static factory method for the non-exported `RegistryImage` class.
    1. [Network Isolation][network-isolation]: The `EnableNetworkIsolation` Cloudformation boolean
       flag (defaults to false) on a model resource prevents inbound and outbound network calls
       to/from the model container. Incorporating such an attribute into the Model L2 construct
       should not conflict with any proposed API.
    1. [AWS Marketplace Models][marketplace-models]: The `ModelPackageName` string attribute was
       added to the `ContainerDefinition` CloudFormation structure to specify the ARN of a reusable,
       versioned model which can be listed on the AWS Marketplace. When creating a `Model` resource
       from a model package, the customer need no longer specify a container image as the model
       package contains all information about the underlying container(s) required for inference. To
       incorporate this support into the SageMaker module, it would likely entail creating a new L2
       construct `ModelPackage` to represent the `AWS::SageMaker::ModelPackage` CloudFormation
       resource and modifying the proposed `ContainerDefinition` interface to support an optional
       `IModelPackage` as an attribute (while making `image: ContainerImage` an optional attribute).

[serverless-inference]: https://aws.amazon.com/about-aws/whats-new/2021/12/amazon-sagemaker-serverless-inference/
[async-inference]: https://aws.amazon.com/about-aws/whats-new/2021/08/amazon-sagemaker-asynchronous-new-inference-option/
[model-monitor]: https://aws.amazon.com/about-aws/whats-new/2019/12/introducing-amazon-sagemaker-model-monitor/
[retain-variant-properties]: https://aws.amazon.com/blogs/machine-learning/configuring-autoscaling-inference-endpoints-in-amazon-sagemaker/
[deployment-guardrails]: https://aws.amazon.com/about-aws/whats-new/2021/11/new-deployment-guardrails-amazon-sagemaker-inference-endpoints/
[multi-model]: https://aws.amazon.com/blogs/machine-learning/save-on-inference-costs-by-using-amazon-sagemaker-multi-model-endpoints/
[multi-container]: https://aws.amazon.com/blogs/machine-learning/deploy-multiple-serving-containers-on-a-single-instance-using-amazon-sagemaker-multi-container-endpoints/
[private-docker]: https://aws.amazon.com/about-aws/whats-new/2021/03/amazon-sagemaker-now-supports-private-docker-registry-authentication/
[network-isolation]: https://aws.amazon.com/blogs/security/secure-deployment-of-amazon-sagemaker-resources/
[marketplace-models]: https://aws.amazon.com/blogs/awsmarketplace/using-amazon-augmented-ai-with-aws-marketplace-machine-learning-models/

[serverless-exclusions]: https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html#serverless-endpoints-how-it-works-exclusions
[design-conversation]: https://github.com/aws/aws-cdk-rfcs/pull/433#discussion_r952949608
[deployment-guardrails-exclusions]: https://docs.aws.amazon.com/sagemaker/latest/dg/deployment-guardrails-exclusions.html
[container-image-from-registry]: https://github.com/aws/aws-cdk/blob/v1-main/packages/%40aws-cdk/aws-ecs/lib/container-image.ts#L14-L19

#### Rough Edges

1. As observed with [Lambda][lambda-eni-issue] and [EKS][eks-eni-issue], the Elastic Network
   Interfaces (ENIs) associated with a SageMaker model's VPC are not always cleaned up in a timely
   manner after downstream compute resources are deleted. As a result, attempts to delete a
   SageMaker endpoint along with its networking resources (e.g., subnets, security groups) from a
   CloudFormation stack [may cause the stack operation to fail as the ENIs are still in
   use][sagemaker-eni-issue]. From a CDK integration test perspective, specifying `--no-clean` will
   allow the generation of a snapshot regardless of whether stack deletion will succeed or fail but
   may hinder snapshot re-generation by subsequent CDK contributors. For this reason, it may be
   helpful to exclude VPC specification from the endpoint integration test at this time.

[lambda-eni-issue]: https://github.com/aws/aws-cdk/issues/12827
[eks-eni-issue]: https://github.com/aws/aws-cdk/issues/9970
[sagemaker-eni-issue]: https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/1327

#### Cross-module API Convergence

1. This RFC proposes a new [`ContainerImage` API](#container-image) for the SageMaker module which
   closely resembles the same-named API from the ECS module. The primary difference between the two
   is that the ECS module's API `bind`s on an ECS `TaskDefinition` whereas this new SageMaker
   module's API `bind`s on a SageMaker `Model`. There may be an opportunity to unify these APIs in
   the future assuming that `bind`ing to a common type would sufficient for both use-cases (e.g.,
   `IGrantable`).

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.
