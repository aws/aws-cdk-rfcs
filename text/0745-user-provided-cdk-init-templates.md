# RFC: User-Provided `cdk init` Templates

* Original Author(s):: @rohang9000
* Tracking Issue: #745
* API Bar Raiser: @iliapolo


CDK customers need a way to use and author custom templates for `cdk init` to meet specific technical/regulatory requirements and standardize project initialization.


## Working Backwards

This section of the RFC addresses both users who will use custom templates to initialize a CDK project through the `cdk init` command and authors of such custom templates.


### CHANGELOG

```
feat(cli): custom cdk init templates
```



### Updated README for Users of CDK CLI

NOTE: All sections prior to and after `cdk init` within the existing README remain the same.


#### `cdk init`

Creates a new CDK project from built-in templates or custom templates. This command helps you get started with AWS CDK by initializing a new project with the necessary files and folders to organize your CDK code, including directories for your application definition, stacks, and constructs.


#### Getting Started with Built-in Templates

The CDK provides three built-in templates to help you get started quickly:

1. `app` - CDK Application Template

    * Creates a basic deployable CDK application structure
    * Includes a sample stack with basic setup
    * Available in: TypeScript, JavaScript, Python, Java, C#, F#, Go

1. `lib` - CDK Construct Library Template

    * Creates a reusable construct library
    * For building and sharing custom CDK constructs
    * Includes testing setup and publishing configuration
    * Available in: TypeScript

1. `sample-app` - Example CDK Application

    * Creates a CDK application with example constructs
    * Demonstrates common AWS services and patterns
    * Great for learning CDK concepts
    * Available in: TypeScript, JavaScript, Python, Java, C#, F#, Go

##### Basic Usage of Built-In Templates

```
# List all available templates and supported languages
$ cdk init --list
Available templates:
* app: Template for a CDK Application
   └─ cdk init app --language=[csharp|fsharp|go|java|javascript|python|typescript]
* lib: Template for a CDK Construct Library
   └─ cdk init lib --language=typescript
* sample-app: Example CDK Application with some constructs
   └─ cdk init sample-app --language=[csharp|fsharp|go|java|javascript|python|typescript]

# Create a new TypeScript application
$ cdk init app --language=typescript

# Create a construct library
$ cdk init lib --language=typescript

# Create a sample application to explore CDK features
$ cdk init sample-app --language=typescript
```



#### Working with Custom Templates

For more advanced use cases, you can use custom templates from local directories, Git repositories, or NPM packages to:

* Standardize project structure across your organization
* Include company-specific configurations and best practices
* Pre-configure common services and patterns

NOTE: [This](#authoring-custom-cdk-templates) is what a custom template directory needs to looks like before running `cdk init`.

##### Using Local Custom Templates

Create projects from a custom template stored locally on your filesystem:

```
# Use a local template directory path
$ cdk init --template-path ./my-cdk-template --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

[This](#project-file-structure-after-running-cdk-init) is how your project’s file structure should look after running `cdk init` in a target directory called “my-cdk-project”.

##### Using Git Repository Templates

Create projects with templates pulled from Git repositories (GitHub, GitLab, Bitbucket, etc.):

```
# Use specific template from Git repository of many templates
$ cdk init --git-url [URL] --template-name [name] --language=[csharp|fsharp|go|java|javascript|python|typescript]

# If Git repository only contains one template, don't need to specify template name
$ cdk init --git-url [URL] --language=[csharp|fsharp|go|java|javascript|python|typescript]

# If template contains only one language, don't need to specify language
$ cdk init --git-url [URL] --template-name [name]

# Examples:
# Using GitHub URL
$ cdk init --git-url https://github.com/username/my-cdk-templates.git --language=[csharp|fsharp|go|java|javascript|python|typescript]

# Using BitBucket URL
$ cdk init --git-url https://bitbucket.org/username/my-cdk-templates.git --language=[csharp|fsharp|go|java|javascript|python|typescript]
```

[This](#project-file-structure-after-running-cdk-init) is how your project’s file structure should look after running `cdk init` in a target directory called “my-cdk-project”.

#### Using NPM Package Templates

Create projects with templates pulled from NPM packages (on [npmjs.com](http://npmjs.com/) or any registry that hits NPM endpoint):

```
# Use specific template from NPM package with many templates
$ cdk init --npm-package [package-name] --template-name [name] --language=[csharp|fsharp|go|java|javascript|python|typescript]

# If NPM package only contains one template, don't need to specify template name
$ cdk init --npm-package [package-name] --language=[csharp|fsharp|go|java|javascript|python|typescript]

# Examples:
# Using specific template from NPM package
$ cdk init --npm-package my-cdk-templates --template-name my-template --language=typescript

# Using NPM package with single template
$ cdk init --npm-package my-cdk-template --language=typescript
```

[This](#project-file-structure-after-running-cdk-init) is how your project’s file structure should look after running `cdk init` in a target directory called “my-cdk-project”.

##### Project File Structure After Running `cdk init` 

```
my-cdk-project/
├── bin/       # Entry point for your CDK app
│   └── mycdk-project         # language-specific file that instantiates new CDK app, creates your stack, adds it to your app, and gives the stack an ID
├── lib/       # Stack definitions and constructs
│   └── my-cdk-project-stack  # language-specific file that defines CDK stack class where you define your AWS resources (S3 Buckets, Lambda functions, etc))
├── test/      # CDK Unit tests
│   └── my-cdk-project.test   # language-specific file that verifies your infrastructure code generates the expected CloudFormation resources
├── cdk.json   # CDK configuration file that specifies how to run your app
├── README.md  # Project documentation
└── # language-specific dependency management, language configuration, and testing configuration files
```

##### Troubleshooting

If a custom template fails to load, the CLI will throw an error. Below are some basic troubleshooting steps for possible error scenarios associated with using custom templates:

###### Template not found:

    * Verify the path/URL/package name is correct and public

###### Permission errors:

    * Ensure you have write permissions in the target directory running `cdk init`
    * Check that the template files have appropriate permissions



#### Advanced Options

```
# Generate only (skip dependency installation and git initialization)
$ cdk init app --language=typescript --generate-only

# Use a specific CDK library version
$ cdk init app --language=typescript --lib-version 2.100.0

# Combine both options
$ cdk init app --language=typescript --generate-only --lib-version 2.100.0

# Works with custom templates too
$ cdk init --git-url https://github.com/user/my-template.git --generate-only
$ cdk init --npm-package @myorg/template --lib-version 2.100.0
```



### Authoring Custom CDK Templates

The requirements for a custom template, which are validated by the CLI, are that it contains at least one CDK supported language subdirectory and an info.json file which serves as the template’s metadata definition. Here are a few example templates to reference: https://github.com/aws/aws-cdk-cli/tree/main/packages/aws-cdk/lib/init-templates


#### Example Structure of Custom Template

```
my-custom-template/
├── info.json                 # Template metadata
└── [language]/               # Language directory
    ├── bin/                  # The CDK app entry point
    ├── lib/                  # Contains CDK stack definitions and constructs
    └── cdk.template.json     # CDK configuration with placeholders
└── [language]/               # Language directory
    ├── bin/                  # The CDK app entry point
    ├── lib/                  # Contains CDK stack definitions and constructs
    └── cdk.template.json     # CDK configuration with placeholders
```

##### **Example info.json for TypeScript template**

```
{
    "description": "My Organization's CDK Template",
    // can run cdk init command with these alternate names for same template
    "aliases": ["org-template", "company"] 
}
```

##### **Example /bin/%name%.template.ts for TypeScript template**

```
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { %name.PascalCased%Stack } from '../lib/%name%-stack';

const app = new cdk.App();
new %name.PascalCased%Stack(app, '%stackname%');
```

##### **Example /lib/%name%-stack.template.ts for TypeScript template**

```
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class %name.PascalCased%Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, '%name.PascalCased%Queue', {
      visibilityTimeout: Duration.seconds(300)
    });

    const topic = new sns.Topic(this, '%name.PascalCased%Topic');

    topic.addSubscription(new subs.SqsSubscription(queue));
  }
}
```

##### **Example /cdk.template.json for  TypeScript template**

```
{
  "app": "npx ts-node --prefer-ts-exts bin/%name%.ts",
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



#### Using Placeholder or Template Variables for Consistent Naming of Template Components

As described in the above examples, the `cdk init` command supports defining custom template components using the `%name.PascalCased%` placeholder or template variable to dynamically insert user determined template file names into generated CDK project files. Below is a breakdown of placeholder or template variables terminology:

* **%...%:** The percent signs indicate a template token that will be replaced during code generation.
* **name:** This refers to a variable input which will be the name of your CDK project’s target directory.
* .**PascalCased:** This is a transformation function that converts the string into PascalCase


Ticking the box below indicates that the public API of this RFC has been signed-off by the API bar raiser (the `status/api-approved` label was applied to the RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```



## Public FAQ

### What are we launching today?

A new feature in the AWS CDK CLI that enables users to use custom templates for project initialization from local files, Git repositories, or NPM packages.

### Why should I use this feature?

* Be able to use custom components and configurations by default
* Share templates for specific use cases through repository or NPM package



## Internal FAQ

### Why are we doing this?

Users are currently limited to three built-in templates. Organizations need custom templates to:

* Quickly create CDK projects with specific components and requirements and reduce setup time

### Why should we *not* do this?

* Increased CLI complexity

### What is the technical solution (design) of this feature?

Extend `cdk init` with:

1. Custom template source options (local/Git Repo/NPM) with all CDK supported languages
2. Simple CLI syntax for users to run `cdk init` commands with custom templates
3. Custom template validation to ensure a valid CDK project can be initialized
4. Initialize project using custom template

### Is this a breaking change?

No, the new feature does not affect existing functionality for creating CDK projects using built-in template options.

### What alternative solutions did you consider?

1. Alternatives for supporting custom templates for `cdk init`
    1. Expanded template registry that users can choose from beyond the three built-in templates
2. Alternatives for Consistent Naming of Template Components
    1. Current CDK Approach: %name.PascalCased%
        1. Pros: 
            1. Already works for built-in templates
                1. Proven in production with minimal maintenance 
            2. Independent of template users
                1. Uses the `cdk init` context (like project folder name), so no user input required.
            3. Easy format for template authors to use
                1. Simple substitution syntax with no setup or tooling required.
            4. No external dependencies
                1. Entire process is handled within CDK so reduced risk of integration issues
        2. Cons:
            1. Limited to filename and file content replacement
                1. Does not provide interactive prompts or advanced templating logic like Yeoman
            2. Only helps template authors, not users
                1. Does not provide a better UX for users who want to customize scaffolding more granularly
            3. Template customization beyond naming is hard (ie, customizing generated README)
    2. npm-init
        1. Pros:
            1. Easy publishing to npm
                1. Streamlines creating package.json, making it quicker to publish templates as npm packages.
            2. Uses existing npm infrastructure
                1. No need to learn new package systems.
        2. Cons:
            1. Limited to scaffolding metadata
                1. Only generates package.json, doesn’t solve the actual template generation or naming
            2. Not template-aware
                1. Doesn’t provide mechanisms for substituting template variables or scaffolding logic.
            3. Requires manual integration with CDK templating logic
                1. Adds a step but doesn't integrate directly with CDK’s project generation lifecycle.
    3. Yeoman Generator
        1. Pros:
            1. Highly customizable scaffolding logic
                1. Enables conditional file inclusion, dynamic file naming, and complex transformations based on user input beyond static substitution like %name.PascalCased%.
            2. Interactive CLI experience for users
                1. Users can be prompted during `cdk init` to select options, allowing a single generator to produce many variations of a template.
            3. Facilitates reusable and adaptable enterprise templates
                1. Organizations can standardize internal CDK setups with customizable templates that adjust based on use case
            4. Supports post-processing automation
                1. After scaffolding, Yeoman can automatically run `npm install`, initialize Git, and add license headers
        2. Cons:
            1. Increased complexity and learning curve
                1. CDK users would need to install and learn Yeoman
                2. Template authors must write JS-based generators instead of simple file templates
            2. External dependency
                1. Relies on the Yeoman runtime and ecosystem so CDK loses control over some UX
                2. Added maintenance risk from external changes
            3. Not natively integrated into CDK CLI
                1. `cdk init` logic needs to be updated to recognize and delegate to Yeoman generators
                2. Makes CDK’s bootstrapping process more complex
            4. Overkill for simple use cases
                1. Most CDK users just want to get started quickly
                2. %name.PascalCased% and static templates are sufficient
    4. Projen
        1. Pros: 
            1. Controlled and maintained by AWS
                1. Easier to add CDK specific behaviors
            2. Automates common setup tasks (like linting, testing, and publishing configs)
                1. Template authors don’t have to maintain those manually across many templates.
            3. One Projen-based template can generate consistent setups across different language targets.
        2. Cons: 
            1. Steep learning curve
                1. Template authors must understand how Projen works, including its configuration language
            2. Templates are code, not files
                1. Instead of writing/copying static template files, template authors must write Projen config code that generates those files.
            3. Generated files are not meant to be edited
                1. Generated files are overwrited on every synth, so template users should only modify the config and not the output file
            4. Harder to preview template
                1. Since the actual files aren’t visible until you run `projen synth`, don’t initially know what the final output will look like.
                2. Can slow down the template authoring and review process.

### What are the drawbacks of this solution?

1. Can't ensure template quality without good validation (burden is on the template author)
2. Increased CLI complexity

### What is the high-level project plan?

* Phase 1: Basic support

    1. Support for custom templates through local files, Git repositories, and NPM packages
    2. Basic CDK supported language type validation and error handling

* Phase 2: Multi-language support

    1. Extend support for C#, F#, Go, Java, JavaScript, and Python
    2. Enhance template validation to check info.json file for name identifiers when selecting between multiple templates in a Git repository or NPM package

* Phase 3: Support for additional methods of passing in custom templates from community

    1. Support for passing in all types of NPM packages such as:
        1. a folder containing a program described by a package.json file
        2. a gzipped tarball containing (i)
        3. a url that resolves to (ii)
        4. a <name>@<version> that is published on the registry (see registry) with (iii)
        5. a <name>@<tag> (see npm dist-tag) that points to (iv)
        6. a <name> that has a "latest" tag satisfying (v)
        7. a <git remote url> that resolves to (i)
    2. If a customer wants to use an internal company repository or package manager (GitFarm, CodeArtifact, etc)

* Phase 4: Documentation and testing
    * Create documentation for template authors
    * Create documentation for CDK customers
    * Develop unit and integration tests

### Are there any open issues that need to be addressed later?

1. Publish sample templates on GitHub or NPM for template authors to reference when creating
2. Allow users to specify template version for Git repos and NPM packages
3. Integrate CDK CLI telemetry to track which sources for custom templates are used and how often

## Appendix