# Amazon GameLift L2

* **Original Author(s):**: @stevehouel
* **Tracking Issue**: #436
* **API Bar Raiser**: 

The `aws-gamelift` construct library allows you to create Amazon Gamelift Matchmaking configuration and deploy game server Fleets with just a few lines of code. As with most construct libraries, you can also easily define permissions, bind notification resource and add metrics using a simple API.

## Working Backwards

### CHANGELOG

`feat(gamelift): GameLift L2;`

### README

#### Amazon GameLift Construct Library

[Amazon GameLift](https://docs.aws.amazon.com/gamelift/latest/developerguide/gamelift-intro.html) is a service used to deploy, operate, and scale dedicated, low-cost servers in the cloud for session-based multiplayer games. Built on AWS global computing infrastructure, GameLift helps deliver high-performance, high-reliability game servers while dynamically scaling your resource usage to meet worldwide player demand.

GameLift is composed of three main components:

* GameLift FlexMatch which is a customizable matchmaking service for multiplayer games. With FlexMatch, you can build a custom set of rules that defines what a multiplayer match looks like for your game, and determines how to evaluate and select compatible players for each match. You can also customize key aspects of the matchmaking process to fit your game, including fine-tuning the matching algorithm.
  
* GameLift hosting for custom or realtime servers which helps you deploy, operate, and scale dedicated game servers. It regulates the resources needed to host games, finds available game servers to host new game sessions, and puts players into games.
  
* GameLift FleetIQ to optimize the use of low-cost Amazon Elastic Compute Cloud (Amazon EC2) Spot Instances for cloud-based game hosting. With GameLift FleetIQ, you can work directly with your hosting resources in Amazon EC2 and Amazon EC2 Auto Scaling while taking advantage of GameLift optimizations to deliver inexpensive, resilient game hosting for your players

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project. It allows you to define components for your matchmaking configuration or gmae server fleet management system.

#### GameLift FlexMatch

##### Defining a Matchmaking configuration

FlexMatch is available both as a GameLift game hosting solution (including Realtime Servers) and as a standalone matchmaking service. To set up a FlexMatch matchmaker to process matchmaking requests, you have to create a matchmaking configuration based on a RuleSet.

More details about matchmaking ruleSet are covered [below](#ruleSet).

There is two types of Matchmaking configuration: through a queue system to let FlexMatch forms matches and uses the specified GameLift queue to start a game session for the match, and through a standalone version to let FlexMatch forms matches and returns match information in an event.

Either a Matchmaking configuration using Queue
```ts
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const ruleSet = new RuleSet(this, 'Matchmaking RuleSet', {
    teams: [{
        name: 'oneteam',
        minPlayers: 2,
        maxPlayers: 2
    }]
});


new QueuedMatchmaking(this, 'Queued Matchmaking', {
  requestTimeouts: Duration.seconds(35),
  ruleSet: matchmakingRuleSet
});
```

either a Standalone Matchmaking configuration

```ts
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const ruleSet = new RuleSet(this, 'Matchmaking RuleSet', {
    teams: [{
        name: 'oneteam',
        minPlayers: 2,
        maxPlayers: 2
    }]
});

new StandaloneMatchmaking(this, 'Standalone Matchmaking', {
  requestTimeouts: Duration.seconds(35),
  ruleSet: matchmakingRuleSet
});
```

The above example implicitly defines the following resources:

* A Matchmaking RuleSet
* A Queue or a Standalone based Matchmaking configuration

##### RuleSet

Every FlexMatch matchmaker must have a rule set. The rule set determines the two key elements of a match: your game's team structure and size, and how to group players together for the best possible match.

For example, a rule set might describe a match like this: Create a match with two teams of four to eight players each, one team is the cowboy and the other team the aliens. A team can have novice and experienced players, but the average skill of the two teams must be within 10 points of each other. If no match is made after 30 seconds, gradually relax the skill requirements.

```ts
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const ruleSet = new RuleSet(this, 'Matchmaking RuleSet', {
    playerAttributes: [ {
        name: "skill",
        type: "number",
        default: 10
    }],
    teams: [{
        name: 'aliens',
        minPlayers: 4,
        maxPlayers: 8
    }, {
        name: 'cowboys',
        minPlayers: 4,
        maxPlayers: 8
    }],
    rules: [{
        name: "FairTeamSkill",
        description: "The average skill of players in each team is within 10 points from the average skill of all players in the match",
        type: "distance",
        // get skill values for players in each team and average separately to produce list of two numbers
        measurements: [ "avg(teams[*].players.attributes[skill])" ],
        // get skill values for players in each team, flatten into a single list, and average to produce an overall average
        referenceValue: "avg(flatten(teams[*].players.attributes[skill]))",
        maxDistance: 10 // minDistance would achieve the opposite result
    }, {
        name: "EqualTeamSizes",
        description: "Only launch a game when the number of players in each team matches, e.g. 4v4, 5v5, 6v6, 7v7, 8v8",
        type: "comparison",
        measurements: [ "count(teams[cowboys].players)" ],
        referenceValue: "count(teams[aliens].players)",
        operation: "=" // other operations: !=, <, <=, >, >=
    }],
    expansions: [{
        target: "rules[FairTeamSkill].maxDistance",
        steps: [{
            waitTimeSeconds: 30,
            value: 50
        }]
    }]
});
```

another way to implement `RuleSet` can be done through dedicated methods

```ts
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const ruleSet = new RuleSet(this, 'Matchmaking RuleSet');
ruleSet.addPlayerAttribute({
    name: "skill",
    type: "number",
    default: 10
});
ruleSet.addTeam({
    name: 'aliens',
    minPlayers: 4,
    maxPlayers: 8
});
ruleSet.addTeam({
    name: 'cowboys',
    minPlayers: 4,
    maxPlayers: 8
});
ruleSet.addRule({
    name: "FairTeamSkill",
    description: "The average skill of players in each team is within 10 points from the average skill of all players in the match",
    type: "distance",
    // get skill values for players in each team and average separately to produce list of two numbers
    measurements: [ "avg(teams[*].players.attributes[skill])" ],
    // get skill values for players in each team, flatten into a single list, and average to produce an overall average
    referenceValue: "avg(flatten(teams[*].players.attributes[skill]))",
    maxDistance: 10 // minDistance would achieve the opposite result
});
ruleSet.addRule({
    name: "EqualTeamSizes",
    description: "Only launch a game when the number of players in each team matches, e.g. 4v4, 5v5, 6v6, 7v7, 8v8",
    type: "comparison",
    measurements: [ "count(teams[cowboys].players)" ],
    referenceValue: "count(teams[aliens].players)",
    operation: "=" // other operations: !=, <, <=, >, >=
});
ruleSet.addExpansion({
    target: "rules[FairTeamSkill].maxDistance",
    steps: [{
        waitTimeSeconds: 30,
        value: 50
    }]
});
```

##### Integrating a GameLift hosting solution

FlexMatch is available with the managed GameLift hosting for custom game servers and Realtime Servers. To add FlexMatch matchmaking to your game, you have to bind both components through a game session queue.

```ts fix
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const queue = new gamelift.GameSessionQueue(this, 'Game session queue', {
  destinations: [fleet]
});

new StandaloneMatchmaking(this, 'Standalone Matchmaking', {
  requestTimeouts: Duration.seconds(35),
  queues: [queue]
});
```

or

```ts fix
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const queue = new gamelift.GameSessionQueue(this, 'Game session queue', {
  destinations: [fleet]
});

const config = new StandaloneMatchmaking(this, 'Standalone Matchmaking', {
  requestTimeouts: Duration.seconds(35),
});

config.addQueue(queue);
```

See: [FlexMatch integration with GameLift hosting](https://docs.aws.amazon.com/gamelift/latest/flexmatchguide/match-tasks.html)
in the *Amazon GameLift FlexMatch Developer Guide*.

##### Monitoring

You can monitor GameLift FlexMatch activity for matchmaking configurations and matchmaking rules using Amazon CloudWatch. These statistics are used to provide a historical perspective on how your Gamelift FlexMatch solution is performing.

###### Metrics

GameLift FlexMatch sends metrics to CloudWatch so that you can collect and analyze the activity of your matchmaking solution, including match acceptance workflow, ticket consumtion, and the state of your matchmaking rules evaluation.

You can then use CloudWatch alarms to alert you, for example, when matches has been rejected (potential matches that were rejected by at least one player since the last report) exceed a certain thresold which could means that you may have an issue in your matchmaking rules.

CDK provides methods for accessing GameLift metrics with default configuration,
such as `metricCurrentTickets`, or `metricMatchAccepted` (see [`IMatchmakingConfiguration`](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-gamelift.IMatchmakingConfiguration.html)
for a full list). CDK also provides a generic `metric` method that can be used to produce metric configurations for any metric provided by GameLift FlexMatch; the configurations are pre-populated with the correct dimensions for the matchmaking configuration.

```ts fixture=with-matchmaking-configuration
import * as cloudwatch from '@aws-cdk-lib/aws-cloudwatch';
// Alarm that triggers when the per-second average of not placed matches exceed 10%
const matchesPlacedRatio = new cloudwatch.MathExpression({
  expression: '1 - (matchesPlaced / matchedCreated)',
  usingMetrics: {
    matchesPlaced: matchmakingConfiguration.metricMatchesRejected({ statistic: cloudwatch.Statistic.SUM }),
    matchesCreated: matchmakingConfiguration.metric('MatchesCreated'),
  },
});
new Alarm(this, 'Alarm', {
  metric: matchesPlacedRatio,
  threshold: 0.1,
  evaluationPeriods: 3,
});
```

See: [Monitoring Using CloudWatch Metrics](https://docs.aws.amazon.com/gamelift/latest/developerguide/monitoring-cloudwatch.html)
in the *Amazon GameLift Developer Guide*.

#### GameLift Hosting

##### Defining a GameLift Fleet

GameLift helps you deploy, operate, and scale dedicated game servers for session-based multiplayer games. It helps you regulate the resources needed to host your games, finds available game servers to host new game sessions, and puts players into games.

###### Creating a realtime game server fleet

This lightweight server solution provides ready-to-go game servers that you can configure to fit your game. To set up and optionnally customize a realtime server fleet, you need to provide a script (in the form of some JavaScript code).

```ts
import * as s3 from 'aws-cdk-lib/aws-s3-assets';
import * as gamelift from 'aws-cdk-lib/aws-gamelift';

const script = new gamelift.RealtimeScript(this, 'Game server build', {
  location: new s3.Asset(this, "SampleScriptAsset", {
    path: path.join(__dirname, 'file-asset.txt')
  })
});

new gamelift.RealtimeGameServerFleet(this, 'Realtime server fleet', {
  script: script
});
```

###### Creating a custom game server fleet

Your uploaded game servers are hosted on GameLift virtual computing resources, called instances. You set up your hosting resources by creating a fleet of instances and deploying them to run your game servers. You can design a fleet to fit your game's needs.

```ts
import * as s3 from 'aws-cdk-lib/aws-s3-assets';
import * as gamelift from 'aws-cdk-lib/aws-gamelift';

const build = new gamelift.GameServerBuild(this, 'Game server build', {
  location: new s3.Asset(this, "SampleZippedDirAsset", {
    path: path.join(__dirname, "sample-asset-directory")
  })
});

new gamelift.CustomGameServerFleet(this, 'Realtime server fleet', {
  build: build
});
```

##### Integrating a queue system

The game session queue is the primary mechanism for processing new game session requests and locating available game servers to host them. Although it is possible to request a new game session be hosted on specific fleet or location.

```ts fixture=with-build
import * as gamelift from 'aws-cdk-lib/aws-gamelift';

const fleet = new gamelift.CustomGameServerFleet(this, 'Realtime server fleet', {
  build: build
});

new gamelift.GameSessionQueue(this, 'Game session queue', {
  destinations: [fleet]
});
```

or

```ts fixture=with-build
import * as gamelift from 'aws-cdk-lib/aws-gamelift';

const fleet = new gamelift.CustomGameServerFleet(this, 'Realtime server fleet', {
  build: build
});

const alias = fleet.addAlias({
  name: 'live'
})

const queue = new gamelift.GameSessionQueue(this, 'Game session queue');
queue.addDestination(alias)
```

See [Setting up GameLift queues for game session placement](https://docs.aws.amazon.com/gamelift/latest/developerguide/realtime-script-uploading.html)
in the *Amazon GameLift Developer Guide*.

###### Managing player latency policies


```ts fixture=with-build
import * as gamelift from 'aws-cdk-lib/aws-gamelift';

const fleet = new gamelift.CustomGameServerFleet(this, 'Realtime server fleet', {
  build: build
});

new gamelift.GameSessionQueue(this, 'Game session queue', {
  destinations: [fleet]
});
```

###### Setting notifications

If you're using queues to manage game session placement in your game, you need a way to monitor the status of individual placement requests and take action as appropriate. Implementing event notifications is a fast and efficient method for tracking placement activity. If your game is in production, or in pre-production with high-volume placement activity, you should be using event notifications.

There are two options for setting up event notifications. You can set up an SNS topic and have GameLift publish event notifications on placement activity by referencing the topic ID in a game session queue. Alternatively, you can use Amazon CloudWatch Events, which has a suite of tools available for managing events and taking action on them.


```ts fixture=with-build
import * as gamelift from 'aws-cdk-lib/aws-gamelift';

const fleet = new gamelift.CustomGameServerFleet(this, 'Realtime server fleet', {
  build: build
});

const topic = new sns.Topic(this, 'Topic');

new gamelift.GameSessionQueue(this, 'Game session queue', {
  destinations: [fleet],
  notification: topic
});
```

##### Managing game servers launch configuration

GameLift uses a fleet's runtime configuration to determine the type and number of processes to run on each instance in the fleet. At a minimum, a runtime configuration contains one server process configuration that represents one game server executable. You can also define additional server process configurations to run other types of processes related to your game. Each server process configuration contains the following information:

* The file name and path of an executable in your game build.

* Optionally Parameters to pass to the process on launch.

* The number of processes to run concurrently.

A GameLift instance is limited to 50 processes running concurrently.

```ts fixture=with-build
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

new gamelift.CustomGameServerFleet(this, 'Customer game server fleet', {
  build: build,
  runtimeConfiguration: {
    gameSessionActivationTimeoutSeconds: 123,
    maxConcurrentGameSessionActivations: 123,
    serverProcesses: [{
      concurrentExecutions: 1
      launchPath: '/local/game/GameLiftExampleServer.x86_64'
      parameters: '-logFile /local/game/logs/myserver1935.log -port 1935'
    }]
  }
});
```

See [Managing how game servers are launched for hosting](https://docs.aws.amazon.com/gamelift/latest/developerguide/fleets-multiprocess.html)
in the *Amazon GameLift Developer Guide*.

##### Defining an instance type

GameLift uses Amazon Elastic Compute Cloud (Amazon EC2) resources, called instances, to deploy your game servers and host game sessions for your players. When setting up a new fleet, you decide what type of instances your game needs and how to run game server processes on them (using a runtime configuration). All instances in a fleet use the same type of resources and the same runtime configuration. You can edit a fleet's runtime configuration and other fleet properties, but the type of resources cannot be changed.

```ts fixture=with-build
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

new gamelift.CustomGameServerFleet(this, 'Customer game server fleet', {
  build: build,
  instanceType: gamelift.InstanceType.of(gamelift.InstanceClass.C5, gamelift.InstanceSize.LARGE)
});
```

##### Using Spot instances

When setting up your hosting resources, you have the option of using Spot Instances, On-Demand Instances, or a combination.

By default, this property is set to ON_DEMAND.

```ts fixture=with-build
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

new gamelift.CustomGameServerFleet(this, 'Customer game server fleet', {
  build: build,
  fleetType: FleetType.SPOT
});
```

##### Allowing Ingress traffic

The allowed IP address ranges and port settings that allow inbound traffic to access game sessions on this fleet.

New game sessions are assigned an IP address/port number combination, which must fall into the fleet's allowed ranges. Fleets with custom game builds must have permissions explicitly set. For Realtime Servers fleets, GameLift automatically opens two port ranges, one for TCP messaging and one for UDP.

```ts fixture=with-build
import * as gamelift from '@aws-cdk-lib/aws-gamelift';
import * as ec2 from '@aws-cdk-lib/aws-ec2';

const fleet = new gamelift.CustomGameServerFleet(this, 'Customer game server fleet', {
  build: build,
});
// Allowing all IP Addresses from port 1111 to port 1122 on TCP Protocol
fleet.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(1111), ec2.Port.tcp(1122));

// Allowing a specific CIDR for port 1111 on UDP Protocol
fleet.addIngressRule(ec2.Peer.ipv4('1.2.3.4/32'), ec2.Port.udp(1111));
```

##### Managing locations

A single Amazon GameLift fleet has a home Region by default (the Region you deploy it to), but it can deploy resources to any number of GameLift supported Regions. Select Regions based on where your players are located and your latency needs.

```ts fixture=with-build
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

new gamelift.CustomGameServerFleet(this, 'Customer game server fleet', {
  build: build,
  locations: [
    'us-east-1',
    'eu-west-1'
  ]
});
```

or 

```ts fixture=with-build
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const fleet = new gamelift.CustomGameServerFleet(this, 'Customer game server fleet', {
  build: build
});
fleet.addLocation('eu-west-1');
```

##### Monitoring

GameLift is integrated with CloudWatch, so you can monitor the performance of
your game servers via logs and metrics.

###### Logs

TODO

###### Metrics

TODO

##### Specifying an IAM role

Some GameLift features require you to extend limited access to your AWS resources. This is done by creating an AWS IAM role. The GameLift Fleet class automatically created an IAM role with all the minimum necessary permissions for GameLift to access your ressources. If you wish, you may
specify your own IAM role.

```ts fixture=with-build
import * as iam from '@aws-cdk-lib/aws-iam';
import * as ec2 from '@aws-cdk-lib/aws-ec2';
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const role = new iam.Role(this, 'Role', {
  assumedBy: new iam.CompositePrincipale(new iam.ServicePrincipal('gamelift.amazonaws.com'),
  new iam.ServicePrincipal('ec2.amazonaws.com'), new iam.ServicePrincipal('ec2.amazonaws.com'))
});
role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'));

new gamelift.CustomGameServerFleet(this, 'Customer game server fleet', {
  build = build,
  instanceRole: role
});

```

If you need to access resources in your own account and you have a multi-region fleet with locations in one of the opt-in regions, add gamelift.opt-in-region.amazonaws.com to the role trust policy. The following example includes the four supported opt-in regions:

* gamelift.ap-east-1.amazonaws.com
* gamelift.me-south-1.amazonaws.com
* gamelift.af-south-1.amazonaws.com
* gamelift.eu-south-1.amazonaws.com

```ts fixture=with-build
import * as iam from '@aws-cdk-lib/aws-iam';
import * as ec2 from '@aws-cdk-lib/aws-ec2';
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const role = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('gamelift.amazonaws.com')
});
role.addServicePrincipal('gamelift.ap-east-1.amazonaws.com');
role.addServicePrincipal('gamelift.me-south-1.amazonaws.com');
role.addServicePrincipal('gamelift.af-south-1.amazonaws.com');
role.addServicePrincipal('gamelift.eu-south-1.amazonaws.com');

new gamelift.CustomGameServerFleet(this, 'Customer game server fleet', {
  build = build,
  instanceRole: role
});

```

##### Alias

A GameLift alias is used to abstract a fleet designation. Fleet designations tell Amazon GameLift where to search for available resources when creating new game sessions for players. By using aliases instead of specific fleet IDs, you can more easily and seamlessly switch player traffic from one fleet to another by changing the alias's target location.

```ts

import * as gamelift from 'aws-cdk-lib/aws-gamelift';

const fleet = new gamelift.CustomGameServerFleet(this, 'Realtime server fleet', {
  build: build
});
fleet.addAlias({
  name: 'live'
});
```

See [Add an alias to a GameLift fleet](https://docs.aws.amazon.com/gamelift/latest/developerguide/aliases-creating.html)
in the *Amazon GameLift Developer Guide*.

#### GameLift FleetIQ

The GameLift FleetIQ solution is a game hosting layer that supplements the full set of computing resource management tools that you get with Amazon EC2 and Auto Scaling. This solution lets you directly manage your Amazon EC2 and Auto Scaling resources and integrate as needed with other AWS services.

##### Defining a Game Server Group

When using GameLift FleetIQ, you prepare to launch Amazon EC2 instances as usual: make an Amazon Machine Image (AMI) with your game server software, create an Amazon EC2 launch template, and define configuration settings for an Auto Scaling group. However, instead of creating an Auto Scaling group directly, you create a GameLift FleetIQ game server group with your Amazon EC2 and Auto Scaling resources and configuration.

```ts
import * as ec2 from '@aws-cdk-lib/aws-ec2';
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const template = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
  machineImage: ec2.MachineImage.latestAmazonLinux(),
  securityGroup: new ec2.SecurityGroup(this, 'LaunchTemplateSG', {
    vpc: vpc,
  }),
});

new gamelift.FleetIQ(this, 'Game server group', {
  instanceDefinition = [{
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.SMALL),
  }],
  launchTemplate = template,
});

```

##### Scaling Policy

The scaling policy uses the metric `PercentUtilizedGameServers` to maintain a buffer of idle game servers that can immediately accommodate new games and players.

```ts fixture=with-launch-template
import * as ec2 from '@aws-cdk-lib/aws-ec2';
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const template = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
  machineImage: ec2.MachineImage.latestAmazonLinux(),
  securityGroup: new ec2.SecurityGroup(this, 'LaunchTemplateSG', {
    vpc: vpc,
  }),
});

new gamelift.FleetIQ(this, 'Game server group', {
  instanceDefinition = [{
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.SMALL),
  }],
  launchTemplate = template,
  scalingPolicy: {
    utilizedGameServersPercent: 66
  }
});

```

See [Manage game server groups](https://docs.aws.amazon.com/gamelift/latest/fleetiqguide/gsg-integrate-gameservergroup.html)
in the *Amazon GameLift FleetIQ Developer Guide*.

##### Specifying an IAM role

The GameLift FleetIQ class automatically creates an IAM role with all the minimum necessary
permissions for GameLift to access your Amazon EC2 Auto Scaling groups. If you wish, you may
specify your own IAM role. It must have the correct permissions, or FleetIQ creation or ressource usage may fail.

```ts fixture=with-launch-template
import * as iam from '@aws-cdk-lib/aws-iam';
import * as ec2 from '@aws-cdk-lib/aws-ec2';
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const role = new iam.Role(this, 'Role', {
  assumedBy: new iam.CompositePrincipale(new iam.ServicePrincipal('gamelift.amazonaws.com'),
  new iam.ServicePrincipal('autoscaling.amazonaws.com'))
});
role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('GameLiftGameServerGroupPolicy'));

new gamelift.FleetIQ(this, 'Game server group', {
  instanceDefinition = [{
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.SMALL),
  }],
  launchTemplate = template,
  role: role
});
```

See [Controlling Access](https://docs.aws.amazon.com/gamelift/latest/fleetiqguide/gsg-iam-permissions-roles.html)
in the *Amazon GameLift FleetIQ Developer Guide*.

##### Specifying VPC Subnets

GameLift FleetIQ use by default, all supported GameLift FleetIQ Availability Zones in your chosen region. You can override this parameter to specify VPCs subnets that you've set up. 

This property cannot be updated after the game server group is created, and the corresponding Auto Scaling group will always use the property value that is set with this request, even if the Auto Scaling group is updated directly.

```ts fixture=with-rule-set
import * as ec2 from '@aws-cdk-lib/aws-ec2';
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const vpc = new ec2.Vpc(this, 'TheVPC', {
   cidr: "10.0.0.0/16"
});

new gamelift.FleetIQ(this, 'Game server group', {
  instanceDefinition = [{
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.SMALL),
  }],
  launchTemplate = template,
  subnets: vpc.selectSubnets({
    subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
  })
});
```

##### Monitoring

GameLift FleetIQ sends metrics to CloudWatch so that you can collect and analyze the activity of your Game server fleet, including the number of utilized game servers, and the number of game server interruption due to limited Spot availability.

You can then use CloudWatch alarms to alert you, for example, when the portion of game servers that are currently supporting game executions exceed a certain thresold which could means that your autoscaling policy need to be adjust to add more instances to match with player demand.

CDK provides methods for accessing GameLift metrics with default configuration,
such as `metricGameServerInterruptions`, or `metricAvailableGameServers` (see [`IFleetIQ`](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-gamelift.IMatchmakingConfiguration.html)
for a full list). CDK also provides a generic `metric` method that can be used to produce metric configurations for any metric provided by GameLift FleetIQ; the configurations are pre-populated with the correct dimensions for the matchmaking configuration.

```ts fixture=with-matchmaking-configuration
import * as cloudwatch from '@aws-cdk-lib/aws-cloudwatch';
// Alarm that triggers when the percent of utilized game servers exceed 90%
new Alarm(this, 'Alarm', {
  metric: fleet.metricPercentUtilizedGameServers,
  threshold: 0.9,
  evaluationPeriods: 2,
});
```

See: [Monitoring with CloudWatch](https://docs.aws.amazon.com/gamelift/latest/fleetiqguide/gsg-metrics.html)
in the *Amazon GameLift FleetIQ Developer Guide*.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

> This section should include answers to questions readers will likely ask about
> this release. Similar to the "working backwards", this section should be
> written in a language as if the feature is now released.
>
> The template includes a some common questions, feel free to add any questions
> that might be relevant to this feature or omit questions that you feel are not
> applicable.

### What are we launching today?

> What exactly are we launching? Is this a new feature in an existing module? A
> new module? A whole framework? A change in the CLI?

### Why should I use this feature?

> Describe use cases that are addressed by this feature.

## Internal FAQ

> The goal of this section is to help decide if this RFC should be implemented.
> It should include answers to questions that the team is likely ask. Contrary
> to the rest of the RFC, answers should be written "from the present" and
> likely discuss design approach, implementation plans, alternative considered
> and other considerations that will help decide if this RFC should be
> implemented.

### Why are we doing this?

> What is the motivation for this change?

### Why should we _not_ do this?

> Is there a way to address this use case with the current product? What are the
> downsides of implementing this feature?

### What is the technical solution (design) of this feature?

> Briefly describe the high-level design approach for implementing this feature.
>
> As appropriate, you can add an appendix with a more detailed design document.
>
> This is a good place to reference a prototype or proof of concept, which is
> highly recommended for most RFCs.

### Is this a breaking change?

> If the answer is no. Otherwise:
>
> Describe what ways did you consider to deliver this without breaking users?
>
> Make sure to include a `BREAKING CHANGE` clause under the CHANGELOG section with a description of the breaking
> changes and the migration path.

### What alternative solutions did you consider?

> Briefly describe alternative approaches that you considered. If there are
> hairy details, include them in an appendix.

### What are the drawbacks of this solution?

> Describe any problems/risks that can be introduced if we implement this RFC.

### What is the high-level project plan?

> Describe your plan on how to deliver this feature from prototyping to GA.
> Especially think about how to "bake" it in the open and get constant feedback
> from users before you stabilize the APIs.
>
> If you have a project board with your implementation plan, this is a good
> place to link to it.

### Are there any open issues that need to be addressed later?

> Describe any major open issues that this RFC did not take into account. Once
> the RFC is approved, create GitHub issues for these issues and update this RFC
> of the project board with these issue IDs.

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.