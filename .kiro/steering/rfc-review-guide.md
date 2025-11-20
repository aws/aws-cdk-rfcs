# RFC Review Guide

This guide provides criteria and best practices for reviewing AWS CDK RFCs effectively.

## Quality Indicators for Good RFCs

### Essential Components

**Working Backwards**: Comprehensive user experience documentation with concrete examples, README sections, and CHANGELOG entries. This should read like actual product documentation.

**Technical Depth**: Detailed algorithms, edge cases, implementation specifics, and formal definitions. The RFC should provide enough detail to implement the feature.

**API Design**: Clear interfaces, proper abstractions, inheritance hierarchies, and complete method signatures. APIs should follow CDK patterns and be extensible.

**Implementation Planning**: Phased approach with concrete tasks, timelines, and migration strategies. The plan should be realistic and actionable.

**Alternatives Analysis**: Thorough consideration of different approaches with trade-offs and rationale. Show that multiple solutions were explored.

### Structure and Documentation

**Clear Problem Statement**: Well-defined motivation, scope, and customer impact. Why does this feature matter?

**Comprehensive Examples**: Multiple use cases with complete code samples in all supported languages. Examples should be realistic and runnable.

**Migration Strategy**: For breaking changes, detailed upgrade paths and compatibility plans. How will existing users adopt this?

**Security Considerations**: Proper handling of permissions, cross-account scenarios, and IAM policies. Security should not be an afterthought.

**Extensibility**: Future-proofing, enhancement considerations, and backward compatibility. How will this evolve?

## Red Flags for Poor RFCs

**Brevity Without Substance**: Too short for the complexity of the feature (under 5 pages for complex features). Lack of detail indicates insufficient thinking.

**Missing Working Backwards**: No user experience documentation or README sections. Without this, the RFC is just a technical spec.

**Incomplete API Design**: Vague interfaces, missing method signatures, or unclear abstractions. APIs should be fully specified.

**No Implementation Plan**: Lack of concrete next steps or phased approach. How will this actually get built?

**Missing Alternatives**: No consideration of other approaches or design decisions. Was this the only option explored?

**Unsigned API Bar Raiser**: Missing required sign-off from designated reviewer. Process compliance matters.

## Review Checklist

### Content Quality

- [ ] Working backwards section with realistic examples and README content
- [ ] Detailed technical implementation approach with algorithms and data structures
- [ ] Comprehensive API documentation with complete type definitions
- [ ] Implementation plan with phases, tasks, and concrete deliverables
- [ ] Analysis of alternatives with clear trade-offs and decision rationale
- [ ] Security, compatibility, and performance considerations addressed

### Process Compliance

- [ ] API Bar Raiser assigned and signed off (status/api-approved label)
- [ ] Proper RFC template structure followed with all sections
- [ ] All required sections completed (not just placeholders)
- [ ] Tracking issue properly linked and maintained
- [ ] Appropriate labels applied throughout lifecycle

### Technical Review

- [ ] API design follows CDK patterns and conventions
- [ ] Breaking changes properly handled with migration paths
- [ ] Edge cases, error scenarios, and failure modes addressed
- [ ] Performance, scalability, and resource usage considerations
- [ ] Integration with existing CDK features and constructs

## Review Process

### Before Reviewing

1. Check if RFC has API Bar Raiser sign-off requirement
2. Verify RFC follows the template structure
3. Ensure tracking issue is properly linked

### During Review

**Completeness Check**: All required sections present, working backwards artifacts included, technical solution documented, implementation plan provided.

**Quality Assessment**: Technical depth appropriate for complexity, examples are practical and realistic, API design is consistent and extensible, error handling and edge cases considered.

**Feasibility Review**: Implementation approach is realistic, dependencies and prerequisites identified, timeline and resource requirements reasonable, breaking change impact assessed.

### Questions to Ask

1. Does this RFC solve a real customer problem?
2. Is the proposed API intuitive and consistent with CDK patterns?
3. Are the examples realistic and comprehensive?
4. Is the implementation approach feasible and well-planned?
5. Have alternatives been properly considered?
6. Are breaking changes properly justified and documented?
7. Is the technical depth appropriate for the feature complexity?

## Review Feedback Guidelines

### Constructive Feedback

- Ask for specific examples when concepts are unclear or abstract
- Request detailed implementation for complex features and algorithms
- Suggest alternative approaches with clear reasoning and trade-offs
- Point out missing edge cases, error scenarios, or failure modes
- Recommend improvements to API ergonomics and developer experience

### What to Look For

**In Working Backwards**: Does it read like real documentation? Are examples complete and realistic? Would a customer understand how to use this?

**In Technical Design**: Is there enough detail to implement? Are edge cases covered? Are algorithms and data structures specified?

**In API Design**: Is it consistent with CDK patterns? Is it extensible? Are all methods and properties documented?

**In Implementation Plan**: Is it realistic? Are phases clearly defined? Are dependencies identified?

**In Alternatives**: Were multiple approaches considered? Is the rationale clear? Are trade-offs honestly assessed?

## Approval Criteria

### Must Have

- Complete working backwards documentation
- Comprehensive technical solution
- Realistic implementation plan
- API Bar Raiser sign-off (if required)
- Proper consideration of alternatives

### Should Have

- Multiple practical examples
- Detailed API documentation
- Error handling strategy
- Migration/compatibility plan
- Performance considerations

### Nice to Have

- Formal mathematical definitions
- Comprehensive appendices
- Advanced use case coverage
- Integration with other services

## Common Issues and Solutions

**Issue: Incomplete Working Backwards**
Solution: Request comprehensive README with multiple examples and use cases

**Issue: Insufficient Technical Depth**
Solution: Ask for detailed implementation approach, algorithms, and edge case handling

**Issue: Poor API Design**
Solution: Review for consistency, extensibility, and CDK patterns compliance

**Issue: Missing Implementation Plan**
Solution: Require phased approach with concrete tasks and timelines

**Issue: No Alternative Analysis**
Solution: Request comparison of different approaches with trade-offs

## Examples to Study

### Excellent RFCs

- **RFC 162 (Refactoring Support)**: Exceptional technical depth with formal definitions
- **RFC 49 (Continuous Delivery)**: Comprehensive end-to-end solution with security model
- **RFC 431 (SageMaker L2)**: Excellent API design with clear abstractions
- **RFC 340 (Firehose L2)**: Comprehensive feature coverage with thorough alternatives

### Poor RFCs to Avoid

- **RFC 95 (Cognito)**: Extremely brief, no working backwards, missing technical details
- **RFC 359 (Construct Hub Deny List)**: Very short, lacks comprehensive coverage
- **RFC 670/673 (Application Signals)**: Incomplete, not signed off, limited examples

## Final Recommendations

1. **Be Thorough**: Don't approve RFCs that lack essential details
2. **Focus on User Experience**: Ensure working backwards truly represents customer value
3. **Demand Quality**: High-impact features require high-quality documentation
4. **Consider Maintainability**: Evaluate long-term support and evolution
5. **Validate Feasibility**: Ensure implementation approach is realistic and well-planned
6. **Check Process**: Verify API Bar Raiser sign-off and proper labels
7. **Think Long-term**: Consider how this will evolve and integrate with future features
