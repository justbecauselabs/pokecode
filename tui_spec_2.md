# Pokecode CLI TUI — Spec v2

## Goals & Scope
- Primary goal: Easily test the backend API end-to-end via an interactive terminal UI.
- Must: Bun runtime, TypeScript, React-style TUI framework, SSE chat.
- Auth: Support register, login, refresh, logout.
- Sessions: Let user supply `projectPath` when creating a session.
- Chat: Append streaming text as it arrives (no file APIs in v1).
- No telemetry, no special rate-limit UI.
- Live under `/cli` directory.

## Tech Choices
- Runtime: Bun (>=1.0). Native TypeScript execution.
- Language: TypeScript.
- TUI Framework: Ink (React-based) for fast iteration and clean stateful UI.
- Styling/UX: `chalk`/`kleur` for color; `ink-text-input`, `ink-select-input`, `ink-spinner`.
- HTTP/SSE: `fetch` (Bun) + `eventsource-parser` for SSE stream parsing.
- Config storage: File-based at `~/.pokecode-cli/config.json` (cross-platform: resolve via HOME/AppData/XDG).

## Backend Endpoints (mapped)
Base URL: `http://localhost:<port>` (configurable in CLI).
- Auth (prefix `/api/auth`):
  - POST `/register` → { email, password, name? } → { accessToken, refreshToken, user }
  - POST `/login` → { email, password } → { accessToken, refreshToken, user }
  - POST `/refresh` → { refreshToken } → { accessToken, refreshToken }
  - POST `/logout` → Authorization: Bearer access
- Sessions (prefix `/api/claude-code/sessions`):
  - POST `/` → { projectPath, context?, metadata? } → session
- Prompts (prefix `/api/claude-code/sessions/:sessionId/prompts`):
  - POST `/` → { prompt, allowedTools? } → { id, status, jobId? }
  - GET `/:promptId/stream` (SSE, Authorization required) → events: `connected`, intermediate chunks, `complete` | `error`
- History/Export (prefix `/api/claude-code/sessions/:sessionId`):
  - GET `/history` → session conversation history (for future use)
  - GET `/export?format=markdown|json` → export (optional viewer in TUI)

## UX Flow
1) Startup
- If no tokens in config, show Welcome screen with options: [Login], [Register], [Set Base URL].
- If tokens exist, show Session screen.

2) Auth Screens
- Register: Collect email, name (optional), password (masked). On success, persist tokens and user info.
- Login: Collect email + password; persist tokens.
- Token Refresh Strategy: Attempt automatic refresh on 401 (once per request). If refresh fails, return to Login screen.
- Logout: Revoke access token via `/logout`, clear local tokens, return to Welcome.

3) Session Screen
- List: Show recent sessions from local cache (if any) for quick re-entry, plus options:
  - [Create Session]: Prompt for `projectPath` (string). Optionally accept `context` (multi-line input) in an advanced toggle.
  - [Enter Session ID]: For testing existing sessions by UUID.
- After creating/choosing a session, navigate to Chat.

4) Chat Screen
- Layout:
  - Header: app name, environment (base URL host), user email, current session id.
  - Transcript area: scrollable; shows prompt/assistant entries chronologically.
  - Input line: single-line prompt; Enter to send.
- Sending a message:
  - POST create prompt → get `promptId`.
  - Start SSE at `/sessions/:sessionId/prompts/:promptId/stream` with Authorization header.
  - Append incoming `data` chunks to the current assistant message live.
  - End on `complete` or `error`.
- Controls:
  - Enter: send message.
  - Ctrl+C or Esc: cancel current stream (DELETE `/:promptId`), remain in chat.
  - F2: Switch session (go back to Session Screen).
  - F3: New session (shortcut to Create Session).
  - F4: Export (fetch markdown; show in modal viewer; copy-to-clipboard optional).
  - Ctrl+L: Logout.
- Errors: Show non-blocking toast (banner) and keep transcript intact.

## Configuration
Location: `~/.pokecode-cli/config.json`
- Example:
```json
{
  "baseUrl": "http://localhost:3000",
  "auth": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { "id": "...", "email": "...", "name": "..." }
  },
  "recentSessions": [
    { "id": "<uuid>", "projectPath": "...", "lastUsedAt": "2025-08-08T10:00:00Z" }
  ]
}
```
- Notes:
  - Tokens stored locally (plain text). Suitable for dev; warn users to keep private.
  - Config schema validates on read/write. Failed parse → backup and start fresh.

## Error Handling
- 401: Attempt refresh with saved refresh token; retry original request once.
- 403/404/409: Show human-friendly message inline.
- Network errors: Show banner; allow retry.
- SSE:
  - If disconnected before `complete`, show banner with reason; allow re-open from transcript context.
  - Heartbeats are ignored; only `event: ...` + `data:` parsed.

## Rate Limits & Telemetry
- No special rate-limit UI; standard error banners suffice.
- No telemetry. Local logs only (debug toggle, logged to `~/.pokecode-cli/debug.log`).

## Project Structure (under `/cli`)
```
cli/
  package.json
  tsconfig.json
  src/
    index.ts           # entry; starts Ink app
    app.tsx            # top-level Ink <App/>
    screens/
      Welcome.tsx
      AuthLogin.tsx
      AuthRegister.tsx
      Sessions.tsx
      Chat.tsx
      ExportViewer.tsx
    components/
      Header.tsx
      PromptInput.tsx
      Transcript.tsx
      Toast.tsx
      KeyHints.tsx
    core/
      api.ts           # fetch wrapper with auth + refresh
      sse.ts           # SSE stream via eventsource-parser
      config.ts        # read/write config; schema
      state.ts         # global app state (Zustand or simple context)
      keybinds.ts      # shared key handling
    types/
      api.ts          # generated or hand-written types (match backend)
```

## Networking Layer
- `core/api.ts`:
  - `setBaseUrl(url: string)`; `setTokens(access, refresh)`; `clearTokens()`.
  - `request(path, { method, body, headers })` → handles JSON, injects Authorization, refresh-on-401.
  - Auth helpers: `login`, `register`, `refresh`, `logout`.
  - Sessions: `createSession`, `getSession`.
  - Prompts: `createPrompt`, `cancelPrompt`, `getPrompt`, `exportSession`.
- `core/sse.ts`:
  - `streamPrompt({ sessionId, promptId, signal, onEvent })` using `fetch` and `eventsource-parser`.
  - Parses `event:` and `data:`; calls `onEvent({ type, data })`.

## State Management
- Keep it simple with React context + reducers or Zustand.
- Global state examples:
  - auth: { user, accessToken, refreshToken }
  - ui: { screen, toasts[] }
  - session: { currentId, projectPath, recent[] }
  - chat: { entries: Array<{ role: 'user'|'assistant', text: string }>, streaming: boolean }

## Accessibility & UX Details
- Always show current base URL and user email in header.
- Preserve transcript between screens within a session.
- Show a spinner while waiting for POST create prompt.
- Display streaming text as a single growing assistant message; commit on `complete`.
- Provide subtle color theming (no hard dependencies on terminal background).

## Dependencies
- runtime: `bun`
- prod: `ink`, `react`, `eventsource-parser`, `chalk` (or `kleur`), `zustand` (optional)
- dev: `@types/node`, `typescript`

## Scripts (package.json in `/cli`)
```json
{
  "name": "pokecode-cli",
  "private": true,
  "type": "module",
  "engines": { "bun": ">=1.0.0" },
  "bin": { "pokecode": "./src/index.ts" },
  "scripts": {
    "dev": "bun ./src/index.ts",
    "start": "bun ./src/index.ts"
  },
  "dependencies": {
    "ink": "^4",
    "react": "^18",
    "eventsource-parser": "^1",
    "chalk": "^5"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "@types/node": "^20"
  }
}
```

## API Contracts (selected)
- Auth
  - login(email, password) → stores tokens + user; error: `LOGIN_FAILED`.
  - register(email, password, name?) → same as login; errors: `ALREADY_REGISTERED`, `REGISTER_FAILED`.
  - refresh(refreshToken) → rotate tokens.
  - logout(accessToken) → blacklists token; clears local.
- Sessions
  - createSession(projectPath, context?) → session { id, projectPath, status, timestamps }
- Prompts
  - createPrompt(sessionId, prompt) → { id, status }
  - streamPrompt(sessionId, promptId) → events to append text; end on `complete`.

## Security Notes
- Tokens stored in plain-text config for dev ergonomics (no keychain). Display a one-time notice after first login.
- Redact tokens in any debug logs.

## MVP Checklist
- Config read/write and schema validation.
- Auth screens: register, login, logout; auto-refresh on 401.
- Session creation with user-supplied `projectPath`.
- Chat screen with SSE append and cancel.
- Export viewer (markdown modal); copy-to-clipboard optional.
- Keybindings and toasts.

## Stretch (post-MVP)
- Profiles for multiple base URLs.
- Session history view pane.
- Theme toggle and resizable panes.
- Installable binary via Bun bundling; NPM package for global usage.

---
This spec reflects your preferences: localhost base URL, support register, file-based config, user-supplied `projectPath`, append-only streaming text, no file APIs, no rate-limit UI, and no telemetry. The implementation will live under `/cli` using Ink + Bun.
