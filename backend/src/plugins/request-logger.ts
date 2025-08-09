import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

type Json = unknown;

const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'pwd',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'authorization',
  'auth',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function sanitize(value: Json, depth = 0): Json {
  if (depth > 6) {
    return '[redacted: depth]';
  }

  if (value == null) {
    return value as null;
  }

  if (typeof value === 'string') {
    if (value.length > 2000) {
      return `${value.slice(0, 2000)}…[truncated]`;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const max = 50;
    const arr = value.slice(0, max).map((v) => sanitize(v, depth + 1));
    if (value.length > max) {
      arr.push('…[truncated array]');
    }
    return arr;
  }

  if (isPlainObject(value)) {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = sanitize(v as Json, depth + 1);
      }
    }
    return out;
  }

  // For other types (Buffer, Stream, etc.)
  return `[${typeof value}]`;
}

const requestLoggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Log POST request bodies (sanitized) to aid debugging
  fastify.addHook('preHandler', async (request, _reply) => {
    if (request.method !== 'POST') {
      return;
    }

    // Avoid logging huge or binary bodies (e.g., multipart)
    const contentType = request.headers['content-type'] || '';
    if (/multipart\/form-data/i.test(contentType)) {
      return;
    }

    const body = (request as any).body;
    if (body === undefined) {
      return;
    }

    try {
      const safeBody = sanitize(body);
      fastify.log.info(
        {
          reqId: request.id,
          method: request.method,
          url: request.url,
          body: safeBody,
        },
        'incoming request body',
      );
    } catch {
      // Best-effort; never throw from logging
    }
  });
};

export default fp(requestLoggerPlugin, { name: 'request-logger' });
