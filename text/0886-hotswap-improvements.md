# Hotswap Improvements

* **Original Author(s):**: @ShadowCat567
* **Tracking Issue**: #886
* **API Bar Raiser**: @rix0rrr

Currently hotswap supports a very small number of resource types (see below) and we have gotten many feature requests asking for expanded hotswap coverage.
Additionally, hotswap spends about 7 seconds performing actions that are not making changes to the resources that are being hotswapped.
This time is largely spent doing language-specific compilation and synthesis.
With this feature, we aim to speed up hotswap deployments by increasing hotswap coverage and
decreasing the amount of time hotswap deployments spend not updating the requested resources.
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
* feat(hotswap): asset hotswapping has been improved
* feat(cli): by default hotswap deployments fallback to an AWS CloudFormation deployment
* feat(cli): the hotswap-fallback flag can now accept a deployment mode
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

#### Broader Resource Coverage with AWS Cloud Control API

The primary driver behind this improvement is the introduction of a new hotswap engine built on the AWS Cloud Control API (CCAPI).
Previously, each supported resource type required a dedicated hotswap implementation.
The new CCAPI-based engine takes a different approach:
for any change that is not already handled by an existing implementation, the engine attempts to perform an in-place update using Cloud Control APIs.
If this is not possible the change is gracefully classified as non-hotswappable and routed to a fallback AWS CloudFormation deployment.
This means it will be easier for the CDK team to add hotswap support for new resource types,
since the need to write custom implementations with SDK will largely be eliminated.
Developers working with resources that previously fell outside of hotswap coverage will see the most dramatic improvement in their iteration speed
compared to performing regular AWS CloudFormation deployments.

#### Additional Improvements

Alongside the CCAPI-based engine, we have made several complementary improvements:

* **Optimized asset handling** — Assets are now rebuilt only when necessary, and the cdk synth step is skipped when only asset files have changed.
This reduces pre-deployment overhead.
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

We are launching a set of improvements to CDK hotswap which will affect one off hotswap deployments
(`cdk deploy --hotswap`/`cdk deploy --hotswap-fallback`) and iterative hotswap deployments via watch (`cdk watch`).
The more expansive improvements that will affect most cdk hotswap users are expanding the coverage of hotswap using a CCAPI-based engine and
improvements to hotswapping assets such as incremental bundling and skipping the cdk synth phase if the hotswap change only includes asset files which
should help speed up the pre-hotswap synthesis phase.
We are also improving tracking of actual resource state when doing multiple subsequent hotswap deployments,
updating the fallback behavior of hotswap (hotswap will now fallback to doing a full deployment by default) and the hotswap fallback command.
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
2. We skip the cdk synth step of hotswap if we detect that a change only involves assets

Asset bundling is expensive and we want to avoid doing it unless absolutely necessary while doing hotswap deployment using `cdk watch`.
We take advantage of the watching capabilities of the watcher in `cdk watch` and register assets like
lambda function handler files to be watched for changes.
If a change happens to an asset, then we rebuild it during the next hotswap deployment.

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

#### Hotswap Fallback Mode

Currently the hotswap can only configure one type of AWS CloudFormation deployment.
If in the future AWS CloudFormation releases other deployment modes, they cannot be used as a fallback deployment mode
for hotswap deployments with non-hotswappable changes.
In response to this, we are introducing a new flag that is used in conjunction with the `cdk deploy --hotswap` command
to configure a specific fallback mode.
If the fallback flag is not present, we use the default fallback mode of `cdk deploy --hotswap`.
Current behavior will remain the same (no fallback):

```
$ cdk deploy --hotswap
```

Can now specify a deployment mode (performs a full AWS CloudFormation deployment):

```
$ cdk deploy --hotswap --fallback=FULL_DEPLOY
```

The default fallback mode for hotswap will change if AWS CloudFormation releases a deployment option that is faster than
what we currently get from AWS CloudFormation deployments.

### Is this a breaking change?

No

### What alternative solutions did you consider?

#### Plugin system with customer-created plugins

This was the proposal associated with the initial Github issue associated with hotswap anything (https://github.com/aws/aws-cdk-cli/issues/882).
In this option we would create a plugin architecture which would allow CDK customers to write their own hotswap plugins and load them into the CLI.
This would let customers add hotswap support for their own resources without waiting for the CDK team. However, it shifts that responsibility to the community.
While some community members would write and share hotswap implementations for new resource types, only those who write their own or
find publicly shared ones would benefit.
Which makes this an incomplete solution to the speed limitations that come from hotswapping non-hotswappable resources.

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

### What is the high-level project plan?

This project will be completed in 3 main phases, the CCAPI engine, asset and synthesis improvements, and open hotswap issues.
I have already started working on a POC for a CCAPI-based hotswap engine (on [this branch](https://github.com/aws/aws-cdk-cli/tree/cloudcontrol-hotswap-test)),
which is based on some experiments I was doing with our current hotswap implementations.
I will be basing the CCAPI-based hotswap engine off this POC and pushing that as the first part of this project.
The second part of this project will be focused on improving asset hotswapping.
While we are working on improving asset hotswapping, we will also be working on decreasing the amount of time we spend preparing to hotswap resources.
The third part of this project will focus on addressing several open issues related to hotswapping,
including altering the default fallback deployment type, updating the hotswap fallback command,
and improving tracking of current resource state compared to the last time a full AWS CloudFormation deployment happened.

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
