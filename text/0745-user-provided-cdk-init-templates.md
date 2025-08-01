# RFC: User-Provided `cdk init` Templates

Original Author(s):: @rohang9000

Tracking Issue: [#745](https://github.com/aws/aws-cdk-rfcs/issues/745)

API Bar Raiser: @iliapolo

***

Customers need a way to initialize CDK projects in the CLI with custom templates to meet specific technical/regulatory requirements and standardize project initialization.


## Working Backwards

This section of the RFC addresses both users who will use custom templates to initialize a CDK project through the `cdk init` command and authors of custom templates.

### CHANGELOG

```
feat(cli): user-provided cdk init templates
```



### Updated `cdk init` README Section for CDK CLI Users

#### `cdk init`
The `cdk init` command creates a new CDK project from built-in templates or custom templates. This command helps you get started with AWS CDK by initializing a new project with the necessary files and folders to organize your CDK code, including directories for your project definition and constructs, as well as your stacks for applications.


#### **Your First CDK Project**
Let's begin by creating your first CDK project. Create your new project directory and navigate to it by running:
```
$ mkdir my-first-project
$ cd my-first-project
```

Next, let's initialize the project in the CDK language of your choice. The CDK provides 3 built-in templates to help you get started quickly:


##### For a basic application, run:
```
$ cdk init app --language=[csharp|fsharp|go|java|javascript|python|typescript]
```
This creates a basic deployable CDK application with an empty stack, available in TypeScript, JavaScript, Python, Java, C#, F#, and Go.

##### For building reusable constructs, run:
```
$ cdk init lib --language=typescript
```
This creates a CDK Construct Library Template for building and sharing custom CDK constructs (available in TypeScript only).

##### For exploring CDK with examples, run:
```
$ cdk init sample-app --language=[csharp|fsharp|go|java|javascript|python|typescript]
```
This creates a CDK application with example constructs that demonstrates common AWS services and patterns, available in TypeScript, JavaScript, Python, Java, C#, F#, and Go.

#### **Working with Custom Templates**
For more advanced use cases, you can run `cdk init` with custom templates from Git repositories or NPM packages to:
* Standardize project structure across your organization
* Include company-specific configurations
* Pre-configure common services and patterns

Let's walk through an example of creating a CDK project using a custom TypeScript template from GitHub.

Here's what a custom template in a GitHub repository called "my-cdk-templates" could look like:
```
my-custom-template/                # Template directory
└── typescript/                    # Language subdirectory
    ├── package.json
    ├── cdk.json                   # CDK project configuration - specifies how to run the app and stores context/feature flags
    ├── bin/
    │   └── app.ts                 # App entry file
    ├── lib/
    │   └── stack.ts               # Stack class file
    ├── test/
    │   └── stack.test.ts          # Test file
    ├── tsconfig.json
    ├── .gitignore
    └── README.md
```

Start by creating your new project directory and navigating to it:
```
$ mkdir custom-template-project
$ cd custom-template-project
```

Then, to initialize your project from this template, run:
```
$ cdk init --from-github username/my-cdk-templates --template-path my-custom-template --language=typescript
```

Here's what happened when we ran `cdk init`:
1. Template files were copied to your project directory
2. A Git repository was initialized with an initial commit
3. Dependencies were installed if needed (npm install for JS/TS, mvn package for Java, virtual env for Python)

Your new project's directory now looks like:
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


##### From Git Repositories
Alternatively, you can pull custom templates from any Git Repository (GitLab, Bitbucket, etc.) with one of the options below.

To select a specific template from Git repository of many templates:
```
$ cdk init --from-git-url [URL] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

If Git repository only contains one template and it is at the root directory of the repository, you don't need to specify template path:
```
$ cdk init --from-git-url [URL] --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

If the template contains only one language directory, you don't need to specify language:
```
$ cdk init --from-git-url [URL] --template-path ./template-name
```

To select a template from a specific Git branch/tag/commit, add the `--template-version` flag to your command:
```
# Use a specific Git branch
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version develop --language=typescript

# Use a specific Git tag
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version v2.1.0 --language=typescript

# Use a specific Git commit
$ cdk init --from-git-url https://github.com/aws-samples/cdk-templates.git --template-version a1b2c3d4 --language=typescript
```

NOTE: If the CLI detects a name conflict between a branch and tag specified by `--template-version`, the CLI will prompt the user with an interactive like the below example to handle it:
```
$ cdk init --from-git-url repo.git --template-version v1.0.0

⚠️  Ambiguous reference "v1.0.0" found:
  [1] Branch v1.0.0 (latest commit: a1b2c3d)
  [2] Tag v1.0.0 (commit: e4f5g6h)

Which would you like to use? [1/2]: 2
```

##### From NPM Packages
Or, pull a custom template from any NPM package (on npmjs.com or any registry that hits NPM endpoint) with one of the options below.

To select a specific template from an NPM package with many templates:
```
$ cdk init --from-npm [package-name] --template-path ./template-name --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

If NPM package only contains one template and it is at the root directory of the package, you don't need to specify template name:
```
$ cdk init --from-npm [package-name] --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

If the template contains only one language directory, you don't need to specify language:
```
$ cdk init --from-npm [package-name] --template-path ./template-name
```

To select a template from a specific NPM package version, add the `--template-version` flag to your command:
```
$ cdk init --from-npm @aws-samples/cdk-web-template --template-version 1.5.2 --language=typescript
```

#### **More Advanced Options**

To skip dependency installation and git initialization, add the `--generate-only` flag to your command:
```
$ cdk init app --language=typescript --generate-only
$ cdk init --from-git-url https://github.com/user/my-template.git --generate-only
```

To use a specific CDK library version (built-in templates only), add the `--lib-version` flag to your command:
```
$ cdk init app --language=typescript --lib-version 2.100.0
```

To use a custom stack name for your project (built-in templates only), add the `--stack-name` flag to your command:
```
$ cdk init app --language=typescript --stack-name MyCustomStack
```


#### **CDK Template Registry**

The CDK CLI includes a vetted registry of public AWS templates that provide pre-configured infrastructure patterns for specific use cases. To see all available templates to initialize a CDK project with, including those in the public registry, run `cdk init --list`:

```
Available templates:
* app: CDK Application Template
   └─ cdk init app --language=[typescript|javascript|python|java|csharp|fsharp|go]
* lib: CDK Construct Library Template
   └─ cdk init lib --language=typescript
* sample-app: Example CDK Application with constructs
   └─ cdk init sample-app --language=[typescript|javascript|python|java|csharp|fsharp|go]

Public template registry:
┌────────────────┬─────────────────────────────────────┬───────────────────────┬────────────────────────────────────────────────────────────────────┐
│ Name           │ Description                         │ Author                │ Usage                                                              │
├────────────────┼─────────────────────────────────────┼───────────────────────┼────────────────────────────────────────────────────────────────────┤
│sample-git-repo │ Sample public GitHub repository with│ @rohang9000           │--from-github=rohang9000/sample-git-repo --template-path my-template│
│                │ a custom template                   │                       │--language=[python|typescript]                                      │
└────────────────┴─────────────────────────────────────┴───────────────────────┴────────────────────────────────────────────────────────────────────┘
```



### Authoring Custom CDK Templates

The requirements for a custom template are that it contains a CDK supported language subdirectory and at least one file of the same type inside that subdirectory. Reference the appendix for example app template implementations in all CDK Languages.

#### Custom Template Schema

```
my-custom-app-template/
└── [language-name]/             # REQUIRED: CDK language subdirectory 
    └── [file-name].[ext]        # REQUIRED: At least one file matching the language type in language subdirectory
```

##### Language-Specific Substitutions:

* [language-name]: csharp, fsharp, go, java, javascript, python, typescript
* [ext]: .cs, .fs, .go, .java, .js, .py, .ts


#### Testing Your Custom Templates Locally

After authoring your custom templates, it can be helpful to test that `cdk init` runs successfully before publishing them to a Git repository or NPM package. Projects can be initialized from the authored template stored locally on your filesystem:

```
# Use a local template directory path
$ cdk init --from-path ./my-cdk-template --language=[csharp|fsharp|go|java|javascript|python|typescript]

# If template contains only one language, don't need to specify language
$ cdk init --from-path ./my-cdk-template
```


Ticking the box below indicates that the public API of this RFC has been signed-off by the API bar raiser (the `status/api-approved` label was applied to the RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

***

## Public FAQ

### What are we launching today?

A new feature in the AWS CDK CLI that enables users to use custom templates for project initialization from local files, Git repositories, or NPM packages.


### Why should I use this feature?

* CDK Developer
    * Quickly create projects with specific components, configurations, and requirements by default in the AWS CDK CLI, which reduces setup time
    * Static template discovery in CLI
* CDK Template Author
    * Write and share templates for specific use cases through Git repository or NPM package
    * Static template discovery in CLI



### Are custom templates required to be “synth-able”?

No, custom templates are not required to be “synth-able”. Templates generally fall under 2 categories: libraries, which create reusable constructs, and apps, which create deployable infrastructure. Library templates do not synthesize, but are still valid custom template types. As such, the `cdk init` command does not verify that a CDK stack is defined in a custom template and does not enforce a successful `cdk synth` in order to initialize a new CDK project.


### Can I publish dynamic custom templates to a Git repository or NPM package to be used by `cdk init`?

No, dynamic templates are not directly supported or processed by the CDK CLI. However, template authors who want to have variations on templates can do the branching generation-side and use dynamic template generation tools (ie. Projen, Yeoman, Cookiecutter, etc.) to develop static templates which can be published and used by a CDK user.


## Internal FAQ

### Why are we doing this?

Currently, cdk init only supports built-in AWS templates, limiting developers to basic project structures. Teams need custom templates that include their organization's best practices, pre-configured resources, and standardized project layouts, but have no way to use them with the CDK CLI.

### Why should we *not* do this?

* Increased CLI complexity because users have to learn syntax for new arguments
* CDK users/template authors can already utilize custom templates outside of the CDK ecosystem (Below options achieve same outcome)
    * Extended cdk init command to allow passing in custom templates from source:
        * cdk init --from-git-url https://github.com/codepipeline/cdk-templates —template-path ./LambdaInvoke
    * Downloading template source and extracting files:
        1. git clone https://github.com/codepipeline/cdk-templates
        2. cp -r cdk-templates/LambdaInvoke/typescript .

### What is the technical solution (design) of this feature?

Extend cdk init to support custom templates from various source options while maintaining the same user experience and validation standards as built-in templates. The main aspects of this solution are:

#### Multi Template Source Support (local/Git repo/NPM package)

* Use CLI flags `--from-local`, `--from-git-url`, `--from-github`, or `--from-npm` to specify custom template sources
* Implement template loaders for each source type that download/copy templates and normalize them into a common format
* Support `--template-path` for specifying subdirectories within Git repositories or NPM packages
* Support `--template-version` for Git branches/tags/commits or NPM package versions
* Ensure target directory is empty to prevent overwriting existing files
* Initialize new Git repository in project directory
* Create initial Git commit with all template files

#### Simple User Experience in CDK CLI

* Maintain existing `cdk init [template] --language=[language]` syntax for built-in templates
* Add source-specific flags that work with existing parameters: `--from-path`, `--from-git-url`, `--from-github`, `--from-npm`
* Provide unified command structure: `cdk init --from-<source>=[location] --language=[language]`
* Preserve existing CLI option `--generate-only` with custom templates

#### Template Validation

* Check that language argument specified is a valid CDK language (TypeScript, JavaScript, Python, Java, C#, F#, Go)
* Validate template structure matches required schema in "Authoring Custom CDK Templates" document before installation
   * At least 1 language subdirectory contained in template root
   * At least 1 file of the same language type in that language subdirectory
* Provide clear error messages when template source is invalid or unreachable
* Provide clear error messages when invalid argument is used in `cdk init` command

#### Template Discovery

* Implement static registry of curated public template repositories and NPM packages
* Extend `cdk init --list` to display both built-in and templates in registry
* Show description, author, supported languages, and template usage instructions in formatted table

#### Static Registry Management Process

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
5. If approved, CDK team adds entry to PUBLIC_TEMPLATE_REGISTRY in template-registry.ts. If not approved, CDK team will deliver feedback for revision to internal AWS team.


### Is this a breaking change?

No, the new feature does not affect existing functionality for creating CDK projects using built-in template options.


### What alternative solutions did you consider?

* Alternatives for supporting custom templates for `cdk init`
    *  Current way to use custom templates to create a CDK project
       * Pros:
         * 2 simple CLI commands:
           1. `git clone https://github.com/codepipeline/cdk-templates`
           2. `cp -r cdk-templates/LambdaInvoke/typescript .` 
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
       * Easy format for template authors to use — authors write files using placeholders like %name.PascalCased%, which are replaced automatically during `cdk init` based on project context.
       * Pros:
         * Already works and is sufficient for built-in templates
           * Proven in production with minimal maintenance
         * Independent of template users
           * Uses the `cdk init` context (like project folder name), so no user input (like) required.
         * Easy format for template authors to use
           * Simple substitution syntax with no setup or tooling required.
         * No external dependencies
           * Entire process is handled within CDK so reduced risk of integration issues
       * Cons:
         * Very limited template generation capabilities - limited to filename and file content replacement
           * Does not provide interactive prompts or advanced templating logic like Yeoman
    * `npm-init`
       * npm init is a command used to scaffold new Node.js projects. For users, it walks through prompts to create a package.json. For template authors, it allows publishing an npm package named create-<name>, which users can invoke using `npm init <name>` to generate projects based on custom logic.
       * Pros:
         * Easy publishing to npm
           * Streamlines creating package.json, making it quicker to publish templates as npm packages.
         * Uses existing npm ecosystem familiar to CDK users 
       * Cons:            
         * No multi-language support
         * Limited to scaffolding metadata
           * Only generates package.json, doesn’t solve the actual template generation or substitution
         * Requires manual integration with CDK templating logic
           * Introduces an extra manual step to bridge between the scaffolded output and CDK’s expected project structure and lifecycle, requiring users to manually configure files or run additional setup before using CDK commands.
    * Yeoman Generator
       * Yeoman Generator is a scaffolding tool used to automate the setup of new projects by generating files and directory structures based on templates. Users run `yo <generator-name>` and answer interactive prompts that guide project generation. Template authors write JavaScript-based generators (named generator-<name>) that define prompts and dynamically control which files are generated and how they’re customized.
       * Pros:      
         * Highly customizable scaffolding logic
           * Enables conditional file inclusion, dynamic file naming, and complex transformations based on user input beyond static substitution like %name.PascalCased%.
         * Interactive CLI experience for users
           * Users can be prompted during `cdk init` to select options, allowing a single generator to produce many variations of a template.
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
           * Template authors don’t have to maintain those manually across many templates.
       * Cons: 
            
         * Steep learning curve
           * Template authors must understand how Projen works, including its configuration language
            
         * Templates are code, not files
           * Instead of writing/copying static template files, template authors must write Projen config code that generates those files.
            
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

### Example CDK App Templates for Supported Languages

  * #### [TypeScript](https://github.com/aws/aws-cdk-rfcs/blob/rohang9000/0745-user-provided-cdk-init-templates/text/0745-user-provided-cdk-init-templates.md/#Example-of-CDK-TypeScript-App-Template)
  * #### [Python](https://github.com/aws/aws-cdk-rfcs/blob/rohang9000/0745-user-provided-cdk-init-templates/text/0745-user-provided-cdk-init-templates.md/#Example-of-CDK-Python-App-Template)
  * #### [Java](https://github.com/aws/aws-cdk-rfcs/blob/rohang9000/0745-user-provided-cdk-init-templates/text/0745-user-provided-cdk-init-templates.md/#Example-of-CDK-Java-App-Template)
  * #### [JavaScript](https://github.com/aws/aws-cdk-rfcs/blob/rohang9000/0745-user-provided-cdk-init-templates/text/0745-user-provided-cdk-init-templates.md/#Example-of-CDK-JavaScript-App-Template)
  * #### [C Sharp](https://github.com/aws/aws-cdk-rfcs/blob/rohang9000/0745-user-provided-cdk-init-templates/text/0745-user-provided-cdk-init-templates.md/#Example-of-CDK-C-Sharp-App-Template)
  * #### [F Sharp](https://github.com/aws/aws-cdk-rfcs/blob/rohang9000/0745-user-provided-cdk-init-templates/text/0745-user-provided-cdk-init-templates.md/#Example-of-CDK-F-Sharp-App-Template)
  * #### [Go](https://github.com/aws/aws-cdk-rfcs/blob/rohang9000/0745-user-provided-cdk-init-templates/text/0745-user-provided-cdk-init-templates.md/#Example-of-CDK-Go-App-Template)

#### Example of CDK TypeScript App Template

```
my-custom-template/
└── typescript/
    ├── package.json
    ├── cdk.json                   # CDK project configuration - specifies how to run the app and stores context/feature flags
    ├── bin/
    │   └── app.ts                 # App entry file
    ├── lib/
    │   └── stack.ts               # Stack class file
    ├── test/
    │   └── stack.test.ts          # Test file
    ├── tsconfig.json
    ├── .gitignore
    └── README.md
```

##### **Example Implementation of /package.json for TypeScript template**

```
{
  "app": "npx ts-node --prefer-ts-exts bin/my-app.ts",
  "watch": {
    "include": ["**"],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "yarn.lock",
      "node_modules",
      "test"
    ]
  }
}
```

##### **Example Implementation of /cdk.json for TypeScript template**

```
{
  "app": "npx ts-node --prefer-ts-exts bin/my-app.ts",
  "watch": {
    "include": ["**"],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "yarn.lock",
      "node_modules",
      "test"
    ]
  }
}
```

##### **Example Implementation of /bin/app.ts for TypeScript template**

```
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyAppStack } from '../lib/my-app-stack';

const app = new cdk.App();
new MyAppStack(app, 'MyAppStack');
```

##### **Example Implementation of /lib/stack.ts for TypeScript template**

```
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class MyAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, 'MyAppQueue', {
      visibilityTimeout: Duration.seconds(300)
    });

    const topic = new sns.Topic(this, 'MyAppTopic');

    topic.addSubscription(new subs.SqsSubscription(queue));
  }
}
```

##### **Example Implementation of /test/stack.test.ts for TypeScript template**

```
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MyAppStack } from '../lib/my-app-stack';

test('SQS Queue and SNS Topic Created', () => {
  const app = new cdk.App();
  const stack = new MyAppStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::SQS::Queue', {
    VisibilityTimeoutSeconds: 300
  });

  template.hasResourceProperties('AWS::SNS::Topic', {});
});
```

##### **Example Implementation of /tsconfig.json for TypeScript template**

```
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": [
      "es2022"
    ],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "typeRoots": [
      "./node_modules/@types"
    ]
  },
  "exclude": [
    "node_modules",
    "cdk.out"
  ]
}
```

##### **Example Implementation of /.gitignore for TypeScript template**

```
*.js
!jest.config.js
*.d.ts
node_modules

# CDK asset staging directory
.cdk.staging
cdk.out
```

##### **Example Implementation of /README.md for TypeScript template**

```
# MyApp CDK App

This is a starter AWS CDK app in TypeScript.

## Getting Started

```bash
npm install
npx cdk synth
npx cdk deploy
```



#### Example of CDK Python App Template

```
my-custom-template/
└── python/
    ├── requirements.txt                           
    ├── cdk.json                                   # CDK project configuration - specifies how to run the app and stores context/feature flags
    ├── app.py                                     # App entry file
    ├── my_cdk_project/                            
    │   ├── __init__.py                            
    │   └── my_cdk_project_stack.py                # Stack class file
    ├── tests/                                     
    │   ├── __init__.py                            
    │   └── test_my_cdk_project_stack.py           # Test file
    ├── setup.py                                   
    ├── .gitignore                                 
    └── README.md                                  
```

##### **Example Implementation of /requirements.txt for Python template**

```
aws-cdk-lib==2.139.0
constructs>=10.0.0,<11.0.0
```

##### **Example Implementation of /cdk.json for Python template**

```
{
  "app": "python app.py"
}
```

##### **Example Implementation of /app.py for Python template**

```
#!/usr/bin/env python3
import aws_cdk as cdk
from my_cdk_project.my_cdk_project_stack import MyCdkProjectStack

app = cdk.App()
MyCdkProjectStack(app, "MyCdkProjectStack")
app.synth()
```

##### **Example Implementation of /my_cdk_project/__init__.py for Python template**

```
# Empty init file to define this as a Python package
```

##### **Example Implementation of /my_cdk_project/my_cdk_project_stack.py for Python template**

```
from aws_cdk import Stack
from constructs import Construct

class MyCdkProjectStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Example resource
        # from aws_cdk import aws_s3 as s3
        # s3.Bucket(self, "MyBucket", versioned=True)
```

##### **Example Implementation of /tests/__init__.py for Python template**

```
# Empty init to mark this as a test package
```

##### **Example Implementation of /tests/test_my_cdk_project_stack.py for Python template**

```
import aws_cdk as cdk
import pytest
from my_cdk_project.my_cdk_project_stack import MyCdkProjectStack

def test_stack_synthesizes():
    app = cdk.App()
    stack = MyCdkProjectStack(app, "TestStack")
    template = cdk.assertions.Template.from_stack(stack)
    assert template  # At minimum, the template exists
```

##### **Example Implementation of /setup.py for Python template**

```
import setuptools

setuptools.setup(
    name="my_cdk_project",
    version="0.1.0",
    description="A CDK Python app",
    author="your-name",
    package_dir={"": "."},
    packages=setuptools.find_packages(where="."),
    install_requires=[
        "aws-cdk-lib==2.139.0",
        "constructs>=10.0.0,<11.0.0"
    ],
    python_requires=">=3.7",
)
```

##### **Example Implementation of /.gitignore for Python template**

```
*.pyc
__pycache__/
.env
cdk.out/
*.egg-info/
*.log
.idea/
.vscode/
```

##### **Example Implementation of /README.md for Python template**

```
# My CDK Project

This is a template for an AWS CDK Python project.

## Requirements

- Python 3.7+
- AWS CDK v2

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```



#### Example of CDK Java App Template

```
my-custom-app-template/
└── java/
    ├── build.gradle                            
    ├── cdk.json                                # CDK project configuration - specifies how to run the app and stores context/feature flags
    ├── bin/
    │   └── App.java                            # CDK app entry point
    ├── lib/
    │   └── MyStack.java                        # Stack definition
    ├── test/
    │   └── MyStackTest.java                    # Stack unit test
    ├── settings.gradle                         
    ├── .gitignore                              
    └── README.md                               
```

##### **Example Implementation of /build.gradle for Java template**

```
plugins {
    id 'java'
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'software.amazon.awscdk:aws-cdk-lib:2.139.0'
    implementation 'software.constructs:constructs:10.3.0'
    testImplementation 'org.junit.jupiter:junit-jupiter-api:5.8.1'
    testRuntimeOnly 'org.junit.jupiter:junit-jupiter-engine:5.8.1'
}

test {
    useJUnitPlatform()
}
```

##### **Example Implementation of /cdk.json for Java template**

```
{
  "app": "mvn compile exec:java -Dexec.mainClass=com.example.App"
}
```

##### **Example Implementation of /bin/App.java for Java template**

```
package com.example;

import software.amazon.awscdk.App;
import software.amazon.awscdk.StackProps;

public class App {
    public static void main(final String[] args) {
        App app = new App();

        new MyStack(app, "MyJavaCdkStack", StackProps.builder().build());

        app.synth();
    }
}
```

##### **Example Implementation of /lib/MyStack.java for Java template**

```
package com.example;

import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.sqs.Queue;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.subscriptions.SqsSubscription;
import software.constructs.Construct;

public class MyStack extends Stack {
    public MyStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        Queue queue = Queue.Builder.create(this, "MyJavaQueue")
            .visibilityTimeout(Duration.seconds(300))
            .build();

        Topic topic = Topic.Builder.create(this, "MyJavaTopic").build();

        topic.addSubscription(new SqsSubscription(queue));
    }
}
```

##### **Example Implementation of /test/MyStackTest.java for Java template**

```
package com.example;

import software.amazon.awscdk.App;
import software.amazon.awscdk.assertions.Template;
import org.junit.jupiter.api.Test;

public class MyStackTest {

    @Test
    public void testStack() {
        App app = new App();
        MyStack stack = new MyStack(app, "TestStack", null);

        Template template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::SQS::Queue", 
            java.util.Map.of("VisibilityTimeout", 300));
        template.resourceCountIs("AWS::SNS::Topic", 1);
    }
}
```

##### **Example Implementation of /settings.gradle for Java template**

```
rootProject.name = 'cdk-java-app'
```

##### **Example Implementation of /.gitignore for Java template**

```
.gradle/
build/
*.class
*.log
*.jar
.idea/
.vscode/
cdk.out/
```

##### **Example Implementation of /README.md for Java template**

```
# CDK Java App Template

This is a starter AWS CDK application written in Java.

## Requirements

- Java 11+
- AWS CDK v2
- Gradle (or Maven)

## Setup

```bash
# Build the project
./gradlew build

# Synthesize CloudFormation
cdk synth

# Deploy to your AWS account
cdk deploy
```



#### Example of CDK JavaScript App Template

```
my-custom-app-template/
└── javascript/
    ├── package.json                         
    ├── cdk.json                             # CDK project configuration - specifies how to run the app and stores context/feature flags
    ├── bin/
    │   └── app.js                           # CDK app entry point
    ├── lib/
    │   └── my-stack.js                      # CDK stack definition
    ├── test/
    │   └── my-stack.test.js                 # Unit test
    ├── jsconfig.json                        
    ├── .gitignore                           
    └── README.md                            
```

##### **Example Implementation of /package.json for JavaScript template**

```
{
  "app": "node bin/app.js"
}
```

##### **Example Implementation of /cdk.json for JavaScript template**

```
{
  "name": "cdk-js-app",
  "version": "0.1.0",
  "bin": {
    "cdk-js-app": "bin/app.js"
  },
  "scripts": {
    "build": "echo 'No build step needed for plain JS'",
    "watch": "nodemon bin/app.js",
    "test": "jest"
  },
  "dependencies": {
    "aws-cdk-lib": "2.139.0",
    "constructs": "^10.3.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "aws-cdk-lib/assertions": "2.139.0"
  },
  "type": "module"
}
```

##### **Example Implementation of /bin/app.js for JavaScript template**

```
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyStack } from '../lib/my-stack.js';

const app = new cdk.App();
new MyStack(app, 'MyJsCdkStack');
```

##### **Example Implementation of /lib/my-stack.js for JavaScript template**

```
import { Stack, Duration } from 'aws-cdk-lib';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

export class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const queue = new Queue(this, 'MyJsQueue', {
      visibilityTimeout: Duration.seconds(300)
    });

    const topic = new Topic(this, 'MyJsTopic');

    topic.addSubscription(new SqsSubscription(queue));
  }
}
```

##### **Example Implementation of /test/my-stack.test.js for JavaScript template**

```
import { App, assertions } from 'aws-cdk-lib';
import { MyStack } from '../lib/my-stack.js';

test('SQS Queue and SNS Topic Created', () => {
  const app = new App();
  const stack = new MyStack(app, 'TestStack');

  const template = assertions.Template.fromStack(stack);

  template.hasResourceProperties('AWS::SQS::Queue', {
    VisibilityTimeout: 300
  });

  template.resourceCountIs('AWS::SNS::Topic', 1);
});
```

##### **Example Implementation of /jsconfig.json for JavaScript template**

```
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "node",
    "checkJs": true,
    "allowJs": true
  },
  "exclude": ["node_modules", "cdk.out"]
}
```

##### **Example Implementation of /.gitignore for JavaScript template**

```
node_modules/
cdk.out/
*.log
*.tsbuildinfo
.idea/
.vscode/
```

##### **Example Implementation of /README.md for JavaScript template**

```
# CDK JavaScript App

This is a template for an AWS CDK application written in JavaScript (ES modules).

## Requirements

- Node.js 18+
- AWS CDK v2

## Setup

```bash
npm install
```



#### Example of CDK C Sharp App Template

```
my-custom-app-template/
└── csharp/
    ├── MyCdkApp.csproj                      
    ├── cdk.json                             # CDK project configuration - specifies how to run the app and stores context/feature flags
    ├── bin/                                 
    │   └── Program.cs                       # CDK app entry point
    ├── lib/                                 
    │   └── MyCdkAppStack.cs                 # Stack class
    ├── test/                                
    │   ├── MyCdkApp.Tests.csproj            
    │   └── MyCdkAppTests.cs                 # Test class
    ├── .gitignore                           
    └── README.md                            
```

##### **Example Implementation of /MyCdkApp.csproj for C Sharp template**

```
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <RootNamespace>MyCdkApp</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Amazon.CDK" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SQS" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SNS" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SNS.Subscriptions" Version="2.139.0" />
  </ItemGroup>

</Project>
```

##### **Example Implementation of /cdk.json for C Sharp template**

```
{
  "app": "dotnet run --project bin/Program.cs"
}
```

##### **Example Implementation of /bin/Program.cs for C Sharp template**

```
using Amazon.CDK;
using MyCdkApp;

var app = new App();
new MyCdkAppStack(app, "MyCdkAppStack");
app.Synth();
```

##### **Example Implementation of /lib/MyCdkAppStack.cs for C Sharp template**

```
using Amazon.CDK;
using Amazon.CDK.AWS.SQS;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SNS.Subscriptions;

namespace MyCdkApp
{
    public class MyCdkAppStack : Stack
    {
        internal MyCdkAppStack(Construct scope, string id, IStackProps? props = null)
            : base(scope, id, props)
        {
            var queue = new Queue(this, "MyCdkQueue", new QueueProps
            {
                VisibilityTimeout = Duration.Seconds(300)
            });

            var topic = new Topic(this, "MyCdkTopic");

            topic.AddSubscription(new SqsSubscription(queue));
        }
    }
}
```

##### **Example Implementation of /test/MyCdkApp.Tests.csproj for C Sharp template**

```
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Amazon.CDK" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SQS" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SNS" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SNS.Subscriptions" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.Assertions" Version="2.139.0" />
    <PackageReference Include="xunit" Version="2.4.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.4.5" />
  </ItemGroup>

</Project>
```

##### **Example Implementation of /test/MyCdkAppTests.cs for C Sharp template**

```
using Amazon.CDK;
using Amazon.CDK.Assertions;
using Xunit;
using MyCdkApp;

namespace MyCdkApp.Tests
{
    public class MyCdkAppTests
    {
        [Fact]
        public void SQSQueueCreated()
        {
            var app = new App();
            var stack = new MyCdkAppStack(app, "TestStack");

            var template = Template.FromStack(stack);

            template.HasResourceProperties("AWS::SQS::Queue", new Dictionary<string, object>
            {
                ["VisibilityTimeout"] = 300
            });
        }
    }
}
```

##### **Example Implementation of /.gitignore for C Sharp template**

```
bin/
obj/
cdk.out/
*.user
*.suo
*.DotSettings.user
```

##### **Example Implementation of /README.md for C Sharp template**

```
# CDK C# App Template

This is a starter AWS CDK project written in C#.

## Requirements

- [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
- AWS CDK v2

## Install Dependencies

```bash
dotnet restore
```



#### Example of CDK F Sharp App Template

```
my-custom-app-template/
└── fsharp/
    ├── MyCdkApp.fsproj                       
    ├── cdk.json                              # CDK project configuration - specifies how to run the app and stores context/feature flags
    ├── bin/                                  
    │   └── Program.fs                        # Entry point file
    ├── lib/                                  
    │   └── MyCdkAppStack.fs                  # Stack class file
    ├── test/                                 
    │   ├── MyCdkApp.Tests.fsproj             
    │   └── MyCdkAppTests.fs                  # Test file
    ├── .gitignore                            
    └── README.md                             
```

##### **Example Implementation of /MyCdkApp.fsproj for F Sharp template**

```
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <RootNamespace>MyCdkApp</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Amazon.CDK" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SQS" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SNS" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.AWS.SNS.Subscriptions" Version="2.139.0" />
  </ItemGroup>

</Project>
```

##### **Example Implementation of /cdk.json for F Sharp template**

```
{
  "app": "dotnet run --project bin/Program.fs"
}
```

##### **Example Implementation of /bin/Program.fs for F Sharp template**

```
open Amazon.CDK
open MyCdkApp

[<EntryPoint>]
let main argv =
    let app = App()
    MyCdkAppStack(app, "MyCdkAppStack") |> ignore
    app.Synth() |> ignore
    0
```

##### **Example Implementation of /lib/MyCdkAppStack..fs for F Sharp template**

```
namespace MyCdkApp

open Amazon.CDK
open Amazon.CDK.AWS.SQS
open Amazon.CDK.AWS.SNS
open Amazon.CDK.AWS.SNS.Subscriptions

type MyCdkAppStack(scope: Construct, id: string, ?props: IStackProps) as this =
    inherit Stack(scope, id, defaultArg props null)

    let queue = Queue(this, "MyCdkQueue", QueueProps(VisibilityTimeout = Duration.Seconds(300.0)))

    let topic = Topic(this, "MyCdkTopic")

    do topic.AddSubscription(SqsSubscription(queue)) |> ignore
```

##### **Example Implementation of /test/MyCdkApp.Tests.fsproj for F Sharp template**

```
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Amazon.CDK" Version="2.139.0" />
    <PackageReference Include="Amazon.CDK.Assertions" Version="2.139.0" />
    <PackageReference Include="xunit" Version="2.4.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.4.5" />
  </ItemGroup>

</Project>
```

##### **Example Implementation of /test/MyCdkAppTests.fs for F Sharp template**

```
test/MyCdkAppTests.fs
fsharp
Copy
Edit
namespace MyCdkApp.Tests

open Xunit
open Amazon.CDK
open Amazon.CDK.Assertions
open MyCdkApp
open System.Collections.Generic

type MyCdkAppTests() =

    [<Fact>]
    member _.``SQS Queue Created``() =
        let app = App()
        let stack = MyCdkAppStack(app, "TestStack")
        let template = Template.FromStack(stack)

        let expected = Dictionary<string, obj>()
        expected.Add("VisibilityTimeout", box 300)
```

##### **Example Implementation of /.gitignore for F Sharp template**

```
bin/
obj/
cdk.out/
*.fsproj.user
.vscode/
```

##### **Example Implementation of /README.md for F Sharp template**

```
# CDK F# App Template

A starter AWS CDK application written in F#.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
- AWS CDK v2

## Install Dependencies

```bash
dotnet restore
```



#### Example of CDK Go App Template

```
my-custom-app-template/
└── go/
    ├── go.mod                               
    ├── cdk.json                             # CDK project configuration - specifies how to run the app and stores context/feature flags
    ├── bin/                                 
    │   └── main.go                          # Entry file
    ├── lib/                                 
    │   └── my_cdk_app_stack.go              # Stack class file
    ├── test/                                
    │   └── my_cdk_app_test.go               # Test file
    ├── .gitignore                           
    └── README.md                            
```

##### **Example Implementation of /go.mod for Go template**

```
module mycdkapp

go 1.21

require (
    github.com/aws/aws-cdk-go/awscdk/v2 v2.139.0
)
```

##### **Example Implementation of /cdk.json for Go template**

```
{
  "app": "go run ./bin/main.go"
}
```

##### **Example Implementation of /bin/main.go for Go template**

```
package main

import (
    "mycdkapp/lib"
    "github.com/aws/aws-cdk-go/awscdk/v2"
)

func main() {
    app := awscdk.NewApp(nil)

    lib.NewMyCdkAppStack(app, "MyCdkAppStack", &awscdk.StackProps{})

    app.Synth(nil)
}
```

##### **Example Implementation of /lib/my_cdk_app_stack.go for Go template**

```
package lib

import (
    "github.com/aws/aws-cdk-go/awscdk/v2"
    "github.com/aws/aws-cdk-go/awscdk/v2/awsqueue"
    "github.com/aws/aws-cdk-go/awscdk/v2/awssns"
    "github.com/aws/aws-cdk-go/awscdk/v2/awssnssubscriptions"
    "github.com/aws/constructs-go/constructs/v10"
)

type MyCdkAppStackProps struct {
    awscdk.StackProps
}

func NewMyCdkAppStack(scope constructs.Construct, id string, props *awscdk.StackProps) awscdk.Stack {
    stack := awscdk.NewStack(scope, &id, props)

    queue := awsqueue.NewQueue(stack, jsii.String("MyCdkQueue"), &awsqueue.QueueProps{
        VisibilityTimeout: awscdk.Duration_Seconds(jsii.Number(300)),
    })

    topic := awssns.NewTopic(stack, jsii.String("MyCdkTopic"), nil)

    topic.AddSubscription(awssnssubscriptions.NewSqsSubscription(queue, nil))

    return stack
}
```

##### **Example Implementation of /test/my_cdk_app_test.go for Go template**

```
package test

import (
    "testing"
    "github.com/aws/aws-cdk-go/awscdk/v2/assertions"
    "github.com/aws/aws-cdk-go/awscdk/v2"
    "mycdkapp/lib"
)

func TestMyCdkAppStack(t *testing.T) {
    app := awscdk.NewApp(nil)
    stack := lib.NewMyCdkAppStack(app, "TestStack", &awscdk.StackProps{})
    template := assertions.Template_FromStack(stack)

    template.HasResourceProperties(jsii.String("AWS::SQS::Queue"), map[string]interface{}{
        "VisibilityTimeout": float64(300),
    })
}
```

##### **Example Implementation of /.gitignore for Go template**

```
cdk.out/
*.test
vendor/
```

##### **Example Implementation of /README.md for Go template**

```
# CDK Go App Template

A starter AWS CDK application written in Go.

## Prerequisites

- [Go 1.21+](https://go.dev/dl/)
- AWS CDK v2

## Setup

```bash
go mod tidy
```

