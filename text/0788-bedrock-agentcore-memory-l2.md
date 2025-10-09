# Amazon Bedrock AgentCore Memory L2 Construct

* **Original Author(s):**: @krokoko , @aws-rafams , @dineshSajwan
* **Tracking Issue**: #788
* **API Bar Raiser**: @alvazjor,

The Amazon Bedrock AgentCore Memory L2 construct simplifies the creation and management of AI agent memory systems by wrapping the AgentCore Memory L1 constructs.
It provides a high-level, object-oriented approach to creating and managing short-term and long-term memory for AI agents.
This enables agents to maintain context over time and deliver personalized experiences.

A quick comparison between L1 and L2 Memory constructs:

1. Quick and easy creation of Memory resources:
   - Short-term memory with configurable expiration
   - Long-term memory with extraction strategies
   - Built-in and custom memory strategies

2. Simplified infrastructure management:
   - Automatic KMS encryption support
   - Automatic IAM role and policy management
   - Memory strategy configuration

3. Helper methods for better developer experience:
   - `addMemoryStrategy()` for adding strategies after creation
   - Built-in strategies for common use cases
   - Custom strategy support with prompts

4. Validation and error handling:
   - Compile-time configuration validation
   - User-friendly error messages
   - Automatic dependency management

**CHANGELOG**:
```feat(bedrock-agentcore): Amazon Bedrock AgentCore Memory L2 construct```

**README**:
[Amazon Bedrock AgentCore Memory](https://aws.amazon.com/bedrock/agentcore/) provides managed memory capabilities for AI agents to maintain context across conversations.
With Amazon Bedrock AgentCore Memory, developers can enable agents to remember important facts and deliver consistent, personalized experiences.

This construct library facilitates the deployment of AgentCore Memory with short-term and long-term memory strategies.
It leverages underlying CloudFormation L1 resources and custom resources to provision these AgentCore Memory features.

For more details please refer here [Amazon Bedrock AgentCore Memory Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html).

## Memory Overview

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

## Memory Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | No | The name of the memory |
| `expirationDays` | `Duration` | No | Short-term memory expiration in days (between 7 and 365) |
| `description` | `string` | No | Optional description for the memory |
| `kmsKey` | `IKey` | No | Custom KMS key to use for encryption |
| `memoryStrategies` | `MemoryStrategyBase[]` | No | Built-in extraction strategies to use for this memory |
| `executionRole` | `iam.IRole` | No | The IAM role that provides permissions for the memory to access AWS services |

## Basic Memory Creation

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

## Memory with Custom KMS Encryption

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

## LTM Memory Extraction Strategies

If you need long-term memory for context recall across sessions, you can setup memory extraction strategies to extract
the relevant memory from the raw events.

Amazon Bedrock AgentCore Memory has different memory strategies for extracting and organizing information:

- **Summarization**: to summarize interactions to preserve critical context and key insights.
- **Semantic Memory**: to extract general factual knowledge, concepts and meanings from raw conversations
  using vector embeddings. This enables similarity-based retrieval of relevant facts and context.
- **User Preferences**: to extract user behavior patterns from raw conversations.

You can use built-in extraction strategies for quick setup, or create custom extraction strategies with specific models and prompt templates.

## Memory with Built-in Strategies

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

## Memory with Built-in Strategies - Custom Namespace

You can customise the namespace, i.e. where the memories are stored by using the following methods:

1. **Summarization Strategy** (`MemoryStrategy.fromBuiltInSummarization(props)`)
2. **Semantic Memory Strategy** (`MemoryStrategy.fromBuiltInSemantic(props)`)
3. **User Preference Strategy** (`MemoryStrategy.fromBuiltInUserPreference(props)`)

```typescript
import * as cdk from "aws-cdk-lib";
import {
  Memory,
  MemoryStrategy,
} from "aws-cdk/bedrock-agentcore-alpha/memory";

// Create memory with built-in strategies using custom namespaces
const memory = new Memory(this, "MyMemory", {
  name: "my_memory",
  description: "Memory with built-in strategies",
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [
    MemoryStrategy.fromBuiltInUserPreference({
      name: "CustomerPreferences",
      namespaces: ["support/customer/{actorId}/preferences"]
    }),
    MemoryStrategy.fromBuiltInSemantic({
      name: "CustomerSupportSemantic",
      namespaces: ["support/customer/{actorId}/semantic"]
    }),
    MemoryStrategy.fromBuiltInSummarization({
      name: "SessionSummaries",
      namespaces: ["support/sessions/{sessionId}/summary"]
    }),
  ],
});
```

## Custom Strategies

You can also create custom memory strategies using your specified models and prompts.
According to the strategy that you will be customizing, you will have to specify extraction and/or consolidation FMs
and prompt templates to append to the system prompt of the memory strategy. You can do so by using:

1. **Summarization Strategy** (`MemoryStrategy.fromCustomSummaryOverride(props)`)
2. **Semantic Memory Strategy** (`MemoryStrategy.fromCustomSemanticOverride(props)`)
3. **User Preference Strategy** (`MemoryStrategy.fromCustomUserPreferenceOverride(props)`)

Since a custom strategy requires you to invoke certain FMs, you need a role with appropriate permissions. For that, you can:

- Let the L2 construct create a minimum permission role for you when use L2 Bedrock Foundation Models.
- Use a custom role with the overly permissive `AmazonBedrockAgentCoreMemoryBedrockModelInferenceExecutionRolePolicy` managed policy.
- Use a custom role with your own custom policies.

### Memory with Custom Execution Role

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

### Custom Strategy Example

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
    model: "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
    customPrompt: "Custom consolidation prompt for semantic memory",
  },
  customExtraction: {
    model: "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
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

## Memory Strategy Methods

You can add new memory strategies to the memory construct using the `addMemoryStrategy()` method, for instance:

```typescript
import * as cdk from "aws-cdk-lib";
import {
  Memory,
  MemoryStrategy,
} from "aws-cdk/bedrock-agentcore-alpha/memory";

// Create memory without initial strategies
const memory = new Memory(this, "test-memory", {
  name: "test_memory_add_strategy",
  description: "A test memory for testing addMemoryStrategy method",
  expirationDays: cdk.Duration.days(90),
});

// Add strategies after instantiation
memory.addMemoryStrategy(MemoryStrategy.BUILT_IN_SUMMARIZATION);
memory.addMemoryStrategy(MemoryStrategy.BUILT_IN_SEMANTIC);
memory.addMemoryStrategy(MemoryStrategy.BUILT_IN_USER_PREFERENCE);
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

We are excited to announce the launch of our new L2 construct for Amazon Bedrock AgentCore Memory.
This construct library provides high-level abstractions for managing AI agent memory systems.
Key features include:

- **Short-Term Memory**: Session-based context with configurable expiration
- **Long-Term Memory**: Persistent extraction strategies for facts and preferences
- **Built-in Strategies**: Pre-configured summarization, semantic, and user preference strategies
- **Custom Strategies**: Support for custom models and prompts
- **KMS Encryption**: Enterprise-grade security for memory storage

### Why should I use this feature?

The Amazon Bedrock AgentCore Memory L2 construct offers several compelling advantages:

1. **Context Preservation**: Enable agents to remember important information across conversations
2. **Personalization**: Deliver consistent, personalized experiences based on user history
3. **Flexible Strategies**: Choose from built-in or create custom extraction strategies
4. **Secure Storage**: Automatic KMS encryption for sensitive information
5. **Simple Integration**: Easy to add to existing agent applications
6. **Managed Service**: No infrastructure to manage

These L2 constructs eliminate the complexity of implementing persistent memory for AI agents.
Developers can focus on building intelligent applications with context awareness.

## Internal FAQ

### Why are we doing this?

Amazon Bedrock AgentCore Memory addresses critical needs for AI agents:

1. **Context Loss**: LLMs lack persistent memory across conversations
2. **Personalization Needs**: Users expect agents to remember their preferences
3. **Information Extraction**: Important facts need to be preserved for future use
4. **Session Continuity**: Agents need to maintain context within conversations

The L2 construct addresses these challenges by providing:

- Managed short-term and long-term memory
- Built-in extraction strategies
- Secure storage with encryption
- Simple configuration and deployment

### Why should we _not_ do this?

Potential concerns to consider:

1. **Service Maturity**: AgentCore is in preview and subject to changes
2. **Custom Resource Dependency**: Currently relies on custom resources
3. **Storage Costs**: Memory storage incurs ongoing costs

However, these concerns are mitigated by:

- Clear migration path when CloudFormation support becomes available
- Cost-effective storage with configurable expiration
- Significant value from context preservation

### What is the technical solution (design) of this feature?

The L2 construct library is built using:

1. **TypeScript with Projen**: Modern tooling for construct development
2. **JSII**: Multi-language support (TypeScript, Python, Java, .NET)
3. **Custom Resources**: Temporary solution using Lambda functions
4. **Modular Architecture**: Memory and MemoryStrategy as separate constructs

Key design principles:

- **Flexibility**: Support for both built-in and custom strategies
- **Sensible Defaults**: Production-ready configurations out of the box
- **Extensibility**: Support for custom models and prompts
- **Type Safety**: Strong typing for better developer experience

## Interfaces

The construct library provides comprehensive interfaces for Memory services:

### Memory Interfaces

- [MemoryProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memoryprops)
- [MemoryStrategyProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memorystrategyprops)
- [CustomMemoryStrategyProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#custommemorystrategyprops)
- [BuiltInStrategyProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#builtinstrategyprops)

## Classes

### Core Classes

- [Memory](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memory)
- [MemoryStrategy](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memorystrategy)

## Enumerations

- [MemoryStrategyType](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#memorystrategytype)

### Is this a breaking change?

No. This is a new construct library for Amazon Bedrock AgentCore Memory.
It does not affect existing constructs.

### What alternative solutions did you consider?

1. Using DynamoDB for memory storage - lacks extraction strategies
2. Custom vector databases - requires significant infrastructure
3. Session-only memory - loses context between conversations

### What are the drawbacks of this solution?

1. Relies on Lambda-based custom resources until CloudFormation support is available
2. AgentCore is in preview and APIs may change
3. Storage costs for long-term memory

### What is the high-level project plan?

**Phase 1: RFC**:

- Submit RFC proposal for creating the AgentCore Memory L2 construct
- Design the initial interface and helper methods
- Monitor the release of L1 constructs

**Phase 2: Development**:

- Create Memory module with strategy support
- Implement built-in strategies
- Add custom strategy support
- Create comprehensive unit tests
- Write comprehensive API documentation

**Phase 3: Post-Launch**:

- Publish launch blog and announcement posts
- Regular updates to track AgentCore service changes
- Add support for additional extraction strategies

### Are there any open issues that need to be addressed later?

1. Waiting for the release of L1 construct for Bedrock AgentCore Memory
2. Replace all custom resources with L1 constructs
3. Consider adding more built-in extraction strategies based on user feedback
