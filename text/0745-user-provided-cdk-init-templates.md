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

#### **Your First CDK Project**
Let's begin by making and navigating to a new project directory:
```bash
$ mkdir my-first-project
$ cd my-first-project
```

Next, let's initialize the project in the CDK language of your choice. The CDK provides three built-in templates to help you get started quickly:

##### For a basic application, run:
```
$ cdk init app --language=[csharp|fsharp|go|java|javascript|python|typescript]
```
This creates a basic deployable CDK application with an empty stack.

##### For building reusable constructs, run:
```
$ cdk init lib --language=typescript
```
This creates a construct library template for building reusable constructs.

##### For exploring CDK with examples, run:
```
$ cdk init sample-app --language=[csharp|fsharp|go|java|javascript|python|typescript]
```
This creates a CDK app pre-populated with examples demonstrating common AWS services and best practices.

Congratulations, you have now created your first CDK project!

#### **Working with Custom Templates**
To initialize a project with pre-configured services, file structures, and best practices, you can run the `cdk init` command using custom templates from sources such as Git repositories or NPM packages. A single Git repository or NPM package can contain multiple CDK templates for different use cases. Each template is organized in its own directory, with language-specific subdirectories inside.

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
Since this repository contains multiple templates, you must specify the one you want using `--template-path`.

Start by creating your new project directory and navigating to it:
```bash
$ mkdir custom-template-project
$ cd custom-template-project
```

Then, to initialize your project from this template, run:
```bash
$ cdk init --from-github username/my-cdk-templates --template-path my-custom-template --language=typescript
```

Here's what happened when the `cdk init` command was run:
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
Now you're ready to continue coding in your project!

##### Getting Custom Templates From Git Repositories
Alternatively, you can pull custom templates from any Git Repository (GitLab, Bitbucket, etc.) with one of the options below.

To select a specific template from a multi-template Git repository:
```
$ cdk init --from-git-url [URL] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

If the Git repository contains only one template and has language directories at the repository root, you don't need to specify `--template-path`:
```
$ cdk init --from-git-url [URL] --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

If the template contains only one language directory, you don't need to specify `--language`:
```
$ cdk init --from-git-url [URL] --template-path ./template-name
```

To select a template from a specific Git branch/tag/commit, specify the `--template-version`:
```
# Use a specific Git branch
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version develop --language=typescript

# Use a specific Git tag
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version v2.1.0 --language=typescript

# Use a specific Git commit
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version a1b2c3d4 --language=typescript
```

##### Getting Custom Templates From NPM Packages
Or, pull a custom template from any NPM package (on npmjs.com or any registry that hits NPM endpoint) with one of the options below.

To select a specific template from an NPM package with multiple templates:
```
$ cdk init --from-npm [package-name] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

If the NPM package contains only one template and has language directories at the package root, you don't need to specify `--template-path`:
```
$ cdk init --from-npm [package-name] --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

If the template contains only one language directory, you don't need to specify `--language`:
```
$ cdk init --from-npm [package-name] --template-path ./template-name
```

To select a template from a specific NPM package version, specify the `--template-version`:
```
$ cdk init --from-npm @aws-samples/cdk-web-template --template-version 1.5.2 --language=typescript
```

#### **More Advanced Project Initialization Options**

To skip dependency installation and git initialization, add the `--generate-only` flag to your command:
```bash
$ cdk init app --language=typescript --generate-only
$ cdk init --from-git-url https://github.com/user/my-template.git --generate-only
```

To use a specific CDK library version (built-in templates only), specify the `--lib-version`:
```
$ cdk init app --language=typescript --lib-version 2.100.0
```

To set a custom stack name for your project (for built-in templates only), use the `--stack-name` flag:
```
$ cdk init app --language=typescript --stack-name MyCustomStack
```


#### **CLI Public Template Registry**

The CDK CLI includes a vetted registry of public AWS templates that provide pre-configured infrastructure patterns for specific use cases. To see all available templates to initialize a CDK project with, including those in the public registry, run `cdk init --list`:

```
Available templates:
* app: CDK Application Template
   └─ cdk init app --language=[typescript|javascript|python|java|csharp|fsharp|go]
* lib: CDK Construct Library Template
   └─ cdk init lib --language=typescript
* sample-app: Example CDK Application with constructs
   └─ cdk init sample-app --language=[typescript|javascript|python|java|csharp|fsharp|go]

Public Template Registry:
┌────────────────┬─────────────────────────────────────┬───────────────────────┬────────────────────────────────────────┐
│ Name           │ Description                         │ Author                │ Usage                                  │
├────────────────┼─────────────────────────────────────┼───────────────────────┼────────────────────────────────────────┤
│sample-git-repo │ Example GitHub repository containing│ @rohang9000           │--from-github rohang9000/sample-git-repo│
│                │ custom template examples.           │                       │                                        │
└────────────────┴─────────────────────────────────────┴───────────────────────┴────────────────────────────────────────┘
```



### Authoring Custom CDK Templates

A valid custom template must contain a subdirectory for a supported CDK language and at least one file inside it matching that language. You can reference example app template implementations in all CDK Languages [here](https://github.com/rohang9000/sample-git-repo).

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

After creating your custom templates, test them locally to ensure the project structure and content meet your expectations before publishing to a Git repository or NPM package. Projects can be initialized from the authored template stored locally on your filesystem:

```
# Use a local template directory path
$ cdk init --from-path ./my-cdk-template --language=[csharp|fsharp|go|java|javascript|python|typescript]

# If template contains only one language, don't need to specify language
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

* CDK Developer
    * Quickly create projects with specific components, configurations, and requirements by default in the AWS CDK CLI, reducing setup time
    * Discover ready-to-use templates through the Public Template Registry:
* CDK Template Author
    * Write templates for specific use cases and publish them to Git repositories or NPM packages


### Are custom templates required to be “synth-able”?

No, custom templates are not required to be “synth-able”. Templates generally fall under two categories: libraries, which create reusable constructs, and apps, which create deployable infrastructure. Library templates do not synthesize, but are still valid custom template types. As such, the `cdk init` command does not validate that a CDK stack is defined in a custom template and does not enforce a successful `cdk synth` in order to initialize a new CDK project.


### Can I publish dynamic custom templates to a Git repository or NPM package to be used by `cdk init`?

No, dynamic templates are not directly processed by the CDK CLI. Template authors who want to have template variations can use template generation tools (ie. Projen, Yeoman, Cookiecutter, etc.) to develop static templates which can be published and used by a CDK user.


## Internal FAQ

### Why are we doing this?

Currently, `cdk init` only supports built-in AWS templates, limiting developers to basic project structures. Teams need expanded CLI support for custom templates that include their organization's best practices, pre-configured resources, and standardized project layouts.

### Why should we *not* do this?

* Increased CLI complexity because users have to learn syntax for new arguments
* CDK users can already utilize custom templates, although outside of the CDK ecosystem (Below options achieve same outcome)
    * Extending `cdk init` command to allow passing in custom templates from source:
      ```bash
      cdk init --from-git-url https://github.com/codepipeline/cdk-templates —template-path ./LambdaInvoke
      ```
    * Downloading template source and extracting files:
      ```bash
      git clone https://github.com/codepipeline/cdk-templates
      cp -r cdk-templates/LambdaInvoke/typescript .
      ```

### What is the technical solution (design) of this feature?

Extend the `cdk init` command to support custom templates from various source options while maintaining the same user experience and validation standards as built-in templates. The main aspects of this solution are:

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
* Extend `cdk init --list` to display public registry templates in a formatted table with repository/package name, description, author, and template usage instructions

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
    *  Current way to use custom templates to create a CDK project
       * Pros:
         * Two simple CLI commands:
             ```bash
             git clone https://github.com/codepipeline/cdk-templates
             cp -r cdk-templates/LambdaInvoke/typescript .
             ```
       * Cons:
         * Multi-step process that requires Git commands and file-copying
    *  Allowing users to pass in custom templates to `cdk init` with validation of their template definition
       * Pros:
         * Single command to initialize a custom CDK project from any source
         * No new infrastructure
           * Don’t have to build, maintain, and host a registry
         * User controlled
           * Companies/organizations can keep templates private in their own repos or make them public for more visibility
         * Increased availability and quicker template creation process
           * Customers don’t need to wait on an approval/publishing process from CDK team
           * Template authors can update and test immediately
         * Version control flexibility
           * Users can pin to to specific Git commits or NPM versions
         * Distributed approach
           * No central registry downtime that can affect all dependent customers
         * This approach has already been prototyped
       * Cons:
         * Template discovery is harder
           * No central place to find community templates 
         * Quality variance
           * Harder to curate and offer good template validation through backend
         * Worse documentation
           * Private/community repos and packages will be not be maintained by CDK team
         * Dependency on external services
           * Relies on GitHub/NPM availability unless template is on user’s local machine already
         * CDK team can't help debug third-party templates as easily
         * Similar templates scattered across different repos
         * Dynamic custom templates are not supported in current feature proposal
* Alternatives for Template Configuration/Placeholders
    * Current Placeholder Approach For Built-In Templates:
       * The current placeholder appraoch for built-in templates is an format for template authors to use. Authors write files using placeholders like %name.PascalCased%, which are replaced automatically during `cdk init` based on project context.
       * Pros:
         * Already works and is sufficient for built-in templates
           * Proven in production with minimal maintenance
         * Independent of template users
           * Uses the `cdk init` context (like project folder name), so no user input (like) required
         * Easy format for template authors to use
           * Simple substitution syntax with no setup or tooling required
         * No external dependencies
           * Entire process is handled within CDK so reduced risk of integration issues
       * Cons:
         * Very limited template generation capabilities - limited to filename and file content replacement
           * Does not provide interactive prompts or advanced templating logic like Yeoman
    * `npm-init`
       * npm init is a command used to scaffold new Node.js projects. For users, it walks through prompts to create a package.json. For template authors, it allows publishing an npm package named create-<name>, which users can invoke using `npm init <name>` to generate projects based on custom logic.
       * Pros:
         * Easy publishing to npm
           * Streamlines creating package.json, making it quicker to publish templates as npm packages
         * Uses existing npm ecosystem familiar to CDK users 
       * Cons:            
         * No multi-language support
         * Limited to scaffolding metadata
           * Only generates package.json, doesn’t solve the actual template generation or substitution
         * Requires manual integration with CDK templating logic
           * Introduces an extra manual step to bridge between the scaffolded output and CDK’s expected project structure and lifecycle, requiring users to manually configure files or run additional setup before using CDK commands
    * Yeoman Generator
       * Yeoman Generator is a scaffolding tool used to automate the setup of new projects by generating files and directory structures based on templates. Users run `yo <generator-name>` and answer interactive prompts that guide project generation. Template authors write JavaScript-based generators (named generator-<name>) that define prompts and dynamically control which files are generated and how they’re customized.
       * Pros:      
         * Highly customizable scaffolding logic
           * Enables conditional file inclusion, dynamic file naming, and complex transformations based on user input beyond static substitution like %name.PascalCased%
         * Interactive CLI experience for users
           * Users can be prompted during `cdk init` to select options, allowing a single generator to produce many variations of a template
         * Facilitates reusable and adaptable enterprise templates
           * Organizations can standardize internal CDK setups with customizable templates that adjust based on use case
         * Supports post-processing automation
           * After scaffolding, Yeoman can automatically run `npm install`, initialize Git, and add license headers
       * Cons:
         * Increased complexity and learning curve
           * CDK users would need to install and learn Yeoman
             * Template authors must write JS-based generators instead of simple file templates
       * External dependency
         * Relies on the Yeoman runtime and ecosystem so CDK loses control over some UX
         * Added maintenance risk from external changes
       * Not natively integrated into CDK CLI
         * `cdk init` logic needs to be updated to recognize and delegate to Yeoman generators
         * Makes CDK’s bootstrapping process more complex
    * Projen
       * Projen is a project scaffolding and management tool that defines and maintains project configuration using code instead of static files. Users create a project by running `npx projen new <project-type>`, which sets up a .projenrc.js (or .ts) file. From then on, running projen regenerates all config files based on this definition. Template authors create reusable Projen project types by writing JS/TS classes that encapsulate desired configurations and options.
       * Pros: 
         * Controlled and maintained by AWS
           * Easier to add CDK specific behaviors
         * Automates common setup tasks (like linting, testing, and publishing configs)
           * Template authors don’t have to maintain those manually across many templates
       * Cons: 
         * Steep learning curve
           * Template authors must understand how Projen works, including its configuration language
         * Templates are code, not files
           * Instead of writing/copying static template files, template authors must write Projen config code that generates those files
         * Generated files are not meant to be edited
           * Generated files are overwrited on every synth, so template users should only modify the config and not the output file
    * Template authors develop and maintain their own placeholder and template configuration using advanced tools (Yeoman, Projen, Cookiecutter, etc.)
       * Pros:
         * Simpler from a user point of view because valid CLI arguments are more concrete
         * cdk init does not have to support template configuration
           * If template authors want to have variations on templates, they can do the branching generation-side, which allows them to use more advanced tools
       * Cons:
         * No default placeholder or template configuration style for template authors



### What are the drawbacks of this solution?

The template validation burden is on template author, so we can't ensure template quality for CDK users unless the custom template is part of vetted CLI template registry.



### What is the high-level project plan?

* Phase 1: Core functionality

  * Support for custom templates through local files, Git repositories, and NPM packages
  * Support for custom templates in all CDK languages (TypeScript, C#, F#, Go, Java, JavaScript, and Python)
  * Support for public and private Git repositories and NPM packages
  * Support for users to specify what branch/commit of repo or package version they want to pull templates from and if not specified then will use main branch/most recent commit or latest package version by default
  * Basic custom template validation which checks that template follows schema defined in "Authoring Custom Templates" section of RFC

* Phase 2: Testing and Static Discovery for Custom Templates

  * Develop unit and integration tests
  * Extend `cdk init --list` to display public Git repositories and NPM packages for custom templates, created by internal AWS teams and vetted by CDK team.
  * Work with internal AWS teams to create and add more templates to the CDK CLI registry

* Phase 3: Support for additional NPM package formats

  * Extend `--from-npm` to support tarball formats:
    * Local gzipped tarballs: `cdk init --from-npm ./my-template.tgz --language=typescript`
    * Remote tarball URLs: `cdk init --from-npm https://example.com/my-template.tgz --language=typescript`

* Phase 4: Documentation, testing, and marketing
  * Publish official documentation ("Authoring Custom CDK Templates" section) to docs.aws.amazon.com/cdk/ for template authors to reference
  * Publish official documentation ("Updated README for Users of CDK CLI" section) to github.com/aws/aws-cdk-cli/tree/main/packages/aws-cdk for CDK users to reference
  * Author blog post and other marketing materials
    * Include benefits and example use cases of passing in custom templates through Local/Git/NPM
    * Include benefits and example use cases of selecting branch/commit/package version of a custom template

### Are there any future enhancements of this feature?

* Publish sample templates on GitHub or NPM for template authors to reference when creating
* Dynamic template discovery mechanism to browse all available public template beyond static discovery in CLI
* Integrate CDK CLI telemetry to track which sources for custom templates are used and how often



## Appendix
