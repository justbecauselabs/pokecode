import type { FastifyPluginAsync } from 'fastify';
import { ListRepositoriesResponseSchema } from '@/schemas/repository.schema';
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
        fastify.log.error('Failed to list repositories:', error);
        return reply.code(500).send({
          error: 'Failed to list repositories',
          code: 'REPOSITORY_LIST_ERROR',
        });
      }
    },
  );
};

export default repositoryRoutes;
