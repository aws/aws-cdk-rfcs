---
feature name: configuration-policy
start date: 2020-05-21
rfc pr: (leave this empty)
related issue: https://github.com/aws/aws-cdk-rfcs/issues/25
---

# Summary

Configuration defaults and policies allow teams, organizations, and companies
to define and enforce standard behaviors in the CDK by creating a base stack
that enforces these behaviors.

# README

_This is an experiment to start RFCs with a 'working backwards' approach by
writing the README section first._

## Stack configuration defaults and policies

Teams and organizations may want to define default behaviors or enforce standard
configurations. Examples of these default behaviors include: enabling
server-side encryption for S3 buckets, having a dead-letter queue for every SQS
queue, or always enforcing a password reset on first login for IAM users.

Configuration defaults can be created by extending the `Stack` class and
overridding the `onConstructCreation` method. `onConstructCreation` is called
for every `Construct` added to the `Stack`, and receives the same properties
used to create the `Construct`. These properties can be altered or validated to
enforce default behaviors.

The following demonstrates a Stack that enforces encryption for S3 buckets by
default.

```ts
// Base-line Stack to act as a subclass for all other Stacks.
export class FooBarCompanyStack extends Stack {
  public onConstructCreation(className: string, id: string, props: any): any {
    if (className == 'aws-s3.Bucket') {
      const bucketProps = <BucketProps>props;
      if (bucketProps.encryption === undefined || bucketProps.encryption === BucketEncryption.UNENCRYPTED) {
        return {
          encryption: BucketEncryption.S3_MANAGED,
          ...props,
        };
      }
    }
    return props;
  }
}
// App-specific Stack which receives the defaults.
export class MyAppStack extends FooBarCompanyStack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        new Bucket(this, 'myBucket'); // Will automatically get S3-managed encryption.
  }
}
```

In addition to modifying the properties of the `Construct` being created, the
`onConstructCreation` hook can be used to create entirely new resources. This
example enforces a convention of each SQS Queue having its own dead-letter
queue.

```ts
export class FooBarCompanyStack extends Stack {
  public onConstructCreation(className: string, id: string, props: any): any {
    if (className === 'aws-sqs.Queue') {
      const queueProps = <QueueProps>props;
      if (!id.includes("DLQ") && queueProps.deadLetterQueue === undefined) {
        const dlq = new Queue(this, id + "DLQ");
        return {
          deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
          ...props,
        };
      }
    }
    return props;
  }
}
```

# Motivation

Teams, organizations, and companies may have need to enforce or apply default
best practices to CDK-managed infrastructure. This approach will provide a
consistent mechanism to apply these practices, while keeping the actual
business-logic-containing Stacks lightweight.

See the discussion in <https://github.com/aws/aws-cdk/issues/3235> for more
context.

# Basic Example

_See README section._

# Design Summary

The approach adds a new hook (`onConstructCreation`) to the `Stack` class,
which will be called by every L2 on construction. This hook receives the same
inputs as the Construct's constructor, and enables users to adjust or override
any of the input props, as well as throw errors or create ancillary resources.

# Detailed Design

A method is added to the `Stack` class with the following signature and default
implementation:

```ts
public onConstructCreation(className: string, id: string, props: any): any {
  return props;
}
```

The `className` parameter will take the form of `module:class` (e.g.,
`aws-s3.Bucket` or `aws-sqs.Queue`). The `id` and `props` parameters will be
identical to the same parameters passed into the `Construct` on creation.

All L2s will need to call this hook as part of their object construction. The
call should be made immediately after the call to `super`, prior to property
validation or Cfn* resource construction, as the modified properties may alter
the outcome of these calls.

Having the hook return the (unaltered or modified) properties is necessary
because many of the FooProps interfaces contain readonly variables
(e.g., `BucketProps.encryption`).

This approach allows for injecting or enforcing default configuration, even in
the cases of nested Constructs. For example, when creating a
DnsValidatedCertificate, the properties of the underlying Lambda Function can
be altered. However, no special consideration -- for example, an extra
parameter -- is made to explicitly identify these Constructs as being nested.

# Drawbacks

The largest drawback to this change is the scope of the change -- every L2 will
need to be extended to call the new hook as part of its initialization. Closely
related to this, the pattern chosen does not lend itself well to the current
static enforcement tools available (e.g., `awslint`) to ensure consistent
behavior across the L2s. A possible mitigation might be to invest in a runtime
linting capability across the CDK; however, this will expand the scope of the
implementation considerably.

Given the consistency in the change -- always the same one-liner after
construction -- it's possible that a simple test can be created to enforce
that there is one call to the hook per active Construct, simply be examining
the source. This isn't particularly robust. See Unresolved Questions for more.

# Rationale and Alternatives

Providing this hook is a unique opportunity that provides a way to alter and
enforce configuration in a way only possible by altering the CDK itself. Other
similar options for enforcing standard configuration involve factory creation
methods, sub-classing specific constructs, or hooking into the `onPrepare()`
(or other existing Construct hooks). Each comes with its own downsides.

Factory methods to create common standard Constructs are one alternate
solution; this works well enough for top-level Constructs, but falls flat in
scenarios with "nested" Constructs, or any other scenario where the application
logic developer isn't directly instantiating the resource. Similar downsides
exist for end-users subclassing Constructs and initializing them directly.

There are an existing set of hooks for Constructs (e.g., `onPrepare()`) that
could be used to alter or augment Constructs on creation. However, these hooks
only receive the initialized Construct without further metadata or properties,
after baseline Cfn resources have been created and other constructor-time logic
has been executed. This severely limits the ease and range of configurations
that can be altered this way.

# Adoption Strategy

This is a backwards-compatible change. Existing CDK developers can begin
instrumenting default configuration by extending the hook method
(`onConstructCreation`) in their stacks.

# Unresolved questions

1. This RFC doesn't suggest an explicit way to enforce that all L2s have
adopted the pattern and can be altered via the new hook. Suggestions on how
best to achieve this -- or mitigations in the meantime -- are appreciated.
    * One incredibly hacky solution would be to confirm the CDK source contains
      one (and only one) call to the hook per unique className. This would be
      relatively easy to set up, but fragile.
    * Another option would be some mechanism to enforce that each Construct has
      a unit test which instantiates the object and verifies the hook is
      called.
    * Lastly, extending/enhancing the `awslint` tool to be able to perform
      runtime analysis would be super-neato.
1. Naming is hard. Any better suggestions for the hook name than the proposal?

# Future Possibilities

Along the lines of the existing CDK examples, I can see vending examples of
well-configured base stacks which demonstrate good best-practices. A set of
opinionated, best-practice stacks for a variety of use cases would -- I think
-- be helpful for the community and serve as a catalyst for best practices
being used across AWS.
