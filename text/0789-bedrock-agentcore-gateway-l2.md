# Amazon Bedrock AgentCore Gateway L2 Construct

* **Original Author(s):**: @krokoko , @aws-rafams , @dineshSajwan
* **Tracking Issue**: #789
* **API Bar Raiser**: @alvazjor,

The Amazon Bedrock AgentCore Gateway L2 constructs simplify the creation and management of integration points between AI agents
and external services by wrapping the AgentCore Gateway L1 constructs.
It provides high-level, object-oriented approaches to creating and managing Gateways and Gateway Targets.
These components enable AI agents to securely access external tools and APIs.

A quick comparison between L1 and L2 Gateway constructs:

1. Quick and easy creation of Gateway resources:
   - Gateway with MCP protocol support
   - Multiple target types (Lambda, OpenAPI, Smithy)
   - Tool discovery with semantic search

2. Simplified infrastructure management:
   - Automatic Cognito setup for inbound auth
   - Automatic IAM role and policy management
   - Credential provider integration

3. Helper methods for better developer experience:
   - `gateway.addTarget()` for easy target configuration
   - Pre-configured authentication options
   - API schema helpers for different sources

4. Validation and error handling:
   - Compile-time configuration validation
   - User-friendly error messages
   - Automatic dependency management

**CHANGELOG**:
```feat(bedrock-agentcore): Amazon Bedrock AgentCore Gateway L2 construct```

**README**:
[Amazon Bedrock AgentCore Gateway](https://aws.amazon.com/bedrock/agentcore/) provides secure integration points between AI agents and external services.
With Amazon Bedrock AgentCore Gateway, developers can connect agents to multiple tools and APIs through a single MCP URL
while maintaining enterprise-grade security.

This construct library facilitates the deployment of AgentCore Gateway and Gateway Targets.
It leverages underlying CloudFormation L1 resources to provision these AgentCore Gateway features.

For more details please refer here [Amazon Bedrock AgentCore Gateway Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html).

## Gateway

The Gateway construct provides a way to create Amazon Bedrock Agent Core Gateways, which serve as integration points between agents and external services.

### Gateway Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | Yes | The name of the gateway |
| `description` | `string` | No | Optional description for the gateway |
| `protocolConfiguration` | `IGatewayProtocolConfiguration` | No | The protocol configuration for the gateway |
| `authorizerConfiguration` | `IGatewayAuthorizerConfiguration` | No | The authorizer configuration for the gateway |
| `exceptionLevel` | `GatewayExceptionLevel` | No | The verbosity of exception messages |
| `kmsKey` | `kms.IKey` | No | The AWS KMS key used to encrypt data associated with the gateway |
| `role` | `iam.IRole` | No | The IAM role that provides permissions for the gateway to access AWS services |

### Basic Gateway Creation

If not provided, the protocol configuration defaults to MCP and the inbound auth configuration uses Cognito (it is automatically created on your behalf).

```typescript
import * as cdk from "aws-cdk-lib";
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";

// Create a basic gateway with default MCP protocol and Cognito authorizer
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
});
```

### Protocol Configuration

Currently MCP is the only protocol available. To configure it, provide a McpProtocolConfiguration object to protocolConfiguration:

- **Instructions**: provides the instructions for using the Model Context Protocol gateway. These instructions provide guidance
on how to interact with the gateway.
- **Semantic search**: enables intelligent tool discovery so that we are not limited by typical list tools limits (typically 100 or so).
Our semantic search capability delivers contextually relevant tool subsets, significantly improving tool selection accuracy through focused, relevant results,
inference performance with reduced token processing and overall orchestration efficiency and response times.
- **Supported versions**: The supported versions of the Model Context Protocol. This field specifies which versions of the protocol the gateway can use.

```typescript
import {
  Gateway,
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway";

const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
  protocolConfiguration: new McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: McpSearchType.SEMANTIC,
    supportedVersions: ["2024-12-01"],
  }),
});
```

### Inbound Authorization

Inbound authorization works with OAuth authorization, where the client application must authenticate with the OAuth authorizer before using the Gateway.
Your client would receive an access token which is used at runtime.

Before creating your Gateway, you need to set up inbound authorization to validate callers attempting to
access targets through your Amazon Bedrock AgentCore Gateway.
By default, if not provided, the construct will create and configure Cognito as the default identity provider (inbound Auth setup).

You can configure a custom authorization provider by configuring the authorizerConfiguration property.
You need to specify an OAuth discovery server and client IDs/audiences when you create the gateway. You can specify the following:

- **Discovery Url** — String that must match the pattern ^.+/\.well-known/openid-configuration$ for OpenID Connect discovery URLs
- At least one of the below options depending on the chosen identity provider:
  - **Allowed audiences** — List of allowed audiences for JWT tokens
  - **Allowed clients** — List of allowed client identifiers

```typescript
import {
  Gateway,
  CustomJwtAuthorizerConfiguration,
} from "aws-cdk/bedrock-agentcore-alpha/gateway";

const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
  authorizerConfiguration: new CustomJwtAuthorizerConfiguration({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
});
```

### Gateway with KMS Encryption

```typescript
import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import {
  Gateway,
  GatewayExceptionLevel,
  McpProtocolConfiguration,
  McpSearchType,
  CustomJwtAuthorizerConfiguration,
} from "aws-cdk/bedrock-agentcore-alpha/gateway";

// Create a KMS key for encryption
const encryptionKey = new kms.Key(this, "GatewayEncryptionKey", {
  enableKeyRotation: true,
  description: "KMS key for gateway encryption",
});

// Create gateway with KMS encryption
const gateway = new Gateway(this, "MyGateway", {
  name: "my-encrypted-gateway",
  description: "Gateway with KMS encryption",
  protocolConfiguration: new McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: McpSearchType.SEMANTIC,
    supportedVersions: ["2024-12-01"],
  }),
  authorizerConfiguration: new CustomJwtAuthorizerConfiguration({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
  kmsKey: encryptionKey,
  exceptionLevel: GatewayExceptionLevel.DEBUG,
});
```

### Gateway with Custom Execution Role

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  Gateway,
  McpProtocolConfiguration,
  McpSearchType,
  CustomJwtAuthorizerConfiguration,
} from "aws-cdk/bedrock-agentcore-alpha/gateway";

// Create a custom execution role
const executionRole = new iam.Role(this, "GatewayExecutionRole", {
  assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockAgentCoreGatewayExecutionRolePolicy"),
  ],
});

// Create gateway with custom execution role
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
  description: "Gateway with custom execution role",
  protocolConfiguration: new McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: McpSearchType.SEMANTIC,
    supportedVersions: ["2024-12-01"],
  }),
  authorizerConfiguration: new CustomJwtAuthorizerConfiguration({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
  role: executionRole,
});
```

### Gateway IAM Permissions

The Gateway construct provides convenient methods for granting IAM permissions:

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";

// Create a gateway
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
  description: "Gateway for external service integration",
});

// Create a role that needs access to the gateway
const userRole = new iam.Role(this, "UserRole", {
  assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
});

// Grant read permissions (Get and List actions)
gateway.grantRead(userRole);

// Grant manage permissions (Create, Update, Delete actions)
gateway.grantManage(userRole);

// Grant specific custom permissions
gateway.grant(userRole, "bedrock-agentcore:GetGateway");
```

## Gateway Target

After creating gateways, you can add targets which define the tools that your gateway will host.
Gateway supports multiple target types including Lambda functions and API specifications (either OpenAPI schemas or Smithy models).
Gateway allows you to attach multiple targets to a Gateway and you can change the targets / tools attached to a gateway at any point.
Each target can have its own credential provider attached enabling you to securely access targets whether they need IAM, API Key, or OAuth credentials.
Note: the authorization grant flow (three-legged OAuth) is not supported as a target credential type.

With this, Gateway becomes a single MCP URL enabling access to all of the relevant tools for an agent across myriad APIs.

### Target Types

You can create the following target types:

- **Lambda**: targets allow you to connect your gateway to AWS Lambda functions that implement your tools.
 This is useful when you want to execute custom code in response to tool invocations.
- **OpenAPI** (formerly known as Swagger): widely used standard for describing RESTful APIs. Gateway supports
OpenAPI 3.0 specifications for defining API targets.
- **Smithy**: language for defining services and SDKs that works well with Gateway. Smithy models provide a more structured approach
to defining APIs compared to OpenAPI, and are particularly useful for connecting to AWS services.
AgentCore Gateway supports built-in AWS service models only. Smithy models are restricted to AWS services and custom
Smithy models for non-AWS services are not supported.

> Note: For Smithy model targets that access AWS services, your Gateway's execution role needs permissions to access those services.
For example, for a DynamoDB target, your execution role needs permissions to perform DynamoDB operations.
This is not managed by the construct due to the large number of options.

### Outbound Auth

Outbound authorization lets Amazon Bedrock AgentCore gateways securely access gateway targets on behalf of users
authenticated and authorized during Inbound Auth.

Similar to AWS resources or Lambda functions, you authenticate by using IAM credentials. With other resources, you can use OAuth 2LO or
API keys. OAuth 2LO is a type of OAuth 2.0 where a client application accesses resources on it's behalf,
instead of on behalf of the user.

First, you register your client application with third-party providers and then create an outbound authorization with the client ID and secret.
Then configure a gateway target with the outbound authorization that you created.

To create an outbound auth, refer to the Identity RFC to create either an API Key identity or OAuth identity.

### API Schema

If you select a target of type OpenAPI or Smithy, there are three ways to provide an API schema for your target:

#### From a local asset file (requires binding to scope)

```typescript
import * as path from "path";
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha/gateway/api-schema";

// When using ApiSchema.fromLocalAsset, you must bind the schema to a scope
const schema = ApiSchema.fromLocalAsset(path.join(__dirname, "mySchema.yml"));
schema.bind(this);
```

#### From an inline schema

```typescript
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha/gateway/api-schema";

const inlineSchema = ApiSchema.fromInline(`
openapi: 3.0.3
info:
  title: Library API
  version: 1.0.0
paths:
  /search:
    get:
      summary: Search for books
      operationId: searchBooks
      parameters:
        - name: query
          in: query
          required: true
          schema:
            type: string
`);
```

#### From an existing S3 file

```typescript
import * as s3 from "aws-cdk-lib/aws-s3";
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha/gateway/api-schema";

const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
const s3Schema = ApiSchema.fromS3File(bucket, "schemas/action-group.yaml");
```

### Basic Gateway Target Creation

```typescript
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import {
  GatewayTarget,
  OpenApiSchemaMcpTargetConfiguration,
  ApiSchema,
  ApiKeyCredentialProviderConfiguration,
} from "aws-cdk/bedrock-agentcore-alpha/gateway";
import { ApiKeyIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/api-key-identity";

// Create a gateway first
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
});

// Create an API Key identity
const apiKeyIdentity = new ApiKeyIdentity(this, "MyApiKeyIdentity", {
  name: "my-api-key-provider",
  apiKey: "your-api-key-here",
});

const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
const s3Schema = ApiSchema.fromS3File(bucket, "schemas/myschema.yaml");

// Create a gateway target with OpenAPI Schema
const target = new GatewayTarget(this, "MyTarget", {
  name: "my-api-target",
  description: "Target for external API integration",
  gateway: gateway,
  targetConfiguration: new OpenApiSchemaMcpTargetConfiguration(s3Schema),
  credentialProviderConfigurations: [
    new ApiKeyCredentialProviderConfiguration({
      provider: apiKeyIdentity,
      credentialLocation: "HEADER",
      credentialParameterName: "X-API-Key",
    }),
  ],
});
```

### Lambda Target with Tool Schema

```typescript
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  GatewayTarget,
  LambdaMcpTargetConfiguration,
  ToolSchema,
  SchemaDefinitionType,
  GatewayIamRoleCredentialProviderConfiguration,
} from "aws-cdk/bedrock-agentcore-alpha/gateway";

// Create a Lambda function
const lambdaFunction = new lambda.Function(this, "MyFunction", {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: "index.handler",
  code: lambda.Code.fromInline(`
    exports.handler = async (event) => {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Hello from Lambda!' })
      };
    };
  `),
});

// Create a gateway target with Lambda and tool schema
const target = new GatewayTarget(this, "MyLambdaTarget", {
  name: "my-lambda-target",
  description: "Target for Lambda function integration",
  gateway: gateway,
  targetConfiguration: new LambdaMcpTargetConfiguration({
    lambda: lambdaFunction,
    toolSchema: ToolSchema.fromInline([
      {
        name: "hello_world",
        description: "A simple hello world tool",
        inputSchema: {
          type: SchemaDefinitionType.OBJECT,
          description: "Input schema for hello world tool",
          properties: {
            name: {
              type: SchemaDefinitionType.STRING,
              description: "The name to greet",
            },
          },
          required: ["name"],
        },
        outputSchema: {
          type: SchemaDefinitionType.OBJECT,
          description: "Output schema for hello world tool",
          properties: {
            message: {
              type: SchemaDefinitionType.STRING,
              description: "The greeting message",
            },
          },
        },
      },
    ]),
  }),
  credentialProviderConfigurations: [
    new GatewayIamRoleCredentialProviderConfiguration({
      role: new iam.Role(this, "GatewayTargetRole", {
        assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonBedrockAgentCoreGatewayTargetExecutionRolePolicy"
          ),
        ],
      }),
    }),
  ],
});
```

### Smithy Model Target with OAuth

```typescript
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import {
  GatewayTarget,
  SmithyModelMcpTargetConfiguration,
  ApiSchema,
  OAuthCredentialProviderConfiguration,
} from "aws-cdk/bedrock-agentcore-alpha/gateway";
import { OAuthIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-identity";
import { GoogleOauth2Config } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-provider";

// Create an OAuth identity
const oauthIdentity = new OAuthIdentity(this, "MyOAuthIdentity", {
  name: "my-oauth-provider",
  oauthProvider: new GoogleOauth2Config({
    clientId: "your-google-client-id",
    clientSecret: "your-google-client-secret",
  }),
});

const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
// A Smithy model in JSON AST format
const s3Schema = ApiSchema.fromS3File(bucket, "schemas/myschema.json");

// Create a gateway target with Smithy Model and OAuth
const target = new GatewayTarget(this, "MySmithyTarget", {
  name: "my-smithy-target",
  description: "Target for Smithy model integration",
  gateway: gateway,
  targetConfiguration: new SmithyModelMcpTargetConfiguration(s3Schema),
  credentialProviderConfigurations: [
    new OAuthCredentialProviderConfiguration({
      provider: oauthIdentity,
      scopes: ["read", "write"],
      customParameters: {
        audience: "https://api.example.com",
        response_type: "code",
      },
    }),
  ],
});
```

### Target Configuration Types

The Gateway Target construct supports three MCP target configuration types:

1. **OpenAPI Schema Target** (`OpenApiSchemaMcpTargetConfiguration`)
   - Connects to REST APIs using OpenAPI specifications
   - Supports OAUTH and API_KEY credential providers
   - Ideal for integrating with external REST services

2. **Smithy Model Target** (`SmithyModelMcpTargetConfiguration`)
   - Connects to services using Smithy model definitions
   - Supports OAUTH and API_KEY credential providers
   - Ideal for AWS service integrations

3. **Lambda Target** (`LambdaMcpTargetConfiguration`)
   - Connects to AWS Lambda functions
   - Supports GATEWAY_IAM_ROLE credential provider only
   - Ideal for custom serverless function integration

### Gateway Target IAM Permissions

The Gateway Target construct provides convenient methods for granting IAM permissions:

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { GatewayTarget } from "aws-cdk/bedrock-agentcore-alpha/gateway";

// Create a gateway target
const target = new GatewayTarget(this, "MyTarget", {
  name: "my-target",
  gateway: gateway,
  // ... target configuration
});

// Create a role that needs access to the gateway target
const userRole = new iam.Role(this, "UserRole", {
  assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
});

// Grant read permissions (Get and List actions)
target.grantRead(userRole);

// Grant manage permissions (Create, Update, Delete actions)
target.grantManage(userRole);

// Grant specific custom permissions
target.grant(userRole, "bedrock-agentcore:GetGatewayTarget");
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

We are excited to announce the launch of our new L2 constructs for Amazon Bedrock AgentCore Gateway.
These construct libraries provide high-level abstractions for creating integration points between AI agents and external services.
Key features include:

- **Gateway Management**: Single MCP URL for accessing multiple tools
- **Multiple Target Types**: Support for Lambda, OpenAPI, and Smithy targets
- **Semantic Search**: Intelligent tool discovery for better performance
- **Flexible Authentication**: Inbound and outbound auth configurations
- **Enterprise Security**: KMS encryption and IAM integration

### Why should I use this feature?

The Amazon Bedrock AgentCore Gateway L2 constructs offer several compelling advantages:

1. **Unified Access**: Single endpoint for all agent tools and APIs
2. **Tool Discovery**: Semantic search for intelligent tool selection
3. **Security First**: Built-in authentication for both inbound and outbound connections
4. **Multiple Integrations**: Connect to Lambda, REST APIs, and AWS services
5. **Simple Configuration**: Pre-configured defaults with flexibility
6. **Cost Effective**: Pay only for what you use

These L2 constructs eliminate the complexity of managing multiple API integrations.
Developers can focus on building agent applications with rich tool capabilities.

## Internal FAQ

### Why are we doing this?

Amazon Bedrock AgentCore Gateway addresses critical needs for AI agents:

1. **Tool Proliferation**: Agents need access to many different tools and APIs
2. **Security Requirements**: Each integration needs proper authentication
3. **Discovery Challenges**: Traditional tool limits affect agent performance
4. **Integration Complexity**: Different APIs require different configurations

The L2 constructs address these challenges by providing:

- Unified gateway for all tools
- Semantic search for tool discovery
- Built-in authentication management
- Simple target configuration

### Why should we _not_ do this?

Potential concerns to consider:

1. **Service Maturity**: AgentCore is in preview and subject to changes
3. **Smithy Limitations**: Only supports AWS service models

However, these concerns are mitigated by:

- Clear migration path when CloudFormation support becomes available
- OpenAPI support for non-AWS services
- Comprehensive security controls

### What is the technical solution (design) of this feature?

The L2 construct library is built using:

1. **TypeScript with Projen**: Modern tooling for construct development
2. **JSII**: Multi-language support (TypeScript, Python, Java, .NET)
4. **Modular Architecture**: Gateway and GatewayTarget as separate constructs

Key design principles:

- **Composability**: Targets can be added independently
- **Sensible Defaults**: Automatic Cognito setup for auth
- **Extensibility**: Support for custom configurations
- **Type Safety**: Strong typing for better developer experience

## Interfaces

The construct library provides comprehensive interfaces for Gateway services:

### Gateway Interfaces

- [GatewayProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewayprops)
- [GatewayTargetProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewaytargetprops)
- [ProtocolConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#protocolconfiguration)
- [AuthorizerConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#authorizerconfiguration)
- [TargetConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#targetconfiguration)
- [CredentialProviderConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#credentialproviderconfiguration)

## Classes

### Core Classes

- [Gateway](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gateway)
- [GatewayTarget](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewaytarget)

### Configuration Classes

- [McpProtocolConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#mcpprotocolconfiguration)
- [CustomJwtAuthorizerConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#customjwtauthorizerconfiguration)
- [ApiKeyCredentialProviderConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#apikeycredentialproviderconfiguration)
- [OAuthCredentialProviderConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#oauthcredentialproviderconfiguration)
- [GatewayIamRoleCredentialProviderConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewayiamrolecredentialproviderconfiguration)

### Target Configuration Classes

- [OpenApiSchemaMcpTargetConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#openapischemamcptargetconfiguration)
- [SmithyModelMcpTargetConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#smithymodelmcptargetconfiguration)
- [LambdaMcpTargetConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#lambdamcptargetconfiguration)

## Enumerations

- [McpSearchType](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#mcpsearchtype)
- [GatewayExceptionLevel](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewayexceptionlevel)
- [SchemaDefinitionType](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#schemadefinitiontype)

### Is this a breaking change?

No. This is a new construct library for Amazon Bedrock AgentCore Gateway.
It does not affect existing constructs.

### What alternative solutions did you consider?

### What are the drawbacks of this solution?

### What is the high-level project plan?

**Phase 1: RFC**:

- Submit RFC proposal for creating the AgentCore Gateway L2 constructs
- Design the initial interface and helper methods
- Monitor the release of L1 constructs

**Phase 2: Development**:

- Create Gateway and GatewayTarget modules
- Implement target configuration types
- Create comprehensive unit tests
- Write comprehensive API documentation

**Phase 3: Post-Launch**:

- Publish launch blog and announcement posts
- Regular updates to track AgentCore service changes
- Add support for additional target types

### Are there any open issues that need to be addressed later?
