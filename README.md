# AWS CDK RFCs - [Pending RFC List](https://github.com/awslabs/aws-cdk-rfcs/pulls)

Many changes, including bug fixes and documentation improvements can be
implemented and reviewed via the normal GitHub pull request workflow.

Some changes though are "substantial", and we ask that these be put through a
bit of a design process and produce a consensus among the CDK core team.

The "RFC" (request for comments) process is intended to provide a consistent and
controlled path for new features to enter the project.

[Pending RFC List](https://github.com/awslabs/aws-cdk-rfcs/pulls)

## When to follow this process

You should consider using this process if you intend to make "substantial"
changes to [AWS CDK](https://github.com/aws/aws-cdk),
[JSII](https://github.com/aws/jsii), or related tools. Some examples that would
benefit from an RFC are:

- Any change to existing APIs that could break existing code.
- The removal of existing features or public APIs.
- The introduction of new idiomatic usage or conventions, even if they do not
  include code changes to CDK itself.
- Changes to the documented contribution workflow.
- Features that cross multiple construct libraries.
- Additions or changes to framework capabilities.
- Additions or changes to formal specifications like cloud assembly, tree.json,
  jsii, etc.

The RFC process is a great opportunity to get more eyeballs on your proposal
before it becomes a part of a released version of CDK. Quite often, even
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
- Additions only likely to be _noticed by_ other developers-of-CDK, invisible to
  users-of-CDK.
- Additions of missing L1 or L2 constructs. Unless the service and/or constructs
  are especially complex or intentionally diverge from existing api design best
  practices.

## What the process is

In short, to get a major feature added to CDK, one usually first gets the RFC
merged into the RFC repo as a markdown file. At that point the RFC is 'ready'
and may be implemented with the goal of eventual inclusion into CDK.

- [Create a tracking issue](https://github.com/awslabs/aws-cdk-rfcs/issues/new?template=tracking-issue.md)
  for the proposed feature if one doesn't already exist. Use the tracking issue
  template as a guide. If a tracking issue already exists, make sure to update
  it and assign it to let others know you're working on a proposal.
- Fork the RFC repo https://github.com/awslabs/aws-cdk-rfcs
- Copy `0000-template.md` to `text/<rfc#>-<my-feature>.md` where <rfc#> is the
  tracking issue number and <my-feature> is the rfc title.
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
  in CDK.
- RFCs that are candidates for inclusion in CDK will enter a "final comment
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

A core team member will be assigned to 'champion' each proposal. They will
generally be the ones updating the RFCs state in the tracking issue as it moves
through the process. They can decide when a final comment period is triggered.

## The RFC life-cycle

![rfc-states](https://g.gravizo.com/svg?digraph%20states%20{node%20[shape=ellipse];proposed%20[label%20=%20%22Proposed%22];pending%20[label%20=%20%22Pending%22];fcp%20[label%20=%20%22Final%20Comment%20Period%22];ready%20[label%20=%20%22Ready%22];resolved%20[label%20=%20%22Resolved%22];proposed%20-%3E%20pending%20[label%20=%20%22%20rfc%20pr%20created%22];pending%20-%3E%20pending%20[label%20=%20%22%20revisions%22];pending%20-%3E%20fcp%20[label%20=%20%22core%20team%20approval%20%20%20%20%22];fcp%20-%3E%20pending%20[label%20=%20%22%20revision%20requested%22];fcp%20-%3E%20ready%20[label%20=%20%22%20merged%22];ready%20-%3E%20resolved%20[label%20=%20%22%20implementation%20complete%22];})

<!-- for later reference from renderer -->
<details> 
<summary></summary>
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

## Implementing an RFC

While the author of an RFC (like any other developer) is welcome to offer an
implementation for review after the RFC has been accepted, they have no
obligation to do so.

If you are interested in working on the implementation for an RFC marked
'ready', but cannot determine if someone else is already working on it, feel
free to ask (e.g. by leaving a comment on the associated tracking issue).

## Reviewing RFCs

Each week the team will attempt to review some set of open RFC pull requests.

Every RFC that we accept should have a core team champion, who will represent
the feature and its progress.

## Help this is all too informal!

The process is intended to be as lightweight and reasonable for the present
circumstances. As usual, we are trying to let the process be driven by consensus
and community norms, not impose more structure than necessary.

The RFC process itself is subject to changes as dictated by the core team and
the community.

**AWS CDK's RFC process owes its inspiration to the [Yarn RFC process], [Rust
RFC process], [React RFC process], and [Ember RFC process]**

[yarn rfc process]: https://github.com/yarnpkg/rfcs
[rust rfc process]: https://github.com/rust-lang/rfcs
[react rfc process]: https://github.com/reactjs/rfcs
[ember rfc process]: https://github.com/emberjs/rfcs
