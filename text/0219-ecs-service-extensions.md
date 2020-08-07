---
feature name: ecs-service-extensions
start date: 2020-08-06
rfc pr: (leave this empty)
related issue: #219
---

# Summary

This proposal is for a new set of ECS L3 constructs. These constructs enhance the ability to build a full featured ECS service out of components that provide specific feature integrations.

# README

The new ECS `Service` construct is a simple base class to describe your application. You can use it to easily attach AWS ECS features to your application using a system of extensions. Each extension is responsible for a single feature that you might want to enable on your service.

For example you can use the `AppMeshExtension` to add an Envoy proxy sidecar to your ECS service's task definition, enable Cloud Map on your ECS service, and automatically register the application in an App Mesh service mesh. The `XRayExtension` will automatically attach an X-Ray daemon sidecar to your service, allowing your application to send transaction trace spans to X-Ray.

Extensions can be used in any combination with each other, so you can enable and disable features attached to your service while continuing to use the same familiar `Service` construct

# Motivation

As we add more features to ECS one problem that must be faced is that ECS is not a standalone service. The strength of ECS is in its integration with other AWS services, so customers expect these integrations to be as smooth and easy as possible. We must create CDK constructs that can help customers connect their ECS orchestrated application to other AWS services. The constructs in CDK must be extensible enough address all the possible integrations that users may want to enable on their ECS service.

Currently we have built out a set of L3 constructs:

- `ApplicationLoadBalancedEc2Service`, `ApplicationLoadBalancedFargateService`
- `NetworkLoadBalancedEc2Service`, `NetworkLoadBalancedFargateService`
- `QueueProcessingEc2Service`, `QueueProcessingFargateService`
- `ScheduledEc2Task`, `ScheduledFargateTask`

These classes are useful as starter patterns, but aren't very flexible. Most of the decisions about the resulting architecture and integratons are made in the class name itself. Only a few customizations can be made to the resulting architecture via the properties passed to the constructor.

The current approach of many different architecture specific L3 constructs is not scalable. Imagine if users want a service which has both an ALB and a service mesh sidecar. This would require us to create a new pattern called something like: `ApplicationLoadBalancedAppMeshEc2Service`

Following this trend it is easy to predict that over time we will accumulate more and more named classes for various combinations of features. No matter how many of these classes we create it will never be possible to satisfy all the customer demands for all the various permutations of features that customers may want to turn on.

Another angle to the problem is the L2 internal code organization of how these ECS adjacent features are supported in the ECS CDK codebase. Consider the FireLens feature. We have support for FireLens in the `TaskDefinition` construct via a method `TaskDefinition.addFirelensLogRouter()`. This works if you are using the L2 constructs directly, but now consider if wanted to support X-Ray, App Mesh, and CloudWatch Agent. We would need new methods like:

- `TaskDefinition.addXRayDaemon()`
- `TaskDefinition.addAppMeshEnvoy()`
- `TaskDefinition.addCloudwatchAgent()`

As a result the TaskDefinition L2 construct would become an ever growing monolithic collection of code that pertains to other services, instead of just focusing on ECS as it should be. I believe that this problem is contributing to lack of progress on the development of higher level abstractions for ECS integrations, because these features can not be added to the existing codebase using existing patterns without introducing bloated complexity to the L2 construct classes.

Another challenge is that some features such as App Mesh require resources and settings across multiple construct types. For example App Mesh requires that the service be modified to have a CloudMap namespace, it must modify the task definition to have an Envoy sidecar and proxy settings, and it must have created App Mesh specific resources like Virtual Node and Virtual Service. There is no single place for all of this cross construct logic to live in the current construct architecture.

Last but not least the existing approach to L3 constructs has an `Ec2` and a `Fargate` version of each L3 construct. Ideally there would be a way for customers to create a service which is agnostic to whether it is deployed on EC2 or Fargate.

## Tenants

To solve the problems with ECS construct implemention we propose adding a new `Service` class with the following goals:

- __One service class to learn__: Instead of a collection of many different L3 classes that all have different names there is a single class which can implement any number of different forms depending on what the customer wants. Customers don't need to learn the names for different L3 constructs. All ECS architectures start the same way: with the same `Service` class.
- __Easy to extend and customize__: It is easy to extend the `Service` class with new behaviors and features, in any combination required. The `Service` class comes with batteries included: a set of easy to use extensions created and maintained by the AWS team. However there are also clear instructions and examples of how customers can create their own custom extensions. Third parties will be enabled to also create and distribute extensions for their own services, for example a provider like Datadog could easily build an extension that automatically adds Datadog agent to an ECS service.
- __Extensions self configure and self provision__: Service extensions provision their own resources as well as configuring the ECS service to use those resources. For example a load balancer extension creates its own load balancer and also attaches the ECS service to the load balancer. An App Mesh extension creates its own App Mesh virtual service and virtual node as well as configuring the ECS service and ECS task definition to have the right Envoy sidecar and proxy settings.
- __Extensions are aware of each other__: There are no hidden "gotchas" when enabling a service extension. Extensions know of each other's existence. For example the application's container is aware that there is an Envoy proxy and that it must wait until the Envoy proxy has started before the app starts.
- __Service class is agnostic to EC2 vs Fargate__: Rather than choosing the capacity strategy in the class name customers just create a service, and add it to an environment. The service automatically modifies its settings as needed to adjust to the capacity available in the environment.

# Design Summary

In this proposal we introduce two new constructs:

- `Environment` - A simple construct which wraps up a VPC, cluster, and other top level resources needed for ECS services to run on an AWS account
- `Service` - A single application that runs inside an `Environment`

And two new associated foundational classes used by the `Service` construct:

- `ServiceDescription` - A class which is utilized to build out a description of the application and the features that should be attached to the application. This description is consumed by the `Service` class
- `ServiceExtension` - An abstract class for a single type of feature that you want to attach to a service. A `ServiceExtension` is added to a `ServiceDescription` and then the `ServiceDescription` is used to make a new `Service` construct.

The following code example summarizes how you would use these classes together:

```js
const myServiceDesc = new ServiceDescription();
myServiceDesc.add(new Container({
  cpu: 1024,
  memoryMiB: 2048,
  trafficPort: 80,
  image: ContainerImage.fromRegistry('nathanpeck/greeter')
}));
myServiceDesc.add(new AppMeshExtension({ mesh }));
myServiceDesc.add(new FireLensExtension());
myServiceDesc.add(new XRayExtension());
myServiceDesc.add(new CloudwatchAgentExtension());
myServiceDesc.add(new HttpLoadBalancerExtension());

const myEnvironment = new Environment(stack, 'production', {
  vpc: vpc,
  cluster: cluster,
  capacityType: capacityTypes.EC2 || capacityTypes.FARGATE
});

const myService = new Service(stack, 'my-service', {
  environment: myEnvironment
  serviceDescription: myServiceDesc
});
```

# Detailed Design

Let's take a more detailed look at each class:

## Class: `ServiceDescription`

This class is not an actual construct, it is just a helper class which is used to build out a description of the service to build. This class is used because traditionally all CDK constructs are immutable. Once a `Service` is created using its constructor most if not all of its properties should be immutable. Therefore its necessary to build out a full list of all the things that need to be constructed, prior to construction time.

The `ServiceDescription` class has one method: `ServiceDescription.add(ServiceExtension)`. Usage looks similar to this:

```js
const myServiceDesc = new ServiceDescription();
myServiceDesc.add(new Container();
myServiceDesc.add(new AppMeshExtension({ mesh }));
myServiceDesc.add(new FireLensExtension());
myServiceDesc.add(new XRayExtension());
```

## Class: `ServiceExtension`

This class defines an actual extension itself. The extension is collection of hooks which modify the `Service` properties, `TaskDefinition` properties, and/or make use of the resulting `Service` and `TaskDefinition`. Each `ServiceExtension` can implement the following hooks:

- `addHooks()` - This hook is called after all the extensions are added to a `ServiceDescription`, but before any of the other extension hooks have been run. It gives each extension a chance to do some inspection of the overall `ServiceDescription` and see what other extensions have been added. Some extension may want to register hooks on the other extension to modify them. For example the Firelens extension wants to be able to modify the settings of the application container to route logs through Firelens.
- `modifyTaskDefinitionProps()` - This is hook is passed the proposed `ecs.TaskDefinitionProps` for a TaskDefinition that is about to be created. This allows the extension to make modifications to the task definition props before the `TaskDefinition` is created. For example the App Mesh extension modifies the proxy settings for the task.
- `useTaskDefinition()` - After the `TaskDefinition` is created, this hook is passed the actual `TaskDefinition` construct that was created. This allows the extension to add containers to the task, modify the task definition's IAM role, etc.
- `resolveContainerDependencies()` - Once all extensions have added their containers each extension is given a chance to modify its container's `dependsOn` settings. Extensions need to check and see what other extensions were enabled, and decide whether their container needs to wait on another container to start first.
- `modifyServiceProps()` - Before an `Ec2Service` or `FargateService` is created this hook is passed a draft version of the service props to change. Each extension adds its own modifications to the service properties. For example the App Mesh extension needs to modify the service settings to enable CloudMap service discovery.
- `useService()` - After the service is created this hook is given a chance to utilize the service that was created. This is used by extensions like the load balancer or App Mesh extension which create and link other AWS resources to the ECS extension.
- `connectToService()` - This hook is called when a user wants to connect one service to another service. It allows an extension to implement logic about how to allow connections from one service to another. For example the App Mesh extension implements this method so that you can easily connect one service mesh service to another so that the service's Envoy proxy sidecars know how to route traffic to each other.

The `ServiceExtension` is a basic abstract class which can be extended like this:

```js
export class MyCustomExtension extends ServiceExtension {
  constructor() {
    super('my-extension');
  }

  public mutateServiceProps(props: ServiceBuild) {
    return {
      ...props,

      // Make modifications to service props here
      foo: 'bar'
    } as ServiceBuild;
  }

  public useService(service: ecs.Ec2Service | ecs.FargateService) {
    // Make calls to use the resulting Service
  }
}
```

The initial release of this feature includes the following prebuilt extensions:

- `Container` - A key addon that every service needs. This addon sets the main application container
- `AppMesh` - This addon attaches and configures an Envoy sidecar for all task network traffic, and creates the App Mesh virtual node and virtual service required to route traffic within the mesh
- `XRay` - This addon adds an X-Ray daemon sidecar to the task, which can gather up trace spans from the application and send batchs of them off to X-Ray over UDP
- `FireLens` - This addon adds a FluentBit sidecar and configures it to serve as the log router for the application container. It also creates and configures a CloudWatch Log Group to receive the application logs
- `CloudWatchAgent` - This addon adds a CloudWatch Agent daemon for gathering up data from statsd services. This gathers detailed stats from the AppMesh Envoy proxy and sends them to CloudWatch.
- `HttpLoadBalancer` - This addon creates and attaches an Application Load Balancer to the service

__(Extra proposed addons)__

- `NetworkLoadBalancer` - Create and attach an NLB
- `DynamoDbTable` - Create a DynamoDB table and attach it to the service's application container, with IAM permissions and an env variable

One goal of this proposal is to make it easy enough to build a service extension, that CDK consumers feel empowered to create their own custom extensions. Eventually there will also be a third party ecosystem of extensions for third party services as well. For example it would be easy to create a Datadog extension, or Twistlock extension that automatically adds and configures the right sidecar in the task.

## Construct: `Service`

This construct consumes an `Environment` and a `ServiceDescription`. It runs all the extension hooks from the `ServiceDescription` and then creates the actual underlying L2 constructs for the `TaskDefinition` and `Ec2Service` or `FargateService`

A service is created like this:

```js
const myService = new Service(stack, 'my-service', {
  environment: myEnvironment
  serviceDescription: myServiceDesc
});
```

The `Service` construct also has a helper method `Service.connectTo(service)` which is used to connect two `Service`'s to each other. This passes off control to the `connectToService()` method in each service's extensions which runs extension specific logic for connecting two different services to each other. For example the AppMesh extension has logic that understands how to configure the App Mesh service mesh to route traffic between two services. Usage is like this:

```js
const serviceA = new Service(stack, 'service-a');
const serviceB = new Service(stack, 'service-a');

serviceA.connectTo(serviceB);
```

This `connectTo()` abstracts away security groups, service mesh configuration, and all other configuration required to open a network path from service A to service B.

## Construct: `Environment`

This construct serves as a wrapper class. You can use it one of two ways:

```js
const prod = new Environment(stack, 'production');
```

In this approach the `Environment` class will automatically create a VPC, and Fargate cluster. However some people may want more direct control. You can also use the `Environment` like this:

```js
const myEnvironment = new Environment(stack, 'production', {
  vpc: vpc,
  cluster: cluster,
  capacityType: capacityTypes.EC2
});
```

This allows you to manually specify a precreated VPC or cluster if you already have these constructs defined and don't want to rely on the `Environment` to create them for you. Either way you can use the `Environment` to create a service like this.

# Drawbacks

One trade-off of this approach is that if not done well it will suffer from the same problems of the existing L3 constructs: customers will run into something that they can not configure and will have to fail out of the L3 construct back into L2 constructs. However due to the increased amount of functionality which is only accessible via these L3 construct extensions it will be a massive effort to reimplement the same results directly at the L2 level. In summary the L3 construct configures a tremendous amount of things, which are very hard to get right at the L2 level, so it will create a dependence on the L3 construct.

## Do we anticipate certain extensions conflicting with each other?

Yes it is possible that extensions may conflict with each other. It is the responsibility of each extension to check for other extensions at the time of being added to the service and throw an exception if there is an expected conflict.

## Given that ECS patterns are meant to push best practices in application infrastructure/architecture, how will we provide that guidance with extensions?

The goal of these extensions is to do the right thing by default, similar to the existing ECS patterns, but the user just has more choices about what combinations of feature integrations they want to enable. When using the built-in extensions there should be no "bad" choices. If a user wants to leave out an extension it is safe to do so, and if they chose to enable it there should be no gotchas from adding another extension. The goal is to make this hard to misuse, but still powerful and extendable.

# Rationale and Alternatives

One alternative approach to this is to try to enhance the lower level L2 methods with an extension type system. The existing [`TaskDefinition.addExtension()`](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.TaskDefinition.html#add-wbr-extensionextension) method is the beginning of an attempt at this.

However attempting to build out extensions on the L2 level will fail to meet customer expectations because the features they want to enable bridge multiple different types of L2 construct. For example in order for an extension like App Mesh to work properly it must change the service to have a cloud map configuration, change the task definition IAM role to have the right level of access, change the task definition to add proxy settings, attach a container to the task definition, and create and link App Mesh virtual service and virtual node to the service. Because the full feature requires touching all of these different constructs and resulting resources it is not possible to fully implement an extension system at the L2 level. For this reason the existing `TaskDefinition.addExtension()` is not a viable alternative.

# Adoption Strategy

Existing CDK developers will discover and adopt this new pattern as an alternative to the existing L3 constructs. When they reach a point where the basic patterns like `ApplicationLoadBalancedFargateService` can not serve all their needs, they will be able to migrate to the new `Service` pattern with just a few lines of code change.

New CDK developers deploying their first ECS application may actually choose to use the `Service` construct from the start due to its enhanced extendable capabilities.

# Unresolved questions

- Does this API address the customer need well enough?
- Is the API configurable enough? Are we missing important properties that need to be able to be passed into the L3 construct to change the L2 construct?
- Is the initial set of extensions full featured enough?
- If not what other extensions do we need to develop?

# Future Possibilities

The following ideas are out of scope for the initial proposal, but good things to follow up on in the future.

## Environment extensions

There is potential here for customers to eventually add an extension to an environment as well as adding extensions to a service. Adding an extension to the environment would automatically add that extension on all services that are added to the environment. The service would inherit all environment level extensions on top of any locally defined extensions. For example, this would allow operations minded orgs to enforce that all services in an environment have a mandatory security sidecar attached. It would also serve as a DRY simplification for attaching an extension globally if there is an extension that needs to be on every single service anyway.

Usage would look like this:

```js
const serviceOneDesc = new ServiceDescription();
serviceOneDesc.add(new Container({
  cpu: 1024,
  memoryMiB: 2048,
  trafficPort: 80,
  image: ContainerImage.fromRegistry('nathanpeck/greeting')
}));

const serviceTwoDesc = new ServiceDescription();
serviceTwoDesc.add(new Container({
  cpu: 1024,
  memoryMiB: 2048,
  trafficPort: 80,
  image: ContainerImage.fromRegistry('nathanpeck/name')
}));

const myEnvironment = new Environment(stack, 'production', {
  vpc: vpc,
  cluster: cluster,
  capacityType: capacityTypes.EC2 || capacityTypes.FARGATE
});
myEnvironment.add(new AppMeshExtension({ mesh }));

const serviceOne = new Service(stack, 'service-one', {
  environment: myEnvironment
  serviceDescription: serviceOneDesc
});
const serviceTwo = new Service(stack, 'service-two', {
  environment: myEnvironment
  serviceDescription: serviceTwoDesc
});

serviceOne.connectTo(serviceTwo);
```

The above code would cause both of the service's to get the App Mesh extension out of the box, since the App Mesh extension was added globally to the environment.

## Service (and environment) traits

A future goal is to add support for a new feature called "traits". The idea behind this is to allow customers to modify the behavior of all of their extensions via higher level intentions about how the service should behave. Traits are higher level adjectives that describe how the service should be configured. For example some traits could be:

- "cost optimized"
- "performance optimized"
- "high availability"

The service would then self configure based on the traits that the customer selected. For example if the service had the "cost optimized" trait for a development environment it might choose to deploy the smallest possible AWS Fargate task size, and only one of them. However the "performance optimized" or "high availability" traits would override this to deploy multiple copies that are larger.

Each extension would be responsible for implementing traits however it choses. For example the FireLens logging extension might decide to implement "cost optimized" by setting a TTL on log files so that they don't accumulate and cost money for storage. However if there was a "data retention" trait that would instead cause FireLens to retain all logs forever for auditing.

The traits would be able to be added at both the service and environment level.

# Implementation Plan

A full implementation plan will be added when the RFC is
scheduled for implementation.

Note that a working proof of concept PR is already open on the CDK repo here: https://github.com/aws/aws-cdk/pull/9069
