import { Type } from '@sinclair/typebox';
import { Queue } from 'bullmq';
import type { FastifyPluginAsync } from 'fastify';
import { Redis } from 'ioredis';
import { config } from '@/config';
import { checkDatabaseHealth } from '@/db';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.Union([Type.Literal('healthy'), Type.Literal('unhealthy')]),
            timestamp: Type.String({ format: 'date-time' }),
            services: Type.Object({
              database: Type.Union([
                Type.Literal('healthy'),
                Type.Literal('unhealthy'),
                Type.Literal('unknown'),
              ]),
              redis: Type.Union([
                Type.Literal('healthy'),
                Type.Literal('unhealthy'),
                Type.Literal('unknown'),
              ]),
              queue: Type.Union([
                Type.Literal('healthy'),
                Type.Literal('unhealthy'),
                Type.Literal('unknown'),
              ]),
            }),
            version: Type.String(),
            uptime: Type.Number(),
          }),
          503: Type.Object({
            status: Type.Union([Type.Literal('healthy'), Type.Literal('unhealthy')]),
            timestamp: Type.String({ format: 'date-time' }),
            services: Type.Object({
              database: Type.Union([
                Type.Literal('healthy'),
                Type.Literal('unhealthy'),
                Type.Literal('unknown'),
              ]),
              redis: Type.Union([
                Type.Literal('healthy'),
                Type.Literal('unhealthy'),
                Type.Literal('unknown'),
              ]),
              queue: Type.Union([
                Type.Literal('healthy'),
                Type.Literal('unhealthy'),
                Type.Literal('unknown'),
              ]),
            }),
            version: Type.String(),
            uptime: Type.Number(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const startTime = Date.now();
      const checks = {
        database: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
        redis: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
        queue: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
      };

      // Check database with timeout
      try {
        const dbHealthy = await Promise.race([
          checkDatabaseHealth(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
        ]);
        checks.database = dbHealthy ? 'healthy' : 'unhealthy';
      } catch (error) {
        fastify.log.error('Database health check failed:', error);
        checks.database = 'unhealthy';
      }

      // Check Redis with timeout
      let redis: Redis | null = null;
      try {
        redis = new Redis(config.REDIS_URL, {
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 5000,
        });

        await redis.connect();
        const pong = await redis.ping();
        checks.redis = pong === 'PONG' ? 'healthy' : 'unhealthy';
      } catch (error) {
        fastify.log.error('Redis health check failed:', error);
        checks.redis = 'unhealthy';
      } finally {
        if (redis) {
          await redis.quit();
        }
      }

      // Check queue connectivity
      let queue: Queue | null = null;
      try {
        const connection = new Redis(config.REDIS_URL, {
          maxRetriesPerRequest: null,
          connectTimeout: 5000,
        });

        queue = new Queue('claude-code-jobs', { connection });
        const counts = await Promise.race([
          queue.getJobCounts(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);

        checks.queue = counts !== null ? 'healthy' : 'unhealthy';
        await connection.quit();
      } catch (error) {
        fastify.log.error('Queue health check failed:', error);
        checks.queue = 'unhealthy';
      } finally {
        if (queue) {
          await queue.close();
        }
      }

      const allHealthy = Object.values(checks).every((s) => s === 'healthy');
      const checkDuration = Date.now() - startTime;

      const response = {
        status: allHealthy ? ('healthy' as const) : ('unhealthy' as const),
        timestamp: new Date().toISOString(),
        services: checks,
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
      };

      // Log health check result if unhealthy
      if (!allHealthy) {
        fastify.log.warn('Health check failed', {
          services: checks,
          duration: checkDuration,
        });
      }

      return reply.code(allHealthy ? 200 : 503).send(response);
    },
  );

  // Liveness probe - simple check that the server is running
  fastify.get(
    '/live',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.Literal('ok'),
            timestamp: Type.String(),
          }),
        },
      },
    },
    async (_request, reply) => {
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    },
  );

  // Readiness probe - check if the server is ready to accept traffic
  fastify.get(
    '/ready',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.Literal('ready'),
            timestamp: Type.String(),
          }),
          503: Type.Object({
            status: Type.Literal('not_ready'),
            timestamp: Type.String(),
            reason: Type.String(),
          }),
        },
      },
    },
    async (_request, reply) => {
      // Quick database check
      try {
        const dbHealthy = await Promise.race([
          checkDatabaseHealth(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
        ]);

        if (!dbHealthy) {
          return reply.code(503).send({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            reason: 'Database not ready',
          });
        }
      } catch (_error) {
        return reply.code(503).send({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          reason: 'Database check failed',
        });
      }

      return reply.send({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    },
  );
};

export default healthRoute;
