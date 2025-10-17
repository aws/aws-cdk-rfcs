# Amazon Bedrock AgentCore Memory L2 Construct

* **Original Author(s):**: @krokoko , @aws-rafams , @dineshSajwan
* **Tracking Issue**: #788
* **API Bar Raiser**: @alvazjor,

The Amazon Bedrock AgentCore Memory L2 construct simplifies the creation and management of AI agent memory systems by wrapping
the AgentCore Memory L1 constructs.
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
[Amazon Bedrock AgentCore Memory](https://aws.amazon.com/bedrock/agentcore/) provides managed memory capabilities for AI
agents to maintain context across conversations.
With Amazon Bedrock AgentCore Memory, developers can enable agents to remember important facts and deliver consistent, personalized experiences.

This construct library facilitates the deployment of AgentCore Memory with short-term and long-term memory strategies.
It leverages underlying CloudFormation L1 resources to provision these AgentCore Memory features.

For more details please refer here [Amazon Bedrock AgentCore Memory Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html).

## Memory Overview

Memory is a critical component of intelligence. While Large Language Models (LLMs) have impressive capabilities,
they lack persistent memory across conversations. Amazon Bedrock AgentCore Memory addresses this limitation by providing a managed service
that enables AI agents to maintain context over time, remember important facts, and deliver consistent, personalized experiences.

AgentCore Memory operates on two levels:

- **Short-Term Memory**: Immediate conversation context and session-based information that provides continuity within a single interaction
or closely related sessions.
- **Long-Term Memory**: Persistent information extracted and stored across multiple conversations, including facts, preferences, and summaries
that enable personalized experiences over time.

When you interact with the memory via the `CreateEvent` API, you store interactions in Short-Term Memory (STM) instantly.
These interactions can include everything from user messages, assistant responses, to tool actions.

To write to long-term memory, you need to configure extraction strategies which define how and where to store information from conversations
for future use. These strategies are asynchronously processed from raw events after every few turns based on the strategy that was selected.
You can't create long term memory records directly, as they are extracted asynchronously by AgentCore Memory.

### Memory Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `memoryName` | `string` | Yes | The name of the memory |
| `expirationDays` | `Duration` | No | Short-term memory expiration in days (between 7 and 365). Default: 90 days |
| `description` | `string` | No | Optional description for the memory. Default: no description. |
| `kmsKey` | `IKey` | No | Custom KMS key to use for encryption. Default: Your data is encrypted with a key that AWS owns and manages for you |
| `memoryStrategies` | `MemoryStrategyBase[]` | No | Built-in extraction strategies to use for this memory. Default: No extraction strategies (short term memory only) |
| `executionRole` | `iam.IRole` | No | The IAM role that provides permissions for the memory to access AWS services. Default: A new role will be created. |
| `tags` | `{ [key: string]: string }` | No | Tags for memory. Default: no tags. |

#### Basic Memory Creation

Below you can find how to configure a simple short-term memory (STM) with no long-term memory extraction strategies.
Note how you set `expirationDays`, which defines the time the events will be stored in the short-term memory before they expire.

```typescript fixture=default

// Create a basic memory with default settings, no LTM strategies
const memory = new agentcore.Memory(this, "MyMemory", {
  memoryName: "my_memory",
  description: "A memory for storing user interactions for a period of 90 days",
  expirationDays: cdk.Duration.days(90),
});
```

Basic Memory with Custom KMS Encryption

```typescript fixture=default
// Create a custom KMS key for encryption
const encryptionKey = new kms.Key(this, "MemoryEncryptionKey", {
  enableKeyRotation: true,
  description: "KMS key for memory encryption",
});

// Create memory with custom encryption
const memory = new agentcore.Memory(this, "MyMemory", {
  memoryName: "my_encrypted_memory",
  description: "Memory with custom KMS encryption",
  expirationDays: cdk.Duration.days(90),
  kmsKey: encryptionKey,
});
```

### LTM Memory Extraction Stategies

If you need long-term memory for context recall across sessions, you can setup memory extraction strategies
to extract the relevant memory from the raw events.

Amazon Bedrock AgentCore Memory has different memory strategies for extracting and organizing information:

- **Summarization**: to summarize interactions to preserve critical context and key insights.
- **Semantic Memory**: to extract general factual knowledge, concepts and meanings from raw conversations using vector embeddings.
This enables similarity-based retrieval of relevant facts and context.
- **User Preferences**: to extract user behavior patterns from raw conversations.

You can use built-in extraction strategies for quick setup, or create custom extraction strategies with specific models and prompt templates.

### Memory with Built-in Strategies

The library provides three built-in LTM strategies. These are default strategies for organizing and extracting memory data,
each optimized for specific use cases.

For example: An agent helps multiple users with cloud storage setup. From these conversations,
see how each strategy processes users expressing confusion about account connection:

1. **Summarization Strategy** (`MemoryStrategy.usingBuiltInSummarization()`)
This strategy compresses conversations into concise overviews, preserving essential context and key insights for quick recall.
Extracted memory example: Users confused by cloud setup during onboarding.

   - Extracts concise summaries to preserve critical context and key insights
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}/sessions/{sessionId}`

2. **Semantic Memory Strategy** (`MemoryStrategy.usingBuiltInSemantic()`)
Distills general facts, concepts, and underlying meanings from raw conversational data, presenting the information in a context-independent format.
Extracted memory example: In-context learning = task-solving via examples, no training needed.

   - Extracts general factual knowledge, concepts and meanings from raw conversations
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}`

3. **User Preference Strategy** (`MemoryStrategy.usingBuiltInUserPreference()`)
Captures individual preferences, interaction patterns, and personalized settings to enhance future experiences.
Extracted memory example: User needs clear guidance on cloud storage account connection during onboarding.

   - Extracts user behavior patterns from raw conversations
   - Namespace: `/strategies/{memoryStrategyId}/actors/{actorId}`

```typescript fixture=default
// Create memory with built-in strategies
const memory = new agentcore.Memory(this, "MyMemory", {
  memoryName: "my_memory",
  description: "Memory with built-in strategies",
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [
    agentcore.MemoryStrategy.usingBuiltInSummarization(),
    agentcore.MemoryStrategy.usingBuiltInSemantic(),
    agentcore.MemoryStrategy.usingBuiltInUserPreference(),
  ],
});
```

The name generated for each built in memory strategy the followin pattern:

- For Summarization: `summary_builtin_<suffix>`
- For Semantic:`semantic_builtin_<suffix>`
- For User Preferences: `preference_builtin_<suffix>`

Where the suffix is a 5 characters string ([a-z, A-Z, 0-9]).

### Memory with custom Strategies

With Long-Term Memory, organization is managed through Namespaces.

An `actor` refers to entity such as end users or agent/user combinations. For example, in a coding support chatbot,
the actor is usually the developer asking questions. Using the actor ID helps the system know which user the memory belongs to,
keeping each user's data separate and organized.

A `session` is usually a single conversation or interaction period between the user and the AI agent.
It groups all related messages and events that happen during that conversation.

A `namespace` is used to logically group and organize long-term memories. It ensures data stays neat, separate, and secure.

With AgentCore Memory, you need to add a namespace when you define a memory strategy. This namespace helps define where the long-term memory
will be logically grouped. Every time a new long-term memory is extracted using this memory strategy, it is saved under the namespace you set.
This means that all long-term memories are scoped to their specific namespace, keeping them organized and preventing any mix-ups with other
users or sessions. You should use a hierarchical format separated by forward slashes /. This helps keep memories organized clearly. As needed,
you can choose to use the below pre-defined variables within braces in the namespace based on your applications' organization needs:

- `actorId` – Identifies who the long-term memory belongs to, such as a user
- `strategyId` – Shows which memory strategy is being used. This strategy identifier is auto-generated when you create a memory using CreateMemory operation.
- `sessionId` – Identifies which session or conversation the memory is from.

For example, if you define the following namespace as the input to your strategy in CreateMemory operation:

```shell
/strategy/{strategyId}/actor/{actorId}/session/{sessionId}
```

After memory creation, this namespace might look like:

```shell
/strategy/summarization-93483043//actor/actor-9830m2w3/session/session-9330sds8
```

You can customise the namespace, i.e. where the memories are stored by using the following methods:

1. **Summarization Strategy** (`MemoryStrategy.usingSummarization(props)`)
1. **Semantic Memory Strategy** (`MemoryStrategy.usingSemantic(props)`)
1. **User Preference Strategy** (`MemoryStrategy.usingUserPreference(props)`)

```typescript fixture=default
// Create memory with built-in strategies
const memory = new agentcore.Memory(this, "MyMemory", {
  memoryName: "my_memory",
  description: "Memory with built-in strategies",
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [
    agentcore.MemoryStrategy.usingUserPreference({
        name: "CustomerPreferences",
        namespaces: ["support/customer/{actorId}/preferences"]
    }),
    agentcore.MemoryStrategy.usingSemantic({
        name: "CustomerSupportSemantic",
        namespaces: ["support/customer/{actorId}/semantic"]
    }),
  ],
});
```

Custom memory strategies let you tailor memory extraction and consolidation to your specific domain or use case.
You can override the prompts for extracting and consolidating semantic, summary, or user preferences.
You can also choose the model that you want to use for extraction and consolidation.

The custom prompts you create are appended to a non-editable system prompt.

Since a custom strategy requires you to invoke certain FMs, you need a role with appropriate permissions. For that, you can:

- Let the L2 construct create a minimum permission role for you when use L2 Bedrock Foundation Models.
- Use a custom role with the overly permissive `AmazonBedrockAgentCoreMemoryBedrockModelInferenceExecutionRolePolicy` managed policy.
- Use a custom role with your own custom policies.

#### Memory with Custom Execution Role

Keep in mind that memories that **do not** use custom strategies do not require a service role.
So even if you provide it, it will be ignored as it will never be used.

```typescript fixture=default
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
const memory = new agentcore.Memory(this, "MyMemory", {
  memoryName: "my_memory",
  description: "Memory with custom execution role",
  expirationDays: cdk.Duration.days(90),
  executionRole: executionRole,
});
```

```typescript fixture=default
// Create a custom semantic memory strategy
const customSemanticStrategy = agentcore.MemoryStrategy.usingSemantic({
  name: "customSemanticStrategy",
  description: "Custom semantic memory strategy",
  namespaces: ["/custom/strategies/{memoryStrategyId}/actors/{actorId}"],
  customConsolidation: {
    model: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V1_0,
    appendToPrompt: "Custom consolidation prompt for semantic memory",
  },
  customExtraction: {
    model: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V1_0,
    appendToPrompt: "Custom extraction prompt for semantic memory",
  },
});

// Create memory with custom strategy
const memory = new agentcore.Memory(this, "MyMemory", {
  memoryName: "my-custom-memory",
  description: "Memory with custom strategy",
  expirationDays: cdk.Duration.days(90),
  memoryStrategies: [customSemanticStrategy],
});
```

### Memory Strategy Methods

You can add new memory strategies to the memory construct using the `addMemoryStrategy()` method, for instance:

```typescript fixture=default
// Create memory without initial strategies
const memory = new agentcore.Memory(this, "test-memory", {
  memoryName: "test_memory_add_strategy",
  description: "A test memory for testing addMemoryStrategy method",
  expirationDays: cdk.Duration.days(90),
});

// Add strategies after instantiation
memory.addMemoryStrategy(agentcore.MemoryStrategy.usingBuiltInSummarization());
memory.addMemoryStrategy(agentcore.MemoryStrategy.usingBuiltInSemantic());
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

### What is the technical solution (design) of this feature?

The L2 construct library is built using:

1. **TypeScript with Projen**: Modern tooling for construct development
2. **JSII**: Multi-language support (TypeScript, Python, Java, .NET)
4. **Modular Architecture**: Memory and MemoryStrategy as separate constructs

Key design principles:

- **Flexibility**: Support for both built-in and custom strategies
- **Sensible Defaults**: Production-ready configurations out of the box
- **Extensibility**: Support for custom models and prompts
- **Type Safety**: Strong typing for better developer experience

## Interfaces

The construct library provides comprehensive interfaces for Memory services:

All interfaces are available in the public pull request: https://github.com/aws/aws-cdk/pull/35757

### Is this a breaking change?

No. This is a new construct library for Amazon Bedrock AgentCore Memory.
It does not affect existing constructs.

### What alternative solutions did you consider?

### What are the drawbacks of this solution?

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

Self managed strategy is not available yet, it will be added as a long term memory strategy.
