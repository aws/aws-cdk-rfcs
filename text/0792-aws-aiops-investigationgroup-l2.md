# AIOps L2 construct

* **Original Author(s):** @amandaleeatwork
* **Tracking Issue**: [#{0792}](https://github.com/aws/aws-cdk-rfcs/issues/792)
* **API Bar Raiser**: @{BAR_RAISER_USER}

AIOps is an AWS service that helps customers troubleshoot operational issues by automating information gathering, analyzing observability data,
and providing tailored recommendations.
The service uses generative AI to create investigation notebooks that analyze operational issues and provide actionable recommendations.

The AIOps L2 construct simplifies the creation of multiple resources required for AIOps constructs.
It exposes functions for creating constructs with minimal code.
It will help create the required IAM Role, KMS Key, and Resource Policy underneath, with customers only passing the content if needed.
The AIOps L1 construct has one AIOps resource "InvestigationGroup" created, which requires customers to create all associated resources and set up permissions.

## Working Backwards

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

To create an investigation group and set up CloudWatch investigations (aka AIOps),
you must be signed in to an IAM principal that has either the AIOpsConsoleAdminPolicy or the AdministratorAccess IAM policy attached,
or to an account that has similar permissions.

#### Create Investigation Group

L2 construct Example

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: string,
   role?: IRole,
   encryptionKey?: IKey,
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

----

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

Compared to L1 AIOps constructs, introducing an L2 construct would have the following benefits:

1. **Security Defaults**:
   - Automatic encryption configuration for KMS keys, L2 will help setup the key policy statement if customer specified their own key.
   - Proper IAM role and investigation policy setup, including policy statement

2. **Operational Excellence**:
   - Quick and easy creation of constructs
      - Investigation Group role creation, resource-based policy attachment, and encryption key setup are simplified
   - Helper methods for better user experience
      - addCrossAccountConfiguration: Add additional cross-account configuration
      - addChatbotNotification: Add a new chatbot notification ARN to send investigation group resource updates to
      - addToResourcePolicy: Add a new policy statement to the resource policy
   - Validation and user-friendly error handling
      - Retention days validation (7 - 90 days)
      - Cross-account configuration list size limit (max 25), and role ARN format validation
      - Chat configuration ARN format
   - Reducing the learning curve for new users, and reducing development time and potential errors
   - Enforcing AWS best practices automatically

## Internal FAQ

### Why are we doing this?

> Customers have been asking questions about setting up AIOps L1 constructs via CloudFormation,
and multiple customers from Amazon have adopted an internal L2 package to create AIOps resources.
Releasing an L2 construct in aws-cdk-lib could help customers adopt AIOps efficiently.

### Why should we _not_ do this?

> None

### What is the technical solution (design) of this feature?

> We will add an investigation group construct and provide methods to help set up the permissions/roles effectively underneath.

Key design principles:

- **Simplicity**: Expose few properties for customers; the L2 construct will handle the underlying business logic.
- **Sensible Defaults**: Production-ready configurations out of the box
- **Extensibility**: Support for custom configurations and functionality for expanding configurations
- **Type Safety**: Strong typing for better developer experience

**Initializer:**

```new InvestigationGroup(scope: Construct, id: string, props?: InvestigationGroupProps)```

**Construct Properties:**
InvestigationGroupProps

| Name | Type       | Optional | Documentation |
|------|------------|----------|---------------|
| `name` | `string`   | No | Provides a name for the investigation group. |
| `role` | `IRole`    | Yes | Specify the ARN of the IAM role that CloudWatch investigations will use when it gathers investigation data. The permissions in this role determine which of your resources CloudWatch investigations will have access to during investigations. If not specified, CloudWatch investigations will create a role with the name `AIOpsRole-DefaultInvestigationGroup-{randomSixCharacterSuffix}` containing default permissions. |
| `retentionInDays` | `number`   | Yes | Retention period for all resources created under the investigation group container. Min: 7 days, Max: 90 days. If not specified, it will be 90 days by default. |
| `encryptionKey` | `IKey`     | Yes | This is a customer-managed KMS key to encrypt customer data during analysis. If not specified, AIOps will use an AWS-managed key to encrypt. |
| `chatbotNotificationChannels` | `Arn[]`    | Yes | Array of Chatbot notification channel ARNs. AIOps will send investigation group-related resource updates to those channels. |
| `tagKeyBoundaries` | `string[]` | Yes | Enter the existing custom tag keys for custom applications in your system. Resource tags help CloudWatch investigations narrow the search space when it is unable to discover definite relationships between resources. For example, to discover that an Amazon ECS service depends on an Amazon RDS database, CloudWatch investigations can discover this relationship using data sources such as X-Ray and CloudWatch Application Signals. However, if you haven't deployed these features, CloudWatch investigations will attempt to identify possible relationships. Tag boundaries can be used to narrow the resources that will be discovered by CloudWatch investigations in these cases. [More info](https://docs.aws.amazon.com/cloudwatchinvestigations/latest/APIReference/API_CreateInvestigationGroup.html). |
| `isCloudTrailEventHistoryEnabled` | `boolean`  | Yes | Flag to enable CloudTrail event history. If not specified, its default is false. |
| `crossAccountConfigurations` | `Arn[]`    | Yes | List of source account role ARN values that have been configured for cross-account access. |

**Methods:**

| Name | Parameters | Description |
|------|------------|---------------|
| `addCrossAccountConfiguration` | `sourceAccountRole: Arn` | Adds a new cross-account configuration to allow access from another AWS account. Maximum of 25 configurations allowed. |
| `addChatbotNotification` | `snsTopic: Arn` | Adds a new chatbot notification channel to receive investigation group updates. |
| `addToResourcePolicy` | `statement: PolicyStatement` | Adds a policy statement to the investigation group's resource policy. |
| `grantCreate` | `grantee: IGrantable` | Grants create permissions on investigation groups container to the specified IAM principal. |

### Methods

#### To add a cross account configuration

This will add a new source account role ARN to the investigation group.
It does not validate whether the source account role exists or not during investigation group creation.
The source account role and monitor account role permissions need to be set up separately. See [Cross-account investigations](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations-cross-account.html)

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
customers need the create permission to be able to add investigations and related resources under the investigation group.
This will grant create permissions on this investigation group resource to an IAM principal.

`grantCreate(grantee: IGrantable)`

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name: 'MyGroup'
});

group.grantCreate(new ServicePrincipal("<servicePrincipal>"));
```

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
