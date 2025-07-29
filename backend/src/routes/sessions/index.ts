import { type Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { ErrorResponseSchema } from '@/schemas/auth.schema';
import {
  CreateSessionRequestSchema,
  ListSessionsQuerySchema,
  ListSessionsResponseSchema,
  SessionParamsSchema,
  SessionResponseSchema,
  UpdateSessionRequestSchema,
} from '@/schemas/session.schema';
import { sessionService } from '@/services/session.service';

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // Create session
  fastify.post<{
    Body: Static<typeof CreateSessionRequestSchema>;
  }>(
    '/',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        body: CreateSessionRequestSchema,
        response: {
          201: SessionResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;

      try {
        const session = await sessionService.createSession(userId, request.body);
        return reply.code(201).send(session);
      } catch (error: any) {
        if (error.name === 'ValidationError') {
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
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        querystring: ListSessionsQuerySchema,
        response: {
          200: ListSessionsResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const result = await sessionService.listSessions(userId, request.query);
      return reply.send(result);
    },
  );

  // Get session
  fastify.get<{
    Params: Static<typeof SessionParamsSchema>;
  }>(
    '/:sessionId',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: SessionParamsSchema,
        response: {
          200: SessionResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;

      try {
        const session = await sessionService.getSession(sessionId, userId);
        return reply.send(session);
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

  // Update session
  fastify.patch<{
    Params: Static<typeof SessionParamsSchema>;
    Body: Static<typeof UpdateSessionRequestSchema>;
  }>(
    '/:sessionId',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: SessionParamsSchema,
        body: UpdateSessionRequestSchema,
        response: {
          200: SessionResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;

      try {
        const session = await sessionService.updateSession(sessionId, userId, request.body);
        return reply.send(session);
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

  // Delete session
  fastify.delete<{
    Params: Static<typeof SessionParamsSchema>;
  }>(
    '/:sessionId',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: SessionParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;

      try {
        const result = await sessionService.deleteSession(sessionId, userId);
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

  // Register prompt routes
  fastify.register(import('./prompts'), { prefix: '/:sessionId/prompts' });

  // Register file routes
  fastify.register(import('./files'), { prefix: '/:sessionId/files' });
};

export default sessionRoutes;
