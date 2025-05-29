# RFC - AWS Elemental MediaPackage V2 CDK L2 Construct

## L2 Constructs for AWS Elemental MediaPackage V2 ChannelGroup, Channel, OriginEndpoint, ChannelPolicy & OriginEndpointPolicy

* **Original Author(s):** @jamiepmullan
* **Tracking Issue:**
* **API Bar Raiser:**

## README

[AWS Elemental MediaPackage V2](https://aws.amazon.com/mediapackage/) delivers
high-quality video without concern for capacity and makes it easier to implement
popular DVR features such as start over, pause, and rewind. Your content will be
protected with comprehensive support for DRM. The service seamlessly integrates
with other AWS media services as a complete set of tools for cloud-based video
processing and delivery.

Without an L2 construct, developers define MediaPackage channels resources and workflows
for their video pipeline via the AWS console, the AWS CLI, and Infrastructure as Code tools
like CloudFormation and CDK.

However, there are several challenges to defining MediaPackage resources at
scale that an L2 construct can resolve. For example, developers must reference
documentation to determine the valid combinations of parameters for an Origin Endpoint.

We could greatly simplify the developer experience in CDK by introducing MediaPackage L2 constructs.
This will have a mixture of sensible defaults as well as methods to help build correct configurations
of Channel Groups, Channels and Origin Endpoints.

### References

* [What is AWS Elemental MediaPackage?](https://aws.amazon.com/mediapackage/)
* [MediaPackage V2 Documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/what-is.html)
* [MediaPackage V2 L1 (CloudFormation) Constructs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_MediaPackageV2.html)

## AWS Elemental MediaPackage V2 Channel Group

A channel group is the top-level resource that consists of channels and origin endpoints associated with it.
All channels and origin endpoints belonging to this channel group use the same egress domain. This would be the
domain to configure CDNs to stream video from MediaPackage.
For each channel group, you add channels that define the entry point for a content stream into MediaPackage.
You then add origin endpoints to the channels that define the packaging options for the output stream.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/channel-groups.html).

```ts
new mediapackage.ChannelGroup(stack, 'ExampleGroup');
```

Optional override examples:

```ts
new mediapackage.ChannelGroup(stack, 'ExampleGroup', {
  channelGroupName: 'MyExampleGroup',
  description: 'My example channel group',
  tags: {
    environment: 'dev',
  },
});
```

Property Interface for Channel Group:

```ts
ChannelGroupProps{
  /**
    * Channel Group Name
    */
  channelGroupName?: string;

  /**
    * Description of the Channel Group
    */
  description?: string;

  /**
    * Tagging for your Channel Group
    */
  tags?: { [key: string]: string };
}
```

## AWS Elemental MediaPackage V2 Channel

A channel is part of a channel group and represents the entry point for a content stream into MediaPackage.
Upstream encoders such as AWS Elemental MediaLive send content to the channel. When MediaPackage receives a content stream,
it packages the content and outputs the stream from an origin endpoint that you create on the channel. Each incoming
set of adaptive bitrate (ABR) streams has one channel. A channel group can have multiple channels.

This is a simple construct however, we can improve it further by abstracting both `inputType` and `channelGroup`.
In the L1 construct, it actually requires a string input for channel group name, however we will pass in the `IChannelGroup` construct instead.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/channels.html).

```ts
const group = new mediapackage.ChannelGroup(stack, 'Group');
new mediapackage.Channel(stack, 'Channel', {
  channelGroup: group,
  inputType: mediapackage.InputType.CMAF,
});
```

Optional override examples:

```ts
const group = new mediapackage.ChannelGroup(stack, 'Group');
new mediapackage.Channel(stack, 'Channel', {
  channelGroup: group,
  inputType: mediapackage.InputType.CMAF,
  description: 'Input type is CMAF',
  channelName: 'ExampleChannel',
  tags: {
    environment: 'dev',
  },
});
```

Property Interface for Channel:

```ts
ChannelProps{
  /**
   * Channel Group Name
   */
  channelName?: string;

  /**
   * Channel Group
   */
  channelGroup: IChannelGroup;

  /**
   * Input Type
   */
  inputType: InputType;

  /**
   * Description of the Channel Group
   */
  description?: string;

  /**
   * Tagging
   */
  tags?: { [key: string]: string };
}
```

Add Policy to Channel using `addToResourcePolicy()` helper:

```ts
const group = new mediapackage.ChannelGroup(stack, 'MyChannelGroup');
const channel = new mediapackage.Channel(stack, 'myChannel', {
  channelGroup: group,
  inputType: mediapackage.InputType.CMAF,
});
channel.addToResourcePolicy(new PolicyStatement({
  sid: 'AllowMediaLiveRoleToAccessMediaPackageChannel',
  principals: [new ArnPrincipal('arn:aws:iam::AccountID:role/MediaLiveAccessRole')],
  effect: Effect.ALLOW,
  actions: ['mediapackagev2:PutObject'],
  resources: [channel.channelArn],
}));
```

## AWS Elemental MediaPackage V2 OriginEndpoint

This construct has the most complexity in terms of configurability and customisation
that can be achieved in the MediaPackage resources.

Following the design patterns of AWS CDK - the properties will be flattened as much as makes sense - enabling discoverability of props/values.
To also help with speed, OriginEndpoints will need validation to make sure fields are set correctly i.e. correct encryption settings combinations
across TS and CMAF containter types.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/endpoints.html).

Following the design from Channel, we will use `IChannel` as an input to abstract the L1 construct - which actually requires Channel Name
and Channel Group Name.

```ts
const group = new mediapackage.ChannelGroup(stack, 'Group');
const channel = new mediapackage.Channel(stack, 'Channel', {
  channelGroup: group,
  inputType: mediapackage.InputType.CMAF,
});
new mediapackage.OriginEndpoint(stack, 'OriginEndpoint', {
  channel,
  containerType: mediapackage.ContainerType.CMAF,
  manifests: [
    mediapackage.Manifest.hls({
      manifestName: 'index',
    }),
  ],
});
```

Property Interface for OriginEndpoint:

```ts
OriginEndpointProps{
  /**
     * The name of the origin endpoint associated with the origin endpoint configuration.
     */
  originEndpointName?: string;

  /**
     * The channel associated with the origin endpoint.
     */
  channel: IChannel;

  /**
   * The description associated with the origin endpoint.
   */
  description?: string;

  /**
   * The tags associated with the origin endpoint.
   */
  tags?: { [key: string]: string };

  /**
   * Manifests configuration for HLS, Low Latency HLS and DASH.
   * If not defined, use `addManifest()` to add a minimum of 1 Manifest.
   *
   * @default null
   */
  readonly manifests?: Manifest[];

  /**
   * The container type associated with the origin endpoint configuration.
   */
  containerType: ContainerType;

  /**
   * The size of the window to specify a window of the live stream that's available for on-demand viewing.
   * Viewers can start-over or catch-up on content that falls within the window.
   */
  startoverWindow?: Duration;

  /**
   * The segment associated with the origin endpoint.
   *
   * Inside the segment configuration you can define options such as encryption, SPEKE parameters and other
   * general segment configurations.
   */
  segment?: ISegment;

  /**
   * The failover settings for the endpoint.
   * 
   * @default null
   */
  readonly forceEndpointConfigurationConditions?: EndpointErrorConfiguration[];
}
```

Force Endpoint Error Configuration:

```ts
new mediapackage.OriginEndpoint(stack, 'OriginEndpoint', {
  channel,
  containerType: mediapackage.ContainerType.CMAF,
  manifests: [
    mediapackage.Manifest.hls({
      manifestName: 'index',
    }),
  ],
  forceEndpointConfigurationConditions: [mediapackage.EndpointErrorConfiguration.INCOMPLETE_MANIFEST, mediapackage.EndpointErrorConfiguration.STALE_MANIFEST],
});
```

Use DRM/Encryption on an endpoint:

```ts
new mediapackage.OriginEndpoint(stack, 'OriginEndpoint', {
  channel,
  containerType: mediapackage.ContainerType.CMAF,
  manifests: [
    mediapackage.Manifest.hls({
      manifestName: 'index',
    }),
  ],
  segment: {
    encryptionMethod: mediapackage.EncryptionMethod.CMAF_CBCS,
    spekeDrmSystems: [mediapackage.DrmSystems.FAIRPLAY],
    spekeEncryptionContractPresetSpeke20Audio: mediapackage.PresetSpeke20Audio.PRESET_AUDIO_1,
    spekeEncryptionContractPresetSpeke20Video: mediapackage.PresetSpeke20Video.PRESET_VIDEO_1,
    spekeResourceId: 'abcdefghij',
    spekeRole: new Role(stack, 'Role', {
      assumedBy: new ServicePrincipal('mediapackagev2.amazonaws.com'),
    }),
    spekeUrl: 'https://1111111.execute-api.eu-west-1.amazonaws.com/spekeUrl',
  },
});
```

Example DASH configuration:

```ts
new mediapackage.OriginEndpoint(stack, 'OriginEndpoint', {
  channel,
  containerType: mediapackage.ContainerType.CMAF,
  manifests: [mediapackage.Manifest.dash({
    manifestName: 'index',
    periodTriggers: [mediapackage.DashPeriodTriggers.AVAILS],
    segmentTemplateFormat: mediapackage.SegmentTemplateFormat.NUMBER_WITH_TIMELINE,
    scteDashAdMarker: mediapackage.AdMarkerDash.BINARY,
    utcTimingMode: mediapackage.DashUtcTimingMode.HTTP_HEAD,
    utcTimingSource: 'https://example.com',
    manifestWindow: cdk.Duration.seconds(60),
    minBufferTime: cdk.Duration.seconds(10),
    minUpdatePeriod: cdk.Duration.seconds(2),
    suggestedPresentationDelay: cdk.Duration.seconds(60),
  })],
});
```

Filter Configuration on Endpoint:

```ts
new mediapackage.OriginEndpoint(stack, 'OriginEndpoint', {
  channel,
  containerType: mediapackage.ContainerType.CMAF,
  manifests: [
    mediapackage.Manifest.dash({
      manifestName: 'index',
      filterConfiguration: {
        end: new Date('May 18, 2025 15:10:00'),
        start: new Date('May 18, 2025 15:00:00'),
        timeDelay: cdk.Duration.seconds(1),
      },
    }),
  ],
});
```

Filter Configuration customisation to help developer experience and simplify configuration for this part of the resource.
[Refer to our documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/manifest-filter-query-parameters.html).
Firstly Manifest Filtering on Endpoint will use an enum-like class. This helps a developer get started without reading the documentation to find
keys and different permutations of values, ranges and multiple parameters as per the documentation.
However still provides flexibility if there were to be another field added in the future (or some special customization is required).
Secondly, the MediaPackageV2 API requires timestamps to be in a particular format (and in UTC) - so we abstracted to use `Date()` this is then
validated and formatted correctly inside the construct to help with speed of development.

```ts
new mediapackage.OriginEndpoint(stack, 'origin', {
  channel,
  containerType: mediapackage.ContainerType.CMAF,
  manifests: [mediapackage.Manifest.hls({
    manifestName: 'index',
    filterConfiguration: {
      end: new Date('May 18, 2025 15:10:00'),
      start: new Date('May 18, 2025 15:00:00'),
      timeDelay: Duration.seconds(1),
      manifestFilter: [
        mediapackage.ManifestFilter.range(mediapackage.ManifestFilterKeys.AUDIO_SAMPLE_RATE, 0, 50000),
        mediapackage.ManifestFilter.range(mediapackage.ManifestFilterKeys.VIDEO_FRAMERATE, 23.976, 30),
        mediapackage.ManifestFilter.single(mediapackage.ManifestFilterKeys.VIDEO_CODEC, 'h264'),
        mediapackage.ManifestFilter.multiple(mediapackage.ManifestFilterKeys.VIDEO_HEIGHT, ['240p', '360p', '720p-1080p']),
        mediapackage.ManifestFilter.custom('audio_language:fr,en-US,de'),
      ],
    },
  })],
  startoverWindow: Duration.seconds(100),
});
```

Providing ManifestFilter in an enum-like class:

```ts
/**
 * Enable filters for MediaPackageV2 Origin Endpoint
 */
export class ManifestFilter {
  /**
   * Specifying only a single manifest filter key and value
   */
  public static single(key: ManifestFilterKeys, value: string | number) {
    return new ManifestFilter(`${key}:${value}`);
  }

  /**
   * Specifying a manifest filter key and multiple values
   */
  public static multiple(key: ManifestFilterKeys, value: string[] | number[]) {
    return new ManifestFilter(`${key}:${value.join(',')}`);
  }

  /**
   * Specifying a manifest filter key and a value range
   */
  public static range(key: ManifestFilterKeys, start: string | number, end: string | number) {
    if (typeof start != typeof end) throw new UnscopedValidationError('Ensure Manifest Filters types match on range.');
    return new ManifestFilter(`${key}:${start}-${end}`);
  }

  /**
   * Specifying a custom string
   */
  public static custom(custom: string) {
    return new ManifestFilter(custom);
  }

  /**
   * @param filterString Manifest Filter String to apply to the endpoint
   */
  protected constructor(public readonly filterString: string) { }
}
```

One other key abstraction would be the field `manifests`. In the L1 CFN construct it actually surfaces itself as 3 fields:
hlsManifest, lowLatencyManifests, dashManifests.
To simplify the configuration, we will use another enum-like class to allow a user to specify all the configurations required in 1 input field.
This will unpack into the correct field inside the L2 construct.

```ts
/**
 * Manifest configuration for MediaPackageV2 Origin Endpoint
 */
export class Manifest {
  /**
   * Specify a manifest configuration for Low Latency HLS.
   */
  public static lowLatencyHLS(manifest: ILowLatencyHlsManifestConfiguration) {
    return new Manifest(manifest, ManifestKey.LOW_LATENCY_HLS);
  }

  /**
   * Specify a manifest configuration for HLS.
   */
  public static hls(manifest: IHlsManifestConfiguration) {
    return new Manifest(manifest, ManifestKey.HLS);
  }

  /**
   * Specify a manifest configuration for DASH.
   */
  public static dash(manifest: IDashManifestConfiguration) {
    return new Manifest(manifest, ManifestKey.DASH);
  }

  /**
   * @param manifest Manifest Configuration
   * @param key Key field to differentiate the configurations
   */
  protected constructor(public readonly manifest: ILowLatencyHlsManifestConfiguration | IHlsManifestConfiguration | IDashManifestConfiguration,
    public readonly key: ManifestKey) { }
}
```

Add Policy to Origin Endpoint using `addToResourcePolicy()` helper:

```ts
const origin = new mediapackage.OriginEndpoint(stack, 'myEndpoint', {
  channel,
  containerType: mediapackage.ContainerType.CMAF,
  manifests: [
    mediapackage.Manifest.hls({
      manifestName: 'index',
    }),
  ],
});
origin.addToResourcePolicy(new PolicyStatement({
  sid: 'AllowRequestsFromCloudFront',
  principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
  effect: Effect.ALLOW,
  actions: ['mediapackagev2:GetHeadObject', 'mediapackagev2:GetObject'],
  resources: [origin.originEndpointArn],
  conditions: {
    StringEquals: {
      'aws:SourceArn': 'arn:aws:cloudfront::123456789012:distribution/AAAAAAAAA',
    },
  },
}));
```

## MediaPackage V2 ChannelPolicy

This resource specifies the configuration parameters of a MediaPackage V2 channel policy.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/using-iam-policies.html).

Although this class/construct will be available - we will push a developer to use the `addResourcePolicy` in
a similar manner to S3 Buckets.

Example how you could use this resource:

```ts
const policy = new mediapackage.ChannelPolicy(stack, 'ChannelPolicy', {
  channel,
});
policy.document.addStatements(new PolicyStatement({
  sid: 'AllowMediaLiveRoleToAccessMediaPackageChannel',
  principals: [new ArnPrincipal('arn:aws:iam::AccountID:role/MediaLiveAccessRole')],
  effect: Effect.ALLOW,
  actions: ['mediapackagev2:PutObject'],
  resources: [channel.channelArn],
}));
```

## MediaPackage V2 OriginEndpointPolicy

Specifies the configuration parameters of a policy associated with a MediaPackage V2 origin endpoint.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/using-iam-policies.html).

Although this class/construct will be available - we will push a developer to use the `addResourcePolicy` in
a similar manner to S3 Buckets.

Example how you could use this resource:

```ts
const policy = new mediapackage.OriginEndpointPolicy(stack, 'OriginPolicy', {
  originEndpoint: origin,
});

policy.document.addStatements(new PolicyStatement({
  sid: 'AllowRequestsFromCloudFront',
  principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
  effect: Effect.ALLOW,
  actions: ['mediapackagev2:GetHeadObject', 'mediapackagev2:GetObject'],
  resources: [origin.originEndpointArn],
  conditions: {
    StringEquals: {
      'aws:SourceArn': 'arn:aws:cloudfront::123456789012:distribution/AAAAAAAAA',
    },
  },
}));
```

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ TODO

> This section should include answers to questions readers will likely ask about
> this release. Similar to the "working backwards", this section should be
> written in a language as if the feature is now released.
>
> The template includes a some common questions, feel free to add any questions
> that might be relevant to this feature or omit questions that you feel are not
> applicable.

### What are we launching today?

> What exactly are we launching? Is this a new feature in an existing module? A
> new module? A whole framework? A change in the CLI?

We’re launching new AWS Elemental MediaPackageV2 L2 Constructs to provide
best-practice defaults and developer friendly functions to create your
ChannelGroup, Channel, OriginEndpoint, ChannelPolicy and OriginEndpointPolicy.

The primary aim is to help users with guardrails to help
developer experience, as well as speeding up the development process generally.

### Why should I use this feature?

> Describe use cases that are addressed by this feature.

Developers should use this Construct to reduce the amount of boilerplate
code, complexity each individual has to navigate, and make it easier to
create MediaPackageV2 resources.

This construct is the start of abstracting AWS Elemental Media Services.
Meaning that we can help builders with compatibility, construction and integration
in these services.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

Today we help builders with reference architectures using the opensource project
[AWS CDK Media Services Reference Architectures](https://github.com/aws-samples/aws-cdk-mediaservices-refarch).
This open source project has received much positive feedback.

By building out an L2 CDK construct for AWS Elemental MediaPackageV2 (and others services in the future) will mean we can simplify these architectures.
This would put us in a position (in the future) of being able to provide opinionated higher-level patterns (L3+) after full L2 coverage.
To build a pattern, the other 2 RFCs that may come in the future would be AWS Elemental MediaConnect and AWS Elemental MediaLive.
By abstracting and simplifying these resources will aide this effort and
continue improving our developer experience in AWS CDK.

Another example of an L2 that could utilize this resource would be [CloudFront Origins](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins-readme.html).

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

Users today are already using the L1 construct, and would likely need to do a workflow
change and redeployment to alter this existing way of working.

### What is the technical solution (design) of this feature?

> Briefly describe the high-level design approach for implementing this feature.
>
> As appropriate, you can add an appendix with a more detailed design document.
>
> This is a good place to reference a prototype or proof of concept, which is
> highly recommended for most RFCs.

The main thing required for these resources in particular are abstrating fields.
This will make the services more accessible and speed up the development process as you don't need
to deep-dive the documentation to understand the resource.

### Is this a breaking change?

> If the answer is no. Otherwise:
>
> Describe what ways did you consider to deliver this without breaking users?
>
> Make sure to include a `BREAKING CHANGE` clause under the CHANGELOG section with a description of the breaking
> changes and the migration path.

No - an L2 doesn't exist today.

### What alternative solutions did you consider?

> Briefly describe alternative approaches that you considered. If there are
> hairy details, include them in an appendix.

N/A - we already have an opensource project to help builders build these services (as mentioned previously).
However, we want this to be part of the aws-cdk project to help all users/developers using these services.

### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

N/A

### What is the high-level project plan?

> Describe your plan on how to deliver this feature from prototyping to GA.
> Especially think about how to "bake" it in the open and get constant feedback
> from users before you stabilize the APIs.
>
> If you have a project board with your implementation plan, this is a good
> place to link to it.

I have already built a draft L2 construct, working towards getting an alpha draft.

### Are there any open issues that need to be addressed later?

> Describe any major open issues that this RFC did not take into account. Once
> the RFC is approved, create GitHub issues for these issues and update this RFC
> of the project board with these issue IDs.

N/A
