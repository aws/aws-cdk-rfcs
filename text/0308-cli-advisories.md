# CLI notices

* **Original Author(s)**: [@otaviomacedo](https://github.com/otaviomacedo)
* **Tracking Issue**: [#308](https://github.com/aws/aws-cdk-rfcs/issues/308)
* **API Bar Raiser**: @eladb

A new CLI feature to notify customers about urgent and important issues that
require their attention.

## Working backwards

### README

Starting on version x.y.z of the CDK CLI, customers will be notified, on every
command, about security vulnerabilities, regressions and usage of unsupported
versions:

```
$ cdk deploy

... # Normal output of the command

NOTICES

16603   Toggling off auto_delete_objects for Bucket empties the bucket

        Overview: If a stack is deployed with an S3 bucket with
                  auto_delete_objects=True, and then re-deployed with
                  auto_delete_objects=False, all the objects in the bucket
                  will be deleted.

        Affected versions: <1.126.0.

        More information at: https://github.com/aws/aws-cdk/issues/16603


17061   Error when building EKS cluster with monocdk import

        Overview: When using monocdk/aws-eks to build a stack containing
                  an EKS cluster, error is thrown about missing
                  lambda-layer-node-proxy-agent/layer/package.json.

        Affected versions: >=1.126.0 <=1.130.0.

        More information at: https://github.com/aws/aws-cdk/issues/17061

If you don’t want to see an notice anymore, use "cdk acknowledge ID". For example, "cdk acknowledge 16603".
```

By acknowledging a particular notice, it won’t show anymore in subsequent calls:

```
$ cdk acknowledge 16603

NOTICES

17061   Error when building EKS cluster with monocdk import

        Overview: When using monocdk/aws-eks to build a stack containing
                  an EKS cluster, error is thrown about missing
                  lambda-layer-node-proxy-agent/layer/package.json.

        Affected versions: >=1.126.0 <=1.130.0.

        More information at: https://github.com/aws/aws-cdk/issues/17061

If you don’t want to see an notice anymore, use "cdk acknowledge ID". For example, "cdk acknowledge 17061".
```

You can suppress all warnings per individual execution:

```
$ cdk deploy --no-notices
```

And you can disable all notices indefinitely by adding this entry to
`~/.cdk.json`:

```
"notices": false
```

Regardless of the state of this flag and the notices you have acknowledged,
you can always show the currently active notices:

```
$ cdk notices
```

This command returns zero if there is no notice and non-zero otherwise. Users
can then plug this into a pipeline approval workflow and expect manual review if
there are any notices.

> Please note that the acknowledgements are made project by project. If you
acknowledge an notice in one CDK project, it will still appear on other
projects when you run any CDK commands, unless you have suppressed or disabled
notices.  

### Runbook section (internal to the CDK team)

In case of a high-impact issue, follow these steps:

1. Create or update an issue for this incident on the aws-cdk GitHub repository.
2. Update the file `notices.json` on repository `cdklabs/aws-cdk-notices`, adding an entry for
   the incident. Example:
<!-- markdownlint-disable line-length  -->
```json
  {
    "title":  "Toggling off auto_delete_objects for Bucket empties the bucket",
    "issueUrl": "https://github.com/aws/aws-cdk/issues/16603",
    "overview": "If a stack is deployed with an S3 bucket with auto_delete_objects=True, and then re-deployed with auto_delete_objects=False, all the objects in the bucket will be deleted.",
    "component": ["framework"],
    "version": "<1.126.0"
  }
```
<!-- markdownlint-enable line-length  -->

3. Create a PR with this change and wait for an approval. Only SDMs have
   permission to approve PRs in this repository.
4. A PR check will validate the `notices.json` file and verify that the
   following conditions hold:
   * The file is compliant with the schema.
   * The issue exists.
   * Title and overview are within the length constraints.
   * The semantic version is valid.
   * The component is valid.
5. When the PR gets merged, the notice will be visible to all CLI
   installations. The GitHub issue will also be automatically updated with the
   information contained in the file. All the necessary tags will also be added
   automatically.
6. You can keep updating the issue normally, as new information comes in, but
   you're not allowed to touch the sections auto-generated from the notices
   file.

[ ] Signed-off by API Bar Raiser @xxxxx

## Public FAQ

### What are we launching today?

A new communication channel between AWS and users of the CDK. Starting on
version x.y.z of the CDK CLI, customers will be notified, on every command,
about security vulnerabilities, regressions and usage of unsupported versions.

### Why should I use this feature?

These notices shown by the CLI contain very important and actionable
information about problems that directly affect you. They give you an
opportunity to upgrade the CLI or the construct library when necessary or to
work around high-impacting issues.

## Internal FAQ

### Why are we doing this?

In case of emergency announcements, such as security vulnerabilities or
regressions, the only mechanisms we have right now are email campaigns and
pinned GitHub issues. These are not always the best means to reach out to
customers. Many email addresses are not monitored by anyone and customers don’t
necessarily check the GitHub repository for updates. The output of the CLI, on
the other hand, is seen by many customers every day.

### Why should we *not* do this?

This is a powerful feature to convey urgent and important messages to customers.
However, to keep its relevance, it should be used sparingly and the messages
must meet a high bar. Otherwise it will just become a tool for spamming
customers. We will introduce filters to reduce this risk, by only showing
content that applies to each particular environment and also require PR approval
for any changes in notices. But ultimately, it hinges on responsible use. In
particular, this feature should not be used for things like marketing campaigns,
blog post announcements and things like that. If the mechanisms proposed in this
RFC are not considered strong enough by the CDK team, we should not implement
this feature.

### What is the technical solution (design) of this feature?

Notice information will be available as a static file on a GitHub repository.
This file will be automatically synced to an S3 bucket and distributed via
CloudFront. The CLI will consume this file from and apply a set of filters to
narrow down the list of notices to the context in which it is being run. We
will also implement some GitHub actions to validate and copy the contents of the
file over to the issue. For a more detailed explanation, see the Appendix.

### Is this a breaking change?

No.

### What alternative solutions did you consider?

On the publishing side:

* Implementing a new internal REST service to manage the notices. Overly
  complex for this use case.
* Authoring the content directly on the GitHub issue. Hard to enfore
  constraints on the content.

On the distribution side:

* Serving the file directly form GitHub.
* Using the GitHub API to query for special issues that are considered
  notices (in case of using GitHub issues as the source of truth).  

### What is the high-level project plan?

1. Implement and deploy the infastructure necessary for distribution (S3 +
   CloudFront).
1. Implement the GitHub actions of validation and issue sync-up and issue
   protection.
2. Add the construct library version to the cloud assembly metadata.
2. Implement and release the CLI changes.

### What is the expected lifetime of notices?

We should expect notices to be available for months. This is usually the case
when we want users to upgrade the construct library version.

### Why do we need to give users the option to suppress notices?

This is useful when the CDK is running as part of larger script and users want
to hide the output.

### Why do we need to give users the option to acknowledge notices?

Given the expected lifetime of notices, they will eventually become just
noise and users will try to silence it. If the only option we give users is to
suppress them (per execution or indefinitely), they will use that and miss new
notices.

### What future improvements can we make?

**Resource filter**: Ideally, notices should be as targeted as possible. The
version filter addresses part of that requirement, but we can make it better by
also adding a resource filter: if an issue only affects `FargateTaskDefinition`
resources, for example, but this resource is not present in any of the stacks,
the customer doesn’t need to see that particular warning.

**Pipeline awareness**: Initially, we won’t treat the pipeline as a special
case. By default, the notices will be fetched and displayed and we expect
users to never look at them. This behavior can always be overridden by
suppressing the notices. In future releases, the CLI will use the information
about whether it’s running on a pipeline and block the deployment in case there
is any notice.

## Appendix

### Detailed design

#### Publishing notices

We will create a new repository, `cdklabs/aws-cdk-notices`, dedicated to host
the notices file. As usual, in order to be merged, any change to this file
will have to be published as a PR and approved. Using a CODEOWNERS file, we will
restrict the permission to approve PRs only to SDMs. The file will contain a
list of notices, each having the following fields:

|     Field    |                           Description                          | Format                          | Mandatory? |
|:------------:|:--------------------------------------------------------------:|---------------------------------|:----------:|
| `title`      | The title of the incident (max length: 100)                    | Free form text                  | Yes        |
| `issueUrl`   | A link to the GitHub issue where the incident is being tracked | URL                             | Yes        |
| `overview`   | A paragraph with more information about the incident           | Free form text                  | Yes        |
| `component`  | The CLI or the Framework                                       | Either `"cli"` or `"framework"` | Yes        |
| `version`    | Version range using the semver format                          | Semantic Versioning             | No         |

We will also implement three GitHub actions on this repository:

1. File validation on PR. It will block merging if the structure of the file is
   not compliant with the specification above.
2. Issue sync-up. When the PR is merged, this action will copy the content of
   the file over to the GitHub issue it's linked to.
3. Issue protection. Every change to issues that are linked to some notice
   will be checked by this action, to avoid corruption.

For the distribution, we will implement a mechanism to sync the contents of the
GitHub repository with the S3 bucket (e.g., a Event Bridge event). The S3
content will be served by a CloudFront distribution.

#### CLI logic

On every command, the CLI will fetch the file from the backend, parse the
content and check whether the version range contained in the notice matches
the CLI version or the framework version (depending on the affected component).

Since the CLI knows its own version, checking against the version range of the
notice is trivial. The version of the framework, however, is not readily
available anywhere. To address this, we will start writing the framework version
to the Cloud Assembly, in a place where the CLI can read it.

Issues that pass this filter will be displayed on the standard output. If an
error or timeout occurs when retrieving the issues, the CLI will simply skip
the display of notices and try again at the next command execution. Results
will be cached for a period of one hour.

The CLI will store the IDs of the acknowledged issues in the project specific
`./cdk.json` file.
