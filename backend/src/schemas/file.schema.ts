import { type Static, Type } from '@sinclair/typebox';

// List files schemas
export const ListFilesQuerySchema = Type.Object({
  path: Type.Optional(Type.String({ default: '.' })),
  recursive: Type.Optional(Type.Boolean({ default: false })),
  pattern: Type.Optional(Type.String()),
});

export const FileInfoSchema = Type.Object({
  path: Type.String(),
  name: Type.String(),
  type: Type.Union([Type.Literal('file'), Type.Literal('directory')]),
  size: Type.Optional(Type.Number()),
  modifiedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export const ListFilesResponseSchema = Type.Object({
  files: Type.Array(FileInfoSchema),
  basePath: Type.String(),
});

// Get file schemas
export const GetFileResponseSchema = Type.Object({
  path: Type.String(),
  content: Type.String(),
  encoding: Type.String(),
  size: Type.Number(),
  mimeType: Type.String(),
  modifiedAt: Type.String({ format: 'date-time' }),
});

// Create/Update file schemas
export const CreateFileRequestSchema = Type.Object({
  content: Type.String(),
  encoding: Type.Optional(Type.String({ default: 'utf-8' })),
});

export const UpdateFileRequestSchema = Type.Object({
  content: Type.String(),
  encoding: Type.Optional(Type.String({ default: 'utf-8' })),
});

// File path params
export const FilePathParamsSchema = Type.Object({
  sessionId: Type.String({ format: 'uuid' }),
  '*': Type.String(), // Wildcard for file path
});

// Success response
export const FileOperationSuccessSchema = Type.Object({
  success: Type.Boolean(),
  path: Type.String(),
});

// Type exports
export type ListFilesQuery = Static<typeof ListFilesQuerySchema>;
export type FileInfo = Static<typeof FileInfoSchema>;
export type ListFilesResponse = Static<typeof ListFilesResponseSchema>;
export type GetFileResponse = Static<typeof GetFileResponseSchema>;
export type CreateFileRequest = Static<typeof CreateFileRequestSchema>;
export type UpdateFileRequest = Static<typeof UpdateFileRequestSchema>;
export type FilePathParams = Static<typeof FilePathParamsSchema>;
export type FileOperationSuccess = Static<typeof FileOperationSuccessSchema>;
