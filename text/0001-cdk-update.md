---
rfc pr: [#335](https://github.com/aws/aws-cdk-rfcs/pull/335)
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/1
---

# Faster personal CDK deployments

Shorten the development iteration speed -- the "edit-compile-test" loop -- for
CDK applications.

## Working Backwards

### CHANGELOG

- feat(cli): implement `cdk update` and `cdk update --watch` for asset updates

### README

The `cdk update` command accelerates the edit-compile-test loop for your CDK
application during development by inspecting the assets and stack resources in
your application, identifying those that can be updated in-place without a full
CloudFormation stack udpate, and doing so using AWS service APIs directly. It
can either do this as an interactive command or by running continuously and
monitoring the input files.

For supported construct types (see list, below) the update command will identify
assets whose content has changed since the last time the CDK application was
deployed, and then publish them to their asset storage medium. It will then use
AWS SDK commands to directly modify the CDK resources to use the new asset
paths. The update command acts on one or more stacks in the application, and
will only perform the shortcut if all changes are updateable.

A stack is "updateable" if the stack is explicitly marked as updateable, and it
contains resources supported by the update process. At this time, only Lambda
Functions and ECS Services are supported, however more resource types will be
added to this list in the future.

At a high level, `update` operates by reading the current state of the stack,
performing a stack diff on it, and if the stack is different only in resources
supported by update plugins, running those in lieu of a full deployment.

#### Preparing Your Stack

In order to ensure that update is not invoked against production stacks, you
must explicitly designate your stack as being updateable in your application.
This is a stack-level property, set in the `StackProps` parameter to the stack
constructor:

```typescript
const myDevelopmentStack = new ApplicationStack(app, "StackNameForDev", {
    ...
    interactiveUpdate: true,
});
```

The `interactiveUpdate` property is optional, and when present and `true` the
`cdk update` functionality will be executed on the stack.

#### Running Update

To run a one-shot update, you can invoke the `cdk update` command on some or all
of your stacks:

```
$ cdk update ApplicationStack
Checking stack ApplicationStack for possible asset update
 * LambdaFunction[AppFunction]: File asset changed
ApplicationStack can be updated
1/1 stacks can be updated:
Updating LambdaFunction in ApplicationStack
...
Update complete!
```

If the update is to an attribute of the stack that cannot be updated, the
command will offer to perform a full deployment:

```
$ cdk update ApplicationStack
Checking stack ApplicationStack for possible asset update
 * LambdaFunction[Appfunction]: Function data changed
ApplicationStack can *not* be rapidly updated.
Perform a full deployment of ApplicationStack? [Y/n]: Y
Deploying ApplicationStack
...
Done!
```

When multiple stacks are provided, update only occurs if all pending changes are
suitable for update. Otherwise, a full deployment is done:

```
$ cdk update ApplicationStack DataStack
Checking stack ApplicationStack for possible asset update
 * LambdaFunction[Appfunction]: Function data changed
ApplicationStack does not support update.
Checking stack DataStack for possible asset update
 * LambdaFunction[StreamFunction]: File asset changed
DataStack can be updated
1/2 stacks can be updated: Perform a full deployment? [Y/n]? Y
Deploying ApplicationStack
...
Deploying DataStack
...
Done!
```

In addition to running in a one shot mode, the `cdk update` command also has a
`--watch` command line option that enable it to monitor the assets on disk and
perform an update when they change.

```
$ cdk update --watch ApplicationStack DataStack
Checking stack ApplicationStack for possible asset update
 * LambdaFunction[Appfunction]: No Changes
ApplicationStack can *not* be updated
Checking stack DataStack for possible asset update
 * LambdaFunction[StreamFunction]: No Changes

Watching stack inputs for changes:
 * LambdaFunction[Appfunction]: <spinner>
 * LambdaFunction[StreamFunction]: <spinner>

```

The watcher can only watch for file changes. For Lambda code, that means that
directories will be watched for changes and zipped if they change. If the file
asset is a zip file, then the update will fire whenever that changes. The
existing docker asset builder will be used to watch for changes in local docker
images.

#### Resource Support

- AWS Lambda `Function`
  - file and directory assets
- AWS Fargate
  - image assets
- ECS
  - image assets

#### Future Support Plans

- StepFunctions
- API Gateway models

### PRESS RELEASE

DATE - AWS announces the `cdk update` command for the AWS CDK toolkit. The
`update` command allows CDK application developers to rapidly update code within
their CDK application when no other AWS resources are changing, bypassing the
more correct, but time consuming, stack update procedure.

The CDK toolkit uses CloudFormation under the hood to manage changes to AWS
resources, which safely updates resources. This update process is slow, however,
and during development it performs safety checks that add overhead to developer
workflows. Those delays are interposed between every change a developer makes,
and over the course of a product may add hours to the total development time.

The `cdk update` command provides a way to bypass those checks when working in
development, directly updating the code in Lambda functions and ECS services
without a full CDK deployment. When the `update` command can identify that all
changes in the stack have shortcut support, it will directly publish the assets
to AWS and then modify the underlying CDK resources directly.

> Using cdk update dramatically improves our development iteration speed for
> Lambda functions. It cuts down the change-deploy-test cycle to seconds, where
> it was minutes before with a full cdk deploy each time. Unlike some other
> solutions, it actually updates our function running on AWS, which means there
> are no problems with the Lambda behaving differently during testing, and then
> in production - Adam Ruka, developer

Any CDK users who are deploying code to Lambda functions or containers on ECS or
Fargate can take advantage of this tool today, by configuring their stacks for
interactive update, and then using `cdk update` instead of `cdk deploy`.

## FAQ

### What are we launching today?

The `cdk update` and `cdk update --watch` commands, with support for rapid
update of Lambda function code and Fargate images.

### Why should I use this feature?

If you are developing a CDK application and want to publish your code changes
without waiting for CloudFormation to perform a full, safe stack update, you
should use this feature.

### Does it work when my Lambda is in Go or Java?

To an extent, yes, but there are caveats. In order to update the lambda code you
will need to run your build process to create the jar or executable that you are
uploading as lambda code.

### What about "other resource type"?

Based on customer response, we will consider expanding the set of AWS resources
and asset types implemented in the CDK directly. The plugin mechanism for
resource refreshing will allow other resource types to be supported by either
community or vendor addition.

## Internal FAQ

### Why are we doing this?

The overhead of developing a Lambda application using the CDK is significant,
since each code change currently requires a CloudFormation stack update to apply
new code, _or_ manually introducing drift to the application by inspecting the
stack and manipulating the resources directly.

The CDK update tool will allow the CDK to handle the resource changes rather
than this manual process, introducing some implicit safety and reducing the
manual labor of the update.

### Why should we _not_ do this?

This solution has a risk of introducing a deployment tool that users might use
to shortcircuit the safe CloudFormation deployment process. If a user runs CDK
update on their production stack, it can perform updates without adequate stack
update safety checks. Releasing a public tool with instant update capability
into the CDK may not be the right way to make this functionality public. To
mitigate this, `update` only runs on stacks that have explicitly opted in to the
capability.

### What changes are required to enable this change?

This RFC requires three changes:

1. An implementation of the `cdk update` command in the CDK toolkit that can
   examine the Application stacks for updates that can be applied and apply
   them.
2. Adding the `interactiveUpdate` flag to the `StackProps` object, allowing a
   stack to be configured for interactive update. This property will default to
   `false`

   **note:** I chose in-stack markup instead of a `cdk.json` flag so that if
   there is an L3 construct for a personal development stack (or a library that
   creates them) then the attribute can be set there instead.

3. An expansion of the CDK asset model to include optional construction process
   metadata and construction input metadata. This is required to allow CDK to
   identify input changes to the asset, reconstruct it from the defined
   processes, and then publish it to the necessary AWS service.

### Is this a breaking change?

No, it is not.

### What are the drawbacks of this solution?

- Updating like this still entails a fair amount of preprocesing time, since for
  complex projects (Golang and Java lambdas, for example) there remains a
  compilation step.
- The update model requires the AWS account used to publish the stack to also
  have sufficient permissions to update the underlying resources, rather than
  simply requiring the account to have CloudFormation access.
- Runtimes that require compilation or assembly -- Go or Java lambdas, docker
  images -- do not benefit from the `--watch` support as naturally, and require
  some manual steps.
- updating Lambda functions that are using aliases and provisioned concurrency
  can take several minutes to switch over between the two versions.

### What alternative solutions did you consider?

We considered SAM accelerate for a similar purpose, but SAM covers a relatively
small set of possible application structures in AWS, while CDK is intended to
address the whole set of them.

We also considered introspecting the CDK model ourselves, but concluded that
there was little value in reinventing the wheel, so to speak, when CDK already
had all of the information we'd need to deliver this.

### What is the high level implementation plan?

We will start from the prototype CDK update command that identifies the Lambda
resources and then publishes them using the CDK toolkit. We will expand it to
generalize it to use a simple plugin model to define the update mechanism, which
will allow for ECS support in addition to Lambda support.

Additionally, a `--watch` flag and a file watcher will be added to support
monitoring the inputs of assets for changes.

### Are there any open issues that need to be addressed later?

- This RFC requires changes that may affect
  [rfc-0092 - cdk assets](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0092-asset-publishing.md),
  as it entails changes to the asset model to support asset transformation and
  sources.
- This RFC can be extended to add support for further pluggable asset and update
  targets.
- This RFC will be enhanced significantly when the CDK asset model is enriched
  to support asset construction directly.
- Direct support for monitoring container repositories for changes (possibly via
  polling) instead of only supporting local rebuild.
