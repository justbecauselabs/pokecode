# Worker Queue and Claude Code SDK Integration

## Overview

The backend implements a robust asynchronous job processing system using BullMQ (Redis-based queue) integrated with the official Claude Code SDK. This architecture enables scalable, reliable processing of AI prompts with real-time streaming capabilities.

## Architecture

```
┌──────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│   API    │────▶│  Queue  │────▶│  Worker  │────▶│   SDK   │
│ Handler  │     │ Service │     │ Process  │     │ Service │
└──────────┘     └─────────┘     └──────────┘     └─────────┘
      │               │                │                │
      └───────────────┴────────────────┴────────────────┘
                          Redis Pub/Sub
```

## Queue Service (`src/services/queue.service.ts`)

### Configuration
```typescript
{
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 24 * 60 * 60,  // 24 hours
      count: 100          // Keep last 100 completed
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60  // 7 days
    }
  }
}
```

### Core Methods

#### `addPromptJob(data: PromptJobData)`
Queues a new Claude Code prompt for processing.

```typescript
interface PromptJobData {
  sessionId: string;       // Database session ID
  promptId: string;        // Unique job identifier
  prompt: string;          // User prompt text
  allowedTools?: string[]; // Tool restrictions
  projectPath: string;     // Working directory
  messageId?: string;      // Database message ID
}
```

#### `cancelJob(jobId: string)`
Cancels a running job and publishes completion event.

#### `getJobStatus(jobId: string)`
Returns current job state and progress.

#### `publishEvent(channel: string, data: any)`
Publishes events to Redis pub/sub channels.

### Event Publishing
```typescript
// Event channels
`session:${sessionId}:prompt:${promptId}:start`
`session:${sessionId}:prompt:${promptId}:delta`
`session:${sessionId}:prompt:${promptId}:stop`
`session:${sessionId}:prompt:${promptId}:error`
```

## Worker Implementation (`src/workers/claude-code.worker.ts`)

### Configuration
- **Concurrency**: 5 simultaneous jobs
- **Process Isolation**: Separate worker process
- **Graceful Shutdown**: Completes active jobs before exit

### Job Processing Flow

```typescript
async function processPromptJob(job: Job<PromptJobData>) {
  // 1. Update session state
  await updateSession(job.data.sessionId, {
    isWorking: true,
    currentJobId: job.id
  });

  // 2. Initialize SDK service
  const sdk = new ClaudeCodeSDKService({
    sessionId: job.data.sessionId,
    projectPath: job.data.projectPath,
    claudeCodeSessionId: existingSessionId
  });

  // 3. Setup event forwarding
  sdk.on('message:start', (data) => {
    publishEvent(`session:${sessionId}:prompt:${promptId}:start`, data);
  });

  // 4. Execute prompt
  const result = await sdk.executePrompt(job.data.prompt, {
    allowedTools: job.data.allowedTools
  });

  // 5. Store results
  await messageService.create({
    sessionId: job.data.sessionId,
    content: result.content,
    claudeSessionId: result.claudeSessionId
  });

  // 6. Cleanup
  await updateSession(job.data.sessionId, {
    isWorking: false,
    lastJobStatus: 'completed'
  });
}
```

### Event Forwarding
The worker forwards all SDK events to Redis pub/sub:

```typescript
// Forwarded event types
'message:start'      // Streaming started
'message:delta'      // Content chunk
'message:stop'       // Streaming completed
'tool:use'          // Tool invocation
'tool:result'       // Tool execution result
'thinking:start'    // Thinking started
'thinking:delta'    // Thinking content
'citation'          // Source citation
'web_search:start'  // Web search initiated
'web_search:result' // Search results
'system:event'      // System messages
'error'            // Error occurred
```

### Active Session Management
```typescript
class WorkerManager {
  private activeSessions = new Map<string, ClaudeCodeSDKService>();

  async addSession(jobId: string, sdk: ClaudeCodeSDKService) {
    this.activeSessions.set(jobId, sdk);
  }

  async removeSession(jobId: string) {
    const sdk = this.activeSessions.get(jobId);
    if (sdk) {
      await sdk.abort();
      this.activeSessions.delete(jobId);
    }
  }

  async shutdown() {
    // Abort all active sessions on shutdown
    for (const [jobId, sdk] of this.activeSessions) {
      await sdk.abort();
    }
  }
}
```

## Claude Code SDK Service (`src/services/claude-code-sdk.service.ts`)

### SDK Configuration
```typescript
{
  permissionMode: 'bypassPermissions',  // Skip permission prompts
  useLocalAuthentication: true,         // Use local Claude installation
  workingDirectory: projectPath,        // Set working directory
  resumeSessionId: claudeCodeSessionId  // Resume existing session
}
```

### Core Functionality

#### Session Management
```typescript
class ClaudeCodeSDKService extends EventEmitter {
  private sdk: ClaudeCodeSDK;
  private claudeSessionId?: string;

  async executePrompt(prompt: string, options?: ExecuteOptions) {
    // Initialize SDK if needed
    if (!this.sdk) {
      this.sdk = new ClaudeCodeSDK(this.config);
    }

    // Execute prompt
    const response = await this.sdk.sendMessage(prompt, {
      allowedTools: options?.allowedTools
    });

    // Capture session ID on first response
    if (!this.claudeSessionId && response.sessionId) {
      this.claudeSessionId = response.sessionId;
      await this.backfillSessionId();
    }

    return response;
  }

  async resumeSession(sessionId: string) {
    this.sdk = new ClaudeCodeSDK({
      ...this.config,
      resumeSessionId: sessionId
    });
  }
}
```

#### Event Streaming
```typescript
// Stream handling
private handleMessageStream(stream: ReadableStream) {
  const reader = stream.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Parse and emit events
    const event = this.parseStreamChunk(value);
    this.emit(event.type, event.data);
  }
}

// Event emission
this.emit('message:delta', {
  content: chunk.text,
  sessionId: this.sessionId,
  timestamp: new Date().toISOString()
});
```

### Message Processing
```typescript
interface ProcessedMessage {
  content: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  thinking?: string;
  claudeSessionId: string;
}

private processMessage(sdkMessage: SDKMessage): ProcessedMessage {
  return {
    content: this.extractTextContent(sdkMessage),
    toolCalls: this.extractToolCalls(sdkMessage),
    toolResults: this.extractToolResults(sdkMessage),
    thinking: this.extractThinking(sdkMessage),
    claudeSessionId: sdkMessage.sessionId
  };
}
```

## Integration Flow

### 1. Request Initiation
```typescript
// API endpoint receives request
POST /api/claude-code/sessions/:sessionId/messages
{
  "content": "Help me refactor this function",
  "allowedTools": ["Read", "Edit"]
}

// Queue job
const job = await queueService.addPromptJob({
  sessionId,
  promptId: generateId(),
  prompt: content,
  allowedTools,
  projectPath: session.projectPath
});
```

### 2. Worker Processing
```typescript
// Worker picks up job
worker.on('job', async (job) => {
  // Process with SDK
  const result = await processWithSDK(job.data);
  
  // Store results
  await storeResults(result);
  
  // Mark complete
  await job.updateProgress(100);
});
```

### 3. Real-time Updates
```typescript
// Client subscribes to events
const channel = `session:${sessionId}:prompt:${promptId}:*`;
redis.subscribe(channel);

// Receive streaming updates
redis.on('message', (channel, data) => {
  const event = JSON.parse(data);
  // Update UI with streaming content
  updateUI(event);
});
```

## Error Handling

### Retry Strategy
```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  }
}
```

### Error Types
1. **Validation Errors**: Invalid project path, missing parameters
2. **SDK Errors**: API failures, rate limits, authentication
3. **Worker Errors**: Memory limits, timeouts, crashes
4. **Queue Errors**: Redis connection, job processing

### Error Recovery
```typescript
// Worker-level recovery
worker.on('failed', async (job, err) => {
  logger.error({ jobId: job.id, error: err }, 'Job failed');
  
  // Update session state
  await updateSession(job.data.sessionId, {
    isWorking: false,
    lastJobStatus: 'failed',
    lastError: err.message
  });
  
  // Notify client
  await publishError(job.data.sessionId, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  // Stop accepting new jobs
  await worker.close();
  
  // Wait for active jobs
  await worker.whenCurrentJobsFinished();
  
  // Cleanup
  await cleanup();
});
```

## Performance Optimization

### Connection Pooling
```typescript
// Redis connection pool
const redis = new Redis({
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true
});

// Database connection pool
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000
});
```

### Job Batching
```typescript
// Process multiple prompts efficiently
const jobs = await queue.addBulk([
  { name: 'prompt', data: promptData1 },
  { name: 'prompt', data: promptData2 },
  { name: 'prompt', data: promptData3 }
]);
```

### Memory Management
```typescript
// Stream large responses
const stream = sdk.streamResponse(prompt);
for await (const chunk of stream) {
  // Process chunk immediately
  await processChunk(chunk);
  // Garbage collection friendly
}
```

## Monitoring

### Queue Metrics
```typescript
async getQueueMetrics() {
  const [waiting, active, completed, failed] = await Promise.all([
    this.queue.getWaitingCount(),
    this.queue.getActiveCount(),
    this.queue.getCompletedCount(),
    this.queue.getFailedCount()
  ]);

  return { waiting, active, completed, failed };
}
```

### Health Checks
```typescript
// Queue health
async checkQueueHealth() {
  const isReady = await this.queue.isReady();
  const isPaused = await this.queue.isPaused();
  return { isReady, isPaused };
}

// Worker health
async checkWorkerHealth() {
  const isRunning = this.worker.isRunning();
  const activeSessions = this.activeSessions.size;
  return { isRunning, activeSessions };
}
```

### Logging
```typescript
// Structured logging throughout
logger.info({ jobId, sessionId }, 'Processing job started');
logger.debug({ event: eventType, data }, 'SDK event received');
logger.error({ error, jobId }, 'Job processing failed');
logger.warn({ retryCount, delay }, 'Retrying job');
```

## Scaling Considerations

### Horizontal Scaling
- Multiple worker processes can be deployed
- Redis coordinates job distribution
- Session affinity not required

### Vertical Scaling
- Increase worker concurrency for more throughput
- Adjust memory limits for large prompts
- Optimize Redis memory usage

### Load Balancing
```typescript
// Round-robin job assignment
const worker1 = new Worker('queue', processor, { concurrency: 5 });
const worker2 = new Worker('queue', processor, { concurrency: 5 });
const worker3 = new Worker('queue', processor, { concurrency: 5 });
```

## Security

### Input Validation
- Prompt length limits
- Tool whitelist enforcement
- Path validation for project access

### SDK Permissions
- Bypass mode for trusted environments
- Tool restrictions per request
- Project boundary enforcement

### Data Protection
- Encrypted Redis connections
- Session isolation
- Audit logging for all operations