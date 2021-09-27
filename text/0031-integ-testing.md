# Integration testing for CDK apps

* **Original Author(s):**: [@nija-at](https://github.com/nija-at)
* **Tracking Issue**: [#31](https://github.com/aws/aws-cdk-rfcs/issues/31)
* **API Bar Raiser**: @{BAR_RAISER_USER}

CDK app developers and construct library authors can write integration
tests that can be run locally or in their CI/CD pipeline.

## Working Backwards - README.md

### `@aws-cdk/apptest`

🌩️ apptest can verify that your CDK app can be deployed successfully on AWS with the desired resources.

🤖 apptest can verify that your CDK app functions as expected, such as assertions against a public API endpoint.

💨 apptest can be used to run smoke test against your production stack, and trigger a rollback when they fail.

🧑‍💻 Write tests in any CDK supported language, and execute them as part of your CI pipeline.

📸 Capture snapshots of your CDK apps to track how they are impacted by changes.

### Writing Tests

Tests that use apptest can be written in the same programming language as your CDK project.

Let's start with the below CDK construct that creates an artifact repository in an S3 bucket,
and notifies of new artifacts to an SQS queue.

```ts
// repo.ts
import { Construct } from 'constructs';
import { Bucket, EventType, IBucket } from '@aws-cdk/aws-s3';
import { IQueue, Queue } from '@aws-cdk/aws-sqs';
import { SqsDestination } from '@aws-cdk/aws-s3-notifications';

export class ArtifactRepo extends Construct {
  public readonly artifacts: IBucket;
  public readonly publishNotifs: IQueue;
  
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.artifacts = new Bucket(this, 'Artifacts');
    this.publishNotifs = new Queue(this, 'PublishNotifs');

    this.artifacts.addEventNotification(EventType.OBJECT_CREATED_PUT,
      new SqsDestination(this.publishNotifs))
  }
}
```

The following integ test invokes puts an object in the S3 bucket and verifies the message in the SQS queue.

```ts
// repo.apptest.ts
import { ArtifactRepo } from './records';
import { AwsAssertionCall, AwsAssertion, Test } from '@aws-cdk/apptest';

const repo = new ArtifactRepo(app, 'RequestRecord');

const repoTest = Test.forConstruct(repo);

new AwsAssertion(repoTest, 'RepoPutObject', {
  request: AwsAssertionCall.S3.putObject({ bucket: stack.artifacts, key: '...', body: '...' })
});

new AwsAssertion(repoTest, 'MessageReceived', {
  request: AwsAssertionCall.Sqs.receiveMessage({ queue: stack.publishNotifs }),
  returns: { Messages: [...] }
});

const testResult = repoTest.run();
if (testResult.failures > 0) {
  // test runner should fail the test
}
```

### Assertions

`apptest` comes canned with a set of commonly used high level assertions.

* `AwsAssertion`: execute AWS service APIs and assert the response.
* `InvokeLambda`: invoke an AWS Lambda Function and assert its response.
* `HttpRequest`: Execute an HTTP request against an API endpoint and assert the response.
  Used typically to test API Gateway resources.

By default, these assertions will check that the underlying call succeeds. That behavior can be extended
to also include verification of the response.

```ts
new AwsAssertion(test, 'GetObject', {
  request: AwsAssertionCall.S3.getObject({ ... }),
  returns: { Data: ... },
});

new InvokeLambda(test, 'Invoke', {
  lambda: functionArn,
  throws: ...
});
```

When canned assertions are insufficient, `apptest` also provides a mechanism to write custom assertions.
Custom assertions are simply AWS Lambda Functions, and in the CDK, these are any construct that implements `IFunction`.

```ts
import { Code, Function, Runtime } from '@aws-cdk/aws-lambda';

// Checks that a standard header is present in the given S3 object
class StdHeaderAssertion extends Function {
  constructor(scope: Construct, id: string, props: StdHeaderAssertionProps) {
    super(scope, id, {
      code: Code.fromAsset('./standard-header-assertion.js'),
      runtime: Runtime.NODEJS_12_X,
      env: {
        BUCKET_NAME: props.bucket.bucketName,
        KEY: props.bucket.key
      },
    });
  }
}
```

The assertion passes or fails based on the success or failure of the Lambda's handler code.
In both cases, it can also return an optional message, that will be made available in the test result.

To invoke this assertion, you can simply use the `invokeLambda()` API -

```ts
const hdrAssertion = new StdHeaderAssertion(...);
test.invokeLambda(hdrAssertion);
```

> RFC Note: See [Appendix A](#appendix-a---assertions) for details on the underlying design.

### Test snapshots

On first run of a apptest test, a snapshot will be produced that *must be checked into source tree*.
This is a snapshot of the [cloud assembly] containing both the CDK app (being tested) and the test
assertions. The snapshot will be placed at a folder relative to the test file.

```
test
├── repo.apptest.ts
└── repo.apptest.snap
    ├── manifest.json
    ├── RepoStack.template.json
    ├── ...
    └── ...
```

On subsequent runs of this test, if the synthesized cloud assembly matches the
snapshot, apptest will skip deployment and will not run any assertions. The test will be considered
to have passed. This behaviour can be overridden either by setting the `ignoreSnapshot` option for
individual tests or by setting the `CDK_APPTEST_IGNORE_SNAPSHOT` environment variable and will apply
to all tests executed in that environment.

However, when the synthesized cloud assembly does not match the snapshot, the test will be executed
in full and the snapshot will be updated. As before, the changes to the snapshots must be checked into
the source tree.

[cloud assembly]: https://docs.aws.amazon.com/cdk/api/latest/docs/cloud-assembly-schema-readme.html#cloud-assembly

### Test Execution & Report

The `apptest` suite can be executed via any standard test runner available in the programming
language of your choice - jest for javascript or typescript, junit for Java, pytest for Python, etc.

As shown in the above section, it is recommended to use the `apptest` suffix to your test files
to differentiate them from unit and other kinds of tests - `xxx.apptest.ts` in a typescript
project, `xxx.apptest.java` for Java project, etc.

This setup will enable defining a separate script that runs the apptest suite - npm script,
Ant target, Maven phase, etc. - by using `*.apptest.*` as the file filter in your test runner.

The test will be executed when the `run()` method is called on the `apptest.Test` class.
This method will return a list of assertion failures (if any), that can then be used to notify
the test runner of a test case failure.

Test reports can be easily generated from the reporting mechanisms already available via these
test runners.

> RFC Note: See [Appendix B](#appendix-b---test-execution) for details on this design.

### Testing AWS CDK Apps and construct libraries

The industry standard practice is that app developers typically run pre-production instances
of their applications or services as part of their deployment pipeline where integration tests
are executed. This is no different for AWS CDK applications.

In such cases, the apptest suite should define *ONLY* the tests and point them at the existing
pre-production app instance, such as via a well-known endpoint or CloudFormation stack outputs.
The apptest suite, in this case, will deploy (and towards the end destroy) a "testing" stack
where the tests would be executed.

The usage of `apptest` when testing construct libraries is different from that when it is used
for apps.

The `apptest` suite for construct libraries can be used to verify the functionality of the construct
library when it is used with various valid configurations.
Each `apptest` case would define a new AWS CDK `Stack` or `App` that includes the construct
library, followed by assertions. Upon execution, both the app and the assertions will be deployed
(and finally destroyed) as part of the test execution.

## Working Backwards - README.md

### `cdk-deploy`

This jsii module provides the ability to programmatically deploy and destroy AWS CDK apps.

A CDK app can be deployed by calling -

```ts
import { App } from 'cdk-deploy';

const app = new App('/path/to/cdk/app');
app.deploy();
...
app.destroy();
```

The path provided here can be a path to a project that contains a `cdk.json` file or a path
to a CDK app [cloud assembly].

The `deploy()` and `destroy()` APIs will block further program execution until the deployment
or destruction complete. If the action fails, the API will throw an error.
Asynchronous support for `deploy()` and `destroy()` are not available yet.

By default, the APIs print their output and progress to stdout. This can be configured
using options on the APIs.

```ts
app.deploy({
  stdout: false,
  outfile: '/path/to/file' // path to file where the progress should be printed
});
```

### Credentials

This module uses the AWS SDK for Javascript under the hood to communicate with CloudFormation.
We support most of the common ways in which [this SDK allows setting
credentials](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).

Credentials are loaded from the following and in the given order of precedence,

1. [Environment variables](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-environment.html)
1. [Shared credentials file](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-shared.html)
1. Execution platform credentials provider, such as,
   [IAM roles for Amazon EC2](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-iam.html),
   [IAM roles for AWS Lambda](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-lambda.html),
   or Amazon ECS credentials provider.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launch a new AWS CDK module, named `apptest`, that enables customers to write integration
tests as part of their CDK app, and execute them on their developer machines or on a CI server
as part of their continuous deployment.

These integration tests can be used to verify that their CDK app or construct library deploys
successfully on AWS CloudFormation. Users can add additional assertions to verify the behaviour
of their app, such as, invoking an API endpoint or sending a request to a load balancer.

### Why should I use this feature?

This feature is beneficial to users who own a CDK app and want to run assertions on the deployed
app in their pre-production stages as part of a CI/CD pipeline.

It is also beneficial to construct library owners who want to test the consumption of their
construct library when it is deployed as part of an app.

### Why are all my apptest snapshots sometimes invalidated when I upgrade to a newer CDK version?

This usually happens when your CDK app depends on an asset that is bundled as part of the AWS CDK.
Learn more about [assets].

Assets bundled as part of the CDK can change when there is a bug fix or a new feature added to the
asset. When an asset changes, its fingerprint (hash) stored in the CloudFormation template also changes.

With such changes, it is best to re-run all your tests in full (as is the default by `cdk apptest`)
to ensure that all of the new changes do not have any unintended impact to your application.

Rarely, the AWS CDK will change the synthesized template in backwards compatible ways, such as,
changing the order of properties, or setting a property to its default. 
As stated previously, it is still safer to run all tests with invalidated snapshots.

[assets]: https://docs.aws.amazon.com/cdk/latest/guide/assets.html

## Internal FAQ

### Why are we doing this?

Customers have been using the AWS CDK to define and deploy their cloud applications
on AWS. The industry best practice is to automate the release of cloud software so
that tests and release happen automatically upon "check in".

The AWS CDK provides a unit testing framework for CDK apps in the form of the
"assertions" module and has recently released the "pipelines" module to provide CI/CD
solution to CDK apps.

However, customers are still missing the ability to run integration or application
tests "in the cloud". This module aims to address this gap.

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

### What is the technical solution (design) of this feature?

At a high level, we will be releasing a new construct library - `@aws-cdk/apptest`
that has the following features -

- methods to bootstrap an app or construct library for app testing.
- constructs that provide the ability to write assertions. Assertions are run
  "in the cloud" as part of deployment.
- provide a set of canned commonly used assertions, with the ability to
  "bring your own".
- ability to write the test suite in the same programming language as your app,
  and use the your favourite "off the shelf" test runner.
- ability to deploy and destroy AWS CDK stacks programmatically.
- take and store snapshots of your test to speed up test execution.

See appendices for detailed design.

### Is this a breaking change?

We are releasing a new module for testing. This question is not applicable.

### What alternative solutions did you consider?

See [Appendix A](#appendix-a---assertions) for alternatives on assertions design.

See [Appendix B](#appendix-b---test-execution) for alternatives on test execution.

### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

### What is the high-level project plan?

Since this functionality has a fair level of complexity and touches multiple
modules, the project plan will be tracked separately and outside of this RFC.

### Are there any open issues that need to be addressed later?

The RFC does not describe:

* the experience of using apptest in CDK Pipelines
* the local development experience when writing tests and new assertions
* clean up of resources that were deployed as part of the test

These will be incorporated later.

## Appendix A - Assertions

All apptest assertions are AWS Lambda functions at their core and uses AWS CloudFormation
[custom resources] to execute these during deployment.

apptest ships with a single custom resource provider and every call to an assertion
provisions a new CloudFormation custom resource using this provider. Every assertion is a
lambda function.

The provider backing this custom resource simply invokes the lambda function attached to the
assertion with parameters specific to that instance, collect results and write them to a
known destination.

Every test run has a unique id that identifies that test run. The custom resource provider
shipped by apptest will write the assertion output to a AWS Logs log stream using that
identifier, thereby holding the log of all tests and assertions that were executed and their
results.

A reasonable retention period will be applied to the log stream, by default.

There are two major drawbacks to this solution:

Firstly, writing new assertions is non-trivial. Since assertions are lambda functions, there
is a cost associated to developing them. These include, bringing in the function's
dependencies, modeling the input and outputs of the function, considering AWS Lambda's limits
such as timeouts into consideration.

This is not as trivial as writing a new assertion that runs locally in a popular testing
framework.

Secondly, executing and debugging assertions is non-trivial. Since these assertions are
executed as part of an AWS CloudFormation stack deployment, they take time to execute.
It will not be possible to, deploy the app once and run assertions many times against it.

These insufficiencies could lead users to make poor choices on how they model their tests.
For example, bunch unrelated assertions together in the same test in order to reduce test
execution time.

### Alternative - run assertions locally

Alternatively, the test runner executes these assertions locally. Either the developer machine
or the CI server will interact directly with the deployed CDK app to execute the assertions.

The proposed approach is better than this alternative for the following reasons.

The proposed solution allows for users, typically enterprise users, to test "private" resources,
such as a lambda function in a private vpc. With this alternative, the resource will need to be
exposed to the developer machine and/or CI server.

This type of testing being proposed here involves deploying and cleaning up AWS resources via
CloudFormation stacks for each test. This is time intensive. A combined snapshot of the CDK app
and assertions, taken once, provides a high level of confidence that the test does not need to be
re-run. A fresh snapshot is taken every time the CDK app or any of the assertions in the test
changes.
Since the proposed solution models the assertions as AWS CDK constructs, the synthesized [cloud
assembly] functions as a full and effective snapshot.
This alternative, on the other hand, will require inventing an effective snapshotting solution.

The proposed solution also provides a consistent execution environment for tests - the [AWS Lambda
base images] and the ability to [modify the environment][Modifying runtime environment] via
extensions and layers.
As an example, if an assertion depends on the `sed` utility. OSX ships by default with BSD sed,
while Linux ships with GNU sed, which have subtly different behaviours and option switches.
In the proposed solution, the assertion will either use the `sed` utility in the Lambda base
image or bring its own via Lambda Layers.
If this is not accounted for, this alternative will cause the assertion to behave inconsistently.

[AWS CloudFormation custom resources]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html
[cloud assembly]: https://docs.aws.amazon.com/cdk/api/latest/docs/cloud-assembly-schema-readme.html#cloud-assembly
[AWS Lambda base images]: https://docs.aws.amazon.com/lambda/latest/dg/runtimes-images.html
[Modifying runtime environment]: https://docs.aws.amazon.com/lambda/latest/dg/runtimes-modify.html

## Appendix B - Test Execution

### Design

The AWS CDK CLI (aka toolkit) is responsible for deploying and destroying AWS CDK apps.
We will extract these two parts from the CLI into a separate jsii module.

The `run()` method on the class `apptest.Test` will depend on this module to deploy and
destroy stacks as part of test runs.

Once the CDK app and assertions have finished deploying (deploying assertions implies
execution of the assertions - see Appendix A), the `run()` method will query the status
of the stack in CloudFormation.

If the stack is not in one of the expected `COMPLETE` states, an error (or `Exception`
in some languages) will be thrown containing the relevant failure messages.
The failure messages will be sourced from messages from the AWS CloudFormation stack
and the log stream produced by the test run.

### Alternative - custom test executor

An alternate approach is to ship our own test framework & execution system
as part of the AWS CDK CLI.

An example design for such an approach will consist -

A project set up for apptest will have the `apptest` section in its `cdk.json`.
In the case of a javascript CDK app:

```json
{
  "apptest": {
    "exec": "node {}",
    "testRegex": "**/*.apptest.js"
  }
}
```

The apptest suite for a project is executed by running `cdk apptest`.

When invoked, it will discover all apptest test cases using the `testRegex` provided.
For each match, run synthesis using the value provided in the `exec` option, followed
by deployment and finally destruction of the stack and assertions.

At the end of the run, the CLI will download the detailed test results from AWS Logs to the
location `apptest.out/results-xxx`.

The major downside to this solution is that it is re-inventing another test execution mechanism.

Users will now need to learn how to organize apptest tests, learn how to execute it and read
results. We are not leveraging existing "well known" test frameworks.

Although this looks basic today, as the scope of apptest expands and more features are added,
the apptest test execution mechanism will likely have to re-implement features that are
already present in most popular testing frameworks today.

The proposal does not produce the test report in any known format, and this is going to lead
to poor integration with test reporting tools that support well known test reporting formats.