# AWS CloudWatch Application Signals L2 Construct for Simplifying SLO

* **Original Author(s):**: @liunia-amazon
* **Tracking Issue**: [#673](https://github.com/aws/aws-cdk-rfcs/issues/673)
* **API Bar Raiser**: @moelasmar

The `ServiceLevelObjective` module is a collection of L2 constructs which leverages native L1 CFN resources, simplifying the Application Signals Service Level Objectives (SLOs) creation process to monitor the reliability of a service against customer expectations. 
The current process of creating SLOs using AWS CDK is complex and requires significant input from users, leading to potential errors and a time-consuming setup process. This design document addresses these challenges by proposing a predefined constants,
and robust set of L2 CDK constructs that simplify the creation of SLOs while providing the flexibility.
## Working Backwards

### CHANGELOG

`feat(cloudwatch): introduce new Application Signals L2 constructs for simplifying SLO creation and management`

### README

#### IntervalProps

|Name |Type |Description |
|--- |--- |--- |
|duration |number |Duration value |
|unit |DurationUnit |Unit of duration <br>One of the following enum values:<br>`HOUR`<br>`DAY`<br>`MINUTE`|

#### CalendarIntervalProps

|Name |Type |Description |
|--- |--- |--- |
|duration |number |Duration value |
|startTime? |number |Start time for the calendar interval.<br> default is now |
|unit |DurationUnit (enum) |Unit of duration. the following enum values:<br>`MONTH` |

#### GoalConfig

|Name |Type |Description |
|--- |--- |--- |
|attainmentGoal? |number |Optional The target goal percentage.<br> default is 99.9 |
|warningThreshold? |number |Optional warning threshold percentage.<br> default is 30 |
|interval |IInterval |Interval configuration |

#### MetricDimension

|Name |Type |Description |
|--- |--- |--- |
|name |string |Dimension name |
|value |string |Dimension value |

#### MetricDefinition

|Name |Type |Description |
|--- |--- |--- |
|metricName |string |Name of the metric |
|namespace |string |Metric namespace |
|dimensions? |MetricDimension[] |Optional metric dimensions |

#### SliMetricBaseProps

|Name |Type |Description |
|--- |--- |--- |
|metricThreshold |number |Threshold for the metric |
|metricType? |MetricType(enum) |Optional metric type. <br>One of the following enum values:<br>`LATENCY`<br>`AVAILABILITY` |
|keyAttributes? |string |Optional key attributes |
|operationName? |string |Optional operation name |
|comparisonOperator? |ComparisonOperator(enum( |Optional comparison operator. <br> One of the following enum values:<br>`GREATER_THAN`<br>`LESS_THAN`<br>`GREATER_THAN_OR_EQUAL`<br>`LESS_THAN_OR_EQUAL` 


#### PeriodBasedMetricProps

|Name |Type |Description |
|--- |--- |--- |
|periodSeconds? |number |Period in seconds, default is 60s |
|statistic |MetricStatistic |Statistic |
|metricDataQueries |MetricDataQuery[] |Array of metric queries |

#### RequestBasedMetricProps

|Name |Type |Description |
|--- |--- |--- |
|goodCountMetrics? |MetricDataQuery[] |Optional good count metrics |
|totalCountMetrics |MetricDataQuery[] |Total count metrics |
|badCountMetrics? |MetricDataQuery[] |Optional bad count metrics |

#### PeriodBasedSloProps

|Name |Type |Description |
|--- |--- |--- |
|name |string |The name of the SLO |
|keyAttributes |IResolvable \| { [string]: string } |The key attributes for the SLO |
|operationName? |string |The operation name for the SLO (optional) |
|goal |SLOGoalConfig |The goal configuration for the SLO |
|sliMetric? |PeriodBasedMetricProps |Period-based metric configuration |
|description? |string |A description for the SLO (optional) |
|burnRateWindows? |number[] |Burn rate windows (Optional) |

#### RequestBasedSloProps

|Name |Type |Description |
|--- |--- |--- |
|name |string |The name of the SLO |
|keyAttributes |IResolvable \| { [string]: string } |The key attributes for the SLO |
|operationName? |string |The operation name for the SLO (optional) |
|goal |SLOGoalConfig |The goal configuration for the SLO |
|sliMetric? |RequestBasedMetricProps |Request-based metric configuration |
|description? |string |A description for the SLO (optional) |
|burnRateWindows? |number[] |Burn rate windows (Optional) |
* ERIOD_SLI_METRIC
* REQUEST_SLI_METRIC

#### Use Case 1 - Create a Period-based SLO with custom metrics, default attainmentGoal: 99.9 and warningThreshold: 30

```
const periodSlo = ServiceLevelObjective.periodBased(this, 'PeriodSLO', {
  name: 'my-period-slo',
  goal: {
    interval: Interval.rolling({
      duration: 7,
      unit: DurationUnit.DAY,
    }),
  },
  metric: {
    metricThreshold: 100,
    periodSeconds: 300,
    statistic: 'Average',
    metricDataQueries: [/* ... */],
  },
});
```

#### Use Case 2 - Create a Period-based SLO with service/operation, attainmentGoal is 99.99 and warningThreshold is 50

```
const availabilitySlo = ServiceLevelObjective.periodBased(this, 'ApiAvailabilitySlo', {
  name: 'api-availability-slo',
  description: 'API endpoint availability SLO',
  goal: {
    attainmentGoal: 99.99,
    warningThreshold: 50,
    interval: Interval.calendar({
      duration: 1,
      unit: DurationUnit.MONTH,
      // default startTime is now,
    }),
  },
  metric: {
    metricThreshold: 99,
    metricType: MetricType.AVAILABILITY,
    operationName: 'OrderProcessing',
    keyAttributes: {
      service: 'OrderService',
    },
    periodSeconds: 300,
    statistic: 'Average',
  },
});
```

#### Use Case 3 - Create request based SLO with custom metrics

```
const requestSlo = ServiceLevelObjective.requestBased(this, 'RequestSLO', {
  name: 'my-request-slo',
  goal: {
    interval: Interval.calendar({
      duration: 30,
      unit: DurationUnit.DAY,
      startTime: 1,
    }),
  },
  metric: {
    metricThreshold: 200,
    goodCountMetrics: [/* ... */],
    totalCountMetrics: [/* ... */],
  },
});
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```text
[] Signed-off by API Bar Raiser @moelasmar
```

## Public FAQ

### What are we launching today?

We are launching a new L2 construct `ServiceLevelObjective` to simplify the Application Signals SLO creation process.These constructs provide a simplified and more intuitive way to create and manage SLOs using AWS CDK.

### Why should I use this feature?

You should use this feature if you want to:

1. Simplify the process of creating SLOs in your CDK applications
2. Reduce the amount of configuration required for each SLO
3. Benefit from enhanced type safety and autocompletion support

## Internal FAQ

### Why are we doing this?

We are implementing these L2 constructs to address the current complexity in creating SLOs using CDK. The existing process requires extensive configuration and lacks standardization, leading to potential errors and a time-consuming setup process.

### Why should we *not* do this?

While the benefits are significant, potential reasons not to proceed include:

1. Maintenance overhead of supporting both L1 and L2 constructs
2. Possible limitations in flexibility for highly customized SLO configurations

### What is the technical solution (design) of this feature?

#### 1.  Simplified API Structure
   Added pre-defined defaults and builder patterns for cleaner code organization

#### 2. Enhanced Type Safety

   Replaced string literals with enums (DurationUnit, MetricType, ComparisonOperator) 
#### 3. New Features
   Introduced separate Period-based and Request-based SLO patterns   
   Added validation logic for configuration values  
   Implemented reusable interval configurations

### Is this a breaking change?

No.

### What alternative solutions did you consider?

N/A

### What are the drawbacks of this solution?

N/A

### What is the high-level project plan?

* [ ]  Gather feedback on the RFC
* [ ]  Get bar raiser to sign off on RFC
* [ ]  Make pull request to aws-cdk repository
* [ ]  Iterate and respond to PR feedback
* [ ]  Merge new construct and related changes

### Are there any open issues that need to be addressed later?
