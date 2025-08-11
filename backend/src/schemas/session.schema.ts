import { type Static, Type } from '@sinclair/typebox';

// Create session schemas
export const CreateSessionRequestSchema = Type.Object({
  projectPath: Type.Optional(
    Type.String({
      pattern: '^[a-zA-Z0-9._/-]+$',
      minLength: 1,
      maxLength: 255,
    }),
  ),
  folderName: Type.Optional(
    Type.String({
      pattern: '^[a-zA-Z0-9._-]+$',
      minLength: 1,
      maxLength: 100,
    }),
  ),
  context: Type.Optional(Type.String({ maxLength: 5000 })),
  metadata: Type.Optional(
    Type.Object({
      repository: Type.Optional(Type.String()),
      branch: Type.Optional(Type.String()),
      allowedTools: Type.Optional(Type.Array(Type.String())),
    }),
  ),
});

export const SessionResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String(),
  projectPath: Type.String(),
  context: Type.Optional(Type.String()),
  status: Type.Union([Type.Literal('active'), Type.Literal('inactive'), Type.Literal('archived')]),
  metadata: Type.Optional(Type.Any()),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  lastAccessedAt: Type.String({ format: 'date-time' }),
});

// List sessions schemas
export const ListSessionsQuerySchema = Type.Object({
  status: Type.Optional(
    Type.Union([Type.Literal('active'), Type.Literal('inactive'), Type.Literal('archived')]),
  ),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});

export const ListSessionsResponseSchema = Type.Object({
  sessions: Type.Array(SessionResponseSchema),
  total: Type.Integer(),
  limit: Type.Integer(),
  offset: Type.Integer(),
});

// Update session schemas
export const UpdateSessionRequestSchema = Type.Object({
  context: Type.Optional(Type.String({ maxLength: 5000 })),
  status: Type.Optional(
    Type.Union([Type.Literal('active'), Type.Literal('inactive'), Type.Literal('archived')]),
  ),
  metadata: Type.Optional(Type.Any()),
});

// Session params schema
export const SessionParamsSchema = Type.Object({
  sessionId: Type.String({ format: 'uuid' }),
});

// Type exports
export type CreateSessionRequest = Static<typeof CreateSessionRequestSchema>;
export type SessionResponse = Static<typeof SessionResponseSchema>;
export type ListSessionsQuery = Static<typeof ListSessionsQuerySchema>;
export type ListSessionsResponse = Static<typeof ListSessionsResponseSchema>;
export type UpdateSessionRequest = Static<typeof UpdateSessionRequestSchema>;
export type SessionParams = Static<typeof SessionParamsSchema>;
