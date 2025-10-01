# RFC: Feature Flag Advisor

* Original Author(s): @huang-benny
* Tracking Issue: [#808](https://github.com/aws/aws-cdk-rfcs/issues/808)
* API Bar Raiser: @kaizencc

Developers often struggle to know whether a library is actively maintained, well-tested, and safe to adopt. Today, this
requires manually checking repos, scanning docs, and guessing at signals like stars or commit history. Library Quality
Scoring replaces that guesswork with a clear, explainable score backed by evidence, so customers can differentiate libraries
at a glance and maintainers know exactly how to improve.

## Working Backwards

### README

#### CDK Constrct Analyzer

`@cdklabs/cdk-construct-analyzer` is a CLI and library for evaluating the quality of construct libraries.

It calculates a single score (0–100) based on three equally weighted aspects:

* **Maintenance**: Is the project actively maintained and are owners/maintainers responsive?
* **Quality**: Does the project have good docs, tests, linting, and hygiene?
* **Popularity**: How widely is the library adopted in the community?

Each package is scored per version, since different versions may have different scores. The signals within each pillar are
recalculated for the different major versions, capturing changes that may occur between versions.

#### CLI Usage

```> cdk-construct-analyzer --help

Usage: cdk-construct-analyzer [package[@version]] [options]

Arguments:
  package[@major_version]     Name of the construct package to score
                              If no version is provided, defaults to latest

Options:
 --verbose Show detailed breakdown of signals
--help    Show this help message
```

You can run it locally on any construct repository:

```> cdk-construct-analyzer cdklabs/cdk-ecs-codedeploy@1

LIBRARY: @cdklabs/cdk-ecs-codedeploy
VERSION: 1

OVERALL SCORE: 90/100

---

SUBSCORES
  Maintenance :            80/100
  Quality     :            90/100
  Popularity  :           100/100
```

Add `--verbose` for a detailed breakdown:

```> cdk-construct-analyzer cdklabs/cdk-ecs-codedeploy@1 --verbose

LIBRARY: @cdklabs/cdk-ecs-codedeploy
VERSION: 1

OVERALL SCORE: 90/100

---

SUBSCORES
  Maintenance :            80/100
  Quality     :            90/100
  Popularity  :           100/100
  
---

=== Maintenance ===                               SCORE  WEIGHT
— Time to first response......................... ★★★★★    3
— Commit Frequency .............................. ★★★★★    3
— Release Frequency ............................. ★★★★☆    3
— Open issues / total issues .................... ★★★☆☆    3
— Median PR time-to-merge ....................... ★★★★☆    2
— Number of Contributors ........................ ★★★★☆    2
— Most recent commit ............................ ★★☆☆☆    2

=== Quality ===                                   SCORE  WEIGHT
— README, API Reference and usage examples ...... ★★★★★    3
— Tests checklist (unit/snapshot) ............... ★★★★★    3
— Passing CI builds ............................. ★★★★★    3
— Author Quality metrics ........................ ★★★★★    3
— Changelog Present ............................. ★★★★★    3
— License, .gitignore/.npmignore present ........ ★★★★☆    2
— Stable versioning ............................. ★★★★☆    2
— Multi-language Support ........................ ★★★☆☆    1

=== Popularity ===                                SCORE  WEIGHT
— Contributors .................................. ★★★★★    3
— Weekly Downloads .............................. ★★★★★    3
— Version Downloads ............................. ★★★★★    3
— Repo stars .................................... ★★★★★    2
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
* Most recent commit: Recent commits help confirm that the project is not stale.

##### Quality

Signals that are visible in the repo/package that showcases quality:

* README, API Reference and usage examples : High quality documentation makes the project easier to adopt and use.
* Tests checklist (unit/snapshot): Tests ensure correctness and prevent regressions.
* Passing CI builds: A passing CI pipeline indicates functional and validated code.
* Author Quality metrics: Authors with strong history are more likely to maintain good practices.
* Changelog Present: A changelog helps users track updates.
* License, .gitignore/.npmignore present: Legal clarity and clean packaging are basic hygiene signals.
* Stable versioning (>=1.x.x, not deprecated): Indicates API maturity and stability.
* Multi-language Support: Supporting multiple CDK languages shows extra effort and intent to reach a broader developer base

##### Popularity

Signals that reflect adoption and community size:

* Contributors: More contributors typically indicate shared maintenance and community trust.
* Weekly Downloads: High or rising download counts suggest the library is being actively used.
* Version Downloads: Version usage helps confirm which releases are relevant and in demand.
* Repo stars: Stars represent general developer interest and visibility on GitHub.

#### Scoring Weights

Not every signal has the same impact on library , so each signal is assigned an importance level. A signal with
importance level 3 will carry 3× the weight of a signal with importance level 1:

* **3 — Critical** signals that strongly influence a library’s overall health and usability (3 points)
* **2 — Valuable** indicators that support confidence but aren’t decisive signals (2 points)
* **1 — Supportive** or “nice to have” checks (1 points)

Each signal is also scored using stars to visualize thresholds:

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
might start adding meaningless badges to low-effort commits just to get a higher score.

### What is the technical solution (design) of this feature?

At a high level, the tool will:

* Take inputs: Users can point the CLI to a package
* Normalize: The tool will look up the package metadata and used it as the main source of truth for most checks.
* Collect signals:
  * Maintenance: how active the project is (recent releases, frequency of updates, how quickly issues/PRs are handled, active maintainers).
  * Quality: what the project includes (README, tests, lint setup, changelog, license, repo hygiene, CDK-specific setup).
  * Popularity: how widely it’s used (downloads from registries, growth trends, GitHub stars, forks, and contributors).
* Apply weights: Each of these three areas is scored and weighted, then combined into one final score out of 100.
* Show outputs: The results are available in the CLI (with either a simple summary or a detailed verbose breakdown).

### Is this a breaking change?

No.

### What alternative solutions did you consider?

Another option we considered was giving each construct library just one overall score instead of separate scores for every
version. This would make things simpler for users since they would only see one number. The downside is that this hides
problems that might only exist in a specific version. It also doesn’t show if newer versions are healthier than old ones.
We decided to go with per version scoring so the results are more accurate and useful, but in the future we could still
add a single roll-up score for Construct Hub to show at a high level.

### Are there any open issues that need to be addressed later?

No.

## Appendix

### Signals

The term “signals” is used instead of “metrics” because each data point is a hint, not a guarantee. For example, a project
may have a README but it could be poorly written. These signals come together to them paint a clearer picture. This
terminology also aligned with npms.io’s scoring system.

| Pillar      | Signal                             | Calculation / Thresholds                                            | Source         | Required | Justification                    | Importance |
|-------------|------------------------------------|---------------------------------------------------------------------|----------------|----------|----------------------------------|------------|
| Maintenance | Time to first response             | 0–1 wk = 100, 1–4 wk = 75, 4–12 wk = 50, 3–12 mths = 25, 1+ yrs = 0 | Repo API       | YES      | Reflects responsiveness          | 3          |
| Maintenance | Commit Frequency                   | ≥10/month = 100, 5–9 = 75, 1–4 = 50, <1 = 25, 0 in 12mo = 0         | Repo API       | YES      | Shows steady activity            | 3          |
| Maintenance | Release Frequency                  | ≥3/yr = 100, 2 = 75, 1 = 50, 1/yr = 25, 2+yr = 0                    | Registry API   | YES      | Activity check, responsiveness   | 3          |
| Maintenance | Open issues / total issues         | <10% = 100, 10–25% = 75, 25–50% = 50, 50–75% = 25, 75%+ = 0         | Repo API       | YES      | Measures backlog health          | 2          |
| Maintenance | Median PR time-to-merge            | <1wk = 100, 1–4wk = 75, 1–3mo = 50, 3–6mo = 25, 6mo+ = 0            | Repo API       | YES      | Signals maintainer attention     | 2          |
| Maintenance | Number of Contributors             | ≥20 = 100, 10–19 = 75, 5–9 = 50, 1–4 = 25, 0 = 0                    | Repo API       | YES      | Broad community involvement      | 2          |
| Maintenance | Most recent commit                 | <7d = 100, 7–30d = 75, 1–3mo = 50, 3–6mo = 25, >6mo = 0             | Repo API       | YES      | Indicates recency                | 2          |
| Maintenance | Active Maintainers in last 90 days | —                                                                   | Repo API       | NO       | Prevents “bus factor”            | 3          |
| Maintenance | Number of Significant Contributors | —                                                                   | Repo API       | NO       | Measure of team size?            | 2          |
| Maintenance | Branch activity                    | —                                                                   | Repo API       | NO       | Hard to normalize                | 1          |
| Maintenance | SemVer                             | —                                                                   | Registry API   | NO       | Maturity ≠ activity              | 1          |
| Quality     | README, API ref, examples          | Full = 100, README only = 50, none = 0                              | Tarball        | YES      | Entry point for users            | 3          |
| Quality     | Tests checklist (unit/snapshot)    | Unit+Snapshot = 100, one = 50, neither = 0                          | npm            | YES      | Ensures correctness              | 3          |
| Quality     | Passing CI builds                  | Passing = 100, Failing = 0                                          | Repo API       | YES      | Code quality enforcement         | 3          |
| Quality     | Author Quality metrics             | 20+ pkgs = 100, 11–20 = 75, 5–10 = 50, 2–4 = 25, 1 = 0              | Repo API / npm | YES      | Track record of strong authors   | 3          |
| Quality     | Changelog Present                  | Present = 100, Missing = 0                                          | Tarball        | YES      | Transparency for changes         | 3          |
| Quality     | License, .gitignore/.npmignore     | Both = 100, one = 50, none = 0                                      | Tarball        | YES      | Legal clarity + hygiene          | 2          |
| Quality     | Stable versioning                  | ≥1.x.x & active = 100, <1.0 & active = 50, deprecated = 0           | Registry API   | YES      | Avoids abandoned projects        | 2          |
| Quality     | Multi-language Support             | 4+ = 100, 3 = 75, 2 = 50, 1 = 25, fake/missing = 0                  | Tarball        | YES      | Signals extra effort             | 1          |
| Quality     | Lint configuration                 | Present = 100, Absent = 0                                           | Tarball        | MAYBE    | Style/consistency                | 1          |
| Quality     | Badges                             | ≥3 meaningful = 100, 1–2 = 50, none = 0                             | Tarball        | MAYBE    | Signals professionalism          | 1          |
| Quality     | Dependency freshness / vuln checks | —                                                                   | npm            | NO       | Security                         | 3          |
| Quality     | Download Balance Across Languages  | —                                                                   | All registries | NO       | Confirms real multi-lang support | 1          |
| Quality     | Code complexity                    | —                                                                   | —              | NO       | Hard to automate                 | 1          |
| Popularity  | Contributors                       | ≥20 = 100, 10–19 = 75, 5–9 = 50, 1–4 = 25, 0 = 0                    | Repo API       | YES      | Health of contributions          | 3          |
| Popularity  | Weekly Downloads                   | 1M+ = 100, 100K–1M = 75, 10K–99K = 50, 1K–9K = 25, <1K = 0          | npm            | YES      | General usage metric             | 3          |
| Popularity  | Version Downloads                  | 100K+ = 100, 10K–99K = 75, 1K–9K = 50, 100–999 = 25, <100 = 0       | npm            | YES      | Usage of a specific version      | 3          |
| Popularity  | Repo stars                         | ≥5K = 100, 1K–5K = 75, 100–999 = 50, 10–99 = 25, <10 = 0            | Repo API       | YES      | Popularity proxy                 | 2          |
| Popularity  | Dependents                         | —                                                                   | libraries.io   | NO       | Shows reuse                      | 3          |
| Popularity  | Forks                              | —                                                                   | Repo API       | NO       | Community engagement             | 2          |
| Popularity  | Subscribers/watchers               | —                                                                   | Repo API       | NO       | Indicates user interest          | 1          |

### Construct Library Scoring Examples

#### **Repository**: `@cdklabs/cdk-docker-image-deployment@0`
Maintenance: 26/100
Quality:     80/100
Popularity:  11/100
Overall:     39/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 1          |
| Maintenance | Commit Frequency                   | 1          |
| Maintenance | Release Frequency                  | 5          |
| Maintenance | Open issues / total issues         | 1          |
| Maintenance | Median PR time-to-merge            | 3          |
| Maintenance | Number of Contributors             | 1          |
| Maintenance | Most recent commit                 | 2          |
| Quality     | README, API ref, examples          | 5          |
| Quality     | Tests checklist (unit/snapshot)    | 5          |
| Quality     | Passing CI builds                  | 5          |
| Quality     | Author Quality metrics             | 5          |
| Quality     | Changelog Present                  | 1          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 3          |
| Quality     | Multi-language Support             | 5          |
| Popularity  | Contributors                       | 1          |
| Popularity  | Weekly Downloads                   | 2          |
| Popularity  | Version Downloads                  | 1          |
| Popularity  | Repo stars                         | 2          |

#### **Repository**: `@cdklabs/cdk-stacksets@0`
Maintenance: 28/100
Quality:     80/100
Popularity:  23/100
Overall:     44/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 3          |
| Maintenance | Commit Frequency                   | 1          |
| Maintenance | Release Frequency                  | 2          |
| Maintenance | Open issues / total issues         | 2          |
| Maintenance | Median PR time-to-merge            | 3          |
| Maintenance | Number of Contributors             | 1          |
| Maintenance | Most recent commit                 | 3          |
| Quality     | README, API ref, examples          | 5          |
| Quality     | Tests checklist (unit/snapshot)    | 5          |
| Quality     | Passing CI builds                  | 5          |
| Quality     | Author Quality metrics             | 5          |
| Quality     | Changelog Present                  | 1          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 3          |
| Quality     | Multi-language Support             | 5          |
| Popularity  | Contributors                       | 1          |
| Popularity  | Weekly Downloads                   | 2          |
| Popularity  | Version Downloads                  | 2          |
| Popularity  | Repo stars                         | 3          |

#### **Repository**: `@cdklabs/cdk-ecr-deployment@4`
Maintenance: 54/100
Quality:     78/100
Popularity:  43/100
Overall:     58/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 3          |
| Maintenance | Commit Frequency                   | 2          |
| Maintenance | Release Frequency                  | 5          |
| Maintenance | Open issues / total issues         | 4          |
| Maintenance | Median PR time-to-merge            | 2          |
| Maintenance | Number of Contributors             | 2          |
| Maintenance | Most recent commit                 | 4          |
| Quality     | README, API ref, examples          | 5          |
| Quality     | Tests checklist (unit/snapshot)    | 3          |
| Quality     | Passing CI builds                  | 5          |
| Quality     | Author Quality metrics             | 5          |
| Quality     | Changelog Present                  | 1          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 5          |
| Quality     | Multi-language Support             | 5          |
| Popularity  | Contributors                       | 2          |
| Popularity  | Weekly Downloads                   | 3          |
| Popularity  | Version Downloads                  | 3          |
| Popularity  | Repo stars                         | 3          |

#### **Repository**: ` @pahud/cdk-remote-stack@2`
Maintenance: 21/100
Quality:     85/100
Popularity:  25/100
Overall:     44/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 3          |
| Maintenance | Commit Frequency                   | 1          |
| Maintenance | Release Frequency                  | 1          |
| Maintenance | Open issues / total issues         | 4          |
| Maintenance | Median PR time-to-merge            | 2          |
| Maintenance | Number of Contributors             | 1          |
| Maintenance | Most recent commit                 | 1          |
| Quality     | README, API ref, examples          | 5          |
| Quality     | Tests checklist (unit/snapshot)    | 5          |
| Quality     | Passing CI builds                  | 1          |
| Quality     | Author Quality metrics             | 5          |
| Quality     | Changelog Present                  | 5          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 5          |
| Quality     | Multi-language Support             | 5          |
| Popularity  | Contributors                       | 1          |
| Popularity  | Weekly Downloads                   | 2          |
| Popularity  | Version Downloads                  | 3          |
| Popularity  | Repo stars                         | 2          |

#### **Repository**: `@pahud/cdk-ssm-parameter-store@0`
Maintenance: 12/100
Quality:     70/100
Popularity:  0/100
Overall:     27/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 1          |
| Maintenance | Commit Frequency                   | 1          |
| Maintenance | Release Frequency                  | 1          |
| Maintenance | Open issues / total issues         | 1          |
| Maintenance | Median PR time-to-merge            | 5          |
| Maintenance | Number of Contributors             | 1          |
| Maintenance | Most recent commit                 | 1          |
| Quality     | README, API ref, examples          | 5          |
| Quality     | Tests checklist (unit/snapshot)    | 3          |
| Quality     | Passing CI builds                  | 1          |
| Quality     | Author Quality metrics             | 5          |
| Quality     | Changelog Present                  | 5          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 3          |
| Quality     | Multi-language Support             | 3          |
| Popularity  | Contributors                       | 1          |
| Popularity  | Weekly Downloads                   | 1          |
| Popularity  | Version Downloads                  | 1          |
| Popularity  | Repo stars                         | 1          |

#### **Repository**: `@DataDog/datadog-cdk-constructs-v2@3`
Maintenance: 81/100
Quality:     99/100
Popularity:  52/100
Overall:     77/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 4          |
| Maintenance | Commit Frequency                   | 5          |
| Maintenance | Release Frequency                  | 5          |
| Maintenance | Open issues / total issues         | 4          |
| Maintenance | Median PR time-to-merge            | 5          |
| Maintenance | Number of Contributors             | 2          |
| Maintenance | Most recent commit                 | 4          |
| Quality     | README, API ref, examples          | 5          |
| Quality     | Tests checklist (unit/snapshot)    | 5          |
| Quality     | Passing CI builds                  | 5          |
| Quality     | Author Quality metrics             | 5          |
| Quality     | Changelog Present                  | 5          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 5          |
| Quality     | Multi-language Support             | 4          |
| Popularity  | Contributors                       | 2          |
| Popularity  | Weekly Downloads                   | 4          |
| Popularity  | Version Downloads                  | 4          |
| Popularity  | Repo stars                         | 2          |

#### **Repository**: `@aws/aws-cdk@2`
Maintenance: 90/100
Quality:    100/100
Popularity:  93/100
Overall:     94/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 5          |
| Maintenance | Commit Frequency                   | 4          |
| Maintenance | Release Frequency                  | 5          |
| Maintenance | Open issues / total issues         | 4          |
| Maintenance | Median PR time-to-merge            | 5          |
| Maintenance | Number of Contributors             | 4          |
| Maintenance | Most recent commit                 | 5          |
| Quality     | README, API ref, examples          | 5          |
| Quality     | Tests checklist (unit/snapshot)    | 5          |
| Quality     | Passing CI builds                  | 5          |
| Quality     | Author Quality metrics             | 5          |
| Quality     | Changelog Present                  | 5          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 5          |
| Quality     | Multi-language Support             | 5          |
| Popularity  | Contributors                       | 4          |
| Popularity  | Weekly Downloads                   | 5          |
| Popularity  | Version Downloads                  | 5          |
| Popularity  | Repo stars                         | 5          |

#### **Repository**: `@udondan/iam-floyd@0`
Maintenance: 79/100
Quality:     74/100
Popularity:  43/100
Overall:     65/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 4          |
| Maintenance | Commit Frequency                   | 4          |
| Maintenance | Release Frequency                  | 5          |
| Maintenance | Open issues / total issues         | 4          |
| Maintenance | Median PR time-to-merge            | 5          |
| Maintenance | Number of Contributors             | 2          |
| Maintenance | Most recent commit                 | 5          |
| Quality     | README, API ref, examples          | 3          |
| Quality     | Tests checklist (unit/snapshot)    | 3          |
| Quality     | Passing CI builds                  | 5          |
| Quality     | Author Quality metrics             | 4          |
| Quality     | Changelog Present                  | 5          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 3          |
| Quality     | Multi-language Support             | 3          |
| Popularity  | Contributors                       | 2          |
| Popularity  | Weekly Downloads                   | 3          |
| Popularity  | Version Downloads                  | 3          |
| Popularity  | Repo stars                         | 3          |

#### **Repository**: `@hashicorp/terraform-cdk@0`
Maintenance: 57/100
Quality:     88/100
Popularity:  66/100
Overall:     70/100

| Pillar      | Signal                             | Stars      |
|-------------|------------------------------------|------------|
| Maintenance | Time to first response             | 4          |
| Maintenance | Commit Frequency                   | 1          |
| Maintenance | Release Frequency                  | 5          |
| Maintenance | Open issues / total issues         | 4          |
| Maintenance | Median PR time-to-merge            | 5          |
| Maintenance | Number of Contributors             | 1          |
| Maintenance | Most recent commit                 | 3          |
| Quality     | README, API ref, examples          | 3          |
| Quality     | Tests checklist (unit/snapshot)    | 5          |
| Quality     | Passing CI builds                  | 5          |
| Quality     | Author Quality metrics             | 5          |
| Quality     | Changelog Present                  | 5          |
| Quality     | License, .gitignore/.npmignore     | 5          |
| Quality     | Stable versioning                  | 3          |
| Quality     | Multi-language Support             | 5          |
| Popularity  | Contributors                       | 1          |
| Popularity  | Weekly Downloads                   | 4          |
| Popularity  | Version Downloads                  | 5          |
| Popularity  | Repo stars                         | 5          |

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

#### CDK Construct Analyzer vs npms.io

npms.io and CDK Construct Analyzer share the same core idea, using signals across maintenance, quality, and popularity to
help developers assess packages. However, npms.io is focused only on npm packages and is optimized for large-scale automated
ranking across the entire registry. In contrast, CDK Construct Analyzer is specialized for evaluating construct libraries. It
works per-library and per-version, across multiple languages, with scoring logic tuned for construct libraries. For example,
CDK Construct Analyzer includes a signal for multi-language support to verify that a construct is properly packaged and
published across CDK’s supported languages, something npms.io does not need to consider since it only evaluates npm libraries.
