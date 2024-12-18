# Enhanced L1 constructs in CDK

* **Original Author(s):**: @aaythapa
* **Tracking Issue**: #655
* **API Bar Raiser**: @alias

## Background

In the CDK, Level 1 constructs or "L1s" represent constructs that directly correspond to AWS CloudFormation resources. These constructs are automatically generated primarily from the CloudFormation resource provider schema and provide a one-to-one mapping with the corresponding CloudFormation resource. Since they are automatically generated these constructs are updated on a ~weekly basis with new features and services as they are released in CloudFormation.

## Problem

A current gap with the CDK L1 constructs is their disconnect and feature gaps compared to CDK L2 constructs. L2s offer more sophisticated interfaces for AWS services, with built-in defaults, validation, enum definitions, and more. Additionally, L2s can easily reference other L2 constructs wherever a resource is required, using object references rather than attribute references. This provides developers with a richer and more intuitive experience.

In contrast, L1s constructs rely solely on primitive types for properties. Developers must hard-code all string and number properties, even when only specific values are permitted. There's is also no built-in validation with L1s. Many properties in CloudFormation must follow specific patterns if they're a string or fall within certain ranges if they're number, but developers using L1s only discover these constraints when their applications fail to deploy.

Furthermore, CDK L1s and L2s are not interoperable. L2 constructs are equipped with resource interfaces (e.g., IBucket, IRole, IKey, etc.), allowing them to be referenced seamlessly in other L2s. L1s lack these resource interfaces and can only be referenced using attribute . This becomes problematic when an L2 construct expects a resource interface rather than an attribute string, preventing L1s from being referenced within L2s.

For example when working with an L2 Lambda function, it's straightforward to pass in an L2 IAM role.

```
const lambdaRoleL2 = new iam.Role(this, 'lambdaRole', {
    ...
});
const lambdaFunctionL2 = new lambda.Function(this, 'lambdaFunction', {
    ...
    role: lambdaRole,
    ...
});
```

In this case, the developer doesn't need to perform additional steps or know specific attributes to pass. However, if they attempt to pass an L1 IAM role, it becomes more complex. They'd need to manually create an `I<Resource>` object using the L1 role's attribute.
```
const lambdaRoleL1 = new iam.CfnRole(this, 'lambdaRole', {
    ...
});
const lambdaFunctionL2 = new lambda.Function(this, 'lambdaFunction', {
    ...
    role: iam.Role.fromRoleArn(this, 'importedRole', lambdaRoleL1.attrArn),
    ...
});
```
This disconnect between L1s and L2s creates challenges for developers trying to use both in the same CDK application. Bridging this gap in a maintainable and backward-compatible way would significantly enhance the utility of L1s in CDK.

## Proposed Solution

### Adding enums and validation

#### Getting the data 

The `aws-service-spec` currently integrates various data sources (listed [here](https://github.com/cdklabs/awscdk-service-spec?tab=readme-ov-file#data-sources)), combining them into a single JSON file that serves as the source of truth for L1 generation. This JSON file is then published to NPM. The CDK repository uses this file in conjunction with the `spec2cdk` script ([here](https://github.com/aws/aws-cdk/tree/main/tools/%40aws-cdk/spec2cdk)) to generate L1s. While we can enhance the CDK L1s with enums and validations by adjusting our generation code, we first need to ensure the necessary data for this generation is available.

Within our current list of data sources we can find some enums and validation information. The registry schema, which forms the base of our source of truth, already includes some enums and validation information. We just need to modify the service spec to incorporate this information into the published JSON file. We can then expand our data sources to improve coverage. `cfn-lint` is a command line tool that helps validate CFN templates for syntax and best practices. It contains a schema that builds on the CFN Resource Provider Schemas by adding additional information from various SDKs, then repackages these schemas for distribution. We can include the information provided by `cfn-lint` into our source of truth to achieve better coverage. 

In cases where a schema doesn’t contain the required information, it doesn’t matter whether we retrieve this data from a JSON file or by executing an AWS CLI command. For instance this PR updates the enum values available for a property based on the output of an AWS CLI command defined in the docs for that property. We can build workflows that run these commands and update specific properties with new data. These workflows should support all necessary AWS CLI commands and allow flexible specification of which command to run and which property to update.

#### Representing enums in L1s

To represent enums in L1s we can follow the same implementation as enums in L2s which is to create a new type in the generation process. This will allow developers to use the static enum variables from the schema or pass in an hard coded value if needed.

#### Runtime class will be generated
```
export class Runtime {
    public static readonly PYTHON310 = new Runtime('python3.10');
    public static readonly PYTHON311 = new Runtime('python3.11');
    ...
    ...
    public readonly name: string
    protected constructor(name: string) {
        this.name = name;
    }
    public static of(value: string) {
        return new Runtime(value);
    }
}
...
runtime: Runtime.of('python3.10') # Allowed.
# OR
runtime: Runtime.PYTHON310 # Allowed
```

This implementation offers greater flexibility compared to using built-in enum types as custom values would not be allowed. This ensures that developers aren’t restricted when a CFN enum value is available but not yet included in the CDK.

### Validating properties

Currently, L1 constructs in the CDK perform minimal validation on properties, mostly ensuring type correctness. We can extend these validations by leveraging additional data from our sources. Depending on the property type, various validation rules can be applied, as defined in the schema:

1. String
    1. `minLength`: min length the string can be
    2. `maxLength`: max length the string can be
    3. `pattern`: the pattern the string must match (commonly used for arns)
    4. `enum`: the enum values the string can be, this likely won’t be part of the validation as we’ll have an enum type
    5. `const`: the constant the string must be
2. Array
    1. `minItems`: min number of items in the array
    2. `maxItems`: max number of items in the array
3. Integer
    1. `minimum`
    2. `maximum`


e.x Right now `Description` property of Lambda Function currently undergoes string validation
```
errors.collect(cdk.propertyValidator("description", cdk.validateString)(properties.description));
```
In the Registry Schema we have a maxLength value of `256` for `Description`. We can extend the validation to include this:
e.x
```
// add a validator function
errors.collect(cdk.propertyValidator("description", CfnFunctionDescriptionPropertyValidator)(properties.description));
...

// corresponding validator function
function CfnFunctionDescriptionPropertyValidator(prop: any): cdk.ValidationResult {
  ...
  const maxLength = 256
  if (prop.length > maxLength) {
    errors.collect(new cdk.ValidationResult(<Error message>));  
  }
  ...
}
```
### Delivering in a backwards compatible way

The challenge lies in delivering these changes in a backward-compatible way. We can't simply overwrite the current types, nor can we add the new types as unions with the existing ones. Doing so would break backward compatibility by violating the original type guarantees. For example, changing a property type from `string` to `string | number` would remove the certainty that the property is always a string, which could prevent developers from safely performing string-specific operations. Additionally, unions could create complications in languages other than TypeScript, such as Java, C#, or Go, where unions might be represented as objects, leading to a loss of typing information.

The best approach is to deprecate the older types/files and generate new ones with distinct names. There are several ways we could implement this:

1. Add new properties to existing L1 files: Differentiate the new properties by adding a suffix, e.g., `runtime` vs. `runtime_v2`. This follows an established pattern in the CDK, where certain properties have versioned variants (e.x here)
    1. Drawback: The UX may be confusing as developers have to decide which version of a property they want to use
2. Create new L1 files in the existing library: Here, the suffix would be added to the file name rather than the properties, e.g., `aws_lambda` vs. `aws_lambda_v2`.
    1. Drawback: This would overload the current library and may be redundant in some cases as not all properties have a _v2 so we would essentially be copying over the same thing to the new `_v2` file. For libraries with `_v2` files there may be very minimal changes.
3. Generate a new library with the new L1s: The suffix would be applied to the library name itself, e.g., `aws-cdk-lib` vs. `aws-cdk-lib-v2`.
    1. Drawback: While this would provide a clean break between the old L1s and the new we would have to maintain both versions of the library, adding more overhead. It would also present an issue every time we have new type changes, we’d have to make multiple `_v<number>` libraries

### Recommended approach

Adding new property to the existing L1s would be the recommended approach. The suffix of `_v2` should make it clear which property to use and alleviate any confusion. We can also deprecate the older properties to signal to developers to use the new one. By deprecating the older properties rather than removing them, we ensure that existing code continues to function without breaking. Developers can still use the original properties, while being encouraged to adopt the new "_v2" version at their own pace.
E.x
```
const func = new lambda.CfnFunction(this, 'test', {
      code: {
        ...
      },
      handler: 'index.handler',
      role: r.attrArn,
      runtime_v2: lambda.CfnFunction.Runtime.PYTHON310, // new V2 property
      // if both runtime and runtime_v2 are set we can throw an error
      timeout: 30
    })
```

One potential drawback would be the mismatch between L1 and their corresponding L2’s properties. For instance, L1 might have a `_v2` property while L2 still uses the older version. Since L2 properties are typically added with validations and enums in mind, there’s no immediate need to switch, but updates should be made when feasible. While the process of updating L2 properties would need to be handled manually, we could implement a notification system whenever an L2 property requires updating.

### POC

We created an initial internal POC which involved adding the new data sources to the service spec and tweaking the generation script to include validations plus create new properties when new types were introduced. We can continue that work by making the necessary changes to spec2cdk and generating CDK code from the new data.

## Resource interface

One of the main pain points of working with L1s is that they can’t be used when L2s are expected. This creates a disconnect between L1s and L2s where using both in one CDK app is difficult. To resolve this we need to find a way to pass L1s in where L2s are expected and vice versa, enhancing flexibility and allow developers to more easily adopt L1s.

### Current behavior

Most L2s currently only accept object references. This is done by hand writing resource interfaces in all L2 constructs and that interface is used whenever a construct is referenced anywhere. This gives developers a richer interaction with the referenced object as they don’t have to worry about which attribute they need to reference and they can also utilize logic encapsulated by the target object.

e.x in the Bucket L2 construct
```
export interface IBucket extends IResource {
    readonly bucketName: ...
    readonly bucketArn: ...
    ...
    addToResourcePolicy(permission: iam.PolicyStatement) ...
    grantRead(identity: iam.IGrantable, objectsKeyPattern?: any) ...
    ...
}
```
Anytime the bucket needs to be referenced in another construct it will take in IBucket
```
export interface CodePipelineProps {
    ...
    readonly artifactBucket?: s3.IBucket;
}
```

L1s on the other hand don’t have any object references and just take strings to refer to other objects (names, ARNs, ids etc). They also don’t implement resource interfaces, thus cannot be passed where L2s are expected.

### Proposed solution

To make L1s and L2s interoperable we first need to emit a minimal interface in the L1s file with a change to the generation script. This interface should include the refs attributes for that resource (marked as `primaryIdentifiers` in the schema) and any arn attributes. 

e.x for the S3Bucket L1
```
export interface ICfnBucket {
    attrBucketName ...
    attrArn ...
}
```
In the L2’s resource interface we can extend this L1 interface. We can then modify all references of the L2 interface to now take in the new L1 interface. Any location that accepted `IBucket` would now accept `ICfnBucket`

e.x in the Bucket L2
```
export interface IBucket extends ICfnBucket, IResource {
...
}
```
Any location that accepted `IBucket` would now accept `ICfnBucket`
```
export interface CodePipelineProps {
    ...
    readonly artifactBucket?: s3.ICfnBucket;
}
```
If those locations use a functionality from the L2 interface, we can do an upconversion to an `IBucket` by implementing an API that converts an `ICfn<Resource>` into an `I<Resource>`. We do a similar operation when a resource that isn’t created in the current CDK stack is referenced. This needs to done to maintain backwards compatibility and not break existing customers.

e.x
```
// takes in ICfnBucket and returns IBucket
public static fromCFNBucket(bucket: ICfnBucket): IBucket {
...
}

// use case
...
private readonly bucket: s3.IBucket;
constructor(bucket: s3.ICfnBucket) {
    super();
    this.bucket = s3.Bucket.fromCFnBucket(bucket);
}
...
```
Note that we won’t be able to change `I<Resource>` to `ICfn<Resource>` everywhere. Public properties with the type `I<Resource>` can’t be changed as developers might be using an `I<Resource>` specific property. We can work on deprecating these properties and creating new `_v2` version of the property that will accept the CFN interface

### POC

There were some internal experiments done around this idea before. We concluded that generating `ICfn<Resource>` is fairly straight forward but actually backporting the interface to our existing L2 API is manual and runs the risk of accidentally creating breaking changes e.x turning a public property `IBucket` into `ICfnBucket` (since users could be referencing `IBucket` -specific properties) or renaming a parameter to an API can cause breaking changes in Python. If we move forward with this we'll continue the work from the experiments while keeping the findings in mind.

