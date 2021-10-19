---
rfc pr: [#335](https://github.com/aws/aws-cdk-rfcs/pull/335)
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/1
---

# CDK Watch and Hotswap

Shorten the development iteration speed -- the "edit-compile-test" loop -- for
CDK applications.

## Working Backwards

### CHANGELOG

- feat(cli): implement `cdk deploy --hotswap` and `cdk deploy --watch`

### Help

```
cdk deploy --help

    -w --watch   Watch for file changes and deploy any updates. Implies
                 --hotswap=auto if --hotswap is not specified.

    --hotswap[=only|auto|no|ask]   Perform a hotswap deployment of the stack.
        (`--hotswap=only` will fail if there are non-hotswap updates). The
        default value is "only".

Examples:
    cdk deploy -w
    cdk deploy --hotswap
    cdk deploy --hotswap=only --watch
```

### README

The `cdk deploy --hotswap` command improves the speed of the
edit-compile-test loop for your CDK application during development by inspecting
the assets and stack resources in your application, identifying those that can
be updated in-place without a full CloudFormation stack update, and doing so
using AWS service APIs directly. It can either do this as an interactive command
or by running continuously and monitoring the input files.

For supported construct types (see list, below) the update command will identify
assets or other stack resources that have changed since the last time the CDK
application was deployed, and update them in-place according to their types.
Assets will be uploaded to their storage medium. The CDK will then use AWS SDK
commands to directly modify the stack resources in-place to synchronize them
with your local code. The hotswap option can act on one or more stacks in
the application.

#### Usage

The simplest use case for CDK hotswap is `cdk deploy --watch`. This mode of
operation will identify the files that can affect the resources being watched,
monitor them for changes, and perform the fastest supported form of deployment
on the stacks that change, as they change.

```
$ cdk deploy --hotswap --watch ApplicationStack DataStack
Checking stack ApplicationStack for possible hotswap update
 * LambdaFunction[Appfunction]: No Changes
ApplicationStack can *not* be updated
Checking stack DataStack for possible hotswap update
 * LambdaFunction[StreamFunction]: No Changes

Watching stack inputs for changes:
 * LambdaFunction[Appfunction]: <spinner>
 * LambdaFunction[StreamFunction]: <spinner>
```

The "watch" functionality can be customized by setting a few new options in your `cdk.json` file:

1. If either your CDK code, or your runtime code
    (like the code of your Lambda functions)
    needs to go through a build step before invoking `cdk deploy`,
    you can specify that command in the new `"build"` key. Example:

    ```json
    {
      "app": "mvn exec:java",
      "build": "mvn package"
    }
    ```

    If the `"build"` key is present in the `cdk.json` file,
    `cdk synth` (which the "watch" process invokes before deployment)
    will execute the specified command before performing synthesis.

2. The "watch" process needs to know which files and directories to observe for changes,
    and which ones to ignore. You can customize these using the `"include"` and `"exclude"`
    sub-keys of the new `"watch"` top-level key.
    Values are glob patterns that are matched _relative to the location of the `cdk.json`_ directory:

    ```json
    {
      "app": "mvn exec:java",
      "build": "mvn package",
      "watch": {
        "include": ["src", "lambda/code/**/*"],
        "exclude": ["cdk.out", "target"]
      }
    }
    ```

    The `cdk init` command fills these out for you,
    so if your project has a standard layout,
    you shouldn't need to modify these from the generated defaults.

In addition to the monitoring mode, it is possible to perform one-shot
hotswap deployments on some or all of the stacks in the CDK application:

```
$ cdk deploy --hotswap ApplicationStack
Checking stack ApplicationStack for possible hotswap update
 * LambdaFunction[AppFunction]: File asset changed
ApplicationStack can be updated
1/1 stacks can be updated:
Updating LambdaFunction in ApplicationStack
...
Update complete!
```

If the update is to an attribute of the stack that cannot be updated, the
command can offer to perform a full deployment if `--hotswap=ask`:

```
$ cdk deploy --hotswap=ask ApplicationStack
Checking stack ApplicationStack for possible hotswap update
 * LambdaFunction[Appfunction]: Function data changed
ApplicationStack has changes that can not be rapidly updated.
Perform a full deployment of ApplicationStack? [Y/n]: Y
Deploying ApplicationStack
...
Done!
```

When multiple stacks are provided, update only occurs if all pending changes are
suitable for update. Otherwise, a full deployment is done:

```
$ cdk deploy --hotswap=auto ApplicationStack DataStack
Checking stack ApplicationStack for possible hotswap update
 * LambdaFunction[Appfunction]: Function data changed
ApplicationStack has changes that can not be rapidly updated.
Checking stack DataStack for possible hotswap update
 * LambdaFunction[StreamFunction]: File asset changed
DataStack can be updated
1/2 stacks can be hotswap, automatically performing a full deployment.
Deploying ApplicationStack
...
Deploying DataStack
...
Done!
```

#### Resource Support

- AWS Lambda `Function`
  - file and directory assets
- StepFunction
  - State Machine definitions
- ECS
  - image assets

#### Future Support Plans

- API Gateway models

## FAQ

### What are we launching today?

The `cdk deploy --watch` and `cdk deploy --hotswap` command features, with
support for rapid update of Lambda function code, images for ECS and Fargate
task definitions, and AWS StepFunction workflows.

### Why should I use this feature?

If you are developing a CDK application and want to publish your code changes
without waiting for CloudFormation to perform a full, safe stack update, you
should use this feature.

### Does it work when my Lambda is in Go or Java?

To an extent, yes, but there are caveats. In order to update the lambda code you
will need to run your build process to create the jar or executable that you are
uploading as lambda code.

### Does this feature work with `aws-lambda-go` for compiled Lambdas?

Yes, if your lambda is defined by an `aws-lambda-go`, `aws-lambda-python`, or
`aws-lambda-nodejs` construct, the hotswap and watch capabilities will work
within those source trees to automatically deploy changes to your code as you
make it.

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

The CDK hotswap option will allow the CDK to handle the resource changes rather
than this manual process, introducing some implicit safety and reducing the
manual labor of the update.

### Why should we _not_ do this?

This solution has a risk of introducing a deployment tool that users might use
to shortcircuit the safe CloudFormation deployment process. If a user runs CDK
update on their production stack, it can perform updates without adequate stack
update safety checks. Releasing a public tool with instant update capability
into the CDK may not be the right way to make this functionality public. To
mitigate this, `--hotswap` only runs on explicitly selected stacks, and does
not support the `--all` flag.

### What changes are required to enable this change?

1. An implementation of the `cdk deploy --hotswap` command in the CDK CLI
   that can examine the Application stacks for updates that can be applied and
   apply them.
2. The CDK CLI must be able to query a CDK resource for the set of filesystem
   resources it must monitor for the `--watch` operation, and run a filesystem
   monitor for that.

### Is this a breaking change?

No, it is not.

### What are the drawbacks of this solution?

- Updating like this still entails a fair amount of preprocesing time, since for
  complex projects (Golang and Java lambdas, for example) there remains a
  compilation step.
- The update model requires the AWS account used to publish the stack to also
  have sufficient permissions to update the underlying resources, rather than
  simply requiring the account to have CloudFormation access.
- Runtimes that require compilation or assembly -- Java lambdas, docker images
  -- do not benefit from the `--watch` support as naturally, and require some
  manual steps.
- updating Lambda functions that are using aliases and provisioned concurrency
  can take several minutes to switch over between the two versions.

### What alternative solutions did you consider?

We considered "SAM Accelerate" for a similar purpose, but SAM covers a relatively
small set of possible application structures in AWS, while CDK is intended to
address the whole set of them.

We also considered introspecting the CDK model ourselves, but concluded that
there was little value in reinventing the wheel, so to speak, when CDK already
had all of the information we'd need to deliver this.

For identifying stacks that are subject to hotswap deployment, we are
considering defining a full "Personal Development Stack" model, possibly based
off of information in the CDK `App` context.

### What is the high level implementation plan?

We will start from the prototype CDK update command that identifies the Lambda
resources and then publishes them using the CDK CLI, and extend that to
implement support for ECR images associated with ECS and Fargate tasks, API
Gateway definitions, and Step Function workflows. Those will be implemented
directly in the CLI code as part of the launch for the feature. The CLI
implementation will be designed to conform to an interface that provides:

- Watchable filesystem resources
- A way of updating the watchable resource list
- A method for determining whether the construct can be updated in place
- A method for updating the construct in place

If changes to the CDK constructs are necessary to implement the hotswap
development process, we will make those changes as well. In the longer term we
must lay the groundwork for moving the logic defining the update process into
the Construct library, which implies a design for passing these values by way of
the Cloud Assembly.

We will implement a filesystem watcher for the CDK CLI that works on one or more
directory trees, watching for changes. It will base its watch list on the set of
files indicated by the CLI, and update them when those responses change.

Additionally, a `--watch` flag and a file watcher will be added to support
monitoring the inputs of stack resources for changes.

### Are there any open issues that need to be addressed later?

- This RFC can be extended to add support for further pluggable asset and update
  targets. The hotswap capabilities are attached to the CDK constructs, not
  the CDK CLI, so any CDK construct that can perform hotswap deployment can
  implement that capability in whatever manner is appropriate.
- This RFC will be enhanced significantly when the CDK asset model is enriched
  to support asset construction directly.
- Direct support for monitoring container repositories for changes (possibly via
  polling) instead of only supporting local rebuild.

# How do we keep production from being affected by CDK hotswap?

CDK hotswap uses the AWS IAM access controls already in place in your account
to maintain the safety of your production deployments. The interface to CDK
hotswap requires the developer to specify the stacks that they will be
deploying explicitly, so by default it is affecting only the developer's stacks,
and when a production stack is defined it is up to the AWS account administrator
to ensure that the interactive developer's roles do not have modification access
to the hotswap resources.
