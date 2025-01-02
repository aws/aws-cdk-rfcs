# CDK Contributor Council Charter (RFC) — November, 2024

## Purpose of the Council

To improve visibility into CDK, increase feedback opportunities, and build a stronger, more inclusive community, the AWS CDK team proposes forming a Contributor Council.

*Original Author(s)*: [@haubles](https://github.com/haubles), [@billfine](https://github.com/billfine)

*Tracking Issue*: https://github.com/aws/aws-cdk-rfcs/issues/676

## Principles guiding this RFC

1. **Maintain AWS supportability.** In order for AWS to provide on-call resources tasked with resolving high-impact bugs or issues in CDK for customers and the community, AWS must ensure that its standards for processes—for example, security reviews—are met. Therefore, AWS controls the CDK release process.  
2. **Increase community influence**. The community’s input and active engagement is essential for the long-term health and success of the CDK project. Therefore, AWS is committed to creating more robust and clearly-defined channels for soliciting community feedback, and acting on that feedback. We are committed to increasing opportunities and building new processes for accepting more community contributions to the codebase.  
3. **Provide visibility into AWS-led initiatives.** We will provide the CDK’s community with visibility into our roadmap and AWS-led contributions. We will give the community a voice and a hand in our decision-making processes. We must communicate our roadmaps, plans, and decisions openly and promptly, and deliver on them consistently, for the long-term success of CDK. 

## Decision-making by the Council

The Council will meet monthly to start, but may increase or decrease meeting frequency at its discretion. Similarly, the length of the meetings will be determined by the Council and can be increased or decreased at the Council’s discretion. We anticipate Council members will spend less than 5 hours a month on Council activities.

Portions of the sessions will be recorded and published to YouTube. Discussion topics under a Non-Disclosure Agreement (NDA) will be redacted from the recording before it is published.

#### The Council meetings include two sections:

(1) Town hall

* The AWS CDK team will report on project release priorities and the status of AWS-led features in each Council meeting. Council members will have an opportunity to ask questions and deliver feedback.  
* Community representatives will report on news and share updates on community-led features. Council members will have an opportunity to ask questions and deliver feedback.

(2) New proposals

* The Council will review and debate RFCs/features, feature docs, or new processes brought forth by the CDK community and AWS. AWS may not be able to report on all AWS-led projects when we are bound by legal requirements, customer agreements, or when it would put AWS at a competitive disadvantage to report on some project.   
* Anyone in the CDK community may propose topics for discussion by the Council. The agenda is finalized one week before each meeting to allow time for pre-reading and preparation. Proposers are invited to the meeting to present and advocate for their change. If they are unable to attend, their attendance is not required for the Council to make a decision.  
* The Council discusses the change’s appropriateness, merits, scope of work, and whether the change can be community-led or if it will be built by internal Amazon resources.  
* Decisions are completed and recorded through the following mechanism:   
  * Each Council member enters an opinion on whether the feature is viable including a short explanation. The opinions and reasons behind them are recorded on the change proposal. Opinion submissions follow the [Chatham House Rule](https://www.ibabs.com/en/glossary/chatham-house-rule/#:~:text=The%20Chatham%20House%20Rule%20reads,') by default, though Council members may choose to sign them.  
  * If the change is deemed appropriate for inclusion in CDK by the Council, the AWS CDK Product team decides whether the feature will be built by AWS and adds it to their feature backlog, or if the feature will be offered to the community for implementation.  
  * If a change is deemed to be appropriate for community-led development, the label 'open-for-community-contribution' will be added to the feature request.  
  * It is preferred that community-led features are code-reviewed by a [Distinguished Contributor](https://github.com/aws/aws-cdk/blob/main/CONTRIBUTING.md#badges-pilot-program) before AWS reviews them.   
    * If a Distinguished Contributor is not available within 30 days, AWS will review.  
    * The feature needs to adhere to all AWS development and security processes, which AWS will publish on the CDK GitHub. AWS is committed to providing all the required resources for timely reviews and merging.  
    * Those who build a feature through to completion are recognized in a manner to be determined.

## Structure of the Council

The Council is led by two Chairpersons. They do not submit opinions in the decision-making process:

* One Co-Chair and the facilitator of Council sessions will come from the AWS Open Source Strategy & Marketing (OSSM) team.  
* The other Co-Chair is the AWS CDK Product Lead. They set the priorities for AWS resources, but do not have veto power over what the community can or can’t work on.

Amazon will have five permanent members on the Council, which AWS may rotate as necessary. They will represent various AWS teams with vested interests in CDK to bring a multiplicity of viewpoints and experiences to Council debate (Engineering, Support, OSSM).

The community will have five elected members on the Council. 

* The community representatives will be nominated and chosen by the CDK community through a public, time-constrained mechanism which permits transparency into the mechanism and allows the community to self-identify—and make an informed decision about—people who are actively looking to make deeper investment into CDK.  
* In order to participate in the full-breadth of conversation related to CDK and the project’s roadmap, Council members will be required to sign an NDA.  
* The five elected community representatives serve one-year terms. There is no limit to the number of subsequent terms a Council member may serve. Depending on community input, the AWS CDK team may decide to allocate a certain number of Council seats to specific community groups, such as the Open Construct Foundation, or Enterprise Customers. The rest of the seats would be undesignated.  
* We expect Council members to regularly attend Council meetings. If a Council member has two unannounced absences in a row, they will be removed and the Council will decide how to replace them.

## First priority of the Council

After the Council is elected, our desire is for the Council to immediately get to work evolving CDK. Their first tasks may include but are not limited to: 

* Co-definition of the Council (new processes, working groups, etc.)  
* Contributing to the AWS CDK roadmap  
* Building a prioritized list of proposed changes for debate

# FAQ

## What are we launching today?

Today, AWS announces the formation of a Contributor Council, which will serve as a trusted advisor to AWS on CDK’s vision, direction, and day-to-day maintenance/management. It marks our first step toward greater engagement and transparency with the entire community on project strategy and operations. 

This RFC also kicks off a period of community input about the Council and its Charter, which will last for 30 days. On February 10, 2025, we will incorporate the feedback and ratify the Charter by merging it to the CDK repository.

We encourage commenters to build on similar ideas and \+1 feedback from others, to help AWS understand an idea’s overall importance to the community. 

We are also sharing our desire to partner with community members and organizations like the Open Constructs Foundation (OCF) to form working groups.

We envision these working groups as mechanisms for building alongside and in mutual benefit for the entire community. We suggest, but are not limited or tied to, several areas of interest: Distinguished Contributors, community-led constructs, community rewards, and/or events (summits, bug bashes, CDK Day, et cetera). 

If you are interested in joining a working group, or have an idea for one not listed here, please fill out this [form](https://github.com/aws/aws-cdk-rfcs/issues/new?assignees=&labels=working-group-suggestion%2Cneeds-review&projects=&template=committee-suggestion.yml&title=%5BWorking+Group+Suggestion%5D%3A+).

## Why should I participate in the Contributor Council?

The CDK Contributor Council provides an opportunity for community-elected representatives to provide input to and directly influence the AWS decision-making process.

Council members will also gain firsthand knowledge and participatory experience with AWS mechanisms and culture by working alongside AWS CDK Engineering & Support teams.

The entire community will gain more visibility into the AWS CDK team’s project roadmap and decision-making process through the Council’s open sessions.

We are not currently planning on but are open to extending additional responsibilities and/or privileges to Council members such as triage rights, tagging, labeling, etc.

## Why are we doing this?

AWS is committed to implementing changes that empower the community to build alongside our teams. We believe that bringing the community into our processes will help sustain the project, and open more doors for contributions to the codebase. 

We think the CDK project will benefit with more open, clearly-defined channels for information and feedback to flow between AWS, CDK’s contributors, and its users. 

We know the community has valuable insight into how CDK can evolve, so we want to build a stronger connection to the community, with a direct channel to get their feedback.

## Why should we *not* do this? What alternative solutions did you consider

The Contributor Council is one aspect of the investments AWS is making into CDK. In terms of improving community engagement and feedback mechanisms, AWS considered three other options for evolving the project.

* **Change nothing.** With this approach, we would continue to work on improving mechanisms, building transparency, feature prioritization, and creating a modern roadmap for CDK. Despite our continued commitment to the mission of the AWS CDK and though we would strive to do the right thing for our customers and the community, we decided that this approach may not bring enough meaningful change to the mechanisms that define how we work with the community.   
* **Transition to product.** Another approach we considered was transitioning the project to a product, making it internally owned and managed. The team would continue to remain dedicated to supporting the service and prioritizing feature and bug work, but the community would need to go through more traditional mechanisms to interact with the team, slowing down the feedback loop. We felt that this would have created more barriers between us and the community, and further removed transparency. Ultimately, this would not achieve what we wanted.  
* **Transition to community led.** Another approach we considered was adopting a fully community-led governance model. In this approach, AWS would implement a governance model without corporate sponsorship or oversight, and discontinue offering on-call support resources. In this eventuality, we may have reduced the engineering resources assigned to CDK. We decided against this approach, because we believe the community ultimately does want to control CDK at the cost of the benefits AWS-controlled releases processes provide.

We also considered that the community may not feel that this Council and its Charter go far enough in opening up CDK for contributions and community engagement. However, given the security and supportability terms required by the customer agreements we hold with CDK users, it is important that we make careful and deliberate decisions as we open up our internal processes and roadmaps for community engagement. We look forward to working alongside the community as we take additional steps in the future.

## What does this mean for Projen? CDK8s?

The Contributor Council’s remit does not include Projen or CDK8s at this time. Currently, the AWS CDK team is conducting research and soliciting customer feedback about those projects, and plans to determine next steps based on those inputs. If you are interested in or have ideas about Projen or CDK8s, please feel free to share it on the tracking issue for this RFC. 

## What is the high-level project plan?

Timing and processes are to be determined alongside the community, and are subject to change as we learn and build together.

#### Phase One — Community Input

* This RFC PR kicks off a 30-day period of community input.   
* Community input will be gathered from this PR, the [TRACKING-ISSUE](https://github.com/aws/aws-cdk-rfcs/issues/676), and the [Working Group Interest Form](https://github.com/aws/aws-cdk-rfcs/issues/new?assignees=&labels=working-group-suggestion%2Cneeds-review&projects=&template=committee-suggestion.yml&title=%5BWorking+Group+Suggestion%5D%3A+).   
* After 30 days, the AWS CDK team will incorporate community input into CONTRIBUTOR-COUNCIL-CHARTER.md.   
* The Charter will be considered ratified upon merging CONTRIBUTOR-COUNCIL-CHARTER.md into the CDK repository.

#### Phase Two — Contributor Council Elections

* Upon ratification, the AWS OSSM team will begin the process of soliciting representative nominations from the community. The AWS CDK team will select representatives from within AWS/Amazon.   
* The exact process and the nomination/voting tooling will be determined with input from the community alongside the community input period.   
* We plan to complete the nomination and voting period by February 28, 2025\.

#### Phase Three — First Contributor Council Open Session

* Once the Contributor Council Elections are complete, we will begin scheduling and planning the first Contributor Council session.  
* We expect to hold the first Contributor Council meeting in early March, 2025\. Sessions will be held on a monthly basis (subject to change, per the Working Group).  
* The Council meetings will be recorded and posted on YouTube, along with links to any additional materials or action items stemming from sessions. Some portions of the recording and/or materials may be redacted, if a topic discussed is covered by an NDA.

#### Phase Four — Test and Iterate

* The Council will build, document, test, and iterate on its processes with input from the community.  
* The AWS CDK team will monitor the Council’s impact and the community’s sentiments about it. After a year, the Council may choose to alter or disband itself.

## What does success look like?

The Council’s ability to succeed is dependent on the community’s continued interest in participating as Council members and as engaged constituents. So, the AWS CDK team will measure the Council’s success on interest and participation in the election process, viewership and engagement with the Council meeting materials, and participation in working groups. The Council’s success is ultimately the project’s success, so the AWS CDK team will also monitor project health metrics around the RFC process, contributions, and issues that signal the Council’s success.

#### Examples

* Number of nominees in first and second election, percent of contributors that vote  
* Number of working groups formed, participation, and the success of their activities  
* Views and comments on tracking issue, clicks-through to RFC from blog and social media  
* Number of repeat contributors, number of community-led RFCs build, issues remedied
