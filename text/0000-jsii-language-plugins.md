# A lightweight plugin system for jsii language targets

> DRAFT for co-development — offered by @mrgrain in
> [aws/aws-cdk-rfcs#935](https://github.com/aws/aws-cdk-rfcs/issues/935#issuecomment) ("let's work on an
> RFC for a lightweight plugin-system that would allow you to publish a Ruby-plugin and self-host the
> generated language bindings"). Tracking issue and RFC number TBD.

The AWS CDK team does not plan to support additional jsii languages in-tree: usage outside
TypeScript and Python is marginal, and the Go experience showed that every in-tree language
target carries a permanent maintenance tail — including forced breaking changes — regardless of
adoption. At the same time, working community implementations exist (Ruby passes the full jsii
compliance suite and deploys production workloads today). This RFC proposes the *smallest set of
seams* that let a community build, publish and self-host a language target **out of tree**, with
no AWS release-train coupling and no AWS support obligation.

## Working Backwards

A community language maintainer publishes two artifacts, entirely under their own governance:

1. a **pacmak target plugin** (an npm package), and
2. a **guest runtime** for their language (a package in that language's native ecosystem),

and generates bindings for any jsii assembly with stock tooling:

```sh
npx jsii-pacmak --plugin @cdk-community/jsii-target-ruby -t ruby \
  --target-config ./naming-overlay.json -o dist/ruby -- .
```

Consumers install the generated bindings from wherever the community hosts them. AWS's tooling
knows nothing about the language; AWS's repos contain none of its code; AWS's release train
never waits for it. The community runtime proves itself by publishing a passing run of the
**jsii conformance kit** — the same compliance suite that gates the in-tree languages, packaged
to run against any external runtime.

## What we are proposing — three deliverables, smallest first

### D1. pacmak: external target plugins *(the enabling seam)*

Today `jsii-pacmak`'s targets are a closed map (`ALL_BUILDERS: { [key in TargetName]: BuilderFactory }`).
Notably, three of the five built-ins (`go`, `js`, `python`) already run through a *generic*
`IndependentPackageBuilder` parameterized only by a `TargetConstructor` — the abstraction a
plugin needs already exists and is proven. The change is to open the registry, not to invent a
framework:

- `--plugin <npm-package-or-path>` loads a module whose default export declares
  `{ targetName: string, targetConstructor: TargetConstructor }` (or, escape hatch, a full
  `BuilderFactory` for languages that need multi-module builds like .NET/Java).
- CLI target validation accepts plugin-registered names alongside built-ins.
- The per-language hooks currently hardcoded in pacmak internals move into the plugin contract:
  version-scheme conversion (`toReleaseVersion` / native version-range mapping) and any
  reserved-word/naming utilities the target needs.
- **Naming-config overlay** (`--target-config <file>`): construct libraries will not carry
  `targets.<community-language>` naming config in their repos, so the plugin supplies it at
  generation time — per-assembly and per-submodule module names, acronym casing, etc., merged
  over whatever the assembly declares. (The Ruby reference implementation maintains exactly this
  file today for the 613 submodules of `aws-cdk-lib`.)

The stability contract: the plugin API surface (`Target`, `TargetConstructor`, `TargetBuilder`,
the version hooks) is published as an explicitly versioned, initially **experimental** API; pacmak
declares its plugin-API version, plugins declare a compatible range, and mismatches fail loudly at
load time. No guarantee is made beyond that during the experimental period.

### D2. Runtime conformance: a stability statement plus a kit *(no code changes)*

A guest runtime needs **no plugin API at all** — the jsii kernel wire protocol (line-delimited
JSON over stdio to `@jsii/runtime`) is already the boundary, and every released guest runtime
already depends on its stability. This deliverable makes that implicit contract explicit:

- a documented statement that the kernel protocol is a public interface for alternative guest
  runtimes, with its compatibility policy;
- `tools/jsii-compliance` published as a runnable **conformance kit**: the canonical suite
  definition plus the report format, so any external runtime can generate a compliance report
  and make a verifiable claim ("full pass") without AWS running anything.

### D3. rosetta: language plugins *(phase 2, optional)*

Example translation is enhancement, not enablement — bindings are useful with TypeScript
examples in the docs. Phase 2 opens rosetta's `TARGET_LANGUAGES` map the same way as D1
(values are already plain strings; tablets are string-keyed), with the visitor interface offered
at the same experimental tier. Deliberately deferred so D1 stays reviewable in an afternoon.

### Explicit non-changes

- **jsii-compiler: zero changes.** `targets` already types unknown languages as pass-through
  (`[otherLanguage: string]: unknown`) — community naming config flows into assemblies today.
- **The `.jsii` assembly format and kernel protocol: unchanged.**
- **AWS repos gain no language code, no CI matrix rows, no release-train steps.**

## Public FAQ

**Is a plugin language a supported CDK language?** No. Supported languages are TS/JS and Python
(plus the existing in-tree targets). Plugin languages are community-built, community-hosted and
community-supported; AWS supports only the seams named above.

**How do I know a community runtime actually works?** It publishes a conformance-kit report —
the same suite that gates the in-tree languages. That's a stronger, more checkable claim than
most community bindings can make today.

**Where do plugin languages live?** Wherever their maintainers choose. The Open Constructs
Foundation has been suggested as a natural home for languages with a sustainable maintainer team.

**What may the generated packages be called?** Open question for this RFC — names like
`aws-cdk-lib` in other package ecosystems carry AWS's brand, and whether community publications
may use them (vs. e.g. OCF-branded names) needs an explicit AWS position.

## Internal FAQ

**Why are we doing this?** It converts "please absorb a language forever" (declined, for good
portfolio reasons — see #935) into "expose the boundary that already exists in practice." The
Ruby work demonstrated both halves: the implementation quality is achievable outside the core
team, and the *only* thing forcing it to live in forks is the absence of these seams — the fork's
entire delta over upstream is registry entries and version pins that D1 replaces.

**Why should we _not_ do this?** Frozen APIs are a commitment; a plugin ecosystem could create
support pressure ("my plugin broke"). Mitigations: the surface is tiny and mostly already-stable
interfaces; the experimental tier sets expectations; the support boundary is stated in the FAQ
above and in pacmak's docs.

**Is this a breaking change?** No. Built-in targets are untouched; `--plugin` is additive.

**What is the reference implementation?** Ruby, extracted from the existing fork: a pacmak
target (~2,300 lines) and rosetta visitor (~1,100 lines) ready to re-home behind the D1/D3 seams;
a runtime gem passing the full compliance suite; generated `aws-cdk-lib` bindings self-hosted on
a public gem feed with rendered API docs; production workloads deploying through them; and an
operating publish pipeline that has been performing the "out-of-tree language target" role for
weeks — today via forks and patch-pins, which this RFC's seams eliminate. Maintainer team: two
(second maintainer onboarding August 2026), meeting the sustainability bar hosting organizations
ask for.

**What is the high-level project plan?**
1. This RFC (co-developed with the jsii maintainers).
2. D1 PR to `jsii-pacmak` — small: registry + `--plugin` + version hooks + `--target-config`.
3. Extract `jsii-target-ruby` from the fork as the first plugin; retire the fork pins.
4. D2: protocol statement + conformance kit packaging; Ruby publishes its report.
5. D3 (phase 2): rosetta registry; re-home the Ruby visitor.
6. Dispose of the superseded in-tree PRs (aws/jsii#5178, jsii-compiler#2663, aws-cdk#38248,
   jsii-rosetta#3710) with pointers here.

**Open questions to settle in co-development**
- Plugin discovery: `--plugin` flag only (explicit, lightweight) vs. also package.json config?
- Exact plugin contract: `TargetConstructor`-level (reusing `IndependentPackageBuilder`) with
  `BuilderFactory` escape hatch — or builder-level only?
- Version-hook shape: what exactly moves from `version-utils` into the contract?
- Conformance kit packaging: npm package? repo? who cuts its releases?
- Naming/branding position for generated packages (see Public FAQ).
- Experimental→stable graduation criteria for the plugin API.
