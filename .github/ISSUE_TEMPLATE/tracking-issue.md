---
name: "RFC Tracking Issue"
about: "Tracking issue for an RFC"
title: proposal title
labels: management/tracking, status/proposed
---

## Description

Short description of the proposed feature.

## Roles

| Role                | User
|---------------------|------------------------------
| Proposed by         | @alias
| Author(s)           | @alias, @alias, @alias
| API Bar Raiser      | @alias
| Stakeholders        | @alias, @alias, @alias

> See [RFC Process](https://github.com/aws/aws-cdk-rfcs#rfc-process) for details

## Workflow

- [x] Tracking issue created (label: `status/proposed`)
- [ ] API bar raiser assigned (ping us at
  [#aws-cdk-rfcs](https://cdk-dev.slack.com/archives/C025ZFGMUCD) if needed)
- [ ] Kick off meeting
- [ ] RFC pull request submitted (label: `status/review`)
- [ ] Community reach out (via Slack and/or Twitter)
- [ ] API signed-off (label `api-approved` applied to pull request)
- [ ] Final comments period (label: `status/final-comments-period`)
- [ ] Approved and merged (label: `status/approved`)
- [ ] Execution plan submitted (label: `status/planning`)
- [ ] Plan approved and merged (label: `status/implementing`)
- [ ] Implementation complete (label: `status/done`)

---

> Author is responsible to progress the RFC according to this checklist, and
apply the relevant labels to this issue so that the RFC table in README gets
updated.
