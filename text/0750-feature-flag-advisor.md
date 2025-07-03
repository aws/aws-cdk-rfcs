# RFC: Feature Flag Advisor

* Original Author(s): [Vivian Chen](https://quip-amazon.com/GGQ9EAAQ3Jw)
* Tracking Issue: N/A
* API Bar Raiser: [Rico Huijbers](https://quip-amazon.com/YPP9EA8Gt6Q)

The feature flag CLI tool will inform users of their current feature flag configuration and allow them to switch any/all of them to a different value.

## Working Backwards

### **Help:** 

```
> cdk flags --help
cdk flags 
Finds and displays a report of the feature flag configuration and compares users' current values with our recommended values.
 
Options:
    --switch-all          **safely** switch all feature flags to their recommended states 
    --switch-unconfigured **safely** switch unconfigured feature flags to their recommended states 
    --toggle=string       toggle the state of a specific flag
    
Examples:
    cdk flags
    cdk flags --toggle="#FLAGNAME#"
```

### README:

The new CLI command `cdk flags` shows you a report comparing your current feature flag configurations and our recommended states. When you run `cdk flags`, a feature flags report is displayed to you in the following format: flags that match the recommended values are at the top of the list, followed by flags that do not match the recommended values and then lastly, flags that are not configured by the user at all. There will be a Menu with options for the user to configure their feature flags. 

```
> cdk flags 
    Feature Flag                              Recommended                  User
    @aws-cdk/...                              true                         true
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         - (not configured)
  
  MENU --------------------------------------------------
  [1] Switch **all** flags to recommended states
  [2] Switch all **unconfigured** flags to recommended states
  [3] Switch all unconfigured flags to false state (no impact on application)
  [4] Toggle **one** flag 
```

To switch all feature flags to their recommended states, run `cdk flags --switch-all`. You will see a comparison between the previous CloudFormation template of your application and the new one. This option will access your feature flag configuration in `cdk.json` and modify them to match the recommendations.

```
> cdk flags --switch-all
    **Feature** **** **Flag** **** **Recommended** **** **User**
    @aws-cdk/...                              true                         true
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         false

Would you like to switch on all recommended flags? (Y/n)
> Y
Resynthesizing... 
Here is the difference:
- S3 Bucket:
-    Properties:
-      `BucketEncryption``:`` ``None`
+ S3 Bucket:
+    Properties:
+      BucketEncryption: 
+        `ServerSideEncryptionConfiguration``:`
+          ...
```

To switch the state of a specific feature flag, run `cdk flags --toggle="#FLAGNAME#"`. After showing the difference in CloudFormation templates, you will be asked if you would like to keep the changes or reject them.

```
> cdk flags --toggle="#FLAGNAME#"
    Feature Flag                              Recommended                  User
    @aws-cdk/...                              true                         true
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         false

Would you like to switch the state of "#FLAGNAME#"? (Y/n)
> Y
Resynthesizing... 
Here is the difference:
- S3 Bucket:
-    Properties:
-      `BucketEncryption``:`` ``None`
+ S3 Bucket:
+    Properties:
+      BucketEncryption: 
+        `ServerSideEncryptionConfiguration``:`
+          ...

Would you like to accept these changes? (Accept/reject)
> reject
- S3 Bucket:                                   --    
-    Properties:                                |
-      BucketEncryption:                        |    CURRENT VERSION 
-        ServerSideEncryptionConfiguration:     |
-          ...                                 --
+ S3 Bucket:                             --
+    Properties:                          |    INCOMING VERSION
+      BucketEncryption: None            --
Resynthesizing... 
Done.
```

## What are we trying to solve?

Feature flags are an important tool for adding new bug fixes without affecting the current state of the application. However, feature flags often go unnoticed by the user. In order to change their configurations, users are required to manually update their `cdk.json` file, resulting in a time-consuming task. They can impact a user in many ways. For example, the @aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021 flag changed the default behavior to use the updated version TLSv1.2_2021, which is a more secure and support TLS version for CloudFront. Users who stuck with the previous version may have been exposed to security vulnerabilities and failed compliance tests. To remain Backwards Compatible, newly released feature flags are automatically disabled for existing projects, meaning that those users are required to constantly keep an eye on CDK releases to manually update their feature flags. 

This problem is more severe for users who create their CDK projects without using `cdk init` because their feature flags have not been configured at all. This results in different app behavior and missing out on potential bug fixes. By providing a straightforward `cdk flags` command to find, modify, and view their feature flag configuration, we reduce the burden on the user to maintain upkeep of their applications.

## Why should we do this?

Feature flags have the potential to improve the user experience by incorporating bug fixes and new default behavior, so it is beneficial to create a visible tool for users to increase autonomy within their CDK projects. This tool will also reduce burden on the user by allowing them to change their feature flag configurations through simple commands on their CLI. By creating a Feature Flag CLI tool, we show users with information on their feature flag configuration, inform them about available feature flags, and allow them to modify their initial feature flag states seamlessly, resulting in a better user experience.

## Why should we *not* do this?

This tool aims to simplify the feature flag configuration file by asking users if they would like to make the changes from the CLI. However, this creates a risk of users applying our recommendations without fully understanding its impact on their application. For example, a user could unknowingly enable a recommended flag that impacts behavior a user is depending on. To ensure they are informed about these changes as much as possible, any change will result in a comparison of their CloudFormation template and their modified one.

Adding a new CLI tool also increases the CDK CLI complexity, requiring more maintenance and support for this new feature. 

## What alternative solutions did you consider?

Instead of creating a Feature Flag CLI tool, we could expand on `cdk synth`. If a user’s feature flags differ from our recommended values, it would display a warning or suggestion. This reduces the need for another CLI command, but this method risks negatively impacting user experience due to cluttering the `cdk synth` output if many flags differ. 

Another solution could be to prompt users to configure their feature flags when they create their CDK app using `cdk init`. This increases visibility to the feature flags and can be integrated smoothly within their project creation process. However, this does not help existing projects and could be considered an inconvenience and unnecessary by users. 

## What is the technical solution (design) of this feature? 

To implement this feature, we would first generate a Feature Flag Report artifact to be stored in CloudAssembly. The report is a `Record` of individual `FeatureFlag` objects that contain the fields `userValue`, `recommendedValue`, and `summary.` When the `cdk flags` command is run, the CLI accesses this artifact stored in `manifest.json` and displays the report to the user. A backup of the previous version of `cdk.out `will be stored in memory for future comparison. When the user chooses to modify a specific feature flag to our recommended value, that value is changed in  `cdk.json` and the entire application resynthesizes. After resynthesizing, the CloudFormation template is compared to the one prior to the change and displayed to the user. If the user wishes, they can restore their previous version by rejecting the changes. 
![Feature Flag Advisor Design](../images/featureflagadvisor.png)


## Additional Considerations

### Increasing visibility to `cdk flags`

Although this feature will increase visibility to feature flags, we still need to bring visibility to the CLI tool itself. Otherwise, CDK users continue to remain unaware of feature flags and their potential benefits. To address this, we will display a notice whenever `cdk synth` is run. This notice will be discarded once users have configured all of their flags. 

```
> cdk synth
Notice: You currently have **10** **** unconfigured feature flags that could potentially impact
your CDK application. Run `cdk flags` to learn more. 

> cdk flags 
    Feature Flag                              Recommended                  User
    @aws-cdk/...                              true                         true
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         - (not configured)
  
  MENU ----------------------------------------------------------------------
  [1] Switch **all** flags to recommended states 
  [2] Switch all **unconfigured** flags to recommended states
  [3] Switch all **unconfigured** flags to **false** **** state (no impact on application)
  [4] Toggle **one** flag 
```

### Ensuring safe configuration changes

Currently, we rely on the user to view the difference in their CloudFormation templates to determine if the change is safe or not for their application. To reduce burden on the user, we will introduce a bit masking algorithm to determine how many feature flag states can be altered without affecting the application deployment. 

## Public FAQ

### What are we launching today? 

A new CDK CLI tool that will enable users to view and modify their feature flag configurations.

### Why should I use this feature? 

Feature flags contain bug fixes and improved default configurations that could potentially help your application. This CLI tool will make enabling feature flags easier and more efficient. 

### Is this a breaking change?

No. Users will be able to view the changes they are making and reject them if necessary. 

### Why not read from `recommended-feature-flags.json` from `aws-cdk-lib` directly?

This would not work for jsii projects as the `recommended-feature-flags.json` file would not transfer over to projects in other CDK-compatible languages. 

### 


