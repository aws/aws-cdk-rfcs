# RFC - Glue CDK L2 Construct
https://github.com/aws/aws-cdk-rfcs/issues/497

## L2 Construct for AWS Glue Connections, Jobs, and Workflows

* Original Author(s): @natalie-white-aws, @mjanardhan @parag-shah-aws
* Tracking Issue: 
* API Bar Raiser: [Kendra Neil](https://quip-amazon.com/AZX9EAmb6vG)

## Working Backwards - README

[AWS Glue](https://aws.amazon.com/glue/) is a serverless data integration service that makes it easier to discover, prepare, move, and integrate data from multiple sources for analytics, machine learning (ML), and application development. Glue was released on 2017/08.  Launch: https://aws.amazon.com/blogs/aws/launch-aws-glue-now-generally-available/

Today, customers define Glue data sources, connections, jobs, and workflows to define their data and ETL solutions via the AWS console, the AWS CLI, and Infrastructure as Code tools like CloudFormation and the CDK. However, they have challenges defining the required and optional parameters depending on job type, networking constraints for data source connections, secrets for JDBC connections, and least-privilege IAM Roles and Policies. We will build convenience methods working backwards from common use cases and default to recommended best practices.

This RFC proposes updates to the L2 construct for Glue which will provide convenience features and abstractions for the existing [L1 (CloudFormation) Constructs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_Glue.html) building on the functionality already supported in the [@aws-cdk/aws-glue-alpha module](https://github.com/aws/aws-cdk/blob/v2.51.1/packages/%40aws-cdk/aws-glue/README.md). 


## Create a Glue Job

The glue-alpha-module already supports three of the four common types of Glue Jobs: Spark (ETL and Streaming), Python Shell, Ray. This RFC will add the more recent Flex Job. The construct also implements AWS practice recommendations when creating a Glue Job such use of Secrets Management for Connection JDBC strings, Glue Job Autoscaling, least privileges in terms of IAM permissions and also sane defaults for Glue job specification (more details are mentioned in the below table).

This RFC will introduce breaking changes to the existing glue-alpha-module to streamline the developer experience and introduce new constants and validations. The L2 construct will determine the job type by the job type and language provided by the developer, rather than having separate methods in every permutation that Glue jobs allow. 


### Spark Jobs

1. **ETL Jobs
    **

ETL jobs supports python and Scala language. ETL job type supports G1, G2, G4 and G8 worker type default as G2 which customer can override. Also preferred version for ETL is 4.0 but customer can override the version to 3.0. We by default enable several features for ETL jobs these are` —enable-metrics, —enable-spark-ui, —enable-continuous-cloudwatch-log.` We recommend to use these feature for ETL jobs. You can find more details about version, worker type and other feature on public documentation.

```
glue.Job(this, 'ScalaSparkEtlJob', {
    jobType: glue.JobType.ETL,
    jobLanguage: glue.JobLanguage.SCALA_SPARK,
    scriptS3Url: 's3://bucket-name/path-to-scala-jar',
    className: 'com.example.HelloWorld',
});

glue.Job(this, 'pySparkEtlJob', {
    jobType: glue.JobType.ETL,
    jobLanguage: glue.JobLanguage.PYSPARK,
    scriptS3Url: 's3://bucket-name/path-to-python-script',
});
```

Optionally, developers can override the glueVersion and add extra jars and a description:

```
glue.Job(this, 'ScalaSparkEtlJob', {
   jobType: glue.JobType.ETL,
   jobLanguage: glue.JobLanguage.SCALA_SPARK,
   glueVersion: glue.GlueVersion.V3_0,
   scriptS3Url: 's3://bucket-name/path-to-scala-jar',
   className: 'com.example.HelloWorld',
   extraJarsS3Url: ['s3://bucket-name/path-to-extra-scala-jar',],
   description: 'an example Scala Spark ETL job',
   numberOfWorkers: 20
});

glue.Job(this, 'pySparkEtlJob', {
   jobType: glue.JobType.ETL,
   jobLanguage: glue.JobLanguage.PYSPARK,
   glueVersion: glue.GlueVersion.V3_0,
   pythonVersion: glue.PythonVersion.3_6,
   scriptS3Url: 's3://bucket-name/path-to-scala-jar',
   extraJarsS3Url: ['s3://bucket-name/path-to-extra-scala-jar'],
   description: 'an example pySpark ETL job',
   numberOfWorkers: 20
});
```

1. **Streaming Jobs**

A Streaming job is similar to an ETL job, except that it performs ETL on data streams. It uses the Apache Spark Structured Streaming framework. Some Spark job features are not available to streaming ETL jobs. These jobs will default to use Python 3.6.

Similar to ETL streaming job supports Scala and python language. Similar to ETL, it supports G1 and G2 worker type and 2.0, 3.0 and 4.0 version. We’ll default to G2 worker and 4.0 version for streaming jobs which customer can override. Some of the feature we’ll enable are `—enable-metrics, —enable-spark-ui, —enable-continuous-cloudwatch-log` 

```
new glue.Job(this, 'PythonSparkStreamingJob', {
   jobType: glue.JobType.STREAMING,
   jobLanguage: glue.JobLanguage.PYSPARK,
   scriptS3Url: 's3://bucket-name/path-to-python-script',
});


new glue.Job(this, 'ScalaSparkStreamingJob', {
   jobType: glue.JobType.STREAMING,
   jobLanguage: glue.JobLanguage.SCALA_SPARK,
   scriptS3Url: 's3://bucket-name/path-to-scala-jar',
   className: 'com.example.HelloWorld',
});

```

Optionally, developers can override the glueVersion and add extraJars and a description:

```
new glue.Job(this, 'PythonSparkStreamingJob', {
   jobType: glue.JobType.STREAMING,
   jobLanguage: glue.JobLanguage.PYSPARK,
   glueVersion: glue.GlueVersion.V3_0,
   pythonVersion: glue.PythonVersion.3_6,
   scriptS3Url: 's3://bucket-name/path-to-python-script',
   description: 'an example Python Streaming job',
   numberOfWorkers: 20,
});


new glue.Job(this, 'ScalaSparkStreamingJob', {
   jobType: glue.JobType.STREAMING,
   jobLanguage: glue.JobLanguage.SCALA_SPARK,
   glueVersion: glue.GlueVersion.V3_0,
   pythonVersion: glue.PythonVersion.3_6,
   scriptS3Url: 's3://bucket-name/path-to-scala-jar',
   className: 'com.example.HelloWorld',
   description: 'an example Python Streaming job',
   numberOfWorkers: 20,
});
```

1. **Flex Jobs**

The flexible execution class is appropriate for non-urgent jobs such as pre-production jobs, testing, and one-time data loads. Flexible job runs are supported for jobs using AWS Glue version 3.0 or later and `G.1X` or `G.2X` worker types but will default to the latest version of Glue (currently Glue 3.0.) Also similar to ETL we’ll enable these feature `—enable-metrics, —enable-spark-ui, —enable-continuous-cloudwatch-log`

```
glue.Job(this, 'ScalaSparkFlexEtlJob', {
   jobType: glue.JobType.FLEX,
   jobLanguage: glue.JobLanguage.SCALA_SPARK,
   scriptS3Url: 's3://bucket-name/path-to-scala-jar',
   className: 'com.example.HelloWorld',
});

glue.Job(this, 'pySparkFlexEtlJob', {
   jobType: glue.JobType.FLEX,
   jobLanguage: glue.JobLanguage.PYSPARK,
   scriptS3Url: 's3://bucket-name/path-to-python-script',
});
```

Optionally, developers can override the glue version, python version, provide extra jars, and a description

```
glue.Job(this, 'pySparkFlexEtlJob', {
   jobType: glue.JobType.FLEX,
   jobLanguage: glue.JobLanguage.SCALA_SPARK,
   glueVersion: glue.GlueVersion.V3_0,
   scriptS3Url: 's3://bucket-name/path-to-python-script',
   extraJarsS3Url: ['s3://bucket-name/path-to-extra-python-scripts'],
   description: 'an example pySpark ETL job',
   numberOfWorkers: 20,
});

new glue.Job(this, 'FlexJob', {
   jobType: glue.JobType.FLEX,
   jobLanguage: glue.JobLanguage.PYSPARK,
   glueVersion: glue.GlueVersion.V3_0,
   pythonVersion: glue.PythonVersion.3_6,
   scriptS3Url: 's3://bucket-name/path-to-python-script',
   description: 'an example Flex job',
   numberOfWorkers: 20,
});
```

### Python Shell Jobs

A Python shell job runs Python scripts as a shell and supports a Python version that depends on the AWS Glue version you are using. This can be used to schedule and run tasks that don't require an Apache Spark environment. Python 3.6 and 3.9 are supported.

We’ll default to `PythonVersion.3_9` which customer can override. Python shell jobs doesn’t support different worker type, instead it has MaxDPU feature. Customer can choose Max DPU = `0.0625` or Max DPU = `1`. By default MaxDPU will be set `0.0625`. Also `PythonVersion.3_9` supports preloaded analytics libraries using flag `library-set=analytics` , this feature will be enable by default.


```
new glue.Job(this, 'PythonShellJob', {
    jobType: glue.JobType.PYTHON_SHELL,
    jobLanguage: glue.JobLanguage.PYSPARK,
    scriptS3Url: 's3://bucket-name/path-to-python-script',
});
```

Optional overrides:

```
new glue.Job(this, 'PythonShellJob', {
    jobType: glue.JobType.PYTHON_SHELL,
    jobLanguage: glue.JobLanguage.PYSPARK,
    glueVersion: glue.GlueVersion.V1_0,
    pythonVersion: glue.PythonVersion.3_6,
    scriptS3Url: 's3://bucket-name/path-to-python-script',
    description: 'an example Python Shell job',
    numberOfWorkers: 20,
});
```



### Ray Jobs

Glue ray only supports Z.2X worker type and 4.0 Glue version. Runtime will default to `Ray2.3` and min workers will default to 3.


```
declare const bucket: s3.Bucket;
new glue.Job(this, 'GlueRayJob', {
  jobType: glue.JobType.GLUE_RAY,
  jobLanguage: glue.JobLanguage.PYTHON,
  scriptS3Url: 's3://bucket-name/path-to-python-script',
});
```

Optionally customer can override min workers and other Glue job fields


```
declare const bucket: s3.Bucket;
new glue.Job(this, 'GlueRayJob', {
  jobType: glue.JobType.GLUE_RAY,
  jobLanguage: glue.JobLanguage.PYTHON,
  runtime: glue.Runtime.RAY_2_2
  scriptS3Url: 's3://bucket-name/path-to-python-script',
  minWorkers: 20,
  numberOfWorkers: 50
});
```

### Job Triggers

We will add convenience functions for adding triggers to jobs. Standalone triggers are an anti-pattern, so we will only create triggers from within a workflow.


1. **On Demand Triggers**

On demand triggers can start glue jobs or crawlers. We’ll add convenience functions to create on-demand crawler or job triggers. The trigger method will take an optional description but abstract the requirement of an actions list using the job or crawler name. 

```
myGlueJob.createOnDemandTrigger(this, 'MyJobTrigger', {
  description: 'On demand run for ' + myGlueJob.name,
});
```

```
myGlueCrawler.createOnDemandTrigger(this, 'MyCrawlerTrigger');
```



1. **Scheduled Triggers**

Schedule triggers are a way for customers to create jobs using cron expressions. We’ll provide daily, weekly and hourly options which customer can override using custom cron expression. The trigger method will take an optional description but abstract the requirement of an actions list using the job or crawler name. 

```
myGlueJob.createDailyTrigger(this, 'MyDailyTrigger');

myGlueJob.createHourlyTrigger(this, 'MyHourlyTrigger');

myGlueJob.createWeeklyTrigger(this, 'MyWeeklyTrigger');

myGlueJob.createScheduledTrigger(this, 'MyScheduledTrigger', {
  description: 'Scheduled run for ' + crawler.name,
  schedule: '`cron(15 12 * * ? *)'`` //``every day at 12:15 UTC`
});
```



#### **3. Notify  Event Trigger**

This type of trigger is only supported with Glue workflow. There are two types of notify event triggers, batching and non-batching trigger. For batching trigger `BatchSize` customer has to specify but for non-batching `BatchSize` will be set to 1. For both trigger type `BatchWindow will be default to 900 seconds`

```
myGlueJob.createNotifyEventBatchingTrigger(this, 'MyNotifyTrigger', batchSize,
    workFlowName: workflow.name,
    batchSize: batchSize
);

myGlueCrawler.createNotifyEventBatchingTrigger(this, 'MyNotifyTrigger', batchSize,
    workFlowName: workflow.name,
    batchSize: batchSize
);

myGlueJob.createNotifyEventNonBatchingTrigger(this, 'MyNotifyTrigger', 
    workFlowName: workflow.name
);

myGlueCrawler.createNotifyEventNonBatchingTrigger(this, 'MyNotifyTrigger',
    workFlowName: workflow.name
);

```

#### **4. Conditional Trigger**

Conditional trigger has predicate and action associated with it. Based on predicate, trigger action will be executed.

```
// Triggers on Job and Crawler status
myGlueJob.addConditionalTrigger(
  jobs: [
    {jobArn: "job1-arn", status: glue.JobStatus.SUCCEEDED},
    {jobArn: "job2-arn", status: glue.JobStatus.FAILED},
  ], crawlers: [
    {crawlerArn: "crawler1-arn", status: glue.CrawlerStatus.SUCCEEDED},
    {crawlerArn: "crawler2-arn", status: glue.CrawlerStatus.TIMEOUT},
]);

```



### Connection Properties

A `Connection` allows Glue jobs, crawlers and development endpoints to access certain types of data stores. 


* **Secrets Management
    **User needs to specify JDBC connection credentials in Secrets Manager and provide the Secrets Manager Key name as a property to the Job connection property. 
    
* **Networking - CDK determines the best fit subnet for Glue Connection configuration
    **The current glue-alpha-module requires the developer to specify the subnet of the Connection when it’s defined. This L2 RFC will make the best choice selection for subnet by default by using the data source provided during Job provisioning, traverse the source’s existing networking configuration, and determine the best subnet to provide to the Glue Job parameters to allow the Job to access the data source. The developer can override this subnet parameter, but no longer has to provide it directly. 




## Public FAQ

### What are we launching today?

We’re launching new features to an AWS CDK Glue L2 Construct to provide best-practice defaults and convenience methods to create Glue Jobs, Connections, Triggers, Workflows, and the underlying permissions and configuration. 

### Why should I use this Construct?

Developers should use this Construct to reduce the amount of boilerplate code and complexity each individual has to navigate, and make it easier to create best-practice Glue resources. 

### What’s not in scope?

Glue Crawlers and other resources that are now managed by the AWS LakeFormation team are not in scope for this effort. Developers should use existing methods to create these resources, and the new Glue L2 construct assumes they already exist as inputs. While best practice is for application and infrastructure code to be as close as possible for teams using fully-implemented DevOps mechanisms, in practice these ETL scripts will likely be managed by a data science team who know Python or Scala and don’t necessarily own or manage their own infrastructure deployments. We want to meet developers where they are, and not assume that all of the code resides in the same repository, Developers can automate this themselves via the CDK, however, if they do own both.

Uploading Job scripts to S3 buckets is also not in scope for this effort. 

Validating Glue version and feature use per AWS region at synth time is also not in scope. AWS’ intention is for all features to eventually be propagated to all Global regions, so the complexity involved in creating and updating region-specific configuration to match shifting feature sets does not out-weigh the likelihood that a developer will use this construct to deploy resources to a region without a particular new feature to a region that doesn’t yet support it without researching or manually attempting to use that feature before developing it via IaC. The developer will, of course, still get feedback from the underlying Glue APIs as CloudFormation deploys the resources similar to the current CDK L1 Glue experience.


