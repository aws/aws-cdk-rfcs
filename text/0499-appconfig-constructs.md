# RFC - AppConfig CDK L2 Constructs

* **Original Author(s):**: @chenjane-dev
* **Tracking Issue**: #499
* **API Bar Raiser**: @otaviomacedo

We are creating L2 constructs for AppConfig to make creating and deploying configuration through AppConfig much easier for CDK users.

## Working Backwards

## README

[AWS AppConfig](https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html) is a capability of AWS Systems Manager, to create,
manage, and quickly deploy application configurations. AppConfig was officially
[launched](https://aws.amazon.com/about-aws/whats-new/2019/11/simplify-application-configuration-with-aws-appconfig/) on Nov 25, 2019.

Today, customers define AppConfig resources (applications, configuration profiles, deployment strategies, environments, and extensions) via the AWS
console, the AWS CLI, and Infrastructure as Code tools like CloudFormation and the CDK. However, they have challenges defining the required and
optional parameters depending on a number of factors. We will build convenient methods working backwards from common use cases and default to
recommended best practices.

This RFC proposes new AppConfig L2 constructs which will provide convenient features and abstractions for the existing
[L1 (CloudFormation) Constructs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_AppConfig.html).

### Lower level resources

This section details how we will implement our constructs that are based off resources.

## Environment

For each AWS AppConfig application, you define one or more environments. An environment is a logical deployment group of AppConfig targets, such as
applications in a Beta or Production environment. You can also define environments for application subcomponents such as the Web, Mobile, and
Back-end components for your application. You can configure Amazon CloudWatch alarms for each environment. The system monitors alarms during a
configuration deployment. If an alarm is triggered, the system rolls back the configuration.

We can create this secondary resource by calling `addEnvironment` to an application or we can construct this as follows. A secondary resource to
an environment is an extension association so we will also have a method to add this.

### Monitors

If you want to enable AWS AppConfig to roll back a configuration in response to a CloudWatch alarm, then you must configure an AWS Identity and
Access Management (IAM) role with permissions to enable AWS AppConfig to respond to CloudWatch alarms.

This is modeled as an interface with members of type cloudwatch.IAlarm and iam.IRole to represent this, the alarm and the permissions for AppConfig
to monitor your alarm. The alarm will be required to pass in, but if the role is not, we will create a role with the configured permissions
by default.

#### Example

```ts
const env = new Environment(stack, 'MyEnvironment', {
  application: <IApplication>,

  // optional
  name: 'MyEnv',
  monitors: [
    {
      alarm: <IAlarm>,

      // optional
      alarmRole: <IRole>,
    },
  ],
  description: 'This is my description',
});
```

We can also add an extension association to this resource by calling `on(ActionPoint, EventDestination)` or through convenience methods such
as `onDeploymentComplete(EventDestination)`.

## Deployment strategy

An AWS AppConfig deployment strategy defines the following important aspects of a configuration deployment.

### Deployment type

Deployment type defines how the configuration deploys or rolls out. AWS AppConfig supports Linear and Exponential deployment types.

* Linear: For this type, AWS AppConfig processes the deployment by increments of the growth factor evenly distributed over the deployment.
Here's an example timeline for a 10 hour deployment that uses 20% linear growth:

  Elapsed time  Deployment progress
  0 hour              0%
  2 hour              20%
  4 hour              40%
  6 hour              60%
  8 hour              80%
  10 hour             100%

* Exponential: For this type, AWS AppConfig processes the deployment exponentially using the following formula: G*(2^N). In this formula, G is
the step percentage specified by the user and N is the number of steps until the configuration is deployed to all targets. For example, if you
specify a growth factor of 2, then the system rolls out the configuration as follows:
  2*(2^0)
  2*(2^1)
  2*(2^2)
  Expressed numerically, the deployment rolls out as follows: 2% of the targets, 4% of the targets, 8% of the targets, and continues until the
  configuration has been deployed to all targets.

### Step percentage (growth factor)

This setting specifies the percentage of callers to target during each step of the deployment. In the SDK and the AWS AppConfig API Reference,
step percentage is called growth factor.

### Deployment time

This setting specifies an amount of time during which AWS AppConfig deploys to hosts. This is not a timeout value. It is a window of time during
which the deployment is processed in intervals.

### Bake time

This setting specifies the amount of time AWS AppConfig monitors for Amazon CloudWatch alarms after the configuration has been deployed to 100%
of its targets, before considering the deployment to be complete. If an alarm is triggered during this time, AWS AppConfig rolls back the
deployment. You must configure permissions for AWS AppConfig to roll back based on CloudWatch alarms. For more information, see (Optional)
Configure permissions for rollback based on CloudWatch alarms.

### Predefined deployment strategies

AWS AppConfig includes predefined deployment strategies to help you quickly deploy a configuration. Instead of creating your own strategies, you
can choose one of the following when you deploy a configuration.

* **AppConfig.AllAtOnce** (Quick): This strategy deploys the configuration to all targets immediately. The system monitors for Amazon CloudWatch
alarms for 10 minutes. If no alarms are received in this time, the deployment is complete. If an alarm is triggered during this time, AppConfig
rolls back the deployment.
* **AppConfig.Linear50PercentEvery30Seconds** (Testing/Demonstration): This strategy deploys the configuration to half of all targets every 30
seconds for a one-minute deployment. The system monitors for Amazon CloudWatch alarms for 1 minute. If no alarms are received in this time, the
deployment is complete. If an alarm is triggered during this time, AppConfig rolls back the deployment.
We recommend using this strategy only for testing or demonstration purposes because it has a short duration and bake time.
* **AppConfig.Canary10Percent20Minutes** (AWS Recommended): This strategy processes the deployment exponentially using a 10% growth factor over
20 minutes. The system monitors for Amazon CloudWatch alarms for 10 minutes. If no alarms are received in this time, the deployment is complete.
If an alarm is triggered during this time, AppConfig rolls back the deployment.
We recommend using this strategy for production deployments because it aligns with AWS best practices for configuration deployments.

You can create a maximum of 20 deployment strategies. When you deploy a configuration, you can choose the deployment strategy that works best
for the application and the environment.

#### Example

```ts
new DeploymentStrategy(this, 'MyDeploymentStrategy', {
  rolloutStrategy: RolloutStrategy.linear({
    growthFactor: 15,
    deploymentDuration: Duration.minutes(60),
  }),

  // optional
  name: 'MyDeploymentStrategy',
  finalBakeTime: Duration.minutes(30),
  replicateTo: ReplicateTo.NONE,  // this is the default value
  description: 'This is my description',
});
```

To import and use a predefined deployment strategy, we can do so as follows.

```ts
new DeploymentStrategy(this, 'MyDeploymentStrategy', {
  rolloutStrategy: RolloutStrategy.ALL_AT_ONCE,
});
```

## Extension

An extension augments your ability to inject logic or behavior at different points during the AWS AppConfig workflow of creating or deploying
a configuration. For example, you can use extensions to perform the following types of tasks (to name a few):

* Send a notification to an Amazon Simple Notification Service (Amazon SNS) topic when a configuration profile is deployed.
* Scrub the contents of a configuration profile for sensitive data before a deployment starts.
* Create or update an Atlassian Jira issue whenever a change is made to a feature flag.
* Merge content from a service or data source into your configuration data when you start a deployment.
* Back up a configuration to an Amazon Simple Storage Service (Amazon S3) bucket whenever a configuration is deployed.

AWS AppConfig includes the following AWS authored extensions. These extensions can help you integrate the AWS AppConfig workflow with other
services. You can use these extensions in the AWS Management Console or by calling extension API actions directly from the AWS CLI,
AWS Tools for PowerShell, or the SDK.

* Amazon CloudWatch Evidently A/B testing: This extension allows your application to assign variations to user sessions locally instead of
by calling the EvaluateFeature operation.
* AWS AppConfig deployment events to EventBridge: This extension sends events to the EventBridge default event bus when a configuration is
deployed.
* AWS AppConfig deployment events to Amazon Simple Notification Service (Amazon SNS): This extension sends messages to an Amazon SNS topic
that you specify when a configuration is deployed.
* AWS AppConfig deployment events to Amazon Simple Queue Service (Amazon SQS): This extension enqueues messages into your Amazon SQS queue
when a configuration is deployed.
* Integration extension—Atlassian Jira: This extensions allows AWS AppConfig to create and update issues whenever you make changes to a
feature flag.

You can associate these types of tasks with AWS AppConfig applications, environments, and configuration profiles.

For more information about extensions, see
[About AWS AppConfig extensions](https://docs.aws.amazon.com/appconfig/latest/userguide/working-with-appconfig-extensions-about.html).

### Example

```ts
const extension = new Extension(this, 'MyExtension', {
  actions: [
    new Action(this, 'MyAction', {
      eventDestination: <IEventDestination>,
      actionPoint: ActionPoint.ON_DEPLOYMENT_COMPLETE,
    }),
  ],

  // optional
  name: 'ExtensionName',
});
```

## Higher level resources

This section details how we will implement our constructs that combine multiple different resources into one.

## Configuration

A configuration is a higher level construct that can either be a HostedConfiguration (stored internally through AppConfig) or a
SourcedConfiguration (stored in S3, Secrets Manager, SSM Parameter, SSM Document, or Code Pipeline). This construct will be used as a building
block to deploy configuration through the AppConfig construct (detailed in the next section). For a HostedConfiguration, this construct will
combine both a configuration profile and a hosted configuration version.

### Example

```ts
const hostedConfig = new HostedConfiguration(this, 'MyHostedConfig', {
  content: ConfigurationSource.fromInline('This is my configuration content'),
  application: <IApplication>,

  // optional ConfigurationProfile props
  name: '...',
  tags: '...',
  validators: '...',
  configurationType: '...',

  // optional HostedConfigurationVersion props
  versionLabel: '...',
  latestVersionNumber: 1,
  contentType: '...',

  // optional
  description: '...',
  deployTo: [
    <IEnvironment>,
  ],
});

const sourcedConfig = new SourcedConfiguration(this, 'MySourcedConfig', {
  location: <IBucket|IParameter|IDocument|ISecret|IPipeline>,   // ex. Location.fromBucket(<IBucket>), only required if creating new configuration profile
  application: <IApplication>,
  versionNumber: '...',

  // optional ConfigurationProfile props
  name: '...',
  retrievalRole: '...',
  validators: '...',
  configurationType: '...',
  description: '...',

  // optional
  deployTo: [
    <IEnvironment>,
  ],
});
```

We will also be able to add these configurations to an application by calling `addConfiguration`.

We can also add an extension association to this resource by calling `on(ActionPoint, EventDestination)` or through convenience methods
such as `onDeploymentComplete(EventDestination)`.

## AppConfig

An AppConfig construct will be the simplest way to create and deploy configuration. This construct will handle deployments for you and start
deploying configuration on creation. There will be a 1:1 mapping between `AppConfig` and an application resource.

### Example

```ts
const appconfig = new AppConfig(this, 'MyAppConfig',{
  deploymentStrategy: <IDeploymentStrategy>,
  configuration: [
    hostedConfig,   // from previous section
    sourcedConfig,  // from previous section
  ]

  // optional
  name: 'MyApp',
  kmsKey: <IKey>,
  description: '...',
});

appconfig.addEnvironment();
appconfig.addConfiguration();
appconfig.onDeploymentComplete(<EventDestination>);
appconfig.onBakeComplete(<EventDestination>);
appconfig.onDeploymentRollback(<EventDestination>);
```

We can also add an extension association to an application by calling `on(ActionPoint, EventDestination)` or through convenience methods
such as `onDeploymentComplete(EventDestination)`.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching a new L2 construct library for AppConfig that will be available through the core CDK library.

### Why should I use this feature?

Using these constructs will make it very easy to use AppConfig in CDK to do the following:

* Application tuning – Introduce changes carefully to your application that can be tested with production traffic.
* Feature toggle – Turn on new features that require a timely deployment, such as a product launch or announcement.
* Allow list – Allow premium subscribers to access paid content.
* Operational issues – Reduce stress on your application when a dependency or other external factor impacts the system.

## Internal FAQ

### Why are we doing this?

AppConfig is a widely used service and we have many customers who want officially vended L2 constructs. These constructs will make the lives
of our customers easier by being able to deploy and manage configuration with little effort through CDK.

### Why should we _not_ do this?

One possible (although not likely) reason is that we already have L1 constructs and our resources are already available through CDK.

### What is the technical solution (design) of this feature?

The technical solution (design) of this feature follows the
[CDK design guidelines](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md).

### Is this a breaking change?

This is a new feature and therefore not a breaking change.

### What is the high-level project plan?

- [ ] Gather feedback on the RFC
- [ ] Get bar raiser to sign off on RFC
- [ ] Implement the constructs in a separate repository
- [ ] Publish the construct library to alpha
- [ ] Iterate and respond to issues
- [ ] Move the construct library to the core library after stabilized

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.
