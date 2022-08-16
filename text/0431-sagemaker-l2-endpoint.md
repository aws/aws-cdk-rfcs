SageMaker Model Hosting L2 Constructs

* **Original Author(s):** @pvanlund, @mattmcclean, @l2yao, @jetterdj, @foxpro24, @rangoju
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

In machine learning, a model is used to make predictions, or inferences. A deployable model in
SageMaker consists of inference code and model artifacts. Model artifacts are the results of model
training by using a machine learning algorithm. The inference code must be packaged in a Docker
container and stored in Amazon ECR. You can either package the model artifacts in the same container
as the inference code, or store them in Amazon S3. As model artifacts may change each time a new
model is trained (while the inference code may remain static), artifact separation in S3 may act as
a natural decoupling point for your application.

When instantiating the `Model` construct, you tell Amazon SageMaker where it can find these model
components. The `ContainerDefinition` interface encapsulates both the specification of model
inference code as a `ContainerImage` and an optional set of separate artifacts as `ModelData`.

### Single Container Model

In the event that a single container is sufficient for your inference use-case, you can define a
single-container model:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
import * as path from 'path';

const image = sagemaker.ContainerImage.fromAsset(this, 'Image', {
  directory: path.join('path', 'to', 'Dockerfile', 'directory')
});
const modelData = sagemaker.ModelData.fromAsset(this, 'ModelData',
  path.join('path', 'to', 'artifact', 'file.tar.gz'));

const model = new sagemaker.Model(this, 'PrimaryContainerModel', {
  container: {
    image: image,
    modelData: modelData,
  }
});
```

### Inference Pipeline Model

An inference pipeline is an Amazon SageMaker model that is composed of a linear sequence of two to
five containers that process requests for inferences on data. You use an inference pipeline to
define and deploy any combination of pretrained Amazon SageMaker built-in algorithms and your own
custom algorithms packaged in Docker containers. You can use an inference pipeline to combine
preprocessing, predictions, and post-processing data science tasks. Inference pipelines are fully
managed. To define an inference pipeline, you can provide additional containers for your model via
the `extraContainers` property:

```typescript fixture=with-assets
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const model = new sagemaker.Model(this, 'InferencePipelineModel', {
  container: {
    image: image1, modelData: modelData1
  },
  extraContainers: [
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

const image = sagemaker.ContainerImage.fromAsset(this, 'Image', {
  directory: path.join('path', 'to', 'Dockerfile', 'directory')
});
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

If you choose to decouple your model artifacts from your inference code, the artifacts can be
specified via the `modelData` property which accepts a class that extends the `ModelData` abstract
base class. The default is to have no model artifacts associated with a model.

#### Asset Model Data

Reference local model data:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
import * as path from 'path';

const modelData = sagemaker.ModelData.fromAsset(this, 'ModelData',
  path.join('path', 'to', 'artifact', 'file.tar.gz'));
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

In this configuration, you identify one or more models to deploy and the resources that you want
Amazon SageMaker to provision. You define one or more production variants, each of which identifies
a model. Each production variant also describes the resources that you want Amazon SageMaker to
provision. This includes the number and type of ML compute instances to deploy. If you are hosting
multiple models, you also assign a variant weight to specify how much traffic you want to allocate
to each model. For example, suppose that you want to host two models, A and B, and you assign
traffic weight 2 for model A and 1 for model B. Amazon SageMaker distributes two-thirds of the
traffic to Model A, and one-third to model B:

```typescript fixture=with-assets
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const endpointConfig = new sagemaker.EndpointConfig(this, 'EndpointConfig', {
  productionVariant: {
    model: modelA,
    variantName: 'modelA',
    initialVariantWeight: 2.0,
  },
  extraProductionVariants: [{
    model: modelB,
    variantName: 'variantB',
    initialVariantWeight: 1.0,
  }]
});
```

### Endpoint

If you create an endpoint from an `EndpointConfig`, Amazon SageMaker launches the ML compute
instances and deploys the model or models as specified in the configuration. To get inferences from
the model, client applications send requests to the Amazon SageMaker Runtime HTTPS endpoint. For
more information about the API, see the
[InvokeEndpoint](https://docs.aws.amazon.com/sagemaker/latest/dg/API_runtime_InvokeEndpoint.html)
API. Defining an endpoint requires at minimum the associated endpoint configuration:

```typescript fixture=with-endpoint-config
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const endpoint = new sagemaker.Endpoint(this, 'Endpoint', { endpointConfig });
```

### AutoScaling

To enable autoscaling on the production variant, use the `autoScaleInstanceCount` method:

```typescript fixture=with-endpoint-config
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const endpoint = new sagemaker.Endpoint(this, 'Endpoint', { endpointConfig });
const productionVariant = endpoint.findProductionVariant('variantName');
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

The `IEndpointProductionVariant` interface also provides a set of APIs for referencing CloudWatch
metrics associated with a production variant associated with an endpoint:

```typescript fixture=with-endpoint-config
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const endpoint = new sagemaker.Endpoint(this, 'Endpoint', { endpointConfig });
const productionVariant = endpoint.findProductionVariant('variantName');
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
[ ] Signed-off by API Bar Raiser @xxxxx
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
     * Specifies the primary container or the first container in an inference pipeline. Additional
     * containers for an inference pipeline can be provided using the "extraContainers" property.
     *
     */
    readonly container: ContainerDefinition;

    /**
     * Specifies additional containers for an inference pipeline.
     *
     * @default - none
     */
    readonly extraContainers?: ContainerDefinition[];

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

    constructor(scope: Construct, id: string, props: ModelProps) { ... }
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
These closely mirror [analogous entities from the `@aws-cdk/ecs` module][ecs-image] but, rather than
`bind`-ing upon an ECS task definition, instead operate upon a SageMaker model.

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
     *
     * @param scope The scope within which to create the image asset
     * @param id The id to assign to the image asset
     * @param props The properties of a Docker image asset
     */
    public static fromAsset(scope: Construct, id: string, props: assets.DockerImageAssetProps): ContainerImage { ... }

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
     * @param scope The scope within which to create a new asset
     * @param id The id to associate with the new asset
     * @param path The local path to a model artifact file as a gzipped tar file
     */
    public static fromAsset(scope: Construct, id: string, path: string): ModelData { ... }

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
     * A ProductionVariantProps object.
     */
    readonly productionVariant: ProductionVariantProps;

    /**
     * An optional list of extra ProductionVariantProps objects.
     *
     * @default - none
     */
    readonly extraProductionVariants?: ProductionVariantProps[];
  }
  ```

- `EndpointConfig` -- defines a SageMaker EndpointConfig  (with helper methods for importing an
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

    constructor(scope: Construct, id: string, props: EndpointConfigProps) { ... }

    /**
     * Add production variant to the endpoint configuration.
     *
     * @param props The properties of a production variant to add.
     */
    public addProductionVariant(props: ProductionVariantProps): void { ... }

    /**
     * Get production variants associated with endpoint configuration.
     */
    public get productionVariants(): ProductionVariant[] { ... }

    /**
     * Find production variant based on variant name
     * @param name Variant name from production variant
     */
    public findProductionVariant(name: string): ProductionVariant { ... }
  }
  ```

##### Production Variants

To accommodate A/B testing of model behaviors, an endpoint config supports the specification of
multiple production variants. Each variant's weight determines the traffic distribution to itself
relative to the other configured variants.

- `ProductionVariantProps` -- construction properties for a production variant

  ```ts
  export interface ProductionVariantProps {
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
     * Determines initial traffic distribution among all of the models that you specify in the
     * endpoint configuration. The traffic to a production variant is determined by the ratio of the
     * variant weight to the sum of all variant weight values across all production variants.
     *
     * @default 1.0
     */
    readonly initialVariantWeight?: number;
    /**
     * Instance type of the production variant.
     *
     * @default - ml.t2.medium instance type.
     */
    readonly instanceType?: ec2.InstanceType;
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

- `ProductionVariant` -- represents a production variant that has been associated with an
  `EndpointConfig`

  ```ts
  export interface ProductionVariant {
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
     * Determines initial traffic distribution among all of the models that you specify in the
     * endpoint configuration. The traffic to a production variant is determined by the ratio of the
     * variant weight to the sum of all variant weight values across all production variants.
     */
    readonly initialVariantWeight: number;
    /**
     * Instance type of the production variant.
     */
    readonly instanceType: ec2.InstanceType;
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

- `AcceleratorType` -- an enumeration of values representing the size of the Elastic Inference (EI)
  instance to use for the production variant. EI instances provide on-demand GPU computing for
  inference

  ```ts
  export enum AcceleratorType {
    /**
     * Medium accelerator type.
     */
    MEDIUM = 'ml.eia1.medium',
    /**
     * Large accelerator type.
     */
    LARGE = 'ml.eia1.large ',
    /**
     * Extra large accelerator type.
     */
    XLARGE = 'ml.eia1.xlarge',
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
     *
     * [disable-awslint:ref-via-interface]
     */
    readonly endpointConfig: EndpointConfig;
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
     * Get production variants associated with endpoint.
     */
    public get productionVariants(): IEndpointProductionVariant[] { ... }

    /**
     * Find production variant based on variant name
     * @param name Variant name from production variant
     */
    public findProductionVariant(name: string): IEndpointProductionVariant { ... }
  }
  ```

##### Endpoint Production Variants

When monitoring or auto-scaling real-time inference endpoints, both CloudWatch and Application Auto
Scaling operate at the level of endpoint name + variant name. For this reason, once a variant has
been attached to an endpoint, this RFC allows customers to retrieve `IEndpointProductionVariant`
instances from their endpoint for the purposes of referencing CloudWatch metrics or an Application
Auto Scaling `BaseScalableAttribute`.

- `IEndpointProductionVariant` -- represents a production variant that has been associated with an
  endpoint

  ```ts
  export interface IEndpointProductionVariant {
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

  class EndpointProductionVariant implements IEndpointProductionVariant { ... }
  ```

### Is this a breaking change?

No.

### What alternative solutions did you consider?

1. Theoretically, the `ContainerImage` code (referenced [above](#container-image)) from the
   `@aws-cdk/ecs` and `@aws-cdk/sagemaker` modules could be unified assuming it would be sufficient
   for both use-cases to `bind` using an `IGrantable` (adjusting ECS's `TaskDefinition`
   accordingly). However, it's unclear within which module such a unified API should reside as
   support for private repositories makes it a bad fit for `@aws-cdk/ecr` and `@aws-cdk/ecr-assets`,
   and it would be unintuitive for `@aws-cdk/sagemaker` to declare a dependency on `@aws-cdk/ecs`.

   Package concerns aside, historically, there was a period during which SageMaker only supported
   ECR as an image source while ECS was capable of sourcing images from either ECR or a
   customer-owned private repository. Given the fact that these two products' supported images
   sources may yet again diverge in the future, maybe it would be best to keep their
   `ContainerImage` APIs separate within their respective modules.
1. In the [earliest PR][earliest-pr] attempting to add SageMaker L2 constructs to the CDK, the
   author did not create an `EndpointConfig` construct, instead hiding the resource's creation
   behind `Endpoint` (to which production variants could be added). Although a simplifier, this
   prevents customers from reusing configuration across endpoints. For this reason, an explicit
   L2 construct for endpoint configuration was incorporated into this RFC.

[earliest-pr]: https://github.com/aws/aws-cdk/pull/2888

### What are the drawbacks of this solution?

This RFC and its [original associated implementation PR][original-pr] were based on a Q3 2019
feature set of SageMaker real-time inference endpoints. Since that point in time, SageMaker has
launched the following features which would require further additions to the L2 API contracts:

* [Multi-model endpoints][multi-model]
* [Model Monitor][model-monitor]
* [Asynchronous inference][async-inference]
* [Deployment guardrails][deployment-guardrails]
* [Serverless inference][serverless-inference]

Although some of these changes would be small and additive (e.g., `DataCaptureConfig` for Model
Monitor), features like asynchronous and serverless inference represent more significant shifts in
functionality. For example, SageMaker hosts real-time inference endpoints on EC2 instances, meaning
that CloudWatch alarms and Application Auto Scaling rules operate on instance-based metrics. In
contrast, serverless inference does not expose any instance-based metrics nor does it yet support
auto-scaling. Since both features are specified via the CloudFormation resource
`AWS::SageMaker::EndpointConfig`, the current recommendation of this RFC would be to support the
specification of both use-cases through a single L2 `EndointConfig` construct. However, this
presents a challenge when modeling helper APIs like `metricCPUUtilization` or
`autoScaleInstanceCount` on a related construct as those methods would not universally apply to
*all* endpoint types.

Given that (1) RFC reviewers may have idiomatic recommendations to solve such modeling challenges
and (2) the current proposed constructs are still viable for creating a SageMaker endpoint, the
first draft of this RFC is being published without further revisions accommodating the above newer
SageMaker features.

[original-pr]: https://github.com/aws/aws-cdk/pull/6107
[multi-model]: https://aws.amazon.com/blogs/machine-learning/save-on-inference-costs-by-using-amazon-sagemaker-multi-model-endpoints/
[model-monitor]: https://aws.amazon.com/about-aws/whats-new/2019/12/introducing-amazon-sagemaker-model-monitor/
[async-inference]: https://aws.amazon.com/about-aws/whats-new/2021/08/amazon-sagemaker-asynchronous-new-inference-option/
[deployment-guardrails]: https://aws.amazon.com/about-aws/whats-new/2021/11/new-deployment-guardrails-amazon-sagemaker-inference-endpoints/
[serverless-inference]: https://aws.amazon.com/about-aws/whats-new/2021/12/amazon-sagemaker-serverless-inference/

### What is the high-level project plan?

As the proposed design has been fully implemented in
[CDK PR #20113](https://github.com/aws/aws-cdk/pull/20113), the delivery timeline of the
implementation of this RFC will be contingent upon the scope of changes requested by reviewers. For
baking, the L2 constructs for this module would be marked as experimental, leaving room for further
adjustments prior to marking the APIs as stable.

### Are there any open issues that need to be addressed later?

1. Please see the [drawbacks section above](#what-are-the-drawbacks-of-this-solution) for potential
   follow-on work (assuming it need not be incorporated into this RFC).
1. As observed with [Lambda][lambda-eni-issue] and [EKS][eks-eni-issue], the Elastic Network
   Interfaces (ENIs) associated with a SageMaker model's VPC are not always cleaned up in a timely
   manner after downstream compute resources are deleted. As a result, attempts to delete a
   SageMaker endpoint along with its networking resources (e.g., subnets, security groups) from a
   CloudFormation stack may cause the stack operation to fail as the ENIs are still in use. From a
   CDK integration test perspective, specifying `--no-clean` will allow the generation of a snapshot
   regardless of whether stack deletion will succeed or fail but may hinder snapshot re-generation
   by subsequent CDK contributors. For this reason, it may be helpful to exclude VPC specification
   from the endpoint integration test at this time.

[lambda-eni-issue]: https://github.com/aws/aws-cdk/issues/12827
[eks-eni-issue]: https://github.com/aws/aws-cdk/issues/9970

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.
