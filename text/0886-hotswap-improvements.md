# Hotswap Improvements

* **Original Author(s):**: @ShadowCat567
* **Tracking Issue**: #886
* **API Bar Raiser**: @rix0rrr

Currently hotswap is very fast for the resources it does provide support for, however we think we can make it faster.
We aim to make hotswap faster by increasing hotswap resource coverage to include resources that are commonly involved in
hotswap operations but are not currently hotswappable and making improvements to asset handling in `cdk synth` and `cdk watch`.
Resources currently supported by Hotswap:

* Lambda functions
  * file and directory assets
  * Aliases and Versions
* Step Functions States
* AppSync
  * Resolvers
  * Function Configurations
  * GraphQL Schemas
  * API Keys
* ECS Task Definition
* Codebuild Projects
* Bedrock Agentcore Runtime
* CDK Bucket Deployment custom resource

## Working Backwards

### CHANGELOG

* feat(hotswap): hotswap now covers significantly more resource types due to using a CCAPI-based deployment engine
* feat(synth): assets are only rebuilt when they need to be due to a changes
* feat(watch): synth step is skipped if only assets are being hotswapped
* feat(hotswap): hotswap deployments are now diff-ed based on the last successful hotswap deployment instead of the last full AWS CloudFormation deployment

### BLOG POST

#### AWS CDK Hotswap Deployments Are Now 25% Faster

March 18, 2026 · AWS CDK Team

Today, we are announcing a set of improvements to the AWS CDK hotswap deployment feature that reduce deployment times by at least 25%.
These changes apply to both one-off hotswap deployments (`cdk deploy --hotswap`) and continuous deployments via `cdk watch`.

#### Background

Hotswap is a CDK CLI feature that accelerates the development loop by updating AWS resources directly through service APIs,
bypassing the full AWS CloudFormation deployment process.
This allows developers to see their changes reflected in AWS in seconds rather than minutes.
Hotswap has historically supported only a limited set of resource types,
including AWS Lambda functions, AWS Step Functions, AWS AppSync, Amazon ECS Task Definitions, and AWS CodeBuild Projects.
Within those resource types hotswap supports, only a limited set of properties are allowed to be changed.
Changes to any other resource type required a full AWS CloudFormation deployment, even during active development.
This meant that many developers could not take full advantage of hotswap's speed benefits across their entire application.

#### Increased Speed through Broader Resource Coverage with AWS Cloud Control API

The primary driver behind this improvement is the introduction of a new hotswap engine built on the AWS Cloud Control API (CCAPI).
Previously, each supported resource type required a dedicated hotswap implementation.
The new CCAPI-based engine takes a different approach:
for any change that is not already handled by an existing implementation, the engine attempts to perform an in-place update using Cloud Control APIs.
If this is not possible the change is gracefully classified as non-hotswappable and routed to a fallback AWS CloudFormation deployment.
This means it will be easier for the CDK team to add hotswap support for new resource types,
since the need to write custom implementations with SDK will largely be eliminated.
Developers working with resources that previously fell outside of hotswap coverage will see the most dramatic improvement in their iteration speed
compared to performing regular AWS CloudFormation deployments.
This does not mean we will entirely abandon adding custom SDK implementations for certain resource types if there is a significant enough
speed advantage, however we believe that the CCAPI implemention will be satifactory for most situations.

#### Assets are only re-bundled when necessary during cdk synth

After the initial `cdk synth` run, assets are now only re-bundled when necessary.
This is a change that is not only useful to hotswap, but will improve `cdk synth` times across the board since
we will no longer be rebundling every asset every time `cdk synth` is run.
Instead, we will only be rebundling assets if something has changed in their source files or their build configuration that necessitates a rebuild.

#### Additional Improvements

Alongside the CCAPI-based engine, we have made some complementary improvements:

* **Optimized asset handling during cdk watch** — The `cdk synth` step is skipped when only asset files have changed during `cdk watch`.
* **Improved state tracking** — Successive hotswap deployments now diff against the last successful hotswap rather than the last full
AWS CloudFormation deployment, preventing redundant resource updates.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching a set of improvements to CDK hotswap which are primarily concerned with making hotswap faster.
These improvements will affect one off hotswap deployments (`cdk deploy --hotswap`/`cdk deploy --hotswap-fallback`)
and iterative hotswap deployments via watch (`cdk watch`).
The more expansive improvements that will affect most cdk hotswap users are expanding the coverage of hotswap using a CCAPI-based engine and
improvements to hotswapping assets such as incremental bundling and skipping the `cdk synth` phase if the hotswap change only includes asset files
which should help speed up the pre-hotswap synthesis phase.
We are also improving tracking of actual resource state when doing multiple subsequent hotswap deployments.
Our primary metric for success is that hotswap deployments will be at least 25% faster than they were previously.

### Why should I use this feature?

You should use this feature while you are working on developing and testing your CDK application.
Hotswap significantly speeds up the make a change-deploy-test loop in comparison to performing AWS CloudFormation deployments.
This will be particularly useful in speeding up the iterations your AI Agents are performing when they develop in CDK.

## Internal FAQ

### Why are we doing this?

We are doing this change because we want to speed up development iteration cycles in CDK for both humans and
AI Agents to ensure as little time is spend waiting for changes to deploy as possible so more time is spent making changes and
testing the functionality those changes produce.

### Why should we _not_ do this?

Deployment speed could be addressed somewhere else in the deployment process, such as skipping stabilization in AWS CloudFormation for
resources that don’t need it, which could allow for speed gains without introducing drift.
Hotswap and watch are still not commands that can be used in productions environments because they introduce drift,
however this is fine for the purpose of rapid iteration.
This change will not entirely address the resource coverage gap hotswap has, since we are primarily focuses on speeding up hotswap
deployments for the majority of users.
A more complete set of hotswap improvements would include a plugin interface to allow customers to write their own hotswap implementations,
however, as stated previously, full resource coverage and therefore the plugin interface are not planned for this project.

### Will there be any additional telemetry collection to support this feature?

We will collect counts of AWS CloudFormation resource types that cause hotswap deployments to fall back to a full deployment.
Hotswap fallbacks represent a performance degradation.
Users invoking hotswap expect to be put on a faster deployment path and falling back to the standard path results in
significantly longer deployment times.
This data allows us to identify which resource types are primarily responsible for causing hotswap deployments to
fallback, so we can target performance improvements to reduce hotswap deployment latency.
Where fallback rates are high for specific resource types, we may implement optimized deployment paths (such as CCAPI integration
or custom SDK logic) to eliminate the bottleneck.

### What resources will get hotswap implementations through SDK/CCAPI?

The goal of this feature is not to reinvent AWS CloudFormation and create a treadmill in the CLI.
This means, we will not be adding hotswap support for all resources AWS CloudFormation supports.
Instead we will add hotswap support for a minimal set of resource types that are most commonly used in practical iterative deployment activities.
Resources that will be supported by hotswap must meet the following criteria:

1. Hotswappable resources are in the top 80% of resources that are included in hotswap deployments but are not currently hotswappable.
If a resource type that is not currently hotswappable appears in often in hotswap deployments that is a signal that resource type should get hotswap support.
2. Hotswappable resources must recover well from drift. If making hotswap changes to a resource outside of
AWS CloudFormation routinely causes errors while attempting to recover from drift we do not consider this resource hotswappable.
3. Hotswappable resources, when implemented with CCAPIs, have a deployment speed through hotswap that is at least 2x faster than deploying through
AWS CloudFormation. We want to ensure that we are only allow listing resources that will receive significant deployments speed benefits from hotswap.

#### Resource Types that would be considered good canditates

Note that this is not a final or exhaustive list.

* `AWS::ApiGateway::RestApi`
* `AWS::ApiGateway::Method`
* `AWS::ApiGatewayV2::Api`
* `AWS::ApiGatewayV2::Integration`
* `AWS::ApiGatewayV2::Route`
* `AWS::Bedrock::Agent`
* `AWS::Events::Rule`
* `AWS::DynamoDB::Table`
* `AWS::DynamoDB::GlobalTable`
* `AWS::SNS::Subscription`
* `AWS::SNS::Topic`
* `AWS::SQS::Queue`
* `AWS::CloudWatch::Alarm`
* `AWS::CloudWatch::Dashboard`

### What is the technical solution (design) of this feature?

#### CCAPI-Based Hotswap

We are introducing a CCAPI-based implementation of hotswap which takes in changes that are not already covered
by our previously created SDK-based implementation and attempts to perform a hotswap change using Cloud Control APIs.
If the resource that we are trying to hotswap is not supported by CCAPIs or we cannot update the resource in place,
we swallow the error that would have been generated and log it as a non-hotswappable change where we use part of the error message
in the reason why this was not a hotswappable change.
We also have an allow list for resources that will not cause issues with subsequent AWS CloudFormation deployments when
hotswapped and resources where their hotswap implementation with CCAPIs is at least 2x faster than with a regular AWS CloudFormation deployment.
Changes to resource types not on this allow list will be classified has non-hotswappable changes.
[See the appendix for a prototype of the CCAPI hotswap engine](#ai-generated-implementation-of-ccapi-hotswap-engine)

#### Hotswapping Assets

Hotswapping assets has been improved in the following ways:

1. We only rebuild assets when a change happens to them that requires that they are rebuilt

Asset bundling is expensive and we want to avoid doing it unless absolutely necessary while running `cdk synth`.
To do this we compute a hash of everything that goes into bundling an asset in the Cloud Assembly
(source files and bundling configuration), the source fingerprint, and persist it in `cdk.out`.
During the first cdk synth a customer does, everything is bundled from scratch and an initial source fingerprint is computed.
On subsequent `cdk synths` (which is also run everytime `cdk deploy`/`cdk deploy --hotswap` is run) we compare
the new souce fingerprint to the old source fingerprint, cached in `cdk.out`.
If there is a change, we rebundle the asset, if there is no change, we skip bundling for that asset.

2. While running `cdk watch`, We skip the `cdk synth` step if we detect that a change only involves assets

After the initial `cdk watch` run, we cache a mapping from an asset's source path to its affiliated resources,
including what resources an asset is affiliated with, whether all those resources are hotswappable, and the asset's metadata.
On subsequent runs of `cdk watch` (triggered by file saves) we detect whether all the changes are changes to
assets affiliated with hotswappable resources.
If we only have asset changes, then we rebuild and upload the affected asset and construct a minimal template diff
from the cached mapping, then feed it through the exising hotswap detctors.
This means we would skip the overhead from synthesis and AWS Cloudformation GetTemplate API calls on asset only changes.  

#### State Tracking during Subsequent Hotswap Deployments

Currently running `cdk deploy --hotswap` updates all resources since the last AWS CloudFormation deployment.
If you are running multiple hotswap deployments in a row, this means each new template that is generated to perform the hotswap deployment
does not know about the last hotswap deployment that happened.
Which leads to creating diffs that includes changes that have already been hotswapped.
This incurs a performance penalty over time since the time it takes for a `--hotswap`
deployment to complete is proportional to the number of changed resources.
To address this problem we are saving the AWS CloudFormation template synthesized from the most recent successful hotswap deployment
so we can refer back to it when new changes are made instead of referring back to the AWS CloudFormation template from the last full deployment.
These hotswap templates are wiped when a AWS CloudFormation deployment happens and they do not attempt to alter
or replace the AWS CloudFormation template from the last successful deployment.

### Is this a breaking change?

No

### What alternative solutions did you consider?

#### Plugin system with customer-created plugins

This was the proposal associated with the initial Github issue associated with hotswap anything (https://github.com/aws/aws-cdk-cli/issues/882).
In this option we would create a plugin architecture which would allow CDK customers to write their own hotswap plugins and load them into the CLI.
This would let customers add hotswap support for their own resources without waiting for the CDK team. However, it shifts that responsibility to the community.
While some community members would write and share hotswap implementations for new resource types, only those who write their own or
find publicly shared ones would benefit.
While this would provide the benefit of increased resource coverage for those who would create plugins and would allow customers to make plugins
tailored to their environments, which could also serve the goal of making hotswap faster.
Ultimately this is an incomplete solution for the goal of increasing the speed of hotswap for the highest number of customers.

#### Classify deployment speed as problem for AWS CloudFormation to solve

We also considered classifying performance concerns about deployment speed as a problem that should be solved in AWS CloudFormation
and wait for the AWS CloudFormation team to make improvements on their end.
Any improvements the AWS CloudFormation team makes to performance is a benefit to CDK customers and
if there is a drastic deployment speed improvement in AWS CloudFormation, then hotswap could be rendered obsolete.
However, even if the AWS CloudFormation team is able to improve the performance of their service,
a custom hotswap implementation that uses SDK and CCAPI will still be faster because we can eliminate any overhead that comes from AWS CloudFormation.

### What are the drawbacks of this solution?

The main drawback of this solution is that hotswap deployments will continue to introduce drift between actual resource state and
the state AWS CloudFormation thinks the resource should be in.
We will not have the full resource coverage or customization a plugin interface could provide to customers.

### What is the high-level project plan?

This project will be completed in 3 main phases, the CCAPI engine, asset and synthesis improvements, and open hotswap issues.
I have already started working on a POC for a CCAPI-based hotswap engine (on [this branch](https://github.com/aws/aws-cdk-cli/tree/cloudcontrol-hotswap-test)),
which is based on some experiments I was doing with our current hotswap implementations.
I will be basing the CCAPI-based hotswap engine off this POC and pushing that as the first part of this project.
The second part of this project will be focused on improving asset hotswapping.
While we are working on improving asset hotswapping, we will also be working on decreasing the amount of time we spend preparing to hotswap resources.
The third part of this project will focus on addressing several open issues related to hotswapping,
including improving tracking of current resource state compared to the last time a full AWS CloudFormation deployment happened.

### Are there any open issues that need to be addressed later?

With this RFC we will be addressing as many of the open github issues relating to hotswap as possible.

## Appendix

### AI-generated implementation of CCAPI Hotswap engine

This is the general idea of what the CCAPI-based hotswap engine will look like,
however this code is untested (so it likely does not work as expected) and is not the final implementation.

```typescript
/**
 * A generalized hotswap detector that uses Cloud Control API (CCAPI) to update
 * any resource type that CCAPI supports. Used as a fallback for resource types
 * that don't have a dedicated hotswap detector.
 *
 * If the CCAPI update fails (e.g. the resource type isn't supported by CCAPI,
 * or the property requires replacement), the error is swallowed and the change
 * is reported as non-hotswappable instead.
 */
export async function isHotswappableCloudControlChange(
  logicalId: string,
  change: ResourceChange,
  evaluateCfnTemplate: EvaluateCloudFormationTemplate,
): Promise<HotswapChange[]> {
  const ret: HotswapChange[] = [];

  const changedPropNames = Object.keys(change.propertyUpdates);
  if (changedPropNames.length === 0) {
    return ret;
  }

  const classifiedChanges = classifyChanges(change, changedPropNames);
  classifiedChanges.reportNonHotswappablePropertyChanges(ret);

  if (classifiedChanges.namesOfHotswappableProps.length === 0) {
    return ret;
  }

  const identifier = await evaluateCfnTemplate.findPhysicalNameFor(logicalId);
  if (!identifier) {
    return ret;
  }

  const resourceType = change.newValue.Type;

  ret.push({
    change: {
      cause: change,
      resources: [{
        logicalId,
        resourceType,
        physicalName: identifier,
        metadata: evaluateCfnTemplate.metadataFor(logicalId),
      }],
    },
    hotswappable: true,
    service: 'cloudcontrol',
    apply: async (sdk: SDK) => {
      const cloudControl = sdk.cloudControl();

      const currentResource = await cloudControl.getResource({
        TypeName: resourceType,
        Identifier: identifier,
      });
      const currentProps: Record<string, any> = JSON.parse(
        currentResource.ResourceDescription?.Properties ?? '{}',
      );

      const patchOps: Array<{ op: string; path: string; value: any }> = [];
      for (const propName of classifiedChanges.namesOfHotswappableProps) {
        const newValue = await evaluateCfnTemplate.evaluateCfnExpression(
          change.propertyUpdates[propName].newValue,
        );
        if (JSON.stringify(currentProps[propName]) !== JSON.stringify(newValue)) {
          patchOps.push({ op: 'replace', path: `/${propName}`, value: newValue });
        }
      }

      if (patchOps.length === 0) {
        return;
      }

      await cloudControl.updateResource({
        TypeName: resourceType,
        Identifier: identifier,
        PatchDocument: JSON.stringify(patchOps),
      });
    },
  });

  return ret;
}

/**
 * Wraps the CCAPI hotswap detector so that failures during apply are caught
 * and converted into non-hotswappable rejections rather than hard errors.
 */
export async function tryCloudControlHotswap(
  logicalId: string,
  change: ResourceChange,
  evaluateCfnTemplate: EvaluateCloudFormationTemplate,
): Promise<HotswapChange[]> {
  const results = await isHotswappableCloudControlChange(logicalId, change, evaluateCfnTemplate);

  return results.map((result) => {
    if (!result.hotswappable) {
      return result;
    }

    // Wrap the apply function to catch CCAPI errors and convert them to rejections
    const originalApply = result.apply;
    return {
      ...result,
      apply: async (sdk: SDK) => {
        try {
          await originalApply(sdk);
        } catch (e: any) {
          throw new CloudControlHotswapError(change, e);
        }
      },
    };
  });
}

/**
 * Sentinel error thrown when a CCAPI hotswap apply fails. The caller in
 * hotswap-deployments can catch this and demote the change to non-hotswappable.
 */
export class CloudControlHotswapError extends Error {
  public readonly change: ResourceChange;
  public readonly cause: Error;

  constructor(change: ResourceChange, cause: Error) {
    super(`Cloud Control API hotswap failed for ${change.newValue.Type}: ${cause.message}`);
    this.change = change;
    this.cause = cause;
  }

  public toRejectedChange(): HotswapChange {
    return nonHotswappableChange(
      this.change,
      NonHotswappableReason.RESOURCE_UNSUPPORTED,
      `Cloud Control API could not hotswap this resource: ${this.cause.message}`,
    );
  }
}
```
