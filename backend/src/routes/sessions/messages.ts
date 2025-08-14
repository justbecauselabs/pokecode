import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import {
  CreateMessageBodySchema,
  type CreateMessageRequest,
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
      schema: {
        params: SessionIdParamsSchema,
        body: CreateMessageBodySchema,
        response: {
          202: Type.Object({}), // Empty response
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { content, agent } = request.body;

      try {
        // Verify session exists
        const session = await sessionService.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            error: 'Session not found',
            code: 'NOT_FOUND',
          });
        }

        // Save user message first
        await messageService.saveUserMessage(sessionId, content);

        // Queue prompt for processing (SDK will create assistant messages)
        // Pass agent context if provided
        await messageService.queuePrompt(sessionId, content, { agent });

        // Track metrics
        if (fastify.metrics) {
          fastify.metrics.promptsTotal.inc({ status: 'queued' });
        }

        logger.debug(
          {
            sessionId,
            content: content.substring(0, 100),
          },
          'Prompt queued for processing',
        );

        return reply.code(202).send();
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

        // Get all messages parsed from SDK format to API format
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
            name: session.name,
            isWorking: session.isWorking,
            currentJobId: session.currentJobId,
            lastJobStatus: session.lastJobStatus,
            status: session.status,
          },
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
