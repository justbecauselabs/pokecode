import { type Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { rateLimitConfig } from '@/config';
import { ErrorResponseSchema } from '@/schemas/auth.schema';
import {
  CreateFileRequestSchema,
  FileOperationSuccessSchema,
  GetFileResponseSchema,
  ListFilesQuerySchema,
  ListFilesResponseSchema,
  UpdateFileRequestSchema,
} from '@/schemas/file.schema';
import { fileService } from '@/services/file.service';
import { sessionService } from '@/services/session.service';

const fileRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to verify session access
  async function verifySessionAccess(sessionId: string, userId: string) {
    const session = await sessionService.getSession(sessionId, userId);
    return session.projectPath;
  }

  // List files
  fastify.get<{
    Params: { sessionId: string };
    Querystring: Static<typeof ListFilesQuerySchema>;
  }>(
    '/',
    {
      preHandler: fastify.authenticate,
      config: {
        rateLimit: rateLimitConfig.read,
      },
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        querystring: ListFilesQuerySchema,
        response: {
          200: ListFilesResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;
      const { path, recursive, pattern } = request.query;

      try {
        const projectPath = await verifySessionAccess(sessionId, userId);
        const result = await fileService.listFiles(sessionId, projectPath, path, {
          recursive,
          pattern,
        });
        return reply.send(result);
      } catch (error: any) {
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
        throw error;
      }
    },
  );

  // Get file content
  fastify.get<{
    Params: { sessionId: string; '*': string };
  }>(
    '/*',
    {
      preHandler: fastify.authenticate,
      config: {
        rateLimit: rateLimitConfig.read,
      },
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          '*': Type.String(),
        }),
        response: {
          200: GetFileResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;
      const filePath = request.params['*'];

      try {
        const projectPath = await verifySessionAccess(sessionId, userId);
        const file = await fileService.readFile(sessionId, projectPath, filePath);
        return reply.send(file);
      } catch (error: any) {
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
        throw error;
      }
    },
  );

  // Create file
  fastify.post<{
    Params: { sessionId: string; '*': string };
    Body: Static<typeof CreateFileRequestSchema>;
  }>(
    '/*',
    {
      preHandler: fastify.authenticate,
      config: {
        rateLimit: rateLimitConfig.file,
      },
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          '*': Type.String(),
        }),
        body: CreateFileRequestSchema,
        response: {
          201: FileOperationSuccessSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;
      const filePath = request.params['*'];
      const { content, encoding } = request.body;

      try {
        const projectPath = await verifySessionAccess(sessionId, userId);
        const result = await fileService.createFile(
          sessionId,
          projectPath,
          filePath,
          content,
          encoding,
        );
        return reply.code(201).send(result);
      } catch (error: any) {
        if (error.name === 'ConflictError') {
          return reply.code(409).send({
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
        throw error;
      }
    },
  );

  // Update file
  fastify.put<{
    Params: { sessionId: string; '*': string };
    Body: Static<typeof UpdateFileRequestSchema>;
  }>(
    '/*',
    {
      preHandler: fastify.authenticate,
      config: {
        rateLimit: rateLimitConfig.file,
      },
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          '*': Type.String(),
        }),
        body: UpdateFileRequestSchema,
        response: {
          200: FileOperationSuccessSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;
      const filePath = request.params['*'];
      const { content, encoding } = request.body;

      try {
        const projectPath = await verifySessionAccess(sessionId, userId);
        const result = await fileService.updateFile(
          sessionId,
          projectPath,
          filePath,
          content,
          encoding,
        );
        return reply.send(result);
      } catch (error: any) {
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
        throw error;
      }
    },
  );

  // Delete file
  fastify.delete<{
    Params: { sessionId: string; '*': string };
  }>(
    '/*',
    {
      preHandler: fastify.authenticate,
      config: {
        rateLimit: rateLimitConfig.file,
      },
      schema: {
        headers: { $ref: 'authHeaders#' },
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          '*': Type.String(),
        }),
        response: {
          200: FileOperationSuccessSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const { sessionId } = request.params;
      const filePath = request.params['*'];

      try {
        const projectPath = await verifySessionAccess(sessionId, userId);
        const result = await fileService.deleteFile(sessionId, projectPath, filePath);
        return reply.send(result);
      } catch (error: any) {
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
        throw error;
      }
    },
  );
};

export default fileRoutes;
