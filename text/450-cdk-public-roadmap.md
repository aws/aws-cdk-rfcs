# CDK PUBLIC ROADMAP

* **Original Author(s):**: @evgenyka
* **Tracking Issue**: #450
* **API Bar Raiser**: @{BAR_RAISER_USER}

Today, users have a problem when they would like to know the future plans of the CDK team.
Users need a way to get frequent updates and mid/long term visibility into product roadmap.

## Working Backwards

**BLOG POST**
Visibility and collaboration are key success elements for our project.
This roadmap is meant to provide visibility to the community on the plans and expected outcomes and making it easier to communicate with the stakeholders.
As a contributor or regular user, you will be able to review and understand what are the team plans for the next iteration (1 month) or half year.
You will also be able to comment, suggest, vote or complain about the content that is either planned or currently at work.
You will also be able to understand the prioritization and selection process for the content that is being implemented.
We prefer to have it in the same tool to keep it user-centric and focused.
It should be easy to create, update, understand and respond.
Therefore, the forward-going approach will be:

- Use Issue as a primary entity for the Product Roadmap.
- Tag the Product Roadmap issues with "Planning" label for easy search/filtering.
- Half-year roadmap: 2 issues (January - June, July - December) that will outline the 6 months plans for the team.
- Iteration plan: dedicated Issue for each and every month (iteration == month) that outlines what is the focus in each area.
- The roadmap is focusing on customer value via innovation and tech debt projects or activities.It is not for bug fixes or PR-review updates.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

Q: Who is responsible/in charge of creating and updating the roadmap?
A: CDK Product Manager is responsible for half-year updates, any contributor is responsible to update the iteration plan.

Q: how frequently will the plans be updated?
A: Iteration plans are reviewed and updated monthly (calendar), half year issue is updated in advance

Q: how can I influence the roadmap plans?
A: provide your votes and comments in the issue

Q: I've opened a bug, will it be reflected in one of the roadmaps?
A: No, Product Roadmap is reserved for innovation and tech debt increments only.

### What are we launching today?

A new process for creating and maintaining the product roadmap.

### Why should I use this feature?

To get visibility and information about what are the mid/short term plans of the team.
Provide your inputs, suggestions and comments to the proposed agenda.

## Internal FAQ

TBD

### Why are we doing this?

Current public roadmap is not up to date, which generates uncertainty for the community.
It is a lot of work to update it, hard to holistically review it and virtually impossible to respond to it.

### Why should we _not_ do this?

We do have a public roadmap, just need to invest in keeping it actual and get users feedback.

### What is the technical solution (design) of this feature?

- Develop templates for Half-year and iteration roadmap (reflect business goals, domains, challenges, customer feedbacks)
- Product Manager generate half-year roadmap
- Product Manager and contributors create iteration plan
- Contributors and users comment/vote for each

### What alternative solutions did you consider?

- Keep the Product Roadmap in Project View as of today
- Provide Product Roadmap outside of the tool
- Not disclosing the Roadmap

### What are the drawbacks of this solution?

- Content: some internal stuff that is not affecting/impacting the community may get exposed
- Discipline: keep process and information actual and up-to-date
- Review: will require extra effort to review contributors comments, feedback and inputs

### What is the high-level project plan?

- Get RFC comments and adjust the process
- Develop the templates
- Launch current month update
- Launch half-year update

### Are there any open issues that need to be addressed later?

TBD

## Appendix

Example: <https://github.com/microsoft/TypeScript/labels/Planning>
