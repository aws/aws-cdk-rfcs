# vpcLattice L2 Construct

- [Project Information](#project-information)
- [Example Impleentation](#example-implementation)
- [API Design](#proposed-api-design-for-vpclattice)
- [FAQ](#faq)
- [Acceptance](#acceptance)


--- 
## Project Information

**Status** (DRAFT)

**Original Author(s):** @mrpackethead, , @taylaand,  @nbaillie

**Tracking Issue:** #502

**API Bar Raiser:** @TheRealAmazonKendra

**Public Issues ( aws-cdk)**
* (vpclattice): L2 for Amazon VPC Lattice #25452


**Prototype Code**
- https://github.com/raindancers/aws-cdk/tree/mrpackethead/aws-vpclattice-alpha/packages/%40aws-cdk/aws-vpclattice-alpha
- hhttps://github.com/raindancers/vpclattice-prealpha-demo


**VpcLattice**

Amazon VPC Lattice is an application networking service that consistently connects, monitors, and secures communications between your services, helping to improve productivity so that your developers can focus on building features that matter to your business. You can define policies for network traffic management, access, and monitoring to connect compute services in a simplified and consistent way across instances, containers, and serverless applications.

The L2 Construct seeks to assist the consumer to create a lattice service easily by abstracting some of the detail.  The major part of this is in creating the underlying auth policy and listener rules together, as their is significant intersection in the properties require for both. 
 
---

## Example Implementation

- A Service is created 
- A Listener is added to the serviceand associated with a ServiceNetwork
- A Rule is assocated with the listener which uses a Lambda function as a target
- A Service Network is created
- The Service is associated with the ServiceNetwork, and two vpcs are attached to it. 
A Lattice Network is created, and associated with two different VPC's, VPC1 and VPC2.  
Two lambdas are created,  lambda1 is providing a interface to an api,  lambda2 is making requests..  Lambda1 will be in VPC1, and Lambda2 in VPC2



```typescript
import * as core from 'aws-cdk-lib';

import {
  aws_iam as iam,
}
  from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { SupportResources } from './support';
import {
  ServiceNetwork,
  Service,
  TargetGroup,
  Target,
}
  from '../../lib/index';

export class LatticeTestStack extends core.Stack {

  constructor(scope: Construct, id: string, props?: core.StackProps) {
    super(scope, id, props);

    const support = new SupportResources(this, 'supportresources');

    // Create a Lattice Service
    // this will default to using IAM Authentication
    const myLatticeService = new Service(this, 'myLatticeService', {});
    // add a listener to the service, using the defaults
    // - HTTPS
    // - Port 443
    // - default action of providing 404 NOT Found,
    // - cloudformation name
    const myListener = new vpclattice.Listener(this, 'Listener', {
      service: myLatticeService,
    })

  
    // add a listenerRule that will use the helloworld lambda as a Target
    mylistener.addListenerRule({
      name: 'helloworld',
      priority: 10,
      action: [
        {
          targetGroup: new vpclattice.TargetGroup(this, 'hellolambdatargets', {
            name: 'hellowworld',
            target: vpclattice.Target.lambda([
              support.helloWorld,
            ]),
          }),
        },
      ],

      httpMatch: {
        pathMatches: { path: '/hello' },
      },
      // we will only allow access to this service from the ec2 instance
      accessMode: vpclattice.RuleAccessMode.UNAUTHENTICATED
    });

    //add a listenerRule that will use the goodbyeworld lambda as a Target
    mylistener.addListenerRule({
      name: 'goodbyeworld',
      priority: 20,
      action: [
        {
          targetGroup: new vpclattice.TargetGroup(this, 'goodbyelambdatargets', {
            name: 'goodbyeworld',
            target: vpclattice.Target.lambda([
              support.goodbyeWorld,
            ]),
          }),
        },
      ],
      
      httpMatch: {
        pathMatches: { path: '/goodbye' },
      },
      // we will only allow access to this service from the ec2 instance
      allowedPrincipals: [support.ec2instance.role],
      accessMode: vpclattice.RuleAccessMode.AUTHENTICATED_ONLY,
    });

    
    myLatticeService.applyAuthPolicy();

    /**
     * Create a ServiceNetwork.
     * OPINIONATED DEFAULT: The default behavior is to create a
     * service network that requries an IAM policy, and authenticated access
     * ( requestors must send signed requests )
     */

    const serviceNetwork = new ServiceNetwork(this, 'LatticeServiceNetwork', {
      services: [myLatticeService],
      vpcs: [
        support.vpc1,
      ],
    });

    serviceNetwork.applyAuthPolicyToServiceNetwork();
  }
}
```
---

## Proposed API Design for vpclattice

- [ServiceNetwork](#servicenetwork)
- [Service](#serviceService)
- [Listener](#listener)
- [TargetGroups](#targetgroups)
- [Targets](#targets)
- [Logging](#logging)



### ServiceNetwork
A service network is a logical boundary for a collection of services. Services associated with the network can be authorized for discovery, connectivity, accessibility, and observability. To make requests to services in the network, your service or client must be in a VPC that is associated with the service network.


![Service Network](https://docs.aws.amazon.com/images/vpc-lattice/latest/ug/images/service-network.png)

The construct `ServiceNetwork` provides for this. 

The construct will implement `IServiceNetwork`.  

```typescript
/**
 * Create a vpc lattice service network.
 * Implemented by `ServiceNetwork`.
 */
export interface IServiceNetwork extends core.IResource {

  /**
  * The Amazon Resource Name (ARN) of the service network.
  */
  readonly serviceNetworkArn: string;

  /**
   * The Id of the Service Network
   */
  readonly serviceNetworkId: string;
  /**
   * Add Lattice Service
   */
  addService(props: AddServiceProps): void;
  /**
   * Associate a VPC with the Service Network
   */
  associateVPC(props: AssociateVPCProps): void;
  /**
   * Add a logging Destination.
   */
  addloggingDestination(props: AddloggingDestinationProps): void;
  /**
   * Share the ServiceNetwork, Consider if it is more appropriate to do this at the service.
   */
  share(props: ShareServiceNetworkProps): void;

  /**
   * Add a statement to the auth policy. This should be high level coarse policy, consider only adding
   * statements here that have DENY effects
   * @param statement the policy statement to add.
   */
  addStatementToAuthPolicy(statement: iam.PolicyStatement): void;
  /**
  * Apply auth policy to the Service Network
  */
  applyAuthPolicyToServiceNetwork(): void;
}
```

The Construct will consume ServiceNetworkProps.


```typescript
/**
 * Create a vpc lattice service network.
 * Implemented by `ServiceNetwork`.
 */
export interface ServiceNetworkProps {

  /** The name of the Service Network. If not provided Cloudformation will provide
   * a name
   * @default cloudformation generated name
   */
  readonly name?: string

  /**
   * The type of  authentication to use with the Service Network
   * @default 'AWS_IAM'
   */
  readonly authType?: AuthType | undefined;

  /**
   * Logging destinations
   * @default: no logging
   */
  readonly loggingDestinations?: LoggingDestination[];

  /**
   * Lattice Services that are assocaited with this Service Network
   * @default no services are associated with the service network
   */
  readonly services?: IService[] | undefined;

  /**
   * Vpcs that are associated with this Service Network
   * @default no vpcs are associated
   */
  readonly vpcs?: ec2.IVpc[] | undefined;
  /**
   * Allow external principals
   * @default false
   */
  readonly accessmode?: ServiceNetworkAccessMode | undefined;
}
```

### Service

A service within VPC Lattice is an independently deployable unit of software that delivers a specific task or function.  A service has listeners that use rules, that you configure to route traffic to your targets. Targets can be EC2 instances, IP addresses, serverless Lambda functions, Application Load Balancers, or Kubernetes Pods.  The following diagram shows the key components of a typical service within VPC Lattice.


![service](https://docs.aws.amazon.com/images/vpc-lattice/latest/ug/images/service.png)


```typescript
/**
 * Create a vpcLattice service network.
 * Implemented by `Service`.
 */
export interface IService extends core.IResource {
  /**
  * The Amazon Resource Name (ARN) of the service.
  */
  readonly serviceArn: string;
  /**
  * The Id of the Service Network
  */
  readonly serviceId: string;
  /**
   * Allow an Odd
   */
  readonly orgId: string | undefined;
  /**
   * the policy document for the service;
   */
  authPolicy: iam.PolicyDocument;

  /**
   * Add A vpc listener to the Service.
   * @param props
   */
  shareToAccounts(props: ShareServiceProps): void;

  /**
   * Grant Access to other principals
   */
  grantAccess(principals: iam.IPrincipal[]): void;

  /**
   * Apply the authAuthPolicy to the Service
   */
  applyAuthPolicy(): iam.PolicyDocument;
  /**
   * Add A policyStatement to the Auth Policy
   */
  addPolicyStatement(statement: iam.PolicyStatement): void;
}
export interface IService extends core.IResource {
  /**
  * The Amazon Resource Name (ARN) of the service.
  */
  readonly serviceArn: string;
  /**
  * The Id of the Service Network
  */
  readonly serviceId: string;
  /**
   * Allow an Odd
   */
  readonly orgId: string | undefined;
  /**
   * the policy document for the service;
   */
  authPolicy: iam.PolicyDocument;

  /**
   * Add A vpc listener to the Service.
   * @param props
   */
  shareToAccounts(props: ShareServiceProps): void;

  /**
   * Grant Access to other principals
   */
  grantAccess(principals: iam.IPrincipal[]): void;

  /**
   * Apply the authAuthPolicy to the Service
   */
  applyAuthPolicy(): iam.PolicyDocument;
  /**
   * Add A policyStatement to the Auth Policy
   */
  addPolicyStatement(statement: iam.PolicyStatement): void;
}

```

`Service` will take `ServiceProps` as props
```typescript
/**
 * Properties for a Lattice Service
 */
export interface LatticeServiceProps {

  /**
   * Name for the service
   * @default cloudformation will provide a name
   */
  readonly name?: string | undefined;

  /**
   * The authType of the Service
   * @default 'AWS_IAM'
   */
  readonly authType?: string | undefined;

  /**
   * Listeners that will be attached to the service
   * @default no listeners
  */
  readonly listeners?: IListener[] | undefined;

  /**
   * A certificate that may be used by the service
   * @default no custom certificate is used
   */
  readonly certificate?: certificatemanager.Certificate | undefined;
  /**
   * A customDomain used by the service
   * @default no customdomain is used
   */
  readonly customDomain?: string | undefined;
  /**
   * A custom hosname
   * @default no hostname is used
   */
  readonly dnsEntry?: aws_vpclattice.CfnService.DnsEntryProperty | undefined;

  /**
   * Share Service
   *@default no sharing of the service
   */
  readonly shares?: ShareServiceProps[] | undefined;
}

```

### Listener
A listener is a process that checks for connection requests, using the protocol and port that you configure. The rules that you define for a listener determine how the service routes requests to its registered targets.

It is not expected that a direct call to Listener will be made, instead the `.addListener()` should be used.


``` typescript
/**
 * Create a vpcLattice Listener.
 * Implemented by `Listener`.
 */
export interface IListener extends core.IResource {
  /**
  * The Amazon Resource Name (ARN) of the service.
  */
  readonly listenerArn: string;
  /**
  * The Id of the Service Network
  */
  readonly listenerId: string;

  /**
   * Add A Listener Rule to the Listener
   */
  addListenerRule(props: AddRuleProps): void;

}
```

`Listener` will take `ListenerProps`

```typescript
/**
 * Propertys to Create a Lattice Listener
 */
/**
 * Propertys to Create a Lattice Listener
 */
export interface ListenerProps {
  /**
   *  * A default action that will be taken if no rules match.
   *  @default 404 NOT Found
  */
  readonly defaultAction?: aws_vpclattice.CfnListener.DefaultActionProperty | undefined;
  /**
  * protocol that the listener will listen on
  * @default HTTPS
  */
  readonly protocol?: Protocol | undefined;
  /**
  * Optional port number for the listener. If not supplied, will default to 80 or 443, depending on the Protocol
  * @default 80 or 443 depending on the Protocol

  */
  readonly port?: number | undefined
  /**
  * The Name of the service.
  * @default CloudFormation provided name.
  */
  readonly name?: string;
  /**
   * The Id of the service that this listener is associated with.
   */
  readonly service: IService;
}
```

### TargetGroups

A VPC Lattice target group is a collection of targets, or compute resources, that run your application or service. Targets can be EC2 instances, IP addresses, Lambda functions, Application Load Balancers

```typescript

 /** Create a vpc lattice TargetGroup.
 * Implemented by `TargetGroup`.
 */
export interface ITargetGroup extends core.IResource {
  /**
   * The id of the target group
   */
  readonly targetGroupId: string
  /**
   * The Arn of the target group
   */
  readonly targetGroupArn: string;
}
```

`TargetGroup` will take `TargetGroupProps`

```typescript
/**
 * Properties for a Target Group, Only supply one of instancetargets, lambdaTargets, albTargets, ipTargets
 */
export interface TargetGroupProps {
  /**
   * The name of the target group
   */
  readonly name: string,
  /**
   * Targets
   */
  readonly target: Target,
}
```

### Target

Target is an abstract class with static function to return propertys for a TargetGroup

```typescript
/**
 * Targets for target Groups
 */
export abstract class Target {

  /**
   * Lambda Target
   * @param lambda
   */
  public static lambda(lambda: aws_lambda.Function[]): Target {

    let targets: aws_vpclattice.CfnTargetGroup.TargetProperty[] = [];
    lambda.forEach((target) => {
      targets.push({ id: target.functionArn });
    });

    return {
      type: TargetType.LAMBDA,
      targets: targets,
    };
  };

  /**
   * IpAddress as Targets
   * @param ipAddress
   * @param config
   */
  public static ipAddress(ipAddress: string[], config: aws_vpclattice.CfnTargetGroup.TargetGroupConfigProperty ): Target {

    let targets: aws_vpclattice.CfnTargetGroup.TargetProperty[] = [];

    ipAddress.forEach((target) => {
      targets.push({ id: target });
    });

    return {
      type: TargetType.LAMBDA,
      targets: targets,
      config: config,
    };

  };

  /**
   * EC2 Instances as Targets
   * @param ec2instance
   * @param config
   */
  public static ec2instance(ec2instance: ec2.Instance[], config: aws_vpclattice.CfnTargetGroup.TargetGroupConfigProperty): Target {

    let targets: aws_vpclattice.CfnTargetGroup.TargetProperty[] = [];

    ec2instance.forEach((target) => {
      targets.push({ id: target.instanceId });
    });

    return {
      type: TargetType.LAMBDA,
      targets: targets,
      config: config,
    };

  };

  /**
   * Application Load Balancer as Targets
   * @param alb
   * @param config
   */
  public static applicationLoadBalancer(alb: elbv2.ApplicationListener[], config: aws_vpclattice.CfnTargetGroup.TargetGroupConfigProperty): Target {

    let targets: aws_vpclattice.CfnTargetGroup.TargetProperty[] = [];

    alb.forEach((target) => {
      targets.push({ id: target.listenerArn });
    });

    return {
      type: TargetType.LAMBDA,
      targets: targets,
      config: config,
    };

  }
  /**
   * The type of target
   */
  public abstract readonly type: TargetType;
  /**
   * References to the targets, ids or Arns
   */
  public abstract readonly targets: aws_vpclattice.CfnTargetGroup.TargetProperty[];
  /**
   * Configuration for the TargetGroup, if it is not a lambda
   */
  public abstract readonly config?: aws_vpclattice.CfnTargetGroup.TargetGroupConfigProperty | undefined;

  constructor() {};

}
```

### LoggingDestination

LoggingDestination is a abstract class to return properties for a LoggingSubscription

```typescript
/**
 * Logging options
 */
export abstract class LoggingDestination {

  /**
   * Construct a logging destination for a S3 Bucket
   * @param bucket an s3 bucket
   */
  public static s3(bucket: s3.IBucket): LoggingDestination {
    return {
      name: bucket.bucketName,
      arn: bucket.bucketArn,
    };
  }
  /**
   * Send to CLoudwatch
   * @param logGroup
   */
  public static cloudwatch(logGroup: logs.ILogGroup): LoggingDestination {
    return {
      name: logGroup.logGroupName,
      arn: logGroup.logGroupArn,
    };
  }

  /**
   * Stream to Kinesis
   * @param stream
   */
  public static kinesis(stream: kinesis.IStream): LoggingDestination {
    return {
      name: stream.streamName,
      arn: stream.streamArn,
    };
  }

  /**
  * A name of the destination
  */
  public abstract readonly name: string;
  /**
   * An Arn of the destination
   */
  public abstract readonly arn: string;

  protected constructor() {};
}
```

---

### FAQ

**What are we launching today?**  
Amazon VPC Lattice AWS CDK L2 Construct

**Why should I use this construct?**  
This CDK L2 Construct can be used to deploy resources from Amazon VPC Lattice. VPC Lattice is a fully managed application networking service that you use to connect, secure, and monitor all your services across multiple accounts and virtual private clouds (VPCs).

This construct handles all the different resources you can use with VPC Lattice: Service Network, Service, Listeners, Listener Rules, Target Groups (and targets), and Associations (Service or VPC). You have the freedom to create the combination of resources you need, so in multi-AWS Account environments you can make use of the module as many times as needed (different providers) to create your application network architecture.

You can check common Amazon VPC Lattice Reference Architectures to understand the different use cases you can build with the AWS service.

- It simplifies the deployment of common patterns for AWS VPC Lattice
- It has been tested and implemented as part of a number of wider architectures
- It is extensible to support other patterns as they emerge
- It simplifies AWS VPC Lattice adoption and administration
- Allows you to integrate infrastructure deployment with your application code
- Reduces time to deploy and test AWS VPC Lattice
- Provides separation of concerns with a common interface for user personas

**Why are we doing this?**  
- To provide a CDK native interface for AWS VPC Lattice
- Provide a way to deploy AWS VPC Lattice deterministically

**Is this a breaking change**  
No.

**What are the drawbacks of this solution**  
- It is an opinionated pattern, however there are escapes to help customisation where needed.
- It is a new AWS Service and its common usecases and features may change and evolve

---
### Acceptance
Ticking the box below indicates that the public API of this RFC has been signed-off by the API bar raiser (the api-approved label was applied to the RFC pull request):


`[ ] Signed-off by API Bar Raiser @TheRealAmazonKendra`
