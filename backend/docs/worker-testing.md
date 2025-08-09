# Worker Testing Guide

## Overview

The Claude Code Worker processes prompts from the BullMQ queue by executing them with the Claude Code SDK and streaming results via Redis pub/sub.

## Testing the Worker

### 1. Prerequisites

Ensure you have the following running:

```bash
# Start PostgreSQL and Redis (if using Docker)
docker-compose up -d postgres redis

# Or ensure they're running locally
```

Set up environment variables:
```bash
# Copy .env.example if you haven't already
cp .env.example .env

# Ensure these are set:
ANTHROPIC_API_KEY=your-api-key
REDIS_URL=redis://localhost:6379
DB_HOST=localhost
DB_PORT=5432
DB_NAME=claude_code_mobile
DB_USER=postgres
DB_PASSWORD=your-password
```

### 2. Run Database Migrations

```bash
# Run migrations
bun migrate

# Verify database schema
bun migrate:studio
```

### 3. Start the Worker

In one terminal, start the worker:

```bash
# Development mode with auto-reload
bun dev:worker

# Or production mode
bun worker
```

You should see:
```
🚀 Starting Claude Code Worker...
📦 Environment: development
✅ Database connection verified
✅ Redis connection verified
🤖 Claude Code Worker started successfully
📊 Queue: claude-code-jobs
🔧 Concurrency: 5
✅ Status: Running
```

### 4. Test the Worker

In another terminal, run the test script:

```bash
bun run scripts/test-worker.ts
```

This script will:
1. Create a test user and session
2. Add a prompt job to the queue
3. Subscribe to Redis events
4. Monitor job progress
5. Display the results

Expected output:
```
🧪 Claude Code Worker Test Script

📝 Setting up test data...
✅ Test user: worker-test@example.com
✅ Test session: [session-id]
✅ Test prompt: [prompt-id]
📡 Subscribing to channel: claude-code:[session-id]:[prompt-id]
📦 Adding job to queue...
✅ Job added with ID: [job-id]
📊 Job state: active
💬 Message: Initializing Claude Code...
🔧 Tool Use: LS { path: '.' }
📊 Tool Result: LS
💬 Message: Based on the files...
✅ Complete! { duration: 2345, toolCallCount: 3 }
✅ Job completed successfully!

Final Prompt Status:
Status: completed
Response: Based on the files in the current directory...
```

### 5. Manual Testing via API

You can also test by making API calls:

```bash
# 1. Login to get token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.token')

# 2. Create a session
SESSION_ID=$(curl -X POST http://localhost:3000/api/claude-code/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"/path/to/project"}' \
  | jq -r '.id')

# 3. Create a prompt
PROMPT_ID=$(curl -X POST http://localhost:3000/api/claude-code/sessions/$SESSION_ID/prompts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"List files in the current directory"}' \
  | jq -r '.id')

# 4. Stream results
curl -N http://localhost:3000/api/claude-code/sessions/$SESSION_ID/prompts/$PROMPT_ID/stream \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Monitoring the Worker

#### Check Queue Metrics

```bash
# In your code or via a script
const queueService = new QueueService();
const metrics = await queueService.getQueueMetrics();
console.log(metrics);
// { waiting: 0, active: 1, completed: 5, failed: 0, delayed: 0, total: 1 }
```

#### View Worker Logs

The worker logs detailed information:
- Job processing start/complete
- Tool usage
- Errors and retries
- Progress updates

#### Redis Monitoring

Monitor Redis pub/sub channels:

```bash
# Subscribe to all Claude Code channels
redis-cli PSUBSCRIBE "claude-code:*"
```

### 7. Testing Different Scenarios

#### Test with Specific Tools

Modify the test script to use different allowed tools:

```typescript
const jobData: PromptJobData = {
  // ...
  allowedTools: ['Read', 'Write', 'Edit'], // Change tools here
};
```

#### Test Error Handling

Create a prompt that will fail:

```typescript
const prompt = 'Access a file that does not exist: /nonexistent/file.txt';
```

#### Test Long-Running Jobs

```typescript
const prompt = 'Write a comprehensive analysis of all TypeScript files in this project';
```

### 8. Debugging Tips

1. **Enable Debug Logging**: Set `LOG_LEVEL=debug` in `.env`

2. **Check Job Details**: 
   ```typescript
   const job = await queue.getJob(jobId);
   console.log(await job.getState());
   console.log(job.failedReason);
   console.log(job.attemptsMade);
   ```

3. **Monitor BullMQ Dashboard**: Install Bull Board for visual monitoring
   ```bash
   bun add @bull-board/fastify
   ```

4. **Check Database State**:
   ```sql
   SELECT * FROM claude_code_prompts WHERE id = 'prompt-id';
   ```

### 9. Common Issues

#### Worker Not Processing Jobs

- Check Redis connection
- Verify queue name matches (`claude-code-jobs`)
- Check for errors in worker logs

#### Jobs Failing

- Check ANTHROPIC_API_KEY is set
- Verify project path exists
- Check allowed tools are valid
- Review error in job.failedReason

#### Events Not Streaming

- Verify Redis pub/sub is working
- Check channel name format
- Ensure SSE endpoint is subscribed

### 10. Performance Testing

For load testing:

```typescript
// Add multiple jobs
for (let i = 0; i < 10; i++) {
  await addTestJob(sessionId, `prompt-${i}`, `Test prompt ${i}`);
}
```

Monitor:
- Job processing time
- Memory usage
- Redis connection pool
- Database query performance

## Next Steps

- Set up monitoring with Prometheus
- Add health check endpoint
- Configure dead letter queue
- Implement job priority
- Add worker autoscaling