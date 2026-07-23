# Ruby Language Bindings

* **Original Author(s):**: @omarqureshi
* **Tracking Issue**: #935
* **API Bar Raiser**: @{BAR_RAISER_USER}

This RFC proposes the introduction of native Ruby language bindings for the AWS Cloud Development Kit (CDK).

## The Problem

The current state of the AWS CDK forces Ruby-centric engineering organizations into an adoption bottleneck. While the
CDK natively supports TypeScript, Python, Java, Go, and .NET, organizations whose core application stacks and internal
expertise are built entirely on Ruby (e.g., large-scale Rails deployments) face significant friction.

To manage their infrastructure as code via the CDK, these developers must accept a high cognitive load—managing
disjointed local toolchains, foreign dependency managers (e.g., `npm`, `pip`), and isolated linting configurations. This
fragmentation creates severe context-switching overhead. While Python is often cited as an alternative due to its
readable syntax, forcing a Ruby team to adopt Python solely for infrastructure introduces artificial training costs,
fractures internal shared libraries, and prevents organizations from leveraging their deeply established testing and
automation ecosystems.

By introducing Ruby support to `jsii`, we resolve one of the longest-standing open language requests in the jsii
tracker (open since August 2018 — see the demand data under *Why are we doing this?*), allowing Ruby teams to treat
infrastructure as a first-class citizen using their primary language.

## Proposed Developer Experience

- **Native Dependency Management**: Ruby developers will manage their infrastructure dependencies using Bundler
  (`Gemfile`) and distribute reusable infrastructure constructs as standard Ruby Gems published to RubyGems.org.
- **Familiar Tooling**: Developers will execute CDK pipelines using familiar testing frameworks (e.g., RSpec, Minitest),
  entirely removing the need to interact directly with Python or Java toolchains.
- **Idiomatic Syntax**: Complex cloud architecture topologies will be declared using standard Ruby idioms—such as
  keyword arguments and snake_case naming—preserving the fluid design patterns characteristic of the language.

## System Impact

The impact of this proposal is strictly additive. Because `jsii` isolates language-specific bindings to decoupled
code-generation targets inside the `jsii-pacmak` compiler, the introduction of a Ruby target introduces zero breaking
changes, performance regressions, or syntax alterations to existing language modules.

The compiler change is limited to an additive schema extension: `targets.ruby` configuration validation in
`project-info.ts` / `assembler.ts` ([aws/jsii-compiler#2663](https://github.com/aws/jsii-compiler/pull/2663)). The
intermediate `.jsii` assembly format itself is entirely unchanged — existing assemblies gain Ruby support with no
recompilation.

**Affected repositories.** The change spans the jsii toolchain plus additive naming config in `aws-cdk`; no
library/runtime code in `aws-cdk` itself is touched:

| Repository | Change |
| --- | --- |
| `aws/jsii` | New `@jsii/ruby-runtime` gem + `jsii-pacmak` Ruby target ([aws/jsii#5178](https://github.com/aws/jsii/pull/5178), tracked by [aws/jsii#5129](https://github.com/aws/jsii/issues/5129)) |
| `aws/jsii-compiler` | Additive `targets.ruby` schema validation ([aws/jsii-compiler#2663](https://github.com/aws/jsii-compiler/pull/2663)) |
| `aws/jsii-rosetta` | New `RubyVisitor` snippet transliterator ([aws/jsii-rosetta#3710](https://github.com/aws/jsii-rosetta/pull/3710)) |
| `aws/aws-cdk` | Additive per-submodule `targets.ruby.module` naming config only — 329 `.jsiirc.json` files across `aws-cdk-lib` (e.g. `aws-s3` → `AWSCDK::S3`); no library code changes ([aws/aws-cdk#38248](https://github.com/aws/aws-cdk/pull/38248)) |
| `cdklabs/jsii-docgen` | Ruby renderer for Construct Hub |

This RFC is filed in `aws-cdk-rfcs` because enabling a new CDK language is a cross-cutting ecosystem decision for CDK
leadership. The `aws-cdk` footprint is limited to additive `.jsiirc.json` naming declarations (the same files that
already carry the Java/Python/.NET module names) — no construct or runtime code changes — and the individual PRs above
proceed under each repo's normal review once the direction is approved.

## Implementation Status (evidence)

Unlike a speculative design document, this RFC is backed by a working implementation (tracked at
[aws/jsii#5129](https://github.com/aws/jsii/issues/5129)); every generated-code example below is **real output** from
the current generator (lightly presented: long module prefixes are trimmed — `class Calculator` for
`class JsiiCalc::Calculator` — and doc-comment lines elided where noted):

- **The full standard compliance suite passes**, reported through the same `tools/jsii-compliance` matrix used to gate
  the other jsii languages — surfaced in the monorepo implementation PR
  ([aws/jsii#5178](https://github.com/aws/jsii/pull/5178)).
- The runtime test suite (compliance + unit) is green at every build: it gates the local development loop and full
  green monorepo-CI runs exist on the branch (2026-06-04/07, including the full OS matrix). Since the fork-compiler pin
  landed, the fork's own CI check fails fast by construction (the ordering constraint in *Upstreaming sequence*) — the
  suite's ongoing verification lives in the daily preview pipeline, whose post-publish smoke test installs the
  published gems from the public feed and synthesizes a real stack on every run, alongside generated-code snapshot
  coverage in `jsii-pacmak`'s cross-language test harness.
- The full `aws/jsii` monorepo CI (build, unit tests across the OS/language matrix, pacmak integration against
  `aws-cdk-lib`) passes end-to-end on the preview build of the implementation branch. One caveat is deliberate and
  disclosed: the branch depends on the `targets.ruby` schema from [aws/jsii-compiler#2663](https://github.com/aws/jsii-compiler/pull/2663),
  which is not yet released — so CI green requires pinning a pre-release build of that compiler change, and the checks
  on [aws/jsii#5178](https://github.com/aws/jsii/pull/5178) itself stay red **by construction** until #2663 merges and
  releases. This is an ordering constraint, not an implementation gap; see *Upstreaming sequence* below.
- **Validated end-to-end at `aws-cdk-lib` scale.** The generator emits the entire `aws-cdk-lib` (20,351 types across 613
  submodules) in ~10 seconds. The generated assembly loads *lazily* — `require 'aws-cdk-lib'` registers ~20,400 autoload
  entries and eager-defines **zero** types (see *Lazy loading* under Detailed Design) — and a real `App → Stack` with an
  S3 bucket, a VPC and a Lambda function synthesizes correct CloudFormation through the kernel: unresolved attribute
  tokens resolve to `Fn::GetAtt` intrinsics, struct keyword arguments and enums round-trip, `vpc.public_subnets`
  hydrates subnet proxies the program never referenced by constant, and cross-assembly `constructs.Node` references
  resolve. This is the full path a CDK user exercises, on the real library, not a fixture.
- The author's production blog infrastructure consumes the generated gems today: the stack at
  <https://github.com/omarqureshi/blog> compiles, synthesizes and deploys via the `aws-cdk-lib` Ruby bindings, spanning
  eleven service modules (S3 and S3 Deployment, CloudFront, Certificate Manager, Route53 with its targets and patterns
  submodules, Cognito, DynamoDB, Lambda, API Gateway — with IAM engaged through the `grant_*` helpers rather than
  direct module references) — breadth across the generated API surface, not a single
  cherry-picked construct. The deployment runs on the final `AWSCDK::S3`-style module naming proposed below (see *Root
  namespace rationale*), so the naming convention is exercised in production, not just on paper.
  (The gems are available today from a public, credential-free preview channel —
  `source "https://rubygems.omarqureshi.net"` in a `Gemfile` — with RubyGems.org as the GA channel; see
  *Gem name governance*.)
- There is a working implementation of a Rails application stack (Lamby on Lambda, Dynamoid on DynamoDB) whose
  infrastructure is defined and deployed via the Ruby CDK, exercised end to end against a local AWS emulator.
- The YARD documentation `jsii-pacmak` emits is rendered and browsable at <https://rubygems.omarqureshi.net/docs> — the
  full `aws-cdk-lib` API reference in Ruby, with cross-module type links, per-module READMEs and a getting-started
  guide. (This is the gem-level YARD reference; the Construct Hub Ruby tab is the separate `jsii-docgen` renderer listed
  in *System Impact*.)
- The full test matrix passes on Linux, macOS and Windows runners, and the runtime reports itself via the standard
  `JSII_AGENT` mechanism (`Ruby/<version>`), integrating with jsii's existing runtime telemetry.

### Upstreaming sequence

The open PRs are not independent — one small change gates the rest, and review effort is best spent in this order:

1. **[aws/jsii-compiler#2663](https://github.com/aws/jsii-compiler/pull/2663)** — additive `targets.ruby` schema
   validation (+75/−0 with tests, no dependencies on any other change, currently mergeable). Everything else waits on
   this being merged **and released**, because the jsii monorepo's Ruby target reads that schema at build time.
2. **[aws/jsii#5178](https://github.com/aws/jsii/pull/5178)** — the runtime + `jsii-pacmak` target. Once a compiler
   release carries #2663, the branch drops its pre-release compiler pin and monorepo CI goes green with stock
   dependencies. Until then its checks are red by construction (see the caveat above). The branch tracks upstream:
   last rebased onto `aws/jsii` `main` on 2026-07-23 (31 upstream commits absorbed; the seven review units replayed
   without conflicts, full test suite green after regeneration).
3. **[aws/jsii-rosetta#3710](https://github.com/aws/jsii-rosetta/pull/3710)** and the `jsii-docgen` Ruby renderer —
   independent of each other and reviewable in parallel with (2).
4. **[aws/aws-cdk#38248](https://github.com/aws/aws-cdk/pull/38248)** — pure per-submodule naming configuration; its
   CI already passes as-is, but the config only takes effect once (1) and (2) are released.

## Working Backwards

### Product Press Release

Today, Amazon Web Services (AWS) announced the preview of native Ruby language support for the AWS Cloud Development Kit
(CDK), expanding the open-source software development framework to the global Ruby community. The AWS CDK allows
developers to define cloud infrastructure using familiar programming languages. With this release, Ruby developers can
now provision AWS resources natively using idiomatic Ruby code, eliminating the need to learn alternative language
syntaxes or maintain fragmented DevOps toolchains.

Historically, Ruby-centric engineering teams, such as those running large-scale Ruby on Rails deployments, had to
context-switch to TypeScript or Python to leverage the power of the AWS CDK. This introduced friction, requiring
developers to manage distinct runtime environments, foreign package managers, and isolated linting systems solely for
infrastructure provisioning.

By integrating Ruby directly into jsii—the underlying technology that powers the CDK's polyglot capabilities—Ruby
developers can now use Bundler to manage infrastructure dependencies and publish reusable cloud architecture components
as standard Ruby Gems. Infrastructure definitions now look, feel, and execute like native Ruby applications, allowing
teams to integrate infrastructure definitions directly into their existing application codebases and test suites.

### The Developer Experience (UX)

With the AWS CDK for Ruby, developers can seamlessly weave cloud infrastructure into their existing Ruby environments.
Below is an example of defining an Amazon S3 bucket within a custom stack:

```ruby
require 'aws-cdk-lib'

class MyCustomStack < AWSCDK::Stack
  def initialize(scope, id, props = nil)
    super(scope, id, props)

    AWSCDK::S3::Bucket.new(self, 'MyBucket', {
      versioned: true,
      encryption: AWSCDK::S3::BucketEncryption::KMS_MANAGED
    })
  end
end

app = AWSCDK::App.new
MyCustomStack.new(app, 'MyStack')
app.synth
```

This is not hypothetical syntax: an equivalent stack spanning eleven service modules (S3, CloudFront, ACM, Route53
and its targets/patterns submodules, Cognito, DynamoDB, Lambda, API Gateway and more) runs today as the author's production blog infrastructure,
deployed entirely through the Ruby bindings — see <https://github.com/omarqureshi/blog>.

To get started with the AWS CDK for Ruby, visit the AWS CDK Getting Started Guide or explore the open-source repository
on GitHub.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### Why add Ruby support to the AWS CDK?

We want to eliminate toolchain friction for engineering organizations whose primary expertise is in Ruby. Prior to this
release, Ruby teams had to adopt a second language ecosystem (like Python or TypeScript) strictly to manage their
infrastructure via the CDK. Native Ruby support allows these teams to consolidate their codebases, reduce cognitive
switching overhead, and leverage their existing Ruby testing and automation workflows.

### Which Ruby versions are supported?

MRI (CRuby) **3.3 and newer**. Ruby 3.1 and 3.2 have reached end-of-life and are not supported; the gemspecs enforce
`required_ruby_version >= 3.3.0`, and CI exercises the currently-supported MRI series (3.3, 3.4, 4.0). The production
reference deployment runs on Ruby 4.0.

### How does the performance of AWS CDK for Ruby compare to other languages?

The architecture is identical to Python's: every jsii binding drives the same Node.js kernel process over a JSON-RPC
pipe, so synthesis time is dominated by the shared kernel rather than the guest language. The measured data so far is
consistent with that: `require 'aws-cdk-lib'` is effectively free (~20,400 lazy autoload registrations, zero type
bodies defined — see *Lazy loading* in the Detailed Design), and a real-world `cdk deploy` dropped roughly 30 seconds
when the generator switched to lazy emission.

A side-by-side `synth` benchmark against the Python bindings (measured 2026-07-23; identical mirror stacks — a VPC,
25 buckets, DynamoDB table, queue, topic, Lambda with IAM grants, and a REST API, both synthesizing the same
64-resource template; medians of 5 full-process runs, memory as `/proc`-reported peak RSS for the guest process and
its Node sidecar). Three columns: Python from PyPI (2.261.0), and — for a same-source comparison — Python bindings
generated with `jsii-pacmak` from the *identical* `aws-cdk` `main` build that produced the Ruby preview gem:

| | Python 2.261.0 (PyPI) | Python (same source as Ruby) | Ruby preview |
| --- | --- | --- | --- |
| library load | 0.98 s | 0.44 s | 0.46 s |
| construct phase | 0.26 s | 0.35 s | 0.30 s |
| synth phase | 0.09 s | 1.06 s | 1.15 s |
| guest process peak | 128 MB | 83 MB | 86 MB |
| Node sidecar peak | 47 MB | 47 MB | 56 MB |

The same-source columns are the meaningful comparison, and they show **parity**: library load 0.44 vs 0.46 s, synth
1.06 vs 1.15 s, guest process 83 vs 86 MB. The apparent 0.09-vs-1.15 s synth gap against the PyPI column is version
skew in the underlying library, not a Ruby or jsii cost: `aws-cdk` `main` now runs the default CloudFormation
validation engine (`@aws/cloudformation-validate`, a WebAssembly-compiled Rego policy engine) inside every
`app.synth()` — roughly 0.6 s of engine initialisation plus 0.6 s of template evaluation on this host — while
release 2.261.0 predates that feature. Two controls confirm it: Python built from the same source pays the same
engine cost (1.06 s), and a pure-Node run of the same app (no jsii guest at all) synthesizes in ~1.1 s on the
`main` build versus ~0.03 s on 2.261.0. Subtracting the library's own cost, the jsii synth overhead is ~0.1 s in
both guest languages. The benchmark harness and raw methodology are published alongside the preview tooling.

The numbers above come from the development host (WSL2). To rule out host-specific effects, the same harness also runs
monthly in CI on a stock `ubuntu-latest` runner; the first run (2026-07-23; Python `aws-cdk-lib` 2.262.0 from PyPI,
Ruby preview from the public feed, versions disclosed in the run log) measured a median full-process wall of 2.58 s
and 138 MB process-tree peak for Python against 2.66 s and 140 MB for Ruby — near-parity on neutral hardware, with
the Ruby column still carrying the synth-time validation-engine cost that the PyPI release predates.

### Do I need Node.js installed on my machine to use CDK for Ruby?

Yes. Just like the Python, Java, and Go variants of the CDK, the Ruby bindings rely on `jsii`, which requires a local
Node.js runtime to execute the core cloud assembly compiler behind the scenes. However, as a Ruby developer, you will
interact entirely with `.rb` files and standard Ruby tools; the Node.js process operates transparently in the
background.

### How do I manage dependencies for my Ruby CDK project?

You will use standard Ruby tools. Dependencies are defined in a standard Gemfile and locked using Bundler (`bundle
install`). Custom or shared infrastructure constructs can be packaged and distributed internally or publicly as standard
Ruby Gems.

During the preview, a project's Gemfile pulls the CDK gems from the credential-free preview channel:

```ruby
source "https://rubygems.org"

# The Ruby CDK is a preview, published to a separate gem feed.
source "https://rubygems.omarqureshi.net" do
  gem "aws-cdk-lib", ">= 0.0.0.pre"
  gem "constructs", ">= 0.0.0.pre"
  gem "jsii-ruby-runtime", ">= 0.0.0.pre"

  # aws-cdk-lib loads these asset packages at require time.
  gem "aws-cdk-asset-awscli-v1", ">= 0.0.0.pre"
  gem "aws-cdk-asset-node-proxy-agent-v6", ">= 0.0.0.pre"
  gem "aws-cdk-cloud-assembly-schema", ">= 0.0.0.pre"
end
```

Two details are load-bearing. The block-scoped `source` resolves those gems **only** from the preview feed while
everything else stays on RubyGems.org — closing the dependency-confusion gap a bare second source would open. And
`>= 0.0.0.pre` opts Bundler into the timestamped prerelease versions the preview publishes (Bundler otherwise refuses
prereleases). At GA this collapses to the ordinary case: the gems resolve from RubyGems.org with no extra `source`
block and no prerelease constraint.

### Does this update break or slow down development for existing CDK languages?

Not at all. The Ruby implementation is built as an entirely isolated code-generation target within the `jsii-pacmak`
compiler layer as an additional target. The only compiler-side change is additive `targets.ruby` configuration schema
validation; no changes were made to existing language generators or the assembly format, ensuring stability and zero
regression for TypeScript, Python, Java, Go, and .NET users.

### How will the Ruby bindings be versioned and published?

The Ruby constructs will be published as standard `.gem` packages to RubyGems.org, with version numbers mirroring the
core AWS CDK releases (e.g., if the CDK is on version `2.150.0`, the corresponding `aws-cdk-lib` gem will also be
`2.150.0`).

Every preview build also publishes a source manifest beside the gem index
(`/manifests/<version>.json`) pinning the exact commit of every repository that produced it — each published version is
traceable to sources.

Publishing happens in two stages. During the preview, gems publish from a **decoupled pipeline that trails the npm
release** — the version numbers stay in sync, but a Ruby packaging failure can only delay the gem, never the core CDK
release train. Only at GA, once the promotion criteria are met (see the project plan), does Ruby move into the lockstep
multi-language release pipeline alongside Python, Java, .NET and Go.

### Does this support JRuby or TruffleRuby?

The initial release and testing matrix specifically targets standard MRI Ruby (CRuby). While the bindings may
functionally operate on alternative Ruby interpreters, they are not officially supported or tested as part of the
initial launch.

## Internal FAQ

### Why are we doing this?

**1. Quantified, long-standing demand**
Ruby support is one of the longest-standing open requests in the jsii tracker:
[aws/jsii#3923](https://github.com/aws/jsii/issues/3923) has been open since **August 2018** and carries **478
reactions (386 👍) and 60+ comments**; its closed predecessor ([aws/jsii#144](https://github.com/aws/jsii/issues/144),
36 reactions) dates to jsii's original language line-up. The surrounding ecosystem shows these are users who already
manage AWS infrastructure from Ruby, with weaker tools: the official AWS SDK for Ruby's core gem (`aws-sdk-core`) has
**~1.69 billion** RubyGems downloads, and `cfndsl` — a community CloudFormation DSL with no L2 abstractions — has 2.4
million downloads and was still cutting releases in February 2026. (Figures as of 2026-06-12.) The demand is durable;
what has been missing is supply. Native bindings remove the adoption barrier for teams currently forced to
context-switch to TypeScript or Python solely for infrastructure provisioning.

**2. Tapping into a DevOps Legacy**
Ruby has a storied legacy in the infrastructure-as-code space. The original DevOps revolution (Puppet, Chef, Vagrant,
Capistrano) was heavily driven by Ruby because of its unique capacity for creating elegant Internal Domain Specific
Languages (DSLs). Its flexible syntax allows developers to write configuration blueprints that read naturally while
retaining the power of a Turing-complete language. Bringing Ruby to the CDK taps into this legacy, offering an
idiomatic, powerful experience that resonates deeply with infrastructure engineers.

**3. Enhancing the Polyglot CDK Vision**
The AWS CDK was built on `jsii` precisely to be polyglot. By adding Ruby alongside TypeScript, Python, Java, Go, and .NET,
we validate and strengthen the core `jsii` architecture. Expanding the supported languages reinforces the AWS CDK's
position as the universal, developer-first infrastructure framework, regardless of the user's technology stack.

### Why should we _not_ do this?

- **Market Share Decline**: While Ruby powers major enterprise web frameworks like Ruby on Rails, its overall share in
  the modern cloud-native, serverless, and DevOps ecosystems has decreased relative to TypeScript, Python, and Go.
- **Maintenance Tail**: Implementing a new JSII language target creates a permanent, non-zero tail of maintenance
  (handling new JSII wire protocol versions, debugging runtime edge cases, maintaining the `jsii-rosetta` Ruby
  translator, and updating CI/CD pipelines).
- **Opportunity Cost**: The ongoing engineering investment might yield a lower return on investment (ROI) in terms of
  net-new CDK adoption compared to spending those engineering hours optimizing existing, highly requested features for
  TypeScript or Python.
- **Release Pipeline Complexity**: Adding Ruby means adding RubyGems to the global AWS CDK release pipeline. Any
  localized outage or rate-limiting on RubyGems.org could theoretically block or delay a global multi-language CDK
  release. *(Mitigated: during preview the gems publish from a decoupled pipeline that trails the npm release — see the
  versioning FAQ — so this risk is only taken on at GA, after the preview has demonstrated demand.)*
- **Tooling Fragmentation**: Introducing another language dilutes the core team's focus. The core AWS CDK maintainers
  will now need to field bug reports, review pull requests, and debug memory/IPC issues specific to the Ruby VM and its
  interaction with the JSII Node.js subprocess.

### AWS has not added a jsii language since Go — what is different this time?

Two things: the cost structure, and the shape of the ask.

Every prior language effort — including AWS's own early Ruby prototype: a `@jsii/ruby-runtime` package lived in the
monorepo until it was removed in May 2020 ([aws/jsii#1691](https://github.com/aws/jsii/pull/1691)) as "not a supported
target and not being actively developed" — ran into the same economics: building and validating a new language target
is a multi-quarter effort for the core team, weighed against uncertain adoption. This RFC inverts that cost structure:
the implementation already exists, passes the same standard compliance suite that gates Java and Go, runs the full
monorepo CI across three operating systems (on the preview build — see *Upstreaming sequence*), and is validated
against `aws-cdk-lib` at full scale. The remaining ask is
not "build Ruby support"; it is "review and steward a finished target through a preview".

Second, the project plan below is structured as a **commitment ladder**: each phase is independently approvable, the
cheap and reversible steps come first (registering gem names costs an afternoon and protects the namespace even if
everything else is declined), and the expensive commitments — lockstep release-pipeline integration, GA support
obligations — come last, gated on observed preview demand and a working co-maintainer arrangement.

### Who will own and maintain the Ruby bindings long-term?

Because the CDK relies heavily on the `jsii` code generation engine, any new AWS CDK construct written in TypeScript
automatically gets Ruby bindings generated for free. The ongoing maintenance surface is therefore isolated to the Ruby
generator (`jsii-pacmak`), the `jsii-ruby-runtime` gem, the Rosetta Ruby translator, and the Gem publishing pipeline.

To directly address the maintenance-tail concern above, this RFC proposes a **community-maintainer model** rather than
asking the core team to absorb the full cost. The honest risk here is a **bus factor of one**: the proposal currently
rests on a single external maintainer, and the core team should weigh that explicitly. The model below is designed to
make that risk bounded and recoverable rather than to pretend it away:

- @omarqureshi commits to acting as the *initial* primary maintainer for the Ruby target: triaging Ruby-specific issues,
  keeping the runtime current with jsii wire-protocol changes, and maintaining the compliance-suite pass rate as the
  suite evolves.
- **Code home and co-maintainership.** To avoid a personal-account dependency, the Ruby target should live under AWS/
  `cdklabs` stewardship from day one, and the RFC explicitly invites at least one additional co-maintainer (from the
  community or the core team) before GA. **Status (2026-07-23): a second maintainer has been recruited and begins
  onboarding onto the project in mid-August 2026** — stated as a commitment in progress, not yet a contribution
  record. The author will support onboarding this and any further co-maintainers.
- The Ruby target launches under an **experimental / Developer Preview tier** with explicit stability annotations: no
  semantic-versioning guarantees on the Ruby API surface until promotion criteria (defined with the core team) are met.
  This contains the blast radius mechanically, not just by policy: preview gems publish from a decoupled pipeline that
  trails the npm release (see the versioning FAQ), so a Ruby-specific failure can never block a core CDK release.
  Lockstep pipeline integration is deferred to GA.
- **Objective health signal and an exit ramp.** The standard compliance suite provides a language-neutral health metric
  (currently a full pass). A sustained regression in that matrix — or an agreed period without an active maintainer — is the
  pre-agreed signal to mark the target unmaintained and, if needed, withdraw it while still in preview, mirroring how
  other targets are tracked. Because the target is additive and isolated, retiring it never affects the other languages.

### Are there any concerns with the Ruby execution speed or cold starts?

Since the CDK `synth` process runs locally on developer machines or inside persistent CI/CD runners (not as an AWS
Lambda function), cold-start times are largely irrelevant. The time required to boot the Ruby VM and the child Node.js
worker process is measured in fractions of a second and does not negatively impact the developer experience compared to
Python or Java.

### What is the technical solution (design) of this feature?

See the **Detailed Design** appendix; in summary, three pillars:

**1. The Ruby JSII Runtime (`@jsii/ruby-runtime`)** — thread-safe JSON-RPC kernel client, object registry with
`allocate`-based hydration and reference identity, structural runtime type validation, explicit serializer, guarded
dynamic-dispatch fallback.

**2. The pacmak Generator (`jsii-pacmak/lib/targets/ruby.ts`)** — translates `.jsii` assemblies into idiomatic Ruby gems
with YARD documentation, runtime type checks, hash-to-struct coercion and complete gemspec metadata, packaged as
standard `.gem` archives.

**3. Documentation Translation (`jsii-rosetta`)** — a new `RubyVisitor` transliterates the TypeScript example snippets
embedded in CDK documentation into idiomatic Ruby, so Construct Hub and inline docs show Ruby code. Implemented and
covered by the translation-fixture corpus; see *Documentation translation (jsii-rosetta)* in the appendix. Implementation is
complete and open for review as [aws/jsii-rosetta#3710](https://github.com/aws/jsii-rosetta/pull/3710) (draft until the
RFC direction is approved).

### Is this a breaking change?

No

### What alternative solutions did you consider?

- **AWS SDK for Ruby (`aws-sdk-ruby`)**: Teams can write custom Ruby scripts using the official AWS SDK to imperatively
  provision infrastructure. However, this forces developers to manually handle state management, rollback logic,
  idempotency, and resource dependency graphs. The AWS CDK abstracts this away by synthesizing declarative
  CloudFormation templates, providing a far safer infrastructure-as-code solution.
- **CloudFormation Generators (`cfndsl`)**: Developers currently use gems like `cfndsl` to generate CloudFormation
  JSON/YAML. However, `cfndsl` only provides a syntactic wrapper around raw CloudFormation resources; it lacks the
  higher-level abstraction (L2/L3 constructs), state management, and asset deployment capabilities of the AWS CDK.
- **Third-Party IaC (Pulumi / Terraform CDK)**: Unlike Python or TypeScript, major third-party declarative IaC
  frameworks like Pulumi and CDK for Terraform (CDKTF) do *not* currently have native support for Ruby. Adding Ruby
  bindings makes the AWS CDK the only mainstream high-level declarative infrastructure framework with native Ruby
  support.

### What are the drawbacks of this solution?

The primary drawback is the impedance mismatch between Ruby's dynamic, metaprogramming-heavy nature and the strict
structural typing enforced by `jsii`. To remain compatible with the polyglot JSII kernel, the Ruby bindings favor
explicit generated stubs and validation over Ruby's fully dynamic idioms; `method_missing` exists only as a guarded
fallback for members the generator could not know about. We lean on the architectural patterns established by the Python
JSII runtime to ensure stability, which may occasionally feel restrictive compared to pure Ruby libraries. Furthermore,
like all `jsii` targets, the Ruby runtime requires a hidden Node.js subprocess to execute, which can complicate
debugging and slightly increase memory overhead.

### What is the high-level project plan?

Delivery is structured as a **commitment ladder**: four phases, each independently approvable, ordered so the cheap
and reversible decisions come first. Declining a later rung leaves the earlier rungs intact and still valuable.

#### Phase 0: Namespace Protection (near-zero cost, time-sensitive)

- Secure `aws-cdk-lib`, `constructs`, `aws-cdk`, `jsii`, `jsii-ruby-runtime` and the `aws-cdk-asset-*` gem names on
  RubyGems.org under an MFA-enforced, AWS-owned organization account. **Partially executed:** the names were verified
  unregistered (2026-06-07 through 2026-07-22) and are now held as author-published placeholder releases pending
  transfer to AWS — see the *Gem name governance* status disclosure. The remaining step is the ownership transfer
  itself (`gem owner --add`), being coordinated with the maintainer team; it costs an afternoon and retains its value
  even if every subsequent phase is declined.

#### Phase 1: Prototyping & Core Runtime (Implementation Complete; Upstreaming)

- Establish the `jsii` Ruby runtime environment (`@jsii/ruby-runtime`), managing the child Node.js process and standard
  IO pipes.
- Develop the proxy `Object` foundation and robust runtime type validation across the language boundary.
- Implement the `jsii-pacmak` code generator target for Ruby, including YARD documentation emission and generated-code
  snapshot coverage in the cross-language test harness.
- **Milestone:** A full pass on the JSII standard compliance suite. ✅ **Achieved**, reported through
  `tools/jsii-compliance` into the same compliance matrix as Java and Go.
- The commitment requested at this rung is code review and an experimental home for the target — no publishing or
  support obligations.

#### Phase 2: Documentation, Tooling & Decoupled Preview Publishing (In Progress)

- Extend the `jsii-rosetta` translation engine to automatically generate idiomatic Ruby code snippets and usage examples
  from the original TypeScript sources (implemented and open for review as
  [aws/jsii-rosetta#3710](https://github.com/aws/jsii-rosetta/pull/3710), draft until the RFC direction is approved).
- Ruby renderer for `jsii-docgen`, enabling a Construct Hub Ruby documentation tab for every published construct library
  (implemented; PR opens on RFC approval).
- Generate and publish the core `aws-cdk-lib` modules and dependencies as standard Ruby Gems from a **decoupled
  pipeline trailing the npm release** (see the versioning FAQ): version numbers mirror the core CDK, but a Ruby
  packaging failure cannot block the release train.
- CDK CLI integration: a `cdk init --language ruby` project template (Gemfile, `app.rb`, `cdk.json` with `bundle exec
  ruby app.rb`) so the first-run experience matches the other languages.
- Implement comprehensive CI/CD pipelines to ensure ongoing stability against new JSII wire protocol updates (monorepo
  CI passes end-to-end today, including pacmak integration against `aws-cdk-lib`).

#### Phase 3: Community Preview & General Availability (Gated)

- Release an Alpha/Developer Preview to gather community feedback regarding the Developer Experience (DX).
- Publish migration guides, "Getting Started" documentation, and tutorials tailored for Ruby on Rails engineers.
- Validate `require`-time and lazy-load behavior across the preview cohort at `aws-cdk-lib` scale (lazy `autoload`
  emission is already implemented — see *Lazy loading* in Detailed Design).
- Finalize API stabilization and fix edge-case bugs based on user feedback.
- **Gate:** promotion to GA — and with it, lockstep release-pipeline integration and standard support expectations —
  happens only when pre-agreed criteria are met: sustained compliance-matrix health, preview adoption signals (gem
  downloads, issue volume), and at least one onboarded co-maintainer.

### Unresolved questions & known limitations

In the spirit of RFC 204's honesty section — current open items, none of which block the compliance suite:

- **Ambiguous unions**: Hashes passed where a union allows *multiple* struct types are forwarded as-is; coercion only
  happens when exactly one struct arm makes the conversion unambiguous. (Matching by key-shape was considered and
  rejected as too magical.)
- **Hash key casing**: user-supplied hashes must use snake_case keys; camelCase (wire-shape) hashes are handled by the
  deserializer, not at call sites.
- **Async static methods** are invoked via the synchronous kernel path (the kernel's `begin` API only accepts object
  references) — a kernel-level limitation shared by all bindings.
- **Naming of generated artifacts** (gem names for scoped npm packages, acronym defaults, and the `AWSCDK::S3`-style
  module mapping — see *Root namespace rationale* in the appendix) follows conventions established here but deserves
  bar-raiser review before the API freezes.

## Future Possibilities

Beyond GA, the type information already present in `.jsii` assemblies enables several natural extensions:

- ~~**Block-based DSL sugar**: optional block-initializer style (`Bucket.new(self, 'B') { |b| b.versioned = true }`)
  layered over the kwargs API, leaning into Ruby's configuration-DSL heritage without altering the wire contract.~~
  *(Struck: a post-construction mutation block adds nothing over the kwargs form, and L2 construct properties are
  construct-time-only — there is no `bucket.versioned=` setter — so the block has nothing to set. The kwargs/struct API
  already covers this idiomatically.)*
- **JRuby / TruffleRuby evaluation**: the runtime is pure Ruby over stdio pipes with no C extensions, so alternative
  interpreters are plausible targets once officially tested.
- **Rails integration**: generators/railties that scaffold CDK stacks inside existing Rails applications, unifying app
  and infrastructure in a single repository and test suite.

## Appendix: Detailed Design

To map the `jsii` specification to native Ruby, the code generator (`jsii-pacmak`) translates each jsii type-system
feature into an idiomatic Ruby construct:

| jsii concept | Ruby construct |
| --- | --- |
| Class | `class Foo < Jsii::Object` (or its jsii base class) |
| Behavioral interface | `module IFoo` (mixed in with `include`) |
| Struct (datatype interface) | Value class `< Jsii::Struct`, kwargs constructor; plain Hashes coerced at call sites |
| Enum | `module Foo` containing `Jsii::Enum` constants |
| Static member | Singleton method on the defining class |
| `camelCase` member | `snake_case` method |
| Namespace / submodule | `PascalCase` nested modules (configurable acronyms) |
| Optional value | `nil` / omitted keyword argument |
| `Promise<T>` | Synchronous call (kernel `begin`/`end` bridged internally) |

Where the sibling runtimes faced the same mapping questions, Ruby's positions are deliberate choices within the family:

| Concern | Python | Java | Go | **Ruby** |
| --- | --- | --- | --- | --- |
| Struct passing | keyword arguments | generated Builders | struct types with pointer fields | value classes + hash/kwargs coercion |
| Optionals | `None` defaults | `@Nullable` / builder omission | pointer types | `nil` keyword defaults |
| Guest interface impl | `@jsii.implements` decorator | `implements` | interface embedding | `include Module` |
| Enums | `enum.Enum` | Java `enum` | typed string constants | `Jsii::Enum` constants |

### Enums

Enum members are **wrapper objects, not raw strings**: they must serialize as `$jsii.enum` wire envelopes carrying their
fully-qualified name to round-trip through the kernel. Generated output:

```ruby
module AllTypesEnum
  MY_ENUM_VALUE   = Jsii::Enum.new("jsii-calc.AllTypesEnum", "MY_ENUM_VALUE")
  YOUR_ENUM_VALUE = Jsii::Enum.new("jsii-calc.AllTypesEnum", "YOUR_ENUM_VALUE")
  THIS_IS_GREAT   = Jsii::Enum.new("jsii-calc.AllTypesEnum", "THIS_IS_GREAT")
end
```

Members compare by value (`fqn` + name), so values received from the kernel are `==` to the generated constants.
Integer-backed and string-backed TypeScript enums are handled identically — the wire format only ever carries the member
*name*.

### Interfaces

#### Behavioral interfaces → modules

Behavioral interfaces map to Ruby modules, implemented via `include`. This is Ruby's native contract idiom
(`Comparable`, `Enumerable`) — but here the `include` is also **load-bearing for the wire protocol**: jsii is nominally
typed, and when a native Ruby object is passed to the kernel, the runtime gathers the jsii FQNs of every included
interface module and registers them (with an overrides table) so the JavaScript side builds a proxy honoring exactly
those contracts. Duck typing cannot cross the process boundary; `include IBellRinger` is the one-line nominal
declaration the protocol requires.

```ruby
class MyBellRinger
  include JsiiCalc::IBellRinger

  def your_turn(bell)
    bell.ring   # `bell` is a live proxy; this call re-enters the kernel
  end
end

JsiiCalc::ConsumerCanRingBell.static_implemented_by_public_class(MyBellRinger.new)  # => true
```

Required members are validated at construction time (fail-fast `missing required method/property: ...`) instead of
erroring later inside a Node-side callback.

#### Structs (datatype interfaces) → value classes + hash coercion

Structs generate as value classes inheriting `Jsii::Struct`, with keyword-argument constructors, per-member runtime type
validation, and content-based `==`/`hash`. Real generated output:

```ruby
class CalculatorProps < Jsii::Struct
  Jsii::Object.register_jsii_fqn("jsii-calc.CalculatorProps", self)

  # @param initial_value [Numeric, nil] The initial value of the calculator.
  # @param maximum_value [Numeric, nil] The maximum value the calculator can store.
  def initialize(initial_value: nil, maximum_value: nil)
    @initial_value = initial_value
    Jsii::Type.check_type(@initial_value, ..., "initialValue") unless @initial_value.nil?
    @maximum_value = maximum_value
    Jsii::Type.check_type(@maximum_value, ..., "maximumValue") unless @maximum_value.nil?
  end

  # The initial value of the calculator.
  #
  # @return [Numeric, nil]
  # @note Default: 0
  attr_reader :initial_value
end
```

At call sites, plain Ruby Hashes are accepted and **coerced into struct instances** — recursively, including elements of
arrays and maps, and the single struct arm of unambiguous unions — so the idiomatic hash-literal style works everywhere.
Ruby 3's keyword-to-positional-hash conversion makes both spellings equivalent:

```ruby
Bucket.new(self, 'MyBucket', { versioned: true })   # explicit hash
Bucket.new(self, 'MyBucket', versioned: true)       # trailing keywords
```

Coercion matters beyond ergonomics: an uncoerced Hash would serialize with its literal snake_case keys while the kernel
expects the struct's camelCase wire form — so coercion happens *before* validation and serialization.

jsii structs support multiple inheritance ("diamond" hierarchies); Ruby classes do not. The generator subclasses the
**first** declared parent and records the rest in a conformance registry on `Jsii::Struct`, which `is_a?`, `kind_of?`
and `case`/`when` dispatch consult — so a `DiamondInheritanceTopLevelStruct` instance is an `is_a?` match for *both*
mid-level parents. Equality remains exact-class to keep `==` symmetric.

### Classes

#### Case 1: Simple class

Generated classes inherit `Jsii::Object` (the RPC proxy base) and self-register their FQN for ref hydration. Members
carry YARD documentation generated from the assembly docs:

```ruby
# A calculator which maintains a current value and allows adding operations.
class Calculator < ::JsiiCalc::Composition::CompositeOperation
  self.jsii_fqn = "jsii-calc.Calculator"
  Jsii::Object.register_jsii_fqn("jsii-calc.Calculator", self)

  # Creates a Calculator object.
  #
  # @param props [JsiiCalc::CalculatorProps, nil] Initialization properties.
  def initialize(props = nil)
    props = props.is_a?(Hash) ? ::JsiiCalc::CalculatorProps.new(**props.transform_keys(&:to_sym)) : props
    Jsii::Type.check_type(props, ..., "props") unless props.nil?
    Jsii::Object.instance_method(:initialize).bind(self).call(props)
  end

  # Adds a number to the current value.
  #
  # @param value [Numeric]
  # @return [void]
  def add(value)
    Jsii::Type.check_type(value, ..., "value")
    jsii_call_method("add", [value])
  end
end
```

(Type metadata is embedded as Base64-encoded JSON literals — elided as `...` above — so no jsii-supplied string can ever
inject into generated source via `#{}` interpolation.)

#### Case 2: Extending a base class and implementing interfaces

Inheritance maps directly; host interfaces appear as `include`s. Real output:

```ruby
class Multiply < ::JsiiCalc::BinaryOperation
  include ::JsiiCalc::IFriendlier
  include ::JsiiCalc::IRandomNumberGenerator
  self.jsii_fqn = "jsii-calc.Multiply"
  Jsii::Object.register_jsii_fqn("jsii-calc.Multiply", self)

  # Creates a BinaryOperation.
  #
  # @param lhs [Scope::JsiiCalcLib::NumericValue] Left-hand side operand.
  # @param rhs [Scope::JsiiCalcLib::NumericValue] Right-hand side operand.
  def initialize(lhs, rhs)
    Jsii::Type.check_type(lhs, ..., "lhs")
    Jsii::Type.check_type(rhs, ..., "rhs")
    Jsii::Object.instance_method(:initialize).bind(self).call(lhs, rhs)
  end
  ...
end
```

Every class also emits a `jsii_overridable_methods` table mapping Ruby member names to their jsii wire names — the
runtime diffs a *user's* subclass against this table at construction time to compute the overrides list registered with
the kernel.

#### Case 3: Native subclassing and overrides (guest → host callbacks)

Users subclass generated classes with ordinary Ruby. Overridden members are detected automatically and registered with
the kernel; when host code invokes them, the kernel calls back into the Ruby implementation — including `super`, which
crosses the boundary back to the original JS implementation without ping-ponging:

```ruby
class OverrideCallsSuper < JsiiCalc::AsyncVirtualMethods
  def override_me(mult)
    super(mult) * 10 + 1   # `super` executes the original JS implementation
  end
end
```

#### Case 3½: Lambdas as callbacks (SAM coercion)

jsii's wire protocol has no function type — callbacks are always "an object implementing an interface". Whether a
language can pass a *lambda* there is guest-language ergonomics: TypeScript gets it from structural typing, Java from
javac's SAM conversion, and Python/C#/Go require an explicit implementing class. Ruby joins the first group at the
runtime level: at any call site expecting a single-method interface, generated code coerces a `Proc` — or the
TypeScript-mirror form, `{ member: -> { ... } }` — into an anonymous implementing object, which then rides the
ordinary (compliance-tested) callback machinery:

```ruby
consumer.implemented_by_object_literal(->(bell) { bell.ring })
```

The coercion is additive and self-limiting: the runtime re-derives single-method-ness from the generated module's own
override table and passes every non-coercible value through to normal type checking. This is also what makes
rosetta-translated examples honest — a TypeScript `Lazy.string({ produce: () => value })` renders as
`Lazy.string({ produce: -> { value } })`, which actually runs.

#### Case 4: Abstract classes

Abstractness only exists at the TypeScript level — on the wire there are just object refs and member names. The
generated Ruby class for an abstract type has a concrete forwarding stub for *every* member, and instances returned by
the kernel hydrate via `allocate` (never `new`), so "you cannot instantiate an abstract class" never arises for
kernel-returned values. When the kernel returns an instance of an **unexported** concrete subclass, the reference is
labelled with the nearest *exported* ancestor, and virtual dispatch on the real JS object does the rest. Guest
subclasses of abstract classes supply the abstract members as plain Ruby methods and are driven by host callbacks
(verified by the `abstractMembersAreCorrectlyHandled` compliance test).

#### Statics

Static members are emitted **only on their defining class**: Ruby inherits singleton methods, which matches the ES6
static-inheritance semantics the jsii kernel implements (its member lookups walk the base chain). A child that overrides
a static gets its own stub carrying the child's FQN — pinned by the `StaticHelloParent`/`StaticHelloChild` fixture.
Classes whose jsii constructor is private generate an `initialize` that raises eagerly with a pointer to the factory
methods.

### Optional values and `nil`

This is one of the places Ruby maps *cleanly* where other languages struggle (cf. Go's pointer-types design in RFC 204):

- Optional parameters and struct members become `param = nil` / `key: nil` defaults; `nil` is serialized as `undefined`.
- Unset optionals read back as `nil`; a host API legitimately returning `undefined` collections surfaces `nil`.
- Unset struct members are **absent** from the wire payload (not present-as-null) — JS `'key' in obj` semantics are
  preserved (`eraseUnsetDataValues`).
- Runtime validation is nil-tolerant for optionals and strict for required members (missing required kwargs raise
  `ArgumentError` natively).

No wrapper types, no pointers, no sentinel values.

### Async (`Promise`) methods

Async host methods are bridged synchronously: the runtime issues the kernel's `begin`, services any callback requests
while the promise is pending (this is when Ruby overrides of async methods execute), then collects the result with
`end`. From the Ruby caller's perspective the method is an ordinary blocking call:

```ruby
# async callMe(): Promise<number>  →
def call_me()
  jsii_async_call_method("callMe", [])
end
```

Guest async overrides, overrides-calling-`super`, multiple simultaneous overrides, exception propagation (any Ruby
exception class → host promise rejection → `Jsii::RuntimeError`), and `Promise<void> → nil` are all covered by the
`asyncOverrides_*` compliance tests. Async **static** methods are invoked via the synchronous kernel path, as the
kernel's `begin` API only accepts object references.

### Naming, reserved words, and the runtime's own API

- Members: `camelCase` → `snake_case`; constants: `UPPER_SNAKE` (`Statics.FOO`); modules/classes: `PascalCase` with
  per-assembly configurable acronyms (`APIGateway`, `DynamoDB`) — acronym lists are scoped to the assembly that declared
  them and treated as literal text, not patterns.
- Names colliding with Ruby keywords (`class`, `while`, `end`...) or with the object model and the runtime's own API
  (`initialize`, `new`, `allocate`, `to_jsii`, and the entire reserved `jsii_` prefix) are deterministically prefixed
  with `_`. The kernel callback dispatcher applies the *identical* mapping — enforced by a cross-package consistency
  test — so an override of a renamed member always dispatches. Visible in real output: `IRandomNumberGenerator#next`
  becomes `_next` (Ruby keyword).
- Package names that cannot start a Ruby constant (npm allows `3d-tools`) are prefixed (`V_3dTools`).

### Lazy loading (autoload)

The dominant assembly is `aws-cdk-lib`: ~20,000 types in one gem. Eager-defining every class at `require` time — parsing
and evaluating ~180 MB of generated source (measured: exactly 180 MB uncompressed in the 2026-07-23 published gem) — is
untenable; a program that touches one S3 bucket should not pay to define every CloudFormation resource in AWS.

The generator therefore emits each assembly as a **thin loader plus one file per type**, rather than a single monolith:

- `lib/<assembly>.rb` (the loader) loads the assembly into the kernel and, for every type, declares a Ruby `autoload`
  and calls `Jsii::Object.register_autoload(fqn, path)`. It defines no class bodies.
- `lib/<assembly>/<namespace>/<type>.rb` defines a single type, loaded on first use.
- Types nested under a class (e.g. `CfnBucket.ReplicationRuleProperty`) are bundled into their owner's file, since a
  constant nested under a class cannot be autoloaded without forcing the class to load.

Two load triggers cover the two ways a type is reached:

- **Ruby `autoload`** fires when user code references a constant (`AWSCDK::S3::Bucket`).
- **`register_autoload`** covers the case the kernel hands back an FQN the user never named — pervasive in CDK, where
  `vpc.public_subnets` returns `Subnet` proxies for types the program never wrote down. The registry's
  `find_class_by_fqn` does a load-on-miss `require` before hydrating, so a kernel-returned object always resolves to its
  real proxy class rather than a bare `Jsii::Object`.

The result is measured above: `require 'aws-cdk-lib'` registers ~20,400 autoloads and defines zero type bodies;
constructing a small stack loads only the handful of files actually touched. In practice this is not a
micro-optimization: on the production reference deployment, switching to lazy `autoload` emission cut roughly 30 seconds
off `cdk deploy` versus the prior single-file eager layout.

### Type signatures (RBS)

Alongside the runtime sources, the generator emits **RBS signatures** (`sig/<assembly>.rbs`) describing every generated
class, module, method and struct. This gives Ruby's static type tooling (Steep, TypeProf) and editor tooling a precise
view of the CDK API — the same intent as the `.d.ts`/typeshed surface other ecosystems ship — without affecting runtime
behavior. Real generated output, mirroring the `Calculator`/`CalculatorProps` sources above:

```rbs
class JsiiCalc::Calculator < ::JsiiCalc::Composition::CompositeOperation
  def initialize: (?::JsiiCalc::CalculatorProps? props) -> void
  attr_reader value: Numeric
end

class JsiiCalc::CalculatorProps < ::Jsii::Struct
  def initialize: (?initial_value: Numeric?, ?maximum_value: Numeric?) -> void
  attr_reader initial_value: Numeric?
  attr_reader maximum_value: Numeric?
end

# Optional members map to nilable types (`?`); union types are parenthesized so
# they don't collide with RBS's method-overload separator:
attr_reader union_array_property: Array[(Numeric | ::Scope::JsiiCalcLib::NumericValue)]
```

The generated RBS validates clean under `rbs validate` across `jsii-calc` and its dependency closure (with the runtime
gem's own signatures and the stdlib `date` library on the load path) — a check wired into the runtime test suite,
including a negative control that fails the build if the generator ever emits a malformed signature.

### Runtime architecture (`@jsii/ruby-runtime`)

The runtime lives in the jsii monorepo as the npm-workspace package `@jsii/ruby-runtime` (mirroring
`@jsii/python-runtime`) and is *published* as the Ruby gem `jsii-ruby-runtime` — the two names refer to the same
component, the former being its source location and the latter its RubyGems artifact.

- **Kernel client**: spawns the `jsii-runtime` Node child process over stdio pipes; a re-entrant `Monitor` makes the
  bidirectional JSON-RPC pipe thread-safe (dedicated concurrency tests), and an isolated stderr-draining thread prevents
  pipe deadlocks.
- **Object registry**: byref handles map to live proxies for reference identity across the boundary; hydration uses
  `allocate` so constructor side-effects never run twice; a pending-object mechanism preserves `self` identity when JS
  constructors call back before registration completes.
- **Object lifetime**: the registry holds *strong* references and the runtime never issues the kernel's per-object `del`
  on garbage collection — matching both reference runtimes. A jsii object is referenced from both sides of the boundary,
  and the guest cannot know the host's reference count, so a guest-initiated `del` would risk a dangling reference
  (use-after-free) on the host. Python documents this explicitly ("we can never free the memory of JSII objects ever,
  because we have no idea how many references exist on the *other* side"); Go defines a `Del` request but never calls it
  per-object, finalizing only the kernel client to close the process. Ruby does the same: wholesale cleanup happens when
  the kernel shuts down and the Node sidecar exits, which suits jsii's short-lived `synth` workloads.
- **Dispatch**: generated explicit stubs are the primary path; a guarded `method_missing` fallback (with matching
  `respond_to?` discipline) covers members with no generated stub, e.g. on dynamically-returned anonymous objects.
- **Serialization**: a dedicated `Jsii::Serializer` handles the wire envelopes
  (`$jsii.byref`/`enum`/`date`/`map`/`struct`) — no core-class monkey-patching, so the runtime coexists with
  ActiveSupport and never walks host-application objects.
- **Errors**: JS exceptions re-raise as `Jsii::RuntimeError` preserving the original name, message and remote stack
  trace.

### Packages, submodules and distribution

Namespaces nest as modules; submodules pin explicit Ruby module names via `targets.ruby.module`, and for `aws-cdk-lib`
the service-level `Aws` prefix is dropped: `aws-s3` maps to **`AWSCDK::S3`** (not `AWSCDK::AWSS3`), giving
`AWSCDK::S3::Bucket`.

**Root namespace rationale.** Two alternatives were considered and rejected:

- `Aws::CDK::S3` — superficially the most idiomatic, but `Aws` is the root module owned by the official AWS SDK for
  Ruby (`aws-sdk-core`). Reopening another gem family's root constant couples the CDK's load behavior to `aws-sdk-*`
  internals, risks constant collisions in applications that load both (most Rails applications would), and makes the
  SDK team a stakeholder in every CDK naming decision. A distinct root constant keeps the CDK self-contained — the same
  reasoning behind .NET's standalone `Amazon.CDK` root.
- `AWSCDK::AWSS3` — a literal port of .NET's `Amazon.CDK.AWS.S3` submodule naming, and what the default acronym rules
  produce. It says "AWS" twice in every constant; the service-level `AWS` prefix carries no information inside a module
  already named `AWSCDK`. Dropping it is a pure win for the constants users type most.

The mapping lives entirely in per-submodule `targets.ruby.module` declarations in `aws-cdk`'s `.jsiirc.json` files (the
same files that already carry the Java/Python/.NET module names), so the bar raiser can revise the convention without
any generator changes.

Each assembly generates a complete gemspec from its own metadata. Real output:

```ruby
Gem::Specification.new do |s|
  s.name        = 'jsii-calc'
  s.version     = '3.20.120'
  s.summary     = 'Ruby bindings for jsii-calc'
  s.description = 'A simple calcuator built on JSII.'
  s.authors     = ['Amazon Web Services']
  s.license     = 'Apache-2.0'
  s.homepage    = 'https://github.com/aws/jsii'
  s.files       = Dir["lib/**/*"] + Dir["sig/**/*"]
  s.required_ruby_version = '>= 3.3.0'
  s.add_dependency 'jsii-ruby-runtime', '< 0.0.1'
  s.add_dependency 'base64', '~> 0.2'
end
```

NPM version semantics translate to RubyGems equivalents via `toRubyVersionRange` (pre-release identifiers map to
`.alpha.1` / `.dev.1`-style suffixes; caret/tilde ranges to `~>` constraints). Gems for CDK libraries version in
lockstep with their npm counterparts.

> In the end state, the runtime gem versions in lockstep with `aws-cdk-lib` like every other CDK gem, and generated
> gemspecs carry an ordinary `~>` constraint on it. The `'< 0.0.1'` pin visible above is a temporary bootstrap against
> prerelease runtime gems while the upstream changes ([aws/jsii#5129](https://github.com/aws/jsii/issues/5129),
> [aws/jsii-compiler#2663](https://github.com/aws/jsii-compiler/pull/2663)) are still in review.

**Gem name governance**: all target names (`aws-cdk-lib`, `constructs`, `aws-cdk`, `jsii`, `jsii-ruby-runtime` and the
`aws-cdk-asset-*` names) were verified unregistered on RubyGems.org between 2026-06-07 and 2026-07-22. RubyGems has no
reservation mechanism and adjudicates name disputes case-by-case, so early registration is the only reliable protection.

**Status disclosure (2026-07-22): the author has executed the interim fallback described below.** All of the names
above are now held by the author's MFA-enforced RubyGems account as honest placeholder releases: prerelease-versioned
(`0.0.0.pre.reserved.1`, which Bundler and `gem install` never select by default), authored under the author's own name
— not AWS's — and each carrying a reservation notice pointing at this RFC together with a standing commitment to
transfer ownership to AWS (`gem owner --add`). **Ownership transfer to AWS is being coordinated with the maintainer
team.** The end state this RFC asks for is unchanged: every name under an AWS-owned, MFA-enforced organization account,
so the supply chain sits entirely within AWS's control before any public preview is announced; the executed fallback
exists solely so that there is a namespace left to hand over.

**API documentation**: `jsii-docgen` gains a Ruby renderer (delivered as a separate PR to cdklabs/jsii-docgen), so
Construct Hub can present a Ruby tab — API reference in Ruby syntax — for every published construct library, exactly as
it does for the existing languages.

### Documentation translation (jsii-rosetta)

`pacmak` generates the gems; `jsii-rosetta` is what lets the *docs* speak Ruby. Every CDK API doc and README carries
TypeScript example snippets, and rosetta transliterates them per target language. Ruby is added as a first-class
rosetta target — a new `TargetLanguage.RUBY` enum value wired through `targetName()` and the language registry, plus a
self-contained `RubyVisitor extends DefaultVisitor` that overrides 40+ AST node handlers (imports, variable/property/class
declarations, call/new expressions, object literals, parameters, control flow, string/template literals, ternaries, etc.).

Representative behaviors, each pinned by a translation fixture:

- **Members → `snake_case`, modules → `PascalCase`**, with reserved-word escaping (`next` → `_next`) using the same
  rules as the generator.
- **`this` → `self`**, and a small builtin map (`console.log` → `puts`, `console.error` → `STDERR.puts`,
  `Math.random` → `rand`).
- **Struct/object literals → Ruby hashes** with keyword-style keys, matching the call-site form the generated gems
  accept. Real fixture (`structs/var_new_class_known_struct`):

```ruby
# TypeScript:  const vpc = new Vpc(this, "Something", { argument: 5 });
vpc = Vpc.new(self, "Something", {
    argument: 5
})
```

- **Behavioral interfaces → `include`** in translated class snippets (`classes/class_implementing_jsii_interface`):

```ruby
class MyClass
  include IResolvable
  def resolve
    return 42
  end
end
```

Acronym casing follows the same single-source-of-truth rule as the generator: when a snippet's type references
resolve to a jsii assembly, the visitor reads `targets.ruby.acronyms` (and the module configuration) from that
assembly — rosetta deliberately carries **no built-in acronym list**. A snippet whose references cannot be resolved to
any assembly renders plain PascalCase — an honest best-effort guess rather than fake authority — which is a known
limitation for non-compiling snippets, not a correctness bug in the snippet's Ruby. The reserved-word set (Ruby
language data, not library data) is the one hardcoded table, mirroring the generator's.

Coverage spans the full fixture corpus (97 at last count) across calls (17), classes (15), expressions (22), statements (12),
structs (6), imports (6), comments (4), intersections (4), interfaces (2), identifiers (2), visibility/hiding (6) and
miscellaneous (1) — each checked against the *same* TypeScript source used to validate the Python/Java/Go/.NET
renderers.

### Security considerations

- Generated code contains **no runtime `eval` or dynamic code construction**: type metadata is embedded as
  Base64-encoded JSON literals, so no jsii-supplied identifier or docstring can inject into generated Ruby source
  through string interpolation.
- The serializer is explicit and type-driven — it never monkey-patches core classes and never walks arbitrary
  host-application objects, so application state cannot leak unintentionally into the kernel process.
- The Node.js child process communicates exclusively over stdio pipes; it opens no network listeners.
- Reserved-name mangling prevents generated members from shadowing the runtime's own dispatch surface (`send`,
  `initialize`, the `jsii_` prefix), closing a class of confused-deputy bugs between generated and runtime code.
