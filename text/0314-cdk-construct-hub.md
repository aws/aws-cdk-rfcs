---
rfc pr: [#314](https://github.com/aws/aws-cdk-rfcs/pull/314)
tracking issue: https://github.com/aws/aws-cdk-rfcs/issues/yyy
---

# Construct Hub

A community-driven hub for discovering and sharing CDK constructs.

## Working Backwards

### PRESS RELEASE

Today, Amazon Web Services Inc., an Amazon company, announced the CDK Construct
Hub, a service that makes it easy to find AWS Cloud Development Kit (CDK)
constructs and provides a centralized documentation experience for those. CDK
Construct Hub automatically indexes custom construct libraries as soon as they
are published, without requiring any additional effort from the author. The AWS
CDK makes it easy for customers to build applications by raising the level of
abstraction of infrastructure components, and Construct Hub makes it easy to
discover, use and share custom-made constructs. To get started with CDK
Construct Hub, visit `${TBD}`.

Construct Hub offers an integrated search experience, allowing customers to
easily find the right construct for their need. The built-in multi-language
documentation helps customers understand what features are available, and learn
how to correctly use the constructs in their chosen programming language.

The Construct Hub itself is developed as an open-source construct: members
of CDK community can freely participate in the development of the service.
Customers with specific needs are also able to deploy a private instance of the
Construct Hub, and integrate it with their package management solution.

## FAQ

### What are we launching today?

Construct Hub is a new website that makes it easy for developers to
discover, use, and share CDK constructs that encapsulate cloud infrastructure
patterns. The community has already published hundreds of CDK constructs on the
public registries like npmjs.com, PyPI, Maven Central, and NuGet. However those
are distributed repositories, managed by numerous organizations, and lack
centralized search tools sufficient for developers to easily find the cloud
infrastructure patterns they are looking for, in the programming language they
want to use.

Construct Hub automatically indexes all CDK construct libraries published to
the various general purpose package managers, so that developers have a single
place to search for constructs, regardless of preferred programming language or
provisioning engine. Developers will find constructs published by AWS, partners,
and individual developers. CDK Constuct Hub also generates unified documentation
for the constructs in all supported programming languages.

Construct Hub is also available as a deploymable CDK construct library, so
that enterprises and users with specific needs can host a private instance of
the catalog, making interally developed constructs easier for teams to find.
Just like the public instance of Construct Hub scans public repositories for
construct libraries, the private Construct Hub instance can be configured to
scan private repositories like AWS CodeArtifact, JFrog Artifactory, and others.

### Why should I use this feature?

The Construct Hub is a centralized place that helps discover and share
custom-made constructs compatible with the AWS Cloud Development Kit (CDK), CDK
for Kubernetes (CDK8s), or CDK for Terraform (CDKtf). It shortens the time it
takes to ship cloud applications by allowing developers to discover constructs
that address their infrastructure requirements, and provides a unified
cross-language documentation experience to help developers integrate those
constructs into their application.

Customers can also deploy a private instance of Construct Hub to facilitate
sharing infrastructure abstractions published to a private package registry
within the organization.

### Where can I find the Construct Hub?

The public instance of Construct Hub is at: `${TBD}`.

### How do I publish a package to Construct Hub?

Packages published to the public npm registry (npmjs.com) are automatically
indexed by the public instance of Construct Hub as long as they meet the
following prerequisites:

1. Cross-language support has been configured correctly using [jsii]
1. The `cdk` keyword is referenced (in the `keywords` key of `package.json`)

[jsii]: https://aws.github.io/jsii

### Can I opt packages out of the public instance of Construct Hub?

There is currently no self-service way to un-list a package from the CDK
Construct Hub. If you would like your package to be removed from the public
instance of Construct Hub, please file an issue in GitHub. You will be
required to prove ownership of the package(s) you are requesting un-listing for.

### Can I trust all constructs listed on Construct Hub?

Construct Hub does not perform a comprehensive audit of packages it indexes.
You should not trust packages found via the Construct Hub any differently
from packages found via other package search tools or registries, such as
npmjs.com, Maven Central, PyPI, NuGet, etc.

## Specification

### Landing Page

> [Example rendering](#rendering-landing-page)

The landing page for the Construct Hub includes a search bar that allows
developers to search for constructs that solve their use-case using relevant
keywords, and optionally filtering on a specific programming language and CDK
flavor (AWS CDK / CDK8s / CDKtf).

It may also feature a short-list of packages, selected based on popularity or
latest release date.

### Search Results Page

When a search is performed using the search bar in the landing page (or in the
header of all other pages), a list of relevant results is displayed as tiles,
similar to the short-list of packages shown on the landing page.

### Package Detail Page

> [Example rendering](#rendering-package-detail-page)

Clicking on a given package's tile in the landing page or search result page
brings the user to a package detail page that represents the following
information:

- Package name, tags, and description
- Overview of publishing information (author, version, license, etc...)
  - Where possible, links to the source repository, issue tracker, etc...
- Install instructions
- Available languages
- Package's documentation
  - Rendered content of the package's `README.md`
  - API reference documentation, in all supported languages

The list of available languages is also a selector: upon clicking a language,
the installation instructions and documentation automatically switch to the
relevant form for the currently selected language.

### Support

The Construct Hub offers ways for customers to engage maintainers about
various problems, including the following:

- A malicious package was identified
- Incorrectly rendered documentation
- Package un-listing request

When a contact request originates from a package detail page, the customer is
guided to the package's issue tracker or public repository if their issue is
with the package itself (and not about it's listing in Construct Hub).

## Technical Design

### What is the high level implementation plan?

#### Overview

The Construct Hub is a relatively simple static web application. While the
dataset it exposes (all CDK Construct Libraries) may be relatively fast moving,
there is no necessity for newly published packages (or versions thereof) to be
indexed and presented on the application particularly quickly. A consistency
window between a couple of hours and a day is probably acceptable.

A simple data pipeline will ingest package publication events created by a
source-specific adapter (e.g: by polling on the CouchDB instance replica for the
[npmjs.com registry](https://skimdb.npmjs.com/registry)), and produce static
artifacts the website is based off of. This pipeline is in particular
responsible for extracting the `.jsii` assembly file from the npm packages, and
to prefetch all information necessary to back the webiste's search and package
detail pages.

#### Back-End

1. The back-end for Construct Hub starts with a custom-built event source,
   which implements the logic necessary to detect new packages that are relevant
   to the Construct Hub, and sends messages to an SQS queue for further
   processing. Notifications have the following attributes:

   Name        | Description
   ------------|----------------------------------------------------------------
   `assembly`  | The `.jsii` assembly included in the package
   `time`      | The timestamp at which the version was created
   `integrity` | An integirity check for the complete record

   In cases where the `assembly` object is too large, it may be staged in S3
   instead of being sent directly as part of the message payload. In such cases,
   the `assembly` field contains an S3 URI instead of a JSON object.

1. A Lambda function then picks up messages from the SQS queue and prepares the
   artifacts consumed by the front-end application, stored in a dedicated S3
   bucket using the following key format:
   `assemblies/${assembly.name}/v${assembly.version}/assembly.json`

   This function validates the contents of the `assembly` to ensure the message
   was well-formed. In case the message is found to be incoherent, it is sent to
   a dead-letter queue and an alarm is triggered.

   It also creates or updates the `assemblies/${assembly.name}/versions.json`
   object, which contains a list of all versions ever indexed for the package,
   matched to the versions' current status (`deprecated`, `latest`, ...):

   Name        | Description
   ------------|----------------------------------------------------------------
   `v${major}` | All versions part of this major version stream, and their status

   [SemVer]: https://semver.org/spec/v2.0.0.html

1. A series of Lambda functions prepare language-specific assembly files for
   each configured language, with adjusted naming conventions, and updated
   sample code fragments, and proceeds to store those at:
   `assemblies/${assembly.name}/v${assembly.version}/assembly-${lang}.json`.
   This transformation is backed by the `jsii-rosetta` tool, which is part of
   the [jsii project][jsii].

   [jsii]: https://aws.github.io/jsii

1. A Lambda function keeps the `latest.json` object updated with the last 20
   package versions indexed (according to the `time` field reported by the
   ingestion component).

1. A Lambda function keeps the `catalog.json` object updated with the latest
   versions of each package's major version lines, which backs the websites'
   search page. The object may be sharded if it becomes too large.

#### Front-End

The front-end consists in a simple [React] application hosted in an S3 bucket.
A CloudFront distribution fronts this application, ensuring it is served from
edge locations close to any customer, and binding together the static assets
that compose the application and the data objects maintained by the back-end
pipeline.

1. The landing page asynchronously loads the `latest.json` object to render the
   "latest" tiles, containing the short-list of packages that changed most
   recently.

1. The search feature asynchronously loads the `catalog.json` object, and
   performs client-side filtering to prepare search results.

1. Package detail pages fetch the relevant `assembly.json` object from the
   assembly store, and renders the detail page using information contained
   therein.

   - If a different language (than JavaScript) is selected, the
     `assembly-${lang}.json` object is fetched instead, providing the relevant
     documentation elements. In the event that object is not available yet, a
     message will be displayed instead, instructing the user to try again later.

[react]: https://reactjs.org

#### Construct Packaging

The Construct Hub is to be created as a reusable construct, including all
necessary components of the application. The public instance of CDK Construct
Hub will simply be an AWS-Managed instance of that, which feeds from packages
published to the [npm registry](https://npmjs.com).

It will expose a simple API: a `ConstructHub` class will be the main entry point
to the application, with the following configuration properties:

Name         | Description
-------------|------------------------------------------------------------------
`dnsName`    | The DNS name to use for hosting the Construct Hub instance
`pathPrefix` | The URL prefix for the Construct Hub hosting

It exposes the following attributes, to allow integrations to operate correctly:

Name                | Description
--------------------|-------------------------------------------------------------------------------
`ingestionQueueUrl` | The URL of the SQS queue where ingestion messages should be sent
`ingestionRoleArn`  | The IAM role used to process input payloads (and read S3 staged objects)
`ingestionDlqArn`   | The ARN of the ingestion pipeline's dead letter queue

### Are there any open issues that need to be addressed later?

- When the catalog becomes too large to be convenient to process in-memory on
  the client-side, it may need to be sharded, or the search feature may need to
  be re-done as a dynamic back-end service. A prototype shows that 409 packages
  amount to about `913,86 KiB` of un-compressed JSON-encoded data, which reduces
  to `71.53 KiB` when compressed using the `gzip` algorithm. This means each
  package would consume about `2.23 KiB` of un-compressed data, and results in
  an additional `0.17 KiB` to effectively transfer.

- Generation of per-language documentation may become prohibitively expensive,
  and it may be interesting to only generate language-specific documentation
  once a customer has expressed interest in it.

- Generated documentation will eventually benefit from cross-linking API
  elements across indexed libraries. All the necessary information is present
  (the `assembly.json` object includes a `dependencies` section).

## Appendix

### Rendering: Landing Page

> Note: the actual page design may differ.

![Landing Page](../images/cdk-construct-hub/landing-page.png)

### Rendering: Package Detail Page

> Note: the actual page design may differ.

![Package Detail Page](../images/cdk-construct-hub/detail-page.png)
