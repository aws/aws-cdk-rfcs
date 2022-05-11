# Amazon GameLift L2

* **Original Author(s):**: @stevehouel
* **Tracking Issue**: #436
* **API Bar Raiser**: 

The `aws-gamelift` construct library allows you to create Amazon Gamelift Matchmaking configuration and deploy game server Fleets with just a few lines of code. As with most construct libraries, you can also easily define permissions, bind notification resource and add metrics using a simple API.

## Working Backwards

### CHANGELOG

`feat(gamelift): GameLift L2;`

### README

---

# Amazon GameLift Construct Library

[Amazon GameLift](https://docs.aws.amazon.com/gamelift/latest/developerguide/gamelift-intro.html) is a service used to deploy, operate, and scale dedicated, low-cost servers in the cloud for session-based multiplayer games. Built on AWS global computing infrastructure, GameLift helps deliver high-performance, high-reliability game servers while dynamically scaling your resource usage to meet worldwide player demand.

GameLift is composed of three main components:

* GameLift FlexMatch which is a customizable matchmaking service for multiplayer games. With FlexMatch, you can build a custom set of rules that defines what a multiplayer match looks like for your game, and determines how to evaluate and select compatible players for each match. You can also customize key aspects of the matchmaking process to fit your game, including fine-tuning the matching algorithm.
  
* GameLift hosting for custom or realtime servers which helps you deploy, operate, and scale dedicated game servers. It regulates the resources needed to host games, finds available game servers to host new game sessions, and puts players into games.
  
* GameLift FleetIQ to optimize the use of low-cost Amazon Elastic Compute Cloud (Amazon EC2) Spot Instances for cloud-based game hosting. With GameLift FleetIQ, you can work directly with your hosting resources in Amazon EC2 and Amazon EC2 Auto Scaling while taking advantage of GameLift optimizations to deliver inexpensive, resilient game hosting for your players

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project. It allows you to define components for your matchmaking configuration or gmae server fleet management system.

## GameLift FlexMatch

### Defining a Matchmaking configuration

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

### RuleSet

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

### Monitoring

You can monitor GameLift FlexMatch activity for matchmaking configurations and matchmaking rules using Amazon CloudWatch. These statistics are used to provide a historical perspective on how your Gamelift FlexMatch solution is performing.

#### Metrics

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

## GameLift Fleet

### Defining a GameLift Fleet

#### Realtime server

#### Customer Game server

## GameLift FleetIQ

The GameLift FleetIQ solution is a game hosting layer that supplements the full set of computing resource management tools that you get with Amazon EC2 and Auto Scaling. This solution lets you directly manage your Amazon EC2 and Auto Scaling resources and integrate as needed with other AWS services.

### Defining a Game Server Group

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

### Scaling Policy

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

### Specifying an IAM role

The GameLift FleetIQ class automatically creates an IAM role with all the minimum necessary
permissions for GameLift to access your Amazon EC2 Auto Scaling groups. If you wish, you may
specify your own IAM role. It must have the correct permissions, or FleetIQ
creation or ressource usage may fail.

```ts fixture=with-launch-template
import * as iam from '@aws-cdk-lib/aws-iam';
import * as ec2 from '@aws-cdk-lib/aws-ec2';
import * as gamelift from '@aws-cdk-lib/aws-gamelift';

const role = new iam.Role(this, 'Role', {
  assumedBy: new iam.CompositePrincipale(new iam.ServicePrincipal('gamelift.amazonaws.com'),
  new iam.ServicePrincipal('autoscaling.amazonaws.com'))
}
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

### Specifying VPC Subnets

TODO

### Monitoring

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

- [] Signed-off by API Bar Raiser 

## Public FAQ

## Internal FAQ

## Appendix

Feel free to add any number of appendices as you see fit. Appendices are
expected to allow readers to dive deeper to certain sections if they like. For
example, you can include an appendix which describes the detailed design of an
algorithm and reference it from the FAQ.