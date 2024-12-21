# AWS CloudWatch Application Signals L2 Construct for Simplifying Enablement

* **Original Author(s):**: @bjrara
* **Tracking Issue**: [#670](https://github.com/aws/aws-cdk-rfcs/issues/670)
* **API Bar Raiser**: @moelasmar

The application-signals-integration module is a collection of L2 constructs which leverages native L1 CFN resources, simplifying the enablement steps
and the creation of Application Signals resources. The new L2 construct for enablement addresses key challenges in the current ECS CDK enablement
process, which requires complex manual configurations, including new container setup, volume management, and extensive environment variable configuration.

## Working Backwards

### CHANGELOG

`feat(cloudwatch): introduce Application Signals L2 construct for simplifying the enablement steps.`

### README

#### ApplicationSignalsTaskDefinition

`ApplicationSignalsTaskDefinition` is a construct to update an existing TaskDefinition with Application Signals auto-instrumentation configurations.

|Name |Type |Description |
|--- |--- |--- |
|taskDefinition |[ecs.TaskDefinition](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.TaskDefinition.html) |The task definition to render. |
|instrumentation |[InstrumentationProps](https://quip-amazon.com/OdXQA04nJ3Fv#temp:C:TaA589601f465f847c4aadd74516) |The auto-instrumentation configuration. |
|serviceName? |string |The serivce identifier in Application Signals.<br>Default: the input task definition name. |
|overrideEnvironments? |[EnvironmentExtension](https://quip-amazon.com/OdXQA04nJ3Fv#temp:C:TaA4e452437b4f9453183557666b)[] |The Application Signals reserved envrionment variables to overwrite on the main container. |
|cloudWatchAgent? |[CloudWatchAgentProps](https://quip-amazon.com/OdXQA04nJ3Fv#temp:C:TaA7a894d0dca304d6f818a5d62c) |The CloudWatch agent sidecar configuration.<br>Default: enables a basic agent sidecar container with latest public image. |

#### InstrumentationProps

|Name |Type |Description |
|--- |--- |--- |
|instrumentationLanguage |InstrumentationLanguage (enum) |The langugage SDK to be auto-instrumented.<br>One of the following enum values:<br>*JAVA<br>* PYTHON<br>*DOTNET<br>* NODEJS |
|sdkVersion |string |The language SDK version to be used. |
|runtimePlatform? |[ecs.RuntimePlatform](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.RuntimePlatform.html) | The runtime platform.<br>The value inherits from the [runtimePlatform](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.RuntimePlatform.html) specified through the input task definition or defaults to linux-x64 if undefined. |

#### EnvironmentExtension

|Name |Type |Description |
|--- |--- |--- |
|name |string |The environment variable name to be overwritten. |
|value |string |The environment variable value to be overwritten. |

#### CloudWatchAgentProps

|Name |Type |Description |
|--- |--- |--- |
|enableSidecar? |boolean |Inject CloudWatch agent as a sidecar container.<br>Default: true. |
|container? |[ContainerDefinition](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ContainerDefinition.html) |The CloudWatch agent container definition to be used.<br>Default: a basic agent container with the latest public image |

#### Use Case 1 - Enable Application Signals on a Java application, with CloudWatch agent deployed as a sidecar

```js
new ApplicationSignalsIntegration(this, 'ApplicationSignalsIntegration', taskDefinition, {
  instrumentation: {
    language: InstrumentationLanguage.JAVA,
    sdkVersion: 'v1.32.6',
  },
  serviceName: 'sample-app',
  cloudWatchAgent: {
    enableSidecar: true,
  }
})
```

#### Use Case 2 - Enable Application Signals on a Python application, with CloudWatch agent deployed as a daemon

```js
new ApplicationSignalsIntegration(this, 'ApplicationSignalsIntegration', taskDefinition, {
  instrumentation: {
    language: InstrumentationLanguage.PYTHON,
    sdkVersion: 'v0.7.0'
  },
  overrideEnvironments: [{
    name: "OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT",
    value: "http://cwagent-4316-http:4316/v1/metrics"
  }, {
    name: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    value: "http://cwagent-4316-http:4316/v1/traces"
  }, {
    name: "OTEL_TRACES_SAMPLER_ARG",
    value: "endpoint=http://cwagent-2000-http:2000"
  }],
  serviceName: 'sample app',
  cloudWatchAgent: {
    enableSidecar: false,
  }
})
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```text
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching a new L2 construct `ApplicationSignalsTaskDefinition` to simplify the enablement steps to onboard Application Signals for ECS customers.

### Why should I use this feature?

It automates the Application Signals configuration when defining the ECS TaskDefinition, eliminating complex manual setup work and reducing potential
configuration errors.

## Internal FAQ

### Why are we doing this?

We're introducing this feature to improve the customer experience with Application Signals by eliminating complex manual setup requirements for ECS.
Currently, customers face frustration due to time-consuming configuration processes and frequent setup errors, which often leads to hours spent
troubleshooting instead of actually using the product features. By automating these setup steps, we aim to provide a smoother onboarding experience and
enable customers to focus on utilizing the product's actual capabilities more quickly.

ECS is not the only platform Application Signals supports today. On some platforms, this complaint is minor with the integration of other components,
such as add-on on EKS, operator on native Kubernetes, and vended layer on Lambda. The pain point is most prominent on ECS and EC2.

### Why should we *not* do this?

We should not using this feature if granular control over the TaskDefinition configuration is required. While the automation simplifies setup, it may
not be suitable for cases where manually customizing specific fields or maintaining precise control over the TaskDefinition settings is needed. In
such cases, stick with the existing L1 ECS TaskDefinition construct for manual configuration.

### What is the technical solution (design) of this feature?

#### 1. Current enablement process

At high level, the customers are required to execute the following steps to onboard Application Signals.

1. Add additional CloudWatch agent permission to the Task Role.
2. Instrument ECS [TaskDefinition](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html) with 5 steps.
    1. Configuring the bind mount volume to provide a volume for auto-instrumentation.
    2. Adding a new non-essential CloudWatch agent sidecar.
        1. *Not required when using CloudWatch agent as daemon on ECS on EC2.*
    3. Adding a new non-essential `init` container with ADOT auto-instrumentation image.
    4. Adding the required environment variables to the user application container.
    5. Mounting the volume defined in \<2.i\> to the container created in \<2.iii\> and the container updated in \<2.iv\>.
3. Deploy the application with the updated task definition.

The final TaskDefinition will be provisioned as illustrated in the following diagram.

```text
    --------                                    -----------------
--- | main | ---------------------------------- | shared volume |
|   --------                                    -----------------
|       | copy the auto-instrumentation agent from    |
|       | init into main for data collection          |
|   --------                                          |
|   | init | ------------------------------------------
|   --------
|
| the auto-instrumentation agent sends monitoring data to the CloudWatch Agent
|
|   -----------
--- | cwagent |
    -----------
```

The init container is a short-lived container that copies the auto-instrumentation agent to the main container for data collection through the shared
volume. The auto-instrumentation agent will be hooked into the application process on start, generating monitoring data (mainly traces and metrics)
and sending them to the CloudWatch Agent. The CloudWatch Agent will further process the data received and export to the CloudWatch backend service.

#### 2. Automated solution

The new feature introduces an L2 construct (ApplicationSignalsTaskDefinition) that automates step 2 (including the 5 sub-steps by automatically
handling all TaskDefinition configurations. A key advantage of this approach is its seamless integration with existing CDK workflows. Customers can
maintain their current TaskDefinition configuration process while enabling Application Signals by simply wrapping their existing TaskDefinition with
`ApplicationSignalsTaskDefinition`. All necessary modifications and configurations are handled automatically behind the scenes, requiring no changes
to their established CDK implementation patterns.

##### 2.1. Required Inputs

Other than the original TaskDefinition, the new construct requires essential information through
[InstrumentationProps](https://quip-amazon.com/OdXQA04nJ3Fv#temp:C:TaA5aafc56e072f4736ab860ad1b) for appropriate configuration injection.

1. The application language and the SDK version
    1. To decide the right image and image tag of the init container.
       E.g. `public.ecr.aws/aws-observability/adot-autoinstrumentation-$lang:$version`
    2. To decide the language specific environment varirables to be injected into the application container.
       See [Environment variables required by Application Signals auto-instrumentation](#environment-variables-required-by-application-signals-auto-instrumentation).
2. The OS and the CPU architecture
    1. To decide the image tag of CloudWatch Agent.
       E.g. the linux tag is `latest` and the windows image tag is `latest-windowsservercore2022`.
    2. To decide what value to be set in `CORECLR_PROFILER_PATH`  for .NET applications.
       See [DOTNET Linux x64](#dotnet-linux-x64), [DOTNET Linux ARM64](#dotnet-linux-arm64) and [DOTNET Windows](#dotnet-windows)

```js
export enum InstrumentationLanguage {
  JAVA, PYTHON, DOTNET, NODEJS
}

export interface InstrumentationProps {
  // The application language
  readonly language: InstrumentationLanguage;

  // The SDK version, should match the image tag of the ADOT auto-instrumentation ECR repositories
  readonly sdkVersion: string;

  // The OS and CPU architecture used by the Task, defaults to linux-x64
  readonly runtimePlatform?: ecs.RuntimePlatform;
}
```

**Note**
The SDK version is the image tag from the following ECR repository:

1. <https://gallery.ecr.aws/aws-observability/adot-autoinstrumentation-java>
2. <https://gallery.ecr.aws/aws-observability/adot-autoinstrumentation-python>
3. <https://gallery.ecr.aws/aws-observability/adot-autoinstrumentation-node>
4. <https://gallery.ecr.aws/aws-observability/adot-autoinstrumentation-dotnet>

##### 2.2. Validation

ApplicationSignalsTaskDefinition will validate:

1. That the CloudWatch agent daemon deployment mode (enableSidecar=false) can only be used on ECS on EC2.

ApplicationSignalsTaskDefinition won't validate:

1. The correctness of the SDK version configured.

##### 2.3. Override Mechanism

Additionally, the new construct provides overrides mechanism through
[EnvironmentExtension](https://quip-amazon.com/OdXQA04nJ3Fv#temp:C:TaA274e82dd0c8a4c0d8d7408938) and [CloudWatchAgentProps](https://quip-amazon.com/OdXQA04nJ3Fv#temp:C:TaA978c452c7e73434db47a0ae88).

### Is this a breaking change?

No.

### What alternative solutions did you consider?

N/A

### What are the drawbacks of this solution?

N/A

### What is the high-level project plan?

* [ ]  Gather feedback on the RFC
* [ ]  Get bar raiser to sign off on RFC
* [ ]  Make pull request to aws-cdk repository
* [ ]  Iterate and respond to PR feedback
* [ ]  Merge new construct and related changes

### Are there any open issues that need to be addressed later?

## Appendix

### Environment variables required by Application Signals auto-instrumentation

#### Common

```js
const DEFAULT_ENVS = [
  {
    "name": "OTEL_LOGS_EXPORTER",
    "value": "none"
  },
  {
    "name": "OTEL_METRICS_EXPORTER",
    "value": "none"
  },
  {
    "name": "OTEL_EXPORTER_OTLP_PROTOCOL",
    "value": "http/protobuf"
  },
  {
    "name": "OTEL_AWS_APPLICATION_SIGNALS_ENABLED",
    "value": "true"
  },
  {
    "name": "OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT",
    "value": "http://localhost:4316/v1/metrics"
  },
  {
    "name": "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    "value": "http://localhost:4316/v1/traces"
  },
  {
    "name": "OTEL_TRACES_SAMPLER",
    "value": "xray"
  },
  {
    "name": "OTEL_TRACES_SAMPLER_ARG",
    "value": "endpoint=http://localhost:2000"
  },
  {
    "name": "OTEL_PROPAGATORS",
    "value": "tracecontext,baggage,b3,xray"
  }
];
```

#### Java

```js
const JAVA_ENVS = [
  {
    "name": "JAVA_TOOL_OPTIONS",
    "value": " -javaagent:/otel-auto-instrumentation/javaagent.jar"
  }
]
```

#### Python

```js
const PYTHON_ENVS = [
  {
    "name": "OTEL_PYTHON_DISTRO",
    "value": "aws_distro"
  },
  {
    "name": "OTEL_PYTHON_CONFIGURATOR",
    "value": "aws_configurator"
  },
  {
    "name": "PYTHONPATH",
    "value": "/otel-auto-instrumentation-python/opentelemetry/instrumentation/auto_instrumentation:/otel-auto-instrumentation-python"
  }
];
```

#### DOTNET Common

```js
const DOTNET_COMMON_ENVS = [
  {
    "name": "OTEL_DOTNET_DISTRO",
    "value": "aws_distro"
  },
  {
    "name": "OTEL_DOTNET_CONFIGURATOR",
    "value": "aws_configurator"
  },
  {
    "name": "OTEL_DOTNET_AUTO_PLUGINS",
    "value": "AWS.Distro.OpenTelemetry.AutoInstrumentation.Plugin, AWS.Distro.OpenTelemetry.AutoInstrumentation"
  },
];
```

#### DOTNET Linux Common

```js
const DOTNET_LINUX_ENVS = [
  {
    "name": "CORECLR_ENABLE_PROFILING",
    "value": "1"
  },
  {
    "name": "CORECLR_PROFILER",
    "value": "{918728DD-259F-4A6A-AC2B-B85E1B658318}"
  },
  {
    "name": "CORECLR_PROFILER_PATH",
    "value": "/otel-auto-instrumentation-dotnet/linux-x64/OpenTelemetry.AutoInstrumentation.Native.so"
  },
  {
    "name": "DOTNET_STARTUP_HOOKS",
    "value": "/otel-auto-instrumentation-dotnet/net/OpenTelemetry.AutoInstrumentation.StartupHook.dll"
  },
  {
    "name": "DOTNET_ADDITIONAL_DEPS",
    "value": "/otel-auto-instrumentation-dotnet/AdditionalDeps"
  },
  {
    "name": "OTEL_DOTNET_AUTO_HOME",
    "value": "/otel-auto-instrumentation-dotnet"
  },
  {
    "name": "DOTNET_SHARED_STORE",
    "value": "/otel-auto-instrumentation-dotnet/store"
  }
];
```

#### DOTNET Linux x64

```js
{
  "name": "CORECLR_PROFILER_PATH",
  "value": "/otel-auto-instrumentation-dotnet/linux-x64/OpenTelemetry.AutoInstrumentation.Native.so"
}
```

#### DOTNET Linux ARM64

```js
{
  "name": "CORECLR_PROFILER_PATH",
  "value": "/otel-auto-instrumentation-dotnet/linux-arm/OpenTelemetry.AutoInstrumentation.Native.so"
}
```

#### DOTNET Windows

```js
const DOTNET_WINDOWS_ENVS = [
  {
    "name": "CORECLR_ENABLE_PROFILING",
    "value": "1"
  },
  {
    "name": "CORECLR_PROFILER",
    "value": "{918728DD-259F-4A6A-AC2B-B85E1B658318}"
  },
  {
    "name": "CORECLR_PROFILER_PATH",
    "value": "C:\\otel-auto-instrumentation-dotnet\\win-x64\\OpenTelemetry.AutoInstrumentation.Native.dll"
  },
  {
    "name": "DOTNET_STARTUP_HOOKS",
    "value": "C:\\otel-auto-instrumentation-dotnet\\net\\OpenTelemetry.AutoInstrumentation.StartupHook.dll"
  },
  {
    "name": "DOTNET_ADDITIONAL_DEPS",
    "value": "C:\\otel-auto-instrumentation-dotnet\\AdditionalDeps"
  },
  {
    "name": "OTEL_DOTNET_AUTO_HOME",
    "value": "C:\\otel-auto-instrumentation-dotnet"
  },
  {
    "name": "DOTNET_SHARED_STORE",
    "value": "C:\\otel-auto-instrumentation-dotnet\\store"
  }
];
```
