---
feature name: compatibility-strategy
start date: February 2nd, 2020
rfc pr: (leave this empty)
related issue: (tracking issue number)
---

<!-- replace the blockquoted sections with your content -->
# Summary

There are currently two statements we advertise to our customers with regards to framework and cli compatibility:

- CLI versions should always support older framework versions. That is, upgrading the CLI should never require an upgrade of the framework.
- Framework versions might require an upgrade of the CLI. In which case, we provide instructions as to which CLI version should be used.

This RFC details the necessary strategy and mechanism for ensuring that we keep those promises when releasing new versions.

# Motivation

> Why are we doing this? What use cases does it support? What is the expected
> outcome?

There are 2 main motivations why we should put some substantial effort into this:

## (1) Haven't we suffered enough?

Recently, we experienced several incidents that are directly related to this domain:

- https://github.com/aws/aws-cdk/issues/5986
- https://github.com/aws/aws-cdk/issues/4897
- https://github.com/aws/aws-cdk/issues/4294

These issues were very awkward and caused both our customers and ourselves a lot of unwanted work.
They also reflect poorly on the stability of the CDK, especially in a post GA era.

*We want to implement this RFC to prevent (or at least greatly reduce) the occurrences of such issues.*

## (2) Refactor CX Protocol versioning

We've talked about the mechanism we currently use to perform protocol version changes quite a bit. The process and the expected output aren't very clear, and we seem to be always trying to understand it again and again.
This might warrant a re-think/re-design, to make it much more ergonomic and developer friendly. 

However, performing changes on such a crucial part of the system, shouldn't be done without a proper validation mechanism.

*We want to implement this RFC so that we are able to iterate and change the versioning mechanism itself* 

Actually, We have already acknowledged the need for this a while back:

- https://github.com/aws/cdk-ops/issues/365
- https://github.com/aws/cdk-ops/issues/233

Its time we solve this once and for all.

After implementing this RFC, we can expect the following outcomes:

- An incompatible change in the CLI won't make it to the release.
- An incompatible change in the framework, will always be accompanied with a version bump.
- An incompatible change in the framework, accompanied with a protocol version bump, will always produce the correct error message.

# Out Of Scope



# Basic Example

> If the proposal involves a new or changed API, include a basic code example.
> Omit this section if it's not applicable.
> 
> Please focus on explaining the motivation so that if this RFC is not accepted,
> the motivation could be used to develop alternative solutions. In other words,
> enumerate the constraints you are trying to solve without coupling them too
> closely to the solution you have in mind.

# Design Summary

> Summarize the approach of the feature design in a couple of sentences. Call out
> any known patterns or best practices the design is based around.

In order to ensure compatibility between the CLI and the Framework, we have to actually run the CLI against an old framework version, and vice versa.
We want to find a generic mechanism for running these tests, without having to cherry-pick use-cases or versions. 

The main design idea is to introduce new types of integration tests into our pre-release suite. Those tests will run various permutations of `CLI X Framework` and validate the expected result in each permutation.

To make it generic, the tests will actually run the entire current integration tests suite, and simply inject different versions each time.

An important note is that when testing compatibility to older versions (being it CLI or Framework), we cannot run the latest integration test suite, as it may contain tests for new features and bug fixes, which were not implement in older versions.

Therefore, the entire design relies on us having the following ability:

- *Run **old** integration tests using a **new** CLI version and an **old** Framework version.*
- *Run **old** integration tests using a **new** Framework version and an **old** CLI version.*

# Detailed Design

> This is the bulk of the RFC. Explain the design in enough detail for somebody
> familiar with CDK to understand, and for somebody familiar with the
> implementation to implement. This should get into specifics and corner-cases,
> and include examples of how the feature is used. Any new terminology should be
> defined here.
> 
> Include any diagrams and/or visualizations that help to demonstrate the design.
> Here are some tools that we often use:
> 
> - [Graphviz](http://graphviz.it/#/gallery/structs.gv)
> - [PlantText](https://www.planttext.com)

The design is best explained by simply looking at the proposed code changes. Most of what you need to know is in the inline comments of the code.

As mentioned, everything is based on our ability to run integration tests with various version permutations. We introduce a new function, `run_integration_tests_perm` which magically does what we need, as well as some useful constants.

**[common.bash](https://github.com/aws/aws-cdk/blob/master/packages/aws-cdk/test/integ/cli/common.bash)**

```bash
# This is the latest published version.
CURRENT_VERSION=$(node -e 'console.log(require("package.json").version')

# This is the soon to be published version.
PREVIOUS_VERSION="$(decrease_minor ${CURRENT_VERSION})"

# This is the previously published version.
NEXT_VERSION="$(bump_minor ${CURRENT_VERSION})"

function run_integration_tests_perm() {

    integration_tests_version=1
    framework_version=$2
    cli_version=$3
    expected_error=$4

    # Checkout the relevant integration tests
    # Install framework version
    # Install CLI version
    # Inject versions to integration tests
    # Run tests (should either pass or print the expected error)

}

function bump_minor() {

    version=$1

    # Accept a version and bump the minor version.
}

function decrease_minor() {

    version=$1

    # Accept a version and decrease the minor version.

}
```

We now create a new file, which is responsible for validating the compatibility of new framework versions against old cli versions.

**test-framework-compatibility.sh**

```bash
source ./common.bash

function run_tests() {

    expected_error=$1

    run_integration_tests_perm ${PREVIOUS_VERSION} ${CURRENT_VERSION} ${PREVIOUS_VERSION} ${expected_error}
}

function expect_error() {
    run_tests "A newer version of the CDK CLI (>= ${NEXT_VERSION}) is necessary to interact with this app"
}

function expect_pass() {
    run_tests
}

if [ ${CURRENT_VERSION} == "1.19.0" ]; then
  
    # version 1.20.0 of the framework bumped protocol version, so we expect an error message.
    expect_error

elif [ ${CURRENT_VERSION} == "1.20.0" ]; then

    # version 1.21.0 of the framework bumped protocol version, so we expect an error message.
    expect_error

else

    # common case, backwards compatible (i.e no protocol version bump)
    # all old integration tests should pass.
    expect_pass

fi

```

In addition, we create a new file, which is responsible for validating the compatibility of new cli versions against old framework versions.

**test-cli-compatibility.sh**

```bash
source ./common.bash

# CLI should always support older framework versions, so these tests should always pass.
run_integration_tests_perm ${PREVIOUS_VERSION} ${PREVIOUS_VERSION} ${CURRENT_VERSION}

```

## Developer Workflow

Ideally, developers should mainly focus on code changes that are relevant to the functionality they are implementing, not necessarily concerning themselves with versioning issues. 

This design attempts to provide a mechanism that, given the compatibility is broken, will guide the developer to the necessary code changes that need to be done. This way, developers don't have to *remember* anything, they simply won't be able to properly merge their changes until those versioning concerns are addressed.

> Thats not to say we should stop thinking about compatibility when designing our changes, it simply alleviates the fear of unintentionally breaking compatibility.

Following are the two possible scenarios that might break compatibility, with a diagram that represents the actions the developer would take in order for the change to be accepted. 

### Introducing changes to the CLI

This is really straight forwards, new cli versions must always be compatible with older framework versions.

1. Developer merges a PR to master.
2. CLI compatibility tests are executed.
3. They can result in one of two states:

    - `pass`
    - `fail`

4. If tests pass, we are good. If they fail, fix the code and GOTO 1.

<img src='https://g.gravizo.com/svg?
digraph G {
    aize ="4,4";
    "merge-to-master";
    "merge-to-master" -> "test-cli-compatibility.sh"; 
    node [shape=box,style=filled,color="yellowgreen"];   
    "test-cli-compatibility.sh" -> pass;    
    node [shape=box,style=filled,color="crimson"];   
    "test-cli-compatibility.sh" -> fail;    
    fail -> "merge-to-master" [label = "  make-compatible"]
  }
'/>

### Introducing changes to the Framework

This case is a bit more complicated, because we don't require framework versions be necessarily compatible with older cli versions.

1. Developer merges a PR to master.
2. Framework compatibility tests are executed.
3. They can result in one of four states:

    - `pass`: Tests are executed with an expectation to pass. And indeed all of them pass. This means the change is fully compatible with older versions of the CLI.
    - `pass-on-error`: Tests are executed with expectation to fail with an error message. And indeed the error message is correct.    
    - `fail`: Tests are executed with an expectation to pass, but some of them don't.
    - `fail-on-error`: Tests are executed with an expectation to fail with an error message, but the error message is incorrect.
    
4. Depending of which state, the developer performs one the following actions:

    - `make-compatible`: Try to make the code compatible. This would normally happen when the breakage is unintentional, and therefore no version bump was performed.
    - `bump-version-and-mark`: Developer reluctantly understands that the changes cannot be compatible, and decides to bump the version.
    - `fix-version-bump`: This would happen when a version bump was performed, but the value it was bumped to is incorrect.

5. If the state of step 3 is `pass` or `pass-on-error`, we are done. Otherwise, GOTO 1.

<img src='https://g.gravizo.com/svg?
digraph G {
    aize ="4,4";
    "merge-to-master";
    "merge-to-master" -> "test-framework-compatibility.sh";
    node [shape=box,style=filled,color="yellowgreen"];
    "test-framework-compatibility.sh" -> pass;
    "test-framework-compatibility.sh" -> "pass-on-error";
    node [shape=box,style=filled,color="crimson"];
    "test-framework-compatibility.sh" -> "fail";
    "test-framework-compatibility.sh" -> "fail-on-error";
    "fail" -> "merge-to-master" [label = "  make-compatible\/bump-version"]
    "fail-on-error" -> "merge-to-master" [label = "  fix-version-bump"]
  }
'/>


# Drawbacks

> Why should we _not_ do this? Please consider:
> 
> - implementation cost, both in term of code size and complexity
> - whether the proposed feature can be implemented in user space
> - the impact on teaching people how to use CDK
> - integration of this feature with other existing and planned features
> - cost of migrating existing CDK applications (is it a breaking change?)
> 
> There are tradeoffs to choosing any path. Attempt to identify them here.

# Rationale and Alternatives

> - Why is this design the best in the space of possible designs?
> - What other designs have been considered and what is the rationale for not
>   choosing them?
> - What is the impact of not doing this?

# Adoption Strategy

> If we implement this proposal, how will existing CDK developers adopt it? Is
> this a breaking change? How can we assist in adoption?

# Unresolved questions

> - What parts of the design do you expect to resolve through the RFC process
>   before this gets merged?
> - What parts of the design do you expect to resolve through the implementation
>   of this feature before stabilization?
> - What related issues do you consider out of scope for this RFC that could be
>   addressed in the future independently of the solution that comes out of this
>   RFC?

# Future Possibilities

> Think about what the natural extension and evolution of your proposal would be
> and how it would affect CDK as whole. Try to use this section as a tool to more
> fully consider all possible interactions with the project and ecosystem in your
> proposal. Also consider how this fits into the roadmap for the project.
> 
> This is a good place to "dump ideas", if they are out of scope for the RFC you
> are writing but are otherwise related.
> 
> If you have tried and cannot think of any future possibilities, you may simply
> state that you cannot think of anything.
