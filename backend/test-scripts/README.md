# Backend Test Scripts

Simple test scripts to verify the backend API endpoints are working correctly.

## Scripts

### 1. login.ts
Tests the authentication endpoint.

```bash
bun run test-scripts/login.ts
```

### 2. create-session.ts
Creates a new Claude Code session (automatically logs in if no token provided).

```bash
bun run test-scripts/create-session.ts
```

### 3. create-prompt.ts
Sends a prompt to a session (automatically logs in and creates session if needed).

```bash
bun run test-scripts/create-prompt.ts
```

## Run All Tests

```bash
# Run all three tests in sequence
export API_BASE_URL=http://localhost:3001
export TEST_EMAIL=test@example.com
export TEST_PASSWORD=password123

bun run test-scripts/login.ts
bun run test-scripts/create-session.ts
bun run test-scripts/create-prompt.ts
```

## Environment Variables

- `API_BASE_URL` - Backend API URL (default: `http://localhost:3000`)
- `TEST_EMAIL` - Test user email (default: `test@example.com`)
- `TEST_PASSWORD` - Test user password (default: `testpassword123`)
- `ACCESS_TOKEN` - Skip login if provided
- `SESSION_ID` - Skip session creation if provided
- `SESSION_TITLE` - Custom session title
- `PROJECT_PATH` - Project path for session (default: `/test/project`)
- `PROMPT_CONTENT` - Custom prompt text
- `STREAM` - Set to `true` for streaming responses
- `EXPORT_TOKENS` - Set to `true` to output tokens for reuse
- `EXPORT_SESSION` - Set to `true` to output session ID for reuse

## Notes

- The prompt endpoint (create-prompt.ts) requires the Claude API to be configured
- If you get a 500 error on prompt creation, check that `ANTHROPIC_API_KEY` is set in the backend `.env` file
- Sessions require a `projectPath` parameter
- All scripts can run independently or chain together