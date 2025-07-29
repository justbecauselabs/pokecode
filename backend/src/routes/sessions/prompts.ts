import { type Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { rateLimitConfig } from '@/config';
import { ErrorResponseSchema } from '@/schemas/auth.schema';
import {
  CreatePromptRequestSchema,
  ExportQuerySchema,
  HistoryQuerySchema,
  HistoryResponseSchema,
  PromptDetailResponseSchema,
  PromptParamsSchema,
  PromptResponseSchema,
} from '@/schemas/prompt.schema';
import { promptService } from '@/services/prompt.service';

const promptRoutes: FastifyPluginAsync = async (fastify) => {
  // Create prompt
  fastify.post<{
    Params: { sessionId: string };
    Body: Static<typeof CreatePromptRequestSchema>;
  }>(
    '/',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: rateLimitConfig.prompt,
      },
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        body: CreatePromptRequestSchema,
        response: {
          201: PromptResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;

      try {
        const prompt = await promptService.createPrompt(sessionId, userId, request.body);

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
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: PromptParamsSchema,
        response: {
          200: PromptDetailResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId, promptId } = request.params;

      try {
        const prompt = await promptService.getPrompt(promptId, sessionId, userId);
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
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: PromptParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId, promptId } = request.params;

      try {
        const result = await promptService.cancelPrompt(promptId, sessionId, userId);

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

  // Get prompt stream
  fastify.register(import('./stream'), { prefix: '/:promptId' });
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
      preHandler: fastify.authenticate,
      config: {
        rateLimit: rateLimitConfig.read,
      },
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        querystring: HistoryQuerySchema,
        response: {
          200: HistoryResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;

      try {
        const history = await promptService.getHistory(sessionId, userId, request.query);
        return reply.send(history);
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

  // Export session
  fastify.get<{
    Params: { sessionId: string };
    Querystring: Static<typeof ExportQuerySchema>;
  }>(
    '/export',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
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
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;
      const { format } = request.query;

      try {
        const result = await promptService.exportSession(sessionId, userId, format);

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
};

export default promptRoutes;
