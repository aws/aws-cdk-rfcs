# Supporting precreated roles in CDK

* **Original Author(s):**: @rix0rrr
* **Tracking Issue**: #63
* **API Bar Raiser**: @corymhall

Make CDK work for environments where developers are not allowed to create IAM roles.

## Abstract

One of the beloved features of CDK is that it automatically creates execution roles and instance roles for all infrastructure that requires them, and assigns least-privilege permissions to these roles based on declared intent of the related infrastructure. However, some developers are working in environments where central IT operators do not allow the application developers to create any roles, to avoid potential risky situations where these roles might be misconfigured with overly broad permissions.

In those environments, using CDK is a chore: every construct and integration needs to be inspected for an optional `role?: IRole` parameter, which needs to be passed an instance of `Role.fromRoleName()`, passing the roles that have been precreated for the application developers by the IT operators. These referenced Roles need to be threaded through the entire construct tree to get to the right location, and their policies need to be determined using trial-and-error.

This RFC proposes a mechanism by which roles creation is replaced with an offline reporting mechanism. Application developers write their application as usual, using standard constructs and standard `grant` calls. Then, when this feature is switched on, `Role` resources are no longer synthesized. Instead, a report is generated containing all Roles and policies that *would* have been created, and synthesis fails. This report can be given to the central IT organization, who can create and configure the roles as reported. Afterwards, the app developer plugs in the names of the roles that the IT organization created, and synthesis succeeds (assuming all would-be Roles have name assigned).

## README: prevent creation of IAM Roles

In normal operation, L2 constructs in the AWS Construct Library will automatically create IAM Roles for resources that require them (like Execution Roles for AWS Lambda Functions and Instance Roles for EC2 instances), and assign least-privilege permissions based on the `grant`s and integrations you define.

If you work in an environment that does not allow definition of IAM Roles by application developers, you can disable
this behavior by calling `iam.Role.customizeRoles()` with `preventSynthesis: true` on the scope at which you want to prevent roles from being
created, before defining the infrastructure of your application. Example:

```ts
import { App, aws_iam as iam } from 'aws-cdk-lib';
import { MyStack } from './my-stack';

const app = new App();

// Disable synthesis of IAM Roles in the entire app
iam.Role.customizeRoles(app, {
  preventSynthesis: true,
});

new MyStack(app, 'MyStack', {
  // ...
});
app.synth();
```

The next time you run `cdk synth`, a file named `cdk.out/iam-roles.txt` will be created, containing a report of all roles that the CDK app would have created, and the permissions that would be added to them (based on `grant` methods).

For example, `iam-roles.txt` might look like this:

```text
<missing role> (/MyStack/MyLambda/Role)
    AssumeRole Policy:
        {
            "Effect": "Allow",
            "Action": ["sts:AssumeRole"],
            "Principal": { "Service": "lambda.amazonaws.com" }
        }

    Managed Policies:
        arn:(PARTITION):iam:::aws/policy/AWSLambdaBasicExecutionRole

    Identity Policy:
        {
            "Effect": "Allow",
            "Action": ["s3:GetObject"],
            "Resource": ["arn:(PARTITION):s3:(REGION):(ACCOUNT):(/MyStack/MyBucket.Arn)/*",
        }
```

If there are any roles marked as `<missing role>` (which means there is no known role name associated with them yet), synthesis will fail.

Give this report to your IT operators, and ask them to create roles with the required permissions. The policies may refer to resources which have yet to be created, and therefore have no resource names to refer to in the policies. Your IT operators will need to use wildcards or set up some form of tag-based access control when they build the permissions for these roles.

> Note: if you don't use this workflow and let CDK generate IAM Roles, it will generate least-privilege permissions Roles that can only access the resources they need to. This avoids the need to use wildcard-based pre-created Role permissions. If you can, let CDK generate Roles and use *Permissions Boundaries* to address concerns of privilege escalation. The feature described in this section is intended only to allow usage of CDK in environments where the IAM Role creation process cannot be changed.

When your IT department comes back to you, they will have created a role with a known name. For example, they might have created a role named `LambdaRole`.
Plug that name into your `customizeRoles`:

```ts
iam.Role.customizeRoles(app, {
  preventSynthesis: true,
  usePrecreatedRoles: {
    'MyStack/MyLambda/Role': 'LambdaRole',
  },
});
```

On the next synthesis, the given existing Role is automatically referenced in places where originally an IAM Role would be created. When all Roles that would be created have a precreated name assigned (and there are no precreated names specified that do not correspond to actual Role constructs), synthesis will succeed.

You do not need to create a separate Role for each construct: it is possible to supply the same role name for multiple constructs, as long as that single role has all the required permissions.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Internal FAQ

### Why are we doing this?

This change is intended to help developers that want to use CDK in environments where they do not permissions to manipulate IAM resources. This change makes it feasible to build a workflow where app developers can use CDK to build their application as normal, while delegating the IAM role creation to a different team, with minimal impact on source code and development workflow.

### Why should we _not_ do this?

It might be that the envisioned workflow doesn't match the actual workflow at the companies we're targeting, or that
the limitation around identifying individual resources makes the workflow ineffective or unacceptable (see next section).

### What are the limitations of this feature?

- If resources are created as part of the deployment, they will typically have generated identifiers. The names are not predictable, and hence IT operators will need to grant `*` permissions, which they will probably feel uncomfortable with.
  - We can potentially replicate the CloudFormation physical ID generation logic to come up with a wildcard like `"arn:PARTITION:s3:REGION:ACCOUNT:mystack-mybucket13437-*"`, but it's hard to say how reliable that will be. This strategy can not and will not work for resources that have unique IDs instead of names.
  - IT operators may impose naming scheme requirements to get around this limitation, preventing future resource replacement. This does not help the CDK as even if we know the resource name we don't currently track the known resource name to downstream resources (see below).
- Some construct libraries go and create policies directly (without going through `role.addToPrincipalPolicy()`); we will not be able to capture these permissions, and we will not be able to prevent their creation.
- Developers will need to call `grant` methods and `addToPrincipalPolicy()` in their code, to get the most out of the automatic policy report. However, the permissions will never actually be applied so it's hard to know if they are correct.

#### What do you mean we don't track known resource names?

Given the following:

```ts
const bucket = new Bucket(this, 'MyBucket', { bucketName: 'my-bucket' });
const lambda = new Lambda(this, 'MyLambda', {
  environment: {
    BUCKET_NAME: bucket.bucketName,
  },
});
```

We have the choice of rendering one of the following:

```
(1)
MyLambda:
  Properties:
    Environment:
      - Name: BUCKET_NAME
        Value: { Ref: 'MyBucket' }

----------------------------------------------

(2)
MyLambda:
  Properties:
    Environment:
      - Name: BUCKET_NAME
        Value: 'my-bucket'
```

We currently render variant `(1)`, because: even though we *know* that `bucketName` has the value `my-bucket`, the `{ Ref }` has the additional effect of implying a dependency from `MyLambda -> MyBucket`.

If we were to render the value `my-bucket` directly, we would need to recreate that dependency by adding a `DependsOn` field to `MyLambda`. Because of the way the CDK token system works internally, that is currently not available, and not easy to add.

The upshot of this is that even if IT operators force hard-naming resources (disregarding all the operational downsides
of doing so), we have no way of easily tracking that resource name to the policies.

### What is the technical solution (design) of this feature?

This section is mostly interesting for implementors:

* `customizeRoles` will set a **context key** at the given scope. The exact name and value of this context key are an implementation detail and will not be made public.
* `new Role()` will check for this context key. If found, `new CfnRole()` will *not* be called; instead, if a name is available for the current construct, `iam.Role.fromRoleName()` will be used instead. A validation is added to the Role which will fail if no precreated name is assigned for it (meaning errors are reported as construct tree errors).
* When operating in "no role creation" mode, roles will synthesize their policy documents to a report file.
* Some of the logic will have to be reimplemented for the Custom Resource framework in `@aws-cdk/core`, which creates Roles but doesn't use `iam.Role` (but rather `CfnResource`).
* `customizeRoles` takes either *absolute* or *relative* construct paths to the scope it's invoked on. This makes it possible to set it on production stacks but not development stacks (for example).
* `customizeRoles` will throw if any of the paths it is invoked on already exist, or if no `iam.Role` creation was prevented. This should help find instances of people calling it *after* application construction, instead of before.
* Tokens are not supported.
* We should be able to detect `new iam.Policy()` as well, as I believe it calls `role.attachPolicy()`. We record the policy and prevent its synthesis of `CfnPolicy`.
* I'm not sure we will be able to detect `new iam.ManagedPolicy()`.

### What alternative solutions did you consider?

This solution has the advantage of being relatively easily to implement, because it just automates some work
that developers would otherwise have to do manually (communicate about required permissions, reference them in their
code). However, it has the disadvantage of not being able to generate least-privilege permissions very well.

Potential alternatives might be better, but would require buy-in from the IT organization to change processes:

- Permissions Boundaries.
- CloudFormation Hooks which compare newly requested IAM Roles and policies to a pre-approved set (this could be treated as an extension of the feature proposed in this RFC).

### What is the high-level project plan?

MVP

- We should be able to implement the limited version of this feature (without support for tracking resource names) pretty easily. We will let developers use that feature for a while and see how it goes.
  - `customizeRoles` takes an options object on purpose so that if we need to change behavior, we can add more optional fieldds and flags.
  - Initial version will only support role names but importing by ARN should be trivial enough to add by testing for the presence of a `:` in the given role name.

POTENTIAL EXTENSIONS

- Do the same for Security Groups.
- We may extend by generating a machine-readable report in addition to a text file so organizations can build their
own automation around it.
- We may implement resource name tracking later (although this will be a lot of work) to generate more targeted policies, if enough people ask for it.
- Potentially we may add a callback interface so that organizations will be able to control their own Role handlers,
generate whatever formalism they desire.
- In a distant post-Launchpads future, we may extend this feature with an approval workflow that gets validated in CloudFormation hooks.
