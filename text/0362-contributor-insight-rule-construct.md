# Construct Library for Contributor Insight Rule

* **Original Author(s):**: @abrahcoh
* **Tracking Issue**: #362, #6255
* **API Bar Raiser**: @madeline-k

Amazon [Contributor Insight Rules](https://docs.amazonaws.cn/en_us/AmazonCloudWatch/latest/monitoring/ContributorInsights.html)
provide analysis for high cardinality data of AWS cloud components, allowing users to find the Top-N contributors of
various metrics emitted from their logs.

# Rules

The rule will specify the rule name, the rule body, and its state.

Using the CDK, a new rule can be created as part of the stack using the construct’s constructor as shown below:

```typescript
import * as cw from '@aws-cdk-lib/aws-cloudwatch';

const rule = new cw.InsightRule(this, 'insight-fulName', {
    insightRuleName: 'insight-fulName',
    insightRuleBody: //..
};
```

One can also explicitly state the `insightRuleState` as either `ENABLED` or `DISABLED`, but it is `ENABLED` by default.

# Rule Body

Rule bodies define what data the rule will analyze and how it will analyze it. Further information on fields can be found in the
[Contributor Insights Rule Syntax documentation](https://docs.amazonaws.cn/en_us/AmazonCloudWatch/latest/monitoring/ContributorInsights-RuleSyntax.html)
.

An example rule body to get the number of rejected TCP connections from VPC flow logs is shown below:

```json

{
   "Schema": {
      "Name": "CloudWatchLogRule",
      "Version": 1
   },
   "LogGroupNames": [
      "/aws/containerinsights/sample-cluster-name/flowlogs"
   ],
   "LogFormat": "CLF",
   "Fields": {
      "3": "interfaceID",
      "4": "sourceAddress",
      "8": "protocol",
      "13": "action"
   },
   "Contribution": {
      "Keys": [
         "interfaceID",
         "sourceAddress"
      ],
      "Filters": [
         {
            "Match": "protocol",
            "EqualTo": 6
         },
         {
            "Match": "action",
            "In": [
               "REJECT"
            ]
         }
      ]
   },
   "AggregateOn": "Count"
}
```

## Creating the Rule Body

Users will be able to create rule bodies using the `InsightRuleBody` class.

### Creating the Rule Body from a String

Users will be able to define their rule bodies as strings. In the below example, a user can use the rule body above in their
construct.

```typescript
import * as cw from '@aws-cdk-lib/aws-cloudwatch';

const ruleBodyString =
`{
    "Schema": {
        "Name": "CloudWatchLogRule",
        "Version": 1
    },
    "LogGroupNames": [
        "/aws/containerinsights/sample-cluster-name/flowlogs"
    ],
    "LogFormat": "CLF",
    "Fields": {
        "3": "interfaceID",
        "4": "sourceAddress",
        "8": "protocol",
        "13": "action"
    },
    "Contribution": {
        "Keys": [
            "interfaceID",
            "sourceAddress"
        ],
        "Filters": [
            {
                "Match": "protocol",
                "EqualTo": 6
            },
            {
                "Match": "action",
                "In": [
                    "REJECT"
                ]
            }
        ]
    },
    "AggregateOn": "Count"
}`;

const rule = new cw.InsightRule(this, 'insight-fulName', {
   insightRuleName: 'insight-fulName',
   insightRuleBody: cw.InsightRuleBody.fromString(ruleBodyString),
};
```

### Creating the Rule Body from the `fromRuleBody()` API

Users can use this API to leverage IDE typechecking and autocompletes to create their rule bodies. To create a rule with the
rule body above, one can do the following:

```typescript
import * as cw from '@aws-cdk-lib/aws-cloudwatch';

const rule = new cw.InsightRule(this, 'insight-fulName', {
   insightRuleName: 'insight-fulName',
   insightRuleBody: cw.InsightRuleBody.fromRuleBody({
      logGroupNames: ["/aws/containerinsights/sample-cluster-name/flowlogs"],
      fields: {
         3: "interfaceID",
         4: "sourceAddress",
         8: "protocol",
         13: "action"
      },
      contributorKeys: ["interfaceID", "sourceAddress"],
      contributorFilters: cw.InsightRuleFilters.fromFilters(
          {
             match: "protocol", condition: cw.InsightRuleFilterCondition.equalTo(6),
          },
         {
             match: "action", condition: cw.InsightRuleFilterCondition.in("REJECT"),
         }
      ),
   }),
};
```

>Note: We are proposing to have the `Contribution` field divided into the `contributionKeys`, `contributionFilters`, and
>`contributionValueOf` field to prevent excess nesting, as recommended by the Design Guidelines.
>In additon for the filters, we are calling the `"In":  ["REJECT"]` section the `condition` and turning them into functions.

A table below is shown to details the various defaults of each field:

| Field Name  | Default                                                         |
|-------------|-----------------------------------------------------------------|
| Log Format  | `CLF` if `fields` set, otherwise `JSON`                         |
| AggregateOn | `SUM` if `contributorValueOf` set, otherwise `COUNT`            |
| Filters     | `[]` if not set. Otherwise is whatever user set                 |
| Schema      | Always  `"Schema": {"Name": "CloudWatchLogRule","Version": 1},` |

# Using Insight Widgets

Users can use Insight Widgets to graph there Insight rules on dashboards.

These can be configured with the following properties:

1. `rule`: This is the insight rule the widget will be based upon. Required.
2. `maxContributorCount`: The max number of contributors to show in the widget. Default is 10. Max is 100.
3. `orderBy`: How to order the contributors. Default is by sum.
4. `leftYAxis`: These are a `YAxisProps` interface, One can set the min and max axis values. Default is no min or max.
5. `legendPosition`: Position of the legend. Default is on the bottom.

An example of using the widget with a dashboard is shown below:

```typescript
import * as cw from '@aws-cdk-lib/aws-cloudwatch';

const rule = new cw.InsightRule(...);
const ruleWidget = new cw.InsightRuleWidget({
    rule: rule,
)};

const dash = new cw.Dashboard(stack, 'cool-dash', {
   dashboardName: 'my-cool-dashboard',
});

dash.addWidgets(ruleWidget);
```

# Using Insight Rule Metric Math Functions

CloudWatch provides a metric math function `INSIGHT_RULE_METRIC(ruleName, metricName)` that allows a user to graph
specific metrics from their insight rule.

These possible functions described in detail in
the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContributorInsights-GraphReportData.html)

Users can use the metric math function through methods provided in the `InsightRule` class. These methods
will return `MathExpression` objects one can use in graph widgets.

An example below where one can make a graph widget of the max contributor value of a rule is shown below:

```typescript
import * as cw from '@aws-cdk-lib/aws-cloudwatch';

const rule = new cw.InsightRule(...);

const graph = new cw.GraphWidget({
    left: [
        rule.maxContributorValue(),
    ],
    title: 'cool-graph',
});

const dash = new cw.Dashboard(stack, 'cool-dash', {
    dashboardName: 'my-cool-dashboard',
});

dash.addWidgets(graph);
```

In addition, these capabilities are compatible with alarms. In the below example, we make an alarm that goes off
when the number of max contributorValue for this rule goes beyond 5:

```typescript
import * as cw from '@aws-cdk-lib/aws-cloudwatch';

const rule = new cw.InsightRule(...);
const alarm = new cw.Alarm(stack, 'asd', {
    metric: rule.maxContributorValue(),
    threshold: 5,
    evaluationPeriods: //...
});
```

# Importing Rules

Any rule that has been created outside a stack can be imported into the CDK app. Importing a rule allows for it
to be used in other parts of the CDK app that reference an `IInsightRule`. However, imported rules have limited configuration.
As a rule of thumb, none of the properties that are a part of the `AWS::CloudWatch::InsightRule` CloudFormation resource can be
configured.

Rules can be imported either by providing the Insight Rule name, via the `InsightRule.fromInsightRuleName()` API or
by providing the Insight Rule ARN, via `InsightRule.fromInsightRuleArn()` API.

```typescript
import * as cw from '@aws-cdk-lib/aws-cloudwatch';

const stack = new Stack(app, 'my-stack');

const insightfulRule = cw.InsightRule.fromInsightRuleName(
    stack,
    'amazing-rule',
    'my-rad-rule'
);

const veryInsightfulRule = cw.InsightRule.fromInsightRuleArn(
    stack,
    'most-amazing-rule',
    'arn:aws:insight-rule:us-east-1:lots_of_numbers'
);
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @madeline-k
```

## Public FAQ

### Why should I use this feature?

Users writing CloudWatch log rule bodies manually can now create rules in the CDK and levarage their
IDEs for improved error detection and correction time. In addition, users with dashboard constructs
and log group construct will be able to analyze high cardinality data using the InsightRule construct.

In addition, creating rule bodies via string is immensely error-prone, as it is a large JSON string. If a user wishes to have
IDE autocomplete and immediate error detection, use this construct to make your Insight Rules.

## Internal FAQ

### Why are we doing this?

The primary use case for Insight Rules are to have Insight Widgets that display the Top-100 of the metrics users define
in their rule bodies. Currently, users need to make their own Insight Widget via the `ConcreteWidget` class, which is
forcing the user to use low level constructs, when they should be able to use higher level and easy to use higher level
constructs.

### Why should we _not_ do this?

For the `InsightRuleBody.fromRuleBody()` api specifically, it seems that customers are primarily asking for this
construct to have an easy method for creating Insight Widgets. There is no _explicit_ mention of customers desiring an
easy method for creating rule bodies themselves. This said, the rule body API would be the bulk of the code for this construct
if made.

The `RuleBody` parameter in the InsightRule construct is also not similar to most other constructs, as it is responsible for
the entire configuration of the resource, yet is just a single giant JSON string parameter. This differs from other resources, as
the subparameters within the `RuleBody`, such as `Schema` or `LogGroups`, would typically properties to the resource itself.

The `InsightRuleBody.fromRuleBody()` would also essentially be a string builder, which (as far as I have researched) would be
the first within the CDK, so there are design considerations on whether we would want this in the CDK at all.

Overall, I would recommend 2 options:

1. Assuming customers would want the easy method for making rule bodies, just include this API with the rest of the construct at
   release.
2. (Most Conservative) Keep the `InsightRuleBody` class to keep this construct future flexible enough to have the
   `fromRuleBody` method in the future and just keep the `fromString` method. After the overall construct is made, open up an
   issue and see if there is appropriate community desire for this feature.

### Is this a breaking change?

No

### Are there any open issues that need to be addressed later?

Contributor Insights rules have a metric math function called `INSIGHT_RULE_METRIC` that does not exactly
fit an `IMetric`, for it lacks a namespace and dimensions.
This issue was brought up [here](https://github.com/aws/aws-cdk/issues/6255)
