---
feature name: react-cdk-add-jsx-tsx-support
start date: 2020-09-27
rfc pr:
related issue: https://github.com/aws/aws-cdk-rfcs/issues/256
---

# Summary

Support the expression of cloud infrastructure resources via React JSX / TSX. Cloud solutions
are composed of many services. Being able to efficiently and naturally express the composition
is a developer ergonomics/DX concern.

# README

Create CDK applications using React.

**TL;DR**

## Hello ReactCDK

Example ReactCDK application

```jsx
const { ReactCDK, App, Stack } = require('@aws-cdk/react')
const Bucket = require('@aws-cdk/react/s3')
const { CloudFrontDistribution, Origins, DefaultOrigin } = require('@aws-cdk/react/cloudfront')
const { Api, Resource, Integration } = require('@aws-cdk/react/apigateway')
const Lambda = require('@aws-cdk/react/lambda')

const EchoLambda = (
  <Lambda>
  {
    async ({event, context}) => ({
      "statusCode": 200,
      "headers": {
            "Content-Type": "application/json"
        }
      "body: JSON.stringify(event)
    })
  }
  </Lambda>
)

const EchoApi = (
  <Api>
    <Resource path="*">
      <Integration type="lambda">
        <EchoLambda />
      </Integration>
    </Resource>
  </Api>
)

const WebsiteBucket = () => (
  <Bucket src="./public" />
)

const MyCloudFrontDistribution = (
  <CloudFrontDistribution>
    <Origins>
      <DefaultOrigin oai="true">
        <WebsiteBucket />
      </DefaultOrigin>
      <Origin path="/api/*">
        <EchoApi />
      </Origin>
    </Origins>
  </CloudFrontDistribution>
)

const MyApp = (
<App>
  <Stack>
    <MyCloudFrontDistribution />
  </Stack>
</App>
)

ReactCDK.render(MyApp, {region: 'us-east-1'})
```

# Motivation

**Why are we doing this?**

Developer accessibility.  Expanding and making the AWS platform accessible
to a larger group of people.

* Library / framework support is a natural evolution on top of already
  supported CDK languages.
* React is familiar to a large group of frontend developers. It's a generalized
  tech that allows developers to naturally express composition, which is the core
  tenet of serverless / serviceful solutions.
* This eases developers into more advanced AWS usage and therefore enabling them
  to get more value from the platform.
* Library/framework support on top of already supported language (ts) via jsii

**What use cases does it support?**

The large pool of existing React developers who have experience with React and it's
component based composition idioms.  Allows them to reuse and leverage their existing
knowledge to build full stack cloud solutions.

**What is the expected outcome?**

More people leveraging CDK suite -> more innovation and solutions -> advance humanity.

# Design Summary

Code generate a set of ReactCDK components that has feature parity with all TS
components from cfn constructs to solutions constructs.

# Detailed Design

## Codegen ReactCDK components

A set of ReactCDK components that has feature parity with all TS components from cfn constructs to solutions constructs.

* mapping from react concepts of props, state, children, render props to typescript
CDK constructors, params, hierarchical nesting (parent), etc.
* code generated based on the jsii manifests of CDK modules
[via]((https://twitter.com/emeshbi/status/1305017904027643906?s=20)) @eladb
* custom react renderer / reconciler where cloud (cfn) is it's render target getting there via CDK language layer.
* ReactCDKBaseComponent (class or functional component/hooks friendly)
* ReactCDKPatternComponent - pre-composed infra for common use cases.
* leverage React ecosystem adjacencies (e.g. react storybook, etc.)
* wrap these ReactCDK components for Amplify “Backend” library
* special cases of lambda function code being webpack + babel + etc being
transpiled, bundled, etc. and handed over to CDK provisioning layer.
  > this is a bit more involved and also needs research.  this is the blending of app code and infra resources it
  interacts with.
  > This is somewhat similar to
  [Meteor](https://blog.meteor.com/the-meteor-chef-an-introduction-to-apollo-b1904955289e),
  but instead of only mongodb, it's every cfn supported AWS service.  Need to not make same mistakes as meteor.
* step function special cases where the components that make it up are customized for developer ergonomics/dx.
* this is additional alternative to amplify add [backend] (e.g. api, auth, etc.)

# Drawbacks

* React is not universally liked.  If it becomes associated with CDK there is potential brand/product damage.
* CDK is associated and tied to AWS brand.  AWS tends to support all "popular" frameworks equally.  Favoring one might
not be good for brand.
* Might draw demand / more work for Vue.js, Angular, Svelete, etc. support
* Frontend libraries and frameworks come and go much more frequently than programming languages.
* React itself has gone through major "idiomatic" changes throughout it's short lifetime.  For example, classes,
functional components, hooks.  JSX has remained stable, but there could be "another" evolution step that makes JSX
a moving target.
* A new layer and choice is introduced to the end user.  Should I use a supported programming language or go up a
layer and use a supported higher-level technology.

# Rationale and Alternatives

* leverage developers existing knowledge around technologies that easy the use of component oriented solutions.
* there are no technical negative impacts in not doing this.  Purely additive.  There is only the "potential" lost
opportunity cost.

# Adoption Strategy

* Leverage existing Amplify brand platform/position with frontend developer community.
* This is an additive "personality" / choice for a target CDK user type.  Does not impact existing code bases.

# Unresolved questions

* mapping from react concepts of props, state, children, render props to typescript CDK constructors, params,
hierarchical nesting (parent), etc.

# Future Possibilities

There currently is a "locality of code" issue with CDK, SAM, CFN, etc.  The infrastructure I define is not close to
the application code that leverages it (e.g. lambda code living in separate file, referencing it via s3://.zip).
Explicit IAM permissions (or what could be codegened) live only in infra code.  Application code events expressed in
code seamlessly leveraging EventBridge for example without the developer needing to do any additional work.  Would be
a step towards a "cloud native programming language" where the programming language control constructs naturally scale
and map to corresponding services (e.g. control flow -> step fn, events -> EventBride,
lambdas (lang level) -> lambdas :))

# Implementation Plan


# Resources

* original "concept" conversation on [twitter](https://twitter.com/pfeilbr/status/1304757893544148992?s=20)
* [`Hello ReactCDK` app concept gist](https://gist.github.com/pfeilbr/78db35ec7cac5886f771bc2d81e7aacd)
* [Part 1/3 - Beginners guide to Custom React Renderers. How to build your own renderer from scratch?](https://blog.atulr.com/react-custom-renderer-1)
