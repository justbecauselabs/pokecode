import { ListRepositoriesResponseSchema } from '@pokecode/api';
import type { FastifyPluginAsync } from 'fastify';
import { repositoryService } from '@pokecode/core';
import { z } from 'zod';

const repositoryRoutes: FastifyPluginAsync = async (fastify) => {
  // List all git repositories from configured paths
  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: ListRepositoriesResponseSchema,
          500: z.object({
            error: z.string(),
            code: z.string(),
          }),
        },
      },
    },
    async (_request, reply) => {
      try {
        const repositories = await repositoryService.listRepositories();
        return reply.send(repositories);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        fastify.log.error(
          {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          },
          'Failed to list repositories',
        );
        return reply.code(500).send({
          error: `Failed to list repositories: ${errorMessage}`,
          code: 'REPOSITORY_LIST_ERROR',
        });
      }
    },
  );
};

export default repositoryRoutes;
