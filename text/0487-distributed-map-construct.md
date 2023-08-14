# RFC - Step Functions Distribute Map State CDK L2 Construct

* **Original Author(s):**: @beck3905
* **Tracking Issue**: #487
* **API Bar Raiser**: @{BAR_RAISER_USER}

Users will be able to create Map states with the new DISTRIBUTED mode in their Step Functions state machine definitions.

## Working Backwards

The following is the README for the Distributed Map State L2 Construct.

### Map State in Distributed Mode

The Step Functions Map state supports a "distributed" mode for larger scale parallel workloads as defined by the [map state processing modes](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-inline-vs-distributed-map.html).

A map state in "distributed" mode runs each iteration of the map state in a child workflow known as a "Map Run". In order to support larger inputs and outputs and child workflow execution options, the map state includes multiple new properties that only pertain to operating in "distributed" mode. See [Using Map state in Distributed mode](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-asl-use-map-state-distributed.html)

The distributed map state construct generates standard state machine definitions that use the standard map state in "distributed" mode, but simplify authoring those definitions by providing specific new classes.

Distributed map states extend the existing Map state construct and introduce several new optional properties:

* `ItemReader` - Determines the list of items over which the map state will iterate. Options include:
  * state input JSON payload
  * S3 bucket (list objects)
  * S3 object (CSV)
  * S3 object (JSON)
  * S3 inventory manifest
* `ToleratedFailurePercentage` - percentage of map iterations that can fail, but still allow the state machine execution to succeed
* `ToleratedFailureCount` - count of map iterations that can fail, but still allow the state machine execution to succeed
* `ItemBatcher` - allows each iteration to contain a batch of items rather than individual items
* `Label` - applies a label to the ARN of each map run (iteration) execution
* `ResultWriter` - determines which S3 bucket and prefix to write map state results

#### Defining a DistributeMap

```ts
import * as stepfunctions from '@aws-cdk/aws-stepfunctions';
import * as s3 from '@aws-cdk/aws-s3';

const readerBucket = new s3.Bucket(stack, 'ItemsBucket');
const writerBucket = new s3.Bucket(stack, 'ResultBucket');

const distributedMap = new stepfunctions.DistributedMap(this, "Distributed Map State", {
    mapExecutionType: stepfunctions.StateMachineType.EXPRESS,
    itemReader: new stepfunctions.S3ObjectsItemReader({
        bucket: readerBucket,
        prefix: 'items',
        maxItems: 10
    }),
    resultWriter: new stepfunctions.ResultWriter({
        bucket: writerBucket,
        prefix: 'test',
    }),
    toleratedFailurePercentage: 5,
    toleratedFailureCountPath: stepfunctions.JsonPath.stringAt('$.toleratedFailureCount'),
    maxItemsPerBatch: 10,
    maxInputBytesPerBatchPath: stepfunctions.JsonPath.stringAt('$.maxInputBytesPerBatch'),
    label: 'demoLabel',
    batchInput: {
        test: 2
    }
});
```

#### Supporting Classes

The more complex properties of a distributed map state are defined in their own classes.

##### Item Readers

###### S3 Objects

This will list objects in a S3 bucket.

```ts
const reader = new S3ObjectsItemReader({
    bucket: <s3.IBucket>,
    prefix?: <string>,
    maxItems?: <number>
});
```

###### S3 Json

This will list items in a JSON array stored in a S3 object.

```ts
const reader = new S3JsonItemReader({
    bucket: <s3.IBucket>,
    key: <string>,
    maxItems?: <number>
});
```

###### S3 CSV

This will list items in a CSV file stored in a S3 object. Headers are determined by the `CsvHeaders` class.

```ts
const reader = new S3CsvItemReader({
    bucket: <s3.IBucket>,
    key: <string>,
    maxItems?: <number>,
    csvHeaders?: CsvHeaders.useFirstRow() | CsvHeaders.use([<string>, <string>])
});
```

###### S3 Manifest

This will list items in a S3 inventory manifest.

```ts
const reader = new S3ManifestItemReader({
    bucket: <s3.IBucket>,
    key: <string>,
    maxItems?: <number>
});
```

##### Result Writer

This will define the S3 location to store results of each iteration.

```ts
const writer = new ResultWriter({
    bucket: <s3.IBucket>,
    prefix?: <string>
});
```

#### Granting Access to S3 for Item Readers and Result Writers

Step Functions will need access to S3 buckets defined in Item Readers and Result Writers. IAM policies need to be attached to the execution role of the state machine. Depending on the type of reader or writer different permissions are needed.

##### S3 Objects Reader

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::myBucket"
            ],
            "Condition": {
                "StringLike": {
                    "s3:prefix": [
                        "processImages"
                    ]
                }
            }
        }
    ]
}
```

##### S3 CSV or JSON Item Reader

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::myBucket/csvDataset/ratings.csv|json"
            ]
        }
    ]
}
```

##### S3 Inventory Manifest Item Reader

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::destination-prefix/source-bucket/config-ID/YYYY-MM-DDTHH-MMZ/manifest.json",
                "arn:aws:s3:::destination-prefix/source-bucket/config-ID/data/*"
            ]
        }
    ]
}
```

##### S3 Result Writer

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListMultipartUploadParts",
                "s3:AbortMultipartUpload"
            ],
            "Resource": [
                "arn:aws:s3:::resultBucket/csvJobs/*"
            ]
        }
    ]
}
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching an L2 construct to support the Step Functions Map state in Distributed mode feature.

### Why should I use this feature?

Use this feature to process large scale parallel workflows in state machines. This feature supports high concurrency workflows.

## Internal FAQ

### Why are we doing this?

The "distributed" mode for Step Functions Map states was released late 2022 and is not currently available in state machine definitions authored using the CDK. This will allow users to author distributed map states natively in the CDK without having to resort to JSON or YAML state machine definitions.

### Why should we _not_ do this?

The only way to currently create a state machine using the CDK and use map states in "distributed" mode is to author the state machine definition in raw JSON or YAML. There is no L1 construct to support this.

I don't think the question is whether or not to do this, but whether it should be done _this_ way.

### What is the technical solution (design) of this feature?

Technical details and the implementation can be found in [PR 24331](https://github.com/aws/aws-cdk/pull/24331).

### Is this a breaking change?

No.

### What alternative solutions did you consider?

* The supporting classes could be organized differently
* Handling of the properties that support a value or path could be combined into a single, more complex property, but I chose to stick more closely to how they are implemented in Amazon States Language as separate properties.

### What are the drawbacks of this solution?

These constructs and classes deviate some from how a map state in distributed mode would be defined in Amazon States Language, so it could be confusing to new CDK users. However, I think it is in line with other CDK states constructs and patterns.

### What is the high-level project plan?

I have already submitted the PR with the implementation for review. Once the RFC is approved, the PR can be reopened, reviewed, and hopefully merged.

### Are there any open issues that need to be addressed later?

No.
