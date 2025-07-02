# CDK CLI Telemetry

* **Original Author(s):**: @conroyka
* **Tracking Issue**: #732
* **API Bar Raiser**: @iliapolo

The CDK CLI team currently has limited visibility into how the CLI is performing for users.
In order to detect accidental regressions more quickly, and make data-driven decisions on what to work on next,
the CDK CLI will begin to collect anonymous telemetry on user commands.

The purpose of this RFC is to iterate in public. We welcome community feedback on the opt-out mechanism,
on whether you would decide to opt-out,
or on additional telemetry values that we are missing that have proven helpful in other CLIs.

## Data Collection

Before we start, two definitions that will help guide this RFC:

* A **session** corresponds to a CLI command execution.
* An **event** is a specific _action_ taking place within a **session**.

A **session** can have multiple **events**, and an **event** can have multiple **metrics**.
Such as the case of `cdk watch`, which is a long-running **session** that contains the
`synth` and `deploy` **events** multiple times.

The CLI will send events to the telemetry service in batches.

### Example

Here’s a snippet of data we will collect for a `deploy` **event** (not a full example, just the important parts):

For more information on what gets sanitized, see [Customer Content](#customer-content).

```jsonc
{
  "identifiers": {
    "sessionId": "737EBA96-6A5F-4B1C-BE6D-FD395B10ECE9", // UUID generated on each CLI command invocation
    "eventId": "737EBA96-6A5F-4B1C-BE6D-FD395B10ECE9:1", // sessionId + an increment for each additional event in the session
    "installationId": "3F1FD23A-58A9-4C0D-8A82-098D6101B322", // UUID stored on a local file on the developer"s machine
    "accountId": "d445c5a1b10d4f9c90a4b17769aa84d2e5d5c3da642c4acd392c71a46275e6f9", // optional hash of account ID
    "region": "us-east-1", // optional region being deployed to
  },
  "event": {
    "state": "SUCCESS",
    "eventType": "deploy",
    "command": {
      "path": ["cdk", "deploy", "$STACK1"],
      "parameters": {},
      "config": {},
    },
  }
}
```

Alternatively, if deployment fails, the deploy **event** looks like this:

```jsonc
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
      "path": ["cdk", "deploy", "$STACK1"],
      "parameters": {},
      "config": {},
    },
  },
  "error": {
    "name": "ToolkitError",
    "message": "Error: Asset $ASSET1 upload failed: AccessDenied: Access Denied",
    "trace": "    at AssetPublishing.publishAsset (/aws-cdk/lib/assets/asset-publishing.js:128:23)
    at CloudFormationDeployment.publishAssets (/aws-cdk/lib/api/cloudformation-deployment.js:295:41)
    at CloudFormationStackArtifact.prepareForDeployment (/aws-cdk/lib/api/cdk-toolkit.js:517:12)",
    "logs": "Deploying stack $STACK1
    IAM Statement Changes
    ┌───┬─────────────────────────┬────────┬─────────────────────────┬─────────────────────────┬───────────┐
    │   │ Resource                │ Effect │ Action                  │ Principal               │ Condition │
    ├───┼─────────────────────────┼────────┼─────────────────────────┼─────────────────────────┼───────────┤
    │ + │ $ARN              │ Allow  │ sts:AssumeRole          │ Service:lambda.amazonaw │           │
    │   │                         │        │                         │ s.com                   │           │
    └───┴─────────────────────────┴────────┴─────────────────────────┴─────────────────────────┴───────────┘
    (NOTE: There may be security-related changes not in this list. See https://github.com/aws/aws-cdk/issues/1299)

    Bundling asset $ASSET1",
  }
}
```

## Opt-Out

Collecting anonymous data will help the CDK team on two fronts: usage metrics and error debugging.
Both of these aspects will help us better serve CDK customers in the future.
We do not collect [customer content](https://aws.amazon.com/compliance/data-privacy-faq/#topic-1) and we anonymize the telemetry we do collect.

You can opt-out of sending telemetry data.
Customers can set `cli-telemetry: false` in their `cdk.json` configuration files.
Setting `cli-telemetry: false` in the CDK App level `cdk.json` will disable telemetry in your CDK App.
Setting `cli-telemetry: false` in the `~/.cdk.json` file will disable telemetry across all CDK Apps on the same machine.

We will also respect an environment variable, `CDK_DISABLE_CLI_TELEMETRY=true`.
If set, this will achieve the same effect of disabling cli telemetry in that environment.

Alternatively, you can run a new CDK CLI command:

```bash
> cdk cli-telemetry --disable/--enable
```

This will record the action to your local `cdk.json` file, which affects the current CDK App only.

## Metrics

Below is an exhaustive list of metrics we will collect, with the reason for each.
It’s important to note that all data we collect will be anonymous.
We are only collecting enumerable values derived from your input.

In `command`, we only collect `boolean` or `enum` values but not free text. Any free text will be recorded as a passed-in `boolean`.
The below example shows what we record if `--bootstrap-kms-key-id` (typed as a `string`)
is set:

```bash
> cdk bootstrap --bootstrap-kms-key-id='MyKMSKeyID'
```

results in:

```jsonc
"parameters": {
  "bootstrap-kms-key-id": true,
}
```

| Metric                       | Description                                                                                                                  | Reason                                                                                                                                                                                                                                                                                                   |
|------------------------------|------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CDK CLI Version              | CLI version (x.y.z)                                                                                                          | Collecting this will help us bisect our data by version, which can help us identify problematic versions.                                                                                                                                                                                                |
| Installation ID              | UUID stored on local machines executing CLI commands                                                                         | This helps us estimate the distinct number of users who are either 1) affected by an error, or 2) use a specific CLI feature. Each unique machine will have their own Installation ID.                                                                                                                   |
| Hashed Account ID (optional) | Account ID, hashed to be anonymous                                                                                           | This will help us get a sense of blast radius when regressions are identified.                                                                                                                                                                                                                           |
| Region (optional)            | AWS Region                                                                                                                   | This will help us bisect our data for region-specific issues.                                                                                                                                                                                                                                            |
| Timestamp                    | The time (generated by the client) the data is sent to our telemetry endpoint                                                | This will help us generate time series graphs.                                                                                                                                                                                                                                                           |
| Event State                  | The "result" of the event. Possible values are 'SUCCESS', 'FAILURE', 'ABORTED'                                               | This will help us track error rates on each CLI command and alert us to potential regressions before they are reported by customers.                                                                                                                                                                     |
| Event Type                   | An identifier for the type of event that produces the data                                                                   | Since we aim to send metrics on a per-event basis, and there could be multiple events in a command execution, this is an enum that identifies what kind of event transpired. Values could be 'synth', 'deploy', etc..                                                                                    |
| Command Path                 | The command and properties entered into the CLI, with any free text redacted                                                 | For example, `cdk deploy myStack` would be turned into `['cdk', 'deploy', '$STACK1']` in the telemetry data. This information is critical to determine feature usage and will help us make data-driven decisions on what CLI features to prioritize.                                                        |
| Command Parameters           | The optional parameters entered into the CLI, with any free text redacted                                                    | Some of our features include parameters, like `cdk deploy --watch`. This information is critical to determine fetaure usage and for us to make data-driven decisions. |
| Configuration                | Additional parameters that may affect the CLI command (i.e. cdk.json / cdk.context.json values), with any free text redacted | This will help us facilitate debugging by providing a comprehensive view of all possible parameters that may affect the behavior of the CLI.                                                                                                                                                             |
| Operating System             | The operating system that is being used                                                                                      | This will help us debug issues that only affect specific operating systems.                                                                                                                                                                                                                              |
| CI/CD                        | Whether or not the CLI command is being invoked from a Ci/CD environment                                                     | Helps us prioritize CLI features that better facilitate CI/CD environments.                                                                                                                                                                                                                              |
| Node Version                 | The node version used in the environment                                                                                     | This will help us debug any node-specific issues that arise.                                                                                                                                                                                                                                             |
| Timers                       | The length of the event (and potentially, any smaller denominations that are interesting)                                    | We will monitor the duration of events like (but not limited to) synthesis, deploy, etc..                                                                                                                                                                                                                |
| Counters                     | Various counter metrics derived from your CDK app and CLI execution                                                          | We will monitor how counting stats like (but not limited to) CFN resource count affect the duration of deploy.                                                                                                                                                                                           |
| Dependencies                 | Relevant AWS dependencies and their versions                                                                                 | We plan to track AWS dependencies that might affect the CLI result, like `aws-cdk-lib`, `jsii`, `projen`, etc..                                                                                                                                                                                          |
| Error Messages               | The error message returned, if an error occurs. Customer content redacted                                                    | Capturing the error message will help us aggregate data on which errors are encountered at a greater rate, as well as help us debug what went wrong in individual use cases.                                                                                                                             |
| Error Stack Trace            | The stack trace of the error message, if an error occurs. Customer content redacted                                          | The stack trace will be helpful for individual debugging purposes and is necessary for us to be able to reproduce issues that may arise.                                                                                                                                                                 |
| Error Logs                   | The logs of a failed CLI command, if an error occurs. Customer content redacted                                              | Error logs will also help us debug and reproduce issues that we see in the CLI.                                                                                                                                                                                                                          |

## Customer Content

We do not collect customer content as defined [here](https://aws.amazon.com/compliance/data-privacy-faq/#topic-1).
As such, we sanitize free text to remove customer content.

### CLI Input

We will only collect known command and option names.
Input values that are boolean or enums are not redacted.
We do not collect any free text input supplied by the user to CLI.
For arguments and options with string inputs we only collect that the respective argument/option was set.

Take the following command:

```bash
> cdk bootstrap --bootstrap-bucket-name=MyBucket
```

Since `MyBucket` is free text, we do not collect this as part of telemetry data. This command will be processed into the following command object:

```jsonc
{
  "command": {
    "path": ["cdk", "bootstrap"],
    "parameters": {"bootstrap-bucket-name": "true" },
  }
}
```

We record that `bootstrap-bucket-name` is set, but not what the value is.

Another example:

```bash
> cdk deploy MyStack
```

`MyStack` is free text, and will not be included as part of telemetry data.
This command turns into the following telemetry command:

```jsonc
{
  "command": {
    "path": ["cdk", "deploy", "$STACK1"],
  }
}
```

### Errors & Logs are sanitized

A core goal of the CDK CLI Telemetry Service is to provide a more efficient debugging experience for both the CDK core team and customers.
It will help the team with:

- identifying and resolving issues prior to customer reports.
- reducing the back-and-forth often needed to resolve an existing customer report.

The second bullet point should improve the customer experience of reporting bugs that are
affecting their work.

When something goes wrong in the CDK CLI, we will report the error to the telemetry service.
The error schema looks like this:

```ts
export type ErrorDetails = {
  name: string;
  message?: string; // sanitized error message
  stackTrace?: string; // sanitized stack trace
  logs?: string; // sanitized stack logs
}
```

The error name is an enum — currently either `ToolkitError`, `AuthorizationError`, `AssemblyError`, etc.

Below we show what exactly is being sanitized.

#### ARNs

An ARN is a string that is prefixed by `arn:`. `arn:aws:s3:::my-bucket` will turn into `$ARN`.

#### AccountIDs

Anything that is a 12 digit number (that wasn’t already sanitized within an ARN) will be removed. `123456789012` will turn into `$ACCOUNT_ID`.

#### UUIDs

Sometimes, a log may include information from an SDK call like this:

```
(Service: Lambda, Status Code: 400, Request ID: c99252d8-xxxx-xxxx-xxxx-xxxxxxxxxxxx) (SDK Attempt Count: 1)"
(RequestToken: ab70879f-xxxx-xxxx-xxxx-xxxxxxxxxxxx, HandlerErrorCode: InvalidRequest)
```

We'll replace UUIDs with `$UUID`:

```
(Service: Lambda, Status Code: 400, Request ID: $UUID) (SDK Attempt Count: 1)" (RequestToken: $UUID, HandlerErrorCode: InvalidRequest)
```

#### File Paths

Part of the file path (before `aws-cdk/**`) is customer content that we will not record.

For example, a file path like `~/MyUser/my/path/to/node_modules/aws-cdk/lib/cli/cdk-toolkit.js:20:19` will be truncated to `$HOME/aws-cdk/lib/cli/cdk-toolkit.js:20:19`.

#### Stack Names

Stack Names are not included in telemetry data. These names will be redacted in the error message, stack trace, and logs.
For example, the stack name might show up in the following string: `'cdk.out/MyStackName.assets.json'`.
The string will be recorded in telemetry data as `cdk.out/$STACK1.assets.json`.

#### Asset Display Names

Asset Display Names are redacted.
Similar to Stack Names, Asset Names will be redacted in the error message, stack trace, and logs.

A log message like `start: Building TelemetryFunction/Code` becomes `start: Building $ASSSET1`.

#### Logical IDs

Logical IDs can also show up in the error text we collect. They will also be redacted.

Logical IDs might show up in a log message like the following:

```
12:32:30 PM | UPDATE_FAILED        | AWS::Lambda::Function      | TelemetryFunctionABCDEFGH
```

And will be logged in telemetry data as:

```
12:32:30 PM | UPDATE_FAILED        | AWS::Lambda::Function      | $LOGICAL_ID_1
```

#### Arbitrary Log Messages

We collect log messages that originate from the CDK CLI.
These logs are piped through the `CliIoHost` before being printed to console, and do not contain
arbitrary data -- we control the input and are aware of all customer-provided free text within.
This free text is redacted by the rules provided above.
