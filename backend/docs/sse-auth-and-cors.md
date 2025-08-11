# SSE Auth and CORS: Reliable Streaming for Authenticated Clients

This guide explains the current friction between browser EventSource, authorization, and CORS, and proposes patterns with code samples to make streaming robust and secure.

## Problems

- EventSource cannot set custom headers: Browsers do not allow setting `Authorization: Bearer ...` on native `EventSource`. The `/stream` route requires header-based auth, so authenticated clients cannot open the stream using EventSource.
- CORS header mismatch: The SSE route writes `Access-Control-Allow-Origin: *` while the CORS plugin enables `credentials: true`. With credentials, `*` is invalid; browsers will reject such responses.
- Duplication: The SSE route hand-codes headers and heartbeat logic while there is already an `SSEStream` utility that standardizes this.

## Goals

- Allow authenticated clients to consume SSE with native EventSource.
- Keep CORS behavior consistent and correct (one source of truth).
- Centralize SSE headers and logic for maintainability.

## Recommended Approaches

Pick one of the following (A is generally simplest):

A) Short-lived stream token in query string

- Issue a short-lived, signed token (distinct from the main access token) for streaming.
- Pass it as `?stream_token=...` to the SSE endpoint; validate server-side.
- Keep lifetime small (e.g., 1–5 minutes) and bind to user/session/prompt.

B) Cookie-based auth

- Put the access token in an HttpOnly, same-site cookie.
- Ensure the CORS settings align with credentials and origins.
- EventSource will send cookies automatically.

C) Fetch-based SSE polyfill

- Use `fetch()` + `ReadableStream` to emulate SSE and include `Authorization` headers.
- Useful in environments where you control clients fully and do not want query tokens or cookies.

Below we outline A and show code.

## Implementation (Approach A)

1) Add a helper to mint and verify short-lived stream tokens

```ts
// backend/src/utils/jwt.ts (add methods)
import jwt from 'jsonwebtoken';

export class JWTService {
  // ...existing...

  generateStreamToken(payload: { sub: string; sessionId: string; promptId: string }, ttl = '5m') {
    return jwt.sign(payload, jwtConfig.access.secret, { expiresIn: ttl } as any);
  }

  verifyStreamToken(token: string): { sub: string; sessionId: string; promptId: string } {
    return jwt.verify(token, jwtConfig.access.secret) as any;
  }
}
```

2) Add an endpoint that returns a stream token

```ts
// backend/src/routes/sessions/prompts.ts (near create/get endpoints)
fastify.post<{ Params: { sessionId: string; promptId: string } }>(
  '/:promptId/stream-token',
  { preHandler: fastify.authenticate },
  async (request, reply) => {
    const userId = (request.user as any).sub;
    const { sessionId, promptId } = request.params;

    // Access verification reused from existing get logic
    await promptService.getPrompt(promptId, sessionId, userId);
    const token = jwtService.generateStreamToken({ sub: userId, sessionId, promptId }, '3m');
    return reply.send({ token, expiresIn: 180 });
  },
);
```

3) Update the SSE route to accept `stream_token` query param and use `SSEStream`

```ts
// backend/src/routes/sessions/stream.ts
import { SSEStream, createSSEHeartbeat } from '@/utils/sse';

fastify.get<{ Params: { sessionId: string; promptId: string }; Querystring: { stream_token?: string } }>(
  '/stream',
  {
    // Do not require header Authorization for EventSource
    // We validate short-lived token instead
  },
  async (request, reply) => {
    const { sessionId, promptId } = request.params;
    const { stream_token } = request.query as any;

    try {
      const payload = jwtService.verifyStreamToken(String(stream_token || ''));
      if (payload.sessionId !== sessionId || payload.promptId !== promptId) {
        return reply.code(403).send({ error: 'Invalid stream token', code: 'AUTHORIZATION_ERROR' });
      }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired stream token', code: 'AUTHENTICATION_ERROR' });
    }

    // Optional: reverify ownership
    // await sessionService.getSession(sessionId, payload.sub);
    // await promptService.getPrompt(promptId, sessionId, payload.sub);

    // Standardize SSE with helper
    const stream = new SSEStream(reply);
    stream.send('connected', { promptId, timestamp: new Date().toISOString() });

    // Subscribe to Redis (unchanged)
    // ... existing Redis subscribe logic ... but write via stream.send(eventName, data)

    // Heartbeat
    const hb = createSSEHeartbeat(stream, 30000);
    request.raw.on('close', async () => {
      clearInterval(hb);
      // ... unsubscribe and quit redis ...
      stream.close();
    });
  }
);
```

4) Remove manual CORS headers from the stream route

- Do not set `Access-Control-Allow-Origin` in the route. Let the CORS plugin decide based on `CORS_ORIGIN` and `credentials`.
- Ensure your frontend uses the allowed origin; for credentials, avoid `*` and use specific origins.

Client usage example (EventSource):

```ts
// 1) Request a short-lived token
const { token } = await fetch(`/api/claude-code/sessions/${sessionId}/prompts/${promptId}/stream-token`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
}).then(r => r.json());

// 2) Connect EventSource with token in query
const es = new EventSource(`/api/claude-code/sessions/${sessionId}/prompts/${promptId}/stream?stream_token=${encodeURIComponent(token)}`);

es.addEventListener('message', (ev) => console.log('message', JSON.parse(ev.data)));
es.addEventListener('tool_use', (ev) => console.log('tool_use', JSON.parse(ev.data)));
es.addEventListener('error', () => es.close());
```

## Alternative: Cookie-Based Auth (Summary)

- Set `credentials: true` in CORS and list explicit trusted origins.
- Put the access token in an HttpOnly cookie on login.
- EventSource will send cookies; the server can keep `preHandler: fastify.authenticate` and rely on cookie → header translation via Fastify JWT or a custom extractor.

## Testing Tips

- Verify EventSource connects without headers and streams successfully.
- Try a stale token (> TTL) and ensure 401 is returned.
- Check that no `Access-Control-Allow-Origin: *` is present when `credentials: true`.

