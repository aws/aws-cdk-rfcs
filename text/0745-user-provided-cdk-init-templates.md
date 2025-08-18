# RFC: User-Provided `cdk init` Templates

Original Author(s):: @rohang9000

Tracking Issue: [#745](https://github.com/aws/aws-cdk-rfcs/issues/745)

API Bar Raiser: @iliapolo

***
Organizations and teams need a way to initialize CDK projects in the CLI with
specific configurations through custom templates they create and maintain. This
will also allow AWS to vend and manage templates for specific use cases.

## Working Backwards

This section of the RFC addresses both CDK developers and the newly introduced
role of template authors.

### CHANGELOG

```text
feat(cli): user-provided cdk init templates
```

### Updated `cdk init` README

#### `cdk init`

The `cdk init` command creates a new CDK project from built-in or custom
templates. It sets up the necessary files and directories to organize your CDK
code, including project definitions, constructs, and stacks for applications.

#### **Initializing Your First CDK Project**

Let's begin by making and navigating to a new project directory:

```bash
mkdir my-first-project
cd my-first-project
```

Next, let's initialize the project in the CDK language of your choice. CDK
provides three built-in templates to help you get started quickly:

##### For a basic application

```bash
cdk init app --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

This creates a basic deployable CDK application with an empty stack.

##### For building reusable constructs

```bash
cdk init lib --language=typescript
```

This creates a construct library template for building reusable constructs.

##### For exploring CDK with examples

```bash
cdk init sample-app --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

This creates a CDK app pre-populated with examples demonstrating common AWS
services and best practices.

Congratulations, you have now initialized your first starter CDK project!

#### **Working with Custom Templates**

To initialize a project with pre-configured services, file structures, or best
practices, you can run `cdk init` using custom templates from Git repositories
or NPM packages. A single Git repository or NPM package can contain multiple CDK
templates for different use cases. Each template is organized in its own
directory, with language-specific subdirectories inside.

##### Getting Custom Templates From GitHub

Let’s walk through an example of initializing a project using a GitHub repository named `my-cdk-templates`, which contains multiple custom templates. 
Here's what the repository structure might look like:

```text
my-cdk-templates/                  # Repository root
├── my-custom-template/            # First template (the one we'll use)
│   └── typescript/                # Language subdirectory
│       ├── package.json
│       ├── cdk.json               # CDK project configuration - specifies how to run the app and stores context/feature flags
│       ├── bin/
│       │   └── app.ts             # App entry file
│       ├── lib/
│       │   └── stack.ts           # Stack class file
│       ├── test/
│       │   └── stack.test.ts      # Test file
│       ├── tsconfig.json
│       ├── .gitignore
│       └── README.md
├── web-app-template/              # Second template
│   ├── typescript/
│   └── python/
└── api-template/                  # Third template
    ├── typescript/
    └── java/
```

Start by creating your new project directory and navigating to it:

```bash
mkdir custom-template-project
cd custom-template-project
```

Since the repository contains multiple templates, use `--template-path` to
specify one and initialize your project:

```bash
cdk init --from-github username/my-cdk-templates --template-path my-custom-template --language=typescript
```

Here's what happened when `cdk init` was run:

1. The template files were copied to your project directory
2. A Git repository was initialized with an initial commit
3. Dependencies were installed as needed (npm install for JS/TS, mvn package
   for Java, virtual env for Python)

Your new project's root now looks like:

```text
custom-template-project/           # Project directory name
├── package.json                   # Copied folders and files from template
├── cdk.json
├── bin/
│   └── app.ts
├── lib/
│   └── stack.ts
├── test/
│   └── stack.test.ts
├── tsconfig.json
├── .gitignore
└── README.md
```

Now you're ready to continue coding in your project from a more specific state!

##### Getting Custom Templates From Other Git Repositories

You can pull custom templates from any other Git Repository (GitLab,
Bitbucket, etc.) type with the options below.

Select a specific template from a multi-template Git repository:

```bash
cdk init --from-git-url [URL] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the Git repository contains only one template and has language
directories at the repository root, you don't need to specify `--template-path`:

```bash
cdk init --from-git-url [URL] --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the template contains only one language directory, you don't need to specify `--language`:

```bash
cdk init --from-git-url [URL] --template-path ./template-name
```

Select a template from a specific Git branch/tag/commit by specifying the `--ref`:

```bash
cdk init --from-git-url [URL] --ref [tag/commit/branch] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**Note**: Both public and private Git repositories are supported. Private
repositories work through your existing Git authentication (SSH keys, personal
access tokens, or credential helpers) without requiring additional setup.

##### Getting Custom Templates From NPM Packages

Alternatively, pull a custom template from any NPM package (on npmjs.com or
any registry that hits NPM endpoint) with the options below.

Select a specific template from an NPM package with multiple templates:

```bash
cdk init --from-npm [package-name] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the NPM package contains only one template and has language
directories at the package root, you don't need to specify `--template-path`:

```bash
cdk init --from-npm [package-name] --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the template contains only one language directory, you don't need to specify `--language`:

```bash
cdk init --from-npm [package-name] --template-path ./template-name
```

Select a template from a specific NPM package version by specifying the `--version`:

```bash
cdk init --from-npm [package-name] --version [version] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**Note**: Both public and private NPM registries are supported. Private NPM
registries are supported through your existing NPM configuration (.npmrc file,
environment variables, or npm config settings) without requiring additional
setup.

#### **More Advanced Project Initialization Options**

Skip git initialization and dependency installation by including
`--generate-only`:

```bash
cdk init app --language=typescript --generate-only
cdk init --from-git-url https://github.com/user/my-template.git --generate-only
```

Use a specific CDK library version (built-in templates only) by specifying the
`--lib-version`:

```bash
cdk init app --language=typescript --lib-version 2.100.0
```

#### **CLI Public Template Registry**

The CDK CLI includes a vetted registry of public AWS templates that provide
pre-configured infrastructure patterns for specific use cases. To see all
available templates to initialize a CDK project with, including those in the
public registry, run `cdk init --list`:

```text
Built-in templates:
* app: CDK Application Template
   └─ cdk init app \
      --language=[typescript|javascript|python|java|csharp|fsharp|go]
* lib: CDK Construct Library Template
   └─ cdk init lib --language=typescript
* sample-app: Example CDK Application with constructs
   └─ cdk init sample-app \
      --language=[typescript|javascript|python|java|csharp|fsharp|go]

Public Template Registry:
* Initialize a project from a template:
   └─ cdk init --from-<sourceType> [sourceLocation] \
      --template-path [PATH] --language=[supportedLanguage]

┌──────────────┬──────────────────────────┬───────────────────┬────────┬───────────────────┬─────────────────────────────────────────────────────────────────┐
│ Author       | Repository/Package       │ Template Path     │ Type   │ Description       | Initialization Command                                          │
├──────────────┼──────────────────────────┼───────────────────┼────────┼───────────────────┼─────────────────────────────────────────────────────────────────┤
│ rohang9000   | sample-git-repo          │ NestedTemplate/   | GitHub | Same below sample | cdk init --from-github rohang9000/sample-git-repo               |
|              |                          | Samples           |        | templates nested  | --template-path NestedTemplate/Samples                          |
|              |                          |                   |        | in subdirectory   | --language=[java|javascript|python|typescript]                  |
├──────────────┼──────────────────────────┼───────────────────┼────────┼───────────────────┼─────────────────────────────────────────────────────────────────┤
│ rohang9000   | sample-git-repo          │ Samples           | GitHub | Sample template   | cdk init --from-github rohang9000/sample-git-repo               |
|              |                          |                   |        | for new authors   | --template-path Samples                                         |
|              |                          |                   |        | to reference      | --language=[csharp|fsharp|go|java|javascript|python|typescript] |
├──────────────┼──────────────────────────┼───────────────────┼────────┼───────────────────┼─────────────────────────────────────────────────────────────────┤
│ rohang9000   | sample-git-repo          │ Tutorials/cdk-    | GitHub | Completed CDK     | cdk init --from-github rohang9000/sample-git-repo               |
|              |                          | hello-world-      |        | Hello World App   | --template-path Tutorials/cdk-hello-world-template              |
|              |                          | template          |        | Application       | --language=[csharp|go|java|javascript|python|typescript]        |
├──────────────┼──────────────────────────┼───────────────────┼────────┼───────────────────┼─────────────────────────────────────────────────────────────────┤
│ rupta        | custom-cdk-init-template │ my-template       │ NPM    │ Custom CDK init   | cdk init --from-npm custom-cdk-init-template                    |
│              |                          │                   │        │ template          | --template-path my-template                                     │
│              |                          │                   │        │                   | --language=[python][typescript]                                 │
└──────────────┴──────────────────────────┴───────────────────┴────────┴───────────────────┴─────────────────────────────────────────────────────────────────┘
```

### Authoring Custom CDK Templates

A valid custom template must contain a subdirectory for a supported CDK
language and at least one file inside it matching that language. You can
reference [custom app template implementations in all CDK Languages](https://github.com/rohang9000/sample-git-repo/tree/main/Samples) here.

#### Custom Template Schema

```text
my-custom-app-template/
└── [language-name]/             # REQUIRED: CDK language subdirectory
    └── [file-name].[ext]        # REQUIRED: At least one file matching
                                 # the language type in language subdirectory
```

##### Language-Specific Substitutions

* [language-name]: csharp, fsharp, go, java, javascript, python, typescript
* [ext]: .cs, .fs, .go, .java, .js, .py, .ts

#### Testing Your Custom Templates

After creating your custom templates, test them locally to ensure the project
structure and content meet your expectations before publishing them to a Git
repository or NPM package. A project can be initialized directly from a
template stored on your local filesystem.

To do this, pass in the directory path for your template and run:

```bash
cdk init --from-path ./my-cdk-template --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the template contains only one language directory, you don't need to specify `--language`:

```bash
cdk init --from-path ./my-cdk-template
```

If you've created a multi-template repository setup locally, you can also fully test it by 
specifying templates to initialize from using `--template-path`:

```bash
cdk init --from-path ./cdk-templates --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

This allows you to verify that all expected files and directories are copied
correctly.

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied
to the RFC pull request):

```text
[ ] Signed-off by API Bar Raiser @xxxxx
```

***

## Public FAQ

### What are we launching today?

A new feature in the AWS CDK CLI that enables users to use custom templates
from local files, Git repositories, or NPM packages for project initialization.
This feature also provides static discovery for public templates created and
maintained by AWS service teams.

### Why should I use this feature?

#### For CDK Developers

* **Enterprise standardization:** Initialize projects with your organization's
  security policies, naming conventions, and architectural patterns
  pre-configured
* **Reduced project setup time:** Start coding immediately with automatically
  installed project dependencies and an initialized Git repository to track
  local changes
* **Service-specific templates:** Use AWS service team templates optimized for
  specific use cases (e.g., CI/CD pipelines)

#### For Template Authors

* **Community reach:** Share best practices with the broader CDK community
  through Git Repositories or NPM Packages

#### Real-world use cases

* An enterprise creates templates with pre-configured compliance and security
  settings for its developers
* AWS service teams provide optimized templates for their services
* Open source projects offer CDK templates for popular application architectures

### Are custom templates required to be “synth-able”?

No, custom templates are not required to be “synth-able”. Templates generally fall under two categories: libraries, which 
create reusable constructs, and apps, which create deployable infrastructure. Library templates do not synthesize, but are 
still valid custom template types. As such, `cdk init` does not validate that a CDK stack is defined in a custom template and
does not enforce a successful `cdk synth` in order to initialize a new CDK project.

### Can I publish dynamic custom templates to a Git repository or NPM package to be used by `cdk init`?

No, dynamic templates are not directly processed by the CDK CLI. Template
authors who want to have template variations can use template generation tools
(ie. Projen, Yeoman, Cookiecutter, etc.) to develop static templates which can
be published and used by a CDK user.

## Internal FAQ

### Why are we doing this?

Currently, `cdk init` only supports built-in CDK templates, limiting developers to basic project structures. Teams need expanded CLI
support for custom templates that include their organization's best practices, pre-configured resources, and standardized project layouts.

This feature offers several benefits:

* **Improved CDK CLI initialization experience for users**
  * Enables custom project initialization from any source (Git, NPM, local) using a familiar command
* **Improved discovery for AWS service team templates with low additional maintenance for the CDK team**
  * Today: Developers must search GitHub, NPM, or internal docs to find example CDK project structures,
    without any guarantee of template quality or compatibility. AWS service team templates, if they exist,
    are typically hidden in separate repos, blog posts, or sample code folders and are not surfaced in the CLI.
  * With this proposal: The CLI can surface a curated Public Template Registry with a list of known, validated
    templates. Users can browse available templates directly from the terminal, then initialize them immediately
    with a single command. This improves visibility of AWS-authored templates without the CDK team having to
    maintain their content, only the registry metadata.
* **Increased flexibility for enterprise users**
  * Organizations can host private or public templates and use them with the `cdk init` command as long as users have access
* **Easier template distribution for template authors**
  * No need to wait for approval from the CDK team — authors can publish directly to Git or NPM

### Why should we *not* do this?

#### Existing alternatives already enable similar workflows

Customers can already achieve a large portion of the functionality proposed here manually by using Linux commands to 
first clone the custom template repository and copy the relevant template files into their CDK project directory

```bash
git clone https://github.com/codepipeline/cdk-templates
cp -r cdk-templates/LambdaInvoke/typescript .
```

Once the template files are in place, the process would then continue with initializing a new Git repository 
to track changes locally, adding all files to staging, making an initial commit, and installing the necessary 
dependencies so the project is ready for customization and deployment:

```bash
git init
git add .
git commit -m "Initial commit from CDK template"
npm install
```

* Pros:
  * Zero cost to the CDK team while preserving low user burden.
* Cons:
  * User manually runs six commands instead of one `cdk init` command to achieve same result
  * Outside of CDK CLI experience
  * No telemetry on custom template usage
  * Users need to manually discover AWS vetted templates

#### Quality and support for custom templates may be inconsistent

* Since templates are authored and maintained outside of the CDK team, quality can vary depending on the author.
* The CLI can validate only basic file structure, not functional correctness of a CDK project

### What is the technical solution (design) of this feature?

Extend the `cdk init` command to support custom templates from various source options while 
maintaining the same user experience and validation standards as built-in templates.

**Key Components:**

#### Support for Various Template Source Options (local/Git repo/NPM package)

* Use CLI flags `--from-path`, `--from-git-url`, `--from-github`, or `--from-npm` to specify custom template sources
* Implement template loaders for each source type that download/copy templates and normalize them into a common format
* Support `--template-path` for specifying nested subdirectories within Git repositories or NPM packages
* Support `--ref` for Git branches/tags/commits and `--version` for NPM package versions
* Preserve existing CLI option `--generate-only` with custom templates
* Incorporate into the existing code path:
  * Ensure target directory is empty to prevent overwriting existing files
  * Check that language argument specified is a valid CDK language (TypeScript, JavaScript, Python, Java, C#, F#, or Go)
  * Initialize new Git repository in project directory
  * Create initial Git commit with all template files
* Validate template structure matches required schema in "Authoring Custom CDK Templates" document before installation
  * At least one language subdirectory contained in template root (matched against known CDK languages)
  * At least one file of the same language type in that language subdirectory

#### Public Template Discovery

* Implement statically updated registry of curated public template repositories and NPM packages
* Extend `cdk init --list` to display public registry templates in a formatted table with author,
  repository/package name, template path, type, brief template description, and command usage information.

#### Static Management Process for Public Template Registry

When internal AWS teams want to add a template source to the public registry, they must provide the following metadata:

```typescript
{
   author: string;                               // Organization, team, or user's name as it appears in Git repository or NPM package
   source: string;                               // GitHub shorthand, Git URL, or NPM package name
   sourceDescription: string;                    // Brief description of template repository or package functionality
   sourceType: 'github' | 'git' | 'npm';         // Source type (GitHub, Git, NPM)
   templates: CustomTemplate[];                  // List of templates provided by this source
}   
```

Where template is a struct like the below example that can easily be extended:

```typescript
interface CustomTemplate {
  path: string;                                  // Relative path of the template in the repository/package
  description: string;                           // Short description of the template
  languages: string[];                           // Supported CDK languages
}
```

Template Submission Process:

1. Internal AWS team creates and tests templates using `cdk init --from-git-url <repo>`, `cdk init --from-npm <package>`,
   or `cdk init --from-path <path>`
2. Internal AWS team writes a README file for custom template with usage instructions and examples
3. Team contacts CDK team with template source and required metadata
4. CDK Team reviews custom templates in repository or package to ensure community benefit, conformity to custom
   template schema, clear README file, and that it is well tested
5. If approved, CDK team adds entry to PUBLIC_TEMPLATE_REGISTRY in template-registry.ts. If not approved, the CDK team
   provides feedback for revision to internal AWS team

### Is this a breaking change?

No, the new feature does not affect existing functionality for creating CDK projects using built-in template options.

### What alternative solutions did you consider?

#### Dynamic Template Substitution

The selected approach does not provide a way for template authors to use dynamic information that is known only at 
initialization time. The following approaches were considered as a way to provide this functionality. However, after 
doing customer research, the CDK team decided on the RFC's proposed solution of the `cdk init` command only handling 
static templates. If in the future, a customer need is identified for the `cdk init` command to handle dynamic templating 
directly, this can be addressed as a potential enhancement.

##### Current Placeholder Approach For Built-In Templates

The current placeholder approach for built-in templates is a format for authors to use dynamic information 
inside templates. Authors write files using placeholders like %name.PascalCased%, which are replaced 
automatically during `cdk init` based on project context.

* Pros:
  * Proven in production for built-in templates with minimal maintenance
  * Requires no setup or tooling for users
  * Entire substitution logic handled within CDK and is not reliant on any external dependencies for this process
* Cons:
  * Very limited template generation capabilities - limited to initialization directory and library version
  * Does not provide interactive prompts or advanced templating logic like Yeoman, Projen, or Cookiecutter
  * Exposing this engine could lead the CDK team to develop a full blown custom templating language, which is not
    their forte and what they should spend their time on

This approach is proven and low-maintenance, but it can’t express richer scaffolding (conditional files, prompts, 
multi-language branches) without expanding CDK’s placeholder engine into a full templating system. The proposed solution 
keeps the CLI simple while enabling that flexibility via static templates from any source, letting authors use any dynamic 
tool they prefer without locking CDK into a bespoke templating language.

##### The `npm-init` Command

`npm init` is a command used to scaffold new Node.js projects. For users, it walks through prompts to create a package.json.
For template authors, it allows publishing an npm package named `create-<name>`, which users can invoke using 
`npm init <name>` to generate projects based on custom logic.

* Pros:
  * Streamlines creating `package.json`, making it quicker to publish templates as NPM packages
  * Most CDK users are familiar with running NPM commands and its ecosystem
* Cons:
  * No multi-language support (important since CDK is supported in 7 languages)
  * Only generates package.json, doesn’t solve the actual template generation or substitution

`npm init` is Node-centric and primarily scaffolds `package.json`, so it doesn’t meet CDK’s multi-language requirements or 
broader project-structure needs. The proposed solution is language-agnostic and source-agnostic (Git/NPM/local), delivering 
a consistent `cdk init` UX across all supported languages while still letting authors choose their own tooling.

##### Yeoman Generator

Yeoman Generator is a scaffolding tool used to automate the setup of new projects by generating files and directory structures 
from templates. Users run `yo <generator-name>` and answer interactive prompts that guide project generation (see Appendix A 
for a sample dialog). Template authors write JavaScript-based generators (named `generator-<name>`) that define prompts and
dynamically control which files are generated and how they’re customized (See Appendix B for a minimal example generator).

Template authors typically publish generators as public NPM packages (e.g., `generator-mytemplate`) so they can be installed 
via `npm install -g generator-mytemplate` or invoked directly with `yo mytemplate`. The `cdk init` command could detect or be 
configured to invoke a Yeoman generator by name, passing along parameters to skip prompts or prefill defaults. A single
generator can implement branching logic to scaffold different languages within the same codebase, using conditional file sets 
(`templates/python/**`, `templates/java/**`, etc.) and running the corresponding post-install commands for each language.

* Pros:
  * Enables advanced scaffolding logic (conditional file inclusion, dynamic file naming, and complex transformations) based on
    user input from interactive prompts to produce many variations of a template
  * Supports post-processing automation — after scaffolding, Yeoman generators can be written to automatically run
    language-appropriate dependency installation commands (e.g., `npm install` for JavaScript/TypeScript, `pip install` for
    Python, `mvn package` for Java, `dotnet restore` for C# and F#), initialize Git, and add license headers
* Cons:
  * Template authors must write JS-based generators (see a minimal example in Appendix B) instead of simple static file templates.
  * Relies on the Yeoman runtime and ecosystem so CDK loses control over some UX and its ability to provide new features
    to template authors is limited

While Yeoman offers strong scaffolding logic and built-in post-processing automation, adopting it as the default CDK template engine 
would couple our experience to an external runtime and ecosystem, reducing flexibility for future CLI features. The proposed solution 
retains those benefits for authors who choose Yeoman while allowing other authors to use any dynamic or manual approach, keeping CDK 
independent of a single tooling dependency.

##### Projen

Projen is a project configuration tool that defines all project settings, dependencies, and configuration files in a single TypeScript 
(or JavaScript) definition file (.projenrc.ts). Instead of manually editing generated files, users modify the Projen configuration, 
and Projen re-synthesizes the project structure.

Project types in Projen are implemented as subclasses of Project (or a language-specific base project) and can be published as NPM 
packages so others can install them and initialize new projects. The `cdk init` command could integrate with Projen by invoking 
`npx projen new <project-type>`, optionally passing parameters to skip prompts or apply CDK defaults.

Projen supports multi-language projects through specialized project types for Java, Python, C#, Go, and others, each with tailored 
file structures, dependency management, and post-processing automation. Authors can also define hybrid project types that generate 
multiple language components in a single repo.

A minimal example of a custom project type is shown in Appendix C.

* Pros:
  * Controlled and maintained by AWS so it is easier to add requested features.
  * Automates common setup tasks (such as linting, testing, dependency management, and publishing configurations) by generating them
    from a single Projen configuration file
* Cons:
  * Steep learning curve for template authors, who must understand Projen’s configuration model to create or modify templates.
  * By default, Projen regenerates files on every `pj synth`, so direct edits are lost; changes must be made in the config. A `--eject`
    option exists to remove the Projen dependency after initialization, preserving the generated files while removing Projen’s automation benefits.

Projen’s automation and multi-language support are compelling, but its `.projenrc`-driven model diverges from the direct-edit workflows many CDK 
users expect. The proposed solution retains those benefits for authors who choose Projen while allowing other authors to use any dynamic or 
manual approach, keeping CDK independent of a single tooling dependency.

##### CookieCutter

Cookiecutter is a CLI utility for creating projects from templates. It uses a folder structure with Jinja2 templating syntax ({{ placeholder }}) 
to define variable parts of files and filenames. Users run `cookiecutter <template-source>` and are prompted to provide values for placeholders. 
It then generates a project by rendering files with those values.

* Pros:
  * Works with any language or framework, making it well-suited for CDK's multi-language ecosystem
  * Template authors use expressions for variable substitution, conditional logic, and looping in both file content and filenames
  * Interactive automatically prompts users for input, enabling flexible template customization without extra scripting
  * Industry tested by many open source projects
  * Once the project is generated, no link to Cookiecutter remains (all files are static and editable)
* Cons:
  * It is a python package so users must install Cookiecutter via pip, which may not be intuitive for CDK developers

While Cookiecutter offers powerful templating features and language independence, its requirement to be installed as a Python package is a 
significant drawback that, for some, could be a deal-breaker. The proposed solution avoids introducing this dependency and keeps ownership 
and UX within `cdk init`, while still allowing authors who prefer Cookiecutter to generate static
templates and publish them for use with the same flow.

### What is the high-level project plan?

* Phase 1: Core functionality
  * Support for custom templates through local files, Git repositories, and NPM packages
  * Support for custom templates in all CDK languages (TypeScript, C#, F#, Go, Java, JavaScript, and Python)
  * Support for public and private Git repositories and NPM packages
  * Support for users to specify what branch/commit of repo or package version they want to pull templates from and if not specified then
    will use main branch/most recent commit or latest package version by default
  * Basic custom template validation which checks that template follows schema defined in "Authoring Custom Templates" RFC section
  * Develop unit and integration tests for each subfeature of core functionality

* Phase 2: Static discovery for custom templates through the Public Template Registry
  * Extend `cdk init --list` to display AWS service team templates in a formatted table (with author, repository/package name, template path,
    type, template description, and command usage fields)
    * Templates are maintained by internal AWS teams after being vetted by CDK team
    * Registry is maintained by CDK team
  * Work with internal AWS teams to create and add more templates to the CDK CLI registry
  * Implement ability to query registry for template sources an organization/author maintains, templates a source contains, and languages a
    template is supported in.

* Phase 3: Documentation, testing, and marketing
  * Publish official documentation ("Authoring Custom CDK Templates" section) to [https://docs.aws.amazon.com](https://docs.aws.amazon.com)
    for template authors to reference
  * Publish official documentation ("Updated `cdk init` README" section) to
    [https://github.com/aws/aws-cdk-cli/tree/main/packages/aws-cdk](https://github.com/aws/aws-cdk-cli/tree/main/packages/aws-cdk)
    for CDK users to reference
  * Author blog post and other marketing materials
    * Include benefits and example use cases of passing in custom templates through Local/Git/NPM
    * Include benefits and example use cases of selecting branch/commit/package version of a custom template

### Are there any future enhancements of this feature?

* Dynamic template discovery mechanism to browse all available public
  template beyond AWS service team templates that appear in statically
  maintained CLI Public Template Registry

## Appendix

### Appendix A - Example Yeoman Dialog

```bash
$ yo mytemplate
? Project name: my-service
? Language: Python
? Include CI/CD pipeline? Yes
? License: MIT
   create  README.md
   create  package.json
   create  src/handler.py
   create  tests/test_handler.py
   create  .gitignore
   run     pip install
   run     git init
   run     git add .
   run     git commit -m "Initial commit from template"
```

### Appendix B – Minimal Example of a Yeoman Generator

```bash
// generators/app/index.js
const Generator = require('yeoman-generator');

module.exports = class extends Generator {
  async prompting() {
    this.answers = await this.prompt([
      { type: 'input', name: 'name', message: 'Project name', default: 'my-app' },
      { type: 'list', name: 'language', message: 'Language', choices: ['Python', 'JavaScript'] }
    ]);
  }

  writing() {
    this.fs.copyTpl(
      this.templatePath(`${this.answers.language.toLowerCase()}/**`),
      this.destinationPath(),
      { name: this.answers.name }
    );
  }

  install() {
    if (this.answers.language === 'Python') {
      this.spawnCommand('pip', ['install', '-r', 'requirements.txt']);
    } else {
      this.npmInstall();
    }
  }
};
```

### Appendix C — Example Projen Project Type

1. Minimal project type definition (authored & published by a template author)

    ```bash
    // src/MyCdkProject.ts
    import { awscdk } from 'projen';
    
    export interface MyCdkProjectOptions extends awscdk.AwsCdkTypeScriptAppOptions {
      // Add any custom options here
    }
    
    export class MyCdkProject extends awscdk.AwsCdkTypeScriptApp {
      constructor(options: MyCdkProjectOptions) {
        super({
          cdkVersion: '2.120.0',
          defaultReleaseBranch: 'main',
          name: 'my-cdk-app',
          ...options,
        });
    
        // Example: add a default dependency
        this.addDeps('lodash');
    
        // Example: add a custom script
        this.addTask('deploy', {
          exec: 'cdk deploy',
        });
      }
    }
    ```

2. How an author publishes it

    ```bash
    npm init -y
    npm install projen
    # After writing src/MyCdkProject.ts and building
    npx tsc
    npm publish
    ```

3. How a user would consume it through `cdk init` command

    ```bash
    cdk init my-projen-package.MyCdkProject
    ```
