# CLI advisories

* **Original Author(s)**: [@otaviomacedo](https://github.com/otaviomacedo)
* **Tracking Issue**: [#308](https://github.com/aws/aws-cdk-rfcs/issues/308)
* **API Bar Raiser**: @{BAR_RAISER_USER}

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

ADVISORIES

16603   Toggling off auto_delete_objects for Bucket empties the bucket

        Summary: If a stack is deployed with an S3 bucket with
                 auto_delete_objects=True, and then re-deployed with 
                 auto_delete_objects=False, all the objects in the bucket 
                 will be deleted.
                 
        Affected versions: <1.126.0.

        More information at: https://github.com/aws/aws-cdk/issues/16603


17061   Error when building EKS cluster with monocdk import

        Summary: When using monocdk/aws-eks to build a stack containing
                 an EKS cluster, error is thrown about missing 
                 lambda-layer-node-proxy-agent/layer/package.json.
         
        Affected versions: >=1.126.0 <=1.130.0.

        More information at: https://github.com/aws/aws-cdk/issues/17061 

If you don’t want to see an advisory anymore, use "cdk acknowledge ID". For example, "cdk acknowledge 16603".
```

By acknowledging a particular advisory, it won’t show anymore in subsequent calls:

```
$ cdk acknowledge 16603

ADVISORIES

17061   Error when building EKS cluster with monocdk import

        Summary: When using monocdk/aws-eks to build a stack containing
                 an EKS cluster, error is thrown about missing 
                 lambda-layer-node-proxy-agent/layer/package.json.
         
        Affected versions: >=1.126.0 <=1.130.0.

        More information at: https://github.com/aws/aws-cdk/issues/17061 

If you don’t want to see an advisory anymore, use "cdk acknowledge ID". For example, "cdk acknowledge 17061".
```

You can suppress all warnings per individual execution:

```
$ cdk deploy --no-advisories
```

And you can disable all advisories indefinitely by adding this entry to
`~/.cdk.json`:

```
"advisories": false
```

Regardless of the state of this flag and the advisories you have acknowledged,
you can always show the currently active advisories:

```
$ cdk advisories
```

This command returns zero if there is no advisory and non-zero otherwise. Users
can then plug this into a pipeline approval workflow and expect manual review if
there are any advisories.

> Please note that the acknowledgements are made project by project. If you
acknowledge an advisory in one CDK project, it will still appear on other 
projects when you run any CDK commands, unless you have suppressed or disabled 
advisories.  

### Runbook section (internal to the CDK team)

In case of a high-impact issue, follow these steps:
1. Create or update an issue for this incident on the aws-cdk GitHub repository.
2. If there is an error message related to issue, include it in the title so 
that it appears in web searches.
3. In the body of the issue, use the following template:

```markdown
Please add your +1 👍 to let us know you have encountered this
---

### Status: __<!-- Please add status here 'INVESTIGATING/IN-PROGRESS/RESOLVED' -->__

### Overview
<!--
Use this section to outline the problem, focusing on 'root-cause' and 'users affected'
-->
#### Complete Error Message

### Workaround
<!--
Please provide a detailed workaround outlining all steps required for implementation.
If none exist yet, leave blank
-->

### Solution
<!--
Once able please describe solution here as well as any steps required for implementation
If no solution at present, leave blank
-->

### Related Issues
<!--
List all related issues here. If none related, leave blank
-->

### Affected component

<!-- 
Either "CLI", "Framework" or both, separated by comma. 
This is mandatory if you want the issue to be published as a CLI advisory
-->

### Affected version range

<!--  
The versions of the CLI or the framework affected by this incident. Use the
[Semantic Versioning scheme](https://semver.org) to denote the version range.
This is mandatory if you want the issue to be published as a CLI advisory
-->
```
4. Remove the `needs-triage` label.
5. Add the labels `p0`, `management/tracking` and all relevant
   subject/package labels.
6. Pin the issue.
7. Add the `advisory` label. If you followed the previous steps correctly, CLI
   users will start seeing this information as part of the output of every
   command. If you missed anything, a GitHub action will post a warning on the
   issue.

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

A new communication channel between AWS and users of the CDK. Starting on
version x.y.z of the CDK CLI, customers will be notified, on every command,
about security vulnerabilities, regressions and usage of unsupported versions.

### Why should I use this feature?

These advisories shown by the CLI contain very important and actionable
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
content that applies to each particular environment. But ultimately, it hinges
on responsible use. In particular, this feature should not be used for things
like marketing campaigns, blog post announcements or upcoming events. If we
don’t have a good mechanism for defining and enforcing this constraint, we
should not implement this feature.

### What is the technical solution (design) of this feature?

To publish a new advisory, all that the CDK team will have to do is create a
GitHub issue that fulfils some requirements. The CLI will consume these issues
using the GitHub API and apply a set of filters to narrow down the list of
advisories to the context in which it is being run. To improve the publishing
experience, we will implement a GitHub action that will validate whether the
issues that are candidates for advisories fulfil the requirements. For a more
detailed explanation, see the Appendix.

### Is this a breaking change?

No.

### What alternative solutions did you consider?

All the solutions listed below were considered and discarded for adding
unnecessary complexity to the overall architecture.

On the publishing side:

* Implementing a new internal REST service to manage the advisories.
* Storing the advisories as structured data (e.g., JSON files) in some GitHub
  repository.

On the distribution side:

* Assuming the advisories were stored in an S3 file (using one of the publishing
  solutions considered above), we would use CloudFront to distribute them.
* Use GitHub pages as our distribution mechanism, directly from the repository
  were the data were stored.

### What is the high-level project plan?

1. Implement the issue validation logic as an NPM package.
2. Implement the GitHub action, using the validation package.
3. Implement the CLI changes.
4. Add the GitHub action to the aws-cdk repository.

### What is the expected lifetime of advisories?

We should expect advisories to be available for months. This is usually the case
when we want users to upgrade the construct library version.

### Why do we need to give users the option to suppress advisories?

This is useful when the CDK is running as part of larger script and users want
to hide the output.

### Why do we need to give users the option to acknowledge advisories?

Given the expected lifetime of advisories, they will eventually become just
noise and users will try to silence it. If the only option we give users is to
suppress them (per execution or indefinitely), they will use that and miss new
advisories.

### What future improvements can we make?

**Resource filter**: Ideally, advisories should be as targeted as possible. The
version filter addresses part of that requirement, but we can make it better by
also adding a resource filter: if an issue only affects `FargateTaskDefinition`
resources, for example, but this resource is not present in any of the stacks,
the customer doesn’t need to see that particular warning.

**Pipeline awareness**: Initially, we won’t treat the pipeline as a special
case. By default, the advisories will be fetched and displayed and we expect
users to never look at them. This behavior can always be overridden by
suppressing the advisories. In future releases, the CLI will use the information
about whether it’s running on a pipeline and block the deployment in case there
is any advisory.

## Appendix

### Detailed design

There are three parts to this solution: the data format, the GitHub workflow and
the CLI logic.

#### Data format

We will use GitHub issues to publish and manage advisories. To be considered a
valid advisory, the body of a GitHub issue must have the following fields:

| Field                  | Description                                                                                                                                                | Format                                 | Mandatory? |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- |
| Overview               | A paragraph with more information                                                                                                                          | Free-form text                         | Yes        |
| Affected component     | The CLI or the construct library (or both)                                                                                                                 | A non-empty subset of {CLI, Framework} | Yes        |
| Affected version range | Version range using the semver format                                                                                                                      | semver                                 | No         |
| Workaround             | Actions the user can take to mitigate the problem. | Free-form text                         | No         |

In order to keep the issue human readable as well as easily parseable, each of
these fields should be indicated by a Markdown header (`### Overview`, `###
Affected component` etc). The piece of text following the header will be
interpreted as the content of the field. See the template in the **Working
backwards** section.

#### GitHub workflow

To be considered an advisory, a GitHub issue must be pinned and have the
following tags: `p0` and a new tag, `advisory`. The `advisory` tag will work as
an acknowledgement that author of the issue is making a conscious decision to
publish an advisory that will be seen by potentially hundreds of thousands of
users. Adding this tag will trigger a new workflow, which will inspect the issue
and check whether its body contains the right data format (see **Data format**
section). If the issue doesn’t comply with the specification, the workflow will
post a message (similar to a CI report, for example).

#### CLI logic

The CLI will make unauthenticated requests to the GitHub Issues API and query
for issues that match the tag system described in the **GitHub workflow**
section. Then it will apply additional filters on the result:

* Format filter: whether the body of the issue complies with the data format
  specification.
* Version filter: whether the version range contained in the issue matches the
  CLI version or the framework version (depending on the affected component,
  also present in the issue). To check which version of the framework is being
  used, the CLI will read the cloud assembly (`tree.json` file, specifically).

Issues that pass these filters will be displayed on the standard output.

The GitHub API imposes a rate limit of 60 requests per hour for unauthenticated
requests. To avoid hitting that limit, the CLI will cache the results for a set
period of time (provisionally defined as 1 hour). The filtered advisories and
the expiration time will be saved to a file in the `$HOME/.cdk/cache` folder.
When the expiration time is reached, the cache is considered invalid and, at the
next command execution, the CLI will make a new request to get fresh results.

The CLI will store the IDs of the acknowledged issues in the project specific 
`./cdk.json` file.
