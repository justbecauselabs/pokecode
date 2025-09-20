import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
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
  // Track request start times to compute response durations
  const startTimes = new WeakMap<FastifyRequest, bigint>();
  // Track whether we already logged the request body in preValidation
  const preValidationLogged = new WeakSet<FastifyRequest>();

  fastify.addHook('onRequest', async (request, _reply) => {
    // High-resolution start time
    startTimes.set(request, process.hrtime.bigint());
  });

  // Log as early as possible with sanitized body, before validation can fail.
  fastify.addHook('preValidation', async (request, _reply) => {
    try {
      const method = request.method;
      const url = request.url;
      const hostname = request.hostname;

      // Only include body for methods that typically carry one
      const shouldIncludeBody =
        method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

      // Avoid logging huge or binary bodies (e.g., multipart)
      const contentType = request.headers['content-type'] || '';
      const isMultipart = /multipart\/form-data/i.test(contentType);

      const body =
        shouldIncludeBody && !isMultipart && 'body' in request ? request.body : undefined;

      // For the sessions create endpoint, include a compact snapshot of key fields
      let bodySnapshot: Json | undefined;
      if (body && Object.prototype.toString.call(body) === '[object Object]') {
        bodySnapshot = sanitize(body);
      } else if (body !== undefined) {
        bodySnapshot = `[${typeof body}]`;
      }

      const logFields: Record<string, Json> = {
        reqId: request.id,
        stage: 'preValidation',
        req: { method, url, hostname },
      };

      if (bodySnapshot !== undefined) {
        logFields.body = bodySnapshot;
      }

      fastify.log.info(logFields, 'incoming request');
      preValidationLogged.add(request);
    } catch {
      // Best-effort; never throw from logging
    }
  });

  // Emit a single, consistent "incoming request" log (like Fastify's default)
  // but include a sanitized body for write methods when appropriate. Skip if already logged.
  fastify.addHook('preHandler', async (request, _reply) => {
    if (preValidationLogged.has(request)) return;
    try {
      const method = request.method;
      const url = request.url;
      const hostname = request.hostname;

      // Prefer x-forwarded-for first hop, then Fastify's ip, then raw socket
      const xff = Array.isArray(request.headers['x-forwarded-for'])
        ? request.headers['x-forwarded-for'][0]
        : request.headers['x-forwarded-for'];
      let forwardedIp: string | undefined;
      if (typeof xff === 'string') {
        const firstHop = xff.split(',')[0];
        const trimmed = firstHop ? firstHop.trim() : '';
        if (trimmed.length > 0) {
          forwardedIp = trimmed;
        }
      }
      const remoteAddress =
        forwardedIp ??
        request.ip ??
        (request.raw as { socket?: { remoteAddress?: string } }).socket?.remoteAddress;
      const remotePort = (request.raw as { socket?: { remotePort?: number } }).socket?.remotePort;

      // Only include body for methods that typically carry one
      const shouldIncludeBody =
        method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

      // Avoid logging huge or binary bodies (e.g., multipart)
      const contentType = request.headers['content-type'] || '';
      const isMultipart = /multipart\/form-data/i.test(contentType);

      const body =
        shouldIncludeBody && !isMultipart && 'body' in request ? request.body : undefined;

      const logFields: Record<string, Json> = {
        reqId: request.id,
        req: {
          method,
          url,
          hostname,
          remoteAddress,
          remotePort,
        },
      };

      if (body !== undefined) {
        logFields.body = sanitize(body);
      }

      fastify.log.info(logFields, 'incoming request');
    } catch {
      // Best-effort; never throw from logging
    }
  });

  // Mirror Fastify's default completion log to retain observability
  fastify.addHook('onResponse', async (request, reply) => {
    try {
      const start = startTimes.get(request);
      const durationNs = start ? Number(process.hrtime.bigint() - start) : undefined;
      const responseTimeMs =
        durationNs !== undefined ? Math.round(durationNs / 1_000_000) : undefined;

      const fields: Record<string, Json> = {
        reqId: request.id,
        res: {
          statusCode: reply.statusCode,
        },
      };

      if (responseTimeMs !== undefined) {
        fields.responseTime = responseTimeMs;
      }

      fastify.log.info(fields, 'request completed');
    } catch {
      // Never throw from logging
    }
  });
};

export default fp(requestLoggerPlugin, { name: 'request-logger' });
