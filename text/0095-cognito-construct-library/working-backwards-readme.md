# Amazon Cognito Construct Library

> Note to RFC reviewers: All comments in code blocks such as this one are either implementation notes, todos for
> further investigation, or pieces of information that are important for this RFC review but will not be part of the
> final README.

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

Using the CDK, a new user pool can be created as part of the stack using the construct's constructor. You may specify
the `userPoolName` to give your own identifier to the user pool. If not, CloudFormation will generate a name.

```ts
new UserPool(this, 'myuserpool', {
  userPoolName: 'myawesomeapp-userpool',
  // ...
  // ...
});
```

### Sign Up

Users can either be signed up by the app's administrators or can sign themselves up. Once a user has signed up, their
account needs to be confirmed. Cognito provides several ways to sign users up and confirm their accounts. Learn more
about [user sign up here](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html).

Consider the following code sample which configures all of the properties related to sign up on a user pool -

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  selfSignUp: {
    verificationEmail: {
      subject: 'Verify your email for our awesome app!',
      body: 'Hello {username}, Thanks for signing up to our awesome app! Your verification code is {####}',
      style: EmailVerificationStyle.CODE
    },
    verificationSms: {
      message: 'Hello {username}, Thanks for signing up to our awesome app! Your verification code is {####}',
    }
  },
  adminSignUp: {
    tempPasswordValidity: Duration.days(3),
    invitationEmail: {
      subject: 'Invite to join our awesome app!'
      body: 'Hello {username}, you have been invited to join our awesome app! Your temporary password is {####}'
    },
    invitationSms: {
      message: 'Your temporary password for our awesome app is {####}'
    }
  }
});
```

The `selfSignUp` property group contains configuration for the user pool's behaviour when a user signs themselves up.
This primarily involves how they will confirm their accounts and verify their contact information. Learn more about
[signing up and confirming user
accounts](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html). When
the `verificationEmail` and/or the `verificationSms` properties are specified, the user pool is configured to verify
them. The email subject, body and the SMS message content can be configured. Learn more about [configuring SMS and email
messages](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-message-customizations.html).
When verifying the account via email, the verification can either be done by the user entering a code into the app that
was emailed to them, or by clicking on a $link. This can be configured via the `style` property under
`verificationEmail`.

*Note*: If you would like to disable self sign up for your user pool, set the property `selfSignUp` to `undefined`.

Besides self sign up, users can also be signed up directly by the administrator. Learn more about [creating user
accounts as administrator](https://docs.aws.amazon.com/cognito/latest/developerguide/how-to-create-user-accounts.html).
The `adminSignUp` property group lets this be configured. Similar to the verification email and SMS, an invitation email
and/or SMS can be configured to be sent automatically an administrator signs a user up. This invitation email or SMS
will carry the temporary password for the user. The user will use this password to log in and reset their password. The
temporary password is valid only for a limited time which can be configured via the `tempPasswordValidity` policy.

*Note*: By default, the email and/or phone number attributes will be marked as required if `verificationEmail` or
`verificationSms` respecitvely are specified. See [attributes](#attributes) section for more on standard attributes.

> These are the defaults that will be part of tsdoc, and not part of the README -
>
> * selfSignUp - enabled; adminSignUp - disabled
> * selfSignUp.verificationEmail.subject: 'Verify your new account'
> * selfSignUp.verificationEmail.body - 'Hello {username}, Your verification code is {####}'
> * selfSignUp.verificationEmail.verificationStyle - CODE
> * selfSignUp.verificationSms.message - 'The verification code to your new account is {####}'
>
> Internal Notes:
>
> * disable self sign up via UserPool-AdminCreateUserConfig-AllowAdminCreateUserOnly
> * enable verification of email and/or sms via UserPool-AutoVerifiedAttributes.
> * `selfSignUp.verificationEmail` to both UserPool-EmailVerification\* and UserPool-VerificationMessageTemplate-Email\*
> * `selfSignUp.verificationSms` to both UserPool-SmsVerificationMessage and UserPool-VerificationMessageTemplate-SmsMessage
> * `verificationStyle` via UserPool-VerificationMessageTemplate-DefaultEmailOption
> * `adminSignUp` via UserPool-AdminCreateUserConfig
> * `adminSignUp.tempPasswordValidity` via UserPool-Policies

### Sign In

These are the various ways a user of your app can sign in. There are 4 options available with the enum `SignInType`:

* `USERNAME`: Allow signing in using the one time immutable user name that the user chose at the time of sign up.
* `PREFERRED_USERNAME`: Allow signing in with an alternate user name that the user can change at any time. However, this
  is not available if the USERNAME option is not chosen.
* `EMAIL`: Allow signing in using the email address that is associated with the account.
* `PHONE_NUMBER`: Allow signing in using the phone number that is associated with the account.

> These are the defaults that will be part of tsdoc, and not part of the README -
> SignInType: `USERNAME`.

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

Learn more on [attributes in Cognito's
documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html).

The following code sample configures a user pool with two standard attributes (name and address) as required, and adds
two optional attributes, one as 'string' type and one as 'number' type.

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  attributes: {
    required: [ StandardAttrs.address, StandardAttrs.name ],
    custom: {
      'myappid': new StringAttr({ minLen: 5, maxLen: 15 }),
      'callingcode': new NumberAttr({ min: 1, max: 3 }),
    },
  }
});
```

*Note* that, custom attributes cannot be marked as required.

*Note*: By default, the standard attributes 'email' and/or 'phone\_number' will automatically be marked required if
they are one of the verified contact methods. See [Sign up](#sign-up) for details on verified contact methods.

Additionally, two properties `mutable` and `adminOnly` properties can be set for each custom attribute. The former
specifies that the property can be modified by the user while the latter specifies that it can only be modified by the
app's administrator and not by the user (using their access token).

> These are the defaults that will be part of tsdoc, and not part of the README -
>
> * No standard attributes are marked required.
> * For all custom attributes, `mutable`: true & `adminOnly`: false.
>
> Internal note: Implemented via UserPool-SchemaAttribute
>
> Internal note: Follow up - is mutable = false and adminOnly = true allowed?

### Security

User pools can be configured to enable MFA. It can either be turned off, set to optional or made required. Setting MFA
to optional means that individual users can choose to enable it. Phone numbers must be verified if MFA is enabled.
Additionally, MFA can be sent either via SMS text message or via a time-based software token.
See the [documentation on MFA](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html) to
learn more.

The MFA enforcement policy and the type of MFA token to use can be configured by setting the `mfa` property group.

User pools can be configured a password policy for its users. The policy can specify a minimum length, whether
lowercase, numbers and/or symbols must be present.

Cognito sends various messages to its users via SMS, for different actions, ranging from account verification to
marketing. In order to send SMS messages, Cognito needs an IAM role that it can assume, with permissions that allow it
to send SMS messages. By default, CDK will create this IAM role but can be explicily specified to an existing role via
the `smsRole` property.

The following code sample has these three properties configured.

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  mfa: {
    enforcement: MfaEnforcement.REQUIRED,
    type: [ MfaType.SMS, MfaType.SOFTWARE_TOKEN ]
  },
  passwordPolicy: {
    required: [ PasswordPolicy.LOWERCASE, PasswordPolicy.NUMBERS, PasswordPolicy.SYMBOLS ],
    minLength: 12,
  },
  smsRole: iam.Role.fromRoleArn(/* ... */),
});
```

> These are the defaults that will be part of tsdoc, and not part of the README -
>
> * mfa.enforcement: OPTIONAL
> * mfa.type: SMS
> * passwordPolicy.minLength: 8
> * passwordPolicy.required - lowercase, numbers and symbols
> * smsRole - assumable by `cognito-idp.amazonaws.com` and permitting `sns:Publish` action against resource `*`.
>   The role assumption will be conditioned on a strict equals on an ExternalId that will be unique to this user pool.
>
> Internal Note: Password policy via UserPool-Policies, MFA enable via UserPool-MfaConfiguration; MFA type via
> UserPool-EnabledMfas; smsRole via UserPool-SmsConfiguration
>
> Internal Note: Account Recovery settings are missing from UserPool CloudFormation resource.

### Emails

Cognito will handle sending emails to users in the user pool. The address from which emails are sent can be configured
on the user pool via the `from` property, and the `replyTo` property to configure the email where replies are sent.

User pools can also be configured to send emails through Amazon SES, however, that is not yet supported via the CDK. Use
the [cfn layer](https://docs.aws.amazon.com/cdk/latest/guide/cfn_layer.html) to configure this.

> These are the defaults that will be part of tsdoc, and not part of the README -
>
> * email.from - TODO: find the default that Cognito uses.
> * email.replyTo - same address as from.

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

The CDK will add necessary permission to the lambda functions for it to be invoked by the cognito service.

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
  attributes: {
    [StandardAttrs.EMAIL]: 'support@awesomeapp.com',
    callingcode: 12,
  },
  forceAliasCreation: true,
  resendInvitation: true,
});
```

The property `userName` is the name of the user and is mandatory.

The property `deliveryMedium` is how the user will be contacted to sign up, upon first creation. Both email and sms are
available here.

The property `attributes` specifies the list of standard and custom [attributes](#attributes) as part of the user.
Values of the `StandardAttrs` enum can be used against `name` to reference standard attributes. If one or both contact
methods are set with `deliveryMedium`, this attribute is required to be set as part of `attributes`.

`forceAliasCreation` can be used only when the user pool is configured with either email or phone as a verified contact
method. When this is set, any existing user with the same email address or phone number will have its alias migrated to
this user.

When the `resendInvitation` property is set to true, Cognito will resend the invitation message for a user that already
exists but has not signed up.

Users can be created for imported user pools by using the `UserPoolUser` construct, as so -

```ts
const userpool = UserPool.fromUserPoolAttributes(this, 'myuserpool', { ... });

new UserPoolUser(this, userpool, {
  userPool: userpool,
  // ...
  // all of the same properties as above
  // ...
});
```

> These are the defaults that will be part of tsdoc, and not part of the README -
>
> * deliveryMedium: ContactsMethod.PHONE
> * attributes: none
> * forceAliasCreation: false
> * resendInvitation: false

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

> These are the defaults that will be part of tsdoc, and not part of the README -
>
> * description - empty
> * precedence - `undefined`

## Identity Pools (Federated Identity)

Identity pools enables creation of unique identities for their users and federate them with identity providers. These
identity providers can be a Cognito user pool, Facebook, Google, or any other SAML-based identity provider.
With an identity pool, you can obtain temporary, limited-privilege AWS credentials to access other AWS services.

Using the CDK, a new identity pool can be created as part of the stack using the construct's constructor. You may
specify the `identityPoolName`, however when not specified, CloudFormation will assign a name to the pool.

```ts
new IdentityPool(this, 'myidentitypool', {
  identityPoolName: 'myawesomeapp-identitypool',
});
```

Identity pools can be configured to allow unauthenticated identities to access the application. This can be specified
by setting the `unauthenticatedIdentities` boolean property. See [the Cognito
guide](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html) to learn more about
unauthenticated identities.

Identity pools can be configured so that a user authenticating with it will go through a different workflow to bootstrap
their credentials. There are two different flows for authentication with public providers - basic and enhanced. See [the
authentication flow page on Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html)
to learn more about them. Use the `authenticationFlow` property to configure this.

This is the code snippet with these properties configured -

```ts
new IdentityPool(this, 'myidentitypool', {
  identityPoolName: 'myawesomeapp-identitypool',
  allowUnauthenticated: true,
  authenticationFlow: AuthenticationFlow.ENHANCED,
});
```

> These are the defaults that will be part of tsdoc, and not part of the README -
>
> * allowUnauthenticated: false
> * authenticationFlow: `AuthenticationFlow.ENHANCED`

### Access Control

Identity pools are configured with IAM roles from which temporary credentials will be provided to users of this pool
when they need to access AWS resources. The IAM roles are configured with permissions based on what the users are
allowed to access.

An identity pool can have separate IAM roles configured for its authenticated users (authenticated via one of the
identity providers as above) and unauthenticated users. They can be specified via the properties `authenticatedRole` and
`unauthenticatedRole` properties. When no role is specified against these properties, CDK will create a new role with
the permissions to Amazon Mobile Analytics and Amazon Cognito Sync. This is similar to the behaviour of the AWS console.
Read the [IAM Roles documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/iam-roles.html) to learn
more on how to set up your own IAM roles.

The following code configures an identity pool with two roles, one that authenticated users of the identity pool will
assume and the other for unauthenticated users. It goes further to configure access read and read-write access to an S3
bucket. When a role is not explicitly specified, CDK creates an empty role by default that can then be used by calling
the `authenticatedRole` and `unauthenticatedRole` getter APIs on `IdentityPool`.

```ts
const authenRole = new iam.Role(this, 'cognito-authenticated-role', { ... });

const unAuthenRole = new iam.Role(this, 'cognito-unauthenticated-role', { ... });

const identitypool = new IdentityPool(this, 'my-awesome-id-pool', {
  // ...
  // ...
  authenticatedRole: authenRole,
  unAuthenticatedRole: unauthenRole
});

bucket.grantRead(identitypool.authenticatedRole);
bucket.grantWrite(identitypool.authenticatedRole);
bucket.grantRead(identitypool.unauthenticatedRole);
```

In order for Cognito to interact with these IAM roles, they require that a trust policy be attached that permits Cognito
to assume this role. The best practice is to specify a 'Condition' that this operation is allowed only when operating
with the corresponding identity pool. See [Role Trust and
Permissions](https://docs.aws.amazon.com/cognito/latest/developerguide/role-trust-and-permissions.html) to learn more.
The CDK automatically adds a trust policy to all roles used in the `IdentityPool` following these best practices. This
applies to the all of the roles specified in this section. To disable this, set the `configureRoleTrust` to `false`.

**Note** that, however, this does not apply to imported IAM roles; all of the correct trust policies must be set up
outside of the CDK app.

> These are the defaults that will be part of tsdoc, and not part of the README -
>
> * authenticatedRole & unauthenticatedRole - empty Role with the correct trust configured.
> * no default rolemappings

### Identity Providers

Identity pools can be configured with external providers for sign in. These can be from facebook, google, twitter as
well as, "login with Amazon" and Cognito user pools. Use the `identityProviers` property to configure these providers.
Learn more about external identity providers at [Cognito's
documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/external-identity-providers.html). The CDK
documentation of the `identityProviders` property has more details on how to configure an identity pool with each of
these external providers.

Besides the external identity providers, Cognito identity pools also support developer authenticated identities. Read
[the documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/developer-authenticated-identities.html)
to learn more about developer authenticated identities. This can be configured via the property `developerProvider`.

The following code snippet configures an identity pool with a bunch of external providers -

```ts
new IdentityPool(this, 'myidentitypool', {
  // ...
  identityProviders: {
    amazon: { appId: 'amzn1.application.188a56d827a7d6555a8b67a5d' },
    facebook: { appId: '7346241598935555' },
    google: { clientId: '123456789012.apps.googleusercontent.com' },
    twitter: { consumerKey: 'xvz1evFS4wEEPTGEFPHBog', consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw' },
    developerProvider: { name: 'login.mycompany.myapp' }
  }
});
```

When users are authenticated with one of these identity providers, they are supplied with the credentials of the
`authenticatedRole` IAM role (see [access control section](#access-control). However, rules can be configured such that
the access for specific users can be modified (elevated or restricted). Learn more about [using rules to assign roles to
users](https://docs.aws.amazon.com/cognito/latest/developerguide/role-based-access-control.html#using-rules-to-assign-roles-to-users).

The following code snippet sets up two rules that assign the admin role based on whether the admin logged in via
facebook or via google.

```ts
const adminRole = new iam.Role(this, 'admin-role', { ... });

new IdentityPool(this, 'my-awesome-id-pool', {
  // ...
  // ...
  identityProviders: {
    facebook: {
      appId: '7347241598935555',
      roleMappingRules: [
        {
          // if the identifier of the user as returned by facebook is 'boris'
          claim: FacebookRoleMappingClaim.SUB,
          matchType: MatchType.EQUALS,
          value: 'boris',
          role: adminRole
        }
      ],
      ambiguousRoleResolution: AmbiguousRoleResolution.DENY
    },

    google: {
      clientId: '123456789012.apps.googleusercontent.com',
      roleMappingRules: [
        {
          // if the verified email as returned by google is 'borissvenson@gmail.com'
          claim: GoogleRoleMappingClaim.EMAIL_VERIFIED,
          matchType: MatchType.EQUALS,
          value: 'borissvenson@gmail.com',
          role: adminRole
        }
      ],
      ambiguousRoleResolution: AmbiguousRoleResolution.AUTHENTICATED_ROLE
    }
  }
});
```

The list of mapping token claims (i.e., `claim` property) for each identity provider can be [found
here](https://docs.aws.amazon.com/cognito/latest/developerguide/role-based-access-control.html#token-claims-for-role-based-access-control).

The `ambiguousRoleResolution` specifies how Cognito should resolve if there is ambiguity while resolving the different
rules. `DENY` specifies that no role should be provided while `AUTHENTICATED_ROLE` specifies that only the role
specified against `authenticatedRole` be returned. Learn more about this property
[here](https://docs.aws.amazon.com/cognitoidentity/latest/APIReference/API_RoleMapping.html#CognitoIdentity-Type-RoleMapping-AmbiguousRoleResolution).

**Note:** As detailed in the [section on access control](#access-control), all roles specified here would automatically
have a trust policy trusting the Cognito service and following the best practice, unless `configureRoleTrust` is set to
`false` or if the IAM role is imported.

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
