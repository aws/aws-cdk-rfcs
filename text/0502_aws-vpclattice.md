# L2 Constructs for AWS VpcLattice

**Status:** (DRAFT)

* **Original Author(s):** @mrpackethead, 
, @taylaand,  @nbaillie
* **Tracking Issue:** #502
* **API Bar Raiser:** @TheRealAmazonKendra

This RFC proposes a new L2 module for CDK to support AWS VPC Lattice.

---
## PUBLIC ISSUES
* (vpclattice): L2 for Amazon VPC Lattice #25452

## Prototype Code:
https://github.com/raindancers/latticeplay
https://github.com/raindancers/aws-cdk/tree/mrpackethead/aws-vpclattice-alpha/packages/%40aws-cdk/aws-vpclattice-alpha

---
## VpcLattice

Amazon VPC Lattice is an application networking service that consistently connects, monitors, and secures communications between your services, helping to improve productivity so that your developers can focus on building features that matter to your business. You can define policies for network traffic management, access, and monitoring to connect compute services in a simplified and consistent way across instances, containers, and serverless applications.

The resources, that are required by lattice broadly fall into two catagories 
* those are a associated with the creation of a Lattice Service network, its access and logging
* those that are associated with the the **services** that the applicaton network will deliver. 

## Example Implementation

#### Create a Service Network, and allow access from a VPC


```typescript
import { ServiceNetwork } from '@aws-cdk/aws-vpclattice-alpha';

const myServiceNetwork: ServiceNetwork;
myServiceNetwork = new ServiceNetwork(this, 'myserviceNetwork, {
  name: 'mylatticenetwork',
});
```
Optionally an authentication policy can be added to the service network, Typically access policies for the Service Network are 
coarse such as allowing particular accounts to use the service network. Note: the `.addLaticeAuthPolicy()` method provides defaults for 
resources, actions and effect

```typescript
myServiceNetwork.addLatticeAuthPolicy(
  [
    new iam.PolicyStatement({
      principal: new iam.AccountPrincipal('12345678900')
    }),
  ]
);
  iam.policyDocument: iam.PolicyStatement[]): void;
```
The service can be configured to log to S3, Stream to kinesis, or use Cloudwatch with the `.logToS3()`, `sendToCloudWatch()` or `streamtoKinesis()` methods. 

```typescript
const loggingbucket: S3.Bucket
myServiceNetwork.logToS3(loggingbucket)
```

The service Network can be Shared using RAM using the `.share()` method

```typescript
myServiceNetwork.share({
  name: 'myserviceshare',
  allowExternalPrincipals: false,
  principals: new iam.AccountPrincipal('12345678900')
})
```
In order to access a service network a vpc must be associated with a vpc. 
Optionally security groups can be applied. 
For vpcs, in the same account as the Servicenetwork;
```typescript
const vpc: ec2.Vpc;
const securityGroup: ec2.SecurityGroup
myServiceNetwork.associateVPC(vpc, [securityGroups])
})
```
Cross account 
```typescript
const vpc: ec2.Vpc;
const securityGroup: ec2.SecurityGroup;
cosnt serviceNetwork = ServiceNetwork.importFromName('mylatticenetwork')
myServiceNetwork.associateVPC(vpc, [securityGroups])
```

#### Create a service from a Lambda and associate it with the Service

A lattice service is the 'front' for various applicaitons that might be 'served' by AWS resources such
as ec2 Instances, Applicaiton Load Balancers, Lambdas.   Listeners are attached to the service, which have rules and targets. 

```typescript
import { Service, Protocol, FixedResponse } from '@aws-cdk/aws-vpclattice-alpha';


const myService: Service = new Service(this, 'myservice', {
  name: 'myservice',
})
```

Add a listner to the service, with a certificate, a hostname and DNS
```typescript
const myCertificate: certificate_manager.Certificate
const serviceListener: lattice.Listener = myService.addListener(
  defaultAction: FixedResponse.NOT_FOUND
  protocol: Protocol.HTTPS,
  name: 'MyServiceListener'
)
myService.addCertificate(myCertificate);
myService.addCustomDomain('example.org');
myService.addDNSEntry('abcdef');
```

Create targets which will provide the 'content' for your service, in this example
we target a lambda. Then use the target in a Rule that is attached to the Listener.

```typescript
const functionOne: aws_lambda.Function

const targetOne = new lattice.LatticeTargetGroup(this, 'TargetOne', {
  name: 'targetgroupOne',
  lambdaTargets: [
    functionOne
  ],
})

serviceListener.addListenerRule({
  name: 'listentolambdaone',
  action: [{ target: targetOne }],
  priority: 100,  
  pathMatch:  {
    pathMatchType: lattice.PathMatchType.EXACT,
    matchValue: '/serviceOne',
    caseSensitive: false,
  } 
})
    
```
3. Finally, add the Service to the the Service Network
```typescript
serviceNetwork.addService(myService)
```

## API Design
The following API design is proposed

#### Listener
```typescript
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
   * Add A Rule to the Listener
   */
  addListenerRule(props: AddRuleProps): void;
}
```

#### Service
```typescript
/**
 * Create a vpcLattice service.
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
   * Add An Authentication Policy to the Service.
   * @param policyStatement[];
   */
  addLatticeAuthPolicy(policyStatement: iam.PolicyStatement[]): iam.PolicyDocument;
  /**
   * Add A vpc listener to the Service.
   * @param props
   */
  addListener(props: vpclattice.ListenerProps): vpclattice.Listener;
  /**
   * Share the service to other accounts via RAM
   * @param props
   */
  share(props: ShareServiceProps): void;

  /**
  * Create a DNS entry in R53 for the service.
  */
  addDNSEntry(props: aws_vpclattice.CfnService.DnsEntryProperty): void;

  /**
   * Add a certificate to the service
   * @param certificate
   */
  addCertificate(certificate: certificatemanager.Certificate): void;

  /**
   * add a custom domain to the service
   * @param domain
   */
  addCustomDomain(domain: string): void;

  /**
   * add a name for the service
   * @default cloudformation will provide a name
   */
  addName(name: string): void;
  /**
   *grant a Principal access to a Services Path
   * @deafult
   */
   grantAccess(props: grantAccessProps): void; 

}
```
#### ServiceNetwork
```typescript
/**
 * Create a vpc lattice service network.
 * Implemented by `ServiceNetwork`
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
   * Add LatticeAuthPolicy
   */
  addLatticeAuthPolicy(policyDocument: iam.PolicyStatement[]): void;
  /**
   * Add Lattice Service Policy
   */
  addService(service: vpclattice.Service): void;
  /**
   * Associate a VPC with the Service Network
   */
  associateVPC(vpc: ec2.Vpc, securityGroups: ec2.SecurityGroup[]): void;
  /**
   * Log To S3
   */
  logToS3(bucket: s3.Bucket | s3.IBucket ): void;
  /**
   * Send Events to Cloud Watch
   */
  sendToCloudWatch(log: logs.LogGroup | logs.ILogGroup ): void;
  /**
   * Stream to Kinesis
   */
  streamToKinesis(stream: kinesis.Stream | kinesis.IStream ): void;
  /**
   * Share the ServiceNetwork
   */
  share(props: ShareServiceNetworkProps): void;
  /**
  * Create a service network from Attributes.  
  * This function only needs to be used when it is not possible to pass
  * a ServiceNetwork between cdk apps or stacks.
  */ 
  fromServiceNetworkAttributes(attrs: ServiceNetworkAttributes): void;

}
```
#### TargetGroups
```typescript
/**
 * Create a vpc lattice TargetGroup.
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






## SCRUM - USER STORIES

As a consumer of cdk constructs I would like a L2 CDK Construct for Aws Lattice that;
* Is intuitive, and consistent with the general approach of cdk, and the service documentation. 
* Abstracts the underlying complexities of the lattice service so, it is easy to concentrate on the solution. 
* Integration between this construct and other CDK constructs
* Apply secure, best practice configurations as default

As a Service Owner I would like to:
* Publish my service for others to access
* Control Authentication and Authorisation for my services
* Control load distribution across my compute resources
* Hide the implementation detail of my services from consumers

As a Service Consumer I would like to:
* Be able have my resources use services that are available to me in my VPCs
* Authenticate with services
* Restrict access for services to security groups that I decide

As a Platform/Network Admin I would like to:
* Create Service Networks for Owners and Consumers to use

***



## FAQ

### What is the scope of this RFC?

This RFC Provides Classes and Methods to implement The VPC Lattice Service. 
This construct handles all the different resources you can use with VPC Lattice: Service Network, Service, Listeners, Listener Rules, Target Groups (and targets), and Associations (Service or VPC). 

### Why should I use this construct?

This CDK L2 Construct can be used to deploy resources from [Amazon VPC Lattice](https://docs.aws.amazon.com/vpc-lattice/latest/ug/what-is-vpc-service-network.html). VPC Lattice is a fully managed application networking service that you use to connect, secure, and monitor all your services across multiple accounts and virtual private clouds (VPCs).


You can check common [Amazon VPC Lattice Reference Architectures](https://d1.awsstatic.com/architecture-diagrams/ArchitectureDiagrams/lattice-use-cases-ra.pdf) to understand the different use cases you can build with the AWS service.
Examples of use for these constructs, are at .....


* [vpc-lattice-an-implementation-of-kubernetes](https://aws.amazon.com/blogs/containers/introducing-aws-gateway-api-controller-for-amazon-vpc-lattice-an-implementation-of-kubernetes-gateway-api/)

### Is this a breaking change?

* No this will not break exisiting CDK functionality. 


Ticking the box below indicates that the public API of this RFC has been signed-off by the API bar raiser (the `api-approved` label was applied to the RFC pull request):


`[ ]` Signed-off by API Bar Raiser @TheRealAmazonKendra
