---
feature name: CDK Metadata v2
start date: 2020-09-23
rfc pr: (leave this empty)
related issue: #253
---

# Summary

The CDK Metadata resource used to report library versions, but once we move
to a single library this will no longer yield the desired granularity of
reporting.

Instead, the metadata resource will start reporting individual constructs
used in a Stack's synthesis.

For every construct used in a Stack from a library containing a
`cdk-metadata.json` file, we will collect the library name, version and
qualified class name (using a generated lookup table to obtain submodule
names) and submit these to the metadata service in a gzipped blob.

# Background

CDK stack templates contain a Metadata resource that reports information about the
construct libraries used in the CDK application that synthesized the templates.

The goal of CDK Metadata is twofold:

* Track what library versions customers are using, so that if there are severe (security)
  problems with a library, we can contact them in a targeted fashion and suggest
  they upgrade.
* Get business metrics on the adoption of CDK and its libraries. This includes # of accounts,
  \# of stacks, upgrade speed, popular construct libraries, etc.

We only collect this information for AWS-vended libraries, and customers can
opt out of the generation of this Metadata resource (and hence the collection
of their metrics).

# Motivation

The current CDK Metadata is based on libraries loaded into the NodeJS process. When
we move to CDK v2, the entire CDK library will be vended as one library, destroying
our ability to measure in the same way.

At the same time, our current method fails in the face of multiple distinct
stacks in the same application. For example, in the case of a CDK Pipelines
application, the `@aws-cdk/pipelines` library would be counted `N+1` times:
in addition to the pipeline stack itself, once for every environment deployed
via that pipeline because the library happened to be in memory while those
stacks were being synthesized.

We therefore need to move to a more fine-grained tracking system: a stack
will report the individual constructs used to synthesize that stack.

We will retain the existing behavior that we will only collect information
about constructs from AWS-authored construct libraries. 3rd-party information
will not be collected.

# Design

There are two subproblems to address:

* Collecting construct identifiers: library name, version, and qualified class name.
* Encoding that information into the metadata resource.

## Construct identifiers

We need a sufficiently unique string representation of each construct type. A
construct identifier should the following components:

* Library and version
* Qualified class name; the qualified class name itself consists of two copmonents:
  * Submodule
  * Class name

Construct identifiers will be formatted like this:

```text
library@version:[submodule.]classname
```

Submodules are a concept introduced at the jsii level to organize the monocdk
package, and they serve to disambiguate type names between classes that
originally were different libraries. For example, both the `@aws-cdk/aws-ecs`
and `@aws-cdk/aws-eks` packages have a class named `Cluster`, so when we
bundle those packages into `monocdk` we need a way to namespace those names,
as `monocdk.Cluster` by itself would be ambiguous. Submodules are the namespacing
mechanism we introduced.

## Collecting construct identifiers

There are two strategies for getting a construct identifier this for every construct:

* Manually annotate each construct in some way, adding a unique identifier for it
  (either by passing additional strings, adding decorators, or some other mechanism).
* Try to automatically infer the identifier components from the reflection
  capabilities available to us in NodeJS.

Manual annotation seems an undesirable amount of work, so we will have to
make do with the reflection capabilities provided by NodeJS.

### NodeJS reflection

Runtime reflection in NodeJS gives us access to the following information:

* An object's class, by accessing its `constructor` property.
* The file a class is defined in, which we can find by examining
  `require.cache[filePath].exports` for every file, and selecting the
  `filePath` whose `exports` contain the given `constructor`.
  * From the filename, we hope to be able to deduce the package and submodule
    names.

This method has the following caveats:

* If the class is non-exported (such as an `class Import implements IBucket {
  ... }`) it will not show up in the `exports`, and we won't be able to figure
  out what file it's from. It will most likely show up as `Construct` (the
  first exported base class).
  * The only feasible solution to fixing this is to do manual annotation, which
  I don't think we want to resort to.

* A constructor may be found in multiple file's `exports` (because of
  re-exporting symbols from another file, something we regularly do in
  files like `index.ts`). If it is, take the file with the file path deepest
  in the directory hierarchy. That approach is going to help us identify the
  correct submodule (see next section).

> Implementation note: looking up the source file from a class is a potentially
> expensive operation as it takes a linear scan through all sources for every class.
> We should build a reverse index in order to speed this up.

### Inheritance

A class has an inheritance chain, and the concrete class of the object may
not be reportable. For example, it may not be exported (so we cannot determine
the filename and hence not the package). It may also be exported but from
a user-defined or 3rd-party library which we purposely intend to not report on.

For those cases we have a choice to make:

* Don't report the construct at all
* Follow up the inheritance chain to report the first class that is exported by
  a construct library we're interested in (as determined by the `filePath`
  where we found the exported class).

The second case will give us slightly more information, although it might not
necessarily be the most useful. Consider:

```ts
// Will be reported as 'Resource': class is not exported but anonymous class
// extends 'Resource'.
const bucket = Bucket.fromBucketName(this, 'ImportedBucket', 'my-bucket');

// Will be reported as 'Construct' since it's a user-defined class and hence
// not in scope.
const myConstruct = new MyConstruct(this, 'MyConstruct', { ... });

// On the other hand, the following might be interesting to report as 'Bucket'
// (assuming the class 'extends Bucket').
const richBucket = new RichBucket(this, 'RichBucket', { ... });
```

### Identifier components

We obtain the construct identifier's components as follows:

**CLASS NAME** We can get the simple class name by reading `obj.constructor.name`.

**LIBRARY/VERSION** We can find the package a class is from by crawling up the
directory tree from the filename we identified and looking for
`package.json`, getting the `name` and `version` from that file.

**SUBMODULE** Getting submodule names is more complex, as they don't have a
runtime representation in NodeJS. We will have to derive the submodule from
the file path and a helper file. The next section goes into more detail.

### Submodule names

Especially in monocdk and the upcoming v2, disambiguating identical class names
by submodule is going to be essential. The question is how we will determine
submodule names from file paths, keeping a couple of goals in mind:

* In order to not proliferate identifier variations, it would be nice if the
  submodule names would be the same names we use in the jsii build of CDK. There's
  no strict need for them to be, but it just might ease future analysis if
  we kept that consistency.
* The mechanism should still work with libraries that don't have a submodule structure
  at all, such as non-CDK team construct libraries vended by AWS like `@aws-solutions-constructs`.

Some examples of what we want to derive:

File name                                                              | Submodule
-----------------------------------------------------------------------|----------
.../node_modules/aws-cdk-lib/lib/aws-ecs/lib/cluster.js                | "aws_ecs"
.../node_modules/aws-cdk-lib/lib/aws-eks/lib/cluster.js                | "aws_eks"
.../node_modules/@aws-solutions-constructs/aws-lambda-sqs/lib/index.js | ""

We could obtain submodule names by establishing conventions on monocdk's
directory structure, using rules as "ignore `/lib/` and replace `-` with `_`
to obtain the module name", for example. This reliance on convention seems
brittle and unflexible. Instead, let's use a configuration file.

One possible candidate is the jsii manifest. It contains the right module names
already, but there is nothing in the jsii manifest that could reliably be used to
trace source files to class names or module names. Plus, the jsii manifest
is rather big to load.

#### cdk-metadata.json

Instead, we can use an additional lookup table that can be generated by the
monocdk build tool, which is in charge of picking the submodule names and
generating the submodule structure anyway. The only thing it needs to do
is record those decisions in an additional file called `cdk-metadata.json`,
which looks like this:

```json
{
  "submodules": {
    "lib/aws-ecs": "aws_ecs",
    "lib/aws-eks": "aws_eks",
    ...
  }
}
```

Absence of a directory in this list or an empty directory indicates no submodule name.

Currently, CDK core contains a hardcoded list of module names for which
metadata should be reported. We can make this an open opt-in protocol by
triggering this reporting off purely off of the presence of the `cdk-metadata.json`
file, which removes the need for the hard-coded names found here:

https://github.com/aws/aws-cdk/blob/1f7311f56457556a6f229e745cd24e3f1e5fe1d3/packages/%40aws-cdk/core/lib/private/runtime-info.ts#L5-L8

Other library vendors like the AWS Solutions Architects Team simply needs
to add an empty `cdk-metadata.json` to their libraries to get metadata
reported for their libraries.

> **Implementation note:** if a `cdk-metadata.json` file is found, we will stop
> emitting the library name to the current `Modules` property of the metadata
> resource, so that we can use presence of a module in that list as an indicator
> of (lack of) adoption of this protocol.

.

> **Implementation note:** the first matching directory found will be used, so should
> we ever need a situation to support submodules-in-submodules, we can make
> use of the fact that JSON dictionaries are ordered and make sure the deeper
> directories occur first.

### jsii considerations

When a jsii-enabled client is instantiating AWS constructs, the full original
library has been loaded into the NodeJS process and the files on disk
(`package.json` et al) match the disk layout we're expecting, so the
mechanism will work the same.

When a jsii-enabled client instantiates a foreign class we will not be able
to obtain a construct identifier for the class, but fortunately we're only
interested in AWS-vended constructs anyway and they will all be implemented
in TypeScript.

## Metadata resource encoding

The Metadata resource looks like this:

```yaml
Resources:
  CDKMetadata:
    Type: AWS::CDK::Metadata
    Properties:
      Modules: <v1 module information, deprecated by this RFC>
      Analytics: <v2 construct information, introduced by this RFC>
```

### Construct list size

Once we have established a list of construct names to transmit, the question is how
we will encode them into the CloudFormation template, given that the list may be sizeable.

A rough estimate of the maximum number of constructs used in a stack will be
about 400 (maximum of 200 L1s with a corresponding L2 wrapper). We will
therefore need to encode roughly 400 strings of the form
`@aws-solutions-constructs/aws-lambda-sqs.LambdaToSqs@1.63.0`.

The longest overall type in the current monocdk is
`monocdk-experiment.aws_cognito.CfnUserPoolRiskConfigurationAttachment.CompromisedCredentialsRiskConfigurationTypeProperty`
(121 characters), the longest construct class name is
`monocdk-experiment.aws_ecs_patterns.ApplicationMultipleTargetGroupsFargateService`
(81 characters).

If an identifier is estimated to be a maximum of 100 bytes (which seems
reasonable be plenty of room) the resulting data set will be at most ~40kB.

We can encode the elements as a list straight in the template, but it will
take up a lot of space in the template: vertical space while looking at it,
as well as bytes that count toward the template size (maximum of 460kB).

### Compression

As an experiment, I've drawn 400 random class names from the complete list of class
names currently in monocdk; that set of class names comes to about 23kB (uncompressed).

Trying various methods of compression on it yields the following (keeping in mind
that the result of binary compression will need to be base64-encoded to transmit via
a CloudFormation template):

| Description                | Raw size    | Base64ed size |
|----------------------------|-------------|---------------|
| Plaintext                  | 23k         | -             |
| gzipped                    | 3.6k        | 4.8k          |
| Zopfli                     | 3.4k        | 4.6k          |
| bzip2                      | 3.4k        | 4.6k          |
| Prefix-grouped (plaintext) | 7.4k        | -             |
| Prefix-grouped gzipped     | 3.0k        | 4.0k          |
| Bloom Filter (1% error)    | 720b        | 960b          |

Prefix-grouped, gzipped data seems to give the best results that are still
convenient and generic to work with (see Appendix 1 for a description of
prefix grouping).

See Appendix 2 for an example blob to be added to a template. I'm not super
happy with this, but this is the most straightfoward option available.

If we are willing to do more work, we can achieve less space used up by doing
more esoteric things. One option would be to use a Bloom Filter, which can use
a configurable amount of storage to achieve a configurable hit error ratio.
For example, achieving about a 1% false positive rate would take on the order
of about ~1k base64-encoded bytes. However, in order to extract a construct list
from this Bloom Filter would be a considerable amount of work: we would need
a full list of all construct available in every library and at every version,
in order to test each construct's presence in the filter. This would destroy
the openness of the protocol, and is probably not worth it.

### Analytics payload

The analytics payload itself will be preceded by an encoding scheme identifier,
followed by a `:` and the transmitted data:

```yaml
Resources:
  CDKMetadata:
    Type: AWS::CDK::Metadata
    Properties:
      Analytics: <payload-encoding>:<payload>
```

The only valid payload encodings at the moment are:

* `deflate64`: base64-encoded, gzipped data.
* `plain`: plaintext data.

The payload itself is a JSON object with `"constructs"` currently defined as the only
valid key (but can be extended in the future). Values can be prefixed with
an encoding scheme as well:

```json
{
  "constructs": "[<value-encoding>:]<prefix-encoded construct list>"
}
```

The only valid payload value encodings at the moment are:

* `prefix`: prefix-encoded string list (see Appendix 1).
* `plain`: plaintext data.

Encoding may change the type (the encoded value is a `string` but the decoded
value is a `string[]`).

> If a value does not start with > /^[a-z0-9]{,10}:/ it is considered to
> be not encoded (the encoding is considered to be "plain").

## Metadata resource decoding

Decoding will happen on the receiving end before the data hits long-term storage,
in order to make consuming it as trivial as possible. There is no need to be frugal
with bits anymore once the data hits an AWS datacenter.

# Extensions

We will be able more information into additional fields of the metadata resource.
Size of template, number of resources are obvious candidates.

# Unresolved questions

- How acceptable is the giant base64-encoded blob in the template? If we want
  to cut down on it, what clever strategies can we come up with?

# Implementation Plan

This can be implemented in v1 already, no need to wait for v2.

* Instruct all AWS library authors to add an empty `cdk-metadata.json` to the root of their
  packages.
* Update metadata service backend to accept new `Constructs` field. This is where
  decoding should happen back to a flat list again.
* Update canary to exercise new field.
* Update reporting tool to report on new information (in addition to old one).
  We will be generating 2 sets of results according to
  2  different schemas.
* Add `cdk-metadata.json` to all current packages and the monocdk package.
* Emit both `Constructs` and `Modules` to the metadata resource, skipping emitting
  modules that have a `cdk-metadata.json` to the `Modules` array.
* Verify metrics are coming in
* Wait until no libraries are reported via old `Modules` mechanism.
* Remove the code that generates the `Modules` field from the CDK.

# Appendix 1: Reference implementation for prefix-grouping used above

Prefix-grouping in this case means rearranging the data and sorting it so that
we can share common prefixes. Example of a prefix-grouped list:

```text
monocdk-experiment@1.63.0:{aws_amplify.DomainOptions,aws_apigateway.{CfnResource,MethodLoggingLevel},aws_autoscaling.Monitoring,aws_backup.Backup{PlanRule,Selection},aws_chatbot.SlackChannelConfiguration,aws_codedeploy.IEcsApplication,aws_ec2.{AclTraffic,CfnDHCPOptions,NatInstanceImage},aws_eks.PatchType,aws_elasticloadbalancingv2.{CfnListenerRule,NetworkLoadBalancerAttributes},aws_glue.Table,aws_greengrass.CfnCoreDefinitionVersion,aws_logs_destinations.LambdaDestination,aws_rds.{ClusterEngineBindOptions,DatabaseProxy},aws_route53_patterns.HttpsRedirect}
```

(Fun fact: the above uses the shell convention `{,}` so you can recover the original list
by running `echo $THE_STRING_ABOVE`.)

It was done using this code:

```py
def tree_ified(xs):
  def split_intelli(x):
    # Split AFTER ., : and BEFORE uppercase chars
    # Replace split points with ' ' then split on that
    x = re.sub('([A-Z])', ' \\1', x)
    x = re.sub('\\.', '. ', x)
    x = re.sub('\\:', ': ', x)
    return x.split(' ')

  partified = [split_intelli(x) for x in xs]

  tree = {}
  for parts in partified:
    insert = tree
    for part in parts:
      insert = insert.setdefault(part, {})

  ret = []

  def recurse(node):
    first = True
    for key, value in node.items():
      if not first:
        ret.append(',')
      first = False
      ret.append(key)
      if len(value) > 1:
        ret.append('{')
        recurse(value)
        ret.append('}')
      elif len(value) > 0:
        recurse(value)

  recurse(tree)

  return ''.join(ret)
```

# Appendix 2: Example metadata resource

For reference, at the compression numbers we are able to reach, every
template will contain something like this:

```yaml
Resources:
  CDKMetadata:
    Type: AWS::CDK::Metadata
    Properties:
      Analytics: |
        deflate64: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
```
