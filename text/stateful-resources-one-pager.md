# 1Pager | Modeling Stateful Resources

This document is a one pager meant to surface the idea of explicitly modeling stateful resources in the core framework. Its goal is to conduct a preliminary discussion and gather feedback before it potentially progresses into a full blown RFC.

## Customer pain

Customers are currently exposed to un intentional data loss when stateful resources are designated for either removal or replacement by CloudFormation.

Data, similarly to security postures, is an area in which even a single rare mistake can cause catastrophic outages. The CDK can and should help reduce the risk of such failures.
With respect to security, the CDK currently defaults to blocking deployments that contain changes in security postures, requiring a user confirmation:

```console
(NOTE: There may be security-related changes not in this list. See https://github.com/aws/aws-cdk/issues/1299)

Do you wish to deploy these changes (y/n)?
```

However, no such mechanism exists for changes that might result in data loss, i.e removal or replacement of stateful resources, such as `S3` buckets, `DynamoDB` tables, etc...

## Failure scenarios

To understand how susceptible customers are to this, we outline a few scenarios where such data loss can occur.

### Stateful resource without `DeletionPolicy/UpdateReplacePolicy`

By default, CloudFormation will **delete** resources that are removed from the stack, or when a property that requires replacement is changed.

> - [UpdateReplacePolicy](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatereplacepolicy.html)
> - [DeletionPolicy](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-deletionpolicy.html)

To retain stateful resources, authors must remember to configure those policies with the `Retain` value. Having to remember this makes it also easy to forget. This means that stateful resources might be shipped with the incorrect policy.

### Policy Change

CDK applications are often comprised out of many third-party resources. Even if a third-party resource is initially shipped with the correct policy, this may change. Whether or not the policy change was intentional is somewhat irrelevant, it can still be undesired and have dire implications on the consuming application.

For that matter, even policy changes made by the application author itself can be unexpected or undesired.

## Proposal

The proposal described here was designed under the following assumptions:

1. The correct policy for stateful resources is always `Retain`.
2. Its better

## Q & A

#### Isn't remembering to extend `StatefulResource` the same as remembering to configure `DeletionPolicy/UpdateReplacePolicy`?

#### What about CDK Pipelines?

#### Would this have prevented https://github.com/aws/aws-cdk/issues/16603 ?

#### 

