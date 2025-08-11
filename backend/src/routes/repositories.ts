import type { FastifyPluginAsync } from 'fastify';
import { ErrorResponseSchema } from '@/schemas/auth.schema';
import { ListRepositoriesResponseSchema } from '@/schemas/repository.schema';
import { repositoryService } from '@/services/repository.service';

const repositoryRoutes: FastifyPluginAsync = async (fastify) => {
  // List all git repositories in GITHUB_REPOS_DIRECTORY
  fastify.get(
    '/',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        response: {
          200: ListRepositoriesResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        const repositories = await repositoryService.listRepositories();
        return reply.send(repositories);
      } catch (error: any) {
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
