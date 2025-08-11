# Troubleshooting Worker Failures

This document outlines common issues and solutions for Claude Code worker failures.

## Common Issues and Solutions

### 1. Missing CLAUDE_CODE_PATH Environment Variable

**Symptoms:**
- Worker fails with exit code 1
- Logs show "Claude Code process exited with code 1"
- Empty error objects in logs

**Solution:**
Ensure `CLAUDE_CODE_PATH` is set in your `.env` file:

```env
CLAUDE_CODE_PATH="/Users/billy/.claude/local/node_modules/.bin/claude"
```

**Verification:**
```bash
echo $CLAUDE_CODE_PATH
"$CLAUDE_CODE_PATH" --version
```

### 2. Invalid Project Path

**Symptoms:**
- Worker fails with "Project path does not exist" error
- Session references non-existent directory

**Solution:**
The worker now validates project paths before executing. If you see this error, the session was created with an incorrect project path. Create a new session with the correct path.

### 3. Server Crashes from Worker Failures

**Symptoms:**
- Server logs "FATAL: Unhandled Rejection"
- Server process exits after worker errors

**Solution:**
The server now handles unhandled rejections gracefully without shutting down, maintaining availability even when workers fail.

### 4. Poor Error Logging

**Symptoms:**
- Error logs show empty `{}` objects
- Difficult to debug actual error causes

**Solution:**
Enhanced error logging now captures:
- Error message
- Stack trace
- Error name and code
- Relevant context

## Environment Setup

### Required Environment Variables

```env
# Claude Code CLI Path - REQUIRED
CLAUDE_CODE_PATH="/Users/billy/.claude/local/node_modules/.bin/claude"

# Database (example)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pokecode
DB_USER=billy
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379
```

### Verifying Claude Code Installation

```bash
# Check if Claude Code CLI is available
which claude

# Verify the configured path works
"$CLAUDE_CODE_PATH" --version

# Test basic functionality
echo "test prompt" | "$CLAUDE_CODE_PATH" --non-interactive
```

## Monitoring and Debugging

### Log Patterns to Watch

1. **Worker Startup:**
   ```
   INFO: Starting Claude Code Worker...
   INFO: Claude Code Worker started successfully
   ```

2. **Successful Processing:**
   ```
   INFO: Processing prompt
   INFO: Claude Code SDK query completed successfully
   INFO: Job completed successfully
   ```

3. **Failures:**
   ```
   ERROR: Claude Code SDK query failed
   ERROR: Claude Code process exited with code 1
   ```

### Health Checks

Monitor these endpoints:
- `GET /health` - Basic server health
- `GET /health/ready` - Database and Redis connectivity

### Database Queries for Debugging

```sql
-- Check recent failed prompts
SELECT id, status, error, created_at 
FROM prompts 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check sessions with invalid project paths
SELECT id, project_path, status, created_at
FROM sessions 
WHERE project_path NOT LIKE '/Users/billy/workspace/%' 
ORDER BY created_at DESC;
```

## Recovery Procedures

### Restart Worker Only
```bash
# Kill worker process
pkill -f "claude-code.worker"

# Worker will automatically restart via process manager
```

### Full Service Restart
```bash
# Restart both server and worker
npm run restart
# or
docker-compose restart backend
```

### Clean Redis State
```bash
# Clear job queues (use cautiously)
redis-cli FLUSHDB
```

## Prevention

1. **Always validate environment variables** before deployment
2. **Use absolute paths** for project directories
3. **Monitor worker metrics** via `/health` endpoints
4. **Set up proper logging** with structured logs
5. **Implement graceful degradation** for worker failures

## Recent Fixes Applied

- ✅ Added project path validation before Claude Code execution
- ✅ Enhanced error logging with proper serialization
- ✅ Improved SSE stream error handling with timeouts
- ✅ Modified server to handle worker failures gracefully
- ✅ Added CLAUDE_CODE_PATH validation in environment schema