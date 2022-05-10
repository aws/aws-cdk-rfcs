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

GameLift is composed of four main components:

* GameLift FlexMatch which is a customizable matchmaking service for multiplayer games. With FlexMatch, you can build a custom set of rules that defines what a multiplayer match looks like for your game, and determines how to evaluate and select compatible players for each match. You can also customize key aspects of the matchmaking process to fit your game, including fine-tuning the matching algorithm.
* GameLift hosting for custom servers which helps you deploy, operate, and scale dedicated game servers. It regulates the resources needed to host games, finds available game servers to host new game sessions, and puts players into games.
* GameLift hosting for realtime servers which helps you simplify usage of Realtime Servers to stand up games that don't need custom-built game servers. This lightweight server solution provides ready-to-go game servers that you can configure to fit your game. You can deploy game servers with anything from minimal configuration settings to custom logic that is specific to your game and players.
* GameLift FleetIQ for hosting on Amazon Elastic Compute Cloud (Amazon EC2) which is a system to optimize the use of low-cost Amazon Elastic Compute Cloud (Amazon EC2) Spot Instances for cloud-based game hosting. With GameLift FleetIQ, you can work directly with your hosting resources in Amazon EC2 and Amazon EC2 Auto Scaling while taking advantage of GameLift optimizations to deliver inexpensive, resilient game hosting for your players

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project. It allows you to define components for your matchmaking configuration or gmae server fleet management system.

## Defining a Matchmaking configuration

FlexMatch is available both as a GameLift game hosting solution (including Realtime Servers) and as a standalone matchmaking service.

In order to define a Matchmaking configuration, you must specify a ruleSet.

More pre-built matchmaking ruleSet are covered [below](#ruleSet).

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

or 

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

- A Matchmaking RuleSet
- A Queue or a Standalone based Matchmaking configuration

##

### Standalone Matchmaking

## Defining a Fleet

TODO

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