## Description

This RFC proposes the introduction of a formal policy in the AWS Cloud Development Kit (CDK) for discontinuing support of Node.js versions
six months after the Node.js community [officially](https://github.com/nodejs/Release#release-schedule) designates them as End-of-Life (EOL).
This ensures users have ample transition time and that the AWS CDK remains aligned with actively supported, secure Node.js releases.

## What is covered under this RFC

### The following falls under this RFC

* AWS CDK CLI
* AWS CDK Construct Library
* JSII
* Projen
* CDK8s

### The following does not fall under this RFC

* AWS Lambda Runtimes
* Custom Resource Lambda Functions managed by the CDK team

## Motivation

* Security & Stability: When Node.js versions reach EOL, they no longer receive critical security patches or bug fixes from the Node.js community.
  Continuing to support them imposes security risks and technical overhead.
* Focus on Innovation: By trimming support for EOL Node.js versions, the AWS CDK can rely on modern Node.js features and improvements that benefit
  the developer community.
* Consistency & Predictability: Providing a clear, consistent policy for when Node.js versions lose AWS CDK support allows customers to plan
  upgrades confidently and reduces confusion around "how long will CDK support version X?"

## Background

The AWS CDK is dropping support for Node.js 14.x and 16.x on May 30, 2025. These versions went EOL on:

* Node.js 14.x EOL: 2023-04-30
* Node.js 16.x EOL: 2023-09-11

Separately:

* Node.js 18.x EOL: 2025-05-30 (per the Node.js working group's schedule), and the AWS CDK support will end 2025-11-30.

In this proposal, we formalize a policy for all Node.js versions going forward.

## Policy Proposal

1. Policy Statement
   The AWS CDK will discontinue official support for any Node.js version six months after that version has reached End-of-Life according
   to [the Node.js Release working group schedule](https://github.com/nodejs/Release#release-schedule).
2. Effective Date
   1. This policy is effective immediately upon approval and applies to all future Node.js LTS and non-LTS releases.
   2. Practically, support for Node.js 14.x and 16.x has already ended (announced for May 30, 2025, but both versions are beyond
      Node's official EOL as of this writing).
   3. For Node.js 18.x (which has an EOL date of 2025-05-30), the AWS CDK support will end 2025-11-30.
3. What Does "No Longer Supported" Mean
   1. Bug Reports: Issues will not be triaged or resolved unless they can be reproduced on a supported version of Node.js.
   2. Security Fixes: The AWS CDK will not implement or backport security patches for versions of Node.js beyond their 6-month grace period.
   3. Compatibility Testing: The AWS CDK team will discontinue testing with those versions in CI/CD pipelines, meaning we cannot guarantee
      the functionality of the AWS CDK on those runtimes.
4. Transition Period
   1. The six months after Node's official EOL date is considered a "transition period". During that time:
      1. We will accept bug reports and work on fixes for the soon-to-be-deprecated version.
         1. Depending on scope of work however, we may ask that you update to an LTS version.
      2. We will produce announcements when possible to give users notice.
5. Announcement & Documentation
   1. Official announcements of upcoming deprecations will be published at least 1 month before the EOL + six month cutoff.
   2. The AWS CDK documentation will contain a "Node.js Version Support" section, listing currently supported versions and their end-of-support dates.

## Rationale and Alternatives

* Alternative: Immediate Deprecation on Node.js EOL
  * Some communities drop support the day a Node.js version hits EOL. However, this may leave customers with insufficient lead time to migrate.
    Hence, we prefer a six month grace period.
* Alternative: Longer Grace Period
  * A year or more might be more generous but burdens the AWS CDK team with supporting potentially insecure or outdated runtimes. Six months
    is a balanced, industry-friendly period (see [AWS SDK support for Node.JS](https://aws.amazon.com/blogs/developer/announcing-the-end-of-support-for-node-js-16-x-in-the-aws-sdk-for-javascript-v3/))
* Alternative: Stick to "Best-Effort"
  * The AWS CDK could rely on "best-effort" support without a formal policy, but that ambiguity complicates planning for customers who need
    a known end date.

## Implementation Plan

1. Documentation Updates
   1. Update the AWS CDK Developer Guide to reflect the new support policy and current Node.js version status.
   2. Publish a schedule table showing upcoming Node.js EOL dates and the corresponding AWS CDK "end-of-support" dates.
2. Tooling
   1. In the AWS CDK CLI, we will print a warning if the user's Node.js runtime is in the 6-month transition period or already past AWS CDK support.
3. Communication
   1. Post announcements in the AWS CDK GitHub repository, AWS forums, and relevant community channels.
   2. Encourage early adopters to test newer Node.js releases while still under transition.
4. Maintenance
   1. Track Node.js EOL dates in an internal schedule.
   2. Every six months, or as new EOL dates come up, update the official support matrix.

## Security Implications

* Dropping support for EOL Node.js versions reduces the attack surface inherent in using outdated runtimes that do not receive security patches.
* Encouraging customers to adopt newer Node.js versions increases overall security posture for AWS CDK-based solutions.

## Drawbacks

* Some users on older Node.js versions may need to perform an unplanned or expedited upgrade if they were unaware of the Node.js EOL schedule.
* There is a small maintenance overhead in tracking Node.js releases and updating documentation,
though we deem it acceptable for security and predictability benefits.

## Adoption Strategy

* Most AWS CDK users who stay on current LTS releases will remain unaffected by this policy.
* Users on older Node.js versions are encouraged to upgrade as soon as possible to avoid issues and missed security patches.

## Conclusion

This RFC seeks to introduce a formal Node.js version support policy for AWS CDK, which is for the AWS CDK to stop supporting a Node.js version
six months after that version's official EOL date. This provides a predictable, security-forward posture that balances end-user needs for
stability with the AWS CDK's continued modernization.

Feedback is welcome! If you have any questions or concerns, please comment on this issue and if needed we can refine the proposal.
