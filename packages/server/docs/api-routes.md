# API Routes Reference

Base URL defaults to `http://<host>:<port>` where `host` and `port` come from config. The server registers routes with these prefixes:
- Health: `/health` (plus `/health/live` and `/health/ready`)
- Repositories: `/api/claude-code/repositories`
- Directories: `/api/claude-code/directories`
- Sessions: `/api/claude-code/sessions`

Schemas mentioned below are from `@pokecode/api`.

## Health

- GET `/health`
  - Response 200/503: `HealthResponseSchema`
- GET `/health/live`
  - Response 200: `LivenessResponseSchema`
- GET `/health/ready`
  - Response 200/503: `ReadinessResponseSchema`

## Repositories

- GET `/api/claude-code/repositories/`
  - Response 200: `ListRepositoriesResponseSchema`
  - Response 500: `{ error, code }` (string)

## Directories

- GET `/api/claude-code/directories/browse`
  - Query: `BrowseDirectoryQuerySchema` (`path?`)
  - Response 200: `BrowseDirectoryResponseSchema`
  - Response 400/500: `{ error, code }`

## Sessions

- POST `/api/claude-code/sessions/`
  - Body: `CreateSessionRequestSchema` `{ projectPath }`
  - Response 201: `SessionSchema`
  - Response 400: `{ error, code? }`

- GET `/api/claude-code/sessions/`
  - Query: `ListSessionsQuerySchema` (`state?`, `limit?`, `offset?`)
  - Response 200: `ListSessionsResponseSchema`

- GET `/api/claude-code/sessions/:sessionId`
  - Params: `SessionIdParamsSchema`
  - Response 200: `SessionSchema`
  - Response 404: `{ error, code? }`

- PATCH `/api/claude-code/sessions/:sessionId`
  - Params: `SessionIdParamsSchema`
  - Body: `UpdateSessionRequestSchema`
  - Response 200: `SessionSchema`
  - Response 400/404: `{ error, code? }`

### Messages (under a session)

- GET `/api/claude-code/sessions/:sessionId/messages/stream`
  - Server‑Sent Events stream
  - Event payload schema: `SSEEventSchema`
  - Emits `update` events with `{ state: 'running' | 'done', message? }` and periodic `heartbeat`

- POST `/api/claude-code/sessions/:sessionId/messages`
  - Body: `CreateMessageBodySchema` `{ content, allowedTools?, model? }`
  - Response 202: empty body (prompt is queued)
  - Response 404: `{ error, code }`

- GET `/api/claude-code/sessions/:sessionId/messages`
  - Query: `GetMessagesQuerySchema` (`after?`, `limit?`)
  - Response 200: `GetMessagesResponseSchema` `{ messages, session, pagination }`
  - Response 404: `{ error, code }`

- GET `/api/claude-code/sessions/:sessionId/messages/raw`
  - Response 200: array of raw Claude SDK messages (parsed JSON from DB)
  - Response 404: `{ error, code }`

- POST `/api/claude-code/sessions/:sessionId/cancel`
  - Response 200: `{ success: boolean }`
  - Response 404: `{ error, code }`

### Commands (under a session)

- GET `/api/claude-code/sessions/:sessionId/commands/`
  - Query: `ListCommandsQuerySchema` (`type?`, `search?`)
  - Response 200: `ListCommandsResponseSchema`
  - Response 400/403/404: `{ error, code? }`

### Agents (under a session)

- GET `/api/claude-code/sessions/:sessionId/agents/`
  - Query: `ListAgentsQuerySchema` (`type?`, `search?`)
  - Response 200: `ListAgentsResponseSchema`
  - Response 400/403/404: `{ error, code? }`

## CURL Examples

- Create a session
```
curl -sS -X POST \
  -H 'content-type: application/json' \
  -d '{"projectPath":"/path/to/repo"}' \
  http://localhost:3001/api/claude-code/sessions
```

- Stream messages (SSE)
```
curl -N http://localhost:3001/api/claude-code/sessions/<sessionId>/messages/stream
```

- Send a prompt
```
curl -sS -X POST \
  -H 'content-type: application/json' \
  -d '{"content":"List files and read README"}' \
  http://localhost:3001/api/claude-code/sessions/<sessionId>/messages
```

- Paginate messages
```
curl -sS 'http://localhost:3001/api/claude-code/sessions/<sessionId>/messages?after=<msgId>&limit=50'
```

Notes
- Schemas live in `@pokecode/api` for shared type safety between server and clients.
- Responses may return 4xx/5xx `{ error, code }` objects from the error handler.

