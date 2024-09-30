# Reduce aws-cdk-lib package size

* **Original Author(s):**: [@madeline-k](https://github.com/madeline-k)
* **Tracking Issue**: #39
* **API Bar Raiser**: [@otaviomacedo](https://github.com/otaviomacedo)

The AWS CDK v2 framework library, `aws-cdk-lib` contains all framework packages
from AWS CDK v1 in one monolithic package. While this is a great value for
customers in making dependency management much easier, it has also resulted in
increasing the unpacked npm package size to 234 MB, at the time of writing. The
goal of this project is to significantly reduce this size.

## Working Backwards

Aside from the change in package size, the only customer-facing changes
resulting from this RFC will be the changes made to dynamically load dependencies
for the `lambda-layer` submodules. Since these changes may cause a breaking
change for customers depending on their environment, we will release in two
steps.

### CHANGELOG

#### v2.Y.0

##### ⚠ BREAKING CHANGES TO EXPERIMENTAL FEATURES

- **lambda-layer-awscli, lambda-layer-kubectl, lambda-layer-node-proxy-agent:**
  synthesis might fail in certain environments, see
  [#22470](https://github.com/aws/aws-cdk/issues/22470) for more information

##### Features

- feat(lambda-layer-awscli, lambda-layer-kubectl,
  lambda-layer-node-proxy-agent): reduce aws-cdk-lib package size, by removing
  layer.zip files

#### v2.X.0 (3 months earlier)

##### Features

- feat(lambda-layer-awscli): Dynamically load asset for AwsCliLayer, with
  bundled fallback
- feat(lambda-layer-kubectl): Dynamically load asset for KubectLayer, with
  bundled fallback
- feat(lambda-layer-node-proxy-agent): Dynamically load asset for AwsCliLayer,
  with bundled fallback

### CLI Notices

Starting with 2.X.0, we will deliver a notice to customers based on if their
application is using the layer.zip that was bundled into `aws-cdk-lib` as a
fallback. This will happen if their application is using `KubectlLayer`,
`AwsCliLayer`, or `NodeProxyAgentLayer` and their environment is not able to
download packages from npm. This could happen if the environment is network
restricted, does not have npm installed, or has npm configured to use a private
registry that does not include `@aws-cdk/asset-` packages. Customers in this
situation will see:

```
NOTICES

22470    (lambda-layer-awscli): [ACTION REQUIRED] Your CDK application is using AwsCliLayer

         Overview: Your app is using the AwsCliLayer construct in an environment
                   where npm is inaccessible. Add a dependency on @aws-cdk/asset-awscli-v1,
                   or the equivalent in your language, to remove this notice.

         Affected versions: aws-cdk-lib.lambda_layer_awscli.Notice: ^2.X.0

         More information at: https://github.com/aws/aws-cdk/issues/22470
```

Repeat the same for `lambda-layer-kubectl`, and `lambda-layer-node-proxy-agent`.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

- [x] Signed-off by API Bar Raiser
  [@otaviomacedo](https://github.com/otaviomacedo)

## Public FAQ

### What are we launching today?

Today, we are launching a smaller version of the AWS CDK v2 framework library,
`aws-cdk-lib`. Before today’s release, the unpacked size of this package was 234
MB. This large size prevented many customers from being able to use it, and
caused performance problems for others. It also prevented the CDK team from
releasing certain new features. Now, the size of the package is less than 100
MB. This smaller version also has a mechanism for adding new Lambda Layer
dependencies. Because of this launch, the AWS CDK framework will be able to add
support for more versions of kubectl, and awscliv2.

### Why should I use this feature?

You should upgrade your dependencies on `aws-cdk-lib` to get the benefits of a
smaller package size. If you use `aws-cdk-lib` in a Lambda function, now you can
include more code and dependencies before hitting the Lambda function code size
limit of 250 MB. If you use `aws-cdk-lib` in your CI/CD pipelines and are
frequently downloading it with a fresh npm install, you will see performance
improvements in the download times.

## Internal FAQ

### Why is a large package a problem? Why are we doing this?

There are many reasons this is an issue for customers. The following items need
to be addressed.

1. The package managers that `aws-cdk-lib` is published on have real or
   recommended filesize limits. For example:
    1. The v2 release currently gets this warning when publishing for Go. `Go:
       remote: warning: File awscdk/jsii/aws-cdk-lib-2.17.0.tgz is 55.42 MB;
       this is larger than GitHub's recommended maximum file size of 50.00 MB`
    2. NPM itself does not have a package size limit, but other services that
       host NPM packages do. For example, [Azure
       Artifacts](https://docs.microsoft.com/en-us/azure/devops/artifacts/reference/limits?view=azure-devops)
       has a limit of 500 MB.
    3. PyPi has an unofficially documented limit of 60 MB.
2. A large download size might be problematic for customers with weak internet
   connections or limited bandwidth.
3. Customers who download and install `aws-cdk-lib` on every CI/CD pipeline run
   may be frustrated to spend resources frequently downloading a large package.
4. AWS Lambda limits the size of your function code to 250 MB.
5. The AWS Lambda limit for all uploaded assets for a Function is 75 GB. If a
   customer is using Lambda Versions, and wants to maintain a Version for every
   version they have published, they might end up hitting this limit because of
   the large size of `aws-cdk-lib`.
6. The CDK project is currently blocked from including more 'large
   dependencies', such as multiple versions of kubectl, multiple versions of the
   AWS CLI, and dedicated versions of the AWS SDK for use in custom resources.
   This is a decision we’ve made to avoid increasing the size of the package
   further until a more scalable solution for these kinds of dependencies is
   implemented.

Most of these above issues have workarounds. For running CDK apps in Lambda, you
can use a Docker image for your Lambda code, and the limit becomes 10GB. For
package manager size limits, we can request
[increases](https://github.com/pypa/pypi-support/issues/1642), and those have
historically been approved. However, publishing a large package is a bad
practice in the open-source software ecosystem. Even if a customer has no
technical limitations for adding a 234 MB dependency to their package, it is a
red flag to them when considering using `aws-cdk-lib`. We should be
customer-obsessed, and solve the problem of `aws-cdk-lib` being a huge
dependency, before customers start complaining about it.

### Why is the package so large today?

There are some large assets contributing to the size of `aws-cdk-lib`, like
.jsii files, and zip files of dependencies used in custom resources. The library
also contains a huge volume of source code now that `aws-cdk-lib` combines 231
(and increasing) CDK modules. The table below breaks down the percentage that
each category of files contributes to the size of aws-cdk-lib.

Note: The percentages do not add up to 100. Some files, e.g. various .json
files, are excluded and contribute very little to the size.

| Category                       | Percentage of aws-cdk-lib size |
| ------------------------------ | ------------------------------ |
| .jsii files                    | 41.64%                         |
| Source Maps (.js.map)          | 21.93%                         |
| Lambda Layer zip files         | 15.48%                         |
| Javascript code (.js)          | 9.17%                          |
| Type Declaration files (.d.ts) | 9.15%                          |
| README, etc (.md)              | 0.76%                          |
| bundled npm dependencies       | 0.69%                          |
| .ts-fixture                    | 0.37%                          |
| .jsiirc                        | 0.36%                          |

### Why is the package going to be larger in the future?

The CDK team is currently blocked on adding more Lambda Layer zip files to the
AWS CDK framework, because adding them would dramatically increase the size of
the package. Each of these zips are in a module whose only purpose is to bundle
a dependency (or two) into a Lambda Layer, which is then used in custom
resources that are part of the AWS CDK framework.  We need a solution that is
scalable, so that more Lambda Layer dependencies can be added without bundling
them into `aws-cdk-lib` and significantly impacting its size. See section
[Lambda Layer Zip Files](#lambda-layer-zip-files) for the proposed solution.

There are more dependencies like these that need to be added to the framework,
but we are currently blocked on adding them with the current design because they
would increase the size too much. The current known list is:

1. Additional versions of
   [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl). This is a
   pressing problem for customers using the EKS module, who are limited to a
   single version of the kubectl CLI today.
2. Additional versions of [awscli](https://pypi.org/project/awscli/). See
   [issue](https://github.com/aws/aws-cdk/issues/13993).
3. [Boto3](https://pypi.org/project/boto3/), and
   [aws-sdk](https://www.npmjs.com/package/aws-sdk). All custom resources in the
   AWS CDK framework currently rely on whatever version of the AWS SDK that is
   available in the Lambda runtime by default. To make the custom resources more
   robust, and allow us to choose the exact version of the AWS SDK used by them,
   we should bundle these dependencies into each custom resource’s Lambda code.

If we add all of these with the current design, that would increase the size of
`aws-cdk-lib` by approximately 130 MiB*, and make the Lambda Layers the biggest
contributor of size at 39%.

*See Appendix A to see where this estimate came from.

| Category                       | Estimated future percentage of aws-cdk-lib size |
| ------------------------------ | ----------------------------------------------- |
| Lambda Layer zip files         | 38.83%                                          |
| .jsii files                    | 30.14%                                          |
| Source Maps (.js.map)          | 15.87%                                          |
| Javascript code (.js)          | 6.63%                                           |
| Type Declaration files (.d.ts) | 6.62%                                           |
| README, etc (.md)              | 0.55%                                           |
| bundled npm dependencies       | 0.50%                                           |
| .ts-fixture                    | 0.27%                                           |
| .jsiirc                        | 0.26%                                           |

### Why should we _not_ do this?

The main reason to not do this is that it will inevitably break up the
monolothic `aws-cdk-lib` package in some manner, and we will lose some of the
wonderful simplicity of releasing and using a single package. But, we can't keep
everything in one place, and reduce the size enough to have a significant
positive impact.

### What is the technical solution (design) of this feature?

There are different categories of files contributing to the size of
`aws-cdk-lib`, and each category will have its own solution. The following
sections cover the top five categories in size contribution in order from
largest to smallest potential size.

#### Lambda Layer Zip Files

Use separate npm packages for each `lambda-layer-X` module. `aws-cdk-lib` will
dynamically load in these packages using `require()`, and handle installing them
if they are not available. With this solution, customers will not have to figure
out when they do or do not need to include these dependencies, and they will not
be required to access a public endpoint besides npm during runtime of their CDK
apps. Practically, this solution breaks down into the following steps.

1. Publish `@aws-cdk/asset-aws-cli-v1`, `@aws-cdk/asset-kubectl-v20`,
   `@aws-cdk/lambda-layer-node-proxy-agent` as separate v2-compatible Construct
   libraries. Each package will expose a Construct such as `AwsCliAsset` which
   is an `s3_assets.Asset` and bundles the relevant dependency as an Asset
   construct. This publishing process will be done in
   [cdklabs](https://github.com/cdklabs) repositories. Each package will get its
   own repository. See [this issue](https://github.com/aws/aws-cdk/issues/21605)
   for a detailed discussion of the options, and why we have decided to use
   separate repositories.
2. Modify the `lambda-layer-X` submodules in `aws-cdk-lib` to dynamically load
   the appropriate `@aws-cdk/asset-X` package from step 1. This implementation
   should use `npm` commands to download and cache the package's archive in the
   CDK home directory, and then install the package into the current process's
   `node_modules`. This logic should be implemented once, and then reused in
   each `lambda-layer-X` submodule.
    1. I have implemented a POC that shows the proposed dynamic loading
       mechanism will work with node languages and jsii target languages. See
       [this
       repo](https://github.com/madeline-k/dynamically-load-npm-dependencies)
       for more details.
3. We need to keep the dependencies up-to-date to get security updates and new
   features. Each asset package will need to be treated slightly differently.
    1. Kubectl - This one has two dependencies to keep
       updated. All updates described below will result in a minor version bump
       to this package.
        1. [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl)
            1. Kubernetes users will need to be able to choose the minor version
               of kubectl that they want to use. And the aws-eks module will
               need to as well.
            2. We will release multiple packages, one for each currently
               supported minor version of kubernetes, e.g.
               `@aws-cdk/lambda-layer-kubectl-v20`. Each one will expose a
               Construct called `KubectlLayer`.
            3. A weekly automated task will check the [Kubernetes
               API](https://dl.k8s.io/release/stable.txt) for a new patch
               version of each currently supported minor version, and
               automatically update the version of kubectl used in each package.
               This update will be performed with an auto-approved PR.
            4. A weekly automated task will check for new supported minor
               versions of kubectl. If there is one, a PR will be automatically
               be created which creates a new
               `@aws-cdk/lambda-layer-kubectl-XYZ` package for the new minor
               version. A human, the on-call engineer, will need to review this
               one.
        2. [helm](https://helm.sh/) is also included in each asset in
           these packages
            1. Helm has a somewhat complicated version support policy documented
               [here](https://helm.sh/docs/topics/version_skew/).
            2. For each `@aws-cdk/lambda-layer-kubectl-XYZ` package, we will
               include the latest available version of Helm which is compatible
               with that version of Kubernetes.
            3. A weekly automated task will update the minor and patch versions
               of helm within the supported ranges.
            4. The automated task that checks for new supported minor versions
               of kubectl, will also attempt to figure out what is the latest
               version of helm compatible with that version of kubectl. This
               will be verified by a human in PR review to make sure it is
               correct.
    2. AWS CLI - We will release two separate packages to make major versions 1
       and 2 both available, and automatically update to the latest minor or
       patch version.
        1. Two packages: `@aws-cdk/lambda-layer-aws-cli-v1`, and
           `@aws-cdk/lambda-layer-aws-cli-v2`.
        2. AWS CLI v1: automatically check for new minor and patch versions from PyPi -
           [awscli](https://pypi.org/project/awscli/). Each update will
           result in a minor version bump of the corresponding package.
        3. AWS CLI v2: automatically check for new minor and patch versions from offical
           awscliv2 [Dockerfile](https://hub.docker.com/r/amazon/aws-cli). AWS CLI v2 does
           not expose an official PyPi package, but Dependabot can automatically check new
           Dockerfile versions. Each update will result in a minor version bump of the
           corresponding package.
    3. Node proxy-agent - New minor versions will
       automatically be picked up and available with a minor version bump of the
       library.
        1. This can be implemented with `npm-check-updates`, since
           `proxy-agent` is an npm package.
    4. AWS CDK v2 will automatically pick up new minor versions of the
       `@aws-cdk/asset-XYZ` packages with our current dependency upgrade
       automation.

After the above is implemented, this mechanism can be extended to include
additional Lambda Layers with different dependencies. The solution should be
implemented in such a way that new dependencies can be added with the below
steps.

1. Create a cdklabs repo and publish a Construct library called
   `@aws-cdk/asset-MyNewDependency`.
2. Add a new directory in the `aws-cdk` monorepo:
   `@aws-cdk/lambda-layer-MyNewDependency`.
3. Implement the MyNewDependencyLayer API.
4. If the dependency is from npm, then updates will happen automatically. If it
   is from some other source, then extend the automation from the above steps to
   also update the new dependency.

Once this solution is implemented, it will be possible to write more concrete
steps. And those will be included in the aws-cdk Contributing Guide.

##### What about customers executing their CDK apps in network-restricted environments?

This question raises an important drawback of this solution. It will result in a
breaking change for customers who are using these Lambda Layers in
network-restricted environments. If customers are able to use the CDK in their
network-restricted environments, then it is reasonable to assume they were able
to acquire the `aws-cdk` package from npm somehow. This implies customers will
be able to acquire the `@aws-cdk/asset-X` packages from npm. There are a
few options for these customers:

1. If using TypeScript or JavaScript, add each necessary package to the
   dependencies of their CDK app.
2. If using a target jsii language, add each necessary package as a dependency
   as they normally would for other construct libraries. Each
   `@aws-cdk/asset-X` package will be a jsii construct library, that is
   also vended to the package managers for each target jsii language. For
   example, Python users can install aws-cdk.asset-awscli-v2 from pip.
3. Include them in a private artifact registry.

Unfortunately, there is no way to remove these large files and host them
somewhere else without causing a breaking change for these customers. We will
publish a CLI notice directly to affected customers of this change
well in advance of releasing it. And, advertise the change in advance of release
on the aws-cdk GitHub repository.

##### What about customers in ADC regions?

Today, there is a mechanism for publishing AWS CDK into ADC (Amazon Dedicated
Cloud) regions. This mechanism includes bundling the direct dependencies of the
CDK and publishing them into the ADC regions, e.g. `constructs`. We will add the
`@aws-cdk/asset-X` npm packages, and their corresponding non-Node
language versions to this process. When customers use the lambda-layers in ADC
regions, the right dependencies will already be available.

#### .jsii Files

There are two files, .jsii.tabl.json and .jsii, bundled in `aws-cdk-lib` for the
jsii runtime to work for any non-NodeJS languages. And, to enable code and
documentation generation from the published npm package. Today, they make up 42%
of the package size. And in the future, after adding more Lambda Layers, the
.jsii files would compose 30% of the package size.

We will compress the .jsii.tabl.json and .jsii files. Compressing with gzip
currently creates a 4 MB and 4.7 MB file, respectively. This change will impact
the jsii runtime, and Construct Hub. NodeJS jsii runtimes don't need to use
either file, and non-NodeJS runtimes would decompress the .jsii file when
needed. Construct Hub generates documentation from the .jsii.tabl.json file, and
it will also decompress this file as needed.

#### Source Map Files (.js.map)

These files currently makeup 22% of the total size of `aws-cdk-lib`. Source map
files map from the transformed source to the original source. In the case of
`aws-cdk-lib`, these are not actually useful today, since we do not ship the
original `.ts` files. We will remove the source maps from the released package.

#### Javascript Files (.js)

The Javascript files make up about 10% of the overall package size. Today, they
are already minified in the released package. There is not much else that can be
done to make them smaller.

#### Type Declaration Files (.d.ts)

We can minify these files, which could result in a space saving of up to 20 MB.
Minifying is the process of removing new-lines and whitespace characters from
the files. The 20 MB number was collected by removing all new-line and
whitespace characters. In reality, we can not actually remove all whitespace. We
will need to maintain whitespace in documentation comments, so that
type-checking in IDEs still has readable type references. As well as the minimum
whitespace necessary for the files to still be readable when navigating to them
in an IDE from usage of `aws-cdk-lib`.

For the type declaration files, we will also pursue combining them into one file
per submodule. Currently, there is one `.d.ts` file per `.ts` file in the
`aws-cdk-lib` source code. This could lead to better compression of the library
overall. And, would improve performance for `tsc` invocations, since the
compiler would not need to read as many files. These improvements have not been
measured yet. They will be measured during the implementation to make sure the
changes are worth it.

### Is this a breaking change?

Yes, see CHANGELOG and CLI Notice sections. The solution for the Lambda Layer
zip files will have a breaking change for customers executing CDK applications
that use the Lambda Layers in some network-restricted environments. Most
alternative solutions will also have a breaking change for these customers. The
proposed solution will have the easiest migration path for these customers.

### What alternative solutions did you consider?

Each category of files has different alternative solutions to reduce the size.

#### .jsii Files

1. Vend the Rosetta tablet file (.jsii.tabl.json) separately. On each release,
   we would publish this file as a separate artifact on GitHub releases, and
   reference the URI from the jsii assembly (.jsii). This solution will not be
   pursued at this time. There are several issues with de-coupling the Rosetta
   tablet file from the artifacts that customers install, including adding a
   requirement that the jsii runtime to run in an environment that has access to
   the public endpoint where it would be hosted.
2. The .jsii.tabl.json  and .jsii files are both “pretty-printed.” We can reduce
   their size to 42 MB (-23%) and 30 MB (-33%) by removing all the whitespace
   and newlines. Since we are going to be compressing these files, removing
   whitespace doesn't have much benefit. It will not impact either the unpacked
   npm package size, or the compressed artifact size for all package manager.
   Since the files will already be compressed in both versions.

#### Source Map Files (.js.map)

1. Minifying the files, instead of removing them. Since the source maps are not
   useful in their current form, it is best to just remove them. In the future,
   we could consider adding them back in a minified form.
2. Releasing an additional 2.X.Y-debug package with every release, that will
   contain the source maps and source files. In addition to reducing the size of
   the aws-cdk-lib package, we want to reduce the volume of artifacts we publish
   to npm and other package managers in total. This would be in direct conflict
   with that goal by doubling the amount of content that is published on each
   release. And, there is currently no demonstrated customer need for a debug
   package like this.

#### Lambda Layer Zip Files

1. Host the zip files in a static website. This would be implemented as a CDK
   app in a new GitHub repository. The CDK CLI will download and cache these zip
   files at synth time. The existing `lambda-layer-X` modules will be modified
   to reference the large dependencies from a local cache. The CDK CLI will be
   modified to update that cache at synth time, if needed. Then, the rest of
   their usage will remain the same. The URLs for each dependency would follow a
   predictable format, including each dependency’s version. Some automated
   mechanism would be required to add new artifacts to the website as new
   versions of each dependency are released. And, to add new versions of each
   dependency to aws-cdk-lib. The problem with this solution is that it requires
   access to a public endpoint during synthesis of CDK applications and does not
   lend itself to a straightforward workaround for customers who run CDK apps in
   network-restricted environments (Construct Hub, ADC region customers, etc).
2. Download the the zip files from a static website in the framework
   implementation of each `Layer` class, instead of in the CLI. We should not do
   this, because the CLI already has logic for managing credentials and making
   network calls. This type of work should remain in the CLI, and not overflow
   into the framework.
3. Use regionalized S3 buckets to host the zip files. With this solution, the
   customer does not need to download the zip file and then re-upload it to
   their deployment environment. Instead, the Lambda Layer or Lambda Function
   resource definition in their CloudFormation template references the zip
   hosted by us in the same region as their deployment environment. The
   maintenance burden of keeping up with deploying these artifacts and keeping
   them up to date in every AWS region is too high. This would effectively make
   our team double as a hosted artifact repository for artifacts that we don't
   own. This solution is the same as the one described in this
   [comment](https://github.com/aws/aws-cdk-rfcs/issues/39#issuecomment-593092612).
4. Use [public Lambda
   Layers](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html).
   This would essentially be the same as alternative #3, because the code for
   each public Lambda Layer would need to reside in S3. This solution adds
   additional complexity for the naming and versioning convention of the
   artifacts, so we would likely choose S3 over this.
5. Separate packages that `aws-cdk-lib` peer depends on. With this solution,
   customers do not need to include the large `lambda-layer-X` packages in their
   dependencies unless they are actually using one of the Constructs that
   requires them. This would be confusing for customers to know when they need
   these peer dependencies, and when they do not. It would also be difficult for
   customers to manage versions and to know which versions of each package are
   compatible with each other.
6. Upstream the custom resources where the zip files are used. Since all of
   these zip files are used in custom resources, another way to remove them from
   `aws-cdk-lib` is to remove the custom resources themselves. We will create
   AWS resources that are available in the CloudFormation public registry under
   the namespace `AWS::CDK`. This option would not require customers in
   network-restricted to perform a workaround to get these dependencies. In
   addition to reducing the size of the package, this solution also has another
   benefit of addressing pain points with CDK publishing custom resources into
   customer accounts. The `XXLayer` APIs on their own are also valuable to
   customers. If we are able to remove their dependencies within `aws-cdk-lib`
   by removing the custom resources, then we could vend these libraries
   separately for customers who use them explicitly. We are not going to pursue
   this solution right now, since this will increase the operational burden on
   our team by an unknown amount. The proposed solution does not prevent us from
   also pursuing this in the future.

#### Javascript Files (.js)

No alternatives were considered yet.

#### Type Declaration Files (.d.ts)

Remove these files. We can’t remove the type declaration files, because that
would break the amazing type-checking features of CDK!

#### Generated L1 Construct files

The auto-generated L1 code overlaps with the Javascript, Source Map, and Type
Declaration categories already mentioned, and it composes about 25% of the
overall package. The size of this code grows linearly as the volume of
CloudFormation resources and features grows. Alternative solutions focusing on
this category:

1. Separate out the L1 constructs to their own library. This would compromise
   one of the major values of AWS CDK v2, which is that all AWS CDK constructs
   are in a single library, and customers no longer have to manage a complicated
   dependency tree for their CDK apps and libraries. We might consider this in
   the future as a logical way of breaking up the library into multiple
   components, if we are not able to keep the size under control with other
   solutions described in this document.
2. Invent a new way of generating this code that has a smaller footprint. This
   could be a huge undertaking, and needs a lot more investigation into whether
   there are possible solutions for this.

### What are the drawbacks of this solution?

1. This solution does not address the fact that the size of aws-cdk-lib
   increases with each weekly release, because we are adding code and new
   features at a rapid pace, and AWS is always adding new services and features.
   It is possible that after all of the proposed solutions are implemented, that
   the package size will still continue to increase past a reasonable size. At
   that point, we might need to invent more creative solutions to reduce the
   size, or implement some of the alternative solutions outlined here.

2. This solution has a breaking change for some customers. Until we get some
   feedback from the community on this RFC, we don't know for sure if the
   proposed migration for those customers is reasonable.

### What is the high-level project plan?

Each category of files can be worked on in parallel and addressed separately.

The highest priority category to start with will be the Lambda Layer zip files.
Even though the Lambda Layers are not the biggest contributor to size today,
they are the biggest potential contributor to size. And, there is customer need
to add more Lambda Layers, which we are not able to do until the large
dependencies are not required to be bundled in aws-cdk-lib.

The next category will be the .jsii files. After both of these solutions are
implemented, the the aws-cdk-lib unpacked npm package size will be about 100 MB.

The lowest priority category will be removing the Source Map files and minifying
the Type Declaration files. The final size of the package after this work is
still to be determined.

Work will be tracked on [this project
board](https://github.com/aws/aws-cdk/projects/15).

## Appendix A - Notes on size calculations

1. All size calculations in this document were done based on
   `aws-cdk-lib@2.19.0`.
2. `du -k` was used to get sizes in Kb (Kibibytes), for calculating the
   percentages.
3. The total size of the package according to `du` that was used to calculate
   percentages is 247008 Kb.
4. The total size of 234 MB that is referenced in the doc, is the unpacked size
   of version 2.19.0 according to npm.
5. The estimate for the 130 MiB increase in size for future Lambda Layer zips
   was calculated from these estimates:

   |                             | Size (KiB) | Source                                           |
   | --------------------------- | ---------- | ------------------------------------------------ |
   | kubectl                     | 23740      | actual size of zip in released package           |
   | awscli                      | 13088      | ''                                               |
   | node-proxy-agent            | 1400       | ''                                               |
   | 3 minor versions of kubectl | 71220      | = 3 * 23740                                      |
   | boto3                       | 133        | [pypi](https://pypi.org/project/boto3/#files)    |
   | awscliv2                    | 13088      | estimate same size as awscli                     |
   | aws-sdk                     | 9876       | zipped size of aws-sdk after a fresh npm install |
   | --------------------------- | ---------- | ---------------------------------------------    |
   | Total KiB                   | 132545     |                                                  |
   | Total MiB                   | 129.44     | = 132545 / 1024                                  |
