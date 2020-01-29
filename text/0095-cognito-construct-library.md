---
feature name: cognito-construct-library
start date: 27/01/2020
rfc pr:
related issue: n/a
---

# Summary

This RFC covers the design of Cognito's CDK construct library coverage.

# Motivation

The CDK constructs that are currently available in the CDK have a decent level of usage among customers. However, the
current usage is via the 'Cfn' constructs and some basic features available via the `UserPool` construct. The current
implementation of the `UserPool` construct only covers sign in type, user pool attributes and triggers.

The goal of this RFC is to review the current `UserPool` construct for ergonomics in usability and extensibility, and
to extend the features covered by the Cognito module.

# Design Summary

This RFC is structured as a working backwards document. Since the focus of this RFC is to propose the API design, the
best way to propose this is to write up the future user guide of the Cognito module, as if it was complete.

The bulk of the RFC is in the supporting document -
[working-backwards-readme.md](./0095-cognito-construct-library/working-backwards-readme.md)

# Detailed Design

The design creates a couple of entry points for getting into the Cognito APIs.

The first is the `UserPool` construct. The UserPool resource type itself can be fully configured via its constructor.
Further resource types that are based on user pool, such as, user pool user, client, etc. can configured from this.

The other entry point is the `IdentityPool` construct.
> TODO

# Adoption Strategy

The proposal looks to adhere as close to the existing set of `UserPool` APIs as possible, so any breaking change to the
current APIs is easy and quick to resolve.

The Cognito module's API stability is 'experimental'. This is a signal to the users of this module that breaking
changes to the API are to be expected.

# Unresolved questions

> - What parts of the design do you expect to resolve through the RFC process
>   before this gets merged?
> - What parts of the design do you expect to resolve through the implementation
>   of this feature before stabilization?
> - What related issues do you consider out of scope for this RFC that could be
>   addressed in the future independently of the solution that comes out of this
>   RFC?

# Future Changes / Currently out of scope

The following are currently out of scope for this document. Towards the end of the implementation, separate issues will
be created for these, that will then be prioritized based on customer requests and +1s.

* User Pool
  * Import using user pool name
  * Configure SES email actions.
  * ClientMetadata and ValidationData properties in User
  * Support for Clients and HostedUI - https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html
* Identity Pool
  * External provider - Cognito. This requires CDK coverage of user pool clients (above). While it's available via the
    APIs and CloudFormation resources, it is [not listed in the
    documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/external-identity-providers.html) as one
    of the identity providers, so it might not be a sought after feature.
  * External provider - OpenId connect. This requires coverage for OIDC identity providers in the IAM module.
  * External provider - SAML. This requires coverage for SAML identity providers in the IAM module.

The following are out of scope of this document and are unlikely to be implemented.

* Identity pool cognito sync. Reason:
  [Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-sync.html) suggests the use of AWS
  AppSync instead.

