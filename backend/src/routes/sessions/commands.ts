import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  type ListCommandsQuery,
  ListCommandsQuerySchema,
  ListCommandsResponseSchema,
} from '@/schemas/command.schema';
import { commandService } from '@/services/command.service';
import { sessionService } from '@/services/session.service';

// Type guard for API errors
function isApiError(error: unknown): error is { name: string; message: string; code?: string } {
  return error instanceof Error && 'name' in error && 'message' in error;
}

const commandRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to verify session access and get project path
  async function verifySessionAccess(sessionId: string) {
    const session = await sessionService.getSession(sessionId);
    return session.projectPath;
  }

  // List available slash commands
  fastify.get<{
    Params: { sessionId: string };
    Querystring: ListCommandsQuery;
  }>(
    '/',
    {
      schema: {
        summary: 'List available slash commands',
        description:
          'Discover slash commands from both user Claude home directory and project directory',
        tags: ['Commands'],
        params: z.object({ sessionId: z.string().uuid() }),
        querystring: ListCommandsQuerySchema,
        response: {
          200: ListCommandsResponseSchema,
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

        const result = await commandService.listCommands({
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

export default commandRoutes;
