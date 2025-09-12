## AIOps L2 Construct

AIOps is an AWS service that helps customers troubleshoot operational issues by automating information gathering, analyzing observability data,
and providing tailored recommendations.
The service uses generative AI to create investigation notebooks that analyze operational issues and provide actionable recommendations.

The AIOps L2 construct simplifies the creation of multiple resources required for AIOPs construct.
It exposes functions for creating features with minimum code.
It will help create required IAM Role, KMS Key, Resource Policy underneath, with customer only passing the content if needed.
AIOps L1 construct has one AIOps resources "InvestigationGroup" created, which requires customer to create all associated resources and setup permission.

### A quick comparison between L1 and L2 AIOps constructs

1. **Security Defaults**:
   - Automatic encryption configuration for KMS keys, L2 will help setup the key policy statement if customer specified their own key.
   - Proper IAM role and investigation policy setup, including policy statement

2. **Operational Excellence**:
   - Quick and easy creation of constructs
      - Investigation Group role creation, resource based policy attachment, encryption key setup are simplified
   - Helper methods for better user experience
      - addCrossAccountConfiguration: Add additional cross account configuration
      - addChatbotNotification: add a new chatbot notification arn to send investigation group resources updates to.
      - addToResourcePolicy: Add a new policy statement to resource policy
   - Validation and user-friendly error handling
      - Retention days validation (7 - 90 days)
      - cross-account configuration list size limit (max 25), and role arn format validation
      - Chat configuration arn format
   - Reducing the learning curve for new users, and reducing development time and potential errors
   - Enforcing AWS best practices automatically

### Investigation Group

----

An Investigation Group serves as a container for organizing customer investigations, with an associated IAM role that defines AIOps backend service permissions.
Creating an investigation group is a one-time setup task for each Region in your account. It is a necessary task to be able to perform investigations.

Settings in the investigation group help you centrally manage the common properties of your investigations, such as the following:

* Who can access the investigations

* Whether investigation data is encrypted with a customer managed AWS Key Management Service key.

* How long investigations and their data are retained by default.

Currently, you can have one investigation group in each Region in your account.
Each investigation in a Region is a part of the investigation group in that Region

To create an investigation group and set up CloudWatch investigations,
you must be signed in to an IAM principal that has either the AIOpsConsoleAdminPolicy or the AdministratorAccess IAM policy attached,
or to an account that has similar permissions.

#### Create Investigation Group

Example

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup',
   role?: IRole,
   encryptionKey?: Ikey,
   chatbotNotificationChannels?: [
      snsTopic
   ],
   crossAccountConfigurations?: [
      sourceAccountRole
   ],
   isCloudTrailEventHistoryEnabled?: boolean,
   retentionInDays?: Duration,
   removalPolicy?: RemovalPolicy.DESTROY,
   tagKeyBoundaries?: string[]
});
```

### Technical designs for this feature

**Properties:**

| Name | Type | Optional | Documentation |
|------|------|----------|---------------|
| `Name` | `string` | No | Provides a name for the investigation group. |
| `role` | `IRole` | Yes | Specify the ARN of the IAM role that CloudWatch investigations will use when it gathers investigation data. The permissions in this role determine which of your resources that CloudWatch investigations will have access to during investigations. |
| `RetentionInDays` | `integer` | Yes | Retention period for all resources created under investigation group container. Min: 7 days, Max: 90 days (Default) |
| `encryptionKey` | `IKey` | Yes | This is kms key to encrypt customer data during analysis. If not specified, AIOps will use AWS-managed key to encrypt. |
| `chatbotNotificationChannels` | `string[]` | Yes | Array of Chatbot notification channels arns. AIOps would send investigation group related resources updates to those channels. |
| `tagKeyBoundaries` | `string[]` | Yes | Enter the existing custom tag keys for custom applications in your system. Resource tags help CloudWatch investigations narrow the search space when it is unable to discover definite relationships between resources. For example, to discover that an Amazon ECS service depends on an Amazon RDS database, CloudWatch investigations can discover this relationship using data sources such as X-Ray and CloudWatch Application Signals. However, if you haven't deployed these features, CloudWatch investigations will attempt to identify possible relationships. Tag boundaries can be used to narrow the resources that will be discovered by CloudWatch investigations in these cases. You don't need to enter tags created by myApplications or AWS CloudFormation, because CloudWatch investigations can automatically detect those tags. |
| `IsCloudTrailEventHistoryEnabled` | `boolean` | Yes | Flag to enable cloud trail history |
| `crossAccountConfigurations` | `string[]` | Yes | List of source account role Arn values that have been configured for cross-account access. |

**Functions:**

| Name | Static | Parameters | Return Type | Documentation |
|------|--------|------------|-------------|---------------|
| `Constructor` | No | `scope: aws-cdk-lib.core.Construct`<br>`id: string`<br>`props: InvestigationGroupProps` | `void` | The InvestigationGroup L2 construct that represents AWS::AIOps::InvestigationGroup CFN resource. |

### Methods

#### To add a cross account configuration

This will add a new source account role arn to the investigation group.
It didn't validate if the source account role exist or not during investigation group creation.
The source account role and monitor account role permissions needs to be setup separately. See [Cross-account investigations](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations-cross-account.html)

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.addCrossAccountConfiguration({
  sourceAccountRole: Arn
});
```

#### To add a chatbot notification channel

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.addChatbotNotification({
  snsTopic: Arn
});
```

#### To add a resource policy

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
customer needs the create permission to be able to add investigations and related resources under investigation group.
This will grant create permissions of this investigation group resource to an IAM principal.

`grantCreate(identity, objectsKeyPattern?, allowedActionPatterns?)`

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.grantCreate(new ServicePrincipal("<servicePrincipal>"));
```
