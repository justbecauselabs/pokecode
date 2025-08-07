# Claude Code Mobile Backend API Specification

## Overview

This specification defines a Fastify-based backend API service that extends the existing claude-linear infrastructure to support the Claude Code Mobile application. The backend will provide REST endpoints with SSE streaming, leveraging the existing BullMQ queue system and Claude Code SDK integration.

## Architecture

### Technology Stack

- **Framework**: Fastify 5.x with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Queue**: BullMQ with Redis (existing infrastructure)
- **Authentication**: JWT with refresh tokens
- **Validation**: TypeBox for JSON Schema validation
- **Testing**: Vitest for unit/integration tests
- **Documentation**: OpenAPI/Swagger auto-generated from schemas

### System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Mobile Client  │────▶│  Fastify API     │────▶│  BullMQ Queue   │
│  (React Native) │◀────│  (New Service)   │     │  (Existing)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                           │
                               ▼                           ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │   PostgreSQL     │     │  Claude Code    │
                        │   (Sessions DB)  │     │  SDK Worker     │
                        └──────────────────┘     └─────────────────┘
```

## Database Schema

### New Tables with Drizzle ORM

```typescript
// src/db/schema/sessions.ts
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, jsonb, pgEnum, index } from "drizzle-orm/pg-core";

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "inactive",
  "archived"
]);

export const sessions = pgTable("claude_code_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  projectPath: text("project_path").notNull(),
  context: text("context"),
  status: sessionStatusEnum("status").default("active").notNull(),
  metadata: jsonb("metadata").$type<{
    repository?: string;
    branch?: string;
    allowedTools?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull()
}, (table) => ({
  userIdIdx: index("idx_sessions_user_id").on(table.userId),
  statusIdx: index("idx_sessions_status").on(table.status),
  lastAccessedIdx: index("idx_sessions_last_accessed").on(table.lastAccessedAt)
}));

// src/db/schema/prompts.ts
export const promptStatusEnum = pgEnum("prompt_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled"
]);

export const prompts = pgTable("claude_code_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  response: text("response"),
  status: promptStatusEnum("status").default("queued").notNull(),
  jobId: text("job_id"), // BullMQ job ID
  error: text("error"),
  metadata: jsonb("metadata").$type<{
    allowedTools?: string[];
    toolCalls?: Array<{ tool: string; params: any; result?: any }>;
    duration?: number;
    tokenCount?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
}, (table) => ({
  sessionIdIdx: index("idx_prompts_session_id").on(table.sessionId),
  statusIdx: index("idx_prompts_status").on(table.status),
  jobIdIdx: index("idx_prompts_job_id").on(table.jobId)
}));

// src/db/schema/files.ts
export const fileAccessEnum = pgEnum("file_access_type", ["read", "write", "create", "delete"]);

export const fileAccess = pgTable("claude_code_file_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  promptId: uuid("prompt_id").references(() => prompts.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  accessType: fileAccessEnum("access_type").notNull(),
  content: text("content"), // For write operations
  metadata: jsonb("metadata").$type<{
    size?: number;
    mimeType?: string;
    encoding?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  sessionIdIdx: index("idx_file_access_session_id").on(table.sessionId),
  promptIdIdx: index("idx_file_access_prompt_id").on(table.promptId),
  filePathIdx: index("idx_file_access_file_path").on(table.filePath)
}));

// src/db/schema/users.ts
export const users = pgTable("claude_code_users", {
  id: text("id").primaryKey(), // JWT sub claim
  email: text("email").notNull().unique(),
  name: text("name"),
  refreshToken: text("refresh_token"),
  metadata: jsonb("metadata").$type<{
    preferences?: Record<string, any>;
    lastDevice?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at").defaultNow().notNull()
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email)
}));
```

## API Endpoints

### Authentication Endpoints

```typescript
// POST /api/auth/login
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

// POST /api/auth/refresh
interface RefreshRequest {
  refreshToken: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// POST /api/auth/logout
// Headers: Authorization: Bearer <token>
interface LogoutResponse {
  success: boolean;
}
```

### Session Management Endpoints

```typescript
// POST /api/claude-code/sessions
interface CreateSessionRequest {
  projectPath: string;
  context?: string;
  metadata?: {
    repository?: string;
    branch?: string;
    allowedTools?: string[];
  };
}

interface SessionResponse {
  id: string;
  userId: string;
  projectPath: string;
  context?: string;
  status: "active" | "inactive" | "archived";
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

// GET /api/claude-code/sessions
interface ListSessionsQuery {
  status?: "active" | "inactive" | "archived";
  limit?: number;
  offset?: number;
}

interface ListSessionsResponse {
  sessions: SessionResponse[];
  total: number;
  limit: number;
  offset: number;
}

// GET /api/claude-code/sessions/:sessionId
// PATCH /api/claude-code/sessions/:sessionId
// DELETE /api/claude-code/sessions/:sessionId
```

### Prompt Execution Endpoints

```typescript
// POST /api/claude-code/sessions/:sessionId/prompts
interface CreatePromptRequest {
  prompt: string;
  allowedTools?: string[];
}

interface PromptResponse {
  id: string;
  sessionId: string;
  prompt: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  jobId?: string;
  createdAt: string;
}

// GET /api/claude-code/sessions/:sessionId/prompts/:promptId
interface PromptDetailResponse extends PromptResponse {
  response?: string;
  error?: string;
  metadata?: {
    allowedTools?: string[];
    toolCalls?: Array<{ tool: string; params: any; result?: any }>;
    duration?: number;
    tokenCount?: number;
  };
  completedAt?: string;
}

// DELETE /api/claude-code/sessions/:sessionId/prompts/:promptId
// Cancels a running prompt
```

### Server-Sent Events Streaming

```typescript
// GET /api/claude-code/sessions/:sessionId/prompts/:promptId/stream
// Response: EventStream

interface StreamEvent {
  id?: string;
  event: "message" | "tool_use" | "tool_result" | "error" | "complete";
  data: string; // JSON stringified payload
}

// Event payloads:
interface MessageEvent {
  type: "message";
  content: string;
  timestamp: string;
}

interface ToolUseEvent {
  type: "tool_use";
  tool: string;
  params: Record<string, any>;
  timestamp: string;
}

interface ToolResultEvent {
  type: "tool_result";
  tool: string;
  result: string;
  timestamp: string;
}

interface CompleteEvent {
  type: "complete";
  summary: {
    duration: number;
    tokenCount?: number;
    toolCallCount: number;
  };
  timestamp: string;
}
```

### File Access Endpoints

```typescript
// GET /api/claude-code/sessions/:sessionId/files
interface ListFilesQuery {
  path?: string; // Directory path
  recursive?: boolean;
  pattern?: string; // Glob pattern
}

interface FileInfo {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
}

interface ListFilesResponse {
  files: FileInfo[];
  basePath: string;
}

// GET /api/claude-code/sessions/:sessionId/files/*path
interface GetFileResponse {
  path: string;
  content: string;
  encoding: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
}

// POST /api/claude-code/sessions/:sessionId/files/*path
interface CreateFileRequest {
  content: string;
  encoding?: string; // Default: utf-8
}

// PUT /api/claude-code/sessions/:sessionId/files/*path
interface UpdateFileRequest {
  content: string;
  encoding?: string;
}

// DELETE /api/claude-code/sessions/:sessionId/files/*path
```

### History and Export Endpoints

```typescript
// GET /api/claude-code/sessions/:sessionId/history
interface HistoryQuery {
  limit?: number;
  offset?: number;
  includeToolCalls?: boolean;
}

interface HistoryResponse {
  prompts: Array<{
    id: string;
    prompt: string;
    response?: string;
    status: string;
    metadata?: Record<string, any>;
    createdAt: string;
    completedAt?: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

// GET /api/claude-code/sessions/:sessionId/export
interface ExportQuery {
  format: "markdown" | "json";
  includeFiles?: boolean;
}
```

## Fastify Server Implementation

### Project Structure

```
claude-code-api/
├── src/
│   ├── server.ts                 # Fastify server setup
│   ├── app.ts                    # App configuration
│   ├── config/
│   │   ├── index.ts             # Configuration management
│   │   └── env.schema.ts        # Environment validation
│   ├── db/
│   │   ├── index.ts             # Drizzle instance
│   │   ├── schema/              # Table definitions
│   │   └── migrations/          # Database migrations
│   ├── plugins/
│   │   ├── auth.ts              # JWT authentication
│   │   ├── cors.ts              # CORS configuration
│   │   ├── swagger.ts           # API documentation
│   │   └── error-handler.ts     # Global error handling
│   ├── routes/
│   │   ├── auth/                # Authentication routes
│   │   ├── sessions/            # Session management
│   │   ├── prompts/             # Prompt execution
│   │   ├── files/               # File operations
│   │   └── health.ts            # Health check
│   ├── services/
│   │   ├── auth.service.ts      # Authentication logic
│   │   ├── session.service.ts   # Session management
│   │   ├── prompt.service.ts    # Prompt processing
│   │   ├── file.service.ts      # File operations
│   │   └── queue.service.ts     # BullMQ integration
│   ├── schemas/
│   │   ├── auth.schema.ts       # Auth request/response
│   │   ├── session.schema.ts    # Session schemas
│   │   └── prompt.schema.ts     # Prompt schemas
│   ├── hooks/
│   │   ├── auth.hook.ts         # Authentication hooks
│   │   └── rate-limit.hook.ts   # Rate limiting
│   ├── utils/
│   │   ├── jwt.ts               # JWT utilities
│   │   ├── crypto.ts            # Encryption utilities
│   │   └── sse.ts               # SSE helpers
│   └── types/
│       └── index.ts             # TypeScript types
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── fixtures/                # Test fixtures
├── scripts/
│   ├── migrate.ts               # Database migrations
│   └── seed.ts                  # Database seeding
└── package.json
```

### Core Server Setup

```typescript
// src/server.ts
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { app } from './app';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  },
  ajv: {
    customOptions: {
      removeAdditional: 'all',
      coerceTypes: true,
      useDefaults: true
    }
  }
}).withTypeProvider<TypeBoxTypeProvider>();

// Register app
server.register(app);

// Start server
const start = async () => {
  try {
    await server.listen({
      port: parseInt(process.env.PORT || '3001'),
      host: '0.0.0.0'
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

### Authentication Plugin

```typescript
// src/plugins/auth.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Register JWT plugin
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: {
      expiresIn: '15m'
    }
  });

  // Decorate request with user
  fastify.decorateRequest('user', null);

  // Authentication hook
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = await request.jwtVerify();
      request.user = decoded;
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Add auth schema
  fastify.addSchema({
    $id: 'authHeaders',
    type: 'object',
    properties: {
      authorization: Type.String({ pattern: '^Bearer .+$' })
    },
    required: ['authorization']
  });
};

export default fp(authPlugin, {
  name: 'auth'
});
```

### SSE Implementation

```typescript
// src/routes/prompts/stream.ts
import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { Redis } from 'ioredis';

const streamRoute: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL!);

  fastify.get<{
    Params: { sessionId: string; promptId: string };
  }>('/:promptId/stream', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' }),
        promptId: Type.String({ format: 'uuid' })
      })
    },
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const { sessionId, promptId } = request.params;
    
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Subscribe to Redis channel
    const channel = `claude-code:${sessionId}:${promptId}`;
    await redis.subscribe(channel);

    // Send initial connection event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ promptId })}\n\n`);

    // Handle Redis messages
    redis.on('message', (ch, message) => {
      if (ch === channel) {
        const event = JSON.parse(message);
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
        
        if (event.type === 'complete' || event.type === 'error') {
          redis.unsubscribe(channel);
          reply.raw.end();
        }
      }
    });

    // Handle client disconnect
    request.raw.on('close', () => {
      redis.unsubscribe(channel);
      redis.disconnect();
    });
  });
};

export default streamRoute;
```

### Queue Service Integration

```typescript
// src/services/queue.service.ts
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../db';
import { prompts } from '../db/schema/prompts';
import { eq } from 'drizzle-orm';

export class QueueService {
  private queue: Queue;
  private redis: Redis;

  constructor() {
    const connection = new Redis(process.env.REDIS_URL!);
    this.redis = new Redis(process.env.REDIS_URL!);
    this.queue = new Queue('claude-code-jobs', { connection });
  }

  async addPromptJob(sessionId: string, promptId: string, prompt: string, allowedTools?: string[]) {
    const job = await this.queue.add('process-prompt', {
      sessionId,
      promptId,
      prompt,
      allowedTools,
      projectPath: await this.getProjectPath(sessionId)
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    // Update prompt with job ID
    await db.update(prompts)
      .set({ jobId: job.id, status: 'processing' })
      .where(eq(prompts.id, promptId));

    return job.id;
  }

  async publishEvent(sessionId: string, promptId: string, event: any) {
    const channel = `claude-code:${sessionId}:${promptId}`;
    await this.redis.publish(channel, JSON.stringify(event));
  }

  private async getProjectPath(sessionId: string): Promise<string> {
    // Get project path from session
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId)
    });
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    return session.projectPath;
  }
}
```

### File Service with Sandboxing

```typescript
// src/services/file.service.ts
import { FastifyPluginAsync } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { Type } from '@sinclair/typebox';

export class FileService {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async validatePath(sessionPath: string, requestedPath: string): Promise<string> {
    // Resolve and normalize paths
    const resolvedBase = path.resolve(this.baseDir, sessionPath);
    const resolvedPath = path.resolve(resolvedBase, requestedPath);

    // Ensure requested path is within session directory
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error('Path traversal attempt detected');
    }

    return resolvedPath;
  }

  async listFiles(sessionPath: string, dirPath: string = '.', options: { recursive?: boolean; pattern?: string } = {}) {
    const validPath = await this.validatePath(sessionPath, dirPath);
    
    const files: FileInfo[] = [];
    const entries = await fs.readdir(validPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(validPath, entry.name);
      const relativePath = path.relative(sessionPath, fullPath);

      if (entry.isDirectory()) {
        files.push({
          path: relativePath,
          name: entry.name,
          type: 'directory'
        });

        if (options.recursive) {
          const subFiles = await this.listFiles(sessionPath, relativePath, options);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        files.push({
          path: relativePath,
          name: entry.name,
          type: 'file',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString()
        });
      }
    }

    return files;
  }

  async readFile(sessionPath: string, filePath: string): Promise<GetFileResponse> {
    const validPath = await this.validatePath(sessionPath, filePath);
    
    const content = await fs.readFile(validPath, 'utf-8');
    const stats = await fs.stat(validPath);
    
    return {
      path: filePath,
      content,
      encoding: 'utf-8',
      size: stats.size,
      mimeType: this.getMimeType(filePath),
      modifiedAt: stats.mtime.toISOString()
    };
  }

  async writeFile(sessionPath: string, filePath: string, content: string, encoding = 'utf-8') {
    const validPath = await this.validatePath(sessionPath, filePath);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(validPath), { recursive: true });
    
    // Write file
    await fs.writeFile(validPath, content, encoding);
    
    // Log file access
    await this.logFileAccess(sessionPath, filePath, 'write', content);
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async logFileAccess(sessionPath: string, filePath: string, accessType: string, content?: string) {
    // Implementation for logging file access to database
  }
}
```

## Security Implementation

### JWT Token Management

```typescript
// src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface TokenPayload {
  sub: string; // user ID
  email: string;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiry = '15m';
  private readonly refreshExpiry = '7d';

  constructor() {
    this.accessSecret = process.env.JWT_ACCESS_SECRET!;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET!;
  }

  generateTokenPair(payload: Omit<TokenPayload, 'iat' | 'exp'>) {
    const accessToken = jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessExpiry
    });

    const refreshToken = jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiry
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.accessSecret) as TokenPayload;
  }

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, this.refreshSecret) as TokenPayload;
  }

  async rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.verifyRefreshToken(oldToken);
    
    // Invalidate old token (store in Redis blacklist)
    await this.blacklistToken(oldToken);
    
    // Generate new pair
    return this.generateTokenPair({
      sub: payload.sub,
      email: payload.email
    });
  }

  private async blacklistToken(token: string) {
    // Implementation for token blacklisting
  }
}
```

### Rate Limiting

```typescript
// src/hooks/rate-limit.hook.ts
import { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL!);

  await fastify.register(rateLimit, {
    global: false,
    redis,
    nameSpace: 'claude-code-rate-limit:',
    keyGenerator: (req) => {
      return req.user?.sub || req.ip;
    },
    errorResponseBuilder: (req, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${context.after}`,
        rateLimit: {
          limit: context.max,
          remaining: context.remaining,
          reset: new Date(context.reset).toISOString()
        }
      };
    }
  });

  // Define rate limit configurations
  fastify.decorate('rateLimits', {
    // Strict limit for prompt execution
    prompt: {
      max: 10,
      timeWindow: '1 minute'
    },
    // Moderate limit for file operations
    file: {
      max: 100,
      timeWindow: '1 minute'
    },
    // Lenient limit for read operations
    read: {
      max: 1000,
      timeWindow: '1 minute'
    }
  });
};

export default fp(rateLimitPlugin);
```

### Input Validation

```typescript
// src/schemas/validation.ts
import { Type, Static } from '@sinclair/typebox';

// Common validation patterns
export const patterns = {
  uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  safePath: '^[a-zA-Z0-9._/-]+$', // No .. or absolute paths
  projectPath: '^[a-zA-Z0-9._/-]+$' // Restricted project paths
};

// Path validation schema
export const FilePathSchema = Type.String({
  pattern: patterns.safePath,
  maxLength: 255,
  description: 'Safe file path without traversal attempts'
});

// Prompt validation
export const PromptSchema = Type.Object({
  prompt: Type.String({
    minLength: 1,
    maxLength: 10000,
    description: 'User prompt for Claude Code'
  }),
  allowedTools: Type.Optional(Type.Array(
    Type.Union([
      Type.Literal('Bash'),
      Type.Literal('Read'),
      Type.Literal('Write'),
      Type.Literal('Glob'),
      Type.Literal('Grep'),
      Type.Literal('Task')
    ])
  ))
});

// Session validation
export const SessionSchema = Type.Object({
  projectPath: Type.String({
    pattern: patterns.projectPath,
    description: 'Project directory path'
  }),
  context: Type.Optional(Type.String({
    maxLength: 5000,
    description: 'Additional context for the session'
  })),
  metadata: Type.Optional(Type.Object({
    repository: Type.Optional(Type.String()),
    branch: Type.Optional(Type.String()),
    allowedTools: Type.Optional(Type.Array(Type.String()))
  }))
});
```

## Testing Strategy

### Unit Testing

```typescript
// tests/unit/services/session.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionService } from '../../../src/services/session.service';
import { db } from '../../../src/db';

vi.mock('../../../src/db');

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    service = new SessionService();
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with valid data', async () => {
      const userId = 'user-123';
      const sessionData = {
        projectPath: '/projects/test',
        context: 'Test context'
      };

      const mockSession = {
        id: 'session-123',
        userId,
        ...sessionData,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date()
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSession])
        })
      });

      const result = await service.createSession(userId, sessionData);

      expect(result).toEqual(mockSession);
      expect(db.insert).toHaveBeenCalledWith(sessions);
    });

    it('should validate project path to prevent traversal', async () => {
      const userId = 'user-123';
      const maliciousData = {
        projectPath: '../../etc/passwd',
        context: 'Malicious attempt'
      };

      await expect(
        service.createSession(userId, maliciousData)
      ).rejects.toThrow('Invalid project path');
    });
  });
});
```

### Integration Testing

```typescript
// tests/integration/routes/prompts.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../../src/app';
import { FastifyInstance } from 'fastify';

describe('Prompts API', () => {
  let app: FastifyInstance;
  let authToken: string;
  let sessionId: string;

  beforeAll(async () => {
    app = await build({ logger: false });
    
    // Create test user and get auth token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'testpass123'
      }
    });
    
    authToken = JSON.parse(loginRes.body).accessToken;
    
    // Create test session
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/claude-code/sessions',
      headers: {
        authorization: `Bearer ${authToken}`
      },
      payload: {
        projectPath: '/test/project'
      }
    });
    
    sessionId = JSON.parse(sessionRes.body).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /sessions/:sessionId/prompts', () => {
    it('should create a new prompt', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/claude-code/sessions/${sessionId}/prompts`,
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          prompt: 'Analyze the project structure',
          allowedTools: ['Read', 'Glob']
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body.status).toBe('queued');
    });

    it('should enforce rate limiting', async () => {
      // Send multiple requests to trigger rate limit
      const requests = Array(15).fill(null).map(() =>
        app.inject({
          method: 'POST',
          url: `/api/claude-code/sessions/${sessionId}/prompts`,
          headers: {
            authorization: `Bearer ${authToken}`
          },
          payload: {
            prompt: 'Test prompt'
          }
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.statusCode === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
```

### E2E Testing

```typescript
// tests/e2e/prompt-execution.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '../utils/test-client';
import { waitForJobCompletion } from '../utils/test-helpers';

describe('Prompt Execution E2E', () => {
  let client: Client;
  let sessionId: string;

  beforeAll(async () => {
    client = new Client();
    await client.authenticate();
    
    const session = await client.createSession({
      projectPath: '/test/project',
      context: 'E2E test session'
    });
    
    sessionId = session.id;
  });

  it('should execute a prompt and stream results', async () => {
    // Create prompt
    const prompt = await client.createPrompt(sessionId, {
      prompt: 'List all TypeScript files in the project',
      allowedTools: ['Glob']
    });

    // Connect to SSE stream
    const events: any[] = [];
    const stream = client.streamPrompt(sessionId, prompt.id);
    
    stream.on('message', (event) => events.push(event));
    stream.on('tool_use', (event) => events.push(event));
    stream.on('complete', (event) => {
      events.push(event);
      stream.close();
    });

    // Wait for completion
    await waitForJobCompletion(prompt.id, 30000);

    // Verify events were received
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.type === 'tool_use')).toBe(true);
    expect(events.some(e => e.type === 'complete')).toBe(true);

    // Verify prompt status
    const updatedPrompt = await client.getPrompt(sessionId, prompt.id);
    expect(updatedPrompt.status).toBe('completed');
    expect(updatedPrompt.response).toBeTruthy();
  });
});
```

## Performance Optimization

### Database Optimization

```typescript
// src/db/indexes.ts
import { sql } from 'drizzle-orm';

// Create optimized indexes for common queries
export const createIndexes = async (db: any) => {
  // Session lookup by user and status
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_status 
    ON claude_code_sessions(user_id, status) 
    WHERE status = 'active'
  `);

  // Prompt lookup by session and status
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_session_status 
    ON claude_code_prompts(session_id, status) 
    WHERE status IN ('queued', 'processing')
  `);

  // File access pattern analysis
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_file_access_pattern 
    ON claude_code_file_access(session_id, file_path, created_at DESC)
  `);
};

// Query optimization examples
export const optimizedQueries = {
  // Get active sessions for user with pagination
  getActiveSessions: sql`
    SELECT * FROM claude_code_sessions
    WHERE user_id = $1 AND status = 'active'
    ORDER BY last_accessed_at DESC
    LIMIT $2 OFFSET $3
  `,

  // Get recent prompts with metadata
  getRecentPrompts: sql`
    SELECT 
      p.*,
      COUNT(fa.id) as file_access_count
    FROM claude_code_prompts p
    LEFT JOIN claude_code_file_access fa ON fa.prompt_id = p.id
    WHERE p.session_id = $1
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT $2
  `
};
```

### Caching Strategy

```typescript
// src/services/cache.service.ts
import { Redis } from 'ioredis';
import { LRUCache } from 'lru-cache';

export class CacheService {
  private redis: Redis;
  private memoryCache: LRUCache<string, any>;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    
    // In-memory LRU cache for hot data
    this.memoryCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true
    });
  }

  // Two-tier caching: memory -> Redis -> database
  async get<T>(key: string, fetcher: () => Promise<T>, ttl = 300): Promise<T> {
    // Check memory cache first
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== undefined) {
      return memoryValue;
    }

    // Check Redis
    const redisValue = await this.redis.get(key);
    if (redisValue) {
      const parsed = JSON.parse(redisValue);
      this.memoryCache.set(key, parsed);
      return parsed;
    }

    // Fetch from source
    const value = await fetcher();
    
    // Store in both caches
    await this.redis.setex(key, ttl, JSON.stringify(value));
    this.memoryCache.set(key, value);
    
    return value;
  }

  // Cache invalidation
  async invalidate(pattern: string) {
    // Clear from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.match(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from Redis
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Connection Pooling

```typescript
// src/db/connection-pool.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Create optimized connection pool
const sql = postgres({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Connection pool settings
  max: 20,                    // Maximum connections
  idle_timeout: 20,           // Close idle connections after 20s
  connect_timeout: 10,        // Connection timeout 10s
  
  // Performance settings
  prepare: true,              // Use prepared statements
  types: {
    bigint: postgres.BigInt,
  },
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  
  // Connection lifecycle hooks
  onnotice: (notice) => {
    console.log('Database notice:', notice);
  },
  
  onclose: (connId) => {
    console.log(`Database connection ${connId} closed`);
  }
});

export const db = drizzle(sql);
```

## Deployment Configuration

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json ./
RUN bun install --production

# Build
FROM base AS builder
COPY package*.json ./
RUN bun install
COPY . .
RUN bun run build

# Runtime
FROM base AS runner
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER fastify
EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### Environment Variables

```bash
# .env.example
# Server Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=claude_code_mobile
DB_USER=postgres
DB_PASSWORD=

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# Claude Configuration
ANTHROPIC_API_KEY=

# File Storage
FILE_STORAGE_BASE=/var/claude-code/projects

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=*
```

### Health Check Endpoint

```typescript
// src/routes/health.ts
import { FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { Redis } from 'ioredis';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                redis: { type: 'string' },
                queue: { type: 'string' }
              }
            },
            version: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const checks = {
      database: 'unknown',
      redis: 'unknown',
      queue: 'unknown'
    };

    // Check database
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = 'healthy';
    } catch (error) {
      checks.database = 'unhealthy';
    }

    // Check Redis
    try {
      const redis = new Redis(process.env.REDIS_URL!);
      await redis.ping();
      checks.redis = 'healthy';
      redis.disconnect();
    } catch (error) {
      checks.redis = 'unhealthy';
    }

    // Check queue connectivity
    try {
      const queue = new Queue('claude-code-jobs');
      await queue.getJobCounts();
      checks.queue = 'healthy';
    } catch (error) {
      checks.queue = 'unhealthy';
    }

    const allHealthy = Object.values(checks).every(s => s === 'healthy');

    return reply.code(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: checks,
      version: process.env.npm_package_version || '1.0.0'
    });
  });
};

export default healthRoute;
```

## Monitoring and Observability

### Logging Configuration

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.ip,
      remotePort: req.socket.remotePort
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.getHeaders()
    })
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]'
  }
});
```

### Metrics Collection

```typescript
// src/plugins/metrics.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import promClient from 'prom-client';

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  // Create metrics registry
  const register = new promClient.Registry();
  promClient.collectDefaultMetrics({ register });

  // Custom metrics
  const httpDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
  });

  const promptsTotal = new promClient.Counter({
    name: 'claude_code_prompts_total',
    help: 'Total number of prompts processed',
    labelNames: ['status'],
    registers: [register]
  });

  const activeSessionsGauge = new promClient.Gauge({
    name: 'claude_code_active_sessions',
    help: 'Number of active sessions',
    registers: [register]
  });

  // Track request metrics
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = (Date.now() - request.startTime) / 1000;
    httpDuration
      .labels(request.method, request.routerPath || request.url, reply.statusCode.toString())
      .observe(duration);
  });

  // Expose metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    reply.type('text/plain');
    return register.metrics();
  });

  // Decorate fastify with metrics
  fastify.decorate('metrics', {
    promptsTotal,
    activeSessionsGauge
  });
};

export default fp(metricsPlugin);
```

## Migration from Next.js

### Gradual Migration Strategy

1. **Phase 1**: Run Fastify API alongside Next.js
   - Deploy Fastify API on separate port
   - Proxy `/api/claude-code/*` routes from Next.js to Fastify
   - Share Redis and PostgreSQL connections

2. **Phase 2**: Migrate authentication
   - Implement JWT authentication in Fastify
   - Create token exchange endpoint for existing sessions
   - Update mobile client to use new auth flow

3. **Phase 3**: Full migration
   - Move all Claude Code endpoints to Fastify
   - Update worker to publish to Fastify SSE
   - Deprecate Next.js API routes

### Proxy Configuration

```typescript
// Next.js middleware.ts for proxying
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Proxy claude-code routes to Fastify
  if (request.nextUrl.pathname.startsWith('/api/claude-code')) {
    const fastifyUrl = new URL(request.nextUrl.pathname, process.env.FASTIFY_URL);
    fastifyUrl.search = request.nextUrl.search;

    return NextResponse.rewrite(fastifyUrl, {
      headers: {
        ...request.headers,
        'X-Forwarded-For': request.ip || '',
        'X-Forwarded-Host': request.headers.get('host') || '',
        'X-Forwarded-Proto': request.nextUrl.protocol.replace(':', '')
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/claude-code/:path*'
};
```

## Summary

This backend specification provides a comprehensive foundation for the Claude Code Mobile API:

1. **Type-safe Fastify API** with TypeBox validation
2. **PostgreSQL with Drizzle ORM** for session and prompt management
3. **SSE streaming** for real-time Claude responses
4. **BullMQ integration** for async job processing
5. **JWT authentication** with refresh tokens
6. **File sandboxing** for secure project access
7. **Comprehensive testing** strategy
8. **Performance optimizations** including caching and connection pooling
9. **Production-ready** deployment configuration
10. **Monitoring and observability** with metrics and logging

The architecture is designed to scale horizontally, integrate seamlessly with the existing claude-linear infrastructure, and provide a robust API for the mobile application.