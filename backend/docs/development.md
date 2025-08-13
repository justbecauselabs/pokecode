# Development Guide

## Getting Started

### Prerequisites
- **Bun** >= 1.0.0
- **PostgreSQL** >= 14
- **Redis** >= 6.0
- **Git**
- **Claude Code** CLI installed locally

### Initial Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**
```bash
bun install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Setup database**
```bash
# Create database
createdb pokecode

# Run migrations
bun run db:migrate
```

5. **Start Redis**
```bash
redis-server
```

6. **Start development server**
```bash
bun run dev
```

## Development Commands

### Common Tasks
```bash
# Start development server with hot reload
bun run dev

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Type checking
bun run typecheck

# Linting
bun run lint

# Format code
bun run format
```

### Database Management
```bash
# Generate migration from schema changes
bun run db:generate

# Apply pending migrations
bun run db:migrate

# Open database GUI
bun run db:studio

# Reset database (caution!)
bun run db:reset
```

### Build and Production
```bash
# Build for production
bun run build

# Start production server
bun run start

# Check bundle size
bun run analyze
```

## Project Structure

```
backend/
├── src/
│   ├── app.ts              # Fastify app configuration
│   ├── server.ts           # Server entry point
│   ├── config/             # Configuration files
│   ├── db/                 # Database setup
│   ├── hooks/              # Fastify hooks
│   ├── plugins/            # Fastify plugins
│   ├── routes/             # API routes
│   ├── schemas/            # Validation schemas
│   ├── services/           # Business logic
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   └── workers/            # Background workers
├── drizzle/                # Database migrations
├── tests/                  # Test files
├── docs/                   # Documentation
└── scripts/                # Utility scripts
```

## Environment Variables

### Required Variables
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
ANTHROPIC_API_KEY=sk-ant-... # For API mode
```

### Environment Validation
Environment variables are validated at startup using Zod schemas. See `src/config/env.schema.ts` for the complete schema.

## Code Style Guide

### TypeScript
```typescript
// Use explicit types
interface UserData {
  id: string;
  name: string;
}

// Prefer const assertions
const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const;

// Use proper error handling
try {
  await riskyOperation();
} catch (error) {
  logger.error({ error }, 'Operation failed');
  throw new AppError('Operation failed', 500);
}
```

### Naming Conventions
- **Files**: kebab-case (`user-service.ts`)
- **Classes**: PascalCase (`UserService`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with 'I' prefix optional (`IUserData` or `UserData`)

### File Organization
```typescript
// 1. Imports (external first, then internal)
import { FastifyRequest } from 'fastify';
import { db } from '../db';

// 2. Types and interfaces
interface RequestParams {
  id: string;
}

// 3. Constants
const MAX_RESULTS = 100;

// 4. Main code
export class UserService {
  // Implementation
}

// 5. Exports
export { UserService };
```

## Testing

### Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  describe('getUserById', () => {
    it('should return user when exists', async () => {
      const user = await service.getUserById('123');
      expect(user).toBeDefined();
      expect(user.id).toBe('123');
    });

    it('should throw when user not found', async () => {
      await expect(service.getUserById('invalid'))
        .rejects.toThrow('User not found');
    });
  });
});
```

### Testing Patterns
```typescript
// API endpoint testing
import { build } from '../src/app';

describe('GET /api/sessions', () => {
  const app = build();

  it('should return sessions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('sessions');
  });
});

// Service mocking
vi.mock('../src/services/queue.service', () => ({
  QueueService: vi.fn(() => ({
    addPromptJob: vi.fn().mockResolvedValue({ id: 'job-123' })
  }))
}));
```

## Debugging

### Logging
```typescript
import { logger } from './utils/logger';

// Log levels
logger.fatal({ error }, 'Fatal error occurred');
logger.error({ error, userId }, 'Operation failed');
logger.warn({ attempt, maxAttempts }, 'Retry attempt');
logger.info({ sessionId }, 'Session created');
logger.debug({ data }, 'Processing data');
logger.trace({ request }, 'Incoming request');
```

### Debug Configuration
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "name": "Debug Server",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.ts",
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  ]
}
```

### Debugging Workers
```typescript
// Enable verbose logging
const worker = new Worker('queue', processor, {
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1
  }
});

worker.on('failed', (job, error) => {
  logger.error({ 
    jobId: job.id,
    jobData: job.data,
    error: error.stack 
  }, 'Job failed');
});
```

## Performance Optimization

### Database Queries
```typescript
// Bad: N+1 query problem
const sessions = await db.query.sessions.findMany();
for (const session of sessions) {
  const messages = await db.query.messages.findMany({
    where: eq(messages.sessionId, session.id)
  });
}

// Good: Single query with join
const sessionsWithMessages = await db.query.sessions.findMany({
  with: {
    messages: true
  }
});
```

### Caching Strategy
```typescript
import { Redis } from 'ioredis';

class CacheService {
  private redis = new Redis();
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(key: string, value: any, ttl = 3600) {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

## Security Best Practices

### Input Validation
```typescript
// Use TypeBox schemas
const CreateSessionSchema = Type.Object({
  projectPath: Type.String({ minLength: 1, maxLength: 1000 }),
  context: Type.Optional(Type.String({ maxLength: 5000 }))
});

// Validate in routes
app.post('/sessions', {
  schema: {
    body: CreateSessionSchema
  }
}, handler);
```

### SQL Injection Prevention
```typescript
// Bad: String concatenation
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// Good: Parameterized queries (handled by Drizzle)
await db.query.users.findFirst({
  where: eq(users.id, userId)
});
```

### File Security
```typescript
// Validate file paths
import { isAbsolute, join, normalize } from 'path';

function validatePath(basePath: string, requestedPath: string) {
  const resolved = normalize(join(basePath, requestedPath));
  if (!resolved.startsWith(basePath)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}
```

## Deployment

### Docker Development
```dockerfile
FROM oven/bun:1.0.0

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

EXPOSE 3001
CMD ["bun", "run", "start"]
```

### Health Checks
```yaml
# docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify credentials
psql -h localhost -U postgres -d pokecode

# Check connection string
echo $DATABASE_URL
```

#### Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping

# Verify connection
redis-cli -h localhost -p 6379

# Check Redis memory
redis-cli info memory
```

#### Worker Not Processing Jobs
```typescript
// Check worker status
const metrics = await queueService.getQueueMetrics();
console.log('Queue metrics:', metrics);

// Check for stalled jobs
const stalled = await queue.getStalledJobs();
console.log('Stalled jobs:', stalled);

// Manually process job
await worker.run();
```

### Performance Issues

#### Slow API Responses
1. Check database query performance
2. Enable query logging
3. Review indexes
4. Check connection pool settings

#### Memory Leaks
1. Monitor heap usage
2. Check for circular references
3. Review event listener cleanup
4. Use memory profiling tools

## Contributing

### Workflow
1. Create feature branch from `main`
2. Write tests for new features
3. Ensure all tests pass
4. Update documentation
5. Submit pull request

### Commit Messages
Follow conventional commits:
```
feat: add session archiving
fix: resolve memory leak in worker
docs: update API documentation
refactor: simplify queue service
test: add session service tests
```

### Code Review Checklist
- [ ] Tests pass
- [ ] Type checking passes
- [ ] No linting errors
- [ ] Documentation updated
- [ ] Security considerations addressed
- [ ] Performance impact assessed