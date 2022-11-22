# Amazon Ground Station L2

- **Original Author(s):**: @kochie
- **Tracking Issue**: #434
- **API Bar Raiser**: @

The `aws-groundstation` construct library allows user to seamlessly create
mission profiles and configurations to connect with satellites in orbit. As with
most construct libraries, you can also easily define permissions, bind
notification resource and add metrics using a simple API.

## Working Backwards

> This section should contain one or more "artifacts from the future", as if the
> feature was already released and we are publishing its CHANGELOG, README,
> CONTRIBUTING.md and optionally a PRESS RELEASE. This is the most important
> section of your RFC. It's a powerful thought exercise which will challenge you
> to truly think about this feature from a user's point of view.
>
> Choose _one or more_ of the options below:
>
> - **CHANGELOG**: Write the changelog entry for this feature in conventional
>   form (e.g. `feat(eks): cluster tags`). If this change includes a breaking
>   change, include a `BREAKING CHANGE` clause with information on how to
>   migrate. If migration is complicated, refer to a fictional GitHub issue and
>   add its contents here.
>
> - **README**: If this is a new feature, write the README section which
>   describes this new feature. It should describe the feature and walk users
>   through usage examples and description of the various options and behavior.
>
> - **PRESS RELEASE**: If this is a major feature (~6 months of work), write the
>   press release which announces this feature. The press release is a single
>   page that includes 7 paragraphs: (1) summary, (2) problem, (3) solution, (4)
>   leader quote, (5) user experience, (6) customer testimonial and (7) one
>   sentence call to action.

### CHANGELOG

```
feat(groundstation): Initial implementation
feat(groundstation): Higher Level Satellite Constructs
feat(groundstation): Demodulation configuration and type checking
```

---

### README

#### AWS::GroundStation Construct Library

Constructs to create workflows for communicating with satellites.

```ts
import { Fn, Duration } from "aws-cdk-lib"
import { MissionProfile, Autotrack, S3RecordingConfig, TrackingConfig } from "aws-cdk-lib/aws-groundstation"
import { Bucket } from "aws-cdk-lib/aws-s3"
import { Role } from "aws-cdk-lib/aws-s3"

const bucket = new Bucket(this, "gs-bucket", {
  bucketName: `aws-groundstation-${BUCKET_NAME}`
})

const role = new Role(this, "gs-s3-role", {

})

const recordConfig = new S3RecordingConfig(this, "S3RecordingConfig", {
  bucket,
  role,
  // Optional keys for substitution: {satellite_id} | {config-name} | {config-id} | {year} | {month} | {day}
  prefix: "{satellite_id}/{year}/{month}/{day}/",
});

const trackingConfig = new TrackingConfig(this, "TrackingConfig", {
  configName: "Tracking",
  autotrack: Autotrack.PREFERRED
})

new MissionProfile(this, "MissionProfile", {
  dataflowEdges: [{
    source: Fn.join([antennaDownlinkDemodDecodeConfig.configArn, 'UncodedFramesEgress'], "/")
    destination: recordConfig.configArn
  }],
  minimumViableContactDuration: Duration.minutes(1),
  name: "Satellite #1 Mission Profile",
  trackingConfig: trackingConfig
});
```

##### Creating Configurations

Configurations define how all satellite communication is handled. There are many
different configuration constructs

##### AntennaDownlinkConfig

Provides information about how AWS Ground Station should configure an antenna
for downlink during a contact. Use an antenna downlink config in a mission
profile to receive the downlink data in raw DigIF format.

```ts
new AntennaDownlinkConfig(this, 'AntennaDownlinkConfig', {
  configName: 'AntennaDownlink_Alpha',
  spectrumConfig: {
    bandwidth: {
      value: 30,
      units: Frequency.MHZ,
    },
    centerFrequency: {
      value: 7812,
      units: Frequency.MHZ,
    },
    polarization: Polarization.LEFT_HAND,
  },
});
```

##### AntennaDownlinkDemodDecodeConfig

Provides information about how AWS Ground Station should configure an antenna
for downlink during a contact. Use an antenna downlink demod decode config in a
mission profile to receive the downlink data that has been demodulated and
decoded.

```ts
new AntennaDownlinkDemodDecodeConfig(this, 'AntennaDownlinkDemodDecodeConfig', {
  configName: 'AntennaDownlinkDemodDecodeConfig_Alpha',
  spectrumConfig: {
    centerFrequency: {
      value: 7812,
      units: Frequency.MHZ,
    },
    bandwidth: {
      value: 30,
      units: Frequency.MHZ,
    },
    polarization: Polarization.RIGHT_HAND,
  },
  demodulationConfig: {
    unvalidatedJson: `
  {
        "type":"QPSK",
        "qpsk":{
          "carrierFrequencyRecovery":{
            "centerFrequency":{
              "value":7812,
              "units":"MHz"
            },
            "range":{
              "value":250,
              "units":"kHz"
            }
          },
          "symbolTimingRecovery":{
            "symbolRate":{
              "value":15,
              "units":"Msps"
          },
          "range":{
            "value":0.75,
            "units":"ksps"
          },
          "matchedFilter":{
            "type":"ROOT_RAISED_COSINE",
            "rolloffFactor":0.5
          }
        }
      }
    }
  `,
  },
  decodeConfig: {
    unvalidatedJson: `
    {
      "edges":[
        {
          "from":"I-Ingress",
          "to":"IQ-Recombiner"
        },
        {
          "from":"Q-Ingress",
          "to":"IQ-Recombiner"
        },
        {
          "from":"IQ-Recombiner",
          "to":"CcsdsViterbiDecoder"
        },
        {
          "from":"CcsdsViterbiDecoder",
          "to":"NrzmDecoder"
        },
        {
          "from":"NrzmDecoder",
          "to":"UncodedFramesEgress"
        }
      ],
      "nodeConfigs":{
        "I-Ingress":{
          "type":"CODED_SYMBOLS_INGRESS",
          "codedSymbolsIngress":{
            "source":"I"
          }
        },
        "Q-Ingress":{
          "type":"CODED_SYMBOLS_INGRESS",
          "codedSymbolsIngress":{
            "source":"Q"
          }
        },
        "IQ-Recombiner":{
          "type":"IQ_RECOMBINER"
        },
        "CcsdsViterbiDecoder":{
          "type":"CCSDS_171_133_VITERBI_DECODER",
          "ccsds171133ViterbiDecoder":{
            "codeRate":"ONE_HALF"
          }
        },
        "NrzmDecoder":{
          "type":"NRZ_M_DECODER"
        },
        "UncodedFramesEgress":{
          "type":"UNCODED_FRAMES_EGRESS"
        }
      }
    }
    `,
  },
});
```

##### AntennaUplinkConfig

Provides information about how AWS Ground Station should configure an antenna
for uplink during a contact.

```ts
new AntennaUplinkConfig(this, "AntennaUplinkConfig", {
  configName: "AntennaUplinkConfig_Alpha",
  spectrumConfig: {
    centerFrequency: {
      value: 2072.5
      units: Frequency.MHZ
    },
    polarization: Polarization.RIGHT_HAND
  },
  targetEirp: {
    value: 20.0
    units: EripUnits.DBW
  }
})
```

##### DataflowEndpointConfig

Provides information to AWS Ground Station about which IP endpoints to use
during a contact.

```ts
declare const endpoint: DataflowEndpoint;

new DataflowEndpointConfig(this, 'DataflowEndpointConfig', {
  dataflowEndpointName: 'Downlink Demod Decode',
  dataflowEndpointRegion: 'us-east-1',
});
```

##### S3RecordingConfig

Provides information about how AWS Ground Station should save downlink data to
S3.

```ts
declare const bucket: s3.Bucket;
declare const role: iam.Role;

new S3RecordingConfig(this, 'S3RecordingConfig', {
  bucket,
  role,
  // Optional keys for substitution: {satellite_id} | {config-name} | {config-id} | {year} | {month} | {day}
  prefix: '{satellite_id}/{year}/{month}/{day}/',
});
```

##### TrackingConfig

Provides information about how AWS Ground Station should track the satellite
through the sky during a contact.

```ts
new TrackingConfig(this, 'TrackingConfig', {
  configName: 'TrackingConfig_Alpha',
  autotrack: Autotrack.REQUIRED,
});
```

##### UplinkEchoConfig

Provides information about how AWS Ground Station should echo back uplink
transmissions to a dataflow endpoint.

```ts
declare const antennaUplinkConfig: AntennaUplinkConfig;

new UplinkEchoConfig(this, 'UplinkEchoConfig', {
  configName: 'UplinkEchoConfig_Alpha',
  antennaUplinkConfig: antennaUplinkConfig,
  enabled: true,
});
```

#### Creating Endpoints

Dataflow endpoint groups contain a list of endpoints. When the name of a
dataflow endpoint group is specified in a mission profile, the Ground Station
service will connect to the endpoints and flow data during a contact.

```ts
new DataflowEndpointGroup(this, "DataflowEndpointGroup", {
  endpointDetails: [{
    endpoint: {
      name: 'myEndpoint',
      address: {
        name: 172.10.0.2
        port: 44720
      },
      mtu: 1500
    },
    securityDetails: {
      subnetIds: ['subnet-12345678'],
      securityGroupIds: ['sg-87654321']
      role: "arn:aws:iam::012345678910:role/groundstation-service-role-AWSServiceRoleForAmazonGroundStation-EXAMPLEABCDE"
    }
  }]
})
```

#### Mission Profiles

```ts
declare const s3RecordingConfig: S3RecordingConfig
declare const antennaDownlinkDemodDecodeConfig: AntennaDownlinkDemodDecodeConfig
declare const trackingConfig: TrackingConfig

new MissionProfile(this, "MissionProfile", {
  contactPostPassDuration: Duration.seconds(10),
  contactPrePassDuration: Duration.seconds(10),
  dataflowEdges: [{
    source: Fn.join([antennaDownlinkDemodDecodeConfig.configArn, 'UncodedFramesEgress'], "/")
    destination: s3RecordingConfig.configArn
  }],
  minimumViableContactDuration: Duration.minutes(1),
  name: "Satellite #1 Mission Profile",
  trackingConfig: trackingConfig
});
```

---

If this is a major feature (~6 months of work), write the

> press release which announces this feature. The press release is a single page
> that includes 7 paragraphs: (1) summary, (2) problem, (3) solution, (4) leader
> quote, (5) user experience, (6) customer testimonial and (7) one sentence call
> to action.

## Press Release

Today, we're making it easier and faster for customers to communicate and
integrate satellites into their workflow with the introduction of AWS Ground
Station CDK constructs.

Before today if customers wanted to integrate their satellites into their
account they would have to write and maintain large sections of CloudFormation
templates.

Now all customers need to do is import the groundstation CDK constructs and
within minutes can begin integrating their satellites into workflows, using the
data for machine learning pipelines, HPC, and more.

Leader Quote

UX

Customer Testimonial

You can get started with AWS Ground Station in CDK today, simply follow the
instructions found in the
[CDK Documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_groundstation-readme.html)

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

> This section should include answers to questions readers will likely ask about
> this release. Similar to the "working backwards", this section should be
> written in a language as if the feature is now released.
>
> The template includes a some common questions, feel free to add any questions
> that might be relevant to this feature or omit questions that you feel are not
> applicable.

### What is AWS Ground Station?

AWS Ground Station is a service that allows users to communicate with
satellites. Customers can rent time on ground stations found all over the world
to upload instructions to satellites they either own or download information
from public domain satellites such as NOAA and AQUA.

### What are we launching today?

> What exactly are we launching? Is this a new feature in an existing module? A
> new module? A whole framework? A change in the CLI?

### Why should I use this feature?

> Describe use cases that are addressed by this feature.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

> What is the motivation for this change?

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

### What is the technical solution (design) of this feature?

> Briefly describe the high-level design approach for implementing this feature.
>
> As appropriate, you can add an appendix with a more detailed design document.
>
> This is a good place to reference a prototype or proof of concept, which is
> highly recommended for most RFCs.

### Is this a breaking change?

> If the answer is no. Otherwise:
>
> Describe what ways did you consider to deliver this without breaking users?
>
> Make sure to include a `BREAKING CHANGE` clause under the CHANGELOG section
> with a description of the breaking changes and the migration path.

### What alternative solutions did you consider?

> Briefly describe alternative approaches that you considered. If there are
> hairy details, include them in an appendix.

### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

### What is the high-level project plan?

> Describe your plan on how to deliver this feature from prototyping to GA.
> Especially think about how to "bake" it in the open and get constant feedback
> from users before you stabilize the APIs.
>
> If you have a project board with your implementation plan, this is a good
> place to link to it.

### Are there any open issues that need to be addressed later?

> Describe any major open issues that this RFC did not take into account. Once
> the RFC is approved, create GitHub issues for these issues and update this RFC
> of the project board with these issue IDs.

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.
