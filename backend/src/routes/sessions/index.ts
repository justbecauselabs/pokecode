import {
  type CreateSessionRequest,
  CreateSessionRequestSchema,
  type ListSessionsQuery,
  ListSessionsQuerySchema,
  ListSessionsResponseSchema,
  type SessionParams,
  SessionParamsSchema,
  SessionSchema,
  type UpdateSessionRequest,
  UpdateSessionRequestSchema,
} from '@pokecode/api';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sessionService } from '@/services/session.service';

// Type guard for API errors
function isApiError(error: unknown): error is { name: string; message: string; code?: string } {
  return error instanceof Error && 'name' in error && 'message' in error;
}

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // Create session
  fastify.post<{
    Body: CreateSessionRequest;
  }>(
    '/',
    {
      schema: {
        body: CreateSessionRequestSchema,
        response: {
          201: SessionSchema,
          400: z.object({
            error: z.string(),
            code: z.string().optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const session = await sessionService.createSession(request.body);
        return reply.code(201).send(session);
      } catch (error) {
        if (isApiError(error) && error.name === 'ValidationError') {
          return reply.code(400).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // List sessions
  fastify.get<{
    Querystring: ListSessionsQuery;
  }>(
    '/',
    {
      schema: {
        querystring: ListSessionsQuerySchema,
        response: {
          200: ListSessionsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await sessionService.listSessions(request.query);
      return reply.send(result);
    },
  );

  // Get session
  fastify.get<{
    Params: SessionParams;
  }>(
    '/:sessionId',
    {
      schema: {
        params: SessionParamsSchema,
        response: {
          200: SessionSchema,
          404: z.object({
            error: z.string(),
            code: z.string().optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      try {
        const session = await sessionService.getSession(sessionId);
        return reply.send(session);
      } catch (error) {
        if (isApiError(error) && error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // Update session
  fastify.patch<{
    Params: SessionParams;
    Body: UpdateSessionRequest;
  }>(
    '/:sessionId',
    {
      schema: {
        params: SessionParamsSchema,
        body: UpdateSessionRequestSchema,
        response: {
          200: SessionSchema,
          400: z.object({
            error: z.string(),
            code: z.string().optional(),
          }),
          404: z.object({
            error: z.string(),
            code: z.string().optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      try {
        const session = await sessionService.updateSession(sessionId, request.body);
        return reply.send(session);
      } catch (error) {
        if (isApiError(error) && error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // Delete session
  fastify.delete<{
    Params: SessionParams;
  }>(
    '/:sessionId',
    {
      schema: {
        params: SessionParamsSchema,
        response: {
          200: z.object({ success: z.boolean() }),
          404: z.object({
            error: z.string(),
            code: z.string().optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      try {
        const result = await sessionService.deleteSession(sessionId);
        return reply.send(result);
      } catch (error) {
        if (isApiError(error) && error.name === 'NotFoundError') {
          return reply.code(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );

  // Register message routes (was prompts)
  fastify.register(import('./messages'), { prefix: '/:sessionId' });

  // Register command routes
  fastify.register(import('./commands'), { prefix: '/:sessionId/commands' });

  // Register agent routes
  fastify.register(import('./agents'), { prefix: '/:sessionId/agents' });
};

export default sessionRoutes;
