---
feature name: Go Language Bindings
start date: 2020-07-17
rfc pr: (leave this empty)
related issue: <https://github.com/aws/aws-cdk/issues/547>
---

# Summary

This RFC proposes to support Go language bindings for the CDK.

# Motivation

Go has seen a huge rise in popularity in recent years and is the language of choice for many infrastructure tools, particularly in the container
world. It has ranked high in recent years on the StackOverflow Developer Survey, especially for such a young language, and with the continued
popularity of containers and trend towards developers owning their infrastructure, there is a high demand for using Go for infrastructure-as-code
tooling.

# Design Summary

In order to create the JSII Go language binding, the various types defined in the JSII spec need to be translated into equivalent types in Go. The
three main types discussed here are Enums, Interfaces, and Classes.

# Detailed Design

## Enums

The standard way of specifying an enum in Go is with a custom type and constant generator iota, e.g.

```go
type Month int // custom type, like type alias

const (
    Jan Month = iota + 1
    Feb
    Mar
    Apr
    May
    ...
)
// Jan=1, Feb=1, Mar=3 ...
```

Since Enums in the CDK are not always iterative, using a constant generator may not be the best translation. We could instead have string values, with
the name of the constant prefixed with the name of the Typescript enum to avoid potential namespace collisions, e.g.:

```ts
export enum LaunchType {
  /**
   * The service will be launched using the EC2 launch type
   */
  EC2 = 'EC2',

  /**
   * The service will be launched using the FARGATE launch type
   */
  FARGATE = 'FARGATE'
}
```

Go translation:

```go
type LaunchType string

const (
    LaunchTypeEc2     LaunchType = "EC2"
    LaunchTypeFargate LaunchType = "FARGATE"
)
```

*_NOTE_*: This would be consistent with how the [aws-sdk-go](https://github.com/aws/aws-sdk-go/blob/master/service/ecs/api.go#L20410-L20416) handles enums.

## Interfaces

### Go Interfaces

Go Interfaces are named collections of *method signatures*. They can be implemented by other types, including other interfaces. Go interfaces are
implemented *implicitly*, so, e.g., the implements keyword is not needed by the type that is implementing an interface. Interfaces can embed other
interfaces, which effectively allows the embedding interface to “inherit” all the methods defined in the embedded interface. This is the closest to
how typescript interfaces use extends.

Interfaces can be used as fields on structs as way to encapsulate behavior and facilitate testing.

### Typescript Interfaces

Typescript Interfaces are types (similar to type aliases) which have *methods* and *properties*. They can *extend* other interfaces or other
types/classes (whereas a type alias would use a type intersection instead of extends). There are three major differences between type aliases and
interfaces:

1. _Shape rather than type definition_: Define a shape rather than a collection of possible types
2. _Extension type checking_: Extending an interface with any of the properties/methods overridden by the interface that is extending it will cause a
   type error, whereas a type alias will do its best to create an overloaded signature. This is useful when modeling inheritance.
3. _Declaration merging_: Multiple interfaces in the same scope with the same name are merged; multiple type aliases of the same name will throw a
   compile-time error.

Classes that implement an interface do so *explicitly* by using the implements keyword.

In the JSII, there are two types of interfaces; *datatype* interfaces (or *structs*) and *non-datatype* interfaces (conventionally named `IXxx`, where
`Xxx` is a resource name). The following describes how to handle each kind.

### JSII Non-Datatype Interfaces (Structs)

Typescript interfaces that define method signatures can be translated directly as Go interfaces. Any properties that the interface may contain would
be converted to getters (and setters, as needed).

**Example**:

Typescript interface:

```ts
export interface ISecurityGroup extends IResource, IPeer {
  readonly securityGroupId: string;
  readonly allowAllOutbound: boolean;

  addIngressRule(peer: IPeer, connection: Port, description?: string, remoteRule?: boolean): void;
  addEgressRule(peer: IPeer, connection: Port, description?: string, remoteRule?: boolean): void;
}
```

Go interface:

```go
type ISecurityGroup interface {
    IResource
    IPeer

    SecurityGroupId() string
    AllowAllOutbound() bool
    AddIngressRule(peer: IPeer, connect: Port, description: *string, remoteRule: *boolean)
    AddEgressRule(peer: IPeer, connect: Port, description: *string, remoteRule: *boolean)
}
```

### JSII Datatype Interfaces (`IResource`)

In the JSII, the InterfaceType has a [datatype field](https://github.com/aws/jsii/blob/master/packages/%40jsii/spec/lib/assembly.ts#L879-L888)
attribute that indicates that the interface only contains properties. While this does corresponds directly to a Go struct, we would likely need to
generate both a Go interface that contains getter methods that correspond to each property as well as a Go struct that implements that interface. This
is in order to support subtyping, as the interface is typically what is passed as an argument into other functions, as well as to ensure forward
compatibility in case the datatype interface eventually extends another. Were it not for these considerations, it would be simpler to simply have a
single Go struct that corresponds to a datatype interface (see last bullet point in Notes/Concerns).

#### Case 1: Typescript datatype interface (no extensions)

Here, a datatype interface (`HealthCheck`) is converted into a Go interface (`HealthCheck`), where each property becomes a
getter method (JSII datatype properties always are readonly, so there are no setter methods generated). This Go interface is then implemented by a struct
(LinuxParameterProps), which would contain the properties from the original typescript interface as non-exported (i.e. lowercase) properties and rely
on the generated Getter methods for readonly access (as when _used as an argument_ to the constructor):

[Example](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-ecs/lib/container-definition.ts#L596):

```ts
export interface HealthCheck {
  readonly command: string[];
  readonly interval?: cdk.Duration;
  readonly retries?: number;
  readonly startPeriod?: cdk.Duration;
  readonly timeout?: cdk.Duration;
}

function renderHealthCheck(hc: HealthCheck): CfnTaskDefinition.HealthCheckProperty {
  return {
    command: getHealthCheckCommand(hc),
    interval: hc.interval != null ? hc.interval.toSeconds() : 30,
    retries: hc.retries !== undefined ? hc.retries : 3,
    startPeriod: hc.startPeriod && hc.startPeriod.toSeconds(),
    timeout: hc.timeout !== undefined ? hc.timeout.toSeconds() : 5,
  };
}
```

Go translation (Run example in the [Go playground](https://play.golang.org/p/_eRLhVmXmp8):

```go
package ecs

type HealthCheckIface interface{
   Command() []string
   Interval() cdk.Duration;
   Retries() int
   StartPeriod() cdk.Duration;
   Timeout() cdk.Duration;
}

type HealthCheck struct {
    command []string
    interval cdk.Duration;
    retries int
    startPeriod cdk.Duration;
    timeout cdk.Duration;
}

func (h HealthCheck) Command() []string {
    return h.command
}

func (h HealthCheck) Retries() int {
    return h.retries
}

func (h HealthCheck) Interval() cdk.Duration {
    return h.interval
}

func (h HealthCheck) StartPeriod() cdk.Duration {
    return h.startPeriod
}

func (h HealthCheck) Timeout() cdk.Duration {
    return h.timeout
}

func renderHealthCheck(hc HealthCheck) CfnTaskDefinition.HealthCheckProperty {
    return CfnTaskDefintion.HealthCheckProperty{
        command:     hc.Command(),
        interval:    hc.Interval(),
        retries:     hc.Retries(),
        startPeriod: hc.StartPeriod(),
        timeout:     hc.Timeout(),
    }
}
```

#### Case 2: Extending Typescript datatype interfaces

For Typescript datatype interfaces that extend another datatype interface, the corresponding interfaces and implementing structs would be generated in
go, with the extending interface embedding the extended one, e.g.:

```ts
export interface BaseServiceOptions {
  readonly cluster: ICluster;
  readonly desiredCount?: number;
  readonly serviceName?: string;
  readonly maxHealthyPercent?: number;
  readonly minHealthyPercent?: number;
  readonly healthCheckGracePeriod?: Duration;
  readonly cloudMapOptions?: CloudMapOptions;
  readonly propagateTags?: PropagatedTagSource;
  readonly enableECSManagedTags?: boolean;
  readonly deploymentController?: DeploymentController;
}

export interface BaseServiceProps extends BaseServiceOptions {
  readonly launchType: LaunchType;
}
```

As before, the Go translation would have the getter methods (e.g. readonly cluster) defined in a the generated interface, which correspond to
non-exported struct members in the struct that implements each getter.

```go
package ecs

type BaseServiceOptionsIface interface {
    Cluster()                ICluster
    DesiredCount()           *int
    ServiceName()            *string
    MaxHealthyPercent()      *int
    MinHealthyPercent()      *int
    HealthCheckGracePeriod() *Duration
    CloudMapOptions()        CloudMapOptions
    PropagateTags()          PropagatedTagSource
    EnableECSManagedTags()   *bool
    DeploymentController()   DeploymentController
}

type BaseServicePropsIface interface {
    serviceOptions           BaseServiceOptionsIface  // embeddeded interface
    LaunchType()             LaunchType
}

type BaseServiceOptions struct {
    cluster                ICluster
    desiredCount           *int
    serviceName            *string
    maxHealthyPercent      *int
    minHealthyPercent      *int
    healthCheckGracePeriod *Duration
    cloudMapOptions        CloudMapOptions
    propagateTags          PropagatedTagSource
    enableECSManagedTags   *bool
    deploymentController   DeploymentController
}

type BaseServiceProps struct {
    baseOptions         BaseServiceOptions  // embedded (anonymous?) field
    launchType          LaunchType
}

func (o BaseServiceOptions) Cluster() ICluster { return o.cluster }
func (o BaseServiceOptions) DesiredCount() int { return o.desiredCount }

// ... etc

```

This allows the embedding interface (here, `BaseServicePropsIFace`) to "inherit" all the methods defined in the embedded interface
(`BaseServiceOptionsIFace`). Similarly, the embedding struct (`BaseServiceProps`) would have access to all the properties of the embedded struct
(`BaseServiceOptions`) through having it as an anonymous field (See: [Go playground example](https://play.golang.org/p/XRpTH3LN6bx)).

```go
props := BaseServiceProps{
    BaseServiceOptions{
      ServiceName: "myService",
      ...
    },
    LaunchType: "EC2",
}

props.ServiceName  // => "myService"
```

### Notes/Concerns

* When fields in the Go struct are exported, the struct cannot have a method with the same name (e.g. exported field `Bar` , and method `Bar()`.
   Using a `Bar()` getter on a private field bar is most consistent with idiomatic Go;  however, this may make code generation more difficult since it
would potentially necessitate converting public properties on the source (JSII) class into an interface implemented by the custom struct (Go “class”).
The *alternative* to this is to prefix the methods in the generated Go interface with Get, e.g. `GetBar()` to avoid the name collision.
* Like the AWS Go SDK, we can use pointers to primitive types to simulate that fields are optional (i.e. allow null values rather than default “empty”
  values for each type, which are not nullable)
* Generated Go interfaces corresponding to a datatype interface would need a suffix, e.g. Iface,  in order to disambiguate it from the struct. This is
  a bit verbose, and it may be worth considering switching the naming (i.e. adding a suffix to the struct instead) if the interface name is what will
primarily be used by the customer.

* The alternative to having to implement both a struct and interface is simply translating the datatype interface into a struct. This option has the
  added advantage of having a more streamlined API, rather than having to convert each property into a getter method and having to call those methods
to access data fields. For example, something like the
[HealthCheck](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-ecs/lib/container-definition.ts#L596-L642) interface in a container
definition would be converted into a Go struct:

```go
type HealthCheck struct {
    Command []string
    Interval cdk.Duration;
    Retries int
    StartPeriod cdk.Duration;
    Timeout cdk.Duration;
}
```

This would allow a function that takes that interface as an argument, such as
[renderHealthCheck](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-ecs/lib/container-definition.ts#L652-L660) look like this
(simplified, without accounting for default values):

```go
func renderHealthCheck(hc HealthCheck) CfnTaskDefinition.HealthCheckProperty {
    return CfnTaskDefintion.HealthCheckProperty{
        command:     hc.Command,
        interval:    hc.Interval,
        retries:     hc.Retries,
        startPeriod: hc.StartPeriod,
        timeout:     hc.Timeout,
    }
}

```

Rather than:

```go
func renderHealthCheck(hc HealthCheck) CfnTaskDefinition.HealthCheckProperty {
    return CfnTaskDefintion.HealthCheckProperty{
        command:     hc.GetCommand(),
        interval:    hc.GetInterval(),
        retries:     hc.GetRetries(),
        startPeriod: hc.GetStartPeriod(),
        timeout:     hc.GetTimeout(),
    }
}
```

## Classes

Typescript takes an object-oriented approach to classes, which includes using polymorphism and subtyping, neither of which are natively supported in
Go, which is not an object-oriented language. While custom structs, which can be used as pointer receivers in function definitions to simulate
methods", can be used to encapsulate object-like behavior in Go, subtyping on these custom structs is not possible. In order to simulate subtyping, we
would need to generate an interface in addition to a concrete struct for each JSII class.

The JSII [ClassType](https://github.com/aws/jsii/blob/master/packages/%40jsii/spec/lib/assembly.ts#L803) provides information on whether a
class is abstract, whether it extends another class, and whether it implements other interfaces. We will discuss each case in turn.

### Case 1: Simple class

Example (Taken from [Typescript handbook](https://www.typescriptlang.org/docs/handbook/classes.html#classes)):

```ts
class Greeter {
    readonly greeting: string;

    constructor(message: string) {
        this.greeting = message;
    }

    greet(): string {
        return "Hello, " + this.greeting;
    }
}

let greeter = new Greeter("world");
greeter.greet() // "Hello, world"
```

In Go: ([Go playground example](https://play.golang.org/p/cMW3Rv0lERh))

```go
package greeter

type GreeterIface interface {
    Greet() string
}

type Greeter struct {
    greeting string
}

func New(message string) *Greeter {
    return &Greeter{message}
}

func (g *Greeter) Greet() string {
    return fmt.Sprintf("Hello, %+s", g.greeting)
}

// usage
g := greeter.New("world")
fmt.Println(g.Greet()) // "Hello, world"
```

### Case 2: Extending a Base class

Example (taken from [here](https://www.typescriptlang.org/docs/handbook/classes.html#inheritance)):

```ts
class Animal {
    public readonly name: string;

    constructor(theName: string) { this.name = theName; }

    public move(distanceInMeters: number = 0) {
        console.log(`${this.name} moved ${distanceInMeters}m.`);
    }
}

class Snake extends Animal {
    constructor(name: string) { super(name); }
    public move(distanceInMeters = 5) {
        console.log("Slithering...");
        super.move(distanceInMeters);
    }
}

const sam = new Snake("Sammy the Python");

sam.move();
//  Slithering...
// Sammy the Python moved 10m.
```

In Go:
([Go playground example](https://play.golang.org/p/ZwoKmLn5OkV))
([Example with embedded field as named property](https://play.golang.org/p/nWfmHhxbs1G))

```go
package animal

// Base class as interface
type AnimalIface interface {
    Name() string
    Move(distance int64)
}

// Base class implementation
type Animal struct {
    name string
}

func NewAnimal(name string) AnimalIface {
    return &Animal{name}
}

func (a *Animal) Name() string {
    return a.name
}

func (a *Animal) Move(distance int64) {
    fmt.Printf("%s moved %vm.\n", a.Name(), distance)
}

// Child class
type SnakeIface interface {
  AnimalIface
}

type Snake struct {
    Animal
}

func NewSnake(name string) SnakeIface {
    return &Snake{Animal{name}}
}

func (s *Snake) Name() string {
    return s.Animal.Name()      // simulates "super" call
}

func (s *Snake) Move(distance int64) {
    fmt.Printf("Slithering...\n")
    s.Animal.Move(distance)
}

// usage:
dumpling := NewAnimal("Dumpling the Dog")
dumpling.Move(5)

sam := NewSnake("Sammy the Python")
sam.Move(10)

// Dumpling the Dog moved 5m.
// Slithering...
// Sammy the Python moved 10m.
```

### Case 3: Class that implements an interface

Using embedding can also be used for a Typescript class that implements an interface:

```ts
// Typescript

export interface ICluster extends IResource {
  readonly clusterName: string;
  readonly clusterArn: string;
  readonly vpc: ec2.IVpc;
  readonly connections: ec2.Connections;
  readonly hasEc2Capacity: boolean;
  readonly defaultCloudMapNamespace?: cloudmap.INamespace;
  readonly autoscalingGroup?: autoscaling.IAutoScalingGroup;
}

export class Cluster extends Resource implements ICluster {
  public static fromClusterAttributes(scope: Construct, id: string, attrs: ClusterAttributes): ICluster {
    return new ImportedCluster(scope, id, attrs);
  }
  public readonly connections: ec2.Connections = new ec2.Connections();
  public readonly vpc: ec2.IVpc;
  public readonly clusterArn: string;
  public readonly clusterName: string;

  private _defaultCloudMapNamespace?: cloudmap.INamespace;
  private _hasEc2Capacity: boolean = false;
  private _autoscalingGroup?: autoscaling.IAutoScalingGroup;
...
}
```

Go struct (derived from TS class) with embedded struct (derived from TS datatype interface):

```go
type ICluster interface {
    IResource

    ClusterName()              string
    ClusterArn()               string
    Vpc()                      ec2.IVpc
    Connections()              ec2.Connections
    HasEc2Capacity()           bool
    DefaultCloudMapNamespace() cloudmap.INamespace
    AutoscalingGroup()         autoscaling.IAutoScalingGroup
}

// Generated interface for Cluster class
type ClusterIface interface {
    ICluster
}

// Generated struct for Cluster class
type Cluster struct {
    Resource
    ICluster

    connections ec2.Connections
    vpc         ec2.IVpc
    clusterArn  string
    clusterName string

    defaultCloudMapNamespace cloudmap.INamespace
    hasEc2Capacity           bool
    autoscalingGroup         autoscaling.IAutoScalingGroup
}

func (c *Cluster) ClusterName() string {
    return c.clusterName
}

// ...etc
```

### Case 4: Abstract Classes

These should be able to be handled much in the same way as regular classes, by generating an interface and a struct. The struct generation is still
necessary in this case because method implementations can actually be defined on abstract classes in Typescript.

## Other considerations

### Primitive types

#### Date

JSII Date would be satisfied by Go's `time.Time` type.

#### String

JSII String would be satisfied by Go's string type.

#### Number

JSII number does not distinguish the difference between integer and float. This either requires JSII for Go to treat all numbers as float64, or define
a new jsii.Number type that "wraps" Go number types into the singular JSII Number type.

Typescript numbers are float64 with a max integer size of 2^53 -1. This means that Customers could want to provide a int64 value that would lose
precision.

#### Any

JSII any maps to Go's empty interface type. JSII for Go should replace all JSII any types with interface{}.

### Promise

Promises do not exist natively in Go. JSII functions would be wrapped within a synchronous Go function that wait for the async JSII function to be
complete, and return either the result or an error. This is the same pattern used for Java and .Net JSII bindings.

```go
func JSIIPromise() (resp, error) { /* ... */ }
```

### Packages and submodules

Go package names correspond to a single directory, since their full path is used when imported from other packages. Packages cannot be split across
multiple directories, nor can more than one package be specified in the same directory. NOTE: This does not apply subdirectories.

By convention, package names in go are lower case without underscores or mixed caps. However, many of the module names in the CDK are quite
long/verbose, resulting in names that don’t necessarily fit the succinct style of Go. Currently, we are staying with convention of having a single,
lower-cased package name. However, we may want to consider alternatives such as adding underscores or mixed caps for readability.

### Packaging

Unlike Node, which has NPM, or other languages, there is no central package repository for Go; packages/dependencies are fetched from their source
location, usually on GitHub.

Packages are imported by name (for stdlib packages) or URL (for external packages) using the import keyword, and should be grouped alphabetically
(running gofmt will take care of the alphabetization automatically). As of Go 1.11, the use of go modules is the recommended mechanism for managing
package dependencies. Imports may be aliased to avoid namespace collisions.

# Drawbacks

The programming model for Go differs significantly from that of Typescript. Imposing an object-oriented philosophy on a procedural language may result
in non-idiomatic constructs and APIs in the target language. However, the tradeoff for having CDK constructs available in more languages outweights
this disadvantage.

# Unresolved questions

- Some details of class inheritence, especially from abstract classes, as they are tricky to model in Go idiomatically.
- Naming of interfaces/structs generated for datatype interfaces and classes
- submodule/package organization within a construct library

# Future Possibilities

This will hopefully further pave the way for more language bindings for the CDK.
