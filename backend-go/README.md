# backend-go (demo)

Minimal Go demo of the Claude Code Mobile backend with:

- HTTP API using Gin
- Redis-backed queue using Asynq
- Separate worker process that simulates Claude CLI streaming
- Strict env configuration and structured logging

## Prereqs

- Go 1.22+
- Redis (local or remote)

## Quick start

1. Copy `.env.example` to `.env` and edit values

```bash
cp .env.example .env
```

2. Run API server

```bash
go run ./cmd/api
```

3. Run worker (in another terminal)

```bash
go run ./cmd/worker
```

## Try it

Create a prompt (enqueues a background job):

```bash
curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"List files in repo","projectPath":"/tmp"}' \
  http://localhost:3001/api/claude-code/sessions/00000000-0000-0000-0000-000000000000/prompts | jq
```

You should see a JSON response with a `jobId`. The worker logs will simulate streaming events and mark completion.

Health endpoint:

```bash
curl -s http://localhost:3001/health | jq
```

## Notes

- The worker includes a stubbed Claude runner that fakes a short stream if `CLAUDE_CODE_PATH` is not set. Wire in your actual CLI invocation later.
- This is a demo skeleton: DB models and full history parsing are omitted for brevity but the structure is ready for extension.

