# RFC - CloudFront + MediaPackage V2 Origin Integration

## Native CloudFront Origin Support for MediaPackage V2

* **Original Author(s):** @jamiepmullan
* **Tracking Issue:** [#907](https://github.com/aws/aws-cdk-rfcs/issues/907)
* **API Bar Raiser:** @alvazjor

Today, connecting a CloudFront distribution to a MediaPackage V2 origin
endpoint requires manually configuring origin access control, resource
policies, and custom origin settings. This RFC adds first-class support
across two modules so that developers can wire up a CloudFront +
MediaPackage V2 pipeline in a few lines of code.

The implementation spans a stable module and an alpha module: a generic
`MediaPackageV2OriginAccessControl` OAC class is added to
`aws-cdk-lib/aws-cloudfront` (stable), while the opinionated
`MediaPackageV2Origin` origin class lives in
`@aws-cdk/aws-mediapackagev2-alpha`. This keeps the dependency direction
correct — the alpha module depends on the stable cloudfront module, not
the other way around — and allows the stable module to ship a reusable
OAC primitive without taking a dependency on alpha types. The origin
class in the alpha module then builds on that primitive to deliver the
full integration experience (OAC auto-creation, resource policy grants,
egress domain wiring). If MediaPackage V2 were already stable, the
origin class would naturally live in `aws-cloudfront-origins` alongside
`S3BucketOrigin` — but since it depends on alpha types, it must remain
in the alpha module until graduation.

Before (L1 escape hatches):

```ts
const oac = new cloudfront.CfnOriginAccessControl(this, 'OAC', {
  originAccessControlConfig: {
    name: 'my-mediapackage-oac',
    originAccessControlOriginType: 'mediapackagev2',
    signingBehavior: 'always',
    signingProtocol: 'sigv4',
  },
});

const distribution = new cloudfront.Distribution(this, 'Dist', {
  defaultBehavior: {
    origin: new HttpOrigin(channelGroup.egressDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    }),
  },
});

const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
cfnDistribution.addOverride(
  'Properties.DistributionConfig.Origins.0.OriginAccessControlId',
  oac.ref,
);

endpoint.addToResourcePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
  actions: ['mediapackagev2:GetObject', 'mediapackagev2:GetHeadObject'],
  resources: [endpoint.originEndpointArn],
  conditions: {
    StringEquals: {
      'aws:SourceArn': `arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${distribution.distributionId}`,
    },
  },
}));
```

After (L2):

```ts
new cloudfront.Distribution(this, 'Dist', {
  defaultBehavior: {
    origin: new MediaPackageV2Origin(endpoint, {
      channelGroup: group,
    }),
  },
});
```

## Working Backwards

### README

#### MediaPackageV2OriginAccessControl (aws-cdk-lib/aws-cloudfront)

A new OAC class for MediaPackage V2 origins, following the same pattern as `S3OriginAccessControl` and `FunctionUrlOriginAccessControl`.

```ts
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

// Create a new OAC for MediaPackage V2
const oac = new cloudfront.MediaPackageV2OriginAccessControl(stack, 'MyOAC');

// Import an existing OAC
const importedOac = cloudfront.MediaPackageV2OriginAccessControl.fromOriginAccessControlId(
  stack, 'ImportedOAC', 'E1234567890ABC',
);
```

Property Interface:

```ts
export interface MediaPackageV2OriginAccessControlProps {
  /**
   * A description of the origin access control.
   * @default - no description
   */
  readonly description?: string;

  /**
   * A name to identify the origin access control.
   * @default - a generated name
   */
  readonly originAccessControlName?: string;
}
```

#### MediaPackageV2Origin (@aws-cdk/aws-mediapackagev2-alpha)

A CloudFront origin class that handles the full integration between
CloudFront and MediaPackage V2. It extends `cloudfront.OriginBase` and
wires together OAC creation, resource policies, and origin configuration.

```ts
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as mediapackagev2 from '@aws-cdk/aws-mediapackagev2-alpha';

declare const endpoint: mediapackagev2.IOriginEndpoint;
declare const channelGroup: mediapackagev2.IChannelGroup;

// Simple usage — OAC is auto-created
const distribution = new cloudfront.Distribution(stack, 'Distribution', {
  defaultBehavior: {
    origin: new mediapackagev2.MediaPackageV2Origin(endpoint, {
      channelGroup: channelGroup,
    }),
  },
});
```

With explicit OAC and CDN auth:

```ts
declare const endpoint: mediapackagev2.IOriginEndpoint;
declare const channelGroup: mediapackagev2.IChannelGroup;

const oac = new cloudfront.MediaPackageV2OriginAccessControl(stack, 'OAC');

const distribution = new cloudfront.Distribution(stack, 'Distribution', {
  defaultBehavior: {
    origin: new mediapackagev2.MediaPackageV2Origin(endpoint, {
      channelGroup: channelGroup,
      originAccessControl: oac,
      cdnAuthConfiguration: {
        headerName: 'X-MediaPackage-CDNIdentifier',
        secretHeaderValue: secretsmanager.Secret.fromSecretNameV2(
          stack, 'CdnSecret', 'my-cdn-auth-secret',
        ),
      },
    }),
  },
});
```

Property Interface:

```ts
export interface MediaPackageV2OriginProps extends cloudfront.OriginOptions {
  /**
   * The channel group that contains the origin endpoint.
   * Used to derive the egress domain for the custom origin.
   */
  readonly channelGroup: mediapackagev2.IChannelGroup;

  /**
   * The origin access control to use.
   * @default - a new MediaPackageV2OriginAccessControl is created
   */
  readonly originAccessControl?: cloudfront.IOriginAccessControl;

  /**
   * CDN authorization configuration.
   * When provided, the specified header and secret are included
   * in origin requests for MediaPackage V2 CDN auth validation.
   * @default - no CDN authorization
   */
  readonly cdnAuthConfiguration?: CdnAuthConfiguration;
}

export interface CdnAuthConfiguration {
  /**
   * The header name used for CDN authorization.
   */
  readonly headerName: string;

  /**
   * The Secrets Manager secret containing the header value.
   */
  readonly secretHeaderValue: secretsmanager.ISecret;
}
```

The origin automatically:

- Configures HTTPS-only custom origin pointing at the channel group's egress domain
- Creates a `MediaPackageV2OriginAccessControl` if one isn't provided
- Calls `endpoint.addToResourcePolicy()` to grant the CloudFront
  distribution access (including `GetHeadObject` for MQAR support)

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

Two additions across two modules:

1. `MediaPackageV2OriginAccessControl` in the stable
   `aws-cdk-lib/aws-cloudfront` module — a new OAC class for
   MediaPackage V2 origins.
2. `MediaPackageV2Origin` in `@aws-cdk/aws-mediapackagev2-alpha` — a
   CloudFront origin class that handles the full CloudFront +
   MediaPackage V2 integration.

### Why should I use this feature?

If you're building a live streaming pipeline with CloudFront and
MediaPackage V2, this removes the need to manually configure OAC,
resource policies, and custom origin settings. Instead of ~30 lines
of boilerplate, you get a single origin class that handles it all.

## Internal FAQ

### Why are we doing this?

Connecting CloudFront to MediaPackage V2 currently requires users to
understand OAC configuration, resource policy grants, egress domain
construction, and HTTPS-only origin settings. This is error-prone and
repetitive. The S3 origin integration already sets the precedent for
auto-wiring OAC and bucket policies — we're applying the same pattern
to MediaPackage V2.

### Why should we _not_ do this?

Users can achieve this today with escape hatches and manual
configuration. However, the integration is complex enough that most
users get it wrong on the first attempt, particularly around resource
policies and MQAR support.

### What is the technical solution (design) of this feature?

The design splits across two modules to maintain correct dependency direction:

- The stable `aws-cloudfront` module gets
  `MediaPackageV2OriginAccessControl`, which is a standalone OAC class
  following the existing `S3OriginAccessControl` pattern. It creates a
  `CfnOriginAccessControl` with
  `originAccessControlOriginType: MEDIAPACKAGEV2`. The
  `MEDIAPACKAGEV2` enum value already exists in
  `OriginAccessControlOriginType`.

- The alpha `aws-mediapackagev2-alpha` module gets
  `MediaPackageV2Origin`, which extends `cloudfront.OriginBase`. It
  takes an `IOriginEndpoint` and `IChannelGroup`, auto-creates OAC if
  needed, grants resource policy access, and renders HTTPS-only custom
  origin config. The alpha module depends on the stable cloudfront
  module (not the other way around).

This mirrors how `aws-cloudfront-origins` provides `S3BucketOrigin`
that auto-creates `S3OriginAccessControl`, except the origin lives in
the mediapackagev2 alpha package since it depends on alpha types.

### Is this a breaking change?

No. Both additions are net-new classes with no changes to existing APIs.

### What alternative solutions did you consider?

- Placing `MediaPackageV2Origin` in `aws-cloudfront-origins` — rejected
  because it would require the stable module to depend on alpha
  MediaPackage V2 types.
- A standalone integration module — unnecessary complexity for two
  classes that fit naturally in their respective modules.

### What are the drawbacks of this solution?

The origin class lives in the alpha module, so users must install
`@aws-cdk/aws-mediapackagev2-alpha` to get the integration. Once
MediaPackage V2 graduates to stable, the origin class would move to
`aws-cloudfront-origins` or remain in the stable mediapackagev2 module.

### What is the high-level project plan?

Implementation is already drafted. The OAC class is a small addition to
the stable cloudfront module. The origin class builds on the existing
mediapackagev2 alpha constructs.

### Are there any open issues that need to be addressed later?

- Migration path for `MediaPackageV2Origin` when the alpha module
  graduates to stable.
