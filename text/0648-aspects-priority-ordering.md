
# Priority-Ordered Aspect Invocation

* **Original Author(s):**: @sumupitchayan
* **Tracking Issue**: #648
* **API Bar Raiser**: @rix0rrr @mrgrain

Redesigning Aspect invocation in CDK by allowing users to specify the order in which Aspects are applied.

## Working Backwards

### CHANGELOG

**feat(core): Priority-Ordered Aspect Invocation**

* Introduced a priority-based ordering system for aspects in the CDK to allow users to control the order in which aspects are applied across constructs.
* Added default priority ranges to assist with common use cases (e.g., mutating aspects, readonly aspects) and to improve the execution flow of aspects.

### README

Aspects is a feature in CDK that allows you to apply operations or transformations across all constructs in a construct tree. Common use cases include tagging resources, enforcing encryption on S3 Buckets, or applying specific security or compliance rules to all resources in a stack.

Conceptually, there are two types of Aspects:

* Read-only aspects scan the construct tree but do not make changes to the tree. Common use cases of read-only aspects include performing validations (for example, enforcing that all S3 Buckets have versioning enabled) and logging (for example, collecting information about all deployed resources for audits or compliance).
* Mutating aspects either (1.) add new nodes or (2.) mutate existing nodes of the tree in-place. One commonly used mutating Aspect is adding Tags to resources. An example of an Aspect that adds a node is one that automatically adds a security group to every EC2 instance in the construct tree if no default is specified.

Users can ensure Aspects are applied in a predictable and controlled order by using the optional priority parameter when applying an Aspect. Priority values must be non-negative integers, where a higher number means the Aspect will be applied later, and a lower number means it will be applied sooner.

CDK provides standard priority values for mutating and readonly aspects to help ensure consistency across different construct libraries:

```ts
const MUTATING_PRIORITY = 100;
const READONLY_PRIORITY = 300;
```

If no priority is provided, the default value will be 200. This ensures that aspects without a specified priority run after mutating aspects but before any readonly aspects.

Correctly applying Aspects with priority values ensures that mutating aspects (such as adding tags or resources) run before validation aspects, and new nodes created by mutating aspects inherit aspects from their parent constructs. This allows users to avoid misconfigurations and ensure that the final construct tree is fully validated before being synthesized.

Applying Aspects with Priority:

```ts
import { Aspects, Stack, IAspect, Tags } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';

class MyAspect implements IAspect {
  visit(node: IConstruct) {
    // Modifies a resource in some way
  }
}

class ValidationAspect implements IAspect {
  visit(node: IConstruct) {
    // Perform some readonly validation on the cosntruct tree
  }
}

const stack = new Stack();

Aspects.of(stack).add(new MyAspect(), 100);  // Run first (mutating aspects)
Aspects.of(stack).add(new ValidationAspect(), 300);  // Run later (readonly aspects)
```

Using Aspects from a Third-Party Library

When a third-party construct adds and applies its own aspect, we can override that Aspect priority like so:

```ts
// Import third-party aspect
import { ThirdPartyConstruct } from 'some-library';

const stack: Stack;
const construct = new ThirdPartyConstruct(stack, 'third-party-construct');

// Author's aspect - adding to the stack
const validationAspect = new ValidationAspect();
Aspects.of(stack).add(validationAspect, 300);  // Run later (validation)

// Getting the Aspect from the ThirdPartyConstruct
const thirdPartyAspect = Aspects.of(construct).list()[0];
// Overriding the Aspect Priority from the ThirdPartyConstruct to run first
Aspects.of(construct).setPriority(thirdPartyAspect, 0);
```

When using aspects from a library but controlling their application:

```ts
// Import third-party aspect
import { SecurityAspect } from 'some-library';

const stack: Stack;

// Application author has full control of ordering
const securityAspect = new SecurityAspect();
Aspects.of(stack).add(securityAspect, 50);

// Add own aspects in relation to third-party one
Aspects.of(stack).add(new MyOtherAspect(), 75);
```

In all scenarios, application authors can use priority values to ensure their aspects run in the desired order relative to other aspects, whether those are their own or from third-party libraries. The standard priority ranges (100 for mutating, 200 default, 300 for readonly) provide guidance while still allowing full flexibility through custom priority values.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
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

We are launching an update to the CDK's Aspect system that allows users to control the order in which aspects are applied using a priority value. 

### Why should I use this feature?

This feature provides greater control over the aspect application process, ensuring that aspects like validation and resource configuration are applied in the correct order. It is especially useful for developers working with complex stacks and multiple aspects, where the order of execution directly affects the result.

### How does this feature work?

Aspects can now be assigned a priority when added to a construct. Higher priority values will run later, while lower values will run first. This allows users to ensure that mutating aspects are applied before validation aspects, preventing issues like failed validations or missed configurations.

### What is the default priority for aspects?

If no priority is set, aspects will default to a priority of 200. This ensures mutating aspects (with priority 100) run first, followed by general aspects, and readonly aspects (with priority 300) run last.

### Can I override third-party aspects' priorities?

Yes, if a third-party construct adds aspects with its own priority, you can override that priority by setting it when you apply your own aspects to the same construct.

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
