import { type Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { ListAgentsQuerySchema, ListAgentsResponseSchema } from '@/schemas/agent.schema';
import { agentService } from '@/services/agent.service';
import { sessionService } from '@/services/session.service';

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
    Querystring: Static<typeof ListAgentsQuerySchema>;
  }>(
    '/',
    {
      schema: {
        summary: 'List available agents',
        description: 'Discover agents from both user Claude home directory and project directory',
        tags: ['Agents'],
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        querystring: ListAgentsQuerySchema,
        response: {
          200: ListAgentsResponseSchema,
          400: Type.Object({
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
          403: Type.Object({
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
