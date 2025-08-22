import { ApiError } from '@pokecode/core';
import type { FastifyError, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

interface FastifyValidationError extends Error {
  validation: unknown[];
}

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

function isValidationError(error: unknown): error is FastifyValidationError {
  return error instanceof Error && 'validation' in error;
}

function hasStatusCode(error: unknown): error is ErrorWithStatusCode {
  return error instanceof Error && 'statusCode' in error;
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  // Set custom error handler
  fastify.setErrorHandler((error: FastifyError | ApiError | Error, request, reply) => {
    // Log the error
    fastify.log.error({
      err: error,
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        query: request.query,
      },
    });

    // Handle custom API errors
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
    }

    // Handle Fastify validation errors
    if (isValidationError(error)) {
      return reply.code(400).send({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: error.validation,
      });
    }

    // Handle rate limit errors
    if (hasStatusCode(error) && error.statusCode === 429) {
      return reply.code(429).send({
        error: error.message || 'Too many requests',
        code: 'RATE_LIMIT_ERROR',
        statusCode: 429,
      });
    }

    // Handle response serialization errors with detailed logging
    if (error.message?.includes('does not match schema definition')) {
      // Try to extract more detailed error information
      const errorDetails: Record<string, unknown> = {
        message: error.message,
        stack: error.stack,
        requestUrl: request.url,
        requestMethod: request.method,
        errorName: error.name,
        errorCode: (error as unknown as Record<string, unknown>).code,
        allErrorKeys: Object.keys(error),
        errorConstructor: error.constructor.name,
      };

      // Check for AJV/validation specific properties
      if ('validation' in error) {
        errorDetails.validation = (error as unknown as Record<string, unknown>).validation;
      }
      if ('validationContext' in error) {
        errorDetails.validationContext = (
          error as unknown as Record<string, unknown>
        ).validationContext;
      }
      if ('schemaPath' in error) {
        errorDetails.schemaPath = (error as unknown as Record<string, unknown>).schemaPath;
      }
      if ('instancePath' in error) {
        errorDetails.instancePath = (error as unknown as Record<string, unknown>).instancePath;
      }
      if ('params' in error) {
        errorDetails.params = (error as unknown as Record<string, unknown>).params;
      }

      // Check for fast-json-stringify specific properties
      if ('serialization' in error) {
        errorDetails.serialization = (error as unknown as Record<string, unknown>).serialization;
        fastify.log.error(
          {
            fastJsonStringifyError: (error as unknown as Record<string, unknown>).serialization,
          },
          'fast-json-stringify serialization details',
        );
      }

      fastify.log.error(
        {
          serializationError: errorDetails,
        },
        'Response serialization error - schema mismatch detected',
      );

      return reply.code(500).send({
        error: 'Response serialization error',
        code: 'SERIALIZATION_ERROR',
        statusCode: 500,
        details: error.message,
        debug:
          process.env.NODE_ENV === 'development'
            ? {
                allErrorKeys: Object.keys(error),
                errorConstructor: error.constructor.name,
                errorName: error.name,
              }
            : undefined,
      });
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return reply.code(401).send({
        error: 'Invalid or expired token',
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401,
      });
    }

    // Handle database errors
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return reply.code(503).send({
        error: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
    }

    // Default error response
    const statusCode = hasStatusCode(error) ? error.statusCode || 500 : 500;
    const message = statusCode === 500 ? 'Internal server error' : error.message;

    return reply.code(statusCode).send({
      error: message,
      code: 'INTERNAL_ERROR',
      statusCode,
    });
  });

  // Add not found handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Route not found',
      code: 'NOT_FOUND',
      statusCode: 404,
      path: request.url,
    });
  });

  // Add hook to catch uncaught errors
  fastify.addHook('onError', async (request, _reply, error) => {
    // Additional error logging or reporting can be added here
    if (hasStatusCode(error) && error.statusCode && error.statusCode >= 500) {
      fastify.log.fatal(
        {
          err: error,
          request: {
            id: request.id,
            method: request.method,
            url: request.url,
          },
        },
        'Internal server error',
      );
    }
  });
};

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});
