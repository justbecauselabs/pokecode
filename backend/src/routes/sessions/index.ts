import { type Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import {
  CreateSessionRequestSchema,
  ListSessionsQuerySchema,
  ListSessionsResponseSchema,
  SessionParamsSchema,
  SessionResponseSchema,
  UpdateSessionRequestSchema,
} from '@/schemas/session.schema';
import { sessionService } from '@/services/session.service';

// Type guard for API errors
function isApiError(error: unknown): error is { name: string; message: string; code?: string } {
  return error instanceof Error && 'name' in error && 'message' in error;
}

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // Create session
  fastify.post<{
    Body: Static<typeof CreateSessionRequestSchema>;
  }>(
    '/',
    {
      schema: {
        body: CreateSessionRequestSchema,
        response: {
          201: SessionResponseSchema,
          400: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
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
    Querystring: Static<typeof ListSessionsQuerySchema>;
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
    Params: Static<typeof SessionParamsSchema>;
  }>(
    '/:sessionId',
    {
      schema: {
        params: SessionParamsSchema,
        response: {
          200: SessionResponseSchema,
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
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
    Params: Static<typeof SessionParamsSchema>;
    Body: Static<typeof UpdateSessionRequestSchema>;
  }>(
    '/:sessionId',
    {
      schema: {
        params: SessionParamsSchema,
        body: UpdateSessionRequestSchema,
        response: {
          200: SessionResponseSchema,
          400: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
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
    Params: Static<typeof SessionParamsSchema>;
  }>(
    '/:sessionId',
    {
      schema: {
        params: SessionParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          404: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
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
