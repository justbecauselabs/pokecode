# Testing Documentation

This guide covers testing strategies, patterns, and how to write effective tests for the Claude Code Mobile backend.

## Testing Stack

- **Vitest**: Fast unit test runner with native TypeScript support
- **@vitest/ui**: Interactive UI for test exploration
- **@vitest/coverage-v8**: Code coverage reporting
- **Fastify Test Helpers**: Built-in testing utilities

## Test Structure

Tests are organized in the `/tests` directory:

```
/tests
├── setup.ts           # Global test setup
├── unit/             # Unit tests
│   ├── config.test.ts
│   ├── services/
│   └── utils/
├── integration/      # Integration tests
│   ├── routes/
│   └── db/
└── e2e/             # End-to-end tests
```

## Running Tests

```bash
# Run all tests once
bun test

# Run tests in watch mode
bun test:watch

# Run with UI
bun test:ui

# Run with coverage
bun test:coverage
```

## Unit Testing

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('UserService', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        name: 'Test User'
      };

      // Act
      const user = await userService.createUser(userData);

      // Assert
      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.id).toMatch(/^user_/);
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData = { email: 'existing@example.com' };
      await userService.createUser(userData);

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow('Email already exists');
    });
  });
});
```

### Mocking Dependencies

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import * as userService from '@/services/user.service';

// Mock the database module
vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn()
      }
    }
  }
}));

describe('UserService with mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call database insert', async () => {
    // Arrange
    const mockUser = { id: 'user_123', email: 'test@example.com' };
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockUser])
      })
    });

    // Act
    const result = await userService.createUser({ email: 'test@example.com' });

    // Assert
    expect(db.insert).toHaveBeenCalledWith(users);
    expect(result).toEqual(mockUser);
  });
});
```

## Integration Testing

### Testing Fastify Routes

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '@/app';
import type { FastifyInstance } from 'fastify';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: expect.stringMatching(/healthy|unhealthy/),
      timestamp: expect.any(String),
      services: expect.objectContaining({
        database: expect.any(String),
        redis: expect.any(String),
        queue: expect.any(String)
      })
    });
  });
});
```

### Testing Authenticated Routes

```typescript
describe('Protected routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();

    // Get auth token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password123'
      }
    });

    authToken = loginResponse.json().accessToken;
  });

  it('should access protected route with valid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/claude-code/sessions',
      headers: {
        authorization: `Bearer ${authToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('sessions');
  });

  it('should reject request without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/claude-code/sessions'
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: 'UNAUTHORIZED',
      message: expect.any(String)
    });
  });
});
```

## Database Testing

### Test Database Setup

```typescript
// tests/helpers/db.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '@/db/schema';

export async function setupTestDatabase() {
  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://localhost/test';
  const sql = postgres(testDbUrl);
  const db = drizzle(sql, { schema });

  // Run migrations
  await migrate(db, { migrationsFolder: './drizzle' });

  return { db, sql };
}

export async function cleanupTestDatabase(sql: postgres.Sql) {
  // Clean all tables
  await sql`TRUNCATE TABLE claude_code_users CASCADE`;
  await sql.end();
}
```

### Database Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/db';
import { users } from '@/db/schema';

describe('User database operations', () => {
  let db: PostgresJsDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    ({ db, sql } = await setupTestDatabase());
  });

  afterAll(async () => {
    await cleanupTestDatabase(sql);
  });

  it('should create and retrieve user', async () => {
    // Create user
    const [created] = await db.insert(users)
      .values({
        id: 'test_user_1',
        email: 'test@example.com',
        name: 'Test User'
      })
      .returning();

    expect(created).toBeDefined();
    expect(created.email).toBe('test@example.com');

    // Retrieve user
    const found = await db.query.users.findFirst({
      where: eq(users.id, 'test_user_1')
    });

    expect(found).toEqual(created);
  });
});
```

## Testing Services

### Service Test Example

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as sessionService from '@/services/session.service';
import { db } from '@/db';

vi.mock('@/db');

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create session with generated ID', async () => {
      // Arrange
      const userId = 'user_123';
      const sessionData = { title: 'Test Session' };
      
      vi.mocked(db.insert).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'session_123',
            userId,
            title: sessionData.title,
            createdAt: new Date()
          }])
        })
      }));

      // Act
      const session = await sessionService.createSession(userId, sessionData);

      // Assert
      expect(session).toMatchObject({
        id: expect.stringMatching(/^session_/),
        userId,
        title: sessionData.title
      });
    });
  });
});
```

## Testing Utilities

### Custom Test Helpers

```typescript
// tests/helpers/auth.ts
export function createMockUser(overrides = {}) {
  return {
    id: 'user_test_123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    lastLoginAt: new Date(),
    ...overrides
  };
}

export function createAuthHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`
  };
}

// tests/helpers/fixtures.ts
export const fixtures = {
  validSession: {
    id: 'session_123',
    userId: 'user_123',
    title: 'Test Session',
    model: 'claude-3-opus',
    createdAt: new Date()
  },
  
  validPrompt: {
    id: 'prompt_123',
    sessionId: 'session_123',
    userId: 'user_123',
    content: 'Test prompt',
    role: 'user' as const
  }
};
```

## Testing Error Scenarios

```typescript
describe('Error handling', () => {
  it('should handle database connection errors', async () => {
    // Mock database error
    vi.mocked(db.select).mockRejectedValue(
      new Error('Connection refused')
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/claude-code/sessions',
      headers: createAuthHeaders(token)
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    });
  });

  it('should validate request body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/claude-code/sessions',
      headers: createAuthHeaders(token),
      payload: {
        // Missing required field: title
        model: 'claude-3-opus'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: expect.arrayContaining([
        expect.objectContaining({
          field: 'title',
          message: expect.any(String)
        })
      ])
    });
  });
});
```

## Test Coverage

### Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
```

## Best Practices

1. **Test Naming**: Use descriptive test names that explain what is being tested
   ```typescript
   it('should return 404 when session does not exist')
   ```

2. **AAA Pattern**: Arrange, Act, Assert
   ```typescript
   it('should update user name', async () => {
     // Arrange
     const user = await createUser();
     
     // Act
     const updated = await updateUser(user.id, { name: 'New Name' });
     
     // Assert
     expect(updated.name).toBe('New Name');
   });
   ```

3. **Test Isolation**: Each test should be independent
4. **Mock External Dependencies**: Mock APIs, databases, file systems
5. **Test Edge Cases**: Empty arrays, null values, errors
6. **Use Fixtures**: Create reusable test data
7. **Test Public APIs**: Focus on testing public interfaces, not implementation details

## Testing Async Operations

```typescript
describe('Async operations', () => {
  it('should handle promises correctly', async () => {
    const result = await someAsyncFunction();
    expect(result).toBeDefined();
  });

  it('should handle promise rejection', async () => {
    await expect(failingAsyncFunction())
      .rejects.toThrow('Expected error');
  });

  it('should timeout long operations', async () => {
    await expect(
      Promise.race([
        longRunningOperation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 1000)
        )
      ])
    ).rejects.toThrow('Timeout');
  }, 2000); // Increase test timeout
});
```

## Snapshot Testing

```typescript
it('should match response structure', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/claude-code/sessions/123'
  });

  expect(response.json()).toMatchSnapshot({
    id: expect.any(String),
    createdAt: expect.any(String),
    updatedAt: expect.any(String)
  });
});
```