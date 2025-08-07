# Claude Code Mobile Backend - Developer Guide

This guide provides a comprehensive overview of the Claude Code Mobile backend structure and documentation to help developers navigate and contribute to the codebase effectively.

## Directory Structure

```
backend/
├── src/                    # Source code
│   ├── app.ts             # Main Fastify application setup
│   ├── server.ts          # Server entry point
│   ├── config/            # Configuration management
│   │   ├── index.ts       # Config loader with validation
│   │   └── env.schema.ts  # Environment variable schemas
│   ├── db/                # Database layer
│   │   ├── index.ts       # Database connection
│   │   └── schema/        # Drizzle ORM schemas
│   │       ├── users.ts   # User model
│   │       ├── sessions.ts # Session model
│   │       ├── prompts.ts # Prompt model
│   │       └── files.ts   # File model
│   ├── routes/            # API routes
│   │   ├── health.ts      # Health check endpoints
│   │   ├── auth/          # Authentication routes
│   │   └── sessions/      # Session management routes
│   ├── services/          # Business logic layer
│   │   ├── auth.service.ts
│   │   ├── session.service.ts
│   │   ├── prompt.service.ts
│   │   ├── file.service.ts
│   │   └── queue.service.ts
│   ├── plugins/           # Fastify plugins
│   │   ├── auth.ts        # JWT authentication
│   │   ├── cors.ts        # CORS configuration
│   │   ├── error-handler.ts
│   │   └── swagger.ts     # API documentation
│   ├── hooks/             # Fastify hooks
│   │   └── rate-limit.hook.ts
│   ├── schemas/           # TypeBox validation schemas
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
│       ├── errors.ts      # Error handling utilities
│       ├── jwt.ts         # JWT helpers
│       └── sse.ts         # Server-sent events
├── tests/                 # Test files
│   ├── setup.ts          # Test configuration
│   └── unit/             # Unit tests
├── scripts/              # Utility scripts
│   └── migrate.ts        # Database migration runner
├── drizzle/              # Database migrations
├── docs/                 # Documentation
│   ├── routes.md         # Route development guide
│   ├── database.md       # Database operations guide
│   ├── testing.md        # Testing strategies
│   ├── local-development.md # Local setup guide
│   ├── claude-code-flow.md  # AI-assisted development
│   └── git-flows.md      # Version control practices
└── config files          # Various configuration files
    ├── package.json      # Dependencies and scripts
    ├── tsconfig.json     # TypeScript configuration
    ├── vitest.config.ts  # Test configuration
    ├── drizzle.config.ts # Database configuration
    └── biome.json        # Code formatting/linting
```

## Documentation Overview

### 📍 [Routes Documentation](./docs/routes.md)
Learn how to create and structure API routes using Fastify, TypeBox schemas, and best practices for RESTful endpoints.

**Key Topics:**
- Route structure and registration
- Schema validation with TypeBox
- Authentication middleware
- Error handling patterns
- SSE (Server-Sent Events) implementation

### 🗄️ [Database Documentation](./docs/database.md)
Comprehensive guide to database operations using Drizzle ORM with PostgreSQL.

**Key Topics:**
- Schema definition patterns
- Migration procedures
- CRUD operations with examples
- Transaction handling
- Query optimization
- Database best practices

### 🧪 [Testing Documentation](./docs/testing.md)
Testing strategies and patterns for ensuring code quality and reliability.

**Key Topics:**
- Unit testing with Vitest
- Integration testing Fastify routes
- Mocking strategies
- Test database setup
- Coverage requirements
- Testing best practices

### 💻 [Local Development](./docs/local-development.md)
Complete setup guide for running the backend locally.

**Key Topics:**
- Prerequisites and initial setup
- Environment configuration
- Docker setup for dependencies
- Development scripts
- Debugging techniques
- Common troubleshooting

### 🤖 [Claude Code Flow](./docs/claude-code-flow.md)
How to effectively use Claude Code for AI-assisted development.

**Key Topics:**
- Effective prompting strategies
- Common development workflows
- Code generation templates
- Best practices for AI assistance
- Anti-patterns to avoid

### 🌿 [Git Flows](./docs/git-flows.md)
Version control best practices and workflows.

**Key Topics:**
- Branch strategy
- Commit conventions
- Pull request process
- Release workflow
- Git hooks setup
- Troubleshooting common issues

## Quick Start Commands

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Run tests
bun test

# Run migrations
bun migrate

# Open database studio
bun migrate:studio

# Check types
bun type-check

# Format and lint
bun format && bun lint:fix
```

## Key Technologies

- **Fastify**: High-performance web framework
- **TypeScript**: Type-safe development
- **Drizzle ORM**: Type-safe database toolkit
- **PostgreSQL**: Primary database
- **Redis**: Caching and queue management
- **TypeBox**: Runtime validation with TypeScript inference
- **Vitest**: Fast unit testing framework
- **JWT**: Authentication mechanism
- **BullMQ**: Job queue processing

## Architecture Principles

1. **Type Safety First**: Leverage TypeScript throughout the stack
2. **Schema Validation**: Validate all inputs at runtime
3. **Layered Architecture**: Separate routes, services, and data access
4. **Error Handling**: Consistent error responses across the API
5. **Testing**: Comprehensive test coverage for reliability
6. **Performance**: Optimize for speed and scalability
7. **Security**: Follow OWASP guidelines and best practices

## Getting Help

1. **Check Documentation**: Start with the relevant guide in `/docs`
2. **Read Tests**: Tests often show usage examples
3. **Use Claude Code**: Ask for help with specific code challenges
4. **Review Examples**: Look at existing implementations for patterns

## Contributing

When contributing to this project:

1. Follow the [Git Flow](./docs/git-flows.md) conventions
2. Write tests for new features
3. Update documentation as needed
4. Ensure all checks pass before submitting PR
5. Use conventional commits for clear history

## Environment Variables

Key environment variables (see `.env.example`):

- `NODE_ENV`: Development/production mode
- `PORT`: Server port (default: 3000)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret for JWT signing
- `LOG_LEVEL`: Logging verbosity

## API Documentation

When running in development, access Swagger UI at:
```
http://localhost:3000/documentation
```

## Support

For questions or issues:
1. Check existing documentation
2. Look for similar patterns in codebase
3. Use Claude Code for guidance
4. Create an issue with clear description