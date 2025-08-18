import {
  CreateMessageBodySchema,
  type CreateMessageRequest,
  ErrorResponseSchema,
  GetMessagesResponseSchema,
  SessionIdParamsSchema,
} from '@pokecode/api';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
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
          202: z.object({}), // Empty response
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

        // Save user message first
        await messageService.saveUserMessage(sessionId, content);

        // Queue prompt for processing (SDK will create assistant messages)
        // Pass agent context if provided
        await messageService.queuePrompt(sessionId, content);

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
        const messages = await messageService.getMessages(sessionId, session.projectPath);

        logger.debug(
          {
            sessionId,
            messageCount: messages.length,
          },
          'Retrieved messages',
        );

        // Include full session info in response
        return reply.send({
          messages,
          session: {
            id: session.id,
            projectPath: session.projectPath,
            name: session.name,
            claudeDirectoryPath: session.claudeDirectoryPath,
            context: session.context,
            status: session.status,
            metadata: session.metadata,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            lastAccessedAt: session.lastAccessedAt,
            isWorking: session.isWorking,
            currentJobId: session.currentJobId,
            lastJobStatus: session.lastJobStatus,
            messageCount: session.messageCount,
            tokenCount: session.tokenCount,
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

  // GET /sessions/:sessionId/messages/raw - Get raw messages from DB with parsed content_data
  fastify.get<{
    Params: { sessionId: string };
  }>(
    '/messages/raw',
    {
      schema: {
        params: SessionIdParamsSchema,
        // No response validation - return raw data
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

        // Get raw messages from database with parsed content_data
        const rawMessages = await messageService.getRawMessages(sessionId);

        // Extract only the contentData from each message
        const contentDataOnly = rawMessages.map((msg) => msg.contentData).filter(Boolean);

        logger.debug(
          {
            sessionId,
            messageCount: contentDataOnly.length,
          },
          'Retrieved raw messages contentData',
        );

        return reply.send(contentDataOnly);
      } catch (error) {
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to get raw messages',
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

  // POST /sessions/:sessionId/cancel - Cancel current session processing
  fastify.post<{
    Params: { sessionId: string };
  }>(
    '/cancel',
    {
      schema: {
        params: SessionIdParamsSchema,
        response: {
          200: z.object({ success: z.boolean() }),
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

        // Cancel the current session processing
        await messageService.cancelSession(sessionId);

        logger.debug(
          {
            sessionId,
          },
          'Session cancelled successfully',
        );

        return reply.send({ success: true });
      } catch (error) {
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to cancel session',
        );
        throw error;
      }
    },
  );
};

export default messageRoutes;
