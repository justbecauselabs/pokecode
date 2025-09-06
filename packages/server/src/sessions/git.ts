import {
  type GitDiffQuery,
  GitDiffQuerySchema,
  type GitDiffResponse,
  GitDiffResponseSchema,
  type GitFileQuery,
  GitFileQuerySchema,
  type GitFileResponse,
  GitFileResponseSchema,
  type GitStatusQuery,
  GitStatusQuerySchema,
  type GitStatusResponse,
  GitStatusResponseSchema,
  type SessionParams,
  SessionParamsSchema,
} from '@pokecode/api';
import { gitService } from '@pokecode/core';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const gitRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /status — repo status
  fastify.get<{
    Params: SessionParams;
    Querystring: GitStatusQuery;
    Reply: GitStatusResponse | { error: string; code?: string };
  }>(
    '/status',
    {
      schema: {
        params: SessionParamsSchema,
        querystring: GitStatusQuerySchema,
        response: {
          200: GitStatusResponseSchema,
          400: z.object({ error: z.string(), code: z.string().optional() }),
          404: z.object({ error: z.string(), code: z.string().optional() }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      try {
        const result = await gitService.getStatus({ sessionId, options: request.query });
        return reply.send(result);
      } catch (error) {
        if (error instanceof Error) {
          const code = 'GIT_STATUS_ERROR';
          const status = error.name === 'NotFoundError' ? 404 : 400;
          return reply.code(status).send({ error: error.message, code });
        }
        throw error;
      }
    },
  );

  // GET /diff — unified diff for a single file
  fastify.get<{
    Params: SessionParams;
    Querystring: GitDiffQuery;
    Reply: GitDiffResponse | { error: string; code?: string };
  }>(
    '/diff',
    {
      schema: {
        params: SessionParamsSchema,
        querystring: GitDiffQuerySchema,
        response: {
          200: GitDiffResponseSchema,
          400: z.object({ error: z.string(), code: z.string().optional() }),
          404: z.object({ error: z.string(), code: z.string().optional() }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      try {
        const result = await gitService.getDiff({ sessionId, options: request.query });
        return reply.send(result);
      } catch (error) {
        if (error instanceof Error) {
          const code = 'GIT_DIFF_ERROR';
          const status = error.name === 'NotFoundError' ? 404 : 400;
          return reply.code(status).send({ error: error.message, code });
        }
        throw error;
      }
    },
  );

  // GET /file — file content at ref (WORKING/INDEX/HEAD/<sha>)
  fastify.get<{
    Params: SessionParams;
    Querystring: GitFileQuery;
    Reply: GitFileResponse | { error: string; code?: string };
  }>(
    '/file',
    {
      schema: {
        params: SessionParamsSchema,
        querystring: GitFileQuerySchema,
        response: {
          200: GitFileResponseSchema,
          400: z.object({ error: z.string(), code: z.string().optional() }),
          404: z.object({ error: z.string(), code: z.string().optional() }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      try {
        const result = await gitService.getFile({ sessionId, options: request.query });
        return reply.send(result);
      } catch (error) {
        if (error instanceof Error) {
          const code = 'GIT_FILE_ERROR';
          const status = error.name === 'NotFoundError' ? 404 : 400;
          return reply.code(status).send({ error: error.message, code });
        }
        throw error;
      }
    },
  );
};

export default gitRoutes;
