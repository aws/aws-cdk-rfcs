---
name: "RFC Tracking Issue"
about: "Tracking issue for an RFC"
title: proposal title
labels: management/tracking, status/proposed
---

## Description

Short description of the proposed feature:
* First sentence describes the feature (think changelog entry)
* Describe the change to users as if it was already been implemented (i.e. like it would be described in the README).
* Add code or CLI commands as appropriate
* Keep it short

## Roles

| Role                | User
|---------------------|------------------------------
| Proposed by         | @alias
| Driver              | @alias
| Approvers           | @alias, @alias
| Stakeholders        | @alias, @alias, @alias
| Implementation lead | @alias

## Workflow

- [x] Tracking issue created (label: `status/proposed`)
- [ ] Driver assigned
- [ ] Approvers assigned
- [ ] Stakeholders identified
- [ ] Kick off meeting
- [ ] RFC pull request created (label: `status/review`)
- [ ] Community reach out (via Slack and/or Twitter)
- [ ] Final comments period (label: `status/final-comments-period`)
- [ ] Approved and merged (label: `status/approved`)
- [ ] Implementation lead assigned
- [ ] Execution plan submitted (label: `status/planning`)
- [ ] Plan approved and merged (label: `status/implementing`)
- [ ] Implementation complete (label: `status/done`)

---

> Driver is responsible to progress the RFC according to this checklist, and apply the
relevant labels to this issue so that the RFC table in README gets updated.
