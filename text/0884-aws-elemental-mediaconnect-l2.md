# RFC AWS Elemental MediaConnect CDK L2 Construct

## L2 Constructs for AWS Elemental MediaConnect Flow, Bridge, Gateway and Router resources

* **Original Author(s):** @jamiepmullan
* **Tracking Issue:** [#884](https://github.com/aws/aws-cdk-rfcs/issues/884)
* **API Bar Raiser:** TBD

This design outlines how we build an L2 construct for AWS Elemental MediaConnect, delivering the following benefits:

- Implement sensible defaults to make getting started with AWS Elemental MediaConnect easier
- Simplify the declaration of Flow, Bridge, and Gateway by using factory patterns instead of complex union types
- Make VPC integration easier with reusable VpcInterface objects
- Abstract source configurations using enum-like classes for RTP, SRT, RIST, and entitlement sources
- Provide faster validation within CDK to ensure parameters are compatible with each other
- Include helper functions such as:
  - `.addOutput()` to make output definitions easier for both flows and bridges
  - Add metric functions to provide default/basic CloudWatch metrics as per CDK design
- Use types instead of string literals to simplify definitions (Duration, enums)

The code sample below is a simple configuration comparison between the existing L1 construct and what a L2 _could_ look like:

```ts
const flow = new CfnFlow(stack, 'Flow', {
  name: 'my-flow',
  source: {
    name: 'my-source',
    protocol: 'rtp',
    ingestPort: 5000,
    whitelistCidr: '203.0.113.0/24',
    description: 'RTP source',
  },
  vpcInterfaces: [{
    name: 'my-vpc-interface',
    roleArn: role.roleArn,
    securityGroupIds: [securityGroup.securityGroupId],
    subnetId: subnet.subnetId,
    networkInterfaceType: 'ena',
  }],
});

const bridge = new CfnBridge(stack, 'Bridge', {
  name: 'my-bridge',
  placementArn: gateway.gatewayArn,
  egressGatewayBridge: {
    maxBitrate: 10000000,
  },
  sources: [{
    flowSource: {
      name: 'flow-source',
      flowArn: flow.attrFlowArn,
      flowVpcInterfaceAttachment: {
        vpcInterfaceName: 'my-vpc-interface',
      },
    },
  }],
  outputs: [{
    networkOutput: {
      name: 'network-output',
      ipAddress: '192.168.1.100',
      port: 5000,
      protocol: 'rtp',
      networkName: 'my-network',
      ttl: 64,
    },
  }],
});
```

Same Configuration in an example L2:

```ts
const vpcInterface = mediaconnect.VpcInterface.create({
  vpcInterfaceName: 'my-vpc-interface',
  role: role,
  securityGroups: [securityGroup],
  subnet: subnet,
});

const flow = new mediaconnect.Flow(stack, 'Flow', {
  flowName: 'my-flow',
  source: mediaconnect.SourceConfiguration.rtp({
    flowSourceName: 'my-source',
    port: 5000,
    network: mediaconnect.NetworkConfiguration.internet('203.0.113.0/24'),
  }),
  vpcInterfaces: [vpcInterface],
});

const bridge = new mediaconnect.Bridge(stack, 'Bridge', {
  bridgeName: 'my-bridge',
  gateway: gateway,
  config: mediaconnect.BridgeConfiguration.egress({
    maxBitrate: mediaconnect.Bitrate.mbps(10),
    flowSources: [{
      name: 'flow-source',
      flow: flow,
      vpcInterface: vpcInterface,
    }],
    networkOutputs: [
      mediaconnect.BridgeOutputConfiguration.network({
        name: 'network-output',
        ipAddress: '192.168.1.100',
        port: 5000,
        protocol: mediaconnect.BridgeProtocol.RTP,
        networkName: 'my-network',
        ttl: 64,
      }),
    ],
  }),
});
```

The rest of this doc outlines the design for an L2 construct.

## Working Backwards

### README

[AWS Elemental MediaConnect](https://aws.amazon.com/mediaconnect/) is a high-quality transport service for live video that provides the reliability and security of satellite and fiber-optic combined with the flexibility, agility, and economics of IP-based networks. MediaConnect enables you to build mission-critical live video workflows in a fraction of the time and cost of satellite or fiber services.

Without an L2 construct, developers define MediaConnect flows and bridges via the AWS console, the AWS CLI, and Infrastructure as Code tools like CloudFormation and CDK.

However, there are several challenges to defining MediaConnect resources at scale that an L2 construct can resolve. For example, developers must reference documentation to determine the valid combinations of parameters for different source types and bridge configurations.

We could greatly simplify the developer experience in CDK by introducing MediaConnect L2 constructs. This will have a mixture of sensible defaults as well as methods to help build correct configurations of Flows, Bridges, Gateways, Routers, and VPC interfaces.

* [What is AWS Elemental MediaConnect?](https://aws.amazon.com/mediaconnect/)
* [MediaConnect Documentation](https://docs.aws.amazon.com/mediaconnect/latest/ug/what-is.html)
* [MediaConnect L1 (CloudFormation) Constructs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_MediaConnect.html)

#### AWS Elemental MediaConnect Flow

A MediaConnect flow represents a transport stream connection between a source and one or more outputs. Flows are the primary resource for transporting live video content.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediaconnect/latest/ug/flows.html).

```ts
new mediaconnect.Flow(stack, 'MyFlow', {
  source: mediaconnect.SourceConfiguration.rtp({
    flowSourceName: 'my-source',
    port: 5000,
    network: mediaconnect.NetworkConfiguration.internet('203.0.113.0/24'),
  }),
});
```

Optional override examples:

```ts
new mediaconnect.Flow(stack, 'MyFlow', {
  flowName: 'my-live-stream',
  source: mediaconnect.SourceConfiguration.rtp({
    flowSourceName: 'my-source',
    port: 5000,
    network: mediaconnect.NetworkConfiguration.internet('203.0.113.0/24'),
  }),
});
```

##### Adding Outputs to Flows

The `addOutput()` method provides a convenient way to create outputs directly associated with a flow. Outputs define where and how the flow sends content to downstream destinations.

```ts
const flow = new mediaconnect.Flow(stack, 'MyFlow', {
  source: mediaconnect.SourceConfiguration.rtp({
    flowSourceName: 'my-source',
    port: 5000,
    network: mediaconnect.NetworkConfiguration.internet('203.0.113.0/24'),
  }),
});

// Add an RTP output
const rtpOutput = flow.addOutput('RtpOutput',
  mediaconnect.OutputConfiguration.rtp({
    destination: '198.51.100.10',
    port: 5001,
  }),
);

// Add an SRT output with encryption
const srtOutput = flow.addOutput('SrtOutput',
  mediaconnect.OutputConfiguration.srtCaller({
    destination: '198.51.100.11',
    port: 5002,
    minLatency: Duration.millis(200),
  }),
);

// Add a router output
const routerOutput = flow.addOutput('RouterOutput',
  mediaconnect.OutputConfiguration.router(),
);
```

Interface for Flow Output:

```ts
/**
 * Interface for MediaConnect Flow Output
 */
export interface IFlowOutput extends IResource {
  /**
   * The Amazon Resource Name (ARN) of the flow output
   *
   * @attribute
   */
  readonly flowOutputArn: string;
}
```

Flow outputs support various protocols and configurations:

- **RTP/RTP-FEC**: Real-time Transport Protocol for standard streaming
- **SRT**: Secure Reliable Transport with configurable latency
- **RIST**: Reliable Internet Stream Transport
- **Zixi**: Zixi protocol for reliable transport
- **CDI**: Cloud Digital Interface for uncompressed workflows

Outputs can include encryption, VPC interface attachments, and router integration for advanced workflows.

Property Interface for Flow:

```ts
FlowProps {
  /**
   * Flow Name
   */
  flowName?: string;

  /**
   * Source configuration for the flow
   */
  source: SourceConfiguration;

  /**
   * Determines the processing capacity and feature set of the flow.
   * MEDIUM for standard transport streams, LARGE for NDI, LARGE_4X for CDI/JPEG XS.
   * @default - MEDIUM
   */
  flowSize?: FlowSize;

  /**
   * VPC interfaces for the flow
   */
  vpcInterfaces?: VpcInterfaceConfig[];

  /**
   * Source failover configuration
   */
  sourceFailoverConfig?: FailoverConfig;

  /**
   * Source monitoring configuration
   */
  sourceMonitoringConfig?: SourceMonitoringConfig;

  /**
   * NDI configuration (requires LARGE flow size)
   */
  ndiConfig?: NdiConfig;

  /**
   * Maintenance window configuration
   */
  maintenance?: MaintenanceWindow;

  /**
   * Media streams for CDI and JPEG XS workflows
   */
  mediaStream?: MediaStream[];

  /**
   * Policy to apply when the Flow is removed from the stack
   *
   * @default RemovalPolicy.RETAIN
   */
  removalPolicy?: RemovalPolicy;
}
```

Interface example of what the Flow will implement:

```ts
/**
 * Interface for MediaConnect Flow
 */
export interface IFlow extends IResource, IFlowRef {
  /**
   * The Amazon Resource Name (ARN) of the flow
   *
   * @attribute
   */
  readonly flowArn: string;

  /**
   * The Amazon Resource Name (ARN) of the primary source
   *
   * @attribute
   */
  readonly sourceArn: string;

  /**
   * Whether failover is enabled
   */
  readonly isFailoverEnabled?: boolean;

  /**
   * Add an output to this flow
   */
  addOutput(id: string, outputConfig: OutputConfiguration): IFlowOutput;

  /**
   * Create a CloudWatch metric
   */
  metric(metricName: string, props?: MetricOptions): Metric;

  /**
   * Metric for source bitrate
   * @default - average over 60 seconds
   */
  metricSourceBitrate(props?: MetricOptions): Metric;

  /**
   * Metric for packets not recovered
   * @default - sum over 60 seconds
   */
  metricSourceNotRecoveredPackets(props?: MetricOptions): Metric;

  /**
   * Metric for total packets received
   * @default - sum over 60 seconds
   */
  metricSourceTotalPackets(props?: MetricOptions): Metric;

  /**
   * Metric for failover source selection
   * @default - maximum over 60 seconds
   */
  metricFailoverSourceSelected(props?: MetricOptions): Metric;
}
```

Provide fromMethod capability - allowing imports of the resource:

```ts
/**
 * Creates a Flow construct that represents an external (imported) Flow
 */
public static fromFlowAttributes(scope: Construct, id: string, attrs: FlowAttributes): IFlow {
  class Import extends FlowBase implements IFlow {
    public readonly flowArn = attrs.flowArn;
    public readonly sourceArn = attrs.primarySourceArn;
    public readonly isFailoverEnabled = attrs.isFailoverEnabled ?? false;
  }

  return new Import(scope, id);
}
```

##### Flow Source Types

MediaConnect supports multiple source types for ingesting content into a flow:

###### SRT Listener Source

```ts
new mediaconnect.Flow(stack, 'MyFlow', {
  source: mediaconnect.SourceConfiguration.srtListener({
    flowSourceName: 'live-encoder-source',
    description: 'Live encoder feed',
    port: 5000,
    minLatency: Duration.millis(2000),
    network: mediaconnect.NetworkConfiguration.internet('203.0.113.0/24'),
  }),
});
```

###### VPC Source

```ts
declare const securityGroup: ec2.ISecurityGroup;
declare const subnet: ec2.ISubnet;
declare const role: iam.IRole;

const vpcInterface = mediaconnect.VpcInterface.create({
  vpcInterfaceName: 'my-vpc-interface',
  role: role,
  securityGroups: [securityGroup],
  subnet: subnet,
});

new mediaconnect.Flow(stack, 'MyFlow', {
  source: mediaconnect.SourceConfiguration.rist({
    flowSourceName: 'vpc-source',
    description: 'VPC-based source',
    port: 5000,
    maxLatency: Duration.millis(2000),
    network: mediaconnect.NetworkConfiguration.vpc(vpcInterface),
  }),
  vpcInterfaces: [vpcInterface],
});
```

###### Entitled Source (From Another AWS Account)

```ts
// Import an entitlement from another AWS account
const entitlement = mediaconnect.FlowEntitlement.fromFlowEntitlementAttributes(stack, 'ImportedEntitlement', {
  entitlementArn: 'arn:aws:mediaconnect:us-west-2:111122223333:entitlement:1-11111111111111111111111111111111:MyEntitlement',
});

new mediaconnect.Flow(stack, 'MyFlow', {
  source: mediaconnect.SourceConfiguration.entitlement({
    entitlement: entitlement,
  }),
});
```

#### AWS Elemental MediaConnect VPC Interface

VPC interfaces enable MediaConnect flows to send and receive content through your Amazon VPC, providing secure, private connectivity between MediaConnect and your VPC resources. VPC interfaces are essential for integrating MediaConnect with other AWS services within your VPC, such as connecting flows to bridges or routing content through private networks.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediaconnect/latest/ug/vpc-interfaces.html).

##### Creating VPC Interfaces

VPC interfaces are created using the `VpcInterface.create()` factory method and can be reused across multiple flows and bridges:

```ts
declare const role: iam.IRole;
declare const securityGroup: ec2.ISecurityGroup;
declare const subnet: ec2.ISubnet;

const vpcInterface = mediaconnect.VpcInterface.create({
  vpcInterfaceName: 'my-vpc-interface',
  role: role,
  securityGroups: [securityGroup],
  subnet: subnet,
});
```

##### Network Interface Types

You can specify the network interface type for performance optimization:

```ts
declare const role: iam.IRole;
declare const securityGroup: ec2.ISecurityGroup;
declare const subnet: ec2.ISubnet;

// ENA (Elastic Network Adapter) - Standard performance
const enaInterface = mediaconnect.VpcInterface.create({
  vpcInterfaceName: 'ena-interface',
  role: role,
  securityGroups: [securityGroup],
  subnet: subnet,
  networkInterfaceType: mediaconnect.NetworkInterface.ENA,
});

// EFA (Elastic Fabric Adapter) - Required for CDI workflows
const efaInterface = mediaconnect.VpcInterface.create({
  vpcInterfaceName: 'efa-interface',
  role: role,
  securityGroups: [securityGroup],
  subnet: subnet,
  networkInterfaceType: mediaconnect.NetworkInterface.EFA,
});
```

##### Using Existing Network Interfaces

If you have pre-created network interfaces, you can reference them:

```ts
declare const role: iam.IRole;
declare const securityGroup: ec2.ISecurityGroup;
declare const subnet: ec2.ISubnet;

const vpcInterface = mediaconnect.VpcInterface.create({
  vpcInterfaceName: 'existing-interface',
  role: role,
  securityGroups: [securityGroup],
  subnet: subnet,
  networkInterfaceIds: ['eni-1234567890abcdef0', 'eni-0987654321fedcba0'],
});
```

**Note:** You cannot specify both `networkInterfaceType` and `networkInterfaceIds`. Use `networkInterfaceType` to let MediaConnect create interfaces automatically, or `networkInterfaceIds` to use existing interfaces.

##### Using VPC Interfaces with Flows

VPC interfaces enable flows to use VPC-based sources and outputs:

```ts
declare const role: iam.IRole;
declare const securityGroup: ec2.ISecurityGroup;
declare const subnet: ec2.ISubnet;

const vpcInterface = mediaconnect.VpcInterface.create({
  vpcInterfaceName: 'flow-vpc-interface',
  role: role,
  securityGroups: [securityGroup],
  subnet: subnet,
});

const flow = new mediaconnect.Flow(stack, 'VpcFlow', {
  source: mediaconnect.SourceConfiguration.rist({
    flowSourceName: 'vpc-source',
    port: 5000,
    maxLatency: Duration.millis(2000),
    network: mediaconnect.NetworkConfiguration.vpc(vpcInterface),
  }),
  vpcInterfaces: [vpcInterface],
});
```

##### Using VPC Interfaces with Bridges

VPC interfaces are required for egress bridges to connect cloud-based flows to on-premises equipment:

```ts
declare const gateway: mediaconnect.IGateway;
declare const flow: mediaconnect.IFlow;
declare const vpcInterface: mediaconnect.VpcInterfaceConfig;

new mediaconnect.Bridge(stack, 'EgressBridge', {
  bridgeName: 'my-egress-bridge',
  gateway: gateway,
  config: mediaconnect.BridgeConfiguration.egress({
    maxBitrate: mediaconnect.Bitrate.mbps(10),
    flowSources: [{
      name: 'cloud-source',
      flow: flow,
      vpcInterface: vpcInterface,
    }],
    networkOutputs: [/* ... */],
  }),
});
```

Property Interface for VpcInterface:

```ts
VpcInterfaceProps {
  /**
   * Unique name for the VPC interface
   */
  name: string;

  /**
   * IAM role that MediaConnect assumes to create ENIs in your account
   */
  role: IRole;

  /**
   * Security groups to apply to the ENI
   */
  securityGroups: ISecurityGroup[];

  /**
   * Subnet where the ENI will be created (must be in the same AZ as the flow)
   */
  subnet: ISubnet;

  /**
   * Pre-created network interface IDs
   * @default - MediaConnect creates network interfaces automatically
   */
  networkInterfaceIds?: string[];

  /**
   * Network interface type (ENA or EFA)
   * @default - Default network interface type
   */
  networkInterfaceType?: NetworkInterface;
}
```

Interface example of what VpcInterface implements:

```ts
/**
 * VPC Interface configuration
 */
export interface VpcInterfaceConfig {
  /**
   * Unique name for the VPC interface
   */
  readonly name: string;

  /**
   * IAM role for ENI creation
   */
  readonly role: IRole;

  /**
   * Security groups for the ENI
   */
  readonly securityGroups: ISecurityGroup[];

  /**
   * Subnet for the ENI
   */
  readonly subnet: ISubnet;

  /**
   * Network interface IDs (if using existing interfaces)
   */
  readonly networkInterfaceIds?: string[];

  /**
   * Network interface type
   */
  readonly networkInterfaceType?: NetworkInterface;
}
```

#### AWS Elemental MediaConnect Gateway

MediaConnect gateways enable hybrid cloud workflows by allowing on-premises equipment to connect to AWS cloud resources. Gateways define the network infrastructure that bridges use to transport video between on-premises and cloud environments.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediaconnect/latest/ug/gateways.html).

```ts
const gateway = new mediaconnect.Gateway(stack, 'MyGateway', {
  gatewayName: 'my-gateway',
  egressCidrBlocks: ['10.0.0.0/16'],
  networks: [{
    cidrBlock: '192.168.1.0/24',
    name: 'production-network',
  }],
});
```

##### Adding Networks to Gateways

Networks can be added at creation time or dynamically using the `addNetwork()` method:

```ts
const gateway = new mediaconnect.Gateway(stack, 'MyGateway', {
  gatewayName: 'my-gateway',
  egressCidrBlocks: ['10.0.0.0/16'],
  networks: [{
    cidrBlock: '192.168.1.0/24',
    name: 'production-network',
  }],
});

// Add additional networks dynamically
gateway.addNetwork({
  cidrBlock: '192.168.2.0/24',
  name: 'backup-network',
});

gateway.addNetwork({
  cidrBlock: '192.168.3.0/24',
  name: 'test-network',
});
```

##### Importing Existing Gateways

You can import existing gateways for use in your CDK application:

```ts
const gateway = mediaconnect.Gateway.fromAttributes(stack, 'ImportedGateway', {
  gatewayArn: 'arn:aws:mediaconnect:us-west-2:111122223333:gateway:1-11111111111111111111111111111111:MyGateway',
});

// Use the imported gateway with bridges
new mediaconnect.Bridge(stack, 'MyBridge', {
  bridgeName: 'my-bridge',
  gateway: gateway,
  config: mediaconnect.BridgeConfiguration.egress({
    maxBitrate: mediaconnect.Bitrate.mbps(10),
    flowSources: [/* ... */],
    networkOutputs: [/* ... */],
  }),
});
```

Property Interface for Gateway:

```ts
GatewayProps {
  /**
   * Gateway Name
   */
  gatewayName?: string;

  /**
   * The range of IP addresses that are allowed to contribute content or initiate output requests
   */
  egressCidrBlocks: string[];

  /**
   * The list of networks in the gateway
   */
  networks?: IGatewayNetwork[];
}
```

Interface example of what the Gateway will implement:

```ts
/**
 * Interface for MediaConnect Gateway
 */
export interface IGateway extends IResource, IGatewayRef {
  /**
   * The Amazon Resource Name (ARN) of the gateway
   *
   * @attribute
   */
  readonly gatewayArn: string;

  /**
   * Add a network to this gateway
   */
  addNetwork(network: IGatewayNetwork): IGatewayNetwork;
}
```

#### AWS Elemental MediaConnect Bridge

MediaConnect bridges enable you to interconnect on-premises equipment with cloud-based workflows. Bridges support both ingress (on-premises to cloud) and egress (cloud to on-premises) scenarios. Bridges must be associated with a gateway to function.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediaconnect/latest/ug/bridges.html).

Property Interface for Bridge:

```ts
BridgeProps {
  /**
   * Bridge Name
   */
  bridgeName?: string;

  /**
   * Bridge configuration (ingress or egress)
   */
  config: BridgeConfiguration;

  /**
   * Gateway associated with the bridge
   */
  gateway: IGateway;

  /**
   * Description of the Bridge
   */
  description?: string;

  /**
   * Tagging for your Bridge
   */
  tags?: { [key: string]: string };

  /**
   * Policy to apply when the Bridge is removed from the stack
   *
   * @default RemovalPolicy.RETAIN
   */
  removalPolicy?: RemovalPolicy;
}
```

###### Ingress Bridge (On-premises to Cloud)

```ts
const gateway = new mediaconnect.Gateway(stack, 'MyGateway', {
  gatewayName: 'my-gateway',
  egressCidrBlocks: ['10.0.0.0/16'],
  networks: [{
    cidrBlock: '192.168.1.0/24',
    name: 'production-network',
  }],
});

new mediaconnect.Bridge(stack, 'MyIngressBridge', {
  bridgeName: 'my-ingress-bridge',
  config: mediaconnect.BridgeConfiguration.ingress({
    maxBitrate: mediaconnect.Bitrate.mbps(10),
    maxOutputs: 2,
    networkSources: [{
      name: 'on-prem-source',
      protocol: mediaconnect.BridgeProtocol.RTP,
      networkName: 'production-network',
      multicastIp: '224.1.1.1',
      port: 5000,
    }],
  }),
  gateway: gateway,
});
```

###### Egress Bridge (Cloud to On-premises)

```ts
declare const gateway: mediaconnect.IGateway;
declare const flow: mediaconnect.IFlow;
declare const vpcInterface: mediaconnect.VpcInterfaceConfig;

new mediaconnect.Bridge(stack, 'MyEgressBridge', {
  bridgeName: 'my-egress-bridge',
  config: mediaconnect.BridgeConfiguration.egress({
    maxBitrate: mediaconnect.Bitrate.mbps(10),
    flowSources: [{
      name: 'cloud-source',
      flow: flow,
      vpcInterface: vpcInterface,
    }],
    networkOutputs: [
      mediaconnect.BridgeOutputConfiguration.network({
        name: 'on-prem-output',
        ipAddress: '192.168.1.200',
        port: 5001,
        networkName: 'production-network',
        protocol: mediaconnect.BridgeProtocol.RTP,
        ttl: 64,
      }),
    ],
  }),
  gateway: gateway,
});
```

#### AWS Elemental MediaConnect Router

MediaConnect routers provide high-performance, low-latency video routing capabilities for building complex live video workflows. Router resources include network interfaces, inputs, and outputs.

For further information refer to [our documentation](https://docs.aws.amazon.com/mediaconnect/latest/ug/routers.html).

##### Router Network Interfaces

Network interfaces define the network connectivity for router inputs and outputs:

```ts
// Public network interface
const publicInterface = new mediaconnect.RouterNetworkInterface(stack, 'PublicInterface', {
  routerNetworkInterfaceName: 'public-interface',
  configuration: mediaconnect.RouterNetworkConfiguration.internet({
    cidr: ['10.0.0.0/16'],
  }),
});

// Private network interface
declare const securityGroup: ec2.ISecurityGroup;
declare const subnet: ec2.ISubnet;

const privateInterface = new mediaconnect.RouterNetworkInterface(stack, 'PrivateInterface', {
  routerNetworkInterfaceName: 'private-interface',
  configuration: mediaconnect.RouterNetworkConfiguration.vpc({
    securityGroups: [securityGroup],
    subnet: subnet,
  }),
});
```

##### Router Inputs

Router inputs receive live video streams from various sources:

```ts
// Standard input with RTP protocol
declare const networkInterface: mediaconnect.IRouterNetworkInterface;

const input = new mediaconnect.RouterInput(stack, 'RtpInput', {
  routerInputName: 'rtp-input',
  maximumBitrate: mediaconnect.Bitrate.mbps(10),
  routingScope: mediaconnect.RoutingScope.REGIONAL,
  tier: mediaconnect.RouterInputTier.INPUT_100,
  availabilityZone: 'us-east-1a',
  configuration: mediaconnect.RouterInputConfiguration.standard({
    networkInterface: networkInterface,
    protocol: mediaconnect.RouterInputProtocol.rtp({
      port: 5000,
    }),
  }),
});

// MediaConnect Flow input
declare const flow: mediaconnect.IFlow;
declare const flowOutput: mediaconnect.IFlowOutput;

const flowInput = new mediaconnect.RouterInput(stack, 'FlowInput', {
  routerInputName: 'flow-input',
  maximumBitrate: mediaconnect.Bitrate.mbps(20),
  routingScope: mediaconnect.RoutingScope.REGIONAL,
  tier: mediaconnect.RouterInputTier.INPUT_50,
  availabilityZone: 'us-east-1a',
  configuration: mediaconnect.RouterInputConfiguration.mediaConnectFlow({
    flow: flow,
    flowOutput: flowOutput,
  }),
});

// MediaConnect Flow input without specific connection (requires explicit AZ)
const flowInputNoConnection = new mediaconnect.RouterInput(stack, 'FlowInputNoConnection', {
  routerInputName: 'flow-input-no-connection',
  maximumBitrate: mediaconnect.Bitrate.mbps(20),
  routingScope: mediaconnect.RoutingScope.REGIONAL,
  tier: mediaconnect.RouterInputTier.INPUT_50,
  availabilityZone: 'us-east-1a',
  configuration: mediaconnect.RouterInputConfiguration.mediaConnectFlowWithoutConnection({
    availabilityZone: 'us-east-1a',
  }),
});
```

##### Router Outputs

Router outputs send video streams to various destinations:

```ts
// Standard output with SRT protocol
declare const networkInterface: mediaconnect.IRouterNetworkInterface;

const output = new mediaconnect.RouterOutput(stack, 'SrtOutput', {
  routerOutputName: 'srt-output',
  maximumBitrate: mediaconnect.Bitrate.mbps(10),
  routingScope: mediaconnect.RoutingScope.REGIONAL,
  tier: mediaconnect.RouterOutputTier.OUTPUT_100,
  configuration: mediaconnect.RouterOutputConfiguration.standard({
    protocol: mediaconnect.RouterOutputProtocol.srtListener({
      port: 9001,
      minimumLatency: Duration.millis(200),
    }),
    networkInterface: networkInterface,
  }),
});

// MediaLive output
declare const mediaLiveInput: medialive.CfnInput;

const mediaLiveOutput = new mediaconnect.RouterOutput(stack, 'MediaLiveOutput', {
  routerOutputName: 'medialive-output',
  maximumBitrate: mediaconnect.Bitrate.mbps(15),
  routingScope: mediaconnect.RoutingScope.GLOBAL,
  tier: mediaconnect.RouterOutputTier.OUTPUT_50,
  configuration: mediaconnect.RouterOutputConfiguration.mediaLiveInput({
    mediaLiveInputArn: mediaLiveInput.attrArn,
    mediaLivePipelineId: mediaconnect.MediaLivePipeline.PIPELINE_0,
  }),
});

// MediaLive output without specific connection (requires explicit AZ)
const mediaLiveOutputNoConnection = new mediaconnect.RouterOutput(stack, 'MediaLiveOutputNoConnection', {
  routerOutputName: 'medialive-output-no-connection',
  maximumBitrate: mediaconnect.Bitrate.mbps(15),
  routingScope: mediaconnect.RoutingScope.GLOBAL,
  tier: mediaconnect.RouterOutputTier.OUTPUT_50,
  configuration: mediaconnect.RouterOutputConfiguration.mediaLiveInputWithoutConnection({
    availabilityZone: 'us-east-1a',
  }),
});

// MediaConnect Flow output
declare const flow: mediaconnect.IFlow;

const flowOutput = new mediaconnect.RouterOutput(stack, 'FlowOutput', {
  routerOutputName: 'flow-output',
  maximumBitrate: mediaconnect.Bitrate.mbps(20),
  routingScope: mediaconnect.RoutingScope.REGIONAL,
  tier: mediaconnect.RouterOutputTier.OUTPUT_100,
  configuration: mediaconnect.RouterOutputConfiguration.mediaConnectFlow({
    flow: flow,
  }),
});

// MediaConnect Flow output without specific connection (requires explicit AZ)
const flowOutputNoConnection = new mediaconnect.RouterOutput(stack, 'FlowOutputNoConnection', {
  routerOutputName: 'flow-output-no-connection',
  maximumBitrate: mediaconnect.Bitrate.mbps(20),
  routingScope: mediaconnect.RoutingScope.REGIONAL,
  tier: mediaconnect.RouterOutputTier.OUTPUT_100,
  configuration: mediaconnect.RouterOutputConfiguration.mediaConnectFlowWithoutConnection({
    availabilityZone: 'us-east-1a',
  }),
});
```

##### Adding Outputs to Bridges

For egress bridges, the `addOutput()` method provides a convenient way to add network outputs:

```ts
const bridge = new mediaconnect.Bridge(stack, 'MyEgressBridge', {
  bridgeName: 'my-egress-bridge',
  config: mediaconnect.BridgeConfiguration.egress({
    maxBitrate: mediaconnect.Bitrate.mbps(10),
    flowSources: [{
      name: 'cloud-source',
      flow: flow,
      vpcInterface: vpcInterface,
    }],
    networkOutputs: [], // Start with empty outputs
  }),
  gateway: gateway,
});

// Add network outputs using the helper method
bridge.addOutput('Output1', {
  name: 'on-prem-output-1',
  ipAddress: '192.168.1.200',
  port: 5001,
  networkName: 'production-network',
  protocol: mediaconnect.BridgeProtocol.RTP,
  ttl: 64,
});

bridge.addOutput('Output2', {
  name: 'on-prem-output-2',
  ipAddress: '192.168.1.201',
  port: 5002,
  networkName: 'production-network',
  protocol: mediaconnect.BridgeProtocol.UDP,
});
```

Interface example of what the Bridge will implement:

```ts
/**
 * Interface for MediaConnect Bridge
 */
export interface IBridge extends IResource, IBridgeRef {
  /**
   * The name of the bridge
   *
   * @attribute
   */
  readonly bridgeName: string;

  /**
   * The Amazon Resource Name (ARN) of the bridge
   *
   * @attribute
   */
  readonly bridgeArn: string;

  /**
   * The state of the bridge
   *
   * @attribute
   */
  readonly bridgeState: string;

  /**
   * Add a network output to this bridge (for egress bridges only)
   */
  addOutput(id: string, options: BridgeOutputOptions): BridgeOutput;

  /**
   * Create a CloudWatch metric
   *
   * @param metricName name of the metric
   * @param props metric options
   */
  metric(metricName: string, props?: MetricOptions): Metric;

  /**
   * Returns Metric for Bridge State
   *
   * @default - average over 60 seconds
   */
  metricBridgeState(props?: MetricOptions): Metric;
}
```

Ticking the box below indicates that the public API of this RFC has been signed-off by the API bar raiser (the `status/api-approved` label was applied to the RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Design Decisions

### Flow Size Validation

The construct validates flow size constraints at synthesis time based on the source protocol and NDI configuration:

- `LARGE_4X` is required for CDI and JPEG XS protocols
- `LARGE` is required when NDI is enabled
- `LARGE_4X` cannot be used with transport stream protocols (RTP, SRT, RIST, etc.)

These are mutually exclusive — CDI/JPEG XS and NDI cannot coexist on the same flow because they require different flow sizes.

### Factory Pattern for Configurations

Router inputs and outputs use factory methods to create configurations:

- `RouterInputConfiguration.standard()` - Standard protocol-based input
- `RouterInputConfiguration.mediaConnectFlow()` - Input from a specific MediaConnect flow
- `RouterInputConfiguration.mediaConnectFlowWithoutConnection()` - Prepared for flow connection (requires AZ)
- `RouterOutputConfiguration.standard()` - Standard protocol-based output  
- `RouterOutputConfiguration.mediaLiveInput()` - Output to a specific MediaLive input
- `RouterOutputConfiguration.mediaLiveInputWithoutConnection()` - Prepared for MediaLive connection (requires AZ)
- `RouterOutputConfiguration.mediaConnectFlow()` - Output to a specific MediaConnect flow
- `RouterOutputConfiguration.mediaConnectFlowWithoutConnection()` - Prepared for flow connection (requires AZ)

This pattern provides type safety and makes it clear which parameters are required for each configuration type, preventing invalid combinations at compile time.

### Encryption Patterns

The construct library uses specific encryption classes for different protocols:

- **StaticKeyEncryption**: Used for Zixi protocols and flow entitlements (requires algorithm: AES128, AES192, or AES256)
- **SrtPasswordEncryption**: Used for SRT protocols in flow sources and outputs (no algorithm required)
- **RouterSrtEncryption**: Used for SRT protocols in router outputs (simplified structure)
- **TransitEncryption**: Used for securing connections between flows and routers

**Note on SPEKE**: Flow entitlements do not support SPEKE encryption because flow sources cannot decrypt SPEKE-encrypted content. Only static key encryption is supported for entitlements.

## Public FAQ

### What are we launching today?

We're launching new AWS Elemental MediaConnect L2 Constructs to provide best-practice defaults and developer friendly functions to create your Flow, Bridge, Gateway, Router, and VpcInterface resources.

The primary aim is to help users with guardrails to improve developer experience, as well as speeding up the development process generally.

### Why should I use this feature?

Developers should use this Construct to reduce the amount of boilerplate code, complexity each individual has to navigate, and make it easier to create MediaConnect resources.

This construct continues our work abstracting AWS Elemental Media Services (following MediaPackageV2). Meaning that we can help builders with compatibility, construction and integration in these services.

## Internal FAQ

### Why are we doing this?

Today we help builders with reference architectures using the opensource project [AWS CDK Media Services Reference Architectures](https://github.com/aws-samples/aws-cdk-mediaservices-refarch). This open source project has received much positive feedback.

By building out an L2 CDK construct for AWS Elemental MediaConnect (and other services in the future) will mean we can simplify these architectures.

The existing process requires extensive configuration and lacks standardization, leading to potential errors and a time-consuming setup process. By abstracting and simplifying these resources (L2) we will continue improving our developer experience in AWS CDK.

### Why should we _not_ do this?

Users today are already using the L1 construct, and would likely need to do a workflow change and redeployment to alter this existing way of working.

### What is the technical solution (design) of this feature?

The main thing required for these resources in particular are abstracting fields using factory patterns. This will make the services more accessible and speed up the development process as you don't need to deep-dive the documentation to understand the resource.

### Is this a breaking change?

No - an L2 doesn't exist today.

### What alternative solutions did you consider?

**Source/Output configuration: Factory pattern vs. flat props**

We considered exposing source and output configuration as flat props directly on the Flow construct, similar to how the L1 works. For example:

```ts
new mediaconnect.Flow(stack, 'Flow', {
  sourceName: 'my-source',
  sourceProtocol: 'rtp',
  sourcePort: 5000,
  sourceWhitelistCidr: '203.0.113.0/24',
});
```

- Pros: Simpler API surface, fewer classes to learn
- Cons: No compile-time safety for protocol-specific parameters. Users could supply SRT-specific props (like `minLatency`) alongside an RTP source, which would be silently ignored or cause runtime errors. The L1 already suffers from this problem.

We chose the factory pattern (`SourceConfiguration.rtp()`, `SourceConfiguration.srtListener()`, etc.) because it makes invalid states unrepresentable at compile time. Each factory method only accepts the parameters valid for that protocol, which eliminates an entire class of configuration errors.

**Bridge configuration: Single construct vs. separate ingress/egress classes**

We considered having separate `IngressBridge` and `EgressBridge` classes instead of a single `Bridge` with `BridgeConfiguration.ingress()` / `BridgeConfiguration.egress()`.

- Pros of separate classes: Stronger type separation, impossible to mix ingress and egress concerns
- Cons of separate classes: Doubles the number of bridge-related classes, and CloudFormation models this as a single `AWS::MediaConnect::Bridge` resource with optional `IngressGatewayBridge` / `EgressGatewayBridge` properties

We chose the single `Bridge` construct with a configuration factory because it mirrors the CloudFormation model and keeps the API surface smaller, while still providing type safety through the factory methods.

### What are the drawbacks of this solution?

- **Larger API surface**: The factory pattern for sources, outputs, and bridge configurations introduces more classes and static methods than a flat-props approach. Users need to discover the right factory method for their protocol, which adds a learning curve compared to a simple props object.
- **Migration from L1**: Users with existing L1-based MediaConnect stacks will need to refactor their code to use the L2 API. While this is not a breaking change (the L1 continues to work), the migration effort could be non-trivial for complex workflows with many flows and bridges.

### What is the high-level project plan?

A draft implementation covering all constructs (Flow, Bridge, Gateway, Router, VpcInterface) has been completed. The remaining work is to finalize the RFC review, address any Bar Raiser feedback, and prepare the implementation PR for submission.

### Are there any open issues that need to be addressed later?

N/A
