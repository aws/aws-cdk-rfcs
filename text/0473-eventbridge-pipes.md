# AWS CDK RFC-473 - EventBridge Pipes L2 Construct

- **Original Author(s):**: @RaphaelManke
- **Tracking Issue**: #473
- **API Bar Raiser**: @mrgrain

> Write one sentence which is a brief description of the feature. It should
> describe:
>
> - What is the user pain we are solving?
> - How does it impact users?

## Working Backwards

> This section should contain one or more "artifacts from the future", as if the
> feature was already released and we are publishing its CHANGELOG, README,
> CONTRIBUTING.md and optionally a PRESS RELEASE. This is the most important
> section of your RFC. It's a powerful thought exercise which will challenge you
> to truly think about this feature from a user's point of view.
>
> Choose _one or more_ of the options below:

**CHANGELOG**: feat(eventbridge): add support for EventBridge Pipes

## Readme

# EventBridge Pipes Construct Library

This library contains constructs for working with Amazon EventBridge Pipes.

EventBridge Pipes let you create source to target connections between several
aws services. While transporting messages from a source to a target the messages
can be filtered, transformed and enriched.

![diagram of pipes](https://docs.aws.amazon.com/images/eventbridge/latest/userguide/images/pipes_overview.png)

For more details see the service

[Documentation](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html)

[Cloudformation docs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-pipes-pipe.html)

## Pipe

[EventBridge Pipes](https://aws.amazon.com/blogs/aws/new-create-point-to-point-integrations-between-event-producers-and-consumers-with-amazon-eventbridge-pipes/) is a fully managed service that enables point-to-point integrations between event producers and consumers. Pipes can be used to connect several AWS services to each other, or to connect AWS services to external services.

A Pipe has a Source and a Target. The source events can be filtered and enriched before reaching the target.

### Example
```ts

new Pipe(this, "pipe", {
    source: new SqsSource(
      queue: sourceQueue,
      {
        batchSize: 10,
    }),
    
    filter: new Filter({
        eventPatterns: [{
                detail: {
                    user: ["example"],
                }, 
            }]
        ),
    }),

    enrichment: new LambdaEnrichment(
        function: enrichmentFunction,
        {
          inputTransformation: InputTransformation.fromJson({
              instance : <$.detail.instance-id>,
              state: <$.detail.state>,
              pipeArn : <aws.pipes.pipe-arn>,
              pipeName : <aws.pipes.pipe-name>,
              originalEvent : <aws.pipes.event.json>
        }),
    }),
    
    target: new SqsTarget(
      queue: targetQueue,
      {
        inputTransformation: InputTransformation.fromJson({
            instance : <$.detail.instance-id>,
            state: <$.detail.state>,
            pipeArn : <aws.pipes.pipe-arn>,
            pipeName : <aws.pipes.pipe-name>,
            originalEvent : <aws.pipes.event.json>
        }),
    }),
        
})
```

## Source

A source is a AWS Service that needs to be polled.
The following Sources are possible:

- [Amazon DynamoDB stream](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-dynamodb.html)
- [Amazon Kinesis stream](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-kinesis.html)
- [Amazon MQ broker](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-mq.html)
- [Amazon MSK stream](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-msk.html)
- [Self managed Apache Kafka stream](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-kafka.html)
- [Amazon SQS queue](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-sqs.html)

### Example

```ts
new SqsSource(
  queue: sourceQueue,
  {
    batchSize: 10,
})
```

## Filter

A Filter can be used to filter the events from the source before they are forwarded to the enrichment step.
Multiple filter expressions are possible. If one of the filter expressions matches the event is forwarded to the enrichment or target step.

### Example

```ts
new Filter({
    eventPatterns: [{
            detail: {
                user: ["example"],
            }, 
        }]
    ),
})
```
## Enrichment

In the enrichment step the (un)filtered payloads from the source can be used to invoke one of the following services

- API destination
- Amazon API Gateway
- Lambda function
- Step Functions state machine
  - only express workflow


### Example
```ts
new PipeLambdaEnrichment({
    function: enrichmentFunction,
    inputTransformation: InputTransformation.fromJson({
        instance : <$.detail.instance-id>,
        state: <$.detail.state>,
        pipeArn : <aws.pipes.pipe-arn>,
        pipeName : <aws.pipes.pipe-name>,
        originalEvent : <aws.pipes.event.json>
    }),
})
```

## Target

A Target is the end of the Pipe. After the payload from the source is pulled, filtered and enriched it is forwarded to the target.
For now the following targets are supported:

- [API destination](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-api-destinations.html)
- [API Gateway](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-api-gateway-target.html)
- [Batch job queue](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-event-target.html#pipes-targets-specifics-batch)
- [CloudWatch log group](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-event-target.html#pipes-targets-specifics-cwl)
- [ECS task](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-event-target.html#pipes-targets-specifics-ecs-task)
- Event bus in the same account and Region
- Firehose delivery stream
- Inspector assessment template
- Kinesis stream
- Lambda function (SYNC or ASYNC)
- Redshift cluster data API queries
- SageMaker Pipeline
- SNS topic
- SQS queue
- Step Functions state machine
  - Express workflows (ASYNC)
  - Standard workflows (SYNC or ASYNC)

The target event can be transformed before it is forwarded to the target using the same input transformation as in the enrichment step.

### Example

```ts
new SqsTarget(
  queue: targetQueue,
  {
    messageDeduplicationId: "messageDeduplicationId",
    inputTransformation: InputTransformation.fromJson({
        instance : <$.detail.instance-id>,
        state: <$.detail.state>,
        pipeArn : <aws.pipes.pipe-arn>,
        pipeName : <aws.pipes.pipe-name>,
        originalEvent : <aws.pipes.event.json>
    }),
})
```



---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

Q: How does this constructs improves developer experience?

A: Pipes are a new service that not have a L2 construct in the CDK. This construct makes it easier to use Pipes in the CDK. 
The construct apis reflect the AWS console so that the developer has a familiar experience. 
Especially the filter and input transformations are not easy to develop. 
Therefore the developer can use the provided tools in the aws console to develop the filter and input transformation and then use them directly in the cdk code. 
Additionally the construct provides a more type safe way to define the required parts of a Pipe.
Also the iam policy management is done by the construct which makes connecting the source, enrichment and target easier.


### What are we launching today?

Today we are launching a new construct that makes it easier to use EventBridge Pipes in the CDK.
This construct is a L2 construct that introduces specific classes for the different parts of a Pipe. These specified classes provide the developer with a more type safe way to define the required parts of a Pipe. 
On top of that the construct takes care of all the iam permissions that are required to connect the different parts of a Pipe.

Each in EventBridge Pipe supported source is represented by a class that supports the specific properties of the source and a helper class for creating filter pattern for that source.

Besides the source classes there are also classes for the different supported targets. These classes support the specific properties of the target and also take care of the iam permissions that are required to push events to the target.

The enrichment step is also supported by a class that supports the specific properties of the enrichment step and also takes care of the iam permissions that are required to invoke the enrichment step.

With this construct it is now possible to define a Pipe in the CDK that is equivalent to the Pipe that is defined in the AWS console.

### Why should I use this feature?

This construct makes it easier to use EventBridge Pipes in the CDK.
It provides a more type safe way to define the required parts of a Pipe and also takes care of the iam permissions that are required to connect the different parts of a Pipe.
It also splits the cloudformation template into multiple parts that are easier to understand and maintain. 
The construct additionally provides source, enrichment and target specific implementations that make it easier to develop EventBridge Pipes.

## Internal FAQ

Q: Why isn't the filter patten part of the source class?

A: The filter pattern isn't part of the source class because the AWS console as well has a separate filter pattern editor.
An integration into the source class would make it harder for the developer to find the property for the filter pattern.
This design decision still allows to build source specific filter patterns using the provided helper classes.
### Why are we doing this?

EventBridge Pipes are a crucial part of building cloud native pattern in an event driven architecture. 
Pipes can reduce the need of building lambda functions for transporting data from a to b. 
Implementing a Pipe in the CDK is currently not easy and each developer would need to understand the underlying cloudformation template to implement a Pipe.

### Why should we _not_ do this?

The construct build opinionated classes for the different parts of a Pipe. 
On top of that EventBridge Pipes can already be used in CDK today by using the low level cloudformation classes.


### What is the technical solution (design) of this feature?

An example implementation can be found here:
https://github.com/RaphaelManke/aws-cdk-pipes-rfc-473


The technical solution follows the following principles:
- The construct usage is as simple as possible. The developer should not need to understand the underlying cloudformation template to use the construct.
- The construct usage is similar to the usage of the AWS console.
- The construct provides a more type safe way to define the required parts of a Pipe.
- Each supported source is represented by a class that supports the specific properties of the source, the iam permissions and a helper class for creating filter pattern for that source.
- Each supported target is represented by a class that supports the specific properties of the target, the iam permissions and support input transformations.
- Each supported enrichment is represented by a class that supports the specific properties of the enrichment, the iam permissions and support input transformations.
- The Pipe exposes useful properties like the arn and the name of the pipe or the iam role that is used by the pipe.

#### Interfaces
**Pipe**

```ts
export interface IPipe extends IResource {
  /**
   * The name of the pipe
   *
   * @attribute
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-pipes-pipe.html#cfn-pipes-pipe-name
   */
  readonly pipeName: string;

  /**
   * The ARN of the pipe
   *
   * @attribute
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-pipes-pipe.html#Arn-fn::getatt
   */
  readonly pipeArn: string;

  /**
   * The role used by the pipe
   *
   * @attribute
   */
  readonly pipeRole: IRole;
}
```
and the Pipe constructor properties interface:
```ts
export interface IPipeProps {
  /**
   * The source of the pipe
   */
  readonly source: IPipeSource;
  /**
   * The filter pattern for the pipe source
   */
  readonly filter?: IPipeSourceFilter;
  /**
  *
  */
  readonly enrichment?: IPipeEnrichment;
  /**
   * The target of the pipe
   */
  readonly target: IPipeTarget;
  /**
  * Name of the pipe in the AWS console
  *
  * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-pipes-pipe.html#cfn-pipes-pipe-name
  */
  readonly name?: string;
  /**
   * The role used by the pipe which has permissions to read from the source and write to the target.
   * If an enriched target is used, the role also have permissions to call the enriched target.
   * If no role is provided, a role will be created.
   */
  readonly role?: IRole;
  /**
   * A description of the pipe displayed in the AWS console
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-pipes-pipe.html#cfn-pipes-pipe-description
   */
  readonly description?: string;
  /**
   * The desired state of the pipe. If the state is set to STOPPED, the pipe will not process events.
   *
   * @link https://docs.aws.amazon.com/eventbridge/latest/pipes-reference/API_Pipe.html#eventbridge-Type-Pipe-DesiredState
   */
  readonly desiredState?: DesiredState;
  /**
   * `AWS::Pipes::Pipe.Tags`
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-pipes-pipe.html#cfn-pipes-pipe-tags
   */
  readonly tags?: {
    [key: string]: string;
  };
}
```

***Source***

```ts
export interface IPipeSource {
  sourceArn: string;
  sourceParameters?: CfnPipe.PipeSourceParametersProperty | IResolvable;

  grantRead(grantee: IRole): void;
}
```
and the Source constructor properties interface:
```ts
export interface IPipeSourceProps {
  /**
   * The ARN of the source
   */
  readonly source: Queue | Table | ...;
  /**
   * One parameter of the source
   */
  readonly one?: string;

   /**
   * Another parameter of the source
   */
  readonly another?: number;
}
```


_Note_: The source Parameters are dependent on the source type. 
They are typed https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-pipes-pipe-pipesourceparameters.html. 
Each implementation of the IPipeSource interface should support only those properties that are relevant.
The sourceParametersIdentifier is used to identify the source parameters name in the cloudformation template.
E.g. SQS has the identifier `SqsQueueParameters` in the pipe source parameters object.

Example for SQS:
```ts
new SqsSource(
  source: queue,
  {
    batchSize: 10,
    maximumBatchingWindowInSeconds: 2,
});
```

***Source Filter***

```ts
export interface  IFilter {
  pattern: string;
}

export interface IFilterCriteria {
  filters: IFilter[];
}

export interface IPipeSourceFilter {
  filterCriteria: IFilterCriteria;
}
```

The Source Filter constructor properties interface:
```ts
export interface IPipeSourceFilterProps {
  /**
   * The filter criteria
   */
  readonly filterCriteriaJson: Json[];
}
```

The Filter is a JSON object like the one that can be created in the AWS console. 
The filter criteria is similar to the filter criteria of the [EventBridge Rule](https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_aws-events.Rule.html#eventpattern).


**Enrichment**

```ts
export interface IPipeEnrichment {
  enrichmentArn: string;
  enrichmentParameters: CfnPipe.PipeEnrichmentParametersProperty;

  grantInvoke(grantee: IRole): void;
}
```

**Input Transformation**

```ts
export interface IInputTransformation {
  inputTemplate: string;
}
```

_Note:_ The input transformation is the same as the one from [EventBridge RuleTargetInput](https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_aws-events.RuleTargetInput.html)

**Target**

```ts
export interface IPipeTarget {
  targetArn: string;
  targetParameters: CfnPipe.PipeTargetParametersProperty;

  grantPush(grantee: IRole): void;
}
```

the Target constructor properties interface should be similar to:

```ts
export interface IPipeSqsTargetProps {
  /**
   * The ARN of the target
   */
  readonly queue: Queue | Table | ...;
  /**
   * The input transformation
   */
  readonly inputTemplate?: IInputTransformation;
  /**
   * One parameter of the target
   */
  readonly one?: string;

   /**
   * Another parameter of the target
   */
  readonly another?: number;
}
```

### Is this a breaking change?

This is a new feature and therefore not a breaking change.

### What alternative solutions did you consider?

1. Build the Pipe in as a builder pattern like construct. 
   - A builder pattern like construct would reduce the required properties of the Pipe class.
   But the Pipe class would still need all the same parts and would increase the risk that developers forget to add a part to the Pipe.
   Additionally the cloudformation implementation requires that the pipe is defined in a single cloudformation resource.

### What are the drawbacks of this solution?

The source, target and enrichment classes require a lot of work and knowledge by the construct developer because each touched service as different properties and restrictions (e.g [Implicit body data parsing](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-input-transformation.html#input-transform-implicit)).

### What is the high-level project plan?

- [ ] Gather feedback on the RFC and discuss the api and usage design.
- [ ] Gather examples that show how the Pipe construct can be used.
- [ ] Implement the Pipe construct in a separate repository.
- [ ] Move the implementation to the aws-cdk repository.
- [ ] Publish the Pipe construct as a alpha construct.
- [ ] Move the Pipe construct to the stable constructs.

### Are there any open issues that need to be addressed later?

Not known yet.

## Appendix

- Details on the implementation concept can be found here: https://github.com/RaphaelManke/aws-cdk-pipes-rfc-473/blob/78b04c7ef51a934a7b1355b09796529e011e524f/README.md
