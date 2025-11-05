# AWS AIOps Investigation Group L2 Construct

* **Original Author(s):** @amandaleeatwork
* **Tracking Issue**: [#{0792}](https://github.com/aws/aws-cdk-rfcs/issues/792)
* **API Bar Raiser**: @{aemada-aws}

## Working Backwards

### CHANGELOG

```feat(aiops): AIOps L2 construct```

### README

## Amazon AIOps Construct Library

[AWS AIOps](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations.html) is a generative AI-powered assistant
that helps you respond to incidents by analyzing telemetry data and providing actionable recommendations.

This construct library provides L2 constructs that follow AWS CDK design principles with secure defaults, simplified configuration,
and comprehensive helper methods.

### Investigation Group

An Investigation Group serves as a container for organizing customer investigations, with an associated IAM role that defines AIOps backend service permissions.
This regional resource requires one-time setup and acts as the parent container for all your investigations.
Within this structure, you can create multiple investigations, each capable of containing multiple investigation events,
providing a hierarchical organization for incident management.

Settings in the investigation group help you centrally manage the common properties of your investigations and their associated events, such as:

* Who can access the investigations and associated events
* Whether investigation data is encrypted with a customer managed AWS Key Management Service key
* How long investigations and their data are retained by default

Currently, you can have one investigation group in each region in your account.

#### Basic Usage

```typescript
// Minimal configuration with secure defaults
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
  name: 'myInvestigationGroup',
});
```

#### Advanced Configuration

```typescript
// Custom role and encryption
const customRole = new Role(this, 'CustomAIOpsRole', {
  assumedBy: new ServicePrincipal('aiops.amazonaws.com'),
  managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AIOpsAssistantPolicy')],
});

const encryptionKey = new Key(this, 'AIOpsEncryptionKey', {
  enableKeyRotation: true,
  description: 'AIOps Investigation Group encryption key',
});

const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
  name: 'myInvestigationGroup',
  role: customRole,
  encryptionKey: encryptionKey,
  retention: Duration.days(30),
  includeCloudTrailEvents: true,
  tagKeyBoundaries: ['Environment', 'Application'],
  removalPolicy: RemovalPolicy.DESTROY,
});
```

#### Helper Methods

##### Cross-Account Configuration

For `addCrossAccountConfiguration` method, L2 construct extends the investigation group's cross-account
configurations by adding a new source account role ARN,
and configuring the necessary `assumeRole` permission on source account role resource in the investigation group's IAM role.
It allows the current account to access telemetry data from the source account by assuming the source account role specified here.
L2 construct does not validate whether the source account role exists or not in `addCrossAccountConfiguration` method.
The source account role permissions need to be set up separately.
See [Cross-account investigations](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations-cross-account.html)

```typescript
const sourceRole = Role.fromRoleArn(this, 'SourceRole', 
  'arn:aws:iam::123456789012:role/AIOpsSourceRole');

group.addCrossAccountConfiguration(sourceRole);
```

##### Chatbot Notifications

Investigation group can contain a list of chatbotNotificationChannel.
Each chatbotNotificationChannel is used to integrate AIOps with chat applications, which includes following two attributes:

* snsTopicArn is the ARN of an Amazon SNS topic.
* chatConfigurationArns is list of ARNs of one or more chat applications configurations that you want to associate with that topic.
For more information about these configuration ARNs,
see [Getting started with Amazon Q in chat applications](https://docs.aws.amazon.com/chatbot/latest/adminguide/getting-started.html) and
[Resource type defined by AWS Chatbot](https://docs.aws.amazon.com/service-authorization/latest/reference/list_awschatbot.html#awschatbot-resources-for-iam-policies).

For `addChatbotNotificationChannel` method, L2 construct will add additional chatbotNotificationChannel to investigation group.

```typescript
const notificationTopic = new Topic(this, 'AIOpsNotifications');
const chatbotNotificationChannel: ChatbotNotificationChannel = {
  chatConfigurationArns: ['arn:aws:chatbot::123456789012:chat-configuration/slack-channel/my-channel'],
  snsTopicArn: Topic.fromTopicArn(this, 'ImportedTopic', 'arn:aws:sns:us-east-1:123456789012:aiops-notifications'),
};
group.addChatbotNotificationChannel(chatbotNotificationChannel);
```

##### Resource Policy Permissions Management

Investigation group supports resource based policy, allowing identity to perform AIOps actions on the investigation group resource.
L2 construct supports multiple helper methods for identity to setup the resource based policy on investigation group.

For `grantCreate` method, L2 construct will grant given identity create permissions on this investigation group resource,
including `aiops:createInvestigation` and `aiops:createInvestigationEvent`.

```typescript
const alarmsSP = new ServicePrincipal('aiops.alarms.cloudwatch.amazonaws.com');
group.grantCreate(alarmsSP);
```

For `grant` method, L2 construct provides flexible permission management by allowing customer to specify custom actions that should be granted to
a principal on the investigation group resource.
This method accepts a grantee and a variable number of action strings, enabling fine-grained access control for specific AIOps operations.

```typescript
const user = User.fromUserName(this, 'InvestigationUser', 'alice');;

// Grant specific actions to a user
group.grant(user, 'aiops:GetInvestigation', 'aiops:ListInvestigations');
```

For `addToResourcePolicy` method, it allows customers to add statements to investigation group's resource policy,
allowing certain entity to perform AIOps operations on the investigation group.

```typescript
group.addToResourcePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  principals: [new ServicePrincipal('aiops.alarms.cloudwatch.amazonaws.com')],
  actions: ['aiops:CreateInvestigation'],
  resources: ['*'],
}));
```

##### Role Permissions Management

For `addToRolePolicy` method, customer can add new permission policy to Investigation Group's role,
expanding AIOps permission on customer account.

```typescript
group.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cloudwatch:GetMetricData'],
  resources: ['*'],
}));
```

##### EKS Integration

The `grantEksAccess` method creates an EKS AccessEntry that grants the investigation group's IAM role the managed AccessPolicy `AmazonAIOpsAssistantPolicy`.
This enables AIOps to access and analyze EKS cluster resources during investigations.
The method only supports clusters configured with authentication modes of `API_AND_CONFIG_MAP` or `API`.

```typescript
const cluster = Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster',
});

const accessEntry = group.grantEksAccess(cluster);
```

##### CloudWatch Metrics

The investigation group provides multiple methods to access CloudWatch metrics for monitoring and operational awareness.

The `metric` method returns a CloudWatch metric for any named metric associated with the investigation group.

```typescript
// Access a custom metric by name
const customMetric = group.metric('InvestigationErrors', {
  statistic: 'Sum',
  period: Duration.minutes(1),
});
```

The `metricActiveInvestigations` method returns a CloudWatch metric that tracks the number of active investigations under the investigation group.
This metric helps customer monitor investigation activity and can be used to create alarms for operational awareness.
The metric supports standard CloudWatch metric options including custom statistics, periods, and dimensions.

```typescript
const activeInvestigationsMetric = group.metricActiveInvestigations({
  statistic: 'Average',
  period: Duration.minutes(5),
});

const alarm = new Alarm(this, 'HighActiveInvestigations', {
  metric: activeInvestigationsMetric,
  threshold: 10,
  evaluationPeriods: 2,
});
```

### API Reference

#### Constructor

```typescript
new InvestigationGroup(scope: Construct, id: string, props: InvestigationGroupProps)
```

#### Properties Interface

```typescript
export interface ChatbotNotificationChannel {
  readonly chatConfigurationArns: ARN[];
  readonly snsTopicArn: ITopic;
}

export interface InvestigationGroupProps {
  readonly name: string;
  readonly role?: IRole;
  readonly encryptionKey?: IKey;
  readonly retention?: Duration;
  readonly crossAccountConfigurations?: IRole[];
  readonly chatbotNotificationChannels?: ChatbotNotificationChannel[];
  readonly includeCloudTrailEvents?: boolean;
  readonly tagKeyBoundaries?: string[];
  readonly resourcePolicy?: iam.PolicyStatement[];
  readonly removalPolicy?: RemovalPolicy;
}
```

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | `string` | ✓ | - | Provides a name for the investigation group. |
| `role` | `IRole` | ✗ | `AIOpsRole-DefaultInvestigationGroup-{randomSixCharacterSuffix}` | Specify the IAM role that AIOps will use when it gathers investigation data. The permissions in this role determine which of your resources AIOps will have access to during investigations. If not specified, AIOps will create a role with the name `AIOpsRole-DefaultInvestigationGroup-{randomSixCharacterSuffix}` containing default permissions of manager policy `AIOpsAssistantPolicy`. |
| `encryptionKey` | `IKey` | ✗ | AWS-managed | This customer-managed KMS key ensures encryption of sensitive data during the analysis process, including both the metadata required to retrieve telemetry results and the actual telemetry result data itself. If not specified, AIOps will use an AWS-managed key to encrypt. |
| `retention` | `Duration` | ✗ | 90 days | Retention period for all resources created under the investigation group container. Min: 7 days, Max: 90 days. Investigation group related resources includes investigation, investigationEvents resources. If not specified, it will be 90 days by default.  |
| `crossAccountConfigurations` | `IRole[]` | ✗ | `[]` | List of source account role ARN values that have been configured for cross-account access. |
| `chatbotNotificationChannels` | `ChatbotNotificationChannel[]` | ✗ | `[]` | Array of chatbot notification channel. Each chatbot notification channel specifies chat configuration ARNs and an SNS topic ARN for delivering investigation updates. |
| `includeCloudTrailEvents` | `boolean` | ✗ | `false` | Specify true to include CloudTrail event history in investigations. When enabled, AIOps can access change events recorded by CloudTrail during investigations. |
| `tagKeyBoundaries` | `string[]` | ✗ | `[]` | Displays the custom tag keys for custom applications in your system that you have specified in the investigation group. Resource tags help AIOps narrow the search space when it is unable to discover definite relationships between resources. [More info](https://docs.aws.amazon.com/cloudwatchinvestigations/latest/APIReference/API_CreateInvestigationGroup.html). |
| `resourcePolicy` | `iam.PolicyStatement[]` | ✗ | `[]` | Resource policy statement on the investigation group. |
| `removalPolicy` | `RemovalPolicy` | ✗ | `RETAIN` | Resource removal policy |

#### Static Factory Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `fromInvestigationGroupArn` | `scope: Construct, id: string, arn: string` | `IInvestigationGroup` | Import investigation group by ARN |
| `fromInvestigationGroupName` | `scope: Construct, id: string, name: string` | `IInvestigationGroup` | Import investigation group by name |

#### Instance Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `addCrossAccountConfiguration` | `sourceAccountRole: IRole` | `void` | **@config** Adds a new source account role ARN to investigation group's cross-account configurations, to allow cross-account access to the source account. Maximum of 25 configurations allowed. |
| `addChatbotNotificationChannel` | `config: ChatbotNotificationChannel` | `void` | **@config** Adds a new chatbot notification channel to integrate AIOps with chat applications. |
| `addToResourcePolicy` | `statement: PolicyStatement` | `void` | Adds statement to the investigation group's resource policy. |
| `addToRolePolicy` | `statement: PolicyStatement` | `void` | Add statement to the investigation group role policy |
| `grant` | `grantee: IGrantable, ...actions: string[]` | `Grant` | Grant custom permissions to the identity |
| `grantCreate` | `grantee: IGrantable` | `Grant` | Grants create permissions on investigation groups container to the specified identity, including createInvestigation and createInvestigationEvent permissions. |
| `grantEksAccess` | `cluster: ICluster` | `AccessEntry` | Creates an EKS AccessEntry granting the investigation group IAM role the managed AccessPolicy AmazonAIOpsAssistantPolicy. Only clusters with an authentication mode of API_AND_CONFIG_MAP or API are supported. |

#### Metrics Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `metric` | `metricName: string, options?: MetricOptions` | `Metric` | Return the given named metric for this investigation group. |
| `metricActiveInvestigations` | `options?: MetricOptions` | `Metric` | Return CloudWatch metric that tracks the number of active investigations under the investigation group. |

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching an L2 construct for AWS AIOps Investigation Groups that provides secure defaults,
simplified configuration, and helper methods following AWS CDK design principles.

### Why should I use this feature?

This L2 construct enables the creation of investigation groups with minimal code while adhering to AWS best practices.
It eliminates the complexity of manually configuring IAM roles, KMS encryption, and service principal trust relationships.

## Internal FAQ

### Why are we doing this?

The development of AIOps L2 constructs addresses significant customer needs and adoption patterns. Currently, customers rely on L1 constructs through CloudFormation,
requiring detailed understanding of resource configurations. Additionally, multiple Amazon internal teams have successfully adopted an internal
L2 package for AIOps resource management, demonstrating the value and demand for higher-level abstractions.

The L2 constructs will encapsulate AWS best practices within implementation,
significantly reducing the risk of misconfiguration while ensuring consistent and secure deployment patterns across customer applications.
This L2 construct approach allows customers to focus on their business logic rather than underlying infrastructure details.

### Why should we _not_ do this?

L1 CDK constructs for investigationGroup already exist. However, they require extensive configuration and deep understanding
of the underlying CloudFormation resources, which creates barriers to adoption.

### Is this a breaking change?

No, this is the first time releasing an L2 construct for AIOps Investigation Groups.

### What alternative solutions did you consider?

We considered providing customers with detailed usage documentation for L1 constructs. However,
this approach requires extensive code to provision resources and lacks the abstraction benefits of L2 constructs.

### What are the drawbacks of this solution?

There are no significant drawbacks. The L2 construct provides optional advanced configuration for customers
who need it while maintaining simple defaults for common use cases.

### What is the high-level project plan?

The AIOps service has gone GA. We would like to follow CDK community guidelines to release this L2 construct and collect customer feedback.

#### Phase 1: RFC

- Submit RFC proposal for creating the AIOps L2 constructs
- Design the initial interface and helper methods
- Get API Bar Raiser approval on the RFC

#### Phase 2: Development

- Create a new aiops implementation under aws-cdk repo
- Create comprehensive unit/integration tests
- Write comprehensive API documentation
- Get reviewed by CDK community and address feedback

### Are there any open issues that need to be addressed later?

No open issues at this time.

## Appendix

### References

- [AWS AIOps Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations.html)
- [CloudFormation InvestigationGroup Resource](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-aiops-investigationgroup.html)

### L1 Construct Example

The following example shows the complexity required when using L1 constructs:

```typescript
import {
  Role,
  ServicePrincipal,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  AccountRootPrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnInvestigationGroup } from 'aws-cdk-lib/aws-aiops';

public createInvestigationGroup(id: string): void {
   const partition = 'aws', region = 'us-east-1', accountId = '1234567890';
    const aiOpsAssistantRole = this.createAIOpsAssistantRole(partition, region, accountId);
    const encryptionKey = this.createEncryptionKeyForInvestigationGroup(partition, region, accountId);

    new CfnInvestigationGroup(this, 'InvestigationGroup', {
      name: `${id}-InvestigationGroup-${account}-${region}`,
      roleArn: aiOpsAssistantRole.roleArn,
      encryptionConfig: {
        encryptionConfigurationType: 'CUSTOMER_MANAGED_KMS_KEY',
        kmsKeyId: encryptionKey.keyArn,
      },
    });
  }

  private createAIOpsAssistantRole(partition:string, region:string, account:string): Role {
    return new Role(this, 'AIOpsAssistantRole', {
      assumedBy: new ServicePrincipal('<AIOps-ServicePrincipal>', {
        conditions: {
          // Prevent a confused deputy situation
          StringEquals: {
            'aws:SourceAccount': account,
          },
          ArnLike: {
            'aws:SourceArn': `arn:${partition}:aiops:${region}:${account}:*`,
          },
        },
      }),
      // You can customize the policy to be used by AI Operations, this is the minimum permission.
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AIOpsAssistantPolicy')],
    });
  }

  private createEncryptionKeyForInvestigationGroup(partition:string, region:string, account:string): Key {
    const investigationGroupArnLike = `arn:${partition}:aiops:${region}:${account}:investigation-group/*`;

    return new Key(this, 'CloudWatchInvestigationGroupEncryptionKey', {
      enableKeyRotation: true,
      description: 'The key used to encrypt investigations in CloudWatch investigations.',
      policy: new PolicyDocument({
        statements: [
          // Account administrator permission
          new PolicyStatement({
            actions: ['kms:*'],
            principals: [new AccountRootPrincipal()],
            resources: ['*'],
          }),
          // CloudWatch investigation permissions
          new PolicyStatement({
            principals: [new ServicePrincipal('<AIOps-ServicePrincipal>')],
            actions: ['kms:DescribeKey'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'aws:SourceAccount': account,
              },
              StringLike: {
                'aws:SourceArn': investigationGroupArnLike,
              },
            },
          }),
          new PolicyStatement({
            principals: [new ServicePrincipal('<AIOps-ServicePrincipal>')],
            actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'aws:SourceAccount': account,
              },
              StringLike: {
                'aws:SourceArn': investigationGroupArnLike,
              },
              ArnLike: {
                'kms:EncryptionContext:aws:aiops:investigation-group-arn': investigationGroupArnLike,
              },
            },
          }),
          // Allow alarm triggered investigation for encryption
          new PolicyStatement({
            principals: [new ServicePrincipal('<CloudWatchAlarm-ServicePrincipal>')],
            actions: ['kms:DescribeKey', 'kms:Decrypt', 'kms:GenerateDataKey'],
            resources: ['*'],
            conditions: {
              ArnLike: {
                'kms:EncryptionContext:aws:aiops:investigation-group-arn': investigationGroupArnLike,
              },
              StringEquals: {
                'aws:SourceAccount': account,
                'kms:ViaService': `<AIOps-ServicePrincipal>`,
              },
              StringLike: {
                'aws:SourceArn': `arn:${partition}:cloudwatch:${region}:${account}:alarm:*`,
              },
            },
          }),
        ],
      }),
    });
  }
```
