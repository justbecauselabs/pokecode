# Server-Sent Events (SSE) Implementation Plan

## Overview

This document outlines the plan to replace the current polling mechanism for messages with Server-Sent Events (SSE) to provide real-time updates when new messages are added to the database.

## 🎉 SIMPLIFIED APPROACH: Embed Worker in Server Process

**Key Insight**: Instead of complex cross-process communication, we can run the worker in the same process as the server! This allows them to share the same MessageService instance and use simple in-memory EventEmitters.

## Current Implementation Analysis

### 1. Messages Endpoint (`backend/src/routes/sessions/messages.ts`)

Currently provides three main endpoints:
- `GET /messages` - Retrieves messages with cursor pagination
- `POST /messages` - Creates new user messages and queues them for processing
- `POST /cancel` - Cancels current session processing

The GET endpoint returns:
- Messages array with pagination
- Full session state (including `isWorking` status)
- Session metadata

### 2. Worker Message Processing (`backend/src/workers/claude-code-sqlite.worker.ts`)

The worker processes jobs by:
1. Polling the SQLite job queue every 1 second
2. Processing jobs through `ClaudeCodeSDKService`
3. SDK service calls `messageService.saveSDKMessage()` for each message received
4. Updates session state (`isWorking`, `currentJobId`, `lastJobStatus`)

### 3. Message Service (`backend/src/services/message.service.ts`)

Key methods for SSE implementation:
- `saveSDKMessage()` - Saves messages from Claude SDK to database
- `saveUserMessage()` - Saves user messages to database
- `queuePrompt()` - Queues jobs and updates session working state

### 4. Current Client Polling (`mobile/src/hooks/useSessionMessages.ts`)

Currently polls every 1000ms when `session.isWorking === true`:
- Fetches incremental messages using cursor pagination
- Maintains local message cache with `allMessagesRef`
- Uses React Query with `refetchInterval`

## SSE Implementation Plan with Embedded Worker

### Backend Changes

#### 1. Install Fastify SSE Plugin

```bash
bun add fastify-sse-v2
```

#### 2. Start Worker in Server Process

Modify `backend/src/app.ts` to start the worker when the server starts:

```typescript
// backend/src/app.ts
import { FastifySSEPlugin } from 'fastify-sse-v2';
import { ClaudeCodeSQLiteWorker } from './workers/claude-code-sqlite.worker';

// Global worker instance to share across the app
let globalWorker: ClaudeCodeSQLiteWorker | null = null;

export const app: FastifyPluginAsync = async (fastify, _opts) => {
  // Register SSE plugin
  await fastify.register(FastifySSEPlugin, {
    retryDelay: 3000,
    highWaterMark: 16384
  });

  // ... existing plugin registrations ...

  // Start the worker when the app is ready
  fastify.addHook('onReady', async () => {
    if (!globalWorker) {
      fastify.log.info('Starting embedded Claude Code worker...');
      globalWorker = new ClaudeCodeSQLiteWorker();
      await globalWorker.start();
      fastify.log.info('Claude Code worker started successfully');
    }
  });

  // Stop the worker when the app is closing
  fastify.addHook('onClose', async () => {
    if (globalWorker) {
      fastify.log.info('Stopping embedded Claude Code worker...');
      await globalWorker.shutdown();
      globalWorker = null;
      fastify.log.info('Claude Code worker stopped');
    }
  });

  // ... rest of existing code ...
};

// Export worker instance for access in routes
export { globalWorker };
```

#### 3. Create Typed Event Emitter

```typescript
// backend/src/services/event-bus.service.ts
import { EventEmitter } from 'events';
import type { Message } from '@pokecode/api';

// SSE payload format
interface SSEPayload {
  message: Message | null;
  state: 'running' | 'done';
}

// Type-safe event definitions
interface EventBusEvents {
  'sse-update': { sessionId: string; payload: SSEPayload };
}

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends keyof EventBusEvents>(
    event: K,
    listener: (data: EventBusEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof EventBusEvents>(
    event: K,
    listener: (data: EventBusEvents[K]) => void
  ): this {
    return super.off(event, listener);
  }
}

// Global event bus for real-time updates
export const messageEvents = new TypedEventEmitter();

// Helper functions to emit SSE updates
export function emitNewMessage(sessionId: string, message: Message) {
  messageEvents.emit('sse-update', {
    sessionId,
    payload: {
      message,
      state: 'running'
    }
  });
}

export function emitSessionDone(sessionId: string) {
  messageEvents.emit('sse-update', {
    sessionId,
    payload: {
      message: null,
      state: 'done'
    }
  });
}
```

#### 4. Update Message Service to Emit Events

```typescript
// backend/src/services/message.service.ts
import { emitNewMessage } from './event-bus.service';
import { sessions } from '../db/schema-sqlite';

export class MessageService {
  /**
   * Modified saveSDKMessage to emit real-time events
   */
  async saveSDKMessage(
    sessionId: string,
    sdkMessage: SDKMessage,
    claudeCodeSessionId?: string,
  ): Promise<void> {
    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Determine message type for database - map all to user/assistant for compatibility
      let messageType: 'user' | 'assistant' = 'assistant';

      if (sdkMessage.type === 'user') {
        messageType = 'user';
      }

      // Extract token count from the SDK message
      const tokenCount = extractTokenCount(sdkMessage);

      // Save message with SDK data as JSON string, including Claude session ID and token count
      const [insertedMessage] = await tx.insert(sessionMessages).values({
        sessionId,
        type: messageType,
        contentData: JSON.stringify(sdkMessage), // Store raw SDK message
        claudeCodeSessionId: claudeCodeSessionId || null,
        tokenCount: tokenCount > 0 ? tokenCount : null,
      }).returning(); // Use returning() to get the inserted row

      // Update session counters
      await tx
        .update(sessions)
        .set({
          messageCount: sql`${sessions.messageCount} + 1`,
          tokenCount: sql`${sessions.tokenCount} + ${tokenCount}`,
        })
        .where(eq(sessions.id, sessionId));

      // Get project path for message parsing
      const session = await tx.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { projectPath: true }
      });

      // After DB commit, emit real-time event with full Message object
      if (insertedMessage && session) {
        const parsedMessage = parseDbMessage(insertedMessage, session.projectPath);
        if (parsedMessage) {
          emitNewMessage(sessionId, parsedMessage);
        }
      }
    });
  }

  /**
   * Modified saveUserMessage to emit real-time events
   */
  async saveUserMessage(sessionId: string, content: string): Promise<void> {
    // Create user message in Claude SDK format
    const userMessage: SDKMessage & { type: 'user' } = {
      type: 'user',
      message: {
        role: 'user',
        content: content,
      },
      parent_tool_use_id: null,
      session_id: createId(),
    };

    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Save as user message
      const [insertedMessage] = await tx.insert(sessionMessages).values({
        id: createId(),
        sessionId,
        type: 'user',
        contentData: JSON.stringify(userMessage),
        tokenCount: null, // User messages don't have token costs
      }).returning();

      // Update session message count
      await tx
        .update(sessions)
        .set({
          messageCount: sql`${sessions.messageCount} + 1`,
        })
        .where(eq(sessions.id, sessionId));

      // Get project path for message parsing
      const session = await tx.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { projectPath: true }
      });

      // After DB commit, emit real-time event with full Message object
      if (insertedMessage && session) {
        const parsedMessage = parseDbMessage(insertedMessage, session.projectPath);
        if (parsedMessage) {
          emitNewMessage(sessionId, parsedMessage);
        }
      }
    });
  }
}
```

#### 5. Update Worker to Emit Session Done Events

```typescript
// backend/src/workers/claude-code-sqlite.worker.ts
import { emitSessionDone } from '@/services/event-bus.service';

export class ClaudeCodeSQLiteWorker {
  private async processJob(
    job: Awaited<ReturnType<typeof sqliteQueueService.getNextJob>>,
  ): Promise<void> {
    if (!job) return;

    const { id: jobId, sessionId, promptId, data } = job;
    this.processingJobs++;

    try {
      // ... existing job processing logic ...

      // Mark job as processing
      await sqliteQueueService.markJobProcessing(jobId);

      await db
        .update(sessions)
        .set({
          isWorking: true,
          currentJobId: promptId,
          lastJobStatus: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Execute Claude SDK - messages are emitted automatically via messageService.saveSDKMessage()
      const result = await sdkService.execute(data.prompt);

      if (result.success) {
        // Mark job as completed
        await sqliteQueueService.markJobCompleted(jobId);

        // Update session working state
        await db
          .update(sessions)
          .set({
            isWorking: false,
            currentJobId: null,
            lastJobStatus: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(sessions.id, sessionId));

        // Emit session done (Claude SDK finished)
        emitSessionDone(sessionId);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      // ... error handling ...

      // Update session working state on error
      await db
        .update(sessions)
        .set({
          isWorking: false,
          currentJobId: null,
          lastJobStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Emit session done (with error)
      emitSessionDone(sessionId);
    } finally {
      this.processingJobs--;
    }
  }
}
```

#### 6. Create Simplified SSE Endpoint

```typescript
// backend/src/routes/sessions/messages.ts
import { messageEvents } from '@/services/event-bus.service';

// Simple event queue for single event type
class EventQueue {
  private queue: Array<{ message: Message | null; state: 'running' | 'done' }> = [];
  private resolvers: Array<(value: { message: Message | null; state: 'running' | 'done' }) => void> = [];
  private aborted = false;

  push(payload: { message: Message | null; state: 'running' | 'done' }) {
    if (this.aborted) return;

    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver(payload);
    } else {
      this.queue.push(payload);
    }
  }

  async next(): Promise<{ message: Message | null; state: 'running' | 'done' } | null> {
    if (this.aborted) return null;

    const item = this.queue.shift();
    if (item) return item;

    return new Promise((resolve) => {
      if (this.aborted) {
        resolve(null);
        return;
      }
      this.resolvers.push(resolve);
    });
  }

  abort() {
    this.aborted = true;
    // Resolve all pending promises with null
    this.resolvers.forEach(resolve => resolve(null));
    this.resolvers.length = 0;
    this.queue.length = 0;
  }
}

// GET /sessions/:sessionId/messages/stream - SSE endpoint for real-time messages
fastify.get<{
  Params: { sessionId: string };
}>(
  '/messages/stream',
  {
    schema: {
      params: SessionIdParamsSchema,
    },
  },
  async (request, reply) => {
    const { sessionId } = request.params;

    try {
      // Verify session exists
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({
          error: 'Session not found',
          code: 'NOT_FOUND',
        });
      }

      // Set up SSE stream
      reply.sse(
        (async function* () {
          const eventQueue = new EventQueue();

          // Set up event listener for SSE updates
          const onSSEUpdate = (data: { sessionId: string; payload: { message: Message | null; state: 'running' | 'done' } }) => {
            if (data.sessionId === sessionId) {
              eventQueue.push(data.payload);
            }
          };

          // Register listener
          messageEvents.on('sse-update', onSSEUpdate);

          // Clean up on client disconnect
          const cleanup = () => {
            messageEvents.off('sse-update', onSSEUpdate);
            eventQueue.abort();
          };

          request.socket.on('close', cleanup);
          request.socket.on('error', cleanup);

          try {
            // Send heartbeat every 30 seconds to keep connection alive
            const heartbeatInterval = setInterval(() => {
              eventQueue.push({ message: null, state: 'running' }); // Heartbeat as running state
            }, 30000);

            // Process events from the queue
            while (true) {
              const event = await eventQueue.next();
              if (!event) break; // Aborted

              yield {
                data: JSON.stringify(event),
              };
            }

            clearInterval(heartbeatInterval);
          } finally {
            cleanup();
          }
        })()
      );
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to establish SSE connection',
      );
      throw error;
    }
  },
);
```

#### 7. Update Package.json Scripts

```json
{
  "scripts": {
    "dev": "bun --watch src/server.ts",
    "build": "bun build src/server.ts --target=bun --outdir=dist",
    "start": "bun run dist/server.js",
    // Remove separate worker scripts - no longer needed!
  }
}
```

### Frontend Changes

#### 1. Install React Native SSE Library

```bash
bun add react-native-sse react-native-url-polyfill
```

#### 2. Create Simplified SSE Hook

Replace the existing useSessionMessages hook with SSE:

```typescript
// mobile/src/hooks/useSessionMessages.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { EventSource } from 'react-native-sse';
import 'react-native-url-polyfill/auto';
import { apiClient } from '../api/client';
import type { Message, Session } from '../types/messages';

// SSE payload format matching backend
interface SSEPayload {
  message: Message | null;
  state: 'running' | 'done';
}

export function useSessionMessages(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId) return;

    let isActive = true;

    // Initial data fetch
    const loadInitialData = async () => {
      try {
        const response = await apiClient.getMessages({
          sessionId,
          query: { limit: 1000 }
        });
        if (isActive) {
          setMessages(response.messages);
          setSession(response.session);
          setIsWorking(response.session?.isWorking || false);
        }
      } catch (err) {
        console.error('[SSE] Failed to load initial messages:', err);
        if (isActive) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      }
    };

    const connectSSE = () => {
      if (!isActive) return;

      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const baseUrl = apiClient.getCurrentBaseUrl();
      const sseUrl = `${baseUrl}/api/claude-code/sessions/${sessionId}/messages/stream`;

      console.log('[SSE] Connecting to:', sseUrl);

      const eventSource = new EventSource(sseUrl, {
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });

      eventSourceRef.current = eventSource;

      eventSource.addEventListener('open', () => {
        if (!isActive) return;
        console.log('[SSE] Connection opened for session:', sessionId);
        setIsConnected(true);
        setError(null);
        setReconnectAttempt(0);
      });

      eventSource.addEventListener('message', (event) => {
        if (!isActive) return;

        try {
          const payload: SSEPayload = JSON.parse(event.data);

          // Add new message if present
          if (payload.message) {
            setMessages(prev => [...prev, payload.message!]);
          }

          // Update working state
          if (payload.state === 'running') {
            setIsWorking(true);
          } else if (payload.state === 'done') {
            setIsWorking(false);
          }
        } catch (err) {
          console.error('[SSE] Failed to parse message:', err, event.data);
        }
      });

      eventSource.addEventListener('error', (event) => {
        if (!isActive) return;

        console.error('[SSE] Connection error:', event);
        setIsConnected(false);

        // Attempt to reconnect with exponential backoff
        const attempt = reconnectAttempt + 1;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30s

        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${attempt})`);
        setReconnectAttempt(attempt);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isActive && attempt <= 5) { // Max 5 attempts
            connectSSE();
          } else {
            setError(new Error('SSE connection failed after multiple attempts'));
          }
        }, delay);
      });

      eventSource.addEventListener('close', () => {
        console.log('[SSE] Connection closed for session:', sessionId);
        if (isActive) {
          setIsConnected(false);
        }
      });
    };

    // Start the connection process
    loadInitialData().then(() => {
      if (isActive) {
        connectSSE();
      }
    });

    // Cleanup function
    return () => {
      isActive = false;
      console.log('[SSE] Cleaning up connection for session:', sessionId);

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setIsConnected(false);
    };
  }, [sessionId, reconnectAttempt]);

  const sendMessageMutation = useMutation({
    mutationFn: async (params: { content: string }) => {
      return apiClient.sendMessage({
        sessionId,
        data: { content: params.content },
      });
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sessionMessages', sessionId] });

      // Optimistically add user message
      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`,
        type: 'user',
        data: { content: params.content },
        parentToolUseId: null,
      };

      setMessages(prev => [...prev, optimisticUserMessage]);
      setIsWorking(true);

      return { optimisticUserMessage };
    },
    onError: (_, __, context) => {
      // Remove optimistic message
      if (context?.optimisticUserMessage) {
        setMessages(prev => prev.filter(msg => msg.id !== context.optimisticUserMessage.id));
      }
      setIsWorking(false);
    },
    onSuccess: () => {
      // Remove optimistic message - real message will come via SSE
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      return apiClient.cancelSession({ sessionId });
    },
    onSuccess: () => {
      setIsWorking(false);
    }
  });

  return {
    messages,
    session,
    isLoading: !isConnected && messages.length === 0,
    error,
    refetch: () => {
      // For SSE, refetch means reconnecting
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setReconnectAttempt(prev => prev + 1);
    },
    sendMessage: (params: { content: string }) => sendMessageMutation.mutateAsync(params),
    cancelSession: () => cancelSessionMutation.mutateAsync(),
    isSending: sendMessageMutation.isPending,
    isCancelling: cancelSessionMutation.isPending,
    isWorking,
    isConnected,
    reconnectAttempt,
  };
}
```

#### 3. Update Cancel Session to Emit Events

```typescript
// backend/src/services/message.service.ts
import { emitSessionDone } from './event-bus.service';

export class MessageService {
  /**
   * Cancel current session processing
   */
  async cancelSession(sessionId: string): Promise<void> {
    // ... existing cancellation logic ...

    // Update session state immediately
    await db
      .update(sessions)
      .set({
        isWorking: false,
        currentJobId: null,
        lastJobStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    // Emit session done (cancelled)
    emitSessionDone(sessionId);

    logger.info({ sessionId }, 'Successfully cancelled session');
  }
}
```

## 🚀 Embedded Worker Solution

### Why This Approach is MUCH Better

Your insight to run the worker in the same process eliminates ALL the complexity:

1. **Shared Memory**: Worker and server share the same MessageService instance
2. **Real-time EventEmitters**: Instant event delivery with Node.js EventEmitter
3. **Zero Additional Infrastructure**: No new tables, no polling, no cleanup
4. **Simplified Architecture**: One process, one deployment, one log stream
5. **Better Resource Usage**: Shared memory, no IPC overhead

### Benefits vs Separate Processes

#### ✅ Embedded Worker (Recommended)
- **Real-time**: Instant event delivery via EventEmitter
- **Simple**: No cross-process communication
- **Reliable**: Shared memory, no network/file dependencies
- **Debuggable**: Single process, unified logging
- **Efficient**: No serialization/deserialization overhead

#### ❌ Separate Processes (Previous Approach)
- **Complex**: Requires SQLite event store or Redis
- **Latency**: Polling delays (500ms+)
- **Overhead**: Database writes/reads for events
- **Deployment**: Two processes to manage
- **Debugging**: Logs split across processes

### What Changes
- **Before**: `bun dev:server` + `bun dev:worker` (2 processes)
- **After**: `bun dev` (1 process with embedded worker)
- **Architecture**: Server starts worker on app startup
- **Events**: Real-time EventEmitter instead of database polling

## Implementation Benefits

### Real-time Updates
- Immediate message delivery without polling delays
- Real-time session state changes (working status, job completion)
- Reduced latency for user experience

### Performance Improvements
- Eliminates constant HTTP polling overhead
- Reduces server load and battery drain on mobile
- More efficient bandwidth usage

### Scalability
- Single persistent connection per session
- Event-driven architecture supports multiple concurrent sessions
- Proper cleanup prevents memory leaks

## Implementation Considerations

### Connection Management
- Automatic reconnection on network issues (handled by react-native-sse)
- Proper cleanup when users navigate away from session screens
- Graceful degradation to polling if SSE fails

### Error Handling
- Network connection failures
- Server-side errors
- Malformed SSE data

### Security
- Same authentication mechanisms as REST endpoints
- Proper session validation before establishing SSE connections
- Rate limiting on SSE endpoints

### Testing Strategy
- Unit tests for SSE hooks
- Integration tests for message flow
- Performance testing with multiple concurrent connections
- Network simulation testing (poor connectivity, reconnections)

## Migration Plan

### Phase 1: Backend SSE Implementation
1. Install and configure fastify-sse-v2
2. Add SSE endpoint to messages route
3. Extend messageService with event emission
4. Update worker to emit session state changes

### Phase 2: Frontend SSE Implementation
1. Install react-native-sse library
2. Create useSSEMessages hook
3. Update session screen to use SSE
4. Add fallback mechanisms

### Phase 3: Testing and Optimization
1. Test SSE functionality thoroughly
2. Performance testing and optimization
3. Add monitoring and error tracking
4. Documentation updates

### Phase 4: Rollout
1. Feature flag to enable/disable SSE
2. Gradual rollout to users
3. Monitor performance and error rates
4. Remove polling fallback after successful rollout

## Summary of Simplified SSE Implementation

### Key Features

1. **Single Event Type**: Unified `sse-update` event with simple payload format
2. **Clean Payload**: `{ message: Message | null, state: 'running' | 'done' }`
3. **Full API Schema**: Messages are complete `Message` objects from `@pokecode/api`
4. **No Backward Compatibility**: Direct replacement of polling with SSE
5. **Embedded Worker**: Single process for simplified architecture

### SSE Event Format (Updated)

```typescript
type SSEEvent =
  | {
      type: 'heartbeat';
      data: {};
    }
  | {
      type: 'update';
      data: {
        state: 'running' | 'done';
        message: Message | null;
      };
    };
```

### Event Flow

1. **New Message**: `{ type: 'update', data: { state: 'running', message: Message } }`
2. **Worker Done**: `{ type: 'update', data: { state: 'done', message: null } }`
3. **Worker Error**: `{ type: 'update', data: { state: 'done', message: null } }`
4. **Cancelled**: `{ type: 'update', data: { state: 'done', message: null } }`
5. **Heartbeat**: `{ type: 'heartbeat', data: {} }` (every 30 seconds)

### Implementation Details

- **Server Event Format**: `{ data: JSON.stringify({ type: 'update'|'heartbeat', data: {...} }) }`
- **Client Handling**: Zod schema validation with discriminated union parsing
- **Heartbeats**: 30-second intervals using `{ type: 'heartbeat', data: {} }`
- **Type Safety**: Full Zod schema validation on both client and server
- **Cleanup**: Proper EventEmitter cleanup on disconnect
- **Reconnection**: Exponential backoff with max 5 attempts
- **Message Source**: Full `parseDbMessage()` output with `projectPath`

### Testing Checklist

- [x] SSE connection establishes successfully ✅ Implemented
- [x] New messages appear in real-time with full Message schema ✅ Implemented
- [x] Worker state changes from 'running' to 'done' ✅ Implemented
- [x] Connection cleanup happens on screen navigation ✅ Implemented
- [x] Reconnection works after network issues ✅ Implemented with exponential backoff
- [x] Heartbeats keep connection alive on mobile ✅ Implemented (30s intervals)
- [x] No memory leaks from EventEmitter listeners ✅ Proper cleanup implemented
- [x] Optimistic user messages work correctly ✅ Implemented with SSE real-time updates

## ✅ IMPLEMENTATION COMPLETE

This simplified implementation provides true real-time updates with a clean, single-payload format that directly uses the API schema.

### What Was Implemented

#### Backend Changes ✅
1. **Fastify SSE Plugin** - Installed `fastify-sse-v2` plugin for Server-Sent Events support
2. **SSE Schemas** - Added type-safe SSE event schemas to `packages/api` with Zod validation
3. **Event Bus Service** - Created typed EventEmitter with discriminated union event format
4. **Message Service Updates** - Modified to emit SSE events on every message save (user and assistant)
5. **Worker Integration** - Updated Claude worker to emit session completion/error events
6. **Embedded Worker** - Worker now runs in same process as server for simplified architecture
7. **SSE Endpoint** - Added `/sessions/:sessionId/messages/stream` with proper heartbeats and validation
8. **Package Scripts** - Simplified to single process deployment (removed separate worker scripts)

#### Frontend Changes ✅
1. **React Native SSE** - Installed `react-native-sse` and `react-native-url-polyfill` libraries
2. **SSE Hook** - Completely replaced polling-based `useSessionMessages` with real-time SSE implementation
3. **Schema Validation** - Uses Zod schemas from `packages/api` for type-safe event parsing
4. **Discriminated Union Handling** - Properly handles heartbeat vs update events
5. **Reconnection Logic** - Exponential backoff with max 5 attempts for network resilience
6. **Optimistic Updates** - User messages show immediately, real messages replace via SSE
7. **Connection Management** - Proper cleanup and error handling for mobile environments

#### Architecture Improvements ✅
- **Single Process** - Worker embedded in server eliminates complex IPC
- **Real-time Events** - Instant message delivery via in-memory EventEmitter
- **Type Safety** - Full TypeScript support for SSE payloads and events
- **Mobile Optimized** - Heartbeats, reconnection, and proper cleanup for React Native
- **Simplified Deployment** - One process, one command (`bun dev`)
- **Better Debugging** - Unified logging and single process lifecycle

### Key Benefits Achieved
✅ **Performance**: Eliminated 1-second polling overhead
✅ **Real-time**: Instant message delivery (no polling delays)
✅ **Reliability**: Automatic reconnection with exponential backoff
✅ **Scalability**: Event-driven architecture supports multiple sessions
✅ **Maintenance**: Single process simplifies deployment and debugging
✅ **Mobile Friendly**: Proper cleanup and heartbeats for mobile environments
