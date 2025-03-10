# Property Injection Implementation of Blueprints

* **Original Author(s):**: @pcheungamz
* **Tracking Issue**: [#693](https://github.com/aws/aws-cdk-rfcs/issues/693)
* **API Bar Raiser**: @rix0rrr

`Property injection` is a new mechanism that makes it possible to control the properties that are used to instantiate a construct via an out-of-band mechanism.
Constructs explicitly opt in to being injectable; all L2 constructs in the AWS CDK standard library will be property injectable.

Property injection allows the implementation of `Blueprints`:
a collection of property injectors vended inside a large organization to make it easy for application builders to apply
organizational best practices when configuring constructs.
"Blueprints" is a branding term, and they do not imply or require any new technical capability besides property injection.
Blueprints by themselves are not a compliance enforcement mechanism;
instead they are a mechanism to make it easier for developers to hit compliance targets that are already being enforced via other means.

**Why do we need Blueprints?**

Let's say our org wants to prevent publically accessible S3 Buckets.
You can extend the Bucket class, set `blockPublicAccess: BlockPublicAccess.BLOCK_ALL` and tell all development teams to use our new class.
Or we can also require all development teams to use `blockPublicAccess: BlockPublicAccess.BLOCK_ALL` in their code.
With Blueprints, we no longer have to subclass Bucket and it is easy for development teams to use.

**What are the key pieces of Blueprints?**

`IPropertyInjector` - An IPropertyInjector defines a way to inject additional properties that are not specified in the props.
It is specific to one Construct and operates on that Construct’s properties.  This will be called `Injector` for short.

`propertyInjectors` - A collection of injectors attached to the construct tree.
Injectors can be attached to any construct, but in practice we expect most of them will be attached to `App`, `Stage` or `Stack`.

**What is the Blueprints design philosophy?**

An Org sets the standards and default value, and it is the responsibility of the development teams to adhere to that.
We also recognize that there are situations where the development team might need to override the standard.
In these situations, we value the autonomy of the development team by giving them the flexibility to override.

In the Working Backwards example below, the Org defines standard defaults for development teams to use,
but development teams can override the defaults if they need to.
Development teams can also write their own Injectors and share them across teams.  

## Working Backwards

### Development Team Experience

Development teams can start using Blueprints by attaching propertyInjectors to App.
In the example below, this dev team wants use the Property Injectors provided by its org for S3 Buckets and Lambda Functions.

```ts
import { BucketPropsInjector, FunctionPropsInjector } from '@my-org/standard-props-injectors';
...
const app = new App({
  ...
  propertyInjectors: [
    new BucketPropsInjector(),
    new FunctionPropsInjector(),
  ],
});
```

Alternatively, you can use this syntax:

```ts
const app = new App({});

PropertyInjectors.of(app).add(
  new BucketPropsInjector(),
  new FunctionPropsInjector(),
);
```

Dev teams can also attach propertyInjectors to Stacks as well.  This will override the Bucket Injector provided in App.

```ts
import { BetaBucketPropsInjector } from '@my-team/custom-props-injectors';
...
const betaStack = new Stack(stage, 'MyApp-beta-stack', {
  env: { account: '123456789012', region: 'us-east-1' },
  propertyInjectors: [
    new BetaBucketPropsInjector(),
  ],
});
```

In this case, Constructs created in betaStack will use `BetaBucketPropsInjector` instead of `BucketPropsInjector`.
This is useful when Beta resources have different requirements.

See [Scope Tree Traversal](#scope-tree-traversal) for more information.

### Organization Level Standardization

As an org with many dev teams, we can standardize how AWS Resources are created by providing dev teams with Injectors.

Here is a simple PropertyInjector to make sure the S3 Bucket is not publically accessible and SSL is used.

```ts
class MyBucketPropsInjector implements IPropertyInjector {
  public readonly constructUniqueId: string;

  constructor() {
    this.constructUniqueId = Bucket.PROPERTY_INJECTION_ID;
  }

  public inject(originalProps: BucketProps, _context: InjectionContext): BucketProps {
    return {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      ...originalProps,
    };
  }
}
```

Notes:

* We will add Bucket.PROPERTY_INJECTION_ID to unique identify this Construct.
This is a new Property that we will add to Bucket and other supported Constructs.
* This TypeScript code will set blockPublicAccess to BlockPublicAccess.BLOCK_ALL and enforceSSL to true
if these properties are not specified in originalProps.
This implementation allows the dev teams to override the org's recommended defaults.
* In this implementation of `IPropertyInjector`, we allow dev teams to overwrite the recommended defaults.  
However, orgs also can implement `IPropertyInjector` that explicitly overwrites dev team decisions.

## CDK Implementation Detail

### Add propertyInjectors to App, Stage, and Stack

In the constructor of App, we will add the propertyInjectors to AppProps.

```ts
export class App extends Stage {
  ...
  constructor(props: AppProps = {}) {
    if (props.propertyInjectors) {
      const injectors = PropertyInjectors.of(this);
      injectors.add(...props.propertyInjectors);
      ...
    }
  }
}
...
```

We will also add `propertyInjectors` to `StackProps` and `StageProps`.  In their constructor, we will pass `propertyInjectors` to `PropertyInjectors`.

### PropertyInjectors

The PropertyInjectors class has a map of constructUniqueId to IPropertyInjector.
This means that we can have only have one IPropertyInjector per Construct.  We put all the changes we want to make for a Construct in one place.

```ts
const PROPERTY_INJECTORS_SYMBOL = Symbol.for('@aws-cdk/core.PropertyInjectors');

export class PropertyInjectors {
  public static of(scope: IConstruct): PropertyInjectors {
    let propInjectors = (scope as any)[PROPERTY_INJECTORS_SYMBOL];
    if (!propInjectors) {
      propInjectors = new PropertyInjectors(scope);

      Object.defineProperty(scope, PROPERTY_INJECTORS_SYMBOL, {
        value: propInjectors,
        configurable: true,
        enumerable: true,
      });
    }
    return propInjectors;
  }
  
  private readonly _scope: IConstruct;
  private readonly _injectors: Map<string, IPropertyInjector>;

  private constructor(scope: IConstruct) {
    this._injectors = new Map<string, IPropertyInjector>();
    this._scope = scope;
  }

  /**
   * Add an array of IPropertyInjector to this collection of PropertyInjectors.
   * @param propsInjector
   */
  public add(...propsInjectors: IPropertyInjector[]) {
    for (const pi of propsInjectors) {
      if (this._injectors.has(pi.constructUniqueId)) {
        warn(`WARN: Overwriting injector for ${pi.constructUniqueId}`);
      }
      this._injectors.set(pi.constructUniqueId, pi);
      log(`=== Added ${pi.constructUniqueId} to ${this._scope}`);  
    }
  }
  
  /**
   * Get the PropertyInjector that is registered to the Construct's uniqueId.
   * @param uniqueId
   * @returns
   */
  public for(uniqueId: string): IPropertyInjector | undefined {
    return this._injectors.get(uniqueId);
  }
}
```

PropertyInjectors can be attached to any scope, but the typical use case is to attach PropertyInjectors to App, Stage, and Stack.

In [Scope Tree Traversal](#scope-tree-traversal), we will discuss how to find the correct injector when they are specified in app, stack, etc.

### Update Construct constructors - Alternate Option

Below are changes we will make to S3 Bucket.  We need to add `PROPERTY_INJECTION_ID` and in the constructor, call `applyInjectors`.

```ts
export class Bucket extends BucketBase {
  /**
   * Uniquely identifies this class.
   */
  public static readonly PROPERTY_INJECTION_ID = 'aws-cdk-lib.aws-s3.Bucket';
  ...
  constructor(scope: Construct, id: string, props: BucketProps = {}) {
    props = applyInjectors(Bucket.PROPERTY_INJECTION_ID, props, {
      scope,
      id,
    });

    super(scope, id, ...);
    ...
  }
}
```

`applyInjectors` finds the injector associated with `Bucket.PROPERTY_INJECTION_ID` by calling `findInjectorsFromConstruct`,
and once the injector is found, it applies the changes to the props.  See the next section for how we walk up the scope tree to find the injector.

### Update Construct constructors - Preferred Option

**This option is now possible thanks to
[this commit](https://github.com/aws/aws-cdk/commit/b48a5ad0d0c96c80252aae3ff32df41c1fb89099)**

We first define a Decorator called `propertyInjectionDecorator`.

```ts
export function propertyInjectionDecorator<T extends Constructor>(constructor: T) {
  log('In propertyInjectionDecorator');
  return class extends constructor {
    constructor(...args: any[]) {
      const scope = args[0];
      const id = args[1];
      let props = args[2];

      log(`Ctor scope: ${scope}, id: ${id}, old props: ${inspect(props)}`);
      const fqn = (constructor as any)['PROPERTY_INJECTION_ID'] as string;
      log('Ctor fqn:', fqn);

      props = applyInjectors(fqn, props, {
        scope,
        id,
      });

      log(`Ctor new props: ${inspect(props)}`);

      super(scope, id, props);
    }
  };
}
```

In the Construct, define this:

```ts
@propertyInjectionDecorator
export class Bucket extends BucketBase {
```

This is more ergonamonic than the previous implementation because:

* No change in the constuctor.
* Very clear to see that this class is decorated with `propertyInjectionDecorator`.
* `PROPERTY_INJECTION_ID` is inferred.  We don't need to worry about specifying the wrong `PROPERTY_INJECTION_ID` when calling `applyInjectors`.

### Scope Tree Traversal

We have added propertyInjectors to App, Stage, and Stack, so we can specify injectors at different levels.  Let’s say we specified injectors as follows:

* At app, specify Bucket injector b1.
* At stage, specify Function injector f1.
* At stack, specify Bucket injector b2.
* No PropertyInjectors on stack2.
* No PropertyInjectors on function.

![Scope Tree Traversal.](../images/0693/tree_traversal.drawio.png)

`findInjectorsFromConstruct` starts with the current scope and looks up the tree until an IPropertyInjector for that construct is found.

When function is created, the injector f1 is used, because there is no injector for Function at stack, but there is one at stage.

When bucket is created, the injector b2 is used.  Every bucket with scope of stack will be injected with b2.

bucket2 will use injector b1, because there is no Bucket injector found in stack2 so it will check stage, follow by app.

## FAQs

### Is this backward compatible?

Yes.  You do not need to specify or use any Injectors.  If no Injectors are specified, props are not changed.
Your existing code will continue to work.

### What changes are you making to AWS CDK?

* Introduce `IPropertyInjector` for organizations to implement.
* Introduce `PropertyInjectors` and allow it to be attached to App, Stage, and Stack.  Also see [Can I attach IPropertyInjector to other constructs?](#can-i-attach-ipropertyinjector-to-other-constructs)
* These [Constructs](#which-constructs-will-support-ipropertyinjector) will have their constructors modified.
  - They will call `applyInjectors` to look for the appropiate Injector to modify the props before `super` is called.
  - These Constructs will also have an PROPERTY_INJECTION_ID property.

### Which Constructs will support IPropertyInjector?

Below is a list of Constructs we plan to support in the initial release.
Each of the Constructs will also get a new PROPERTY_INJECTION_ID property.

<!--BEGIN_TABLE-->
Package|Construct
---|-----
aws-cdk-lib.aws-apigateway|ApiKey
aws-cdk-lib.aws-apigateway|Deployment
aws-cdk-lib.aws-apigateway|DomainName
aws-cdk-lib.aws-apigateway|LambdaRestApi
aws-cdk-lib.aws-apigateway|RestApi
aws-cdk-lib.aws-apigateway|SpecRestApi
aws-cdk-lib.aws-apigateway|Stage
aws-cdk-lib.aws-apigatewayv2|HttpApi
aws-cdk-lib.aws-apigatewayv2|HttpAuthorizer
aws-cdk-lib.aws-apigatewayv2|HttpRoute
aws-cdk-lib.aws-apigatewayv2|DomainName
aws-cdk-lib.aws-appmesh|VirtualGateway
aws-cdk-lib.aws-appmesh|VirtualNode
aws-cdk-lib.aws-appsync|GraphqlApi
aws-cdk-lib.aws-appsync|HttpDataSource
aws-cdk-lib.aws-autoscaling|AutoScalingGroup
aws-cdk-lib.aws-backup|BackupVault
aws-cdk-lib.aws-certificatemanager|Certificate
aws-cdk-lib.aws-chatbot|SlackChannelConfiguration
aws-cdk-lib.aws-cloudfront|CloudFrontWebDistribution
aws-cdk-lib.aws-cloudfront|Distribution
aws-cdk-lib.aws-cloudtrail|Trail
aws-cdk-lib.aws-cognito|UserPoolClient
aws-cdk-lib.aws-cognito|UserPoolIdentityProviderSaml
aws-cdk-lib.aws-docdb|DatabaseCluster
aws-cdk-lib.aws-dynamodb|Table
aws-cdk-lib.aws-dynamodb|TableV2
aws-cdk-lib.aws-ec2|BastionHostLinux
aws-cdk-lib.aws-ec2|Instance
aws-cdk-lib.aws-ec2|InterfaceVpcEndpoint
aws-cdk-lib.aws-ec2|LaunchTemplate
aws-cdk-lib.aws-ec2|PrivateSubnet
aws-cdk-lib.aws-ec2|PublicSubnet
aws-cdk-lib.aws-ec2|SecurityGroup
aws-cdk-lib.aws-ec2|Subnet
aws-cdk-lib.aws-ec2|SubnetConfiguration
aws-cdk-lib.aws-ec2|Volume
aws-cdk-lib.aws-ec2|Vpc
aws-cdk-lib.aws-ecr|Repository
aws-cdk-lib.aws-ecr-assets|DockerImageAsset
aws-cdk-lib.aws-ecs|BaseService
aws-cdk-lib.aws-ecs|Cluster
aws-cdk-lib.aws-ecs|ContainerDefinition
aws-cdk-lib.aws-ecs|Ec2Service
aws-cdk-lib.aws-ecs|Ec2TaskDefinition
aws-cdk-lib.aws-ecs|ExternalTaskDefinition
aws-cdk-lib.aws-ecs|FargateService
aws-cdk-lib.aws-ecs|TaskDefinition
aws-cdk-lib.aws-ecs-patterns|ApplicationLoadBalancedServiceBase
aws-cdk-lib.aws-ecs-patterns|ApplicationListenerProps
aws-cdk-lib.aws-ecs-patterns|ApplicationMultipleTargetGroupsServiceBase
aws-cdk-lib.aws-ecs-patterns|ApplicationLoadBalancedFargateService
aws-cdk-lib.aws-ecs-patterns|ApplicationLoadBalancedFargateServiceProps
aws-cdk-lib.aws-ecs-patterns|ApplicationMultipleTargetGroupsFargateService
aws-cdk-lib.aws-ecs-patterns|ApplicationMultipleTargetGroupsFargateServiceProps
aws-cdk-lib.aws-ecs-patterns|NetworkLoadBalancedFargateService
aws-cdk-lib.aws-ecs-patterns|NetworkLoadBalancedFargateServiceProps
aws-cdk-lib.aws-ecs-patterns|NetworkMultipleTargetGroupsFargateService
aws-cdk-lib.aws-ecs-patterns|NetworkMultipleTargetGroupsFargateServiceProps
aws-cdk-lib.aws-ecs-patterns|QueueProcessingFargateServiceProps
aws-cdk-lib.aws-efs|FileSystem
aws-cdk-lib.aws-eks|Cluster
aws-cdk-lib.aws-eks|FargateCluster
aws-cdk-lib.aws-elasticloadbalancingv2|ApplicationListener
aws-cdk-lib.aws-elasticloadbalancingv2|AddApplicationTargetsProps
aws-cdk-lib.aws-elasticloadbalancingv2|ApplicationLoadBalancer
aws-cdk-lib.aws-elasticloadbalancingv2|ApplicationTargetGroup
aws-cdk-lib.aws-elasticloadbalancingv2|BaseNetworkListenerProps
aws-cdk-lib.aws-elasticloadbalancingv2|AddNetworkTargetsProps
aws-cdk-lib.aws-elasticloadbalancingv2|NetworkListener
aws-cdk-lib.aws-elasticloadbalancingv2|NetworkLoadBalancer
aws-cdk-lib.aws-elasticloadbalancingv2|NetworkTargetGroup
aws-cdk-lib.aws-iam|Policy
aws-cdk-lib.aws-iam|PolicyStatement
aws-cdk-lib.aws-iam|Role
aws-cdk-lib.aws-iam|User
aws-cdk-lib.aws-kinesis|Stream
aws-cdk-lib.aws-kms|Key
aws-cdk-lib.aws-lambda|CodeSigningConfig
aws-cdk-lib.aws-lambda|Function
aws-cdk-lib.aws-lambda|FunctionUrl
aws-cdk-lib.aws-log|LogGroup
aws-cdk-lib.aws-log|LogRetention
aws-cdk-lib.aws-opensearchservice|Domain
aws-cdk-lib.aws-rds|DatabaseCluster
aws-cdk-lib.aws-rds|DatabaseClusterFromSnapshot
aws-cdk-lib.aws-rds|DatabaseInstance
aws-cdk-lib.aws-rds|DatabaseInstanceFromSnapshot
aws-cdk-lib.aws-rds|DatabaseInstanceReadReplica
aws-cdk-lib.aws-rds|DatabaseProxy
aws-cdk-lib.aws-rds|DatabaseSecret
aws-cdk-lib.aws-rds|ParameterGroup
aws-cdk-lib.aws-rds|ServerlessCluster
aws-cdk-lib.aws-rds|ServerlessClusterFromSnapshot
aws-cdk-lib.aws-s3|Bucket
aws-cdk-lib.aws-s3-deployment|BucketDeployment
aws-cdk-lib.aws-secretsmanager|Secret
aws-cdk-lib.aws-servicecatalog|ProductStackHistory
aws-cdk-lib.aws-ses|ConfigurationSet
aws-cdk-lib.aws-ses|DropSpamReceiptRule
aws-cdk-lib.aws-ses|EmailIdentity
aws-cdk-lib.aws-ses|ReceiptRule
aws-cdk-lib.aws-sns|Subscription
aws-cdk-lib.aws-sns|Topic
aws-cdk-lib.aws-sns|TopicPolicy
aws-cdk-lib.aws-sns-subscriptions|UrlSubscription
aws-cdk-lib.aws-sns-subscriptions|UrlSubscriptionProps
aws-cdk-lib.aws-sqs|Queue
aws-cdk-lib.aws-stepfunctions-tasks|EcsRunTask
aws-cdk-lib.custom-resources|Provider
aws-cdk-lib.custom-resources|ProviderProps
aws-cdk-lib.custom-resources|AwsCustomResource
<!--END_TABLE-->

### What happens when you need to create a accessLogBucket for a Bucket?

Would a Bucket injector trying to create accesslogBucket run into infinite recursion, since you are creating another Bucket inside the constructor?

Bucket Injectors that need to create a Bucket will need to take special care to avoid infinite recursion.
One way to accomplish this is to track the state in the Injector.  Here is an example.

```ts
class SpecialBucketInjector implements IPropertyInjector {
  public readonly constructUniqueId: string;

  // this variable will track if this Injector should be skipped.
  private _skip: boolean;

  constructor() {
    this._skip = false;
    this.constructUniqueId = Bucket.PROPERTY_INJECTION_ID;
  }

  public inject(originalProps: BucketProps, context: InjectionContext): BucketProps {
    if (this._skip) {
      return originalProps;
    }

    let accessLogBucket = originalProps.serverAccessLogsBucket;
    if (!accessLogBucket) {
      // When creating a new accessLogBucket, disable further Bucket injection.
      this._skip = true;

      // Since injection is disabled, make sure you provide all the necessary props.
      accessLogBucket = new Bucket(context.scope, 'my-access-log', {
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy: originalProps.removalPolicy ?? core.RemovalPolicy.RETAIN,
      });

      // turn on injection for Bucket again.
      this._skip = false;
    }

    return {
      serverAccessLogsBucket: accessLogBucket,
      ...originalProps,
    };
  }
}
```

We have to set `_skip` to true before the line to create an accessLogBucket.
Otherwise, it will try to create an accessLogBucket for an accessLogBucket, ad inifinitum.

This technique should also be used when creating a DeadLetterQueue within aws-sqs.Queue, because we are creating a Queue within a Queue.
However, this is not necessary when creating a DeadLetterQueue inside a lambda Function Injector.

### Can I attach two differnt Bucket IPropertyInjector to a Stack?

What happens when I do this?

```ts
const myStack = new Stack(stage, 'MyApp-stack', {
  env: { account: '123456789012', region: 'us-east-1' },
  propertyInjectors: [
    new DefaultBucketPropsInjector(),
    new BetaBucketPropsInjector(),
  ],
});
```

Assuming both have `constructUniqueId` of `Bucket.PROPERTY_INJECTION_ID`.  `BetaBucketPropsInjector` will overwrite `DefaultBucketPropsInjector`.
Any Bucket created in `myStack` will have `BetaBucketPropsInjector` applied to it.
This is because we use a Map keyed by constructUniqueId to store the Injectors and the second one will overwrite the first one.

### Can I attach IPropertyInjector to other constructs?

Yes.  You can use `.of`.

Example:

```ts
const function = new Function(stack, 'MyFunc', {
  ...
});

const b3 = new BucketInjector();

PropertyInjectors.of(function).add(b3);

const bucketA = new Bucket(function, 'test-mybucket', {
    ...
});
```

`bucketA` will get BucketInjector `b3` applied to it, regardless of what Bucket Injector was defined in Stack or App.
The typical use case is to attach IPropertyInjectors to App, Stage, and Stack.  So we have added `propertyInjectors` to their props for ease of use.

### Can I overwrite a default value in an Injector with undefined?

Using this Injector as an example:

```ts
class MyBucketPropsInjector implements IPropertyInjector {
  public readonly constructUniqueId: string;

  constructor() {
    this.constructUniqueId = Bucket.PROPERTY_INJECTION_ID;
  }

  public inject(originalProps: BucketProps, _context: InjectionContext): BucketProps {
    return {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      ...originalProps,
    };
  }
}
```

TypeScript clients can use:

```ts
new Bucket(this, 'My-test-bucket', {
  blockPublicAccess: undefined,
});
```

to create a Bucket with `blockPublicAccess: undefined`.

However, `undefined` is not support in Python and Java.  If Python client set `blockPublicAccess` to `None`,
it woudl be as if `blockPublicAccess` was never passed in, so the Injector would use `BLOCK_ALL` as default.
To get around this, orgs can allow Dev Team to subclass the Injector and specify `blockPublicAccess: undefined`.

One example is:

```ts
class MyBucketPropsInjector implements IPropertyInjector {
  public readonly constructUniqueId: string;

  constructor() {
    this.constructUniqueId = Bucket.PROPERTY_INJECTION_ID;
  }

  protected getDefaultBlockPublicAccess() {
    return BlockPublicAccess.BLOCK_ALL;
  }

  public inject(originalProps: BucketProps, _context: InjectionContext): BucketProps {
    return {
      blockPublicAccess: getDefaultBlockPublicAccess(),
      enforceSSL: true,
      ...originalProps,
    };
  }
}
```

```ts
export MyTeamInjector extends MyBucketPropsInjector {
  protected getDefaultBlockPublicAccess() {
    return undefined;
  }
}
```

The Python client uses `MyTeamInjector`, then they can specify `blockPublicAccess` at Bucket creation time with

```py
bucket = s3.Bucket(
    self, "MyBucket",
    block_public_access=None,
)
```

```py
bucket = s3.Bucket(
    self, "MyBucket",
    block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
)
```
