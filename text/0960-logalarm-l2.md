# RFC: Log Alarm L2 Construct

* **Original Author(s):** @rtuna
* **Tracking Issue:** https://github.com/aws/aws-cdk-rfcs/issues/960
* **API Bar Raiser:** TBD

Add a new `LogAlarm` L2 construct to `aws-cdk-lib/aws-cloudwatch` so customers can define CloudWatch log alarms — alarms
evaluated against the results of a scheduled CloudWatch Logs query — in CDK, without hand-writing the
`AWS::CloudWatch::LogAlarm` L1 resource.

## Summary

`LogAlarm` lets customers alarm directly on logs. Instead of a metric + threshold + evaluation periods, a log alarm runs
a scheduled CloudWatch Logs Insights (CWLI) query (a query string + aggregation over one or more log groups) and compares
the aggregated result against a threshold using an M-out-of-N evaluation. It also can surface matching log lines in the
alarm notification.
The construct wraps the `AWS::CloudWatch::LogAlarm` CloudFormation resource, reuses the existing
`ComparisonOperator`/`TreatMissingData` enums, and — like `Alarm` and `PromQLAlarm` — extends `AlarmBase` so it is
interchangeable anywhere an `IAlarm` is accepted.

---

## Working Backwards

`CHANGELOG: feat(cloudwatch): add Log Alarm L2 construct`

### README

#### Log Alarm

Create a CloudWatch alarm that evaluates a scheduled CloudWatch Logs query against one or more log groups and alarms on the aggregated results.

```ts
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Duration } from 'aws-cdk-lib';

declare const logGroup: logs.LogGroup;
declare const queryRole: iam.IRole;

new cloudwatch.LogAlarm(this, 'ErrorRateAlarm', {
  threshold: 5,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  queryResultsToEvaluate: 3,
  queryResultsToAlarm: 2,
  scheduledQueryConfiguration: {
    queryString: 'fields @message | filter @message like /ERROR/',
    aggregationExpression: 'count(*)',
    logGroupIdentifiers: [logGroup.logGroupName],
    scheduledQueryRole: queryRole,
    schedule: {
      rate: Duration.minutes(5),
      startTimeOffset: Duration.minutes(5),
    },
  },
});
```

##### Including Log Lines in Notifications

Set `actionLogLineCount` to include matching log lines in alarm notifications. When it is greater than 0, an
`actionLogLineRole` is required so CloudWatch can read the log lines.

```ts
new cloudwatch.LogAlarm(this, 'ErrorRateAlarm', {
  threshold: 5,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  queryResultsToEvaluate: 3,
  queryResultsToAlarm: 2,
  actionLogLineCount: 10,
  actionLogLineRole: logLineRole,
  scheduledQueryConfiguration: { /* ... */ },
});
```

##### Adding Actions

`LogAlarm` extends `AlarmBase`, so you add alarm, OK, and insufficient-data actions the same way as existing alarms:

```ts
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';

declare const logAlarm: cloudwatch.LogAlarm;
declare const topic: sns.Topic;

logAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic));
```

Log alarms support SNS notification, Lambda, and Systems Manager OpsItem actions. Other action types (for example
CloudWatch investigation or Systems Manager Incident) are not supported and are ignored by the service; adding one
emits a synthesis-time warning.

##### Importing an Existing Log Alarm

```ts
const imported = cloudwatch.LogAlarm.fromLogAlarmArn(
  this, 'ImportedAlarm',
  'arn:aws:cloudwatch:us-east-1:123456789012:alarm:MyLogAlarm',
);

const importedByName = cloudwatch.LogAlarm.fromLogAlarmName(this, 'ImportedByName', 'MyLogAlarm');
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to
the RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new `LogAlarm` L2 construct in the existing `aws-cdk-lib/aws-cloudwatch` module, wrapping the `AWS::CloudWatch::LogAlarm` CloudFormation resource.

### What is a log alarm?

A log alarm evaluates a scheduled CloudWatch Logs query against one or more log groups on a recurring schedule and
alarms on an aggregation of the results (for example `count(*)`). It removes the old two-step pattern (metric filter →
metric alarm) and can attach the matching log lines directly to the alarm notification.

### Why should I use this feature?

Customers monitoring logs previously had to create a metric filter and then a metric alarm, and then manually go back to
the log group to find the offending log lines. `LogAlarm` collapses that into a single construct and can surface the
triggering log lines in the notification, reducing MTTR.

### Why do I need a new construct instead of the existing `Alarm`?

The `Alarm` construct is built around a metric, comparison operator, threshold, and evaluation periods. A log alarm has
a different model: instead of a metric it runs a scheduled query (`scheduledQueryConfiguration`), and instead of
`evaluationPeriods`/`datapointsToAlarm` it uses `queryResultsToEvaluate` (N) and `queryResultsToAlarm` (M). A dedicated
construct gives a clean, type-safe API without overloading `Alarm` with mutually exclusive property groups.

---

## Internal FAQ

### Why are we doing this?

Customers who want to alarm on logs currently must create a metric filter and then a metric alarm, and then manually
return to the log group to find the log lines that triggered the alarm. CloudWatch launched `AWS::CloudWatch::LogAlarm`
to collapse this into a single resource that runs a scheduled Logs query and can surface the triggering log lines in the
notification. Without an L2, CDK users must hand-write the L1 `CfnLogAlarm`, manually render the `rate(...)` schedule
expression, wire the IAM role ARN, and discover the service's validation rules by trial and error. An L2 provides a
type-safe, validated, idiomatic API consistent with the existing `Alarm` and `PromQLAlarm` constructs.

### Why should we _not_ do this?

There is no strong reason not to. The core shape (query + aggregation + schedule + M-of-N) is stable and matches the
CloudFormation resource.

### What is the technical solution (design) of this feature?

`LogAlarm` is a new class extending `AlarmBase` (mirroring `Alarm`, `CompositeAlarm`, and `PromQLAlarm`), so it is
interchangeable anywhere an `IAlarm` is accepted:

```
IAlarm (extends IResource)
  └── AlarmBase (abstract)
        ├── Alarm
        ├── CompositeAlarm
        ├── PromQLAlarm
        └── LogAlarm     ← NEW
```

It maps to the `AWS::CloudWatch::LogAlarm` resource (a distinct resource type, unlike `PromQLAlarm` which reuses
`AWS::CloudWatch::Alarm`). The full API is in the Proposed API Design section below. Key design decisions:

- **`Duration` for the schedule** (not raw `number` seconds as `PromQLAlarm` used) — per the CDK Design Guidelines'
  preference for strong types. `rate` is rendered to a `rate(...)` schedule expression and must be a whole number of
  minutes ≥ 1 (validated at synth); `startTimeOffset`/`endTimeOffset` convert to the integer seconds the L1 expects.
- **`startTimeOffset` is required** — the scheduled-query service rejects a null start-time offset, so requiring it fails
  fast at synth instead of at deploy (per the guideline on synth-time validation of always-fail-at-deploy input).
- **`logGroupIdentifiers: string[]` (not `ILogGroup[]`)** — `aws-logs` already depends on `aws-cloudwatch`, so importing
  `ILogGroup` into `aws-cloudwatch` would create a circular module dependency and break the jsii build (which is why no
  `aws-cloudwatch` construct references `aws-logs`). `string[]` also matches how CWLI `SOURCE`-prefix queries identify log
  groups.

A proof-of-concept construct with unit tests and an integration test has been implemented and deployed against a real
account, confirming it creates a valid `AWS::CloudWatch::LogAlarm`.

### Is this a breaking change?

No. This is a new construct; it does not alter any existing API.

### What alternative solutions did you consider?

1. **Extend `Alarm` with optional log-alarm props** — rejected. Would require making most `AlarmProps` optional and adding
   mutual-exclusivity validation, degrading the type system for both standard and log alarms.
2. **A static factory on `Alarm`** (e.g. `Alarm.fromLogQuery(...)`) — rejected. Hides the different configuration model and
   still needs to return a distinct type.
3. **New `LogAlarm extends AlarmBase`** — chosen. Clean dedicated surface, interchangeable via `IAlarm`, consistent with
   the accepted `PromQLAlarm` precedent.

### What are the drawbacks of this solution?

The construct depends on the `AWS::CloudWatch::LogAlarm` schema published in `@aws-cdk/aws-service-spec`. The field
constraints are final (`logGroupIdentifiers` optional, `startTimeOffset` range fixed); the L2 is written against that
final shape and requires the corresponding published service-spec version at build time.

### What is the high-level project plan?

- [x] Implement the `LogAlarm` construct, unit tests, integration test, and README
- [x] Validate against `aws-cdk-lib` built from `@aws-cdk/aws-service-spec` 0.1.190
- [x] Deploy the integration test to a real account and confirm resource creation
- [ ] RFC review and API bar-raiser sign-off
- [ ] Open the public `aws/aws-cdk` PR
- [ ] Address review feedback, merge, and release

### Are there any open issues that need to be addressed later?

- None.

---

## Proposed API Design

### `LogAlarmProps`

```ts
export interface LogAlarmProps {
  readonly threshold: number;
  readonly comparisonOperator: ComparisonOperator;       // static-threshold operators only
  readonly queryResultsToEvaluate: number;               // N (positive integer)
  readonly queryResultsToAlarm: number;                  // M (positive integer, ≤ N)
  readonly scheduledQueryConfiguration: ScheduledQueryConfiguration;

  readonly alarmName?: string;                           // @default - generated
  readonly alarmDescription?: string;                    // @default - none
  readonly actionsEnabled?: boolean;                     // @default true
  readonly treatMissingData?: TreatMissingData;          // @default - service default
  readonly actionLogLineCount?: number;                  // 0–50
  readonly actionLogLineRole?: IRole;                    // auto-created (trusts cloudwatch.amazonaws.com) when count > 0
  readonly alarmActions?: IAlarmAction[];
  readonly okActions?: IAlarmAction[];
  readonly insufficientDataActions?: IAlarmAction[];
  readonly tags?: { [key: string]: string };
}

export interface ScheduledQueryConfiguration {
  readonly queryString: string;
  readonly aggregationExpression: string;                // e.g. count(*)
  readonly logGroupIdentifiers?: string[];               // names or ARNs; optional for inline CWLI SOURCE queries
  readonly scheduledQueryRole?: IRole;                   // auto-created (trusts logs.amazonaws.com) when omitted
  readonly schedule: ScheduledQuerySchedule;
}

export interface ScheduledQuerySchedule {
  readonly rate: Duration;                               // rendered to rate(...); whole minutes
  readonly startTimeOffset: Duration;                    // required by the service
  readonly endTimeOffset?: Duration;                     // @default - none
}
```

### `LogAlarm`

```ts
@propertyInjectable
export class LogAlarm extends AlarmBase {
  public static readonly PROPERTY_INJECTION_ID: string;
  public static fromLogAlarmArn(scope: Construct, id: string, alarmArn: string): IAlarm;
  public static fromLogAlarmName(scope: Construct, id: string, alarmName: string): IAlarm;
  public get alarmArn(): string;
  public get alarmName(): string;
  // The scheduled-query role (provided or auto-created); exposed so callers can grant/extend it.
  public readonly scheduledQueryRole: IRole;
  // The log-line role (provided or auto-created when actionLogLineCount > 0); undefined otherwise.
  public readonly actionLogLineRole?: IRole;
  constructor(scope: Construct, id: string, props: LogAlarmProps);
}
```

### Validation performed at synth

- `comparisonOperator` must be a static-threshold operator (anomaly-detection operators rejected).
- `queryResultsToEvaluate` / `queryResultsToAlarm` positive integers; `queryResultsToAlarm ≤ queryResultsToEvaluate`.
- `actionLogLineCount` integer in `[0, 50]`; requires `actionLogLineRole` when `> 0`.
- `logGroupIdentifiers` (when provided) contains at most 50 entries.
- `schedule.rate` a whole number of minutes ≥ 1.
- `schedule.startTimeOffset` between 1 second and 2592000 seconds (30 days).
- `schedule.endTimeOffset` (when provided) between 0 seconds and 2592000 seconds (30 days).
- `aggregationExpression` at most 2048 characters.

---

## CloudFormation Mapping

```ts
new cloudwatch.LogAlarm(this, 'ErrorRateAlarm', {
  threshold: 5,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  queryResultsToEvaluate: 3,
  queryResultsToAlarm: 2,
  scheduledQueryConfiguration: {
    queryString: 'fields @message | filter @message like /ERROR/',
    aggregationExpression: 'count(*)',
    logGroupIdentifiers: [logGroup.logGroupName],
    scheduledQueryRole: queryRole,
    schedule: { rate: Duration.minutes(5), startTimeOffset: Duration.minutes(5) },
  },
});
```

Synthesizes to:

```yaml
Type: AWS::CloudWatch::LogAlarm
Properties:
  ComparisonOperator: GreaterThanThreshold
  Threshold: 5
  QueryResultsToEvaluate: 3
  QueryResultsToAlarm: 2
  ScheduledQueryConfiguration:
    QueryString: "fields @message | filter @message like /ERROR/"
    AggregationExpression: "count(*)"
    LogGroupIdentifiers: [ { "Ref": "LogGroup..." } ]
    ScheduledQueryRoleARN: { "Fn::GetAtt": ["ScheduledQueryRole...", "Arn"] }
    ScheduleConfiguration:
      ScheduleExpression: "rate(5 minutes)"
      StartTimeOffset: 300
```

---

## Appendix

### References

- [AWS::CloudWatch::LogAlarm — CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cloudwatch-logalarm.html)
- [CDK Design Guidelines](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md)
- [Existing Alarm L2 source](https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-cloudwatch/lib/alarm.ts)
- [AlarmBase source](https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-cloudwatch/lib/alarm-base.ts)
