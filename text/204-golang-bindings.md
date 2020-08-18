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

In order to create the jsii Go language binding, the various types defined in the jsii spec need to be translated into equivalent types in Go. The
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
package launchtype

type LaunchType string

const (
    LaunchTypeEc2     LaunchType = "EC2"
    LaunchTypeFargate LaunchType = "FARGATE"
)
```

*_NOTE_*: This would be consistent with how the [aws-sdk-go](https://github.com/aws/aws-sdk-go/blob/master/service/ecs/api.go#L20410-L20416) handles
enums.

We could also add some utility functions to make the API a little neater:

```go
func EC2() LaunchType {
    return LaunchTypeEc2
}

func Fargate() LaunchType {
    return LaunchTypeFargate
}

func Values() []LaunchType {
    return []LaunchType{
        LaunchTypeEc2,
        LaunchTypeFargate,
    }
}
```

Encapsulating the enum within a package would then create an intuitive namespacing (Run example in the [Go
playground](https://play.golang.org/p/olztr74OKsk))

```go
fmt.Println(launchtype.EC2()) // => "EC2"
fmt.Println(launchtype.Fargate()) // => "FARGATE"
fmt.Println(launchtype.Values()) // => [EC2 FARGATE]
```

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

In jsii, there are two types of interfaces; *structs* (aka: *datatypes* - immutable pure data objects) and *behavioral interfaces* (named `IXxx`,
where `Xxx` is a resource name). The following describes how to handle each kind.

### JSII Non-Datatype Interfaces (`IResource`)

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

### JSII Datatype Interfaces (Structs)

In jsii, the InterfaceType has a [datatype field](https://github.com/aws/jsii/blob/master/packages/%40jsii/spec/lib/assembly.ts#L879-L888) attribute
that indicates that the interface only contains readonly properties. While this does corresponds directly to a Go struct, we would likely need to
generate both a Go interface that contains getter methods that correspond to each property as well as a Go struct that implements that interface. This
is in order to support subtyping, as the interface is typically what is passed as an argument into other functions, as well as to ensure forward
compatibility in case the datatype interface eventually extends another. Were it not for these considerations, it would be simpler to simply have a
single Go struct that corresponds to a datatype interface (see last bullet point in Notes/Concerns).

#### Case 1: Typescript struct/datatype interface (no extensions)

In the case of a simple a datatype interface (`HealthCheck`) without extensions, we would generate both a Go struct (HealthCheck), which would hold
the properties of the original typescript interface as public members, and a Go interface (`IHealthCheck`) that defines getter methods for each
property that would be implemented by the corresponding struct (jsii datatype properties always are readonly, so there are no setter methods
generated). Since Go does not allow a struct to have exported members with the same name as an interface method, we would have to prefix the interface
methods; the recommendation here is to use a `Get` prefix.

[Example](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-ecs/lib/container-definition.ts#L596):

```ts
export interface HealthCheck {
  readonly command: string[];
  readonly interval?: cdk.Duration;
  readonly retries?: number;
  readonly startPeriod?: cdk.Duration;
  readonly timeout?: cdk.Duration;
}

function renderHealthCheck(hc: HealthCheck): cfntaskdefinition.HealthCheckProperty {
  return {
    command: getHealthCheckCommand(hc),
    interval: hc.interval != null ? hc.interval.toSeconds() : 30,
    retries: hc.retries !== undefined ? hc.retries : 3,
    startPeriod: hc.startPeriod && hc.startPeriod.toSeconds(),
    timeout: hc.timeout !== undefined ? hc.timeout.toSeconds() : 5,
  };
}
```

Go translation (Run example in the [Go playground](https://play.golang.org/p/o84uoUGORYH):

```go
package ecs

type IHealthCheck interface{
   GetCommand() []string
   GetInterval() cdk.Duration;
   GetRetries() int
   GetStartPeriod() cdk.Duration;
   GetTimeout() cdk.Duration;
}

type HealthCheck struct {
    Command []string
    Interval cdk.Duration;
    Retries int
    StartPeriod cdk.Duration;
    Timeout cdk.Duration;
}

// See NOTE below
func (h HealthCheck) GetCommand() []string {
    return append([]string{}, h.Command...)
}

func (h HealthCheck) GetRetries() int {
    return h.Retries
}

func (h HealthCheck) GetInterval() cdk.Duration {
    return h.Interval
}

func (h HealthCheck) GetStartPeriod() cdk.Duration {
    return h.StartPeriod
}

func (h HealthCheck) GetTimeout() cdk.Duration {
    return h.Timeout
}

func renderHealthCheck(hc HealthCheck) cfntaskdefinition.HealthCheckProperty {
    return CfnTaskDefintion.HealthCheckProperty{
        Command:     hc.GetCommand(),
        Interval:    hc.GetInterval(),
        Retries:     hc.GetRetries(),
        StartPeriod: hc.GetStartPeriod(),
        Timeout:     hc.GetTimeout(),
    }
}
```

**NOTE**: To ensure immutability, getters that return a slice type should return a copy of the slice, since elements could be reordered or replaced

It is worth noting that this is not the idiomatic Go way of accessing struct members; normally, a struct would contain unexported members (e.g.
`command`) and implement a Getter method with the uppercase method name (e.g.  `Command()`). However, having unexported members would make
instantiating the struct unreasonably difficult for our use case, as struct members can only be set if they are exported. This does make the syntax
more unwieldy when accessing the members within a function that takes the datatype interface as an argument, but the tradeoff is easier instantiation.

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

The interface generated for the jsii struct being extended would be **embedded** in the extending struct.

```go
package ecs

type BaseServiceOptionsIface interface {
    GetCluster()                ICluster
    GetDesiredCount()           *int
    GetServiceName()            *string
    GetMaxHealthyPercent()      *int
    GetMinHealthyPercent()      *int
    GetHealthCheckGracePeriod() *Duration
    GetCloudMapOptions()        CloudMapOptions
    GetPropagateTags()          PropagatedTagSource
    GetEnableECSManagedTags()   *bool
    GetDeploymentController()   DeploymentController
}

type BaseServicePropsIface interface {
    BaseServiceOptionsIface  // embeddeded interface
    GetLaunchType()             LaunchType
}
```

However, for the corresponding structs, we can take one of two approaches:

the first is to embed the extended struct into the extending struct:
(See: [Go playground example](https://play.golang.org/p/Dcww2kYR_Qx)).

```go
type BaseServiceOptions struct {
    Cluster                ICluster
    DesiredCount           *int
    ServiceName            *string
    MaxHealthyPercent      *int
    MinHealthyPercent      *int
    HealthCheckGracePeriod *Duration
    CloudMapOptions        CloudMapOptions
    PropagateTags          PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   DeploymentController
}
type BaseServiceProps struct {
    BaseServiceOptions  // embedded (anonymous) field
    LaunchType          LaunchType
}

func (o BaseServiceOptions) Cluster() ICluster { return o.Cluster }
func (o BaseServiceOptions) DesiredCount() int { return o.DesiredCount }
// ... etc

// BaseServiceProps does not have to re-implement all the methods above
func (p BaseServiceProps) GetLaunchType() string     { return p.LaunchType }


// example function that takes the embedding interface
func TakesBaseServicePropsIface(props BaseServicePropsIface) {
    fmt.Printf("Class: %T\nValue:%+[1]v", props)
}
```

This allows the embedding struct (here, `BaseServiceProps`) to "inherit" all the methods defined in the embedded interface
(`BaseServiceOptionsIFace`) automatically.

The advantages of this approach are:

- there would be less boilerplate, since `BaseServiceProps` would not need to re-implement the methods defined in `BaseServiceOptionsIface`.
- any changes to the extended interface would automatically be inherited by the extending interface.

The main disadvantage of embedding is that instantiating the struct would require knowledge of which properties are inherited from the embedded
struct, i.e.:

```go
serviceProps := ecs.BaseServiceProps{
    ServiceName:       "myService",
    MaxHealthyPercent: 100,
    MinHealthyPercent: 50,
    LaunchType: "EC2",
}

ecs.TakesBaseServicePropsIface(serviceProps)
```

The second approach is not to embed the struct, but **flatten** all the properties inherited from the extended interface.
(See: [Go playground example](https://play.golang.org/p/ioL4XRpjETA)).

```go
type BaseServiceOptions struct {
    Cluster                ICluster
    DesiredCount           *int
    ServiceName            *string
    MaxHealthyPercent      *int
    MinHealthyPercent      *int
    HealthCheckGracePeriod *Duration
    CloudMapOptions        CloudMapOptions
    PropagateTags          PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   DeploymentController
}

type BaseServiceProps struct {
    // Flattened properties generated from extended interface (i.e. Base ServiceOptions)
    Cluster                ICluster
    DesiredCount           *int
    ServiceName            *string
    MaxHealthyPercent      *int
    MinHealthyPercent      *int
    HealthCheckGracePeriod *Duration
    CloudMapOptions        CloudMapOptions
    PropagateTags          PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   DeploymentController

    LaunchType          LaunchType
}

func (o BaseServiceOptions) GetServiceName() string    { return o.ServiceName }
func (o BaseServiceOptions) GetMaxHealthyPercent() int { return o.MaxHealthyPercent }
func (o BaseServiceOptions) GetMinHealthyPercent() int { return o.MinHealthyPercent }

// ... etc

// Generated interface methods inherited from BaseServiceOptionsIface
func (p BaseServiceProps) GetServiceName() string    { return p.ServiceName }
func (p BaseServiceProps) GetMaxHealthyPercent() int { return p.MaxHealthyPercent }
func (p BaseServiceProps) GetMinHealthyPercent() int { return p.MinHealthyPercent }
func (p BaseServiceProps) GetLaunchType() string     { return p.LaunchType }

// ... etc
```

This approach would allow for properties to be passed to a function in a flattened data structure, i.e.

```go
serviceProps := ecs.BaseServiceProps{
    ServiceName:       "myService",
    MaxHealthyPercent: 100,
    MinHealthyPercent: 50,
    LaunchType: "EC2",
}

ecs.TakesBaseServicePropsIface(serviceProps)
```

The disadvantage is that there is much more boilerplate generated to implement the inherited methods, and any change to the inherited interface would
be a breaking change to anything inheriting it. For the latter concern, within the jsii, any generated code would be tied to some version of jsii, so
we would be able to re-generate datatype interfaces that extend other datatypes. For customers creating their own custom constructs, they could
mititage potential breaking changes in jsii interfaces by creating their own interface wrappers, e.g.

```go
// custom method that takes wrapped interface
func myCustomMethod(props CustomServicePropsIface) {...}

// wrapper - takes subset of methods definfed in BaseServiceOptionsIface
type CustomServicePropsIface interface {
    GetServiceName() string
    GetMaxHealthyPercent() int
    GetMinHealthyPercent() int
}
```

### Notes/Concerns

* Like the AWS Go SDK, we can use pointers to primitive types to simulate that fields are optional (i.e. allow null values rather than default "empty"
  values for each type, which are not nullable)
* Generated Go interfaces corresponding to a datatype interface would need a suffix, e.g. Iface, in order to disambiguate it from the struct. This is
  a bit verbose, and it may be worth considering switching the naming (i.e. adding a suffix to the struct instead) if the interface name is what will
primarily be used by the customer.
* The alternative to having to implement both a struct and interface is simply translating the datatype interface into a struct. This option has the
  added advantage of having a more streamlined API, rather than having to convert each property into a getter method and having to call those methods
to access data fields. However, this is not a viable option since in order to pass them as arguments to functions, structs would have to be
structurally typed, which is not the case for Go structs. The only way to satisfy the structural typing requirements of argments is through
interfaces.

## Classes

Typescript takes an object-oriented approach to classes, which includes using polymorphism and subtyping, neither of which are natively supported in
Go, which is not an object-oriented language. While custom structs, which can be used as pointer receivers in function definitions to simulate
methods", can be used to encapsulate object-like behavior in Go, subtyping on these custom structs is not possible. In order to simulate subtyping, we
would need to generate an interface in addition to a concrete struct for each jsii class.

The jsii [ClassType](https://github.com/aws/jsii/blob/master/packages/%40jsii/spec/lib/assembly.ts#L803) provides information on whether a
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
// Sammy the Python moved 5m.
```

In Go:
([Go playground example](https://play.golang.org/p/v9gVW0bG2y1))
([Example with embedded field as named property](https://play.golang.org/p/nWfmHhxbs1G))

```go
package animal

// Base class as interface
type AnimalIface interface {
    Name() string
    Move(distance int64)
    isAnimal() // private method saftey check
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

// Snake class would be customer-defined extension of Animal
type Snake struct {
    Animal
}

func NewSnake(name string) SnakeIface {
    a := NewAnimal{name}  // or ExtendAnimal, to avoid introspection for super calls later
    return &Snake{a}
}

func (s *Snake) Name() string {
    return s.name  // inherits `name` property from `Animal`
}

func (s *Snake) Move(distance int64) {
    fmt.Printf("Slithering...\n")
    // how to look up Animal.Move to delegate to the node runtime? Use JSII-reflect
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

JSII number does not distinguish the difference between integer and float. This either requires jsii for Go to treat all numbers as float64, or define
a new jsii.Number type that "wraps" Go number types into the singular jsii Number type.

Typescript numbers are float64 with a max safe integer size of 2^53 -1. This means that Customers could want to provide a int64 value that would lose
precision.

#### Any

JSII any maps to Go's empty interface type. JSII for Go should replace all jsii any types with interface{}.

### Promise

Promises do not exist natively in Go. JSII functions would be wrapped within a synchronous Go function that wait for the async jsii function to be
complete, and return either the result or an error. This is the same pattern used for Java and .Net jsii bindings.

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
in non-idiomatic constructs and APIs in the target language. However, the tradeoff for having CDK constructs available in more languages outweighs
this disadvantage.

# Unresolved questions

- Some details of class inheritence, especially from abstract classes, as they are tricky to model in Go idiomatically.
- Naming of interfaces/structs generated for datatype interfaces and classes
- submodule/package organization within a construct library

# Future Possibilities

This will hopefully further pave the way for more language bindings for the CDK. It would also be interesting to use this as a stepping stone to
create an automated scaffolding for other target language code generation.
