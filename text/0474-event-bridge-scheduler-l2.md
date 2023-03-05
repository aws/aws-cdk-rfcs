# {RFC_TITLE}

* **Original Author(s):**: @filletofish, @Jacco
* **Tracking Issue**: #https://github.com/aws/aws-cdk-rfcs/issues/473
* **API Bar Raiser**: @{BAR_RAISER_USER}

> Write one sentence which is a brief description of the feature. It should describe:
> * What is the user pain we are solving?
> * How does it impact users?

Library `aws-events-scheduler` contains L2 CDK constructs for creating, run, and manage scheduled tasks at scale with Amazon Event Bridge Scheduler. 


## Working Backwards

> This section should contain one or more "artifacts from the future", as if the
> feature was already released and we are publishing its CHANGELOG, README,
> CONTRIBUTING.md and optionally a PRESS RELEASE. This is the most important
> section of your RFC. It's a powerful thought exercise which will challenge you
> to truly think about this feature from a user's point of view.
>
> Choose *one or more* of the options below:
>
> * **CHANGELOG**: Write the changelog entry for this feature in conventional
>   form (e.g. `feat(eks): cluster tags`). If this change includes a breaking
>   change, include a `BREAKING CHANGE` clause with information on how to
>   migrate. If migration is complicated, refer to a fictional GitHub issue and
>   add its contents here.
>
> * **README**: If this is a new feature, write the README section which
>   describes this new feature. It should describe the feature and walk users
>   through usage examples and description of the various options and behavior.
>
> * **PRESS RELEASE**: If this is a major feature (~6 months of work), write the
>   press release which announces this feature. The press release is a single
>   page that includes 7 paragraphs: (1) summary, (2) problem, (3) solution, (4)
>   leader quote, (5) user experience, (6) customer testimonial and (7) one
>   sentence call to action.

**CHANGELOG**:

`feat(events-scheduler): Event Bridge Scheduler L2 constructs`

 **README**: 

 See below

 # Amazon EventBridge Scheduler Contruct Library

[Amazon Kinesis Data Firehose](https://docs.aws.amazon.com/firehose/latest/dev/what-is-this-service.html)
is a service for fully-managed delivery of real-time streaming data to storage services
such as Amazon S3, Amazon Redshift, Amazon Elasticsearch, Splunk, or any custom HTTP
endpoint or third-party services such as Datadog, Dynatrace, LogicMonitor, MongoDB, New
Relic, and Sumo Logic.

Kinesis Data Firehose delivery streams are distinguished from Kinesis data streams in
their models of consumtpion. Whereas consumers read from a data stream by actively pulling
data from the stream, a delivery stream pushes data to its destination on a regular
cadence. This means that data streams are intended to have consumers that do on-demand
processing, like AWS Lambda or Amazon EC2. On the other hand, delivery streams are
intended to have destinations that are sources for offline processing and analytics, such
as Amazon S3 and Amazon Redshift.

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk)
project. It allows you to define Kinesis Data Firehose delivery streams.

## Defining a schedule 

```ts

const target = new targets.LambdaInvoke({
    input: ScheduleTargetInput.fromObject({
    "payload": "useful"
    })
}, props.func);
    
const schedule = new Schedule(this, 'Schedule', {
    schedule: ScheduleExpression.rate(Duration.minutes(10)),
    target,
    description: 'This is a test schedule that invokes lambda function every 10 minutes.',
});
```

### Schedule Expressions


## Scheduler Targets

List of targets: 

1. InvokeLambda
2. ...

### Input 


### Specifying IAM role 

...

### Cross-account and cross-region targets
...

## Specifying Encryption key

.. details how to pass KMS key

## Overriding Target Properties 

...

## Monitoring

... 

### Group Metrics

... 

### Schedule Metrics
...



---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

> This section should include answers to questions readers will likely ask about
> this release. Similar to the "working backwards", this section should be
> written in a language as if the feature is now released.
>
> The template includes a some common questions, feel free to add any questions
> that might be relevant to this feature or omit questions that you feel are not
> applicable.

### What are we launching today?

> What exactly are we launching? Is this a new feature in an existing module? A
> new module? A whole framework? A change in the CLI?


We are launching a new module (`@aws-cdk/aws-eventbridge-scheduler`) that contains L2
construcs for managing Amazon EventBridge Scheduler schedules and targets.

This launch fully and fluently supports schedule expressions for ... 

Out of the box, we are launching with X Scheduler Targets for AWS service
destinations (InvokeLambda, ..., ... ), as well as a Universal Scheduler Target so
that customers can connect to other AWS services. These targets are located in a secondary module
(`@aws-cdk/aws-eventbridge-scheduler-targets`).


### Why should I use this feature?

> Describe use cases that are addressed by this feature.

EventBridge Scheduler is a tool that can be used to automate the creation of schedules for various tasks, such as sending reminders for tasks, starting and stopping Amazon EC2 instances, and managing subscription-based services. It can be useful for companies of different sizes and types, such as a task management system, a large organization with multiple AWS accounts, and SaaS providers. EventBridge Scheduler can help reduce costs, respect time zones, and manage scheduled tasks more efficiently. Using EventBridge Scheduler with CDK Constructs smooths many configuration edges and provides seamless
integrations with your existing infrastructure as code.


## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

> What is the motivation for this change?

The [tracking Github issue for the module](https://github.com/aws/aws-cdk/issues/23394) has
the 19 +1s indicating that customers want L2 CDK Construct support for this service.

Describe better what CDK construct simplifies: 

1. Setting up permissions for invoking targets
2. Encrypting data 
3. Metrics / Permissions to Schedules
4. Simpler target declaration 

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?


We are not confident that the service API is fully set in stone and implementing an L2 on
top of the current L1 may be setting us up for changes in the future. We are reaching out
to the service team to get their input and plans for the service. 

It’s a large effort (X devs * 1 week) to invest in a module when we have other pressing
projects. However, the bulk of the effort has been spent already since we have fairly
robust prototypes already implemented.

### What is the technical solution (design) of this feature?

![L2 Constructs Class Diagram](../images/EventBridge-Scheduler-2023-03-05-1723.excalidraw.png)

Prototype at https://github.com/filletofish/cdk-eb-scheduler/

### Is this a breaking change?

No.

### What alternative solutions did you consider?

> Briefly describe alternative approaches that you considered. If there are
> hairy details, include them in an appendix.

### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

### What is the high-level project plan?

> Describe your plan on how to deliver this feature from prototyping to GA.
> Especially think about how to "bake" it in the open and get constant feedback
> from users before you stabilize the APIs.
>
> If you have a project board with your implementation plan, this is a good
> place to link to it.

### Are there any open issues that need to be addressed later?

> Describe any major open issues that this RFC did not take into account. Once
> the RFC is approved, create GitHub issues for these issues and update this RFC
> of the project board with these issue IDs.

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.
