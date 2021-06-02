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


### Examples

The following:

```ts
import { SecretValue } from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as cdkp from '@aws-cdk/pipelines';

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

const stage = new MyStage(this, 'PreProd', {
  env: { account: '12345', region: 'us-east-1' },
});
stage.addActions(
  new cdkp.ShellScriptAction({
    commands: ['node ./integ-tests'],
    additionalArtifacts: [integTestArtifact],
  }),
);
```

Becomes:

```ts
import * as cdkp from '@aws-cdk/pipelines';

const pipeline = new cdkp.Pipeline(this, 'Pipeline', {
  build: new cdkp.CdkBuild({
    input: cdkp.CodePipelineSource.gitHub('OWNER/REPO'),
    commands: ['npm ci', 'npm run build'],
    additionalOutputs: {
      tests: cdkp.AdditionalOutput.fromDirectory('test'),
    }
  }),
  backend: new cdkp.AwsCodePipelineBackend(),
});

const stage = new MyStage(this, 'PreProd', {
  env: { account: '12345', region: 'us-east-1' },
});
pipeline.addCdkStage(stage, {
  after: [
    new cdkp.ShellScriptAction({
      input: pipeline.build.additionalOutput('tests'),
      commands: ['node ./integ-tests'],
    }),
  ],
});
```

### Splitting definition and backend

It is helpful if there is a clearly defined moment in time when the pipeline definition is ready to be rendered.

There are various ways to organize this, each pretty much isomorphic to one another.

OPTION 1

Clear split of definition and instantiation. Very much like StepFunctions.

```ts
const pipelineDefinition = new cdkp.PipelineDefinition({
  build: new cdkp.CdkBuild({
    input: cdkp.CodePipelineSource.gitHub('OWNER/REPO'),
    ...
  }),
});
pipelineDefinition.addCdkStage(...);
pipelineDefinition.addCdkStage(...);

new cdkp.CodePipelineBackend(this, 'Pipeline', {
  pipelineDefinition: pipelineDefinition,
});
```

OPTION 2

Automatic rendering moment.

```ts
const pipeline = new cdkp.Pipeline(this, 'Pipeline', {
  build: new cdkp.CdkBuild({
    input: cdkp.CodePipelineSource.gitHub('OWNER/REPO'),
    ...
  }),
  backend: new cdkp.CodePipelineBackend({
    ...backendOptions
}),
});
pipeline.addCdkStage(...);
pipeline.addCdkStage(...);

pipeline.render();  // <-- can be automatically called if not called at `prepare()` time.
```

OPTION 3 (syntactic sugar over OPTIONS 1 or 2)

Backend-specific syntactic sugar for people that definitely only need one backend.

```ts
const pipeline = new cdkp.CodePipeline(this, 'Pipeline', {
  build: new cdkp.CdkBuild({
    input: cdkp.CodePipelineSource.gitHub('OWNER/REPO'),
    ...
  }),
  ...backendOptions
});
pipeline.addCdkStage(...);
pipeline.addCdkStage(...);

pipeline.render();  // <-- can be automatically called if not called at `prepare()` time.
```

Advantages of options 2, 3 are that `render()` can be implicit if necessary, and so cannot
be accidentally forgotten.

Recommendation: we implement options 1 and 3.

### Waves

Deploying multiple applications in parallel is done by adding waves:

```ts
const def = new cdkp.PipelineDefinition({
  build: new cdkp.CdkBuild({ ... }),
  waves: [
    {
      waveName: '...',
      stages: [
        {
          stageName?: '...',
          stage: new MyAppStage(...),
          after: [...],
        }
      ],
    },
  ],
});
def.addCdkStage(new MyAppStage(...));

const wave = def.addWave('asdf', {
  stages: [...],
});
wave.addCdkStage(new MyAppStage(...));
```

### Validations

Waves and Stages can be decorated with `before` and `after` actions, intended for validations
and checks.

```ts
const def = new cdkp.PipelineDefinition({
  build: new cdkp.CdkBuild({ ... }),
});
def.addCdkStage(new MyAppStage('Beta', ...));

const wave = def.addWave('Prod', {
  before: [
    new cdkp.ManualApprovalAction('Promote Beta to Prod'),
  ],
});

wave.addCdkStage(new MyAppStage(...), {
  after: [
    new cdkp.ShellScriptAction('Validate', {
      commands: [
        'curl -Ssf https://mywebsite.com/ping',
      ],
    }),
  ],
});
```

### Using additional artifacts

To clearly distinguish them from Stack Outputs, we will call artifacts "file sets". They
can be consumed and produced by build actions and shell actions, and are always
about whole directories:

```ts
const pipeline = new cdkp.PipelineDefinition({
  build: new cdkp.CdkBuild({
    input: cdkp.CodePipelineSource.gitHub('OWNER/REPO'),
    additionalInputs: {
      'subdir': cdkp.CodePipelineSource.gitHub('OWNER2/REPO2'),
      '../side-dir': someStep,
    },
    commands: ['npm ci', 'npm run build'],
    additionalOutputs: {
      tests: cdkp.AdditionalOutput.fromDirectory('test'),
    }
  }),
});

pipeline.addCdkStage(stage, {
  after: [
    new cdkp.ShellScriptAction({
      input: pipeline.additionalBuildOutput('tests'),
      commands: ['node ./integ-tests'],
      output: cdkp.AdditionalOutput.fromDirectory('./test-results'),
    }),
  ],
});
```

### Using Stack Outputs

Stack outputs are useful in validations:

```ts
const cdkStage = new MyAppStage(...);
wave.addCdkStage(cdkStage, {
  after: [
    new cdkp.ShellScriptAction('Validate', {
      environmentVariablesFromStackOutputs: {
        ENDPOINT_URL: cdkp.StackOutput.fromCfnOutput(cdkStage.endpointUrl),
      },
      commands: [
        'curl -Ssf $ENDPOINT_URL',
      ],
    }),
  ],
});
```

### CodeBuild-specific customizations

AWS-specific customizations are passed as parameters to the Backend class for the well-defined
CodeBuild projects (build, self-update, assets, ...)

```ts
const def = new cdkp.PipelineDefinition({
  build: new cdkp.CdkBuild({
    input: cdkp.CodePipelineSource.gitHub('OWNER/REPO'),
    commands: ['npm ci', 'npm run build', 'npx cdk synth'],
    environment: {
      NPM_CONFIG_UNSAFE_PERM: 'true',
    },
  }),
});
def.addCdkStage(...);
def.addCdkStage(...);

new cdkp.CodePipeline(this, 'Pipeline', {
  definition: def,
  pipeline,
  pipelineName: 'MyPipeline',
  vpc,
  subnetSelection: { subnetType: ec2.SubnetType.PRIVATE },
  crossAccountKeys: true,
  buildEnvironment: {
    image: codebuild.CodeBuildImage.AWS_STANDARD_6,
    privilegedMode: true,
  },
  assetBuildEnvironment: {
    environmentVariables: {
      SECRET: { type: codebuild.EnvironmentVariableType.SECRETS_MANAGER, value: 'arn:aws:...:my-secret' },
    },
    additionalDockerBuildArgs: ['SECRET'],
  },
  buildCaching: true,
  cdkCliVersion: '1.2.3',
  selfMutating: false,
  pipelineUsesDockerAssets: true,
  dockerAssetBuildPrefetch: true,
  dockerCredentials: {
    '': cdkp.DockerCredentials.fromSecretsManager('my-dockerhub-login'),
    '111111.dkr.ecr.us-east-2.amazonaws.com': cdkp.DockerCredentials.standardEcrCredentials(),
  },
  buildTestReports: {
    SurefireReports: {
      baseDirectory: 'target/surefire-reports',
      files: ['**/*'],
    }
  },
});
```

If there are "anonymous" shellscript actions (as validation steps) that need to be customized, they
can be customized by substituting a specialized subclass:

```ts
def.addCdkStage(..., {
  after: [
    new cdkp.CodeBuildAction({
      environmentVariablesFromStackOutputs: {
        ENDPOINT_URL: cdkp.StackOutput.fromCfnOutput(cdkStage.endpointUrl),
      },
      commands: [
        'curl -Ssf $ENDPOINT_URL',
      ],
      buildEnvironment: {
        computeType: codebuild.ComputeType.MEDIUM,
        buildImage: codebuild.CodeBuildImage.fromAsset('./fancy-curl-image'),
      },
    }),
  ],
});
```

## Implementation FAQ

### How will this work?

The library will be organized into 2 layers and a backwards compatibility layer:

```
         ┌────────────────────────────┐
         │                            │
   C     │        CdkPipeline         │
         │                            │
         ├──────────────────┬─────────┴──────┬───────────────────────┐
         │                  │                │                       │
         │     Backend,     │  Definition,   │    Generic actions    │
   2     │ backend-specific │    Pipeline    │                       │
         │sources & actions │                │                       │
         │                  └────────────────┴───────────────────────┤
         │                                                           │
         │                                                           │
   1     │             Render to CodePipeline/CodeBuild              │
         │                                                           │
         └───────────────────────────────────────────────────────────┘
```

Layer 1 takes a Pipeline definition and renders it to a specific CI/CD runner.  In the CDK Pipelines case, a
CodePipeline with a set of CodeBuild projects and CloudFormation Actions. Backends operate by doing a lot
of type testing of the objects at level 2, and should be erroring out if they encounter classes they're not
prepared to deal with.

Layer 2 layer is a mutable object graph that represents user intent and provides Cloud Assembly parsing. It has methods
for things like querying what assets would be required to deploy a certain stage, which the backend can query
to make decisions on. Crucially, level 1 does not contain any logic that helps with deciding what it means to
publish assets, or how things should be ordered. All these kinds of decisions are left to the backend.
*dependencies*, *artifacts*. Some backend-specific classes are offered at this layer as well, notably sources
and escape hatches that allow injecting arbitrary data that only makes sense to a specific backend.

Layer 3 is a backwards compatibility layer so we don't break existing customers, *implemented in terms of*
the rest of the framework.

### How will we port to another backend?

What is the work to implement different backends for CDK deployments (like, for example, GitHub Actions)?

* Obviously, we need to add something new at layer 1
* We may need to add some new backend-specific components to layer 2 (such as new sources, or other new kinds of
  backend-specific actions).

Code sharing between backend implementations may happen naturally (as long as they are implemented in the
same library), but the framework does not provide provisions for that from the start.

That is, the CodePipeline implementation will naturally use a nested graph library with topological
sort internally to provide its functionality. Any other backends might reuse this graph library, or do something
completely different as they choose.

### Why will we stay backwards compatible?

Many people have already invested a lot of effort into writing code against the CDK Pipelines
library. The changes we are planning mostly affect the internals of the library, and we want to add
some slight enhanced expressiveness and customizability to the API.

With a little additional effort, we can make the new API additive and have the old one continue to work,
giving people the opportunity to switch over to the new API at their own pace.

### How will asset publishing work?

Asset publishing is up to the specific backend. There is no telling whether backends might want to use the `prepublish
assets → create changeset → execute changeset` strategy that the CodePipeline implementation will use, or choose to just
run `cdk deploy` instead. Hence, the framework can and will not provide any help, other than allowing to
query the set of assets that would be required for a certain deployment.

### Why are we doing this?

We are trying to stabilize the current iteration of CDK Pipelines, so that it can
be declared ready for use by all CDK users. At the same time, we are trying to make
sure our work isn't completely targeted at AWS CodePipeline only, and can be made
to work with other deployment backends like GitHub Actions.

### Why should we _not_ do this?

Maybe generalizing to multiple deployment backends is too speculative, and we shouldn't be spending effort on it.

In any case, our current front-end API is a bit awkward and can do with some optimizing (it's not as minimal and
humanist as we prefer our CDK APIs to be), and the internals need some reworking to address bits of
flow customization users currently aren't able to do, which requires mutation of an in-memory model
anyway. While doing that, it's not a *lot* of additional effort to separate out responsibilities
enough that it becomes feasible to port the concepts.

### What are the drawbacks of this solution?


### What alternative solutions did you consider?


### What is the high level implementation plan?

### Are there any open issues that need to be addressed later?


