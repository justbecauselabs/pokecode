import { ListRepositoriesResponseSchema } from '@pokecode/api';
import type { FastifyPluginAsync } from 'fastify';
import { repositoryService } from '@/services/repository.service';

const repositoryRoutes: FastifyPluginAsync = async (fastify) => {
  // List all git repositories in GITHUB_REPOS_DIRECTORY
  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: ListRepositoriesResponseSchema,
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
            required: ['error'],
          },
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
