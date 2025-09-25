# Amazon Bedrock AgentCore L2 Construct

* **Original Author(s):**: @krokoko , @aws-rafams , @dineshSajwan
* **Tracking Issue**: #785
* **API Bar Raiser**: @alvazjor,

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
You can create endpoints using the `addEndpoint()` helper method to reference specific versions for staging
or production environments. For example, you might keep a "production" endpoint on a stable version while testing newer versions
through a "staging" endpoint. This separation allows you to test changes thoroughly before promoting them
to production by simply updating the endpoint to point to the newer version.
The "DEFAULT" endpoint automatically points to the latest version of your agent runtime.

### AgentCore Runtime Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentRuntimeName` | `string` | Yes | The name of the agent runtime. Valid characters are a-z, A-Z, 0-9, _ (underscore). Must start with a letter and can be up to 48 characters long |
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
  agentRuntimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
});

// Add an endpoint for invocation - this creates a stable reference point
// for invoking the runtime, which can be updated to different versions
const endpoint = runtime.addEndpoint("my_endpoint");
```

#### Managing Endpoints and Versions

When you update your runtime configuration, new versions are automatically created. Here's how to manage multiple endpoints pointing to different versions:

```typescript
// Initial deployment - Creates Version 1
const runtime = new Runtime(this, "MyAgentRuntime", {
  agentRuntimeName: "myAgent",
  agentRuntimeArtifact: AgentRuntimeArtifact.fromEcrRepository(repository, "v1.0.0"),
});

// Production endpoint - explicitly pinned to a specific version
const prodEndpoint = runtime.addEndpoint("production", {
  version: "1",  // prod version 
  description: "Stable production endpoint"
});

// Staging endpoint - for testing new versions before production
const stagingEndpoint = runtime.addEndpoint("staging", {
  version: "2",  // new version in staging env
  description: "Staging environment for testing"
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
  agentRuntimeName: "myAgent",
  agentRuntimeArtifact: agentRuntimeArtifact,
});
```

## Identity

The Identity constructs provide a high-level interface for creating and managing credential providers in Amazon Bedrock AgentCore.
These constructs handle the creation, configuration, and lifecycle management of different types of identity providers.

### API Key Credential Provider

The `ApiKeyIdentity` construct enables you to create API key credential providers for Amazon Bedrock AgentCore.
This construct automatically handles the secure storage of API keys in AWS Secrets Manager and provides a clean interface for managing API key-based authentication.

#### Creating an API Key Identity

```typescript
import { ApiKeyIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/api-key-identity";

// Create a new API key identity
const apiKeyIdentity = new ApiKeyIdentity(this, "MyApiKeyIdentity", {
  name: "my-api-key-provider",
  apiKey: "your-api-key-here",
});
```

#### Importing an Existing API Key Identity

```typescript
import { ApiKeyIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/api-key-identity";

// Import an existing API key identity
const importedIdentity = ApiKeyIdentity.fromApiKeyIdentityAttributes(
  this,
  "ImportedApiKeyIdentity",
  {
    name: "existing-api-key-provider",
    credentialProviderArn:
      "arn:aws:bedrock-agentcore:us-east-1:123456789012:token-vault/my-vault/apikeycredentialprovider/existing-provider",
    apiKeySecretArn:
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:bedrock-agentcore-api-key-secret",
  }
);
```

#### Using with Gateway Credential Provider Configuration

```typescript
import { ApiKeyIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/api-key-identity";
import { ApiKeyCredentialProviderConfiguration } from "aws-cdk/bedrock-agentcore-alpha/gateway/credential-provider";


// Create API key identity
const apiKeyIdentity = new ApiKeyIdentity(this, "MyApiKeyIdentity", {
  name: "my-api-key-provider",
  apiKey: "your-api-key-here",
});

// Use with gateway credential provider configuration
const credentialProviderConfig = new ApiKeyCredentialProviderConfiguration({
  provider: apiKeyIdentity,
});
```

#### Using OAuth Identity with Gateway Credential Provider Configuration

```typescript

import { OAuthIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-identity";
import { GoogleOauth2Config } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-provider";
import { OAuthCredentialProviderConfiguration } from "aws-cdk/bedrock-agentcore-alpha/gateway/credential-provider";

// Create OAuth identity
const oauthIdentity = new OAuthIdentity(this, "MyOAuthIdentity", {
  name: "my-oauth-provider",
  oauthProvider: new GoogleOauth2Config({
    clientId: "your-google-client-id",
    clientSecret: "your-google-client-secret",
  }),
});

// Use with gateway credential provider configuration
const oauthCredentialProviderConfig = new OAuthCredentialProviderConfiguration({
  provider: oauthIdentity,
});
```

#### Properties

| Property                | Type                   | Description                                  |
| ----------------------- | ---------------------- | -------------------------------------------- |
| `name`                  | `string`               | The name of the API key credential provider  |
| `apiKey`                | `string`               | The API key value to be stored securely      |
| `credentialProviderArn` | `string`               | The ARN of the created credential provider   |
| `apiKeySecretArn`       | `string`               | The ARN of the secret containing the API key |
| `identityType`          | `IdentityType.API_KEY` | The type of identity (always API_KEY)        |

### OAuth 2 Credential Provider

The `OAuthIdentity` construct enables you to create OAuth2 credential providers for Amazon Bedrock AgentCore.
This construct supports multiple OAuth2 providers including Google, GitHub, Slack, Salesforce, Microsoft, and custom OAuth2 providers.

#### Creating a Standard OAuth Identity

```typescript
import { OAuthIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-identity";
import { GoogleOauth2Config } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-identity";


// Create a Google OAuth2 identity
const googleOAuthIdentity = new OAuthIdentity(this, "MyGoogleOAuthIdentity", {
  name: "my-google-oauth-provider",
  oauthProvider: new GoogleOauth2Config({
    clientId: "your-google-client-id",
    clientSecret: "your-google-client-secret",
  }),
});

// Create a GitHub OAuth2 identity
import { GithubOauth2Config } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-provider";


const githubOAuthIdentity = new OAuthIdentity(this, "MyGithubOAuthIdentity", {
  name: "my-github-oauth-provider",
  oauthProvider: new GithubOauth2Config({
    clientId: "your-github-client-id",
    clientSecret: "your-github-client-secret",
  }),
});
```

#### Creating a Custom OAuth Identity

```typescript
import { OAuthIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-identity";
import { CustomOauth2Config } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-provider";

// Create a custom OAuth2 identity with authorization server metadata
const customOAuthIdentity = new OAuthIdentity(this, "MyCustomOAuthIdentity", {
  name: "my-custom-oauth-provider",
  oauthProvider: new CustomOauth2Config({
    clientId: "your-custom-client-id",
    clientSecret: "your-custom-client-secret",
    oauthDiscovery: {
      authorizationServerMetadata: {
        authorizationEndpoint: "https://your-auth-server.com/oauth/authorize",
        issuer: "https://your-auth-server.com",
        tokenEndpoint: "https://your-auth-server.com/oauth/token",
        responseTypes: ["code", "token"],
      },
    },
  }),
});

// Create a custom OAuth2 identity with discovery URL
const customOAuthWithDiscoveryUrl = new OAuthIdentity(this, "MyCustomOAuthWithDiscovery", {
  name: "my-custom-oauth-discovery-provider",
  oauthProvider: new CustomOauth2Config({
    clientId: "your-custom-client-id",
    clientSecret: "your-custom-client-secret",
    oauthDiscovery: {
      discoveryUrl: "https://your-auth-server.com/.well-known/openid-configuration",
    },
  }),
});
```

#### Importing an Existing OAuth Identity

```typescript
import { OAuthIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-identity";


// Import an existing OAuth identity
const importedOAuthIdentity = OAuthIdentity.fromOAuthIdentityAttributes(
  this,
  "ImportedOAuthIdentity",
  {
    name: "existing-oauth-provider",
    credentialProviderArn:
      "arn:aws:bedrock-agentcore:us-east-1:123456789012:token-vault/my-vault/oauth2credentialprovider/existing-provider",
    clientSecretArn:
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:bedrock-agentcore-oauth-secret",
  }
);
```

#### Available OAuth Provider Types

The construct supports the following OAuth2 provider types:

- **GoogleOauth2Config**: Google OAuth2 provider
- **GithubOauth2Config**: GitHub OAuth2 provider
- **SlackOauth2Config**: Slack OAuth2 provider
- **SalesforceOauth2Config**: Salesforce OAuth2 provider
- **MicrosoftOauth2Config**: Microsoft OAuth2 provider
- **CustomOauth2Config**: Custom OAuth2 provider with configurable discovery

#### Properties

| Property                | Type                  | Description                                                                      |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `name`                  | `string`              | The name of the OAuth2 credential provider                                       |
| `oauthProvider`         | `OAuthProviderConfig` | The OAuth2 provider configuration (GoogleOauth2Config, GithubOauth2Config, etc.) |
| `credentialProviderArn` | `string`              | The ARN of the created credential provider                                       |
| `clientSecretArn`       | `string`              | The ARN of the secret containing the client secret                               |
| `identityType`          | `IdentityType.OAUTH`  | The type of identity (always OAUTH)                                              |

#### Custom OAuth2 Configuration

For custom OAuth2 providers, you can specify either:

**Authorization Server Metadata:**

```typescript
oauthDiscovery: {
  authorizationServerMetadata: {
    authorizationEndpoint: 'https://your-auth-server.com/oauth/authorize',
    issuer: 'https://your-auth-server.com',
    tokenEndpoint: 'https://your-auth-server.com/oauth/token',
    responseTypes: ['code', 'token'], // Optional
  },
}
```

**Discovery URL:**

```typescript
oauthDiscovery: {
  discoveryUrl: 'https://your-auth-server.com/.well-known/openid-configuration',
}
```

## Memory

Memory is a critical component of intelligence. While Large Language Models (LLMs) have impressive capabilities, they lack persistent memory across conversations.
Amazon Bedrock AgentCore Memory addresses this limitation by providing a managed service that enables AI agents to maintain
context over time, remember important facts, and deliver consistent, personalized experiences.

AgentCore Memory operates on two levels:

- **Short-Term Memory**: Immediate conversation context and session-based information that provides continuity within
a single interaction or closely related sessions.
- **Long-Term Memory**: Persistent information extracted and stored across multiple conversations, including facts,
 preferences, and summaries that enable personalized experiences over time.

When you interact with the memory via the `CreateEvent` API, you store interactions in Short-Term Memory (STM) instantly.
These interactions can include everything from user messages, assistant responses, to tool actions.

To write to long-term memory, you need to configure extraction strategies which define how and where to store
information from conversations for future use.
These strategies are asynchronously processed from raw events after every few turns based on the strategy that was selected.
You can't create long term memory records directly, as they are extracted asynchronously by AgentCore Memory.

### Memory Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | No | The name of the memory |
| `expirationDays` | `Duration` | No | Short-term memory expiration in days (between 7 and 365) |
| `description` | `string` | No | Optional description for the memory |
| `kmsKey` | `IKey` | No | Custom KMS key to use for encryption |
| `memoryStrategies` | `MemoryStrategyBase[]` | No | Built-in extraction strategies to use for this memory |
| `executionRole` | `iam.IRole` | No | The IAM role that provides permissions for the memory to access AWS services |

### Basic Memory Creation

Below you can find how to configure a simple short-term memory (STM) with no long-term memory extraction strategies. Note how you set `expirationDays`,
which defines the time the events will be stored in the short-term memory before they expire.

```typescript
import * as cdk from "aws-cdk-lib";
import { Memory } from "aws-cdk/bedrock-agentcore-alpha/memory";

// Create a basic memory with default settings, no LTM strategies
const memory = new Memory(this, "MyMemory", {
  name: "my_memory",
  description: "A memory for storing user interactions for a period of 90 days",
  expirationDays: cdk.Duration.days(90),
});
```

Basic Memory with Custom KMS Encryption

```typescript
import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import { Memory } from "aws-cdk/bedrock-agentcore-alpha/memory";


// Create a custom KMS key for encryption
const encryptionKey = new kms.Key(this, "MemoryEncryptionKey", {
  enableKeyRotation: true,
  description: "KMS key for memory encryption",
});

// Create memory with custom encryption
const memory = new Memory(this, "MyMemory", {
  name: "my_encrypted_memory",
  description: "Memory with custom KMS encryption",
  expirationDays: cdk.Duration.days(90),
  kmsKey: encryptionKey,
});
```

### LTM Memory Extraction Stategies

If you need long-term memory for context recall across sessions, you can setup memory extraction strategies to extract
the relevant memory from the raw events.

Amazon Bedrock AgentCore Memory has different memory strategies for extracting and organizing information:

- **Summarization**: to summarize interactions to preserve critical context and key insights.
- **Semantic Memory**: to extract general factual knowledge, concepts and meanings from raw conversations using vector embeddings.
 This enables similarity-based retrieval of relevant facts and context.
- **User Preferences**: to extract user behavior patterns from raw conversations.

You can use built-in extraction strategies for quick setup, or create custom extraction strategies with specific models and prompt templates.

### Memory with Built-in Strategies

The library provides three built-in LTM strategies:

1. **Summarization Strategy** (`MemoryStrategy.BUILT_IN_SUMMARIZATION`)

   - Extracts concise summaries to preserve critical context and key insights
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}/sessions/{sessionId}`

2. **Semantic Memory Strategy** (`MemoryStrategy.BUILT_IN_SEMANTIC`)

   - Extracts general factual knowledge, concepts and meanings from raw conversations
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}`

3. **User Preference Strategy** (`MemoryStrategy.BUILT_IN_USER_PREFERENCE`)
   - Extracts user behavior patterns from raw conversations
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}`

```typescript
import * as cdk from "aws-cdk-lib";
import {
  Memory,
  MemoryStrategy,
} from "aws-cdk/bedrock-agentcore-alpha/memory";

// Create memory with built-in strategies
const memory = new Memory(this, "MyMemory", {
  name: "my_memory",
  description: "Memory with built-in strategies",
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [
    MemoryStrategy.BUILT_IN_SUMMARIZATION,
    MemoryStrategy.BUILT_IN_SEMANTIC,
    MemoryStrategy.BUILT_IN_USER_PREFERENCE,
  ],
});
```

### Memory with Built-in Strategies - Custom Namespace

You can customise the namespace, i.e. where the memories are stored by using the following methods:

1. **Summarization Strategy** (`MemoryStrategy.fromBuiltInUserPreference(props)`)
1. **Semantic Memory Strategy** (`MemoryStrategy.fromBuiltInSemantic(props)`)
1. **User Preference Strategy** (`MemoryStrategy.fromBuiltInSummarization(props)`)

```typescript
import * as cdk from "aws-cdk-lib";
import {
  Memory,
  MemoryStrategy,
} from "aws-cdk/bedrock-agentcore-alpha/memory";

// Create memory with built-in strategies
const memory = new Memory(this, "MyMemory", {
  name: "my_memory",
  description: "Memory with built-in strategies",
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [
    MemoryStrategy.fromBuiltInUserPreference({
        name: "CustomerPreferences"
        namespaces: ["support/customer/{actorId}/preferences"]
    }),
    MemoryStrategy.fromBuiltInSemantic({
        name: "CustomerSupportSemantic"
        namespaces: ["support/customer/{actorId}/semantic"]
    }),
  ],
});
```

### Custom Strategies

You can also create custom memory strategies using your specified models and prompts.
According to the strategy that you will be customizing, you will have to specify extraction and/or consolidation FMs
and prompt templates to append to the system prompt of the memory strategy. You can do so by using:

1. **Summarization Strategy** (`MemoryStrategy.fromCustomSummaryOverride(props)`)
1. **Semantic Memory Strategy** (`MemoryStrategy.fromCustomSemanticOverride(props)`)
1. **User Preference Strategy** (`MemoryStrategy.fromCustomUserPreferenceOverride(props)`)

Since a custom strategy requires you to invoke certain FMs, you need a role with appropriate permissions. For that, you can:

- Let the L2 construct create a minimum permission role for you when use L2 Bedrock Foundation Models.
- Use a custom role with the overly permissive `AmazonBedrockAgentCoreMemoryBedrockModelInferenceExecutionRolePolicy` managed policy.
- Use a custom role with your own custom policies.

#### Memory with Custom Execution Role

Keep in mind that memories that **do not** use custom strategies do not require a service role. So even if you provide it,
it will be ignored as it will never be used.

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Memory } from "aws-cdk/bedrock-agentcore-alpha/memory";

// Create a custom execution role
const executionRole = new iam.Role(this, "MemoryExecutionRole", {
  assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName(
      "AmazonBedrockAgentCoreMemoryBedrockModelInferenceExecutionRolePolicy"
    ),
  ],
});

// Create memory with custom execution role
const memory = new Memory(this, "MyMemory", {
  name: "my_memory",
  description: "Memory with custom execution role",
  expirationDays: cdk.Duration.days(90),
  executionRole: executionRole,
});
```

```typescript
import * as cdk from "aws-cdk-lib";
import * as bedrock from "@aws-cdk/aws-bedrock-alpha";
import {
  Memory,
  MemoryStrategy,
  MemoryStrategyType,
} from "aws-cdk/bedrock-agentcore-alpha/memory";

// Create a custom semantic memory strategy
const customSemanticStrategy = MemoryStrategy.fromCustomSemanticOverride({
  name: "custom-semantic-strategy",
  description: "Custom semantic memory strategy",
  namespaces: ["/custom/strategies/{memoryStrategyId}/actors/{actorId}"],
  customConsolidation: {
    model: "model_arn",
    customPrompt: "Custom consolidation prompt for semantic memory",
  },
  customExtraction: {
    model: "model_arn",
    customPrompt: "Custom extraction prompt for semantic memory",
  },
});

// Create memory with custom strategy
const memory = new Memory(this, "MyMemory", {
  name: "my-custom-memory",
  description: "Memory with custom strategy",
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [customSemanticStrategy],
});
```

### Memory Strategy Methods

You can add new memory strategies to the memory construct using the `addMemoryStrategy()` method, for instance:

```typescript
// Create memory without initial strategies
memory = new Memory(stack, "test-memory", {
  name: "test_memory_add_strategy",
  description: "A test memory for testing addMemoryStrategy method",
  expirationDays: Duration.days(90),
});

// Add strategies after instantiation
memory.addMemoryStrategy(MemoryStrategy.BUILT_IN_SUMMARIZATION);
memory.addMemoryStrategy(MemoryStrategy.BUILT_IN_SEMANTIC);
```

## Browser Tool

### Browser Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | Yes | The name of the browser |
| `description` | `string` | No | Optional description for the browser |
| `networkConfiguration` | `BrowserNetworkConfiguration` | Yes | Network configuration for browser |
| `recordingConfig` | `RecordingConfig` | No | Recording configuration for browser |
| `executionRole` | `iam.IRole` | No | The IAM role that provides permissions for the browser to access AWS services |

### Basic Browser Creation

```typescript
import * as cdk from "aws-cdk-lib";
import {
  Browser,
  BrowserNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha/tools/browser";

// Create a basic browser with public network access
const browser = new Browser(this, "MyBrowser", {
  name: "my_browser",
  description: "A browser for web automation",
  networkConfiguration: {
    networkMode: BrowserNetworkMode.PUBLIC,
  },
});
```

### Browser with Recording Configuration

```typescript
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import {
  Browser,
  BrowserNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha/tools/browser";

// Create an S3 bucket for recordings
const recordingBucket = new s3.Bucket(this, "RecordingBucket", {
  bucketName: "my-browser-recordings",
  removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes
});

// Create browser with recording enabled
const browser = new Browser(this, "MyBrowser", {
  name: "my_browser",
  description: "Browser with recording enabled",
  networkConfiguration: {
    networkMode: BrowserNetworkMode.PUBLIC,
  },
  recordingConfig: {
    enabled: true,
    s3Location: {
      bucketName: recordingBucket.bucketName,
      objectKey: "browser-recordings/",
    },
  },
});
```

### Browser with Custom Execution Role

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  Browser,
  BrowserNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha/tools/browser";

// Create a custom execution role
const executionRole = new iam.Role(this, "BrowserExecutionRole", {
  assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockAgentCoreBrowserExecutionRolePolicy"),
  ],
});

// Create browser with custom execution role
const browser = new Browser(this, "MyBrowser", {
  name: "my_browser",
  description: "Browser with custom execution role",
  networkConfiguration: {
    networkMode: BrowserNetworkMode.PUBLIC,
  },
  executionRole: executionRole,
});
```

### Browser with S3 Recording and Permissions

```typescript
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import {
  Browser,
  BrowserNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha/tools/browser";

// Create an S3 bucket for recordings
const recordingBucket = new s3.Bucket(this, "RecordingBucket", {
  bucketName: "my-browser-recordings",
  removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes
});

// Create browser with recording enabled
const browser = new Browser(this, "MyBrowser", {
  name: "my_browser",
  description: "Browser with recording enabled",
  networkConfiguration: {
    networkMode: BrowserNetworkMode.PUBLIC,
  },
  recordingConfig: {
    enabled: true,
    s3Location: {
      bucketName: recordingBucket.bucketName,
      objectKey: "browser-recordings/",
    },
  },
});

// The browser construct automatically grants S3 permissions to the execution role
// when recording is enabled, so no additional IAM configuration is needed
```

### Browser IAM Permissions

The Browser construct provides convenient methods for granting IAM permissions:

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  Browser,
  BrowserNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha/tools/browser";

// Create a browser
const browser = new Browser(this, "MyBrowser", {
  name: "my_browser",
  description: "Browser for web automation",
  networkConfiguration: {
    networkMode: BrowserNetworkMode.PUBLIC,
  },
});

// Create a role that needs access to the browser
const userRole = new iam.Role(this, "UserRole", {
  assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
});

// Grant read permissions (Get and List actions)
browser.grantRead(userRole);

// Grant use permissions (Start, Update, Stop actions)
browser.grantUse(userRole);

// Grant specific custom permissions
browser.grant(userRole, "bedrock-agentcore:GetBrowserSession");
```

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

### Protocol configuration

Currently MCP is the only protocol available. To configure it, provide a McpProtocolConfiguration object to protocolConfiguration:

- Instructions: provides the instructions for using the Model Context Protocol gateway. These instructions provide guidance on
how to interact with the gateway.
- Semantic search: enables intelligent tool discovery so that we are not limited by typical list tools limits (typically 100 or so).
Our semantic search capability delivers contextually relevant tool subsets, significantly improving tool selection accuracy through focused, relevant results,
inference performance with reduced token processing and overall orchestration efficiency and response times.
- Supported versions: The supported versions of the Model Context Protocol. This field specifies which versions of the protocol the gateway can use.

```typescript
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
  protocolConfiguration: new McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: McpSearchType.SEMANTIC,
    supportedVersions: ["2024-12-01"],
  }),
});
```

### Inbound authorization

Inbound authorization works with OAuth authorization, where the client application must authenticate with the OAuth authorizer before using the Gateway.
Your client would receive an access token which is used at runtime.

Before creating your Gateway, you need to set up inbound authorization to validate callers attempting to
access targets through your Amazon Bedrock AgentCore Gateway.
By default, if not provided, the construct will create and configure Cognito as the default identity provider (inbound Auth setup).

You can configure a custom authorization provider by configuring the authorizerConfiguration property.
You need to specify an OAuth discovery server and client IDs/audiences when you create the gateway. You can specify the following:

- Discovery Url — String that must match the pattern ^.+/\.well-known/openid-configuration$ for OpenID Connect discovery URLs
- At least one of the below options depending on the chosen identity provider.
- Allowed audiences — List of allowed audiences for JWT tokens
- Allowed clients — List of allowed client identifiers

```typescript
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

You can provide a KMS key, and configure the authorizer as well as the protocol configuration.

```typescript
import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import {
  Gateway,
  GatewayExceptionLevel,
} from "aws-cdk/bedrock-agentcore-alpha/gateway";
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";

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
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";

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
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";

// Create a gateway
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
  description: "Gateway for external service integration",
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

After Creating gateways, you can add targets which define the tools that your gateway will host.
Gateway supports multiple target types including Lambda functions and API specifications (either OpenAPI schemas or Smithy models).
Gateway allows you to attach multiple targets to a Gateway and you can change the targets / tools attached to a gateway at any point.
Each target can have its own credential provider attached enabling you to securely access targets whether they need IAM, API Key, or OAuth credentials.
Note: the authorization grant flow (three-legged OAuth) is not supported as a target credential type.

With this, Gateway becomes a single MCP URL enabling access to all of the relevant tools for an agent across myriad APIs.
Let’s dive deeper into how to define each of the target types.

### Targets types

You can create the following targets types:

- Lambda: targets allow you to connect your gateway to AWS Lambda functions that implement your tools.
 This is useful when you want to execute custom code in response to tool invocations.
- OpenAPI (formerly known as Swagger): widely used standard for describing RESTful APIs. Gateway supports OpenAPI 3.0 specifications for defining API targets.
- Smithy: language for defining services and SDKs that works well with Gateway. Smithy models provide a more structured approach
to defining APIs compared to OpenAPI, and are particularly useful for connecting to AWS services.
AgentCore Gateway supports built-in AWS service models only. Smithy models are restricted to AWS services and custom
Smithy models for non-AWS services are not supported.

> Note: For Smithy model targets that access AWS services, your Gateway's execution role needs permissions to access those services.
For example, for a DynamoDB target, your execution role needs permissions to perform DynamoDB operations.
This is not managed by the construct due to the large number of options.

### Outbound auth

Outbound authorization lets Amazon Bedrock AgentCore gateways securely access gateway targets on behalf of users
authenticated and authorized during Inbound Auth.

Similar to AWS resources or Lambda functions, you authenticate by using IAM credentials. With other resources, you can use OAuth 2LO or
API keys. OAuth 2LO is a type of OAuth 2.0 where a client application accesses resources on it's behalf,
instead of on behalf of the user. For more information, see OAuth 2LO.

First, you register your client application with third-party providers and then create an outbound authorization with the client ID and secret.
Then configure a gateway target with the outbound authorization that you created.

To create an outbound auth, refer to the Identity section to create either an API Key identity or OAuth identity.

### Api schema

If you select a target of type OpenAPI or Smithy, there are three ways to provide an API schema for your target:

- From a local asset file (requires binding to scope):

```typescript
import * as path from "path";
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha//gateway/api-schema";

// When using ApiSchema.fromLocalAsset, you must bind the schema to a scope
const schema = ApiSchema.fromLocalAsset(path.join(__dirname, "mySchema.yml"));
schema.bind(this);
```

- From an inline schema:

```typescript
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha//gateway/api-schema";

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

- From an existing S3 file:

```typescript
import * as s3 from "aws-cdk-lib/aws-s3";
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha//gateway/api-schema";

const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
const s3Schema = ApiSchema.fromS3File(bucket, "schemas/action-group.yaml");
```

### Basic Gateway Target Creation

```typescript
import * as cdk from "aws-cdk-lib";
import { GatewayTarget } from "aws-cdk/bedrock-agentcore-alpha//gateway/target";
import { OpenApiSchemaMcpTargetConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/target-configuration";
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha//gateway/api-schema";
import { ApiKeyCredentialProviderConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/credential-provider";
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";
import { ApiKeyIdentity } from "aws-cdk/bedrock-agentcore-alpha//identity/api-key-identity";
import * as s3 from "aws-cdk-lib/aws-s3";

// Create a gateway first
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
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
import { GatewayTarget } from "aws-cdk/bedrock-agentcore-alpha//gateway/target";
import { LambdaMcpTargetConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/target-configuration";
import {
  ToolSchema,
  SchemaDefinitionType,
} from "aws-cdk/bedrock-agentcore-alpha//gateway/tool-schema";
import { GatewayIamRoleCredentialProviderConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/credential-provider";
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";

// Create a gateway first
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
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
import { GatewayTarget } from "aws-cdk/bedrock-agentcore-alpha//gateway/target";
import { SmithyModelMcpTargetConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/target-configuration";
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha//gateway/api-schema";
import { OAuthCredentialProviderConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/credential-provider";
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";
import { OAuthIdentity } from "aws-cdk/bedrock-agentcore-alpha/identity/oauth-identity";

import { GoogleOauth2Config } from "aws-cdk/bedrock-agentcore-alpha//identity/oauth-provider";
import * as s3 from "aws-cdk-lib/aws-s3";

// Create a gateway first
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
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
});

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

### Complex Lambda Target with S3 Tool Schema

```typescript
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { GatewayTarget } from "aws-cdk/bedrock-agentcore-alpha//gateway/target";
import { LambdaMcpTargetConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/target-configuration";
import { ToolSchema } from "aws-cdk/bedrock-agentcore-alpha//gateway/tool-schema";
import * as s3 from "aws-cdk-lib/aws-s3";
import { GatewayIamRoleCredentialProviderConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/credential-provider";
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";

// Create a gateway first
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
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
});

// Create a Lambda function
const lambdaFunction = new lambda.Function(this, "MyComplexFunction", {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: "index.handler",
  code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
            return {
                statusCode: 200,
                body: JSON.stringify({ result: 'Complex operation completed' })
            };
        };
    `),
});

// Create a gateway target with Lambda and S3 tool schema
const target = new GatewayTarget(this, "MyComplexLambdaTarget", {
  name: "my-complex-lambda-target",
  description: "Target for complex Lambda function integration",
  gateway: gateway,
  targetConfiguration: new LambdaMcpTargetConfiguration({
    lambda: lambdaFunction,
    toolSchema: ToolSchema.fromS3File(
      s3.Bucket.fromBucketName(this, "SchemasBucket", "my-schemas-bucket"),
      "tools/complex-tool-schema.json",
      "123456789012"
    ),
  }),
  credentialProviderConfigurations: [
    new GatewayIamRoleCredentialProviderConfiguration({
      role: new iam.Role(this, "ComplexGatewayTargetRole", {
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

### Lambda Target with Local Asset Tool Schema

```typescript
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { GatewayTarget } from "aws-cdk/bedrock-agentcore-alpha//gateway/target";
import { LambdaMcpTargetConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/target-configuration";
import { ToolSchema } from "aws-cdk/bedrock-agentcore-alpha//gateway/tool-schema";
import { GatewayIamRoleCredentialProviderConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/credential-provider";
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";

// Create a gateway first
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
  protocolConfiguration: new McpProtocolConfiguration({
    instructions: "Use this gateway to connect to external MCP tools",
    searchType: McpSearchType.SEMANTIC,
    supportedVersions: ["2024-12-01"],
  }),
  authorizerConfiguration: new CustomJwtAuthorizerConfiguration({
    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
    allowedAudience: ["my-app"],
  }),
});

// Create a Lambda function
const lambdaFunction = new lambda.Function(this, "MyLambdaFunction", {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: "index.handler",
  code: lambda.Code.fromInline(`
    exports.handler = async (event) => {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Hello from Lambda!" })
      };
    };
  `),
});

// Create a target with local asset tool schema
const target = new GatewayTarget(this, "MyLocalAssetLambdaTarget", {
  name: "my-local-asset-lambda-target",
  description: "Target for Lambda function with local asset tool schema",
  gateway: gateway,
  targetConfiguration: new LambdaMcpTargetConfiguration({
    lambda: lambdaFunction,
    toolSchema: ToolSchema.fromLocalAsset(
      path.join(__dirname, "schemas", "my-tool-schema.json")
    ),
  }),
  credentialProviderConfigurations: [
    new GatewayIamRoleCredentialProviderConfiguration({
      role: new iam.Role(this, "LocalAssetGatewayTargetRole", {
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

### Gateway Target IAM Permissions

The Gateway Target construct provides convenient methods for granting IAM permissions:

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { GatewayTarget } from "aws-cdk/bedrock-agentcore-alpha//gateway/target";
import { OpenApiSchemaMcpTargetConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/target-configuration";
import { ApiSchema } from "aws-cdk/bedrock-agentcore-alpha//gateway/api-schema";
import { ApiKeyCredentialProviderConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/credential-provider";
import { Gateway } from "aws-cdk/bedrock-agentcore-alpha/gateway";
import {
  McpProtocolConfiguration,
  McpSearchType,
} from "aws-cdk/bedrock-agentcore-alpha/gateway/protocol";
import { CustomJwtAuthorizerConfiguration } from "aws-cdk/bedrock-agentcore-alpha//gateway/authorizer";
import { ApiKeyIdentity } from "aws-cdk/bedrock-agentcore-alpha//identity/api-key-identity";
import * as s3 from "aws-cdk-lib/aws-s3";

// Create a gateway and target
const gateway = new Gateway(this, "MyGateway", {
  name: "my-gateway",
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
});

// Create an API Key identity
const apiKeyIdentity = new ApiKeyIdentity(this, "MyApiKeyIdentity", {
  name: "my-api-key-provider",
  apiKey: "your-api-key-here",
});

const bucket = s3.Bucket.fromBucketName(this, "ExistingBucket", "my-schema-bucket");
const s3Schema = ApiSchema.fromS3File(bucket, "schemas/myschema.yaml");

const target = new GatewayTarget(this, "MyTarget", {
  name: "my-target",
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

## Code Interpreter

### Code Interpreter Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | Yes | The name of the code interpreter |
| `description` | `string` | No | Optional description for the code interpreter |
| `executionRole` | `iam.IRole` | No | The IAM role that provides permissions for the code interpreter to access AWS services |
| `networkConfiguration` | `CodeInterpreterNetworkConfiguration` | Yes | Network configuration for code interpreter |

### Basic Code Interpreter Creation

```typescript
import * as cdk from "aws-cdk-lib";
import {
  CodeInterpreter,
  CodeInterpreterNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha//tools/code-interpreter";

// Create a basic code interpreter with public network access
const codeInterpreter = new CodeInterpreter(this, "MyCodeInterpreter", {
  name: "my_code_interpreter",
  description: "A code interpreter for Python execution",
  networkConfiguration: {
    networkMode: CodeInterpreterNetworkMode.PUBLIC,
  },
});
```

### Code Interpreter with Sandbox Network Mode

```typescript
import * as cdk from "aws-cdk-lib";
import {
  CodeInterpreter,
  CodeInterpreterNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha//tools/code-interpreter";

// Create code interpreter with sandbox network mode (isolated)
const codeInterpreter = new CodeInterpreter(this, "MyCodeInterpreter", {
  name: "my_sandbox_interpreter",
  description: "Code interpreter with isolated network access",
  networkConfiguration: {
    networkMode: CodeInterpreterNetworkMode.SANDBOX,
  },
});
```

### Code Interpreter with Custom Execution Role

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  CodeInterpreter,
  CodeInterpreterNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha//tools/code-interpreter";

// Create a custom execution role
const executionRole = new iam.Role(this, "CodeInterpreterExecutionRole", {
  assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
});

// Create code interpreter with custom execution role
const codeInterpreter = new CodeInterpreter(this, "MyCodeInterpreter", {
  name: "my_code_interpreter",
  description: "Code interpreter with custom execution role",
  networkConfiguration: {
    networkMode: CodeInterpreterNetworkMode.PUBLIC,
  },
  executionRole: executionRole,
});
```

### Code Interpreter IAM Permissions

The Code Interpreter construct provides convenient methods for granting IAM permissions:

```typescript
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  CodeInterpreter,
  CodeInterpreterNetworkMode,
} from "aws-cdk/bedrock-agentcore-alpha//tools/code-interpreter";

// Create a code interpreter
const codeInterpreter = new CodeInterpreter(this, "MyCodeInterpreter", {
  name: "my_code_interpreter",
  description: "Code interpreter for Python execution",
  networkConfiguration: {
    networkMode: CodeInterpreterNetworkMode.PUBLIC,
  },
});

// Create a role that needs access to the code interpreter
const userRole = new iam.Role(this, "UserRole", {
  assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
});

// Grant read permissions (Get and List actions)
codeInterpreter.grantRead(userRole);

// Grant use permissions (Start, Invoke, Stop actions)
codeInterpreter.grantUse(userRole);

// Grant specific custom permissions
codeInterpreter.grant(userRole, "bedrock-agentcore:GetCodeInterpreterSession");
```

### Code Interpreter Network Modes

The Code Interpreter construct supports two network modes:

1. **Public Network Mode** (`CodeInterpreterNetworkMode.PUBLIC`)

   - Allows internet access for package installation and external API calls
   - Suitable for development and testing environments
   - Enables downloading Python packages from PyPI

2. **Sandbox Network Mode** (`CodeInterpreterNetworkMode.SANDBOX`)
   - Isolated network environment with no internet access
   - Suitable for production environments with strict security requirements
   - Only allows access to pre-installed packages and local resources

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
