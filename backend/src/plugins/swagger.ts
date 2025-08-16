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
        // Convert Zod schemas to JSON Schema format
        const convertZodToJsonSchema = (obj: unknown): unknown => {
          // Check if this is a Zod schema object
          if (
            obj &&
            typeof obj === 'object' &&
            (obj as Record<string, unknown>)['~standard'] &&
            (obj as Record<string, unknown>).def
          ) {
            // Convert Zod schema to JSON Schema
            try {
              // For different Zod types, convert to appropriate JSON Schema
              const def = (obj as Record<string, unknown>).def as Record<string, unknown>;

              if (def.type === 'string') {
                return {
                  type: 'string',
                  ...(def.format && { format: def.format }),
                  ...(def.minLength !== null && { minLength: def.minLength }),
                  ...(def.maxLength !== null && { maxLength: def.maxLength }),
                };
              }

              if (def.type === 'number') {
                return {
                  type: def.isInt ? 'integer' : 'number',
                  ...(def.minValue !== null && { minimum: def.minValue }),
                  ...(def.maxValue !== null && { maximum: def.maxValue }),
                };
              }

              if (def.type === 'boolean') {
                return { type: 'boolean' };
              }

              if (def.type === 'object' && def.shape) {
                const properties: Record<string, unknown> = {};
                const required: string[] = [];

                for (const [key, value] of Object.entries(def.shape)) {
                  properties[key] = convertZodToJsonSchema(value);
                  // Check if field is required (not optional)
                  if (!(value as Record<string, unknown>)?.def?.type?.includes?.('optional')) {
                    required.push(key);
                  }
                }

                return {
                  type: 'object',
                  properties,
                  ...(required.length > 0 && { required }),
                };
              }

              if (def.type === 'array') {
                return {
                  type: 'array',
                  items: convertZodToJsonSchema(def.element),
                };
              }

              if (def.type === 'union') {
                return {
                  anyOf: def.options.map((option: unknown) => convertZodToJsonSchema(option)),
                };
              }

              if (def.type === 'literal') {
                return {
                  type: typeof def.values[0],
                  enum: def.values,
                };
              }

              if (def.type === 'optional') {
                return convertZodToJsonSchema(def.innerType);
              }

              if (def.type === 'nullable') {
                const innerSchema = convertZodToJsonSchema(def.innerType);
                return {
                  anyOf: [innerSchema, { type: 'null' }],
                };
              }

              if (def.type === 'default') {
                const innerSchema = convertZodToJsonSchema(def.innerType);
                return {
                  ...innerSchema,
                  default: def.defaultValue,
                };
              }

              // Fallback for unknown types
              return { type: 'unknown' };
            } catch (error) {
              console.warn('Failed to convert Zod schema:', error);
              return { type: 'unknown' };
            }
          }

          // Recursively process arrays
          if (Array.isArray(obj)) {
            return obj.map(convertZodToJsonSchema);
          }

          // Recursively process objects
          if (obj && typeof obj === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
              result[key] = convertZodToJsonSchema(value);
            }
            return result;
          }

          return obj;
        };

        return convertZodToJsonSchema(swaggerObject);
      },
    });

    // Log documentation URL
    fastify.log.info(`API documentation available at http://localhost:${config.PORT}/docs`);
  }
};

export default fp(swaggerPlugin, {
  name: 'swagger',
});
