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

#### Getting Started

> TBD: Installation instructions

#### Writing Tests

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

#### Assertions

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

> TODO: Explain later that assertions are modeled as CFN custom resources.

#### Test Execution & Reporting

contest tests can be written in the same programming language as your CDK project.

Execute contest test can be executed by running the `contest` CLI. Each contest test case will be in its
own file.
By default, the CLI will look for files named `*.contest.*` and execute them.
See [configuration](#configuration) *[TODO]* on how to change this.

Once all the tests are executed, a test report is printed to the console detailing any deployment and
assertion failures.

<!--

#### TBD

- Reporting
- Revisit custom assertions
- Snapshots
- construct library / app upgrades.
- Run nightly/regularly.

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
> to the rest of the RFC, answers should be written "from the present" and
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
-->