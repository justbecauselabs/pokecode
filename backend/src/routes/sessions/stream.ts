import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { Redis } from 'ioredis';
import { config } from '@/config';
import { promptService } from '@/services/prompt.service';
import { sessionService } from '@/services/session.service';
import { createRedisSSEStream } from '@/utils/sse';

const streamRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { sessionId: string; promptId: string };
    Querystring: { token?: string };
  }>(
    '/stream',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          promptId: Type.String({ format: 'uuid' }),
        }),
        querystring: Type.Object({
          token: Type.Optional(Type.String()),
        }),
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId, promptId } = request.params;

      // Verify access
      try {
        await sessionService.getSession(sessionId, userId);
        await promptService.getPrompt(promptId, sessionId, userId);
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }

      // Create Redis connection for subscription
      const redis = new Redis(config.REDIS_URL);
      const channel = `claude-code:${sessionId}:${promptId}`;

      try {
        // Use the enhanced SSE stream with fastify-sse-v2
        await createRedisSSEStream(reply, redis, channel, {
          event: 'connected',
          data: {
            promptId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        fastify.log.error('Error setting up SSE stream:', error);
        try {
          await redis.quit();
        } catch (cleanupError) {
          fastify.log.warn('Redis cleanup error:', cleanupError);
        }
        throw error;
      }

      // Handle client disconnect
      request.raw.on('close', async () => {
        try {
          await redis.quit();
          fastify.log.info(`Client disconnected from stream: ${promptId}`);
        } catch (error) {
          fastify.log.warn('Error cleaning up on disconnect:', error);
        }
      });
    },
  );
};

export default streamRoute;
