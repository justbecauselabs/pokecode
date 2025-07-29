import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { config, rateLimitConfig } from '@/config';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(config.REDIS_URL);

  await fastify.register(rateLimit, {
    global: false, // We'll apply rate limits per route
    redis,
    nameSpace: 'claude-code-rate-limit:',
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise use IP
      const user = request.user as any;
      return user?.sub || request.ip;
    },
    errorResponseBuilder: (_request, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${Math.ceil(context.ttl / 1000)} seconds`,
        code: 'RATE_LIMIT_ERROR',
        rateLimit: {
          limit: context.max,
          remaining: (context as any).remaining || 0,
          reset: new Date(Date.now() + context.ttl).toISOString(),
        },
      };
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // Store rate limit configurations on fastify instance
  fastify.decorate('rateLimits', rateLimitConfig);

  // Clean up Redis connection on close
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
};

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
});
