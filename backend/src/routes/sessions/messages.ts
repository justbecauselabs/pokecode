import type { FastifyPluginAsync } from 'fastify';
import { rateLimitConfig } from '@/config';
import {
  type CreateMessageRequest,
  CreateMessageBodySchema,
  CreateMessageResponseSchema,
  ErrorResponseSchema,
  GetMessagesResponseSchema,
  SessionIdParamsSchema,
} from '@/schemas/message.schema';
import { messageService } from '@/services/message.service';
import { sessionService } from '@/services/session.service';
import { logger } from '@/utils/logger';

const messageRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /sessions/:sessionId/messages - Create new message
  fastify.post<{
    Params: { sessionId: string };
    Body: CreateMessageRequest;
  }>(
    '/messages',
    {
      config: {
        rateLimit: rateLimitConfig.prompt,
      },
      schema: {
        params: SessionIdParamsSchema,
        body: CreateMessageBodySchema,
        response: {
          201: CreateMessageResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { content } = request.body;

      try {
        // Verify session exists
        const session = await sessionService.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            error: 'Session not found',
            code: 'NOT_FOUND',
          });
        }

        // Create message and queue for processing
        const message = await messageService.createMessage(sessionId, content);

        // Track metrics
        if (fastify.metrics) {
          fastify.metrics.promptsTotal.inc({ status: 'created' });
        }

        logger.debug(
          {
            sessionId,
            messageId: message.id,
            content: content.substring(0, 100),
          },
          'Message created and queued',
        );

        return reply.code(201).send({ message });
      } catch (error) {
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to create message',
        );
        throw error;
      }
    },
  );

  // GET /sessions/:sessionId/messages - Get all messages
  fastify.get<{
    Params: { sessionId: string };
  }>(
    '/messages',
    {
      config: {
        rateLimit: rateLimitConfig.read,
      },
      schema: {
        params: SessionIdParamsSchema,
        response: {
          200: GetMessagesResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      try {
        // Verify session exists
        const session = await sessionService.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            error: 'Session not found',
            code: 'NOT_FOUND',
          });
        }

        // Get all messages with nested JSONL content
        const messages = await messageService.getMessages(sessionId);

        logger.debug(
          {
            sessionId,
            messageCount: messages.length,
          },
          'Retrieved messages',
        );

        // Include session info in response
        return reply.send({ 
          messages,
          session: {
            id: session.id,
            isWorking: session.isWorking,
            currentJobId: session.currentJobId,
            lastJobStatus: session.lastJobStatus,
            status: session.status,
          }
        });
      } catch (error) {
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to get messages',
        );

        if (error instanceof Error && error.message === 'Session not found') {
          return reply.code(404).send({
            error: 'Session not found',
            code: 'NOT_FOUND',
          });
        }
        throw error;
      }
    },
  );
};

export default messageRoutes;
