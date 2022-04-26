# Reduce aws-cdk-lib package size

* **Original Author(s):**: @madeline-k
* **Tracking Issue**: #39
* **API Bar Raiser**: tbd

The AWS CDK v2 framework library, `aws-cdk-lib` contains all packages from AWS
CDK v1 in one monolithic package. While this is a great value for customers in
making dependency management much easier, it has also resulted in increasing the
unpacked npm package size to 234 MB, at the time of writing. This feature
reduces the size of the package to under 100 MB.

## Working Backwards

* **CHANGELOG**:

feat(aws-cdk-lib): Reduce aws-cdk-lib package size.

‼️ If you use any of the following Constructs in a network-restricted
environment, you might encounter problems upgrading to this version. ‼️

* lambda_layer_kubectl.KubectlLayer
* aws_eks.KubectlProvider
* aws_eks.HelmChart
* aws_eks.KubernetesManifest
* aws_eks.KubernetesObjectValue
* aws_eks.KubernetesPatch
* lambda_layer_awscli.AwsCliLayer
* aws_s3_deployment.BucketDeploymentß
* aws_stepfunctions_tasks.EmrContainersStartJobRun
* lambda_layer_node_proxy_agent.NodeProxyAgentLayer
* aws_eks.FargateProfile
* aws_eks.Cluster

Please see [#1234](https://github.com/aws/aws-cdk/issues/1234) for more details,
and comment on the issue if you run into problems.

* **CLI Notices**:

We can deliver a notice to customers based on what specific constructs they are
using. We will define separate notices for each different scenario.

Title: (aws-cdk-lib): upcoming change in packaging structure might require
action to upgrade

Body: We’ve identified that you are using at least one of the [List of
Constructs] Constructs. If you are running your aws-cdk commands in an
environment that does not have access to npm, then you will need to make a
change to make version 2.x of [npm packages] available in your environment. See
[#1234](https://github.com/aws/aws-cdk/issues/1234) for details and
instructions.

| List of Constructs                                                                        | npm packages                                                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| KubectlLayer                                                                              | @aws-cdk/lambda-layer-kubectl                                                                           |
| KubectlProvider, HelmChart, KubernetesManifest, KubernetesObjectValue, or KubernetesPatch | @aws-cdk/lambda-layer-kubectl and @aws-cdk/lambda-layer-awscli                                          |
| AwsCliLayer, BucketDeployment, or EmrContainersStartJobRun                                | @aws-cdk/lambda-layer-awscli                                                                            |
| NodeProxyAgentLayer, or FargateProfile                                                    | @aws-cdk/lambda-layer-node-proxy-agent                                                                  |
| aws_eks.Cluster                                                                           | @aws-cdk/lambda-layer-kubectl, @aws-cdk/lambda-layer-awscli, and @aws-cdk/lambda-layer-node-proxy-agent |

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

Today, we are launching a smaller version of the AWS CDK v2 framework library,
`aws-cdk-lib`. And, a change in the AWS CDK v2 CLI to support this smaller
framework library. Before today’s release, the unpacked size of this package was
234 MB. This large size prevented many customers from being able to use it, and
caused performance problems for others. It also prevented the CDK team from
releasing certain new features. Now, the size of the package is less than 100
MB. This smaller version also has a mechanism for adding new lambda-layer
dependencies. Because of this launch, the AWS CDK framework will be able to add
support for more versions of kubectl, and awscliv2.

### Why should I use this feature?

You should upgrade your dependencies on `aws-cdk-lib` to get the benefits of a
smaller package size. If you use `aws-cdk-lib` in a lambda function, now you can
include more code and dependencies before hitting the lambda function code size
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
6. The developer experience of using `aws-cdk-lib` in an IDE might be slower in
   some cases.
7. The CDK project is currently blocked from including more ‘large
   dependencies’, such as multiple version of kubectl, multiple version of the
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

### Why is the package going to be large in the future?

The CDK team is currently blocked on adding more Lambda Layer zip files to the
AWS CDK framework, because adding them would dramatically increase the size of
the package. Each of these zips are in a module whose only purpose is to bundle
a dependency (or two) into a Lambda Layer, which is then used in custom
resources that are part of the AWS CDK framework.

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

| Category                       | Percentage of aws-cdk-lib size |
| ------------------------------ | ------------------------------ |
| Lambda Layer zip files         | 38.83%                         |
| .jsii files                    | 30.14%                         |
| Source Maps (.js.map)          | 15.87%                         |
| Javascript code (.js)          | 6.63%                          |
| Type Declaration files (.d.ts) | 6.62%                          |
| README, etc (.md)              | 0.55%                          |
| bundled npm dependencies       | 0.50%                          |
| .ts-fixture                    | 0.27%                          |
| .jsiirc                        | 0.26%                          |

### Why should we _not_ do this?

The main reason to not do this is that it will inevitably break up the
monolothic `aws-cdk-lib` package in some manner, and we will lose some of the
wonderful simplicity of releasing and using a single package. But, we can't keep
everything in one place, and reduce the size enough to have a significant
positive impact.

### What is the technical solution (design) of this feature?

There are different categories of files contributing to the size of aws-cdk-lib,
and each category will have it’s own solution. The following sections cover the
top five categories in size contribution in order from largest to smallest
potential size.

#### Lambda Layer Zip Files

For the Lambda Layers, there are two different approaches we will take to remove
these large assets from `aws-cdk-lib`.

###### Separate npm packages

Use separate npm packages for each `lambda-layer-X` module, which the CDK CLI
will automatically install if not already present in the `node_modules`
directory. With this solution, customers will not have to figure out when they
do or do not need to include these dependencies, and they will not be required
to access a public endpoint besides npm during runtime of their CDK apps.
Practically, this solution breaks down into the following steps.

1. Publish v2 compatible versions of `@aws-cdk/lambda-layer-aws-cli`,
   `@aws-cdk/lambda-layer-aws-cli`, `@aws-cdk/lambda-layer-node-proxy-agent` as
   their own npm packages, separate from `aws-cdk-lib`.
2. Modify the `lambda-layer-X` submodules in `aws-cdk-lib` to not bundle these
   large dependencies themselves, but instead reference the appropriate `Layer`
   class from the packages in step 1. We will need to do something clever here
   to make sure customers do not have IDE or compilation errors before the CDK
   CLI has an opportunity to download and install the lambda layer packages.
3. Modify the CDK CLI to verify that the correct packages are available in the
   `node_modules` directory during synthesis. If they are not available,
   download them from npm.
4. We need to keep the dependencies up-to-date to get security updates and new
   features. Each Lambda Layer will need to be treated slightly differently.
    1. `@aws-cdk/lambda-layer-kubectl` - This one has two dependencies to keep
       updated. All updates described below will result in a minor version bump
       to this package.
        1. [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl)
            1. Kubernetes users will need to be able to choose the minor version
               of kubectl that they want to use. And the aws-eks module will
               need to as well.
            2. The public API for this package will have a `KubectlV1_20Layer`
               class for each currently supported minor version of kubernetes.
            3. A weekly automated task will check the [Kubernetes
               API](https://dl.k8s.io/release/stable.txt) for a new patch
               version of each currently supported minor version, and
               automatically update the existing `Layer` class to use the new
               patch version. This update will be performed with an
               auto-approved PR.
            4. A weekly automated task will check for new supported minor
               versions of kubectl. If there is one, a PR will be automatically
               created which creates a new `Layer` class in the API for the new
               minor version. A human will need to review this one.
        2. [helm](https://helm.sh/) is also included in each Lambda Layer in
           this package
            1. Helm has a somewhat complicated version support policy documented
               [here](https://helm.sh/docs/topics/version_skew/).
            2. For each `KubectlVX_YLayer` class, we will include the latest
               available version of Helm which is compatible with that version
               of Kubernetes.
            3. A weekly automated task will update the minor and patch versions
               of helm within the supported ranges.
            4. The automated task that checks for new supported minor versions
               of kubectl, will also attempt to figure out what is the latest
               version of helm compatible with that version of kubectl. This
               will be verified by a human in PR review to make sure it is
               correct.
    2. `@aws-cdk/lambda-layer-aws-cli` - Major versions 1 and 2 will both be
       available, and automatically updated to the latest minor or patch
       version.
        1. This package will have two APIs: `AwsCliLayer`, and `AwsCliV2Layer`.
        2. Automatically check for new minor and patch versions from Pypi -
           [awscli](https://pypi.org/project/awscli/),
           [awscliv2](https://pypi.org/project/awscliv2/). Each update will
           result in a minor version bump of this package.
    3. `@aws-cdk/lambda-layer-node-proxy-agent` - New minor versions will
       automatically be picked up and available with a minor version bump of the
       library.
        1. This can be implemented with `npm-check-updates`, since
           `node-proxy-agent` is an npm package.
    4. AWS CDK v2 will automatically pick up new minor versions of the above
       libraries.

_What about customers executing their CDK apps in network-restricted
environments?_

This question raises an important drawback of this solution. It will result in a
breaking change for customers who are using these Lambda Layers in
network-restricted environments. If customers are able to use the CDK CLI in
their network-restricted environments, then it is reasonable to assume they were
able to acquire the aws-cdk package from npm somehow. This implies customers
will be able to also acquire the lambda layer packages if we publish them
separately to npm. They can either make sure the necessary packages are already
installed and available in the `node_modules` directory where their CDK
applications are executed, or include them in a private npm registry.

Unfortunately, there is no way to remove these large files and host them
somewhere else without causing a breaking change for these customers. We will
publish a CLI notice directly to potentially-affected customers of this change
well in advance of releasing it. And, advertise the change in advance of release
on the aws-cdk GitHub repository.

_What about customers in ADC regions?_

Today, there is a mechanism for publishing AWS CDK into ADC (Amazon Dedicated
Cloud) regions. This mechanism includes bundling the direct dependencies of the
CDK and publishing them into the ADC regions, e.g. `constructs`. We will add the
lambda-layer packages to this process, and when customers use the aws-cdk npm
package in ADC regions, the right dependencies will already be present in the
`node_modules` directory.

###### Upstream custom resources that consume the lambda layers

The second, and more long-term part of this solution will be to upstream the
custom resources where the zip files are used. Since all of these zip files are
used in custom resources, another way to remove them from `aws-cdk-lib` is to
remove the custom resources themselves. We will create Uluru resources that are
available in the CloudFormation public registry under the namespace `AWS::CDK`.
This will increase the operational burden on our team by an unknown amount. We
should start with a single custom resource, and evaluate the maintenance cost of
this as it is implemented. In addition to reducing the size of the package, this
solution also has another benefit of addressing pain points with CDK publishing
custom resources into customer accounts. The lambda-layer APIs on their own, are
also valuable to customers. If we are able to remove their dependencies within
aws-cdk-lib by removing the custom resources, then we could vend these libraries
separately for customers who use them explicitly. The details of this solution
is out of scope for this document, and will probably need its own RFC.

#### .jsii Files

There are two files, .jsii.tabl.json and .jsii, bundled in `aws-cdk-lib` for the
JSII runtime to work for any non-NodeJS languages. And, to enable code and
documentation generation from the published npm package. Today, they makeup 42 %
of the package size. And in the future, after adding more Lambda Layers would
still compose 30%.

We will compress the .jsii.tabl.json and .jsii files. Compressing with gzip
currently creates a 4 MB and 4.7 MB file, respectively. This change will impact
the JSII runtime, and Construct Hub. NodeJS JSII runtimes don't need to use
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
whitespace characters. In reality, we will need to do something slightly more
sophisticated and keep whitespace in documentation comments, so that
type-checking in IDEs still has readable type references.

### Is this a breaking change?

Yes, see CHANGELOG and CLI Notice sections. The solution for the Lambda Layer
zip files will have a breaking change for customers executing CDK applications
that use the Lambda Layers in some network-restricted environments. All
alternative solutions will also have a breaking change for these customers. The
proposed solution will have the easiest migration path for these customers.

### What alternative solutions did you consider?

Each category of files has different alternative solutions to reduce the size.

#### .jsii Files

1. The .jsii.tabl.json  and .jsii files are both “pretty-printed.” We can reduce
   their size to 42 MB (-23%) and 30 MB (-33%) by removing all the whitespace
   and newlines. We will not take this solution, because the space savings is
   not as significant as compression. And, then we can maintain the benefit of
   using pretty-printed JSON when uncompressed.
2. Vend the Rosetta tablet file (.jsii.tabl.json) separately. On each release,
   we would publish this file as a separate artifact on GitHub releases, and
   reference the URI from the jsii assembly (.jsii). This solution will not be
   pursued at this time. There are several issues with de-coupling the Rosetta
   tablet file from the artifacts that customers install, and with requiring the
   JSII runtime to run in an environment that has access to the public endpoint
   where it would be hosted.

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
   mechanism would be required to add new artifacts to the website, as new
   versions of each dependency are released. And, to add new versions of each
   dependency to aws-cdk-lib. The problem with this solution is that it requires
   access to a public endpoint during synth of CDK applications. Many customers
   run CDK apps in network-restricted environments (Construct Hub, ADC region
   customers), and this solution does not lend itself to a straightforward
   workaround for these customers.
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
   them up to date in every AWS region is too high. This solution is the same as
   the one described in this
   [comment](https://github.com/aws/aws-cdk-rfcs/issues/39#issuecomment-593092612).
4. Separate packages that `aws-cdk-lib` peer depends on. With this solution,
   customers do not need to include the large `lambda-layer-X` packages in their
   dependencies unless they are actually using one of the Constructs that
   requires them. This is not a reasonable solution, since it would too
   confusing for customers to know when they need these peer dependencies, and
   when they do not.

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
increases with each weekly release, because we are adding code and new features
at a rapid pace, and AWS is always adding new services and features. It is
possible that after all of the proposed solutions are implemented, that the
package size will still continue to increase past a reasonable size. At that
point, we might need to invent more creative solutions to reduce the size, or
implement some of the alternative solutions outlined here.

2. This solution has a breaking change for some customers. Until we get some
   feedback from the community on this RFC, we don't know for sure if the
   proposed migration for those customers is reasonable.

### What is the high-level project plan?

This project will have two phases:

#### Phase 1 — Remove large files & minify as much as possible

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

Work for phase 1 will be tracked on [this project
board](https://github.com/aws/aws-cdk/projects/15).

#### Phase 2 — Upstream custom resources as Uluru resources

For this phase, we will start by upstreaming the `KubectlProvider` custom
resource. This is the best option to start with, because it uses the largest
Lambda-Layer dependency, kubectl. And, because there is the most customer demand
for this custom resource to be removed from CDK. This work will be quite
complex, and the detailed design is out of scope of this document.

## Appendix A - Notes on size calculations

1. All size calculations in this document were done based on
   `aws-cdk-lib@2.19.0`.
2. `du -k` was used to get sizes in Kb (Kebibytes), for calculating the
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
