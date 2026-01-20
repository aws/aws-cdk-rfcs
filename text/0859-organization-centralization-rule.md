# AWS ObservabilityAdmin OrganizationCentralizationRule L2 Construct

* **Original Author(s)**: @jsicheng
* **Tracking Issue**: #859
* **API Bar Raiser**: @kumsmrit, @gjurova

The Amazon ObservabilityAdmin OrganizationCentralizationRule L2 construct simplifies centralization rule creation for an AWS Organization,
reducing the complexity of configuring organization-wide log centralization policies through sensible defaults, strong-typing and synthesis-time validation.

## Working Backwards

### CHANGELOG

```
feat(observabilityadmin): ObservabilityAdmin OrganizationCentralizationRule L2 construct
```

### README

#### AWS ObservabilityAdmin OrganizationCentralizationRule Construct Library

[Amazon ObservabilityAdmin OrganizationCentralizationRule](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CloudWatchLogs_Centralization.html)
provides AWS Organization management accounts and optionally, delegated admin accounts, the ability to create log centralization rules for their
organization. Defined rules automatically replicate select CloudWatch Logs data from multiple source accounts and regions into a centralized
destination account and region. Centralization rules offers configuration flexibility to meet operational and security requirements, such as the ability
to configure a backup region and KMS encryption behavior.

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk)
project. It allows you to define ObservabilityAdmin organization centralization rules.

##### Basic Usage

```typescript
new OrganizationCentralizationRule(this, 'OrganizationCentralizationRule', {
  ruleName: 'OrganizationCentralizationRule',
  sourceScope: Scope.ALL,
  sourceRegions: ['us-east-1', 'us-west-2'],
  sourceLogGroupSelectionCriteria: LogGroupSelectionCriteria.ALL,
  destinationAccount: '123456789012',
  destinationRegion: 'us-east-1',
});
```

##### Advanced Configuration

```typescript
new OrganizationCentralizationRule(this, 'OrganizationCentralizationRule', {
  ruleName: 'OrganizationCentralizationRule',
  sourceScope: Scope.fromString(`AccountId = '012345678901'`),
  sourceRegions: ['us-east-1', 'us-west-2'],
  sourceLogGroupSelectionCriteria: LogGroupSelectionCriteria.fromString(`LogGroupName = 'ExactLogGroupName'`),
  sourceEncryptedLogGroupStrategy: EncryptedLogGroupStrategy.ALLOW,
  destinationAccount: '123456789012',
  destinationRegion: 'us-east-1',
  destinationLogEncryptionStrategy: LogEncryptionStrategy.CUSTOMER_MANAGED,
  destinationLogEncryptionConflictResolutionStrategy: LogEncryptionConflictResolutionStrategy.ALLOW,
  destinationLogEncryptionKmsKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
  destinationBackupRegion: 'us-west-2',
  destinationBackupKmsKeyArn: 'arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012',
});
```

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching a new L2 construct in the `aws-observabilityadmin` module that provides a simplified, type-safe interface for creating
AWS ObservabilityAdmin OrganizationCentralizationRule resources. This construct abstracts the complexity of the underlying CloudFormation
resource and L1 construct while following AWS CDK design principles.

### Why should I use this feature?

The L2 construct enables the creation of organization centralization rules with minimal configurations while adhering to the AWS best practices.
The included types and defaults smooths out rough edges in configuring the resource using L1 constructs.

## Internal FAQ

### Why are we doing this?

AWS ObservabilityAdmin OrganizationCentralizationRule is a feature that helps organizations centralize their log data collection. Currently, users
must work with highly nested L1 parameters, which requires deep knowledge of the service's configuration options and can lead to misconfigurations.
An L2 construct will:

1. Provide a more intuitive API with sensible defaults
2. Include built-in validation to prevent common configuration errors
3. Offer better integration with CDK patterns and other constructs

### Why should we _not_ do this?

Potential concerns:

- The service is relatively new and APIs might still evolve
- The L1 construct already provides full functionality

However, these concerns are outweighed by the benefits of providing a better developer experience and encouraging adoption of
centralized log management practices.

### What is the technical solution (design) of this feature?

- Resource interfaces:

```typescript
interface ICentralizationRuleBase extends IResource, ITaggableV2 {
  /**
   * The name of the centralization rule.
   * 
   * @attribute
   */
  readonly ruleName: string;
  /**
   * The ARN of the centralization rule.
   * 
   * @attribute
   */
  readonly ruleArn: string;
}

interface IOrganizationCentralizationRule extends ICentralizationRuleBase {}
```

- Resource classes:

```typescript
abstract class CentralizationRuleBase extends Resource implements ICentralizationRuleBase {
  public abstract readonly ruleName: string;
  public abstract readonly ruleArn: string;
}

class OrganizationCentralizationRule extends CentralizationRuleBase implements IOrganizationCentralizationRule  {
  public static fromOrganizationCentralizationRuleName(scope: Construct, id: string, name: string): IOrganizationCentralizationRule;
  public static fromOrganizationCentralizationRuleArn(scope: Construct, id: string, arn: string): IOrganizationCentralizationRule;
  constructor(scope: Construct, id: string, props: OrganizationCentralizationRuleProps);
}
```

- Resource props:

```typescript
interface BaseCentralizationRuleProps {
  /**
   * The name of the centralization rule.
   */
  readonly ruleName: string;
  /**
   * The list of source regions from which telemetry data should be centralized.
   */
  readonly sourceRegions: string[];
  /**
   * The selection criteria that specifies which source log groups to centralize. The selection criteria uses the same format as OAM link filters.
   */
  readonly sourceLogGroupSelectionCriteria: LogGroupSelectionCriteria;
  /**
   * A strategy determining whether to centralize source log groups that are encrypted with customer managed KMS keys (CMK).
   * ALLOW will consider CMK encrypted source log groups for centralization while SKIP will skip CMK encrypted source log groups from centralization.
   * @default - Skip centralizing CMK encrypted source log groups.
   */
  readonly sourceEncryptedLogGroupStrategy?: EncryptedLogGroupStrategy;
  /**
   * The destination account (within the organization) to which the telemetry data should be centralized.
   */
  readonly destinationAccount: string;
  /**
   * The primary destination region to which telemetry data should be centralized.
   */
  readonly destinationRegion: string;
  /**
   * Configuration that determines the encryption strategy of the destination log groups. 
   * CUSTOMER_MANAGED uses the configured KmsKeyArn to encrypt newly created destination log groups.
   * @default - Inferred from destinationLogEncryptionKmsKeyArn.
   * If destinationLogEncryptionKmsKeyArn is not provided, defaults to AWS_OWNED. Otherwise, defaults to CUSTOMER_MANAGED.
   */
  readonly destinationLogEncryptionStrategy?: LogEncryptionStrategy;
  /**
   * Conflict resolution strategy for centralization if the encryption strategy is set to CUSTOMER_MANAGED and
   * the destination log group is encrypted with an AWS_OWNED KMS Key.
   * ALLOW lets centralization go through while SKIP prevents centralization into the destination log group.
   * @default - Skip centralization for conflicting encryption.
   */
  readonly destinationLogEncryptionConflictResolutionStrategy?: LogEncryptionConflictResolutionStrategy;
  /**
   * KMS Key ARN belonging to the primary destination account and region, to encrypt newly created central log groups in the primary destination.
   * @default - Log groups are encrypted with an AWS_OWNED KMS key.
   */
  readonly destinationLogEncryptionKmsKeyArn?: string; // explicitly string and not IKey, since the KMS key may not be from the same account
  /**
   * Logs-specific backup destination region within the primary destination account to which log data should be centralized.
   * @default - no centralization backup destination region is configured.
   */
  readonly destinationBackupRegion?: string;
  /**
   * KMS Key ARN belonging to the primary destination account and backup region, to encrypt newly created central log groups in the backup destination.
   * Only applied when destinationBackupRegion is set. 
   * If destinationBackupRegion is set, the backup region KMS key must be specified if destinationLogEncryptionStrategy is CUSTOMER_MANAGED.
   * @default - backup destination log groups are encrypted with an AWS_OWNED KMS key.
   */
  readonly destinationBackupKmsKeyArn?: string; // explicitly string and not IKey, since the KMS key may not be from the same account
}

interface OrganizationCentralizationRuleProps extends BaseCentralizationRuleProps {
  /**
   * The organizational scope from which telemetry data should be centralized, specified using accounts or organizational unit ids.
   */
  sourceScope: Scope;
}
```

- Helper classes:

```typescript
export class Scope {
  /**
   * All accounts in the organization.
   */
  public static ALL = new Scope('*');
  /**
   * Create a scope from a string value.
   *
   * @param scope The scope string (e.g., account ID, OU ID, or '*').
   */
  public static fromString(scope: string): Scope {
    return new Scope(scope);
  }
  protected constructor(public readonly scope: string) { }
}

/**
 * The selection criteria that specifies which source log groups to centralize.
 */
export class LogGroupSelectionCriteria {
  /**
   * All log groups.
   */
  public static ALL = new LogGroupSelectionCriteria('*');
  /**
   * Create a LogGroupSelectionCriteria from a string value.
   *
   * @param selectionCriteria The selection criteria string. Uses the same format as OAM link filters.
   */
  public static fromString(selectionCriteria: string): LogGroupSelectionCriteria {
    return new LogGroupSelectionCriteria(selectionCriteria);
  }
  protected constructor(public readonly selectionCriteria: string) { }
}

/**
 * Strategy for determining whether to centralize source log groups that are encrypted with customer managed KMS keys (CMK).
 */
export enum EncryptedLogGroupStrategy {
  /**
   * Allow CMK encrypted log groups to be centralized.
   */
  ALLOW = 'ALLOW',
  /**
   * SKIP CMK encrypted source log groups from centralization.
   */
  SKIP = 'SKIP'
}

/**
 * Configuration that determines the encryption strategy of the destination log groups.
 */
export enum LogEncryptionStrategy {
  /**
   * Use the configured KmsKeyArn to encrypt newly created destination log groups.
   */
  CUSTOMER_MANAGED = 'CUSTOMER_MANAGED',
  /**
   * Use an AWS owned KMS key to encrypt newly created destination log groups.
   */
  AWS_OWNED = 'AWS_OWNED'
}

/**
 * Conflict resolution strategy for centralization if the LogEncryptionStrategy is set to CUSTOMER_MANAGED and the destination log group is 
 * encrypted with an AWS_OWNED KMS Key.
 */
export enum LogEncryptionConflictResolutionStrategy {
  /**
   * Allow source CMK encrypted log groups to be centralized despite encryption conflicts in the destination.
   */
  ALLOW = 'ALLOW',
  /**
   * Skip CMK encrypted source log groups from centralization.
   */
  SKIP = 'SKIP'
}
```

Validations:

- Required array inputs must not be empty.
- Account IDs in Scope should be 12 digit numbers.
- `destinationAccount` should be a 12 digit number.
- `sourceRegions` should not be empty.
- `sourceRegions` should contain valid AWS regions.
- `destinationRegion` should be a valid AWS region.
- `destinationBackupRegion` should be a valid AWS region.
- If `destinationLogEncryptionStrategy` is `CUSTOMER_MANAGED`, then
- `destinationLogEncryptionKmsKeyArn` must be provided.
- If destinationBackupRegion is set, then `destinationBackupKmsKeyArn` must also be provided.
- KMS Key ARNs should follow valid ARN format.

### Is this a breaking change?

No, this is a new feature that adds functionality without modifying existing APIs.

### What alternative solutions did you consider?

Keeping a simple string input for all fields without adding new types, but still keeping parameters unnested and flat.
However, many customers are likely not familiar with available options. Having classes/enums can help customers see
what options are available and avoid mistakes in configuring their rules.

### What are the drawbacks of this solution?

- **API evolution**: The underlying service is relatively new and may soon introduce new resources and fields.

### What is the high-level project plan?

- [ ]  Kick off and gather feedback for RFC
- [ ]  Bar raiser to sign off on RFC
- [ ]  Implement L2 Construct, iterate and respond to feedback
- [ ]  Merge new construct

### Are there any open issues that need to be addressed later?

- **Forward compatibility**: L2 construct must support future data sources. Some fields will be intentionally left as optional to support this.
