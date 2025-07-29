import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { config, isDevelopment } from '@/config';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Register swagger documentation generator
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Claude Code Mobile API',
        description: 'Backend API for Claude Code Mobile application',
        version: '1.0.0',
      },
      servers: [
        {
          url: isDevelopment ? `http://localhost:${config.PORT}` : 'https://api.claudecode.com',
          description: isDevelopment ? 'Development server' : 'Production server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'sessions', description: 'Session management' },
        { name: 'prompts', description: 'Prompt execution' },
        { name: 'files', description: 'File operations' },
        { name: 'health', description: 'Health checks' },
      ],
    },
  });

  // Register swagger UI
  if (isDevelopment) {
    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
        persistAuthorization: true,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject) => {
        // Add example values for better documentation
        return swaggerObject;
      },
    });

    // Log documentation URL
    fastify.log.info(`API documentation available at http://localhost:${config.PORT}/docs`);
  }
};

export default fp(swaggerPlugin, {
  name: 'swagger',
});
