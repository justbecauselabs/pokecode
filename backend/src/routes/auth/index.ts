import { type Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import {
  ErrorResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
  RefreshRequestSchema,
  RefreshResponseSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
} from '@/schemas/auth.schema';
import { authService } from '@/services/auth.service';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register endpoint
  fastify.post<{
    Body: import('@/schemas/auth.schema').RegisterRequest;
  }>(
    '/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        body: RegisterRequestSchema,
        response: {
          201: RegisterResponseSchema,
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password, name } = request.body;
      try {
        const result = await authService.register(email, password, name);
        return reply.code(201).send(result);
      } catch (error: any) {
        const msg = error?.message || 'Registration failed';
        const code = msg.includes('registered') ? 409 : 400;
        return reply
          .code(code)
          .send({ error: msg, code: code === 409 ? 'ALREADY_REGISTERED' : 'REGISTER_FAILED' });
      }
    },
  );

  // Login endpoint
  fastify.post<{
    Body: Static<typeof LoginRequestSchema>;
  }>(
    '/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        body: LoginRequestSchema,
        response: {
          200: LoginResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      try {
        const result = await authService.login(email, password);
        return reply.send(result);
      } catch (error: any) {
        return reply.code(400).send({
          error: error.message,
          code: 'LOGIN_FAILED',
        });
      }
    },
  );

  // Refresh token endpoint
  fastify.post<{
    Body: Static<typeof RefreshRequestSchema>;
  }>(
    '/refresh',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        body: RefreshRequestSchema,
        response: {
          200: RefreshResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      try {
        const result = await authService.refresh(refreshToken);
        return reply.send(result);
      } catch (error: any) {
        return reply.code(401).send({
          error: error.message,
          code: 'REFRESH_FAILED',
        });
      }
    },
  );

  // Logout endpoint
  fastify.post(
    '/logout',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        response: {
          200: LogoutResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const accessToken = request.headers.authorization?.substring(7);

      if (!accessToken) {
        return reply.code(401).send({
          error: 'No access token provided',
          code: 'NO_ACCESS_TOKEN',
        });
      }

      try {
        const result = await authService.logout(userId, accessToken);
        return reply.send(result);
      } catch (_error: any) {
        return reply.code(500).send({
          error: 'Logout failed',
          code: 'LOGOUT_FAILED',
        });
      }
    },
  );

  // Get current user endpoint
  fastify.get(
    '/me',
    {
      preHandler: fastify.authenticate,
      schema: {
        headers: { $ref: 'authHeaders#' },
        response: {
          200: Type.Object({
            id: Type.String(),
            email: Type.String(),
            name: Type.Optional(Type.String()),
            createdAt: Type.String(),
            lastLoginAt: Type.String(),
          }),
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;

      try {
        const user = await authService.getUser(userId);
        return reply.send(user);
      } catch (_error: any) {
        return reply.code(404).send({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }
    },
  );
};

export default authRoutes;
