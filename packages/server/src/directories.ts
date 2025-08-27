import { resolve } from 'node:path';
import {
  type BrowseDirectoryQuery,
  BrowseDirectoryQuerySchema,
  BrowseDirectoryResponseSchema,
} from '@pokecode/api';
import { getHomeDirectory, getParentPath, joinPath, validateGitRepository } from '@pokecode/core';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const directoryRoutes: FastifyPluginAsync = async (fastify) => {
  // Browse directory contents
  fastify.get(
    '/browse',
    {
      schema: {
        querystring: BrowseDirectoryQuerySchema,
        response: {
          200: BrowseDirectoryResponseSchema,
          400: z.object({
            error: z.string(),
            code: z.string(),
          }),
          500: z.object({
            error: z.string(),
            code: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { path } = request.query as BrowseDirectoryQuery;

        // Default to home directory if no path provided
        const targetPath = path ? resolve(path) : getHomeDirectory();

        // Security check: prevent directory traversal attacks
        const normalizedPath = resolve(targetPath);
        if (!normalizedPath.startsWith('/')) {
          return reply.code(400).send({
            error: 'Invalid path provided',
            code: 'INVALID_PATH',
          });
        }

        try {
          // Import fs functions and check if directory exists using stat
          const { readdir, stat } = await import('node:fs/promises');
          const stats = await stat(normalizedPath);

          if (!stats.isDirectory()) {
            return reply.code(400).send({
              error: 'Path is not a directory',
              code: 'NOT_A_DIRECTORY',
            });
          }

          // Read directory contents using readdir
          const dirEntries = await readdir(normalizedPath);
          const entries = [];

          // Process each entry
          for (const entry of dirEntries) {
            try {
              const entryPath = joinPath(normalizedPath, entry);
              const stats = await stat(entryPath);

              // Only include directories for project selection
              if (stats.isDirectory()) {
                // Check if it's a git repository using existing utility
                const gitInfo = await validateGitRepository(entryPath);
                const isGitRepository = gitInfo.isGitRepository;

                entries.push({
                  name: entry,
                  path: entryPath,
                  type: 'directory' as const,
                  isGitRepository,
                });
              }
            } catch (_entryError) {
              // Skip entries we can't access (permission denied, etc.)
            }
          }

          // Sort directories: git repos first, then alphabetically
          entries.sort((a, b) => {
            if (a.isGitRepository && !b.isGitRepository) return -1;
            if (!a.isGitRepository && b.isGitRepository) return 1;
            return a.name.localeCompare(b.name);
          });

          // Determine parent path
          const parentPath = normalizedPath === '/' ? null : getParentPath(normalizedPath);

          return reply.send({
            currentPath: normalizedPath,
            parentPath,
            items: entries,
          });
        } catch (readError) {
          if (readError instanceof Error && 'code' in readError && readError.code === 'ENOENT') {
            return reply.code(400).send({
              error: 'Directory does not exist',
              code: 'DIRECTORY_NOT_FOUND',
            });
          }
          return reply.code(400).send({
            error: 'Permission denied or unable to read directory',
            code: 'DIRECTORY_READ_ERROR',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        fastify.log.error(
          {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          },
          'Failed to browse directory',
        );
        return reply.code(500).send({
          error: `Failed to browse directory: ${errorMessage}`,
          code: 'DIRECTORY_BROWSE_ERROR',
        });
      }
    },
  );
};

export default directoryRoutes;
