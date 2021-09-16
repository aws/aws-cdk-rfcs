# Integration testing for CDK apps

* **Original Author(s):**: [@nija-at](https://github.com/nija-at)
* **Tracking Issue**: [#31](https://github.com/aws/aws-cdk-rfcs/issues/31)
* **API Bar Raiser**: @{BAR_RAISER_USER}

CDK app developers and construct library authors can write integration
tests that can be run locally or in their CI/CD pipeline.

## Working Backwards - README.md

### `@aws-cdk/app-test`

🌩️ app-test can verify that your CDK app can be deployed successfully on AWS with the desired resources.

🤖 app-test can verify that your CDK app functions as expected, such as assertions against a public API endpoint.

🧑‍💻 Write tests in any CDK supported language, and execute them as part of your CI pipeline.

📸 Capture snapshots of your CDK apps to track how they are impacted by changes.

🧹 app-test will clean up any AWS resources that it had to provision, and keep your AWS costs to the minimum.

### Writing Tests

Tests that use app-test can be written in the same programming language as your CDK project.

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
import { AwsAssertionCall, AwsAssertion, Test } from '@aws-cdk/app-test';

const repo = new ArtifactRepo(app, 'RequestRecord');

const repoTest = Test.forConstruct(repo);

new AwsAssertion(repoTest, 'RepoPutObject', {
  request: AwsAssertionCall.S3.putObject({ bucket: stack.artifacts, key: '...', body: '...' })
});

new AwsAssertion(repoTest, 'MessageReceived', {
  request: AwsAssertionCall.Sqs.receiveMessage({ queue: stack.publishNotifs }),
  returns: { Messages: [...] }
});
```

### Assertions

`app-test` comes canned with a set of commonly used high level assertions.

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

When canned assertions are insufficient, `app-test` also provides a mechanism to write custom assertions.
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

### Test Execution & Report

To execute your app-test suite, you need to simply run `cdk app-test` using the standard AWS CDK CLI.

For projects that were created prior to the introduction of app-test, or were not created using `cdk init`,
a section for `app-test` will need to be added to the `cdk.json` file of your project.
The following applies to a CDK project in javascript that uses Node.js -

```json
{
  "app-test": {
    "exec": "node {}",
    "testRegex": "**/*.apptest.js"
  }
}
```

- The `testRegex` is the glob pattern to find app-test test files.
- The `exec` key specifies the binary that should be invoked to synthesize a app-test test.
  The `{}` placeholder is required. This will be replaced by each file resolved by the `testRegex` glob.

`cdk app-test` will begin by discovering files and executing them one by one.
As each test is completed, a one line summary of its pass/fail is printed to console.
Detailed test results are available in a file, usually at `app-test.out/results-xxx`.

### Test snapshots

On first run of a app-test test, a snapshot will be produced that *must be checked into source tree*.
This is a snapshot of the [cloud assembly] containing both the CDK app (being tested) and the test's
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

On subsequent runs of this test - via `cdk app-test` - if the synthesized cloud assembly matches the
snapshot, then a full deployment and assertions will be skipped and the test will be considered to
have passed. This behaviour can be overridden with the `--ignore-snapshots` flag.

However, when the synthesized cloud assembly does not match the snapshot, the test will be executed
in full and the snapshot updated. As before, the updates must be checked into the source tree.

[cloud assembly]: https://docs.aws.amazon.com/cdk/api/latest/docs/cloud-assembly-schema-readme.html#cloud-assembly


### Developing Tests

> TBD

<!--

#### TBD

- In the pipeline
- clean up
- authoring experience - interplay with 'cdk watch'
- Test output in a standard protocol
- Can we support standard test frameworks

-->

## Working Backwards - README.md

### AWS CDK Toolkit

> TBD
> For now see, [Test Execution](#test-execution--report) above.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

> What exactly are we launching? Is this a new feature in an existing module? A
> new module? A whole framework? A change in the CLI?

### Why should I use this feature?

> Describe use cases that are addressed by this feature.

### Why are all my app-test snapshots sometimes invalidated when I upgrade to a newer CDK version?

This usually happens when your CDK app depends on an asset that is bundled as part of the AWS CDK.
Learn more about [assets].

Assets bundled as part of the CDK can change when there is a bug fix or a new feature added to the
asset. When an asset changes, its fingerprint (hash) stored in the CloudFormation template also changes.

With such changes, it is best to re-run all your tests in full (as is the default by `cdk app-test`)
to ensure that all of the new changes do not have any unintended impact to your application.

Rarely, the AWS CDK will change the synthesized template in backwards compatible ways, such as,
changing the order of properties, or setting a property to its default. 
As stated previously, it is still safer to run all tests with invalidated snapshots.

[assets]: https://docs.aws.amazon.com/cdk/latest/guide/assets.html

## Internal FAQ

### Why are we doing this?

> What is the motivation for this change?

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

### What is the technical solution (design) of this feature?

> Briefly describe the high-level design approach for implementing this feature.
>
> As appropriate, you can add an appendix with a more detailed design document.
>
> This is a good place to reference a prototype or proof of concept, which is
> highly recommended for most RFCs.

### Is this a breaking change?

We are releasing a new module for testing. This question is not applicable.

### What alternative solutions did you consider?

See [Appendix A](#appendix-a---test-execution) for alternatives on test execution.

See [Appendix B](#appendix-b---assertions) for alternatives on assertions design.

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

The RFC does not describe the experience of using app-test in CDK Pipelines.
This needs to be incorporated later.

## Appendix A - Test Execution

### Design

A project set up for app-test will have the `app-test` section in its `cdk.json`.
In the case of a javascript CDK app:

```json
{
  "app-test": {
    "exec": "node {}",
    "testRegex": "**/*.apptest.js"
  }
}
```

The app-test suite for a project is executed by running `cdk app-test`.

When invoked, it will discover all app-test test cases using the `testRegex` provided and,
for each match will run synthesis using the `exec` command.

All synthesized CDK apps will be placed under `apptest.out/`.

Following this, by default, the CLI will continue and deploy each test. As usual, it will
poll CloudFormation for its status and print a pass/fail against each test case.
When a test completes, it will then destroy the stack, before proceeding to run the next test.

At the end of the run, the CLI will download the detailed test results from AWS Logs to the
location `apptest.out/results-xxx`.

The major downside to this solution is that it is re-inventing another test execution mechanism.

Users will now need to learn how to organize app-test tests, learn how to execute it and read
results. We are not leveraging existing "well known" test frameworks.

Although this looks basic today, as the scope of app-test expands and more features are added,
the app-test test execution mechanism will likely have to re-implement features that are
already present in most popular testing frameworks today.

The proposal does not produce the test report in any known format, and this is going to lead
to poor integration with reporting tools and parsers.

### Alternatives

Instead of adding a new CLI subcommand and updated init templates, we could look to reuse
existing testing frameworks, such as, jest for Node.js, junit for Java, etc.
This would imply a simpler and a more familiar experience of writing tests. It also integrates
well with existing tooling such as standard test report generation, test parallelism, etc.

To achieve this, we will need to provide a jsii module that can deploy and destroy AWS CDK
applications. Currently, this is available only via the AWS CDK CLI.

> TBD: To be explored

## Appendix B - Assertions

All app-test assertions are AWS Lambda functions at their core and uses AWS CloudFormation
[custom resources] to execute these during deployment.

app-test ships with a single custom resource provider and every call to an assertion
provisions a new CloudFormation custom resource using this provider. Every assertion is a
lambda function.

The provider backing this custom resource simply invokes the lambda function attached to the
assertion with parameters specific to that instance, collect results and write them into a
pre-configured log stream in AWS Logs associated with this test run.

### Alternatives

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

> TBD: Document the downsides of the proposed approach

[AWS CloudFormation custom resources]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html
[cloud assembly]: https://docs.aws.amazon.com/cdk/api/latest/docs/cloud-assembly-schema-readme.html#cloud-assembly
[AWS Lambda base images]: https://docs.aws.amazon.com/lambda/latest/dg/runtimes-images.html
[Modifying runtime environment]: https://docs.aws.amazon.com/lambda/latest/dg/runtimes-modify.html