---
rfc pr: [#342](https://github.com/aws/aws-cdk-rfcs/pull/342)
tracking issue: [#340](https://github.com/aws/aws-cdk-rfcs/issues/340)
---

# Amazon Kinesis Data Firehose Delivery Stream L2

The `aws-kinesisfirehose` construct library allows you to create Amazon Kinesis
Data Firehose delivery streams and destinations with just a few lines of
code. As with most construct libraries, you can also easily define permissions
and metrics using a simple API.

The amount of effort needed to create these resources is about the same as doing
it using the AWS console and you can choose from any of the supported
destinations.

## Working Backwards

### CHANGELOG

`feat(kinesisfirehose): DeliveryStream L2; S3, Elasticache, Redshift destinations`

### README

---

# Amazon Kinesis Data Firehose Construct Library

[Amazon Kinesis Data Firehose](https://docs.aws.amazon.com/firehose/latest/dev/what-is-this-service.html)
is a service for fully-managed delivery of real-time streaming data to storage services
such as Amazon S3, Amazon Redshift, Amazon Elasticsearch, Splunk, or any custom HTTP
endpoint or third-party services such as Datadog, Dynatrace, LogicMonitor, MongoDB, New
Relic, and Sumo Logic. This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk)
project. It allows you to create Kinesis Data Firehose delivery streams.

## Creating a Delivery Stream

In order to create a Delivery Stream, you must specify a destination. An S3 bucket can be
used as a destination. More supported destinations are covered [below](#destinations).

```ts
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations';

new DeliveryStream(this, 'Delivery Stream', {
  destination: new destinations.S3(),
});
```

The above example creates the following resources:

- An S3 bucket
- A Kinesis Data Firehose delivery stream with Direct PUT as the source and CloudWatch
  error logging turned on.
- An IAM role which gives the delivery stream permission to write to your S3 bucket.

## Sources

There are two main methods of sourcing input data: Kinesis Data Streams and via a "direct
put".

See: [Sending Data to a Delivery Stream](https://docs.aws.amazon.com/firehose/latest/dev/basic-write.html)
in the *Kinesis Data Firehose Developer Guide*.

### Kinesis Data Stream

A delivery stream can read directly from a Kinesis data stream as a consumer of the data
stream. Configure this behaviour by providing a data stream in the `sourceStream`
property when constructing a delivery stream:

```ts fixture=with-destination
import * as kinesis from '@aws-cdk/aws-kinesis';

const sourceStream = new kinesis.Stream(this, 'Source Stream');
new DeliveryStream(this, 'Delivery Stream', {
  sourceStream: sourceStream,
  destination: destination,
});
```

### Direct Put

If a source data stream is not provided, then data must be provided via "direct put", ie.,
by using a `PutRecord` or `PutRecordBatch` API call. There are a number of ways of doing
so, such as:

- Kinesis Agent: a standalone Java application that monitors and delivers files while
  handling file rotation, checkpointing, and retries. See: [Writing to Kinesis Data Firehose Using Kinesis Agent](https://docs.aws.amazon.com/firehose/latest/dev/writing-with-agents.html)
  in the *Kinesis Data Firehose Developer Guide*.
- AWS SDK: a general purpose solution that allows you to deliver data to a delivery stream
  from anywhere using Java, .NET, Node.js, Python, or Ruby. See: [Writing to Kinesis Data Firehose Using the AWS SDK](https://docs.aws.amazon.com/firehose/latest/dev/writing-with-sdk.html)
  in the *Kinesis Data Firehose Developer Guide*.
- CloudWatch Logs: subscribe to a log group and receive filtered log events directly into
  a delivery stream. See: [logs-destinations](../aws-logs-destinations).
- Eventbridge: add an event rule target to send events to a delivery stream based on the
  rule filtering. See: [events-targets](../aws-events-targets).
- SNS: add a subscription to send all notifications from the topic to a delivery
  stream. See: [sns-subscriptions](../aws-sns-subscriptions).
- IoT: add an action to an IoT rule to send various IoT information to a delivery stream

## Destinations

The following destinations are supported. See [@aws-cdk/aws-kinesisfirehose-destinations](../aws-kinesisfirehose-destinations)
for the implementations of these destinations.

### S3

Creating a delivery stream with an S3 bucket destination:

```ts
import * as s3 from '@aws-cdk/aws-s3';
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations';

const bucket = new s3.Bucket(this, 'Bucket');

const s3Destination = new destinations.S3({
  bucket: bucket,
});

new DeliveryStream(this, 'Delivery Stream', {
  destination: s3Destination,
});
```

The S3 destination also supports custom dynamic prefixes. `prefix` will be used for files
successfully delivered to S3. `errorOutputPrefix` will be added to failed records before
writing them to S3.

```ts fixture=with-bucket
const s3Destination = new destinations.S3({
  bucket: bucket,
  prefix: 'myFirehose/DeliveredYear=!{timestamp:yyyy}/anyMonth/rand=!{firehose:random-string}',
  errorOutputPrefix: 'myFirehoseFailures/!{firehose:error-output-type}/!{timestamp:yyyy}/anyMonth/!{timestamp:dd}',
});
```

See: [Custom S3 Prefixes](https://docs.aws.amazon.com/firehose/latest/dev/s3-prefixes.html) in the *Kinesis Data Firehose Developer Guide*.

### Elasticsearch

```ts
import * as es from '@aws-cdk/aws-elasticsearch';
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations';

const domain = new es.Domain(this, 'Domain', {
  version: es.ElasticsearchVersion.V7_1,
});

const deliveryStream = new DeliveryStream(this, 'Delivery Stream', {
  destination: new destinations.Elasticsearch({
    domain: domain,
    indexName: 'myindex',
  }),
});
```

### Redshift

A delivery stream can deliver data to a table within a Redshift cluster, using an
intermediate S3 bucket and executing a Redshift `COPY` command. Redshift clusters must be
placed in public subnets within an VPC, must be marked as publicly accessible, and cannot
provide a master user password (it must be generated by the CDK). A Redshift user will be
created within the cluster for the exclusive use of the delivery stream, and a Redshift
table with the provided schema will be created within the provided database.

```ts
import * as ec2 from '@aws-cdk/aws-ec2';
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations';
import * as redshift from '@aws-cdk/aws-redshift';
import { Duration, Size } from '@aws-cdk/core';

const vpc = new ec2.Vpc(this, 'Vpc');
const database = 'my_db';
const cluster = new redshift.Cluster(this, 'Cluster', {
  vpc: vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PUBLIC,
  },
  masterUser: {
    masterUsername: 'master',
  },
  defaultDatabaseName: database,
  publiclyAccessible: true,
});

const redshiftDestination = new destinations.Redshift({
  cluster: cluster,
  user: {
    username: 'firehose',
  },
  database: database,
  tableName: 'firehose_test_table',
  tableColumns: [
    { name: 'TICKER_SYMBOL', dataType: 'varchar(4)' },
    { name: 'SECTOR', dataType: 'varchar(16)' },
    { name: 'CHANGE', dataType: 'float' },
    { name: 'PRICE', dataType: 'float' },
  ],
  copyOptions: 'json \'auto\'',
});
new DeliveryStream(this, 'Delivery Stream', {
  destination: redshiftDestination,
});
```

### 3rd Party

Third-party service providers such as Splunk, Datadog, Dynatrace, LogicMonitor, MongoDB,
New Relic, and Sumo Logic have integrated with AWS to allow users to configure their
service as a delivery stream destination out of the box.

These integrations have not been completed (see #1234), please use [custom HTTP endpoints](#custom-http-endpoint)
to integrate with 3rd party services.

### Custom HTTP Endpoint

A delivery stream can deliver data to any custom HTTP endpoint that conforms to the
[HTTP request/response schema]. Use the `HttpDestination` class to specify how Kinesis
Data Firehose can reach your custom endpoint and any configuration that may be required.

This integration has not been completed (see #1234).

[HTTP request/response schema]: https://docs.aws.amazon.com/firehose/latest/dev/httpdeliveryrequestresponse.html

## Server-side Encryption

Enabling server-side encryption (SSE) requires Kinesis Data Firehose to encrypt all data
sent to delivery stream when it is stored at rest. This means that data is encrypted
before being written to the storage layer and decrypted after it is received from the
storage layer. The service manages keys and cryptographic operations so that sources and
destinations do not need to, as the data is encrypted and decrypted at the boundaries of
the service. By default, delivery streams do not have SSE enabled.

The Key Management Service (KMS) Customer Managed Key (CMK) used for SSE can either be
AWS-owned or customer-managed. AWS-owned CMKs are keys that an AWS service (in this case
Kinesis Data Firehose) owns and manages for use in multiple AWS accounts. As a customer,
you cannot view, use, track, or manage these keys, and you are not charged for their
use. On the other hand, customer-managed CMKs are keys that are created and owned within
your account and managed entirely by you. As a customer, you are responsible for managing
access, rotation, aliases, and deletion for these keys, and you are changed for their
use. See: [Customer master keys](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#master_keys)
in the *KMS Developer Guide*.

```ts fixture=with-destination
import * as kms from '@aws-cdk/aws-kms';

// SSE with an AWS-owned CMK
new DeliveryStream(this, 'Delivery Stream AWS Owned', {
  encryption: StreamEncryption.AWS_OWNED,
  destination: destination,
});

// SSE with an customer-managed CMK that is created automatically by the CDK
new DeliveryStream(this, 'Delivery Stream Implicit Customer Managed', {
  encryption: StreamEncryption.CUSTOMER_MANAGED,
  destination: destination,
});

// SSE with an customer-managed CMK that is explicitly specified
const key = new kms.Key(this, 'Key');
new DeliveryStream(this, 'Delivery Stream Explicit Customer Managed'', {
  encryptionKey: key,
  destination: destination,
});
```

If a Kinesis data stream is configured as the source of a delivery stream, Kinesis Data
Firehose no longer stores data at rest and all encryption is handled by Kinesis Data
Streams. Kinesis Data Firehose receives unencrypted data from Kinesis Data Streams,
buffers the data in memory, and sends the data to destinations without ever writing the
unencrypted data at rest. Practically, this means that SSE should be specified on the
Kinesis data stream when it is used as the source of a delivery stream (and specifying SSE
on the delivery stream will cause an error).

See: [Data Protection](https://docs.aws.amazon.com/firehose/latest/dev/encryption.html) in
the *Kinesis Data Firehose Developer Guide*.

## Monitoring

Kinesis Data Firehose is integrated with CloudWatch, so you can monitor the performance of
your delivery streams via logs and metrics.

### Logs

Kinesis Data Firehose will send logs to CloudWatch when data transformation or data
delivery fails.  The CDK will enable logging by default and create a CloudWatch LogGroup
and LogStream for your Delivery Stream.

You can provide a specific log group to specify where the CDK will create the log streams
where log events will be sent:

```ts fixture=with-destination
import * as logs from '@aws-cdk/aws-logs';

const logGroup = new logs.LogGroup(this, 'Log Group');
new DeliveryStream(this, 'Delivery Stream', {
  logGroup: logGroup,
  destination: destination,
});
```

Logging can also be disabled:

```ts fixture=with-destination
new DeliveryStream(this, 'Delivery Stream', {
  loggingEnabled: false,
  destination: destination,
});
```

See: [Monitoring using CloudWatch Logs](https://docs.aws.amazon.com/firehose/latest/dev/monitoring-with-cloudwatch-logs.html)
in the *Kinesis Data Firehose Developer Guide*.

### Metrics

Kinesis Data Firehose sends metrics to CloudWatch so that you can collect and analyze the
performance of the delivery stream, including data delivery, data ingestion, data
transformation, format conversion, API usage, encryption, and resource usage. You can then
use CloudWatch alarms to alert you, for example, when data freshness (the age of the
oldest record in the delivery stream) exceeds the buffering limit (indicating that data is
not being delivered to your destination), or when the rate of incoming records exceeds the
limit of records per second (indicating data is flowing into your delivery stream faster
than it is configured to process).

CDK provides methods for accessing delivery stream metrics with default configuration,
such as `metricIncomingBytes`, and `metricIncomingRecords` (see [`IDeliveryStream`](../lib/delivery-stream.ts)
for a full list). CDK also provides a generic `metric` method that can be used to produce
metric configurations for any metric provided by Kinesis Data Firehose; the configurations
are pre-populated with the correct dimensions for the delivery stream.

```ts fixture=with-delivery-stream
// TODO: confirm this is a valid alarm
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
// Alarm that triggers when the per-second average of incoming bytes exceeds 90% of the current service limit
const incomingBytesPercentOfLimit = new cloudwatch.MathExpression({
  expression: 'incomingBytes / 300 / bytePerSecLimit',
  usingMetrics: {
    incomingBytes: deliveryStream.metricIncomingBytes({ statistic: cloudwatch.Statistic.SUM }),
    bytePerSecLimit: deliveryStream.metric('BytesPerSecondLimit'),
  },
});
new Alarm(this, 'Alarm', {
  metric: incomingBytesPercentOfLimit,
  threshold: 0.9,
  evaluationPeriods: 3,
});
```

See: [Monitoring Using CloudWatch Metrics](https://docs.aws.amazon.com/firehose/latest/dev/monitoring-with-cloudwatch-metrics.html)
in the *Kinesis Data Firehose Developer Guide*.

## Compression

Your data can automatically be compressed when it is delivered to S3 as either a final or
an intermediary/backup destination. Supported compression formats are: gzip, Snappy,
Hadoop-compatible Snappy, and ZIP, except for Redshift destinations, where Snappy
(regardless of Hadoop-compatibility) and ZIP are not supported. By default, data is
delivered to S3 without compression.

```ts fixture=with-bucket
// Compress data delivered to S3 using Snappy
const s3Destination = new destinations.S3({
  compression: Compression.SNAPPY,
  bucket: bucket,
});
new DeliveryStream(this, 'Delivery Stream', {
  destination: destination,
});
```

## Buffering

Incoming data is buffered before it is delivered to the specified destination. The
delivery stream will wait until the amount of incoming data has exceeded some threshold
(the "buffer size") or until the time since the last data delivery occurred exceeds some
threshold (the "buffer interval"), whichever happens first. You can configure these
thresholds based on the capabilities of the destination and your use-case. By default, the
buffer size is 3 MiB and the buffer interval is 1 minute.

```ts fixture=with-bucket
// Increase the buffer interval and size to 5 minutes and 3 MiB, respectively
import * as cdk from '@aws-cdk/core';

const s3Destination = new destinations.S3({
  bufferingInterval: cdk.Duration.minutes(5),
  bufferingSize: cdk.Size.mebibytes(8),
  bucket: bucket,
});
new DeliveryStream(this, 'Delivery Stream', {
  destination: destination,
});
```

See: [Data Delivery Frequency](https://docs.aws.amazon.com/firehose/latest/dev/basic-deliver.html#frequency)
in the *Kinesis Data Firehose Developer Guide*.

## Backup

A delivery stream can be configured to backup data to S3 that it attempted to deliver to
the configured destination. Backed up data can be all the data that the delivery stream
attempted to deliver or just data that it failed to deliver (Redshift and S3 destinations
can only backup all data). CDK can create a new S3 bucket where it will back up data or
you can provide a bucket where data will be backed up. You can also provide prefix under
which your backed-up data will placed within the bucket. By default, source data is not
backed up to S3.

```ts fixture=with-domain
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations';
import * as s3 from '@aws-cdk/aws-s3';

// Enable backup of all source records (to an S3 bucket created by CDK)
const deliveryStream = new DeliveryStream(this, 'Delivery Stream Backup All', {
  destination: new destinations.Elasticsearch({
    domain: domain,
    indexName: 'myindex',
    backup: BackupMode.ALL,
  }),
});

// Enable backup of only the source records that failed to deliver (to an S3 bucket created by CDK)
const deliveryStream = new DeliveryStream(this, 'Delivery Stream Backup Failed', {
  destination: new destinations.Elasticsearch({
    domain: domain,
    indexName: 'myindex',
    backup: BackupMode.FAILED,
  }),
});

// Explicitly provide an S3 bucket to which all source records will be backed up
const backupBucket = new s3.Bucket(this, 'Bucket');
const deliveryStream = new DeliveryStream(this, 'Delivery Stream Backup All Explicit Bucket', {
  destination: new destinations.Elasticsearch({
    domain: domain,
    indexName: 'myindex',
    backupBucket: backupBucket,
  }),
});

// Explicitly provide an S3 prefix under which all source records will be backed up
const deliveryStream = new DeliveryStream(this, 'Delivery Stream Backup All Explicit Prefix', {
  destination: new destinations.Elasticsearch({
    domain: domain,
    indexName: 'myindex',
    backup: BackupMode.ALL,
    backupPrefix: 'mybackup',
  }),
});
```

If any Data Processing or Transformation is configured on your Delivery Stream, the source
records will be backed up in their original format.

## Data Processing/Transformation

Data can be transformed before being delivered to destinations. There are two types of
data processing for delivery streams: record transformation with AWS Lambda, and record
format conversion using a schema stored in an AWS Glue table. If both types of data
processing are configured, then the Lambda transformation is performed first. By default,
no data processing occurs.

### Data transformation with AWS Lambda

To transform the data, Kinesis Data Firehose will call a Lambda function that you provide
and deliver the data returned in lieu of the source record. The function must return a
result that contains records in a specific format, including the following fields:

- `recordId` -- the ID of the input record that corresponds the results.
- `result` -- the status of the transformation of the record: "Ok" (success), "Dropped"
  (not processed intentionally), or "ProcessingFailed" (not processed due to an error).
- `data` -- the transformed data, Base64-encoded.

The data is buffered up to 1 minute and up to 3 MiB by default before being sent to the
function, but can be configured using `bufferInterval` and `bufferSize` in the processor
configuration (see: [Buffering](#buffering)). If the function invocation fails due to a
network timeout or because of hitting an invocation limit, the invocation is retried 3
times by default, but can be configured using `retries` in the processor configuration.

```ts fixture=with-bucket
// Provide a Lambda function that will transform records before delivery, with custom
// buffering and retry configuration
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
const lambdaFunction = new lambda.Function(this, 'Processor', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, 'process-records')),
});
const s3Destination = new firehosedestinations.S3Destination({
  processors: [{
    lambdaFunction: lambdaFunction,
    bufferingInterval: cdk.Duration.minutes(5),
    bufferingSize: cdk.Size.mebibytes(5),
    retries: 5,
  }],
  bucket: bucket,
});
new DeliveryStream(this, 'Delivery Stream', {
  destination: destination,
});
```

See: [Data Transformation](https://docs.aws.amazon.com/firehose/latest/dev/data-transformation.html)
in the *Kinesis Data Firehose Developer Guide*.

### Record format conversion using AWS Glue

Kinesis Data Firehose can convert the format of your input data from JSON to
[Apache Parquet](https://parquet.apache.org/) or [Apache ORC](https://orc.apache.org/)
before storing the data in S3. This allows you to change the format of your data
records without writing any Lambda code, but you must use S3 as your destination.

```ts
import * as glue from '@aws-cdk/aws-glue';
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations';

const myGlueDb = new glue.Database(this, 'MyGlueDatabase',{
  databaseName: 'MyGlueDatabase',
});
const myGlueTable = new glue.Table(this, 'MyGlueTable', {
  columns: [{
    name: 'firstname',
    type: glue.Schema.STRING,
  }, {
    name: 'lastname',
    type: glue.Schema.STRING,
  }, {
    name: 'age',
    type: glue.Schema.INTEGER,
  }],
  dataFormat: glue.DataFormat.PARQUET,
  database: myGlueDb,
  tableName: 'myGlueTable',
});

new DeliveryStream(this, 'Delivery Stream', {
  destination: new destinations.S3({
    dataFormatConversionConfiguration: {
      schema: myGlueTable,
      inputFormat: destinations.InputFormat.OPENX_JSON
      outputFormat: destinations.OuputFormat.PARQUET
    },
  }),
});
```

See: [Converting Input Record Format](https://docs.aws.amazon.com/firehose/latest/dev/record-format-conversion.html)
in the *Kinesis Data Firehose Developer Guide*.

### Specifying an IAM role

The DeliveryStream class automatically creates an IAM role with all the minimum necessary
permissions for Kinesis Data Firehose to access the resources referenced by your delivery
stream. For example: an Elasticsearch domain, a Redshift cluster, a backup or destination
S3 bucket, a Lambda data transformer, an AWS Glue table schema, etc. If you wish, you may
specify your own IAM role. It must have the correct permissions, or delivery stream
creation or data delivery may fail.

```ts
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-iam';

const role = new iam.Role(stack, 'MyRole');
const bucket = new s3.bucket(stack, 'MyBucket');
bucket.grantWrite(role);
new DeliveryStream(stack, 'MyDeliveryStream', {
  destination: new destinations.S3({
    bucket: bucket,
  }),
  role: role,
});
```

See [Controlling Access](https://docs.aws.amazon.com/firehose/latest/dev/controlling-access.html)
in the *Kinesis Data Firehose Developer Guide*.

## Permission Grants

IAM roles, users or groups which need to be able to work with delivery streams should be
granted IAM permissions.

Any object that implements the `IGrantable` interface (has an associated principal) can be
granted permissions to a delivery stream by calling:

- `grantRead(principal)` - grants the principal read access to the control plane
- `grantWrite(principal)` - grants the principal write access to the control plane
- `grantWriteData(principal)` - grants the principal write access to the data plane
- `grantFullAccess(principal)` - grants principal full access to the delivery stream

### Control Plane Read Permissions

Grant `read` access to the control plane of a delivery stream by calling the `grantRead()` method.

```ts fixture=with-delivery-stream
import * as iam from '@aws-cdk/aws-iam';
const lambdaRole = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
}

// Give the role permissions to read information about the delivery stream
deliveryStream.grantRead(lambdaRole);
```

The following read permissions are provided to a service principal by the `grantRead()` method:

- `firehose:DescribeDeliveryStream`
- `firehose:ListDeliveryStreams`
- `firehose:ListTagsForDeliveryStream`

### Control Plane Write Permissions

Grant `write` access to the control plane of a delivery stream by calling the `grantWrite()` method.

```ts fixture=with-delivery-stream
import * as iam from '@aws-cdk/aws-iam';
const lambdaRole = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
}

// Give the role permissions to modify the delivery stream
deliveryStream.grantWrite(lambdaRole);
```

The following write permissions are provided to a service principal by the `grantWrite()` method:

- `firehose:DeleteDeliveryStream`
- `firehose:StartDeliveryStreamEncryption`
- `firehose:StopDeliveryStreamEncryption`
- `firehose:UpdateDestination`

### Data Plane Write Permissions

Grant `write` access to the data plane of a delivery stream by calling the `grantWriteData()` method.

```ts fixture=with-delivery-stream
import * as iam from '@aws-cdk/aws-iam';
const lambdaRole = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
}

// Give the role permissions to write data to the delivery stream
deliveryStream.grantWriteData(lambdaRole);
```

The following write permissions are provided to a service principal by the `grantWriteData()` method:

- `firehose:PutRecord`
- `firehose:PutRecordBatch`

### Custom Permissions

You can add any set of permissions to a delivery stream by calling the `grant()` method.

```ts fixture=with-delivery-stream
import * as iam from '@aws-cdk/aws-iam';
const user = new iam.User(this, 'User');

// give user permissions to update destination
deliveryStream.grant(user, 'firehose:UpdateDestination');
```

---

# Amazon Kinesis Data Firehose Destinations Library

This library provides constructs for adding destinations to a Amazon Kinesis Data Firehose
delivery stream.  Destinations can be added by specifying the `destination` prop when
creating a delivery stream.

See Amazon Kinesis Data Firehose module README for usage examples.

If further customization is required, use `HttpDestination` from this package or implement
`firehose.IDestination`.

---

## FAQ

### What are we launching today?

We are launching a new module (`@aws-cdk/aws-kinesisfirehose`) that contains a single L2
construct (`DeliveryStream`). This launch fully and fluently supports Kinesis Data
Firehose (a fully-managed service for delivering real-time streaming data to storage
locations) within the CDK. Out of the box, we are launching with 3 AWS service
destinations (S3, Elasticsearch, and Redshift), as well as a generic HTTP destination so
that customers can connect to the suported 3rd-party cloud service providers or any custom
HTTP endpoint that they develop. These destinations are located in a secondary module
(`@aws-cdk/aws-kinesisfirehose-destinations`).

### Why should I use this feature?

Specify and spin up a delivery stream that streams high amounts of data straight to your
storage service. Possible use-cases include automated CloudWatch log delivery to S3 for
analysis in S3; streaming analytic data to Redshift for analysis in Quicksight. Using
Kinesis Data Firehose with CDK smooths many configuration edges and provides seamless
integrations with your existing infrastructure as code.

## Internal FAQ

### Why are we doing this?

The [tracking Github issue for the module](https://github.com/aws/aws-cdk/issues/7536) has
the most +1s for a new module (43) besides Elasticache (68) so we have a clear signal that
customers want CDK support for this service.

A delivery stream requires a fairly verbose configuration to set up depending on the
destination desired. For example, the Redshift destination synthesizes to about 900 lines
of JSON from about 20 lines of Typescript code. The destination requires only 5 variables
to be configured in order to create a resource with 20+ nested properties and 10+
associated/generated resources. While we retain flexibility, we often replace several CFN
properties with a single boolean switch that creates and connects the required resources.

Using Kinesis Data Firehose without the CDK requires network configuration, complex
permission statements, and manual intervention. We have added 10+ compile-time validations
and auto-generated permissions to ensure destinations are correctly integrated, avoiding
days of debugging errors. We have leveraged custom resources in order to perform a
one-click deployment that creates an immediately functional application with no manual
effort.

### Why should we _not_ do this?

We are not confident that the service API is fully set in stone and implementing an L2 on
top of the current L1 may be setting us up for changes in the future. We are reaching out
to the service team to get their input and plans for the service. See: “alternative
solutions”, below, for concrete details.

It’s a large effort (3 devs * 1 week) to invest in a module when we have other pressing
projects. However, the bulk of the effort has been spent already since we have fairly
robust prototypes already implemented.

### What changes are required to enable this change?

#### Design

- `IDeliveryStream` -- interface for created and imported delivery streams

  ```ts
  interface IDeliveryStream extends
      // Since DeliveryStream will extend Resource
      cdk.IResource,
      // To allow service role to access other resources like Redshift
      iam.IGrantable,
      // To open network conns between Firehose and resources in VPCs like Redshift
      ec2.IConnectable,
      // DeliveryStream allows tagging
      cdk.ITaggable {
    readonly deliveryStreamArn: string;
    readonly deliveryStreamName: string;
    grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
    // Grant permission to describe the stream
    grantRead(grantee: iam.IGrantable): iam.Grant;
    // Grant permission to modify the stream
    grantWrite(grantee: iam.IGrantable): iam.Grant;
    // Grant permission to write data to the stream
    grantWriteData(grantee: iam.IGrantable): iam.Grant;
    grantFullAccess(grantee: iam.IGrantable): iam.Grant;
    metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
    // Some canned metrics as well like `metricBackupToS3DataFreshness`
  }
  ```

- `DeliveryStreamProps` -- configuration for creating a `DeliveryStream`

  ```ts
  interface DeliveryStreamProps {
    // The destination that this delivery stream will deliver data to.
    readonly destination: IDestination;
    // Auto-generated by CFN
    readonly deliveryStreamName?: string;
    // Can source data from Kinesis, if not provided will use API to produce data
    readonly sourceStream?: kinesis.IStream;
    // Service role
    readonly role?: iam.IRole;
    // Specifies SSE (AWS-owned, customer-managed, none)
    readonly encryption?: StreamEncryption;
    // Customer-managed CMK for SSE
    readonly encryptionKey?: kms.IKey;
  }
  ```

- `IDestination` -- interface that destinations will implement to create
  resources as needed and produce configuration that is injected into the
  DeliveryStream definition

  ```ts
  // Output of IDestination bind method
  interface DestinationConfig {
    // Schema-less properties that will be injected directly into `CfnDeliveryStream`.
     // Should include top-level key like `{ RedshiftDestinationConfiguration: { ... } }`
    readonly properties: object;
  }
  // Info provided to bind method to help destination attach
  interface DestinationBindOptions {
    readonly deliveryStream: IDeliveryStream;
  }
  interface IDestination {
    bind(scope: Construct, options: DestinationBindOptions): DestinationConfig;
  }
  ```

- `DestinationBase` -- abstract base destination class with some helper
  props/methods

  ```ts
  // Compression method for data delivered to S3
  enum Compression { GZIP, HADOOP_SNAPPY, SNAPPY, UNCOMPRESSED, ZIP }
  // Not yet fully-fleshed out
  interface DataProcessor {
     // Function that will be called to do data processing
    readonly lambdaFunction: lambda.IFunction;
    // Length of time delivery stream will buffer data before sending to processor
    readonly bufferInterval?: Duration;
    // Size of buffer
    readonly bufferSize?: Size;
    // Number of retries for networking failures or invocation limits
    readonly retries?: number;
  }
  interface DestinationProps {
     // Whether failure logging should be enabled
     readonly logging?: boolean;
    // Specific log group to use for failure logging
    readonly logGroup?: logs.ILogGroup;
    // Data transformation to convert data before delivering
    // Should probably just be a singleton
    readonly processors?: DataProcessor[];
    // Whether to backup all source records, just failed records, or none
    readonly backup?: BackupMode;
    // Specific bucket to use for backup
    readonly backupBucket?: s3.IBucket;
    // S3 prefix under which to place backups
    readonly backupPrefix?: string;
    // Length of time delivery stream will buffer data before backing up
    readonly backupBufferInterval?: Duration;
    // Size of buffer
    readonly backupBufferSize?: Size;
  }
  abstract class DestinationBase implements IDestination {
     constructor(protected readonly props: DestinationProps = {}) {}
    abstract bind(scope: Construct, options: DestinationBindOptions): DestinationConfig;
     // Helper methods that subclasses can use to create common config
    protected createLoggingOptions(...): CfnDeliveryStream.CloudWatchLoggingOptionsProperty | undefined;
    protected createProcessingConfig(...): CfnDeliveryStream.ProcessingConfigurationProperty | undefined;
    protected createBackupConfig(...): CfnDeliveryStream.S3DestinationConfigurationProperty | undefined;
    protected createBufferingHints(...): CfnDeliveryStream.BufferingHintsProperty | undefined;
  }
  ```

#### Other modules

- Redshift
  - expose publiclyAccessible Cluster attribute (used to ensure cluster is
    publicly accessible for Firehose access)
  - expose subnetGroups Cluster attribute and selectedSubnets ClusterSubnetGroup
    (used to ensure cluster is located in public subnet for Firehose access)
  - expose attachRole Cluster method that allows lazily attaching a new role to
    the cluster after construction (used to give cluster permissions to access
    S3 for the COPY operation after the cluster has been created)
- Region Info
  - add new fact that tracks the IP addresses used by Firehose in each region
    (used to allow incoming connections from Firehose to resources like a
    Redshift cluster)

### Is this a breaking change?

No.

### What alternative solutions did you consider?

1. Placing destinations into the core module instead of creating a separate module, since
   a delivery stream can’t exist without a destination.  We followed the common pattern of
   placing service integrations (where one service provides an interface that multiple
   other services implement) into a separate module. In contrast to many of the other
   modules that follow this pattern, a delivery stream cannot be created without some
   destination, as the destination is a key element of the service. It could be argued
   that these destinations should be treated as first-class and co-located with the
   delivery stream itself. However, this is similar to SNS, where a topic doesn’t have
   much meaning without a subscription and yet service integrations for subscriptions are
   still located in a separate module.
2. Hoist common configuration/resources such as logging, data transformation, and backup
   to the delivery stream level Currently, we follow the service API closely in the
   hierarchical sense: many properties that are common to multiple destinations are
   specified in the destination instead of on the delivery stream, since this is how the
   API organizes it. Because the delivery stream only allows a single destination,
   modeling these common properties on the delivery stream itself would reduce the amount
   of configuration each destination implementation would need to manage. Practically,
   this would look like moving every property in `DestinationProps` into
   `DeliveryStreamProps`, as well as exposing hooks in `DestinationBindOptions` to allow
   destinations to call configuration-creating functions during binding.  Some downsides
   of making this change: moving away from the service API may confuse customers who have
   previously used it to create a delivery stream; if delivery streams support multiple
   destinations in the future then configuration will not be flexible per-destination.
3. Provide a more generic interface for data transformers instead of requiring a Lambda
   function.  The data transformation API seems to indicate future support for processors
   that are not Lambda functions; [ProcessingConfiguration.Processor](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-kinesisfirehose-deliverystream-processor.html)
   is quite generic, with the only processor type currently supported as “Lambda”.
   However, our DataProcessor requires a lambda.IFunction, tying our API to Lambda as the
   only supported processor and requiring a breaking change to support a different
   processor type. We could work around this by creating a class instead that has static
   methods for each possible processor type (ie., `static fromFunction(lambdaFunction:
   lambda.IFunction, options: ProcessorOptions): Processor`). This may be too complex for
   a change that we are not confident will occur.
4. Allow multiple destinations to be provided to the delivery stream.  While the console
   UI only allows a single destination to be configured per delivery stream, the
   horizontal model of the service API and the fact that a call to DescribeDeliveryStream
   returns an array of destinations seems to indicate that the service team may support
   multiple destinations in the future. To that end, we could modify `DeliveryStreamProps`
   to accept an array of destinations (instead of a single destination, as is the case
   currently) and simply throw an error if multiple destinations are provided until the
   service team launches that feature. However, this would be significantly
   future-proofing the API at the expense of confusing users that would reasonably assume
   that multiple destinations are currently supported.
5. Allowing the user to create or use separate IAM roles for each aspect of the delivery
   stream. This would mean that in a complex delivery stream using AWS Lambda
   transformation, AWS Glue record conversion, S3 Backup, and a destination, that the user
   could specify a separate IAM role for Firehose to access each of those resources. We
   chose to only use one role for this design, because it will be simpler for the
   user. While the API is in the experimental stage, we will solicit customer feedback to
   find out if customers want to have more fine grained control over the permissions for
   their delivery stream.

### What is the high level implementation plan?

> Describe your plan on how to deliver this feature from prototyping to GA.
> Especially think about how to "bake" it in the open and get constant feedback
> from users before you stabilize the APIs.
>
> If you have a project board with your implementation plan, this is a good
> place to link to it.

### Are there any open issues that need to be addressed later?

We should probably have a separate design for `CustomHttpDestination`, as that
will need to be used for both 3rd-party service partners and truly custom HTTP
endpoints provided by the customer.

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.
