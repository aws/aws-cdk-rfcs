# AWS CDK RFCs

This repo is a place to propose and track major upcoming changes to [AWS CDK], [jsii], and
other related projects. It also is a great place to learn about the current and
future state of the libraries and to discover projects for contribution.

[AWS CDK]: https://github.com/aws/aws-cdk
[jsii]: https://github.com/aws/jsii

**Jump to**: [What is an RFC?](#what-is-an-rfc) |
[RFC Process](#rfc-process) |
[RFC State Diagram](#the-rfc-life-cycle)

## Current RFCs

**Jump to**:
[Full list](./FULL_INDEX.md) |
[Accepted](./ACCEPTED.md) |
[Proposed](./PROPOSED.md) |
[Closed](./CLOSED.md)

<!--BEGIN_TABLE-->
\#|Title|Owner|Status
---|-----|-----|------
[456](https://github.com/aws/aws-cdk-rfcs/issues/456)|[L2 ElastiCache support](https://github.com/aws/aws-cdk-rfcs/blob/main/text/0456-elasticache-l2.md)||👷 implementing
[473](https://github.com/aws/aws-cdk-rfcs/issues/473)|[EventBridge Pipes L2 Construct](https://github.com/aws/aws-cdk-rfcs/blob/main/text/0473-eventbridge-pipes.md)|[@mrgrain](https://github.com/mrgrain)|👷 implementing
[162](https://github.com/aws/aws-cdk-rfcs/issues/162)|[CDK Refactoring Tools](https://github.com/aws/aws-cdk-rfcs/issues/162)||📆 planning
[502](https://github.com/aws/aws-cdk-rfcs/issues/502)|[Amazon VPC Lattice L2 Construct](https://github.com/aws/aws-cdk-rfcs/blob/main/text/0502_aws-vpclattice.md)|[@TheRealAmazonKendra](https://github.com/TheRealAmazonKendra)|👍 approved
[507](https://github.com/aws/aws-cdk-rfcs/issues/507)|[Full control over VPC and subnet configuration](https://github.com/aws/aws-cdk-rfcs/blob/main/text/0507-subnets)|[@otaviomacedo](https://github.com/otaviomacedo)|👍 approved
[362](https://github.com/aws/aws-cdk-rfcs/issues/362)|[Construct Library for Contributor Insights Rules](https://github.com/aws/aws-cdk-rfcs/issues/362)||✍️ review
[419](https://github.com/aws/aws-cdk-rfcs/issues/419)|[CDK environment setup for platform/system administrators](https://github.com/aws/aws-cdk-rfcs/issues/419)||✍️ review
<!--END_TABLE-->

## What is an RFC?

An RFC is a document that proposes a change to one of the projects led by the
CDK team at AWS. *Request for Comments* means a request for discussion and
oversight about the future of the project from maintainers, contributors and
users.

**When should I write an RFC?** The CDK team proactively decides to write RFCs
on major features or complex changes that we feel require that extra vetting.
However, the process is designed to be as lightweight as needed and can be used
to request feedback on any change. Quite often, even changes that seem obvious
and simple at first sight can be significantly improved once a wider group of
interested and experienced people have a chance to weigh in.

**Who should submit an RFC?** An RFC can be submitted by anyone. In most cases,
RFCs are authored by CDK maintainers, but contributors are more than welcome to
submit RFCs.

If you are a **contributor** and you wish to write an RFC, please contact the
core team at the [#aws-cdk-rfcs] to make sure someone from the core team can
sponsor your work. Otherwise, there is a good chance we won't have bandwidth to
help.

## RFC Process

To start an RFC process, create a [new tracking issue] and follow the
instructions in the issue template. It includes a checklist of the various
stages an RFC goes through.

[new tracking issue]: https://github.com/aws/aws-cdk-rfcs/issues/new?assignees=&labels=management%2Ftracking%2C+status%2Fproposed&template=tracking-issue.md&title=proposal+title

This section describes each stage in detail, so you can refer to it for
guidance.

### 1. Tracking Issue

Each RFC has a GitHub issue which tracks it from start to finish. The issue is
the hub for conversations, community signal (+1s) and the issue number is used
as the unique identifier of this RFC.

> Before creating a tracking issue, please search for similar or related ideas in
the RFC table above or in the issue list of this repo. If there is a relevant
RFC, collaborate on that existing RFC, based on its current stage.

Our [tracking issue template] includes a checklist of all the steps an RFC goes
through and it's the driver's responsibility to update the checklist and assign
the correct label to on the RFC throughout the process.

[tracking issue template]: https://github.com/aws/aws-cdk-rfcs/blob/master/.github/ISSUE_TEMPLATE/tracking-issue.md

When the issue is created, it is required to fill in the following information:

1. **Title**: the name of the feature or change - think changelog entry.
2. **Description**: a _short_ description of feature, as if it was already implemented.
3. **Proposed by**: fill in the GitHub alias of the person who proposed the idea
   under "Proposed by".

### 2. API Bar Raiser

Reach us via [#aws-cdk-rfcs] to get an "API Bar Raiser" assigned to your RFC.

For each RFC, CDK leadership will assign an **API Bar Raiser** who reviews and
approves the public API of the feature. API Bar Raisers have veto rights on
API-related design decisions, such as naming, structure, options, CLI commands
and others.

The public API of a feature represents the surface through which users interact
with it, and we want to make sure these APIs are consistent, ergonomic and
designed based on the intent and the mental model of our users. Additionally,
once we announce that a feature is "stable" (1.0, GA, etc) any breaking change
to its public API will require releasing a new major version, so we like think
of API decisions as "one way doors".

API Bar Raisers will be assigned using a tiering model which is generally based
on the size of the user base that will likely get exposed to the feature. As a
general rule, the more "significant" the feature is, we will assign a bar raiser
with a wider and longer-term context of the project.

To merge an RFC, a [sign-off](#6-api-sign-off) from the bar raiser is required
on the public API of the feature, so we encourage to engage with them early in
the process to make sure you are aligned on how the API should be designed.

> NOTE: The technical solution proposed in an RFC *does not* require approval
> beyond the normal pull request approval model (e.g. a core team member needs
> to approve the RFC PR and any subsequent changes to it).

### 3. Kick-off

Before diving into writing the RFC, it is highly recommended to organize a
kick-off meeting that includes the API Bar Raiser and any stakeholders that
might be interested in this RFC or can contribute ideas and direction. The goal
of the meeting is to discuss the feature, its scope and general direction for
implementation.

If you are not part of the CDK team at Amazon, reach out to us via [#aws-cdk-rfcs]
and we will help to organize the kick-off meeting.

Our experience shows that such a meeting can save a lot of time and energy.

You can use the tracking issue to record some initial API and design ideas and
collect early feedback and use cases as a preparation for the kick-off meeting
and RFC document itself. You can start the meeting by letting participants
obtaining context from the tracking issue.

At the end of the meeting, record any ideas and decisions in the tracking issue
and update the checklist to indicate that the kick-off meeting has happened.

### 4. RFC Document

The next step is to write the first revision of the RFC document itself.

Create a file under `text/NNNN-name.md` based off of the template under
[`0000-template.md`](./0000-template.md) (where `NNNN` is your tracking issue
number). Follow the template. It includes useful guidance and tips on how to
write a good RFC.

**What should be included in an RFC?** The purpose of an RFC is to reduce
ambiguity and risk and get approval for public-facing interfaces (APIs), which
are "one-way doors" after the feature is released. Another way to think about it
is that the goal and contents of the document should allow us to create a
*high-confidence* implementation plan for a feature or a change.

In many cases, it is useful to develop a **prototype** or even start coding the
actual implementation while you are writing the RFC document. Take into account
that you may need to throw your code away or refactor it substantially, but our
experience shows that good RFCs are the ones who dive into the details. A
prototype is great way to make sure your design "holds water".

> [!NOTE]
> To ensure consistency, the Markdown you write will be checked for common >
mistakes using a linter. To get early feedback while you are writing, use the
[VSCode > markdownlint
extensions](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint),
> or run the `./lint.sh` script in the root of the repository.
> Run `./lint.sh --fix` auto fix all fixable violations.

### 5. Feedback

Once you have an initial version of your RFC document (it is completely fine to
submit an unfinished RFC to get initial feedback), submit it as a pull request
against this repo and start collecting feedback.

Contact the CDK core team at [#aws-cdk-rfcs] (or via email/Slack if you are part
of the core team) and reach out to the public and Amazon internal communities
via various Slack channels in [cdk.dev](https://cdk.dev), Twitter and any other
relevant forum.

This is the likely going to be the longest part of your RFC process, and where
most of the feedback is collected. Some RFCs resolve quickly and some can take
months (!!). *Take into account at least 1-2 weeks to allow community and
stakeholders to provide their feedback.*

A few tips:

- If you decide to resolve a comment without addressing it, take the time to
  explain.
- Try to understand where people are coming from. If a comment seems off, ask
  folks to elaborate and describe their use case or provide concrete examples.
- Work with your API bar raiser: if there are disagreements, @mention them in a
  comment and ask them to provide their opinion.
- Be patient: it sometimes takes time for an RFC to converge. Our experience
  shows that some ideas need to "bake" and solutions oftentimes emerge via a
  healthy debate. We've had RFCs that took months to resolve.
- Not everything must be resolved in the first revision. It is okay to leave
  some things to resolve later. Make sure to capture them clearly and have an
  agreement about that. We oftentimes update an RFC doc a few times during the
  implementation.

### 6. API Sign-off

Before you can merge your RFC, you will need the API Bar Raiser to sign-off on
the public API of your feature. This is will normally be described under the
**Working Backwards** section of your RFC.

To sign-off, the API bar raiser will add the **status/api-approved** label to the RFC
pull request.

Once the API was signed-off, update your RFC document and add a `[x]` the
relevant location in the RFC document. For example:

```
[x] Signed-off by API Bar Raiser @foobar
```

### 7. Final Comments Period

At some point, you've reached consensus about most issues that were brought up
during the review period, and you are ready to merge. To allow "last call" on
feedback, the author can announce that the RFC enters "final comments period",
which means that within a ~week, if no major concerns are raised, the RFC will
be approved and merged.

Add a comment on the RFC pull request, tracking issue (and possibly slack/email
if relevant) that the RFC entered this stage so that all relevant stakeholders
will be notified.

Once the final comments period is over, seek an approval of one of the core team
members, and you can merge your PR to the main branch. This will move your RFC
to the "approved" state.

### 8. Implementation

For large changes, we highly recommend creating an implementation plan which
lists all the tasks required. In many cases, large implementation  should be
broken down and released via multiple iterations. Devising a concrete plan to
break down the break can be very helpful.

The implementation plan should be submitted through a PR that adds an addendum
to the RFC document and seeks the approval of any relevant stakeholders.

Throughout this process, update the tracking issue:

- Add the alias of the "implementation lead"
- Execution plan submitted (label: `status/planning`)
- Plan approved and merged (label: `status/implementing`)
- Implementation complete (label: `status/done`)

## The RFC Life Cycle

The following state diagram describes the RFC process:

![rfc-states](./images/lifecycle.png)

<!--
digraph states {
    node [shape=ellipse];
    edge [color=gray, fontsize=12]

    idea [label = "Idea", shape = plaintext]
    proposed [label = "Proposed"];
    review [label = "In Review"];
    fcp [label = "Final Comment Period"];
    approved [label = "Approved"];
    planning [label = "Planning"];
    implementing [label = "Implementing"];
    done [label = "Done"];
    rejected [label = "Rejected"];

    idea -> proposed [label = "github issue created"]
    proposed -> review [label = "pull request with rfc doc created"];
    review -> review [label = "doc revisions"];
    review -> fcp [label = "shepherd approved"];
    review -> rejected [label = "rejected"];
    fcp -> review [label = "revision requested"];
    fcp -> approved [label = "pull request approved and merged"];
    fcp -> rejected [label = "rfc rejected"];
    approved -> planning [label = "pull request with implementation plan created"];
    planning -> implementing [label = "rfc with implementation plan approved and merged"];
    implementing -> done [label = "implementation completed"];
}
-->

1. **Proposed** - A tracking issue has been created with a basic outline of the
   proposal.
2. **Review** - An RFC document has been written with a detailed design and a PR is
   under review. At this point the PR will be assigned a **shepherd** from the core
   team.
3. **Final Comment Period** - The shepherd has approved the RFC PR, and announces
   that the RFC enters a period for final comments before it will be approved (~1wk).
   At this stage, if major issues are raised, the RFC may return to **Review**.
4. **Approved** - The RFC PR is approved and merged to `master`, and the RFC is now
   ready to be implemented.
5. **Planning** - A PR is created with the **Implementation Plan** section of the RFC.
6. **Implementing** - Implementation plan is approved and merged and the RFC is actively
   being implemented.
7. **Done** - Implementation is complete and merged across appropriate
   repositories.
8. **Rejected** - During the review period, the RFC may be rejected and then it will
   be marked as such.
9. **Stale** - The RFC did not get any significant enough progress or tracking and has become stale.
   We welcome a re-submission with substantial enough changes to overcome the original issues.

---

AWS CDK's RFC process owes its inspiration to the [Yarn RFC process], [Rust
RFC process], [React RFC process], and [Ember RFC process]

[yarn rfc process]: https://github.com/yarnpkg/rfcs
[rust rfc process]: https://github.com/rust-lang/rfcs
[react rfc process]: https://github.com/reactjs/rfcs
[ember rfc process]: https://github.com/emberjs/rfcs

[#aws-cdk-rfcs]: https://cdk-dev.slack.com/archives/C025ZFGMUCD
