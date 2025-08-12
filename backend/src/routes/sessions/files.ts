import { type Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
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
  async function verifySessionAccess(sessionId: string) {
    const session = await sessionService.getSession(sessionId);
    return session.projectPath;
  }

  // List files
  fastify.get<{
    Params: { sessionId: string };
    Querystring: Static<typeof ListFilesQuerySchema>;
  }>(
    '/',
    {
      schema: {
        params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }),
        querystring: ListFilesQuerySchema,
        response: {
          200: ListFilesResponseSchema,
          400: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          403: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          404: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { path, recursive, pattern } = request.query;

      try {
        const projectPath = await verifySessionAccess(sessionId);
        const result = await fileService.listFiles(sessionId, projectPath, path, {
          ...(recursive !== undefined && { recursive }),
          ...(pattern !== undefined && { pattern }),
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
      schema: {
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          '*': Type.String(),
        }),
        response: {
          200: GetFileResponseSchema,
          400: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          403: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          404: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const filePath = request.params['*'];

      try {
        const projectPath = await verifySessionAccess(sessionId);
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
      schema: {
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          '*': Type.String(),
        }),
        body: CreateFileRequestSchema,
        response: {
          201: FileOperationSuccessSchema,
          400: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          403: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          409: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const filePath = request.params['*'];
      const { content, encoding } = request.body;

      try {
        const projectPath = await verifySessionAccess(sessionId);
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
      schema: {
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          '*': Type.String(),
        }),
        body: UpdateFileRequestSchema,
        response: {
          200: FileOperationSuccessSchema,
          400: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          403: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          404: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const filePath = request.params['*'];
      const { content, encoding } = request.body;

      try {
        const projectPath = await verifySessionAccess(sessionId);
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
      schema: {
        params: Type.Object({
          sessionId: Type.String({ format: 'uuid' }),
          '*': Type.String(),
        }),
        response: {
          200: FileOperationSuccessSchema,
          400: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          403: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
          404: Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const filePath = request.params['*'];

      try {
        const projectPath = await verifySessionAccess(sessionId);
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
