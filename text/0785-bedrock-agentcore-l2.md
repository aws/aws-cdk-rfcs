# Amazon Bedrock AgentCore L2 Construct

* **Original Author(s):**: @krokoko , @aws-rafams , @dineshSajwan
* **Tracking Issue**: #785
* **API Bar Raiser**: @{BAR_RAISER_USER}

The Amazon Bedrock AgentCore L2 construct simplifies the deployment and management of AI agents at scale by wrapping the AgentCore L1 constructs.
It provides a high-level, object-oriented approach to creating and managing Amazon Bedrock AgentCore resources.
This enables developers to deploy highly effective agents securely using any framework and model.

A quick comparison between L1 and L2 AgentCore constructs:

1. Quick and easy creation of AgentCore resources:
   - Runtime deployment with containerized agents
   - Identity providers (API Key, OAuth) with secure token vault
   - Memory with built-in strategies (summarization, semantic, user preference)
   - Built-in tools (Browser, Code Interpreter) with enterprise security
   - Gateway for tool discovery and API transformation

2. Simplified infrastructure management:
   - Automatic ECR repository integration for Runtime
   - Secure credential storage in AWS Secrets Manager for Identity
   - Automatic IAM role and policy management

3. Helper methods for better developer experience:
   - `runtime.addEndpoint()` for easy endpoint configuration
   - `memory.addStrategy()` for memory strategy management
   - `gateway.addTarget()` for gateway target configuration
   - `grantRead()`, `grantUse()`, `grantManage()` for IAM permissions

4. Validation and error handling:
   - Compile-time configuration validation
   - User-friendly error messages
   - Automatic dependency management between resources

**CHANGELOG**:
```feat(bedrock-agentcore): Amazon Bedrock AgentCore L2 construct```

**README**:
[Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/) enables you to deploy and operate highly effective agents securely.
It works at scale using any framework and model.
With Amazon Bedrock AgentCore, developers can accelerate AI agents into production.
The service provides the scale, reliability, and security critical to real-world deployment.

This construct library facilitates the deployment of AgentCore Runtime, Identity providers, Memory, and Built-in tools.
The Built-in tools include Browser and Code Interpreter, along with Gateway resources.
It leverages underlying CloudFormation L1 resources and custom resources to provision these AgentCore features.

For more details please refer here [Amazon Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html).

## AgentCore Runtime

Amazon Bedrock AgentCore Runtime is a secure, serverless runtime purpose-built for deploying and scaling dynamic AI agents and tools.
It supports any open-source framework, giving developers complete flexibility in their choice of agent frameworks.

The Runtime L2 construct dramatically simplifies agent deployment for developers.
With just a few lines of code, you can deploy production-ready agents without managing complex infrastructure.
Simply pass your ECR repository or container image, and the construct automatically handles IAM roles, permissions, and configurations.
What traditionally required hundreds of lines of CloudFormation now takes just a simple construct instantiation.

Endpoints provide addressable access points to specific versions of your AgentCore Runtime.
The L2 construct makes endpoint management effortless with a single `addEndpoint()` call.
Built-in validation catches configuration errors at compile time rather than deployment, saving developers hours of debugging.
Each agent runtime in Amazon Bedrock AgentCore is automatically versioned, enabling seamless rollbacks and A/B testing.

### Creating a Runtime with ECR Repository

```typescript
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { bedrock } from 'aws-cdk-lib/aws-bedrock-agentcore';

// Reference an existing ECR repository
const agentEcr = ecr.Repository.fromRepositoryName(this, 'AgentRepo', 'my-agent-repo');

// Create runtime using the ECR image
const runtime = new bedrock.Runtime(this, 'MyAgentRuntime', {
  agentRuntimeName: 'myAgent',
  agentRuntimeArtifact: {
    containerConfiguration: {
      repository: agentEcr,
      tag: 'latest',
    },
  },
});

// Grant ECR pull permissions
agentEcr.grantPull(runtime.role!);

// Add an endpoint for invocation
const endpoint = runtime.addEndpoint('my_endpoint');
```

### Creating a Runtime with Direct Image URI

```typescript
const runtime = new bedrock.Runtime(this, 'MyAgentRuntime', {
  agentRuntimeName: 'myAgent',
  agentRuntimeArtifact: {
    containerConfiguration: {
      imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-agent:v1.0.0',
    },
  },
});
```

## Identity

The Identity L2 constructs dramatically simplify credential management for developers working with Amazon Bedrock AgentCore.
Instead of manually configuring token vaults and managing secrets, developers can create secure identity providers with just a few lines of code.
The constructs automatically handle AWS Secrets Manager integration, token vault creation, and IAM permissions.
What would typically require complex CloudFormation templates is now a simple object instantiation with intuitive properties.

### API Key Identity

```typescript
import { bedrock } from 'aws-cdk-lib/aws-bedrock-agentcore';

// Create a new API key identity
const apiKeyIdentity = new bedrock.ApiKeyIdentity(this, 'MyApiKeyIdentity', {
  name: 'my-api-key-provider',
  apiKey: 'your-api-key-here',
});

// Import an existing API key identity
const importedIdentity = bedrock.ApiKeyIdentity.fromApiKeyIdentityAttributes(
  this,
  'ImportedApiKeyIdentity',
  {
    name: 'existing-api-key-provider',
    credentialProviderArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:token-vault/my-vault/apikeycredentialprovider/existing-provider',
    apiKeySecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:api-key',
  }
);
```

### OAuth Identity

```typescript
import { bedrock } from 'aws-cdk-lib/aws-bedrock-agentcore';

// Create a Google OAuth2 identity
const googleOAuthIdentity = new bedrock.OAuthIdentity(this, 'MyGoogleOAuthIdentity', {
  name: 'my-google-oauth-provider',
  oauthProvider: new bedrock.GoogleOauth2Config({
    clientId: 'your-google-client-id',
    clientSecret: 'your-google-client-secret',
  }),
});

// Create a custom OAuth2 identity
const customOAuthIdentity = new bedrock.OAuthIdentity(this, 'MyCustomOAuthIdentity', {
  name: 'my-custom-oauth-provider',
  oauthProvider: new bedrock.CustomOauth2Config({
    clientId: 'your-custom-client-id',
    clientSecret: 'your-custom-client-secret',
    oauthDiscovery: {
      authorizationServerMetadata: {
        authorizationEndpoint: 'https://your-auth-server.com/oauth/authorize',
        issuer: 'https://your-auth-server.com',
        tokenEndpoint: 'https://your-auth-server.com/oauth/token',
        responseTypes: ['code', 'token'],
      },
    },
  }),
});
```

### Supported OAuth Providers

- **GoogleOauth2Config**: Google OAuth2 provider
- **GithubOauth2Config**: GitHub OAuth2 provider  
- **SlackOauth2Config**: Slack OAuth2 provider
- **SalesforceOauth2Config**: Salesforce OAuth2 provider
- **MicrosoftOauth2Config**: Microsoft OAuth2 provider
- **CustomOauth2Config**: Custom OAuth2 provider with configurable discovery

## Memory

The Memory L2 construct transforms the complex task of implementing agent memory into a simple, declarative configuration.
Developers can enable sophisticated memory capabilities with just a few lines of code, without managing underlying storage or retrieval systems.
The construct automatically handles memory persistence, indexing, and retrieval strategies through an intuitive object-oriented interface.
Built-in strategies like summarization, semantic memory, and user preferences are available as simple enum selections.
What traditionally required custom memory implementations and complex state management now takes just a single construct instantiation.

### Basic Memory Creation

```typescript
import * as cdk from 'aws-cdk-lib';
import { bedrock } from 'aws-cdk-lib/aws-bedrock-agentcore';

// Create a basic memory with default settings
const memory = new bedrock.Memory(this, 'MyMemory', {
  name: 'my_memory',
  description: 'A memory for storing user interactions',
  expirationDays: cdk.Duration.days(90),
});
```

### Memory with Built-in Strategies

```typescript
// Create memory with built-in strategies
const memory = new bedrock.Memory(this, 'MyMemory', {
  name: 'my_memory',
  description: 'Memory with built-in strategies',
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [
    bedrock.MemoryStrategy.builtinSummarization,
    bedrock.MemoryStrategy.builtinSemantic,
    bedrock.MemoryStrategy.builtinUserPreference,
  ],
});
```

### Memory Strategy Types

#### Built-in Strategies

1. **Summarization Strategy** (`MemoryStrategy.BUILTIN_SUMMARIZATION`)
   - Extracts concise summaries to preserve critical context and key insights
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}/sessions/{sessionId}`

2. **Semantic Memory Strategy** (`MemoryStrategy.BUILTIN_SEMANTIC`)
   - Extracts general factual knowledge, concepts and meanings from raw conversations
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}`

3. **User Preference Strategy** (`MemoryStrategy.BUILTIN_USER_PREFERENCE`)
   - Extracts user behavior patterns from raw conversations
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}`

#### Custom Memory Strategies

```typescript
// Create a custom semantic memory strategy
const customSemanticStrategy = bedrock.MemoryStrategy.fromCustomSemanticOverride({
  name: 'custom-semantic-strategy',
  description: 'Custom semantic memory strategy',
  type: bedrock.MemoryStrategyType.SEMANTIC,
  namespaces: ['/custom/strategies/{memoryStrategyId}/actors/{actorId}'],
  customConsolidation: {
    model: bedrock.FoundationModel.fromFoundationModelId(
      this, 'ConsolidationModel', 'anthropic.claude-3-sonnet-20240229-v1:0'
    ),
    customPrompt: 'Custom consolidation prompt for semantic memory',
  },
  customExtraction: {
    model: bedrock.FoundationModel.fromFoundationModelId(
      this, 'ExtractionModel', 'anthropic.claude-3-sonnet-20240229-v1:0'
    ),
    customPrompt: 'Custom extraction prompt for semantic memory',
  },
});

const memory = new bedrock.Memory(this, 'MyMemory', {
  name: 'my-custom-memory',
  description: 'Memory with custom strategy',
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [customSemanticStrategy],
});
```

## Browser Tool

The Browser L2 construct makes web automation accessible to developers with minimal configuration overhead.
Instead of managing browser infrastructure, network configurations, and recording setups manually, developers can deploy a cloud-based browser.
Simple property settings replace complex infrastructure management.
The construct automatically handles browser provisioning, network isolation, and optional recording to S3.
IAM permissions are simplified through helper methods like `grantRead()` and `grantUse()`, eliminating complex policy writing.
What would require extensive browser infrastructure setup is now just a few lines of declarative code.

### Basic Browser Creation

```typescript
import { bedrock } from 'aws-cdk-lib/aws-bedrock-agentcore';

// Create a basic browser with public network access
const browser = new bedrock.Browser(this, 'MyBrowser', {
  name: 'my_browser',
  description: 'A browser for web automation',
  networkConfiguration: {
    networkMode: bedrock.BrowserNetworkMode.PUBLIC,
  },
});
```

### Browser with Recording Configuration

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';

// Create an S3 bucket for recordings
const recordingBucket = new s3.Bucket(this, 'RecordingBucket', {
  bucketName: 'my-browser-recordings',
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

// Create browser with recording enabled
const browser = new bedrock.Browser(this, 'MyBrowser', {
  name: 'my_browser',
  description: 'Browser with recording enabled',
  networkConfiguration: {
    networkMode: bedrock.BrowserNetworkMode.PUBLIC,
  },
  recordingConfig: {
    enabled: true,
    s3Location: {
      bucketName: recordingBucket.bucketName,
      objectKey: 'browser-recordings/',
    },
  },
});
```

### Browser IAM Permissions

```typescript
import * as iam from 'aws-cdk-lib/aws-iam';

const browser = new bedrock.Browser(this, 'MyBrowser', {
  name: 'my_browser',
  description: 'Browser for web automation',
  networkConfiguration: {
    networkMode: bedrock.BrowserNetworkMode.PUBLIC,
  },
});

// Create a role that needs access to the browser
const userRole = new iam.Role(this, 'UserRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});

// Grant read permissions (Get and List actions)
browser.grantRead(userRole);

// Grant use permissions (Start, Update, Stop actions)
browser.grantUse(userRole);
```

## Code Interpreter Tool

The Code Interpreter L2 construct simplifies secure code execution for AI agents through an elegant object-oriented interface.
Developers can deploy isolated Python execution environments with just a constructor call and network mode selection.
The construct automatically manages sandbox isolation, resource limits, and security boundaries without manual configuration.
Network modes are easily toggled between public and sandbox through simple enum values rather than complex networking setup.
What traditionally required careful security configuration and environment isolation now takes just a single construct with clear properties.

### Basic Code Interpreter Creation

```typescript
import { bedrock } from 'aws-cdk-lib/aws-bedrock-agentcore';

// Create a basic code interpreter with public network access
const codeInterpreter = new bedrock.CodeInterpreter(this, 'MyCodeInterpreter', {
  name: 'my_code_interpreter',
  description: 'A code interpreter for Python execution',
  networkConfiguration: {
    networkMode: bedrock.CodeInterpreterNetworkMode.PUBLIC,
  },
});
```

### Code Interpreter with Sandbox Network Mode

```typescript
// Create code interpreter with sandbox network mode (isolated)
const codeInterpreter = new bedrock.CodeInterpreter(this, 'MyCodeInterpreter', {
  name: 'my_sandbox_interpreter',
  description: 'Code interpreter with isolated network access',
  networkConfiguration: {
    networkMode: bedrock.CodeInterpreterNetworkMode.SANDBOX,
  },
});
```

### Network Modes

1. **Public Network Mode** (`CodeInterpreterNetworkMode.PUBLIC`)
   - Allows internet access for package installation and external API calls
   - Suitable for development and testing environments
   - Enables downloading Python packages from PyPI

2. **Sandbox Network Mode** (`CodeInterpreterNetworkMode.SANDBOX`)
   - Isolated network environment with no internet access
   - Suitable for production environments with strict security requirements
   - Only allows access to pre-installed packages and local resources

## Gateway

The Gateway L2 construct revolutionizes how developers expose tools and APIs to their AI agents.
With just a few lines of code, developers can transform existing APIs, Lambda functions, and services into agent-compatible tools.
The construct automatically handles protocol configurations, authentication, and tool discovery through an intuitive object model.
Complex MCP protocol setup, JWT authorization, and KMS encryption are reduced to simple property configurations.
What would typically require extensive API gateway configuration and tool adaptation is now a straightforward construct instantiation.

### Basic Gateway Creation

```typescript
import { bedrock } from 'aws-cdk-lib/aws-bedrock-agentcore';

// Create a basic gateway with default MCP protocol and Cognito authorizer
const gateway = new bedrock.Gateway(this, 'MyGateway', {
  name: 'my-gateway',
});
```

### Gateway with Custom Configuration

```typescript
import * as kms from 'aws-cdk-lib/aws-kms';

// Create a KMS key for encryption
const encryptionKey = new kms.Key(this, 'GatewayEncryptionKey', {
  enableKeyRotation: true,
  description: 'KMS key for gateway encryption',
});

// Create gateway with custom configuration
const gateway = new bedrock.Gateway(this, 'MyGateway', {
  name: 'my-encrypted-gateway',
  description: 'Gateway with KMS encryption',
  protocolConfiguration: new bedrock.McpProtocolConfiguration({
    instructions: 'Use this gateway to connect to external MCP tools',
    searchType: bedrock.McpSearchType.SEMANTIC,
    supportedVersions: ['2024-12-01'],
  }),
  authorizerConfiguration: new bedrock.CustomJwtAuthorizerConfiguration({
    discoveryUrl: 'https://auth.example.com/.well-known/openid-configuration',
    allowedAudience: ['my-app'],
    allowedClients: ['my-client-id'],
  }),
  kmsKey: encryptionKey,
  exceptionLevel: bedrock.GatewayExceptionLevel.DEBUG,
});
```

## Gateway Target

Gateway Targets define endpoints that a gateway can connect to, with support for different target types and credential providers.

### OpenAPI Schema Target

```typescript
const target = new bedrock.GatewayTarget(this, 'MyTarget', {
  name: 'my-api-target',
  description: 'Target for external API integration',
  gatewayIdentifier: gateway.gatewayId,
  targetConfiguration: new bedrock.OpenApiSchemaMcpTargetConfiguration({
    schema: 'https://api.example.com/openapi.json',
    version: '3.0.0',
    additionalConfig: {
      'baseUrl': 'https://api.example.com',
    },
  }),
  credentialProviderConfiguration: new bedrock.ApiKeyCredentialProviderConfiguration({
    providerArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:api-key',
    credentialLocation: 'HEADER',
    credentialParameterName: 'X-API-Key',
  }),
});
```

### Lambda Target with Tool Schema

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';

// Create a Lambda function
const lambdaFunction = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: 'index.handler',
  code: lambda.Code.fromInline(`
    exports.handler = async (event) => {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Hello from Lambda!' })
      };
    };
  `),
});

// Create a gateway target with Lambda
const target = new bedrock.GatewayTarget(this, 'MyLambdaTarget', {
  name: 'my-lambda-target',
  description: 'Target for Lambda function integration',
  gatewayIdentifier: gateway.gatewayId,
  targetConfiguration: new bedrock.LambdaMcpTargetConfiguration({
    lambda: lambdaFunction,
    toolSchema: new bedrock.InlinePayloadToolSchemaConfiguration({
      payload: [
        {
          name: 'hello_world',
          description: 'A simple hello world tool',
          inputSchema: {
            type: bedrock.SchemaDefinitionType.OBJECT,
            description: 'Input schema for hello world tool',
            properties: {
              name: {
                type: bedrock.SchemaDefinitionType.STRING,
                description: 'The name to greet'
              }
            },
            required: ['name']
          },
        }
      ]
    }),
  }),
  credentialProviderConfiguration: new bedrock.GatewayIamRoleCredentialProviderConfiguration({
    role: executionRole,
  }),
});
```

### Target Configuration Types

1. **OpenAPI Schema Target** (`OpenApiSchemaMcpTargetConfiguration`)
   - Connects to REST APIs using OpenAPI specifications
   - Supports OAUTH and API_KEY credential providers

2. **Smithy Model Target** (`SmithyModelMcpTargetConfiguration`)
   - Connects to services using Smithy model definitions
   - Supports OAUTH and API_KEY credential providers

3. **Lambda Target** (`LambdaMcpTargetConfiguration`)
   - Connects to AWS Lambda functions
   - Supports GATEWAY_IAM_ROLE credential provider only

## Invoking AgentCore Runtime

Once you've deployed your agent using the Runtime construct, you can invoke it using the AWS SDK:

### Python Example

```python
import boto3
import json

client = boto3.client('bedrock-agentcore', region_name='us-east-1')

response = client.invoke_agent_runtime(
    agentRuntimeArn="arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/myAgent-abc123",
    qualifier="my_endpoint",
    payload=json.dumps({"prompt": "Your question"})
)

# Process response
for event in response.get("response", []):
    print(event.decode('utf-8'))
```

### JavaScript Example

```javascript
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';

const client = new BedrockAgentCoreClient({ region: 'us-east-1' });

const response = await client.send(new InvokeAgentRuntimeCommand({
    agentRuntimeArn: "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/myAgent-abc123",
    qualifier: "my_endpoint",
    payload: JSON.stringify({ prompt: "Your question" })
}));

// Process response
for await (const event of response.response) {
    console.log(new TextDecoder().decode(event));
}
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

We are excited to announce the launch of our new L2 construct for Amazon Bedrock AgentCore.
This construct library provides high-level abstractions for deploying and managing AI agents at scale.
It delivers enterprise-grade security and reliability. Key features include:

- **AgentCore Runtime**: Serverless runtime for deploying containerized agents using any framework
- **Identity Management**: Secure credential providers with API Key and OAuth support
- **Memory**: Context-aware agents with built-in memory strategies
- **Built-in Tools**: Browser automation and Code Interpreter for enhanced agent capabilities
- **Gateway**: Secure tool discovery and API transformation
- **Framework Agnostic**: Support for any open-source framework and model

### Why should I use this feature?

The Amazon Bedrock AgentCore L2 construct offers several compelling advantages:

1. **Accelerated Development**: Deploy production-ready agents in minutes, not weeks
2. **Framework Flexibility**: Use any open-source framework (LangGraph, CrewAI, Strands Agents) without vendor lock-in
3. **Enterprise Security**: Built-in security features including session isolation, KMS encryption, and secure credential management
4. **Automatic Scaling**: Serverless architecture that scales automatically without infrastructure management
5. **Cost Optimization**: Pay only for what you use with consumption-based pricing
6. **Simplified Operations**: Focus on agent logic while AWS handles infrastructure, security, and scaling

This L2 construct eliminates the complexity of managing infrastructure, implementing security, and handling scale.
Developers can focus on building innovative agent applications.

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
4. **Framework Lock-in**: Existing solutions often force specific framework choices

The L2 construct addresses these challenges by providing:

- Framework-agnostic deployment
- Built-in enterprise security
- Serverless, managed infrastructure
- Simplified operational model

### Why should we _not_ do this?

Potential concerns to consider:

1. **Service Maturity**: AgentCore is in preview and subject to changes
2. **Custom Resource Dependency**: Currently relies on custom resources until CloudFormation support is available
3. **Learning Curve**: Developers need to understand AgentCore concepts and architecture

However, these concerns are mitigated by:

- Clear migration path when CloudFormation support becomes available
- Comprehensive documentation and examples
- Abstraction of complexity through L2 constructs

### What is the technical solution (design) of this feature?

The L2 construct library is built using:

1. **TypeScript with Projen**: Modern tooling for construct development
2. **JSII**: Multi-language support (TypeScript, Python, Java, .NET)
3. **Custom Resources**: Temporary solution using Lambda functions with AgentCore Control Plane APIs
4. **Modular Architecture**: Each AgentCore service as a separate construct

Key design principles:

- **Composability**: Constructs work independently or together
- **Sensible Defaults**: Production-ready configurations out of the box
- **Extensibility**: Support for custom configurations and overrides
- **Type Safety**: Strong typing for better developer experience

## Interfaces

The construct library provides comprehensive interfaces for all AgentCore services:

### Runtime Interfaces

- [RuntimeProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#runtimeprops)
- [RuntimeEndpointProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#runtimeendpointprops)
- [ContainerConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#containerconfiguration)

### Identity Interfaces

- [ApiKeyIdentityProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#apikeyidentityprops)
- [OAuthIdentityProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#oauthidentityprops)
- [OAuthProviderConfig](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#oauthproviderconfig)

### Memory Interfaces

- [MemoryProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memoryprops)
- [MemoryStrategyProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memorystrategyprops)
- [CustomMemoryStrategyProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#custommemorystrategyprops)

### Tool Interfaces

- [BrowserProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#browserprops)
- [CodeInterpreterProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#codeinterpreterprops)
- [NetworkConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#networkconfiguration)

### Gateway Interfaces

- [GatewayProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewayprops)
- [GatewayTargetProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewaytargetprops)
- [ProtocolConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#protocolconfiguration)
- [AuthorizerConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#authorizerconfiguration)

## Classes

### Core Classes

- [Runtime](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#runtime)
- [ApiKeyIdentity](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#apikeyidentity)
- [OAuthIdentity](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#oauthidentity)
- [Memory](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memory)
- [Browser](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#browser)
- [CodeInterpreter](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#codeinterpreter)
- [Gateway](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gateway)
- [GatewayTarget](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewaytarget)

### Configuration Classes

- [McpProtocolConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#mcpprotocolconfiguration)
- [CustomJwtAuthorizerConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#customjwtauthorizerconfiguration)
- [ApiKeyCredentialProviderConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#apikeycredentialproviderconfiguration)
- [OAuthCredentialProviderConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#oauthcredentialproviderconfiguration)

## Enumerations

- [NetworkMode](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#networkmode)
- [BrowserNetworkMode](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#browsernetworkmode)
- [CodeInterpreterNetworkMode](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#codeinterpreternetworkmode)
- [MemoryStrategyType](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memorystrategytype)
- [McpSearchType](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#mcpsearchtype)
- [GatewayExceptionLevel](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#gatewayexceptionlevel)
- [SchemaDefinitionType](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#schemadefinitiontype)

### Is this a breaking change?

No. This is a new construct library for Amazon Bedrock AgentCore, which is a separate service from Amazon Bedrock.
It does not affect existing Bedrock constructs.

### What alternative solutions did you consider?

Using Amazon Bedrock AgentCore L1 constructs for each feature individually was considered.
However, this approach requires extensive code to provision resources and lacks the abstraction benefits of L2 constructs.

### What are the drawbacks of this solution?

1. Relies on Lambda-based custom resources until CloudFormation support is available

2. AgentCore is in preview and APIs may change, Breaking changes possible during preview period.

3. Need more documentation and examples which are critical for adoption.

### What is the high-level project plan?

**Phase 1: RFC**:

- Submit RFC proposal for creating the AgentCore L2 constructs
- Design the initial interface and helper methods
- Monitor the release of L1 constructs

**Phase 2: Development**:

- Create a new bedrock-agentcore-alpha package
- Create Runtime, Memory, Identity, Gateway, Browser and Code Interpreter modules
- Create separate PR for each module for code review
- Hold the release and release the whole package with all the modules
- Create comprehensive unit tests
- Write comprehensive API documentation

**Phase 3: Post-Launch**:

- Publish launch blog and announcement posts
- Regular updates to track AgentCore service changes
- Move to aws-cdk-lib package from alpha package if no open issues are present

### Are there any open issues that need to be addressed later?

1. Waiting for the release of L1 construct for Bedrock AgentCore
2. Replace all custom resources with L1 construct.
