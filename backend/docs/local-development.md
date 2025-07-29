# Local Development Documentation

This guide covers setting up and running the Claude Code Mobile backend for local development.

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL (local or Docker)
- Redis (local or Docker)

## Initial Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Node environment
NODE_ENV=development

# Server
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/claude_code

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Optional: Test Database
TEST_DATABASE_URL=postgresql://username:password@localhost:5432/claude_code_test
```

### 3. Database Setup

#### Using Docker (Recommended)

Create a `docker-compose.yml` for local services:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: claude_code
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Start services:

```bash
docker-compose up -d
```

#### Local Installation

Install PostgreSQL and Redis using your package manager:

```bash
# macOS
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis

# Ubuntu/Debian
sudo apt-get install postgresql redis-server
sudo systemctl start postgresql redis
```

### 4. Run Database Migrations

```bash
# Generate migration files from schema
pnpm migrate:generate

# Apply migrations to database
pnpm migrate

# Or push schema directly (development only)
pnpm migrate:push
```

## Development Workflow

### Start Development Server

```bash
pnpm dev
```

This starts the server with hot-reload using `tsx watch`. The server will restart automatically when you make changes.

### Available Scripts

```bash
# Development
pnpm dev              # Start dev server with hot-reload
pnpm build            # Build TypeScript to JavaScript
pnpm start            # Start production server

# Database
pnpm migrate          # Run migrations
pnpm migrate:generate # Generate new migration
pnpm migrate:push     # Push schema changes (dev only)
pnpm migrate:studio   # Open Drizzle Studio
pnpm seed            # Seed database with test data

# Testing
pnpm test            # Run tests once
pnpm test:watch      # Run tests in watch mode
pnpm test:ui         # Open Vitest UI
pnpm test:coverage   # Run tests with coverage

# Code Quality
pnpm lint            # Check code with Biome
pnpm lint:fix        # Fix linting issues
pnpm format          # Format code with Biome
pnpm type-check      # Check TypeScript types
```

## Development Tools

### API Documentation

When running in development, Swagger UI is available at:

```
http://localhost:3000/documentation
```

### Database GUI

Use Drizzle Studio to explore your database:

```bash
pnpm migrate:studio
```

Opens at: http://localhost:4983

### Logging

Development logs are prettified using pino-pretty:

```typescript
// Structured logging
fastify.log.info({ userId: user.id }, 'User logged in');
fastify.log.error({ err: error }, 'Database query failed');
```

### Debugging

#### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "skipFiles": ["<node_internals>/**"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test:watch"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

#### Node.js Inspector

Start with inspector:

```bash
node --inspect -r tsx/cjs src/server.ts
```

Then connect Chrome DevTools or your debugger to `chrome://inspect`.

## Common Development Tasks

### Adding a New Route

1. Create route file in `/src/routes`:

```typescript
// src/routes/example.ts
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';

const exampleRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: {
        200: Type.Object({
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    return { message: 'Hello from example route' };
  });
};

export default exampleRoute;
```

2. Register in `src/app.ts`:

```typescript
import exampleRoutes from './routes/example';

// In the app function
await fastify.register(exampleRoutes, { prefix: '/api/example' });
```

### Adding a Database Table

1. Create schema file in `/src/db/schema`:

```typescript
// src/db/schema/examples.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const examples = pgTable('examples', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export type Example = typeof examples.$inferSelect;
export type NewExample = typeof examples.$inferInsert;
```

2. Export from `src/db/schema/index.ts`:

```typescript
export * from './examples';
```

3. Generate and run migration:

```bash
pnpm migrate:generate
pnpm migrate
```

### Creating a Service

```typescript
// src/services/example.service.ts
import { db } from '@/db';
import { examples } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function createExample(data: NewExample) {
  const [example] = await db.insert(examples)
    .values(data)
    .returning();
  
  return example;
}

export async function getExample(id: string) {
  return db.query.examples.findFirst({
    where: eq(examples.id, id)
  });
}
```

## Environment-Specific Configuration

### Development Overrides

```typescript
// src/config/index.ts
if (process.env.NODE_ENV === 'development') {
  // Development-specific settings
  config.LOG_LEVEL = 'debug';
  config.PRETTY_LOGS = true;
}
```

### Mock Data & Seeding

Create seed script:

```typescript
// scripts/seed.ts
import { db } from '../src/db';
import { users, sessions, prompts } from '../src/db/schema';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create test user
  const [user] = await db.insert(users).values({
    id: 'user_test',
    email: 'test@example.com',
    name: 'Test User'
  }).returning();

  // Create test sessions
  const [session] = await db.insert(sessions).values({
    id: 'session_test',
    userId: user.id,
    title: 'Test Session'
  }).returning();

  console.log('✅ Seeding complete');
}

seed().catch(console.error);
```

Run with: `pnpm seed`

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Issues

Check PostgreSQL is running:

```bash
# Check status
pg_ctl status
# or
sudo systemctl status postgresql

# Check connection
psql -U postgres -c "SELECT 1"
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check Redis logs
redis-cli monitor
```

### TypeScript Errors

```bash
# Clear build cache
rm -rf dist/

# Check types without building
pnpm type-check

# Restart TS server in VS Code
Cmd+Shift+P > "TypeScript: Restart TS Server"
```

### Migration Issues

```bash
# Check migration status
pnpm migrate:studio

# Rollback last migration (if needed)
# Note: Drizzle doesn't have built-in rollback
# You'll need to manually write a down migration

# Reset database (CAUTION: Data loss!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
pnpm migrate
```

## Performance Tips

1. **Use `tsx watch`** for fast development restarts
2. **Enable TypeScript incremental compilation** in tsconfig.json
3. **Use concurrent** for running multiple processes:

```json
{
  "scripts": {
    "dev:all": "concurrently \"pnpm dev\" \"pnpm migrate:studio\""
  }
}
```

4. **Database query logging** in development:

```typescript
const sql = postgres(getDatabaseUrl(), {
  debug: process.env.NODE_ENV === 'development'
});
```

5. **API Response compression** (already enabled via Fastify)

## VS Code Extensions

Recommended extensions for development:

- **Biome** - Code formatting and linting
- **PostgreSQL** - Database management
- **Thunder Client** - API testing
- **Error Lens** - Inline error display
- **GitLens** - Git insights

## Git Hooks (Optional)

Set up pre-commit hooks with Husky:

```bash
pnpm add -D husky lint-staged
pnpm husky init

# Add to .husky/pre-commit
pnpm lint-staged
```

Configure in package.json:

```json
{
  "lint-staged": {
    "*.{ts,js}": ["pnpm lint:fix", "pnpm type-check"],
    "*.{json,md}": ["pnpm format"]
  }
}
```