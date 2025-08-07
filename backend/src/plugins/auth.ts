import jwt from '@fastify/jwt';
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { jwtConfig } from '@/config';
import { AuthenticationError } from '@/types';
import { jwtService } from '@/utils/jwt';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Register JWT plugin
  await fastify.register(jwt, {
    secret: jwtConfig.access.secret,
    sign: {
      expiresIn: jwtConfig.access.expiresIn,
    },
  });

  // Decorate request with user (only if not already decorated)
  if (!fastify.hasRequestDecorator('user')) {
    fastify.decorateRequest('user', null);
  }

  // Authentication hook (only if not already decorated)
  if (!fastify.hasDecorator('authenticate')) {
    fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = jwtService.extractTokenFromHeader(request.headers.authorization);

      if (!token) {
        throw new AuthenticationError('No token provided');
      }

      // Check if token is blacklisted
      const isBlacklisted = await jwtService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked');
      }

      // Verify token
      const decoded = await request.jwtVerify({ complete: false });
      request.user = decoded as any;
    } catch (err) {
      if (err instanceof AuthenticationError) {
        reply.code(401).send({
          error: err.message,
          code: err.code,
        });
      } else {
        reply.code(401).send({
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
        });
      }
    }
  });
  }

  // Add auth schema
  fastify.addSchema({
    $id: 'authHeaders',
    type: 'object',
    properties: {
      authorization: Type.String({ pattern: '^Bearer .+$' }),
    },
    required: ['authorization'],
  });

  // Optional auth hook (for endpoints that work with or without auth)
  if (!fastify.hasDecorator('optionalAuth')) {
    fastify.decorate('optionalAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
      try {
        const token = jwtService.extractTokenFromHeader(request.headers.authorization);

        if (token) {
          const isBlacklisted = await jwtService.isTokenBlacklisted(token);
          if (!isBlacklisted) {
            const decoded = await request.jwtVerify({ complete: false });
            request.user = decoded as any;
          }
        }
      } catch (_err) {
        // Ignore errors for optional auth
        request.user = undefined as any;
      }
    });
  }
};

export default fp(authPlugin, {
  name: 'auth',
});
