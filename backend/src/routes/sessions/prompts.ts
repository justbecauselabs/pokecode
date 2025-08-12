import { type Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { rateLimitConfig } from '@/config';
import {
  CreatePromptRequestSchema,
  ExportQuerySchema,
  HistoryQuerySchema,
  HistoryResponseSchema,
  MessagesQuerySchema,
  MessagesResponseSchema,
  PromptDetailResponseSchema,
  PromptParamsSchema,
  PromptResponseSchema,
} from '@/schemas/prompt.schema';
import { messageService } from '@/services/message.service';
import { promptService } from '@/services/prompt.service';
import { sessionService } from '@/services/session.service';
import { logger } from '@/utils/logger';

const promptRoutes: FastifyPluginAsync = async (fastify) => {
  // Create prompt
  fastify.post<{
    Params: { sessionId: string };
    Body: Static<typeof CreatePromptRequestSchema>;
  }>(
    '/',
    {
      config: {
        rateLimit: rateLimitConfig.prompt,
      },
      schema: {
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        body: CreatePromptRequestSchema,
        response: {
          201: PromptResponseSchema,
          400: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
          409: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
          429: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      try {
        const prompt = await promptService.createPrompt(sessionId, request.body);

        // Track metrics
        if (fastify.metrics) {
          fastify.metrics.promptsTotal.inc({ status: 'created' });
        }

        return reply.code(201).send(prompt);
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        if (error.name === 'ConflictError') {
          return reply.code(409).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // Get prompt
  fastify.get<{
    Params: Static<typeof PromptParamsSchema>;
  }>(
    '/:promptId',
    {
      schema: {
        params: PromptParamsSchema,
        response: {
          200: PromptDetailResponseSchema,
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId, promptId } = request.params;

      try {
        const prompt = await promptService.getPrompt(promptId, sessionId);
        return reply.send(prompt);
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // Cancel prompt
  fastify.delete<{
    Params: Static<typeof PromptParamsSchema>;
  }>(
    '/:promptId',
    {
      schema: {
        params: PromptParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
          409: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId, promptId } = request.params;

      try {
        const result = await promptService.cancelPrompt(promptId, sessionId);

        // Track metrics
        if (fastify.metrics) {
          fastify.metrics.promptsTotal.inc({ status: 'cancelled' });
        }

        return reply.send(result);
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        if (error.name === 'ConflictError') {
          return reply.code(409).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // Poll prompt intermediate messages
  fastify.get<{
    Params: Static<typeof PromptParamsSchema>;
  }>(
    '/:promptId/poll',
    {
      config: {
        rateLimit: rateLimitConfig.read,
      },
      schema: {
        params: PromptParamsSchema,
        response: {
          200: Type.Object({
            status: Type.Union([
              Type.Literal('pending'),
              Type.Literal('running'),
              Type.Literal('completed'),
              Type.Literal('failed'),
            ]),
            messages: Type.Array(Type.Any()),
            count: Type.Number(),
            isComplete: Type.Boolean(),
          }),
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId, promptId } = request.params;

      try {
        // Use promptId as threadId since they correspond in the JSONL structure
        const messages = await promptService.getIntermediateMessages(sessionId, promptId);

        // For now, assume completed if we have messages, pending if not
        // This could be enhanced to check actual job status from queue if needed
        const status = messages.length > 0 ? 'completed' : 'pending';
        const isComplete = status === 'completed';

        logger.debug(
          {
            sessionId,
            promptId,
            messageCount: messages.length,
            status,
            isComplete,
          },
          'Poll endpoint response',
        );

        return reply.send({
          status,
          messages,
          count: messages.length,
          isComplete,
        });
      } catch (error: any) {
        logger.error(
          {
            sessionId,
            promptId,
            errorName: error.name,
            errorMessage: error.message,
          },
          'Poll endpoint error',
        );

        if (error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );
};

// Export routes for session history and export
export const historyAndExportRoutes: FastifyPluginAsync = async (fastify) => {
  // Get session history
  fastify.get<{
    Params: { sessionId: string };
    Querystring: Static<typeof HistoryQuerySchema>;
  }>(
    '/history',
    {
      config: {
        rateLimit: rateLimitConfig.read,
      },
      schema: {
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        querystring: HistoryQuerySchema,
        response: {
          200: HistoryResponseSchema,
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      logger.debug(
        {
          sessionId,
          query: request.query,
        },
        'History route called',
      );

      try {
        const history = await promptService.getHistory(sessionId, request.query);

        logger.debug(
          {
            sessionId,
            promptCount: Array.isArray(history.prompts) ? history.prompts.length : 0,
            hasPrompts: !!(history.prompts && history.prompts.length > 0),
          },
          'History route response',
        );

        return reply.send(history);
      } catch (error: any) {
        logger.error(
          {
            sessionId,
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
          },
          'History route error',
        );

        if (error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // Export session
  fastify.get<{
    Params: { sessionId: string };
    Querystring: Static<typeof ExportQuerySchema>;
  }>(
    '/export',
    {
      schema: {
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        querystring: ExportQuerySchema,
        response: {
          200: Type.Union([
            Type.Object({ content: Type.String(), format: Type.Literal('markdown') }),
            Type.Object({
              session: Type.Any(),
              prompts: Type.Array(Type.Any()),
            }),
          ]),
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { format } = request.query;

      try {
        const result = await promptService.exportSession(sessionId, format);

        if (format === 'markdown') {
          reply.type('text/markdown');
        }

        return reply.send(result);
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // Get session messages (new endpoint)
  fastify.get<{
    Params: { sessionId: string };
    Querystring: Static<typeof MessagesQuerySchema>;
  }>(
    '/messages',
    {
      config: {
        rateLimit: rateLimitConfig.read,
      },
      schema: {
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        querystring: MessagesQuerySchema,
        response: {
          200: MessagesResponseSchema,
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { limit = 50, offset = 0 } = request.query;

      logger.debug(
        {
          sessionId,
          query: request.query,
        },
        'Messages route called',
      );

      try {
        // Get session to verify it exists and get working state
        const session = await sessionService.getSession(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }

        // Get messages with content from hybrid approach
        const messages = await messageService.getMessagesWithContent(sessionId);

        // Apply pagination
        const total = messages.length;
        const paginatedMessages = messages.slice(offset, offset + limit);

        const response = {
          messages: paginatedMessages.map((msg) => ({
            ...msg,
            createdAt: msg.createdAt.toISOString(),
          })),
          session: {
            id: session.id,
            isWorking: session.isWorking,
            currentJobId: session.currentJobId,
            lastJobStatus: session.lastJobStatus,
            status: session.status,
          },
          total,
          limit,
          offset,
        };

        logger.debug(
          {
            sessionId,
            messageCount: paginatedMessages.length,
            hasMessages: paginatedMessages.length > 0,
          },
          'Messages route response',
        );

        return reply.send(response);
      } catch (error: any) {
        logger.error(
          {
            sessionId,
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
          },
          'Messages route error',
        );

        if (error.name === 'NotFoundError' || error.message === 'Session not found') {
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

export default promptRoutes;
