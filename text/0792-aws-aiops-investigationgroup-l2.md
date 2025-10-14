# AIOps L2 construct

* **Original Author(s):** @amandaleeatwork
* **Tracking Issue**: [#{0792}](https://github.com/aws/aws-cdk-rfcs/issues/792)
* **API Bar Raiser**: @{aemada-aws}

AIOps is an AWS service that helps customers troubleshoot operational issues
by automating information gathering, analyzing observability data,
and providing tailored recommendations.
The service uses generative AI to create investigation notebooks that analyze operational issues and provide actionable recommendations.

Compared to L1 AIOps constructs, introducing an L2 construct would have the following benefits:

1. **Security Defaults**:
   - Automatic encryption configuration for KMS keys, L2 construct will help setup the key policy statement if customer specified their own key.
   - If customer didn't specify the role for investigation group, L2 construct will create IAM role with `AIOpsAssistantPolicy` managed policy
   , and establishes a trust relationship with the AIOps service principal
   - If customer specified customized kms key for encryption,
the L2 construct will updates KMS key resource policy to grant necessary encryption/decryption permissions
   - If customer specified cross-account configuration, the L2 construct will update investigation group
  role to include assumeRole permission for specified source account roles.
2. **Operational Excellence**:
   - Quick and easy creation of constructs
      - L2 construct only require minimal input from customer.

   - Helper methods for better user experience
      - addCrossAccountConfiguration: Add additional cross-account configuration
      - addChatbotNotification: Add a new chatbot notification ARN to send investigation group resource updates to
      - addToResourcePolicy: Add a new policy statement to the resource policy
   - Validation and user-friendly error handling
      - Retention days validation (7 - 90 days)
      - Cross-account configuration list size limit (max 25), and each configuration with role ARN format validation
      - Chat configuration ARN format, which includes the snsTopic to send resource update notification to.
   - Reducing the learning curve for new users, and reducing development time and potential errors

L1 construct Example is in Appendix.

## Working Backwards

### CHANGELOG

```feat(aiops): AIOps L2 construct```

### README

---

## Amazon AIOps Construct Library

[AIOps (aka CloudWatch Investigations)](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations.html) is a generative AI-powered
assistant that can help you respond to incidents in your system.
It uses generative AI to scan your system's telemetry and quickly surface telemetry data and suggestions that might be related to your issue.
These suggestions include metrics, logs, deployment events, and root-cause hypotheses with visual representations when multiple resources are involved.

This construct library simplifies Investigation Group creation by leveraging CloudFormation L1 resources.
It automates essential AIOps configurations including IAM roles and resource policies,
while implementing security best practices. This abstraction reduces complexity and ensures secure deployment patterns.

### Investigation Group

An Investigation Group serves as a container for organizing customer investigations, with an associated IAM role that defines AIOps backend service permissions.
Creating an investigation group is a one-time setup task for each Region in your account. It is a necessary task to be able to perform investigations.

Settings in the investigation group help you centrally manage the common properties of your investigations, such as the following:

* Who can access the investigations

* Whether investigation data is encrypted with a customer managed AWS Key Management Service key.

* How long investigations and their data are retained by default.

Currently, you can have one investigation group in each Region in your account.
Each investigation in a Region is a part of the investigation group in that Region

#### Create Investigation Group

L2 construct Example

```typescript
//With minimum required parameters
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: "myInvestigationGroup",
}

//With all parameters
const role = new Role(this, 'AIOpsAssistantRole', {
      assumedBy: new ServicePrincipal('aiops.amazonaws.com')
});
const myKey = new Key(this, 'AIOpsGroupEncryptionKey', {
      enableKeyRotation: true,
      description: 'The key used to encrypt resources in AIOps.'
});

const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: "myInvestigationGroup",
   role: role,
   encryptionKey: myKey,
   chatbotNotificationChannels: [
      'arn:aws:sns:us-east-1:123456789012:MyTopic'
   ],
   crossAccountConfigurations: [
      'arn:aws:iam::123456789012:role/MyRole'
   ],
   isCloudTrailEventHistoryEnabled: true,
   retentionInDays: Duration.daysOf(7),
   removalPolicy: RemovalPolicy.DESTROY,
   tagKeyBoundaries: ["EKS-Application"]
});
```

### Methods

#### To add a cross account configuration

L2 construct will add a new source account role ARN to the investigation group in this method. This enables cross-account functionality, allowing
the current account to access telemetry data from a source account by assuming the source account role specified here.
L2 construct does not validate whether the source account role exists or not during investigation group creation.
The source account role and monitor account role permissions need to be set up separately. See [Cross-account investigations](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations-cross-account.html)

`addCrossAccountConfiguration(sourceAccountRole: IRole)`

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.addCrossAccountConfiguration({
  sourceAccountRole: IRole
});
```

#### To add a chatbot notification channel

If you have already integrated AIOps in chat applications with a third-party chat system,
you can add specific Amazon SNS topic to send updates to about investigations.
This Amazon SNS topic will relay those updates to the chat client.

`addChatbotNotification(snsTopic: ITopic)`

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.addChatbotNotification({
  snsTopic: ITopic
});
```

#### To add a resource policy

L2 construct will creates an IAM resource policy and assigns it to the specified investigation group.

`addToResourcePolicy(statement: PolicyStatement)`

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

const policy = new PolicyStatement({
          actions: ['aiops:*'],
          principals: [new ServicePrincipal('<servicePrincipal>')],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:SourceAccount': ['<accountId>'],
            },
          },
        });
group.addToResourcePolicy(policy);
```

#### To grant create permission on identity

Once the investigation group is created,
customers need the create permission to be able to add investigations and related resources under the investigation group.
L2 construct will grant create permissions on this investigation group resource to an IAM principal in this method.

`grantCreate(grantee: IGrantable): iam.Grant`

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.grantCreate(new ServicePrincipal("<servicePrincipal>"));
```

#### To grant EKS cluster access

Creates an EKS AccessEntry granting the investigation group IAM role the managed AccessPolicy AmazonAIOpsAssistantPolicy.
Only clusters with  an authentication mode of `API_AND_CONFIG_MAP` or `API` are supported.

`grantEksAccess(cluster: ICluster): AccessEntry: iam.Grant`

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

const accessEntry = group.grantEksAccess(new Cluster());
```

#### To get the active investigations metric

This metric reports the count of active investigations within a given investigation group.
Investigation instances can be created under an investigation group, and this metric provides visibility into the current number of ongoing investigations.

`metricActiveInvestigation(options?: cloudwatch.MetricOptions): cloudwatch.Metric;`

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

const activeMetric = group.metricActiveInvestigation();
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

AIOps L2 Construct

### Why should I use this feature?

This L2 construct for AIOps enables the creation of investigation group with minimal code,
adhering to AWS best practices.

## Internal FAQ

### Why are we doing this?

The development of AIOps L2 constructs addresses significant customer needs and adoption patterns. Currently, customers rely on L1 constructs through
CloudFormation, requiring detailed understanding of resource configurations. Additionally, multiple Amazon internal teams have successfully adopted an
internal L2 package for AIOps resource management, demonstrating the value and demand for higher-level abstractions.

The L2 constructs will encapsulate AWS best practices within implementation, significantly reducing the risk of misconfiguration while ensuring
consistent and secure deployment patterns across customer applications.
This L2 construct approach allows customers to focus on their business logic rather than underlying infrastructure details.

### Why should we _not_ do this?

> L1 CDK for investigationGroup already exist.

### What is the technical solution (design) of this feature?

> We will add an investigation group construct and provide methods to help set up the permissions/roles effectively underneath.

**Initializer:**

```new InvestigationGroup(scope: Construct, id: string, props?: InvestigationGroupProps)```

**Construct Properties:**
InvestigationGroupProps

| Name | Type       | Optional | Documentation |
|------|------------|----------|---------------|
| `name` | `string`   | No | Provides a name for the investigation group. |
| `role` | `IRole`    | Yes | Specify the IAM role that AIOps will use when it gathers investigation data. The permissions in this role determine which of your resources AIOps will have access to during investigations. If not specified, AIOps will create a role with the name `AIOpsRole-DefaultInvestigationGroup-{randomSixCharacterSuffix}` containing default permissions. |
| `retentionInDays` | `number`   | Yes | Retention period for all resources created under the investigation group container. Min: 7 days, Max: 90 days. Investigation group related resources includes investigation, investigationEvents resources. If not specified, it will be 90 days by default. |
| `encryptionKey` | `IKey`     | Yes | This customer-managed KMS key ensures encryption of sensitive data during the analysis process, including both the metadata required to retrieve telemetry results and the actual telemetry result data itself. If not specified, AIOps will use an AWS-managed key to encrypt. |
| `chatbotNotificationChannels` | `ITopic[]`    | Yes | Array of Chatbot notification channel ARNs. AIOps will send investigation group-related resource updates to those channels. |
| `tagKeyBoundaries` | `string[]` | Yes | Enter the existing custom tag keys for custom applications in your system. Resource tags help AIOps narrow the search space when it is unable to discover definite relationships between resources. For example, to discover that an Amazon ECS service depends on an Amazon RDS database, CloudWatch investigations can discover this relationship using data sources such as X-Ray and CloudWatch Application Signals. However, if you haven't deployed these features, AIOps will attempt to identify possible relationships. Tag boundaries can be used to narrow the resources that will be discovered by CloudWatch investigations in these cases. [More info](https://docs.aws.amazon.com/cloudwatchinvestigations/latest/APIReference/API_CreateInvestigationGroup.html). |
| `isCloudTrailEventHistoryEnabled` | `boolean`  | Yes | Flag to enable CloudTrail event history. If not specified, its default is false. |
| `crossAccountConfigurations` | `IRole[]`    | Yes | List of source account role ARN values that have been configured for cross-account access. |

**Methods:**

| Name | Parameters | Description |
|------|------------|---------------|
| `addCrossAccountConfiguration` | `sourceAccountRole: IRole` | Adds a new cross-account configuration to allow access from another AWS account. Maximum of 25 configurations allowed. |
| `addChatbotNotification` | `snsTopic: ITopic` | Adds a new chatbot notification channel to receive investigation group updates. |
| `addToResourcePolicy` | `statement: PolicyStatement` | Adds a policy statement to the investigation group's resource policy. |
| `grantCreate` | `grantee: IGrantable` | Grants create permissions on investigation groups container to the specified IAM principal. |
| `grantEksAccess` | `cluster: ICluster` | Creates an EKS AccessEntry granting the investigation group IAM role the managed AccessPolicy AmazonAIOpsAssistantPolicy. Only clusters with  an authentication mode of API_AND_CONFIG_MAP or API are supported. |

### Is this a breaking change?

> No, it's the first time releasing an L2 construct.

### What alternative solutions did you consider?

> Provide customers with detailed usage of L1 constructs.
However, this approach requires extensive code to provision resources and lacks the abstraction benefits of L2 constructs.

### What are the drawbacks of this solution?

> None

### What is the high-level project plan?

> The AIOps project has gone GA. We would like to follow CDK community guidelines to release this L2 construct and collect customer feedback.

**Phase 1: RFC**:

- Submit RFC proposal for creating the AIOps L2 constructs
- Design the initial interface and helper methods
- Get API BR on the RFC

**Phase 2: Development**:

- Create a new aiops implementation under aws-cdk repo
- Create comprehensive unit/integration tests
- Write comprehensive API documentation
- Get reviewed by CDK community and address feedback

**Phase 3: Post-Launch**:

- Publish launch blog and announcement posts
- Regular updates when feedback is provided by customers
- Move to aws-cdk-lib package from alpha package if no open issues are present

### Are there any open issues that need to be addressed later?

> No

## Appendix

* https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations.html

* https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-aiops-investigationgroup.html

* L1 construct example

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
