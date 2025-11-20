# RFC Writing Guide

This guide provides best practices for writing high-quality AWS CDK RFCs based on analysis of successful and unsuccessful RFCs.

## Start with Working Backwards

The working backwards section is the most important part of your RFC. It should read like documentation for a feature that already exists.

**Write the README first**: Create comprehensive user documentation as if the feature is already shipped. Include installation instructions, basic usage, advanced scenarios, and API reference.

**Include CHANGELOG entries**: Write the release notes customers will see. Use conventional commit format: `feat(service): add L2 constructs for ServiceName`

**Provide complete examples**: Show realistic usage patterns with full, runnable code samples. Cover simple to complex scenarios.

**Cover all languages**: Include examples for TypeScript, Python, Java, C#, and Go where applicable.

## Technical Design Requirements

Provide comprehensive technical depth appropriate to the feature complexity.

**Deep technical detail**: Include algorithms, data structures, implementation specifics, and architectural patterns. Don't be vague.

**Edge case analysis**: Consider failure modes, error scenarios, boundary conditions, and how the system behaves under stress.

**Formal definitions**: Use mathematical notation, pseudocode, or state diagrams where appropriate to clarify complex behavior.

**Architecture diagrams**: Visual representations of complex systems, component interactions, and data flows.

## API Design Excellence

**Complete interfaces**: Define all methods, properties, type signatures, and return types. Show the full contract.

**Inheritance hierarchies**: Clearly show class relationships, abstractions, and how components compose together.

**Consistent patterns**: Follow existing CDK conventions, naming schemes, and design patterns. Don't invent new patterns without justification.

**Extensibility**: Design for future enhancements and backward compatibility. Consider how users will extend your constructs.

## Implementation Planning

**Phased approach**: Break large features into manageable, deliverable phases with clear milestones.

**Concrete tasks**: List specific implementation steps with owners, timelines, and dependencies.

**Migration strategy**: For breaking changes, provide detailed upgrade paths and compatibility plans.

**Testing strategy**: Define unit tests, integration tests, and how the feature will be validated.

## Alternatives and Trade-offs

**Multiple approaches**: Consider at least 2-3 different design alternatives. Show you've explored the solution space.

**Clear rationale**: Explain why the chosen approach is superior with specific reasoning.

**Trade-off analysis**: Document pros and cons of each alternative honestly.

**Future considerations**: Note what options remain open for later enhancements.

## Common Pitfalls to Avoid

### Content Issues

- **Too brief**: RFCs under 5 pages for complex features lack necessary detail
- **Missing examples**: Abstract descriptions without concrete usage patterns
- **Incomplete APIs**: Vague method signatures or missing type definitions
- **No error handling**: Ignoring failure scenarios and edge cases
- **Vendor-in dependencies**: Copying code instead of proper dependency management

### Process Issues

- **Skipping API Bar Raiser**: Not getting required sign-off before implementation
- **Incomplete templates**: Leaving sections as placeholders or "TBD"
- **Missing tracking**: Not linking to GitHub issues or maintaining status
- **Poor formatting**: Inconsistent markdown, broken links, or unclear structure

### Technical Issues

- **Breaking CDK patterns**: Inconsistent with existing construct library conventions
- **Security oversights**: Missing IAM considerations or cross-account scenarios
- **Performance blindness**: Not considering scalability or resource usage
- **Integration gaps**: Failing to consider interaction with existing features

## RFC Structure Template

### 1. Summary and Motivation

- Clear problem statement with customer impact
- Scope definition and success criteria
- Background context and current limitations

### 2. Working Backwards

- Complete README documentation
- CHANGELOG entries
- User experience walkthrough
- Code examples in multiple languages

### 3. Technical Design

- Architecture overview with diagrams
- Detailed implementation approach
- Data structures and algorithms
- Error handling and edge cases

### 4. API Design

- Complete interface definitions
- Method signatures and type information
- Usage patterns and examples
- Backward compatibility considerations

### 5. Implementation Plan

- Phased delivery approach
- Concrete tasks and milestones
- Testing and validation strategy
- Migration and rollout plan

### 6. Alternatives Considered

- Multiple design approaches
- Trade-off analysis
- Rationale for chosen solution
- Future enhancement possibilities

## Quality Checklist

Before submitting your RFC:

- [ ] Working backwards section reads like actual user documentation
- [ ] Technical design includes sufficient detail for implementation
- [ ] API design follows CDK patterns and conventions
- [ ] Implementation plan is concrete and realistic
- [ ] Alternatives analysis shows thorough consideration
- [ ] All code examples are complete and functional
- [ ] Security and performance implications addressed
- [ ] Migration strategy provided for breaking changes
- [ ] API Bar Raiser identified and engaged
- [ ] All template sections completed (no placeholders)

## Examples of Excellence

Study these high-quality RFCs for inspiration:

- **RFC 162 (Refactoring Support)**: Exceptional technical depth with formal definitions and comprehensive appendices
- **RFC 49 (Continuous Delivery)**: Complete end-to-end solution with security model and migration strategy
- **RFC 431 (SageMaker L2)**: Excellent API design with clear abstractions and future extensibility
- **RFC 340 (Firehose L2)**: Comprehensive feature coverage with multiple destinations and thorough alternatives analysis

## Final Tips

1. **Start with the User**: Always begin with the working backwards section
2. **Be Comprehensive**: Better to over-document than under-document
3. **Use Real Examples**: Provide practical, runnable code samples
4. **Plan Implementation**: Think through how you'll actually build this
5. **Consider Alternatives**: Show you've thought about different approaches
6. **Get Feedback Early**: Share drafts with colleagues before formal review
7. **Iterate**: Be prepared to revise based on feedback
8. **Focus on Quality**: High-impact features deserve high-quality RFCs
