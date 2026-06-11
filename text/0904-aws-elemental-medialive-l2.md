---
# RFC — AWS Elemental MediaLive CDK L2 Constructs

## L2 Constructs for AWS Elemental MediaLive Input, InputSecurityGroup, Channel, Network, Cluster & ChannelPlacementGroup

* **Original Author(s):** @jamiepmullan
* **Tracking Issue:** TBD
* **API Bar Raiser:** TBD

This design outlines how we build L2 constructs for AWS Elemental MediaLive, delivering the following benefits:

- Implement sensible defaults to make getting started with AWS Elemental MediaLive easier.
- Simplify the declaration of Inputs, Channels, and Output Groups by using typed factory methods and abstract classes instead of deeply nested CFN property bags.
- Abstract one of the most complex CloudFormation resource in the CDK — `AWS::MediaLive::Channel` has hundreds of nested properties — into a composable, type-safe API.
- Provide typed factories for all 9 output group types, all 5 video codecs, and all 7 audio codecs.
- Auto-derive video/audio/caption encode descriptions from outputs at synth time, deduplicating by name at the channel level.
- Validate codec compatibility per output group type, destination counts per channel class, and resolution constraints at synth time — catching errors before deployment.
- Use CDK `Duration` and `Bitrate` types instead of raw numbers for all time-based and bitrate properties.
- Guard string validations with `Token.isUnresolved()` to support lazy/token values.
- Support MediaLive Anywhere deployments with Network, Cluster, and ChannelPlacementGroup constructs.
- Implement other modules both upstream and downstream with AWS Elemental MediaConnect and origination servers (AWS Elemental MediaPackage V2 and Amazon S3) respectively.

The `AWS::MediaLive::Channel` CloudFormation resource has more nested properties than many other AWS resource, and the L2 abstracts that complexity into a composable, discoverable API.

The code sample below is a configuration comparison between the existing L1 construct and what the L2 looks like:

### L1 (CloudFormation) — MediaConnect Router → Channel with MediaPackage V2 + HLS outputs

```ts
import { CfnInput, CfnChannel } from 'aws-cdk-lib/aws-medialive';

// Input
const cfnInput = new CfnInput(stack, 'Input', {
  name: 'my-router-input',
  type: 'MEDIACONNECT_ROUTER',
  routerSettings: {
    destinations: [
      { availabilityZoneName: 'us-east-1a' },
      { availabilityZoneName: 'us-east-1b' },
    ],
    encryptionType: 'AUTOMATIC',
  },
});

// Channel — note the deeply nested, repetitive property bags
const cfnChannel = new CfnChannel(stack, 'Channel', {
  name: 'my-channel',
  channelClass: 'STANDARD',
  roleArn: role.roleArn,
  inputAttachments: [{
    inputId: cfnInput.ref,
    inputSettings: {
      sourceEndBehavior: 'CONTINUE',
      inputFilter: 'AUTO',
      filterStrength: 1,
      deblockFilter: 'DISABLED',
      denoiseFilter: 'DISABLED',
      smpte2038DataPreference: 'IGNORE',
    },
  }],
  inputSpecification: {
    codec: 'AVC',
    maximumBitrate: 'MAX_20_MBPS',
    resolution: 'HD',
  },
  destinations: [
    {
      id: 'mp2-dest',
      mediaPackageSettings: [
        { channelName: 'my-mp-channel', channelGroup: 'my-group', channelEndpointId: 'ENDPOINT_1' },
        { channelName: 'my-mp-channel', channelGroup: 'my-group', channelEndpointId: 'ENDPOINT_2' },
      ],
    },
    {
      id: 'hls-dest',
      settings: [
        { url: 's3ssl://bucket/pipeline-0/index' },
        { url: 's3ssl://bucket/pipeline-1/index' },
      ],
    },
  ],
  encoderSettings: {
    timecodeConfig: { source: 'EMBEDDED' },
    videoDescriptions: [
      {
        name: 'video_1920x1080',
        width: 1920,
        height: 1080,
        respondToAfd: 'NONE',
        scalingBehavior: 'DEFAULT',
        sharpness: 50,
        codecSettings: {
          h264Settings: {
            profile: 'HIGH',
            rateControlMode: 'CBR',
            bitrate: 5000000,
            gopSize: 2,
            gopSizeUnits: 'SECONDS',
            gopNumBFrames: 3,
            adaptiveQuantization: 'HIGH',
            framerateControl: 'SPECIFIED',
            framerateNumerator: 30000,
            framerateDenominator: 1001,
            parControl: 'SPECIFIED',
            parNumerator: 1,
            parDenominator: 1,
            sceneChangeDetect: 'ENABLED',
            spatialAq: 'ENABLED',
            temporalAq: 'ENABLED',
          },
        },
      },
      {
        name: 'video_1280x720',
        width: 1280,
        height: 720,
        respondToAfd: 'NONE',
        scalingBehavior: 'DEFAULT',
        sharpness: 50,
        codecSettings: {
          h264Settings: {
            profile: 'HIGH',
            rateControlMode: 'CBR',
            bitrate: 3000000,
            gopSize: 2,
            gopSizeUnits: 'SECONDS',
            gopNumBFrames: 3,
            adaptiveQuantization: 'HIGH',
            framerateControl: 'SPECIFIED',
            framerateNumerator: 30000,
            framerateDenominator: 1001,
            parControl: 'SPECIFIED',
            parNumerator: 1,
            parDenominator: 1,
            sceneChangeDetect: 'ENABLED',
            spatialAq: 'ENABLED',
            temporalAq: 'ENABLED',
          },
        },
      },
    ],
    audioDescriptions: [
      {
        name: 'audio_aac_stereo',
        audioSelectorName: 'default',
        audioTypeControl: 'FOLLOW_INPUT',
        languageCodeControl: 'FOLLOW_INPUT',
        codecSettings: {
          aacSettings: {
            bitrate: 192000,
            profile: 'LC',
            codingMode: 'CODING_MODE_2_0',
            rateControlMode: 'CBR',
            sampleRate: 48000,
            rawFormat: 'NONE',
            spec: 'MPEG4',
            inputType: 'NORMAL',
          },
        },
      },
    ],
    outputGroups: [
      {
        outputGroupSettings: {
          mediaPackageGroupSettings: {
            destination: { destinationRefId: 'mp2-dest' },
            mediapackageV2GroupSettings: {},
          },
        },
        outputs: [
          {
            outputName: 'mp2-video-1080',
            outputSettings: {
              mediaPackageOutputSettings: {
                mediaPackageV2DestinationSettings: { audioRenditionSets: 'programAudio' },
              },
            },
            videoDescriptionName: 'video_1920x1080',
          },
          {
            outputName: 'mp2-video-720',
            outputSettings: {
              mediaPackageOutputSettings: {
                mediaPackageV2DestinationSettings: { audioRenditionSets: 'programAudio' },
              },
            },
            videoDescriptionName: 'video_1280x720',
          },
          {
            outputName: 'mp2-audio',
            outputSettings: {
              mediaPackageOutputSettings: {
                mediaPackageV2DestinationSettings: { audioGroupId: 'programAudio', hlsAutoSelect: 'OMIT', hlsDefault: 'OMIT' },
              },
            },
            audioDescriptionNames: ['audio_aac_stereo'],
          },
        ],
      },
      {
        outputGroupSettings: {
          hlsGroupSettings: {
            destination: { destinationRefId: 'hls-dest' },
            segmentLength: 6,
            keepSegments: 21,
            indexNSegments: 7,
            mode: 'LIVE',
            minSegmentLength: 0,
            inputLossAction: 'EMIT_OUTPUT',
          },
        },
        outputs: [
          {
            outputName: 'hls-1080',
            outputSettings: {
              hlsOutputSettings: {
                nameModifier: '_1080p',
                hlsSettings: { standardHlsSettings: { m3U8Settings: {} } },
              },
            },
            videoDescriptionName: 'video_1920x1080',
            audioDescriptionNames: ['audio_aac_stereo'],
          },
          {
            outputName: 'hls-720',
            outputSettings: {
              hlsOutputSettings: {
                nameModifier: '_720p',
                hlsSettings: { standardHlsSettings: { m3U8Settings: {} } },
              },
            },
            videoDescriptionName: 'video_1280x720',
            audioDescriptionNames: ['audio_aac_stereo'],
          },
        ],
      },
    ],
  },
});
```

### L2 — Same configuration

```ts
import * as medialive from '@aws-cdk/aws-medialive-alpha';
import { Bitrate } from 'aws-cdk-lib';

// Input — typed factory, no raw strings
const input = new medialive.Input(stack, 'Input', {
  inputName: 'my-router-input',
  input: medialive.InputConfiguration.mediaConnectRouter({
    availabilityZones: ['us-east-1a', 'us-east-1b'],
  }),
});

// Shared encode configurations — defined once, referenced by multiple output groups
const video1080 = medialive.EncodeConfiguration.video({
  name: 'video_1080p',
  width: 1920,
  height: 1080,
  codecSettings: medialive.VideoCodecSettings.h264({
    profile: medialive.H264Profile.HIGH,
    rateControl: medialive.H264RateControl.cbr({ bitrate: Bitrate.mbps(5) }),
    framerate: medialive.Framerate.FPS_29_97,
    gopSize: medialive.GopSize.seconds(2),
    gopNumBFrames: 3,
    adaptiveQuantization: medialive.H264AdaptiveQuantization.HIGH,
  }),
});

const video720 = medialive.EncodeConfiguration.video({
  name: 'video_720p',
  width: 1280,
  height: 720,
  codecSettings: medialive.VideoCodecSettings.h264({
    profile: medialive.H264Profile.HIGH,
    rateControl: medialive.H264RateControl.cbr({ bitrate: Bitrate.mbps(3) }),
    framerate: medialive.Framerate.FPS_29_97,
    gopSize: medialive.GopSize.seconds(2),
    gopNumBFrames: 3,
    adaptiveQuantization: medialive.H264AdaptiveQuantization.HIGH,
  }),
});

const audioStereo = medialive.EncodeConfiguration.audio({
  name: 'audio_aac_stereo',
  codecSettings: medialive.AudioCodecSettings.aac({
    bitrate: Bitrate.kbps(192),
    profile: medialive.AacProfile.LC,
    codingMode: medialive.AacCodingMode.CODING_MODE_2_0,
  }),
});

// Channel — encodes auto-derived from outputs, deduped by name
const channel = new medialive.Channel(stack, 'Channel', {
  channelName: 'my-channel',
  channelClass: medialive.ChannelClass.STANDARD,
  role,
  inputs: [{ input }],
  outputGroups: [
    medialive.OutputGroupConfiguration.mediaPackageV2({
      name: 'mp2-dest',
      destinations: [
        medialive.MediaPackageV2Destination.channel(mpChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_1),
        medialive.MediaPackageV2Destination.channel(mpChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_2),
      ],
      outputs: [
        { outputName: 'mp2-video-1080', encode: video1080 },
        { outputName: 'mp2-video-720', encode: video720 },
        { outputName: 'mp2-audio', encode: audioStereo },
      ],
    }),
    medialive.OutputGroupConfiguration.hls({
      name: 'hls-dest',
      destinations: [
        medialive.OutputDestination.toBucket(originBucket, 'pipeline-0/index'),
        medialive.OutputDestination.toBucket(originBucket, 'pipeline-1/index'),
      ],
      segment: medialive.Segment.seconds(6),
      keepSegments: 21,
      indexNSegments: 7,
      outputs: [
        { outputName: 'hls-1080', nameModifier: '_1080p', encodes: [video1080, audioStereo] },
        { outputName: 'hls-720', nameModifier: '_720p', encodes: [video720, audioStereo] },
      ],
    }),
  ],
});
```

The L2 reduces the code from ~170 lines to ~70 lines, eliminates string-based codec configuration, and catches invalid codec/output-group combinations at synth time.

The rest of this doc outlines the design for the L2 constructs.

## Working Backwards

### README

[AWS Elemental MediaLive](https://aws.amazon.com/medialive/) is a real-time video service for creating live outputs for broadcast and streaming delivery. It transforms live video content from one format and package into others, ensuring compatibility with playback devices such as smartphones and set-top boxes.

Without an L2 construct, developers define MediaLive resources via the AWS console, the AWS CLI, or raw CloudFormation/CDK L1 constructs. The `AWS::MediaLive::Channel` resource is one of the most complex CloudFormation resource in AWS, with hundreds of nested properties for encoder settings, output groups, codec configurations, and destinations.

We greatly simplify the developer experience by introducing MediaLive L2 constructs that:

- Use typed factory methods instead of deeply nested property bags
- Auto-derive encoder settings from output configurations at synth time
- Validate codec compatibility per output group type before deployment
- Validate destination counts based on channel class (STANDARD vs SINGLE_PIPELINE)
- Use CDK `Duration` and `Bitrate` types for all time-based and bitrate properties
- Support all 9 output group types, all 5 video codecs, and all 7 audio codecs
- Support MediaLive Anywhere deployments with Network, Cluster, and ChannelPlacementGroup

* [What is AWS Elemental MediaLive?](https://aws.amazon.com/medialive/)
* [MediaLive Documentation](https://docs.aws.amazon.com/medialive/latest/ug/what-is.html)
* [MediaLive L1 (CloudFormation) Constructs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_MediaLive.html)

---


#### AWS Elemental MediaLive Input

An input represents the upstream source of video content for a MediaLive channel. MediaLive supports many input types — pull-based (URL/HLS, RTMP, SRT caller, MP4/TS files), push-based (RTMP, RTP, UDP, SRT listener, CDI), and managed or Anywhere sources (MediaConnect, MediaConnect Router, SDI, Elemental Link, Multicast, SMPTE 2110 receiver group).

The L2 uses a typed `InputConfiguration` factory class to create the correct input type with validated properties, replacing the L1's untyped string-based `type` field and loosely-typed source/destination arrays.

For further information refer to [our documentation](https://docs.aws.amazon.com/medialive/latest/ug/inputs.html).

Minimal usage:

```ts
// MediaConnect Router input (most common for live workflows)
const input = new medialive.Input(stack, 'Input', {
  input: medialive.InputConfiguration.mediaConnectRouter({
    availabilityZones: ['us-east-1a', 'us-east-1b'],
  }),
});
```

Other input types:

```ts
// URL pull input (HLS/TS)
const urlInput = new medialive.Input(stack, 'UrlInput', {
  input: medialive.InputConfiguration.urlPull([
    medialive.InputSource.url('https://example.com/stream1.m3u8'),
    medialive.InputSource.url('https://example.com/stream2.m3u8'),
  ]),
});

// RTMP push input
const rtmpInput = new medialive.Input(stack, 'RtmpInput', {
  input: medialive.InputConfiguration.rtmpPush({
    inputSecurityGroups: [securityGroup],
    destinations: [{ streamName: 'live/stream1' }],
  }),
});

// SRT caller input
const srtInput = new medialive.Input(stack, 'SrtInput', {
  input: medialive.InputConfiguration.srtCaller([{
    srtListenerAddress: '203.0.113.1',
    srtListenerPort: 5000,
    minimumLatency: Duration.millis(1000),
  }]),
});

// MediaConnect flow input
const mcInput = new medialive.Input(stack, 'McInput', {
  input: medialive.InputConfiguration.mediaConnect({
    flows: [mediaconnect.Flow.fromFlowArn(stack, 'Flow', 'arn:aws:mediaconnect:us-east-1:123456789012:flow:1-aaa:MyFlow')],
    role: mediaLiveRole,
  }),
});

// SDI input
const sdiInput = new medialive.Input(stack, 'SdiInput', {
  input: medialive.InputConfiguration.sdi([sdiSource]),
});

// SRT listener input
const srtListenerInput = new medialive.Input(stack, 'SrtListenerInput', {
  input: medialive.InputConfiguration.srtListener({
    inputSecurityGroups: [securityGroup],
    minimumLatency: Duration.millis(2000),
  }),
});

// MP4 file input
const mp4Input = new medialive.Input(stack, 'Mp4Input', {
  input: medialive.InputConfiguration.mp4File([
    medialive.InputSource.url('s3://my-bucket/video.mp4'),
  ]),
});
```

Property interface for Input:

```ts
interface InputProps {
  /** Input name. @default - auto-generated */
  readonly inputName?: string;
  /** Input configuration that defines the input type and source settings. */
  readonly input: InputConfiguration;
}
```

The `InputConfiguration` class provides typed static factories:

```ts
class InputConfiguration {
  static urlPull(sources: InputSource[]): InputConfiguration;
  static rtmpPull(sources: InputSource[]): InputConfiguration;
  static rtmpPush(props: PushInputProps): InputConfiguration;
  static rtpPush(props: PushInputProps): InputConfiguration;
  static udpPush(props: PushInputProps): InputConfiguration;
  static mp4File(sources: InputSource[]): InputConfiguration;
  static tsFile(sources: InputSource[]): InputConfiguration;
  static mediaConnect(props: MediaConnectInputProps): InputConfiguration;
  static mediaConnectRouter(props?: MediaConnectRouterInputProps): InputConfiguration;
  static sdi(sources: ISdiSource[]): InputConfiguration;
  static srtCaller(sources: SrtCallerSourceProps[]): InputConfiguration;
  static srtListener(props: SrtListenerInputProps): InputConfiguration;
  static cdi(props: CdiInputProps): InputConfiguration;
  static inputDevice(props: InputDeviceInputProps): InputConfiguration;
  static multicast(props: MulticastInputProps): InputConfiguration;
  static smpte2110ReceiverGroup(props: Smpte2110InputProps): InputConfiguration;
}
```

Interface for Input:

```ts
interface IInput extends IResource {
  /** The ARN of the input. @attribute */
  readonly inputArn: string;
  /** The ID of the input. @attribute */
  readonly inputId: string;
  /** The input class (e.g. 'STANDARD', 'SINGLE_PIPELINE'). @attribute */
  readonly inputClass?: string;
}
```

Import capability:

```ts
const imported = medialive.Input.fromInputAttributes(stack, 'Imported', {
  inputArn: 'arn:aws:medialive:us-east-1:123456789012:input:1234567',
  inputId: '1234567',
});
```

---

#### AWS Elemental MediaLive Input Security Group

An input security group controls which IPv4 CIDR blocks can push content to a push-type input (RTMP push, RTP push, UDP push, SRT listener).

For further information refer to [our documentation](https://docs.aws.amazon.com/medialive/latest/ug/working-with-input-security-groups.html).

```ts
const securityGroup = new medialive.InputSecurityGroup(stack, 'SecurityGroup', {
  whitelistRules: ['10.0.0.0/8', '172.16.0.0/12'],
});
```

Property interface:

```ts
interface InputSecurityGroupProps {
  /** The list of IPv4 CIDR addresses to whitelist. */
  readonly whitelistRules: string[];
  /** Tags. @default - no tags */
  readonly tags?: { [key: string]: string };
}
```

Interface:

```ts
interface IInputSecurityGroup extends IResource {
  /** The ARN of the input security group. @attribute */
  readonly inputSecurityGroupArn: string;
  /** The ID of the input security group. @attribute */
  readonly inputSecurityGroupId: string;
}
```

Import capability:

```ts
const imported = medialive.InputSecurityGroup.fromInputSecurityGroupAttributes(stack, 'Imported', {
  inputSecurityGroupArn: 'arn:aws:medialive:us-east-1:123456789012:inputSecurityGroup:1234567',
  inputSecurityGroupId: '1234567',
});
```

---


#### AWS Elemental MediaLive Channel

The Channel is the central construct in MediaLive. It takes one or more inputs, encodes the content using configurable video and audio codecs, and delivers the output to one or more output groups (MediaPackage V2, HLS, RTMP, UDP, Archive, SRT, CMAF Ingest, Frame Capture, MS Smooth).

This is the most complex single-resource L2 construct in the L2. The underlying `AWS::MediaLive::Channel` CloudFormation resource has hundreds of nested properties. The L2 tames this complexity through several key design decisions:

1. **Encode configurations are defined once and shared across output groups.** A `video_1920x1080` encode referenced by both a MediaPackage V2 and an HLS output group is only defined once in the CloudFormation template. The channel deduplicates by name at synth time.

2. **Output groups use typed factory methods.** Instead of a generic `outputGroupSettings` property bag, you call `OutputGroupConfiguration.mediaPackageV2()`, `.hls()`, `.udp()`, etc. Each factory accepts only the props valid for that output group type.

3. **Codec validation happens at synth time.** If you try to use an H.265 video codec with an RTMP output group (which only supports H.264), the construct throws a clear error before deployment.

4. **Destination counts are validated per channel class.** A STANDARD channel requires 2 destinations per output group (one per pipeline). A SINGLE_PIPELINE channel requires 1. MediaPackage V2 and CMAF Ingest support additional destinations via the `additionalDestinations` prop.

For further information refer to [our documentation](https://docs.aws.amazon.com/medialive/latest/ug/creating-a-channel-step1.html).

Minimal usage:

```ts
const input = new medialive.Input(stack, 'Input', {
  input: medialive.InputConfiguration.mediaConnectRouter(),
});

const bucket = new s3.Bucket(stack, 'Bucket');

const video = medialive.EncodeConfiguration.video({
  name: 'video_1080p',
  width: 1920,
  height: 1080,
  codecSettings: medialive.VideoCodecSettings.h264({
    rateControl: medialive.H264RateControl.cbr({ bitrate: Bitrate.mbps(5) }),
    framerate: medialive.Framerate.FPS_29_97,
  }),
});

const audio = medialive.EncodeConfiguration.audio({ name: 'audio_aac' });

const channel = new medialive.Channel(stack, 'Channel', {
  inputs: [{ input }],
  outputGroups: [
    medialive.OutputGroupConfiguration.hls({
      name: 'hls',
      destinations: [medialive.OutputDestination.toBucket(bucket, 'live/index')],
      outputs: [
        { outputName: 'hls-output', encodes: [video, audio] },
      ],
    }),
  ],
});
```

Full-featured example with multiple output groups:

```ts
const channel = new medialive.Channel(stack, 'Channel', {
  channelName: 'production-channel',
  channelClass: medialive.ChannelClass.STANDARD,
  role: mediaLiveRole,
  logLevel: medialive.LogLevel.INFO,
  inputs: [{ input, inputAttachmentName: 'primary' }],
  inputSpecification: medialive.InputSpecification.standard({
    codec: medialive.InputCodec.AVC,
    maximumBitrate: medialive.InputMaximumBitrate.MAX_20_MBPS,
    resolution: medialive.InputResolution.HD,
  }),
  timecodeConfig: {
    source: medialive.TimecodeSource.EMBEDDED,
  },
  maintenance: {
    maintenanceDay: medialive.MaintenanceDay.SUNDAY,
    maintenanceStartTime: '03:00',
  },
  outputGroups: [
    medialive.OutputGroupConfiguration.mediaPackageV2({
      name: 'mp2',
      destinations: [
        medialive.MediaPackageV2Destination.channel(mpChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_1),
        medialive.MediaPackageV2Destination.channel(mpChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_2),
      ],
      outputs: [
        { outputName: 'mp2-1080', encode: video1080 },
        { outputName: 'mp2-720', encode: video720 },
        { outputName: 'mp2-audio', encode: audioStereo },
      ],
    }),
    medialive.OutputGroupConfiguration.archive({
      name: 'archive',
      destinations: [
        medialive.OutputDestination.toBucket(archiveBucket, 'pipeline-0/archive'),
        medialive.OutputDestination.toBucket(archiveBucket, 'pipeline-1/archive'),
      ],
      rolloverInterval: Duration.minutes(5),
      outputs: [
        { outputName: 'archive-output', encodes: [video1080, audioStereo] },
      ],
    }),
  ],
});
```

Incremental composition — add output groups and inputs after construction. Outputs are always declared up front on the group config:

```ts
const channel = new medialive.Channel(stack, 'Channel', {
  inputs: [{ input }],
  outputGroups: [
    medialive.OutputGroupConfiguration.hls({
      name: 'hls',
      destinations: [medialive.OutputDestination.url('s3ssl://bucket/live/index')],
      outputs: [
        { outputName: 'hls-output', encodes: [video1080, audioStereo] },
      ],
    }),
  ],
});

// Add another output group after construction
channel.addOutputGroup(
  medialive.OutputGroupConfiguration.archive({
    name: 'archive',
    destinations: [medialive.OutputDestination.toBucket(archiveBucket, 'archive/recording')],
    outputs: [
      { outputName: 'archive-output', encodes: [video1080, audioStereo] },
    ],
  }),
);

// Add another input
channel.addInput({ input: backupInput, inputAttachmentName: 'backup' });
```

Property interface for Channel (key props):

```ts
interface ChannelProps {
  /** @default - auto-generated */
  readonly channelName?: string;
  /** @default ChannelClass.SINGLE_PIPELINE */
  readonly channelClass?: ChannelClass;
  /** @default - auto-created with medialive.amazonaws.com trust */
  readonly role?: IRole;
  /** At least one required. */
  readonly inputs: InputAttachment[];
  /** At least one required. */
  readonly outputGroups: OutputGroupConfiguration[];
  /** @default LogLevel.DISABLED */
  readonly logLevel?: LogLevel;
  /** @default - AVC, 20 Mbps, HD */
  readonly inputSpecification?: InputSpecification;
  /** @default - default global configuration */
  readonly globalConfiguration?: GlobalConfiguration;
  /** @default - EMBEDDED source */
  readonly timecodeConfig?: TimecodeConfig;
  /** @default - no VPC */
  readonly vpc?: VpcOutputSettings;
  /** @default - no tags */
  readonly tags?: { [key: string]: string };
  /** @default - default maintenance window */
  readonly maintenance?: MaintenanceSettings;
  /** @default - avail blanking disabled */
  readonly availBlanking?: AvailBlanking;
  /** @default - no avail configuration */
  readonly availSettings?: AvailSettings;
  /** @default - all features disabled */
  readonly featureActivations?: FeatureActivations;
  /** @default - thumbnails disabled */
  readonly thumbnailConfiguration?: ThumbnailConfiguration;
  /** @default - blackout slate disabled */
  readonly blackoutSlate?: BlackoutSlate;
  /** @default - not an Anywhere channel */
  readonly anywhereSettings?: AnywhereSettings;
  /** @default - service default */
  readonly channelEngineVersion?: string;
}
```

Interface for Channel:

```ts
interface IChannel extends IResource {
  /** The ARN of the channel. @attribute */
  readonly channelArn: string;
  /** The ID of the channel. @attribute */
  readonly channelId: string;
}
```

Import capability:

```ts
const imported = medialive.Channel.fromChannelAttributes(stack, 'Imported', {
  channelArn: 'arn:aws:medialive:us-east-1:123456789012:channel:1234567',
  channelId: '1234567',
});
```

---

#### EncodeConfiguration

Encode configurations define the video, audio, or caption encoding settings for a channel output. They are created via static factory methods and passed to outputs. The channel automatically collects all encodes from all output groups and deduplicates them by name at synth time.

This means a single `video_1920x1080` encode can be referenced by a MediaPackage V2 output, an HLS output, and an Archive output — and it only appears once in the CloudFormation template's `videoDescriptions` array.

```ts
class EncodeConfiguration {
  static video(props: VideoEncodeProps): EncodeConfiguration;
  static audio(props: AudioEncodeProps): EncodeConfiguration;
  static caption(props: CaptionEncodeProps): EncodeConfiguration;
}
```

Video encode:

```ts
const video = medialive.EncodeConfiguration.video({
  name: 'video_1080p',
  width: 1920,
  height: 1080,
  codecSettings: medialive.VideoCodecSettings.h264({
    profile: medialive.H264Profile.HIGH,
    rateControl: medialive.H264RateControl.cbr({ bitrate: Bitrate.mbps(5) }),
    framerate: medialive.Framerate.FPS_29_97,
    gopSize: medialive.GopSize.seconds(2),
  }),
});
```

Audio encode:

```ts
const audio = medialive.EncodeConfiguration.audio({
  name: 'audio_stereo',
  codecSettings: medialive.AudioCodecSettings.aac({
    bitrate: Bitrate.kbps(192),
    codingMode: medialive.AacCodingMode.CODING_MODE_2_0,
  }),
  languageCode: 'eng',
  streamName: 'English',
});
```

Caption encode:

```ts
const caption = medialive.EncodeConfiguration.caption({
  name: 'caption_eng',
  captionSelectorName: 'embedded',
  languageCode: 'eng',
  languageDescription: 'English',
});
```

---

#### OutputGroupConfiguration

Output group configurations define where and how the channel delivers its encoded output. The L2 provides 10 typed factory methods — one for each output group type supported by MediaLive.

Each factory accepts only the props valid for that output group type, with typed destination factory classes and per-type output definitions.

```ts
class OutputGroupConfiguration {
  static mediaPackageV2(props: MediaPackageV2OutputGroupProps): OutputGroupConfiguration;
  static hls(props: HlsOutputGroupProps): OutputGroupConfiguration;
  static udp(props: UdpOutputGroupProps): OutputGroupConfiguration;
  static archive(props: ArchiveOutputGroupProps): OutputGroupConfiguration;
  static rtmp(props: RtmpOutputGroupProps): OutputGroupConfiguration;
  static srt(props: SrtOutputGroupProps): OutputGroupConfiguration;
  static cmafIngest(props: CmafIngestOutputGroupProps): OutputGroupConfiguration;
  static frameCapture(props: FrameCaptureOutputGroupProps): OutputGroupConfiguration;
  static msSmooth(props: MsSmoothOutputGroupProps): OutputGroupConfiguration;
}
```

**MediaPackage V2 output group:**

```ts
medialive.OutputGroupConfiguration.mediaPackageV2({
  name: 'mp2',
  destinations: [
    medialive.MediaPackageV2Destination.channel(mpChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_1),
    medialive.MediaPackageV2Destination.channel(mpChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_2),
  ],
  outputs: [
    { outputName: 'video-1080', encode: video1080 },
    { outputName: 'audio', encode: audioStereo },
  ],
});
```

MediaPackage V2 destinations use the `MediaPackageV2Destination.channel()` factory with an explicit `IChannel` reference (from `@aws-cdk/aws-mediapackagev2-alpha`) and a pipeline endpoint ID. Each output must contain a single encode (one track per CMAF output). For additional destinations (cross-region or backup), use the same `channel()` factory and pass the region as the third argument (needed when the channel was imported without a region):

```ts
additionalDestinations: [
  medialive.MediaPackageV2Destination.channel(backupChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_1, 'us-west-2'),
],
```

**HLS output group:**

```ts
medialive.OutputGroupConfiguration.hls({
  name: 'hls',
  destinations: [
    medialive.OutputDestination.url('s3ssl://bucket/pipeline-0/index'),
    medialive.OutputDestination.url('s3ssl://bucket/pipeline-1/index'),
  ],
  segment: medialive.Segment.seconds(6),
  keepSegments: 21,
  indexNSegments: 7,
  mode: medialive.HlsMode.LIVE,
  outputs: [
    { outputName: 'hls-1080', nameModifier: '_1080p', encodes: [video1080, audioStereo] },
    { outputName: 'hls-720', nameModifier: '_720p', encodes: [video720, audioStereo] },
  ],
});
```

**UDP output group:**

```ts
medialive.OutputGroupConfiguration.udp({
  name: 'udp',
  destinations: [medialive.UdpOutputDestination.udp({ address: '239.0.0.1', port: 5000 })],
  buffer: Duration.millis(0),
  outputs: [
    { outputName: 'udp-output', encodes: [video1080, audioStereo] },
  ],
});
```

**Archive (S3) output group:**

```ts
medialive.OutputGroupConfiguration.archive({
  name: 'archive',
  destinations: [medialive.S3OutputDestination.toBucket(bucket, 'live/recording')],
  rolloverInterval: Duration.minutes(5),
  outputs: [
    { outputName: 'archive-output', encodes: [video1080, audioStereo] },
  ],
});
```

**RTMP output group:**

```ts
medialive.OutputGroupConfiguration.rtmp({
  name: 'rtmp',
  outputs: [{
    outputName: 'rtmp-output',
    encodes: [video1080, audioStereo],
    destinations: [medialive.RtmpDestination.url('rtmp://203.0.113.1/app', 'stream_key')],
  }],
});
```

Each RTMP output takes one destination per channel pipeline (the console's "Destination A" / "Destination B") — one for `SINGLE_PIPELINE`, two for `STANDARD`. RTMP destinations use the `RtmpDestination.url()` factory with a separate `streamName` parameter. RTMP only supports H.264 video and AAC audio.

**SRT output group:**

```ts
medialive.OutputGroupConfiguration.srt({
  name: 'srt',
  outputs: [{
    outputName: 'srt-output',
    encodes: [video1080, audioStereo],
    destinations: [medialive.SrtDestination.caller({ address: '203.0.113.100', port: 5000 })],
    latency: Duration.millis(1000),
  }],
});
```

Each SRT output takes one destination per channel pipeline (the console's "Destination A" / "Destination B") — one for `SINGLE_PIPELINE`, two for `STANDARD`. Use `SrtDestination.caller({ address, port })`, `SrtDestination.callerUrl(url)` (e.g. a MediaConnect Router Input endpoint), or `SrtDestination.listener({ listenerPort })`.

**CMAF Ingest output group:**

```ts
medialive.OutputGroupConfiguration.cmafIngest({
  name: 'cmaf',
  destinations: [
    medialive.OutputDestination.url('https://ingest.example.com/v1/channel/pipeline-0'),
    medialive.OutputDestination.url('https://ingest.example.com/v1/channel/pipeline-1'),
  ],
  segment: medialive.Segment.seconds(6),
  outputs: [
    { outputName: 'cmaf-video', encode: video1080 },
    { outputName: 'cmaf-audio', encode: audioStereo },
  ],
});
```

Like MediaPackage V2, CMAF Ingest requires one track per output. Additional destinations beyond the pipeline count can be specified via the `additionalDestinations` prop.

**Frame Capture output group:**

```ts
medialive.OutputGroupConfiguration.frameCapture({
  name: 'thumbnails',
  destinations: [medialive.S3OutputDestination.toBucket(bucket, 'captures/thumb')],
  outputs: [
    {
      outputName: 'capture',
      encodes: [medialive.EncodeConfiguration.video({
        name: 'capture',
        width: 1280,
        height: 720,
        codecSettings: medialive.VideoCodecSettings.frameCapture({
          captureInterval: Duration.seconds(5),
        }),
      })],
    },
  ],
});
```

A channel that includes a Frame Capture output group must also include a separate video output group (e.g. HLS, Archive). Frame Capture cannot be the channel's only output group.

**MS Smooth output group:**

```ts
medialive.OutputGroupConfiguration.msSmooth({
  name: 'smooth',
  destinations: [medialive.OutputDestination.url('https://smooth.example.com/live.isml')],
  outputs: [
    { outputName: 'smooth-output', encodes: [video1080, audioStereo] },
  ],
});
```

---

#### Typed Destinations

Each output group type has its own destination interface, enforcing the correct shape at compile time:

| Output Group Type | Destination Interface | Key Fields |
|---|---|---|
| MediaPackage V2 | `MediaPackageV2Destination` | Abstract class with `channel()` factory method |
| HLS, Archive, UDP, CMAF, Frame Capture, MS Smooth | `OutputDestination` | Abstract class with `url()` and `toBucket()` factory methods |
| RTMP | `RtmpDestination` | Abstract class with `url()` factory method |
| SRT | `SrtDestination` | Abstract class with `caller()` and `listener()` factory methods |

**Destination validation** is performed at synth time based on channel class:

- `STANDARD` channels require 2 destinations per output group (one per pipeline).
- `SINGLE_PIPELINE` channels require 1 destination.
- MediaPackage V2 and CMAF Ingest support additional destinations via the `additionalDestinations` prop (up to 2 for STANDARD, 1 for SINGLE_PIPELINE).

---


#### VideoCodecSettings

Video codec settings define the encoding parameters for a video output. The L2 provides typed factory methods for all 5 video codecs supported by MediaLive, with full CFN property coverage.

```ts
class VideoCodecSettings {
  static h264(props?: H264SettingsProps): VideoCodecSettings;
  static h265(props: H265SettingsProps): VideoCodecSettings;
  static av1(props?: Av1SettingsProps): VideoCodecSettings;
  static frameCapture(props?: FrameCaptureSettingsProps): VideoCodecSettings;
  static mpeg2(props?: Mpeg2SettingsProps): VideoCodecSettings;
}
```

**H.264 (AVC)** Example:

```ts
medialive.VideoCodecSettings.h264({
  profile: medialive.H264Profile.HIGH,
  rateControl: medialive.H264RateControl.cbr({ bitrate: Bitrate.mbps(5) }),
  framerate: medialive.Framerate.FPS_29_97,
  gopSize: medialive.GopSize.seconds(2),
  gopNumBFrames: 3,
  adaptiveQuantization: medialive.H264AdaptiveQuantization.HIGH,
});
```

**H.265 (HEVC)** Example:

```ts
medialive.VideoCodecSettings.h265({
  profile: medialive.H265Profile.MAIN,
  tier: medialive.H265Tier.MAIN,
  rateControl: medialive.H265RateControl.qvbr({
    maxBitrate: Bitrate.mbps(8),
    qvbrQualityLevel: 8,
  }),
  framerate: medialive.Framerate.FPS_29_97,
});
```

**AV1** Example:

```ts
medialive.VideoCodecSettings.av1({
  rateControl: medialive.Av1RateControl.qvbr({
    maxBitrate: Bitrate.mbps(4),
    qvbrQualityLevel: 7,
  }),
  framerate: medialive.Framerate.FPS_30,
});
```

**Frame Capture** Example:

```ts
medialive.VideoCodecSettings.frameCapture({
  captureInterval: Duration.seconds(10),
});
```

**MPEG-2** Example:

```ts
medialive.VideoCodecSettings.mpeg2({
  framerate: medialive.Framerate.FPS_29_97,
  gopSize: medialive.GopSize.seconds(2),
});
```


**Codec validation per output group type:**

| Output Group | Allowed Video Codecs | Allowed Audio Codecs |
|---|---|---|
| MediaPackage V2 | H.264, H.265, Frame Capture | AAC, AC3, EAC3, EAC3 Atmos |
| HLS | H.264, H.265, Frame Capture | AAC, AC3, EAC3, EAC3 Atmos |
| UDP | H.264, H.265, Frame Capture | AAC, AC3, EAC3, EAC3 Atmos, MP2 |
| Archive | H.264, H.265, Frame Capture | AAC, AC3, EAC3, EAC3 Atmos, MP2 |
| RTMP | H.264, Frame Capture | AAC |
| SRT | H.264, H.265, Frame Capture | AAC, AC3, EAC3, EAC3 Atmos, MP2 |
| CMAF Ingest | H.264, H.265, AV1, Frame Capture | AAC, AC3, EAC3, EAC3 Atmos |
| Frame Capture | Frame Capture only | (none — video only) |
| MS Smooth | H.264, H.265, Frame Capture | AAC, AC3, EAC3 |

These validations are enforced at synth time. If you use an unsupported codec, the construct throws a clear error message. For the authoritative mapping, see [supported codecs by output type](https://docs.aws.amazon.com/medialive/latest/ug/outputs-supported-codecs.html).

---

#### AudioCodecSettings

Audio codec settings define the encoding parameters for an audio output. The L2 provides typed factory methods for all 7 audio codecs.

```ts
class AudioCodecSettings {
  static aac(props?: AacSettingsProps): AudioCodecSettings;
  static ac3(props?: Ac3SettingsProps): AudioCodecSettings;
  static eac3(props?: Eac3SettingsProps): AudioCodecSettings;
  static eac3Atmos(props?: Eac3AtmosSettingsProps): AudioCodecSettings;
  static mp2(props?: Mp2SettingsProps): AudioCodecSettings;
  static wav(props?: WavSettingsProps): AudioCodecSettings;
  static passthrough(): AudioCodecSettings;
}
```

Examples:

```ts
// AAC
medialive.AudioCodecSettings.aac();

// AAC with custom settings
medialive.AudioCodecSettings.aac({
  bitrate: Bitrate.kbps(128),
  profile: medialive.AacProfile.LC,
  codingMode: medialive.AacCodingMode.CODING_MODE_2_0,
});

// Dolby Digital 5.1
medialive.AudioCodecSettings.ac3({
  bitrate: Bitrate.kbps(384),
  codingMode: medialive.Ac3CodingMode.CODING_MODE_3_2_LFE,
});

// Dolby Digital Plus
medialive.AudioCodecSettings.eac3({
  bitrate: Bitrate.kbps(256),
  codingMode: medialive.Eac3CodingMode.CODING_MODE_3_2,
});

// Dolby Atmos
medialive.AudioCodecSettings.eac3Atmos({
  codingMode: medialive.Eac3AtmosCodingMode.CODING_MODE_5_1_4,
});

// Passthrough (no transcoding)
medialive.AudioCodecSettings.passthrough();
```

---


#### Framerate

The `Framerate` helper class provides static constants for common broadcast frame rates, plus an `of()` method for non-standard rates (e.g. `Framerate.of(24000, 1001)` for 23.976 fps). Frame rates are expressed as numerator/denominator pairs to avoid floating-point precision issues.

```ts
class Framerate {
  static readonly FPS_24: Framerate;     // 24/1
  static readonly FPS_25: Framerate;     // 25/1
  static readonly FPS_29_97: Framerate;  // 30000/1001
  static readonly FPS_30: Framerate;     // 30/1
  static readonly FPS_50: Framerate;     // 50/1
  static readonly FPS_59_94: Framerate;  // 60000/1001
  static readonly FPS_60: Framerate;     // 60/1
  static of(numerator: number, denominator: number): Framerate;  // custom rates, e.g. of(24000, 1001) for 23.976
}
```

---

#### Rate Control

Rate control is configured per codec using typed classes with factory methods. Each codec supports a different set of rate control modes.

**H.264 rate control:**

```ts
class H264RateControl {
  static cbr(props: CbrRateControlProps): H264RateControl;
  static vbr(props: VbrRateControlProps): H264RateControl;
  static qvbr(props: QvbrRateControlProps): H264RateControl;
}
```

**H.265 rate control:**

```ts
class H265RateControl {
  static cbr(props: CbrRateControlProps): H265RateControl;
  static vbr(props: VbrRateControlProps): H265RateControl;
  static qvbr(props: QvbrRateControlProps): H265RateControl;
}
```

**AV1 rate control:**

```ts
class Av1RateControl {
  static qvbr(props: QvbrRateControlProps): Av1RateControl;
  static cbr(props: CbrRateControlProps): Av1RateControl;
}
```

Rate control props use CDK `Bitrate` type:

```ts
interface CbrRateControlProps {
  readonly bitrate: Bitrate;
}

interface VbrRateControlProps {
  readonly bitrate: Bitrate;
  readonly maxBitrate: Bitrate;
}

interface QvbrRateControlProps {
  readonly maxBitrate: Bitrate;
  readonly qvbrQualityLevel?: number;
}
```

---

#### Timecode Burn-in

All video codecs support timecode burn-in — overlaying a timecode on the video output. This is useful for monitoring and debugging.

```ts
medialive.VideoCodecSettings.h264({
  framerate: medialive.Framerate.FPS_29_97,
  rateControl: medialive.H264RateControl.cbr({ bitrate: Bitrate.mbps(5) }),
  timecodeBurnin: {
    fontSize: medialive.TimecodeBurninFontSize.MEDIUM_32,
    position: medialive.TimecodeBurninPosition.BOTTOM_CENTER,
    prefix: 'CH1',
  },
});
```

---


#### Input Attachments

Input attachments define how an input is connected to a channel, including filtering, audio/caption selectors, and network settings.

```ts
const channel = new medialive.Channel(stack, 'Channel', {
  inputs: [{
    input,
    inputAttachmentName: 'primary',
    sourceEndBehavior: medialive.SourceEndBehavior.LOOP,
    inputFilter: medialive.InputFilter.AUTO,
    audioSelectors: [
      medialive.AudioSelector.byLanguage('english', 'eng'),
      medialive.AudioSelector.byPid('commentary', 257),
    ],
    captionSelectors: [
      medialive.CaptionSelector.embedded('embedded-captions'),
    ],
    videoSelector: {
      colorSpace: medialive.VideoColorSpace.REC_709,
    },
    networkInputSettings: {
      serverValidation: medialive.ServerValidation.CHECK_CRYPTOGRAPHY_AND_VALIDATE_NAME,
      hlsInputSettings: {
        bandwidth: Bitrate.mbps(10),
        bufferSegments: 3,
        retries: 5,
        retryInterval: Duration.seconds(3),
      },
    },
  }],
  outputGroups: [/* ... */],
});
```

---

#### Avail Settings

SCTE-35 ad avail handling is configured via the `AvailSettings` abstract class with typed factory methods:

```ts
// Splice insert mode
const channel = new medialive.Channel(stack, 'Channel', {
  inputs: [{ input }],
  outputGroups: [/* ... */],
  availSettings: medialive.AvailSettings.spliceInsert({
    adAvailOffset: 0,
    noRegionalBlackoutFlag: medialive.Scte35FlagBehavior.FOLLOW,
    webDeliveryAllowedFlag: medialive.Scte35FlagBehavior.FOLLOW,
  }),
});

// Time signal APOS mode
const channel2 = new medialive.Channel(stack, 'Channel2', {
  inputs: [{ input }],
  outputGroups: [/* ... */],
  availSettings: medialive.AvailSettings.timeSignalApos(),
});
```

---

#### Linked Channel Settings

For primary/follower channel configurations:

```ts
// Primary channel
const primary = new medialive.Channel(stack, 'Primary', {
  channelClass: medialive.ChannelClass.SINGLE_PIPELINE,
  inputs: [{ input }],
  outputGroups: [/* ... */],
  linkedChannelSettings: medialive.LinkedChannelSettings.primary(),
});

// Follower channel
const follower = new medialive.Channel(stack, 'Follower', {
  channelClass: medialive.ChannelClass.SINGLE_PIPELINE,
  inputs: [{ input }],
  outputGroups: [/* ... */],
  linkedChannelSettings: medialive.LinkedChannelSettings.follower(primary),
});
```

---


#### AWS Elemental MediaLive Multiplex

> **Not implemented in the initial release.** `Multiplex`, `MultiplexProgram`, and the
> `multiplex()` output group are deferred and will follow in a later release.

A multiplex is a multi-program transport stream (MPTS) that carries several programs sharing a fixed total bitrate. Each program is fed by one MediaLive channel through a multiplex output group, and each program's bandwidth can be allocated either statically (constant bitrate) or dynamically across programs (statistical multiplexing).

A multiplex spans two availability zones and defines the total transport stream bandwidth:

```ts
const multiplex = new medialive.Multiplex(stack, 'Multiplex', {
  availabilityZones: ['us-east-1a', 'us-east-1b'],
  transportStreamBitrate: Bitrate.mbps(20),
  transportStreamId: 1,
});
```

A `MultiplexProgram` defines one program slot in the multiplex. Use `MultiplexVideoSettings.statmux()` to let the multiplex vary the program's bitrate (statistical multiplexing), or `constantBitrate()` for a fixed rate:

```ts
const program = new medialive.MultiplexProgram(stack, 'Program', {
  multiplex,
  programName: 'program-1',
  programNumber: 1,
  preferredChannelPipeline: medialive.PreferredChannelPipeline.CURRENTLY_AVAILABLE,
  videoSettings: medialive.MultiplexVideoSettings.statmux({
    minimumBitrate: Bitrate.mbps(1),
    maximumBitrate: Bitrate.mbps(10),
    priority: 2,
  }),
});
```

A channel feeds the program via a multiplex output group (see the OutputGroupConfiguration section). The output group references the program, which supplies the multiplex id and program name to the channel's destination.

Property interfaces:

```ts
interface MultiplexProps {
  /** @default - a name is generated */
  readonly multiplexName?: string;
  /** A multiplex spans two AZs. */
  readonly availabilityZones: string[];
  /** Total transport stream bandwidth. 1 Mbps to 100 Mbps. */
  readonly transportStreamBitrate: Bitrate;
  /** An integer; must be unique among your multiplexes. */
  readonly transportStreamId: number;
  /** @default - no additional bandwidth reserved */
  readonly transportStreamReservedBitrate?: Bitrate;
  /** 1000 to 3000 ms. @default - 2000 milliseconds */
  readonly maximumVideoBufferDelay?: Duration;
  /** @default - no tags */
  readonly tags?: { [key: string]: string };
}

interface MultiplexProgramProps {
  readonly multiplex: IMultiplex;
  readonly programName: string;
  readonly programNumber: number;
  /** @default - service default */
  readonly preferredChannelPipeline?: PreferredChannelPipeline;
  /** @default - no service descriptor */
  readonly serviceDescriptor?: MultiplexProgramServiceDescriptor;
  /** @default - statmux with service defaults */
  readonly videoSettings?: MultiplexVideoSettings;
}
```

Interfaces:

```ts
interface IMultiplex extends IResource {
  /** The ARN of the multiplex. @attribute */
  readonly multiplexArn: string;
  /** The ID of the multiplex. @attribute */
  readonly multiplexId: string;
}

interface IMultiplexProgram extends IResource {
  readonly programName: string;
  readonly multiplexId: string;
}
```

Import capability:

```ts
const imported = medialive.Multiplex.fromMultiplexArn(
  stack, 'Imported', 'arn:aws:medialive:us-east-1:123456789012:multiplex:1234567',
);
```

---


#### AWS Elemental MediaLive Anywhere Network

A network represents a collection of IP address pools and routes used by MediaLive Anywhere resources. Networks are the foundation for on-premises MediaLive deployments.

For further information refer to [our documentation](https://docs.aws.amazon.com/medialive/latest/ug/eml-anywhere.html).

```ts
const network = new medialive.Network(stack, 'Network', {
  networkName: 'on-prem-network',
  ipPools: ['10.0.0.0/24', '10.0.1.0/24'],
  routes: [
    { cidr: '0.0.0.0/0', gateway: '10.0.0.1' },
  ],
});
```

Property interface:

```ts
interface NetworkProps {
  /** The name of the network. */
  readonly networkName: string;
  /** The list of IP address CIDR pools. */
  readonly ipPools: string[];
  /** @default - no routes */
  readonly routes?: NetworkRoute[];
  /** @default - no tags */
  readonly tags?: { [key: string]: string };
}
```

Interface:

```ts
interface INetwork extends IResource {
  /** The ARN of the network. @attribute */
  readonly networkArn: string;
  /** The ID of the network. @attribute */
  readonly networkId: string;
}
```

Import capability:

```ts
const imported = medialive.Network.fromNetworkAttributes(stack, 'Imported', {
  networkArn: 'arn:aws:medialive:us-east-1:123456789012:network:1234567',
  networkId: '1234567',
});
```

---

#### AWS Elemental MediaLive Anywhere Cluster

A cluster represents a group of on-premises hardware nodes used by MediaLive Anywhere. Clusters require an IAM instance role and optional network settings.

```ts
const cluster = new medialive.Cluster(stack, 'Cluster', {
  clusterName: 'on-prem-cluster',
  clusterType: medialive.ClusterType.ON_PREMISES,
  instanceRole: instanceRole,
  networkSettings: {
    defaultRoute: '10.0.0.1',
    interfaceMappings: [
      { logicalInterfaceName: 'data', networkId: network.networkId },
    ],
  },
});
```

Property interface:

```ts
interface ClusterProps {
  /** @default - auto-generated */
  readonly clusterName?: string;
  /** @default - no cluster type */
  readonly clusterType?: ClusterType;
  /** The IAM role for nodes in the cluster. */
  readonly instanceRole: IRole;
  /** @default - no network settings */
  readonly networkSettings?: ClusterNetworkSettings;
  /** @default - no tags */
  readonly tags?: { [key: string]: string };
}
```

Interface:

```ts
interface ICluster extends IResource {
  /** The ARN of the cluster. @attribute */
  readonly clusterArn: string;
  /** The ID of the cluster. @attribute */
  readonly clusterId: string;
}
```

Import capability:

```ts
const imported = medialive.Cluster.fromClusterAttributes(stack, 'Imported', {
  clusterArn: 'arn:aws:medialive:us-east-1:123456789012:cluster:1234567',
  clusterId: '1234567',
});
```

---


#### AWS Elemental MediaLive Anywhere ChannelPlacementGroup

A channel placement group assigns channels to specific nodes within a cluster. This enables fine-grained control over which hardware runs which channels in an on-premises deployment.

```ts
const placementGroup = new medialive.ChannelPlacementGroup(stack, 'PlacementGroup', {
  channelPlacementGroupName: 'primary-group',
  cluster,
  nodes: ['node-001', 'node-002'],
});
```

Using Anywhere settings on a channel:

```ts
const channel = new medialive.Channel(stack, 'AnywhereChannel', {
  inputs: [{ input }],
  outputGroups: [/* ... */],
  anywhereSettings: {
    cluster,
    channelPlacementGroup: placementGroup,
  },
});
```

Property interface:

```ts
interface ChannelPlacementGroupProps {
  /** @default - auto-generated */
  readonly channelPlacementGroupName?: string;
  /** The cluster this group belongs to. */
  readonly cluster: ICluster;
  /** @default - no nodes */
  readonly nodes?: string[];
  /** @default - no tags */
  readonly tags?: { [key: string]: string };
}
```

Interface:

```ts
interface IChannelPlacementGroup extends IResource {
  /** The ARN of the channel placement group. @attribute */
  readonly channelPlacementGroupArn: string;
  /** The ID of the channel placement group. @attribute */
  readonly channelPlacementGroupId: string;
}
```

Import capability:

```ts
const imported = medialive.ChannelPlacementGroup.fromChannelPlacementGroupAttributes(
  stack, 'Imported', {
    channelPlacementGroupArn: 'arn:aws:medialive:us-east-1:123456789012:cluster:abc/channelPlacementGroup:xyz',
    channelPlacementGroupId: 'xyz',
    clusterId: 'abc',
  },
);
```

---

#### SDI Source

An SDI source represents an SDI input device for use with MediaLive Anywhere.

```ts
const sdiSource = new medialive.SdiSource(stack, 'SdiSource', {
  sdiSourceName: 'camera-1',
  type: medialive.SdiType.SINGLE,
});

// Quad SDI
const quadSdi = new medialive.SdiSource(stack, 'QuadSdi', {
  sdiSourceName: 'camera-quad',
  type: medialive.SdiType.QUAD,
  mode: medialive.SdiMode.QUADRANT,
});
```

---


### Key Design Decisions

#### 1. Encode deduplication at the channel level

Encode configurations (video, audio, caption) are defined as standalone objects and referenced by outputs. At synth time, the channel collects all encodes from all output groups and deduplicates them by name. This means a `video_1920x1080` encode shared across MediaPackage V2, HLS, and Archive output groups only appears once in the CloudFormation template.

This mirrors how the underlying CloudFormation resource works — `videoDescriptions`, `audioDescriptions`, and `captionDescriptions` are top-level arrays on the channel, and outputs reference them by name.

This is why the `name` prop on every encode is **required**, not optional. The name is the join key: it is what the output's `videoDescriptionName` / `audioDescriptionNames` reference, and it is the key the channel deduplicates on. An auto-generated name would defeat both — outputs could not refer to a stable handle, and two structurally-identical encodes the user intended to share would render as duplicate descriptions. Making the name explicit and required keeps the user in control of the identity that the whole channel graph hangs on.

#### 2. Abstract classes with static factory methods

The L2 uses abstract classes with static factory methods extensively:

- `InputConfiguration.urlPull()`, `.rtmpPush()`, `.mediaConnectRouter()`, `.cdi()`, `.inputDevice()`, etc.
- `InputSpecification.standard()`, `.cdi()`, `.elementalLink()`
- `OutputGroupConfiguration.mediaPackageV2()`, `.hls()`, `.udp()`, etc.
- `VideoCodecSettings.h264()`, `.h265()`, `.av1()`, etc.
- `AudioCodecSettings.aac()`, `.ac3()`, `.eac3Atmos()`, etc.
- `H264RateControl.cbr()`, `.vbr()`, `.qvbr()`
- `AvailSettings.spliceInsert()`, `.timeSignalApos()`
- `LinkedChannelSettings.primary()`, `.follower()`
- `OutputDestination.url()` / `.toBucket()`, `S3OutputDestination`, `UdpOutputDestination.udp()` / `.rtp()`
- `InputSource.fromBucket()`
- `RtmpDestination.url()`
- `MediaPackageV2Destination.channel()`

This pattern provides type safety (each factory returns the correct type), discoverability (IDE autocomplete shows all options), and validation (each factory validates its own props).

#### 3. Synth-time validation

The L2 validates at synth time:

- **Codec compatibility:** Each output group type validates that its outputs use only supported video and audio codecs.
- **Destination counts:** Based on channel class (STANDARD requires 2 destinations, SINGLE_PIPELINE requires 1), with additional destinations for MediaPackage V2 and CMAF Ingest via the `additionalDestinations` prop.
- **Resolution constraints:** Video width and height must be even numbers.
- **Output name format:** Must be alphanumeric with hyphens and underscores, 1-256 characters.
- **Single track per output:** MediaPackage V2 and CMAF Ingest require exactly one encode per output.
- **Frame Capture companion:** Frame Capture output groups require a companion video output group.
- **MediaPackage V2 framerate:** Video encodes in MediaPackage V2 output groups must have explicit framerate.
- **Input/channel class match:** Input pipeline class must match channel class (a SINGLE_PIPELINE input on a STANDARD channel throws).
- **SRT/RTMP destination count:** SRT and RTMP outputs take one destination per pipeline (the console's "Destination A"/"Destination B") — exactly 2 for a STANDARD channel, 1 for SINGLE_PIPELINE.

#### 4. Auto-created IAM role and automatic grants

The channel auto-creates an IAM role with `medialive.amazonaws.com` trust if none is provided. The role is exposed via `channel.role` for additional grants, and a user-supplied `role` is honoured as an escape hatch (the L2 then grants onto that role rather than creating its own).

Grants are wired automatically from two sources, all least-privilege and scoped to the most specific ARN the service allows:

**Resource-driven grants** — derived from the destinations and inputs the user actually wired, scoped to those exact resources via each resource's own grant helper (no hand-rolled `PolicyStatement`s):

| Wiring | Grant | Scope |
|--------|-------|-------|
| `OutputDestination.toBucket()` | `bucket.grantReadWrite()` | the specific bucket/prefix |
| `InputSource.fromBucket()` | `bucket.grantRead()` | the specific bucket |
| `InputSource.url()` with an SSM password | `param.grantRead()` | the specific parameter ARN |
| `MediaPackageV2Destination.channel()` | `mpChannel.grants.ingest()` | the specific MediaPackage V2 channel |
| `SrtDestination.caller()` / `listener()` with encryption | `secret.grantRead()` | the specific Secrets Manager secret |

**Feature-driven service-role grants** — derived from channel-level features, mirroring the AWS-documented MediaLive trusted-entity requirements (the AWS-managed `MediaLiveAccessRole`):

| Feature | Actions | Scope | Why |
|---------|---------|-------|-----|
| Thumbnails (on by default unless `ThumbnailState.DISABLED`) | `s3:PutObject` | `*` | thumbnails upload to an AWS service-owned bucket, not a customer bucket — no ARN to scope to. Write-only, no read/list/delete |
| Channel logging (when `logLevel !== DISABLED`) | `logs:CreateLogGroup`/`CreateLogStream`/`PutLogEvents`/`PutMetricFilter`/`PutRetentionPolicy`/`DescribeLogStreams`/`DescribeLogGroups` | `arn:<partition>:logs:*` | MediaLive creates its own log group at runtime and `logs:DescribeLogGroups` doesn't support resource-level permissions |
| VPC output (when `vpc` set) | `ec2:CreateNetworkInterface`/`CreateNetworkInterfacePermission`/`DeleteNetworkInterface` | the ENI plus the user's subnet and security-group ARNs | MediaLive manages ENIs in the user's subnets |
| VPC output — describe | `ec2:DescribeNetworkInterfaces`/`DescribeSubnets`/`DescribeSecurityGroups`/`DescribeAddresses` | `*` | EC2 `Describe*` actions don't support resource-level permissions |
| VPC output — public address (only when `publicAddressAllocationIds` set) | `ec2:AssociateAddress` | `*` | association target isn't known at synth time |

Where a `*` resource appears, it is forced by the service (service-owned bucket, runtime-created log group, or actions with no resource-level support) and is documented inline at the call site. ARNs are partition-aware (`Aws.PARTITION`).

**MediaConnect input role is separate.** A MediaConnect / MediaConnect Router input grants `mediaconnect:ManagedDescribeFlow` / `ManagedAddOutput` (and related managed actions) to the *input's* role, not the channel role — these are granted at input-attachment time to the role MediaLive uses to read the flow, which is a distinct trust relationship from the channel's output role.

This eliminates manual IAM wiring for all common destination and input types. No `bucket.grantReadWrite(channel.role)` or `mpChannel.grants.ingest(channel.role)` needed.

**Not yet granted** (because the capability isn't exposed by this L2 yet — the grant lands with the feature): AWS Elemental Inference (`elemental-inference:GetMetadata`, `elemental-inference:PutMedia`).

#### 5. Duration and Bitrate types

All time-based properties use CDK `Duration` instead of raw numbers:

```ts
// Instead of: buffer: 1000
buffer: Duration.millis(1000)

// Instead of: rolloverInterval: 300
rolloverInterval: Duration.minutes(5)

// Instead of: captureInterval: 10
captureInterval: Duration.seconds(10)
```

All bitrate properties use CDK `Bitrate`:

```ts
// Instead of: bitrate: 5000000
bitrate: Bitrate.mbps(5)
```

#### 6. Token guards

String validations check `Token.isUnresolved()` before validating, so lazy/token values (e.g. from `Fn.ref()` or cross-stack references) pass through without errors.

#### 7. Complex nested CFN types replaced with proper typed classes

Several deeply nested CFN types that were initially exposed as string pass-through have been replaced with proper typed classes:

- `colorSpaceSettings` → `H264ColorSpaceSettings`, `H265ColorSpaceSettings`, `Av1ColorSpaceSettings`
- `filterSettings` → `H264FilterSettings`, `H265FilterSettings`, `Mpeg2FilterSettings`
- `hlsCdnSettings` → `HlsCdnSettings` factory class
- `keyProviderSettings` → `HlsKeyProviderSettings` factory class
- `archiveCdnSettings` → `archiveS3CannedAcl: S3CannedAcl` prop
- `frameCaptureCdnSettings` → `frameCaptureS3CannedAcl: S3CannedAcl` prop
- `captionLanguageMappings` → `CaptionLanguageMapping[]` typed array

#### 8. InputSpecification models the input-type choice, not the two CFN properties

At the CloudFormation level the input specification is two disconnected, flat, optional properties on the channel — `inputSpecification` ({ codec, maximumBitrate, resolution }) and `cdiInputSpecification` ({ resolution }) — with no concept linking them. The MediaLive console abstracts this three-way "Input type" control (Other / CDI / Elemental Link) that decides which of the two to populate: "Other" sets the first, "CDI" sets both, "Elemental Link" sets neither. That relationship exists only in the console UX, not in the L1 resource.

Rather than pass the two props through and leave users to rediscover those rules, the L2 exposes the choice directly via `InputSpecification.standard()` / `.cdi()` / `.elementalLink()`. This makes the valid combinations discoverable (the factory names mirror the console), keeps the CDI resolution reachable only where it applies (it's a prop of `.cdi()` only), and represents "Elemental Link needs no spec" as an explicit, intentional choice rather than an empty object.

#### 9. CloudWatch metrics

`IChannel` exposes a generic `metric(metricName, pipeline, props?)` plus named `metricXxx(pipeline, props?)` helpers (e.g. `metricActiveAlerts`, `metricNetworkIn`/`metricNetworkOut`, `metricInputVideoFrameRate`, `metricFillMsec`, `metricInputLossSeconds`, `metricDroppedFrames`, `metricSvqTime`). All build metrics in the `AWS/MediaLive` namespace; the named helpers default to the AWS-recommended statistic for each metric (e.g. `ActiveAlerts`→Max, `NetworkIn`→Average, `InputLossSeconds`→Sum). Because metrics are on `IChannel`, they're available on both owned and imported channels.

```ts
declare const channel: medialive.IChannel;
declare const stack: Stack;

channel.metricDroppedFrames(medialive.Pipeline.PIPELINE_0).createAlarm(stack, 'DroppedFrames', {
  threshold: 1,
  evaluationPeriods: 2,
});

// Any metric by name, with caller-chosen statistic/dimensions
channel.metric('Output4xxErrors', medialive.Pipeline.PIPELINE_0, { statistic: 'sum' });
```

**Why a required `Pipeline` argument.** Every MediaLive metric is published per pipeline. `STANDARD` channels run two redundant pipelines (`PIPELINE_0`, `PIPELINE_1`) — to cover the whole channel you alarm on both. `SINGLE_PIPELINE` channels only publish on `PIPELINE_0`; passing `PIPELINE_1` throws at synth time. Making the pipeline an explicit argument (a `Pipeline` value class, not a raw string) forces a deliberate choice rather than silently monitoring one pipeline of a redundant pair.

**Why metrics live only on `Channel`.** Every documented MediaLive metric — global, input, output, pipeline-locking, and MQCS — is dimensioned by `ChannelId`/`Pipeline` (with metric-specific extra dimensions like `OutputGroupName`, `AudioDescriptionName`, or `ActiveInputFailoverLabel` supplied via `props.dimensionsMap`). MediaLive does not publish a separate `Input`-dimensioned namespace, so "input health" and "output health" are both observed through the channel. `Input` therefore intentionally does not expose `metric()` — there is no resource-scoped metric for it to return.

#### 10. MediaConnect integration and the cross-package dependency direction

MediaLive and MediaConnect reference each other across the contribution/distribution boundary: MediaConnect can deliver to a MediaLive input/channel (`RouterOutputConfiguration.mediaLiveInput`, `RouterInputConfiguration.mediaLiveChannel`), and MediaLive can deliver to a MediaConnect Router Input (`SrtDestination.fromRouterInput`). Two alpha packages that import each other's types form a circular package dependency. We break the cycle by fixing a single dependency direction and choosing the reference type accordingly:

- **The edge is one-directional: `aws-medialive-alpha` → `aws-mediaconnect-alpha`.** MediaLive is the consumer that needs MediaConnect's richer attributes, so it takes the dependency. This mirrors the existing `aws-medialive-alpha` → `aws-mediapackagev2-alpha` edge.
- **MediaLive uses MediaConnect's rich L2 types** where it needs runtime attributes. `SrtDestination.fromRouterInput(routerInput: IRouterInput)` reads the router input's ingest endpoint URL and transit encryption secret off the L2 — neither is available on a bare reference, so the rich type is required.
- **MediaConnect references MediaLive only through `aws-cdk-lib` reference interfaces** (`IInputRef`, `IChannelRef`), never `@aws-cdk/aws-medialive-alpha`. These ref interfaces live in `aws-cdk-lib` (a dependency both alphas already have) and carry just the ARN/identifiers MediaConnect needs. This is the key move: MediaConnect gains type-safe MediaLive references with **no** dependency on the MediaLive alpha, so no back-edge is created.

A dedicated cross-service "integrations" package was considered and rejected: the coupling is cleanly one-directional (the ref interfaces already remove the only would-be back-edge) and the surface is small and naturally homed on the existing constructs, so a third package would add release/versioning/discoverability overhead for no decoupling benefit.

---


### Complete End-to-End Example

This example shows a complete live streaming pipeline: MediaConnect Router input → MediaLive Channel with MediaPackage V2 + HLS output groups → multiple encode profiles (1080p, 720p, audio-only), with the HLS output fronted by CloudFront. It is exercised end-to-end by the `integ.medialive-e2e-cdn` integration test.

```ts
import * as cdk from 'aws-cdk-lib';
import { Bitrate } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as medialive from '@aws-cdk/aws-medialive-alpha';
import * as mediapackagev2 from '@aws-cdk/aws-mediapackagev2-alpha';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'LiveStreamingStack');

// S3 bucket for the HLS output. Passing it via OutputDestination.toBucket() below
// auto-grants the channel's role scoped write access — no manual IAM wiring.
const hlsBucket = new s3.Bucket(stack, 'HlsBucket');

// MediaPackage V2 channel (downstream)
const channelGroup = new mediapackagev2.ChannelGroup(stack, 'ChannelGroup');
const mpChannel = channelGroup.addChannel('MpChannel', {
  input: mediapackagev2.InputConfiguration.cmaf(),
});

// MediaLive input — MediaConnect Router
const input = new medialive.Input(stack, 'Input', {
  inputName: 'router-input',
  input: medialive.InputConfiguration.mediaConnectRouter({
    availabilityZones: ['us-east-1a', 'us-east-1b'],
  }),
});

// Encode configurations — defined once, shared across output groups
const video1080 = medialive.EncodeConfiguration.video({
  name: 'video_1080p',
  width: 1920,
  height: 1080,
  codecSettings: medialive.VideoCodecSettings.h264({
    profile: medialive.H264Profile.HIGH,
    rateControl: medialive.H264RateControl.cbr({ bitrate: Bitrate.mbps(5) }),
    framerate: medialive.Framerate.FPS_29_97,
    gopSize: medialive.GopSize.seconds(2),
    gopNumBFrames: 3,
    adaptiveQuantization: medialive.H264AdaptiveQuantization.HIGH,
  }),
});

const video720 = medialive.EncodeConfiguration.video({
  name: 'video_720p',
  width: 1280,
  height: 720,
  codecSettings: medialive.VideoCodecSettings.h264({
    profile: medialive.H264Profile.HIGH,
    rateControl: medialive.H264RateControl.cbr({ bitrate: Bitrate.mbps(3) }),
    framerate: medialive.Framerate.FPS_29_97,
    gopSize: medialive.GopSize.seconds(2),
    gopNumBFrames: 3,
    adaptiveQuantization: medialive.H264AdaptiveQuantization.HIGH,
  }),
});

const audioStereo = medialive.EncodeConfiguration.audio({
  name: 'audio_aac_stereo',
  codecSettings: medialive.AudioCodecSettings.aac({
    bitrate: Bitrate.kbps(192),
    profile: medialive.AacProfile.LC,
    codingMode: medialive.AacCodingMode.CODING_MODE_2_0,
  }),
});

// MediaLive Channel
const channel = new medialive.Channel(stack, 'Channel', {
  channelName: 'live-channel',
  channelClass: medialive.ChannelClass.STANDARD,
  logLevel: medialive.LogLevel.INFO,
  inputs: [{ input }],
  inputSpecification: medialive.InputSpecification.standard({
    codec: medialive.InputCodec.AVC,
    maximumBitrate: medialive.InputMaximumBitrate.MAX_20_MBPS,
    resolution: medialive.InputResolution.HD,
  }),
  outputGroups: [
    // MediaPackage V2 — one track per output (CMAF)
    medialive.OutputGroupConfiguration.mediaPackageV2({
      name: 'mp2',
      destinations: [
        medialive.MediaPackageV2Destination.channel(mpChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_1),
        medialive.MediaPackageV2Destination.channel(mpChannel, medialive.MediaPackageV2EndpointId.ENDPOINT_2),
      ],
      outputs: [
        { outputName: 'mp2-1080', encode: video1080 },
        { outputName: 'mp2-720', encode: video720 },
        { outputName: 'mp2-audio', encode: audioStereo },
      ],
    }),
    // HLS to S3 — multiple encodes per output. toBucket() auto-grants scoped write.
    medialive.OutputGroupConfiguration.hls({
      name: 'hls',
      destinations: [
        medialive.OutputDestination.toBucket(hlsBucket, 'pipeline-0/index'),
        medialive.OutputDestination.toBucket(hlsBucket, 'pipeline-1/index'),
      ],
      segment: medialive.Segment.seconds(6),
      keepSegments: 21,
      indexNSegments: 7,
      outputs: [
        { outputName: 'hls-1080', nameModifier: '_1080p', encodes: [video1080, audioStereo] },
        { outputName: 'hls-720', nameModifier: '_720p', encodes: [video720, audioStereo] },
      ],
    }),
  ],
});

// Serve the HLS output through CloudFront, locked to the bucket with Origin Access Control.
// The channel's auto-created role already has scoped write to the bucket (via toBucket above);
// OAC gives CloudFront scoped read without making the bucket public.
const distribution = new cloudfront.Distribution(stack, 'Cdn', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(hlsBucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
});
```

---


### Anywhere Deployment Example

The Anywhere constructs (`Network`, `Cluster`, `ChannelPlacementGroup`, `SdiSource`) ship with this release. See their individual Working Backwards sections above for usage. A full end-to-end Anywhere walkthrough will be added to the module README.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We're launching new AWS Elemental MediaLive L2 Constructs to provide best-practice defaults and a developer-friendly API for creating MediaLive Inputs, Input Security Groups, Channels, Networks, Clusters, and Channel Placement Groups.

The aim is to reduce the complexity of the `AWS::MediaLive::Channel` CloudFormation resource into a abstracted, type-safe API with synth-time validation.

### Why should I use this feature?

Developers should use these constructs to:

- Reduce boilerplate from hundreds of lines of nested CFN properties to tens of lines of typed, composable code.
- Catch invalid configurations (wrong codec for output group type, wrong destination count for channel class) at synth time instead of deploy time.
- Use CDK `Duration` and `Bitrate` types instead of raw numbers.
- Share encode configurations across output groups with automatic deduplication.
- Get IDE autocomplete and type checking for all 9 output group types, 5 video codecs, and 7 audio codecs.
- Monitor channels with typed CloudWatch metric helpers (`channel.metricDroppedFrames(...)`, `channel.metric(...)`) in the `AWS/MediaLive` namespace, with AWS-recommended default statistics.

## Internal FAQ

### Why are we doing this?

The `AWS::MediaLive::Channel` CloudFormation resource is one of the most complex resource in AWS. It has hundreds of nested properties for encoder settings, output groups, codec configurations, and destinations. Developers must reference extensive documentation to determine valid combinations of parameters.

By building L2 constructs, we:

1. Reduce the cognitive load of configuring MediaLive channels.
2. Provide compile-time and synth-time validation for codec/output-group compatibility.
3. Enable encode sharing and deduplication across output groups.
4. Use CDK-native types (Duration, Bitrate) for all time and bitrate properties.
5. Support the full breadth of MediaLive capabilities including all 9 output group types and MediaLive Anywhere.

### Why should we _not_ do this?

Users today are already using the L1 construct and would need to migrate. However, the L1 experience for MediaLive Channel is particularly difficult due to the resource's complexity, making the L2 especially valuable.

### What is the technical solution (design) of this feature?

The design centers on:

1. **Abstract classes with static factory methods** for type-safe, discoverable configuration of inputs, output groups, codecs, rate control, and avail settings.
2. **Lazy evaluation** — encode descriptions are collected and deduplicated at synth time using `Lazy.any()`.
3. **Per-output-group validation** — each output group type validates its codec compatibility and destination counts.
4. **Composable encode configurations** — defined once, referenced by multiple outputs across multiple output groups.
5. **CloudWatch metrics** — `IChannel` exposes a generic `metric()` and named `metricXxx()` helpers (`AWS/MediaLive` namespace, `ChannelId`/`Pipeline` dimensions), with a required `Pipeline` argument so monitoring of redundant pipelines is an explicit choice. See Key Design Decision #9.

### Is this a breaking change?

No — an L2 doesn't exist today. This is a new alpha module.

### What alternative solutions did you consider?

We considered a builder pattern for the channel, but the factory method pattern on abstract classes provides better discoverability and type safety while keeping the API surface flat and composable.

### What are the drawbacks of this solution?

Due to the sheer number of property combinations and inter-dependencies in the MediaLive Channel resource, the L2 cannot validate every possible misconfiguration at synth time. We validate the most common and impactful constraints (codec compatibility, destination counts, resolution parity, single-track-per-output for CMAF), but many constraints — such as valid codec parameter ranges, container-specific requirements, and cross-property dependencies — will continue to rely on the MediaLive API for validation. The API error messages from MediaLive are generally clear and actionable, so this is a pragmatic trade-off.

### What is the high-level project plan?

The L2 constructs have been built and are working towards alpha release. The constructs cover:

- 6 resource types: Input, InputSecurityGroup, Channel, Network, Cluster, ChannelPlacementGroup
- 9 output group types: MediaPackage V2, HLS, UDP, Archive, RTMP, SRT, CMAF Ingest, Frame Capture, MS Smooth
- 5 video codecs: H.264, H.265, AV1, Frame Capture, MPEG-2
- 7 audio codecs: AAC, AC3, EAC3, EAC3 Atmos, MP2, WAV, Passthrough
- 16 input types: URL pull, RTMP push/pull, SRT caller/listener, MediaConnect, MediaConnect Router, SDI, UDP push, RTP push, MP4 file, TS file, CDI, Elemental Link (input device), Multicast, SMPTE 2110 receiver group
- CloudWatch metrics on `Channel`: a generic `metric()` plus named helpers for the common global/input/output/pipeline metrics, in the `AWS/MediaLive` namespace

### Are there any open issues that need to be addressed later?

- **Multiplex and MultiplexProgram are not implemented in the initial release.** The `Multiplex`, `MultiplexProgram`, and `multiplex()` output group constructs are deferred and will follow in a later release. The MPEG-2 video codec is also deferred, since its only valid output group is Multiplex.
- Workflow Monitor resources (CloudWatch Alarm Templates, EventBridge Rule Templates, SignalMap) are under the MediaLive CFN namespace but are a cross-service monitoring feature. These are out of scope for this initial release.
- `Framerate` and `PixelAspectRatio` are generic numerator/denominator value objects with no MediaLive-specific behaviour. The same concepts appear in other media services — notably AWS Elemental MediaConnect — so there is an opportunity to define them once and share rather than re-declaring per package. The open question is *where* they should live: a media-specific shared library, or CDK Core. This is deliberately deferred. For the initial alpha these types stay local to this module; consolidation can follow once a second consumer concretely needs them.
