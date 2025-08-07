# RFC: User-Provided `cdk init` Templates

Original Author(s):: @rohang9000

Tracking Issue: [#745](https://github.com/aws/aws-cdk-rfcs/issues/745)

API Bar Raiser: @iliapolo

***
Organizations and teams need a way to initialize CDK projects in the CLI with specific configurations through custom templates they create and maintain. This will also allow AWS to vend and manage templates for specific use cases.

## Working Backwards

This section of the RFC addresses both CDK developers and the newly introduced role of template authors.

### CHANGELOG

```
feat(cli): user-provided cdk init templates
```



### Updated `cdk init` README

#### `cdk init`
The `cdk init` command creates a new CDK project from built-in or custom templates. It sets up the necessary files and directories to organize your CDK code, including project definitions, constructs, and stacks for applications.

#### **Initializing Your First CDK Project**
Let's begin by making and navigating to a new project directory:
```bash
$ mkdir my-first-project
$ cd my-first-project
```

Next, let's initialize the project in the CDK language of your choice. CDK provides three built-in templates to help you get started quickly:

##### For a basic application:
```
$ cdk init app --language=[csharp|fsharp|go|java|javascript|python|typescript]
```
This creates a basic deployable CDK application with an empty stack.

##### For building reusable constructs:
```
$ cdk init lib --language=typescript
```
This creates a construct library template for building reusable constructs.

##### For exploring CDK with examples:
```
$ cdk init sample-app --language=[csharp|fsharp|go|java|javascript|python|typescript]
```
This creates a CDK app pre-populated with examples demonstrating common AWS services and best practices.

Congratulations, you have now initialized your first starter CDK project!

#### **Working with Custom Templates**

To initialize a project with pre-configured services, file structures, or best practices, you can run `cdk init` using custom templates from Git repositories or NPM packages. A single Git repository or NPM package can contain multiple CDK templates for different use cases. Each template is organized in its own directory, with language-specific subdirectories inside.

##### Getting Custom Templates From GitHub

Let’s walk through an example of initializing a project using a GitHub repository named `my-cdk-templates`, which contains multiple custom templates. Here's what the repository structure might look like:
```
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
├── api-template/                  # Third template  
│   ├── typescript/
│   └── java/
└── 
```

Start by creating your new project directory and navigating to it:
```bash
$ mkdir custom-template-project
$ cd custom-template-project
```

Since the repository contains multiple templates, use `--template-path` to specify one and initialize your project:
```bash
$ cdk init --from-github username/my-cdk-templates --template-path my-custom-template --language=typescript
```

Here's what happened when `cdk init` was run:
1. The template files were copied to your project directory
2. A Git repository was initialized with an initial commit
3. Dependencies were installed as needed (npm install for JS/TS, mvn package for Java, virtual env for Python)

Your new project's root now looks like:
```
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
You can pull custom templates from any other Git Repository (GitLab, Bitbucket, etc.) type with the options below.

Select a specific template from a multi-template Git repository:
```
$ cdk init --from-git-url [URL] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the Git repository contains only one template and has language directories at the repository root, you don't need to specify `--template-path`:
```
$ cdk init --from-git-url [URL] --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the template contains only one language directory, you don't need to specify `--language`:
```
$ cdk init --from-git-url [URL] --template-path ./template-name
```

Select a template from a specific Git branch/tag/commit by specifying the `--template-version`:
```
# Use a specific Git branch
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version develop --language=typescript

# Use a specific Git tag
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version v2.1.0 --language=typescript

# Use a specific Git commit
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version a1b2c3d4 --language=typescript
```

##### Getting Custom Templates From NPM Packages
Alternatively, pull a custom template from any NPM package (on npmjs.com or any registry that hits NPM endpoint) with the options below.

Select a specific template from an NPM package with multiple templates:
```
$ cdk init --from-npm [package-name] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the NPM package contains only one template and has language directories at the package root, you don't need to specify `--template-path`:
```
$ cdk init --from-npm [package-name] --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the template contains only one language directory, you don't need to specify `--language`:
```
$ cdk init --from-npm [package-name] --template-path ./template-name
```

Select a template from a specific NPM package version by specifying the `--template-version`:
```
$ cdk init --from-npm @aws-samples/cdk-web-template --template-version 1.5.2 --language=typescript
```

#### **More Advanced Project Initialization Options**

Skip git initialization and dependency installation by including `--generate-only`:
```bash
$ cdk init app --language=typescript --generate-only
$ cdk init --from-git-url https://github.com/user/my-template.git --generate-only
```

Use a specific CDK library version (built-in templates only) by specifying the `--lib-version`:
```
$ cdk init app --language=typescript --lib-version 2.100.0
```

Set a custom stack name for your project (for built-in templates only) using `--stack-name`:
```
$ cdk init app --language=typescript --stack-name MyCustomStack
```


#### **CLI Public Template Registry**

The CDK CLI includes a vetted registry of public AWS templates that provide pre-configured infrastructure patterns for specific use cases. To see all available templates to initialize a CDK project with, including those in the public registry, run `cdk init --list`:

```
Built-in templates:
* app: CDK Application Template
   └─ cdk init app --language=[typescript|javascript|python|java|csharp|fsharp|go]
* lib: CDK Construct Library Template
   └─ cdk init lib --language=typescript
* sample-app: Example CDK Application with constructs
   └─ cdk init sample-app --language=[typescript|javascript|python|java|csharp|fsharp|go]

Public Template Registry:
* Sort registry view by source type:
   └─ cdk init --list bySourceType
* Query for template sources from an organization:
   └─ cdk init --list [organization]
* Query for templates from a specific source:
   └─ cdk init --list [organization] [sourceName]
* Query for languages a specific template supports:
   └─ cdk init --list [organization] [sourceName] --template-path [templatePath]
* Initialize a project from a template:
   └─ cdk init --from-<sourceType> [sourceLocation] --template-path [templateLocation] --language=[supportedLanguage]

┌─────────────────────┬────────────────────────┬───────────────┬───────────────────────────┐
│ Organization        │ Source Name            │ Source Type   │ Description               │
├─────────────────────┼────────────────────────┼───────────────┼───────────────────────────┤
│ rohang9000          │ sample-git-repo        │ GitHub        │ Example GitHub repository │
│                     │                        │               │ with templates.           │
├─────────────────────┼────────────────────────┼───────────────┼───────────────────────────┤
│ rupta               │ cli-init-npm-test      │ NPM           │ Example NPM Package       │
│                     │                        │               │ with a template           │
├─────────────────────┼────────────────────────┼───────────────┼───────────────────────────┤
│ rohang9000          │ single-template-repo   │ GitHub        │ Example GitHub repository │
│                     │                        │               │ with a template           │
└─────────────────────┴────────────────────────┴───────────────┴───────────────────────────┘
```

Registry View When Sorted by Source Type:
```
$ cdk init --list bySourceType

┌─────────────────────┬────────────────────────┬───────────────┬───────────────────────────┐
│ Organization        │ Source Name            │ Source Type   │ Description               │
├─────────────────────┼────────────────────────┼───────────────┼───────────────────────────┤
│ rohang9000          │ sample-git-repo        │ GitHub        │ Example GitHub repository │
│                     │                        │               │ with templates.           │
├─────────────────────┼────────────────────────┼───────────────┼───────────────────────────┤
│ rohang900           │ single-template-repo   │ GitHub        │ Example GitHub Package    │
│                     │                        │               │ with a template           │
├─────────────────────┼────────────────────────┼───────────────┼───────────────────────────┤
│ rupta               │ cli-init-npm-test      │ NPM           │ Example NPM repository    │
│                     │                        │               │ with a template           │
└─────────────────────┴────────────────────────┴───────────────┴───────────────────────────┘
```

Console Output for Template Sources from an Organization:
```
$ cdk init --list rohang9000

Template Sources in `rohang9000`:

   * sample-gi-repo
```

Console Output for Templates from a Specific Source:
```
$ cdk init --list rohang9000 sample-git-repo

Templates in `sample-git-repo`: 
┌───────────────────────────┬────────────────────────────────────┐
│ Name                      │ Path                               │
├───────────────────────────┼────────────────────────────────────┤
│ Examples                  │ Examples                           │
└───────────────────────────┴────────────────────────────────────┘
│ cdk-hello-world-template  │ Tutorials/cdk-hello-world=template │
└───────────────────────────┴────────────────────────────────────┘
```

Console Output for Languages a Specific Template Support:
```
$ cdk init --list rohang9000 sample-git-repo --template-path Examples

Supported Languages for `Examples` template:

   * csharp
   * fsharp
   * go
   * java
   * javascript
   * python
   * typescript 
```



### Authoring Custom CDK Templates

A valid custom template must contain a subdirectory for a supported CDK language and at least one file inside it matching that language. You can reference custom app template implementations in all CDK Languages [here](https://github.com/rohang9000/sample-git-repo) under the `Examples` folder.

#### Custom Template Schema

```
my-custom-app-template/
└── [language-name]/             # REQUIRED: CDK language subdirectory 
    └── [file-name].[ext]        # REQUIRED: At least one file matching the language type in language subdirectory
```

##### Language-Specific Substitutions:

* [language-name]: csharp, fsharp, go, java, javascript, python, typescript
* [ext]: .cs, .fs, .go, .java, .js, .py, .ts


#### Testing Your Custom Templates

After creating your custom templates, test them locally to ensure the project structure and content meet your expectations before publishing them to a Git repository or NPM package. A project can be initialized directly from a template stored on your local filesystem.

To do this, pass in the directory path for your template and run:
```
$ cdk init --from-path ./my-cdk-template --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

**TIP** - If the template contains only one language directory, you don't need to specify `--language`:
```
$ cdk init --from-path ./my-cdk-template
```

This allows you to verify that:
* All expected files are copied correctly
* Directory structure matches your intended layout


Ticking the box below indicates that the public API of this RFC has been signed-off by the API bar raiser (the `status/api-approved` label was applied to the RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

***

## Public FAQ

### What are we launching today?

A new feature in the AWS CDK CLI that enables users to use custom templates from local files, Git repositories, or NPM packages for project initialization. This feature also provides static discovery for public templates created and maintained by AWS service teams.


### Why should I use this feature?

#### For CDK Developers:
* **Enterprise standardization:** Initialize projects with your organization's security policies, naming conventions, and architectural patterns pre-configured
* **Service-specific templates:** Use AWS service team templates optimized for specific use cases (e.g., CI/CD pipelines)
* **Version consistency:** Pin to specific template versions to ensure consistent project setup across your team

#### For Template Authors:
* **Easy distribution:** Publish templates to Git Repositories or NPM Packages without waiting for CDK team approval
* **Community reach:** Share best practices with the broader CDK community
* **Rapid iteration:** Test and update templates locally before publishing

#### Real-world use cases:
* An enterprise creates templates with pre-configured compliance and security settings for its developers
* AWS service teams provide optimized templates for their services
* Open source projects offer CDK templates for popular application architectures


### Are custom templates required to be “synth-able”?

No, custom templates are not required to be “synth-able”. Templates generally fall under two categories: libraries, which create reusable constructs, and apps, which create deployable infrastructure. Library templates do not synthesize, but are still valid custom template types. As such, `cdk init` does not validate that a CDK stack is defined in a custom template and does not enforce a successful `cdk synth` in order to initialize a new CDK project.


### Can I publish dynamic custom templates to a Git repository or NPM package to be used by `cdk init`?

No, dynamic templates are not directly processed by the CDK CLI. Template authors who want to have template variations can use template generation tools (ie. Projen, Yeoman, Cookiecutter, etc.) to develop static templates which can be published and used by a CDK user.


## Internal FAQ

### Why are we doing this?

Currently, `cdk init` only supports built-in AWS templates, limiting developers to basic project structures. Teams need expanded CLI support for custom templates that include their organization's best practices, pre-configured resources, and standardized project layouts.

This feature offers several benefits:
* **Improved CDK CLI experience for users**
   * Enables custom project initialization from any source (Git, NPM, local) using a familiar command
   * Provides version control flexibility — users can start from specific Git commits or NPM versions
   * Simplifies discovery of AWS service team templates via the Public Template Registry
* **Minimal additional maintenance for the CDK team**
   * The CLI only needs to maintain the Public Template Registry, not the templates themselves
* **Increased flexibility for enterprise users**
   * Organizations can host private or public templates and use them with the `cdk init` command as long as users have access
* **Easier template distribution for template authors**
   * No need to wait for approval from the CDK team — authors can publish directly to Git or NPM
* **Faster template creation process for authors**
   * Templates can be updated and tested locally using the CDK CLI


### Why should we *not* do this?

* **Increased CLI complexity and learning curve for users**
   * Introducing new flags (--from-path, --from-github, --from-git-url, --from-npm, --template-path, and --template-version) adds complexity to the `cdk init` command
   * Users must learn the syntax and how to use these new options, which could be overwhelming for beginners
* **Existing alternatives already enable similar workflows**
   * Users can manually consume templates by downloading template source and extracting files:
     ```
     git clone https://github.com/username/my-custom-templates
     cp -r my-custom-templates/my-custom-template/typescript .
     ```
* **Quality and support for custom templates may be inconsistent**
   * Since templates are authored and maintained outside of the CDK team, they may lack proper documentation, testing, or maintenance
   * The CLI can validate only basic file structure, not functional correctness of a CDK project
* **Reliance on external systems and network access**
   * Users pulling templates from Git or NPM are dependent on the availability of third-party dependencies and appropriate credentials
   * Offline development and testing is only possible if templates have been downloaded locally in advance
 

### What is the technical solution (design) of this feature?

Extend the `cdk init` command to support custom templates from various source options while maintaining the same user experience and validation standards as built-in templates.

**Key Components:**

#### Support for Various Template Source Options (local/Git repo/NPM package)

* Use CLI flags `--from-local`, `--from-git-url`, `--from-github`, or `--from-npm` to specify custom template sources
* Implement template loaders for each source type that download/copy templates and normalize them into a common format
* Support `--template-path` for specifying nested subdirectories within Git repositories or NPM packages
* Support `--template-version` for Git branches/tags/commits or NPM package versions
* Ensure target directory is empty to prevent overwriting existing files
* Initialize new Git repository in project directory
* Create initial Git commit with all template files

#### Simple User Experience in CDK CLI

* Maintain existing `cdk init [template] --language=[language]` syntax for built-in templates
* Add source-specific flags that work with existing parameters: `--from-path`, `--from-git-url`, `--from-github`, `--from-npm`
* Provide unified command structure: `cdk init --from-<source> [location] --language=[language]`
* Preserve existing CLI option `--generate-only` with custom templates

#### Custom Template Validation

* Check that language argument specified is a valid CDK language (TypeScript, JavaScript, Python, Java, C#, F#, Go)
* Validate template structure matches required schema in "Authoring Custom CDK Templates" document before installation
   * At least one language subdirectory contained in template root
   * At least one file of the same language type in that language subdirectory
* Provide clear error messages when template source is invalid or unreachable
* Provide clear error messages when invalid flag is used or argument is provided to `cdk init` command

#### Public Template Discovery

* Implement statically updated registry of curated public template repositories and NPM packages
* Extend `cdk init --list` to display public registry templates in a formatted table with publishing organization, repository/package name, source type, and repository/package description
* Implement ability to sort registry view by source type
* Implement ability to query registry for template sources an organization maintains, templates a source contains, and languages a template is supported in.

#### Static Management Process for Public Template Registry

When internal AWS teams want to add templates to the public registry, they must provide:
```
{
  name: string;               // Short, descriptive name
  description: string;        // Brief description of template functionality
  sourceType: 'git' | 'npm';  // Source type
  source: string;             // Git URL or NPM package name
  templates?: string[];       // List of template names if multiple in one source
  languages: string[];        // Supported CDK languages
  author: string;             // Team or organization name
}
```

Template Submission Process:
1. Internal AWS team creates and tests templates using `cdk init --from-git-url <repo>`, `cdk init --from-npm <package>`, or `cdk init --from-path <path>`
2. Internal AWS team writes README file for custom template with usage instructions and examples
3. Team contacts CDK team with template source and required metadata
4. CDK Team reviews custom templates in repository or package to ensure community benefit, conformity to custom template schema, clear README file, and that it is well tested
5. If approved, CDK team adds entry to PUBLIC_TEMPLATE_REGISTRY in template-registry.ts. If not approved, CDK team will deliver feedback for revision to internal AWS team


### Is this a breaking change?

No, the new feature does not affect existing functionality for creating CDK projects using built-in template options.


### What alternative solutions did you consider?

* Alternatives for supporting custom templates for `cdk init`
   *  Clone Custom Template Repository and Copy Template Files to CDK Project Directory
      ```bash
      git clone https://github.com/codepipeline/cdk-templates
      cp -r cdk-templates/LambdaInvoke/typescript .
      ```
      * Pros:
         * Two simple CLI commands
      * Cons:
         * Does not give full project initialization experience of a new Git repository being initialized with an initial commit and dependencies being installed as needed
         * Outside of CDK CLI experience
* Alternatives for Dynamic Template Configuration/Placeholder Substitution
   * Current Placeholder Approach For Built-In Templates:
      * The current placeholder appraoch for built-in templates is an format for template authors to use. Authors write files using placeholders like %name.PascalCased%, which are replaced automatically during `cdk init` based on project context.
      * Pros:
         * Proven in production for built-in templates with minimal maintenance
         * Provides users with simple and generally sufficient substitution functionality that requires no setup or tooling
         * Entire substitution logic handled within CDK and is not reliant on any external dependencies for this process
      * Cons:
         * Very limited template generation capabilities - limited to filename and file content replacement
            * Does not provide interactive prompts or advanced templating logic like Yeoman, Projen, or Cookiecutter
   * `npm-init`
      * `npm init` is a command used to scaffold new Node.js projects. For users, it walks through prompts to create a package.json. For template authors, it allows publishing an npm package named create-<name>, which users can invoke using `npm init <name>` to generate projects based on custom logic.
      * Pros:
         * Streamlines creating `package.json`, making it quicker to publish templates as NPM packages
         * Most CDK users are familiar with running NPM commands and its ecosystem 
      * Cons:            
         * No multi-language support (important since CDK is supported in 7 languages)
         * Only generates package.json, doesn’t solve the actual template generation or substitution
   * Yeoman Generator
      * Yeoman Generator is a scaffolding tool used to automate the setup of new projects by generating files and directory structures based on templates. Users run `yo <generator-name>` and answer interactive prompts that guide project generation. Template authors write JavaScript-based generators (named generator-<name>) that define prompts and dynamically control which files are generated and how they’re customized.
      * Pros:      
         * Enables advanced scaffolding logic with conditional file inclusion, dynamic file naming, and complex transformations based on user input 
         * Interactive CLI experience
            * Prompts users to select options, allowing a single generator to produce many variations of a template based on user input
            * Organizations can standardize internal CDK setups using these dynamic templates
         * Supports post-processing automation
            * After scaffolding, Yeoman can automatically run `npm install`, initialize Git, and add license headers
      * Cons:
         * CDK users would need to install and learn Yeoman
         * Template authors must write JS-based generators instead of simple file templates
         * Relies on the Yeoman runtime and ecosystem so CDK loses control over some UX
         * `cdk init` logic needs to be updated to recognize and delegate to Yeoman generators
   * Projen
      * Projen is a project scaffolding and management tool that defines and maintains project configuration using code instead of static files. Users create a project by running `npx projen new <project-type>`, which sets up a .projenrc.js (or .ts) file. From then on, running projen regenerates all config files based on this definition. Template authors create reusable Projen project types by writing JS/TS classes that encapsulate desired configurations and options.
      * Pros: 
         * Controlled and maintained by AWS so it is easier to add CDK specific behaviors
         * Automates common setup tasks (like linting, testing, and publishing configs) for template authors
      * Cons: 
         * Steep learning curve since template authors must understand how Projen works, including its configuration language 
         * Generated files are overwritten on every synth and not meant to be edited, so template users need to know to only modify the config and not the generated file
   * CookieCutter
      * Cookiecutter is a CLI utility for creating projects from templates. It uses a folder structure with Jinja2 templating syntax ({{ placeholder }}) to define variable parts of files and filenames. Users run cookiecutter <template-source> and are prompted to provide values for placeholders. It then generates a project by rendering files with those values.
      * Pros:
         * Works with any language or framework, making it well-suited for CDK's multi-language ecosystem
         * Template authors use expressions for variable substitution, conditional logic, and looping in both file content and filenames
         * Interactive automatically prompts users for input, enabling flexible template customization without extra scripting
         * Industry tested by many open source projects
         * Once the project is generated, no link to Cookiecutter remains (all files are static and editable)
      * Cons: 
         * Users must install Cookiecutter via pip, which may not be intuitive for CDK developers
         * Template authors who want this dynamic capability must learn the Cookiecutter structure and Jinja2 templating model, which is more complex than existing placeholder substitution mechanism
         * Unlike Yeoman or Projen, it doesn’t offer built-in lifecycle hooks to run commands like npm install or git init after generation
         * CookieCutter is not currently integrated with CDK CLI so users have to run it seperately, not allowing CDK CLI to be a "one stop shop" type of experience
   * Template authors develop and maintain their own placeholder and template configuration using advanced tools (Yeoman, Projen, Cookiecutter, etc.)
      * Pros:
         * Simpler experience for users because valid CLI arguments are more concrete
         * Gives template authors the freedom to use whichever tool (ie. Projen, Yeoman, Cookiecutter, etc.) they want for template generation or placeholder substitution, and can then publish that generated static template to be accessed by users
         * CDK team does not have facilitate dynamic template generation for authors through the `cdk init` command
            * This eliminates the security risk of `cdk init` running an arbitrary template generation script (provided in a custom template) since there's no way to effectively validate the script for malicious code
            * With the current proposal, `cdk init` just copies files, creates a new Git repository to track local changes, and installs project dependencies
      * Cons:
         * No default placeholder or template configuration for authors who want it but are not experienced with advanced tools



### What is the high-level project plan?

* Phase 1: Core functionality

   * Support for custom templates through local files, Git repositories, and NPM packages
   * Support for custom templates in all CDK languages (TypeScript, C#, F#, Go, Java, JavaScript, and Python)
   * Support for public and private Git repositories and NPM packages
   * Support for users to specify what branch/commit of repo or package version they want to pull templates from and if not specified then will use main branch/most recent commit or latest package version by default
   * Basic custom template validation which checks that template follows schema defined in "Authoring Custom Templates" RFC section
   * Develop unit and integration tests for each subfeature of core functionality

* Phase 2: Static discovery for custom templates through the Public Template Registry
   
   * Extend `cdk init --list` to display AWS service team templates in a formatted table (with publishing organization, repository/package name, source type, and repository/package description fields)
      * Templates are maintained by internal AWS teams after being vetted by CDK team
      * Registry is maintained by CDK team
   * Work with internal AWS teams to create and add more templates to the CDK CLI registry
   * Implement ability to sort registry view by source type
   * Implement ability to query registry for template sources an organization maintains, templates a source contains, and languages a template is supported in.

* Phase 3: Documentation, testing, and marketing
   * Publish official documentation ("Authoring Custom CDK Templates" section) to [https://docs.aws.amazon.com](https://docs.aws.amazon.com) for template authors to reference
   * Publish official documentation ("Updated README for Users of CDK CLI" section) to [https://github.com/aws/aws-cdk-cli/tree/main/packages/aws-cdk](https://github.com/aws/aws-cdk-cli/tree/main/packages/aws-cdk) for CDK users to reference
   * Author blog post and other marketing materials
      * Include benefits and example use cases of passing in custom templates through Local/Git/NPM
      * Include benefits and example use cases of selecting branch/commit/package version of a custom template



### Are there any future enhancements of this feature?

* Dynamic template discovery mechanism to browse all available public template beyond AWS service team templates that appear in statically maintained CLI Public Template Registry
* Integrate CDK CLI telemetry to track which sources for custom templates are used and how often



## Appendix
