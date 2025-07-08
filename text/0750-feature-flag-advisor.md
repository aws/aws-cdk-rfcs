# RFC: Feature Flag Advisor

* Original Author(s): [@vivian12300](https://quip-amazon.com/GGQ9EAAQ3Jw)
* Tracking Issue: [#750](https://github.com/aws/aws-cdk-rfcs/issues/750)
* API Bar Raiser: [@rix0rrr](https://quip-amazon.com/YPP9EA8Gt6Q)

CDK uses feature flags to implement changes that could impact current infrastructure. By using these flags, users can add security updates, new behaviors, or bug patches without altering your application's present state. However, because new feature flags are automatically disabled in existing projects to retain backward compatibility, users must manually track and update them as new releases become available. The cdk flags command allows you to view all flags, their recommended values, and modify the users' values.

## Working Backwards

## Help:

```
> cdk flags --help
cdk flags 
Finds and displays a report of the feature flag configuration and compares your current values with our recommended values.
 
Options:
    --set-recommended             set feature flags to their recommended states 
      --all                          set all feature flags to their recommended states     
      --unconfigured                 set unconfigured feature flags to their recommended states     
    --set-default                 set feature flags to their default states
      --all                          set all feature flags to their default states
      --unconfigured                 set unconfigured feature flags to their default states
    "#FLAGNAME#"                  modify a specific flag's state
      --set-recommended              set specific feature flag to its recommended state
      --set-default                  set specific feature flag to its default state
      --set                          set specific feature flag to any state
    
Examples:
    > cdk flags --set-recommended --all
        Feature Flag                              Recommended Value            User Value
      * @aws-cdk/...                              true                         false
      * @aws-cdk/...                              true                         false
      * @aws-cdk/...                              true                         - <unset>
      Setting all feature flags to the recommended values...

    > cdk flags --set-default --unconfigured
        Feature Flag                              Recommended Value            User Value
      * @aws-cdk/...                              true                         - <unset>
      Setting your unconfigured flags to the default values...

    > cdk flags "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021" --set
      What value would you like to change "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021" to?
      > true
        false
```

## README:

The new CLI command `cdk flags` shows you a report of your feature flag configurations that differ from our recommended states. It compares your current feature flag configurations and our recommended states. When you run `cdk flags`, a feature flags report is displayed to you in the following format: flags that do not match the recommended values and then flags that are not configured by the user at all. There will be a Menu with options for the user to configure their feature flags. 

```
> cdk flags 
    Feature Flag                              Recommended Value            User Value
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         - <unset>
  
  How would you like to proceed?
   >  Set all flags to recommended values -> sets all flags to the recommended values, resynthesizes application, and outputs diff
      Set unconfigured flags to recommended values -> sets unconfigured flags to the recommended values, resynthesizes application, and outputs diff
      Reset unconfigured flags to defaults (no impact) -> sets unconfigured flags to the default values, resynthesizes application, and outputs diff
      Modify individual flag -> prompts you to input the flag name, and offers options to set it to the recommended/default value or to provide a custom value.
```
### Expected Use Cases
#### View information about your feature flags
To view a report of all flags, users can run `cdk flags --all`. This will display a report of every feature flag in the following order: feature flags with states that match our recommendations, feature flags with states that do not match our recommended values, and lastly, unconfigured feature flags. 
```
> cdk flags --all
    Feature Flag                              Recommended Value            User Value
    @aws-cdk/...                              true                         true
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         - <unset>
  
  How would you like to proceed?
   >  Set all flags to recommended values
      Set all unconfigured flags to recommended values
      Reset all unconfigured flags to defaults (no impact)
      Modify individual flag
```
To view information about a specific flag, simply run `cdk flags "#FLAGNAME#"`. 
```
> cdk flags "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021"
    Feature Flag                                                        Recommended Value            User Value
    "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021"         true                         true
```
#### Modify your feature flag values
To modify your feature flag configurations, you can use the options `--set-recommended` and `--set-default`. In addition to these options, the `"#FLAGNAME#"` option also contains a `--set` suboption for the user to choose the new value. 

#### I want to change all my flags to the recommended states. 
To change all your feature flags to our recommended states, you can run `cdk flags --set-recommended --all`. 
```
> cdk flags --set-recommended --all
    Feature Flag                              Recommended Value            User Value
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         - <unset>
  Setting all feature flags to the recommended values...

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
#### I want to change my unconfigured flags to the recommended states. 
To change your unconfigured feature flags to our recommended states, you can run `cdk flags --set-recommended --unconfigured`.
```
> cdk flags --set-recommended --unconfigured
    Feature Flag                              Recommended Value            User Value
  * @aws-cdk/...                              true                         - <unset>
  Setting all feature flags to the recommended values...

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

#### I only want to change one feature flag to its recommended state. 
To simply modify one feature flag to our recommended state, you can run `cdk flags --set-recommended --flagName="#FLAGNAME#"`. 
```
> cdk flags --set-recommended --flagName="#FLAGNAME#"
    Feature Flag                              Recommended Value            User Value
  * @aws-cdk/...                              true                         false
  Setting all feature flags to the recommended values...

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
#### I want to modify one feature flag to a different value.
To modify one feature flag, first we view its information.
```
> cdk flags "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021"
    Description: Enable this feature flag to have cloudfront distributions use the security policy TLSv1.2_2021 by default.
    Recommended Value: true
    User Value: true
```
Additionally, to modify the state, you can run `cdk flags --set --flagName="#FLAGNAME#"`. This will return a list of values for you to choose from. 
```
> cdk flags "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021" --set
  What value would you like to change "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021" to?
  > true
    false
> true

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
#### I want to revert my changes.
After performing any of the above operations, you will be shown the difference in CloudFormation templates and asked if you would like to keep the changes as shown below. If you choose to revert the changes, you are given options to revert all flags to its previous states or just a specific one. There will be a list of flags for you to choose from to revert.
````
Would you like to accept these changes? (Accept/revert)
> revert
Would you like to revert the entire feature flag configuration to its previous state or just revert the specific change(s)?
[1] Revert all changes -> Restore all flags to their previous state
[2] Revert only changes to one feature flag -> Undo a specific flag change
[3] Exit without making any changes -> Keep your current configuration as is
> 2
Which feature flag would you like to revert?
[1] @aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021
[2] @aws-cdk/aws-s3:BucketEncryption
[3] Exit
> 1
Reverting the change for @aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021...
Resynthesizing...
The flag has been reverted to its previous state.
````

## What are we trying to solve?

Feature flags are an important tool for adding new bug fixes without affecting the current state of the application. However, feature flags often go unnoticed by the user. In order to change their configurations, users are required to manually update their `cdk.json` file, resulting in a time-consuming task. They can impact a user in many ways. For example, the @aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021 flag changed the default behavior to use the updated version TLSv1.2_2021, which is a more secure and support TLS version for CloudFront. Users who stuck with the previous version may have been exposed to security vulnerabilities and failed compliance tests. To remain Backwards Compatible, newly released feature flags are automatically disabled for existing projects, meaning that those users are required to constantly keep an eye on CDK releases to manually update their feature flags. 

This problem is more severe for users who create their CDK projects without using `cdk init` because their feature flags have not been configured at all. This results in different app behavior and missing out on potential bug fixes. By providing a straightforward `cdk flags` command to find, modify, and view their feature flag configuration, we reduce the burden on the user to maintain upkeep of their applications.


## Why should we do this?

Feature flags have the potential to improve the user experience by incorporating bug fixes and new default behavior, so it is beneficial to create a visible tool for users to increase autonomy within their CDK projects. This tool will also reduce burden on the user by allowing them to change their feature flag configurations through simple commands on their CLI. By creating a Feature Flag CLI tool, we show users with information on their feature flag configuration, inform them about available feature flags, and allow them to modify their initial feature flag states seamlessly, resulting in a better user experience.

## Why should we *not* do this?

This tool aims to simplify the feature flag configuration file by asking users if they would like to make the changes from the CLI. However, this creates a risk of users applying our recommendations without fully understanding its impact on their application. For example, a user could unknowingly enable a recommended flag that impacts behavior a user is depending on. To ensure they are informed about these changes as much as possible, any change will result in a comparison of their CloudFormation template and their modified one.

Adding a new CLI tool also increases the CDK CLI complexity, requiring more maintenance and support for this new feature. 

## What alternative solutions did you consider?

Another solution could be to prompt users to configure their feature flags when they create their CDK app using `cdk init`. This increases visibility to the feature flags and can be integrated smoothly within their project creation process. However, this does not help existing projects and could be considered an inconvenience and unnecessary by users. 

## What is the technical solution (design) of this feature? 

To implement this feature, we would first generate a Feature Flag Report artifact to be stored in CloudAssembly. The report is a `Record` of individual `FeatureFlag` objects that contain the fields `userValue`, `recommendedValue`, and `summary.` When the `cdk flags` command is run, the CLI accesses this artifact stored in `manifest.json` and displays the report to the user. A backup of the previous version of `cdk.out `will be stored in memory for future comparison. When the user chooses to modify a specific feature flag to our recommended value, that value is changed in  `cdk.json` and the entire application resynthesizes. After resynthesizing, the CloudFormation template is compared to the one prior to the change and displayed to the user. If the user wishes, they can restore their previous version by rejecting the changes. 

![Feature Flag Advisor Design](../images/featureflagadvisor.png)


## Additional Considerations

### Increasing visibility to `cdk flags`

Although this feature will increase visibility to feature flags, we still need to bring visibility to the CLI tool itself. Otherwise, CDK users continue to remain unaware of feature flags and their potential benefits. To address this, we will display a notice whenever `cdk synth` is run. This notice will be discarded once users have configured all of their flags. 

```
> cdk synth
Notice: You currently have **10** unconfigured feature flags that could potentially impact
your CDK application. Run `cdk flags` to learn more. 

> cdk flags 
    Feature Flag                              Recommended                  User
    @aws-cdk/...                              true                         true
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         false
  * @aws-cdk/...                              true                         - <unset>
  
  MENU ----------------------------------------------------------------------
   >  Set all flags to recommended values
      Set all unconfigured flags to recommended values
      Reset all unconfigured flags to defaults (no impact)
      Modify individual flag
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

This would not work for jsii projects as the `recommended-feature-flags.json` file would not transfer over to projects in other CDK-compatible languages. Metadata files may not transfer over to projects in languages such as Python and Java and the feature flag information needs to be accessible at all times.

### 


