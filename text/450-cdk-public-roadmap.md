# CDK PUBLIC ROADMAP

* **Original Author(s):**: @evgenyka
* **Tracking Issue**: #450
* **API Bar Raiser**: @{BAR_RAISER_USER}

Today, users have a problem when they would like to know the future plans of CDK team. Users need a way to get frequent updates and mid/long term visibility into product roadmap.

## Working Backwards

**CHANGELOG** 
`BREAKING CHANGE` - the proposed will replace the current process for AWS CDK Roadmap updates.

**README**
This roadmap is meant to making it easier to communicate with all stakeholders and align on the expected outcomes. Therefore, we prefer to keep it in the same tool and provide an easy and convenient way to get an updates and also update on the progress.
The suggested approach will be:
- Use Issue as a primary entity for the Product Roadmap
- Tag the Product Roadmap issues with "Planning" label for easy search/filtering
- Have two types:
    - Half-year roadmap: two issues (January - June, July - December) that will outline the 6 months plans for the team
    - Iteration plan: dedicated Issue for each month (an iteration is considered as a month) that outlines what is the focus in each area for this monnt.
- Each issue should be created according to the template (half-year or monthly)

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

Q: who is responsible/in charge of creating and updating the roadmdap?
A: CDK Product Manager is responsible for hal-year updates, any contributer is reponsible to update the iteration plan.

Q: how frequent the plans will be updated?
A: Iteration plans are reviewed and updated monthly (calendar), half year issue is updated in advance

Q: how can I influence the roadmap plans? 
A: provide your votes and comments in the issue 

### What are we launching today?

A new process for creating and maintaining the product roadmap. 

### Why should I use this feature?

To get visibility and information about what are the mid/short term plans of the team.
Provide your inputs, suggestions and comments to the proposed agenda.

## Internal FAQ
TBD

### Why are we doing this?

Current public roadmap is not up to date, which provdies ambiguety for the community.
It is hard to update, hard to review and almost impossible to digest.

### Why should we _not_ do this?

We do have current public roadmap, need to invest time and effort to keep it actual.

### What is the technical solution (design) of this feature?

- Develop templates for Half-year and iteration roadmap (reflect business goals, domains, challenges, customer feedbacks)
- Product Manager generate half-year roadmap
- Product Manager and contributors create iteration plan
- Contributes and users comment/vote for each

### Is this a breaking change?

`BREAKING CHANGE` - the proposed will replace the current  AWS CDK Roadmap - https://github.com/orgs/aws/projects/7

### What alternative solutions did you consider?

- Keep Product Roadmap in Project View
- Provide Product Roadmap aside of the tool
- Not providing Roadmap

### What are the drawbacks of this solution?

- Content: some internal stuff that is not affecting/impacting the community get exposed
- Discipline: keep process actual
- Review: will require extra effort to review contributers comments, feedbacs and inputs 

### What is the high-level project plan?

- Get RFC comments and adjust the process
- Develop the templates
- Launch current month update
- Launch half-year update

### Are there any open issues that need to be addressed later?

TBD

## Appendix

Example: https://github.com/microsoft/TypeScript/labels/Planning 