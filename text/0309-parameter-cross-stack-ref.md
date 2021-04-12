---
rfc pr: [#311](https://github.com/aws/aws-cdk-rfcs/pull/311)
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/309
---

# [Loosely Coupled Cross Stack Ref]

Use Parameter Store parameters for cross stack references

## Working Backwards

When passing object or class properties between stacks, instead of creating a CFN Export,
Create a SSM Parameter in parameter store, then have the consuming stack create a parameter
to consume the value from parameter store

### CHANGELOG

feat(core): loosely coupled cross stack references

BREAKING CHANGE: Stacks will need to decouple their exports with dummy values

### README

#### Loosely Coupled Stack References

By default when you pass a Stack property to another Stack cdk uses cloudformation exports and Fn::ImportValue to share
the value cross stack. Adding `'@aws-cdk/core:looseCrossStackRefs'` to your cdk.json changes this behavior
so that parameter store is used for storing and retrieving values across stacks

## FAQ

### What are we launching today?

A new feature in core which enables stacks to be loosely coupled but maintain high cohesion by moving to parameters

### Why should I use this feature?

Creating standardized parameter store paths for values based on the stack we are deploying then consuming
those cross stack using the native cloudformation parameterstore parameter type gives a lot of flexibility,
allowing us to update resources as we need and then running stack updates on consuming stacks to pick up the
new values

## Internal FAQ

### Why are we doing this?

Prevent stacks being export locked and unable to update

### Why should we _not_ do this?

Exports lock resources for a reason. In some cases exports may be preferred

### What changes are required to enable this change?

A feature flag which changes the what gets returned when requesting a value from another stack

### Is this a breaking change?

Yes

### What are the drawbacks of this solution?

Tight coupling means the resources you are dependent on wont go away, in some instances
this behavior prevents breaking consumers.

### What alternative solutions did you consider?

Adding extra methods for storing and retrieving parameters from standardized paths, but
this requires a lot of overhead when developing apps

### What is the high level implementation plan?

Add a feature flag, when the flag is enabled create a parameter and return a parameter for the consuming stack

### Are there any open issues that need to be addressed later?

## Appendix
