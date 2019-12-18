# AWS CDK RFCs - [Active RFC List](https://github.com/rust-lang/rfcs/pulls)

Many changes, including bug fixes and documentation improvements can be
implemented and reviewed via the normal GitHub pull request workflow.

Some changes though are "substantial", and we ask that these be put
through a bit of a design process and produce a consensus among the CDK
core team.

The "RFC" (request for comments) process is intended to provide a
consistent and controlled path for new features to enter the project.

[Active RFC List](https://github.com/awslabs/aws-cdk-rfcs/pulls)

## When to follow this process

You should consider using this process if you intend to make "substantial"
changes to [AWS CDK](), [JSII](), or related tools. Some examples that would
benefit from an RFC are:

- Any change to existing APIs that would break existing code.
- The removal of existing features or public APIs.
- The introduction of new idiomatic usage or conventions, even if they
  do not include code changes to React itself.

The RFC process is a great opportunity to get more eyeballs on your proposal
before it becomes a part of a released version of CDK. Quite often, even
proposals that seem "obvious" can be significantly improved once a wider
group of interested people have a chance to weigh in.

The RFC process can also be helpful to encourage discussions about a proposed
feature as it is being designed, and incorporate important constraints into
the design while it's easier to change, before the design has been fully
implemented.

If you submit a pull request to implement a new feature without going through
the RFC process, it may be closed with a polite request to submit an RFC first.

Some changes do not require an RFC:

- Bugfixes for known issues.
- Additions only likely to be _noticed by_ other developers-of-CDK,
  invisible to users-of-CDK.
- Additions of missing L1 or L2 constructs.

## What the process is

In short, to get a major feature added to CDK, one usually first gets
the RFC merged into the RFC repo as a markdown file. At that point the RFC
is 'active' and may be implemented with the goal of eventual inclusion
into CDK.

- Fork the RFC repo https://github.com/awslabs/aws-cdk-rfcs
- Copy `0000-template.md` to `text/0000-my-feature.md` (where 'my-feature' is
  descriptive. Don't assign an RFC number yet.
- Fill in the RFC. Put care into the details: **RFCs that do not present
  convincing motiviation, demonstrate understanding of the impact of the design,
  or are disingenuous about the drawbacks or alternatives tend to be
  poorly-received**.
- Submit a pull request. As a pull request the RFC will receive design
  feedback from the core team and the larger community, and the author should
  be prepared to make revisions in response.
- Build consensus and integrate feedback. RFCs that have broad support are
  much more likely to make progress than those that don't receive any comments.
- Eventually, the team will decide whether the RFC is a candidate for
  inclusion in CDK.
- RFCs that are candidates for inclusion in CDK will enter a "final comment
  period" lasting 3 calendar days. The beginning of this period will be signaled
  with a comment and label on the RFCs pull request.
- An RFC can be modified based upon feedback from the team and community.
  Significant modifications may trigger a new final comment period.
- An RFC may be rejecte4d by the team after public discussion has settled and
  comments have been made summarizing the rationale for rejection. A member of
  the team should then close the RFCs associated pull request.
- An RFC may be accepted ad the close of its final comment period. A team
  member will merge the RFCs associated pull request, at which point the RFC
  will become 'active'.

## The RFC life-cycle

Once an RFC becomes active, then authors may implement it and submit the feature
as a mpull request to the aws-cdk or related repos. Becoming 'active' is not a
rubber stamp, and in particular still does not mean the feature will ultimately
be merged; it does mean that the core team has agreed to it in principle and are
amenable to merging it.

Furthermore, the fact that a given RFC has been accepted and is 'active' implies
nothing about what priority is assigned to its implementation, nor whether
anybody is currently working on it.

Modifications to active RFCs can be down in followup PRs. We strive to write
each RFC in a manner that it will refelct the final design of the feature; but
the nature of the process means that we cannot expect every merged RFC to
actually reflect what the end result will be at the time of the next major
release; therefore we try to keep each RFC document somewhat in sync with the
feature as planned, tracking such changes via followup pull requests to the
document.

## Implementing an RFC

The author of an RFC is not obligated to implement it. Of course, the RFC
author (like any other developer) is welcome to post an implementation for
review after the RFC has been accepted.

If you are interested in working on the implementation for an 'active' RFC, but
cannot determine if someone else is already working on it, feel free to ask
(e.g. by leaving a comment on the associated issue).

## Reviewing RFCs

Each week the team will attempt to review some set of open RFC pull requests.

Every RFC that we accept should have a core team champion, who will represent
the feature and its progress.

## Help this is all too informal!

The process is intended to be as lightweight as reasonable for the present
circumstances. As usual, we are trying to let the process be driven by consensus
and community norms, not impose more structure than necessary.

**AWS CDK's RFC process owes its inspiration to the [Yarn RFC process], [Rust RFC process], [React RFC process], and [Ember RFC process]**

[yarn rfc process]: https://github.com/yarnpkg/rfcs
[rust rfc process]: https://github.com/rust-lang/rfcs
[react rfc process]: https://github.com/reactjs/rfcs
[ember rfc process]: https://github.com/emberjs/rfcs
