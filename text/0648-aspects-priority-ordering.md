
# Priority-Ordered Aspect Invocation

* **Original Author(s):**: @sumupitchayan
* **Tracking Issue**: #648
* **API Bar Raiser**: @rix0rrr @mrgrain

Redesigning Aspect invocation in CDK by allowing users to specify the order in which Aspects are applied.

## Working Backwards

### CHANGELOG

#### feat(core): Priority-Ordered Aspect Invocation

* Introduced a priority-based ordering system for aspects in the CDK to allow users to control the order in which aspects are applied across constructs.
* Added default priority ranges to assist with common use cases (e.g., mutating aspects, readonly aspects) and to improve the execution flow of aspects.

### README

Aspects is a feature in CDK that allows you to apply operations or transformations across all constructs in a construct tree. Common use cases include
tagging resources, enforcing encryption on S3 Buckets, or applying specific security or compliance rules to all resources in a stack.

Conceptually, there are two types of Aspects:

* Read-only aspects scan the construct tree but do not make changes to the tree. Common use cases of read-only aspects include performing validations
(for example, enforcing that all S3 Buckets have versioning enabled) and logging (for example, collecting information about all deployed resources for
audits or compliance).
* Mutating aspects either (1.) add new nodes or (2.) mutate existing nodes of the tree in-place. One commonly used mutating Aspect is adding Tags to
resources. An example of an Aspect that adds a node is one that automatically adds a security group to every EC2 instance in the construct tree if no
default is specified.

Users can ensure Aspects are applied in a predictable and controlled order by using the optional priority parameter when applying an Aspect. Priority
values must be non-negative integers, where a higher number means the Aspect will be applied later, and a lower number means it will be applied sooner.

CDK provides standard priority values for mutating and readonly aspects to help ensure consistency across different construct libraries:

```ts
const MUTATING_PRIORITY = 100;
const READONLY_PRIORITY = 300;
```

If no priority is provided, the default value will be 200. This ensures that aspects without a specified priority run after mutating aspects but before
any readonly aspects.

Correctly applying Aspects with priority values ensures that mutating aspects (such as adding tags or resources) run before validation aspects, and new
nodes created by mutating aspects inherit aspects from their parent constructs. This allows users to avoid misconfigurations and ensure that the final
construct tree is fully validated before being synthesized.

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

In all scenarios, application authors can use priority values to ensure their aspects run in the desired order relative to other aspects, whether
those are their own or from third-party libraries. The standard priority ranges (100 for mutating, 200 default, 300 for readonly) provide
guidance while still allowing full flexibility through custom priority values.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching an update to the CDK's Aspect system that allows users to control the order in which aspects are applied using a priority value.

### Why should I use this feature?

This feature provides greater control over the aspect application process, ensuring that aspects like validation and resource configuration are
applied in the correct order. It is especially useful for developers working with complex stacks and multiple aspects, where the order of
execution directly affects the result.

### How does this feature work?

Aspects can now be assigned a priority when added to a construct. Higher priority values will run later, while lower values will run first.
This allows users to ensure that mutating aspects are applied before validation aspects, preventing issues like failed validations or missed configurations.

### What is the default priority for aspects?

If no priority is set, aspects will default to a priority of 200. This ensures mutating aspects (with priority 100) run first,
followed by general aspects, and readonly aspects (with priority 300) run last.

### Can I override third-party aspects' priorities?

Yes, if a third-party construct adds aspects with its own priority, you can override that priority by setting it when you apply your own aspects
to the same construct.

## Internal FAQ

### Why are we doing this?

Currently, users face challenges with the order of aspect application, especially when mutating aspects are invoked out of order.
The goal of this feature is to give users fine-grained control over the execution order, ensuring that their infrastructure is set up and validated correctly.

### Why should we _not_ do this?

While this feature improves flexibility, it introduces the risk of more complex user configurations, which may be confusing for some. Users might also
need to refactor existing code to accommodate the new priority system, especially if they were relying on the previous order of aspect application.

### What is the technical solution (design) of this feature?

The feature introduces an optional priority parameter when aspects are added. Aspects are then sorted by their priority before being applied to constructs.
This ensures that mutating aspects are applied first and validation aspects follow, if the application author specifies so. Additionally, the algorithm
ensures that newly created nodes inherit aspects from their parent constructs, even if those nodes are added later in the process. See Appendix for
Pseudocode for the new `invokeAspects` function.

### Is this a breaking change?

No

### What alternative solutions did you consider?

We have two alternate solutions.

#### 1. `AspectType` enum to Encode Read-only and Mutating Aspects

Currently, there’s no clear distinction between read-only and mutating Aspects. We can fix this by introducing an optional aspectType parameter in
the new `IAspectV2` interface. This parameter will help categorize aspects as either `MUTATING` or `READONLY`. During invocation, we will execute all
`MUTATING` aspects first, followed by `READONLY` aspects. Aspects without a specified type will run after the mutating ones but before any readonly ones.

```ts
export enum AspectType {
  MUTATING,
  READONLY,
}

export interface IAspectV2 {
  aspectType?: AspectType;
  visit(node: IConstruct): void;
}
```

Then, users can specify the aspectType when writing their Aspect:

```ts
class MyMutatingAspect implements IAspectV2 {
  // Explicitly encoding the Aspect type:
  aspectType = AspectType.MUTATING
  
  visit(node: IConstruct) { ... }
}
```

Pros:

* Easy to understand and implement; minimal effort required from users.
* Solves the issue of executing read-only aspects before mutating ones.

Cons:

* Does not give users full control over the order of aspect invocation; does not address scenarios where specific ordering among mutating aspects is
necessary (e.g., ensuring aspects that create nodes are executed before those that mutate them).
  * Even if we further broke down the AspectType enum to have 3 options: READONLY, MUTATING-IN-PLACE, and MUTATING-ADD-NODE, we still don’t give customers
  the full ability to control their aspect invocation ordering.
* Existing users would need to modify their code to adapt to this new encoding of aspects.

#### 2. Multiple Passes of the Construct Tree with a Stabilization Loop

We can perform multiple passes over the construct tree to ensure that if an Aspect creates a new node, that node will inherit its parent’s Aspects and
be visited. To prevent infinite recursion, we can set a maximum iteration depth (e.g., 100 passes). If invokeAspects hits this limit while still mutating
the tree, it will throw an error. View pseudocode for this alternate solution in the Appendix.

Pros:

* Solves the first constraint without requiring changes from the customer. Newly created nodes will automatically inherit and apply their parent’s Aspects.

Cons:

* This solution doesn’t address the third constraint of Aspect ordering. We would still need a way to specify the order for cases where mutating and
validation Aspects apply to the same node.
* Validation aspects may still run before mutating ones, causing them to throw Errors and fail when they shouldn’t.
* * This solution will change customer’s infrastructure.
    * This reason alone is enough not to pursue this solution. A solution that will change customer’s infrastructure without them making any changes
    to their CDK code would be considered breaking.
* Additionally, this solution would be difficult to understand for customers, compared to assigning priority values.
  * Some times it will work as expected, but other times it will not (since we still have no way to prioritize the ordering of how mutating Aspects are
  applied).

### What are the drawbacks of this solution?

The primary risk is that users may not immediately understand the need to specify priorities, leading to issues if aspects are applied in the wrong
order. Additionally, this change may require users to revisit and update their existing code to take advantage of the new ordering system.

### What is the high-level project plan?

1. Submit this RFC and watch for feedback.
2. Implement initial changes as described in this RFC.
3. Implement additional changes (like potentially adding `priority` to the Aspect interface) depending on the feedback on this RFC.

### Are there any open issues that need to be addressed later?

We have discussed whether or not to add the `priority` property to the `IAspect` interface for users to set defaults.
For now, we are not but we can discuss this in the RFC process.

## Appendix

### New Invoke Aspects Algorithm (Pseudocode)

```
function invoke_aspects(root):
  aspects_map = collect_all_aspects(root)
  
  // Iterate through aspects sorted on priority:
  for prio in aspects_map.keys().sorted():
    for (aspect, node) in aspect_map[prio]:
        invoke_aspect(node, aspect)
  
  return
  
// Helper function for invoking an individual Aspect
function invoke_aspect(node, aspect):
  aspect.visit(node)
  // Recurse and Invoke the aspect on all the node's children (inherited Aspect)
  for child of node.children:
    invoke_aspect(child, aspect)
  
// Helper function for collecting all Aspects of the construct tree
function collect_all_Aspects(root):
  // Map of {priority : (Node, Aspect)[]}
  aspects_map = {}
    
  function aspects_from_node(node):
    for aspect of node.aspects:
      cur_prio = aspect.prio
      if cur_prio not in aspects_map:
        aspects_map[cur_prio] = []
      
      // Add Aspect to the map
      aspects_map[cur_prio] += (node, aspect)
      
    // Recurse through children
    for child of node.children:
      aspects_from_node(child)
  
  aspects_from_node(root)
  
  return aspects_map
```

### Alternate Solution #2 - Pseudocode

Here's what the `invokeAspects` function would look like for alternate solution #2, multiple passes of the construct tree with a stabilization loop:

```
// Invoke Aspects Function called on the Construct Tree.
function invokeAspects:
    for i in 0...100:
    
        // The recurse function will return a boolean indicating if it did anything to the tree.
        const didAnythingToTree = recurse(root, [])
      
        // If this pass of the recursion did not do anything, we are finished.
        if (!didAnything):
            return
    
    // Throw error if we don't return in the first 100 passes of the tree.
    throw Error('Maximum recursions reached')
     
// Helper function for recursing construct tree
function recurse(node, inheritedAspects):

    let didSomething = False
    
    // Here we combine current node's aspects with its inherited aspects
    let aspectsOfThisNode = inheritedAspects + node.aspects
    
    for aspect of aspectsOfThisNode:
        
        // We will track whether or not an aspect has been invoked for a node, probably using a Map.
        if alreadyInvoked(aspect, node):
            continue
        
        aspect.visit(node)
        didSomething = True
        
        // Continue recursion on each of the node's children
        for child of node.children:
            // 
            didSomething |= recurse(child, aspectsOfThisNode)
     
     return didSomething
```
