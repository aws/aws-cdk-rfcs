# RFC: CDK LSP and Web Interface

* **Author:** [Megha Narayanan](https://quip-amazon.com/YWB9EAizoK4)
* **Tracking Issue**: [#920](https://github.com/aws/aws-cdk-rfcs/issues/920)
* **API Bar Raiser**: @ShadowCat567 (lvielto)

CDK developers cannot see what their code creates, discover deployment failures too late, and must jump between disconnected tools to debug. The CDK
LSP and Web Explorer close this gap by surfacing construct-to-resource mappings, validation diagnostics, and three-way linked navigation directly in
editors and a browser-based explorer.

## Working Backwards

### CHANGELOG

```
`* feat(cli): `cdk explore` command launches an interactive web explorer for CDK apps
* feat(cli): CDK LSP server for IDE and AI agent integration
* feat(toolkit-vscode): CDK construct diagnostics, CodeLens, and enhanced CDK tree view via AWS Toolkit
`
```

### README

#### CDK Explorer

CDK Explorer gives you a visual, interactive view of your CDK application — showing the relationship between your source code, the construct tree, and
the synthesized CloudFormation templates.

#### `cdk explore`

Launch the explorer from any CDK project directory:

```
`$ cdk explore
CDK Explorer running at http://127.0.0.1:4000
`
```

The explorer opens in your browser with three linked panels:

* Tree panel: your construct hierarchy, expandable from the app root down to individual resources
* Template panel: the synthesized CloudFormation template with syntax highlighting
* Source panel: your CDK source code

Wireframe:
![Wireframe Design](../images/WebExplorerWireframe.png)

Clicking any element in one panel highlights the corresponding elements in the other two. Click a
construct in the tree to see which CloudFormation resources it produces and which line of code created it. Click a resource in the template to jump to
the CDK code that generated it.

A violations sidebar shows offline validation findings grouped by severity. Clicking a violation navigates all three panels to the relevant construct.
The explorer watches your source files and re-synthesizes automatically on save.  While synthesis is running, a progress indicator appears. If
synthesis fails, the explorer shows the failure and continues displaying the last successful results. A timestamp shows when data was last refreshed;
if source files have been modified since, a staleness warning appears. A manual "Synth now" button is available for forced refresh or when auto-synth
is disabled

#### Limitations

* Re-synthesis on save depends on synth speed; large apps (50+ stacks) may take 10-30s to refresh
* The explorer is read-only — it does not modify source files or deploy resources

#### CDK LSP Server

The CDK LSP server provides real-time CDK intelligence to any editor or AI agent that speaks the Language Server Protocol. In VSCode, install the AWS
Toolkit extension. CDK diagnostics and CodeLens appear automatically when you open a CDK project.

What you get:

* Diagnostics — validation violations appear as warnings/errors on the line of code that created the offending construct
* CodeLens — each construct shows the CloudFormation resources it produces (e.g. "3 resources: Bucket, BucketPolicy, Key"). Clicking the lens
  navigates to the resource's definition in the synthesized template; when a construct produces multiple resources, a picker lets the user choose
  which one to open.
* Hover — hover over a construct line to see its logical ID, resource type, and template file, and call hierarchy.  When a construct produces multiple
  resources, all are listed with links to their template definitions.
* Quick fixes — suppressable violations offer a one-click fix to insert `Validations.of(construct).acknowledge(...)`. Actual fixes (e.g., adding
  encryption, scoping IAM policies) are planned as a future feature, with AI-assisted generation for complex fixes.

Note: Source-linked features (diagnostics on specific lines, CodeLens, hover) require valid stack traces, which are currently only available for
TypeScript CDK apps. Non-TypeScript apps still receive construct-to-resource data in the web explorer.

#### AWS Toolkit for VS Code

The CDK LSP is automatically installed as part of the AWS Toolkit extension for VS Code. No additional setup is required, simply open a CDK project
and diagnostics appear immediately.

#### AI Agent Integration

In Claude Code, install the CDK LSP plugin or add to your `.lsp.json`:

```
`{
  "cdk-lsp": {
    "command": "cdk lsp",
    "extensionToLanguage": { ".ts": "typescript", ".py": "python", ".java": "java" },
    "transport": "stdio",
    "initializationOptions": { "applicationDir": "${CLAUDE_PROJECT_DIR}" }
  }
}
`
```

The agent receives diagnostics automatically after every file change, with no manual invocation needed.

In any LSP-capable editor, simply point your LSP client at `cdk lsp` over stdio. The server accepts an `applicationDir` initialization option pointing
to your CDK project root.
* * *

```
`[ ] Signed-off by API Bar Raiser @xxxxx
`
```

## Public FAQ

### What are we launching today?

Two complementary tools for CDK developers: a web explorer (`cdk explore`) that visualizes the three-way relationship between CDK source code, the
construct tree, and CloudFormation templates; and an LSP server that surfaces validation diagnostics, construct-to-resource mappings, and quick fixes
directly in your editor or AI coding agent.

### Why should I use this feature?

If you've ever:

* Deployed a CDK app and been surprised by what resources it created
* Forgotten to run `cdk synth` and only discovered a validation error at deploy time
* Had to repeatedly run `cdk synth` to check for validation errors while iterating on code
* Struggled to trace from a CloudFormation error back to the CDK code that caused it

These tools close that gap. The explorer gives you a visual map of your entire app. The LSP gives you immediate feedback while writing code without
deploying, without credentials, and without leaving your editor.

### Do I need AWS credentials?

No. Both tools work entirely offline by reading the synthesized cloud assembly (`cdk.out/`).  

Note: AWS credentials can be used via the Toolkit integration but are not required for any current functionality of this feature.

### Which languages are supported?

The core data model is language-agnostic: it reads the synthesized cloud assembly (`cdk.out/`), which any CDK-supported language produces. However,
source-location-linked features (diagnostics on specific lines, CodeLens on construct lines) require valid stack traces, which CDK only records
reliably for TypeScript apps.

For Python, Java, C#, and Go apps, violation data and construct-to-resource mappings are surfaced in the Web Explorer (as construct tree annotations),
and are surfaced in the Problems panel, but without line level precision, since source locations cannot be resolved. Non-TypeScript LSP diagnostic
support is a planned post-launch extension.

### What do I get from the CDK LSP that I can't get from my existing language server?

Your TypeScript/existing language server gives you instant type errors; the CDK LSP gives you infrastructure validation after synthesis, like policy
violations, construct-to-resource mappings, and source-linked deployment warnings. They run alongside each other and serve different feedback loops at
different timescales.

### Does this work with AI coding agents?

Yes. Any LSP-capable agent can use the CDK LSP by pointing its config at the server binary, with no custom integration needed (see [claude
docs](https://code.claude.com/docs/en/plugins-reference#lsp-servers), as an example). Once connected, the agent benefits over raw CLI invocation
because:

* Diagnostics arrive automatically after every edit with no invocation needed
* Source-linked violations let the agent jump directly to the line that needs a fix

## Internal FAQ

### Why are we doing this?

CDK apps are complex, and it is often difficult to visualize the connections between your resources, and to debug, especially customers write
high-level CDK code (L2/L3 constructs), but what actually gets created (CloudFormation resources) are hidden behind layers of abstraction and are not
clearly matched 1-to-1 with the CDK code that created them. This creates three concrete problems:

* Customers can't see what their code creates. A single line like `new lambda.Function(this, 'Fn', { runtime, handler, code })`produces two
  CloudFormation resources, including an IAM execution role the customer never explicitly defined.  Customers don't discover this until they read the
  synthesized template or deploy and inspect the stack. The construct tree hierarchy is not exposed in any interactive way.
* Validation feedback requires manual invocation. Policy violations, invalid configurations, and validation errors are surfaced by `cdk synth`, but
  only when the developer remembers to run it. There is no continuous feedback during development — developers must break their flow to explicitly
  invoke synthesis and parse terminal output..
* Debugging requires jumping between disconnected tools. When something goes wrong, customers must manually trace from their CDK source code to the
  synthesized CloudFormation template to the deployed resource in the AWS console, which is not always clear. There is no single view that shows these
  connections.

With the LSP Server and Web Explorer, a customer can:

* Open their CDK project in VSCode and immediately see inline warnings for (common) violations that would fail deployment
* Click a construct in their code and see exactly which CloudFormation resources it produces
* Launch `cdk explore` from the CLI and visually navigate the three-way relationship between their code, their construct tree, and their
  CloudFormation template
* Click a construct in the explorer and see the corresponding CloudFormation resources it produces and the source code that created it

### Why should we *not* do this?

**Why build both an LSP server and a web interface?** Maintaining two UI surfaces adds complexity. However, the two tools serve fundamentally
different use cases: the LSP provides a tight inline feedback loop while writing code (violations appear as you type, CodeLens shows resource mappings
without leaving your editor), while the web explorer provides a full-app visual map for investigation and debugging (navigating the construct tree,
tracing connections across stacks). The shared core means the incremental cost of the second surface is low.  The data model, synth triggering, and
source location resolution are implemented once and consumed by both.

Additionally, the web explorer is IDE-agnostic and accessible to all CDK customers regardless of their editor. Offering both tools means no customer
is left out.

**Doesn't** **`cdk validate`** **already do this?** There is overlap with `cdk validate --json`, which surfaces validation violations as structured
output. However, `cdk validate` is a fire-and-forget CLI command; it outputs a report but does not integrate into the editing experience. The LSP
improves on this because:

* It provides richer data beyond violations: construct-to-resource mappings, source locations, and property metadata that `cdk validate` does not
  expose
* It integrates into your editor; violations appear as inline warnings on the line that created the offending construct, which is a cleaner UI for
  human developers
* It gives a persistent feedback loop rather than a point-in-time snapshot

The web explorer adds visual, navigable context that a flat JSON report cannot provide — clicking through the construct tree to see what a line of
code produces is qualitatively different from reading a validation report.

### What is the technical solution (design) of this feature?

We are building two complementary tools; an LSP server and a web explorer, that share a core library and solve these problems from different angles.

The LSP gives customers a tight feedback loop while writing code, while the web explorer gives customers a visual map of their entire app when
investigating or debugging. Together, they close the abstraction gap explained above.

The web explorer is launchable from the CDK CLI, which is IDE-agnostic and accessible to all customers. The LSP integrates into VSCode via the AWS
Toolkit plugin, and the Toolkit's existing CDK tree view is enhanced with source-linking and violation annotations.

Functionality will be built as new packages here: https://github.com/aws/aws-cdk-cli/tree/main/packages

The system consists of four components:

* **Shared core (`@aws-cdk/cloud-assembly-api`):** a library that parses the cloud assembly and produces a typed model of the construct tree, source
  locations, and violations
* **LSP server (`cdk lsp`):** a persistent process that embeds the shared core and exposes its data through the Language Server Protocol over stdio.
  Owns file watching, synth triggering, and caching.
* **Web explorer (`cdk explore`):** a local HTTP server and browser SPA. Spawns the LSP as a child process and queries it over JSON-RPC, then serves
  data to the browser via HTTP and SSE.
* **VSCode extension:** an AWS Toolkit integration that spawns `cdk lsp` and connects as a standard LSP client

**Cloud assembly as the data layer**
The LSP server reads from the cloud assembly (`cdk.out/`) produced by `cdk synth`. This gives it a consistent, offline data source with no credentials
or network calls required. The shared core (embedded in the LSP) parses four files:

* **`tree.json`** — construct tree hierarchy and construct-to-resource mappings
* **`manifest.json`** — stack enumeration, inter-stack dependencies, and asset information
* **`*.metadata.json`** — source locations (stack traces captured at construct creation time), enabling the LSP to map resources back to the exact
  line of code that created them
* **`policy-validation-report.json`** — offline validation results (invalid configurations, deprecated runtimes, security issues, best practice
  violations) produced during synthesis with no extra setup

### Is this a breaking change?

No. This introduces new packages and a new CLI command. No existing APIs or behaviors are modified.

### What alternative solutions did you consider?

We considered the following alternatives:

**Online validation as a primary data source****.** We chose offline validation as the foundation because it keeps the tools credential-free, which
means the LSP works standalone in any editor without a plugin or AWS account setup. Online validation was ruled out for v1 because:

* It introduces a credential requirement that the tools otherwise don't have
* It's slower (create change set → poll → read events → delete change set)
* It can only validate against a specific AWS account/region, which may not match the user's intent during development

Offline validation runs locally against the synthesized CloudFormation template during `cdk synth` with no credentials or network calls required. It
catches the majority of actionable violations, like invalid resource types, deprecated runtimes, invalid Fargate CPU/memory combinations, security
issues, and best practice violations. Results are always available in `cdk.out/policy-validation-report.json` with no extra configuration. Online
validation may be offered in the future.

**Using `cdk watch` as-is for re-synthesis****.** `cdk watch` monitors files and re-synthesizes, but it is designed for deployment workflows — it
triggers `cdk deploy --hotswap` with no synth-only mode. Rather than reimplementing file watching from scratch, we decouple the synth-triggering and
file-monitoring logic from `cdk watch`'s deploy step and reuse it directly. The LSP gets live-reload behavior without deploying anything or requiring
credentials.

**Building only the web explorer without an LSP.** A simpler project scope, but would miss the inline editing experience entirely, and lose the
ability to interface with AI agents. Developers would have to context-switch between their editor and a browser to see violations. The LSP provides
the tighter feedback loop that catches issues before the user even thinks to check.

#### Alternatives for the VSCode Plugin

**Embedding the web explorer as a VS Code webview panel.** We considered embedding the same three-panel web explorer directly into VS Code as a
webview, which would let VS Code users access the full explorer without opening a browser. This would maximize code reuse the same code that powers
`cdk explore` would load inside a VS Code panel. We rejected this approach for three reasons:

* **Read-only code panels inside a code editor are confusing.** The explorer's source panel and template panel display read-only, syntax-highlighted
  code. Inside VS Code, this creates a panel that *looks like* an editor but can't be edited, which is unnatural, and could be disorienting rather
  than helpful.
* **Faithful UX replication is impractical.** For the embedded explorer to not feel out of place, it would need to match VS Code's syntax highlighting
  themes (which are user-configurable), respond to font size changes, and match the editor's scrolling and selection behaviors. Achieving this parity
  is significant ongoing work, and if we support another IDE (JetBrains, Neovim), the VS Code-optimized webview would feel entirely foreign there.
* **It does not add novel value over `cdk explore`.** The browser-based explorer already provides the full three-panel experience. Embedding it inside
  VS Code saves the user a window-switch to their browser, but does not enable any interaction that wasn't already possible.

**Building a separate, native VS Code UI from scratch.** We also considered building a VS Code-native experience entirely separate from the web
explorer using native TreeViews, editor tabs, and VS Code APIs rather than web technologies. This would produce the most integrated experience but at
high cost: the three-panel linked navigation would need to be reimplemented using VS Code's constrained extension APIs, and code would not be shared
with the CLI explorer. The development effort would roughly double the project scope for a single IDE.

**Chosen approach: enhance the existing AWS Toolkit CDK tree with source linking and violations.** Instead of embedding or rebuilding the explorer, we
extend the CDK section already present in the AWS Toolkit sidebar. The existing tree view shows the construct hierarchy; we enhance it to:

* Navigate to source code when a construct is clicked (using the source location data from the shared core)
* Display validation violations as tree annotations (icons/badges) with click-to-navigate behavior
* Show construct-to-resource mappings as child nodes or tooltip metadata

This approach uses native VS Code UI (auto-themed, searchable, accessible), integrates with the user's existing editing workflow (clicking a construct
opens the real file in the editor, not a read-only copy), and avoids the webview maintenance burden. The LSP provides inline diagnostics and CodeLens
on the code itself. Together, the enhanced tree + LSP give VS Code users the same information the web explorer provides, but delivered through native
IDE patterns rather than an embedded web application.

### What are the drawbacks of this solution?

* **Synth latency as a bottleneck.** The CDK LSP's data comes from the cloud assembly, which requires running the entire CDK app. For large apps,
  synthesis can take tens of seconds. This means feedback is not instant — the CDK LSP operates on a fundamentally different timescale than a
  TypeScript or Python language server. Users with very large apps may find auto-synth too slow to be useful.
* **Maintenance surface area.** Shipping an LSP server, a web app, a shared core library, and a VSCode extension integration means four components to
  maintain, test, and version. Bugs or regressions in any one component affect the others.
* **Dependency on cloud assembly stability.** The tools read `tree.json`, `manifest.json`, and `policy-validation-report.json`. The validation report
  schema is not yet part of the versioned cloud assembly schema, which adds risk.
* **Adoption risk.** CDK developers have existing workflows. If the tools are too slow, too noisy, or produce stale results, developers may ignore
  them.

### What is the high-level project plan?

The project is delivered in three phases:

**Phase 1: Shared core and LSP server.** Build the shared core library that parses `cdk.out/` and produces the typed data model (construct tree,
source locations, violations). Implement the LSP server on top of it with diagnostics (violations mapped to source lines) and CodeLens
(construct-to-resource mappings). Auto-synth triggering lives in the shared core. By end of Phase 1, a developer can open a CDK project in VSCode and
see inline violation warnings and resource counts on construct lines.

**Phase 2: Web explorer.** Build the `cdk explore` CLI command, HTTP server, and browser SPA. Implement the three-panel layout (tree, template,
source) with bidirectional linked navigation. The violations panel surfaces the same data the LSP shows, but in a visual, browsable form. By end of
Phase 2, a developer can run `cdk explore` and visually navigate their entire app's structure.

**Phase 3: AWS Toolkit integration.** Integrate the LSP client into the AWS Toolkit VSCode extension.  Enhance the AWS Toolkit CDK tree view with
source-linking and violation annotations. By end of Phase 3, VS Code users can click constructs to navigate to source, see violations as tree
annotations, and access construct-to-resource mappings natively.

#### Features

1. [P0] Construct tree parsing and navigation
2. [P0] Source location resolution
3. [P0] CodeLens: construct → CloudFormation resource mapping
4. [P0] LSP Diagnostics: validation violations at source line
5. [P0] Three-panel linked navigation: tree ↔ template ↔ source
6. [P0] `cdk explore` CLI command entry point
7. [P1] Auto-synth on file save
8. [P1] Diagnostic staleness: fade to Hint on edit, restore on re-synth
9. [P1] Web explorer updates without reload
10. [P1] Staleness indicator + "Synth Now" button
11. [P2] Hover: logical ID, resource type, template file
12. [P2] Document Symbols: construct tree in editor Outline view
13. [P2] Inlay Hints: logical IDs inline
14. [P2] Quick Fix: acknowledge/suppress violations
15. [P3] VS Code extension: LSP client (spawns cdk lsp on project detection)
16. [P3] VS Code extension: Enhanced CDK tree
17. [P4] Synth progress notifications
18. [P4] Quick Fixes: (AI-powered) actual fixes (add encryption, scope IAM, etc.)
19. [P4] Error states, performance tuning

### Are there any open issues that need to be addressed later?

* **AWS Toolkit integration.** Embedding the LSP client and enhancing the existing CDK view into the AWS Toolkit VSCode extension requires
  coordination with the AWS Toolkit team. Their contribution guidelines, release cadence, and extension architecture may constrain how the integration
  is built.
* **Validation report schema stabilization.** The `policy-validation-report.json` schema is not yet part of the versioned cloud assembly schema
  (`cdklabs/cloud-assembly-schema`). This is pending and expected to be resolved by project launch.

## Appendix

Proofs of concept:

* Web app: https://github.com/otaviomacedo/webapp-experiment
* Web App + LSP with shared core: https://github.com/ShadowCat567/webapp-lspsplit-experiment

RFC for `cdk validate` command which will be used by LSP: https://github.com/aws/aws-cdk-rfcs/pull/899

Repo for AWS Toolkit plugin into which this will be integrated: https://github.com/aws/aws-toolkit-vscode

CloudFormation LSP: https://github.com/aws-cloudformation/cloudformation-languageserver

ClaudeCode Plugins reference: https://code.claude.com/docs/en/plugins-reference#lsp-servers

Articles on LSPs and Agents:
https://medium.com/@vinodh.thiagarajan/lsp-the-protocol-your-ide-uses-every-day-and-now-your-ai-agent-does-too-19e74ca26ace
 https://tech-talk.the-experts.nl/give-your-ai-coding-agent-eyes-how-lsp-integration-transform-coding-agents-4ccae8444929
