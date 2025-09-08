import { QueueMetricsSchema } from '@pokecode/api';
import { sqliteQueueService } from '@pokecode/core';
import type { FastifyPluginAsync } from 'fastify';

const queueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/metrics',
    {
      schema: {
        response: {
          200: QueueMetricsSchema,
        },
      },
    },
    async (_request, reply) => {
      const metrics = await sqliteQueueService.getQueueMetrics();
      return reply.send(metrics);
    },
  );
};

export default queueRoutes;
