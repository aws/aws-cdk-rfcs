# Weak cross-stack references

* **Original Author(s):**: @rix0rrr
* **Tracking Issue**: #309
* **API Bar Raiser**: @otaviomacedo

A mechanism to make sure that CDK doesn't prevent resource replacement if there is no impact on downstream stacks.

## Motivation

One of the most magical (and hated) features of the CDK is to transparently transport values from one CloudFormation stack to the other. It makes it possible to pass constructs from one stack and pass them into another, and use the construct as if it was defined locally. CDK will detect that a value originating from one stack is used in a different one, and insert the right CloudFormation incantations to make sure the value is properly referenced.

However, CDK has chosen a mechanism to do this (called **CloudFormation Exports**) which have a specific side effect: *values which are currently being consumed by a different Stack are not allowed to be changed or removed*. This RFC introduces "weak cross-stack references", a way to make certain cross-stack references selectively get moved via SSM Parameters instead of by CloudFormation Exports.

We introduce a mechanism for turning strong references into weak references, and turn this on by default for CloudWatch Dashboards.

## README

### Cross-stack references

When CDK detects that you are using resources define in one Stack in another Stack, it will automatically add a dependency between the two stacks, and generate the declarations necessary in both stacks to make sure the value gets transported between them (this feature only works for Stacks in the same account and region--if stacks are in either a different account or different region, the reference will lead to a synthesis error).

By default all references are **strong references**, which introduce some limitations on the resources being referenced:

- The resource that is being referenced cannot be deleted.
- The resource that is being referenced cannot have its location in the construct tree change.
- The resource that is being referenced cannot have any properties changed on it that requires *replacement* of the resource.
- The cross-stack reference itself cannot be deleted if it is the last cross-stack reference that points to the resource and you are deploying via a Pipeline mechanism like CDK Pipelines (if you are using the CLI to deploy, you can delete the reference and choose to `cdk deploy -e` the consuming stack first before `cdk deploy`ing the producer stack).

If you run into any of these limitations, you have to do a two-phase deployment:

- In the first deployment, call [stack.exportValue](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Stack.html#exportwbrvalueexportedvalue-options) on the referenced value in the producing stack, while removing the reference from the consuming stack.
- In the second deployment, you can remove or replace the resource.

### Weak cross-stack references

If you want to avoid having to do a two-phase deployment when deleting or replacing certain resources, and you are confident that the consumer will not suffer negative impact if the resource is removed, you can force the reference to be a **weak reference**. Be sure that your consuming stack will continue to function properly though: for example, if you originally created an IAM Role in one stack and pass it to a Lambda Function in a different stack, and you make a change that cause the IAM Role to be replaced, there will be a period of time in between the deployments of the producer and consumer stacks in which the Lambda executions will fail.

A common use case in which weak references are useful is **monitoring dashboards**: many people like setting up their dashboards in a separate stack and having it reference resources in other stacks in the same application; construct libraries like `cdk-watchful` make it very easy to fill a dashboard with graphs for various resources in the application. This requires transporting resource names (for example, a dashboard metric widget will contain `{ "Dimensions: { "FunctionName": { "Fn::ImportValue": "OtherStack-SomeLambda12345" } } }`)... but because of the behavior of strong references this effectively locks the `SomeLambda` construct into existence. It cannot be removed or replaced, because the dashboard reference would not be valid anymore. In cases like this, the friction is not worth the value it adds: there will be no negative downstream impact if the metrics stream the dashboard is observing stops emitting metrics, and most likely if the resource were to be removed, the corresponding graph would just be removed in the same deployment.

To turn a strong reference into a weak reference, call `Reference.weakStringReference(...)` (or `weakListReference`, or `weakNumberReference`). For example, the following references a bucket name weakly:

```ts
const bucket = new s3.Bucket(this, 'MyBucket');

// ...

const fn = new lambda.Function(this, 'MyFunction', {
  // ...

  environment: {
    BUCKET_NAME: Reference.weakStringReference(bucket.bucketName),
  },
});
```

`Reference.weakStringReference()` only has an effect if the reference is to a construct defined in a different stack: it will use SSM Parameter Store to transport the value between stacks. If the reference is to a construct in the same stack, nothing happens (do be aware that in the example above, if `Bucket` gets renamed, there is a certain time window in which the Lambda Function may continue to be executed with the old bucket name!).

If the value passed to `Reference.weakStringReference()` contains multiple references (either because it's a string with multiple references or it's an array or complex data structure), all of them are made weak.

### Switching from strong to weak references

If you have previously deployed stacks with strong cross-stack references and want to switch them to weak references, you must do this in a two-phase deployment.

First, pass `strongToWeak: true` for the reference you are converting from strong to weak. This will generate both the strong and weak exports in the producing stack, while only consuming the weak reference in the consuming stack:

```ts
// First deployment, generate both exports
Reference.weakStringReference(bucket.bucketName, {
  strongToWeak: true,
})
```

After you have deployed your stack with `strongToWeak` enabled, you can remove the flag again and do another deployment:

```ts
// Second deployment, stop generating strong export
Reference.weakStringReference(bucket.bucketName)
```

### Defaults for stacks

You can choose to configure the default reference style for an entire stack passing the `defaultReferenceStyle` property to a stack constructor:

```ts
new MyStack(this, 'MyStack', {
  defaultReferenceStyle: ReferenceStyle.STRONG,
  // or
  // defaultReferenceStyle: ReferenceStyle.WEAK,
  // defaultReferenceStyle: ReferenceStyle.STRONG_TO_WEAK,
});
```

It is recommended to select reference style on a reference-by-reference basis, and not use this method, but you can if you want to.

### Defaults for dashboards

Strong references cause a lot of usability problems for CloudWatch Dashboards. That's why starting in new applications, all CloudWatch Dashboards will use weak references by default.

This is controlled by the feature flag `@aws-cdk/aws-cloudwatch:dashboardWeakReferences`. It can take on the values `true` (for weak references) or `"strongToWeak"`, for the first phase of the two-phase deployment.

```json
{
  "context": {
    "@aws-cdk/aws-cloudwatch:dashboardWeakReferences": true | "strongToWeak"
  }
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

This is an addition to the core CDK library, adding more flexibility to configuration of the reference style.

### Why should I use this feature?

You can use this feature if the standard reference style is causing you too many problems.

## Internal FAQ

### Why are we doing this?

It comes up frequently that users are stuck trying to remove or refactor a resource, only to find out that they can't because the resource is referenced in another stack. This takes a lot of work to disentangle. This problem is so common that it has been named the "deadly embrace" problem (mostly occurs in Pipelines, where users are unable to play with the deployment order of stacks).

A better mechanism to set up references, combined with sensible defaults for resources that are not impacted by such changes like
Dashboards, should make this problem less frequent.

### Why should we _not_ do this?

It might not be worth the additional complexity in the token and reference system (which is already pretty complex).

### What is the technical solution (design) of this feature?

Transporting the value from one stack to another: we will generate SSM Parameter Store values in the producing stack, and consume them (as `Parameters`) in the consuming stack.

To configure the individual references to be either strong or weak, we:

- add a `referenceStyle` field to `IResolveContext`
- `stack.resolve()` will set the initial `referenceStyle` to the stack configuration
- make `weakStringReference` return a new `IResolvable` that in its `resolve()` method will resolve the inner value with `referenceStyle` set to the appropriate reference style
- references will check the `referenceStyle` of the context and call a new method on `Stack` to create the SSM parameter export and import

### What alternative solutions did you consider?

There are two possible alternatives:

- Explicit exporting
- Transporting values happens outside CloudFormation

### Explicit exporting

We could punt this concern to users more explicitly. Every (owned) construct should have a method `export()` that works like this:

```ts

const producer = new ProducerStack(this, 'Producer');

new ConsumerStack(this, 'Consumer', {
  bucket: producer.bucket.export(),
});
```

The `export` method for a `Bucket` should look like this:

```ts
class Bucket {
  public export(options?: ExportOptions): IBucket;
}
```

And use either `Exports` or SSM parameters to reference itself.

The explicitness puts users in full control, able to generate exports in either or both styles, even without a consumer.

#### Transport values outside CloudFormation

Instead of transporting values between stacks using `Exports`/`{ Fn::ImportValue }`, we use plain `Outputs` and `Parameters`, and have the CLI (or the pipeline) wire the output of one stack into the parameter of another.

This has the advantage of also supporting transporting values between accounts and regions, but a disadvantage that not all deployment systems may support this feature (in particular, the CI/CD system used internally at Amazon does not allow picking up stack outputs and wiring them into the inputs of future deployments).

### What are the drawbacks of this solution?

The solution might be overly complex, requiring learning yet another concept and another public API, and adding complexity to the references/tokens implementation in CDK.
