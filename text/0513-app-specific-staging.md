# Application Specific Staging Resources

* **Original Author(s):**: @rix0rrr
* **Tracking Issue**: #513
* **API Bar Raiser**: -

Currently, to deploy any interesting applications the CDK requires an account to be bootstrapped: it requires the
provisioning of roles and staging resources to hold "assets" (files and Docker images) before any application can
be deployed.

If those staging resources could be created as part of a normal application deployment, the requirement to precreate
those resources is dropped. Users can choose to provision roles if they want to enable CI/CD or cross-account
deployments, or they can choose not to bootstrap at all if they want to use existing credentials.

## A brief history of synthesizers and bootstrapping

The AWS CDK needs some infrastructure to deploy applications into an account and region. What supporting resources exist
and what their names are is a contract between the CDK application and the AWS account. "Synthesizers" are the part of
a CDK application that encode this contract: users prepare their account a certain way, and then pick a synthesizer
that matches the resources they have provisioned (optionally configuring it with non-default parameters). Synthesizers
were introduced in CDKv2; before that, there was only "the" default assumptions that the CDK would make about "the"
account, and none of it was configurable.

The process of preparing an AWS account to be used with a synthesizer is called "bootstrapping".


### V1

In the original bootstrapping stack, we create an S3 bucket to hold files: large CloudFormation templates and assets
such as Lambda code. ECR repositories are created on-demand by the CLI, if Docker images needed to be uploaded.
Originally, we added in a Custom Resource to the template that would clean up the ECR repository when the Stack gets
cleaned up. In 1.21.0, we removed this, and now leave cleanup of dynamically created ECR repositories to users. Asset
locations are completely controlled by the CLI via parameters.

All deployments are being done with the credentials of the user that runs the CLI.

DOWNSIDES

* Assets take up template parameters, of which there is a limited amount (~50 when we built this system)
* The dynamism and arbitrary ECR repo creation does not work well in CI/CD systems.
* The user must have CLI credentials for each account they want to deploy to, and if a single app deployment should
  go into multiple accounts they must selectively deploy stacks into different accounts using different sets of
  credentials.

### V2

The bootstrap resources were redesigned as part of the development of CDK Pipelines, an opinionated construct that
allows trivial deployment of any number of CDK stacks to any number of accounts and regions. The design was designed to
work for the CLI, a CodePipeline-based solution, as well as other CI/CD solutions in general. It also allows
cross-region deployments.

To that end, the bootstrap stack now creates (for each account and region combination):

* A single S3 bucket and single ECR repository with well-known names (that need to be reflected in the CDK app if they are non-standard).
* An encryption key for the S3 bucket
* An Execution Role for the CloudFormation deployment
* A role to trigger the deployment, a role to write to the S3 bucket, a role to write to the ECR repository
* A role to look up context in the account
* An SSM parameter with a version number of the bootstrap stack

This solution solves for the CI/CD and cross-environment deployments by pre-provisioned roles, and removes
the need for parameters by rendering the location of each asset directly into the template.

DOWNSIDES

* Some users don’t like the pre-provisioned roles and prefer the v1 situation where their existing credentials were used
  for permissions.
* A common complaint about the bootstrap stack is that the resources we create by default do not comply with a given
  corporate policy, followed by an endless stream of feature requests to add this-and-that feature to the bootstrap
  stack (block public access, block SSL, tag immutability, image scanning, etc. etc). We solve this by telling customers
  to take the bootstrap template and customize it themselves, but CloudFormation templates can’t be patched simply and
  this requires users to effectively “fork” our bootstrap stack and manually keep it up-to-date with incoming changes.
* Because all staging resources need to be provisioned a priori and need to serve all types of applications, we can't
  depend on application knowledge. Specifically, we won't know how many Docker images will be used in the application,
  so we create a single ECR repository to hold all images. This has a number of downsides:
    * Docker caching relies on pulling the “latest” image from a repository and skipping layers that were already built.
      This doesn’t work if images built off of various different Dockerfiles are in the same repository.
    * Lifecycle policies cannot be used because different images from potentially different applications with very
      different life cycles are all in the same repository. The same was already true for S3, but the problem is
      less severe because S3 is pretty cheap while ECR is not.
    * Some people were using the V1 Docker image publishing mechanism not as a vehicle for uploading Docker images to be used
      by the CDK’s CloudFormation deployment, but simply as a mechanism for building and publishing Docker images, to be
      used by a completely different deployment later. The lack of control over the target ECR repository breaks this
      use case (required the development of an `aws-ecr-deployments` construct module, which does give the necessary
      control but racks up costs by doubling ECR storage requirements, and still does not allow staging resource cleanup).
    * We always create an empty ECR repository because we cannot know whether apps deployed into the account will need
      it or not, so the ECR repository may go unused. AWS Security Hub will throw warnings about empty ECR repositories,
      which makes customers uneasy.
* Bootstrap stacks are expected to be account-wide, and mix assets from all applications. Some customers that deploy
  multiple applications into the same account are very sensitive to this mixing, and would rather keep these resources
  separate. They can do multiple bootstrap stacks in the same account, but this is all a bit onerous.

## A new proposal: application specific staging resources

The bootstrap stack contains two classes of resources: staging resources, which hold assets (bucket and ECR repo), and
roles, which allow for unattended (CI/CD) and cross-account access. In the new proposal, we will separate out the
staging resources from the roles. Roles will still be bootstrapped (if used), but staging resources will not.

* Staging resources will be created on a per-CDK app basis. We will create one S3 bucket with different object prefixes
  for different types of assets (see Appendix A: two types of assets), and an ECR repository per Docker image. Resource
  access roles can also be created on an as-needed basis. This solves the problems of asset resources of different
  applications mixing together, and it would also remove the need for garbage collection by allowing use of life cycle
  rules.
* Since the roles are now the only things that need to be bootstrapped, that will have a number of advantages:
    * Bootstrapping will be faster since the heavy resource of a KMS key is no longer involved.
    * Because roles are a global resource, every account now only needs to be bootstrapped once. First of all the lack
      of necessary control of regions will work a lot better with Control Tower+automatic Stack Sets (which does not
      allow region control).

If we can make the bootstrapping resources part of the CDK application, then users now have a familiar way to customize
them to their heart’s content, so the treadmill of bootstrap stack customization requests is going to disappear, and
customers will also not need to customize the bootstrap template anymore (assuming their customizations have to do with
the resources instead of the roles).

A downside is potentially that we lose the ability to have a version number on the bootstrapped resources (because SSM
is not global), but we might say that’s not necessary anymore since the Roles are unlikely to change often.

> If we wanted to maintain versioning on the Roles, we could say that the stack always must be deployed in `us-east-1`
> and that’s where we look for the version; however, this may require cross-internet traffic and therefore be considered
> dodgy from a reliability perspective, and we could only do the versioning check using the CLI, not from the
> CloudFormation template.  Of course we’ll have to pick the correct leader region per partition, `aws-cn`, `aws-iso`, etc.

### How it will work in practice

Bootstrapping resources are currently designed the way they are because the CLI relies on the assumption that the
bootstrap resources are present with a well-known name, before the first CloudFormation deployment starts. In other
words, this is purely a limitation of the orchestration, that we can take away.

Here’s what we’re going to do:

* We will introduce a new Stack Synthesizer, called `AppStagingSynthesizer`.
* This synthesizer will create a support stack with the bucket, and an ECR repository per Docker image.
* Assets will have a dependency on the support stack. This is a new concept that doesn’t currently exist because assets
  are an orchestration artifact that looks independent like stacks are, but they aren't really: in practice the orchestration
  ignores everything except stacks, and treats assets as being part of a stack.
    * Docker assets may still be built before the first deployment (although for proper caching we need the repository
      to exist first), but will only be uploaded when it’s their time in the orchestration workflow.
* For a minimal diff these resources could have fixed names, but we could add support for Stack Outputs and assets could
  have support for Parameters, so that we can thread generated bucket and repository names through the system. For now,
  we will do fixed names for the staging resources.

### What the API looks like

To use the new synthesizer:

```ts
import { AppStagingSynthesizer } from '@aws-cdk/app-staging-synthesizer';

const app = new App({
  defaultStackSynthesizer: AppStagingSynthesizer.defaultResources({
    appId: 'my-app-id', // put a unique id here
    deploymentIdentities: DeploymentIdentities.defaultBootstrapRoles({ bootstrapRegion: 'us-east-1' }),

    // How long to keep File and Docker assets around for rollbacks (without requiring resynth)
    deployTimeFileAssetLifetime: Duration.days(100),
    imageAssetVersionCount: 10,
  }),
});
```

For any additional customization (such as using custom buckets or ECR repositories), `DefaultStagingStack`
can be subclasses or a full reimplementation of `IStagingResources` can be provided:

```ts
class MyStagingStack extends DefaultStaginStack {
  private bucket?: s3.Bucket;

  public addFile(asset: FileAssetSource): FileStagingLocation {
    this.getCreateBucket();

    return {
      bucketName: 'my-asset-bucket',,
      dependencyStack: this,
    };
  }

  private createOrGetBucket() {
    if (!this.bucket) {
      this.bucket = new s3.Bucket(this, 'Bucket', {
        bucketName: 'my-asset-bucket',
      });
    }
    return this.bucket;
  }
}

const app = new App({
  defaultStackSynthesizer: AppStagingSynthesizer.customFactory({
    factory: {
      obtainStagingResources(stack, context) {
        const myApp = App.of(stack);
        return new MyStagingStack(myApp, `CustomStagingStack-${context.environmentString}`, {});
      },
    },
  }),
});
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

We are launching a new synthesizer that has fewer demands on the AWS account that CDK apps are deployed into. It only
needs preprovisioned Roles, and those are only necessary for CI/CD deployments or for cross-account deployments. For
same-account, CLI deployments no bootstrapping is necessary anymore. If you are using bootstrapped roles anyway,
they only need to be provisioned in one region, making it easier to use with StackSets.

The new staging resources are specific to an application and can be cleaned up alongside the application. In addition,
the way the staging resources are structured, they now allow the use of lifecycle rules, keeping costs down for
running CDK applications over a long period of time.

### Why should I use this feature?

You should use this feature if you:

- Want to take advantage of lifecycle rules on asset staging resources;
- Do not use ECR and don't want to see the SecurityHub warning that tells you you have an empty ECR repository;
- Need to deploy to multiple regions in a set of accounts and want to use StackSets to bootstrap the accounts;
- Want to deploy an application and remove it and be sure that the assets have been cleaned up as well;

## Internal FAQ

### Why should we _not_ do this?

Users generally don't appreciate change, especially if it saddles them with busywork. While the migration path will be
purely optional, and there are definite benefits to be had, synthesis+bootstrapping is already a sore spot for users
(it’s hard to explain and therefore a bit under-documented) and introducing more churn may lead to backlash.

### What is the high-level project plan?

- We will release the new synthesizer as an optional feature, first initially only for the CLI.
- CDK Pipelines support can be added later. When Pipelines support is added, it should be taken into
  account that the time interval between stage deployments may be significant, especially if it involves manual
  approval steps. We must take care that the docker images published to the Testing stage are not rebuilt for
  the Production stage, but are replicated.
- We have to clearly explain the concept of Synthesizers, the account contract, and Bootstrapping, along with the choices
  users have and how they should navigate them in the Developer Guide.
- Customization by subclassing is possible, but we will probably have to selectively expose some protected helper
  functions to make it more convenient. We will do that when feature requests start coming in.
- After a tryout period, we will move the synthesizer into the core library and document it as a possible alternative
  in the developer guide.

### Are there any open issues that need to be addressed later?

- The template for the staging resources stack must be small enough to fit into a CloudFormation API call, which means
  it may not exceed 50kB. Since every ECR repository will add to this size, we have to limit the count. We may need
  to create multiple stacks using an overflow strategy to lift this limit.

## Appendix A: two types of assets

There are two types of assets:

* “Handoff” assets: these are temporarily put somewhere, so that in the course of a service call we can point to them.
  The service will make their own copy of these assets. For example, large CloudFormation templates and Lambda Code
  bundles are an example of this: the CloudFormation template will only read the template once during the deployment,
  and the Lambda service will make a private copy of the S3 file.
    * Rollbacks by means of a pure-CloudFormation deployment (so not fresh deployment that involves a CLI call) may
      require presence of the old handoff asset for a while, so it shouldn’t be deleted right away, but it is reasonable
      to put a lifecycle policy on handoff assets, equal to the longest period of time a user should still reasonably
      expect to want to do a rollback in (see the BONES sev2 and damage control campaign from a couple of years ago when
      the BONES team decided a month was a reasonable period and some service team wanted to roll back to a version of 2
      months old).
* “Live” assets: these get continuously accessed in their staged location by the running application. Examples are ALL
  Docker images (ECS will constantly pull from the user’s ECR container, and never make their own copy), and some
  asset-assisted conveniences like CodeBuild shellables or CFN-init scripts.
    * These can in principle only be garbage collected by mark-and-sweep: we must know they are not needed by any
      current CDK stacks, nor by any CDK stack revisions the user might want to roll back to.
    * However, for ECR images we can do slightly better: since we have an ECR repository per docker image per
      application, we can use a lifecycle policy of the form “keep only the most recent 5 images.”
    * That leaves only certain eccentric types of file assets which are not collectible (until the entire application
      gets deleted). This might be a “good enough” position to be in.
