# Claude Code Mobile Backend

## Overview

This backend powers the Claude Code Mobile application, providing a robust API for managing Claude Code sessions, processing AI prompts, and handling file operations. Built with TypeScript, Fastify, and Bun runtime, it offers high performance and type safety throughout the stack.

## Key Technologies

- **Runtime**: Bun (fast, modern JavaScript runtime)
- **Framework**: Fastify (high-performance web framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Queue**: BullMQ with Redis
- **AI Integration**: @anthropic-ai/claude-code SDK

## Documentation

### Core Documentation

- **[Architecture](./docs/architecture.md)** - System design, patterns, and structure
- **[API Reference](./docs/api-reference.md)** - Complete API endpoints and schemas
- **[Database](./docs/database.md)** - Schema, migrations, and query patterns
- **[Development](./docs/development.md)** - Setup, workflow, and best practices

### Feature Documentation

- **[JSONL Processing](./docs/jsonl-processing.md)** - Conversation history handling
- **[Worker Queue](./docs/worker-queue.md)** - Asynchronous job processing and SDK integration
- **[Security](./docs/security.md)** - Security measures and best practices

## Quick Start

```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
bun run db:migrate

# Start development server
bun run dev
```

## Project Structure

```
backend/
├── src/
│   ├── app.ts                    # Fastify application setup
│   ├── server.ts                 # Server entry point
│   ├── config/                   # Configuration management
│   │   └── env.schema.ts         # Environment validation
│   ├── db/                       # Database layer
│   │   ├── schema.ts            # Drizzle schema definitions
│   │   └── index.ts             # Database connection
│   ├── routes/                   # API endpoints
│   │   ├── health.ts            # Health check endpoints
│   │   ├── repositories.ts     # Repository management
│   │   └── sessions/            # Session endpoints
│   │       ├── index.ts        # Session CRUD
│   │       ├── messages.ts     # Message handling
│   │       └── files.ts        # File operations
│   ├── services/                 # Business logic
│   │   ├── claude-code-sdk.service.ts  # Claude SDK integration
│   │   ├── session.service.ts         # Session management
│   │   ├── message.service.ts         # Message persistence
│   │   ├── queue.service.ts           # Job queue management
│   │   └── file.service.ts            # File operations
│   ├── workers/                  # Background processing
│   │   └── claude-code.worker.ts      # Claude prompt processing
│   └── utils/                    # Utilities
│       ├── message-parser.ts          # JSONL parsing
│       └── logger.ts                   # Logging configuration
├── drizzle/                      # Database migrations
└── docs/                         # Documentation
```

## API Endpoints

### Health & Status
- `GET /health` - System health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

### Sessions
- `POST /api/claude-code/sessions` - Create session
- `GET /api/claude-code/sessions` - List sessions
- `GET /api/claude-code/sessions/:id` - Get session
- `PATCH /api/claude-code/sessions/:id` - Update session
- `DELETE /api/claude-code/sessions/:id` - Delete session

### Messages
- `POST /api/claude-code/sessions/:id/messages` - Send message
- `GET /api/claude-code/sessions/:id/messages` - Get messages

### Files
- `GET /api/claude-code/sessions/:id/files` - List files
- `GET /api/claude-code/sessions/:id/files/*` - Read file
- `POST /api/claude-code/sessions/:id/files/*` - Create file
- `PUT /api/claude-code/sessions/:id/files/*` - Update file
- `DELETE /api/claude-code/sessions/:id/files/*` - Delete file

## Key Features

### Asynchronous Processing
- Redis-based job queue for Claude Code prompts
- Worker processes for scalable AI processing
- Real-time streaming via Redis pub/sub

### Session Management
- Project-based session isolation
- Claude session resumption support
- Conversation history persistence

### Security
- Input validation with TypeBox schemas
- Rate limiting per endpoint
- Path traversal prevention
- CORS and security headers

### Performance
- Connection pooling for database and Redis
- Efficient JSONL parsing
- Optimized file operations
- Response caching strategies

## Development Commands

```bash
# Development
bun run dev          # Start dev server with hot reload
bun test            # Run tests
bun run lint        # Lint code
bun run typecheck   # Type checking

# Database
bun run db:generate  # Generate migration
bun run db:migrate   # Apply migrations
bun run db:studio    # Open database GUI

# Production
bun run build       # Build for production
bun run start       # Start production server
```

## Environment Configuration

Required environment variables:

```env
# Server
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pokecode
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# Claude Code
CLAUDE_CODE_PATH=/usr/local/bin/claude
GITHUB_REPOS_DIRECTORY=/path/to/repos

# Optional
ANTHROPIC_API_KEY=sk-ant-...  # For API mode
```

## Architecture Highlights

### Service Layer Architecture
The backend follows a clean service-oriented architecture with clear separation of concerns:
- **Routes** handle HTTP requests and responses
- **Services** contain business logic
- **Workers** process background jobs
- **Database** layer manages persistence

### Worker Queue System
Asynchronous processing ensures responsive API:
- Jobs queued in Redis via BullMQ
- Workers process Claude Code prompts
- Real-time updates streamed to clients
- Automatic retry with exponential backoff

### JSONL Processing
Sophisticated handling of Claude conversation data:
- Line-by-line parsing with error recovery
- Zod schema validation for type safety
- Support for all Claude tool types
- Hybrid storage (database + files)

## Contributing

Please refer to the [Development Guide](./docs/development.md) for:
- Setup instructions
- Code style guidelines
- Testing practices
- Debugging tips
- Security considerations

## Support

For issues or questions:
1. Check the documentation in `/docs`
2. Review existing GitHub issues
3. Contact the development team

## License

[License information here]