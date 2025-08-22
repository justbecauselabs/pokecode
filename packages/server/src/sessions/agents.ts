import {
  type ListAgentsQuery,
  ListAgentsQuerySchema,
  ListAgentsResponseSchema,
  SessionIdParamsSchema,
} from '@pokecode/api';
import { agentService, sessionService } from '@pokecode/core';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Type guard for API errors
function isApiError(error: unknown): error is { name: string; message: string; code?: string } {
  return error instanceof Error && 'name' in error && 'message' in error;
}

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to verify session access and get project path
  async function verifySessionAccess(sessionId: string) {
    const session = await sessionService.getSession(sessionId);
    return session.projectPath;
  }

  // List available agents
  fastify.get<{
    Params: { sessionId: string };
    Querystring: ListAgentsQuery;
  }>(
    '/',
    {
      schema: {
        params: SessionIdParamsSchema,
        querystring: ListAgentsQuerySchema,
        response: {
          200: ListAgentsResponseSchema,
          400: z.object({
            error: z.string(),
            code: z.string().optional(),
          }),
          403: z.object({
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
      const query = request.query;

      try {
        const projectPath = await verifySessionAccess(sessionId);

        const result = await agentService.listAgents({
          sessionId,
          projectPath,
          query,
        });

        return reply.send(result);
      } catch (error) {
        if (isApiError(error)) {
          if (error.name === 'NotFoundError') {
            return reply.code(404).send({
              error: error.message,
              code: error.code,
            });
          }
          if (error.name === 'ValidationError') {
            return reply.code(400).send({
              error: error.message,
              code: error.code,
            });
          }
          if (error.name === 'AuthorizationError') {
            return reply.code(403).send({
              error: error.message,
              code: error.code,
            });
          }
        }
        throw error;
      }
    },
  );
};

export default agentRoutes;
