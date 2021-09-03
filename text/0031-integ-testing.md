# Integration testing for CDK apps

* **Original Author(s):**: [@nija-at](https://github.com/nija-at)
* **Tracking Issue**: [#31](https://github.com/aws/aws-cdk-rfcs/issues/31)
* **API Bar Raiser**: @{BAR_RAISER_USER}

CDK app developers and construct library authors can write integration
tests that can be run locally or in their CI/CD pipeline.

## Working Backwards - README.md

### contest

🌩️ contest tests can verify that your CDK app can be deployed successfully on AWS with the desired resources.

🤖 contest tests can verify that your CDK app functions as expected, such as assertions against a public API endpoint.

🕰️ contest tests can verify that your CDK app can be updated from a previous version of the app.

🧑‍💻 Write contest tests in any CDK supported language, and execute them as part of your CI pipeline.

📸 Capture snapshots of your CDK apps to track how they are impacted by changes.

### Getting Started

> TBD: Installation instructions

### Writing Tests

contest tests can be written in the same programming language as your CDK project.

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
// repo.contest.ts
import { ArtifactRepo } from './records';
import { Test } from '@aws-cdk/contest';

const repo = new ArtifactRepo(app, 'RequestRecord');

const repoTest = Test.forConstruct(repo);

repoTest.assertAws.
  s3.putObject({ bucket: stack.artifacts, key: '...', body: '...' });

repoTest.assertAws.
  sqs.receiveMessage({ queue: stack.publishNotifs })
     .returns({ Messages: [ ... ] });
```

### Assertions

`contest` comes packaged with a set of commonly used high level assertions.

* `assertAws`: execute AWS service APIs and assert the response.
* `invokeLambda`: invoke an AWS lambda function and assert the response.
* `curlApi`: Execute the 'curl' command on an API endpoint. Used typically to test API Gateway resources.

By default, these assertions will check that the underlying call succeeds. That behavior can be extended
to also include verification of the response.

```ts
test.assertAws(
  s3.getObject({ ... }).returns({ Data: ... });
);

test.invokeLambda(...).returns({ ... });
test.invokeLambda(...).throws({ ... });
```

The `invokeLambda` API is a special and powerful option.
Besides invoking lambda functions defined in the CDK construct under test, it can be used to invoke
lambda functions defined in your test. This mechanism enables user defined assertions as Lambda functions.

**Implementation Note:** All canned and custom contest assertions are modeled as AWS CloudFormation custom resources.
They are executed in the AWS account as part of deployment, after the stack or construct under test has been deployed.

### Test Execution & Report

To execute your contest suite, you need to simply run `cdk contest` using the standard AWS CDK CLI.

For projects that were created prior to the introduction of contest, or were not created using `cdk init`,
a section for `contest` will need to be added to the `cdk.json` file of your project.
The following applies to a CDK project in javascript that uses Node.js -

```json
{
  "contest": {
    "exec": "node {}",
    "testRegex": "**/*.contest.js"
  }
}
```

- The `testRegex` is the glob pattern to find contest test files.
- The `exec` key specifies the binary that should be invoked to synthesize a contest test.
  The `{}` placeholder is required. This will be replaced by each file resolved by the `testRegex` glob.

`cdk contest` will begin by discovering files and executing them one by one.
As each test is completed, a one line summary of its pass/fail is printed to console.
Detailed test results are available in a file, usually at `contest.out/results-xxx`.

<!--

#### TBD

- Reporting
- In the pipeline
- Revisit custom assertions
- Snapshots
- construct library / app upgrades.
- Run nightly/regularly.

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

### Why should I use this feature?

> Describe use cases that are addressed by this feature.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "in the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

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

> If the answer is no. Otherwise:
>
> Describe what ways did you consider to deliver this without breaking users?
>
> Make sure to include a `BREAKING CHANGE` clause under the CHANGELOG section with a description of the breaking
> changes and the migration path.

### What alternative solutions did you consider?

See [Appendix A](#appendix-a---test-execution) for alternatives on test execution.

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

## Appendix A - Test Execution

### Implementation

A project set up for contest will have the `contest` section in its `cdk.json`.
In the case of a javascript CDK app:

```json
{
  "contest": {
    "exec": "node {}",
    "testRegex": "**/*.contest.js"
  }
}
```

The contest suite for a project is executed by running `cdk contest`.

When invoked, it will discover all contest test cases using the `testRegex` provided and,
for each match will run synthesis using the `exec` command.

All synthesized CDK apps will be placed under `contest.out/`.

Following this, by default, the CLI will continue and deploy each test. As usual, it will
poll CloudFormation for its status and print a pass/fail against each test case.
When a test completes, it will then destroy the stack, before proceeding to run the next test.

At the end of the run, the CLI will download the detailed test results from AWS Logs to the
location `contest.out/results-xxx`.

### Alternatives

Instead of adding a new CLI subcommand and updated init templates, we could look to reuse
existing testing frameworks, such as, jest for Node.js, junit for Java, etc.
This would imply a simpler and a more familiar experience of writing tests.

However, to achieve this effectively, the test cases will need to deploy the app it defines.
We do not have a way to deploy CDK applications programmatically.