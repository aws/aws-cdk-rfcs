# CloudWatch Omni L2 Constructs

- **Original Author(s):** @tarangdave
- **Tracking Issue:** #1014
- **API Bar Raiser:** @ShadowCat567

---

## Background: CloudWatch Omni

CloudWatch Omni is an evolution of Amazon CloudWatch: an AI-powered observability experience for applications and AI agents, built on
OpenTelemetry and delivered outside the AWS Management Console. Users reach it through a domain's sign-in URL, with identities they already
have in IAM or IAM Identity Center, and a space gives them access to the telemetry of one account and Region. CloudWatch Omni has been
generally available since September 2026, and it expanded to more Regions in October 2026.

The constructs in this RFC cover the resources that set CloudWatch Omni up, in the order a team meets them. A domain is the root and
configures sign-in, a space belongs to a domain and gives access to the telemetry of one account and Region, a dataset integration forwards
the account's logs and traces into the CloudWatch Dataset behind that space, Access profiles, access grants, dashboards, and alerts belong
to a space. For AWS Organizations, an organization domain configures sign-in for the whole organization, and organization access grants give
principals administrative access to it.

### References

- [Amazon CloudWatch Omni is now available in additional AWS
  Regions](https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-cloudwatch-omni-8-regions/) (What's New, October 2026)
- [CloudWatch Omni](https://aws.amazon.com/cloudwatch/omni/) (product page)
- [CloudWatch Omni](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch-omni.html) (user guide overview)

---

## CHANGELOG

```ts
feat(cloudwatch): L2 constructs for CloudWatch Omni

Domain, Space, AccessProfile, AccessGrant, OmniDashboard, Alert, DomainForOrganization, DomainAccessGrantForOrganization
```

```
feat(observabilityadmin): add DatasetIntegration L2 construct
```

## CloudWatch Omni

CloudWatch Omni organizes observability around a small resource tree. These constructs give each resource in the tree a typed construct, so
a team can keep its whole setup in source control instead of calling the service API or using the console.

1. **Domain** - the root resource and an organization's entry point. A user chooses a domain name during setup, and that name becomes their
   team's sign-in URL, in the format `https://<domain-name>.cloudwatch-omni.global.app.aws`. The name is what identifies the domain when
   users sign in. The identity provider connects at the domain, not per space.
2. **Space** - It's a shared, collaborative workspace built around a specific team, application, or set of workloads to monitor
   infrastructure, applications, and AI agents in one place. A space belongs to a domain.
3. **Access profile**, **access grant**, and **omni-dashboard**: the children of a space. Access profiles and access grants control who can
   use the space, and dashboards hold its authored content.
4. **Alert** - another child of a space. An alert runs a SQL or PromQL query on a schedule, as an access profile, compares the result with
   warning and critical thresholds, and notifies Amazon SNS topics when its state changes.
5. **Organization domain** and **organization access grant**: a separate tree for an AWS Organizations management account. An organization
   has one organization domain, which configures how users sign in for the whole organization, and organization access grants give
   principals administrative access to it.
6. **Dataset integration** - how telemetry reaches a space. It lets CloudWatch Logs forward the account's logs and traces into the
   CloudWatch Dataset behind the space, and an account and Region have one. Its construct, `DatasetIntegration`, is in
   `aws-cdk-lib/aws-observabilityadmin`, because its resource type is `AWS::ObservabilityAdmin::DatasetIntegration`.

### Domains

A domain is the root of the account tree. As mentioned above, users can choose a domain name and set how the team can sign in to the domain.
Sign-in is configured via `identityProviders`. Currently there are two providers, `IAM` and `IDC`. `identityProviderConfiguration` is
basically the IDC instance ARN that is required when `identityProviders` include `IDC`.

```ts
import {
  Domain, IdentityProvider, IdentityCenterInstance,
} from 'aws-cdk-lib/aws-cloudwatch';

const domain = new Domain(this, 'Domain', {
  domainName: 'observability',
  identityProviders: [IdentityProvider.IDC, IdentityProvider.IAM],
  identityCenterInstance: IdentityCenterInstance.fromInstanceArn(
    'arn:aws:sso:::instance/ssoins-1a2b3c4d5e6f7a8b'),
  tags: { Team: "observability" }
});
```

`IdentityProvider.IAM` and `IdentityProvider.IDC` map to the schema values `IAM` and `IDC`. `DomainProps` has `domainName`,
`identityProviders`, an optional `identityCenterInstance` that is required when `IDC` is listed, `removalPolicy`, and `tags`.

The sketch below shows these types. `IdentityProvider` has an `of` escape hatch, so a provider that the service adds later works before it
has a static member.

```ts
import { RemovalPolicy } from 'aws-cdk-lib';
import { aws_sso as ssoRefs } from 'aws-cdk-lib/interfaces';

/** How users sign in to a domain. */
export class IdentityProvider {
  /** Sign-in with IAM users and roles. */
  public static readonly IAM = new IdentityProvider('IAM');
  /** Sign-in through IAM Identity Center. Requires `identityCenterInstance`. */
  public static readonly IDC = new IdentityProvider('IDC');
  /** A provider without a static member, for providers the service adds later. */
  public static of(value: string): IdentityProvider { return new IdentityProvider(value); }

  private constructor(
    /** The CloudFormation IdentityProviders value. */
    public readonly value: string,
  ) {}
}

/** The IAM Identity Center instance that a domain uses for sign-in. */
export abstract class IdentityCenterInstance {
  /** An instance given by its ARN. */
  public static fromInstanceArn(instanceArn: string): IdentityCenterInstance { /* ... */ }
  /** An instance given by a reference, such as an L1 `CfnInstance`. */
  public static fromInstance(instance: ssoRefs.IInstanceRef): IdentityCenterInstance { /* ... */ }

  /** The ARN of the instance. */
  public abstract readonly instanceArn: string;
}

/** Props for a domain. */
export interface DomainProps {
  /** The domain name, 3 to 63 lowercase letters, digits, and single hyphens. Updatable in place. */
  readonly domainName: string;
  /** How users sign in. One or two providers. */
  readonly identityProviders: IdentityProvider[];
  /**
   * The Identity Center instance. Required when IDC is listed.
   * @default - no Identity Center instance
   */
  readonly identityCenterInstance?: IdentityCenterInstance;
  /**
   * What happens to the domain when it is removed from the stack or replaced.
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;
  /**
   * Tags for the domain. Updatable in place.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}
```

#### Domain interfaces and import methods

```ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IDomainRef } from 'aws-cdk-lib/aws-cloudwatch';

/** A CloudWatch Omni domain. */
export interface IDomain extends cdk.IResource, IDomainRef {
  /** The id of the domain, for example d-abc456. */
  readonly domainId: string;
  /** The ARN of the domain. Throws for a domain referenced by id alone, whose ARN is unknown. @attribute */
  readonly domainArn: string;
  /** The URL users open to reach CloudWatch Omni. Undefined when referenced. @attribute */
  readonly domainEndpointUrl?: string;
}

export declare class Domain {
  static fromDomainId(scope: Construct, id: string, domainId: string): IDomain;
  static fromDomainArn(scope: Construct, id: string, domainArn: string): IDomain;
}
```

### Spaces

A space gives access to telemetry from the account and Region in which the space is hosted, and controls who can see it. Because a space
maps to one account and Region, that boundary is what separates spaces, rather than a filter applied when running a query. Users can create
a space inside the domain, and one domain can contain multiple spaces.

A space is per account per Region, see [Set up Omni for your
organization](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-set-up-omni-for-your-organization.html), so teams that
need separate spaces use separate accounts or Regions.

A space names its domain with `DomainIdentifier`. Pass a domain from the same app with `fromDomain`:

```ts
import { Domain } from 'aws-cdk-lib/aws-cloudwatch';

declare const domain: Domain;

const space = new Space(this, 'Space', {
  domain: cloudwatch.DomainIdentifier.fromDomain(domain),
  spaceName: 'observability',
});
```

In a member account of an organization, the space belongs to the organization domain that the management account created. That domain is
defined in the management account's app, so the member account's stack has only its id:

```ts
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

const space = new cloudwatch.Space(this, 'Space', {
  domain: cloudwatch.DomainIdentifier.fromDomainId('d-xxxx'),
  spaceName: 'payments',
});
```

`fromDomainForOrganization` takes an organization domain defined in the same app. Every factory gives the space the domain id that
`CreateSpace` needs, and the space exposes it as `space.domainId`, so a space created in the app always knows its domain id.

The sketch below shows these types.

```ts
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { RemovalPolicy } from 'aws-cdk-lib';

/** The domain a space belongs to: an account domain or an organization domain. */
export class DomainIdentifier {
  /** An account domain: a `Domain`, a `CfnDomain`, or an imported domain. */
  public static fromDomain(domain: IDomainRef): DomainIdentifier;
  /** An organization domain: a `DomainForOrganization`, a `CfnDomainForOrganization`, or an imported one. */
  public static fromDomainForOrganization(domain: IDomainForOrganizationRef): DomainIdentifier;
  /** A domain by id, for example a domain defined in another app or created in the console. */
  public static fromDomainId(domainId: string): DomainIdentifier;

  /** The id of the domain, the CloudFormation DomainId value. */
  public readonly domainId: string;
}

/** Props for a space. */
export interface SpaceProps {
  /**
   * The domain that contains the space: an account domain, an organization domain.
   */
  readonly domain: DomainIdentifier;
  /** The space name, 3 to 64 lowercase letters, digits, and single hyphens. */
  readonly spaceName: string;
  /**
   * The role the service assumes for data access. Create-only.
   * @default - a role trusted by the CloudWatch service principal, with CloudWatchOmniSpaceAccessPolicy attached
   */
  readonly dataAccessRole?: iam.IRoleRef & iam.IGrantable;
  /**
   * The role Amazon Bedrock AgentCore assumes for online evaluation.
   * @default - no evaluation role
   */
  readonly agentCoreEvaluationRole?: iam.IRoleRef;
  /**
   * A customer managed key. Selects the CUSTOMER_MANAGED encryption strategy and adds a key-policy statement.
   * @default - an AWS owned key (AWS_OWNED)
   */
  readonly encryptionKey?: kms.IKey;
  /**
   * What happens to the space when it is removed from the stack or replaced.
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;
  /**
   * Tags for the space. Updatable in place.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}
```

#### Space interface and import methods

```ts
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { ISpaceRef } from 'aws-cdk-lib/aws-cloudwatch';

/** A CloudWatch Omni space. */
export interface ISpace extends cdk.IResource, ISpaceRef {
  /** The ARN of the space. @attribute */
  readonly spaceArn: string;
  /** The id of the space. @attribute */
  readonly spaceId: string;
  /** The id of the domain that contains the space. Undefined when not known, for a space referenced by ARN or without a domainId. */
  readonly domainId?: string;
  /** The customer managed key of the space. Undefined for an AWS owned key or when not supplied on a reference. */
  readonly encryptionKey?: kms.IKey;
  /**
   * The role that CloudWatch Omni assumes for the space's data access, the default role or the
   * `dataAccessRole` prop. Undefined for a referenced space, which may not know its role.
   * The `Space` class declares it as always set.
   */
  readonly dataAccessRole?: iam.IRole;
}

/** Attributes of a space defined outside the stack. */
export interface SpaceAttributes {
  /** The ARN of the space. */
  readonly spaceArn: string;
  /**
   * The id of the domain that contains the space. An access grant needs it.
   * @default - the domain id is not known
   */
  readonly domainId?: string;
  /**
   * The customer managed key of the space.
   * @default - no key
   */
  readonly encryptionKey?: kms.IKey;
}

export declare class Space extends cdk.Resource implements ISpace {
  static fromSpaceArn(scope: Construct, id: string, spaceArn: string): ISpace;
  static fromSpaceAttributes(scope: Construct, id: string, attrs: SpaceAttributes): ISpace;

  /** The role that CloudWatch Omni assumes for the space's data access, the default role or the `dataAccessRole` prop. */
  public readonly dataAccessRole: iam.IRole;
}
```

A space referenced only by its ARN carries no domain id, so it supports the standalone constructs that need only the space id and not `AccessGrant`.

#### The space's roles

When `dataAccessRole` is not given, the construct creates the role that CloudWatch Omni assumes when it issues credentials to the space's
users, with the trust policy and the AWS managed policy `CloudWatchOmniSpaceAccessPolicy` that the service documents. The role in use is
available as `space.dataAccessRole`. A customer managed role needs the same trust policy and permission, and the construct will validate at
build time to achieve a fail-fast mechanism instead of failing at deploy time. In addition to dataAccessRole, the space api also accepts
`agentCoreEvaluationRole`, to conduct automated, real-time online AI agent evaluations. `agentCoreEvaluationRole` is optional, has no
default, and trusts Amazon Bedrock AgentCore rather than CloudWatch so that Amazon Bedrock AgentCore Evaluations can continuously score live
agent telemetry in the background without an active user session. See [Service Roles for
setup](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-identity-and-access-management-for-cloudwatch-omni.html#omni-identity-and-access-management-for-cloudwatch-omni-service-roles-used-for-setup)
for the several IAM roles used for setup.

Creating or updating a space passes its roles to CloudWatch, so the identity that deploys the stack needs `iam:PassRole` on `dataAccessRole`
and on `agentCoreEvaluationRole`, with the `iam:PassedToService` condition equal to `cloudwatch.amazonaws.com` (see the [Service
Authorization Reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_cloudwatch.html), `CreateSpace` and
`UpdateSpace`). Creating an organization domain passes its domain access role in the same way (`CreateDomainForOrganization`). When you
deploy with CloudFormation, the role that CloudFormation deploys with needs this permission.

#### Space replacement

The space's `domain` and `dataAccessRole` are create-only. Changing either, including switching between the default data-access role and a
role you supply, replaces the space. CloudFormation can only change a create-only property by replacing the space, and the space's
replacement strategy is delete-then-create. The construct applies its removal policy to both deletion and replacement, so the outcome
depends on it:

- With the default `RemovalPolicy.RETAIN`, CloudFormation keeps the old space and tries to create a second one. An account has at most one
  space per Region, so the deployment is expected to fail and roll back, and the old space stays as it was.
- With `RemovalPolicy.DESTROY`, CloudFormation deletes the old space first, so the replacement is expected to succeed. Deleting the space
  removes everything in it, including any dashboards, alerts, access-profiles, access-grants, etc.

### Access grants and access profiles

Once telemetry reaches a space, access profiles and access grants decide who sees what. An access grant gives a principal, such as an IAM
role or an Identity Center group, a permission in the space (see [Access grants](#access-grants) for different permissions).

An access profile is an identity for a resource that acts when no one is signed in. An alert, for example, evaluates its query on a
schedule. The profile holds the permissions the resource uses at that time. A profile is reusable. You create it once, grant it permissions,
and choose which resources may assume it, so several alerts can share one profile instead of each carrying a copy of the same permissions.

### Access grants

When you add a member to a space or edit their access, you create a **grant** that carries a **permission level**. A grant belongs to a
**principal**: a user, a group, an IAM user or role, an access profile, or an alert. Each grant carries one permission level:

- **Viewer**: Read-only access to the whole space, including queries and the Omni agent.
- **Editor**: Create, modify, and delete resources other than integrations, run queries, and manage datasets, in addition to everything a
  Viewer can do.
- **Space Admin**: Full access, including managing members and their permissions, and connecting, changing, or removing integrations.
- **Custom**: Exactly the actions you list, optionally limited to specific resources. See [Custom grant
  actions](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-custom-grant-actions.html).

```ts
import * as iam from 'aws-cdk-lib/aws-iam';
import {
  Space, OmniDashboard, AccessGrantPrincipal, AccessGrantPermission, ScopedResourceType,
} from 'aws-cdk-lib/aws-cloudwatch';

declare const space: Space;
declare const operators: iam.IRole;

new AccessGrant(this, 'OperatorsView', {
  space,
  principal: AccessGrantPrincipal.iamRole(operators),
  permission: AccessGrantPermission.READ,
});
new AccessGrant(this, 'SreEditors', {
  space,
  principal: AccessGrantPrincipal.identityCenterGroup('a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6'),
  permission: AccessGrantPermission.READ_WRITE_DELETE,
});
// Every active Identity Center user in the SRE department gets Viewer access,
// including users who join the department later
new AccessGrant(this, 'SreDepartmentView', {
  space,
  principal: AccessGrantPrincipal.identityCenterUser({
    attributes: { 'enterprise.department': 'sre', active: 'true' },
  }),
  permission: AccessGrantPermission.READ,
});
```

An IAM principal must be in the space's account, which is the stack's account, and a space accepts one grant per principal and built-in permission.

#### Access grant props and class

An access grant takes `AccessGrantProps`. The props map to the CloudFormation properties of `AWS::CloudWatch::AccessGrant`. Every property
is create-only and the resource has no update handler, so any change to a grant's props replaces it (delete, then create). An access grant
needs the domain id of its space, because `AWS::CloudWatch::AccessGrant` requires `DomainId` and a space ARN does not contain it. The
construct reads it from a `Space`, from the `domainId` prop of a `CfnSpace`, or from a space imported with
`Space.fromSpaceAttributes({ spaceArn, domainId })`, and throws at synthesis for a space without one, such as a space imported with
`fromSpaceArn`

```ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_cloudwatch as cwRefs } from 'aws-cdk-lib/interfaces';

/** Options for an access grant, for methods that supply the space. */
export interface AccessGrantOptions {
  /** Who receives access. */
  readonly principal: AccessGrantPrincipal;
  /** What the principal can do in the space. */
  readonly permission: AccessGrantPermission;
  /**
   * The name of the access grant, 1 to 64 letters, digits, `_` and `-`.
   * A change replaces the grant.
   * @default - a name generated from the construct path
   */
  readonly accessGrantName?: string;
  /**
   * Up to 50 tags for the access grant. A change replaces the grant.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}

/** Props for an access grant. */
export interface AccessGrantProps extends AccessGrantOptions {
  /** The space the grant belongs to. A change replaces the grant. */
  readonly space: cwRefs.ISpaceRef;
}

/** A CloudWatch Omni access grant. */
export interface IAccessGrant extends cdk.IResource, cwRefs.IAccessGrantRef {
  /** The ARN of the access grant. @attribute */
  readonly accessGrantArn: string;
  /** The id of the access grant. @attribute */
  readonly accessGrantId: string;
}

/**
 * A CloudWatch Omni access grant: one principal's permission in a space.
 * @resource AWS::CloudWatch::AccessGrant
 */
export declare class AccessGrant extends cdk.Resource implements IAccessGrant {
  /** Imports an access grant by ARN, the resource's primary identifier. */
  static fromAccessGrantArn(scope: Construct, id: string, accessGrantArn: string): IAccessGrant;

  constructor(scope: Construct, id: string, props: AccessGrantProps);

  readonly accessGrantArn: string;
  readonly accessGrantId: string;
  readonly space: cwRefs.ISpaceRef;
  readonly principal: AccessGrantPrincipal;
  readonly permission: AccessGrantPermission;
}
```

#### Access grant principals and permissions

Every AccessGrant answers two questions, and each one is a prop:

1. **principal** says who gets access. An AccessGrantPrincipal names one identity, or a group of identities, in the space's account: it
   could be an IAM role, an Identity Center group, an access profile, an alert in the space, and so on. It accepts the grant's PrincipalType
   and PrincipalId (and PrincipalAttributes for attribute-based Identity Center grants).
2. **permission** says what that principal can do in the space. An AccessGrantPermission is either a built-in level that covers the whole
   space or a list of specific actions. It accepts the grant's Permission and ScopedActions.

Both value sets are enum-like classes, so new values can be added without a breaking change and no union type appears on the public surface.

```ts
import * as iam from 'aws-cdk-lib/aws-iam';
import { IAccessProfileRef } from 'aws-cdk-lib/aws-cloudwatch';

/** Who receives access through an access grant. */
export class AccessGrantPrincipal {
  /** An IAM role in the space's account. Sends the role ARN. */
  public static iamRole(role: iam.IRoleRef): AccessGrantPrincipal { /* ... */ }
  /** An IAM user in the space's account. Sends the user ARN. */
  public static iamUser(user: iam.IUserRef): AccessGrantPrincipal { /* ... */ }
  /** The root of the account the grant is deployed in. Sends the root ARN. */
  public static accountRoot(): AccessGrantPrincipal { /* ... */ }
  /** An IAM Identity Center user, by user id, by user attributes, or both. */
  public static identityCenterUser(options: IdentityCenterUserPrincipalOptions): AccessGrantPrincipal { /* ... */ }
  /** An IAM Identity Center group, by Identity Store group id. */
  public static identityCenterGroup(groupId: string): AccessGrantPrincipal { /* ... */ }
  /** An access profile in the same space. Sends the profile id. */
  public static accessProfile(profile: IAccessProfileRef): AccessGrantPrincipal { /* ... */ }
  /**
   * Every alert in the space. Sends PrincipalType ALERT and PrincipalId ALL.
   * Accepts only `AccessGrantPermission.assumeAccessProfile`, checked at synthesis.
   */
  public static allAlerts(): AccessGrantPrincipal { /* ... */ }
  /** Any principal type the service accepts, for types without a dedicated factory. */
  public static of(principalType: string, principalId: string): AccessGrantPrincipal { /* ... */ }

  private constructor(
    /** The CloudFormation PrincipalType value. */
    public readonly principalType: string,
    /** The CloudFormation PrincipalId value, if any. */
    public readonly principalId?: string,
    /** The CloudFormation PrincipalAttributes value, if any. */
    public readonly principalAttributes?: { [key: string]: string },
  ) {}
}

/** Options for an IAM Identity Center user principal. Give a user id, attributes, or both. */
export interface IdentityCenterUserPrincipalOptions {
  /**
   * The Identity Store user id, a UUID.
   * @default - the user is selected by attributes only
   */
  readonly userId?: string;
  /**
   * Up to 10 user attributes that a user must all match, for example `{ email: 'jane@example.com' }`.
   * @default - the user is selected by id only
   */
  readonly attributes?: { [key: string]: string };
}
```

Each factory sends the identifier the service expects as `PrincipalId`:

| Factory | PrincipalType | PrincipalId |
| --- | --- | --- |
| `iamRole(role)` | `IAM_ROLE` | The full role ARN in the space's account. Not a role name, and not an assumed-role ARN. |
| `iamUser(user)` | `IAM_USER` | The full user ARN in the space's account. |
| `accountRoot()` | `IAM_ROOT` | `arn:<partition>:iam::<account>:root` for the account the grant is deployed in, which is the space's account. |
| `identityCenterUser(options)` | `IDC_USER` | The Identity Store user id (a UUID), optional when `attributes` is given. `attributes` maps to `PrincipalAttributes`. |
| `identityCenterGroup(groupId)` | `IDC_GROUP` | The Identity Store group id (a UUID). |
| `accessProfile(profile)` | `ACCESS_PROFILE` | The access profile id, not its ARN. |
| `allAlerts()` | `ALERT` | `ALL`, every alert in the space. Accepts only `AccessGrantPermission.assumeAccessProfile(profile)`. |
| `of(principalType, principalId)` | as given | as given |

Principal attributes are attribute-based access control for Identity Center users. They are valid only with `identityCenterUser`. A grant
with attributes and no user id applies to every Identity Center user who matches all the attributes, and a grant with both applies to that
user only while the attribute matches. The schema accepts up to 10 attributes, and the service accepts the keys `userName`, `active`,
`userStatus`, `displayName`, `email`, `name.givenName`, `name.familyName`, `enterprise.department`, `enterprise.division`,
`enterprise.organization`, `enterprise.costCenter`, and `enterprise.employeeNumber`, with `true` or `false` as the value of `active`. An
`identityCenterUser` principal needs a user id, attributes, or both.

The permission class takes optional scoped actions on every built-in level:

```ts
import { aws_cloudwatch as cwRefs } from 'aws-cdk-lib/interfaces';
import { ScopedAction } from 'aws-cdk-lib/aws-cloudwatch';

/** What a principal can do in a space. Renders an access grant's `Permission` and `ScopedActions`. */
export class AccessGrantPermission {
  /** Viewer: read-only access to the whole space. */
  public static readonly READ = new AccessGrantPermission('READ');

  /** Editor: everything a Viewer can do, plus create, change, and delete resources. */
  public static readonly READ_WRITE_DELETE = new AccessGrantPermission('READ_WRITE_DELETE');

  /** Space Admin: full access, including members, their permissions. */
  public static readonly SPACE_ADMIN = new AccessGrantPermission('SPACE_ADMIN');

  /**
   * Exactly the given actions, and nothing else.
   * @param scopedActions 1 to 20 scoped actions
   */
  public static custom(scopedActions: ScopedAction[]): AccessGrantPermission {
    return new AccessGrantPermission('CUSTOM', scopedActions);
  }

  /**
   * Lets the principal run as the given access profile. Renders `CUSTOM` with
   * `cloudwatch:AssumeAccessProfile` on resource type `AccessProfile`, scoped to the profile's ARN.
   * The only permission `AccessGrantPrincipal.allAlerts()` accepts.
   */
  public static assumeAccessProfile(profile: cwRefs.IAccessProfileRef): AccessGrantPermission { /* ... */ }

  private constructor(
    /** The CloudFormation `Permission` value. */
    public readonly permission: string,
    /** The CloudFormation `ScopedActions` value, if any. */
    public readonly scopedActions?: ScopedAction[],
  ) {}

  /**
   * Narrows a built-in level.
   */
  public withScopedActions(scopedActions: ScopedAction[]): AccessGrantPermission {
    return new AccessGrantPermission(this.permission, [...(this.scopedActions ?? []), ...scopedActions]);
  }
}
```

The schema allows at most 20 scoped actions on a grant. The scoped-action types are plain data interfaces that mirror the schema's
`ScopedActions`, `ResourceScope`, and `RowScope` definitions and their limits:

```ts
/** One scoped action of an access grant. */
export interface ScopedAction {
  /** 1 to 50 actions in `service:Action` form, for example `cloudwatch:GetOmniDashboard`. */
  readonly actions: string[];
  /**
   * Up to 10 resource scopes that limit the actions.
   * @default - the actions are not limited to resources
   */
  readonly resources?: ResourceScope[];
  /**
   * Up to 10 condition keys, each with the values it accepts. Write-only in CloudFormation,
   * so drift detection cannot see it.
   * @default - no conditions
   */
  readonly contextConditions?: { [key: string]: string[] };
}

/** Limits scoped actions to resources of one type. */
export interface ResourceScope {
  /** The resource type. */
  readonly resourceType: ScopedResourceType;
  /**
   * Up to 5 resource ARNs.
   * @default - every resource of the type
   */
  readonly resourceArns?: string[];
  /**
   * Up to 3 tags that a resource must carry.
   * @default - no tag condition
   */
  readonly tags?: { [key: string]: string };
  /**
   * The signal types that the row scopes apply to. Required with `rowScopeGroups`.
   * @default - no signal types
   */
  readonly signalTypes?: SignalType[];
  /**
   * 1 to 20 groups of row conditions. A row matches when it matches every condition of any one group.
   * This controls which rows of telemetry data a principal can read.
   * @example
   * // Shows a log row if (service = checkout AND env = prod) OR (team = sre)
   * rowScopeGroups: [
   *   { conditions: [{ field: 'service', values: ['checkout'] }, { field: 'env', values: ['prod'] }] },
   *   { conditions: [{ field: 'team',    values: ['sre'] }] },
   * ]
   * @default - rows are not limited
   */
  readonly rowScopeGroups?: RowScopeGroup[];
}

/** A resource type that a resource scope limits scoped actions to. */
export class ScopedResourceType {
  /** The telemetry of the space's Dataset, for query actions. */
  public static readonly DATASET = new ScopedResourceType('DataSet');
  /** CloudWatch Omni dashboards. */
  public static readonly OMNI_DASHBOARD = new ScopedResourceType('OmniDashboard');
  /** Access profiles. */
  public static readonly ACCESS_PROFILE = new ScopedResourceType('AccessProfile');

  /** A resource type without a static member, such as alerts and integrations. */
  public static of(value: string): ScopedResourceType {
    return new ScopedResourceType(value);
  }

  private constructor(
    /** The CloudFormation ResourceType value. */
    public readonly value: string,
  ) {}
}

/** A signal type that row scopes apply to. */
export class SignalType {
  /** Log events. */
  public static readonly LOGS = new SignalType('LOGS');
  /** Trace spans. */
  public static readonly TRACES = new SignalType('TRACES');

  /** A signal type without a static member, for types the service adds later. */
  public static of(value: string): SignalType {
    return new SignalType(value);
  }

  private constructor(
    /** The CloudFormation SignalTypes value. */
    public readonly value: string,
  ) {}
}

/** A group of row conditions that a row must all match. */
export interface RowScopeGroup {
  /** 1 to 20 conditions. */
  readonly conditions: RowScope[];
}

/** A row condition: the field must equal one of the values. */
export interface RowScope {
  /** The field name, 1 to 256 characters. */
  readonly field: string;
  /** 1 to 100 distinct values. */
  readonly values: string[];
}
```

### Access profiles

An access profile belongs to a space and is defined with `new AccessProfile(this, id, { space, ... })`. `space` takes any `ISpaceRef`, so a
`Space`, a `CfnSpace`, or an imported space works. A profile can also be the principal of an access grant, through
`AccessGrantPrincipal.accessProfile`.

```ts
import {
  Space, AccessProfile, AccessGrantPermission,
} from 'aws-cdk-lib/aws-cloudwatch';

declare const space: Space;

const profile = new AccessProfile(this, 'ReadersProfile', {
  space,
  accessProfileName: 'readers',
  description: 'Read-only access profile for the service space.',
});

profile.addAccessGrant('View', { permission: AccessGrantPermission.READ });
```

The props map to the CloudFormation properties `Name`, `Description`, and `Tags`, which update in place, and `SpaceId`, which is create-only.

```ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AccessGrant, AccessGrantPermission, ISpaceRef, IAccessProfileRef } from 'aws-cdk-lib/aws-cloudwatch';

/** Props for an access profile. */
export interface AccessProfileProps {
  /** The space that the access profile belongs to. Create-only: a change replaces the profile. */
  readonly space: ISpaceRef;
  /**
   * The name of the access profile, 1 to 256 letters, digits, spaces, and the characters `_.:/=+@-`.
   * Updatable in place.
   */
  readonly accessProfileName: string;
  /**
   * A description of the access profile, up to 1,024 characters. Updatable in place.
   * @default - no description
   */
  readonly description?: string;
  /**
   * Tags for the access profile. Updatable in place.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}

/** Attributes of an access profile defined outside the stack. */
export interface AccessProfileAttributes {
  /** The space that the access profile belongs to. */
  readonly space: ISpaceRef;
  /** The id of the access profile. */
  readonly accessProfileId: string;
}

/** A CloudWatch Omni access profile. */
export interface IAccessProfile extends cdk.IResource, IAccessProfileRef {
  /** The ARN of the access profile. @attribute */
  readonly accessProfileArn: string;
  /** The id of the access profile. @attribute */
  readonly accessProfileId: string;
  /** The space that owns this access profile. */
  readonly space: ISpaceRef;
}

/**
 * Options for a grant that gives an access profile access in its space.
 * The same as `AccessGrantOptions` without `principal`, which is the profile.
 */
export interface AccessProfileGrantOptions {
  /** What the profile can do in the space. Not `SPACE_ADMIN`. */
  readonly permission: AccessGrantPermission;
  /**
   * The name of the access grant, 1 to 64 letters, digits, `_` and `-`. A change replaces the grant.
   * @default - a name generated from the construct path
   */
  readonly accessGrantName?: string;
  /**
   * Up to 50 tags for the access grant. A change replaces the grant.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}

/**
 * A CloudWatch Omni access profile: an identity in a space that alerts run as.
 * @resource AWS::CloudWatch::AccessProfile
 */
export declare class AccessProfile extends cdk.Resource implements IAccessProfile {
  static fromAccessProfileAttributes(scope: Construct, id: string, attrs: AccessProfileAttributes): IAccessProfile;

  constructor(scope: Construct, id: string, props: AccessProfileProps);

  readonly accessProfileArn: string;
  readonly accessProfileId: string;
  readonly space: ISpaceRef;

  /**
   * Gives this profile access in its space. Creates an `AccessGrant` whose principal is this
   * profile, as a child of this construct.
   */
  addAccessGrant(id: string, options: AccessProfileGrantOptions): AccessGrant;
}
```

#### Method: `addAccessGrant`

`profile.addAccessGrant(id, options)` creates an `AccessGrant` in the profile's space whose principal is the profile, as a child of the
profile construct. It is shorthand for
`new AccessGrant(scope, id, { space: profile.space, principal: AccessGrantPrincipal.accessProfile(profile), ...options })`, and the two
forms synthesize the same resource.

```ts
// These two grants are equivalent
profile.addAccessGrant('View', { permission: AccessGrantPermission.READ });

new AccessGrant(this, 'CheckoutProfileView', {
  space,
  principal: AccessGrantPrincipal.accessProfile(profile),
  permission: AccessGrantPermission.READ,
});
```

### Dashboards

A dashboard holds a team's authored content in a space.

#### Defining a dashboard

A dashboard lives in a space, and a space lives in a domain, so a complete minimal stack is shown below.

```ts
import {
  Domain, DomainIdentifier, Space, OmniDashboard, OmniDashboardBody,
  IdentityProvider, IdentityCenterInstance,
} from 'aws-cdk-lib/aws-cloudwatch';

const domain = new Domain(this, 'Domain', {
  domainName: 'observability',
  identityProviders: [IdentityProvider.IDC],
  identityCenterInstance: IdentityCenterInstance.fromInstanceArn(
    'arn:aws:sso:::instance/ssoins-1a2b3c4d5e6f7a8b'),
});

const space = new Space(this, 'Space', {
  domain: DomainIdentifier.fromDomain(domain),
  spaceName: 'observability',
});

new OmniDashboard(this, 'GettingStarted', {
  space,
  omniDashboardName: 'getting-started',
  body: OmniDashboardBody.fromObject({
  panels: [
    {
      type: 'markdown',
      title: 'Overview',
      layout: { x: 0, y: 0, w: 60, h: 120 },
      config: {
        content: 'Service health for OrderProcessor.',
      },
    },
    {
      type: 'explore',
      title: 'Lambda errors',
      layout: { x: 0, y: 120, w: 60, h: 400 },
      config: {
        queries: [
          {
            queryId: 'A',
            queryLanguage: 'promql',
            queryString: 'sum(rate(aws_lambda_errors_sum{function_name="OrderProcessor"}[5m]))',
          },
        ],
        visualization: 'line',
      },
    },
  ],
}),
});
```

#### Dashboard props and class

The props map to the CloudFormation properties `Name`, `Body`, `Description`, and `Tags`, which update in place, and `SpaceId`, which is create-only.

```ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ISpaceRef, IOmniDashboardRef, OmniDashboardBody } from 'aws-cdk-lib/aws-cloudwatch';

/** Props for a dashboard. */
export interface OmniDashboardProps {
  /** The space that the dashboard belongs to. Create-only: a change replaces the dashboard. */
  readonly space: ISpaceRef;
  /**
   * The name of the dashboard, 1 to 256 letters, digits, and the characters `_.@~()-`. Updatable in place.
   */
  readonly omniDashboardName: string;
  /** The body of the dashboard. Updatable in place. */
  readonly body: OmniDashboardBody;
  /**
   * A description of the dashboard, 1 to 1,024 characters. Updatable in place,
   * but removing it replaces the dashboard, because the service can't clear a description.
   * @default - no description
   */
  readonly description?: string;
  /**
   * Tags for the dashboard. Updatable in place.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}

/** Attributes of a dashboard defined outside the stack. */
export interface OmniDashboardAttributes {
  /** The space that the dashboard belongs to. */
  readonly space: ISpaceRef;
  /** The id of the dashboard. */
  readonly omniDashboardId: string;
}

/** A CloudWatch Omni dashboard. */
export interface IOmniDashboard extends cdk.IResource, IOmniDashboardRef {
  /** The ARN of the dashboard. @attribute */
  readonly omniDashboardArn: string;
  /** The id of the dashboard. @attribute */
  readonly omniDashboardId: string;
  /** The space that owns this dashboard. Undefined for a dashboard referenced by ARN alone. */
  readonly space?: ISpaceRef;
}

/**
 * A CloudWatch Omni dashboard: authored content in a space.
 * @resource AWS::CloudWatch::OmniDashboard
 */
export declare class OmniDashboard extends cdk.Resource implements IOmniDashboard {
  static fromOmniDashboardArn(scope: Construct, id: string, omniDashboardArn: string): IOmniDashboard;
  static fromOmniDashboardAttributes(scope: Construct, id: string, attrs: OmniDashboardAttributes): IOmniDashboard;

  constructor(scope: Construct, id: string, props: OmniDashboardProps);

  readonly omniDashboardArn: string;
  readonly omniDashboardId: string;
  readonly space: ISpaceRef;
}
```

#### Dashboard bodies

A dashboard body is one JSON string. `OmniDashboardBody` produces it from a string, an object, or a file, and all three drop into the same
`body` property.

```ts
import * as path from 'path';
import { OmniDashboardBody } from 'aws-cdk-lib/aws-cloudwatch';

const fromText = OmniDashboardBody.fromString('{"panels":[]}');

const fromObj = OmniDashboardBody.fromObject({ panels: [] });

const fromDisk = OmniDashboardBody.fromFile(path.join(__dirname, 'service-health.json'));
```

#### Dashboard body

`OmniDashboardBody` is an abstract class with a bind contract, a body is bound to a construct scope at synthesis and returns the JSON string.

```ts
import { Construct } from 'constructs';

/** The result of binding an OmniDashboardBody. */
export interface OmniDashboardBodyConfig {
  /** The dashboard body as a JSON string. May contain tokens. */
  readonly json: string;
}

/** The body of an OmniDashboard: a JSON document the service interprets. */
export abstract class OmniDashboardBody {
  /** A body given as a JSON string. */
  public static fromString(json: string): OmniDashboardBody { /* ... */ }
  /** A body given as an object, serialized with Stack.toJsonString. */
  public static fromObject(body: { [key: string]: any }): OmniDashboardBody { /* ... */ }
  /** A body read from a JSON file at synthesis time. */
  public static fromFile(filePath: string): OmniDashboardBody { /* ... */ }

  /** Produce the JSON string for the dashboard in the given scope. */
  public abstract bind(scope: Construct): OmniDashboardBodyConfig;
}
```

The `OmniDashboard` construct calls `bind` lazily and checks the returned string when it has no unresolved tokens. The check covers two
things only: the string parses as JSON, and its top-level `panels` member is an array.

### Alerts

Where a dashboard shows the telemetry of a space to whoever opens it, an alert watches that telemetry on a schedule. It runs a SQL or PromQL
query at a fixed interval, compares the result with a warning threshold, a critical threshold, or both, and is always in one of four states:
`OK`, `WARNING`, `CRITICAL`, or `NODATA`. Notification rules send a message to an SNS topic or an integration (see
[Integration](https://docs.aws.amazon.com/cloudwatch-omni/latest/APIReference/API_Integration.html)) when the alert is in the states they
name. An alert assumes an access profile, so the profile, and not the person or the role that defines the alert, decides what the query can
read. See [Alerts](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-alerts.html) for the service behavior.

#### Defining an alert

Every alert carries an **access profile** (the identity it evaluates its query and sends notifications as) you create a different profile
for finer-grained control.

```ts
import { Duration } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import {
  Space, AccessProfile, AccessGrant, AccessGrantPrincipal, AccessGrantPermission,
  Alert, AlertRule, AlertCondition, AlertComparator, AlertState, QueryLanguage,
} from 'aws-cdk-lib/aws-cloudwatch';

declare const space: Space;

// 1. The identity the alert runs as
const profile = new AccessProfile(this, 'CheckoutAlertsProfile', {
  space,
  accessProfileName: 'checkout-alerts',
  description: 'The identity that checkout alerts run as.',
});

// 2. Every alert in the space may run as the profile
new AccessGrant(this, 'AlertsAssumeCheckoutProfile', {
  space,
  principal: AccessGrantPrincipal.allAlerts(),
  permission: AccessGrantPermission.assumeAccessProfile(profile),
});

// 3. The profile can read the space's telemetry
new AccessGrant(this, 'CheckoutProfileReads', {
  space,
  principal: AccessGrantPrincipal.accessProfile(profile),
  permission: AccessGrantPermission.READ,
});

// 4. The alert
const onCall = new sns.Topic(this, 'OnCall');

const alert = new Alert(this, 'CheckoutServerErrors', {
  space,
  alertName: 'checkout-5xx-responses',
  profile,
  rule: AlertRule.telemetry({
    query: 'SELECT * FROM "logs.default" '
      + "WHERE resource['attributes']['service.name'] = 'checkout' "
      + "AND attributes['http.response.status_code'] >= 500",
    language: QueryLanguage.SQL,
    condition: AlertCondition.rowCount({
      comparator: AlertComparator.GREATER_THAN,
      warningThreshold: 10,
      criticalThreshold: 50,
    }),
    evaluationInterval: Duration.minutes(1),
    pendingDuration: Duration.minutes(2),
  }),
  notificationRules: [{
    target: AlertTarget.sns(onCall),
    states: [AlertState.WARNING, AlertState.CRITICAL, AlertState.OK],
  }],
});
```

When it creates or updates the alert, the service checks that alerts can assume the profile, that the identity deploying the alert can
assume the profile, and that the profile can read the data the query references. The alert depends on the profile construct and on every
access grant that names the profile, as its principal or through `assumeAccessProfile`. CloudFormation therefore creates both grants before
the alert, with no `addDependency` in the example. For an imported profile, or for grants defined as `CfnAccessGrant`, CDK cannot see the
grants, so the alert needs `alert.node.addDependency(...)` on them.

#### Alert props and class

```ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_cloudwatch as cwRefs } from 'aws-cdk-lib/interfaces';

/** Options for defining an alert in a space. */
export interface AlertOptions {
  /** The alert name, 1 to 256 characters. Not unique within a space. Updatable in place. */
  readonly alertName: string;
  /**
   * The access profile the alert runs as, in the same space. Alerts and the deploying identity
   * must be allowed to assume it, and it must be able to read the queried data. Updatable in place.
   */
  readonly profile: cwRefs.IAccessProfileRef;
  /** What the alert evaluates. */
  readonly rule: AlertRule;
  /**
   * A description of the alert, up to 1,024 characters.
   * @default - no description
   */
  readonly description?: string;
  /**
   * Up to 5 notification rules. More can be added with `addNotification`.
   * @default - no notification rules, so the alert sends no notifications
   */
  readonly notificationRules?: AlertNotificationRule[];
  /**
   * Whether the notification rules send notifications. The alert evaluates and records
   * its state either way.
   * @default true
   */
  readonly notificationsEnabled?: boolean;
  /**
   * Tags for the alert. Updatable in place.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}

/** Props for an alert. */
export interface AlertProps extends AlertOptions {
  /** The space that the alert belongs to. Create-only: a change replaces the alert. */
  readonly space: cwRefs.ISpaceRef;
}

/** Attributes of an alert defined outside the stack. */
export interface AlertAttributes {
  /** The space that the alert belongs to. */
  readonly space: cwRefs.ISpaceRef;
  /** The id of the alert, 32 lowercase hexadecimal characters. */
  readonly alertId: string;
}

/** A CloudWatch Omni alert. */
export interface IAlert extends cdk.IResource, cwRefs.IAlertRef {
  /** The ARN of the alert. @attribute */
  readonly alertArn: string;
  /** The id of the alert. @attribute */
  readonly alertId: string;
  /** The space that owns this alert. */
  readonly space: cwRefs.ISpaceRef;
}

/**
 * A CloudWatch Omni alert: a query that a space evaluates on a schedule, as an access profile.
 * @resource AWS::CloudWatch::Alert
 */
export declare class Alert extends cdk.Resource implements IAlert {
  static fromAlertAttributes(scope: Construct, id: string, attrs: AlertAttributes): IAlert;

  constructor(scope: Construct, id: string, props: AlertProps);

  readonly alertArn: string;
  readonly alertId: string;
  readonly space: cwRefs.ISpaceRef;
  readonly profile: cwRefs.IAccessProfileRef;

  /** Sends a notification to `target` when the alert is in any of `states`, or in every state when none is given. */
  addNotification(target: IAlertTarget, ...states: AlertState[]): void;
}
```

#### Alert rules

`AlertRule`, `AlertCondition`, `AlertComparator`, `AlertState`, and `QueryLanguage` are enum-like classes that render the CloudFormation `Rule`.

```ts
import * as cdk from 'aws-cdk-lib';

/** What an alert evaluates. One factory for each kind of rule the service offers. */
export class AlertRule {
  /** A rule that runs a telemetry query and compares its result with thresholds. */
  public static telemetry(options: TelemetryRuleOptions): AlertRule { /* ... */ }

  private constructor(/* the CloudFormation Rule value */) {}
}

/** Options for a telemetry rule. */
export interface TelemetryRuleOptions {
  /** The query, 1 to 10,000 characters. */
  readonly query: string;
  /** The language of the query. */
  readonly language: QueryLanguage;
  /** What is compared with the thresholds. */
  readonly condition: AlertCondition;
  /**
   * How often the query runs: 30 seconds, 1, 2, 5, 10, 15, or 30 minutes, or 1 hour.
   * Whole seconds only.
   */
  readonly evaluationInterval: cdk.Duration;
  /**
   * How long results must stay past a threshold before the alert changes state.
   * A whole multiple of `evaluationInterval`. Zero changes the state at once.
   * @default - no pending duration
   */
  readonly pendingDuration?: cdk.Duration;
  /**
   * How long results must stay clear before the alert returns to OK.
   * A whole multiple of `evaluationInterval`. Zero returns to OK at once.
   * @default - no recovery duration
   */
  readonly recoveryDuration?: cdk.Duration;
  /**
   * The state the alert reports when the query returns nothing to evaluate.
   * @default AlertState.NODATA
   */
  readonly treatNoDataAs?: AlertState;
}

/** The language of an alert query. */
export class QueryLanguage {
  /** SQL, for logs and traces. */
  public static readonly SQL = new QueryLanguage('SQL');
  /** PromQL, for metrics. */
  public static readonly PROMQL = new QueryLanguage('PROMQL');
  /** A language without a static member, for languages the service adds later. */
  public static of(value: string): QueryLanguage { return new QueryLanguage(value); }

  private constructor(
    /** The CloudFormation Language value. */
    public readonly value: string,
  ) {}
}

/** What an alert compares with its thresholds. */
export class AlertCondition {
  /** The number of rows the query returns (ThresholdMode COUNT_OF_RESULTS). */
  public static rowCount(options: AlertThresholdOptions): AlertCondition { /* ... */ }
  /** The value of a field in each row, each row a contributor (ThresholdMode FIELD_VALUE). */
  public static fieldValue(field: string, options: AlertThresholdOptions): AlertCondition { /* ... */ }

  private constructor(/* the CloudFormation Condition value */) {}
}

/** The comparison and the thresholds of an alert condition. Give at least one threshold. */
export interface AlertThresholdOptions {
  /** How a result is compared with the thresholds. */
  readonly comparator: AlertComparator;
  /**
   * The value past which the alert enters WARNING.
   * @default - no warning tier
   */
  readonly warningThreshold?: number;
  /**
   * The value past which the alert enters CRITICAL.
   * @default - no critical tier
   */
  readonly criticalThreshold?: number;
}

/** How an alert result is compared with a threshold. */
export class AlertComparator {
  public static readonly GREATER_THAN = new AlertComparator('GT');
  public static readonly GREATER_THAN_OR_EQUAL = new AlertComparator('GTE');
  public static readonly LESS_THAN = new AlertComparator('LT');
  public static readonly LESS_THAN_OR_EQUAL = new AlertComparator('LTE');
  /** A comparator without a static member, for comparators the service adds later. */
  public static of(value: string): AlertComparator { return new AlertComparator(value); }

  private constructor(
    /** The CloudFormation Comparator value. */
    public readonly value: string,
  ) {}
}

/** A state of an alert. */
export class AlertState {
  public static readonly OK = new AlertState('OK');
  public static readonly WARNING = new AlertState('WARNING');
  public static readonly CRITICAL = new AlertState('CRITICAL');
  /** The query returned nothing to evaluate. */
  public static readonly NODATA = new AlertState('NODATA');
  /** A state without a static member, for states the service adds later. */
  public static of(value: string): AlertState { return new AlertState(value); }

  private constructor(
    /** The CloudFormation state value. */
    public readonly value: string,
  ) {}
}
```

#### Alert notifications

Each notification rule names the states that trigger it, or every state when `states` is omitted, and one target. A common setup sends
`WARNING` to a team target, `CRITICAL` to a paging target, and `OK` to both, so the people who were notified know when the alert cleared.

An alert without notification rules sends nothing. `notificationsEnabled: false` stops all notifications while the alert keeps evaluating.

Slack, PagerDuty, and other integrations are connected in the CloudWatch console, and a customer passes the integration's ARN, from the
console or `aws cloudwatch-omni list-integrations`.

```ts
// adding a notification to an alert
import * as sns from 'aws-cdk-lib/aws-sns';
import {
  Alert, AccessProfile, AccessGrantPermission, AlertState, AlertTarget,
} from 'aws-cdk-lib/aws-cloudwatch';

declare const alert: Alert;
declare const profile: AccessProfile;   // the profile the alert runs as
// Integrations connected in the console, by ARN
declare const teamSlackArn: string;
declare const pagerDutyArn: string;

// WARNING goes to the team, CRITICAL pages, and OK tells both that the alert cleared.
alert.addNotification(AlertTarget.slack(teamSlackArn), AlertState.WARNING, AlertState.CRITICAL, AlertState.OK);
alert.addNotification(AlertTarget.pagerDuty(pagerDutyArn), AlertState.CRITICAL, AlertState.OK);

const auditTopic = new sns.Topic(this, 'AlertAudit');
alert.addNotification(AlertTarget.sns(auditTopic));   // no states: every state change
```

```ts
/** When and where an alert sends a notification. */
export interface AlertNotificationRule {
  /** Up to 4 states that trigger the rule. @default - every state */
  readonly states?: AlertState[];
  /** Where the notification goes. */
  readonly target: IAlertTarget;
}

/** Where an alert sends a notification. */
export interface IAlertTarget {
  /** Called once for each alert that uses the target. */
  bind(scope: Construct, alert: IAlert): AlertTargetConfig;
}

/** The CloudFormation Target of a notification rule. */
export interface AlertTargetConfig {
  readonly type: AlertTargetType;
  readonly arn: string;
  /** Up to 20 target-specific values. @default - none */
  readonly metadata?: { [key: string]: string };
}

/** Options for a notification target. */
export interface AlertTargetOptions {
  /** Up to 20 target-specific values. @default - none */
  readonly metadata?: { [key: string]: string };
}

/** The notification targets an alert can send to. */
export class AlertTarget implements IAlertTarget {
  /** A Slack integration, by ARN. */
  static slack(integrationArn: string, options?: AlertTargetOptions): AlertTarget;
  /** A PagerDuty integration, by ARN. */
  static pagerDuty(integrationArn: string, options?: AlertTargetOptions): AlertTarget;
  /** An Amazon SNS topic. */
  static sns(topic: snsRefs.ITopicRef): AlertTarget;
  /** Any target type and ARN, for types without a factory. */
  static of(type: AlertTargetType, arn: string, options?: AlertTargetOptions): AlertTarget;

  bind(scope: Construct, alert: IAlert): AlertTargetConfig;
}

/** The kind of notification target. */
export class AlertTargetType {
  public static readonly SNS = new AlertTargetType('sns');
  public static readonly SLACK = new AlertTargetType('slack');
  public static readonly PAGERDUTY = new AlertTargetType('pagerduty');
    /** A target type without a static member, for types the service adds later. */
  public static of(value: string): AlertTargetType { return new AlertTargetType(value); }

  private constructor(public readonly value: string) {}
}
```

One class covers every target, because the service sends the same `{ type, arn, metadata }` for each and the targets differ only by type.

### Organization domains

In this RFC, "organization domain" and "organization access grant" are the plain-English names of the resources that the
`DomainForOrganization` and `DomainAccessGrantForOrganization` constructs define, after their CloudFormation types
`AWS::CloudWatch::DomainForOrganization` and `AWS::CloudWatch::DomainAccessGrantForOrganization`.

An administrator creates an Organization domain once from the management account, and then any member account can create its own space,
automatically linked to the domain. See [Organization domain rules](#organization-domain-rules) for how an organization domain and an
account `Domain` exclude each other.

A team with one account sets up a domain and a space in that account. An organization that runs CloudWatch Omni in many accounts sets up
sign-in once instead. An organization domain, defined from the management account, configures how users sign in for the whole organization,
the spaces of the member accounts it governs belong to it, and organization access grants give principals administrative access to it.

#### Managing an organization domain

The example below runs in a stack deployed to the management account. It creates the organization domain, with a default domain access role,
and gives an Identity Center group administrative access to it.

```ts
import {
  DomainForOrganization, DomainAccessGrantForOrganizationPrincipal,
  IdentityProvider, IdentityCenterInstance,
} from 'aws-cdk-lib/aws-cloudwatch';

const orgDomain = new DomainForOrganization(this, 'OrgDomain', {
  domainName: 'org-observability',
  identityProviders: [IdentityProvider.IDC],
  identityCenterInstance: IdentityCenterInstance.fromInstanceArn(
    'arn:aws:sso:::instance/ssoins-1a2b3c4d5e6f7a8b'),
});

orgDomain.addAccessGrant('PlatformAdmins', {
  accessGrantName: 'platform-admins',
  principal: DomainAccessGrantForOrganizationPrincipal.identityCenterGroup('a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6'),
});
```

Deploy the stack to the management account. When the domain uses Identity Center, deploy it in the Region of the Identity Center instance or
in a Region that the instance replicates to through multi-Region replication (see [Domains](#domains)). The service gives an `ADMIN` grant
to the identity that creates the domain, which under CloudFormation is the deployment role and not a person, so add grants for the people
who administer the domain, as the example does. An organization access grant always confers `ADMIN`, and like an access grant it is replaced
on any change. See [Organization domain rules](#organization-domain-rules) for who can create, change, and delete these resources.

#### Organization domain rules

An organization has one organization domain. It is created, updated, and deleted from the organization's management account. It cannot be
created while the management account holds an account `Domain`, and an account cannot create its own `Domain` while an organization domain
with trusted access governs it. Member accounts create the spaces that belong to the organization domain, in their own stacks, and reference
the domain by id with `DomainForOrganization.fromDomainForOrganizationId` (see [Spaces](#spaces)). The service gives an `ADMIN` grant to the
identity that creates the domain. Organization access grants are created from the management account, always confer `ADMIN`, and name
principals in the management account or in a delegated administrator account. Every property of an organization access grant is create-only,
so any change, including a tag change, replaces the grant. The domain's `domainAccessRole` is create-only.

#### Organization domain props and interfaces

```ts
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  IDomainForOrganizationRef, IDomainAccessGrantForOrganizationRef,
  IdentityProvider, IdentityCenterInstance, DomainAccessGrantForOrganizationPrincipal,
} from 'aws-cdk-lib/aws-cloudwatch';

/** A CloudWatch Omni organization domain. */
export interface IDomainForOrganization extends cdk.IResource, IDomainForOrganizationRef {
  /** The id of the organization domain, for example d-abc456. @attribute */
  readonly domainForOrganizationId: string;
  /** The organization-domain ARN. Throws for a domain referenced by id alone. @attribute */
  readonly domainForOrganizationArn: string;
  /** The URL users open to reach CloudWatch Omni. Undefined when referenced. @attribute */
  readonly domainForOrganizationEndpointUrl?: string;
}

/** A CloudWatch Omni organization access grant. */
export interface IDomainAccessGrantForOrganization extends cdk.IResource, IDomainAccessGrantForOrganizationRef {
  /** The ARN of the organization access grant. @attribute */
  readonly domainAccessGrantForOrganizationArn: string;
  /** The id of the organization access grant. @attribute */
  readonly domainAccessGrantForOrganizationId: string;
}

/** Props for an organization domain. Deploy it from the organization's management account. */
export interface DomainForOrganizationProps {
  /** The domain name, 3 to 63 lowercase letters, digits, and single hyphens. */
  readonly domainName: string;
  /** How users sign in. One or two providers. */
  readonly identityProviders: IdentityProvider[];
  /**
   * The Identity Center instance. Required when IDC is listed.
   * @default - no Identity Center instance
   */
  readonly identityCenterInstance?: IdentityCenterInstance;
  /**
   * The role the service assumes for the domain. Create-only.
   * @default - a role trusted by the CloudWatch service principal for this management account's
   * organization domains, with CloudWatchOmniDomainAccessPolicy attached
   */
  readonly domainAccessRole?: iam.IRoleRef & iam.IGrantable;
  /**
   * What happens to the organization domain when it is removed from the stack or replaced.
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;
  /**
   * Tags for the organization domain. Updatable in place.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}

/** Options for defining an organization access grant. Every option is create-only. */
export interface DomainAccessGrantForOrganizationOptions {
  /** The name of the grant, 1 to 64 letters, digits, hyphens, and underscores. */
  readonly accessGrantName: string;
  /** Who receives administrative access to the organization domain. */
  readonly principal: DomainAccessGrantForOrganizationPrincipal;
  /**
   * Tags for the organization access grant. Create-only: adding or changing a tag replaces the grant.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}

/** Props for an organization access grant. */
export interface DomainAccessGrantForOrganizationProps extends DomainAccessGrantForOrganizationOptions {
  /** The organization domain that the grant applies to. */
  readonly domain: IDomainForOrganizationRef;
}

export declare class DomainForOrganization {
  static fromDomainForOrganizationId(scope: Construct, id: string, domainId: string): IDomainForOrganization;
  static fromDomainForOrganizationArn(scope: Construct, id: string, domainForOrganizationArn: string): IDomainForOrganization;
}

export declare class DomainAccessGrantForOrganization {
  static fromDomainAccessGrantForOrganizationArn(
    scope: Construct, id: string, domainAccessGrantForOrganizationArn: string): IDomainAccessGrantForOrganization;
}
```

`DomainAccessGrantForOrganizationProps` has no `permission` property, because `ADMIN` is the only permission the schema allows, and the
construct always sends it. The grant name uses `accessGrantName`, matching `AccessGrantOptions`.

#### Domain access role

The default domain access role of an organization domain trusts the `cloudwatch.amazonaws.com` service principal for `sts:AssumeRole`,
`sts:TagSession`, and `sts:SetContext`, on the conditions that `aws:SourceAccount` is the management account and `aws:SourceArn` matches
`arn:<partition>:cloudwatch:*:<account>:organization-domain/*`, and it has the AWS managed policy `CloudWatchOmniDomainAccessPolicy`
attached. The source ARN is a pattern because the domain's id does not exist when the role is created. The service checks during create that
it can assume the role, so a supplied role whose trust policy does not allow this fails the deployment.

The role prop types and the `iam:PassRole` requirement that the domain access role shares with the space's roles are described in [The
space's roles](#the-spaces-roles).

#### Organization access grant principals

Organization access grants accept fewer principal types, so they get a dedicated class rather than reusing `AccessGrantPrincipal`.

```ts
import * as iam from 'aws-cdk-lib/aws-iam';
import { IdentityCenterUserPrincipalOptions } from 'aws-cdk-lib/aws-cloudwatch';

/** Who receives administrative access through an organization access grant. */
export class DomainAccessGrantForOrganizationPrincipal {
  /** An IAM role in the management account or a delegated administrator account. Sends the role ARN. */
  public static iamRole(role: iam.IRoleRef): DomainAccessGrantForOrganizationPrincipal { /* ... */ }
  /** An IAM user in the management account or a delegated administrator account. Sends the user ARN. */
  public static iamUser(user: iam.IUserRef): DomainAccessGrantForOrganizationPrincipal { /* ... */ }
  /** The root of the account the grant is deployed in. Sends the root ARN. */
  public static accountRoot(): DomainAccessGrantForOrganizationPrincipal { /* ... */ }
  /** An IAM Identity Center user, by user id, by user attributes, or both. */
  public static identityCenterUser(options: IdentityCenterUserPrincipalOptions): DomainAccessGrantForOrganizationPrincipal { /* ... */ }
  /** An IAM Identity Center group, by Identity Store group id. */
  public static identityCenterGroup(groupId: string): DomainAccessGrantForOrganizationPrincipal { /* ... */ }
  /** A principal type without a dedicated factory, for types the service adds later. */
  public static of(principalType: string, principalId: string): DomainAccessGrantForOrganizationPrincipal { /* ... */ }

  private constructor(
    /** The CloudFormation PrincipalType value. */
    public readonly principalType: string,
    /** The CloudFormation PrincipalId value, if any. */
    public readonly principalId?: string,
    /** The CloudFormation PrincipalAttributes value, if any. */
    public readonly principalAttributes?: { [key: string]: string },
  ) {}
}
```

The factories map onto the organization schema's principal types `IAM_ROLE`, `IAM_USER`, `IAM_ROOT`, `IDC_USER`, and `IDC_GROUP`, with the
identifiers in the principal table in [Access grant principals and permissions](#access-grant-principals-and-permissions) and the same
attribute rules. These are all the types the schema lists today, so `of` exists for types the service adds later.

### Dataset integrations

A space shows the telemetry that reaches it, and a dataset integration is how logs and traces reach it. The `DatasetIntegration` construct
is in `aws-cdk-lib/aws-observabilityadmin`, because its resource type is `AWS::ObservabilityAdmin::DatasetIntegration`. It does not
reference a domain or a space, and it forwards into the Dataset of its stack's account and Region.

CloudWatch Omni reads what Amazon CloudWatch has ingested and the data (logs/traces) is available in Omni in the space via CloudWatch
Dataset. This integration is enabled by CloudWatch Dataset Integration which enables forwarding from CloudWatch to Dataset for the user
space. Its main setting is the execution role that CloudWatch Logs assumes to read your log groups and write records into the Dataset.

There is one dataset integration per account and Region, and forwarding stays in the same account and Region.

See [Send telemetry to CloudWatch Omni](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-send-telemetry.html) for the
service behavior.

#### Creating a dataset integration

The `DatasetIntegration` construct turns on forwarding for the account and Region of its stack. All props are optional.

```ts
import * as observabilityadmin from 'aws-cdk-lib/aws-observabilityadmin';

new observabilityadmin.DatasetIntegration(this, 'DatasetIntegration');
```

This creates the execution role that CloudWatch Logs assumes. Only `logs.amazonaws.com` can assume the role, and only on behalf of a dataset
integration in the stack's account (the `aws:SourceAccount` and `aws:SourceArn` conditions, see [IAM role behavior](#iam-role-behavior)).
The role allows `logs:IntegrateWithDataset` on every log group in the account, so every log group in the stack's Region is forwarded, and
`cloudwatch:PutRecords` on the account's Datasets, which writes the records into the Dataset. To forward only some log groups, see [Choosing
which log groups are forwarded](#choosing-which-log-groups-are-forwarded). The construct passes the role to the integration and creates the
integration.

```ts
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import { DatasetIntegrationReference, IDatasetIntegrationRef } from 'aws-cdk-lib/aws-observabilityadmin';
import { Construct } from 'constructs';

/**
 * A CloudWatch dataset integration, defined in this app or referenced.
 */
export interface IDatasetIntegration extends cdk.IResource, IDatasetIntegrationRef, iam.IGrantable {
  /**
   * The ARN of the dataset integration.
   * @attribute
   */
  readonly datasetIntegrationArn: string;

  /**
   * The execution role that CloudWatch Logs assumes to forward logs and traces.
   * Undefined for a referenced integration without a role.
   */
  readonly role?: iam.IRoleRef;

  /**
   * Adds a statement to the execution role's identity policy.
   * Adds nothing when there is no role or the role cannot be modified.
   */
  addToRolePolicy(statement: iam.PolicyStatement): void;
}

export interface DatasetIntegrationProps {
  /**
   * The execution role that CloudWatch Logs assumes to forward logs and traces into the Dataset.
   * It must let `logs.amazonaws.com` assume it on behalf of this integration, for example by trusting
   * the principal that `DatasetIntegration.executionRolePrincipal()` returns.
   * @default - a role is created
   */
  readonly role?: iam.IRoleRef & iam.IGrantable;

  /**
   * The log groups that are forwarded, apart from those in `excludeLogGroups`.
   * @default - every log group in the account, for the role that the construct creates and for a
   * supplied role that it can modify. An integration forwards only the log groups in its own Region.
   */
  readonly logGroups?: LogGroupSelection;

  /**
   * Log groups that are never forwarded, even when `logGroups` selects them. The construct adds a
   * statement that denies `logs:IntegrateWithDataset` on them to the execution role.
   * Must not be `LogGroupSelection.all()`.
   * @default - no log groups are excluded
   */
  readonly excludeLogGroups?: LogGroupSelection;

  /**
   * The customer managed key that the Dataset is encrypted with. The construct grants the
   * execution role access to this key. It does not change the Dataset's encryption.
   * @default - no key permissions are added
   */
  readonly datasetEncryptionKey?: kms.IKeyRef;

  /**
   * Tags for the dataset integration.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };
}

export interface DatasetIntegrationAttributes {
  /** The ARN of the dataset integration. */
  readonly datasetIntegrationArn: string;

  /**
   * The execution role that the dataset integration uses.
   * @default - no role
   */
  readonly role?: iam.IRoleRef & iam.IGrantable;
}

/**
 * Forwards logs and traces from CloudWatch Logs into the CloudWatch Dataset of the account and Region.
 * @resource AWS::ObservabilityAdmin::DatasetIntegration
 * @stateless
 */
export declare class DatasetIntegration extends cdk.Resource implements IDatasetIntegration {
  /**
   * The principal that an execution role must trust: `logs.amazonaws.com`, with an `aws:SourceAccount`
   * condition for the account of the scope's stack and an `aws:SourceArn` condition that matches
   * dataset integrations in any Region of that account.
   */
  static executionRolePrincipal(scope: Construct): iam.IPrincipal;
  static fromDatasetIntegrationArn(scope: Construct, id: string, datasetIntegrationArn: string): IDatasetIntegration;
  static fromDatasetIntegrationAttributes(scope: Construct, id: string, attrs: DatasetIntegrationAttributes): IDatasetIntegration;

  constructor(scope: Construct, id: string, props?: DatasetIntegrationProps);

  readonly datasetIntegrationRef: DatasetIntegrationReference;
  /** @attribute */
  readonly datasetIntegrationArn: string;
  /** @attribute */
  readonly datasetIntegrationCreatedAt: string;
  /** @attribute */
  readonly datasetIntegrationUpdatedAt: string;
  /** The execution role in use. Always set for an integration defined in the app. */
  readonly role?: iam.IRoleRef;
  /** The execution role's principal. */
  readonly grantPrincipal: iam.IPrincipal;

  addToRolePolicy(statement: iam.PolicyStatement): void;
}

/**
 * A set of log groups, for the `logGroups` and `excludeLogGroups` props of a dataset integration.
 */
export abstract class LogGroupSelection {
  /** Every log group in the account. An integration forwards only the log groups in its own Region. */
  static all(): LogGroupSelection;
  /** These log groups. They must be in the stack's account and Region. Throws when the list is empty. */
  static fromLogGroups(logGroups: logs.ILogGroupRef[]): LogGroupSelection;
  /** Log groups whose names start with one of these prefixes. Throws when the list or a prefix is empty. */
  static fromNamePrefixes(prefixes: string[]): LogGroupSelection;
}
```

#### Choosing which log groups are forwarded

The `logGroups` prop selects the log groups that are forwarded, and the `excludeLogGroups` prop removes log groups from that selection. The
service has no separate selector: the execution role's `logs:IntegrateWithDataset` permissions decide which log groups forward, and the
construct writes those permissions for you.

```ts
import * as logs from 'aws-cdk-lib/aws-logs';
import * as observabilityadmin from 'aws-cdk-lib/aws-observabilityadmin';

declare const appLogGroup: logs.ILogGroupRef;
declare const auditLogGroup: logs.ILogGroupRef;

new observabilityadmin.DatasetIntegration(this, 'DatasetIntegration', {
  logGroups: observabilityadmin.LogGroupSelection.fromLogGroups([appLogGroup, auditLogGroup]),
});
```

`LogGroupSelection.all()` is the default for `logGroups`, for the role that the construct creates and for a role you supply that the
construct can modify. It allows `logs:IntegrateWithDataset` on `arn:<partition>:logs:*:<account>:log-group:*`.
`LogGroupSelection.fromLogGroups()` allows it on `arn:<partition>:logs:*:<account>:log-group:<log group name>` for each log group, built
from the log group's name.

To forward every log group except some, keep the default and set `excludeLogGroups`:

```ts
import * as observabilityadmin from 'aws-cdk-lib/aws-observabilityadmin';

new observabilityadmin.DatasetIntegration(this, 'DatasetIntegration', {
  excludeLogGroups: observabilityadmin.LogGroupSelection.fromNamePrefixes(['/aws/lambda/test-']),
});
```

`excludeLogGroups` adds a statement to the execution role that denies `logs:IntegrateWithDataset` on the selected log groups. An explicit
deny overrides any allow (see [Policy evaluation
logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)), so an excluded log group is not
forwarded even when another statement on the role allows it, such as one added with `addToRolePolicy()`. For each log group of
`fromLogGroups()`, the statement names both `log-group:<log group name>` and `log-group:<log group name>:*`. A name prefix ends with `*`,
which matches both forms. Each excluded log group adds two ARNs to the role's policy, and [IAM limits the size of a role's
policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html), so use name prefixes for long lists.

#### Using your own execution role

Pass `role` to use an execution role that you manage. The prop accepts `iam.IRoleRef & iam.IGrantable`, so any `iam.IRole` works.

```ts
import * as iam from 'aws-cdk-lib/aws-iam';
import * as observabilityadmin from 'aws-cdk-lib/aws-observabilityadmin';

declare const role: iam.IRole;

const integration = new observabilityadmin.DatasetIntegration(this, 'DatasetIntegration', { role });
```

When you supply a role that can be modified, the construct adds the same permissions as for a role it creates: `cloudwatch:PutRecords`,
`logs:IntegrateWithDataset` for the log groups in `logGroups` (every log group in the account when you omit it), the statement that denies
it for `excludeLogGroups`, and the key statement when you set `datasetEncryptionKey`.

#### IAM role behavior

The execution role trusts `logs.amazonaws.com` on two conditions: `aws:SourceAccount` equals the stack's account, and `aws:SourceArn`
matches `arn:<partition>:observabilityadmin:*:<account>:dataset-integration/*`. The source ARN is a pattern because the integration's ARN
does not exist when the role is created. `DatasetIntegration.executionRolePrincipal()` returns this principal, so a role you define yourself
can trust the same principal. The role's identity policy holds the statements described above: `logs:IntegrateWithDataset` for `logGroups`,
the statement that denies it for `excludeLogGroups`, `cloudwatch:PutRecords`, and the key statement for `datasetEncryptionKey`. For a
supplied role that the construct cannot modify, the construct adds none of these statements, and the role must already carry them.

#### Datasets encrypted with a customer managed key

When the Dataset is encrypted with a customer managed key, pass the key as `datasetEncryptionKey`.

```ts
import * as kms from 'aws-cdk-lib/aws-kms';
import * as observabilityadmin from 'aws-cdk-lib/aws-observabilityadmin';

declare const key: kms.IKeyRef;

new observabilityadmin.DatasetIntegration(this, 'DatasetIntegration', {
  datasetEncryptionKey: key,
});
```

The construct grants the execution role access to the key that the Dataset is encrypted with. It does not change the Dataset's encryption.
The role gets `kms:Decrypt` on the key, with the two conditions from [Data encryption in CloudWatch
Omni](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-data-encryption-in-cloudwatch-omni.html):
`kms:EncryptionContext:aws:cloudwatch:arn` equal to the Dataset ARN, and `kms:ViaService` equal to `cloudwatch.<region>.amazonaws.com`.

#### Dataset integration removal and replacement

The integration uses the CloudFormation default and is deleted with the stack. Deleting the integration stops all forwarding in the account
and Region. To keep forwarding when the stack is deleted, retain the integration.

```ts
import { RemovalPolicy } from 'aws-cdk-lib';
import * as observabilityadmin from 'aws-cdk-lib/aws-observabilityadmin';

const integration = new observabilityadmin.DatasetIntegration(this, 'DatasetIntegration');
integration.applyRemovalPolicy(RemovalPolicy.RETAIN);
```

> **Warning:** An account and Region can have only one dataset integration. Creating a second one fails at deployment with a
`ConflictException`. Changing the construct ID, or moving the construct in the tree, gives the integration a new logical ID. The deployment
is then expected to fail with a conflict, because CloudFormation creates the new integration before it deletes the old one. If an
integration was created in the console, delete it before the stack creates one.

---

Ticking the box below indicates that the public API of this RFC has been signed-off by the API bar raiser (the `status/api-approved` label
was applied to the RFC pull request):

```
[ ] Signed-off by API Bar Raiser @ShadowCat567
```

---

## Public FAQ

### What are we launching today?

Eight L2 constructs, one for each CloudWatch Omni resource type that sets up sign-in, spaces, access, dashboards, alerts, and views:
`Domain`, `Space`, `AccessProfile`, `AccessGrant`, `OmniDashboard`, `Alert`, `DomainForOrganization`, and
`DomainAccessGrantForOrganization`.

We are also launching the `DatasetIntegration` L2 construct. The construct wraps `AWS::ObservabilityAdmin::DatasetIntegration`, which turns
on forwarding of logs and traces into the CloudWatch Dataset of a CloudWatch Omni space.

### Why should I use this feature?

A team that stands up CloudWatch Omni with the L1 resources writes ARNs and ids by hand, writes the roles and the key policy the service
needs, picks an encryption strategy string and a key ARN separately, and repeats the domain id and space id on every access grant. The L2
constructs take construct references instead of ids, create/update necessary roles and policy statements for convenience over L1.

For forwarding, the construct writes the execution role that CloudWatch Logs assumes, with trust conditions that name the stack's account.
That avoids the mistake where the integration deploys but forwards nothing. You manage CloudWatch Omni forwarding together with the rest of
your infrastructure.

### Why is the dashboard body JSON and not typed panel classes?

The CloudFormation resource models the body as one opaque string, and the panel format inside it is defined by the service and still
evolving. `OmniDashboardBody` is an abstract class, so once panel types are made publicly documented the typed builders can be added later
as a new kind of body without changing the `body` property.

### How does this relate to the `Dashboard` construct in `aws-cloudwatch`?

They are separate. The CloudWatch Omni dashboard is a different resource with its own body format, and it shares no widget or metric code
with the classic `Dashboard`. The classic construct, its widgets, and the metric model are unchanged. Both live in
`aws-cdk-lib/aws-cloudwatch` because both resource types are in the `AWS::CloudWatch` namespace.

### How does an alert relate to a CloudWatch alarm?

They are separate resources that share no code. A classic `Alarm` watches one metric, or a metric math expression, and acts through alarm
actions. A CloudWatch Omni `Alert` runs a SQL or PromQL query over the telemetry of a space, as an access profile, can track each row or
series of the result as a contributor with its own state, and notifies through notification rules. The classic `Alarm`, `CompositeAlarm`,
and the actions in `aws-cloudwatch-actions` are unchanged. An `Alert` is not an `IAlarm`, so it cannot be used where an alarm is expected,
such as in a composite alarm rule.

---

## Internal FAQ

### Why are we doing this?

CloudWatch Omni resources are available as CloudFormation resource types, so CDK users get L1 constructs for them. The L1s accept the
resource properties as given, which leaves several mistakes that deploy successfully and then fail later, or fail only at deploy time with
an error that is hard to trace:

- **Roles and policies the service needs.** A space needs a data-access role with a specific trust policy and permission, and a dataset
  integration needs an execution role that CloudWatch Logs can assume for the account. With the wrong trust, a space can't issue
  credentials, or an integration deploys and forwards nothing. The L2s create these roles by default and check a supplied role at synthesis.
- **Identifiers in the right form.** An access grant needs the domain id and the space id, plus a principal id whose form depends on the
  principal type: a role ARN, not a role name, and a profile id, not a profile ARN. The L2s take construct references and fill these in.
- **Ordering the service checks.** An alert is created only after its profile can be assumed and can read data. If the grants come second,
  creation fails, and the denial is cached for about two minutes. The L2s order the alert after the grants that name its profile.
- **Rules the schema doesn't express.** An alert's evaluation interval must be one of eight values, and its durations must be multiples of
  the interval. The schema accepts any integer, so a wrong value fails only at deployment. The L2s check this at synthesis.
- **Notifications that silently go nowhere.** The service publishes to an SNS topic as the CloudWatch service principal, and nothing checks
  the topic policy when the alert is created. The SNS target adds the scoped publish statement, and the KMS statement for an encrypted
  topic.
- **Data that outlives a stack.** A domain or space holds content created outside the stack, and changing a create-only property replaces it
  by deleting it first. The L2s default these resources to `RemovalPolicy.RETAIN`.

The constructs follow the order a team sets CloudWatch Omni up in: sign-in with a domain, a space for the telemetry, a dataset integration
to bring data in, access profiles and access grants for who sees what, then dashboards and alerts. For an AWS Organizations organization,
sign-in is set up once from the management account.

### Why should we *not* do this?

- **The service is new, and parts of it change often.** The panel format of a dashboard body, the alert target types and the integration
  types are all still growing. The constructs go into stable `aws-cdk-lib`, so an API that doesn't fit a later service change can be fixed
  only with a deprecation or a breaking change. The design limits this risk where it can: the dashboard body is JSON instead of typed
  panels, value sets are enum-like classes with an `of()` escape hatch, and alert targets are an interface. Some shapes are still fixed by
  this RFC, such as the props of an alert rule and the grant permissions.
- **The constructs check rules the schema doesn't express.** Examples are the allowed alert intervals, durations that must be multiples of
  the interval, and which permissions an alert principal accepts. If the service relaxes one of these rules, the construct keeps rejecting
  values the service would accept until CDK releases a fix. The checks cover only rules in the service documentation, and each has an escape
  hatch through the L1.
- **The defaults change resources on the customer's behalf.** The constructs create IAM roles, add a key-policy statement to a customer
  managed key, and add a publish statement to an alert's SNS topic. These follow CDK's usual grant behavior, and each statement is scoped to
  the account and resource. Teams that review every policy change will still see statements they didn't write.
- **It adds API surface to maintain:** nine constructs and three value models (the alert rule, the access grant permissions and the scoped
  actions), with tests and documentation that must follow the service.

### What is the technical solution (design) of this feature?

The README above describes the constructs as users see them. This section records the design behind them: where the L1s live, the facts of
each resource schema, the rules the interfaces and import methods follow, and the checks at synthesis.

#### Where the L1s live

The code generator maps the `AWS::CloudWatch` namespace to `aws-cdk-lib/aws-cloudwatch`. `CfnDomain`, `CfnSpace`, `CfnAccessProfile`,
`CfnAccessGrant`, `CfnOmniDashboard`, `CfnAlert`, `CfnDomainForOrganization`, `CfnDomainAccessGrantForOrganization` and `CfnIntegration`,
with their reference interfaces, are in that module next to `CfnDashboard` and `CfnAlarm`. `CfnDatasetIntegration` is in
`aws-cdk-lib/aws-observabilityadmin`. Each L2 is written in the same module as its L1. The L2s don't reuse the classic `IMetric`,
`Dashboard` or widget types, and this RFC proposes no L2 for `AWS::CloudWatch::Integration`.

#### Validation

The constructs check at synthesis only what the resource schemas can't express. CloudFormation validates lengths, patterns and allowed
values against the schema before deployment starts, and the service checks the rest when it creates or updates a resource. The checks are:

1. **Domains and organization domains.** `identityCenterInstance` is required when `identityProviders` lists `IdentityProvider.IDC`.
2. **Spaces.** A supplied `dataAccessRole` is checked for the trust policy and the permission that the default role carries (see [The
   space's roles](#the-spaces-roles)).
3. **Dataset integrations.** A second `DatasetIntegration` for the same account and Region in the app throws. `excludeLogGroups` must not be
   `LogGroupSelection.all()`. `LogGroupSelection.fromLogGroups()` and `fromNamePrefixes()` throw for an empty list or an empty prefix, and
   the log groups of `fromLogGroups()` must be in the stack's account and Region.
4. **Access grants.** The space's domain id must be known: from a `Space`, from a `CfnSpace`, or from `Space.fromSpaceAttributes` with a
   `domainId`. An IAM principal must be in the space's account. An `identityCenterUser` principal needs a user id, attributes, or both, and
   principal attributes are valid only with `identityCenterUser`. An `allAlerts()` principal accepts only
   `AccessGrantPermission.assumeAccessProfile`. `withScopedActions` throws on a custom permission.
5. **Alerts.** `evaluationInterval` must be 30 seconds, 1, 2, 5, 10, 15 or 30 minutes, or 1 hour. `pendingDuration` and `recoveryDuration`
   must be whole multiples of it, and every duration must be a whole number of seconds. A condition needs at least one of `warningThreshold`
   and `criticalThreshold`. The access profile must be in the same space as the alert. When the profile is defined in the app and no
   recorded grant lets alerts assume it or lets it read data, the construct adds a warning.
6. **Dashboards.** When the body has no unresolved tokens, it must parse as JSON, and its top-level `panels` member must be an array.

### Is this a breaking change?

No. The constructs are new classes added to `aws-cdk-lib/aws-cloudwatch` and `aws-cdk-lib/aws-observabilityadmin`.

### What alternative solutions did you consider?

#### One module or a separate CloudWatch Omni module

This RFC puts the CloudWatch Omni constructs in `aws-cdk-lib/aws-cloudwatch`, where the code generator places their L1s because the types
are in the `AWS::CloudWatch` namespace, and the dataset integration in `aws-cdk-lib/aws-observabilityadmin` for the same reason. A separate
module, such as `aws-cloudwatch-omni` or an experimental `@aws-cdk/aws-cloudwatch-omni-alpha` package, would keep CloudWatch Omni names
apart from the classic CloudWatch names, such as `AlertState` and `AlarmState`, and an alpha package would allow API changes while the
service changes. It would also put the L2s in a different module from their L1s, so users would import a resource's L1 and L2 from two
places.

#### Access grant facades instead of an `AccessGrant` construct

Grants could be methods on the resource being accessed, such as `space.access.read(principal)`, following the IAM grant pattern
(`bucket.grants.read(role)`). The service already models a grant as a resource with a principal and a permission, and a grant can be
imported by ARN. So an `AccessGrant` construct with `AccessGrantPrincipal` and `AccessGrantPermission` value classes covers every
combination with one API, while facades would need a method per permission level and a second way to reach L1 spaces.

#### An alert that creates its own access profile

An `Alert` could create a default access profile, with its assume and read grants, when `profile` is omitted, shared by the alerts of a
stack. That would save three resources per stack. But it would create an identity and permissions the customer never declared, each stack's
default would use one of the type-scoped alert grants a space allows, and the read grant would have to guess which data the queries need. A
single grant that lets every alert assume every profile avoids the limit, but it also covers service-managed profiles and profiles created
later. CDK has removed broad implicit defaults of this kind before, such as the default administrator role of an EKS cluster.

---
