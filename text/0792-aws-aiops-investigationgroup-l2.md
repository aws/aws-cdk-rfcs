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
  retentionInDays: Duration.days(30),
  isCloudTrailEventHistoryEnabled: true,
  tagKeyBoundaries: ['Environment', 'Application'],
  removalPolicy: RemovalPolicy.DESTROY,
});
```

#### Helper Methods

##### Cross-Account Configuration

L2 construct extends the investigation group's cross-account capabilities by adding a new source account role ARN
and configuring the necessary `assumeRole` permission in the investigation group's IAM role.
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

For customers who have integrated AIOps with their chat applications, this method allows you to configure notification delivery through an Amazon SNS topic.
When added, investigation updates will be sent to the specified SNS topic, which forwards these notifications to your integrated chat client.

```typescript
const notificationTopic = new Topic(this, 'AIOpsNotifications');
group.addChatbotNotification(notificationTopic);
```

##### Permissions Management

Once the investigation group is created,
customers need the create permission to be able to add investigations and related resources under the investigation group.
L2 construct will grant create permissions on this investigation group resource to an IAM principal in `grantCreate` method.

```typescript
const user = User.fromUserName(this, 'InvestigationUser', 'alice');
group.grantCreate(user);
```

##### EKS Integration

Creates an EKS AccessEntry granting the investigation group IAM role the managed AccessPolicy AmazonAIOpsAssistantPolicy.
Only clusters with  an authentication mode of `API_AND_CONFIG_MAP` or `API` are supported.

```typescript
const cluster = Cluster.fromClusterAttributes(this, 'MyCluster', {
  clusterName: 'my-cluster',
});

const accessEntry = group.grantEksAccess(cluster);
```

##### CloudWatch Metrics

`metricActiveInvestigations` method return the metric with active investigations number under investigation group.

```typescript
const activeInvestigationsMetric = group.metricActiveInvestigations({
  statistic: 'Average',
  period: Duration.minutes(5),
});
```

### API Reference

#### Constructor

```typescript
new InvestigationGroup(scope: Construct, id: string, props: InvestigationGroupProps)
```

#### Properties Interface

```typescript
export interface InvestigationGroupProps {
  readonly name: string;
  readonly role?: IRole;
  readonly encryptionKey?: IKey;
  readonly retentionInDays?: Duration;
  readonly crossAccountConfigurations?: IRole[];
  readonly chatbotNotificationChannels?: ITopic[];
  readonly isCloudTrailEventHistoryEnabled?: boolean;
  readonly tagKeyBoundaries?: string[];
  readonly resourcePolicy?: iam.PolicyStatement[];
  readonly removalPolicy?: RemovalPolicy;
}
```

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | `string` | ✓ | - | Investigation group name |
| `role` | `IRole` | ✗ | Auto-created | IAM role for AIOps service |
| `encryptionKey` | `IKey` | ✗ | AWS-managed | KMS key for encryption |
| `retentionInDays` | `Duration` | ✗ | 90 days | Data retention period (7-90 days) |
| `crossAccountConfigurations` | `IRole[]` | ✗ | `[]` | Source account roles (max 25) |
| `chatbotNotificationChannels` | `ITopic[]` | ✗ | `[]` | SNS topics for notifications |
| `isCloudTrailEventHistoryEnabled` | `boolean` | ✗ | `false` | Enable CloudTrail event history |
| `tagKeyBoundaries` | `string[]` | ✗ | `[]` | Custom tag keys for resource discovery |
| `resourcePolicy` | `iam.PolicyStatement[]` | ✗ | `[]` | Resource policy statements |
| `removalPolicy` | `RemovalPolicy` | ✗ | `RETAIN` | Resource removal policy |

#### Static Factory Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `fromInvestigationGroupArn` | `scope: Construct, id: string, arn: string` | `IInvestigationGroup` | Import investigation group by ARN |
| `fromInvestigationGroupName` | `scope: Construct, id: string, name: string` | `IInvestigationGroup` | Import investigation group by name |

#### Instance Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `addCrossAccountConfiguration` | `sourceAccountRole: IRole` | `void` | **@config** Add cross-account access |
| `addChatbotNotification` | `snsTopic: ITopic` | `void` | **@config** Add notification channel |
| `addToResourcePolicy` | `statement: PolicyStatement` | `void` | Add resource policy statement |
| `addToRolePolicy` | `statement: PolicyStatement` | `void` | Add statement to the investigation group role policy |
| `grant` | `grantee: IGrantable, ...actions: string[]` | `Grant` | Grant custom permissions |
| `grantCreate` | `grantee: IGrantable` | `Grant` | Grant investigation creation permissions |
| `grantEksAccess` | `cluster: ICluster` | `AccessEntry` | Grant EKS cluster access |

#### Metrics Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `metric` | `metricName: string, options?: MetricOptions` | `Metric` | Return the given named metric |
| `metricActiveInvestigations` | `options?: MetricOptions` | `Metric` | Get active investigations metric |

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

#### Phase 3: Post-Launch

- Publish launch blog and announcement posts
- Regular updates when feedback is provided by customers
- Move to aws-cdk-lib package from alpha package if no open issues are present

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

### Core Construct Implementation

```typescript
export class InvestigationGroup extends Construct implements IInvestigationGroup {
  public readonly investigationGroupArn: string;
  public readonly role: IRole;
  public readonly encryptionKey?: IKey;
  
  constructor(scope: Construct, id: string, props: InvestigationGroupProps) {
    // Implementation with secure defaults
  }
}
