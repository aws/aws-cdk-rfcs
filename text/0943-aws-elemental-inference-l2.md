# AWS Elemental Inference L2 Construct Library

* **Original Author(s):** @jamiepm
* **Tracking Issue:** [#943](https://github.com/aws/aws-cdk-rfcs/issues/943)
* **API Bar Raiser:** (assigned during review)

AWS Elemental Inference applies AI to live media. A `Feed` receives media for inference processing and
produces one or more AI-driven outputs — **event clipping**, **smart cropping**, and **smart subtitling** —
and a `Dictionary` supplies domain-specific vocabulary that improves subtitling transcription accuracy.

This L2 turns the `AWS::ElementalInference::Feed` and `AWS::ElementalInference::Dictionary` resources — whose
raw form requires hand-built status strings, nested output-config objects, and a JSON-encoded dictionary
`entries` payload — into a typed, intent-based API with factory methods, enums, and synth-time validation.

## Motivation — L1 vs L2

The sample below configures the same workflow — a dictionary plus a feed with a clipping output and a
subtitling output that references the dictionary — first with the L1 resources, then with the proposed L2.
(It is the configuration exercised by the `integ.feed-subtitling` integration test.)

### L1 (CloudFormation)

```ts
const dictionary = new CfnDictionary(this, 'Dictionary', {
  name: 'my-terms',
  language: 'eng',
  entries: JSON.stringify([
    { content: 'gnocchi', sounds_like: ['nyohki', 'nokey'] },
    { content: 'quinoa', sounds_like: ['keen-wah'] },
    { content: 'MediaLive' },
  ]),
});

new CfnFeed(this, 'Feed', {
  name: 'subtitling-feed',
  outputs: [
    { name: 'event-clipping', status: 'ENABLED', outputConfig: { clipping: {} } },
    {
      name: 'subtitling-eng-us',
      status: 'ENABLED',
      outputConfig: {
        subtitling: {
          language: 'eng-us',
          dictionary: dictionary.attrId,
          aspectRatio: { width: 16, height: 9 },
          profanityFilter: 'CENSOR',
        },
      },
    },
  ],
});
```

### L2 (proposed)

```ts
const dictionary = new Dictionary(this, 'Dictionary', {
  dictionaryName: 'my-terms',
  language: DictionaryLanguage.ENGLISH,
  entries: [
    { content: 'gnocchi', soundsLike: ['nyohki', 'nokey'] },
    { content: 'quinoa', soundsLike: ['keen-wah'] },
    { content: 'MediaLive' },
  ],
});

new Feed(this, 'Feed', {
  feedName: 'subtitling-feed',
  outputs: [
    FeedOutput.clipping({ name: 'event-clipping' }),
    FeedOutput.subtitling({
      name: 'subtitling-eng-us',
      language: SubtitlingLanguage.ENGLISH_US,
      dictionary,
      aspectRatio: AspectRatio.LANDSCAPE_16_9,
      profanityFilter: ProfanityFilter.CENSOR,
    }),
  ],
});
```

The L2 removes the three things the L1 makes the user get right by hand: the JSON-encoded `entries` payload
(a raw string with a snake_case schema), the nested `outputConfig` + `status` strings, and the magic-string
languages/profanity values and raw aspect-ratio numbers. The dictionary-id wiring is handled automatically.

---

## Working Backwards — README

### Feed

A `Feed` receives media content for inference processing. Configure one or more AI features with the
`FeedOutput` factory methods. Clipping, cropping, and subtitling are independent;
a feed may combine different output types, and may carry multiple subtitling outputs in different languages.
Each output's name must be unique within the feed.

```ts
const feed = new Feed(this, 'MyFeed', {
  feedName: 'my-inference-feed',
  outputs: [
    FeedOutput.clipping({ name: 'event-clipping' }),
    FeedOutput.cropping({ name: 'smart-cropping' }),
    FeedOutput.subtitling({ name: 'subtitling-eng-us', language: SubtitlingLanguage.ENGLISH_US }),
  ],
});
```

#### Event clipping

Clipping produces clip metadata, with optional callback metadata returned in clipping callbacks:

```ts
const feed = new Feed(this, 'ClippingFeed', {
  outputs: [FeedOutput.clipping({ name: 'event-clipping', callbackMetadata: 'my-callback-data' })],
});
```

#### Smart cropping

Cropping reframes content for different aspect ratios. When MediaLive drives the cropping, MediaLive inserts
the cropping output into the feed automatically:

```ts
const feed = new Feed(this, 'CroppingFeed', {
  outputs: [FeedOutput.cropping({ name: 'smart-cropping' })],
});
```

#### Smart subtitling

Subtitling uses automatic speech recognition (ASR) to generate live TTML subtitles from the source audio.
Choose the source language, optionally set the rendering aspect ratio, how profanity is handled, and a
`Dictionary` for domain-specific terms:

```ts
const feed = new Feed(this, 'SubtitlingFeed', {
  outputs: [FeedOutput.subtitling({
    name: 'subtitling-eng-us',
    language: SubtitlingLanguage.ENGLISH_US,
    aspectRatio: AspectRatio.LANDSCAPE_16_9,
    profanityFilter: ProfanityFilter.CENSOR,
  })],
});
```

A feed may carry several subtitling outputs in different languages. Each output takes an explicit `name`,
which must be unique within the feed:

```ts
const feed = new Feed(this, 'MultiLanguageSubtitles', {
  outputs: [
    FeedOutput.subtitling({ name: 'subtitling-eng', language: SubtitlingLanguage.ENGLISH }),
    FeedOutput.subtitling({ name: 'subtitling-por', language: SubtitlingLanguage.PORTUGUESE }),
  ],
});
```

The name deploys verbatim and is what downstream consumers reference; the construct
validates uniqueness at synth time and throws if two outputs share a name.

### Dictionary

A `Dictionary` supplies custom words and phrases — brand names, technical terms, player names — that the ASR
engine might otherwise miss. Each entry has `content` and optional `soundsLike` pronunciation hints. Reference
the dictionary from a subtitling output:

```ts
const dictionary = new Dictionary(this, 'Dictionary', {
  dictionaryName: 'my-terms',
  language: DictionaryLanguage.ENGLISH,
  entries: [
    { content: 'gnocchi', soundsLike: ['nyohki', 'nokey'] },
    { content: 'quinoa', soundsLike: ['keen-wah'] },
    { content: 'MediaLive' },
  ],
});

const feed = new Feed(this, 'Feed', {
  outputs: [FeedOutput.subtitling({
    name: 'subtitling-eng',
    language: SubtitlingLanguage.ENGLISH,
    dictionary,
  })],
});
```

### Granting access to a feed

A producer — most commonly a MediaLive channel role — needs feed-scoped permission to push media and read
inference metadata. `IFeed` exposes a generated `grants` collection, which attaches policies scoped to the feed's
ARN:

```ts
declare const role: iam.IRole;

const feed = new Feed(this, 'Feed', {
  outputs: [FeedOutput.subtitling({ name: 'subtitling-eng', language: SubtitlingLanguage.ENGLISH })],
});

feed.grants.contribute(role); // elemental-inference:PutMedia + GetMetadata on this feed
```

The two actions are granted together because a producer pushes media and reads the resulting inference
metadata as one. For any action the generated method doesn't cover, the
`grants.actions(grantee, [...], options)` escape hatch grants a custom action set scoped to the feed ARN.

### Importing existing resources

```ts
const feed = Feed.fromFeedArn(this, 'ImportedFeed',
  'arn:aws:elemental-inference:us-east-1:123456789012:feed/f1a2b3c4d5e6f7g8h9j');

const dictionary = Dictionary.fromDictionaryArn(this, 'ImportedDictionary',
  'arn:aws:elemental-inference:us-east-1:123456789012:dictionary/d1a2b3c4d5e6f7g8h9j');
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We're launching new AWS Elemental Inference L2 constructs — `Feed` and `Dictionary` — that provide a
developer-friendly API for the service's AI media features: **event clipping**,
**smart cropping**, and **smart subtitling**.

The aim is to reduce the `AWS::ElementalInference::Feed` and `AWS::ElementalInference::Dictionary` resources —
which require hand-built status strings, nested output-config objects, and a JSON-encoded dictionary `entries`
payload — into an abstracted, type-safe API with synth-time validation.

### Why should I use this feature?

Developers should use these constructs to:

- Configure feed outputs with typed `FeedOutput.clipping()`, `FeedOutput.cropping()`, and
  `FeedOutput.subtitling()` factories instead of hand-built `outputConfig` objects and `ENABLED`/`DISABLED`
  status strings.
- Never hand-write the dictionary `entries` JSON. Pass structured `{ content, soundsLike }` entries and the
  construct serializes them to the exact wire format the service expects (a top-level JSON array with
  snake_case `sounds_like` keys) — eliminating an easy-to-get-wrong, schema-rejected payload.
- Use typed languages (`SubtitlingLanguage`, `DictionaryLanguage`), profanity handling (`ProfanityFilter`),
  and aspect ratios (`AspectRatio` presets) instead of magic strings and raw numbers.
- Reference a `Dictionary` from a subtitling output with a type-safe construct reference (resolved to the
  dictionary id) rather than copying identifiers.
- Catch invalid configurations — blank entries, oversized payloads, invalid dictionary names — at synth time
  instead of deploy time.

## Internal FAQ

### Why are we doing this?

The `AWS::ElementalInference::Feed` resource models each AI feature as a nested `outputConfig` (one of
`clipping`, `cropping`, `subtitling`) on a list of outputs, each with a `status` string. The
`AWS::ElementalInference::Dictionary` resource accepts its words as `entries` — a `String` property that is
actually a JSON document. Getting that payload wrong fails only
at deploy time, with a generic "Entries payload is not valid JSON or does not match the expected schema"
error.

By building L2 constructs, we:

1. Replace the nested `outputConfig` objects and `ENABLED`/`DISABLED` status strings with typed `FeedOutput` factories.
2. Hide the dictionary `entries` JSON schema behind a typed `DictionaryEntry[]`.
3. Provide synth-time validation for the constraints the service enforces.
4. Use enum-like types for the closed-value fields (languages, profanity filter, aspect ratio).

### Why should we _not_ do this?

No L2 exists today, so there is nothing to migrate from. The L1 surface is small compared with MediaLive, so
the abstraction win is narrower — but the dictionary `entries` payload is a common source of deploy-time errors,
which on its own justifies the L2.

### What is the technical solution (design) of this feature?

The design centers on:

1. **`FeedOutput` abstract class with static factory methods** (`clipping`, `cropping`, `subtitling`) for
   type-safe, discoverable output configuration. Each factory renders its own `outputConfig` and the
   `ENABLED`/`DISABLED` status.
2. **A `Dictionary` resource construct** whose structured `entries` are serialized to the service's JSON
   payload, translating the idiomatic CDK `soundsLike` to the wire's `sounds_like`.
3. **Enum and enum-like types** for closed-value fields: `SubtitlingLanguage`, `DictionaryLanguage`,
   `ProfanityFilter`, and `AspectRatio` (preset instances).
4. **Synth-time validation** for the documented constraints (non-blank entry content, non-blank `soundsLike`
   hints, ≤40 KB serialized payload, dictionary name pattern/length).
5. **Resource interfaces, import factories, and refs** (`IFeed`/`fromFeedArn`,
   `IDictionary`/`fromDictionaryArn`) so feeds and dictionaries can be referenced across stacks.
6. **A generated `FeedGrants` collection** (`feed.grants.contribute(role)`, from `grants.json`)
   returning a feed-ARN-scoped `iam.Grant` for
   `PutMedia` + `GetMetadata` — to be used by AWS Elemental MediaLive L2 to authorize a channel to
   push media to a feed and read its inference results.
7. **CloudWatch metrics on `IFeed`** — a generic `metric()` plus typed helpers (`metricProcessingLatency`,
   `metricProcessingFaultCount`, `metricPutMediaRequestCount`, `metricGetMetadataRequestCount`) in the
   `AWS/ElementalInference` namespace, dimensioned by `Feed`.

### Is this a breaking change?

No — an L2 doesn't exist today. This is a new alpha module.

### What alternative solutions did you consider?

- **Flat per-feature props on `Feed`** (e.g. `clipping?`, `cropping?`, `subtitling?`) instead of a
  `FeedOutput[]` factory list. Rejected: the three features have genuinely different shapes, and the L1 itself
  models them as a list of outputs; the factory list mirrors that and keeps each output's name/status/config
  cohesive.
- **A raw `string` `entries` property** matching the L1. Rejected: it exposes the raw JSON issue that the L2
  should remove. Structured `DictionaryEntry[]` is the right implementation.
- **One shared `Language` enum** across feeds and dictionaries. Rejected: subtitling supports 9 values
  (including `eng-au`/`eng-gb`/`eng-us`) while dictionaries support only the 6 base codes — a shared enum would
  let an invalid value compile and fail at deploy.

### What are the drawbacks of this solution?

The structured `entries` serialization couples the L2 to the service's JSON
schema. If the service adds entry fields, the `DictionaryEntry` struct must follow — but since it is a struct,
new optional fields are additive. As with any L2, not every service constraint is validated at synth time;
the remainder continues to rely on the Elemental Inference API's error messages.

### What is the high-level project plan?

- **Phase 1 (this RFC):** `Feed` (clipping, cropping, subtitling outputs) and `Dictionary`, with the
  supporting types and synth-time validation. Built and working toward alpha release.
- **Phase 2:** MediaLive integration — a smart-subtitles caption selector on the MediaLive `Channel` that
  references an `IFeed`, establishing the `aws-medialive-alpha → aws-elementalinference-alpha` dependency
  edge. Lands once this module is released.

### Are there any open issues that need to be addressed later?

No open issues to be addressed later.

## Key Design Decisions

### 1. `FeedOutput` as an abstract factory

Clipping, cropping, and subtitling are distinct configurations that share only a name and a status. An
abstract `FeedOutput` with `clipping()`/`cropping()`/`subtitling()` factories gives discoverability and
type-safety, mirrors the L1's list-of-outputs model, and keeps each feature's required fields on its own props
type (every output requires a `name`; subtitling additionally requires `language`).

### 2. Structured dictionary entries (hiding the JSON-payload complexity)

The L1 `entries` is a `String` that must be a JSON **array** of `{ "content", "sounds_like"? }` objects
(snake_case, top-level array — a top-level object is rejected). The L2 takes `DictionaryEntry[]` (`{ content, soundsLike }`) and serializes it, translating
`soundsLike` → `sounds_like`, so users never construct the payload by hand. `soundsLike` stays camelCase on
the API to match CDK conventions; the wire detail is hidden.

### 3. `AspectRatio` as an enum-like class

The L1 takes raw `{ width, height }` integers, but subtitling rendering supports only 16:9 and 9:16 in
practice. `AspectRatio.LANDSCAPE_16_9` / `PORTRAIT_9_16` presets guide users to the valid options.

### 4. Two language enums, not one

`SubtitlingLanguage` (9 values, including regional English variants) and `DictionaryLanguage` (6 base codes)
have different allowed sets per the service. Separate enums mean each surface offers only its valid values at
compile time; a shared enum would surface invalid combinations.

### 5. Feed output naming — explicit and required

Output names must be unique within a feed, and the name **deploys verbatim** — it is the identifier downstream
consumers (e.g. a MediaLive smart-subtitles caption selector) reference. Because the name is a stable external
contract rather than an incidental construct detail, every `FeedOutput` takes a **required** `name`; the L2
does not auto-generate one. The construct still **validates uniqueness at synth time**, throwing a clear error
if two outputs collide.

We considered matching the console's auto-naming (`subtitling-<language>`, `event-clipping`, …) with
collision detection, but rejected it. Auto-naming `FeedOutput`s is awkward — they are value objects in a list,
not constructs, so there is no tree path to derive `Names.uniqueResourceName` from.
Relaxing a required prop to an optional, defaulted one later is a non-breaking change.

### 6. Feed grants — generated from `grants.json` (the cross-service seam)

A producer must be granted feed-scoped permissions to push media and read inference results. The Elemental
Inference IAM actions `elemental-inference:PutMedia` (Write) and `elemental-inference:GetMetadata` (Read) are
both **resource-scopable to the feed ARN**, and go hand in hand — a producer pushes media and reads the
resulting metadata as one capability.

```ts
feed.grants.contribute(role); // grants PutMedia + GetMetadata, scoped to this feed's ARN
```

### 7. CloudWatch metrics — typed helpers on `IFeed`

Elemental Inference publishes feed-level CloudWatch metrics (namespace `AWS/ElementalInference`, dimensioned by
`Feed`), so `IFeed` exposes the standard CDK metrics surface: a generic `metric(metricName, props?)` plus typed
helpers for the documented performance metrics — `metricProcessingLatency` (Average, ms),
`metricProcessingFaultCount`, `metricPutMediaRequestCount`, and `metricGetMetadataRequestCount` (all Sum). Each
helper sets the recommended default statistic and routes through `metric()`, which fills in the namespace and
the `{ Feed: feedId }` dimension; callers can override the statistic, period, or add the secondary `StatusCode`
dimension via `props`. The metrics live on a shared base so both created and imported feeds expose them.
`Dictionary` publishes no metrics, so it has no metrics surface.

## Appendix — API Surface

```ts
abstract class FeedOutput {
  static clipping(props: ClippingOutputProps): FeedOutput;
  static cropping(props: CroppingOutputProps): FeedOutput;
  static subtitling(props: SubtitlingOutputProps): FeedOutput;
}

// IFeedRef / FeedReference and IDictionaryRef / DictionaryReference are auto-generated in
// aws-cdk-lib/aws-elementalinference. The L2 interfaces extend the generated *Ref types.
interface IFeed extends IResource, IFeedRef {
  readonly feedArn: string;  // @attribute
  readonly feedId: string;   // @attribute
  /** Grant feed-scoped permissions to a producer (e.g. a MediaLive channel role). */
  readonly grants: FeedGrants;

  // CloudWatch metrics — namespace AWS/ElementalInference, dimensioned by Feed.
  metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricGetMetadataRequestCount(props?: cloudwatch.MetricOptions): cloudwatch.Metric; // Sum
  metricPutMediaRequestCount(props?: cloudwatch.MetricOptions): cloudwatch.Metric;    // Sum
  metricProcessingFaultCount(props?: cloudwatch.MetricOptions): cloudwatch.Metric;    // Sum
  metricProcessingLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;       // Average (ms)
}

interface IDictionary extends IResource, IDictionaryRef {
  readonly dictionaryArn: string;  // @attribute
  readonly dictionaryId: string;   // @attribute
}

class Feed extends Resource implements IFeed {
  static fromFeedArn(scope: Construct, id: string, feedArn: string): IFeed; // feedId derived from the ARN
  readonly feedArn: string;
  readonly feedId: string;
  readonly dataEndpoints: string[];
  get feedRef(): FeedReference;  // { feedArn, feedId }
}

class Dictionary extends Resource implements IDictionary {
  static fromDictionaryArn(scope: Construct, id: string, dictionaryArn: string): IDictionary; // dictionaryId derived from the ARN
  readonly dictionaryArn: string;
  readonly dictionaryId: string;
  get dictionaryRef(): DictionaryReference;  // { dictionaryArn, dictionaryId }
}

interface FeedProps {
  readonly outputs: FeedOutput[];
  /** @default - autogenerated */ readonly feedName?: string;
  /** @default - no tags */ readonly tags?: Record<string, string>;
}

interface ClippingOutputProps {
  readonly name: string;
  /** @default - no description */ readonly description?: string;
  /** @default - none */ readonly callbackMetadata?: string;
  /** @default true */ readonly enabled?: boolean;
}

interface CroppingOutputProps {
  readonly name: string;
  /** @default - no description */ readonly description?: string;
  /** @default true */ readonly enabled?: boolean;
}

interface SubtitlingOutputProps {
  readonly name: string;
  readonly language: SubtitlingLanguage;
  /** @default - no description */ readonly description?: string;
  /** @default - no dictionary */ readonly dictionary?: IDictionary;
  /** @default - service default */ readonly aspectRatio?: AspectRatio;
  /** @default - service default */ readonly profanityFilter?: ProfanityFilter;
  /** @default true */ readonly enabled?: boolean;
}

interface DictionaryProps {
  readonly language: DictionaryLanguage;
  /** @default - autogenerated */ readonly dictionaryName?: string;
  /** @default - no entries */ readonly entries?: DictionaryEntry[];
  /** @default - no tags */ readonly tags?: Record<string, string>;
}

interface DictionaryEntry {
  readonly content: string;
  /** Serialized to the wire as `sounds_like`. @default - none */ readonly soundsLike?: string[];
}

class AspectRatio {
  static readonly LANDSCAPE_16_9: AspectRatio;
  static readonly PORTRAIT_9_16: AspectRatio;
}

enum SubtitlingLanguage { /* eng, eng-au, eng-gb, eng-us, fra, ita, deu, spa, por */ }
enum DictionaryLanguage { /* eng, fra, ita, deu, spa, por */ }
enum ProfanityFilter { DISABLED, CENSOR, DROP }
```

| Resource | Outputs / key types |
| --- | --- |
| `Feed` | `FeedOutput.clipping()`, `FeedOutput.cropping()`, `FeedOutput.subtitling()` |
| `Dictionary` | `DictionaryEntry[]` (`content` + optional `soundsLike`), `DictionaryLanguage` |
