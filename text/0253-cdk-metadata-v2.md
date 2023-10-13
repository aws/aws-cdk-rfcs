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

For every construct used in a Stack we will use the new `jsii-rtti` library
to obtain its type FQN, and if its module matches against a hardcoded allow-list
we will include it in the list of constructs.

The list of constructs gets prefix-encoded to save space and is added to the
template in a gzipped form.

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
stacks in the same application. If two different stacks exist in the same
application, each using a different construct library, then we will count both
construct libraries as "having been used" for both stacks (because they were
loaded into memory at the time the stacks were synthesized).

Though not limited to, this becomes even more pronounced in the case of a CDK
Pipelines application: the `@aws-cdk/pipelines` library would be counted
`N+1` times. In addition to the pipeline stack itself, once for every
environment deployed via that pipeline because the library happened to be in
memory while those stacks were being synthesized.

We therefore need to move to a more fine-grained tracking system: a stack
will report the individual constructs used to synthesize that stack.

We will retain the existing behavior that we will only collect information
about constructs from AWS-authored construct libraries. 3rd-party information
will not be collected.

We will *not* collect counts of each construct used, we will just record its
presence.

# Glossary

- **Construct**: an abstract, reusable specification of Cloud Infrastructure.
In practice, implemented by a `class`
- **Construct type**: same as "Construct".
- **Construct instance**: a concrete single definition of a construct. In
practice, a class instance.
- **Construct identifier**: a string describing a specific version of a
*construct.
- **RTTI**: Run-Time Type Information; a mechanism by which a compiler emits
information about the types it has processed which can be read by programs
during execution, used to power reflection.

# Design

These are the major subproblems this design addresses:

* Obtaining a list of construct instances appropriate for the scope of the
  metadata resource.
* Obtaining a construct identifier given a construct instance.
* Filtering a list of construct identifiers to only retain the ones
  we're allowed to report on.
* Encoding that remaining list into the metadata resource.

## Obtaining construct instances

Since the metadata resource reports on a per-stack basis, and in order to avoid double-counting
constructs or libraries, we will iterate over the construct tree of each stack and
record the construct instances found in there.

When CDK library coverage starts to approach 100%, users will ideally be
using only L2 constructs, which themselves contain L1 constructs, and both
would be reported. Doing so is not actually all that useful, and in fact
makes it harder to detect interesting cases like when users are opting to
forego existing L2 implementations to use the underlying L1 implementations
directly (indicating there is a feature/coverage gap in our L2 layer).
To that end, we will ignore classes that inherit from `CfnResource` if
their parent inherits from `Resource`.

* This collection process is done during stack synthesis.
* Recursion stops upon encountering a contained `Stack`, `Stage` or `NestedStack`.
* Contrary to today, nested stacks will each have their own copy of a metadata resource.

## Obtaining construct identifiers

From a construct instance, we need to obtain a construct identifier. To not
proliferate variants of identifiers too much, it's preferable for this identifier
to be the same, or substantially the same, as the class' jsii type name.

We are planning to eventually introduce a feature for jsii-powered Run-Time
Type Information (RTTI). We will use this project to start introducing that
feature at its very simplest, and the initial feature will be to retrieve a jsii
FQN and module version from an object instance. See Appendix A for a description
of how jsii RTTI will work.

For the initial version of Metadata v2, we will simply say that the construct
identifier is whatever jsii RTTI returns.

> In the future, we may want to onboard libraries that are not jsii-libraries (either
> written in plain TypeScript or a jsii client language like Java); if that happens,
> we will add a CDK-specific core library function to attach a specific construct
> identifier to a construct instance, like
> `CdkMetadata.describe(construct, "@my/library.MyConstruct@1.2.3")`.

## Filtering down the list of construct identifiers

To protect the privacy of our users, we only want to report on 1st-party
constructs, authored and vended by AWS.

We decided against an open system, instead preferring to have a specific
allow-list of packages (or package prefixes) we are going to report on. For
example, the current list looks like this and can be found
[here](https://github.com/aws/aws-cdk/blob/main/packages/@aws-cdk/core/lib/private/runtime-info.ts):

```ts
const ALLOWLIST_SCOPES = ['@aws-cdk', '@aws-solutions-konstruk', '@aws-solutions-constructs', '@amzn'];
const ALLOWLIST_PACKAGES = ['aws-rfdk'];
```

Having a PR opened against the CDK to update this list will be a clear
interaction moment between an AWS team trying to onboard with this mechanism
and us, and will prevent 3rd party authors from accidentally (or maliciously)
onboarding themselves as well and sending us information that we don't have
a use-case for.

## Metadata resource encoding

Once we have the list of construct identifiers, we need to encode it into the
metadata resource.

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

The list of construct identifiers we have discovered may be sizeable. A rough
estimate of the maximum number of constructs used in a stack will be about
200 (maximum of 200 L1/L2s with a couple of higher-level constructs). We will
therefore need to encode roughly 200 strings of the form
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

> The following experiments were run with with 400 construct names, whereas the
> method we're proposing currently will lead to 200 construct names. All sizes
> (except for the Bloom filter) can roughly be divided by 2 in order to get
> good approximations for the final sizes.

As an experiment, I've drawn 400 random class names from the complete list of class
names currently in monocdk; that set of class names comes to about 23kB (uncompressed).

Trying various methods of compression at maximum compression level yields the following
results:

| Description                | Raw size    | Base64ed size |
|----------------------------|-------------|---------------|
| Plaintext                  | 23k         | -             |
| gzipped                    | 3.6k        | 4.8k          |
| Zopfli                     | 3.4k        | 4.6k          |
| bzip2                      | 3.4k        | 4.6k          |
| Affix-grouped (plaintext)  | 7.4k        | -             |
| Affix-grouped gzipped      | 3.0k        | 4.0k          |
| Bloom Filter (1% error)    | 720b        | 960b          |

> base64: the result of binary compression will need to be base64-encoded to
> be transmitted via a CloudFormation template.

Affix-grouped, gzipped data seems to give the best results that are still
convenient and generic to work with (see Appendix B for a description of
prefix grouping).

See Appendix C for an example blob to be added to a template. I'm not super
happy with this, but this is the most straightfoward option available.

> If we are willing to do more work, we can achieve less space used up by doing
> more esoteric things. One option would be to use a Bloom Filter, which can use
> a configurable amount of storage to achieve a configurable hit error ratio.
> For example, achieving about a 1% false positive rate would take on the order
> of about ~1k base64-encoded bytes. However, in order to extract a construct list
> from this Bloom Filter would be a considerable amount of work: we would need
> a full list of all construct available in every library and at every version,
> in order to test each construct's presence in the filter. This imposes a lot
> of complexity on the receiver, which is probably not worth the space savings.

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

The payload itself is a JSON object with `"constructs"` currently defined as
the only valid key (but can be extended in the future). This protocol can be
extended by adding additional keys to the object.

Values inside the JSON object can be annotated with an encoding scheme as
well. If so, the same key followed by the text `$encoding` is added to the
same object.

```json
{
  "constructs$encoding": "<value-encoding>",
  "constructs": <construct list data>
}
```

The only valid value encodings at the moment are:

* `afx`: string list, affix-encoded as a string (see Appendix B).
* `literal`: literal JSON value.

The `$encoding` key may be missing, in which case `literal` is implied.

Encoding may change the type (for `afx` the encoded value is a `string` but the decoded
value is a `string[]`).

## Metadata resource decoding

Decoding will happen on the receiving end before the data hits long-term storage,
in order to make consuming it as trivial as possible. There is no need to be frugal
with bits anymore once the data hits an AWS datacenter.

# Extensions

We will be able more information into additional fields of the metadata resource.
Size of template, number of resources are obvious candidates.

We will be able to support non-jsii languages by adding metadata-specific APIs
to the CDK.

The jsii RTTI mechanism can be extended in the future as well, though those extensions
are out of scope of this RFC.

If we want to change the encoding of the payload in any way, we can.

If the payload grows too large and changing the encoding scheme won't be
enough to reduce it, we can transport and reference the payload as an asset.
Though, that would require us to gain read access to a customer's S3 bucket
from our account, which has security implications; it would also require a
customer to have a bootstrapped account for *every* deployment, even small
ones (though we could lift *that* limitation by hosting bootstrap buckets on behalf
of users).

# Unresolved questions

- How acceptable is the giant base64-encoded blob in the template? If we want
  to cut down on it, what clever strategies can we come up with?

# Server-side considerations

This RFC does not explicitly detail out the work that needs to happen
on the server side. A light design doc should be written in a private
place before starting. Considerations:

- Decode before storage.
- Emulate the old data from the new (more detailed data).
- Emit two different reports, two different schemas to two different locations.

# Implementation Plan

This can be implemented in CDK v1 already, no need to wait for CDK v2.

* Server-side design doc.
* Implement RTTI support in in jsii.
* Inform dependent teams that they need to upgrade to the jsii version that supports
  RTTI.
* Update metadata service backend to accept new `Analytics` field. This is where
  decoding should happen back to a flat list again. Metadata service should extract
  packages from the construct list to continue emitting the old information as well.
* Update canary to exercise new field.
* Update metadata reporting job to report on both new and old information.
* Update metadata resource construction implementation in CDK to switch to RTTI
  implementation, and start emitting `Analytics` field. Update tests.
* Verify metrics are coming in

# Testing

We will have the following tests:

- Unit tests: verify in `core` that given some standard constructs, they are represented
  in the generated Metadata resource.
- CLI integration: the Metadata resource is always generated.
- Server-side unit test: only expected data is recorded, legacy data is synthesized from
  new data.
- Server-side canary: if the Metadata resource is present in a template, its data is recorded.

# FAQ

## Why don't we collect even more data, like construct counts and the entire hierarchy?

This is our customer's sensitive information; collecting more than
rough aggregates is an invasion of privacy.

# Appendix 1: jsii Run-Time Type Information

We will start by having the jsii compiler add FQN information to every
JavaScript class it emits.

Effectively, every class will be emitted as this in the `.js` file (the
`.d.ts` file remains unchanged).

```js
// This will be added to the top of every source file
const vfqnSym = Symbol.for('jsii.rtti');

export class SomeClass {
  // Every class gets an additional field added to it
  private static [vfqnSym] = { fqn: 'module.SomeClass', version: '1.2.3' };

  // Regular class emits here...
}
```

We will introduce a new jsii package to access this information, called `jsii-rtti`.

It will have the following API:

```ts
class TypeInformation {
  /**
   * Get type information based on an object instance
   */
  public static forObject(object: any): TypeInformationForObject | undefined;

  /** Type FQN */
  public readonly fqn: string;

  /** Module version */
  public readonly version: string;

  /** Base class type information */
  public readonly baseClass: TypeInformation | undefined;
}

interface TypeInformationForObject {
  /** Type information for the first base class that has type information */
  readonly typeInformation: TypeInformation;

  /**
   * How many classes were skipped before finding an ancestor with type information
   *
   * This number will be 0 if the object itself was an instance of a class with
   * type information.
   */
  readonly classesSkipped: number;
}
```

# Appendix B: Reference implementation for affix-grouping used above

> IMPLEMENTATION NOTE: The code below written and tested against
> a different format of construct identifier than the one currently being
> advertised by this RFC, and did purely did *prefix* grouping, ignoring
> postfixes. It turned a list like:
>
> ```text
> monocdk-experiment@1.63.0:aws_amplify.DomainOptions
> monocdk-experiment@1.63.0:aws_amplify.Branch
>
> # into
> monocdk-experiment@1.63.0:aws_amplify.{Branch,DomainOptions}
> ```
>
> Now that the current advertised format contains the version number at the
> end, we should extend our prefix-grouping algorithm into one that also considers
> postfixes (hence, turning it into "affix" grouping):
>
> ```text
> monocdk-experiment.aws_amplify.DomainOptions@1.63.0
> monocdk-experiment.aws_amplify.Branch@1.63.0
>
> # should turn into
> monocdk-experiment.aws_amplify.{Branch,DomainOptions}@1.63.0
> ```
>
> The same compression properties will still hold as suffixes are nearly
> guaranteed to match up with prefixes (since users won't have multiple versions
> of the same library in their program).

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

# Appendix C: Example metadata resource

For reference, at the compression numbers we are able to reach, a template
will (at worst) contain a blob like this:

```yaml
Resources:
  CDKMetadata:
    Type: AWS::CDK::Metadata
    Properties:
      Analytics: |
        deflate64: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
```
