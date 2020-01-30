# Amazon Cognito Construct Library

> Note to the RFC reviewer: All comments in code blocks such as this one are either implementation notes or notes for
> further investigation. Kindly ignore.

[Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html) provides
authentication, authorization, and user management for your web and mobile apps. Your users can sign in directly with a
user name and password, or through a third party such as Facebook, Amazon, Google or Apple.

The two main components of Amazon Cognito are [user
pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) and [identity
pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-identity.html). User pools are user directories
that provide sign-up and sign-in options for your app users. Identity pools enable you to grant your users access to
other AWS services.

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

## User Pools

User pools allow creating and managing your own directory of users that can sign up and sign in. They enable easy
integration with social identity providers such as Facebook, Google, Amazon, Microsoft Active Directory, etc. through
SAML.

Using the CDK, a new user pool can be created as part of the stack using the construct's constructor. You must specify
the `userPoolName`, as so -

```ts
new UserPool(this, 'myuserpool', {
  userPoolName: 'myawesomeapp-userpool',
  // ...
  // ...
});
```

### Sign Up

Users need to either be signed up by the app's administrators or can sign themselves up. You can read more about both
these kinds of sign up and how they work
[here](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html).

Further, a welcome email and/or SMS can be configured to be sent automatically once a user has signed up. This welcome
email and/or SMS will carry the temporary password for the user. The user will use this password to log in and reset
their password. The temporary password is valid only for a limited number of days.

All of these options can be configured under the `signUp` property. The pool can be configured to let users sign
themselves up by setting the `selfSignUp` property. A welcome email template can be configured by specifying the
`welcomeEmail` property and a similar `welcomeSms` property for the welcome SMS. The validity of the temporary password
can be specified via the `tempPasswordValidity` property.

The user pool can be configured such that either the user's email address, phone number or both should be verifed at the
time of sign in. Verification is necessary for account recovery, so that there is at least one mode of communication for
a user to reset their password or MFA token when lost.

When either one or both of these are configured to be verified, a confirmation message and/or email are sent at the
time of user sign up that they then enter back into the system to verify these attributes and confirm user sign up.

*Note*: If both email and phone number are specified, Cognito will only verify the phone number. To also verify the
email address, read [the documentation on email and phone
verification](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-email-phone-verification.html

*Note*: By default, the email and/or phone number attributes will be marked as required if they are specified as a
verified contact method. See [attributes](#attributes) section for details about standard attributes.

> TODO: pre-signup lambda trigger

The `verifyContactMethods` attribute allows for this to be configured.

*Defaults*:
* signUp.selfSignUp: true
* signUp.tempPasswordValidity: 7 days
* signUp.welcomeEmail.subject: 'Thanks for signing up'
* signUp.welcomeEmail.body - 'Hello {username}, Your temporary password is {####}'
* signUp.welcomeSms.message - 'Your temporary password is {####}'
* signUp.verifyContactMethods - Email

Code sample:

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  signUp: {
    selfSignUp: true,
    tempPasswordValidity: Duration.days(3),
    welcomeEmail: {
      subject: 'Welcome to our awesome app!'
      body: 'Hello {username}, Thanks for signing up to our awesome app! Your temporary password is {####}'
    },
    welcomeSms: {
      message: 'Your temporary password for our awesome app is {####}'
    },
    verifyContactMethods: [ ContactMethods.EMAIL, ContactMethods.PHONE ],
  }
});
```

> Internal Note: Implemented via UserPool-AdminCreateUserConfig, temp password via UserPool-Policies,
> verifyContactMethods via UserPool-AutoVerifiedAttributes.

### Sign In

These are the various ways a user of your app can sign in. There are 4 options available with the enum `SignInType`:

* `USERNAME`: Allow signing in using the one time immutable user name that the user chose at the time of sign up.
* `PREFERRED_USERNAME`: Allow signing in with an alternate user name that the user can change at any time. However, this
  is not available if the USERNAME option is not chosen.
* `EMAIL`: Allow signing in using the email address that is associated with the account.
* `PHONE_NUMBER`: Allow signing in using the phone number that is associated with the account.

*Defaults*: USERNAME.

Code sample:

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  signInType: [ SignInType.USERNAME, SignInType.EMAIL ],
});
```

> Internal Note: Implemented via UserPool-UsernameAttributes and -AliasAttributes

### Attributes

These are the set of attributes you want to collect and store with each user in your user pool. Cognito provides a set
of standard attributes that are available all user pools. Users are allowed to select any of these standard attributes
to be required. Users will not be able to sign up without specifying the attributes that are marked as required. Besides
these, additional attributes can be further defined, known as custom attributes.

*Note that,* custom attributes cannot be marked as required.

See the [documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html)
on this to learn more.

Standard attributes are available via the `StandardAttrs` enum.

*Note*: By default, the standard attributes 'email' and/or 'phone\_number' will automatically be marked required if
they are one of the verified contact methods. See [Sign up](#sign-up) for details on verified contact methods.

Custom attributes can be specified via the `stringAttr` and `numberAttr` methods, depending on whether the attribute
type is either a string or a number. Constraints can be defined on both string and number types, with length constraint
on the former and range constraint on the latter.

Additionally, two properties `mutable` and `adminOnly` properties can be set for each custom attribute. The former
specifies that the property can be modified by the user while the latter specifies that it can only be modified by the
app's administrator and not by the user (using their access token).

*Defaults*:
* No standard attributes are marked required.
* For all custom attributes, mutable is true and adminOnly is false.

Code sample:

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  attributes: {
    required: [ StandardAttrs.address, StandardAttrs.name ],
    custom: [
      stringAttr({ name: 'myappid', minLen: 5, maxLen: 15 }),
      numberAttr({ name: 'callingcode', min: 1, max: 3 }),
    ],
  }
});
```

> Internal note: Implemented via UserPool-SchemaAttribute

> Internal note: Follow up - is mutable = false and adminOnly = true allowed?

### Security

User pools can be configured to enable MFA. It can either be turned off, set to optional or made required. Setting MFA
to optional means that individual users can choose to enable it. Phone numbers must be verified if MFA is enabled.
Additionally, MFA can be sent either via SMS text message or via a time-based software token.
See the [documentation on MFA](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html) to
learn more.

This can be configured by setting the `mfa.enforcement` option under `security` properties to be one of the values in
the `MfaEnforcement` enum. Available values are `REQUIRED`, `OPTIONAL`, `OFF`.
The type of MFA can be configured by its peer property `type` which can be set to a list of values in the enum
`MfaType`. The available values are `SMS` and `SOFTWARE_TOKEN`.

User pools can be specify the constraints that should be applied when users choose their password. Constraints such as
minimum length, whether lowercase, numbers and/or symbols are required can be specified.

In order to send an SMS, Cognito needs an IAM role that it can assume with permissions that allow it to send an SMS on
behalf of the AWS account. By default, CDK will create this IAM user but allows for it to be overridden via the
`smsRole` permissions.

*Defaults*:
* security.mfa.enforcement: OPTIONAL
* security.mfa.type: SMS
* security.passwordPolicy.minLength: 8
* security.passwordPolicy.required - lowercase, numbers and symbols
* security.smsRole - assumable by `cognito-idp.amazonaws.com` and permitting `sns:Publish` action against resource `*`.
  The role assumption will be conditioned on a strict equals on an ExternalId that will be unique to this user pool.

Code sample:

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  security: {
    mfa: {
      enforcement: MfaEnforcement.REQUIRED,
      type: [ MfaType.SMS, MfaType.SOFTWARE_TOKEN ]
    },
    passwordPolicy: {
      required: [ PasswordPolicy.LOWERCASE, PasswordPolicy.NUMBERS, PasswordPolicy.SYMBOLS ],
      minLength: 12,
    },
    smsRole: iam.Role.fromRoleArn(/* ... */),
  }
});
```

> Internal Note: Password policy via UserPool-Policies, MFA enable via UserPool-MfaConfiguration; MFA type via
> UserPool-EnabledMfas; smsRole via UserPool-SmsConfiguration

> Internal Note: Account Recovery settings are missing from UserPool CloudFormation resource.

### Emails

Cognito will handle sending emails to users in the user pool. The address from which emails are sent can be configured
on the user pool via the `from` property, and the `replyTo` property to configure the email where replies are sent.

User pools can also be configured to send emails through Amazon SES, however, that is not yet supported via the CDK. Use
the cfn layer to configure this - https://docs.aws.amazon.com/cdk/latest/guide/cfn_layer.html.

*Defaults*
* email.from - TODO: find the default that Cognito uses.
* email.replyTo - use the same address as from.

Code sample:

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  email: {
    from: 'noreply@my-awesome-app.com'
    replyTo: 'support@my-awesome-app.com'
  }
});
```

> Internal Note: configured via UserPool-EmailConfiguration

### Triggers

User pools can be configured with a number of lambda function backed triggers. They are available in the CDK via the
`triggers` property. [Go
here](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html)
to read more about user pool workflows using lambda triggers, and details around each trigger.

Check out the [documentation](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-cognito/lib/user-pool.ts#L148)
to find the list of triggers supported by the CDK.

*Defaults*: no lambda triggers are configured.

Code sample:

```ts
const presignupLambda = new lambda.Function(this, 'presignup' {
  // ...
});

const postsignupLambda = new lambda.Function(this, 'postsignup', {
  // ...
});

new UserPool(this, 'myuserpool', {
  // ...
  // ...
  triggers: {
    preSignUp: presignupLambda,
    postSignUp: postsignupLambda,
    preAuthentication: preauthLambda,
    // ...
  }
});
```

Triggers can also be added to the user pool outside of its constructor. This can be done via individual methods such as
`addPreSgnUpTrigger()`, `addPostSignUpTrigger()`, `addPreAuthentication()`, etc.

### Importing User Pools

Any user pool that has been created outside of this stack, can be imported into the CDK app. Importing a user pool
allows for it to be used in other parts of the CDK app that reference an `IUserPool`. However, imported user pools have
limited configurability. As a rule of thumb, none of the properties that is are part of the
[`AWS::Cognito::UserPool`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-userpool.html)
CloudFormation resource can be configured.

User pools can be imported either by specifying the user pool id, via the `UserPool.fromUserPoolId()` API, or by
specifying the user pool ARN, via the `UserPool.fromUserPoolArn()` API.

```ts
const stack = new Stack(app, 'my-stack');

const awesomePool = UserPool.fromUserPoolId(stack, 'awesome-user-pool', 'us-east-1_oiuR12Abd');

const otherAwesomePool = UserPool.fromUserPoolArn(stack, 'other-awesome-user-pool',
  'arn:aws:cognito-idp:eu-west-1:123456789012:userpool/us-east-1_mtRyYQ14D');
```

However, imported user pools have limited configurability.

> Internal Note: TODO - provider name and provider url return values?

### Users

Users are added to pools either as part of sign up or via the Cognito APIs directly. In addition to these, it is
possible to add users to the user pool via the CDK.

Use the `createUser()` API on the user pool to add users to the pool, as so -

```ts
const userpool = new UserPool(this, 'myuserpool', {
  // ...
  // ...
});

userpool.createUser(this, 'myuserpool-supportuser', {
  userName: 'support-user',
  deliveryMediums: [ ContactMethods.EMAIL, ContactMethods.PHONE ],
  attributes: [
    { name: StandardAttrs.EMAIL, value: 'support@awesomeapp.com' },
    { name: 'callingcode' value: '12' }
  ],
  forceAliasCreation: true,
  resendInvitation: true,
});
```

The property `userName` is the name of the user and is mandatory.

The property `deliveryMedium` is how the user will be contacted to sign up, upon first creation. Both email and sms are
available here. The default is SMS (i.e., `ContactMethods.PHONE`).

The property `attributes` specifies the list of standard and custom [attributes](#attributes) as part of the user.
Values of the `StandardAttrs` enum can be used against `name` to reference standard attributes. If one or both contact
methods are set with `deliveryMedium`, this attribute is required to be set as part of `attributes`. The default here is
empty.

`forceAliasCreation` can be used only when the user pool is configured with either email or phone as a verified contact
method. When this is set, any existing user with the same email address or phone number will have its alias migrated to
this user. The default is false.

When the `resendInvitation` property is set to true, Cognito will resend the invitation message for a user that already
exists but has not signed up. The default is false.

Users can be created for imported user pools by using the `UserPoolUser` construct, as so -

```ts
const userpool = UserPool.fromUserPoolAttributes(this, 'myuserpool', { ... });

new UserPoolUser(this, userpool, {
  userPoolId: userpool.userPoolId,
  // ...
  // all of the same properties as above
  // ...
});
```

### Groups

User pools can be configured with groups into which users are added. Groups is the primary mechanism in Cognito for
permission assignment.

Add a new group to the user pool using the `createGroup()` API, as so -

```ts
const userpool = new UserPool(this, 'myuserpool', { ... });

const customerrole = new iam.Role(this, 'customer-role', { ... });

userpool.createGroup(this, 'myuserpool-customers', {
  groupName: 'customers',
  description: 'group for myawesomeapp customers',
  role: customerrole
});
```

The required `groupName` and the optional `description` properties are the identifiers for this group.

The `role` property refers to the IAM role whose permissions that the users in this group are able to assume.

When several different groups are defined for the same user pool, they can be ordered to have a precendence. Precedence
will determine which IAM role's permission will be available for a user when they are part of two different groups. See
[CreateGroup
API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_CreateGroup.html#CognitoUserPools-CreateGroup-request-Precedence)
for more details.

Use the `takesPrecendenceOver()` API to set the precedence of one group over the other.

## Identity Pools (Federated Identity)

Identity pools enables creation of unique identities for their users and federate them with identity providers. These
identity providers can be a Cognito user pool, Facebook, Google, or any other SAML-based identity provider.
With an identity pool, you can obtain temporary, limited-privilege AWS credentials to access other AWS services.

Using the CDK, a new identity pool can be created as part of the stack using the construct's constructor. You must
specify the `identityPoolName`. This is the quickest way to create an identity pool with all of the defaults -

```ts
new IdentityPool(this, 'myidentitypool', {
  identityPoolName: 'myawesomeapp-identitypool',
});
```

Identity pools can be configured to allow unauthenticated identities to access the application. This can be specified
by setting the `unauthenticatedIdentities` boolean property. See [the Cognito
guide](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html) to learn more about
unauthenticated identities. The default is `false`.

Identity pools can be configured so that a user authenticating with it will go through a different workflow to bootstrap
their credentials. There are two different flows for authentication with public providers - basic and enhanced. See [the
authentication flow page on Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html)
to learn more about them. Use the `authenticationFlow` property to configure this. By default, this will be the
'enhanced' flow.

This is the code snippet with these properties configured -

```ts
new IdentityPool(this, 'myidentitypool', {
  identityPoolName: 'myawesomeapp-identitypool',
  unauthenticatedIdentities: true,
  authenticationFlow: AuthenticationFlow.ENHANCED,
});
```

### Identity Providers

Identity pools can be configured with external providers for sign in. These can be from facebook, google, twitter as
well as, "login with Amazon" and Cognito user pools. Use the `identityProviers` property to configure these providers.
Learn more about external identity providers at [Cognito's
documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/external-identity-providers.html). The CDK
documentation of the `identityProviders` property has more details on how to configure an identity pool with each of
these external providers. By default none of the `identityProviders` are defined.

> Internal Note: IdentityPool-SupportedLoginProviders takes a JSON with all of the providers configured.

Besides the external identity providers, Cognito identity pools also support developer authenticated identities. Read
[the documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/developer-authenticated-identities.html)
to learn more about developer authenticated identities. This can be configured via the property `developerProvider`. By
default, this is undefined.

Code snippet with all of the external providers configured -

```ts
new IdentityPool(this, 'myidentitypool', {
  // ...
  identityProviders: {
    amazon: { appId: 'amzn1.application.188a56d827a7d6555a8b67a5d' },
    facebook: { appId: '7346241598935555' },
    google: { clientId: '123456789012.apps.googleusercontent.com' },
    twitter: { consumerKey: 'xvz1evFS4wEEPTGEFPHBog', consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw' },
    developerProvider: 'login.mycompany.myapp'
  }
});
```

### Importing Identity Pools

Any identity pool that has been created outside of this stack, can be imported into the CDK app. Importing an identity
pool allows for it to be used in other parts of the CDK app that reference an `IIdentityPool`. However, imported
identity pools have limited configurability. As a rule of thumb, none of the properties that are part of the
[`AWS::Cognito::IdentityPool`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-identitypool.html)
CloudFormation resource can be configured.

Identity pools can be imported either by specifying the identity pool id, via the `UserPool.fromIdentityPoolId()` API,
or by specifying the identity pool ARN, via the `UserPool.fromIdentityPoolArn()` API.

```ts
const stack = new Stack(app, 'my-stack');

const awesomePool = IdentityPool.fromIdentityPoolId(stack, 'awesome-identity-pool', 'us-east-1:1a1a1a1a-ffff-1111-9999-12345678');

const otherAwesomePool = UserPool.fromIdentityPoolArn(stack, 'other-awesome-user-pool',
  'arn:aws:cognito-identity:us-east-1:0123456789:identitypool/us-east-1:1a1a1a1a-ffff-1111-9999-66655533');
```

However, imported user pools have limited configurability.

> Internal Note: TODO - provider name and provider url return values?

