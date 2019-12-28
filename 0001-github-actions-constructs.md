- Feature Name: github-actions-constructs
- Start Date: 2019-12-26
- RFC PR:
- Related Issue:

# Summary

This RFC proposes creating a library of CDK constructs that allows modeling GitHub Actions as code in any JSII-supported language,
similarly to how the AWS Construct Library allows modeling CloudFormation templates in code.

# Motivation

The CDK team is exploring applying the construct programming model to generate configuration other than just CloudFormation templates.
GitHub Actions seem like an interesting candidate for such a target,
for a number of reasons:

1. GitHb Actions are configured through YAML-based configuration.
    Here's an example, taken from the [starter-workflows repository](https://github.com/actions/starter-workflows),
    of a simple workflow for Gradle-based Java projects:

    ```yaml
    name: Java CI
    
    on: [push]
    
    jobs:
      build:
   
        runs-on: ubuntu-latest
   
        steps:
        - uses: actions/checkout@v1
        - name: Set up JDK 1.8
          uses: actions/setup-java@v1
          with:
            java-version: 1.8
        - name: Grant execute permission for gradlew
          run: chmod +x gradlew
        - name: Build with Gradle
          run: ./gradlew build
    ```
    
    It seems likely that this configuration would benefit greatly from a programmatic model,
    for the same reasons CloudFormation templates benefit from it
    (type safety and validations shorten the feedback loop,
    autocomplete in the IDE aids discoverability,
    YAML lacks ways to reuse and compose fragments of the configuration
    and is very prone to whitespace-related errors, etc.).

2. GitHub Actions have been very-well received by the community,
    and seem to be gaining in usage and popularity.
    The GitHub Marketplace already contains thousands of ready-made actions that you can use in your jobs.

3. GitHub Actions are another avenue for customers to interact with AWS services.
    At the time of writing this, there are over 40 different AWS-based actions in the GitHub Marketplace.
    Many customers are using GitHub Actions to perform builds and deployment of their AWS applications.
    It seems like it's natural for AWS to offer a solution to those customers.
    It would be very interesting, for instance, to extend our ["CI/CD for CDK apps"](https://github.com/aws/aws-cdk/pull/3437)
    story to enable customers to use GitHub Actions in place of CodePipeline.

# Basic Example

Here's how a GitHub Actions CDK app might look like,
based on the documentation of the ["AWS Lambda Deploy"](https://github.com/marketplace/actions/aws-lambda-deploy#usage)
action (the code is in TypeScript):

```typescript
import { App, Construct } from '@aws-cdk/core';
import * as gha from '@aws-cdk/github-actions';
import * as gha_aws from '@aws-cdk/github-actions-aws';

class MyWorkflow extends gha.Workflow {
  constructor(scope: Construct, id: string, props?: gha.WorkflowProps) {
    super(scope, id, props);

    const matrixStrategy = gha.Strategy.matrix({ 'go-version': ['1.13.x'] });
    new gha.Job(this, 'deploy_zip', {
      jobName: 'deploy lambda function',
      runsOn: gha.Ubuntu.latest(),
      strategy: matrixStrategy,
      steps: [
        {
          stepName: 'checkout source code',
          uses: new gha.CheckoutSource(),
        },
        {
          stepName: 'Install Go',
          uses: new gha.GoInstall({
            version: matrixStrategy['go-version'], // Token
          }),
        },
        {
          stepName: 'Build binary',
          run: [
            'cd example',
            'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -v -a -o main main.go',
            'zip deployment.zip main',
          ],
        },
        {
          stepName: 'default deploy',
          uses: new gha_aws.DeployLambda({
            accessKeyId: gha.secret('AWS_ACCESS_KEY_ID'),
            secretAccessKey: gha.secret('AWS_SECRET_ACCESS_KEY'),
            region: gha.secret('AWS_REGION'),
            functionName: 'gorush',
            code: gha_aws.DeployLambda.Code.fromZipFile('example/deployment.zip'),  
            dryRun: true,
          }),
        },
      ],
    });
  }
}

const app = new App();

new MyWorkflow(app, 'main', {
  workflowName: 'deploy to lambda',
  on: [gha.Trigger.onPush({ branches: ['master'] })], // the 'branches' part is optional
});

app.synth();
```

# Detailed Design

This RFC proposes starting an entirely new project.
It will require work in the following areas:

## Core library decoupling

This project needs to have the core CDK library that contains the construct model decoupled from the AWS Construct Library.
We were planning to do this work anyway
(for instance, it's needed for the Kubernetes constructs project),
but, depending on the timelines, might need to be done as part of this work.

## GitHub Actions core library

We will need to write and publish a library
(proposed name: `@aws-cdk/github-actions`)
that contains the logic of generating GitHub Actions YAML configuration from objects,
and classes for the core concepts of GitHub Actions:

- `Workflow` (and `WorkflowProps`)
- `Job` (and `JobProps`)
- `StepOptions`
- `IAction`
- `Strategy`
- `IPlatform`
- etc.

## GitHub Actions action libraries

In addition to the general GitHub Actions library above,
we should also have an ecosystem of libraries that contain particular actions,
both those that are published on the GitHub Marketplace,
and those kept in public GitHub repositories.

GitHub maintains a repository of commonly used actions in the ['actions' organization](https://github.com/actions).
It's probably expected that we should have first-class support for all actions defined in this organization.
It's interesting whether these should live in their own library,
or be part of the above core library.
I'm inclined to the latter
(I think the core library will not be very useful if it didn't contain any actions at all),
and that's what I used in the code sample above.

It's interesting to think about the granularity of the libraries -
should they be 1:1 with the GitHub repositories they are defined in,
or should they be more of a grouping of several, related actions together.
Seeing how the 'actions' GitHub organization mentioned above looks like,
it seems to me grouping many actions into one library is probably the way to go
(it's also a lot of burden on the customer to find and add a dependency to their project for every single action class they want to use).

We should probably pay special attention to actions that are related to dealing with AWS.
In the above example, I have a `@aws-cdk/github-actions-aws`
library that I see as a grouping of several actions that allow you to perform common operations
(like deploying a Lambda function) on AWS services.

## L1 generation

One of the CDK's biggest strengths is the way it layers the different levels of abstraction.
I want to preserve this layering in the GitHub Actions version of the CDK.

GitHub Action have their own declarative syntax for defining action metadata
(not its logic, which is done in code) like the name, inputs, outputs, etc. -
see [the documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/metadata-syntax-for-github-actions) for details.
We need to create a code generator, similar to `cfn2ts` that we use for the CloudFormation spec,
that can take that definition as input,
and generate an L1 class corresponding to it.

Then, we will have hand-written L2s that wrap the automatically-generated L1s with some nicer syntax and/or types,
and then use the L1s in their implementations.

It probably makes sense for packages containing L1s to be 1:1 with the GitHub repositories of the action they're modeling;
then, in the higher level packages, like the `@aws-cdk/github-actions-aws` mentioned above,
we would declare the dependencies on all of the packages of the L1s that we are using in the implementations.

It's interesting to think how should we model these L1-only packages,
and publish them to all JSII-enabled package managers.
One way is to have a separate GitHub repository for each package;
another is to have a centralized repository which just enumerates what packages are mastered in it,
with perhaps a separate GitHub Actions workflow for publishing each of them.

## L3 constructs

I think GitHub Actions would lend themselves well to higher-level constructs that encapsulate more complicated tasks that require multiple steps to accomplish.
For instance, we could define a workflow for building, testing, and publishing a Node package to NPM:

```typescript
/*
 * Checks out your code, builds and tests it, and finally publishes it to NPM in an idempotent way.
 */
new PublishToNpmWorkflow(this, 'publish_to_npm', {
  buildCommand: 'build', // default: 'build'
  testCommand: 'check', // default: 'test'
  npmToken: gha.secret('NPM_TOKEN'), // only required property
});
```

## Versioning actions

Because GitHub actions can be mastered in a git repository,
versioning them is a very interesting problem.
GitHub Actions allow a very flexible versioning scheme,
where you can specify:

- a commit SHA hash (or a part of it that is unique in the repository)
- a tag
- a branch
- a specific semantic version of the action that will then be used to match to a tag
  (for example, `v1` will match `v1.3` but not `v2.0.0`; `v1.2` will match `v1.2.5` but not `v1.3`, etc.)

It's interesting how should the L1s follow the versions.
Should they include the version number in their class name, for instance
(so, `CheckoutSourceV1`, `CheckoutSourceV2`)?
And if so, with which granularity - the major version, the minor version?
Should our L2s pin to a particular version of the action,
or should they try and stay open, using something like `v1` or `v2`?

Also, how would we know to regenerate the L1 package when the action changes?
We might have to build some automation that scans the releases of a given repository,
and re-generates the L1 and automatically publishes it if a new release is detected since the last run.

## Deploying the resulting YAML configuration

GitHub Actions don't have an API used to update the configuration of the workflows,
like `ExecuteChangeSet` does for CloudFormation.
Instead, workflows are defined by YAML files placed in a specific location in the repository
(`.github/workflows/`).
Because of this, there's no way to emulate the `cdk deploy` command for GitHub Actions.

Instead, we would have to generate the files in the `.github/workflows`
directory from the source with a command similar to `cdk synth`.
Then, only on `git push` would the changes be actually applied.

While keeping in version control both the source code and the result of executing it is not ideal,
it is not without precedent;
for example, if you look at the official [setup-node GitHub action](https://github.com/actions/setup-node),
the logic of this action is written in TypeScript,
but of course the action runner only understands JavaScript;
for this reason, the compiled JavaScript code from the TypeScript sources is actually checked in to Git.

# Drawbacks

Some potential drawbacks:

- This is a large project. We can mitigate this risk by delivering in stages
  (for example, we might deliver only L1 support at first).
- We are not certain there's a market for it.
  We can mitigate this risk by making it open source from the get-go,
  and soliciting feedback from existing CDK customers.
- The deployment strategy is not perfect.
  Not much we can do here - that's just how GitHub Actions work.

# Rationale and Alternatives

The alternative is, of course,
to not do this project,
but instead focus on other non-CloudFormation usages
(like Kubernetes, or Terraform).

# Prior Art

Discuss priort art, both the good and the bad, in relation to this proposal. A
few examples of what this could include are.

Related to this proposal are:

- CDK constructs for Kubernetes
- CDK constructs for Terraform modules

# Adoption Strategy

Customers of this solution do not have to be existing CDK customers.

# Future Possibilities

This project has some interesting implications for CDK and JSII:

- Like I mentioned before, the "CI/CD for CDK apps" can be extended to use GitHub Actions,
  not only CodePipeline.
- We can have GitHub Actions for publishing JSII-modules to all the package managers,
  instead of doing it with CodePipeline and delivlib.
- We can have dedicated, blessed CDK-related GitHub Actions.
- We can allow using GitHub Actions as an alternative to CodePipeline for CDK projects.

# Unresolved questions

There are a lot of unresolved questions with this project:

- What should be the correspondence between GitHub repositories holding an action,
  and its L1 CDK package (one to one? many to one?)?
- How should we tie in the version of the action classes,
  and the actual version of the action?
- How do we regenerate the L1 classes when the action they model releases a new version?
