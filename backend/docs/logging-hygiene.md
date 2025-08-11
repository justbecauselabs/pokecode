# Logging Hygiene: Protect Secrets and Reduce Noise

This guide details improvements to avoid leaking sensitive data in logs and to keep logs informative but bounded.

## Problems

- Sensitive headers in error logs: The error handler logs full `request.headers`, which can include `authorization`, cookies, or other secrets.
- Logging file contents: The request-body logger logs all POST bodies; file creation and updates include full file content (potentially large or sensitive). Even with truncation, this is risky and noisy.
- Unbounded entries: Pathological inputs could still produce very large log entries across nested structures.

## Goals

- Redact sensitive fields consistently (headers, bodies).
- Avoid logging raw file contents; log metadata instead.
- Bound the size of logs for stability.

## Recommended Changes

1) Sanitize headers in the error handler

```ts
// backend/src/plugins/error-handler.ts (sanitize headers before logging)
const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'cookie', 'set-cookie']);

function sanitizeHeaders(headers: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k] = SENSITIVE_HEADER_KEYS.has(k.toLowerCase()) ? '[redacted]' : v;
  }
  return out;
}

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error({
    err: error,
    request: {
      method: request.method,
      url: request.url,
      headers: sanitizeHeaders(request.headers as any),
      params: request.params,
      query: request.query,
    },
  });
  // ... existing response logic ...
});
```

2) Skip/restrict body logging for file routes

```ts
// backend/src/plugins/request-logger.ts (add route-based guard)
fastify.addHook('preHandler', async (request, _reply) => {
  if (request.method !== 'POST') return;

  const url = request.url || '';
  // Skip file content routes
  if (/^\/api\/claude-code\/sessions\/.+\/files\//.test(url)) {
    // Optionally log lightweight metadata
    const params = (request as any).params || {};
    fastify.log.info({ reqId: request.id, method: request.method, url, params }, 'incoming file op');
    return;
  }

  const contentType = request.headers['content-type'] || '';
  if (/multipart\/form-data/i.test(contentType)) return;
  const body = (request as any).body;
  if (body === undefined) return;
  const safeBody = sanitize(body);
  fastify.log.info({ reqId: request.id, method: request.method, url, body: safeBody }, 'incoming request body');
});
```

3) Add a global size cap helper (optional)

```ts
// backend/src/plugins/request-logger.ts (wrap the final payload)
function capSize(value: string, maxBytes = 16 * 1024) {
  const buf = Buffer.from(value);
  if (buf.byteLength <= maxBytes) return value;
  return buf.subarray(0, maxBytes).toString() + '…[truncated]';
}

// When logging, stringify then cap
try {
  const json = JSON.stringify({ reqId: request.id, method: request.method, url, body: safeBody });
  fastify.log.info(capSize(json));
} catch {}
```

4) Consider reducing default log levels in production

- In `utils/logger.ts`, production logs already go to stdout with `info`. Ensure `LOG_LEVEL` in prod is not `trace` or `debug` unless troubleshooting.

## Testing Tips

- Trigger an auth error and confirm `authorization` header is redacted.
- Create/update a file and ensure contents are not logged; only path and small metadata should appear.
- Send oversized JSON bodies; verify entries are truncated and service remains responsive.

