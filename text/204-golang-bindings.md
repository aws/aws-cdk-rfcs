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
// Jan=1, Feb=2, Mar=3 ...
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
  FARGATE = 'FARGATE',

  /**
   * A third option (made up for the sake of the exercise - many enum constants
   * have underscores in their names).
   */
  THIRD_OPTION = 'THIRD_OPTION',
}
```

Go translation:

```go
package launchtype

type LaunchType string

const (
 LaunchType_EC2          LaunchType = "EC2"
 LaunchType_FARGATE      LaunchType = "FARGATE"
 LaunchType_THIRD_OPTION LaunchType = "THIRD_OPTION"
)
```

*_NOTE_*: This would be consistent with how the [aws-sdk-go](https://github.com/aws/aws-sdk-go/blob/master/service/ecs/api.go#L20410-L20416) handles
enums.

### Possible Extensions

We could also add some utility functions to make the API a little neater:

```go
func EC2() LaunchType {
    return LaunchType_EC2
}

func FARGATE() LaunchType {
    return LaunchType_FARGATE
}

func THIRD_OPTION() LaunchType {
    return LauncType_THIRD_OPTION
}

func Values() []LaunchType {
    return []LaunchType{
        LaunchType_EC2,
        LaunchType_FARGATE,
        LaunchType_THIRD_OPTION,
    }
}
```

Encapsulating the enum within a package would then create an intuitive namespacing (Run example in the [Go
playground](https://play.golang.org/p/olztr74OKsk))

```go
fmt.Println(launchtype.EC2()) // => "EC2"
fmt.Println(launchtype.FARGATE()) // => "FARGATE"
fmt.Println(launchtype.THIRD_OPTION()) // => "THIRD_OPTION"
fmt.Println(launchtype.Values()) // => [EC2 FARGATE THIRD_OPTION]
```

## Interfaces

### Go Interfaces

Go Interfaces are named collections of *method signatures*. They can be implemented by other types, including other interfaces. Go interfaces are
implemented *implicitly*, so, e.g., the implements keyword is not needed by the type that is implementing an interface. Interfaces can embed other
interfaces, which effectively allows the embedding interface to “inherit” all the methods defined in the embedded interface. This is the closest to
how typescript interfaces use extends.

Interfaces can be used as fields on structs as way to encapsulate behavior and facilitate testing.

See [optional values and pointer types](#optional-values-and-pointer-types) for more information about the usage of pointer to literals the usage of
related helper functions.

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

    SecurityGroupId() *string
    AllowAllOutbound() *bool
    AddIngressRule(peer: IPeer, connect: *Port, description: *string, remoteRule: *boolean)
    AddEgressRule(peer: IPeer, connect: *Port, description: *string, remoteRule: *boolean)
}

// Concrete implementation for jsii proxy values.
type iSecurityGroup struct {
    IResource
    IPeer
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

In the case of a simple a datatype interface (`HealthCheck`) without extensions, we would generate both a Go struct (`HealthCheck`), which would hold
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

Go translation (Run example in the [Go playground](https://play.golang.org/p/o84uoUGORYH)):

```go
package ecs

type IHealthCheck interface{
   GetCommand() *[]*string
   GetInterval() cdk.Duration
   GetRetries() *int
   GetStartPeriod() cdk.Duration
   GetTimeout() cdk.Duration
}

type HealthCheck struct {
    Command     *[]*string
    Interval    cdk.Duration
    Retries     *float64
    StartPeriod cdk.Duration
    Timeout     cdk.Duration
}

// See NOTE below
func (h HealthCheck) GetCommand() *[]*string {
    return append(*[]*string{}, h.Command...)
}

func (h HealthCheck) GetRetries() *float64 {
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

func renderHealthCheck(hc HealthCheck) CfnTaskDefinition.HealthCheckProperty {
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

The interface generated for the jsii struct being extended would be **embedded** in the extending struct's interface.

```go
package ecs

type IBaseServiceOptions interface {
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

type IBaseServiceProps interface {
    IBaseServiceOptions  // embeddeded interface
    GetLaunchType()             LaunchType
}
```

However, for the corresponding structs, we can take one of four approaches:

1. Embedding parent structs
1. Flattening struct properties, with interface
1. Providing a struct constructor
1. **Recommended:** Flattening struct properties, without interface

##### Approach 1: embedding parent structs

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
    CloudMapOptions        *CloudMapOptions
    PropagateTags          *PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   *DeploymentController
}
type BaseServiceProps struct {
    BaseServiceOptions  // embedded (anonymous) field
    LaunchType          *LaunchType
}

func (o BaseServiceOptions) Cluster() ICluster { return o.Cluster }
func (o BaseServiceOptions) DesiredCount() *int { return o.DesiredCount }
// ... etc

// BaseServiceProps does not have to re-implement all the methods above
func (p BaseServiceProps) GetLaunchType() *string     { return p.LaunchType }


// example function that takes the embedding interface
func TakesIBaseServiceProps(props IBaseServiceProps) {
    fmt.Printf("Class: %T\nValue:%+[1]v", props)
}
```

This allows the embedding struct (here, `BaseServiceProps`) to "inherit" all the methods defined in the embedded interface
(`IBaseServiceOptions`) automatically.

The advantages of this approach are:

- there would be less boilerplate, since `BaseServiceProps` would not need to re-implement the methods defined in `IBaseServiceOptions`.
- any changes to the extended interface would automatically be inherited by the extending interface.

The main disadvantage of embedding is that instantiating the struct would require knowledge of which properties are inherited from the embedded
struct (at least until [golang/go#9859](https://github.com/golang/go/issues/9859) is accepted and implemented), i.e.:

```go
serviceProps := ecs.BaseServiceProps{
    BaseServiceOptions{
        ServiceName:       jsii.String("myService"),
        MaxHealthyPercent: jsii.Number(100),
        MinHealthyPercent: jsii.Number(50),
    },
    LaunchType: jsii.String("EC2"),
}

ecs.TakesIBaseServiceProps(&serviceProps)
```

##### Approach 2: flattening struct properties

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
    CloudMapOptions        *CloudMapOptions
    PropagateTags          *PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   *DeploymentController
}

type BaseServiceProps struct {
    // Flattened properties generated from extended interface (i.e. Base ServiceOptions)
    Cluster                ICluster
    DesiredCount           *int
    ServiceName            *string
    MaxHealthyPercent      *int
    MinHealthyPercent      *int
    HealthCheckGracePeriod *Duration
    CloudMapOptions        *CloudMapOptions
    PropagateTags          *PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   *DeploymentController

    LaunchType          LaunchType
}

func (o BaseServiceOptions) GetServiceName() *string    { return o.ServiceName }
func (o BaseServiceOptions) GetMaxHealthyPercent() *float64 { return o.MaxHealthyPercent }
func (o BaseServiceOptions) GetMinHealthyPercent() *float64 { return o.MinHealthyPercent }

// ... etc

// Generated interface methods inherited from IBaseServiceOptions
func (p BaseServiceProps) GetServiceName() *string    { return p.ServiceName }
func (p BaseServiceProps) GetMaxHealthyPercent() *float64 { return p.MaxHealthyPercent }
func (p BaseServiceProps) GetMinHealthyPercent() *float64 { return p.MinHealthyPercent }
func (p BaseServiceProps) GetLaunchType() *string     { return p.LaunchType }

// ... etc
```

This approach would allow for properties to be passed to a function in a flattened data structure, i.e.

```go
serviceProps := ecs.BaseServiceProps{
    ServiceName:       jsii.String("myService"),
    MaxHealthyPercent: jsii.Number(100),
    MinHealthyPercent: jsii.Number(50),
    LaunchType: jsii.String("EC2"),
}

ecs.TakesIBaseServiceProps(&serviceProps)
```

The disadvantage is that there is much more boilerplate generated to implement the inherited methods, and any change to the inherited interface would
be a breaking change to anything inheriting it. For the latter concern, within the jsii, any generated code would be tied to some version of jsii, so
we would be able to re-generate datatype interfaces that extend other datatypes. For customers creating their own custom constructs, they could
mitigate potential breaking changes in jsii interfaces by either embedding the generated type in their constructs, or creating their own interface
wrappers, e.g.

```go
// custom method that takes wrapped interface
func myCustomMethod(props ICustomServiceProps) {...}

// Option 1 - embed the generated struct
type ICustomServiceProps interface {
    IBaseServiceOptions
}

// Option 2 - wrapper that takes subset of methods defined in IBaseServiceOptions
type ICustomServiceProps interface {
    GetServiceName() *string
    GetMaxHealthyPercent() *float64
    GetMinHealthyPercent() *float64
}
```

##### Approach 3: providing a struct constructor

The last option is effectively a mix of approach 1 and 2: the struct is represented by its interface on any API, and the interface is implemented
by a go struct that embeds parent structs. A constructor is provided to "hide" the embedding layout from the user, while a flattened struct is emitted
to be used as the parameter for the constructor, preserving the naming around the initialization:

```go
package ecs

type IBaseServiceOptions interface {
 GetCluster() ICluster
 GetDesiredCount() *int
 GetServiceName() *string
 GetMaxHealthyPercent() *int
 GetMinHealthyPercent() *int
 GetHealthCheckGracePeriod() *Duration
 GetCloudMapOptions() *CloudMapOptions
 GetPropagateTags() *PropagatedTagSource
 GetEnableECSManagedTags() *bool
 GetDeploymentController() *DeploymentController
}

type BaseServiceOptions struct {
 Cluster                ICluster
 DesiredCount           *int
 ServiceName            *string
 MaxHealthyPercent      *int
 MinHealthyPercent      *int
 HealthCheckGracePeriod *Duration
 CloudMapOptions        *CloudMapOptions
 PropagateTags          *PropagatedTagSource
 EnableECSManagedTags   *bool
 DeploymentController   *DeploymentController
}

// NOTE: Here, baseServiceOptions is almost identical to BaseServiceOptions,
// however we refrain from using the same type in order to avoid the risk of
// mis-use -- users should always invoke NewBaseServiceOptions & use the result.
type baseServiceOptions struct {
 cluster                ICluster
 desiredCount           *int
 serviceName            *string
 maxHealthyPercent      *int
 minHealthyPercent      *int
 healthCheckGracePeriod *Duration
 cloudMapOptions        *CloudMapOptions
 propagateTags          *PropagatedTagSource
 enableECSManagedTags   *bool
 deploymentController   *DeploymentController
}

func (b *baseServiceOptions) GetCluster() ICluster    { return b.cluster }
func (b *baseServiceOptions) GetDesiredCount() *int   { return b.desiredCount }
func (b *baseServiceOptions) GetServiceName() *string { return b.serviceName }
// etc...

func NewBaseServiceOptions(args *BaseServiceOptions) IBaseServiceOptions {
 argsstrct := *args
 return &baseServiceOptions{
  cluster:                argsstrct.Cluster,
  desiredCount:           argsstrct.DesiredCount,
  serviceName:            argsstrct.ServiceName,
  maxHealthyPercent:      argsstrct.MaxHealthyPercent,
  minHealthyPercent:      argsstrct.MinHealthyPercent,
  healthCheckGracePeriod: argsstrct.HealthCheckGracePeriod,
  cloudMapOptions:        argsstrct.CloudMapOptions,
  propagateTags:          argsstrct.PropagateTags,
  enableECSManagedTags:   argsstrct.EnableECSManagedTags,
  deploymentController:   argsstrct.DeploymentController,
 }
}

type IBaseServiceProps interface {
    IBaseServiceOptions  // embeddeded interface
    GetLaunchType()             LaunchType
}

type BaseServiceProps struct {
    // Flattened properties generated from extended interface (i.e. Base ServiceOptions)
    Cluster                ICluster
    DesiredCount           *int
    ServiceName            *string
    MaxHealthyPercent      *int
    MinHealthyPercent      *int
    HealthCheckGracePeriod *Duration
    CloudMapOptions        *CloudMapOptions
    PropagateTags          *PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   *DeploymentController
    // New properties introduced by BaseServiceProps
    LaunchType             LaunchType
}

type baseServiceProps struct {
    // NOTE: This could be baseServiceOptions, when both structs are defined in
    // the same package. This could offer a marginal performance improvement,
    // and perhaps a slightly more compact memory layout... Opting out of it
    // on the other hand (as is done below), ensures the code path is always the
    // same, regardless of the package layout.
    IBaseServiceOptions // Embedded supertype

    launchType             LaunchType
}

// Don't have to re-implement parent methods, as these are promoted from the
// anonymous embed.
func (b *baseServiceProps) GetLaunchType() { return b.launchType }

func NewBaseServiceProps(args *BaseServiceProps) IBaseServiceProps {
    argsstrct := *args
    return &baseServiceProps{
        IBaseServiceOptions: NewBaseServiceOptions(BaseServiceOptions{
            Cluster:                argsstrct.Cluster,
            DesiredCount:           argsstrct.DesiredCount,
            ServiceName:            argsstrct.ServiceName,
            MaxHealthyPercent:      argsstrct.MaxHealthyPercent,
            MinHealthyPercent:      argsstrct.MinHealthyPercent,
            HealthCheckGracePeriod: argsstrct.HealthCheckGracePeriod,
            CloudMapOptions:        argsstrct.CloudMapOptions,
            PropagateTags:          argsstrct.PropagateTags,
            EnableECSManagedTags:   argsstrct.EnableECSManagedTags,
            DeploymentController:   argsstrct.DeploymentController,
        }),
        launchType: argsstrct.LaunchType,
    }
}
```

The advantage of this approach is that adding a new optional property to a super struct no longer results in a breaking change (the field will be
absent from the subtype until it is re-generated against the new parent), as the embedding technique guarantees methods are promoted from the
supertype. It also guarantees immutability of built instances, as the actual implementation is not exported.

The inconvenient is that this adds relatively heavy boilerplate around use of structs, where the name of the struct is repeated twice in sequence.
This could lead to some user confusion (at least until the suer becomes familiar with this idiom). A typical call would look like so:

```go
// Pretending one can instantiate the BaseService construct directly
NewBaseService(scope, _jsii_.String("ID"), NewBaseServiceProps(&BaseServiceProps{
    // Note: optional fields omitted (as a user could decide to do)
    Cluster: &cluster,
}))
```

#### Approach 4 (Recommended): flattening props fields, without interface

Go structs are the natural way to represent jsii structs (the fact they are named the same is no coincidence). All previous approaches attempt to
preserve properties of their TypeScript interface counterparts: immutability (they cannot be modified once created) and subsitutability (a child
struct can be passed where it's parent type is expected).

However, maintaining those properties is unlikely to be necessary in go:

- if structs are always passed by-value, mutations of a struct performed by a function that received it will never be visible to the caller,
  effectively maintaining the immutability from the point of view of the caller
- code that has a child struct instance, and needs to provide this to a call that accepts a super-type of it can copy from it's instance to create
  the super-type instance "manually" (although a helper function can be provided on the child struct to convert it to any of it's parent types to
  reduce the burden on the user)

Consequently, the simplest possible generated code is the following:

```go
package ecs

// Note: no interfaces are defined for these, ever!

type BaseServiceOptions struct {
    Cluster                ICluster
    DesiredCount           *int
    ServiceName            *string
    MaxHealthyPercent      *int
    MinHealthyPercent      *int
    HealthCheckGracePeriod *Duration
    CloudMapOptions        *CloudMapOptions
    PropagateTags          *PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   *DeploymentController
}

type BaseServiceProps struct {
    // Flattened properties generated from extended interface (i.e. Base ServiceOptions)
    Cluster                ICluster
    DesiredCount           *int
    ServiceName            *string
    MaxHealthyPercent      *int
    MinHealthyPercent      *int
    HealthCheckGracePeriod *Duration
    CloudMapOptions        *CloudMapOptions
    PropagateTags          *PropagatedTagSource
    EnableECSManagedTags   *bool
    DeploymentController   *DeploymentController

    // Fields introduced by BaseServiceProps
    LaunchType          LaunchType
}

// Optional - we can reduce boilerplate for conversion of BaseServiceProps -> BaseServiceOptions:
func (b BaseServiceProps) ToBaseServiceOptions() BaseServiceOptions {
    return BaseServiceOptions{
        Cluster:                b.Cluster,
        DesiredCount:           b.DesiredCount,
        ServiceName:            b.ServiceName,
        MaxHealthyPercent:      b.MaxHealthyPercent,
        MinHealthyPercent:      b.MinHealthyPercent,
        HealthCheckGracePeriod: b.HealthCheckGracePeriod,
        CloudMapOptions:        b.CloudMapOptions,
        PropagateTags:          b.PropagateTags,
        EnableECSManagedTags:   b.EnableECSManagedTags,
        DeploymentController:   b.DeploymentController,
    }
}
```

And the usage would simply be:

```go
// in package ecs, the struct is passed by value:
func TakesBaseServiceProps(props &BaseServiceProps) { /* ... */ }

// User code:
ecs.TakesBaseServiceProps(&ecs.BaseServiceProps{
    ServiceName:       jsii.String("myService"),
    MaxHealthyPercent: jsii.Number(100),
    MinHealthyPercent: jsii.Number(50),
    LaunchType: jsii.String("EC2"),
})
```

Since there are no interfaces to be implemented here, whenever the `@jsii/kernel` decides to pass a struct by-reference, the properties of the object
will be eagerly fetched, and a struct value initialized with those directly. Such values are never proxied away to JavaScript.

### Notes/Concerns

* Like the AWS Go SDK, we can use pointers to primitive types to simulate that fields are optional (i.e. allow null values rather than default "empty"
  values for each type, which are not nullable). However, this might result in a less than ideal developer experience. Another option is to use a
  wrapper type for optional values.
* Generated Go interfaces corresponding to a datatype interface would need a name addendum, e.g. I prefix of Iface suffix, in order to disambiguate
  it from the struct name. This can be confusing (I prefix makes structs and behavioral interfaces similarly named on APIs) or a bit verbose (Iface
  suffix), and it may be worth considering switching the naming (i.e. adding a suffix to the struct instead), as the interface name is what will
  primarily be used by the customer.
* As the `@jsii/kernel` may decide to pass a data type by-reference (and not by-value), either a concrete struct needs to be implemented that does
  the correct call forwarding to `@jsii/kernel` via the runtime library, or the de-serialization procedure must eagerly read all properties from the
  received reference, and intialize a value correctly.
* The alternative to having to implement both a struct and interface is simply translating the datatype interface into a struct. This option has the
  added advantage of having a more streamlined API, rather than having to convert each property into a getter method and having to call those methods
  to access data fields. However, this is not a viable option since in order to pass them as arguments to functions, structs would have to be
  structurally typed (for otherwise, the user code is coupled to the embedding layout of structs, which would make certain backwards-compatible code
  changes in the TypeScript library result in source-breaking changes in go), which is not the case for Go structs. The only way to satisfy the
  structural typing requirements of argments is through interfaces.

## Classes

Typescript takes an object-oriented approach to classes, which includes using polymorphism and subtyping, neither of which are natively supported in
Go, which is not an object-oriented language. While custom structs, which can be used as pointer receivers in function definitions to simulate
methods", can be used to encapsulate object-like behavior in Go, subtyping on these custom structs is not possible. In order to simulate subtyping, we
would need to generate an interface in addition to a concrete struct for each jsii class.

The jsii [ClassType](https://github.com/aws/jsii/blob/master/packages/%40jsii/spec/lib/assembly.ts#L803) provides information on whether a
class is abstract, whether it extends another class, and whether it implements other interfaces. We will discuss each case in turn.

### Case 1: Simple class

Example (Taken from [Typescript handbook](https://www.typescriptlang.org/docs/handbook/classes.html#classes)):
Readonly properties on the class would be translated as exported methods on the interface, implemented by the generated target struct (see section on
datatype interfaces). Instance methods would be declared in the generated interface and implemented by the target struct.

Static methods, on the other hand, would be generated as package-level functions. Since there could be multiple classes within a package, there is not
a good way to namespace a static function in an idiomatic way (e.g. `ClassName.StaticMethod()`); to ensure that static methods maintain the
characteristic of not requiring a concrete receiver while still ensuring some kind of namespacing, the proposal is to add the class name is a prefix
to the top-level function, and separating with a `_` to avoid namespace conflicts. These methods would not be included in the corresponding interface.

Similarly, static properties would be generated as a function at the package level with the same prefixing as with static methods. This way, we can
still delegate calls to the jsii runtime to get the static property value.

```ts
class Greeter {
    readonly greeting: string;

    constructor(message: string) {
        this.greeting = message;
    }

    greet(): string {
        return "Hello, " + this.greeting;
    }

    public static foo(): string {
        return "foo";
    }

    public static hello = "hello";
}

let greeter = new Greeter("world");
greeter.greet() // "Hello, world"
```

In Go: ([Go playground example](https://play.golang.org/p/T20xlddRo6A))

```go
package greeter

import "jsii"

// The interface represents the class in the API.
type Greeter interface {
    Greet()    *string
    Greeting() *string
}

// The struct is the concrete implementation for the type. This is a JS object
// proxy.
type greeter struct {
    // We need padding to ensure the struct is not 0-width, otherwise object
    // identity is impossible to verify (if the struct occupies no memory, any
    // object allocated right after an instance of it will share the exact same
    // memory address).
    _ byte // padding
}

func NewGreeter(message *string) Greeter {
    g := &greeter{}
    // Creating the backing instance in the JS process
    jsii.Create(g, "example.Greeter", []interface{}{message})
    return g
}

func (g *greeter) Greeting() (result *string) {
    // Getting the property from the JS process
    jsii.Get(g, "greeting", &result)
    return
}

func (g *greeter) Greet() (result *string) {
    // Invoking the method in the JS process
    jsii.Invoke(g, "greet", []interface{}{}, &result)
    return
}

// static method
func Greeter_Foo() (result *string) {
    jsii.StaticInvoke("example.Greeter", "foo", []interface{}, &result)
    return
}

// static property getter
func Greeter_Hello() *string {
    jsii.StaticGet("example.Greeter", "hello", &result)
    return
}

// static property setter
func Greeter_SetHello(hello *string) {
    jsii.StaticSet("example.Greeter", "hello", hello)
}

// usage
g := greeter.NewGreeter(jsii.String("world"))
fmt.Println(*g.Greet()) // "Hello, world"
fmt.Println(*greeter.GreeterFoo()) // "foo"
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

import "jsii"

// Base class as interface
type Animal interface {
    Name() *string

    Move(distance *float64)
    isAnimal() // private method saftey check
}

// Base class implementation
type animal struct {
    // So this is not 0-wodth
    _ byte // padding
}

func NewAnimal(name *string) Animal {
    a := &animal{}
    jsii.Create(a, "example.Animal", []interface{}{name})
    return a
}

func (a *animal) Name() (result *string) {
    jsii.Get(a, "name", &result)
    return
}

func (a *animal) Move(distance *float64) {
    jsii.InvokeVoid(a, "move", []interface{}{distance})
}

// Child class
type Snake interface {
  Animal
}

// Snake class would be customer-defined extension of Animal
type snake struct {
    Animal
}

func NewSnake(name *string) Snake {
    a := NewAnimal(name)  // or ExtendAnimal, to avoid introspection for super calls later
    return &snake{a}
}

func (s *snake) Move(distance *float64) {
    fmt.Printf("Slithering...\n")
    // how to look up Animal.Move to delegate to the node runtime? Use JSII-reflect
    s.Animal.Move(distance)
}

// usage:
dumpling := NewAnimal(_jsii_.String("Dumpling the Dog"))
dumpling.Move(_jsii_.Number(5))

sam := NewSnake(_jsii_.String("Sammy the Python"))
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

    ClusterName()              *string
    ClusterArn()               *string
    Vpc()                      ec2.IVpc
    Connections()              ec2.Connections
    HasEc2Capacity()           *bool
    DefaultCloudMapNamespace() cloudmap.INamespace
    AutoscalingGroup()         autoscaling.IAutoScalingGroup
}

// Generated interface for Cluster class
type Cluster interface {
    Resource
    ICluster
}

// Generated struct for Cluster class
type cluster struct {
    Resource
    ICluster
}

// Public getter on public property
func (c *cluster) ClusterName() (result *string) {
    jsii.Get(c, "clusterName", &result)
    return
}

// Public getter on private property
func (c *cluster) HasEc2Capacity() (result *bool) {
    jsii.Get(c, "hasEc2Capacity", &result)
    return
}

// ...etc
```

### Case 4: Abstract Classes

These should be able to be handled much in the same way as regular classes, by generating an interface and a struct. The struct generation is still
necessary in this case because method implementations can actually be defined on abstract classes in Typescript.

## Optional Values

Go doesn't have 'nullable' types. This presents an issue when transpiling various typescript types to Go. Particularly, this is an issue for methods with
optional arguments and interfaces/structs/classes with optional fields. Being able to downgrade a required parameter to optional without breaking existing
usage is a highly desirable feature.

For example:

```typescript
// A JSII struct with an optional readonly property.
export interface OptionalPropertyProps {
  readonly optionalString?: string;
}

// A JSII class with an optional property
export class MyClass {
  public readonly optionalString?: string;

  // constructor function has an optional argument
  public constructor(props: OptionalPropertyProps) {
    this.optionalString = props.optionalString;
  }

  // A method accepting an optional argument and returning a nullable type
  public static someStatic(arg?: string): string? {
    return arg;
  }
}
```

This allows construction like so:

```typescript
const hasString = new MyClass({ optionalString: "I have a string!" });
const notSoMuch = new MyClass({});

console.log(hasString.optionalString); // =>"I have a string"!
console.log(notSoMuch.optionalString); // =>undefined
console.log(MyClass.SomeStatic("returns a string")); // =>"returns a string"
console.log(MyClass.SomeStatic()); // =>undefined
```

The upcoming go 1.18 release introduces generic types, which can be used to define an `Option[T]` interfae such as:

```go
package jsii

type Option[T any] interface {
    // Fromoption__ is a marker method that effectively associates the Option[T]
    // type with the "required" form T.
    FromOption__() T
}
```

This interface can easily be implemented for any type, although it cannot be added to primitive types (including
`time.Time`), which must be wrapped in a new type instead:

```go
package jsii

import (
    "time"
)

type String string

func (s String) FromOption__() String {
	return s
}

type Time time.Time

func (t Time) FromOption__() Time {
    return t
}
```

Given the TypeScript definitions above, the following Go bindings would be generated:

```go
package example

import "github.com/aws/jsii-runtime-go"

type OptionalPropertyProps struct {
    OptionalString  jsii.Option[jsii.String]
}

// Make OptionalPropertyProps be a valid value for Option[OptionalPropertyProps]
func (o OptionalPropertyProps)FromOption__() OptionalPropertyProps {
    return o
}

type MyClass interface {
    OptionalString() jsii.Option[jsii.String]
}
type myClass struct { /* ... */ }

func NewMyClass(props OptionalPropertyProps) MyClass {
    return &myClass{ /* ... */ }
}

func MyClass_SomeStatic(arg jsii.Option[jsii.String]) jsii.Option[jsii.String] {
    // ...
}

func (m *myClass)OptionalString() jsii.Option[jsii.String] {
    // ...
}

// Make myClass be a valid value for Option[MyClass]
func (m myClass)FromOption__() MyClass {
    return &m
}
```

On the usage site, this would look like so:

```go
package usage

import (
    "fmt"

    "github.com/aws/jsii-runtime-go"
    "github.com/acme/example"
)

func main() {
    has_string := example.NewMyClass(example.OptionalPropertyProps{ OptionalString: jsii.String("I have a string!") });
    not_so_much := new MyClass(example.OptionalPropertyProps{ /* The 0-value of interface types is `nil` */ });

    fmt.printf("{}", has_string.OptionalString());  // => "I have a string"
    fmt.printf("{}", not_so_much.OptionalString()); // => nil

    fmt.printf("{}", example.MyClass_._SomeStatic(jsii.String("returns a string"))); // => "returns a string"
    fmt.printf("{}", example.MyClass_._SomeStatic(nil));                             // => nil
}
```

### Side Benefits

As jsii struct fields are explicitly declared to be optional, this approach makes it possible to perform run-time
validity checks on structs (ensuring all required properties were set) without having to code-generate, and keep track
of a custom validator for each struct type; instead relying solely on the type information that is available from
the `reflect` standard library package.

```go
// Given this struct
type WithRequiredProperties struct {
    Required     InterfaceType
    Optional     Option[InterfaceType]
}

// The following are all valid, compiler-wise
a := WithRequiredProperties{}
b := WithRequiredProperties{Optional: someValue}
c := WithRequiredProperties{Required: someValue}
d := WithRequiredProperties{Required: someValue, optional: someValue}

// When that struct is passed over the wire to node, we can determine that a and b are invalid
SomeStatic(a) // #=> Panic ("missing value for required property 'Required'")
SomeStatic(b) // #=> Panic ("missing value for required property 'Required'")
SomeStatic(c) // #=> OK
SomeStatic(d) // #=> OK

// Without `Option[T]`, this can only be achieved by generating a validator function, and calling that on EVERY usage
// site of the struct.
```

Not using pointers everywhere also enables the runtime library to do away with a lot of pointer indirection work, as
values may no longer be of pointer types and instead are always either a plain struct (in the case of jsii structs), or
an interface type. This results in simplifications in some areas of the runtime library.

Non-optional jsii struct parameters are passed as go structs, which provides compile-time gurantee that the value is not
nil (but does not gurantee all fields have been set to a value other than their zero-value). Thi is more idiomatic go
than the option of passing pointers to structs.

```go
type MyStruct struct { /* ... */ }

// Using pointers:
func WithPointers(ptr *MyStruct) { /* ... */ }
WithPointers(nil) // Compiles, but is invalid!

// Using bare struct
func WithStruct(val MyStruct) { /* ... */ }
withPointers(nil) // Compile error
```

An "unchecked cast" feature is much nicer to use when using generics than when those are not available:

```go
// Without generics
func UncheckedCast(from interface{}, to *interface{}) {
    // Must use reflection & pointer indirection to determine the target type
    t := reflect.TypeOf(to).Elem()
    // ... etc ...
}

opaqueValue := GetOpaque() // Typed interface{} or a parent type of the dynamic type of the value
var castValue SpecificType // Must declare separate variable, then "cast into it"
UncheckedCast(opaqueValue, &castValue)

// With generics
func UncheckedCast[T any](from interface{}) T {
    var result T // Cast function can internally create the target value
    // ...
    return result
}

// No need to declare a separate variable up-front here.
UncheckedCast[SpecificType](opaqueValue)
```

### Downsides

In go, `nil` is a valid value at any location where an interface is expected. This means it is not possible to achieve
compile-time safety with this approach in places where classes are passed as arguments, since those are represented as
interfaces with a non-exported implementing struct. A run-time check can be woven into the generated bindings, to
provide helpful error messages (this can be done regardless of how optionals are implemented, as the type model has the
required information).

```go
// SomeType is a go interface type (e.g: jsii class or interface)
func RequiresInterface(value SomeType) { /* ... */ }

RequiresInterface(nil) // Compiles, but likely crashes at runtime
```

While turning a required parameter to optional is not a usage-breaking change in this scenario, it is an
override-breaking change, as the type signature of the function that must be implemented to satisfy an interface
changes. This has consequences in case a type extends a go interface from a dependency.

```go
// The version accepting required arguments
func (o *MyOverridingClass)OverrideMe(required jsii.String) { /* ... */ }

// Is a different method from the one accepting optional arguments
func (o *MyOverridingClass)OverrideMe(required jsii.Option[jsii.String]) { /* ... */ }
```

Generics are reified to their "instantiated" types during compilation, and the `reflect` standard library package does
not expose generic type information directly. This makes it difficult to identify `jsii.Option[T]` types when traversing
a type's mirror without relying on name-matching (`reflect.Type.Name()` returns a string such as
`Option[github.com/aws/jsii-runtime-go.String]`) or method-matching (identifying whether the `FromOption__` method is
present for a type or not). While working, both methods feel brittle.

Wrapping primitive types requires explicit conversions (both from a go primitive to the boxed variant, and back).
Primitive values are frequently used in the API suerface of the AWS CDK, and this is effectively boilerplate code.

```go
func FromString(str jsii.String) { /* ... */ }

FromString("My string literal") // ❌ Compile error (expected jsii.String, received string)
FromString(jsii.String("My string literal")) // ✅ Compiles, but has boilerplate.
```

Relying on generics forces us to require go 1.18 or greater (at time of writing, this is due to be released in February
of 2022). We can leverage generics to improve the expressiveness of some of the go runtime library's internals, however
this does not deliver a significant improvement over the current situation. For example, the signature of the
`StaticGet` function can be made generic so that it can declare the result variable internally instead of receiving an
`interface{}` pointer to send the result to (the same can be applied to all runtime functions that return a value).

```go
func StaticGet(fqn FQN, property string, res *interface{}) { /* ... */ }
// Must declare the result type ahead of time
var result ResultType
StaticGet(jsii.FQN("type.FQN"), "property", &result)

// Can become:
func StaticGet[R any](fqn FQN, property string) R { /* ... */ }
result := StaticGet(jsii.FQN("type.FQN"), "property")
```

### Explored Alternatives

1. Use pointers everywhere

In order to represent this in Go, we use pointers for all types.

```go
type OptionlPropertyProps struct {
  OptionalString *string
}

type myClassStruct struct {
}

type MyClass Interface {
  OptionalString() *string
}

func NewMyClass(props *OptionalPropertyProps) MyClass {
  // magic jsii client implementation
  return &myClassStruct{}
}

func MyClass_SomeStatic(arg *string) *string {
  // magic jsii client implementation
  return arg
}

// OptionalString is nil
myStruct := OptionalPropertyProps{}
myClass := NewMyClass(&myStruct)
fmt.Println(myClass.OptionalString()) // =>nil
```

All method arguments, return types, behavioral interface fields, and struct fields need to be pointer types. In cases where a type is a Go interface,
ie a jsii generated class or behavioral interface, these are already pointer types, as interfaces dictate method signatures for pointer receivers.

```go
type MyJsiiInterface interface {
  Property() *string
}

type MyJsiiStruct struct {
  IProperty MyJsiiInterface
}
```

This is annoying for users when passing simple values to structs or class methods. This can be mitigated by providing the user with convenience
functions to allow them to continue to define these values inline.

```go
// You have to allocate a variable here in order to address it via `&`
myOptionalString := "string"
myStruct := OptionalPropertyProps{OptionalString: &myOptionalString}

// Now using a helper function with signature string -> *string
myStruct := OptionalPropertyProps{OptionalString: jsii.String("string")}

type SomeStructSlice {
  MySlice: *[]*string
}
// Complex types can be addressed without allocation as they are already pointers
myStruct := SomeStructSlice{MySlice: &[]*string{jsii.String("string")}}
```

Additionally, users will have to always check returned values for nil pointers before dereferencing them.

```go
myStruct := OptionalPropertyProps{}
myClass := NewMyClass(&myStruct)
// I want to access the string value
fmt.Println(*myClass.OptionalString()) // =>Panics!

// Good and safe
if myClass.OptionalString() != nil {
  fmt.Println(*myClass.OptionalString()) // =>Panics!
}
```

Essentially every type that the user passes to or receives from the JSII runtime will have to be a pointer type. We can't only make
optional values pointers because then when a required value became optional in TS, this causes a type change in the generated go code which requires
a code change. This means many non-breaking changes to the TS source would require major version bumps to the generated go modules. The inverse is
also true, an output value, IE a method's return value, cannot be changed from nullable to non-nullable, as this would break consumers.

With these downsides, it still seems like this is the most idiomatic route to take. Go users are familiar with using pointer types in this way from other
popular modules. Additionally, it is the only strategy we can identify that allows us to maintain JSII's versioning compatibility strategy.

1. Don't use pointers.

When a variable is allocated in Go and not specified, it is immediately initialized as that types zero value. Since the jsii runtime relies on type reflection
in order to serialize and deserialize values between Go and JSON, an unset string is indistinguishable from the user explicitly passing "". In go, you
can leave out struct fields during construction and this may appear to be what the user wants, but they won't actually be setting the unspecified
properties to `nil`.

```go
type OptionlPropertyProps struct {
  OptionalString string
}

myStruct := OptionalPropertyProps{}
fmt.Println(myStruct.OptionalString == "") // =>true
```

2. Wrapper Types

Specifying a wrapper type to express nullability would allow users to explicitly pass `nil` values, but the ergonomics are unwieldy and not what Go users
expect. Additionally the lack of generics means we would have to generate these wrappers for every single generated type for the user to have compile
time type checking.

```go
type OptionalString struct {
  val string
  // bool zero value is true so this is slightly more convenient
  // than `isNil`
  isDefined bool
}

// Some convenience method to make construction easier
func NewOptionalString(val string) OptionalString {
  return OptionalString {
    val: val,
    isDefined: true,
  }
}

type OptionlPropertyProps struct {
  OptionalString OptionalString
}
```

We could define custom serialization and deserialization functionality for passing these optional values over the wire, and provide convenience
functions for construction and dereferencing them, but the main hurdle is that every field, function argument, and return value would have to be
these `OptionalX` types in order to maintain compatibility with JSII versioning. If we only used these types to describe fields we knew were optional,
then when a required struct field changed to optional in typescript, this would change the generated type of the field in Go. This is a backwards
incompatible change in generated code caused by a non-breaking change in the typescript source.

3. Use Pointers Only for Optional Types

This has the same issue as the wrapper types above, changing a property from required to optional would result in that properties type in Go changing,
requiring code changes in the consuming Go application.

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
