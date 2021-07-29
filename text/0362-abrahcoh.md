# Construct Library for Contributor Insights Rule

* **Original Author(s):**: @abrahcoh
* **Tracking Issue**: #362
* **API Bar Raiser**: @madeline-k

Amazon [Contributor Insights Rules](https://docs.amazonaws.cn/en_us/AmazonCloudWatch/latest/monitoring/ContributorInsights.html)
provide analysis for high cardinality data of AWS cloud components.
Users can create rules to specify the data they want to analyze and how they choose to analyze it.

By creating a construct library for Contributor Insights Rules, users will be able to create and use rules within the CDK.

# Rules

The rule will specify the rule name, the rule body, and its state.

Using the CDK, a new rule can be created as part of the stack using the construct’s constructor.
You may specify the ruleState if one desires to disable the rule or explicitly enable it.
Otherwise, it will be enabled by default.

```typescript
const rule = new InsightsRule(this, 'insight-fulName', {
    ruleName: 'insight-fulName',
    ruleBody: //..
    ruleState: InsightRuleStates.ENABLED,
    };
```

# Rule Body

Rule bodies define what data the rule will analyze and how it will analyze it. Further information on fields can be found in the
[Contributor Insights Rule Syntax documentation](https://docs.amazonaws.cn/en_us/AmazonCloudWatch/latest/monitoring/ContributorInsights-RuleSyntax.html).
There are multiple ways to either import or create a Contributor Insights rule body.

## Rule Bodies for CloudWatch Logs

For CloudWatch Logs, the user can configure their rule body via these fields:

1. `logGroupNames`: These are the log fields that the user’s rule will analyze.
2. `LogFormat`: This is the format of the log fields specifies in logGroupNames. Can either be CLF or JSON
3. `Contribution`: Specifies the contributor within the log groups the rule will analyze.
4. `AggregateOn`: Specifies whether to aggregate the report based on count of occurrences of the field
    specified in `ValueOf` (specified in the Contribution) or to aggregate the report based on the sum of
    the values of the field specified in `ValueOf`.

Users can develop rule bodies for version 1 CloudWatch Logs using the `fromRuleBody` method as seen below:

```typescript
const ruleBody = CloudWatchLogV1RuleBody.fromRuleBody({
    LogGroupNames: //some log groups,
    LogFormat: LogFormats.JSON, //optional, default is CLF if 'Fields' field is defined. Otherwise is JSON
    Contribution: //some contribution,
    AggregateOn: Aggregates.SUM //optional, default is SUM if 'ValueOf' field is defined in the Contribution.
                                //Otherwise is COUNT
 });
```

## Adding Log Groups Insight Rule Bodies

One can add log groups to an Insight Rule Body either by entering the log group names in a string array.
Wild card expressions are supported as well.

Adding log groups by name is shown below.

```typescript
const ruleBody = CloudWatchLogV1RuleBody.fromRuleBody({
    LogGroupNames: ["Interesting-Group-1", "Very-Interesting-Group-2"],
    //...
 });
```

## Additional Fields for CLF Logs

CLF log events do not have names for the fields like JSON does.
To provide the fields to use for Contributor Insights rules, a CLF log event can be treated as an array
with an index starting from 1. For example, one can specify the first field as “1”, the second field as “2”, and so on.

For convenience and better readability, the user can configure an optional `Fields` field to provide
an alias for CLF field locations.

Furthemore, if the `Fields` is defined, the log format will be inferred to be CLF.

In the below example, the user can create an alias 'IpAddress' for the data in at index 1 of the log group.

```typescript
const ruleBody = CloudWatchLogV1RuleBody.fromRuleBody({
    //...
    Fields: {
        1: "IpAddress"
    },
    //...
 });
```

## Contribution

Users can specify their contribution via these fields:

1. `Keys`: An array of up to 4 log fields
2. `ValueOf`: (Optional) Specifies a log field with numerical values.
    Only required when specifying SUM as the value for AggregateOn.
4. `Filters`: (Optional) Narrows the log events that are included in the report to those that satisfy the filter(s).
    If multiple are given, they will be evaluated with a logical AND operator. Can have a max of 4.

```typescript
const ruleBody = CloudWatchLogV1RuleBody.fromRuleBody({
    //...
    Contribution: {
        Keys: [ "$.ip"],
        ValueOf: "$.requestBytes",
        Filters: //some filters,
        },
    //...
 })
```

# Filters

Users can configure the filters by setting the `Match` field, which specifies a log field to evaluate in the filter.
Next, the user must choose an operator, available of which are shown below:

1. `In`
2. `NotIn`
3. `StartsWith`
4. `GreaterThan`
5. `LessThan`
6. `EqualTo`
7. `NotEqualTo`
8. `IsPresent`

These are all followed by the values these operators will compare against.

`In`, `NotIn`, and `StartsWith` accept an array of strings with max size of 10.
`GreaterThan`, `LessThan`, `EqualTo`, and `NotEqualTo` accept a single numerical value.
`IsPresent` accept either boolean true or false.

To add a filter to a CloudWatch logs contribution, the user will use the `CloudWatchLogsV1Filter.fromFilter()` method,
which will take in a `ICloudWatchLogV1RuleBodyFilter`. Users will enter in the `Match` value and the corresponding
operation and input.

> Note: the name 'operationAndInput' is primarily a placeholder until a better idea comes up.
> Maybe just 'operation' would be sufficient

An example is shown below:

```typescript
const ruleBody = CloudWatchLogV1RuleBody.fromRuleBody({
        //...
        Contribution: {
            Keys: //...
            ValueOf: //...
            Filters: [
                CloudWatchLogsV1Filter.fromFilter({
                    match: '$.httpMethod',
                    operationAndInput: {
                        StartsWith: ['PUT', 'POST']
                    }
                })
            ],
        //...
    })
```

In addition, users can use the `CloudWatchLogsV1FilterOperationFunctions` class to leverage autocompletion and
typechecking when creating the `operationAndInput` field as shown below:

```typescript
const ruleBody = CloudWatchLogV1RuleBody.fromRuleBody({
        //...
        Contribution: {
            Keys: //...
            ValueOf: //...
            Filters: [
                CloudWatchLogsV1Filter.fromFilter({
                    match: '$.httpMethod',
                    operationAndInput: CloudWatchLogsV1FilterOperationFunctions.startsWith('PUT', 'POST'),
                })
            ],
        //...
    })
```

Furthermore, to add multiple filters, the user can use the `CloudWatchLogsV1Filter.allOf()` method as
shown below:

> Note: using 'allOf' was chosen to be similar to how multiple alarm rules are made. As every filter
> is combined via a logical AND operator, it was chosen to use a similar syntax for filters.
> Doing a logical OR operation is not available yet; however, when/if it does, one would follow
> a similar pattern as the alarm rules and use a function like 'anyOf'

```typescript
const ruleBody = CloudWatchLogV1RuleBody.fromRuleBody({
        //...
        Contribution: {
            Keys: //...
            ValueOf: //...
            Filters: CloudWatchLogsV1Filter.allOf(
              {
                match: '$.httpMethod',
                operationAndInput: CloudWatchLogsV1FilterOperationFunctions.in('PUT'),
              },
              {
                match: '$.BytesRecieved',
                operationAndInput: {
                        GreaterThan: 0
                    }
              },
        ),
        //...
    })
```

## Sample Initialization for a Rule with a CloudWatchLog Rule Body

Below is an example initialization of a CloudWatch log rule.

```typescript
import * as cdk from '@aws-cdk/core';
import { CloudWatchLogsV1Filter,
    InsightRule,
    CloudWatchLogsV1RuleBody,
    CloudWatchLogsV1FilterOperationFunctions
    } from '../lib';

new InsightRule(stack, 'myRadRule', {
  insightRuleName: 'veryCoolRule',
  insightRuleBody: CloudWatchLogsV1RuleBody.fromRuleBody({
    logGroupNames: ['/aws/lambda/*'],
    contribution: {
      keys: ['$.requestId'],
      valueof: '$.BytesRecieved',
      filters: [
        CloudWatchLogsV1Filter.fromFilter({
          match: '$.httpMethod',
          operationAndInput: CloudWatchLogsV1FilterOperationFunctions.startsWith('PUT'),
        }),
      ],
    },
  }),
});
```

## Importing CloudWatchLog Rules from Files

One can also load a CloudWatch log rule from a file using `CloudWatchLogV1RuleBody.fromFile()` method, which
takes in the filepath as the input. This will also verify that the rule body in the file is valid.

```typescript
import * as cdk from '@aws-cdk/core';
import { InsightRule } from '../lib';

const rule = new InsightRule(this, "Insight-fulRule", {
    RuleName: "Insight-fulName",
    RuleBody: CloudWatchLogV1RuleBody.fromFile('rule.json'),
    RuleState: RuleStates.ENABLED
 };
```

# Custom Rule Bodies

One can also manually input a custom the rule body using `CustomRuleBody.fromRuleBody()`.
Rule bodies inputted this way will not provided any defaults or be validated by the CDK.

An example of using `CustomRuleBody.fromRuleBody()` is shown below:

```typescript
import * as cdk from '@aws-cdk/core';
import { InsightRule } from '../lib';

const rule = new InsightsRule(this, "rule", {
    RuleName: "Insight-fulRule",
    RuleBody: CustomRuleBody.fromRuleBody({
            Schema: {
                Name: "CloudWatchLogRule",
                Version: 1
            },
            LogGroupNames: ["Interesting-Group-1", "Very-Interesting-Group-2"],
            LogFormat: LogFormats.JSON,
            Contribution: {
                Keys: ["$.ip"],
                ValueOf: "$.requestBytes",
                Filters: [
                        {
                            Match: "$.httpMethod",
                            In: [
                                "Put",
                            ]
                        },
                        {
                            Match: "$.BytesRecieved",
                            GreaterThan: 1000
                        }
                    ]
            },
            AggregateOn: "SUM"
        }),
    RuleState: InsightsRuleStates.ENABLED
);
```

Furthermore, one can also get a string rule body from a file using `CustomRuleBody.fromFile()` as seen below:

```typescript
const rule = new InsightRule(this, "Insight-fulRule", {
    RuleName: "Insight-fulName",
    RuleBody: CustomRuleBody.fromFile('rule.txt'),
    RuleState: RuleStates.ENABLED
 };
```

Differing from the file method in CloudWatchLogs, this rule will not be validated.

# Using Insight Rule Metric Math Functions

CloudWatch provides a metric math function `INSIGHT_RULE_METRIC(ruleName, metricName)` that allows a user to graph
specific metrics from their insight rule. The metric names and there corresponding description are below:

1. `UniqueContributors` — the number of unique contributors for each data point.
2. `MaxContributorValue` — the value of the top contributor for each data point.
    The identity of the contributor might change for each data point in the graph.
3. `SampleCount` — the number of data points matched by the rule.
4. `Sum` — the sum of the values from all contributors during the time period represented by that data point.
5. `Minimum` — the minimum value from a single observation during the time period represented by that data point.
6. `Maximum` — the maximum value from a single observation during the time period represented by that data point.
7. `Average` — the average value from all contributors during the time period represented by that data point.

These are described in further detail in the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContributorInsights-GraphReportData.html)

Users can use the metric math function through methods provided in the `InsightRule` class. These methods
will return `MathExpression` objects one can use in graph widgets.

To illustrate the use of these functions and to show all their definitions, see the below example where
these functions are used to create a graph that shows all of these metrics and are added onto a dashboard:

> Note: The method names were chosen as to be exactly as the names given in the documentation
> For some functions, like sum(), it may be better to be more descriptive, like contributorValueSum()

```typescript
import * as cloudwatch from '../lib';

const rule = new cloudwatch.InsightRule(...);

const graph = new cloudwatch.GraphWidget({
  left: [
    rule.sum(),
    rule.maximum(),
    rule.uniqueContributors(),
    rule.sampleCount(),
    rule.minimum(),
    rule.average(),
    rule.maxContributorValue(),
  ],
  title: 'cool-graph',
});

const dash = new cloudwatch.Dashboard(stack, 'cool-dash', {
  dashboardName: 'my-cool-dashboard',
});

dash.addWidgets(graph);
```

# Importing Rules

Any rule that has been created outside of a stack can be imported into the CDK app. Importing a rule allows for it
to be used in other parts of the CDK app that reference an `IInsightRule`. However, imported rules have limited configuration.
As a rule of thumb, none of the properties that are a part of the `AWS::CloudWatch::InsightRule` CloudFormation resource can be configured.

Rules can be imported either by providing the Insight Rule name, via the `InsightRule.fromInsightRuleName()` API or
by providing the Insight Rule ARN, via `InsightRule.fromInsightRuleArn()` API.

```typescript
const stack = new Stack(app, 'my-stack');

const insightfulRule = InsightsRule.fromInsightRuleName(
    stack,
    'amazing-rule',
    'us-east-1:lots_of_numbers'
 );

const veryInsightfulRule = InsightsRule.fromInsightRuleArn(
    stack,
    'most-amazing-rule',
    'arn:aws:insight-rule:us-east-1:lots_of_numbers'
 );
```

# Access Control

At the moment, only dashboards read data from Contributor Insights Rules.
Furthermore, no public services write to Contributor Insights rules.

To grant another service read permissions to an Insight Rule, one would use the `grantRead()` function.
In this example, we are providing dashboards read permissions to an Insight Rule.

```typescript
const dashboard = new DashBoard(this, 'amazing-dashboard', {...});
const rule = new InsightRule(this, 'amazing-rule', {...});

rule.grantRead(dashboard)
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @madeline-k
```

## Public FAQ

### What are we launching today?

The two modules insight-rule.ts and insight-rule-body.ts will be added to the CloudWatch package.

### Why should I use this feature?

Users writing CloudWatch log rule bodies manually can now create rules in the CDK and levarage their
IDEs for improved error detection and correction time. In addition, users with dashboard constructs
and log group construct will be able to analyze high cardinality data using the InsightRule construct.

## Internal FAQ

### Why are we doing this?

Currently, users wishing to use Contributor Insights rules must use its L1 Construct. Having a parameter
being a major string causes an abundance of errors to occur. With CloudFormation's non-optimal error reporting,
users can spend hours debugging their rules only to find there was a spacing issue or a type error.

By implementing the L2 Construct for Contributor Insights rules, users can create rules for CloudWatch
logs leveraging their IDEs to significantly reduce errors and development time. Furthermore, if errors are to occur,
elborate error reporting from the CDK will drastically reduce error correction time will overall
lead to a better user experience.

Lastly, users wishing to integrate Contributor Insights rules with their log group constructs and dashboards
constructs are unable to, as they only have the L1 Construct for Contributor Insights rules.

### Why should we _not_ do this?

The primary issue with creating this construct is making it generalized enough to handle all rule bodies.
Of course, one can always use the `fromJSON` or `fromString` methods; however, the primary benefit of this
library will come from builder methods used to facilitate the process of creating rule bodies.

If precision is not kept in designing the rule body, this may not be compatible with future schemas.

### What is the technical solution (design) of this feature?

TODO

### Is this a breaking change?

No

### What alternative solutions did you consider?

TODO

### What are the drawbacks of this solution?

To accomadate for future CloudWatch schemas and versions, care must be given to ensure the rule body
can be generalized to fit nearly any change. Otherwise, it could incur a breaking change.

### What is the high-level project plan?

TODO

### Are there any open issues that need to be addressed later?

Contributor Insights rules have a metric math function called `INSIGHT_RULE_METRIC` that does not exactly
fit an `IMetric`, for it lacks a namespace and dimensions.
This issue was brought up [here](https://github.com/aws/aws-cdk/issues/6255)

## Appendix

TODO
