/**
 * File content fixtures for agent files, command files, and other content
 * Realistic examples based on actual usage patterns
 */

export interface AgentFixture {
  path: string;
  frontMatter: Record<string, unknown>;
  content: string;
  fileName: string;
}

export interface CommandFixture {
  path: string;
  frontMatter: Record<string, unknown>;
  content: string;
  fileName: string;
}

/**
 * User agent fixtures (from ~/.claude/agents/)
 */
export const userAgentFixtures: AgentFixture[] = [
  {
    path: '/Users/test/.claude/agents/code-reviewer.md',
    fileName: 'code-reviewer',
    frontMatter: {
      name: 'Code Reviewer',
      description:
        'Reviews code for best practices, security issues, and performance optimizations',
      color: '#4CAF50',
    },
    content: `You are a senior software engineer specializing in code review. Your expertise includes:

## Review Focus Areas
- **Security**: Identify potential vulnerabilities, input validation issues, and security anti-patterns
- **Performance**: Spot inefficient algorithms, memory leaks, and optimization opportunities
- **Best Practices**: Ensure code follows language-specific conventions and industry standards
- **Maintainability**: Check for clear naming, proper documentation, and modular design
- **Testing**: Verify test coverage and quality of test cases

## Review Process
1. Analyze the code structure and architecture
2. Identify specific issues with line numbers and explanations
3. Suggest concrete improvements with code examples
4. Prioritize issues by severity (Critical, High, Medium, Low)
5. Provide positive feedback on well-written code

Always be constructive and educational in your feedback.`,
  },

  {
    path: '/Users/test/.claude/agents/api-documentation.md',
    fileName: 'api-documentation',
    frontMatter: {
      name: 'API Documentation Specialist',
      description: 'Creates comprehensive API documentation and OpenAPI specifications',
      color: '#2196F3',
    },
    content: `You specialize in creating clear, comprehensive API documentation. Your expertise includes:

## Documentation Standards
- **OpenAPI/Swagger**: Generate accurate API specifications
- **Examples**: Provide realistic request/response examples
- **Error Handling**: Document all error codes and scenarios
- **Authentication**: Clearly explain auth requirements and flows
- **Rate Limiting**: Document rate limits and usage guidelines

## Format Guidelines
- Use clear, concise language
- Include code examples in multiple languages
- Provide interactive examples where possible
- Structure information logically with proper hierarchy
- Include troubleshooting sections for common issues

Focus on making APIs easy to understand and integrate for developers.`,
  },

  {
    path: '/Users/test/.claude/agents/database-expert.md',
    fileName: 'database-expert',
    frontMatter: {
      name: 'Database Expert',
      description: 'Specializes in database design, optimization, and troubleshooting',
      color: '#FF9800',
    },
    content: `You are a database expert with deep knowledge of relational and NoSQL databases.

## Expertise Areas
- **Schema Design**: Normalize/denormalize based on use cases
- **Query Optimization**: Analyze and improve query performance
- **Indexing**: Design efficient indexing strategies
- **Migrations**: Safe schema changes and data migrations
- **Monitoring**: Performance monitoring and alerting setup

## Database Technologies
- PostgreSQL, MySQL, SQLite (Relational)
- MongoDB, Redis (NoSQL)
- Drizzle ORM, Prisma, TypeORM (ORMs)

Always consider performance, scalability, and data integrity in your recommendations.`,
  },
];

/**
 * Project agent fixtures (from .claude/agents/)
 */
export const projectAgentFixtures: AgentFixture[] = [
  {
    path: '/project/.claude/agents/fastify-expert.md',
    fileName: 'fastify-expert',
    frontMatter: {
      name: 'Fastify API Expert',
      description: 'Expert in Fastify framework patterns for this project',
      color: '#00D4AA',
    },
    content: `You are an expert in Fastify development for this specific project.

## Project Patterns
- **Route Structure**: Follow the established route organization in \`src/routes/\`
- **Validation**: Use TypeBox schemas for request/response validation
- **Error Handling**: Implement consistent error responses with proper HTTP status codes
- **Authentication**: JWT-based auth using \`@fastify/jwt\`
- **Database**: Drizzle ORM with SQLite integration
- **Testing**: bun:test with comprehensive mocking

## Code Conventions
- Use TypeScript strict mode
- Function parameters as objects: \`function name(params: { ... })\`
- Prefer async/await over Promises
- Export services as singleton instances
- Use Bun APIs for file operations when possible

Follow the existing patterns in the codebase for consistency.`,
  },

  {
    path: '/project/.claude/agents/test-helper.md',
    fileName: 'test-helper',
    frontMatter: {
      name: 'Test Helper',
      description: 'Assists with writing comprehensive tests for this project',
    },
    content: `You help write thorough tests using bun:test and the project's testing infrastructure.

## Testing Patterns
- **Unit Tests**: Focus on individual service functions
- **Integration Tests**: Test full request/response cycles
- **Mocking**: Use the established mock helpers in \`tests/mocks/\`
- **Fixtures**: Leverage realistic test data from \`tests/fixtures/\`

## Test Structure
\`\`\`typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { mockFileSystem } from '@/tests/mocks/file-system.mock';
import { testDatabase } from '@/tests/helpers/database.helpers';

describe('ServiceName', () => {
  beforeEach(async () => {
    await testDatabase.cleanup();
    mockFileSystem.reset();
  });

  it('should handle expected case', () => {
    // Test implementation
  });
});
\`\`\`

Focus on realistic test scenarios and comprehensive edge case coverage.`,
  },
];

/**
 * User command fixtures (from ~/.claude/commands/)
 */
export const userCommandFixtures: CommandFixture[] = [
  {
    path: '/Users/test/.claude/commands/test-all.md',
    fileName: 'test-all',
    frontMatter: {
      name: 'Run All Tests',
      description: 'Runs the complete test suite with coverage',
    },
    content: `# Test Runner Command

Executes the full test suite with coverage reporting and linting.

## Commands

\`\`\`bash
# Run all tests with coverage
bun test --coverage

# Run tests in watch mode during development
bun test --watch

# Run only unit tests
bun test tests/unit

# Run only integration tests
bun test tests/integration

# Type checking
bun run type-check

# Linting
bun run lint
\`\`\`

## Coverage Thresholds
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

Tests must pass these thresholds to succeed.`,
  },

  {
    path: '/Users/test/.claude/commands/database-migrate.md',
    fileName: 'database-migrate',
    frontMatter: {
      name: 'Database Migration',
      description: 'Handles database schema migrations with Drizzle',
    },
    content: `# Database Migration Commands

Manage database schema changes using Drizzle ORM.

## Migration Workflow

\`\`\`bash
# Generate new migration from schema changes
bun run db:generate

# Apply migrations to database
bun run db:push

# Open database studio for inspection
bun run db:studio

# Check migration status
bun run db:check

# Drop database (USE WITH CAUTION)
bun run db:drop
\`\`\`

## Migration Best Practices
1. Always generate migrations before making schema changes
2. Review generated SQL before applying
3. Backup database before major schema changes
4. Test migrations on staging environment first

## Rollback Strategy
For rollbacks, create reverse migration manually as Drizzle doesn't support automatic rollbacks.`,
  },

  {
    path: '/Users/test/.claude/commands/dev-workflow.md',
    fileName: 'dev-workflow',
    frontMatter: {
      name: 'Development Workflow',
      description: 'Common development tasks and commands',
    },
    content: `# Development Workflow

Standard development commands and workflows for this project.

## Development Servers

\`\`\`bash
# Start API server with hot reload
bun run dev:server

# Start background worker
bun run dev:worker

# Start both in parallel (if using process manager)
bun run dev
\`\`\`

## Code Quality

\`\`\`bash
# Format code
bun run format

# Lint and fix issues
bun run lint:fix

# Type checking
bun run type-check

# Run all quality checks
bun run lint && bun run type-check
\`\`\`

## Build & Deploy

\`\`\`bash
# Build for production
bun run build

# Start production servers
bun run start:server
bun run start:worker
\`\`\`

## Environment Setup
1. Copy \`.env.example\` to \`.env\`
2. Configure database connection
3. Set Claude Code path
4. Install dependencies: \`bun install\``,
  },
];

/**
 * Project command fixtures (from .claude/commands/ in project)
 */
export const projectCommandFixtures: CommandFixture[] = [
  {
    path: '/project/.claude/commands/test-all.md',
    fileName: 'test-all',
    frontMatter: {
      name: 'Run All Tests',
      description: 'Runs the complete test suite with coverage',
    },
    content: `# Test Runner Command

Executes the full test suite with coverage reporting and linting.

## Commands

\`\`\`bash
# Run all tests with coverage
bun test --coverage

# Run tests in watch mode during development
bun test --watch

# Run only unit tests
bun test tests/unit

# Run only integration tests
bun test tests/integration

# Type checking
bun run type-check

# Linting
bun run lint
\`\`\`

## Coverage Thresholds
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

Tests must pass these thresholds to succeed.`,
  },

  {
    path: '/project/.claude/commands/database-migrate.md',
    fileName: 'database-migrate',
    frontMatter: {
      name: 'Database Migration',
      description: 'Handles database schema migrations with Drizzle',
    },
    content: `# Database Migration Commands

Manage database schema changes using Drizzle ORM.

## Migration Workflow

\`\`\`bash
# Generate new migration from schema changes
bun run db:generate

# Apply migrations to database
bun run db:push

# Open database studio for inspection
bun run db:studio

# Check migration status
bun run db:check

# Drop database (USE WITH CAUTION)
bun run db:drop
\`\`\`

## Migration Best Practices
1. Always generate migrations before making schema changes
2. Review generated SQL before applying
3. Backup database before major schema changes
4. Test migrations on staging environment first

## Rollback Strategy
For rollbacks, create reverse migration manually as Drizzle doesn't support automatic rollbacks.`,
  },

  {
    path: '/project/.claude/commands/dev-workflow.md',
    fileName: 'dev-workflow',
    frontMatter: {
      name: 'Development Workflow',
      description: 'Common development tasks and commands',
    },
    content: `# Development Workflow

Standard development commands and workflows for this project.

## Development Servers

\`\`\`bash
# Start API server with hot reload
bun run dev:server

# Start background worker
bun run dev:worker

# Start both in parallel (if using process manager)
bun run dev
\`\`\`

## Code Quality

\`\`\`bash
# Format code
bun run format

# Lint and fix issues
bun run lint:fix

# Type checking
bun run type-check

# Run all quality checks
bun run lint && bun run type-check
\`\`\`

## Build & Deploy

\`\`\`bash
# Build for production
bun run build

# Start production servers
bun run start:server
bun run start:worker
\`\`\`

## Environment Setup
1. Copy \`.env.example\` to \`.env\`
2. Configure database connection
3. Set Claude Code path
4. Install dependencies: \`bun install\``,
  },
];

/**
 * Create file system structure for testing
 */
export function createTestFileStructure() {
  return {
    // User agents directory
    '/Users/test/.claude/agents/': userAgentFixtures,
    '/Users/test/.claude/commands/': userCommandFixtures,

    // Project structure
    '/Users/test/project/.claude/agents/': projectAgentFixtures,
    '/Users/test/project/.claude/commands/': projectCommandFixtures,
  };
}

// Export interfaces and functions - variables already exported above
