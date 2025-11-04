# Amazon Bedrock AgentCore Runtime L2 Construct

* **Original Author(s):**: @krokoko , @aws-rafams , @dineshSajwan
* **Tracking Issue**: #785
* **API Bar Raiser**: @alvazjor,

The Amazon Bedrock AgentCore Runtime L2 construct simplifies the deployment and management of containerized AI agents by wrapping the AgentCore Runtime
L1 constructs. It provides a high-level, object-oriented approach to creating and managing agent runtimes and endpoints.
This enables developers to deploy highly effective agents securely using any framework and model.

A quick comparison between L1 and L2 Runtime constructs:

1. Quick and easy creation of Runtime resources:
   - Runtime deployment with containerized agents
   - Automatic versioning management
   - Endpoint creation and management

2. Simplified infrastructure management:
   - Automatic ECR repository integration
   - Automatic IAM role and policy management
   - Network configuration with sensible defaults

3. Helper methods for better developer experience:
   - `runtime.addEndpoint()` for easy endpoint configuration
   - `runtime.usingCognitoAuth()`, `runtime.usingJWTAuth()`, `runtime.usingOAuth()` for authentication
   - `grantRead()`, `grantUse()`, `grantManage()` for IAM permissions

4. Validation and error handling:
   - Compile-time configuration validation
   - User-friendly error messages
   - Automatic dependency management

**CHANGELOG**:
```feat(bedrock-agentcore): Amazon Bedrock AgentCore Runtime L2 construct```

**README**:
[Amazon Bedrock AgentCore Runtime](https://aws.amazon.com/bedrock/agentcore/) enables you to deploy and operate containerized agents securely at scale
using any framework and model.
With Amazon Bedrock AgentCore Runtime, developers can accelerate AI agents into production with serverless deployment that provides automatic scaling,
enterprise-grade security, and framework flexibility.

This construct library facilitates the deployment of AgentCore Runtime and RuntimeEndpoints.
It leverages underlying CloudFormation L1 resources to provision these AgentCore Runtime features.

For more details please refer here [Amazon Bedrock AgentCore Runtime Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html).

## AgentCore Runtime

The AgentCore Runtime construct enables you to deploy containerized agents on Amazon Bedrock AgentCore.
This L2 construct simplifies runtime creation just pass your ECR repository name
and the construct handles all the configuration with sensible defaults.

### Runtime Versioning

Amazon Bedrock AgentCore automatically manages runtime versioning to ensure safe deployments and rollback capabilities.
When you create an agent runtime, AgentCore automatically creates version 1 (V1). Each subsequent update to the
runtime configuration (such as updating the container image, modifying network settings, or changing protocol configurations)
creates a new immutable version. These versions contain complete, self-contained configurations that can be referenced by endpoints,
allowing you to maintain different versions for different environments or gradually roll out updates.

### Runtime Endpoints

Endpoints provide a stable way to invoke specific versions of your agent runtime, enabling controlled deployments across different environments.
When you create an agent runtime, Amazon Bedrock AgentCore automatically creates a "DEFAULT" endpoint which always points to thelatest version
of runtime. You can create explicit endpoints using the `addEndpoint()` helper method to reference specific versions for staging
or production environments. For example, you might keep a "production" endpoint on a stable version while testing newer versions
through a "staging" endpoint. This separation allows you to test changes thoroughly before promoting them
to production by simply updating the endpoint to point to the newer version.

### AgentCore Runtime Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `runtimeName` | `string` | Yes | The name of the agent runtime. Valid characters are a-z, A-Z, 0-9, _ (underscore). Must start with a letter and can be up to 48 characters long |
| `agentRuntimeArtifact` | `AgentRuntimeArtifact` | Yes | The artifact configuration for the agent runtime containing the container configuration with ECR URI |
| `executionRole` | `iam.IRole` | No | The IAM role that provides permissions for the agent runtime. If not provided, a role will be created automatically |
| `networkConfiguration` | `NetworkConfiguration` | No | Network configuration for the agent runtime. Defaults to `{ networkMode: NetworkMode.PUBLIC }` |
| `description` | `string` | No | Optional description for the agent runtime |
| `protocolConfiguration` | `ProtocolType` | No | Protocol configuration for the agent runtime. Defaults to `ProtocolType.HTTP` |
| `authorizerConfiguration` | `AuthorizerConfigurationRuntime` | No | Authorizer configuration for the agent runtime. Supports IAM, Cognito, JWT, and OAuth authentication modes |
| `environmentVariables` | `{ [key: string]: string }` | No | Environment variables for the agent runtime. Maximum 50 environment variables |
| `tags` | `{ [key: string]: string }` | No | Tags for the agent runtime. A list of key:value pairs of tags to apply to this Runtime resource |

### Runtime Endpoint Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `endpointName` | `string` | Yes | The name of the runtime endpoint. Valid characters are a-z, A-Z, 0-9, _ (underscore). Must start with a letter and can be up to 48 characters long |
| `agentRuntimeId` | `string` | Yes | The Agent Runtime ID for this endpoint |
| `agentRuntimeVersion` | `string` | Yes | The Agent Runtime version for this endpoint. Must be between 1 and 5 characters long.|
| `description` | `string` | No | Optional description for the runtime endpoint |
| `tags` | `{ [key: string]: string }` | No | Tags for the runtime endpoint |

### Creating a Runtime

#### Option 1: Use an existing image in ECR

Reference an image available within ECR.

```typescript
import {
  Runtime,
  NetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha/runtime";

repository = new ecr.Repository(stack, "TestRepository", {
  repositoryName: "test-agent-runtime",
});

const agentRuntimeArtifact = AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0");

// Create runtime using the built image
const runtime = new Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
});
```

#### Option 2: Use a local asset

Reference a local directory containing a Dockerfile.
Images are built from a local Docker context directory (with a Dockerfile), uploaded to Amazon Elastic Container Registry (ECR)
by the CDK toolkit,and can be naturally referenced in your CDK app .

```typescript
import * as path from "path";

const agentRuntimeArtifact = AgentRuntimeArtifact.fromAsset(
  path.join(__dirname, "path to agent dockerfile directory")
);

const runtime = new Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
});
```

#### Managing Endpoints and Versions

Amazon Bedrock AgentCore automatically manages runtime versioning to provide safe deployments and rollback capabilities. You can follow
the steps below to understand how to use versioning with runtime for controlled deployments across different environments.

##### Step 1: Initial Deployment

When you first create an agent runtime, AgentCore automatically creates Version 1 of your runtime. At this point, a DEFAULT endpoint is
automatically created that points to Version 1. This DEFAULT endpoint serves as the main access point for your runtime.

```typescript
repository = new ecr.Repository(stack, "TestRepository", {
  repositoryName: "test-agent-runtime",
});

const runtime = new Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0"),
});
```

##### Step 2: Creating Custom Endpoints

After the initial deployment, you can create additional endpoints for different environments. For example, you might create a "production"
endpoint that explicitly points to Version 1. This allows you to maintain stable access points for specific environments while keeping the
flexibility to test newer versions elsewhere.

```typescript
const prodEndpoint = runtime.addEndpoint("production", {
  version: "1",
  description: "Stable production endpoint - pinned to v1"
});
```

##### Step 3: Runtime Update Deployment

When you update the runtime configuration (such as updating the container image, modifying network settings, or changing protocol
configurations), AgentCore automatically creates a new version (Version 2). Upon this update:

- Version 2 is created automatically with the new configuration
- The DEFAULT endpoint automatically updates to point to Version 2
- Any explicitly pinned endpoints (like the production endpoint) remain on their specified versions

```typescript
const agentRuntimeArtifactNew = AgentRuntimeArtifact.fromEcrRepository(repository, "v2.0.0");

new Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifactNew,
});
```

##### Step 4: Testing with Staging Endpoints

Once Version 2 exists, you can create a staging endpoint that points to the new version. This staging endpoint allows you to test the
new version in a controlled environment before promoting it to production. This separation ensures that production traffic continues
to use the stable version while you validate the new version.

```typescript
const stagingEndpoint = runtime.addEndpoint("staging", {
  version: "2",
  description: "Staging environment for testing new version"
});
```

##### Step 5: Promoting to Production

After thoroughly testing the new version through the staging endpoint, you can update the production endpoint to point to Version 2.
This controlled promotion process ensures that you can validate changes before they affect production traffic.

```typescript
const prodEndpoint = runtime.addEndpoint("production", {
  version: "2",  // New version added here
  description: "Stable production endpoint"
});
```

### Creating Standalone Runtime Endpoints

RuntimeEndpoint can also be created as a standalone resource.

#### Example: Creating an endpoint for an existing runtime

```typescript
const existingRuntimeId = "abc123-runtime-id"; // The ID of an existing runtime

// Create a standalone endpoint
const endpoint = new agentcore.RuntimeEndpoint(this, "MyEndpoint", {
  endpointName: "production",
  agentRuntimeId: existingRuntimeId,
  agentRuntimeVersion: "1", // Specify which version to use
  description: "Production endpoint for existing runtime"
});
```

### Runtime Authentication Configuration

The AgentCore Runtime supports multiple authentication modes to secure access to your agent endpoints. By default,
IAM authentication is used, but you can configure Cognito, JWT, or OAuth authentication based on your security requirements.

#### IAM Authentication (Default)

IAM authentication is the default mode and requires no additional configuration. When creating a runtime,
IAM authentication is automatically enabled, requiring callers to sign their requests with valid AWS credentials.

```typescript
import * as agentcore from 'aws-cdk/bedrock-agentcore-alpha/runtime';

const repository = new ecr.Repository(this, "TestRepository", {
  repositoryName: "test-agent-runtime",
});
const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0");

const runtime = new agentcore.Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
  // authorizerConfiguration is optional - defaults to IAM
});

// Or explicitly set IAM authentication
const runtimeWithExplicitIAM = new agentcore.Runtime(this, "MyAgentRuntimeExplicit", {
  runtimeName: "myAgentExplicit",
  agentRuntimeArtifact: agentRuntimeArtifact,
  authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingIAM(),
});
```

#### Cognito Authentication

To configure AWS Cognito User Pool authentication for your runtime, use the `RuntimeAuthorizerConfiguration.usingCognito()` method during runtime creation.
This method requires:

- **User Pool ID** (required): The Cognito User Pool identifier (e.g., "us-west-2_ABC123")
- **Client ID** (required): The Cognito App Client ID
- **Region** (optional): The AWS region where the User Pool is located (defaults to the stack region)
- **Allowed Audiences** (optional): An array of allowed audiences for token validation

```typescript
import * as agentcore from 'aws-cdk/bedrock-agentcore-alpha/runtime';

const repository = new ecr.Repository(this, "TestRepository", {
  repositoryName: "test-agent-runtime",
});
const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0");

const runtime = new agentcore.Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
  authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingCognito(
    "us-west-2_ABC123",  // User Pool ID
    "client-id-123",      // Client ID
    "us-west-2",          // Optional: AWS region (defaults to stack region)
    ["audience1", "audience2"]  // Optional: allowed audiences
  ),
});
```

#### JWT Authentication

To configure custom JWT authentication with your own OpenID Connect (OIDC) provider, use the `RuntimeAuthorizerConfiguration.usingJWT()` method
during runtime creation.
This method requires:

- **Discovery URL**: The OIDC discovery URL (must end with /.well-known/openid-configuration)
- **Allowed Client IDs**: An array of client IDs that are allowed to access the runtime
- **Allowed Audiences** (optional): An array of allowed audiences for token validation

```typescript
import * as agentcore from 'aws-cdk/bedrock-agentcore-alpha/runtime';

const repository = new ecr.Repository(this, "TestRepository", {
  repositoryName: "test-agent-runtime",
});
const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0");

const runtime = new agentcore.Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
  authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingJWT(
    "https://your-oidc-provider.com/.well-known/openid-configuration",  // Discovery URL
    ["client-id-1", "client-id-2"],  // Allowed client IDs
    ["audience1", "audience2"]  // Optional: allowed audiences
  ),
});
```

#### OAuth Authentication

OAuth 2.0 authentication can be configured during runtime creation using the `RuntimeAuthorizerConfiguration.usingOAuth()` method with:

- **Discovery URL**: The OAuth provider's discovery URL (must end with /.well-known/openid-configuration)
- **Client ID**: The OAuth client identifier
- **Allowed Audiences** (optional): An array of allowed audiences for token validation

```typescript
import * as agentcore from 'aws-cdk/bedrock-agentcore-alpha/runtime';

const repository = new ecr.Repository(this, "TestRepository", {
  repositoryName: "test-agent-runtime",
});
const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0");

const runtime = new agentcore.Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
  authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingOAuth(
    "https://oauth-provider.com/.well-known/openid-configuration",  // Discovery URL
    "oauth-client-id",  // OAuth client ID
    ["audience1", "audience2"]  // Optional: allowed audiences
  ),
});
```

#### Using a Custom IAM Role

Instead of using the auto-created execution role, you can provide your own IAM role with specific permissions:
The auto-created role includes all necessary baseline permissions for ECR access, CloudWatch logging, and X-Ray
tracing. When providing a custom role, ensure these permissions are included.

### Runtime Network Configuration

The AgentCore Runtime supports two network modes for deployment:

#### Public Network Mode (Default)

By default, runtimes are deployed in PUBLIC network mode, which provides internet access suitable for less sensitive or open-use scenarios:

```typescript
const repository = new ecr.Repository(this, "TestRepository", {
  repositoryName: "test-agent-runtime",
});
const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0");

// Explicitly using public network (this is the default)
const runtime = new agentcore.Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
  networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
});
```

#### VPC Network Mode

For enhanced security and network isolation, you can deploy your runtime within a VPC:

```typescript
import * as ec2 from 'aws-cdk-lib/aws-ec2';

const repository = new ecr.Repository(this, "TestRepository", {
  repositoryName: "test-agent-runtime",
});
const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0");

// Create or use an existing VPC
const vpc = new ec2.Vpc(this, 'MyVpc', {
  maxAzs: 2,
});

// Configure runtime with VPC
const runtime = new agentcore.Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
  networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingVpc(this, {
    vpc: vpc,
    vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    // Optionally specify security groups, or one will be created automatically
    // securityGroups: [mySecurityGroup],
    allowAllOutbound: true,  // Default is true
  }),
});
```

#### Managing Security Groups with VPC Configuration

When using VPC mode, the Runtime implements `ec2.IConnectable`, allowing you to manage network access using the `connections` property:

```typescript
import * as ec2 from 'aws-cdk-lib/aws-ec2';

const vpc = new ec2.Vpc(this, 'MyVpc', {
  maxAzs: 2,
});

const repository = new ecr.Repository(this, "TestRepository", {
  repositoryName: "test-agent-runtime",
});
const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0");

// Create runtime with VPC configuration
const runtime = new agentcore.Runtime(this, "MyAgentRuntime", {
  runtimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
  networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingVpc(this, {
    vpc: vpc,
    vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  }),
});

// Now you can manage network access using the connections property
// Allow inbound HTTPS traffic from a specific security group
const webServerSecurityGroup = new ec2.SecurityGroup(this, 'WebServerSG', { vpc });
runtime.connections.allowFrom(webServerSecurityGroup, ec2.Port.tcp(443), 'Allow HTTPS from web servers');

// Allow outbound connections to a database
const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSG', { vpc });
runtime.connections.allowTo(databaseSecurityGroup, ec2.Port.tcp(5432), 'Allow PostgreSQL connection');

// Allow outbound HTTPS to anywhere (for external API calls)
runtime.connections.allowToAnyIpv4(ec2.Port.tcp(443), 'Allow HTTPS outbound');
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

We are excited to announce the launch of our new L2 construct for Amazon Bedrock AgentCore Runtime.
This construct library provides high-level abstractions for deploying and managing containerized AI agents at scale.
It delivers enterprise-grade security and reliability. Key features include:

- **Containerized Agent Deployment**: Deploy agents using any framework in secure container environments
- **Automatic Versioning**: Managed versioning system for safe deployments and rollbacks
- **Runtime Endpoints**: Stable endpoints for controlled deployments across environments
- **Multiple Authentication Modes**: Support for IAM, Cognito, JWT, and OAuth authentication
- **Network Flexibility**: Deploy in public or VPC network modes based on security requirements
- **Framework Agnostic**: Support for any open-source framework (LangGraph, CrewAI, Strands Agents)

### Why should I use this feature?

The Amazon Bedrock AgentCore Runtime L2 construct offers several compelling advantages:

1. **Simplified Container Management**: Automatic ECR integration and container lifecycle management
2. **Version Control**: Built-in versioning with immutable versions for safe rollbacks
3. **Endpoint Management**: Create staging and production endpoints pointing to different versions
4. **Security Options**: Choose between public and VPC deployment with configurable security groups
5. **Authentication Flexibility**: Multiple auth modes to match your security requirements

This L2 construct eliminates the complexity of managing containerized agent deployments, versioning, and endpoint management.
Developers can focus on building agent applications while the construct handles infrastructure concerns.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

Amazon Bedrock AgentCore represents a significant evolution in AI agent deployment, addressing critical enterprise needs:

1. **Market Demand**: Enterprises need production-ready agent deployment solutions that work with their existing frameworks
2. **Security Requirements**: Organizations require enterprise-grade security for AI agents handling sensitive data
3. **Operational Complexity**: Current solutions require significant infrastructure management and custom code

The L2 construct addresses these challenges by providing:

- Simplified operational model
- Built-in enterprise security

### Why should we _not_ do this?

Potential concerns to consider:

1. **Service Maturity**: AgentCore is in preview and subject to changes

However, these concerns are mitigated by:

- Clear migration path when CloudFormation support becomes available
- Comprehensive documentation and examples
- Abstraction of complexity through L2 constructs

### What is the technical solution (design) of this feature?

The L2 construct library is built using:

1. **TypeScript with Projen**: Modern tooling for construct development
2. **JSII**: Multi-language support (TypeScript, Python, Java, .NET)
4. **Modular Architecture**: Each AgentCore service as a separate construct

Key design principles:

- **Composability**: Constructs work independently or together
- **Sensible Defaults**: Production-ready configurations out of the box
- **Extensibility**: Support for custom configurations and overrides
- **Type Safety**: Strong typing for better developer experience

## Interfaces

The construct library provides comprehensive interfaces for Runtime services:

### Runtime Interfaces

- [RuntimeProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#runtimeprops)
- [RuntimeEndpointProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#runtimeendpointprops)
- [AgentRuntimeArtifact](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#agentruntimeartifact)
- [ContainerConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#containerconfiguration)
- [NetworkConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#networkconfiguration)
- [AuthorizerConfigurationRuntime](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#authorizerconfigurationruntime)

## Classes

### Core Classes

- [Runtime](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#runtime)
- [RuntimeEndpoint](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#runtimeendpoint)
- [AgentRuntimeArtifact](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#agentruntimeartifact)
- [RuntimeNetworkConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#runtimenetworkconfiguration)

## Enumerations

- [NetworkMode](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#networkmode)
- [ProtocolType](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#protocoltype)
- [AuthorizerMode](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#authorizermode)

### Is this a breaking change?

No. This is a new construct library for Amazon Bedrock AgentCore, which is a separate service from Amazon Bedrock.
It does not affect existing Bedrock constructs.

### What alternative solutions did you consider?

Using Amazon Bedrock AgentCore L1 constructs for each feature individually was considered.
However, this approach requires extensive code to provision resources and lacks the abstraction benefits of L2 constructs.

### What are the drawbacks of this solution?

1. AgentCore is in preview and APIs may change, Breaking changes possible during preview period.

### What is the high-level project plan?

**Phase 1: RFC**:

- Submit RFC proposal for creating the AgentCore Runtime L2 construct
- Design the initial interface and helper methods for Runtime and RuntimeEndpoint

**Phase 2: Development**:

- Create a new bedrock-agentcore-runtime-alpha package
- Implement Runtime construct with versioning support
- Implement RuntimeEndpoint construct for stable deployments
- Add authentication configuration methods (IAM, Cognito, JWT, OAuth)
- Add network configuration support (Public and VPC modes)
- Create comprehensive unit tests
- Write comprehensive API documentation

**Phase 3: Post-Launch**:

- Publish launch blog and announcement posts
- Regular updates to track AgentCore Runtime service changes  
- Move to aws-cdk-lib package from alpha package if no open issues are present

### Are there any open issues that need to be addressed later?

1. Waiting for the release of L1 construct for Bedrock AgentCore Identity, Memory.
