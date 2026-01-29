# Amazon Bedrock AgentCore Tools L2 Construct

* **Original Author(s):**: @krokoko , @aws-rafams , @dineshSajwan
* **Tracking Issue**: #786
* **API Bar Raiser**: @alvazjor,

The Amazon Bedrock AgentCore Tools L2 constructs simplify the deployment and management of built-in tools for AI agents by wrapping the AgentCore Tools
L1 constructs. It provides high-level, object-oriented approaches to creating and managing Browser and Code Interpreter tools.
These tools enable AI agents to interact with websites and execute code securely.

A quick comparison between L1 and L2 Tools constructs:

1. Quick and easy creation of Tool resources:
   - Browser tool with recording and network configuration
   - Code Interpreter with execution modes
   - Secure sandbox environments

2. Simplified infrastructure management:
   - Automatic S3 bucket integration for Browser recordings
   - Automatic IAM role and policy management
   - Network configuration with sensible defaults

3. Helper methods for better developer experience:
   - `grantRead()`, `grantUse()` for IAM permissions
   - Recording configuration helpers for Browser
   - Network mode configuration for both tools

4. Validation and error handling:
   - Compile-time configuration validation
   - User-friendly error messages
   - Automatic dependency management

**CHANGELOG**:
```feat(bedrock-agentcore): Amazon Bedrock AgentCore Tools L2 construct```

**README**:
[Amazon Bedrock AgentCore Tools](https://aws.amazon.com/bedrock/agentcore/) provide built-in capabilities for AI agents including Browser automation
and Code Interpreter for secure code execution.
With Amazon Bedrock AgentCore Tools, developers can enhance their AI agents with powerful capabilities while maintaining enterprise-grade security.

This construct library facilitates the deployment of AgentCore Browser and Code Interpreter tools.
It leverages underlying CloudFormation L1 resources and custom resources to provision these AgentCore Tool features.

For more details please refer here [Amazon Bedrock AgentCore Tools Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html).

## Browser

The Amazon Bedrock AgentCore Browser provides a secure, cloud-based browser that enables AI agents to interact with websites. It includes security features
such as session isolation, built-in observability through live viewing, CloudTrail logging, and session replay capabilities.

Additional information about the browser tool can be found in the [official documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-tool.html)

### Browser Network modes

The Browser construct supports the following network modes:

1. **Public Network Mode** (`BrowserNetworkMode.usingPublicNetwork()`) - Default

   - Allows internet access for web browsing and external API calls
   - Suitable for scenarios where agents need to interact with publicly available websites
   - Enables full web browsing capabilities
   - VPC mode is not supported with this option

2. **VPC (Virtual Private Cloud)** (`BrowserNetworkMode.usingVpc()`)

   - Select whether to run the browser in a virtual private cloud (VPC).
   - By configuring VPC connectivity, you enable secure access to private resources such as databases, internal APIs, and services within your VPC.

    While the VPC itself is mandatory, these are optional:
    - Subnets - if not provided, CDK will select appropriate subnets from the VPC
    - Security Groups - if not provided, CDK will create a default security group
    - Specific subnet selection criteria - you can let CDK choose automatically

For more information on VPC connectivity for Amazon Bedrock AgentCore Browser, please refer to the [official documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html).

### Browser Properties

| Name                   | Type                          | Required | Description                                                                                                                  |
| ---------------------- | ----------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `browserCustomName`    | `string`                      | Yes      | The name of the browser. Must start with a letter and can be up to 48 characters long. Pattern: `[a-zA-Z][a-zA-Z0-9_]{0,47}` |
| `description`          | `string`                      | No       | Optional description for the browser. Can have up to 200 characters                                                          |
| `networkConfiguration` | `BrowserNetworkConfiguration` | No       | Network configuration for browser. Defaults to PUBLIC network mode                                                           |
| `recordingConfig`      | `RecordingConfig`             | No       | Recording configuration for browser. Defaults to no recording                                                                |
| `executionRole`        | `iam.IRole`                   | No       | The IAM role that provides permissions for the browser to access AWS services. A new role will be created if not provided    |
| `tags`                 | `{ [key: string]: string }`   | No       | Tags to apply to the browser resource                                                                                        |

### Basic Browser Creation

```typescript fixture=default
// Create a basic browser with public network access
const browser = new agentcore.BrowserCustom(this, "MyBrowser", {
  browserCustomName: "my_browser",
  description: "A browser for web automation",
});
```

### Browser with Tags

```typescript fixture=default
// Create a browser with custom tags
const browser = new agentcore.BrowserCustom(this, "MyBrowser", {
  browserCustomName: "my_browser",
  description: "A browser for web automation with tags",
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingPublicNetwork(),
  tags: {
    Environment: "Production",
    Team: "AI/ML",
    Project: "AgentCore",
  },
});
```

### Browser with VPC

```typescript fixture=default
const browser = new agentcore.BrowserCustom(this, 'BrowserVpcWithRecording', {
  browserCustomName: 'browser_recording',
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingVpc(this, {
    vpc: new ec2.Vpc(this, 'VPC', { restrictDefaultSecurityGroup: false }),
  }),
});
```

Browser exposes a [connections](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Connections.html) property. This property returns a connections
object, which simplifies the process of defining and managing ingress and egress rules for security groups in your AWS CDK applications. Instead of directly
manipulating security group rules, you interact with the Connections object of a construct, which then translates your connectivity requirements into the
appropriate security group rules. For instance:

```typescript fixture=default
const vpc = new ec2.Vpc(this, 'testVPC');

const browser = new agentcore.BrowserCustom(this, 'test-browser', {
  browserCustomName: 'test_browser',
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingVpc(this, {
    vpc: vpc,
  }),
});

browser.connections.addSecurityGroup(new ec2.SecurityGroup(this, 'AdditionalGroup', { vpc }));
```

So security groups can be added after the browser construct creation. You can use methods like allowFrom() and allowTo() to grant ingress access to/egress
access from a specified peer over a given portRange. The Connections object automatically adds the necessary ingress or egress rules to the security group(s)
associated with the calling construct.

### Browser with Recording Configuration

```typescript fixture=default
// Create an S3 bucket for recordings
const recordingBucket = new s3.Bucket(this, "RecordingBucket", {
  bucketName: "my-browser-recordings",
  removalPolicy: RemovalPolicy.DESTROY, // For demo purposes
});

// Create browser with recording enabled
const browser = new agentcore.BrowserCustom(this, "MyBrowser", {
  browserCustomName: "my_browser",
  description: "Browser with recording enabled",
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingPublicNetwork(),
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

```typescript fixture=default
// Create a custom execution role
const executionRole = new iam.Role(this, "BrowserExecutionRole", {
  assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockAgentCoreBrowserExecutionRolePolicy"),
  ],
});

// Create browser with custom execution role
const browser = new agentcore.BrowserCustom(this, "MyBrowser", {
  browserCustomName: "my_browser",
  description: "Browser with custom execution role",
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingPublicNetwork(),
  executionRole: executionRole,
});
```

### Browser with S3 Recording and Permissions

```typescript fixture=default
// Create an S3 bucket for recordings
const recordingBucket = new s3.Bucket(this, "RecordingBucket", {
  bucketName: "my-browser-recordings",
  removalPolicy: RemovalPolicy.DESTROY, // For demo purposes
});

// Create browser with recording enabled
const browser = new agentcore.BrowserCustom(this, "MyBrowser", {
  browserCustomName: "my_browser",
  description: "Browser with recording enabled",
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingPublicNetwork(),
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

```typescript fixture=default
// Create a browser
const browser = new agentcore.BrowserCustom(this, "MyBrowser", {
  browserCustomName: "my_browser",
  description: "Browser for web automation",
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingPublicNetwork(),
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

## Code Interpreter

The Amazon Bedrock AgentCore Code Interpreter enables AI agents to write and execute code securely in sandbox environments, enhancing their accuracy and
expanding their ability to solve complex end-to-end tasks. This is critical in Agentic AI applications where the agents may execute arbitrary code that
can lead to data compromise or security risks. The AgentCore Code Interpreter tool provides secure code execution, which helps you avoid running into
these issues.

For more information about code interpreter, please refer to the [official documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-tool.html)

### Code Interpreter Network Modes

The Code Interpreter construct supports the following network modes:

1. **Public Network Mode** (`CodeInterpreterNetworkMode.usingPublicNetwork()`) - Default

   - Allows internet access for package installation and external API calls
   - Suitable for development and testing environments
   - Enables downloading Python packages from PyPI

2. **Sandbox Network Mode** (`CodeInterpreterNetworkMode.usingSandboxNetwork()`)
   - Isolated network environment with no internet access
   - Suitable for production environments with strict security requirements
   - Only allows access to pre-installed packages and local resources

3. **VPC (Virtual Private Cloud)** (`CodeInterpreterNetworkMode.usingVpc()`)
   - Select whether to run the browser in a virtual private cloud (VPC).
   - By configuring VPC connectivity, you enable secure access to private resources such as databases, internal APIs, and services within your VPC.

    While the VPC itself is mandatory, these are optional:
    - Subnets - if not provided, CDK will select appropriate subnets from the VPC
    - Security Groups - if not provided, CDK will create a default security group
    - Specific subnet selection criteria - you can let CDK choose automatically

For more information on VPC connectivity for Amazon Bedrock AgentCore Browser, please refer to the [official documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html).

### Code Interpreter Properties

| Name                        | Type                                  | Required | Description                                                                                                                           |
| --------------------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `codeInterpreterCustomName` | `string`                              | Yes      | The name of the code interpreter. Must start with a letter and can be up to 48 characters long. Pattern: `[a-zA-Z][a-zA-Z0-9_]{0,47}` |
| `description`               | `string`                              | No       | Optional description for the code interpreter. Can have up to 200 characters                                                          |
| `executionRole`             | `iam.IRole`                           | No       | The IAM role that provides permissions for the code interpreter to access AWS services. A new role will be created if not provided    |
| `networkConfiguration`      | `CodeInterpreterNetworkConfiguration` | No       | Network configuration for code interpreter. Defaults to PUBLIC network mode                                                           |
| `tags`                      | `{ [key: string]: string }`           | No       | Tags to apply to the code interpreter resource                                                                                        |

### Basic Code Interpreter Creation

```typescript fixture=default
// Create a basic code interpreter with public network access
const codeInterpreter = new agentcore.CodeInterpreterCustom(this, "MyCodeInterpreter", {
  codeInterpreterCustomName: "my_code_interpreter",
  description: "A code interpreter for Python execution",
});
```

### Code Interpreter with VPC

```typescript fixture=default
const codeInterpreter = new agentcore.CodeInterpreterCustom(this, "MyCodeInterpreter", {
  codeInterpreterCustomName: "my_sandbox_interpreter",
  description: "Code interpreter with isolated network access",
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingVpc(this, {
    vpc: new ec2.Vpc(this, 'VPC', { restrictDefaultSecurityGroup: false }),
  }),
});
```

Code Interpreter exposes a [connections](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Connections.html) property. This property returns
a connections object, which simplifies the process of defining and managing ingress and egress rules for security groups in your AWS CDK applications.
Instead of directly manipulating security group rules, you interact with the Connections object of a construct, which then translates your connectivity
requirements into the appropriate security group rules. For instance:

```typescript fixture=default
const vpc = new ec2.Vpc(this, 'testVPC');

const codeInterpreter = new agentcore.CodeInterpreterCustom(this, "MyCodeInterpreter", {
  codeInterpreterCustomName: "my_sandbox_interpreter",
  description: "Code interpreter with isolated network access",
  networkConfiguration: agentcore.BrowserNetworkConfiguration.usingVpc(this, {
    vpc: vpc,
  }),
});

codeInterpreter.connections.addSecurityGroup(new ec2.SecurityGroup(this, 'AdditionalGroup', { vpc }));
```

So security groups can be added after the browser construct creation. You can use methods like allowFrom() and allowTo() to grant ingress access to/egress
access from a specified peer over a given portRange. The Connections object automatically adds the necessary ingress or egress rules to the security group(s)
associated with the calling construct.

### Code Interpreter with Sandbox Network Mode

```typescript fixture=default
// Create code interpreter with sandbox network mode (isolated)
const codeInterpreter = new agentcore.CodeInterpreterCustom(this, "MyCodeInterpreter", {
  codeInterpreterCustomName: "my_sandbox_interpreter",
  description: "Code interpreter with isolated network access",
  networkConfiguration: agentcore.CodeInterpreterNetworkConfiguration.usingSandboxNetwork(),
});
```

### Code Interpreter with Custom Execution Role

```typescript fixture=default
// Create a custom execution role
const executionRole = new iam.Role(this, "CodeInterpreterExecutionRole", {
  assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
});

// Create code interpreter with custom execution role
const codeInterpreter = new agentcore.CodeInterpreterCustom(this, "MyCodeInterpreter", {
  codeInterpreterCustomName: "my_code_interpreter",
  description: "Code interpreter with custom execution role",
  networkConfiguration: agentcore.CodeInterpreterNetworkConfiguration.usingPublicNetwork(),
  executionRole: executionRole,
});
```

### Code Interpreter IAM Permissions

The Code Interpreter construct provides convenient methods for granting IAM permissions:

```typescript fixture=default
// Create a code interpreter
const codeInterpreter = new agentcore.CodeInterpreterCustom(this, "MyCodeInterpreter", {
  codeInterpreterCustomName: "my_code_interpreter",
  description: "Code interpreter for Python execution",
  networkConfiguration: agentcore.CodeInterpreterNetworkConfiguration.usingPublicNetwork(),
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

### Code interpreter with tags

```typescript fixture=default
// Create code interpreter with sandbox network mode (isolated)
const codeInterpreter = new agentcore.CodeInterpreterCustom(this, "MyCodeInterpreter", {
  codeInterpreterCustomName: "my_sandbox_interpreter",
  description: "Code interpreter with isolated network access",
  networkConfiguration: agentcore.CodeInterpreterNetworkConfiguration.usingPublicNetwork(),
  tags: {
    Environment: "Production",
    Team: "AI/ML",
    Project: "AgentCore",
  },
});
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @alvazjor
```

## Public FAQ

### What are we launching today?

We are excited to announce the launch of our new L2 constructs for Amazon Bedrock AgentCore Tools.
These construct libraries provide high-level abstractions for built-in tools that enhance AI agent capabilities.
Key features include:

- **Browser Tool**: Secure cloud-based browser for web automation with session isolation
- **Code Interpreter**: Secure Python execution in sandbox environments
- **Recording Capabilities**: Session recording and replay for Browser tool
- **Network Modes**: Flexible network configuration for both tools
- **Enterprise Security**: Select whether to run the browser in a virtual private cloud (VPC).

### Why should I use this feature?

The Amazon Bedrock AgentCore Tools L2 constructs offer several compelling advantages:

1. **Enhanced Agent Capabilities**: Enable agents to interact with websites and execute code
2. **Security First**: Sandbox environments and session isolation for safe execution
3. **Observability**: Built-in recording, CloudTrail logging, and session replay
4. **Flexible Configuration**: Choose between public and isolated network modes
5. **Simple Integration**: Easy to add to existing agent applications

These L2 constructs eliminate the complexity of implementing secure web automation and code execution.
Developers can focus on building innovative agent applications with enhanced capabilities.

## Internal FAQ

### Why are we doing this?

Amazon Bedrock AgentCore Tools address critical needs for AI agents:

1. **Web Interaction**: Agents need to interact with websites for real-world tasks
2. **Code Execution**: Many tasks require dynamic code generation and execution
3. **Security Concerns**: Arbitrary code execution poses significant security risks
4. **Observability Requirements**: Enterprises need to audit and monitor agent actions

The L2 constructs address these challenges by providing:

- Secure, isolated execution environments
- Built-in recording and logging
- Simple configuration and deployment
- Enterprise-grade security controls

### Why should we _not_ do this?

AgentCore is failry new and subject to changes.

### What is the technical solution (design) of this feature?

The L2 construct library is built using:

1. **TypeScript with Projen**: Modern tooling for construct development
2. **JSII**: Multi-language support (TypeScript, Python, Java, .NET)
4. **Modular Architecture**: Browser and Code Interpreter as separate constructs

Key design principles:

- **Security by Default**: Sandbox environments and session isolation
- **Sensible Defaults**: Production-ready configurations out of the box
- **Extensibility**: Support for custom configurations
- **Type Safety**: Strong typing for better developer experience

## Interfaces

The construct library provides comprehensive interfaces for Tools services:

### Tool Interfaces

- [BrowserProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#browserprops)
- [CodeInterpreterProps](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#codeinterpreterprops)
- [BrowserNetworkConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#browsernetworkconfiguration)
- [CodeInterpreterNetworkConfiguration](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#codeinterpreternetworkconfiguration)
- [RecordingConfig](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#recordingconfig)

## Classes

### Core Classes

- [Browser](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#browser)
- [CodeInterpreter](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#codeinterpreter)

## Enumerations

- [BrowserNetworkMode](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#browsernetworkmode)
- [CodeInterpreterNetworkMode](https://github.com/krokoko/agent-core-cdk-constructs/blob/main/API.md#codeinterpreternetworkmode)

### Is this a breaking change?

No. This is a new construct library for Amazon Bedrock AgentCore Tools.
It does not affect existing constructs.

### What alternative solutions did you consider?

1. Using third-party browser automation tools - lacks enterprise security
2. Running code execution in Lambda - lacks sandbox isolation
3. Building custom solutions - requires significant development effort

### What are the drawbacks of this solution?

1. Relies on Lambda-based custom resources until CloudFormation support is available
2. AgentCore is in preview and APIs may change
3. Code Interpreter currently limited to Python

### What is the high-level project plan?

**Phase 1: RFC**:

- Submit RFC proposal for creating the AgentCore Tools L2 constructs
- Design the initial interface and helper methods
- Monitor the release of L1 constructs

**Phase 2: Development**:

- Create Browser and Code Interpreter modules
- Create comprehensive unit tests
- Write comprehensive API documentation

**Phase 3: Post-Launch**:

- Publish launch blog and announcement posts
- Regular updates to track AgentCore service changes
- Add support for additional languages in Code Interpreter

### Are there any open issues that need to be addressed later?

1. Waiting for the release of L1 construct for Bedrock AgentCore Tools
2. Replace all custom resources with L1 constructs
3. Consider adding support for additional programming languages in Code Interpreter
