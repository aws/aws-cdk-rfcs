# RFC 728 - AWS Elemental MediaPackage V2 CDK L2 Construct

## L2 Constructs for AWS Elemental MediaPackage V2 ChannelGroup, Channel, OriginEndpoint, ChannelPolicy & OriginEndpointPolicy

* **Original Author(s):** @jamiepmullan
* **Tracking Issue:** [#728](https://github.com/aws/aws-cdk-rfcs/issues/728)
* **API Bar Raiser:** @kumsmrit

This design outlines the how we build an L2 construct for AWS Elemental MediaPackageV2, delivering the following benefits:

- Implement sensible defaults to make getting started with AWS Elemental MediaPackageV2 easier.
- Simplify the declaration of ChannelGroup, Channel and OriginEndpoint by passing the object/construct as a mandatory props value -
usually declared by passing the literal string of the Channel Group name to Channel, then in turn the Channel Group Name AND Channel Name to
Origin Endpoints (also in Policies).
- Make fetching Ingest Endpoints URLs easier without using `Fn.select()` in the implementing code
- Abstract manifests in 1 property definition - using enum-like classes to define HLS, DASH and Low Latency HLS respectively
- Provide faster validation within CDK i.e. making sure parameters are compatible with each other
- Include helper functions such as:
  - `.addChannel()` or `.addOriginEndpoint()` to make resource definitions easier
  - Add metric functions to provide default/basic CloudWatch metrics as per CDK design
  - `addToResourcePolicy()` to simplify how the ChannelPolicy and OriginEndpointPolicy gets initialised and added - similar behaviour to S3 buckets
  - `grantIngress()` to create a policy to the identity passed in (i.e. a MediaLive role)
- Use types instead of string literals to simplify definitons i.e. Duration + Date. Use Enums and Enum-like classes to abstract other types.

The code sample below is a simple configuration comparison between the existing L1 construct and what a L2 _could_ look like:

```ts
  const distribution: Distribution;

  const channelGroup = new CfnChannelGroup(stack, 'group', {
    channelGroupName: 'example-channel-group',
  });

  const channel = new CfnChannel(stack, 'channel', {
    channelName: 'example-channel',
    channelGroupName: channelGroup.channelGroupName,
    inputType: 'CMAF'
  });

  const endpoint = new CfnOriginEndpoint(stack, 'endpoint1', {
    channelGroupName: channelGroup.channelGroupName,
    channelName: channel.channelName,
    originEndpointName: 'example-endpoint-hls-1',
    containerType: 'TS',
    hlsManifests: [{
      manifestName: 'index',
      filterConfiguration: {
        end: '2025-03-15T17:25:00+00:00',
        manifestFilter: 'audio_sample_rate:0-50000;video_framerate:23.976-30;video_codec:h264;video_height:240,360,720-1080;audio_language:fr,en-US,de',
        start: '2025-03-15T17:20:00+00:00',
        timeDelaySeconds: 10,
      },
    }],
    startoverWindowSeconds: 10800,
  });

  const policy = new CfnOriginEndpointPolicy(stack, 'origin-endpoint-policy', {
    channelGroupName: channelGroup.channelGroupName,
    channelName: channel.channelName,
    originEndpointName: endpoint.originEndpointName,
    policy: new PolicyDocument({
      statements: [
        new PolicyStatement({
          sid: 'AllowRequestsFromCloudFront',
          effect: Effect.ALLOW,
          actions: [
            'mediapackagev2:GetObject',
            'mediapackagev2:GetHeadObject',
          ],
          principals: [
            new ServicePrincipal('cloudfront.amazonaws.com'),
          ],
          resources: [endpoint.attrArn],
          conditions: {
            StringEquals: {
              'aws:SourceArn': [`arn:aws:cloudfront::1234567890:distribution/${distribution.distributionId}` ],
            },
          },
        }),
      ]
    })
  });
```

Same Configuration in an example L2:

```ts
  const distribution: Distribution;

  const channelGroup = new mediapackagev2.ChannelGroup(stack, 'group');
  const channel = channelGroup.addChannel('channel', {
    channelName: 'example-channel',
    inputType: mediapackagev2.InputType.CMAF,
  });

  const endpoint = channel.addOriginEndpoint('endpoint1', {
    containerType: mediapackagev2.ContainerType.CMAF,
    manifests: [
      mediapackagev2.Manifest.hls({
        manifestName: 'index',
        filterConfiguration: {
          end: new Date('2025-04-15T17:25:00Z'),
          start: new Date('2025-04-15T17:20:00Z'),
          timeDelay: Duration.seconds(10),
          manifestFilter: [
            mediapackagev2.ManifestFilter.range(mediapackagev2.ManifestFilterKeys.AUDIO_SAMPLE_RATE, 0, 50000),
            mediapackagev2.ManifestFilter.range(mediapackagev2.ManifestFilterKeys.VIDEO_FRAMERATE, 23.976, 30),
            mediapackagev2.ManifestFilter.single(mediapackagev2.ManifestFilterKeys.VIDEO_CODEC, 'h264'),
            mediapackagev2.ManifestFilter.multiple(mediapackagev2.ManifestFilterKeys.VIDEO_HEIGHT, ['240', '360', '720-1080']),
            mediapackagev2.ManifestFilter.custom('audio_language:fr,en-US,de'),
          ],
        },
      }),
    ],
    startoverWindow: Duration.seconds(100),
  });

  endpoint.addToResourcePolicy(new PolicyStatement({
    sid: 'AllowRequestsFromCloudFront',
    effect: Effect.ALLOW,
    actions: [
      'mediapackagev2:GetObject',
      'mediapackagev2:GetHeadObject',
    ],
    principals: [
      new ServicePrincipal('cloudfront.amazonaws.com'),
    ],
    resources: [endpoint.originEndpointArn],
    conditions: {
      StringEquals: {
        'aws:SourceArn': [`arn:aws:cloudfront::1234567890:distribution/${distribution.distributionId}`],
      },
    },
  }));
```

The rest of this doc outlines the design for an L2 construct.

## Working Backwards

### README

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

* [What is AWS Elemental MediaPackage?](https://aws.amazon.com/mediapackage/)
* [MediaPackage V2 Documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/what-is.html)
* [MediaPackage V2 L1 (CloudFormation) Constructs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_MediaPackageV2.html)

#### AWS Elemental MediaPackage V2 Channel Group

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

  /**
   * Policy to apply when the Channel Group is removed from the stack
   *
   * @default RemovalPolicy.DESTROY
   */
  removalPolicy?: RemovalPolicy;
}
```

Interface example of what the Channel Group will implement:

```ts
/**
 * Interface for MediaPackageV2 Channel Group
 */
export interface IChannelGroup extends IResource {
  /**
   * The name that describes the channel group. The name is the primary identifier for the channel group.
   *
   * @attribute
   */
  readonly channelGroupName: string;

  /**
   * The Amazon Resource Name (ARN) associated with the resource.
   *
   * @attribute
   */
  readonly channelGroupArn: string;

  /**
   * Create a CloudWatch metric.
   *
   * @param metricName name of the metric
   * @param props metric options.
   */
  metric(metricName: string, props?: MetricOptions): Metric;

  /**
   * Returns Metric for Ingress Bytes
   *
   * @default - sum over 60 seconds
   */
  metricIngressBytes(options?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Bytes
   *
   * @default - sum over 60 seconds
   */
  metricEgressBytes(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Ingress response time
   *
   * @default - average over 60 seconds
   */
  metricIngressResponseTime(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Response time
   *
   * @default - sum over 60 seconds
   */
  metricEgressResponseTime(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Ingress Request Count
   *
   * @default - sum over 60 seconds
   */
  metricIngressRequestCount(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Request Count
   *
   * @default - sum over 60 seconds
   */
  metricEgressRequestCount(props?: MetricOptions): Metric;

  /**
   * Add Channel for this Channel Group.
   */
  addChannel(id: string, options: ChannelOptions): Channel;
}
```

#### AWS Elemental MediaPackage V2 Channel

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
   * Channel Name
   */
  channelName?: string;

  /**
   * Channel Group
   */
  channelGroup: IChannelGroup;

  /**
   * Input Type
   *
   * @default HLS
   */
  inputType?: InputType;

  /**
   * Description of the Channel
   */
  description?: string;

  /**
   * Tagging
   */
  tags?: { [key: string]: string };

  /**
   * Policy to apply when the Channel is removed from the stack
   *
   * @default RemovalPolicy.DESTROY
   */
  removalPolicy?: RemovalPolicy;
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

Provide helper methods on the channel resource interface:

```ts
/**
 * Interface for MediaPackageV2 Channel
 */
export interface IChannel extends IResource {
  /**
   * The name that describes the channel group. The name is the primary identifier for the channel group.
   *
   * @attribute
   */
  readonly channelGroupName: string;

  /**
   * The name that describes the channel. The name is the primary identifier for the channel.
   *
   * @attribute
   */
  readonly channelName: string;

  /**
   * The Amazon Resource Name (ARN) associated with the resource.
   *
   * @attribute
   */
  readonly channelArn: string;

  /**
   * Grants IAM resource policy to the role used by AWS Elemental MediaLive to write to MediaPackageV2 Channel.
   */
  grantIngest(grantee: IGrantable): Grant;

  /**
   * Add Origin Endpoint for this Channel.
   */
  addOriginEndpoint(id: string, options: OriginEndpointOptions): OriginEndpoint;

  /**
   * Configure channel policy.
   *
   * You can only add 1 ChannelPolicy to a Channel.
   * If you have already defined one, function will append the policy already created.
   */
  addToResourcePolicy(statement: PolicyStatement): AddToResourcePolicyResult;

  /**
   * Create a CloudWatch metric.
   *
   * @param metricName name
   * @param props metric options.
   */
  metric(metricName: string, props?: MetricOptions): Metric;

  /**
   * Returns Metric for Ingress Bytes
   *
   * @default - sum over 60 seconds
   */
  metricIngressBytes(options?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Bytes
   *
   * @default - sum over 60 seconds
   */
  metricEgressBytes(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Ingress response time
   *
   * @default - average over 60 seconds
   */
  metricIngressResponseTime(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Response time
   *
   * @default - sum over 60 seconds
   */
  metricEgressResponseTime(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Ingress Request Count
   *
   * @default - sum over 60 seconds
   */
  metricIngressRequestCount(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Request Count
   *
   * @default - sum over 60 seconds
   */
  metricEgressRequestCount(props?: MetricOptions): Metric;
}
```

#### AWS Elemental MediaPackage V2 OriginEndpoint

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
   */
  manifests: Manifest[];

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
   *
   * @default undefined
   */
  segment?: ISegment;

  /**
   * Configuration adding encryption.
   *
   * @default undefined
   */
  encryption?: IEncryption;

  /**
   * The failover settings for the endpoint.
   * 
   * @default null
   */
  forceEndpointConfigurationConditions?: EndpointErrorConfiguration[];

  /**
   * Policy to apply when the Origin Endpoint is removed from the stack
   *
   * @default RemovalPolicy.DESTROY
   */
  removalPolicy?: RemovalPolicy;
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
  encryption: {
    method: mediapackage.EncryptionMethod.CMAF_CBCS,
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

Example TS Segment settings:

```ts
new mediapackage.OriginEndpoint(stack, 'origin', {
  channel,
  containerType: mediapackage.ContainerType.TS,
  startoverWindow: Duration.seconds(100),
  manifests: [
    mediapackage.Manifest.hls({
      manifestName: 'index',
    }),
  ],
  segment: {
    scteFilter: [mediapackage.ScteMessageType.BREAK, mediapackage.ScteMessageType.DISTRIBUTOR_ADVERTISEMENT],
    tsIncludeDvbSubtitles: true,
    tsUseAudioRenditionGroup: true,
    segmentDuration: Duration.seconds(2),
    segmentName: 'mysegment',
  },
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
        mediapackage.ManifestFilter.multiple(mediapackage.ManifestFilterKeys.VIDEO_HEIGHT, ['240', '360', '720-1080']),
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

Provide helper methods on the origin endpoint resource interface:

```ts
/**
 * Origin Endpoint interface
 */
export interface IOriginEndpoint extends IResource {
  /**
   * The name of the channel group associated with the origin endpoint configuration.
   *
   * @attribute
   */
  readonly channelGroupName: string;

  /**
   * The channel name associated with the origin endpoint.
   *
   * @attribute
   */
  readonly channelName: string;

  /**
   * The name of the origin endpoint associated with the origin endpoint configuration.
   *
   * @attribute
   */
  readonly originEndpointName: string;

  /**
   * The Amazon Resource Name (ARN) of the origin endpoint.
   *
   * @attribute
   */
  readonly originEndpointArn: string;

  /**
   * Configure channel policy.
   *
   * You can only add 1 ChannelPolicy to a Channel.
   * If you have already defined one it append the policy already created.
   */
  addToResourcePolicy(statement: PolicyStatement): AddToResourcePolicyResult;

  /**
   * Add to Manifests
   */
  addManifest(manifest: Manifest): void;

  /**
   * Create a CloudWatch metric.
   *
   * @param metricName name
   * @param props metric options.
   */
  metric(metricName: string, props?: MetricOptions): Metric;

  /**
   * Returns Metric for Ingress Bytes
   *
   * @default - sum over 60 seconds
   */
  metricIngressBytes(options?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Bytes
   *
   * @default - sum over 60 seconds
   */
  metricEgressBytes(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Ingress response time
   *
   * @default - average over 60 seconds
   */
  metricIngressResponseTime(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Response time
   *
   * @default - sum over 60 seconds
   */
  metricEgressResponseTime(props?: MetricOptions): Metric;

  /**
   * Returns Metric for Egress Request Count
   *
   * @default - sum over 60 seconds
   */
  metricEgressRequestCount(props?: MetricOptions): Metric;
}
```

#### MediaPackage V2 ChannelPolicy

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

#### MediaPackage V2 OriginEndpointPolicy

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

## Public FAQ

### What are we launching today?

We’re launching new AWS Elemental MediaPackageV2 L2 Constructs to provide
best-practice defaults and developer friendly functions to create your
ChannelGroup, Channel, OriginEndpoint, ChannelPolicy and OriginEndpointPolicy.

The primary aim is to help users with guardrails to help
developer experience, as well as speeding up the development process generally.

### Why should I use this feature?

Developers should use this Construct to reduce the amount of boilerplate
code, complexity each individual has to navigate, and make it easier to
create MediaPackageV2 resources.

This construct is the start of abstracting AWS Elemental Media Services.
Meaning that we can help builders with compatibility, construction and integration
in these services.

## Internal FAQ

### Why are we doing this?

Today we help builders with reference architectures using the opensource project
[AWS CDK Media Services Reference Architectures](https://github.com/aws-samples/aws-cdk-mediaservices-refarch).
This open source project has received much positive feedback.

By building out an L2 CDK construct for AWS Elemental MediaPackageV2 (and others services in the future) will mean we can simplify these architectures.

The existing process requires extensive configuration and lacks standardization, leading to potential errors and a time-consuming setup process.
By abstracting and simplifying these resources (L2) we will continue improving our developer experience in AWS CDK.

Another example of an L2 that could utilize this resource would be [CloudFront Origins](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins-readme.html).

### Why should we _not_ do this?

Users today are already using the L1 construct, and would likely need to do a workflow
change and redeployment to alter this existing way of working.

### What is the technical solution (design) of this feature?

The main thing required for these resources in particular are abstrating fields.
This will make the services more accessible and speed up the development process as you don't need
to deep-dive the documentation to understand the resource.

### Is this a breaking change?

No - an L2 doesn't exist today.

### What alternative solutions did you consider?

N/A - we already have an opensource project to help builders build these services (as mentioned previously).
However, we want this to be part of the aws-cdk project to help all users/developers using these services.

### What are the drawbacks of this solution?

N/A

### What is the high-level project plan?

I have already built a draft L2 construct, working towards getting an alpha draft.

### Are there any open issues that need to be addressed later?

N/A
