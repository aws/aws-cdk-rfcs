# Refactoring Support

* **Original Author(s):**: @rix0rrr
* **Tracking Issue**: #201
* **API Bar Raiser**: @RomainMailler

You can now refactor the shape of your construct tree without incurring resource replacement in CloudFormation. To use refactoring support, you must be on `constructs >= 10.x.y`.

## README

When the CDK needs to allocate unique identifiers for your constructs (such as allocating *logical id*s in CloudFormation templates), it will use the full construct path of your construct to base the identifier on. The result of this is that if you refactor any part of your construct tree (for example, if you change a construct identifier, or extract a resource to new construct, thereby introducing a new scope), the generated identifiers will change. This will lead CloudFormation to think a new resource has been introduced and the old one has been removed.

To prevent this from happening, whenever you refactor part of your construct tree you should record the refactoring by calling specific methods indicating what the change was you performed. Let's run through an example.

### Example: extracting a new construct

```ts
class MyStack extends Stack {
  constructor(scope: Scope, id: string, props: MyStackProps) {
    super(scope, id, props);

    new Bucket(this, 'MyBucket');
  }
}
```

Let's say you introduce a new construct called `MyConstruct` to hold the S3 Bucket (and perhaps a couple of other resources). This will make the construct path to the bucket change from `Stack/MyBucket` to `Stack/MyConstruct/MyBucket`, and hence make it allocate a different ID which will lead to CloudFormation trying to delete the Bucket.

When you perform the refactoring, add a call to `this.node.refactor()`:

```ts
// New extracted construct
class MyConstruct extends Construct {
  constructor(scope: Scope, id: string) {
    super(scope, id);

    new Bucket(this, 'MyBucket');
  }
}

// New version of stack construct
class MyStack extends Stack {
  constructor(scope: Scope, id: string, props: MyStackProps) {
    super(scope, id, props);

    new MyConstruct(this, 'MyConstruct');
    this.node.refactor(this, 'MyBucket', 'MyConstruct/MyBucket');
  }
}
```

Using this information, CDK will keep on generating the same unique identifiers as from before the refactoring.

Put the refactoring calls in the closest where you removed or renamed the resource.

### Supported refactorings

The following refactorings are supported:

* Renaming a construct.
* Moving a construct from the current scope into a deeper scope, or vice versa.
* Moving a construct between two deeper scopes.

It is not possible to move a construct into a bigger scope, or reference a construct from a bigger scope.

It is also not possible to refactor across Stack boundaries. Refactoring only affects the unique identifiers generated for constructs, it does not actually move the construct to a new parent.

To encode a literal `/` into a construct id, double it (`//`).

> Pre-emptive FAQ:
>
> **Why not `\` to escape?** — backslashes will need to be escaped in strings in most programming languages already, forcing people to type `"\\/"` to properly escape a forward slash, and `"\\\\"` to type a single literal `\`, which seems pretty onerous. The
> **Why not an array of strings?** — the syntactic overhead in jsii languages is pretty ugly (`Array.of("a", "b")`, `[2]string{"a", "b"}`, `new [] {"a", "b"}`).

### Testing

To make sure you don't forget to insert the appropriate refactoring calls, CDK comes with testing facilities to check the stability of your logical IDs. Add a single test for each of your stacks that looks like this:

```ts
test('test logical id stability', () => {
  const stack = new MyStack(app, 'MyStack');

  const template = Template.fromStack(stack);
  template.assertLogicalIdsMatchSnapshot({
    statefulResources: true,

    includeResources: ['AWS::ElasticLoadBalancingV2::LoadBalancer'],

    excludeResources: ['AWS::SQS::Queue'],

    directory: 'test/__snapshots__',
  });
});
```

Stateful resources are included by default; you can select additional resource types you are interested in. The test will succeed if new resources have only been added, in which case a new snapshot file will be written to disk which you should commit. Otherwise, if any resources have disappeared from the snapshot list, the test will fail and you probably need to add a `refactor` call.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @RomainMuller
```

## Public FAQ

### What are we launching today?

The `constructs` library now has support for keeping generated unique identifiers consistent, even as you move rename or move constructs around in the construct tree.

### Why should I use this feature?

If you ever quickly set up a CDK stack and deployed it, and now want to bring order to your code by extracting related resources into a construct, you will have noticed that this will affect your existing stacks.

With this refactoring support you can organize your code without causing impact to your existing stacks.

## Internal FAQ

### Why are we doing this?

The ability to reorganize your code to make it more readable is fundamental to good software engineering, which CDK aims to support. Its current behavior is hindering good software practices.

### Why should we _not_ do this?

The current product has some affordances that attempt to give control over logical IDs to users, but those solutions are incomplete and do not work at scale.

### Currently available solutions

Currently, the following mechanism are available to users:

- `CfnElement.overrideLogicalId(id)`/`Stack.allocateLogicalId(element, id)`
- `Stack.renameLogicalId(oldId, newId)`

The first two are equivalent: given an (L1) resource, they allow controlling the logical ID of that resource in the containing stack.

The second allows for renaming a new logical id (after refactoring) to a known old logical ID (from before the refactoring), in order to prevent resource replacement.

Downsides of the existing mechanisms are:

- **Non-locality**: for many reasons[1], the responsibility of applying logical ID control must be on the person who assembles the `Stack`.
  - In a complex application with a deeply layered construct tree, the person who maintains the Stack may be far removed (in time and knowledge) from the person who actually performed the refactoring.
  - If a construct contains a refactoring and is used in multiple Stacks, all Stacks need to have a refactoring applied, which does not scale.
- **Logical ids only**: current methods only allow control of the logical ID. However, the construct library contains other (physical) identifiers that are derived from the construct tree, which can currently not be controlled.

In contrast, the mechanism proposed here requires adding a bit of local information at the time and place where the refactoring is performed, and will affect all identifiers derived from the construct tree.

### What is the technical solution (design) of this feature?

The feature will be implemented in the `constructs` library. A record of refactorings will be maintained in each construct node, and construct nodes will have two methods to calculate a construct path:

- The "real" construct path
- The "identifier" construct path

All methods that calculate identifiers will be rewritten to use the second root path.

We will add misuse protection. It is important that when a construct is "virtually" moved into the location of another, that that location is not reused by a meaningful construct, as their identifiers would start to collide. In the example given above:

```ts
this.node.refactor(this, 'MyBucket', 'MyConstruct/MyBucket');
```

It is important that:

- There is not any construct already named `MyBucket`.
- No new construct named `MyBucket` will be created after this call.

To that end, the `refactor` call will error if the source construct path refers to an existing resource, and drop a new type of construct called `RefactoredNode` in the location of the moved-away resource[1]. That way, users will not be able to create a new construct in its place.

> [1] In fact, it should be a construct that also cannot have children added to it. We don't have this mechanism currently, but we will not introduce it until we see this causing problems.

### Alternatives

This proposal only addresses identifiers. Some calls dig directly into the construct path to find children, such as `construct.node.tryFindChild()`. Those will continue to operate on the "real" construct path, and therefore will not find refactored constructs.

To prevent from breaking intrusive traversal of the construct tree upon refactoring, we could consider actually *moving* construct nodes upon a refactoring. Or, we could have traversal automatically follow the `RefactoredNode` construct nodes.

I have not thought deeply on what the downsides on this would be, but it seems scary. It seems prudent to start with identifier support first, and potentially add real movement later if we ever decide that it's necessary after all.

### What are the drawbacks of this solution?

There are potentially complex interactions between the current logical id manipulations and this refactoring mechanism. Also, there may be some subtlety in working out how different refactorings interacting at different levels chain correctly to lead to the expected end situation.

We will use intensive testing of randomly generated test cases (a.k.a. "property testing").

### What is the high-level project plan?

- First, implement in `constructs` and add an extensive property-based test suite on the stability of interacting `refactor`s.
- Then, import into CDK and add another test suite on the interactions between refactoring and the logical ID manipulation methods.
- We should top of this off with a blog post as this will be an important capability for many users and it should be given a good amount of publicity.
- Integrate blog post into Developer Guide.
