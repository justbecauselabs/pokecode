import { type Static, Type } from '@sinclair/typebox';

// Login schemas
export const LoginRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 6 }),
});

export const LoginResponseSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    name: Type.Optional(Type.String()),
  }),
});

// Refresh token schemas
export const RefreshRequestSchema = Type.Object({
  refreshToken: Type.String(),
});

export const RefreshResponseSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
});

// Logout schemas
export const LogoutResponseSchema = Type.Object({
  success: Type.Boolean(),
});

// Error response schema
export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  code: Type.Optional(Type.String()),
  details: Type.Optional(Type.Any()),
});

// Type exports
export type LoginRequest = Static<typeof LoginRequestSchema>;
export type LoginResponse = Static<typeof LoginResponseSchema>;
export type RefreshRequest = Static<typeof RefreshRequestSchema>;
export type RefreshResponse = Static<typeof RefreshResponseSchema>;
export type LogoutResponse = Static<typeof LogoutResponseSchema>;
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
