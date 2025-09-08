## AIOps L2 Construct

AIOps is an AWS service that helps customers troubleshoot operational issues by automating information gathering, analyzing observability data,
and providing tailored recommendations.
The service uses generative AI to create investigation notebooks that analyze operational issues and provide actionable recommendations.

The AIOps L2 construct simplifies the creation of multiple resources required for AIOPs construct.
It exposes functions for creating features with minimum code.
It will help create required IAM Role, KMS Key, Resource Policy underneath, with customer only passing the content if needed.
AIOps L1 construct only have one AIOps resources "InvestigationGroup" created, and all associated resources to grant permission and have supported configuration.

### 1. Simplified Resource Creation

#### L1 (Complex)

```typescript
// aiops.amazonaws.com is the Service Principal for AIOps services
   const role = new Role(this, "investigationGroupRole", {
      roleName: "investigationGroupRoleName",
      assumedBy: new ServicePrincipal('aiops.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AIOpsAssistantPolicy')],
    });

    const encryptionKey = new Key(this, 'CustomerCustomizedEncryptionKey', {
      enableKeyRotation: true,
      description: 'The key used to encrypt customer data.',
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ['kms:*'],
            principals: [new AccountRootPrincipal()]
            resources: ['*'],
          }),
          new PolicyStatement({
            principals: [new ServicePrincipal('aiops.amazonaws.com')],
            actions: ['kms:DescribeKey'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'aws:SourceAccount': '<accountId>',
              },
              StringLike: {
                'aws:SourceArn': `arn:aws:aiops:<region>:<accountId>:investigation-group/*`,
              },
            },
          }),
          new PolicyStatement({
            principals: [new ServicePrincipal('aiops.amazonaws.com')],
            actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'aws:SourceAccount': '<accountId>',
              },
              StringLike: {
                'aws:SourceArn': `arn:aws:aiops:<region>:<accountId>:investigation-group/*`,
              },
              ArnLike: {
                'kms:EncryptionContext:aws:aiops:investigation-group-arn': `arn:aws:aiops:<region>:<accountId>:investigation-group/*`,
              },
            },
          }),
          new PolicyStatement({
            principals: [new ServicePrincipal('aiops.alarms.cloudwatch.amazonaws.com')],
            actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
            resources: ['*'],
            conditions: {
              ArnLike: {
                'kms:EncryptionContext:aws:aiops:investigation-group-arn': `arn:aws:aiops:<region>:<accountId>:investigation-group/*`,
              },
              StringEquals: {
                'aws:SourceAccount': '<accountId>',
                'kms:ViaService': `aiops.<region>.amazonaws.com`,
              },
              StringLike: {
                'aws:SourceArn': `arn:aws:cloudwatch:<region>:<accountId>:alarm:*`,
              },
            },
          }),
        ],
      }),
    });

   const investigationGroupPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['aiops:CreateInvestigation', 'aiops:CreateInvestigationEvent'],
          principals: [new ServicePrincipal('aiops.alarms.cloudwatch.amazonaws.com')],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:SourceAccount': ['<accountId>'],
            },
          },
        }),
      ],
    });

    const group = new CfnInvestigationGroup(this, "TestInvestigationGroup", {
      name: "testGroupName",
      roleArn: role.roleArn,
      encryptionConfig: {
        encryptionConfigurationType: 'CUSTOMER_MANAGED_KMS_KEY',
        kmsKeyId: encryptionKey.keyArn,
      },
      investigationGroupPolicy: JSON.stringify(investigationGroupPolicy.toJSON()),
    });
```

#### L2 (Simplified)

```typescript
const group = new InvestigationGroup(this, 'MyInvestigationGroup', {
   name?: 'MyGroup',  // optional, if not specified, the name would be DefaultInvestigationGroup by default.
   roleArn?: IRole // optional, if not specified, L2 will create a new role named "AIOpsAssistantRole" with proper permissions.
   chatbotNotificationChannel?: {
      SNSTopicArn: Arn
   },
   encryptionConfiguration?: {
      encryptionConfigurationType: "CUSTOMER_MANAGED_KEY",
      kmsKey: key
   }
   isCloudTrailEventHistoryEnabled?: boolean,
   retentionInDays?: Duration,
   tags?: Tag[],
   tagKeyBoundaries?: string[],
   removalPolicy?: RemovalPolicy.DESTROY
});
```

### 2. Built-in Best Practices

1. **Security Defaults**:
   - Automatic encryption configuration for KMS keys, L2 will help setup the key policy statement if customer specified their own key.
   - Proper IAM role and investigation policy setup, including policy statement
   - Validated cross-account configurations

2. **Operational Excellence**:
   - Default 90-day retention period aligned with AWS recommendations
   - Automatic CloudTrail integration for better observability
   - Built-in validation for AWS service limits

3. **Integration Patterns**:
   - Pre-configured integration with AWS ChatBot
   - Streamlined cross-account setup
   - Simplified SNS topic and chat platform connections

### 3. Type Safety and Validation

1. **Compile-time Checks**:
   - Strong typing for all properties
   - Enum-based configuration options
   - Interface-driven design preventing misconfiguration

2. **Runtime Validations**:
   - Retention period bounds (7-90 days)
   - Cross-account role limit (max 25)
   - Tag key format validation
   - Chat configuration arn format

### 4. Enhanced Developer Experience

1. **Intuitive API Methods**:

   ```typescript
   // Easy resource import
   InvestigationGroup.fromInvestigationGroupName(scope, id, name);
   InvestigationGroup.fromInvestigationGroupArn(scope, id, arn);
   ```

2. **Simplified Resource Management**:
   - Automatic cleanup of associated resources
   - Managed resource dependencies

### 5. Maintenance Benefits

1. **Future Compatibility**:
   - Abstraction layer handles service updates
   - Backwards compatibility management

2. **Code Reduction**:
   - Eliminates boilerplate configuration
   - Reduces error-prone manual setup

### 6. Cost and Resource Optimization

1. **Resource Management**:
   - Default retention periods prevent unnecessary storage
   - Automated cleanup of unused resources
   - Built-in resource limitation checks

2. **Operational Efficiency**:
   - Reduced setup time
   - Fewer configuration errors
   - Standardized deployment patterns

```

These benefits make the L2 construct significantly more valuable for customers by:
1. Reducing the learning curve for new users
2. Enforcing AWS best practices automatically
3. Providing a more intuitive and type-safe API
4. Handling complex integrations and configurations
5. Reducing development time and potential errors
```

### Investigation Group

----

An Investigation Group serves as a container for organizing customer investigations, with an associated IAM role that defines AIOps backend service permissions.
The backend services assume this group role to perform AI analysis on customer data and generate hypotheses, functioning as a supportive operator for customers.

### Required Parameters

* **name**: A unique investigation group name  
* **roleArn**: ARN of an existing role for the Investigation Group
* **createRole**: Flag to enable creation of new IAM role
* **roleName**: Name of the role to create (when createRole is true)

### Optional Parameters

* **tagKeyBoundaries**: An array of tag key boundaries.
* **tags**: An array of key-value pairs to apply as tags.

* **encryptionConfig**: Controls data encryption configuration.
With AIOps analyzing customer data, AIOps use KMS Key to encrypt and store customer data temporarily
  * Uses AWS-owned keys by default for security best practices if this encryptionConfig isn't configured
  * Supports customer-managed KMS keys with proper permissions

* **retentionInDays**: Retention period for investigations  
* Minimum: 7 days
* Maximum: 90 days
* Default: 90 days

* **chatbotNotificationChannels**: Array of Chatbot notification channels for resource updates  

* **isCloudTrailEventHistoryEnabled**: Flag to enable CloudTrail event history tracking  

* **crossAccountConfigurations**: List of source account role ARNs for cross-account configurations.
AIOps offer cross-account configuration, which choose one account as monitor account and others as source accounts.
Monitor account would be able to create AIOps resources (Investigation Group), and source accounts grant monitor account permission to fetch data from.
Monitor account would assume the source account role arn to fetch data from source account.
Thus AIOps will do analysis on monitor account on all data from monitor account and source accounts.
  * Supports monitor account setup to fetch data from source accounts
  * Maximum of 25 cross-account roles are supported
