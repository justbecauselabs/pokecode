import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, cleanupTestApp, makeRequest, parseResponse, assertSuccessResponse } from '../helpers/fastify.helpers';

// Mock external dependencies for health checks
vi.mock('ioredis');
vi.mock('bullmq');

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  describe('GET /health', () => {
    it('should return health status with all services', async () => {
      const response = await makeRequest(app, 'GET', '/health');
      
      expect(response.statusCode).toBeOneOf([200, 503]);
      
      const body = parseResponse(response);
      expect(body).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy)$/),
        timestamp: expect.any(String),
        services: {
          database: expect.stringMatching(/^(healthy|unhealthy|unknown)$/),
          redis: expect.stringMatching(/^(healthy|unhealthy|unknown)$/),
          queue: expect.stringMatching(/^(healthy|unhealthy|unknown)$/),
        },
        version: expect.any(String),
        uptime: expect.any(Number),
      });
    });

    it('should return 503 when database is unhealthy', async () => {
      // Mock database health check to fail
      vi.doMock('@/db', () => ({
        checkDatabaseHealth: vi.fn(() => Promise.resolve(false)),
      }));

      const response = await makeRequest(app, 'GET', '/health');
      
      expect(response.statusCode).toBe(503);
      
      const body = parseResponse(response);
      expect(body.status).toBe('unhealthy');
      expect(body.services.database).toBe('unhealthy');
    });

    it('should handle database timeout gracefully', async () => {
      // Mock database health check to timeout
      vi.doMock('@/db', () => ({
        checkDatabaseHealth: vi.fn(() => new Promise(() => {})), // Never resolves
      }));

      const response = await makeRequest(app, 'GET', '/health');
      
      expect(response.statusCode).toBe(503);
      
      const body = parseResponse(response);
      expect(body.status).toBe('unhealthy');
    });

    it('should include proper timestamps', async () => {
      const response = await makeRequest(app, 'GET', '/health');
      
      const body = parseResponse(response);
      expect(new Date(body.timestamp).getTime()).toBeGreaterThan(Date.now() - 5000);
      expect(new Date(body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should include uptime information', async () => {
      const response = await makeRequest(app, 'GET', '/health');
      
      const body = parseResponse(response);
      expect(body.uptime).toBeGreaterThan(0);
      expect(typeof body.uptime).toBe('number');
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await makeRequest(app, 'GET', '/health/live');
      
      assertSuccessResponse(response, 200);
      
      const body = parseResponse(response);
      expect(body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });

    it('should always return 200 for liveness check', async () => {
      // Even if other services are down, liveness should pass
      const response = await makeRequest(app, 'GET', '/health/live');
      
      expect(response.statusCode).toBe(200);
    });

    it('should include current timestamp', async () => {
      const beforeRequest = Date.now();
      const response = await makeRequest(app, 'GET', '/health/live');
      const afterRequest = Date.now();
      
      const body = parseResponse(response);
      const timestamp = new Date(body.timestamp).getTime();
      
      expect(timestamp).toBeGreaterThanOrEqual(beforeRequest);
      expect(timestamp).toBeLessThanOrEqual(afterRequest);
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status when database is healthy', async () => {
      // Mock database health check to succeed
      vi.doMock('@/db', () => ({
        checkDatabaseHealth: vi.fn(() => Promise.resolve(true)),
      }));

      const response = await makeRequest(app, 'GET', '/health/ready');
      
      assertSuccessResponse(response, 200);
      
      const body = parseResponse(response);
      expect(body).toMatchObject({
        status: 'ready',
        timestamp: expect.any(String),
      });
    });

    it('should return 503 when database is not ready', async () => {
      // Mock database health check to fail
      vi.doMock('@/db', () => ({
        checkDatabaseHealth: vi.fn(() => Promise.resolve(false)),
      }));

      const response = await makeRequest(app, 'GET', '/health/ready');
      
      expect(response.statusCode).toBe(503);
      
      const body = parseResponse(response);
      expect(body).toMatchObject({
        status: 'not_ready',
        timestamp: expect.any(String),
        reason: 'Database not ready',
      });
    });

    it('should return 503 when database check throws error', async () => {
      // Mock database health check to throw
      vi.doMock('@/db', () => ({
        checkDatabaseHealth: vi.fn(() => Promise.reject(new Error('DB Error'))),
      }));

      const response = await makeRequest(app, 'GET', '/health/ready');
      
      expect(response.statusCode).toBe(503);
      
      const body = parseResponse(response);
      expect(body).toMatchObject({
        status: 'not_ready',
        timestamp: expect.any(String),
        reason: 'Database check failed',
      });
    });

    it('should handle database timeout with shorter timeout than health check', async () => {
      // Mock database health check to timeout (readiness has 2s timeout vs health 5s)
      vi.doMock('@/db', () => ({
        checkDatabaseHealth: vi.fn(() => new Promise(resolve => setTimeout(() => resolve(true), 3000))),
      }));

      const response = await makeRequest(app, 'GET', '/health/ready');
      
      expect(response.statusCode).toBe(503);
      
      const body = parseResponse(response);
      expect(body.status).toBe('not_ready');
      expect(body.reason).toBe('Database not ready');
    });
  });

  describe('Schema validation', () => {
    it('should validate health response schema', async () => {
      const response = await makeRequest(app, 'GET', '/health');
      
      const body = parseResponse(response);
      
      // Validate required fields
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('services');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('uptime');
      
      // Validate services object
      expect(body.services).toHaveProperty('database');
      expect(body.services).toHaveProperty('redis');
      expect(body.services).toHaveProperty('queue');
    });

    it('should validate liveness response schema', async () => {
      const response = await makeRequest(app, 'GET', '/health/live');
      
      const body = parseResponse(response);
      
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body.status).toBe('ok');
    });

    it('should validate readiness response schema', async () => {
      const response = await makeRequest(app, 'GET', '/health/ready');
      
      const body = parseResponse(response);
      
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body.status).toMatch(/^(ready|not_ready)$/);
      
      if (body.status === 'not_ready') {
        expect(body).toHaveProperty('reason');
      }
    });
  });

  describe('Error handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Redis mock will fail by default in test environment
      const response = await makeRequest(app, 'GET', '/health');
      
      const body = parseResponse(response);
      // Should not crash the health check
      expect(['healthy', 'unhealthy', 'unknown']).toContain(body.services.redis);
    });

    it('should handle queue connection failures gracefully', async () => {
      // Queue mock will fail by default in test environment
      const response = await makeRequest(app, 'GET', '/health');
      
      const body = parseResponse(response);
      // Should not crash the health check
      expect(['healthy', 'unhealthy', 'unknown']).toContain(body.services.queue);
    });
  });

  describe('Performance', () => {
    it('should respond to liveness check quickly', async () => {
      const start = Date.now();
      const response = await makeRequest(app, 'GET', '/health/live');
      const duration = Date.now() - start;
      
      assertSuccessResponse(response, 200);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should respond to readiness check within timeout', async () => {
      const start = Date.now();
      const response = await makeRequest(app, 'GET', '/health/ready');
      const duration = Date.now() - start;
      
      // Should complete within the 2s timeout plus some buffer
      expect(duration).toBeLessThan(3000);
    });
  });
});