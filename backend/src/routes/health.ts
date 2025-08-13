import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { checkDatabaseHealth } from '@/db';
import { sqliteQueueService } from '@/services/queue-sqlite.service';

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

      // Check SQLite queue connectivity
      try {
        const metrics = await Promise.race([
          sqliteQueueService.getQueueMetrics(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);

        checks.queue = metrics !== null ? 'healthy' : 'unhealthy';
      } catch (error) {
        fastify.log.error('Queue health check failed:', error);
        checks.queue = 'unhealthy';
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
