# RFC: Feature Flag Advisor

* Original Author(s): @huang-benny
* Tracking Issue: [#808](https://github.com/aws/aws-cdk-rfcs/issues/808)
* API Bar Raiser: @kaizencc

CDK developers and AWS customers often struggle to know whether a library is actively maintained, well-tested, and safe to adopt.
Today, this requires manually checking repos, scanning docs, and guessing at signals like stars or commit history. Library Quality
Scoring replaces that guesswork with a clear, explainable score backed by evidence, so customers can differentiate libraries at a
glance and maintainers know exactly how to improve.

## Working Backwards

### README

#### CDK Constrct Analyzer

`@cdklabs/cdk-construct-analyzer` is a CLI and library for evaluating the quality of construct libraries.

It calculates a single score (0–100) based on three equally weighted aspects:

* **Maintenance**: Is the project actively maintained and are owners/maintainers responsive?
* **Quality**: Does the project have good docs, tests, linting, and hygiene?
* **Popularity**: How widely is the library adopted in the community?

Each package is scored on their latest version. Scores are unlikely to change drasically between versions.

#### CLI Usage

```> cdk-construct-analyzer --help

Usage: cdk-construct-analyzer [package] [options]

Arguments:
  package   Name of the construct package to score (Scored on the latest version)

Options:
 --verbose  Show detailed breakdown of signals
 --help     Show this help message
```

You can run it locally on any library published to npm by providing its package name:

```> cdk-construct-analyzer @cdklabs/cdk-ecs-codedeploy

LIBRARY: @cdklabs/cdk-ecs-codedeploy
VERSION: 0.0.421

OVERALL SCORE: 75/100

---

SUBSCORES
  Maintenance :            66/100
  Quality     :            76/100
  Popularity  :            83/100
```

Add `--verbose` for a detailed breakdown:

```> cdk-construct-analyzer @cdklabs/cdk-ecs-codedeploy --verbose

LIBRARY: @cdklabs/cdk-ecs-codedeploy
VERSION: 0.0.421

OVERALL SCORE: 75/100

---

SUBSCORES
  Maintenance :            66/100
  Quality     :            76/100
  Popularity  :            83/100
  
---

=== Maintenance ===                               SCORE  WEIGHT
— Time to first response......................... ★★★☆☆    3
— Commit Frequency .............................. ★★★☆☆    3
— Release Frequency ............................. ★★★★☆    3
— Lockfile Update Recency ....................... ★★★★★    3
— Open issues / total issues .................... ★★★★★    3
— Median PR time-to-merge ....................... ★★☆☆☆    2
— Number of Contributors ........................ ★★★☆☆    2
— Most recent commit ............................ ★★★★☆    2

=== Quality ===                                   SCORE  WEIGHT
— README, API Reference and usage examples ...... ★★★★★    3
— Tests checklist (unit/snapshot) ............... ★★★☆☆    3
— Passing CI builds ............................. ★★★★★    3
— Author Track Record ........................... ★★★★★    3
— Changelog Present ............................. ★☆☆☆☆    3
— Stable versioning ............................. ★★★★☆    2
— License, .gitignore/.npmignore present ........ ★★★★☆    1
— Multi-language Support ........................ ★★★☆☆    1

=== Popularity ===                                SCORE  WEIGHT
— Weekly Downloads .............................. ★★★★★    3
— Repo stars .................................... ★★★★☆    2
— Contributors .................................. ★★★☆☆    1
```

#### Scoring Pillars and Signals

The scoring algorithm evaluates each construct on three pillars with multiple weighted signals as support:

##### Maintenance

Helps determine if the project is active and healthy, or abandoned. Signals include:

* Time to first response: Fast issue resolution reflects active, responsive maintainers.
* Commit Frequency: Frequent commits show steady development and maintenance.
* Release Frequency: Regular releases signal iteration, patching, and progress.
* Open issues / total issues: A lower ratio of open issues indicates backlog health and follow-through
normalized by repository popularity.
* Median PR time-to-merge: Shorter merge times suggest attentiveness to community contributions.
* Number of Contributors: More contributors reduce risk of abandonment and reflect shared maintenance.
* Most recent commit: More recent commits help confirm that the project is active and not stale.

##### Quality

Signals that are visible in the repo/package that showcases quality:

* README, API Reference and usage examples: High quality documentation makes the project easier to adopt and use.
* Tests checklist (unit/snapshot): Tests ensure correctness and prevent regressions.
* Passing CI builds: A passing CI pipeline indicates functional and validated code.
* Author Track Record: Measures how many packages the author has published, more published packages often indicate greater experience.
* Changelog Present: A changelog helps users track updates.
* License, .gitignore/.npmignore present: Legal clarity and clean packaging are basic hygiene signals.
* Stable versioning (>=1.x.x, not deprecated): Indicates API maturity and stability.
* Multi-language Support: Supporting more CDK languages shows extra effort and intent to reach a broader developer base

##### Popularity

Signals that reflect adoption and community size:

* Contributors: More contributors typically indicate shared maintenance and community trust.
* Weekly Downloads: High or rising download counts suggest the library is being actively used.
* Repo stars: Stars represent general developer interest and visibility on GitHub.

#### Scoring Weights

Not every signal has the same impact on library , so each signal is assigned an importance level. A signal with
importance level 3 will carry 3× the weight of a signal with importance level 1:

* **3 — Critical** signals that strongly influence a library’s overall health and usability (3 points)
* **2 — Valuable** indicators that support confidence but aren’t decisive signals (2 points)
* **1 — Supportive** or “nice to have” checks (1 points)

Each signal is also graded into one of five fixed buckets, shown using star ratings:

* ★★★★★ = 100
* ★★★★☆ = 75
* ★★★☆☆ = 50
* ★★☆☆☆ = 25
* ★☆☆☆☆ = 0

When calculating a subscore (Maintenance, Quality, Popularity), each signal’s grade is weighted by its importance.
Once all signals in a category are evaluated, the score is normalized to a 0–100 scale. This ensures that categories
with more signals don’t automatically outweigh others.
Finally, the three pillar scores are combined into the overall score using equal weights:

* **Maintenance**
* **Quality**
* **Popularity**

## Public FAQ

### What are we launching today?

We are launching a new CLI tool and library, called cdk-construct-analyzer, that evaluates CDK construct libraries and
produces a score. This is not a change to CDK itself or Construct Hub directly, but a standalone project that can be
used by customers, construct authors, and eventually integrated into Construct Hub.

### Why should I use this feature?

Use cases this feature addresses:

* **Construct users** can quickly judge if a third-party construct is actively maintained, well-documented, and safe to adopt.
* **Construct authors** can identify gaps (e.g., missing README examples, outdated dependencies, lack of tests) and
improve their libraries.

## Internal FAQ

### Why are we doing this?

Today, it’s hard to evaluate construct libraries objectively. There are thousands of libraries and there is no standard
to differentiate between those that are actively maintained and those that are stale, poorly documented, or abandoned.
This makes it harder for developers to confidently select third-party libraries. Library Quality Scoring provides
transparency and structure, so customers can make informed decisions and authors get clear feedback.

### Why should we not do this?

A risk of implementing this is that some authors may feel judged by an automated score. To mitigate this, the score is
explainable and transparent, with a verbose breakdown of all signals so authors understand how to improve.

Customers could start treating the score as a guarantee of quality. If people rely only on the score and stop evaluating
packages for themselves, that could create a false sense of security. That risk gets worse if our system produces a high
score for a construct that, in practice, turns out to be poor quality or vice versa.

The metrics we’re using are also just signals. For example, a project might technically have tests, but they may not cover
much. Or it might have had a recent commit, but the project could still be functionally abandoned.

The score system is also public, there’s always the chance that some people will try to “game” it. For example, authors
might start making more low-effort commits just to get a higher score on commit frequency.

### What is the technical solution (design) of this feature?

At a high level, the system consists of two parts: a CLI tool and a reusable library. The CLI supports two primary use cases,
scoring any public CDK library by name (for example, @cdklabs/erc-deployerments) for local evaluation, and enabling future
integrations with tools like Construct Hub or internal dashboards. The underlying library encapsulates the scoring logic and
is designed to be a general-purpose, standalone scoring engine that can be adopted in any context—whether internal tooling,
dashboards, or third-party registries.

The scoring process works as follows:

* Take inputs: Users provide an npm package name.
* Normalize: The tool will look up the package metadata from sources like npm and GitHub.
* Collect signals:
  * Maintenance: how active the project is (recent releases, frequency of updates, how quickly issues/PRs are handled, active maintainers).
  * Quality: what the project includes (README, tests, lint setup, changelog, license, repo hygiene, CDK-specific setup).
  * Popularity: how widely it’s used (downloads from registries, growth trends, GitHub stars, forks, and contributors).
* Apply weights: Each of these three areas is scored and weighted, then combined into one final score out of 100.
* Show outputs: The results are available in the CLI (with either a simple summary or a detailed verbose breakdown).

To keep the system modular and easy to maintain, signal weights are defined in a central config file. Each signal includes a
pillar field that specifies whether it belongs to Maintenance, Quality, or Popularity. The logic for evaluating each signal lives
in its corresponding file within the signals directory (for example, signals/maintenance.ts). This structure makes it simple to
adjust weights, add new signals, or reorganize categories without changing the core logic. The scoring system also automatically

### Is this a breaking change?

No.

### What alternative solutions did you consider?

We considered scoring each major version of a package independently, since a library’s score could theoretically change across versions.
However, we decided against this because most signals we evaluate, such as maintenance activity, documentation quality, and community
engagement, are measured at the repository level, not per version. In practice, a package’s score is unlikely to vary significantly across
versions, and tracking each version separately would add unnecessary complexity without much benefit.

### Are there any open issues that need to be addressed later?

No.

### How can Gen AI help in this project?

Generative AI can support this project in helpful but limited ways. It could assist with parsing and interpreting unstructured
content like README files, changelogs, and test files to assess quality related signals. When certain metadata is missing or incomplete,
AI can help infer details, for example, detecting whether usage examples are present in documentation or summarizing code structure.
Additionally, Gen AI could be used to generate summaries or suggestions for construct library authors on how to improve their
library’s score. However, Gen AI is not suitable for core scoring logic. Because its outputs are nondeterministic and not auditable,
it cannot be relied on for calculating scores or evaluating libraries in a reproducible and explainable way. Overall, Gen AI can be a
valuable tool for enhancing developer experience, but it should remain a supporting component rather than a decision making tool.

## Appendix

### Signals

The term “signals” is used instead of “metrics” because each data point is a hint, not a guarantee. For example, a project
may have a README but it could be poorly written. These signals come together to them paint a clearer picture.  

| Pillar      | Signal                             | Calculation / Thresholds                                            | Source         | Required | Justification                    | Importance |
|-------------|------------------------------------|---------------------------------------------------------------------|----------------|----------|----------------------------------|------------|
| Maintenance | Time to first response             | 0–1 wk = 100, 1–4 wk = 75, 4–12 wk = 50, 3–12 mths = 25, 1+ yrs = 0 | Repo API       | YES      | Reflects responsiveness          | 3          |
| Maintenance | Commit Frequency                   | >20/month = 100, 6–20 = 75, 1–5 = 50, 0 in 12mo = 0                 | Repo API       | YES      | Shows steady activity            | 3          |
| Maintenance | Release Frequency                  | >55/yr = 100, 34-54/yr = 75, 5-33/yr = 50, 1-4/yr = 25, 0/yr = 0    | Registry API   | YES      | Activity check, responsiveness   | 3          |
| Maintenance | Lockfile Update Recency            | <1 mth = 100, \<3 mth = 75, <6 mth = 50, <1 yr = 25, >1 yr or N/A = 0| Repo API       | YES      | Shows active dependency upkeep   | 3          |
| Maintenance | Open issues / total issues         | <25% = 100, 25-50% = 75, 50–75% = 50, 75%+ = 25, 0 total issues = 0 | Repo API       | YES      | Measures backlog health          | 2          |
| Maintenance | Median PR time-to-merge            | <1wk = 100, 1–4wk = 75, 1–3mo = 50, 3–6mo = 25, 6mo+ = 0            | Repo API       | YES      | Signals maintainer attention     | 2          |
| Maintenance | Number of Contributors             | ≥4/mth = 100, 2–3/mth = 75, 1/mth = 50, 0/mth = 0                   | Repo API       | YES      | Broad community involvement      | 2          |
| Maintenance | Most recent commit                 | <7d = 100, 7–30d = 75, 1–3mo = 50, 3–6mo = 25, >6mo = 0             | Repo API       | YES      | Indicates recency                | 2          |
| Maintenance | Active Maintainers in last 90 days | —                                                                   | Repo API       | NO       | Prevents “bus factor”            | 3          |
| Maintenance | Number of Significant Contributors | —                                                                   | Repo API       | NO       | Measure of team size             | 2          |
| Maintenance | Branch activity                    | —                                                                   | Repo API       | NO       | Hard to normalize                | 1          |
| Maintenance | SemVer                             | —                                                                   | Registry API   | NO       | Maturity ≠ activity              | 1          |
| Quality     | README, API ref, examples          | Full = 100, README only = 50, none = 0                              | Tarball        | YES      | Entry point for users            | 3          |
| Quality     | Tests checklist (unit/snapshot)    | Unit+Snapshot = 100, one = 50, neither = 0                          | npm            | YES      | Ensures correctness              | 3          |
| Quality     | Passing CI builds                  | Passing = 100, Failing = 0                                          | Repo API       | YES      | Code quality enforcement         | 3          |
| Quality     | Author Track Record                | 20+ pkgs = 100, 11–20 = 75, 5–10 = 50, 2–4 = 25, 1 = 0              | Repo API / npm | YES      | Track record of strong authors   | 3          |
| Quality     | Changelog Present                  | Present = 100, Missing = 0                                          | Tarball        | YES      | Transparency for changes         | 3          |
| Quality     | Stable versioning                  | ≥1.x.x & active = 100, <1.0 & active = 50, deprecated = 0           | Registry API   | YES      | Avoids abandoned projects        | 2          |
| Quality     | License, .gitignore/.npmignore     | Both = 100, one = 50, none = 0                                      | Tarball        | YES      | Legal clarity + hygiene          | 1          |
| Quality     | Multi-language Support             | 4+ = 100, 3 = 75, 2 = 50, 1 = 25, fake/missing = 0                  | Tarball        | YES      | Signals extra effort             | 1          |
| Quality     | Dependency freshness / vuln checks | —                                                                   | npm            | NO       | Security                         | 3          |
| Quality     | Download Balance Across Languages  | —                                                                   | All registries | NO       | Confirms real multi-lang support | 1          |
| Quality     | Code complexity                    | —                                                                   | —              | NO       | Hard to automate                 | 1          |
| Quality     | Lint configuration                 | Present = 100, Absent = 0                                           | Tarball        | NO       | Style/consistency                | 1          |
| Quality     | Badges                             | ≥3 meaningful = 100, 1–2 = 50, none = 0                             | Tarball        | NO       | Signals professionalism          | 1          |
| Popularity  | Weekly Downloads                   | 2.5k+ = 100, 251–2.5K = 75 41-250 = 50, 6-40 = 25, <5 = 0           | npm            | YES      | General usage metric             | 3          |
| Popularity  | Repo stars                         | ≥638 = 100, 28-637 = 75, 4-27 = 50, 1-3 = 25, 0 = 0                 | Repo API       | YES      | Popularity proxy                 | 2          |
| Popularity  | Contributors                       | ≥4/mth = 100, 2–3/mth = 75, 1/mth = 50, 0/mth = 0                   | Repo API       | YES      | Health of contributions          | 1          |
| Popularity  | Version Downloads                  | 10K+ = 100, 1K–9K = 75, 100–999 = 50, 10-99 = 25, <10 = 0           | npm            | NO       | Usage of a specific version      | 3          |
| Popularity  | Dependents                         | —                                                                   | libraries.io   | NO       | Shows reuse                      | 3          |
| Popularity  | Forks                              | —                                                                   | Repo API       | NO       | Community engagement             | 2          |
| Popularity  | Subscribers/watchers               | —                                                                   | Repo API       | NO       | Indicates user interest          | 1          |

### Construct Library Scoring Examples

#### **Repository**: `@cdklabs/cdk-docker-image-deployment`

Maintenance: 61/100
Quality:     79/100
Popularity:  75/100
Overall:     72/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 2          | 3        |
| Maintenance | Commit Frequency                   | 3          | 3        |
| Maintenance | Release Frequency                  | 5          | 3        |
| Maintenance | Lockfile Update Recency            | 5          | 3        |
| Maintenance | Open issues / total issues         | 5          | 2        |
| Maintenance | Median PR time-to-merge            | 3          | 2        |
| Maintenance | Number of Contributors             | 1          | 2        |
| Maintenance | Most recent commit                 | 3          | 2        |
| Quality     | README, API ref, examples          | 5          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 5          | 3        |
| Quality     | Passing CI builds                  | 5          | 3        |
| Quality     | Author Track Record                | 5          | 3        |
| Quality     | Changelog Present                  | 1          | 3        |
| Quality     | Stable versioning                  | 3          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 5          | 1        |
| Popularity  | Weekly Downloads                   | 5          | 3        |
| Popularity  | Repo stars                         | 4          | 2        |
| Popularity  | Contributors                       | 1          | 1        |

#### **Repository**: `@cdklabs/cdk-stacksets`

Maintenance: 41/100
Quality:     79/100
Popularity:  75/100
Overall:     65/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 3          | 3        |
| Maintenance | Commit Frequency                   | 1          | 3        |
| Maintenance | Release Frequency                  | 2          | 3        |
| Maintenance | Lockfile Update Recency            | 5          | 3        |
| Maintenance | Open issues / total issues         | 3          | 2        |
| Maintenance | Median PR time-to-merge            | 3          | 2        |
| Maintenance | Number of Contributors             | 1          | 2        |
| Maintenance | Most recent commit                 | 3          | 2        |
| Quality     | README, API ref, examples          | 5          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 5          | 3        |
| Quality     | Passing CI builds                  | 5          | 3        |
| Quality     | Author Track Record                | 5          | 3        |
| Quality     | Changelog Present                  | 1          | 3        |
| Quality     | Stable versioning                  | 3          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 5          | 1        |
| Popularity  | Weekly Downloads                   | 5          | 3        |
| Popularity  | Repo stars                         | 4          | 2        |
| Popularity  | Contributors                       | 1          | 1        |

#### **Repository**: `@cdklabs/cdk-ecr-deployment`

Maintenance: 66/100
Quality:     76/100
Popularity:  83/100
Overall:     75/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 3          | 3        |
| Maintenance | Commit Frequency                   | 3          | 3        |
| Maintenance | Release Frequency                  | 4          | 3        |
| Maintenance | Lockfile Update Recency            | 5          | 3        |
| Maintenance | Open issues / total issues         | 5          | 2        |
| Maintenance | Median PR time-to-merge            | 2          | 2        |
| Maintenance | Number of Contributors             | 3          | 2        |
| Maintenance | Most recent commit                 | 4          | 2        |
| Quality     | README, API ref, examples          | 5          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 3          | 3        |
| Quality     | Passing CI builds                  | 5          | 3        |
| Quality     | Author Track Record                | 5          | 3        |
| Quality     | Changelog Present                  | 1          | 3        |
| Quality     | Stable versioning                  | 5          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 5          | 1        |
| Popularity  | Weekly Downloads                   | 5          | 3        |
| Popularity  | Repo stars                         | 4          | 2        |
| Popularity  | Contributors                       | 3          | 1        |

#### **Repository**: `@pahud/cdk-remote-stack`

Maintenance: 20/100
Quality:     84/100
Popularity:  63/100
Overall:     56/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 3          | 3        |
| Maintenance | Commit Frequency                   | 1          | 3        |
| Maintenance | Release Frequency                  | 1          | 3        |
| Maintenance | Lockfile Update Recency            | 1          | 3        |
| Maintenance | Open issues / total issues         | 5          | 2        |
| Maintenance | Median PR time-to-merge            | 2          | 2        |
| Maintenance | Number of Contributors             | 1          | 2        |
| Maintenance | Most recent commit                 | 1          | 2        |
| Quality     | README, API ref, examples          | 5          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 5          | 3        |
| Quality     | Passing CI builds                  | 1          | 3        |
| Quality     | Author Track Record                | 5          | 3        |
| Quality     | Changelog Present                  | 5          | 3        |
| Quality     | Stable versioning                  | 5          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 5          | 1        |
| Popularity  | Weekly Downloads                   | 4          | 3        |
| Popularity  | Repo stars                         | 4          | 2        |
| Popularity  | Contributors                       | 1          | 1        |

#### **Repository**: `@pahud/cdk-ssm-parameter-store`

Maintenance: 10/100
Quality:     68/100
Popularity:  33/100
Overall:     37/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 1          | 3        |
| Maintenance | Commit Frequency                   | 1          | 3        |
| Maintenance | Release Frequency                  | 1          | 3        |
| Maintenance | Lockfile Update Recency            | 1          | 3        |
| Maintenance | Open issues / total issues         | 1          | 2        |
| Maintenance | Median PR time-to-merge            | 5          | 2        |
| Maintenance | Number of Contributors             | 1          | 2        |
| Maintenance | Most recent commit                 | 1          | 2        |
| Quality     | README, API ref, examples          | 5          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 3          | 3        |
| Quality     | Passing CI builds                  | 1          | 3        |
| Quality     | Author Track Record                | 5          | 3        |
| Quality     | Changelog Present                  | 5          | 3        |
| Quality     | Stable versioning                  | 3          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 3          | 1        |
| Popularity  | Weekly Downloads                   | 3          | 3        |
| Popularity  | Repo stars                         | 2          | 2        |
| Popularity  | Contributors                       | 1          | 1        |

#### **Repository**: `@DataDog/datadog-cdk-constructs-v2`

Maintenance: 86/100
Quality:     99/100
Popularity:  71/100
Overall:     85/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 4          | 3        |
| Maintenance | Commit Frequency                   | 5          | 3        |
| Maintenance | Release Frequency                  | 3          | 3        |
| Maintenance | Lockfile Update Recency            | 5          | 3        |
| Maintenance | Open issues / total issues         | 5          | 2        |
| Maintenance | Median PR time-to-merge            | 5          | 2        |
| Maintenance | Number of Contributors             | 4          | 2        |
| Maintenance | Most recent commit                 | 5          | 2        |
| Quality     | README, API ref, examples          | 5          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 5          | 3        |
| Quality     | Passing CI builds                  | 5          | 3        |
| Quality     | Author Track Record                | 5          | 3        |
| Quality     | Changelog Present                  | 5          | 3        |
| Quality     | Stable versioning                  | 5          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 4          | 1        |
| Popularity  | Weekly Downloads                   | 5          | 3        |
| Popularity  | Repo stars                         | 2          | 2        |
| Popularity  | Contributors                       | 4          | 1        |

#### **Repository**: `@aws/aws-cdk`

Maintenance:100/100
Quality:    100/100
Popularity: 100/100
Overall:    100/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 5          | 3        |
| Maintenance | Commit Frequency                   | 5          | 3        |
| Maintenance | Release Frequency                  | 5          | 3        |
| Maintenance | Lockfile Update Recency            | 5          | 3        |
| Maintenance | Open issues / total issues         | 5          | 2        |
| Maintenance | Median PR time-to-merge            | 5          | 2        |
| Maintenance | Number of Contributors             | 5          | 2        |
| Maintenance | Most recent commit                 | 5          | 2        |
| Quality     | README, API ref, examples          | 5          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 5          | 3        |
| Quality     | Passing CI builds                  | 5          | 3        |
| Quality     | Author Track Record                | 5          | 3        |
| Quality     | Changelog Present                  | 5          | 3        |
| Quality     | Stable versioning                  | 5          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 5          | 1        |
| Popularity  | Weekly Downloads                   | 5          | 3        |
| Popularity  | Repo stars                         | 5          | 2        |
| Popularity  | Contributors                       | 5          | 1        |

#### **Repository**: `@udondan/iam-floyd`

Maintenance: 74/100
Quality:     72/100
Popularity:  67/100
Overall:     71/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 4          | 3        |
| Maintenance | Commit Frequency                   | 5          | 3        |
| Maintenance | Release Frequency                  | 5          | 3        |
| Maintenance | Lockfile Update Recency            | 1          | 3        |
| Maintenance | Open issues / total issues         | 5          | 2        |
| Maintenance | Median PR time-to-merge            | 5          | 2        |
| Maintenance | Number of Contributors             | 2          | 2        |
| Maintenance | Most recent commit                 | 5          | 2        |
| Quality     | README, API ref, examples          | 3          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 3          | 3        |
| Quality     | Passing CI builds                  | 5          | 3        |
| Quality     | Author Track Record                | 4          | 3        |
| Quality     | Changelog Present                  | 5          | 3        |
| Quality     | Stable versioning                  | 3          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 3          | 1        |
| Popularity  | Weekly Downloads                   | 4          | 3        |
| Popularity  | Repo stars                         | 4          | 2        |
| Popularity  | Contributors                       | 2          | 1        |

#### **Repository**: `@hashicorp/terraform-cdk`

Maintenance: 53/100
Quality:     87/100
Popularity:  83/100
Overall:     74/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 4          | 3        |
| Maintenance | Commit Frequency                   | 1          | 3        |
| Maintenance | Release Frequency                  | 4          | 3        |
| Maintenance | Lockfile Update Recency            | 3          | 3        |
| Maintenance | Open issues / total issues         | 5          | 2        |
| Maintenance | Median PR time-to-merge            | 5          | 2        |
| Maintenance | Number of Contributors             | 1          | 2        |
| Maintenance | Most recent commit                 | 2          | 2        |
| Quality     | README, API ref, examples          | 3          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 5          | 3        |
| Quality     | Passing CI builds                  | 5          | 3        |
| Quality     | Author Track Record                | 5          | 3        |
| Quality     | Changelog Present                  | 5          | 3        |
| Quality     | Stable versioning                  | 3          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 5          | 1        |
| Popularity  | Weekly Downloads                   | 5          | 3        |
| Popularity  | Repo stars                         | 5          | 2        |
| Popularity  | Contributors                       | 1          | 1        |

#### **Repository**: `@mrgrain/cdk-esbuild`

Maintenance: 83/100
Quality:    100/100
Popularity:  88/100
Overall:     90/100

| Pillar      | Signal                             | Stars      | Weight   |
|-------------|------------------------------------|------------|----------|
| Maintenance | Time to first response             | 4          | 3        |
| Maintenance | Commit Frequency                   | 4          | 3        |
| Maintenance | Release Frequency                  | 3          | 3        |
| Maintenance | Lockfile Update Recency            | 5          | 3        |
| Maintenance | Open issues / total issues         | 5          | 2        |
| Maintenance | Median PR time-to-merge            | 5          | 2        |
| Maintenance | Number of Contributors             | 4          | 2        |
| Maintenance | Most recent commit                 | 5          | 2        |
| Quality     | README, API ref, examples          | 5          | 3        |
| Quality     | Tests checklist (unit/snapshot)    | 5          | 3        |
| Quality     | Passing CI builds                  | 5          | 3        |
| Quality     | Author Track Record                | 3          | 3        |
| Quality     | Changelog Present                  | 5          | 3        |
| Quality     | Stable versioning                  | 3          | 2        |
| Quality     | License, .gitignore/.npmignore     | 5          | 1        |
| Quality     | Multi-language Support             | 5          | 1        |
| Popularity  | Weekly Downloads                   | 5          | 3        |
| Popularity  | Repo stars                         | 4          | 2        |
| Popularity  | Contributors                       | 4          | 1        |

### Signals from npms.io (Reference)

npms.io defines three categories similar to ours; Maintenance, Quality, and Popularity.

#### Quality

* README, License, .gitignore and friends
* Version stable? Deprecated?
* Has tests? Coverage %? Build passing?
* Outdated dependencies? Vulnerabilities?
* Custom website? Badges?
* Linters configured?

#### Maintenance

* Ratio of open issues vs. total issues
* Time to close issues
* Most recent commit
* Commit frequency
* Release frequency

#### Popularity

* Stars
* Forks
* Subscribers
* Contributors
* Dependents
* Downloads
* Downloads acceleration

For more information about npms.io:

* GitHub: https://github.com/npms-io/npms-analyzer
* Website: https://npms.io/about

#### CDK Construct Analyzer vs npms.io

npms.io and CDK Construct Analyzer share the same core idea, using signals across maintenance, quality, and popularity to
help developers assess packages. However, npms.io is focused only on npm packages and is optimized for large-scale automated
ranking across the entire registry. In contrast, CDK Construct Analyzer is specialized for evaluating construct libraries. It
works per-library, across multiple languages, with scoring logic tuned for construct libraries. For example, CDK Construct Analyzer
includes a signal for multi-language support to verify that a construct is properly packaged and published across CDK’s supported
languages, something npms.io does not need to consider since it only evaluates npm libraries.
