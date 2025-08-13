# Backend Architecture

## Overview

The Claude Code Mobile backend is a high-performance, TypeScript-based API server built with Fastify and powered by Bun runtime. It provides a scalable interface for managing Claude Code sessions, processing AI prompts, and handling file operations.

## Core Technologies

### Runtime & Framework
- **Bun** (>=1.0.0): Modern JavaScript runtime with native TypeScript support
- **Fastify**: High-performance web framework optimized for throughput
- **TypeScript**: Full type safety with strict configuration

### Key Dependencies
- **@anthropic-ai/claude-code** (v1.0.72): Official Claude Code SDK
- **Drizzle ORM** (v0.30.10): Type-safe SQL ORM
- **BullMQ** (v5.7.0): Redis-based job queue
- **@sinclair/typebox**: Runtime type validation
- **Zod**: Environment configuration validation

## Architecture Patterns

### Service-Oriented Architecture
The backend follows a service-oriented architecture with clear separation of concerns:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  API Layer  │────▶│   Service   │────▶│  Database   │
│  (Fastify)  │     │    Layer    │     │   (Drizzle) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Worker    │
                    │    Queue    │
                    │  (BullMQ)   │
                    └─────────────┘
```

### Plugin Architecture
Cross-cutting concerns are implemented as Fastify plugins:
- **Security**: Helmet, CORS, rate limiting
- **Logging**: Request/response logging with Pino
- **Error Handling**: Centralized error handler
- **Health Monitoring**: Comprehensive health checks

### Worker Pattern
CPU-intensive Claude Code operations are processed asynchronously:
1. API receives request
2. Job queued in BullMQ
3. Worker processes job with SDK
4. Real-time updates via Redis pub/sub
5. Results stored in database

## Directory Structure

```
backend/
├── src/
│   ├── app.ts                 # Application entry point
│   ├── server.ts              # Server startup
│   ├── config/                # Configuration management
│   │   └── env.schema.ts      # Environment validation
│   ├── db/                    # Database configuration
│   │   ├── schema.ts          # Drizzle schema definitions
│   │   └── index.ts           # Database connection
│   ├── hooks/                 # Fastify hooks
│   │   └── rate-limit.hook.ts # Rate limiting logic
│   ├── plugins/               # Fastify plugins
│   │   ├── error-handler.ts  # Error handling
│   │   └── request-logger.ts # Request logging
│   ├── routes/                # API endpoints
│   │   ├── health.ts          # Health checks
│   │   ├── repositories.ts   # Repository management
│   │   └── sessions/          # Session endpoints
│   ├── schemas/               # TypeBox schemas
│   ├── services/              # Business logic
│   ├── types/                 # TypeScript types
│   ├── utils/                 # Utility functions
│   └── workers/               # Background workers
│       └── claude-code.worker.ts
├── drizzle/                   # Database migrations
├── tests/                     # Test suites
└── docs/                      # Documentation
```

## Data Flow

### Request Processing Flow
1. **Request arrives** at Fastify server
2. **Middleware** processes (logging, rate limiting, validation)
3. **Route handler** invokes service layer
4. **Service layer** executes business logic
5. **Database operations** via Drizzle ORM
6. **Response** returned with appropriate status

### Asynchronous Job Processing
1. **Prompt submission** creates job in queue
2. **Worker picks up** job from Redis queue
3. **Claude SDK** processes prompt
4. **Events streamed** via Redis pub/sub
5. **Database updated** with results
6. **Client notified** through SSE/polling

## Security Architecture

### Defense in Depth
- **Helmet**: Security headers (CSP, COOP, etc.)
- **CORS**: Configurable origin validation
- **Rate Limiting**: Per-endpoint throttling
- **Input Validation**: TypeBox and Zod schemas
- **File Security**: Extension whitelist, size limits
- **Path Validation**: Directory traversal prevention

### Authentication Flow
- JWT-based stateless authentication
- BCrypt password hashing
- Token validation middleware
- Session-based authorization

## Performance Optimizations

### Database
- Connection pooling
- Indexed queries
- Prepared statements
- Transaction batching

### Queue System
- Redis connection pooling
- Job batching
- Exponential backoff retry
- Dead letter queue handling

### API
- Response compression
- Request/response caching
- Parallel route registration
- Optimized JSON serialization

## Monitoring & Observability

### Logging Strategy
- **Structured logging** with Pino
- **Log levels**: fatal, error, warn, info, debug, trace
- **Context preservation** with child loggers
- **File output** for debugging

### Health Monitoring
- **/health**: Complete system health
- **/health/live**: Liveness probe
- **/health/ready**: Readiness probe
- Service-level health checks (database, Redis, queue)

### Metrics
- Queue depth and processing rates
- API response times
- Error rates by endpoint
- Database connection pool stats

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Shared Redis for coordination
- Database connection pooling
- Worker process scaling

### Vertical Scaling
- Bun's efficient runtime
- Optimized TypeScript compilation
- Memory-efficient data structures
- Stream processing for large files

## Development Workflow

### Local Development
```bash
bun install        # Install dependencies
bun run dev       # Start development server
bun test          # Run test suite
bun run lint      # Lint code
bun run typecheck # Type checking
```

### Database Management
```bash
bun run db:generate  # Generate migrations
bun run db:migrate   # Apply migrations
bun run db:studio    # Open Drizzle Studio
```

### Environment Configuration
Required environment variables are validated at startup using Zod schemas. See `env.schema.ts` for complete configuration options.

## Error Handling Strategy

### Layered Error Handling
1. **Route-level** validation errors
2. **Service-level** business logic errors
3. **Database-level** constraint violations
4. **Worker-level** job processing errors
5. **Global** error handler for uncaught errors

### Error Response Format
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional context
}
```

## Testing Strategy

### Test Pyramid
- **Unit tests**: Service and utility functions
- **Integration tests**: API endpoints with mocked services
- **E2E tests**: Complete user workflows
- **Performance tests**: Load and stress testing

### Test Infrastructure
- Vitest for unit/integration tests
- Supertest for API testing
- Test database with migrations
- Mock Redis for queue testing