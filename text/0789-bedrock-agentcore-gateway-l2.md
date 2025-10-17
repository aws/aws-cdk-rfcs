# Amazon Bedrock AgentCore Gateway L2 Construct

* **Original Author(s):**: @krokoko, @aws-rafams, @dineshSajwan
* **Tracking Issue**: #789
* **API Bar Raiser**: @alvazjor

The Amazon Bedrock AgentCore Gateway L2 constructs make it easy to create and manage connections between AI agents
and external services. These constructs provide simple, high-level interfaces for creating Gateways and Gateway Targets,
which let AI agents securely access external tools and APIs.

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
[Amazon Bedrock AgentCore Gateway](https://aws.amazon.com/bedrock/agentcore/) provides secure connections between AI agents and external services.
With Amazon Bedrock AgentCore Gateway, developers can connect agents to multiple tools and APIs through a single MCP URL
while keeping everything secure.

This construct library helps you deploy AgentCore Gateway and Gateway Targets.
It uses CloudFormation L1 resources to create these AgentCore Gateway features.

For more details please refer here [Amazon Bedrock AgentCore Gateway Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html).

## Gateway

The Gateway construct provides a way to create Amazon Bedrock Agent Core Gateways, which serve as integration points between agents and external services.

### Gateway Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `gatewayName` | `string` | Yes | The name of the gateway. Valid characters are a-z, A-Z, 0-9, _ (underscore) and - (hyphen). Maximum 100 characters |
| `description` | `string` | No | Optional description for the gateway. Maximum 200 characters |
| `protocolConfiguration` | `IGatewayProtocol` | No | The protocol configuration for the gateway. Defaults to MCP protocol |
| `authorizerConfiguration` | `IGatewayAuthorizer` | No | The authorizer configuration for the gateway. Defaults to Cognito |
| `exceptionLevel` | `GatewayExceptionLevel` | No | The verbosity of exception messages. Use DEBUG mode to see granular exception messages |
| `kmsKey` | `kms.IKey` | No | The AWS KMS key used to encrypt data associated with the gateway |
| `role` | `iam.IRole` | No | The IAM role that provides permissions for the gateway to access AWS services. A new role will be created if not provided |
| `tags` | `{ [key: string]: string }` | No | Tags for the gateway. A list of key:value pairs of tags to apply to this Gateway resource |

### Basic Gateway Creation

The protocol configuration defaults to MCP and the inbound auth configuration uses Cognito (it is automatically created on your behalf).

```typescript fixture=default
// Create a basic gateway with default MCP protocol and Cognito authorizer
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
});
```

### Protocol configuration

Currently MCP is the only protocol available. To configure it, use the `protocol` property with `McpProtocolConfiguration`:

- Instructions: Guidance for how to use the gateway with your tools
- Semantic search: Smart tool discovery that finds the right tools without typical limits. It improves accuracy by finding relevant tools based on context
- Supported versions: Which MCP protocol versions the gateway can use

```typescript fixture=default
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
  protocolConfiguration: new agentcore.McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: agentcore.McpGatewaySearchType.SEMANTIC,
    supportedVersions: [agentcore.MCPProtocolVersion.MCP_2025_03_26],
  }),
});
```

### Inbound authorization

Before you create your gateway, you must set up inbound authorization. Inbound authorization validates users who attempt to access targets through
your AgentCore gateway. By default, if not provided, the construct will create and configure Cognito as the default identity provider
(inbound Auth setup). AgentCore supports the following types of inbound authorization:

**JSON Web Token (JWT)** – A secure and compact token used for authorization. After creating the JWT, you specify it as the authorization
configuration when you create the gateway. You can create a JWT with any of the identity providers at Provider setup and configuration.

You can configure a custom authorization provider using the `inboundAuthorizer` property with `GatewayAuthorizer.usingCustomJwt()`.
You need to specify an OAuth discovery server and client IDs/audiences when you create the gateway. You can specify the following:

- Discovery Url — String that must match the pattern ^.+/\.well-known/openid-configuration$ for OpenID Connect discovery URLs
- At least one of the below options depending on the chosen identity provider.
- Allowed audiences — List of allowed audiences for JWT tokens
- Allowed clients — List of allowed client identifiers

```typescript fixture=default
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
  authorizerConfiguration: agentcore.GatewayAuthorizer.usingCustomJwt({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
});
```

**IAM** – Authorizes through the credentials of the AWS IAM identity trying to access the gateway.

```typescript fixture=default
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
  authorizerConfiguration: agentcore.GatewayAuthorizer.awsIam,
});

// Grant access to a Lambda function's role
const lambdaRole = new iam.Role(this, "LambdaRole", {
  assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
});

// The Lambda needs permission to invoke the gateway
gateway.grantInvoke(lambdaRole);
```

### Gateway with KMS Encryption

You can provide a KMS key, and configure the authorizer as well as the protocol configuration.

```typescript fixture=default
// Create a KMS key for encryption
const encryptionKey = new kms.Key(this, "GatewayEncryptionKey", {
  enableKeyRotation: true,
  description: "KMS key for gateway encryption",
});

// Create gateway with KMS encryption
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-encrypted-gateway",
  description: "Gateway with KMS encryption",
  protocolConfiguration: new agentcore.McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: agentcore.McpGatewaySearchType.SEMANTIC,
    supportedVersions: [agentcore.MCPProtocolVersion.MCP_2025_03_26],
  }),
  authorizerConfiguration: agentcore.GatewayAuthorizer.usingCustomJwt({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
  kmsKey: encryptionKey,
  exceptionLevel: agentcore.GatewayExceptionLevel.DEBUG,
});
```

### Gateway with Custom Execution Role

```typescript fixture=default
// Create a custom execution role
const executionRole = new iam.Role(this, "GatewayExecutionRole", {
  assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockAgentCoreGatewayExecutionRolePolicy"),
  ],
});

// Create gateway with custom execution role
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
  description: "Gateway with custom execution role",
  protocolConfiguration: new agentcore.McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: agentcore.McpGatewaySearchType.SEMANTIC,
    supportedVersions: [agentcore.MCPProtocolVersion.MCP_2025_03_26],
  }),
  authorizerConfiguration: agentcore.GatewayAuthorizer.usingCustomJwt({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
  role: executionRole,
});
```

### Gateway IAM Permissions

The Gateway construct provides convenient methods for granting IAM permissions:

```typescript fixture=default
// Create a gateway
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
  description: "Gateway for external service integration",
  protocolConfiguration: new agentcore.McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: agentcore.McpGatewaySearchType.SEMANTIC,
    supportedVersions: [agentcore.MCPProtocolVersion.MCP_2025_03_26],
  }),
  authorizerConfiguration: agentcore.GatewayAuthorizer.usingCustomJwt({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
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

After Creating gateways, you can add targets which define the tools that your gateway will host. Gateway supports multiple target
types including Lambda functions and API specifications (either OpenAPI schemas or Smithy models). Gateway allows you to attach multiple
targets to a Gateway and you can change the targets / tools attached to a gateway at any point. Each target can have its own
credential provider attached enabling you to securely access targets whether they need IAM, API Key, or OAuth credentials.

### Gateway Target Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `targetName` | `string` | Yes | The name of the gateway target. Valid characters are a-z, A-Z, 0-9, _ (underscore) and - (hyphen) |
| `description` | `string` | No | Optional description for the gateway target. Maximum 200 characters |
| `gateway` | `IGateway` | Yes | The gateway this target belongs to |
| `targetConfiguration` | `ITargetConfiguration` | Yes | The target configuration (Lambda, OpenAPI, or Smithy). Use `LambdaTargetConfiguration.create()`, `OpenApiTargetConfiguration.create()`, or `SmithyTargetConfiguration.create()` |
| `credentialProviderConfigurations` | `IGatewayCredentialProvider[]` | No | Credential providers for authentication. Defaults to `[GatewayCredentialProvider.iamRole()]`. Use `GatewayCredentialProvider.apiKey()`, `GatewayCredentialProvider.oauth()`, or `GatewayCredentialProvider.iamRole()` |

### Targets types

You can create the following targets types:

**Lambda Target**: Lambda targets allow you to connect your gateway to AWS Lambda functions that implement your tools. This is useful
when you want to execute custom code in response to tool invocations.

- Supports GATEWAY_IAM_ROLE credential provider only
- Ideal for custom serverless function integration
- Need tool schema (tool schema is a blueprint that describes the functions your Lambda provides to AI agents).
  The construct provide 3 ways to upload a tool schema to Lambda target

- **OpenAPI Schema Target** : OpenAPI widely used standard for describing RESTful APIs. Gateway supports OpenAPI 3.0
specifications for defining API targets. It onnects to REST APIs using OpenAPI specifications

- Supports OAUTH and API_KEY credential providers
- Ideal for integrating with external REST services
- Need API schema. The construct provide 3 ways to upload a API schema to OpenAPI target

- **Smithy Model Target** : Smithy is a language for defining services and software development kits (SDKs). Smithy models provide
a more structured approach to defining APIs compared to OpenAPI, and are particularly useful for connecting to AWS services.
AgentCore Gateway supports built-in AWS service models only. It Connects to services using Smithy model definitions

- Supports OAUTH and API_KEY credential providers
- Ideal for AWS service integrations
- Need API schema. The construct provide 3 ways to upload a API schema to Smity target

> Note: For Smithy model targets that access AWS services, your Gateway's execution role needs permissions to access those services.
For example, for a DynamoDB target, your execution role needs permissions to perform DynamoDB operations.
This is not managed by the construct due to the large number of options.

### Tools schema For Lambda target

- From a local asset file

```typescript
toolSchema: agentcore.ToolSchema.fromLocalAsset(
    path.join(__dirname, "schemas", "my-tool-schema.json")
  ),
```

- From an existing S3 file:

```typescript

  toolSchema: agentcore.ToolSchema.fromS3File(
    s3.Bucket.fromBucketName(this, "SchemasBucket", "my-schemas-bucket"),
    "tools/complex-tool-schema.json",
    "123456789012"
  ),
```

```typescript
const toolSchema: agentcore.ToolSchema.fromInline( {
      name: "hello_world",
      description: "A simple hello world tool",
      inputSchema: {
        type: agentcore.SchemaDefinitionType.OBJECT,
        properties: {
          name: {
            type: agentcore.SchemaDefinitionType.STRING,
            description: "The name to greet",
          },
        },
        required: ["name"],
      },
    })

```

### Api schema For OpenAPI and Smithy target

The OpenAPI and Smithy target need API Schema. The Gateway construct provide three ways to upload API schema for your target:

- From a local asset file (requires binding to scope):

```typescript fixture=default
// When using ApiSchema.fromLocalAsset, you must bind the schema to a scope
const schema = agentcore.ApiSchema.fromLocalAsset(path.join(__dirname, "mySchema.yml"));
schema.bind(this);
```

- From an inline schema:

```typescript fixture=default
const inlineSchema = agentcore.ApiSchema.fromInline(`
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

- From an existing S3 file:

```typescript fixture=default
const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
const s3Schema = agentcore.ApiSchema.fromS3File(bucket, "schemas/action-group.yaml");
```

### Outbound auth

Outbound authorization lets Amazon Bedrock AgentCore gateways securely access gateway targets on behalf of users authenticated
and authorized during Inbound Auth.

AgentCore Gateway supports the following types of outbound authorization:

**IAM-based outbound authorization** – The gateway uses its execution role to authenticate with AWS services. This is the default
 and most common approach for Lambda targets and AWS service integrations.

**2-legged OAuth (OAuth 2LO)** – Use OAuth 2.0 two-legged flow (2LO) for targets that require OAuth authentication.
The gateway authenticates on its own behalf, not on behalf of a user.

**API key** – Use the AgentCore service/AWS console to generate an API key to authenticate access to the gateway target.

**Note > You need to set up the outbound identity before you can create a gateway target.

### Basic Gateway Target Creation

You can create targets in two ways: using the static factory methods on `GatewayTarget` or using the convenient `addTarget` methods on the gateway instance.

#### Using addTarget methods (Recommended)

Below are the examples on how you can create Lambda , Smity and OpenAPI target using `addTarget` method.

```typescript fixture=default
// Create a gateway first
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
  protocolConfiguration: new agentcore.McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: agentcore.McpGatewaySearchType.SEMANTIC,
    supportedVersions: [agentcore.MCPProtocolVersion.MCP_2025_03_26],
  }),
  authorizerConfiguration: agentcore.GatewayAuthorizer.usingCustomJwt({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
});

// outbound auth (Use AWS console to create it, Once Identity L2 construct is available you can use it to create identity)
const apiKeyIdentityArn = "your-idp-arn"

// OpenAPI target need apischema
const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
const s3Schema = agentcore.ApiSchema.fromS3File(bucket, "schemas/myschema.yaml");

// Add an OpenAPI target directly to the gateway
const target = gateway.addOpenApiTarget("MyTarget", {
  targetName: "my-api-target",
  description: "Target for external API integration",
  apiSchema: s3Schema,
  credentialProviderConfigurations: [
    agentcore.GatewayCredentialProvider.apiKey({
      providerArn: apiKeyIdentityArn,
      credentialLocation: agentcore.ApiKeyCredentialLocation.header({
        credentialParameterName: "X-API-Key",
      }),
    }),
  ],
});

// Add a Lambda target
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

const lambdaTarget = gateway.addLambdaTarget("MyLambdaTarget", {
  targetName: "my-lambda-target",
  description: "Lambda function target",
  lambdaFunction: lambdaFunction,
  toolSchema: agentcore.ToolSchema.fromInline([
    {
      name: "hello_world",
      description: "A simple hello world tool",
      inputSchema: {
        type: agentcore.SchemaDefinitionType.OBJECT,
        properties: {
          name: {
            type: agentcore.SchemaDefinitionType.STRING,
            description: "The name to greet",
          },
        },
        required: ["name"],
      },
    },
  ]),
});

// Add a Smithy target
const smithySchema = agentcore.ApiSchema.fromS3File(bucket, "schemas/mymodel.json");
const smithyTarget = gateway.addSmithyTarget("MySmithyTarget", {
  targetName: "my-smithy-target",
  description: "Smithy model target",
  smithyModel: smithySchema,
  credentialProviderConfigurations: [
    agentcore.GatewayCredentialProvider.iamRole(),
  ],
});
```

#### Using static factory methods

Create Gateway target using static convienence method.

```typescript fixture=default
// Create a gateway first
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
});

const apiKeyIdentityArn = "your-idp-arn"

const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
const s3Schema = agentcore.ApiSchema.fromS3File(bucket, "schemas/myschema.yaml");

// Create a gateway target with OpenAPI Schema 
const target = agentcore.GatewayTarget.forOpenApi(this, "MyTarget", {
  targetName: "my-api-target",
  description: "Target for external API integration",
  gateway: gateway,  // Note: you need to pass the gateway reference
  apiSchema: s3Schema,
  credentialProviderConfigurations: [
    agentcore.GatewayCredentialProvider.apiKey({
     providerArn: apiKeyIdentityArn,
      credentialLocation: agentcore.ApiKeyCredentialLocation.header({
        credentialParameterName: "X-API-Key",
      }),
    }),
  ],
});

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
const target = agentcore.GatewayTarget.forLambda(this, "MyLambdaTarget", {
  targetName: "my-lambda-target",
  description: "Target for Lambda function integration",
  gateway: gateway,
  lambdaFunction: lambdaFunction,
  toolSchema: agentcore.ToolSchema.fromInline([
    {
      name: "hello_world",
      description: "A simple hello world tool",
      inputSchema: {
        type: agentcore.SchemaDefinitionType.OBJECT,
        description: "Input schema for hello world tool",
        properties: {
          name: {
            type: agentcore.SchemaDefinitionType.STRING,
            description: "The name to greet",
          },
        },
        required: ["name"],
      },
      outputSchema: {
        type: agentcore.SchemaDefinitionType.OBJECT,
        description: "Output schema for hello world tool",
        properties: {
          message: {
            type: agentcore.SchemaDefinitionType.STRING,
            description: "The greeting message",
          },
        },
      },
    },
  ]),
  credentialProviderConfigurations: [agentcore.GatewayCredentialProvider.iamRole()],
});


// Create an OAuth identity
const oauthIdentityArn = "oauth-idp-arn"
const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
// A Smithy model in JSON AST format
const s3Schema = agentcore.ApiSchema.fromS3File(bucket, "schemas/myschema.json");

// Create a gateway target with Smithy Model and OAuth 
const target = agentcore.GatewayTarget.forSmithy(this, "MySmithyTarget", {
  targetName: "my-smithy-target",
  description: "Target for Smithy model integration",
  gateway: gateway,
  smithyModel: s3Schema,
  credentialProviderConfigurations: [
    agentcore.GatewayCredentialProvider.oauth({
      providerArn: oauthIdentityArn,
      scopes: ["read", "write"],
      customParameters: {
        audience: "https://api.example.com",
        response_type: "code",
      },
    }),
  ],
});

```

### Gateway Target IAM Permissions

The Gateway Target construct provides convenient methods for granting IAM permissions:

```typescript fixture=default
// Create a gateway and target
const gateway = new agentcore.Gateway(this, "MyGateway", {
  gatewayName: "my-gateway",
  protocolConfiguration: new agentcore.McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: agentcore.McpGatewaySearchType.SEMANTIC,
    supportedVersions: [agentcore.MCPProtocolVersion.MCP_2025_03_26],
  }),
  authorizerConfiguration: agentcore.GatewayAuthorizer.usingCustomJwt({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
    allowedClients: ["my-client-id"],
  }),
});

const apiKeyIdentityArn = "your-idp-arn"

const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
const s3Schema = agentcore.ApiSchema.fromS3File(bucket, "schemas/myschema.yaml");

const target = agentcore.GatewayTarget.forOpenApi(this, "MyTarget", {
  targetName: "my-target",
  gateway: gateway,
  apiSchema: s3Schema,
  credentialProviderConfigurations: [
    agentcore.GatewayCredentialProvider.apiKey({
     providerArn: apiKeyIdentityArn,
      credentialLocation: agentcore.ApiKeyCredentialLocation.header({
        credentialParameterName: "X-API-Key",
      }),
    }),
  ],
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


// Grants permission to invoke this Gateway
gateway.grantInvoke(grantee: iam.IGrantable);
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

The construct library provides interfaces for Gateway services:

### Gateway Interfaces

- `IGateway` - Represents a Gateway resource
- `IGatewayTarget` - Represents a Gateway Target resource
- `IGatewayProps` - Properties for creating a Gateway
- `IGatewayTargetProps` - Properties for creating a Gateway Target
- `IGatewayProtocol` - Protocol configuration interface
- `IGatewayAuthorizer` - Authorizer configuration interface
- `ITargetConfiguration` - Target configuration interface
- `IGatewayCredentialProvider` - Credential provider configuration interface

## Classes

### Core Classes

- `Gateway` - L2 construct for creating and managing Gateways
- `GatewayTarget` - L2 construct for creating and managing Gateway Targets

### Configuration Classes

- `McpProtocolConfiguration` - Configuration for MCP protocol
- `GatewayAuthorizer` - Factory class for creating authorizer configurations
- `GatewayCredentialProvider` - Factory class for creating credential providers
- `ApiSchema` - Helper class for managing API schemas
- `ToolSchema` - Helper class for managing tool schemas
- `ApiKeyCredentialLocation` - Configuration for API key location

### Target Configuration Classes

- `LambdaTargetConfiguration` - Configuration for Lambda targets
- `OpenApiTargetConfiguration` - Configuration for OpenAPI targets
- `SmithyTargetConfiguration` - Configuration for Smithy model targets

## Enumerations

- `McpGatewaySearchType` - Search type for MCP gateway (SEMANTIC or STANDARD)
- `GatewayExceptionLevel` - Exception verbosity level (DEBUG or STANDARD)
- `SchemaDefinitionType` - Schema definition types for tool schemas
- `MCPProtocolVersion` - Supported MCP protocol versions

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
