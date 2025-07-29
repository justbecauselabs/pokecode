# Claude Code Flow Documentation

This guide explains how to use Claude Code effectively with the Claude Code Mobile backend codebase, including best practices, common workflows, and AI-assisted development patterns.

## Overview

Claude Code is optimized for helping you with:
- **Code Generation**: Creating new features, routes, and services
- **Code Review**: Analyzing existing code for improvements
- **Refactoring**: Restructuring code while maintaining functionality
- **Debugging**: Finding and fixing issues
- **Documentation**: Generating and updating documentation
- **Testing**: Writing comprehensive test suites

## Effective Prompting Strategies

### Be Specific and Contextual

```
❌ Bad: "Add authentication"

✅ Good: "Add JWT refresh token rotation to the auth service. When a refresh token is used, generate a new one and invalidate the old one. Update the auth routes to handle this flow."
```

### Provide File Context

```
❌ Bad: "Fix the user service"

✅ Good: "In /src/services/user.service.ts, the updateUser function doesn't validate if the user exists before updating. Add proper existence check and error handling."
```

### Include Expected Behavior

```
✅ Good: "Create a rate limiting middleware that:
- Limits requests to 100 per minute per IP
- Uses Redis for distributed rate limiting
- Returns 429 with retry-after header
- Excludes health check endpoints"
```

## Common Development Workflows

### 1. Creating a New Feature

**Prompt Pattern**:
```
Create a new feature for [feature name] that includes:
1. Database schema in /src/db/schema/[name].ts
2. Service layer in /src/services/[name].service.ts
3. API routes in /src/routes/[name].ts
4. Tests in /tests/unit/services/[name].test.ts
5. Update the main app.ts to register the routes

The feature should [describe functionality]
```

**Example**:
```
Create a new feature for API keys that includes:
1. Database schema for storing user API keys
2. Service for generating, validating, and revoking keys
3. Routes for CRUD operations on API keys
4. Unit tests for the service
5. Integration with existing auth system

API keys should have expiration dates and usage limits.
```

### 2. Debugging and Error Analysis

**Prompt Pattern**:
```
I'm getting this error in [file path]:
[paste error message]

The code that's failing:
[paste relevant code]

Help me understand why this is happening and how to fix it.
```

**Example**:
```
I'm getting this error in /src/routes/sessions/stream.ts:
"TypeError: Cannot read property 'write' of undefined"

The code that's failing:
```typescript
reply.raw.write(`data: ${JSON.stringify(message)}\n\n`);
```

This happens when trying to send SSE events. Help me fix the response handling.
```

### 3. Code Review and Optimization

**Prompt Pattern**:
```
Review the [component name] in [file path] for:
- Performance optimizations
- Security vulnerabilities
- Best practices adherence
- Type safety improvements
- Error handling gaps

Suggest specific improvements with code examples.
```

**Example**:
```
Review the session service in /src/services/session.service.ts for:
- N+1 query problems
- Missing transaction handling
- Potential race conditions
- Memory leaks in streaming responses
- Better error messages

Focus on database query optimization.
```

### 4. Test Generation

**Prompt Pattern**:
```
Generate comprehensive tests for [file path] that covers:
- Happy path scenarios
- Error cases
- Edge cases
- Integration with [dependencies]

Use Vitest with proper mocking of external dependencies.
```

**Example**:
```
Generate comprehensive tests for /src/services/auth.service.ts that covers:
- Successful login/logout flows
- Invalid credentials
- Token expiration
- Concurrent login attempts
- Database connection failures

Mock the database and JWT utilities.
```

### 5. Refactoring Requests

**Prompt Pattern**:
```
Refactor [component] to:
- [improvement 1]
- [improvement 2]
- [improvement 3]

Maintain backward compatibility and update related tests.
```

**Example**:
```
Refactor the file upload handling to:
- Support chunked uploads for large files
- Add progress tracking via SSE
- Implement resumable uploads
- Store files in S3 instead of local disk

Keep the existing API contract intact.
```

## Best Practices for AI-Assisted Development

### 1. Incremental Development

Break large features into smaller, manageable chunks:

```
Step 1: "Create the database schema for notifications"
Step 2: "Add the notification service with send method"
Step 3: "Create REST endpoints for notification CRUD"
Step 4: "Add WebSocket support for real-time notifications"
```

### 2. Context Preservation

When working on related files, reference previous changes:

```
"Following up on the notification schema we created, now update the user schema to add a relation to notifications table and create a junction table for read receipts"
```

### 3. Validation Requests

After generating code, ask for validation:

```
"Review the notification service I just created for:
- Correct TypeScript types
- Proper error handling
- Missing edge cases
- Performance concerns"
```

### 4. Documentation Generation

Request documentation alongside code:

```
"After creating the notification feature, generate:
- API documentation with examples
- Service method JSDoc comments
- README section explaining the feature
- Migration guide for existing users"
```

## Code Generation Templates

### Route Template Request

```
Create a new route at /src/routes/[name].ts with:
- TypeBox schema validation
- Proper error handling
- Authentication middleware where needed
- Pagination support for list endpoints
- OpenAPI documentation
- Rate limiting

Follow the pattern used in /src/routes/sessions/index.ts
```

### Service Template Request

```
Create a service at /src/services/[name].service.ts with:
- Proper TypeScript types
- Transaction support where needed
- Comprehensive error handling
- Logging for important operations
- Input validation
- Caching strategy where applicable

Follow SOLID principles and the pattern in existing services
```

### Migration Template Request

```
Generate a database migration that:
- Adds [describe changes]
- Includes proper indexes
- Handles existing data
- Is reversible (includes down migration logic)
- Updates the schema types

Explain any data transformation needed
```

## Working with Existing Code

### Understanding Code

```
"Explain how the authentication flow works in this codebase, tracing through:
- Initial login request
- Token generation
- Middleware validation
- Token refresh
- Session management"
```

### Finding Code

```
"Where in the codebase do we:
- Handle file uploads?
- Validate JWT tokens?
- Configure rate limiting?
- Set up database connections?"
```

### Impact Analysis

```
"If I change the user schema to add a 'role' field:
- What files need to be updated?
- What migrations are needed?
- Which services are affected?
- What tests need updating?"
```

## Advanced Patterns

### 1. Architecture Decisions

```
"I need to add real-time collaboration features. Compare these approaches:
1. WebSockets with Socket.io
2. Server-Sent Events
3. PostgreSQL LISTEN/NOTIFY
4. Redis Pub/Sub

Consider our current stack and recommend the best approach with implementation plan."
```

### 2. Performance Optimization

```
"Analyze the session list endpoint for performance issues. Suggest optimizations for:
- Database query efficiency
- Response payload size
- Caching strategy
- Pagination implementation"
```

### 3. Security Review

```
"Review the codebase for security vulnerabilities:
- SQL injection risks
- XSS vulnerabilities
- Authentication bypasses
- Rate limiting gaps
- Sensitive data exposure

Provide specific fixes for each issue found."
```

## Anti-Patterns to Avoid

### 1. Vague Requests
❌ "Make it better"
❌ "Fix all the bugs"
❌ "Add some tests"

### 2. No Context
❌ "Create a user service" (without specifying requirements)
❌ "Handle errors properly" (without showing current implementation)

### 3. Too Broad Scope
❌ "Rewrite the entire application"
❌ "Convert everything to microservices"

### 4. Ignoring Constraints
❌ Requesting features that conflict with existing architecture
❌ Asking for technologies not in the current stack

## Troubleshooting AI Assistance

### When Claude Code Seems Confused

1. **Provide more context**: Share related files or explain the system
2. **Break down the request**: Split complex tasks into steps
3. **Show examples**: Provide examples of desired patterns from the codebase
4. **Clarify terminology**: Define domain-specific terms

### Getting Better Results

1. **Reference existing patterns**: "Follow the pattern used in auth.service.ts"
2. **Specify constraints**: "Must work with PostgreSQL and Drizzle ORM"
3. **Include acceptance criteria**: "The solution should pass these test cases..."
4. **Request explanations**: "Explain why you chose this approach"

## Integration with Development Workflow

### 1. Pre-Development
- Architecture planning
- Technology evaluation
- API design
- Database schema design

### 2. During Development
- Code generation
- Problem solving
- Debugging assistance
- Code review

### 3. Post-Development
- Documentation generation
- Test creation
- Performance analysis
- Security review

## Example Full Feature Request

```
I need to add a tagging system to sessions. Here's what I need:

1. Database Design:
   - Tags table with id, name, color
   - Many-to-many relation with sessions
   - Unique constraint on tag names per user

2. API Endpoints:
   - CRUD for tags
   - Add/remove tags from sessions
   - Filter sessions by tags
   - Tag autocomplete

3. Business Logic:
   - Max 10 tags per session
   - Auto-generate tag colors
   - Merge duplicate tags
   - Tag usage statistics

4. Testing:
   - Unit tests for tag service
   - Integration tests for API
   - Test tag limits and constraints

Please implement this following our existing patterns, with proper TypeScript types, error handling, and documentation.
```