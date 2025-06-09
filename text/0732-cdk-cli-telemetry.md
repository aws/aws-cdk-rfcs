# CDK CLI Telemetry

* **Original Author(s):**: @conroyka
* **Tracking Issue**: #732
* **API Bar Raiser**: @iliapolo

The CDK CLI team currently has no visibility into how the CLI is performing for users.
In order to detect accidental regressions more quickly, and make data-driven decisions on what to work on next,
the CDK CLI will begin to collect anonymous telemetry on user commands.

The purpose of this RFC is to iterate in public. We welcome community feedback on the opt-out mechanism,
on whether you would decide to opt-out,
or on additional telemetry values that we are missing that have proven helpful in other CLIs.

## Data Collection

Before we start, two definitions that will help guide this RFC:

* A **session** corresponds to a CLI command execution.
* An **event** is a collection of metrics related to its **session**.

A **session** has multiple **events**, such as the case with `cdk watch`.
`cdk watch` is a long-running **session** that can invoke the `synth` and `deploy` **events** multiple times.

At the end of each **event**, we will send data to the telemetry service.

### Example

Here’s a snippet of data we will collect for a `deploy` **event** (not a full example, just the important parts):

```json
{
  "identifiers": {
    "sessionId": "737EBA96-6A5F-4B1C-BE6D-FD395B10ECE9", // Uuid generated on each CLI command invocation
    "eventId": "737EBA96-6A5F-4B1C-BE6D-FD395B10ECE9:1", // sessionId + an increment for each additional event in the session
    "installationId": "3F1FD23A-58A9-4C0D-8A82-098D6101B322", // Uuid stored on a local file on the developer"s machine
    "accountId": "d445c5a1b10d4f9c90a4b17769aa84d2e5d5c3da642c4acd392c71a46275e6f9", // optional hash of account ID
    "region": "us-east-1", // optional region being deployed to
  },
  "event": {
    "state": "SUCCESS",
    "eventType": "deploy",
    "command": {
      "path": ["cdk", "deploy", "<REDACTED>"],
      "parameters": {},
      "config": {},
    },
  }
}
```

Alternatively, if deployment fails, the deploy **event** looks like this:

```json
{
  "identifiers": {
    "sessionId": "14B36D48-4DFF-47C3-B0E4-D966DD6DB038",
    "eventId": "14B36D48-4DFF-47C3-B0E4-D966DD6DB038:1",
    "installationId": "3F1FD23A-58A9-4C0D-8A82-098D6101B322",
    "accountId": "DDCA70E4-C73A-4B93-B464-BBA7DCCB6B86",
    "region": "us-east-1",
  },
  "event": {
    "state": "FAIL",
    "eventType": "deploy",
    "command": {
      "path": ["cdk", "deploy", "<REDACTED>"],
      "parameters": {},
      "config": {},
    },
  },
  "error": {
    "name": "ToolkitError",
    "message": "Error: Asset <REDACTED> upload failed: AccessDenied: Access Denied",
    "trace": "    at AssetPublishing.publishAsset (<PATH>/aws-cdk/lib/assets/asset-publishing.js:128:23)
    at CloudFormationDeployment.publishAssets (<PATH>aws-cdk/lib/api/cloudformation-deployment.js:295:41)
    at CloudFormationStackArtifact.prepareForDeployment (<PATH>aws-cdk/lib/api/cdk-toolkit.js:517:12)"
    "logs": "Deploying stack <REDACTED>
    IAM Statement Changes
    ┌───┬─────────────────────────┬────────┬─────────────────────────┬─────────────────────────┬───────────┐
    │   │ Resource                │ Effect │ Action                  │ Principal               │ Condition │
    ├───┼─────────────────────────┼────────┼─────────────────────────┼─────────────────────────┼───────────┤
    │ + │ <REDACTED>              │ Allow  │ sts:AssumeRole          │ Service:lambda.amazonaw │           │
    │   │                         │        │                         │ s.com                   │           │
    └───┴─────────────────────────┴────────┴─────────────────────────┴─────────────────────────┴───────────┘
    (NOTE: There may be security-related changes not in this list. See https://github.com/aws/aws-cdk/issues/1299)

    Bundling asset <PATH>...",
  }
}
```

## Opt-Out

Collecting anonymous data will help the CDK team on two fronts: usage metrics and error debugging.
Both of these aspects will help us better serve CDK customers in the future.
We will ensure that we are not collecting [customer content](https://aws.amazon.com/compliance/data-privacy-faq/#topic-1)
or personally-identifiable information.

You can easily opt-out of sending telemetry data.
Customers can set `toolkit-telemetry: false` in their `cdk.json` configuration files.
Setting `toolkit-telemetry: false` in the CDK App level `cdk.json` will disable telemetry in your CDK App.
Setting `toolkit-telemetry: false` in the `~/.cdk.json` file will disable telemetry across all CDK Apps on the same machine.

We will also respect an environment variable, `CDK_TOOLKIT_TELEMETRY=false`. If set, this will achieve the same effect of disabling telemetry.

Alternatively, you can run the CLI command (which disables telemetry for the CDK App):

```bash
> cdk telemetry --disable
```

## Metrics

Below is an exhaustive list of metrics we will collect, with the reason for each.
It’s important to note that all data we collect will be anonymous.
We are only collecting enumerable values derived from customer input.
For example, in command, we only collect `boolean` or `enum` values but not free text. Any free text will be recorded as a passed-in `boolean`.

| Metric                       | Description                                                                                                                  | Reason                                                                                                                                                                                                                                                                                                          |
|------------------------------|------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CDK CLI Version              | CLI version (x.y.z)                                                                                                          | Collecting this will help us bisect our data by version, which can help us identify problematic versions.                                                                                                                                                                                                       |
| Installation ID              | Uuid stored on local machines executing CLI commands                                                                         | This serves as an alternative to Account ID to help us get a sense of blast radius. Each unique machine will have their own Installation ID, but since multiple different machines can target the same AWS Account this counts a slightly different idea of a 'user'.                                           |
| Hashed Account ID (optional) | Account ID, hashed to be anonymous                                                                                           | This will help us get a sense of blast radius when regressions are identified.                                                                                                                                                                                                                                  |
| Region (optional)            | AWS Region                                                                                                                   | This will help us bisect our data for region-specific issues.                                                                                                                                                                                                                                                   |
| Timestamp                    | The time (generated by the client) the data is sent to our telemetry endpoint                                                | This will help us generate time series graphs.                                                                                                                                                                                                                                                                  |
| Event State                  | The "result" of the event. Possible values are 'SUCCESS', 'FAILURE', 'ABORTED'                                               | This will help us track error rates on each CLI command and alert us to potential regressions before they are reported on GitHub.                                                                                                                                                                               |
| Event Type                   | An identifier for the type of event that produces the data                                                                   | Since we aim to send metrics on a per-event basis, and there could be multiple events in a command execution, this is an enum that identifies what kind of event transpired. Values could be 'synth', 'deploy', etc..                                                                                           |
| Command Path                 | The command and properties entered into the CLI, with any free text redacted                                                 | For example, `cdk deploy myStack` would be turned into `['cdk', 'deploy', '<REDACTED>']` in the telemetry data. We are committed to redacting any customer content, but this information is critical to determine feature usage and will help us make data-driven decisions on what CLI features to prioritize. |
| Command Parameters           | The optional parameters entered into the CLI, with any free text redacted                                                   | Some of our features include parameters, like `cdk deploy --watch`. Again, this information is critical to determine fetaure usage and for us to make data-driven decisions.                                                                                                                                    |
| Configuration                | Additional parameters that may affect the CLI command (i.e. cdk.json / cdk.context.json values), with any free text redacted | This will help us facilitate debugging by providing a comprehensive view of all possible parameters that may affect the behavior of the CLI.                                                                                                                                                                    |
| Operating System             | The operating system that is being used                                                                                      | This will help us debug issues that only affect specific operating systems.                                                                                                                                                                                                                                     |
| CI/CD                        | Whether or not the CLI command is being invoked from a Ci/CD environment                                                     | Data points have a different relevance if they are from a developer's machine for from a CI/CD environment.                                                                                                                                                                                                     |
| Node Version                 | The node version used in the environment                                                                                     | This will help us debug any node-specific issues that arise.                                                                                                                                                                                                                                                    |
| Duration Stats               | The length of the event (and potentially, any smaller denominations that are interesting)                                    | We will monitor the duration of events like (but not limited to) synthesis, deploy, etc..                                                                                                                                                                                                                       |
| Counting Stats               | Various counter metrics derived from your CDK app and CLI execution                                                          | We will monitor how counting stats like (but not limited to) CFN resource count affect the duration of deploy.                                                                                                                                                                                                  |
| Dependencies                 | Relevant AWS dependencies and their versions                                                                                 | We plan to track AWS dependencies that might affect the CLI result, like `aws-cdk-lib`, `jsii`, `projen`, etc..                                                                                                                                                                                                     |
| Error Messages (optional)    | The error message returned, if applicable. Customer content redacted                                                         | Capturing the error message will help us aggregate data on which errors are encountered at a greater rate, as well as help us debug what went wrong in individual use cases.                                                                                                                                    |
| Error Stack Trace (optional) | The stack trace of the error message, if applicable. Customer content redacted                                               | The stack trace will be helpful for individual debugging purposes and is necessary for us to be able to reproduce issues that may arise.                                                                                                                                                                        |
| Error Logs (optional)        | The logs of a failed CLI command, if applicable. Customer content redacted                                                   | Error logs will also help us debug and reproduce issues that we see in the CLI.                                                                                                                                                                                                                                 |
