# AWS CloudWatch Application Signals L2 Construct for Simplifying Enablement

* **Original Author(s):**: @bjrara
* **Tracking Issue**: [#670](https://github.com/aws/aws-cdk-rfcs/issues/670)
* **API Bar Raiser**: @moelasmar

The `application-signals-integration` module is a collection of L2 constructs which leverages native L1 CFN resources, simplifying the enablement steps
and the creation of Application Signals resources. This addresses key challenges in the current CDK enablement process, which requires complex manual
configurations for ECS customers, including container setup, volume management, and extensive environment variable configuration. Application Signals
is designed to be flexible and is supported for other platforms as well. However, the initial focus is on supporting ECS, with plans to potentially
extend support to other platforms in the future.

## Working Backwards

### CHANGELOG

`feat(aws-applicationsignals-alpha): introduce Application Signals L2 constructs for simplifying the enablement steps`

### README

#### ApplicationSignalsTaskDefinition

`ApplicationSignalsTaskDefinition` is a construct to update an existing TaskDefinition with Application Signals auto-instrumentation configurations,
and attach required IAM permission **CloudWatchAgentServerPolicy** to the Task role, mentioned in the [ECS onboarding guidance](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Signals-ECS-Sidecar.html#CloudWatch-Application-Signals-Enable-ECS-IAM).

| Name                  | Type                                                                                                      | Description                                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| taskDefinition        | [ecs.TaskDefinition](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.TaskDefinition.html) | The task definition to render.                                                                                                                                                                                                                                                   |
| instrumentation       | [InstrumentationProps](#instrumentationprops)                                                             | The auto-instrumentation configuration.                                                                                                                                                                                                                                          |
| serviceName?          | string                                                                                                    | The serivce identifier in Application Signals.<br>Default: the input task definition name.                                                                                                                                                                                       |
| overrideEnvironments? | [EnvironmentExtension](#environmentextension)[]                                                           | The Application Signals reserved envrionment variables to overwrite on the main container. For the complete list, see [Environment variables injected by Application Signals auto-instrumentation](#environment-variables-injected-by-application-signals-auto-instrumentation). |
| cloudWatchAgent?      | [CloudWatchAgentProps](#cloudwatchagentprops)                                                             | The CloudWatch agent sidecar configuration.<br>Default: enables a basic agent sidecar container with latest public image.                                                                                                                                                        |

#### InstrumentationProps

| Name                    | Type                                                                                                        | Description                                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| instrumentationLanguage | InstrumentationLanguage (enum)                                                                              | The langugage SDK to be auto-instrumented.<br>One of the following enum values:<br>`JAVA`<br>`PYTHON`<br>`DOTNET`<br>`NODEJS`                                                                                                                                     |
| sdkVersion              | Instrumentation (enum)                                                                                      | The ADOT language SDK version to be used.                                                                                                                                                                                                                         |
| runtimePlatform?        | [ecs.RuntimePlatform](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.RuntimePlatform.html) | The runtime platform.<br>The value inherits from the [ecs.RuntimePlatform](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.RuntimePlatform.html) specified through the input task definition or defaults to linux-x64 if it isn't custom defined. |

#### EnvironmentExtension

| Name  | Type   | Description                                       |
| ----- | ------ | ------------------------------------------------- |
| name  | string | The environment variable name to be overwritten.  |
| value | string | The environment variable value to be overwritten. |

#### CloudWatchAgentProps

| Name           | Type                                                                                                                              | Description                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| enableSidecar? | boolean                                                                                                                           | Inject CloudWatch agent as a sidecar container.<br>Default: true.                                                                                                                                                |
| container?     | [ecs.ContainerDefinitionOptions](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ContainerDefinitionOptions.html) | The CloudWatch agent container definitionoptionaldefault: a basic agent container with latest public image, see [Default CloudWatch Agent Container Definition](#default-cloudwatch-agent-container-definition). |

#### Environment variables injected by Application Signals auto-instrumentation

The following constants are provided to list all the environment variables injected by the Application Signals auto-instrumentation,
along with their potential override values. The default value is noted with `*` if multiple options are available.

##### Common Exporting Constants

| Constant Name                                    | Values                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_PROTOCOL`                    | `OTEL_EXPORTER_OTLP_PROTOCOL_HTTP_PROTOBUF`                                                        |
| `OTEL_AWS_APPLICATION_SIGNALS`                   | *`OTEL_AWS_APPLICATION_SIGNALS_ENABLED`<br>`OTEL_AWS_APPLICATION_SIGNALS_DISABLED`                 |
| `OTEL_AWS_APPLICATION_SIGNALS_RUNTIME`           | *`OTEL_AWS_APPLICATION_SIGNALS_RUNTIME_ENABLED`<br>`OTEL_AWS_APPLICATION_SIGNALS_RUNTIME_DISABLED` |
| `OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT` | `OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT_LOCAL_CWA`                                         |

##### Logs Exporting Constants

| Constant Name        | Values                                                  |
| -------------------- | ------------------------------------------------------- |
| `OTEL_LOGS_EXPORTER` | *`OTEL_LOGS_EXPORTER_NONE`<br>`OTEL_LOGS_EXPORTER_OTLP` |

##### Metrics Exporting Constants

| Constant Name           | Values                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `OTEL_METRICS_EXPORTER` | *`OTEL_METRICS_EXPORTER_NONE`<br>`OTEL_METRICS_EXPORTER_OTLP` |

##### Trace Exporting Constants

| Constant Name                        | Values                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT_LOCAL_CWA`                                                                                                                                                                                                                                                 |
| `OTEL_TRACES_SAMPLER`                | *`OTEL_TRACES_SAMPLER_XRAY`<br>`OTEL_TRACES_SAMPLER_TRACEID_RATIO`<br>`OTEL_TRACES_SAMPLER_ALWAYS_ON`<br>`OTEL_TRACES_SAMPLER_ALWAYS_OFF`<br>`OTEL_TRACES_SAMPLER_PARENT_BASED_TRACEID_RATIO`<br>`OTEL_TRACES_SAMPLER_PARENT_BASED_ALWAYS_ON`<br>`OTEL_TRACES_SAMPLER_PARENT_BASED_ALWAYS_OFF` |
| `OTEL_TRACES_SAMPLER_ARG`            | `OTEL_TRACES_SAMPLER_ARG_LOCAL_CWA`                                                                                                                                                                                                                                                            |
| `OTEL_PROPAGATORS`                   | `OTEL_PROPAGATORS_APPLICATION_SIGNALS`                                                                                                                                                                                                                                                         |

##### Java Instrumentation Constants

| Constant Name       | Values                   |
| ------------------- | ------------------------ |
| `JAVA_TOOL_OPTIONS` | `JAVA_TOOL_OPTIONS_ADOT` |

##### Python Instrumentation Constants

| Constant Name              | Values                                      |
| -------------------------- | ------------------------------------------- |
| `OTEL_PYTHON_DISTRO`       | `OTEL_PYTHON_DISTRO_AWS_DISTRO`             |
| `OTEL_PYTHON_CONFIGURATOR` | `OTEL_PYTHON_CONFIGURATOR_AWS_CONFIGURATOR` |
| `PYTHONPATH`               | `PYTHONPATH_ADOT`                           |

##### DOTNET Instrumentation Constants

| Constant Name              | Values                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| `OTEL_DOTNET_DISTRO`       | `OTEL_DOTNET_DISTRO_AWS_DISTRO`                                              |
| `OTEL_DOTNET_CONFIGURATOR` | `OTEL_DOTNET_CONFIGURATOR_AWS_CONFIGURATOR`                                  |
| `OTEL_DOTNET_AUTO_PLUGINS` | `OTEL_DOTNET_AUTO_PLUGINS_ADOT`                                              |
| `CORECLR_ENABLE_PROFILING` | *`CORECLR_ENABLE_PROFILING_ENABLED`<br>`CORECLR_ENABLE_PROFILING_DISABLED`   |
| `CORECLR_PROFILER`         | `CORECLR_PROFILER_OTEL`                                                      |
| `CORECLR_PROFILER_PATH`    | `CORECLR_PROFILER_PATH_LINUX_X64`<br>`CORECLR_PROFILER_PATH_WINDOWS_X64`     |
| `DOTNET_STARTUP_HOOKS`     | `DOTNET_STARTUP_HOOKS_LINUX_ADOT`<br>`DOTNET_STARTUP_HOOKS_WINDOWS_ADOT`     |
| `DOTNET_ADDITIONAL_DEPS`   | `DOTNET_ADDITIONAL_DEPS_LINUX_ADOT`<br>`DOTNET_ADDITIONAL_DEPS_WINDOWS_ADOT` |
| `OTEL_DOTNET_AUTO_HOME`    | `OTEL_DOTNET_AUTO_HOME_LINUX_ADOT`<br>`OTEL_DOTNET_AUTO_HOME_WINDOWS_ADOT`   |
| `DOTNET_SHARED_STORE`      | `DOTNET_SHARED_STORE_LINUX_ADOT`<br>`DOTNET_SHARED_STORE_WINDOWS_ADOT`       |

#### Default CloudWatch Agent Container Definition

```json
{
  "name": "cloudwatch-agent",
  // For Windows, the image tag will be different based on
  // the os version: latest-windowsservercore2019/latest-windowsservercore2022
  "image": "amazon/cloudwatch-agent:latest",
  "cpu": 0,
  "memoryReservation": 50,
  "portMappings": [
    {
      "containerPort": 4316,
      "hostPort": 4316,
      "protocol": "tcp"
    },
    {
      "containerPort": 2000,
      "hostPort": 2000,
      "protocol": "tcp"
    }
  ],
  "essential": false,
  "environment": [
    {
      "name": "CW_CONFIG_CONTENT",
      "value": "{\"logs\":{\"metrics_collected\":{\"application_signals\":{\"enabled\":true}}},\"traces\":{\"traces_collected\":{\"application_signals\":{\"enabled\":true}}}}"
    }
  ],
  "user": "0:1338",
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-stream-prefix": "cloudwatch-agent"
    }
  }
}
```

#### Use Case 1 - Enable Application Signals on a Java application, with CloudWatch agent deployed as a sidecar

```js
new ApplicationSignalsIntegration(this, 'ApplicationSignalsIntegration', taskDefinition, {
  instrumentation: {
    language: InstrumentationLanguage.JAVA,
    sdkVersion: Instrumentation.JAVA_1_32_6
  },
  serviceName: 'sample-app',
  cloudWatchAgent: {
    enableSidecar: true,
  }
})
```

#### Use Case 2 - Enable Application Signals on a Python application, with CloudWatch agent deployed as a daemon

The example overwrites the following environment variables to update the CloudWatch agent endpoints to use the namespace configured using service connect.

* `OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT`
* `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
* `OTEL_TRACES_SAMPLER_ARG`

```js
const cwAgentService = new ecs.Ec2Service(this, 'CwAgentDaemonService', {
    cluster,
    taskDefinition: cwAgentTaskDefinition,
    daemon: true, // Runs one container per EC2 instance
    serviceConnectConfiguration: {
    namespace: namespace.namespaceArn,
    services: [{
        portMappingName: 'cwagent-4316',
        dnsName: 'cwagent-4316-http',
        port: 4316
    }, {
        portMappingName: 'cwagent-2000',
        dnsName: 'cwagent-2000-http',
        port: 2000
    }]
    }
});

new ApplicationSignalsIntegration(this, 'ApplicationSignalsIntegration', taskDefinition, {
  instrumentation: {
    language: InstrumentationLanguage.PYTHON,
    sdkVersion: Instrumentation.PYTHON_V0_7_0
  },
  overrideEnvironments: [{
    name: constants.CommonExporting.OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT,
    value: "http://cwagent-4316-http:4316/v1/metrics"
  }, {
    name: constants.TraceExporting.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    value: "http://cwagent-4316-http:4316/v1/traces"
  }, {
    name: constants.TraceExporting.OTEL_TRACES_SAMPLER_ARG,
    value: "endpoint=http://cwagent-2000-http:2000"
  }],
  serviceName: 'sample-app',
  cloudWatchAgent: {
    enableSidecar: false,
  }
})
```

#### Use Case 3 - Enable Application Signals on a .NET application on Windows servers

As .NET has different environment variable value for `CORECLR_PROFILER_PATH` depending on the operating system and CPU architecture
(see [Environment variables injected by Application Signals auto-instrumentation](#environment-variables-injected-by-application-signals-auto-instrumentation)),
please configure the runtimePlatform if your application is not running on Linux-x64.

```js
new ApplicationSignalsIntegration(this, 'ApplicationSignalsIntegration', taskDefinition, {
  instrumentation: {
    language: InstrumentationLanguage.DOTNET,
    sdkVersion: Instrumetnation.DOTNET_V1_4_0,
    runtimePlatform: {
      operatingSystemFamily: ecs.OperatingSystemFamily.WINDOWS_SERVER_2019_CORE,
      cpuArchitecture: CpuArchitecture.X86_64
    }
  },
  serviceName: 'dotnet-sample-app',
  cloudWatchAgent: {
    enableSidecar: true,
  }
})
```

#### Use Case 4 - Overwrite the default CloudWatch agent sidecar container

The following example demonstrates how to customize the CloudWatch agent configuration used by the sidecar container, otherwise the
[Default CloudWatch Agent Container Definition](#default-cloudwatch-agent-container-definition) will be used.

```js
new ApplicationSignalsIntegration(this, 'ApplicationSignalsIntegration', taskDefinition, {
  instrumentation: {
    language: InstrumentationLanguage.JAVA,
    sdkVersion: Instrumentation.JAVA_1_32_6
  },
  serviceName: 'sample-app',
  cloudWatchAgent: {
    enableSidecar: true,
    container: {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:1.300051.0b992'),
      environment: {
        CW_CONFIG_CONTENT: 'YOUR_CUSTOM_CONFIG'
      },
      logging: new ecs.AwsLogDriver({ streamPrefix: 'cloudwatch-agent' }),
      memoryReservationMiB: 50,
      portMappings: [{
        containerPort: 4316,
        hostPort: 4316,
      }, {
        containerPort: 2000,
        hostPort: 2000,
      }]
    }
  }
})
```

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
RFC pull request):

```text
[x] Signed-off by API Bar Raiser @moelasmar
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
    3. Adding a new non-essential init container with ADOT auto-instrumentation image.
    To avoid container name conflicts, the name of the init container will be generated with an unique identifier.
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

The new feature introduces an L2 construct (ApplicationSignalsTaskDefinition) that automates step 1 and step 2 (including the 5 sub-steps by automatically
handling all TaskDefinition configurations. A key advantage of this approach is its seamless integration with existing CDK workflows. Customers can
maintain their current TaskDefinition configuration process while enabling Application Signals by simply wrapping their existing TaskDefinition with
`ApplicationSignalsTaskDefinition`. All necessary modifications and configurations are handled automatically behind the scenes, requiring no changes
to their established CDK implementation patterns.

##### 2.1. Required Inputs

Other than the original TaskDefinition, the new construct requires essential information through
[InstrumentationProps](#instrumentationprops) for appropriate configuration injection.

1. The application language and the SDK version
    1. To decide the right image and image tag of the init container,
       e.g. `public.ecr.aws/aws-observability/adot-autoinstrumentation-$lang:$$adot_sdk_version`
    2. To decide the language specific environment varirables to be injected into the application container.
       See [Environment variables injected by Application Signals auto-instrumentation](#environment-variables-injected-by-application-signals-auto-instrumentation).
2. The OS and the CPU architecture
    1. To decide the image tag of CloudWatch Agent.
       E.g. the linux tag is `latest` and the windows image tag is `latest-windowsservercore2022`.
    2. To decide what value to be set in `CORECLR_PROFILER_PATH`  for .NET applications.
       See [DOTNET Instrumentation Constants](#dotnet-instrumentation-constants)

```js
export enum InstrumentationLanguage {
  JAVA, PYTHON, DOTNET, NODEJS
}

export enum Instrumentation {
  // This is just an example, the actual provided versions will be different.
  JAVA_1_32_6,
  PYTHON_V0_7_0,
  DOTNET_V1_4_0,
  NODEJS_V0_5_0
}

export interface InstrumentationProps {
  // The application language
  readonly language: InstrumentationLanguage;

  // The ADOT language SDK version to be used
  readonly sdkVersion: Instrumentation;

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
[EnvironmentExtension](#environmentextension) and [CloudWatchAgentProps](#cloudwatchagentprops).

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
