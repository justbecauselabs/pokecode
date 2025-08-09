import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { Redis } from 'ioredis';
import { config } from '@/config';
import { promptService } from '@/services/prompt.service';
import { sessionService } from '@/services/session.service';

const streamRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { sessionId: string; promptId: string };
  }>(
    '/stream',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          promptId: Type.String({ format: 'uuid' }),
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

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial connection event
      reply.raw.write(
        `event: connected\ndata: ${JSON.stringify({
          promptId,
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );

      // Subscribe to Redis channel
      await redis.subscribe(channel);

      // Helper function for Redis cleanup
      const cleanupRedis = async () => {
        try {
          await redis.unsubscribe(channel);
          await redis.quit();
        } catch (error) {
          fastify.log.warn('Redis cleanup error:', error);
        }
      };

      // Handle Redis messages
      redis.on('message', async (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const event = JSON.parse(message);

            // Send SSE event
            reply.raw.write(`event: ${event.type}\n`);
            reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);

            // End stream on completion or error
            if (event.type === 'complete' || event.type === 'error') {
              await cleanupRedis();
              reply.raw.end();
            }
          } catch (error) {
            fastify.log.error('Error parsing Redis message:', error);
            await cleanupRedis();
            reply.raw.end();
          }
        }
      });

      // Handle client disconnect
      request.raw.on('close', async () => {
        await cleanupRedis();

        // Log disconnect
        fastify.log.info(`Client disconnected from stream: ${promptId}`);
      });

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          reply.raw.write(`:heartbeat\n\n`);
        } catch (_error) {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Clean up heartbeat on close
      request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
      });

      // Handle Redis errors
      redis.on('error', async (error) => {
        fastify.log.error('Redis error in stream:', error);
        try {
          reply.raw.write(
            `event: error\ndata: ${JSON.stringify({
              error: 'Stream error',
              timestamp: new Date().toISOString(),
            })}\n\n`,
          );
        } catch (writeError) {
          fastify.log.warn('Failed to write error to stream:', writeError);
        }
        await cleanupRedis();
        reply.raw.end();
      });
    },
  );
};

export default streamRoute;
