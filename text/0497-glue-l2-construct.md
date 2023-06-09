# RFC - Glue CDK L2 Construct

## L2 Construct for AWS Glue Connections, Jobs, and Workflows

* **Original Author(s):** @natalie-white-aws, @mjanardhan @parag-shah-aws
* **Tracking Issue:**
* **API Bar Raiser:** @TheRealAmazonKendra
[Link to RFC Issue](https://github.com/aws/aws-cdk-rfcs/issues/497)

## Working Backwards - README

[AWS Glue](https://aws.amazon.com/glue/) is a serverless data integration
service that makes it easier to discover, prepare, move, and integrate data
from multiple sources for analytics, machine learning (ML), and application
development. Glue was released on 2017/08.
[Launch](https://aws.amazon.com/blogs/aws/launch-aws-glue-now-generally-available/)

Today, customers define Glue data sources, connections, jobs, and workflows
to define their data and ETL solutions via the AWS console, the AWS CLI, and
Infrastructure as Code tools like CloudFormation and the CDK. However, they
have challenges defining the required and optional parameters depending on
job type, networking constraints for data source connections, secrets for
JDBC connections, and least-privilege IAM Roles and Policies. We will build
convenience methods working backwards from common use cases and default to
recommended best practices.

This RFC proposes updates to the L2 construct for Glue which will provide
convenience features and abstractions for the existing
[L1 (CloudFormation) Constructs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_Glue.html) building on the
functionality already supported in the [@aws-cdk/aws-glue-alpha module](https://github.com/aws/aws-cdk/blob/v2.51.1/packages/%40aws-cdk/aws-glue/README.md).

## Create a Glue Job

The glue-alpha-module already supports three of the four common types of Glue
Jobs: Spark (ETL and Streaming), Python Shell, Ray. This RFC will add the
more recent Flex Job. The construct also implements AWS practice
recommendations when creating a Glue Job such use of Secrets Management for
Connection JDBC strings, Glue Job Autoscaling, least privileges in terms of
IAM permissions and also sane defaults for Glue job specification (more details
are mentioned in the below table).

This RFC will introduce breaking changes to the existing glue-alpha-module to
streamline the developer experience and introduce new constants and validations.
As an opinionated construct, the Glue L2 construct will enforce
best practices and not allow developers to create resources that use deprecated
libraries and tool sets (e.g. deprecated versions of Python).

### Spark Jobs

1. **ETL Jobs**

ETL jobs supports python and Scala language. ETL job type supports G1, G2, G4
and G8 worker type default as G2, which customer can override. It wil default to
the best practice version of ETL 4.0, but allow developers to override to 3.0.
We will also default to best practice enablement the following ETL features:
`—enable-metrics, —enable-spark-ui, —enable-continuous-cloudwatch-log.`
You can find more details about version, worker type and other features in
[Glue's public documentation](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api-jobs-job.html).

```
glue.ScalaSparkEtlJob(this, 'ScalaSparkEtlJob', {
    script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-scala-jar'),
    className: 'com.example.HelloWorld',
});

glue.pySparkEtlJob(this, 'pySparkEtlJob', {
    script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
});
```

Optionally, developers can override the glueVersion and add extra jars and a
description:

```
glue.ScalaSparkEtlJob(this, 'ScalaSparkEtlJob', {
   glueVersion: glue.GlueVersion.V3_0,
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-scala-jar'),
   className: 'com.example.HelloWorld',
   extraJarsS3Url: [glue.Code.fromBucket('bucket-name', 'path-to-extra-scala-jar'),],
   description: 'an example Scala Spark ETL job',
   numberOfWorkers: 20
});

glue.pySparkEtlJob(this, 'pySparkEtlJob', {
   jobType: glue.JobType.ETL,
   glueVersion: glue.GlueVersion.V3_0,
   pythonVersion: glue.PythonVersion.3_9,
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
   extraJarsS3Url: [glue.Code.fromBucket('bucket-name', 'path-to-extra-scala-jar')],
   description: 'an example pySpark ETL job',
   numberOfWorkers: 20
});
```

2. **Streaming Jobs**

A Streaming job is similar to an ETL job, except that it performs ETL on data
streams using the Apache Spark Structured Streaming framework. Some Spark
job features are not available to streaming ETL jobs. These jobs will default
to use Python 3.9.

Similar to ETL streaming job supports Scala and Python languages. Similar to ETL,
it supports G1 and G2 worker type and 2.0, 3.0 and 4.0 version. We’ll default
to G2 worker and 4.0 version for streaming jobs which developers can override.
We will enable `—enable-metrics, —enable-spark-ui, —enable-continuous-cloudwatch-log`.

```
new glue.PythonSparkStreamingJob(this, 'PythonSparkStreamingJob', {
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
});


new glue.ScalaSparkStreamingJob(this, 'ScalaSparkStreamingJob', {
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-scala-jar'),
   className: 'com.example.HelloWorld',
});

```

Optionally, developers can override the glueVersion and add extraJars and a
description:

```
new glue.PythonSparkStreamingJob(this, 'PythonSparkStreamingJob', {
   glueVersion: glue.GlueVersion.V3_0,
   pythonVersion: glue.PythonVersion.3_9,
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
   description: 'an example Python Streaming job',
   numberOfWorkers: 20,
});


new glue.ScalaSparkStreamingJob(this, 'ScalaSparkStreamingJob', {
   glueVersion: glue.GlueVersion.V3_0,
   pythonVersion: glue.PythonVersion.3_9,
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-scala-jar'),
   className: 'com.example.HelloWorld',
   description: 'an example Python Streaming job',
   numberOfWorkers: 20,
});
```

3. **Flex Jobs**

The flexible execution class is appropriate for non-urgent jobs such as
pre-production jobs, testing, and one-time data loads. Flexible job runs
are supported for jobs using AWS Glue version 3.0 or later and `G.1X` or
`G.2X` worker types but will default to the latest version of Glue
(currently Glue 3.0.) Similar to ETL, we’ll enable these features:
`—enable-metrics, —enable-spark-ui, —enable-continuous-cloudwatch-log`

```
glue.ScalaSparkFlexEtlJob(this, 'ScalaSparkFlexEtlJob', {
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-scala-jar'),
   className: 'com.example.HelloWorld',
});

glue.pySparkFlexEtlJob(this, 'pySparkFlexEtlJob', {
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
});
```

Optionally, developers can override the glue version, python version,
provide extra jars, and a description

```
glue.ScalaSparkFlexEtlJob(this, 'ScalaSparkFlexEtlJob', {
   glueVersion: glue.GlueVersion.V3_0,
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-scala-jar'),
   className: 'com.example.HelloWorld',
   extraJarsS3Url: [glue.Code.fromBucket('bucket-name', 'path-to-extra-python-scripts')],
   description: 'an example pySpark ETL job',
   numberOfWorkers: 20,
});

new glue.pySparkFlexEtlJob(this, 'pySparkFlexEtlJob', {
   glueVersion: glue.GlueVersion.V3_0,
   pythonVersion: glue.PythonVersion.3_9,
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
   description: 'an example Flex job',
   numberOfWorkers: 20,
});
```

### Python Shell Jobs

A Python shell job runs Python scripts as a shell and supports a Python
version that depends on the AWS Glue version you are using. This can be used
to schedule and run tasks that don't require an Apache Spark environment.

We’ll default to `PythonVersion.3_9`. Python shell jobs have a MaxCapacity feature.
Developers can choose MaxCapacity = `0.0625` or MaxCapacity = `1`. By default,
MaxCapacity will be set `0.0625`. Python 3.9 supports preloaded analytics
libraries using the `library-set=analytics` flag, and this feature will
be enabled by default.

```
new glue.PythonShellJob(this, 'PythonShellJob', {
   script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
});
```

Optional overrides:

```
new glue.PythonShellJob(this, 'PythonShellJob', {
    glueVersion: glue.GlueVersion.V1_0,
    pythonVersion: glue.PythonVersion.3_9,
    script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
    description: 'an example Python Shell job',
    numberOfWorkers: 20,
});
```

### Ray Jobs

Glue ray only supports worker type Z.2X and Glue version 4.0. Runtime
will default to `Ray2.3` and min workers will default to 3.

```
new glue.GlueRayJob(this, 'GlueRayJob', {
    script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
});
```

Developers can override min workers and other Glue job fields

```
new glue.GlueRayJob(this, 'GlueRayJob', {
  runtime: glue.Runtime.RAY_2_2,
  script: glue.Code.fromBucket('bucket-name', 's3prefix/path-to-python-script'),
  numberOfWorkers: 50
});
```

### Required, Optional, and Overridable Parameters

Each of these parameters are documented in [Glue's public documentation](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api.html);
this table lists the parameters that will or will not be required, optional,
and/or overridable for the Glue L2 construct.

|Parameter|Required|Default Value|Overridable|
|Command ScriptLocation|Yes: S3 location|CommandName|yes S3 location|
|NumberOfWorkers|No|10|Yes for ETL, STREAMING, RAY jobs|
|Name|Yes|Default: Auto Generated name|Yes|
|Role|Yes|None|Yes|
|Description|No|None|Yes|
|MaxConcurrentRuns|No|1|Yes|
|DefaultArguments|No|None|Yes|
|Connections|No|None|Yes|
|MaxRetries|No|0|Yes|
|Timeout|No|2 Days for non-streaming jobs|Yes|
|SecurityConfiguration|No|None|Yes|
|Tags|No|None|Yes|
|GlueVersion|No|Default: 3.0 for ETL, RAY: 4.0|Yes|
|Command name|No|ETL, PythonShell, Streaming and GlueRay|No|
|Command Runtime|No|GlueRay: Ray2.4|No|
|NonOverridableArguments|No|None|No|
|ExecutionClass|No|STANDARD / FLEX|No|
|Command PythonVersion|No|3 for ETL/Streaming, 3.9 for PythonShell|
|LogUri|No|None|This option is not widely used|
|MaxCapacity (Python Shell Jobs only)|No|0.0625|Yes|

### Uploading scripts from the same repo to S3

Similar to other L2 constructs, the Glue L2 will automate uploading / updating
scripts to S3 via an optional fromAsset parameter pointing to a script
in the local file structure. Developers will provide an existing S3 bucket and
the path to which they'd like the script to be uploaded.

```
glue.ScalaSparkEtlJob(this, 'ScalaSparkEtlJob', {
    script: glue.Code.fromAsset('bucket-name', 'local/path/to/scala-jar'),
    className: 'com.example.HelloWorld',
});
```

### Workflow Triggers

In AWS Glue, developers can use workflows to create and visualize complex
extract, transform, and load (ETL) activities involving multiple crawlers,
jobs, and triggers. Standalone triggers are an anti-pattern, so we will
only create triggers from within a workflow.

Within the workflow object, there will be functions to create different
types of triggers with actions and predicates. Those triggers can then be
added to jobs.

For all trigger types, the StartOnCreation property will be set to true by
default, but developers will have the option to override it.

1. **On Demand Triggers**

On demand triggers can start glue jobs or crawlers. We’ll add convenience
functions to create on-demand crawler or job triggers. The trigger method
will take an optional description but abstract the requirement of an actions
list using the job or crawler objects using conditional types.

```
myWorkflow = new glue.Workflow(this, "GlueWorkflow", {
    name: "MyWorkflow";
    description: "New Workflow";
    properties: {'key', 'value'};
});

myWorkflow.createOnDemandTrigger(this, 'TriggerJobOnDemand', {
    description: 'On demand run for ' + myGlueJob.name,
    actions: [glueJob1, glueJob2, glueJob3, glueCrawler]
});
```

1. **Scheduled Triggers**

Schedule triggers are a way for developers to create jobs using cron
expressions. We’ll provide daily, weekly, and monthly convenience functions,
as well as a custom function that will allow developers to create their own
custom timing using the [existing event Schedule object](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events.Schedule.html)
without having to build their own cron expressions. (The L2 will extract
the expression that Glue requires from the Schedule object). The trigger method will
take an optional description and list of Actions which can refer to Jobs or
crawlers via conditional types.

```
// Create Daily Schedule at 00 UTC
myWorkflow.createDailyScheduleTrigger(this, 'TriggerCrawlerOnDailySchedule', {
    description: 'Scheduled run for ' + myGlueJob.name,
    actions: [ myGlueCrawler]
});

// Create Weekly schedule at 00 UTC on Sunday
myWorkflow.createWeeklyScheduleTrigger(this, 'TriggerJobOnWeeklySchedule', {
    description: 'Scheduled run for ' + myGlueJob.name,
    actions: [glueJob1, glueJob2, glueJob3, glueCrawler]
});

// Create Custom schedule, e.g. Monthly on the 7th day at 15:30 UTC
myWorkflow.createCustomScheduleJobTrigger(this, 'TriggerCrawlerOnCustomSchedule', {
    description: 'Scheduled run for ' + myGlueJob.name,
    actions: [glueJob1, glueJob2, glueJob3, glueCrawler]
    schedule: events.Schedule.cron(day: '7', hour: '15', minute: '30')
});
```

#### **3. Notify  Event Triggers**

This type of trigger is only supported with Glue workflows. There are two types
of notify event triggers, batching and non-batching trigger. For batching triggers,
developers must specify `BatchSize` but for non-batching `BatchSize` will be set
to 1. For both triggers, `BatchWindow` will be default to 900 seconds.

```
myWorkflow.createNotifyEventTrigger(this, 'MyNotifyTriggerBatching', {
    batchSize: int,
    jobActions: [glueJob1, glueJob2, glueJob3],
    actions: [glueJob1, glueJob2, glueJob3, glueCrawler]
});

myWorkflow.createNotifyEventTrigger(this, 'MyNotifyTriggerNonBatching', {
    actions: [glueJob1, glueJob2, glueJob3]
});
```

#### **4. Conditional Triggers**

Conditional triggers have a predicate and actions associated with them.
When the predicateCondition is true, the trigger actions will be executed.

```
// Triggers on Job and Crawler status
myWorkflow.createConditionalTrigger(this, 'conditionalTrigger', {
    description: 'Conditional trigger for ' + myGlueJob.name,
    actions: [glueJob1, glueJob2, glueJob3, glueCrawler]
    predicateCondition: glue.TriggerPredicateCondition.AND,
    jobPredicates: [{'job': glueJobPred, 'state': glue.JobRunState.FAILED},
                    {'job': glueJobPred1, 'state' : glue.JobRunState.SUCCEEDED}]
});
```

### Connection Properties

A `Connection` allows Glue jobs, crawlers and development endpoints to access
certain types of data stores.

***Secrets Management
    **User needs to specify JDBC connection credentials in Secrets Manager and
    provide the Secrets Manager Key name as a property to the Job connection
    property.

* **Networking - CDK determines the best fit subnet for Glue Connection
configuration
    **The current glue-alpha-module requires the developer to specify the
    subnet of the Connection when it’s defined. The developer can still specify the
    specific subnet they want to use, but no longer have to. This Glue L2 RFC will
    allow developers to provide only a VPC and either a public or private subnet
    selection. The L2 will then leverage the existing [EC2 Subnet Selection](https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_ec2/SubnetSelection.html)
    library to make the best choice selection for the subnet.

## Public FAQ

### What are we launching today?

We’re launching new features to an AWS CDK Glue L2 Construct to provide
best-practice defaults and convenience methods to create Glue Jobs, Connections,
Triggers, Workflows, and the underlying permissions and configuration.

### Why should I use this Construct?

Developers should use this Construct to reduce the amount of boilerplate
code and complexity each individual has to navigate, and make it easier to
create best-practice Glue resources.

### What’s not in scope?

Glue Crawlers and other resources that are now managed by the AWS LakeFormation
team are not in scope for this effort. Developers should use existing methods
to create these resources, and the new Glue L2 construct assumes they already
exist as inputs. While best practice is for application and infrastructure code
to be as close as possible for teams using fully-implemented DevOps mechanisms,
in practice these ETL scripts will likely be managed by a data science team who
know Python or Scala and don’t necessarily own or manage their own
infrastructure deployments. We want to meet developers where they are, and not
assume that all of the code resides in the same repository, Developers can
automate this themselves via the CDK, however, if they do own both.

Validating Glue version and feature use per AWS region at synth time is also
not in scope. AWS’ intention is for all features to eventually be propagated to
all Global regions, so the complexity involved in creating and updating region-
specific configuration to match shifting feature sets does not out-weigh the
likelihood that a developer will use this construct to deploy resources to a
region without a particular new feature to a region that doesn’t yet support
it without researching or manually attempting to use that feature before
developing it via IaC. The developer will, of course, still get feedback from
the underlying Glue APIs as CloudFormation deploys the resources similar to the
current CDK L1 Glue experience.
