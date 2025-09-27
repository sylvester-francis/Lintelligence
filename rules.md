# Development Rules & Guidelines

## Project Overview
This is an **Intelligent Code Review Agent** built with NestJS and TypeScript, focusing on Event-Driven Architecture and AI Integration patterns.

## Core Development Principles

### 1. TypeScript Standards
- **Strict mode enabled**: All TypeScript must use strict type checking
- **Explicit typing**: Avoid `any` types, use proper interfaces and types
- **Proper error handling**: Every function must handle potential errors
- **Decorators**: Leverage NestJS decorators for dependency injection and metadata

### 2. Architecture Patterns

#### Event-Driven Architecture
- Use GitHub webhooks as event triggers
- Implement proper event validation and security
- Design loosely coupled components that communicate via events
- Follow CQRS patterns where applicable

#### Queue-Based Processing
- All heavy processing must be asynchronous using Bull Queue
- Implement proper job retry mechanisms
- Use Redis for queue management
- Design jobs to be idempotent

#### Dependency Injection
- Use NestJS DI container for all services
- Create proper module boundaries
- Implement interface-based programming
- Use factory providers for complex object creation

### 3. Code Organization

#### Module Structure
```
src/
├── modules/           # Feature modules
│   ├── webhook/      # GitHub webhook handling
│   ├── code-analysis/ # AI-powered code analysis
│   ├── queue/        # Queue processing
│   └── github/       # GitHub API integration
├── common/           # Shared utilities
│   ├── decorators/   # Custom decorators
│   ├── guards/       # Authentication/authorization
│   ├── interfaces/   # Shared interfaces
│   └── dto/          # Data transfer objects
└── config/           # Configuration management
```

#### File Naming Conventions
- Services: `*.service.ts`
- Controllers: `*.controller.ts`
- Modules: `*.module.ts`
- Interfaces: `*.interface.ts`
- DTOs: `*.dto.ts`
- Processors: `*.processor.ts`

### 4. AI Integration Standards

#### Prompt Engineering
- Create structured prompts for different analysis types
- Implement prompt versioning and A/B testing
- Design prompts for consistent JSON output
- Include context about programming language and framework

#### Rate Limiting & Error Handling
- Implement exponential backoff for API failures
- Cache AI responses when appropriate
- Handle rate limits gracefully
- Provide fallback mechanisms for AI service unavailability

### 5. Security Requirements

#### Webhook Security
- Validate GitHub webhook signatures
- Use environment variables for all secrets
- Implement request rate limiting
- Log security events for monitoring

#### API Security
- Secure all API endpoints with proper authentication
- Validate all input data using DTOs
- Implement CORS policies
- Use HTTPS in production

### 6. Testing Strategy

#### Unit Testing
- Test coverage minimum: 80%
- Mock external dependencies (GitHub API, AI services)
- Test error scenarios and edge cases
- Use Jest with NestJS testing utilities

#### Integration Testing
- Test webhook endpoint with real GitHub payloads
- Test queue processing with actual jobs
- Test database operations with test database
- Mock AI services for consistent testing

#### E2E Testing
- Test complete workflow from webhook to GitHub comment
- Test failure scenarios and recovery
- Performance testing for queue processing
- Load testing for webhook endpoints

### 7. Performance Guidelines

#### Queue Processing
- Batch similar operations when possible
- Implement circuit breakers for external services
- Monitor queue health and processing times
- Scale processors based on queue depth

#### Database Operations
- Use proper indexing for query performance
- Implement connection pooling
- Use transactions for multi-step operations
- Monitor slow queries and optimize

#### Caching Strategy
- Cache AI analysis results for identical code
- Cache GitHub API responses when appropriate
- Use Redis for distributed caching
- Implement cache invalidation strategies

### 8. Monitoring & Observability

#### Logging
- Use structured logging (JSON format)
- Include correlation IDs for request tracking
- Log all webhook events and processing status
- Implement log levels (DEBUG, INFO, WARN, ERROR)

#### Metrics
- Track webhook processing times
- Monitor queue depth and processing rates
- Measure AI service response times
- Track error rates and types

#### Health Checks
- Implement health endpoints for all services
- Monitor external service connectivity
- Check database connection status
- Verify queue processing health

### 9. Deployment & DevOps

#### Docker Standards
- Multi-stage builds for optimization
- Non-root user execution
- Proper health check implementations
- Environment-specific configurations

#### Environment Management
- Separate configs for dev, staging, production
- Use environment variables for all configuration
- Implement configuration validation
- Secure secret management

### 10. Code Quality

#### Code Review Standards
- All code must be reviewed before merging
- Check for proper error handling
- Verify test coverage and quality
- Ensure documentation is updated

#### Automated Quality Checks
- ESLint for code style enforcement
- Prettier for code formatting
- Husky for pre-commit hooks
- SonarQube for code quality analysis

## Development Workflow

### 1. Feature Development
1. Create feature branch from main
2. Implement feature with proper tests
3. Update documentation if needed
4. Run all quality checks locally
5. Create pull request with description
6. Address review feedback
7. Merge after approval

### 2. Bug Fixes
1. Reproduce bug with test case
2. Implement fix with proper testing
3. Verify fix doesn't break existing functionality
4. Update monitoring if needed
5. Deploy with careful monitoring

### 3. Performance Optimization
1. Identify bottlenecks with profiling
2. Implement optimization with benchmarks
3. Verify improvement with load testing
4. Monitor production performance
5. Document optimization strategies

## AI Agent Guidelines

When implementing AI agents for code review:

### 1. Analysis Types
- **Security Review**: Check for vulnerabilities and security issues
- **Performance Review**: Identify performance bottlenecks
- **Code Quality**: Review for maintainability and best practices
- **Style Review**: Check for coding standard compliance

### 2. Output Format
- Structured JSON responses
- Severity levels (INFO, WARNING, ERROR)
- Line-specific feedback when possible
- Actionable improvement suggestions

### 3. Context Awareness
- Consider the programming language
- Understand the framework being used
- Account for project-specific patterns
- Respect existing code style

## Continuous Improvement

- Regular retrospectives on development process
- Performance monitoring and optimization
- Security audit and updates
- Technology stack evaluation and updates
- Knowledge sharing and documentation updates