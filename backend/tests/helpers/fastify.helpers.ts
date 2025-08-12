import { FastifyInstance } from 'fastify';
import { build } from '@/app';
import { initTestDatabase, cleanupTestDatabase } from './database.helpers';
import { createMockClaudeDirectoryService, mockClaudeDirectoryModule } from './claude-directory.mock';

/**
 * Create a Fastify instance for testing
 */
export async function createTestApp(): Promise<FastifyInstance> {
  // Initialize test database
  await initTestDatabase();
  
  // Set up mocks
  const mockClaudeService = createMockClaudeDirectoryService();
  mockClaudeDirectoryModule(mockClaudeService);

  // Build the Fastify app
  const app = await build({ logger: false });
  
  return app;
}

/**
 * Clean up after tests
 */
export async function cleanupTestApp(app: FastifyInstance) {
  await cleanupTestDatabase();
  await app.close();
}

/**
 * Create test JWT token for authentication
 */
export function createTestJWTToken(app: FastifyInstance, payload: object = {}) {
  const defaultPayload = {
    sub: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    ...payload,
  };
  
  return app.jwt.sign(defaultPayload);
}

/**
 * Helper to make authenticated requests
 */
export async function makeAuthenticatedRequest(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  payload?: any,
  token?: string,
) {
  const authToken = token || createTestJWTToken(app);
  
  const options: any = {
    method,
    url,
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  };

  if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.payload = payload;
    options.headers['content-type'] = 'application/json';
  }

  return app.inject(options);
}

/**
 * Helper to make unauthenticated requests
 */
export async function makeRequest(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  payload?: any,
) {
  const options: any = {
    method,
    url,
  };

  if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.payload = payload;
    options.headers = {
      'content-type': 'application/json',
    };
  }

  return app.inject(options);
}

/**
 * Helper to parse JSON response
 */
export function parseResponse<T = any>(response: any): T {
  return JSON.parse(response.body);
}

/**
 * Assert that a response is successful
 */
export function assertSuccessResponse(response: any, expectedStatus = 200) {
  if (response.statusCode !== expectedStatus) {
    console.error('Response body:', response.body);
    throw new Error(
      `Expected status ${expectedStatus} but got ${response.statusCode}: ${response.body}`
    );
  }
}

/**
 * Assert that a response is an error
 */
export function assertErrorResponse(response: any, expectedStatus: number, expectedMessage?: string) {
  if (response.statusCode !== expectedStatus) {
    console.error('Response body:', response.body);
    throw new Error(
      `Expected status ${expectedStatus} but got ${response.statusCode}: ${response.body}`
    );
  }

  if (expectedMessage) {
    const body = parseResponse(response);
    if (!body.message || !body.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error message to contain "${expectedMessage}" but got: ${body.message}`
      );
    }
  }
}

/**
 * Helper to generate unique test identifiers
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}