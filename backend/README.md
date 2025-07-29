# Claude Code Mobile Backend

Fastify-based API server for Claude Code Mobile application.

## Features

- **REST API** with TypeBox validation
- **PostgreSQL** database with Drizzle ORM
- **JWT Authentication** with refresh tokens
- **Server-Sent Events** for real-time streaming
- **BullMQ** integration for async job processing
- **File System API** with security sandboxing
- **Rate Limiting** per endpoint
- **OpenAPI Documentation** auto-generated

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run database migrations:**
   ```bash
   pnpm migrate
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```

## API Documentation

When running in development, API documentation is available at:
- Swagger UI: http://localhost:3001/docs
- OpenAPI JSON: http://localhost:3001/docs/json

## Database Schema

The application uses PostgreSQL with the following main tables:
- `claude_code_sessions` - User sessions
- `claude_code_prompts` - Prompt executions
- `claude_code_file_access` - File access logs
- `claude_code_users` - User accounts

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### Sessions
- `POST /api/claude-code/sessions` - Create session
- `GET /api/claude-code/sessions` - List sessions
- `GET /api/claude-code/sessions/:id` - Get session
- `PATCH /api/claude-code/sessions/:id` - Update session
- `DELETE /api/claude-code/sessions/:id` - Delete session

### Prompts
- `POST /api/claude-code/sessions/:id/prompts` - Execute prompt
- `GET /api/claude-code/sessions/:id/prompts/:promptId` - Get prompt
- `GET /api/claude-code/sessions/:id/prompts/:promptId/stream` - Stream responses
- `DELETE /api/claude-code/sessions/:id/prompts/:promptId` - Cancel prompt

### Files
- `GET /api/claude-code/sessions/:id/files` - List files
- `GET /api/claude-code/sessions/:id/files/*` - Read file
- `POST /api/claude-code/sessions/:id/files/*` - Create file
- `PUT /api/claude-code/sessions/:id/files/*` - Update file
- `DELETE /api/claude-code/sessions/:id/files/*` - Delete file

## Testing

```bash
# Run unit tests
pnpm test

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

## Production Build

```bash
# Build TypeScript
pnpm build

# Run production server
pnpm start
```

## Docker Deployment

```bash
# Build image
docker build -t claude-code-backend .

# Run container
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  claude-code-backend
```