# AWS CDK RFCs

This repo is a place to propose and track upcoming changes to [AWS CDK], [jsii], and
other related projects. It also is a great place to learn about the current and
future state of the libraries and to discover projects for contribution.

[AWS CDK]: https://github.com/aws/aws-cdk
[jsii]: https://github.com/aws/jsii

See [The RFC Life Cycle](#the-rfc-life-cycle) to learn more about the states of
existing proposals.

<!--BEGIN_TABLE-->
\#|Title|Owner|Status
---|-----|-----|------
[110](https://github.com/aws/aws-cdk-rfcs/issues/110)|[CLI Compatibility Strategy](https://github.com/aws/aws-cdk-rfcs/blob/master/text/00110-cli-framework-compatibility-strategy.md)|[@iliapolo](https://github.com/iliapolo)|ready
[95](https://github.com/aws/aws-cdk-rfcs/issues/95)|[Cognito Construct Library](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0095-cognito-construct-library)|[@nija-at](https://github.com/nija-at)|ready
[92](https://github.com/aws/aws-cdk-rfcs/issues/92)|[CI/CD Asset Publishing](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0092-asset-publishing.md)|[@rix0rrr](https://github.com/rix0rrr)|ready
[49](https://github.com/aws/aws-cdk-rfcs/issues/49)|[CI/CD for CDK apps](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0049-continuous-delivery.md)|[@rix0rrr](https://github.com/rix0rrr)|ready
[6](https://github.com/aws/aws-cdk-rfcs/issues/6)|[Monolithic Packaging](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0006-monolothic-packaging.md)|[@eladb](https://github.com/eladb)|ready
[79](https://github.com/aws/aws-cdk-rfcs/issues/79)|[CDK v2.0](https://github.com/aws/aws-cdk-rfcs/issues/79)|[@MrArnoldPalmer](https://github.com/MrArnoldPalmer)|pending
[60](https://github.com/aws/aws-cdk-rfcs/issues/60)|[Bazel Build System](https://github.com/aws/aws-cdk-rfcs/pull/61)||pending
[139](https://github.com/aws/aws-cdk-rfcs/issues/139)|["fromLookup" for additional resources](https://github.com/aws/aws-cdk-rfcs/issues/139)||proposed
[127](https://github.com/aws/aws-cdk-rfcs/issues/127)|[CDK to directly reference/import/update an existing stack](https://github.com/aws/aws-cdk-rfcs/issues/127)||proposed
[118](https://github.com/aws/aws-cdk-rfcs/issues/118)|[New CDK Major Version](https://github.com/aws/aws-cdk-rfcs/issues/118)||proposed
[116](https://github.com/aws/aws-cdk-rfcs/issues/116)|[Experimental modules](https://github.com/aws/aws-cdk-rfcs/issues/116)|[@rix0rrr](https://github.com/rix0rrr)|proposed
[109](https://github.com/aws/aws-cdk-rfcs/issues/109)|[Elasticache L2 Constructs](https://github.com/aws/aws-cdk-rfcs/issues/109)||proposed
[107](https://github.com/aws/aws-cdk-rfcs/issues/107)|[Publish a Construct Library Module Lifecycle document](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0107-construct-library-module-lifecycle.md)|[@ccfife](https://github.com/ccfife)|proposed
[87](https://github.com/aws/aws-cdk-rfcs/issues/87)|[On-Demand CFN Resource Generator](https://github.com/aws/aws-cdk-rfcs/issues/87)||proposed
[72](https://github.com/aws/aws-cdk-rfcs/issues/72)|[Stack Policy](https://github.com/aws/aws-cdk-rfcs/issues/72)||proposed
[64](https://github.com/aws/aws-cdk-rfcs/issues/64)|[Garbage Collection for Assets](https://github.com/aws/aws-cdk-rfcs/issues/64)||proposed
[63](https://github.com/aws/aws-cdk-rfcs/issues/63)|[CDK in Secure Environments](https://github.com/aws/aws-cdk-rfcs/issues/63)||proposed
[58](https://github.com/aws/aws-cdk-rfcs/issues/58)|[Improved ergonomics for stack default environment](https://github.com/aws/aws-cdk-rfcs/issues/58)||proposed
[52](https://github.com/aws/aws-cdk-rfcs/issues/52)|[Support resource import](https://github.com/aws/aws-cdk-rfcs/issues/52)||proposed
[51](https://github.com/aws/aws-cdk-rfcs/issues/51)|[Standardize security groups](https://github.com/aws/aws-cdk-rfcs/issues/51)||proposed
[48](https://github.com/aws/aws-cdk-rfcs/issues/48)|[Faster builds](https://github.com/aws/aws-cdk-rfcs/issues/48)|[@rix0rrr](https://github.com/rix0rrr)|proposed
[46](https://github.com/aws/aws-cdk-rfcs/issues/46)|[Hooks](https://github.com/aws/aws-cdk-rfcs/issues/46)||proposed
[40](https://github.com/aws/aws-cdk-rfcs/issues/40)|[Stack traces across language boundaries](https://github.com/aws/aws-cdk-rfcs/issues/40)||proposed
[39](https://github.com/aws/aws-cdk-rfcs/issues/39)|[Release public artifacts (lambda layers for custom resources, docker images)](https://github.com/aws/aws-cdk-rfcs/issues/39)||proposed
[35](https://github.com/aws/aws-cdk-rfcs/issues/35)|[Publish construct library guidelines](https://github.com/aws/aws-cdk-rfcs/issues/35)||proposed
[34](https://github.com/aws/aws-cdk-rfcs/issues/34)|[Third-party construct ecosystem](https://github.com/aws/aws-cdk-rfcs/issues/34)||proposed
[32](https://github.com/aws/aws-cdk-rfcs/issues/32)|[App-centric operational experience](https://github.com/aws/aws-cdk-rfcs/issues/32)||proposed
[31](https://github.com/aws/aws-cdk-rfcs/issues/31)|[Integration tests](https://github.com/aws/aws-cdk-rfcs/issues/31)||proposed
[30](https://github.com/aws/aws-cdk-rfcs/issues/30)|[Improve synthesized template output](https://github.com/aws/aws-cdk-rfcs/issues/30)||proposed
[28](https://github.com/aws/aws-cdk-rfcs/issues/28)|[Construct library graduation process](https://github.com/aws/aws-cdk-rfcs/issues/28)||proposed
[27](https://github.com/aws/aws-cdk-rfcs/issues/27)|[200 resource limit tools & guidance](https://github.com/aws/aws-cdk-rfcs/issues/27)||proposed
[26](https://github.com/aws/aws-cdk-rfcs/issues/26)|[Monitoring packs](https://github.com/aws/aws-cdk-rfcs/issues/26)||proposed
[25](https://github.com/aws/aws-cdk-rfcs/issues/25)|[Defaults & configuration policy](https://github.com/aws/aws-cdk-rfcs/issues/25)||proposed
[24](https://github.com/aws/aws-cdk-rfcs/issues/24)|[Resource imports](https://github.com/aws/aws-cdk-rfcs/issues/24)||proposed
[23](https://github.com/aws/aws-cdk-rfcs/issues/23)|[Stateful resource support](https://github.com/aws/aws-cdk-rfcs/issues/23)||proposed
[22](https://github.com/aws/aws-cdk-rfcs/issues/22)|[Cost calculator](https://github.com/aws/aws-cdk-rfcs/issues/22)||proposed
[21](https://github.com/aws/aws-cdk-rfcs/issues/21)|[CDK Explorer Roadmap](https://github.com/aws/aws-cdk-rfcs/issues/21)||proposed
[20](https://github.com/aws/aws-cdk-rfcs/issues/20)|[Security posture summary](https://github.com/aws/aws-cdk-rfcs/issues/20)||proposed
[19](https://github.com/aws/aws-cdk-rfcs/issues/19)|[Introspection API](https://github.com/aws/aws-cdk-rfcs/issues/19)||proposed
[18](https://github.com/aws/aws-cdk-rfcs/issues/18)|[Open context provider framework](https://github.com/aws/aws-cdk-rfcs/issues/18)||proposed
[17](https://github.com/aws/aws-cdk-rfcs/issues/17)|[CLI support for multiple-environments](https://github.com/aws/aws-cdk-rfcs/issues/17)||proposed
[15](https://github.com/aws/aws-cdk-rfcs/issues/15)|[Scaffolding](https://github.com/aws/aws-cdk-rfcs/issues/15)||proposed
[14](https://github.com/aws/aws-cdk-rfcs/issues/14)|[Toolchain 2.0](https://github.com/aws/aws-cdk-rfcs/issues/14)|[@shivlaks](https://github.com/shivlaks)|proposed
[13](https://github.com/aws/aws-cdk-rfcs/issues/13)|[Improvements to Reference docs](https://github.com/aws/aws-cdk-rfcs/issues/13)||proposed
[10](https://github.com/aws/aws-cdk-rfcs/issues/10)|[New workshop modules](https://github.com/aws/aws-cdk-rfcs/issues/10)||proposed
[9](https://github.com/aws/aws-cdk-rfcs/issues/9)|[Master developer guide sources in main repo](https://github.com/aws/aws-cdk-rfcs/issues/9)||proposed
[8](https://github.com/aws/aws-cdk-rfcs/issues/8)|[Project structure guidelines](https://github.com/aws/aws-cdk-rfcs/issues/8)||proposed
[7](https://github.com/aws/aws-cdk-rfcs/issues/7)|[Lambda Bundles](https://github.com/aws/aws-cdk-rfcs/issues/7)||proposed
[5](https://github.com/aws/aws-cdk-rfcs/issues/5)|[Security-restricted environments](https://github.com/aws/aws-cdk-rfcs/issues/5)||proposed
[4](https://github.com/aws/aws-cdk-rfcs/issues/4)|[CDK Testing Tools](https://github.com/aws/aws-cdk-rfcs/issues/4)|[@nija-at](https://github.com/nija-at)|proposed
[3](https://github.com/aws/aws-cdk-rfcs/issues/3)|[Integrate CLI into Native Modules](https://github.com/aws/aws-cdk-rfcs/issues/3)||proposed
[2](https://github.com/aws/aws-cdk-rfcs/issues/2)|[Migration Paths](https://github.com/aws/aws-cdk-rfcs/issues/2)||proposed
[1](https://github.com/aws/aws-cdk-rfcs/issues/1)|[CDK Watch](https://github.com/aws/aws-cdk-rfcs/issues/1)||proposed
[55](https://github.com/aws/aws-cdk-rfcs/issues/55)|[Feature Flags](https://github.com/aws/aws-cdk-rfcs/blob/master/text/0055-feature-flags.md)|[@eladb](https://github.com/eladb)|resolved
[37](https://github.com/aws/aws-cdk-rfcs/issues/37)|[Release from a "release" branch](https://github.com/aws/aws-cdk-rfcs/issues/37)|[@MrArnoldPalmer](https://github.com/MrArnoldPalmer)|resolved
[36](https://github.com/aws/aws-cdk-rfcs/issues/36)|[Constructs Programming Model](https://github.com/aws/aws-cdk-rfcs/issues/36)|[@eladb](https://github.com/eladb)|resolved
[16](https://github.com/aws/aws-cdk-rfcs/issues/16)|[RFC Process](https://github.com/aws/aws-cdk-rfcs/pull/53)|[@MrArnoldPalmer](https://github.com/MrArnoldPalmer)|resolved
<!--END_TABLE-->

## What does all this mean?

This document is a lot of information about process thats meant to help guide.
It is not a set of rules that need to be strictly applied. It is designed to
help contributors (and thats you!) become more involved with the tools that they
rely on. All efforts to contribute are encouraged and appreciated.

## What is an RFC?

An RFC is a document that proposes and details a change or addition to the CDK,
JSII, and other related tooling. It also is a process for reviewing and
discussing the proposal and tracking its implementation. "Request for Comments"
means a request for discussion and oversight about the future of the CDK and
JSII from contributors and users. It is an open forum for suggestions,
questions, and feedback.

The process is intended to be as lightweight and reasonable as possible for the
present circumstances. As usual, we are trying to let the process be driven by
consensus and community norms, not impose more structure than necessary.

The RFC process itself is subject to changes as dictated by the core team and
the community. Proposals can include proposed changes to the RFC process itself
to better serve contributors.

## Contributions

Contributions are welcome from anyone in a variety of ways.

- [Reviewing and dicussing existing proposals](#reviewing-rfcs)

Comments are welcome on proposal tracking issues and RFC pull requests. This can
be to show support for a feature that you're really interested in having, or to
point out possible red flags or downsides to the change.

- [Creating new proposals](#what-the-process-is)

If a feature or change you think is needed hasn't been proposed, create a new
tracking issue.

- [Writing RFC documents](#what-the-process-is)

If you're interested in helping to design an existing proposal, comment on the
tracking issue and get started on an RFC document.

- [Implementing proposals that are ready](#implementing-an-rfc)

Once a proposal has been reviewed and is ready, contributions to its
implementation are greatly appreciated. We try to estimate the effort needed to
implement a proposal. If you're looking for a good introductory project, [look
for proposals that are labeled "ready" and "effort/small".](https://github.com/awslabs/aws-cdk-rfcs/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Astatus%2Fready+label%3Aeffort%2Fsmall)

## When to follow this process

You should consider using this process if you intend to make "substantial"
changes to [AWS CDK](https://github.com/aws/aws-cdk),
[JSII](https://github.com/aws/jsii), or related tools. Some examples that would
benefit from an RFC are:

- Any change to existing APIs that could break existing code.
- The removal of existing features or public APIs.
- The introduction of new idiomatic usage or conventions, even if they do not
  include code changes to CDK or JSII themselves.
- Changes to the documented contribution workflow.
- Features that cross multiple construct libraries.
- Additions or changes to framework capabilities.
- Additions or changes to formal specifications like cloud assembly, tree.json,
  JSII, etc.

The RFC process is a great opportunity to get more eyeballs on your proposal
before it becomes a part of a released version of CDK/JSII. Quite often, even
proposals that seem "obvious" can be significantly improved once a wider group
of interested people have a chance to weigh in.

The RFC process can also be helpful to encourage discussions about a proposed
feature as it is being designed, and incorporate important constraints into the
design while it's easier to change, before the design has been fully
implemented.

If you submit a pull request to implement a new major feature without going
through the RFC process, it may be closed with a polite request to submit an RFC
first.

Some changes do not require an RFC:

- Bugfixes for known issues.
- Additions only likely to be _noticed by_ other developers of CDK/JSII, invisible
  to users of CDK/JSII.
- Additions of missing L1 or L2 constructs. Unless the service and/or constructs
  are especially complex or intentionally diverge from existing api design best
  practices.

If you're not sure whether your change requires an RFC, feel free to create an
issue and ask.

## What the process is

In short, to get a major feature added to CDK/JSII, one usually first gets the
RFC merged into the RFC repo as a markdown file. At that point the RFC is
'ready' and may be implemented with the goal of eventual inclusion into
CDK/JSII.

- [Create a tracking issue](https://github.com/awslabs/aws-cdk-rfcs/issues/new?template=tracking-issue.md)
  for the proposed feature if one doesn't already exist. Use the tracking issue
  template as a guide. If a tracking issue already exists, make sure to update
  it and assign it to let others know you're working on a proposal.
- Fork the [RFC repo](https://github.com/awslabs/aws-cdk-rfcs).
- Copy `0000-template.md` to `text/<rfc#>-<my-feature>.md` where <rfc#> is the
  tracking issue number and `<my-feature>` is the rfc title.
- Fill in the RFC. Put care into the details: **We welcome all honest efforts to
  contribute.**.
- Submit a pull request with the title `RFC: <rfc#> <title>` where <rfc#> is the
  tracking issue number and title is the name of the proposal. As a pull request
  the RFC will receive design feedback from the core team and the larger
  community, and the author should be prepared to make revisions in response.
  - Update the tracking issue with a link to the RFC PR.
- Build consensus and integrate feedback. RFCs that have broad support are much
  more likely to make progress than those that don't receive any comments.
- Eventually, the team will decide whether the RFC is a candidate for inclusion
  in CDK/JSII.
- RFCs that are candidates for inclusion in CDK/JSII will enter a "final comment
  period" lasting 3 calendar days. The beginning of this period will be signaled
  by a team member adding a comment and label on the RFCs pull request.
- An RFC can be modified based upon feedback from the team and community.
  Significant modifications may trigger a new final comment period.
- An RFC may be rejected by the team after public discussion has settled and
  comments have been made summarizing the rationale for rejection. A member of
  the team should then close the RFCs associated pull request.
- An RFC may be accepted at the close of its final comment period. A team member
  will merge the RFCs associated pull request, at which point the RFC will
  become 'ready'.

If the submitter is someone from our CDK community (i.e., not core team member),
a core team member will be assigned to 'champion' each proposal. They will
generally be the ones updating the RFCs state in the tracking issue as it moves
through the process. They can decide when a final comment period is triggered.

On the other hand, if the submitter is a core team member, they will identify
another core team member, with consent, as their 'champion'. The champion would
be the first contact for brainstorming, process and reviews. The core team
would defer to the champion to do the first few rounds of reviews, after which
the rest of the team should be engaged.

## The RFC Life Cycle

![rfc-states](https://g.gravizo.com/svg?digraph%20states%20{node%20[shape=ellipse];proposed%20[label%20=%20%22Proposed%22];pending%20[label%20=%20%22Pending%22];fcp%20[label%20=%20%22Final%20Comment%20Period%22];ready%20[label%20=%20%22Ready%22];resolved%20[label%20=%20%22Resolved%22];proposed%20-%3E%20pending%20[label%20=%20%22%20rfc%20pr%20created%22];pending%20-%3E%20pending%20[label%20=%20%22%20revisions%22];pending%20-%3E%20fcp%20[label%20=%20%22core%20team%20approval%20%20%20%20%22];fcp%20-%3E%20pending%20[label%20=%20%22%20revision%20requested%22];fcp%20-%3E%20ready%20[label%20=%20%22%20merged%22];ready%20-%3E%20resolved%20[label%20=%20%22%20implementation%20complete%22];})

<!-- for later reference from renderer -->
<details>
custom_mark10
  digraph states {
    node [shape=ellipse];
    proposed [label = "Proposed"];
    pending [label = "Pending"];
    fcp [label = "Final Comment Period"];
    ready [label = "Ready"];
    resolved [label = "Resolved"];
    proposed -> pending [label = " rfc pr created"];
    pending -> pending [label = " revisions"];
    pending -> fcp [label = "core team approval    "];
    fcp -> pending [label = " revision requested"];
    fcp -> ready [label = " merged"];
    ready -> resolved [label = " implementation complete"];
  }
custom_mark10
</details>

An RFC flows through the following states.

1. Proposed - A tracking issue has been created with a basic outline of the
   proposal.
2. Pending - An RFC document has been written with a detailed design and a PR is
   under review.
3. Final Comment Period - A core team member has been assigned to oversee the
   proposal and at least 1 core team member has approved the RFC PR.
   - An RFC may be reverted or closed during final comment period if a member of
     the core team or community raises a previously unforeseen issue that is
     cause for concern.
4. Ready - Final comment period is complete and the PR is merged.
5. Resolved - The implementation is complete and merged across appropriate
   repositories.

Once an RFC becomes ready, then authors may implement it and submit the feature
as a pull request to the aws-cdk or related repos. Becoming 'ready' is not a
rubber stamp, and in particular still does not mean the feature will ultimately
be merged; it does mean that the core team has agreed to it in principle and are
amenable to merging it.

Furthermore, the fact that a given RFC has been accepted and is 'ready' implies
nothing about what priority is assigned to its implementation, nor whether
anybody is currently working on it.

Modifications to RFCs marked 'ready' can be done in followup PRs. We strive to
write each RFC in a manner that it will reflect the final design of the feature;
but the nature of the process means that we cannot expect every merged RFC to
actually reflect what the end result will be at the time of the next major
release; therefore we try to keep each RFC document somewhat in sync with the
feature as planned, tracking such changes via followup pull requests to the
document.

## Reviewing RFCs

Each week the team will attempt to review some set of open RFC pull requests.
Comments and feedback on proposals in any state of the process are welcome and
encouraged.

Every RFC that we accept should have a core team champion, who will represent
the feature and its progress. When an RFC is merged, we try to label the
tracking with an estimation of effort required for implementation. These are
general "t-shirt size" estimates e.g. small, medium, large.

## Implementing an RFC

While the author of an RFC (like any other developer) is welcome to offer an
implementation for review after the RFC has been accepted, they have no
obligation to do so.

If you are interested in working on the implementation for an RFC marked
'ready', but cannot determine if someone else is already working on it, feel
free to ask (e.g. by leaving a comment on the associated tracking issue).

**AWS CDK's RFC process owes its inspiration to the [Yarn RFC process], [Rust
RFC process], [React RFC process], and [Ember RFC process]**

[yarn rfc process]: https://github.com/yarnpkg/rfcs
[rust rfc process]: https://github.com/rust-lang/rfcs
[react rfc process]: https://github.com/reactjs/rfcs
[ember rfc process]: https://github.com/emberjs/rfcs
