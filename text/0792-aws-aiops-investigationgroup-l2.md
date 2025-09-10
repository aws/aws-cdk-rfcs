## AIOps L2 Construct

AIOps is an AWS service that helps customers troubleshoot operational issues by automating information gathering, analyzing observability data,
and providing tailored recommendations.
The service uses generative AI to create investigation notebooks that analyze operational issues and provide actionable recommendations.

The AIOps L2 construct simplifies the creation of multiple resources required for AIOPs construct.
It exposes functions for creating features with minimum code.
It will help create required IAM Role, KMS Key, Resource Policy underneath, with customer only passing the content if needed.
AIOps L1 construct only have one AIOps resources "InvestigationGroup" created, and all associated resources to grant permission and have supported configuration.

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
Investigation belongs to one investigation group, which customers can use to track progress of an incident.
Investigation event refers to each telemetry that customer add to investigation.
Both investigation and investigation event are called as investigation group related resources.
The backend services assume this group role to perform AI analysis on customer data and generate hypotheses, functioning as a supportive operator for customers.

#### Create Investigation Group

To create investigation group, it takes those parameters

#### Required Parameters

* **name** prop: A unique investigation group name  

#### Optional Parameters

* **role** prop: ARN of an existing role for the Investigation Group.
If not specified, AIOps will create a default role with name `AIOpsAssistantRole`,
and attach managed policy `AIOpsAssistantPolicy` to it, and add trust relationship from AIOps SPN.

* **encryptionKey** prop: This is kms key to encrypt customer data during analysis. If not specified, AIOps will use AWS-managed key to encrypt.

* **retentionInDays** prop: Retention period for all resources created under investigation group container. Min: 7 days, Max: 90 days (Default)

* **chatbotNotificationChannels** prop: Array of Chatbot notification channels arns.
AIOps would send investigation group related resources updates to those channels.

* **isCloudTrailEventHistoryEnabled** prop: Flag to enable CloudTrail event history.  

* **crossAccountConfigurations** prop: List of source account role ARNs for cross-account configurations.
AIOps offer cross-account analysis, that AIOps choose one account as monitor account and others as source accounts.
Monitor account would be able to create AIOps resources (Investigation Group and related resources),
while source accounts grant monitor account permission to fetch data from them via source account role.
Thus AIOps will do analysis on monitor account on all data fetched from monitor account and source accounts.
Max of 25 cross account configuration are supported.

Example

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup',
   role?: IRole
   chatbotNotificationChannels?: [
      SNSTopicArn
   ],
   encryptionKey?: Ikey
   isCloudTrailEventHistoryEnabled?: boolean,
   retentionInDays?: Duration,
   removalPolicy?: RemovalPolicy.DESTROY
});
```

#### Methods

##### To add a cross account configuration

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.addCrossAccountConfiguration({
  sourceRoleArn: Arn
});
```

##### To add a chatbot notification channel

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.addChatbotNotification({
  snsTopicArn: Arn
});
```

##### To add a resource policy

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

const policy = new PolicyStatement({
          actions: ['aiops:CreateInvestigation', 'aiops:CreateInvestigationEvent'],
          principals: [new ServicePrincipal('aiops.alarms.cloudwatch.amazonaws.com')],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:SourceAccount': ['<accountId>'],
            },
          },
        });
group.addToResourcePolicy(policy);
```
