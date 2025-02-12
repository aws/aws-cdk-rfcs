# Bedrock L2 Construct

* **Original Author(s):**: @dineshSajwan , @krokoko
* **Tracking Issue**: #686
* **API Bar Raiser**: @{BAR_RAISER_USER}

The Bedrock L2 construct simplifies the creation of multiple Bedrock features by wrapping the Bedrock L1 construct. It exposes functions
for creating features with minimal code. Key features include Bedrock Agent, Knowledge Base, Guardrails, Inference Profiles, and Prompt.

A quick comparison between L1 and L2 Bedrock constructs:

1. Quick and easy creation of constructs:
   - Knowledge base, agent, Guardrails, action groups, prompt management and inference profiles are simplified
   - Support multiple datasource , vector stores and kendra with one knowledge base constructor.

2. Manage IAM role policies for Bedrock constructs:
   - Add Bedrock policy on Knowledge Base to invoke embedding model
   - Add resource policy on agent to invoke foundation model

3. Helper methods for better user experience:
   - associateToAgent: Add Knowledge Base to an agent
   - addActionGroup, addActionGroups
   - addKnowledgeBase
   - addGuardrail
   - addS3DataSource, addWebCrawlerDataSource, addSharePointDataSource etc.

4. Managing node dependency, for example:
   - Create vector store before creating Knowledge Base
   - Lazy rendering of guardrails and Knowledge Base with agent

5. Validation and user-friendly error handling with functions like:
   - validateKnowledgeBase
   - validateKnowledgeBaseAssociations
   - validateGuardrail

6. Support creating resources from existing attributes with functions like:
   - fromAttributes
   - fromDataSourceId
   - fromAgentAttrs

**CHANGELOG**:
```feat(bedrock): bedrock L2 construct```

**README**:
[Amazon Bedrock](https://aws.amazon.com/bedrock/) is a fully managed service.
It offers a choice of high-performing foundation models (FMs) from leading AI companies and Amazon through a single API.

This construct library facilitates the deployment of Knowledge Bases, Bedrock Agents, Guardrails, Prompt Management, and Inference Pipelines.
It leverages underlying CloudFormation L1 resources to provision these Bedrock features.

For more details please refer here [Amazon Bedrock README](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/src/cdk-lib/bedrock/README.md).

## Knowledge Base

Amazon Bedrock Knowledge Bases enable you to provide foundation models and agents with contextual information from your company’s private data sources.
This enhances the relevance, accuracy, and customization of their responses.

### Create a Vector Knowledge Base

To create a vector knowledge Base, a vector index on a vector store is required. The resource accepts:

1. `storageConfiguration` prop: An existing vector store from:
   - [Amazon OpenSearch Serverless](../opensearchserverless)
   - [Amazon RDS Aurora PostgreSQL](../amazonaurora/)
   - [Pinecone](../pinecone/)

2. `instruction` prop: Provided to associated Bedrock Agents to determine when to query the Knowledge Base

3. embeddingsModel: Foundation model supported with bedrock.

Example of `OpenSearch Serverless`:

```ts
import * as s3 from 'aws-cdk-lib/aws-s3';
import { bedrock } from 'aws-cdk-lib/aws-bedrock';

const kb = new bedrock.KnowledgeBase(this, 'KnowledgeBase', {
  embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
  instruction: 'Use this knowledge base to answer questions about books. ' + 'It contains the full text of novels.',
  storageConfiguration:[{
    type:'OPENSEARCH_SERVERLESS',
    opensearchServerlessConfiguration:{
          collectionArn: params.vectorStore.collectionArn,
          fieldMapping: {
            vectorField: params.vectorField,
            textField: params.textField,
            metadataField: params.metadataField,
          },
          vectorIndexName: params.indexName,
        },
  }]
});

const docBucket = new s3.Bucket(this, 'DocBucket');

new bedrock.S3DataSource(this, 'DataSource', {
  bucket: docBucket,
  knowledgeBase: kb,
  dataSourceName: 'books',
  chunkingStrategy: bedrock.ChunkingStrategy.fixedSize({
    maxTokens: 500,
    overlapPercentage: 20,
  }),
});
```

For Amazon RDS Aurora PostgreSQL it supports fromExistingAuroraVectorStore() method.
N
ote - you need to provide clusterIdentifier, databaseName, vpc, secret and auroraSecurityGroupId used in
deployment of your existing RDS Amazon Aurora DB, as well as embeddingsModel that you want to be used by a Knowledge Base
for chunking:

```ts
import * as s3 from "aws-cdk-lib/aws-s3";
import { amazonaurora, bedrock } from 'aws-cdk-lib/aws-bedrock';

const auroraDb = aurora.AmazonAuroraVectorStore.fromExistingAuroraVectorStore(stack, 'ExistingAuroraVectorStore', {
  clusterIdentifier: 'aurora-serverless-vector-cluster',
  databaseName: 'bedrock_vector_db',
  schemaName: 'bedrock_integration',
  tableName: 'bedrock_kb',
  vectorField: 'embedding',
  textField: 'chunks',
  metadataField: 'metadata',
  primaryKeyField: 'id',
  embeddingsModel: bedrock.BedrockFoundationModel.COHERE_EMBED_ENGLISH_V3,
  vpc: cdk.aws_ec2.Vpc.fromLookup(stack, 'VPC', {
    vpcId: 'vpc-0c1a234567ee8bc90',
  }),
  auroraSecurityGroupId: 'sg-012ef345678c98a76',,
  secret: cdk.aws_rds.DatabaseSecret.fromSecretCompleteArn(
    stack,
    'Secret',
    cdk.Stack.of(stack).formatArn({
      service: 'secretsmanager',
      resource: 'secret',
      resourceName: 'rds-db-credentials/cluster-1234567890',
      region: cdk.Stack.of(stack).region,
      account: cdk.Stack.of(stack).account,
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
    }),
  ),
});

const kb = new bedrock.KnowledgeBase(this, "KnowledgeBase", {
  vectorStore: auroraDb,
  embeddingsModel: bedrock.BedrockFoundationModel.COHERE_EMBED_ENGLISH_V3,
  instruction:
    "Use this knowledge base to answer questions about books. " +
    "It contains the full text of novels.",
});

const docBucket = new s3.Bucket(this, "DocBucket");

new bedrock.S3DataSource(this, "DataSource", {
  bucket: docBucket,
  knowledgeBase: kb,
  dataSourceName: "books",
  chunkingStrategy: bedrock.ChunkingStrategy.FIXED_SIZE,
});
```

Example of `Pinecone` (manual, you must have Pinecone vector store created):

```ts
import * as s3 from 'aws-cdk-lib/aws-s3';
import { pinecone, bedrock } from 'aws-cdk-lib/aws-bedrock';

const pineconeds = new pinecone.PineconeVectorStore({
  connectionString: 'https://your-index-1234567.svc.gcp-starter.pinecone.io',
  credentialsSecretArn: 'arn:aws:secretsmanager:your-region:123456789876:secret:your-key-name',
  textField: 'question',
  metadataField: 'metadata',
});

const kb = new bedrock.KnowledgeBase(this, 'KnowledgeBase', {
  vectorStore: pineconeds,
  embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
  instruction: 'Use this knowledge base to answer questions about books. ' + 'It contains the full text of novels.',
});

const docBucket = new s3.Bucket(this, 'DocBucket');

new bedrock.S3DataSource(this, 'DataSource', {
  bucket: docBucket,
  knowledgeBase: kb,
  dataSourceName: 'books',
  chunkingStrategy: bedrock.ChunkingStrategy.FIXED_SIZE,
});
```

#### Knowledge Base - Data Sources

Data sources are the various repositories or systems from which information is extracted and ingested into the
knowledge base. These sources provide the raw content that will be processed, indexed, and made available for
querying within the knowledge base system. Data sources can include various types of systems such as document
management systems, databases, file storage systems, and content management platforms. Suuported Data Sources
include Amazon S3 buckets, Web Crawlers, SharePoint sites, Salesforce instances, and Confluence spaces.

- **Amazon S3**. You can either create a new data source using the `bedrock.S3DataSource(..)` class, or using the
  `kb.addS3DataSource(..)`.
- **Web Crawler**. You can either create a new data source using the `bedrock.WebCrawlerDataSource(..)` class, or using the
  `kb.addWebCrawlerDataSource(..)`.
- **Confluence**. You can either create a new data source using the `bedrock.ConfluenceDataSource(..)` class, or using the
  `kb.addConfluenceDataSource(..)`.
- **SharePoint**. You can either create a new data source using the `bedrock.SharePointDataSource(..)` class, or using the
  `kb.addSharePointDataSource(..)`.
- **Salesforce**. You can either create a new data source using the `bedrock.SalesforceDataSource(..)` class, or using the
  `kb.addSalesforceDataSource(..)`.

```ts

const kb = new KnowledgeBase(stack, 'MyKnowledgeBase', {
  name: 'MyKnowledgeBase',
  embeddingsModel: BedrockFoundationModel.COHERE_EMBED_MULTILINGUAL_V3,
});

const bucket = new Bucket(stack, 'Bucket', {});
const lambdaFunction = new Function(stack, 'MyFunction', {
  runtime: cdk.aws_lambda.Runtime.PYTHON_3_9,
  handler: 'index.handler',
  code: cdk.aws_lambda.Code.fromInline('print("Hello, World!")'),
});

const secret = new Secret(stack, 'Secret');
const key = new Key(stack, 'Key');

kb.addWebCrawlerDataSource({
  sourceUrls: ['https://docs.aws.amazon.com/'],
  chunkingStrategy: ChunkingStrategy.HIERARCHICAL_COHERE,
  customTransformation: CustomTransformation.lambda({
    lambdaFunction: lambdaFunction,
    s3BucketUri: `s3://${bucket.bucketName}/chunk-processor/`,
  }),
});

kb.addS3DataSource({
  bucket,
  chunkingStrategy: ChunkingStrategy.SEMANTIC,
  parsingStrategy: ParsingStategy.foundationModel({
    model: BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0,
  }),
});

kb.addConfluenceDataSource({
  dataSourceName: 'TestDataSource',
  authSecret: secret,
  kmsKey: key,
  confluenceUrl: 'https://example.atlassian.net',
  filters: [
    {
      objectType: ConfluenceObjectType.ATTACHMENT,
      includePatterns: ['.*\\.pdf'],
      excludePatterns: ['.*private.*\\.pdf'],
    },
    {
      objectType: ConfluenceObjectType.PAGE,
      includePatterns: ['.*public.*\\.pdf'],
      excludePatterns: ['.*confidential.*\\.pdf'],
    },
  ],
});

kb.addSalesforceDataSource({
  authSecret: secret,
  endpoint: 'https://your-instance.my.salesforce.com',
  kmsKey: key,
  filters: [
    {
      objectType: SalesforceObjectType.ATTACHMENT,
      includePatterns: ['.*\\.pdf'],
      excludePatterns: ['.*private.*\\.pdf'],
    },
    {
      objectType: SalesforceObjectType.CONTRACT,
      includePatterns: ['.*public.*\\.pdf'],
      excludePatterns: ['.*confidential.*\\.pdf'],
    },
  ],
});

kb.addSharePointDataSource({
  dataSourceName: 'SharepointDataSource',
  authSecret: secret,
  kmsKey: key,
  domain: 'yourdomain',
  siteUrls: ['https://yourdomain.sharepoint.com/sites/mysite'],
  tenantId: '888d0b57-69f1-4fb8-957f-e1f0bedf64de',
  filters: [
    {
      objectType: SharePointObjectType.PAGE,
      includePatterns: ['.*\\.pdf'],
      excludePatterns: ['.*private.*\\.pdf'],
    },
    {
      objectType: SharePointObjectType.FILE,
      includePatterns: ['.*public.*\\.pdf'],
      excludePatterns: ['.*confidential.*\\.pdf'],
    },
  ],
});
```

#### Knowledge Base - Chunking Strategies

- **Default Chunking**: Applies Fixed Chunking with the default chunk size of 300 tokens and 20% overlap.

  ```ts
  ChunkingStrategy.DEFAULT;
  ```

- **Fixed Size Chunking**: This method divides the data into fixed-size chunks, with each chunk
  containing a predetermined number of tokens. This strategy is useful when the data is uniform
  in size and structure.
  Typescript

  ```ts
  // Fixed Size Chunking with sane defaults.
  ChunkingStrategy.FIXED_SIZE;

  // Fixed Size Chunking with custom values.
  ChunkingStrategy.fixedSize({ maxTokens: 200, overlapPercentage: 25 });
  ```

- **Hierarchical Chunking**: This strategy organizes data into layers of chunks, with the first
  layer containing large chunks and the second layer containing smaller chunks derived from the first.
  It is ideal for data with inherent hierarchies or nested structures.

  ```ts
  // Hierarchical Chunking with the default for Cohere Models.
  ChunkingStrategy.HIERARCHICAL_COHERE;

  // Hierarchical Chunking with the default for Titan Models.
  ChunkingStrategy.HIERARCHICAL_TITAN;

  // Hierarchical Chunking with custom values. Tthe maximum chunk size depends on the model.
  // Amazon Titan Text Embeddings: 8192. Cohere Embed models: 512
  ChunkingStrategy.hierarchical({
    overlapTokens: 60,
    maxParentTokenSize: 1500,
    maxChildTokenSize: 300,
  });
  ```

- **Semantic Chunking**: This method splits data into smaller documents based on groups of similar
  content derived from the text using natural language processing. It helps preserve contextual
  relationships and ensures accurate and contextually appropriate results.

  ```ts
  // Semantic Chunking with sane defaults.
  ChunkingStrategy.SEMANTIC;

  // Semantic Chunking with custom values.
  ChunkingStrategy.semantic({ bufferSize: 0, breakpointPercentileThreshold: 95, maxTokens: 300 });
  ```

- **No Chunking**: This strategy treats each file as one chunk. If you choose this option,
  you may want to pre-process your documents by splitting them into separate files.

  ```ts
  ChunkingStrategy.NONE;
  ```

#### Knowledge Base - Parsing Strategy

A parsing strategy in Amazon Bedrock is a configuration that determines how the service
processes and interprets the contents of a document. It involves converting the document's
contents into text and splitting it into smaller chunks for analysis. Amazon Bedrock offers
two parsing strategies:

- **Default Parsing Strategy**: This strategy converts the document's contents into text
  and splits it into chunks using a predefined approach. It is suitable for most use cases
  but may not be optimal for specific document types or requirements.

- **Foundation Model Parsing Strategy**: This strategy uses a foundation model to describe
  the contents of the document. It is particularly useful for improved processing of PDF files
  with tables and images. To use this strategy, set the `parsingStrategy` in a data source as below.

  ```ts
  bedrock.ParsingStategy.foundationModel({
    model: BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0,
  });
  ```

#### Knowledge Base - Custom Transformation

Custom Transformation in Amazon Bedrock is a feature that allows you to create and apply
custom processing steps to documents moving through a data source ingestion pipeline.

Custom Transformation uses AWS Lambda functions to process documents, enabling you to
perform custom operations such as data extraction, normalization, or enrichment. To
create a custom transformation, set the `customTransformation` in a data source as below.

```ts
CustomTransformation.lambda({
lambdaFunction: lambdaFunction,
s3BucketUri: `s3://${bucket.bucketName}/chunk-processor/`,
}),
```

### Kendra Knowledge Base

#### Create a Kendra Knowledge Base

Amazon Bedrock Knowledge Bases enables building sophisticated RAG-powered digital assistants using Amazon Kendra GenAI index. Key benefits include:

* **Content Reusability**
  - Use indexed content across multiple Bedrock applications
  - No need to rebuild indexes or re-ingest data

* **Enhanced Capabilities**
  - Leverage Bedrock's advanced GenAI features
  - Benefit from Kendra's high-accuracy information retrieval

* **Customization**
  - Tailor digital assistant behavior using Bedrock tools
  - Maintain semantic accuracy of Kendra GenAI index

#### Kendra Knowledge Base properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| kendraIndex | IKendraGenAiIndex | Yes | The Kendra Index to use for the knowledge base. |
| name | string | No | The name of the knowledge base. If not provided, a name will be auto-generated. |
| description | string | No | Description of the knowledge base. |
| instruction | string | No | Instructions for the knowledge base. |
| existingRole | iam.IRole | No | An existing IAM role to use for the knowledge base. If not provided, a new role will be created. |

#### Initializer

TypeScript

```ts
import * as s3 from 'aws-cdk-lib/aws-s3';
import { bedrock, kendra } from 'aws-cdk-lib/aws-bedrock';

const cmk = new kms.Key(stack, 'cmk', {});

// you can create a new index using the api below 
const index = new kendra.KendraGenAiIndex(this, 'index', {
  name: 'kendra-index-cdk',
  kmsKey: cmk,
  documentCapacityUnits: 1, // 40K documents
  queryCapacityUnits: 1,    // 0.2 QPS
});

// or import an existing one
const index = kendra.KendraGenAiIndex.fromAttrs(this, 'myindex', {
  indexId: 'myindex',
  role: myRole
});

new bedrock.KendraKnowledgeBase(this, 'kb', {
  name: 'kendra-kb-cdk',
  kendraIndex: index,
});
```

## Agents

Amazon Bedrock Agents allow generative AI applications to automate complex, multistep tasks by seamlessly integrating with your APIs, and data sources.

### Create an Agent

The following example creates an Agent with a simple instruction and default prompts that consults a Knowledge Base.

```ts
const agent = new bedrock.Agent(this, 'Agent', {
  foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
  instruction: 'You are a helpful and friendly agent that answers questions about literature.',
});

agent.addKnowledgeBase(kb);
```

You can also use system defined inference profiles to enable cross region inference requests for supported models. For instance:

```ts
const cris = bedrock.CrossRegionInferenceProfile.fromConfig({
  geoRegion: bedrock.CrossRegionInferenceProfileRegion.US,
  model: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V1_0,
});

const agent = new bedrock.Agent(this, 'Agent', {
  foundationModel: cris,
  instruction: 'You are a helpful and friendly agent that answers questions about agriculture.',
});
```

For more information on cross region inference, please refer to [System defined inference profiles](#system-defined-inference-profiles)

### Action Groups

An action group defines functions your agent can call. The functions are Lambda functions. The action group uses an OpenAPI schema to tell
the agent what your functions do and how to call them.

```ts
const actionGroupFunction = new lambda_python.PythonFunction(this, 'ActionGroupFunction', {
  runtime: lambda.Runtime.PYTHON_3_12,
  entry: path.join(__dirname, '../lambda/action-group'),
});

const actionGroup = new AgentActionGroup({
  name: 'query-library',
  description: 'Use these functions to get information about the books in the library.',
  executor: bedrock.ActionGroupExecutor.fromlambdaFunction(actionGroupFunction),
  enabled: true,
  apiSchema: bedrock.ApiSchema.fromLocalAsset(path.join(__dirname, 'action-group.yaml')),
});

agent.addActionGroup(actionGroup);
```

### Prepare the Agent

he Agent constructs take an optional parameter shouldPrepareAgent to indicate that the Agent should be prepared after any updates to
an agent, Knowledge Base association, or action group. This may increase the time to create and update those resources. By default, this
value is false.

Creating an agent alias will not prepare the agent, so if you create an alias with addAlias or by providing an aliasName when creating
the agent then you should set shouldPrepareAgent to true .

#### Prompt Overrides

Bedrock Agents allows you to customize the prompts and LLM configuration for its different steps. You can disable steps or create a new
prompt template. Prompt templates can be inserted from plain text files.

```ts
import { readFileSync } from 'fs';

const file = readFileSync(prompt_path, 'utf-8');

const agent = new bedrock.Agent(this, 'Agent', {
      foundationModel: bedrock.BedrockFoundationModel.AMAZON_NOVA_LITE_V1,
      instruction: 'You are a helpful and friendly agent that answers questions about literature.',
      userInputEnabled: true,
      codeInterpreterEnabled: false,
      shouldPrepareAgent:true,
      promptOverrideConfiguration: bedrock.PromptOverrideConfiguration.fromSteps(
        [
          {
            stepType: bedrock.AgentStepType.PRE_PROCESSING,
            stepEnabled: true,
            customPromptTemplate: file,
            inferenceConfig: {
              temperature: 0.0,
              topP: 1,
              topK: 250,
              maximumLength: 1,
              stopSequences: ["\n\nHuman:"],
            },
          }
        ]
      )
    });
```

### Agent Alias

After iterating on your working draft and being satisfied with your agent's behavior, you can prepare it for deployment
and integration into your application by creating aliases.

To deploy your agent:

1. Create an alias
2. During alias creation, Amazon Bedrock automatically creates a version of your agent
3. The alias points to this newly created version
4. You can point the alias to a previously created version if needed
5. Configure your application to make API calls to that alias

By default, the `Agent` resource doesn't create any aliases. You can use the 'DRAFT' version if no alias is created.

#### Specific version

You can use the `AgentAlias` resource if you want to create an Alias for an existing Agent.

```ts
const agentAlias2 = new bedrock.AgentAlias(this, 'myalias2', {
  aliasName: 'myalias',
  agent: agent,
  agentVersion: '1', // optional
  description: 'mytest'
});
```

## Bedrock Guardrails

Amazon Bedrock's Guardrails feature enables you to implement robust governance and control mechanisms for your generative AI applications,
ensuring alignment with your specific use cases and responsible AI policies. Guardrails empowers you to create multiple tailored policy
configurations, each designed to address the unique requirements and constraints of different use cases. These policy configurations can
then be seamlessly applied across multiple foundation models (FMs) and Agents, ensuring a consistent user experience and standardizing

* Content filters – Adjust filter strengths to block input prompts or model responses containing harmful content.

* Denied topics – Define a set of topics that are undesirable in the context of your application.
These topics will be blocked if detected in user queries or model responses.

* Word filters – Configure filters to block undesirable words, phrases, and profanity. Such words can include offensive terms, competitor names etc.

* Sensitive information filters – Block or mask sensitive information such as personally identifiable information (PII) in user inputs and model responses.

You can create a Guardrail with a minimum blockedInputMessaging ,blockedOutputsMessaging and default content filter policy.

```ts
const guardrails = new bedrock.Guardrail(this, 'bedrockGuardrails', {
  name: 'my-BedrockGuardrails',
  description: 'Legal ethical guardrails.',
});

// Optional - Add Sensitive information filters

guardrail.addPIIFilter({
  type: PIIType.General.ADDRESS,
  action: GuardrailAction.ANONYMIZE,
});

guardrail.addRegexFilter({
  name: 'TestRegexFilter',
  description: 'This is a test regex filter',
  pattern: '/^[A-Z]{2}d{6}$/',
  action: bedrock.GuardrailAction.ANONYMIZE,
});

// Optional - Add contextual grounding

guardrail.addContextualGroundingFilter({
  type: ContextualGroundingFilterType.GROUNDING,
  threshold: 0.95,
});

guardrail.addContextualGroundingFilter({
  type: ContextualGroundingFilterType.RELEVANCE,
  threshold: 0.95,
});

// Optional - Add Denied topics . You can use a Topic or create your custom Topic

guardrail.addDeniedTopicFilter(Topic.FINANCIAL_ADVICE);
guardrail.addDeniedTopicFilter(
  Topic.custom({
    name: 'Legal_Advice',
    definition:
      'Offering guidance or suggestions on legal matters, legal actions, interpretation of laws, or legal rights and responsibilities.',
    examples: [
      'Can I sue someone for this?',
      'What are my legal rights in this situation?',
      'Is this action against the law?',
      'What should I do to file a legal complaint?',
      'Can you explain this law to me?',
    ],
  })
);

// Optional - Add Word filters. You can upload words from a file with addWordFilterFromFile function.
guardrail.addWordFilter('drugs');
guardrail.addManagedWordListFilter(ManagedWordFilterType.PROFANITY);
guardrails.addWordFilterFromFile('./scripts/wordsPolicy.csv');

// versioning - if you change any guardrail configuration, a new version will be created
guardrails.createVersion('testversion');

// Importing existing guardrail
const importedGuardrail = bedrock.Guardrail.fromGuardrailAttributes(stack, 'TestGuardrail', {
  guardrailArn: 'arn:aws:bedrock:us-east-1:123456789012:guardrail/oygh3o8g7rtl',
  guardrailVersion: '1', //optional
  kmsKey: kmsKey, //optional
});

// Importing Guardrails created through the L1 CDK CfnGuardrail construct
const cfnGuardrail = new CfnGuardrail(this, 'MyCfnGuardrail', {
  blockedInputMessaging: 'blockedInputMessaging',
  blockedOutputsMessaging: 'blockedOutputsMessaging',
  name: 'namemycfnguardrails',
  wordPolicyConfig: {
    wordsConfig: [
      {
        text: 'drugs',
      },
    ],
  },
});

const importedGuardrail = bedrock.Guardrail.fromCfnGuardrail(cfnGuardrail);
```

## Prompt management

Amazon Bedrock provides the ability to create and save prompts using Prompt management so that you can save
time by applying the same prompt to different workflows. You can include variables in the prompt so that you can
adjust the prompt for different use case.

The `Prompt` resource allows you to create a new prompt.
Example of a basic Text `Prompt`:

```ts
const cmk = new kms.Key(this, 'cmk', {});
const claudeModel = BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0;

const variant1 = PromptVariant.text({
  variantName: 'variant1',
  model: claudeModel,
  promptVariables: ['topic'],
  promptText: 'This is my first text prompt. Please summarize our conversation on: {{topic}}.',
  inferenceConfiguration: {
    temperature: 1.0,
    topP: 0.999,
    maxTokens: 2000,
  },
});

const prompt1 = new Prompt(this, 'prompt1', {
  promptName: 'prompt1',
  description: 'my first prompt',
  defaultVariant: variant1,
  variants: [variant1],
  encryptionKey: cmk,
});
```

Example of a "Chat" `Prompt`. Use this template type when the model supports the Converse API or the Anthropic Claude Messages API.
This allows you to include a System prompt and previous User messages and Assistant messages for context.

```ts
const cmk = new kms.Key(this, 'cmk', {});

const variantChat = PromptVariant.chat({
  variantName: 'variant1',
  model: BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V1_0,
  messages: [
    ChatMessage.userMessage('From now on, you speak Japanese!'),
    ChatMessage.assistantMessage('Konnichiwa!'),
    ChatMessage.userMessage('From now on, you speak {{language}}!'),
  ],
  system: 'You are a helpful assistant that only speaks the language you`re told.',
  promptVariables: ['language'],
  toolConfiguration: {
    toolChoice: ToolChoice.AUTO,
    tools: [
      {
        toolSpec: {
          name: 'top_song',
          description: 'Get the most popular song played on a radio station.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                sign: {
                  type: 'string',
                  description:
                    'The call sign for the radio station for which you want the most popular song. Example calls signs are WZPZ and WKR.',
                },
              },
              required: ['sign'],
            },
          },
        },
      },
    ],
  },
});

new Prompt(stack, 'prompt1', {
  promptName: 'prompt-chat',
  description: 'my first chat prompt',
  defaultVariant: variantChat,
  variants: [variantChat],
  kmsKey: cmk,
});
```

### Prompt Variants

Prompt variants in the context of Amazon Bedrock refer to alternative configurations of a prompt,
including its message or the model and inference configurations used. Prompt variants allow you
to create different versions of a prompt, test them, and save the variant that works best for
your use case. You can add prompt variants to a prompt by creating a `PromptVariant` object and
specify the variants on prompt creation, or by using the `.addVariant(..)` method on a `Prompt` object.

Example of `PromptVariant`:

```ts
...

const variant2 = PromptVariant.text({
  variantName: "variant2",
  model: claudeModel,
  promptVariables: [ "topic" ],
  promptText: "This is my second text prompt. Please summarize our conversation on: {{topic}}.",
  inferenceConfiguration: {
    temperature: 0.5,
    topP: 0.999,
    maxTokens: 2000,
  },
});

prompt1.addVariant(variant2);
```

### Prompt routing

Amazon Bedrock intelligent prompt routing offers a single serverless endpoint for efficient request routing between different foundational
models in the same family. It optimizes response quality and cost, providing a comprehensive solution for managing multiple AI models
through one endpoint.

This feature simplifies the process by:

1. Predicting each model's performance for every request
2. Dynamically routing requests to the most suitable model
3. Aiming for the desired response at the lowest cost

Intelligent prompt routing streamlines AI model management, potentially improving both quality and cost-effectiveness of responses.

For more detailed information about prompt routing, refer to the [Amazon Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.html).

```ts
const variant = PromptVariant.text({
  variantName: 'variant1',
  promptText: 'What is the capital of France?',
  model: PromptRouter.fromDefaultId(DefaultPromptRouterIdentifier.ANTHROPIC_CLAUDE_V1, region),
});

new Prompt(stack, 'Prompt', {
  promptName: 'prompt-router-test',
  variants: [variant],
});
```

### Prompt Version

A prompt version is a snapshot of a prompt at a specific point in time that you
create when you are satisfied with a set of configurations. Versions allow you to
deploy your prompt and easily switch between different configurations for your
prompt and update your application with the most appropriate version for your
use-case.

You can create a Prompt version by using the `PromptVersion` class or by using the `.createVersion(..)`
on a `Prompt` object. It is recommended to use the `.createVersion(..)` method. It uses a hash based mechanism
to update the version whenever a certain configuration property changes.

```ts
new PromptVersion(prompt1, 'my first version');
```

or alternatively:

```ts
prompt1.createVersion('my first version');
```

## System defined inference profiles

You can build a CrossRegionInferenceProfile using a system-defined inference profile. This profile routes requests to Regions specified in
the chosen cross-region (system-defined) inference profile.

To find system-defined inference profiles:

1. Navigate to your console (Amazon Bedrock -> Cross-region inference)
2. Use programmatic methods, e.g., [boto3's list_inference_profiles](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock/client/list_inference_profiles.html)

Before creating a CrossRegionInferenceProfile:

1. Ensure access to models and regions defined in the inference profiles
2. For example, if "us.anthropic.claude-3-5-sonnet-20241022-v2:0" is defined in your region:
   - Requests route to: US East (Virginia) us-east-1, US East (Ohio) us-east-2, US West (Oregon) us-west-2
   - Enable model access in these regions for `anthropic.claude-3-5-sonnet-20241022-v2:0`

After confirming access, you can create the CrossRegionInferenceProfile as needed.

```ts
const cris = bedrock.CrossRegionInferenceProfile.fromConfig({
  geoRegion: bedrock.CrossRegionInferenceProfileRegion.US,
  model: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V2_0,
});
```

## Application inference profile

Create an application inference profile to track usage and costs when invoking a model across one or more Regions.

For a single Region:

1. Specify a foundation model
2. Usage and costs for requests to that Region with that model will be tracked

For multiple Regions:

1. Specify a cross-region (system-defined) inference profile
2. Requests route to Regions defined in the chosen cross-region profile
3. Usage and costs for requests to these Regions are tracked

Find system-defined inference profiles:

1. Navigate to your console: Amazon Bedrock -> Cross-region inference
2. Use programmatic methods, e.g., [boto3's list_inference_profiles](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock/client/list_inference_profiles.html)

```
bedrock = session.client("bedrock", region_name="us-east-1")
bedrock.list_inference_profiles(typeEquals='SYSTEM_DEFINED')
```

Before using application inference profiles, ensure that:

- You have appropriate IAM permissions
- You have access to the models and regions defined in the inference profiles
- Ensure proper configuration of the required API permissions for inference profile-related actions

Specifically the role you are assuming needs to have permissions for following actions in the IAM policy

```
"Action": [
      "bedrock:GetInferenceProfile",
      "bedrock:ListInferenceProfiles",
      "bedrock:DeleteInferenceProfile"
      "bedrock:TagResource",
      "bedrock:UntagResource",
      "bedrock:ListTagsForResource"
  ]
```

You can restrict to specific resources by applying "Resources" tag in the IAM policy.

```
"Resource": ["arn:aws:bedrock:*:*:application-inference-profile/*"]
```

```ts
// Create an application inference profile for one Region
// You can use the 'bedrock.BedrockFoundationModel' or pass the arn as a string
const appInfProfile1 = new ApplicationInferenceProfile(this, 'myapplicationprofile', {
  inferenceProfileName: 'claude 3 sonnet v1',
  modelSource: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0,
  tags: [{ key: 'test', value: 'test' }],
});

// To create an application inference profile across regions, specify the cross region inference profile
const cris = bedrock.CrossRegionInferenceProfile.fromConfig({
  geoRegion: bedrock.CrossRegionInferenceProfileRegion.US,
  model: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V2_0,
});

const appInfProfile2 = new ApplicationInferenceProfile(this, 'myapplicationprofile2', {
  inferenceProfileName: 'claude 3 sonnet v1',
  modelSource: cris,
});

// Import a Cfn L1 construct created application inference profile
const cfnapp = new CfnApplicationInferenceProfile(this, 'mytestaip3', {
  inferenceProfileName: 'mytest',
  modelSource: {
    copyFrom: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
  },
});

const appInfProfile3 = bedrock.ApplicationInferenceProfile.fromCfnApplicationInferenceProfile(cfnapp);

// Import an inference profile through attributes
const appInfProfile4 = bedrock.ApplicationInferenceProfile.fromApplicationInferenceProfileAttributes(this, 'TestAIP', {
  inferenceProfileArn: 'arn:aws:bedrock:us-east-1:XXXXX:application-inference-profile/ID',
  inferenceProfileIdentifier: 'arn:aws:bedrock:us-east-1:XXXXXXX:application-inference-profile/ID',
});
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

We are excited to announce the launch of our new L2 construct for Amazon Bedrock. This construct includes several key features:

- Bedrock Agent: A core component for managing and orchestrating Bedrock resources.
- Knowledge Base: A repository for storing and managing knowledge assets.
- Guardrails: Mechanisms to ensure safe and compliant use of Bedrock services.
- Inference Profiles: Customizable profiles for optimizing inference tasks.
- Prompt: Tools and templates for creating effective prompts for Bedrock models.

### Why should I use this feature?

This L2 construct for Amazon Bedrock enables the creation of multiple features with minimal code, adhering to AWS best practices.
It facilitates seamless integration of existing features, e.g, allowing users to bring their own vector store and associate it with the knowledge base.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

The Bedrock L2 construct, currently open-sourced in the [generative-ai-cdk-constructs](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/src/cdk-lib/bedrock/README.md)
repository, is widely used and appreciated:

- Nearly 1,500 active AWS accounts use it
- Over 300,000 downloads from npm and PyPI libraries

Popular tools using this construct include:

- Lambda PowerTools: [Documentation](https://docs.powertools.aws.dev/lambda/python/latest/core/event_handler/bedrock_agents/#using-aws-cloud-developer-kit-cdk)
- Claude Chatbot: [GitHub Repository](https://github.com/aws-samples/bedrock-claude-chat)

The construct has received positive customer testimonials. Including it in the official CDK repository will help scale and serve customers
more effectively.

### Why should we _not_ do this?

The construct is currently in the [generative-ai-cdk-constructs](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/src/cdk-lib/bedrock/README.md)
repository. However, increasing demands and expanding use cases make maintenance challenging within this repository.

### What is the technical solution (design) of this feature?

This construct library includes CloudFormation L1 resources for Bedrock features. It provides interfaces for Agent, Guardrails, Knowledge
Base, and Prompt, among others. Detailed [API documentation](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/README.md#interfaces)
is available.

## Interfaces

- [AgentActionGroupProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/AgentActionGroupProps.md)
- [AgentAliasAttributes](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/AgentAliasAttributes.md)
- [AgentAliasProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/AgentAliasProps.md)
- [AgentAttributes](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/AgentAttributes.md)
- [AgentPromptVariantProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/AgentPromptVariantProps.md)
- [AgentProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/AgentProps.md)
- [ApplicationInferenceProfileAttributes](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ApplicationInferenceProfileAttributes.md)
- [ApplicationInferenceProfileProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ApplicationInferenceProfileProps.md)
- [BedrockFoundationModelProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/BedrockFoundationModelProps.md)
- [ChatPromptVariantProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ChatPromptVariantProps.md)
- [CommonPromptVariantProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/CommonPromptVariantProps.md)
- [ConfluenceCrawlingFilters](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ConfluenceCrawlingFilters.md)
- [ConfluenceDataSourceAssociationProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ConfluenceDataSourceAssociationProps.md)
- [ConfluenceDataSourceProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ConfluenceDataSourceProps.md)
- [ContentFilter](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ContentFilter.md)
- [ContextualGroundingFilter](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ContextualGroundingFilter.md)
- [CrawlingFilters](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/CrawlingFilters.md)
- [CrossRegionInferenceProfileProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/CrossRegionInferenceProfileProps.md)
- [CustomParserProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/CustomParserProps.md)
- [CustomTopicProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/CustomTopicProps.md)
- [DataSourceAssociationProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/DataSourceAssociationProps.md)
- [FoundationModelParsingStategyProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/FoundationModelParsingStategyProps.md)
- [GuardrailAttributes](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/GuardrailAttributes.md)
- [GuardrailProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/GuardrailProps.md)
- [HierarchicalChunkingProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/HierarchicalChunkingProps.md)
- [IAgent](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IAgent.md)
- [IAgentAlias](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IAgentAlias.md)
- [IDataSource](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IDataSource.md)
- [IGuardrail](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IGuardrail.md)
- [IInferenceProfile](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IInferenceProfile.md)
- [IInvokable](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IInvokable.md)
- [IKnowledgeBase](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IKnowledgeBase.md)
- [InferenceConfiguration](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/InferenceConfiguration.md)
- [IPrompt](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IPrompt.md)
- [IPromptRouter](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/IPromptRouter.md)
- [KnowledgeBaseAttributes](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/KnowledgeBaseAttributes.md)
- [KnowledgeBaseProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/KnowledgeBaseProps.md)
- [LambdaCustomTransformationProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/LambdaCustomTransformationProps.md)
- [PIIFilter](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/PIIFilter.md)
- [PromptAttributes](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/PromptAttributes.md)
- [PromptProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/PromptProps.md)
- [PromptRouterProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/PromptRouterProps.md)
- [PromptStepConfiguration](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/PromptStepConfiguration.md)
- [PromptStepConfigurationCustomParser](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/PromptStepConfigurationCustomParser.md)
- [PromptVersionProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/PromptVersionProps.md)
- [RegexFilter](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/RegexFilter.md)
- [S3DataSourceAssociationProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/S3DataSourceAssociationProps.md)
- [S3DataSourceProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/S3DataSourceProps.md)
- [SalesforceCrawlingFilters](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/SalesforceCrawlingFilters.md)
- [SalesforceDataSourceAssociationProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/SalesforceDataSourceAssociationProps.md)
- [SalesforceDataSourceProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/SalesforceDataSourceProps.md)
- [SharePointCrawlingFilters](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/SharePointCrawlingFilters.md)
- [SharePointDataSourceAssociationProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/SharePointDataSourceAssociationProps.md)
- [SharePointDataSourceProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/SharePointDataSourceProps.md)
- [TextPromptVariantProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/TextPromptVariantProps.md)
- [ToolConfiguration](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/ToolConfiguration.md)
- [WebCrawlerDataSourceAssociationProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/WebCrawlerDataSourceAssociationProps.md)
- [WebCrawlerDataSourceProps](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/interfaces/WebCrawlerDataSourceProps.md)

## Classes

- [ActionGroupExecutor](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ActionGroupExecutor.md)
- [Agent](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/Agent.md)
- [AgentActionGroup](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/AgentActionGroup.md)
- [AgentAlias](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/AgentAlias.md)
- [AgentAliasBase](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/AgentAliasBase.md)
- [AgentBase](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/AgentBase.md)
- [ApiSchema](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ApiSchema.md)
- [ApplicationInferenceProfile](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ApplicationInferenceProfile.md)
- [BedrockFoundationModel](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/BedrockFoundationModel.md)
- [ChatMessage](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ChatMessage.md)
- [ChunkingStrategy](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ChunkingStrategy.md)
- [ConfluenceDataSource](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ConfluenceDataSource.md)
- [CrossRegionInferenceProfile](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/CrossRegionInferenceProfile.md)
- [CustomTransformation](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/CustomTransformation.md)
- [DataSource](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/DataSource.md)
- [DataSourceBase](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/DataSourceBase.md)
- [DataSourceNew](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/DataSourceNew.md)
- [DefaultPromptRouterIdentifier](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/DefaultPromptRouterIdentifier.md)
- [Guardrail](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/Guardrail.md)
- [GuardrailBase](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/GuardrailBase.md)
- [InferenceProfileBase](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/InferenceProfileBase.md)
- [InlineApiSchema](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/InlineApiSchema.md)
- [KnowledgeBase](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/KnowledgeBase.md)
- [ParentActionGroupSignature](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ParentActionGroupSignature.md)
- [ParsingStategy](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ParsingStategy.md)
- [Prompt](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/Prompt.md)
- [PromptBase](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/PromptBase.md)
- [PromptOverrideConfiguration](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/PromptOverrideConfiguration.md)
- [PromptRouter](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/PromptRouter.md)
- [PromptVariant](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/PromptVariant.md)
- [PromptVersion](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/PromptVersion.md)
- [S3ApiSchema](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/S3ApiSchema.md)
- [S3DataSource](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/S3DataSource.md)
- [SalesforceDataSource](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/SalesforceDataSource.md)
- [SharePointDataSource](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/SharePointDataSource.md)
- [ToolChoice](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/ToolChoice.md)
- [Topic](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/Topic.md)
- [WebCrawlerDataSource](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/classes/WebCrawlerDataSource.md)

## Enumerations

- [AgentStepType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/AgentStepType.md)
- [ChatMessageRole](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/ChatMessageRole.md)
- [ConfluenceDataSourceAuthType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/ConfluenceDataSourceAuthType.md)
- [ConfluenceObjectType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/ConfluenceObjectType.md)
- [ContentFilterStrength](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/ContentFilterStrength.md)
- [ContentFilterType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/ContentFilterType.md)
- [ContextualGroundingFilterType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/ContextualGroundingFilterType.md)
- [CrawlingScope](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/CrawlingScope.md)
- [CrossRegionInferenceProfileRegion](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/CrossRegionInferenceProfileRegion.md)
- [DataDeletionPolicy](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/DataDeletionPolicy.md)
- [DataSourceType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/DataSourceType.md)
- [GuardrailAction](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/GuardrailAction.md)
- [InferenceProfileType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/InferenceProfileType.md)
- [ManagedWordFilterType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/ManagedWordFilterType.md)
- [PromptTemplateType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/PromptTemplateType.md)
- [SalesforceDataSourceAuthType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/SalesforceDataSourceAuthType.md)
- [SalesforceObjectType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/SalesforceObjectType.md)
- [SharePointDataSourceAuthType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/SharePointDataSourceAuthType.md)
- [SharePointObjectType](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/SharePointObjectType.md)
- [TransformationStep](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/apidocs/namespaces/bedrock/enumerations/TransformationStep.md)

### Is this a breaking change?

No.

### What alternative solutions did you consider?

Use Amazon Bedrock L1 construct for each feature individually, which takes a lot of code to provision the resource.

### What are the drawbacks of this solution?

The Knowledge Base vector stores (OpenSearch and Aurora clusters) utilize custom resource lambda functions, as there are no underlying L1 constructs available.

### What is the high-level project plan?

The construct is published and open-sourced in this [repository](https://github.com/awslabs/generative-ai-cdk-constructs/). We:

1. Continuously gather user feedback
2. Maintain a metrics dashboard to measure usage

### Are there any open issues that need to be addressed later?

While there are no major issues, all the latest requested open issues are tracked [here](https://github.com/awslabs/generative-ai-cdk-constructs/issues).

## Appendix
