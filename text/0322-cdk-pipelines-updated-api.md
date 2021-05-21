---
rfc pr: [#xxx](https://github.com/aws/aws-cdk-rfcs/pull/xxx) <-- fill this after you've already created the PR
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/322
---

# CDK Pipelines Updated API

> We are reworking the internals of CDK Pipelines to separate out the concerns of CDK Deployments and AWS CodePipeline
> better, and provide a more streamlined user-facing API,
> both while staying backwards compatible.

## Working Backwards

The final API for CDK Pipelines is finally here. Compared to the previous API:

- CDK applications could not be deployed in waves. They can now, as we automatically establish runorders between
  actions.
- You could not build pipelines that used multiple sources to feed into the synth, or that had a custom build step. You can now.
- Large CDK applications (> 25 stacks) could not previously be deployed because they would exceed the 50 actions per
  stage limit that CodePipeline has. With the new implementation, the actions will automatically spread over multiple
  stages, even if you deploy multiple applications in parallel.
- For simple use cases, you no longer need to manage CodePipeline Artifacts: artifact management is implicit
  as objects that produce artifacts can be used to reference them.

Best of all: your old code--even though it uses no longer recommended idioms--still continues to work, so you
can upgrade to the new style at your own pace.

The following:

```ts
const sourceArtifact = new codepipeline.Artifact();
const cloudAssemblyArtifact = new codepipeline.Artifact('CloudAsm');
const integTestArtifact = new codepipeline.Artifact('IntegTests');

const pipeline = new cdkp.CdkPipeline(this, 'Pipeline', {
  cloudAssemblyArtifact,

  // Where the source can be found
  sourceAction: new codepipeline_actions.GitHubSourceAction({
    actionName: 'GitHub',
    output: sourceArtifact,
    oauthToken: SecretValue.secretsManager('github-token'),
    owner: 'OWNER'
    repo: 'REPO',
    trigger: codepipeline_actions.GitHubTrigger.POLL,
  }),

  // How it will be built
  synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
    sourceArtifact,
    cloudAssemblyArtifact,
    projectName: 'MyServicePipeline-synth',
    additionalArtifacts: [
      {
        directory: 'test',
        artifact: integTestArtifact,
      },
    ],
  }),
});

const stage = pipeline.addApplicationStage(new MyStage(this, 'PreProd', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
}));
stage.addActions(
  new cdkp.ShellScriptAction({
    actionName: 'UseSource',
    commands: [
      // Comes from source
      'cat README.md',
    ],
    additionalArtifacts: [sourceArtifact],
  }),
);
```

Becomes:

```ts
const source = cdkp.Source.gitHub('OWNER/REPO');

const pipeline = new cdkp.CdkPipeline(this, 'Pipeline', {
  synthAction: cdkp.Build.standardNpmSynth({
    input: source,
    projectName: 'MyServicePipeline-synth',
    additionalOutputs: [
      { directory: 'test', name: 'tests' },
    ],
  }),
});

const stage = new MyStage(this, 'PreProd', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
pipeline.addApplicationStage(stage, {
  approvals: [
    cdkp.Approval.shellScript({
      input: source,
      commands: ['cat README.md'],
    }),
  ],
});
```

The biggest changes are: we are layering our own classes over the primitive CodePipeline API
(`Source.gitHub` instead of `codepipeline_actions.GitHubSourceAction`) with improved ergonomics
and defaults, and we are making artifacts implicit.

> The biggest change we want to make but don't have an answer for at time of this writing is how to give users the
> ability to tweak every individual part of every indiviual CodeBuild project that gets generated.

All other changes are mostly related to the internals of how the library is implemented and
how pipeline customizations will work. Most important changes to the internals:

- Knowledge of the steps necessary to deploy a CDK app and how those steps are rendered to
  AWS CodePipeline will be separated out from each other.
- The library will work by mutating an in-memory model of the deployment workflow (as opposed
  to manipulating the `@aws-cdk/aws-codepipeline` constructs directly), and only when the
  manipulation is done will we render everything out to CodePipeline constructs.

These aspects will impact how quickly the feature can be ported to other backends. The porting itself is out of scope
for now.

## Internal FAQ

### How will this work?

The library will be organized into 3 layers:

```
┌────────────────┬────────────────┬───────────────────────┐
│                │                │   Build.shellScript   │
│  CdkPipeline   │ Source.gitHub  │    (Vpc, CodeBuild    │
│                │(SecretsManager)│     testing, IAM)     │
│                │                │                       │
├────────────────┴────────────────┴───────────────────────┤
│                                                         │
│            Workflow core + CDK app knowledge            │
│   (steps, dependencies, translate CDK app into steps)   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│            Render to CodePipeline/CodeBuild             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The **middle** layer has facilities to build and manipulate an abstract workflow, which features concepts like *steps*,
*dependencies*, *artifacts*, and knows how to translate a CDK app into a sequence of backend-agnostic steps.

The **bottom** layer renders the generic workflow to a specific CI/CD runner.  In the CDK Pipelines case, a CodePipeline
with a set of CodeBuild projects and CloudFormation Actions.

The **top** layer is the one the user interacts with. It is specialized to the backend that will be used to render out
the final pipeline, and so can deal in concepts that are familiar to the user and offer all the backend-specific customizations
users might want (Most commonly: source customizations such as credentials coming from AWS SecretsManager, and CodeBuild customizations
like VPC bindings, specific additional IAM permissions, enabling CodeBuild test reporting, customizing Log Groups, etc).

### How will we port to another backend?

What is the work to implement different backends for CDK deployments (like, for example, GitHub Actions)?

* Obviously, we need to replace layer 3
* We will also need to replace layer 1. This is also pretty obvious: for other backends, the set of
  supported Sources will be different, how we specify credentials will be different, the customizations offered
  will be different. The most natural API will be one that maps closely to the platform we're targeting.
  The `CdkPipeline` class (which currently takes `codepipeline.IAction`s, and `IPipeline`s, and will continue to do so
  for backwards compatibility) will also be reimplemented. For example, to a class like `CdkAppWorkflow`.

We will gain efficiency from the fact that the reimplementation will not contain business logic: it will
mostly be mapping types and properties between the different levels. All the knowledge about the structure
and order of deploying CDK apps will be located in layer 2, and is reused.

### Why will we stay backwards compatible?

Many people have already invested a lot of effort into writing code against the CDK Pipelines
library. The changes we are planning mostly affect the internals of the library, and we want to add
some slight enhanced expressiveness and customizability to the API.

With a little additional effort, we can make the new API additive and have the old one continue to work,
giving people the opportunity to switch over to the new API at their own pace.

### How will we stay backwards compatible?

Right now, the parts that are too limiting are the parts that are directly re-exposed from the `aws-codepipeline`
library. For example, the fact that the synth needs to be a `codepipeline.IAction`.

What we'll do is type testing to switch between old and new behavior. Conceptually:

```ts
interface IModernSynthAction implements codepipeline.IAction {
  // Or whatever the signature ends up being
  public addToPipelineModern(pipeline: CdkPipeline): AddResult;
}

if (isModernSynthAction(props.synthAction)) {
  // New behavior
  props.synthAction.addToPipelineModern(this);
} else {
  // Wrapper class for legacy behavior
  new LegacySynthAction(props.synthAction).addToPipelineModern(this);
}
```

### How do we render deployments out across backends?

In the middle layer, a stack deployments gets represented as nested state machines,
like this:

```
┌───────────────────────────────────────────────────────────────┐
│                          DeployStack                          │
│                                                               │
│     ┌────────────────────┐         ┌────────────────────┐     │
│     │                    │         │                    │     │
│     │  CreateChangeSet   │────────▶│  ExecuteChangeSet  │     │
│     │                    │         │                    │     │
│     └────────────────────┘         └────────────────────┘     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

A backend rendered has the choice to either:

* Recognize a `DeployStack` state and render that out to a `cdk deploy` command (or something
  else appropriate); or
* Recognize the individual `CreateChangeSet` and `ExecuteChangeSet` states and render those
  out either to CodePipeline actions or `aws cloudformation change-change-set` CLI commands,
  as may be appropriate.

### How do approval workflows work?

Every `Approval` step will be handed a reference to the workflow of the application
being deployed, as well as to an empty "approval" workflow. It can then choose to
add new actions and dependencies to any of those workflows.

In the most common case, it will add things like "shell script" actions to the approval workflow; but it might also
choose to add actions before "Deploy" (`Approval.securityChanges()`), or it might choose to add actions *in between*
`CreateChangeSet` and `DeployChangeSet` pairs.

The actions it adds may be generic (from level 2), translatable into any backend and so
the approval workflow is reusable, or they may be backend-specific and only apply to
one specific backend.

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                                                   App
│┌────────────────────────────────────────────────────┐          ┌───────────────────────────────────┐  │
 │                       Deploy                       │          │              Approve              │
││                                                    │          │                                   │  │
 │ ┌────────────────────┐    ┌────────────────────┐   │          │                                   │
││ │       Stack1       │    │       Stack2       │   │          │                                   │  │
 │ │                    │    │                    │   │          │                                   │
││ │  ┌────┐    ┌────┐  │    │  ┌────┐    ┌────┐  │   │─────────▶│                                   │  │
 │ │  │ C  │───▶│ E  │  │───▶│  │ C  │───▶│ E  │  │   │          │                                   │
││ │  └────┘    └────┘  │    │  └────┘    └────┘  │   │          │                                   │  │
 │ │                    │    │                    │   │          │                                   │
││ └────────────────────┘    └────────────────────┘   │          │                                   │  │
 │                                                    │          │                                   │
│└────────────────────────────────────────────────────┘          └───────────────────────────────────┘  │
 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
```

### How will asset publishing work?

Similar to how approval workflows work, the asset publishing strategy can be configured
with a callback which can manipulate the workflow as desired. This allows for easy switching
between:

* Prepublish all assets in individual CodeBuild projects
* Prepublish all assets in one CodeBuild project
* Publish assets just before each app deployment
* Publish initial assets as usual but afterwards wait for ECR replication to finish

### What are the generic primitives?

In the middle layer, the following types of actions/states exist:

* ShellScript
  - May have concepts like shell commands, Docker image, IAM permissions it should
    be possible to assume
  - Renders to CodeBuild for CodePipeline, a Step in GitHub Actions
* Manual Approval
  - They GitHub Actions renderer may reject this type of action, and that is okay.
* Create ChangeSet
* Execute ChangeSet
  - With or without capturing outputs (backend may reject capturing outputs if it cannot implement that)

In addition to these, a specific implementation may add backend-specific actions.
So for example, a `CodePipelineAction` can hold any `codepipeline.IAction`, which
can be added into the graph to do whatever. The CodePipeline renderer would render
those out, while any other backend would reject them. This is our "escape hatch" from
level 1 down to level 3.

### Why are we doing this?

We are trying to stabilize the current iteration of CDK Pipelines, so that it can
be declared ready for use by all CDK users. At the same time, we are trying to make
sure our work isn't completely targeted at AWS CodePipeline only, and can be made
to work with other deployment backends like GitHub Actions.

### Why should we _not_ do this?

Maybe generalizing to multiple deployment backends is too speculative, and we shouldn't be spending effort on it.

Maybe leaving a specialized API at level 1 is not generic enough, and we'll end up reimplementing substantial amounts of
code anyway, wasting the effort generalizing.

In any case, our current front-end API is a bit awkward and can do with some optimizing (it's not as minimal and
humanist as we prefer our CDK APIs to be), and the internals need some reworking to address bits of
flow customization users currently aren't able to do, which requires mutation of an in-memory model
anyway. While doing that, it's not a *lot* of additional effort to separate out responsibilities
enough that it becomes feasible to port the concepts.

### What are the drawbacks of this solution?


### What alternative solutions did you consider?


### What is the high level implementation plan?

### Are there any open issues that need to be addressed later?


