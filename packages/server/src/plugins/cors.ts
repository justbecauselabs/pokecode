import cors from '@fastify/cors';
import { config } from '@pokecode/core';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Log the origin for debugging
      fastify.log.debug({ origin }, 'CORS origin check');

      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        fastify.log.debug('CORS: Allowing request with no origin');
        cb(null, true);
        return;
      }

      // Parse allowed origins from config
      const allowedOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
      fastify.log.debug({ allowedOrigins, requestedOrigin: origin }, 'CORS: Checking origin');

      // Check if origin is allowed
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        fastify.log.debug({ origin }, 'CORS: Origin allowed');
        cb(null, true);
      } else {
        fastify.log.warn({ origin, allowedOrigins }, 'CORS: Origin not allowed');
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  });
};

export default fp(corsPlugin, {
  name: 'cors',
});
