import { z } from 'zod';

// Directory item schema
export const DirectoryItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
  modifiedAt: z.string().optional(),
  isGitRepository: z.boolean().optional(),
});

// Request schemas
export const BrowseDirectoryQuerySchema = z.object({
  path: z.string().optional(), // If not provided, start at home directory
});

// Response schemas
export const BrowseDirectoryResponseSchema = z.object({
  currentPath: z.string(),
  parentPath: z.string().nullable(), // null if at root
  items: z.array(DirectoryItemSchema),
});

// Add repository request schema for saving new paths
export const AddRepositoryRequestSchema = z.object({
  path: z.string(),
});

export const AddRepositoryResponseSchema = z.object({
  success: z.boolean(),
  repository: z
    .object({
      folderName: z.string(),
      path: z.string(),
      isGitRepository: z.boolean(),
    })
    .optional(),
});

// Export types
export type DirectoryItem = z.infer<typeof DirectoryItemSchema>;
export type BrowseDirectoryQuery = z.infer<typeof BrowseDirectoryQuerySchema>;
export type BrowseDirectoryResponse = z.infer<typeof BrowseDirectoryResponseSchema>;
export type AddRepositoryRequest = z.infer<typeof AddRepositoryRequestSchema>;
export type AddRepositoryResponse = z.infer<typeof AddRepositoryResponseSchema>;
