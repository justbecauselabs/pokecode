# Server-Sent Events (SSE) Implementation Plan

## Overview

This document outlines the plan to replace the current polling mechanism for messages with Server-Sent Events (SSE) to provide real-time updates when new messages are added to the database.

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

## SSE Implementation Plan

### Backend Changes

#### 1. Create Minimal Event Store Table (Optional)

Create a small table only for non-message events (session state changes, job completion):

```sql
-- Add to your Drizzle schema - ONLY for non-message events
CREATE TABLE session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'session-state-change', 'job-complete'
  event_data TEXT NOT NULL, -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES claude_code_sessions(id)
);

CREATE INDEX idx_session_events_session_created 
ON session_events(session_id, created_at);
```

**Alternative**: Skip this table entirely and only use `session_messages` table with session state polling.

#### 2. Install and Configure Fastify SSE Plugin

```bash
bun add fastify-sse-v2
```

Register the plugin in the main Fastify app:

```typescript
// backend/src/app.ts
import { FastifySSEPlugin } from 'fastify-sse-v2';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({ logger: true });
  
  // Register SSE plugin
  await app.register(FastifySSEPlugin, {
    retryDelay: 3000, // 3 second retry delay
    highWaterMark: 16384 // 16kb buffer
  });
  
  // ... rest of app setup
}
```

#### 3. Create SSE Endpoint Using Existing Tables

Add new SSE endpoint to `backend/src/routes/sessions/messages.ts`:

```typescript
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

      // Set up SSE stream using existing tables
      reply.sse(
        (async function* () {
          // Send initial session state
          yield {
            event: 'session-state',
            data: JSON.stringify({
              isWorking: session.isWorking,
              currentJobId: session.currentJobId,
              lastJobStatus: session.lastJobStatus,
            }),
          };

          let lastMessageId: string | null = null;
          let lastSessionCheck = Date.now();
          let isActive = true;

          // Clean up on client disconnect
          request.socket.on('close', () => {
            isActive = false;
          });

          while (isActive) {
            try {
              // 1. Check for new messages in session_messages table
              const conditions = [eq(sessionMessages.sessionId, sessionId)];
              if (lastMessageId) {
                conditions.push(gt(sessionMessages.id, lastMessageId));
              }

              const newMessages = await db
                .select()
                .from(sessionMessages)
                .where(and(...conditions))
                .orderBy(asc(sessionMessages.id))
                .limit(10);

              // Send new message events
              for (const message of newMessages) {
                if (!isActive) break;
                
                const parsedMessage = parseDbMessage(message, session.projectPath);
                if (parsedMessage) {
                  yield {
                    event: 'new-message',
                    data: JSON.stringify({
                      message: parsedMessage
                    }),
                    id: message.id,
                  };
                  lastMessageId = message.id;
                }
              }

              // 2. Check for session state changes (every 2 seconds to reduce DB load)
              const now = Date.now();
              if (now - lastSessionCheck > 2000) {
                const currentSession = await sessionService.getSession(sessionId);
                
                if (currentSession && (
                  currentSession.isWorking !== session.isWorking ||
                  currentSession.currentJobId !== session.currentJobId ||
                  currentSession.lastJobStatus !== session.lastJobStatus
                )) {
                  yield {
                    event: 'session-state-change',
                    data: JSON.stringify({
                      isWorking: currentSession.isWorking,
                      currentJobId: currentSession.currentJobId,
                      lastJobStatus: currentSession.lastJobStatus,
                    }),
                  };
                  
                  // Update our cached session state
                  Object.assign(session, {
                    isWorking: currentSession.isWorking,
                    currentJobId: currentSession.currentJobId,
                    lastJobStatus: currentSession.lastJobStatus,
                  });
                }
                lastSessionCheck = now;
              }

              // Wait before next poll (500ms for responsive message updates)
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              logger.error({ sessionId, error }, 'Error polling for updates');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
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

#### 4. No Additional Backend Changes Needed!

The beauty of using the existing `session_messages` table is that **no changes are needed** to your message service or worker! The SSE endpoint simply polls the existing tables that are already being updated.

The worker continues to:
1. Save messages via `messageService.saveSDKMessage()` 
2. Update session state in the `sessions` table
3. No additional event publishing needed

The message service continues to:
1. Save messages to `session_messages` table as usual
2. No additional event logic needed

### Frontend Changes

#### 1. Install React Native SSE Library

```bash
bun add react-native-sse react-native-url-polyfill
```

#### 2. Create SSE Hook

Create a new hook for SSE message streaming:

```typescript
// mobile/src/hooks/useSSEMessages.ts
import { useEffect, useRef, useState } from 'react';
import { EventSource } from 'react-native-sse';
import 'react-native-url-polyfill/auto';
import { apiClient } from '../api/client';
import type { Message, Session } from '../types/messages';

interface SSEMessage {
  type: 'new-message' | 'session-state-change';
  data: {
    message?: Message;
    sessionState?: Pick<Session, 'isWorking' | 'currentJobId' | 'lastJobStatus'>;
  };
}

export function useSSEMessages(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Initial data fetch
    const loadInitialData = async () => {
      try {
        const response = await apiClient.getMessages({
          sessionId,
          query: { limit: 1000 }
        });
        setMessages(response.messages);
        setSession(response.session);
      } catch (err) {
        console.error('Failed to load initial messages:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    };

    loadInitialData();

    // Set up SSE connection
    const baseUrl = apiClient.getCurrentBaseUrl();
    const sseUrl = `${baseUrl}/api/claude-code/sessions/${sessionId}/messages/stream`;

    const eventSource = new EventSource(sseUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

    eventSourceRef.current = eventSource;

    eventSource.addEventListener('open', () => {
      console.log('[SSE] Connection opened for session:', sessionId);
      setIsConnected(true);
      setError(null);
    });

    eventSource.addEventListener('message', (event) => {
      try {
        const sseMessage: SSEMessage = JSON.parse(event.data);
        
        switch (sseMessage.type) {
          case 'new-message':
            if (sseMessage.data.message) {
              setMessages(prev => [...prev, sseMessage.data.message!]);
            }
            if (sseMessage.data.sessionState) {
              setSession(prev => prev ? { ...prev, ...sseMessage.data.sessionState } : null);
            }
            break;
            
          case 'session-state-change':
            if (sseMessage.data.sessionState) {
              setSession(prev => prev ? { ...prev, ...sseMessage.data.sessionState } : null);
            }
            break;
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err);
      }
    });

    eventSource.addEventListener('error', (event) => {
      console.error('[SSE] Connection error:', event);
      setError(new Error('SSE connection failed'));
      setIsConnected(false);
    });

    eventSource.addEventListener('close', () => {
      console.log('[SSE] Connection closed for session:', sessionId);
      setIsConnected(false);
    });

    // Cleanup on unmount or sessionId change
    return () => {
      console.log('[SSE] Cleaning up connection for session:', sessionId);
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [sessionId]);

  // Manual close function for when leaving the screen
  const closeConnection = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  return {
    messages,
    session,
    isConnected,
    error,
    closeConnection,
  };
}
```

#### 3. Update Session Screen to Use SSE

Modify the session screen to use SSE instead of polling:

```typescript
// mobile/app/session/[sessionId].tsx
import { useSSEMessages } from '@/hooks/useSSEMessages';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  
  const {
    messages,
    session,
    isConnected,
    error,
    closeConnection
  } = useSSEMessages(sessionId);

  // Close SSE connection when leaving the screen
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, []);

  // ... rest of component logic
}
```

#### 4. Create Fallback Hook for Backwards Compatibility

Keep the existing polling hook as a fallback:

```typescript
// mobile/src/hooks/useSessionMessages.ts
export function useSessionMessages(sessionId: string, useSSE = true) {
  const sseHook = useSSEMessages(sessionId);
  const pollingHook = usePollingMessages(sessionId);
  
  // Use SSE by default, fallback to polling if SSE fails
  if (useSSE && !sseHook.error) {
    return sseHook;
  }
  
  return pollingHook;
}
```

## Cross-Process Communication Solution

### Why SQLite Event Store Works

The key insight you identified is correct: the worker and server are separate processes, so in-memory EventEmitters won't work. The SQLite event store approach solves this by:

1. **Shared Database**: Both processes write to the same SQLite database
2. **Event Store Table**: New events are written as rows, which both processes can read
3. **Polling for SSE**: The SSE endpoint polls the event store (500ms intervals) for new events
4. **Event Cleanup**: Events are deleted after being sent to prevent growth

### Alternative Approaches Considered

#### Option 1: Redis Pub/Sub (Overkill)
- Pros: True real-time, battle-tested
- Cons: Adds Redis dependency, complexity for small-scale use

#### Option 2: File System Watching
- Pros: No polling needed
- Cons: Platform-specific, unreliable, doesn't provide event data

#### Option 3: Process Communication (Pipes/Sockets)
- Pros: Fast, efficient
- Cons: Complex setup, process lifecycle management

#### Option 4: WebSockets Between Processes
- Pros: Real-time
- Cons: Complex, worker needs to know about web server

### Why SQLite Event Store is Optimal

1. **Leverages Existing Infrastructure**: Uses your current SQLite setup
2. **Simple and Reliable**: Database transactions ensure consistency
3. **Scales Reasonably**: Good for dozens of concurrent sessions
4. **Self-Cleaning**: Events can be deleted immediately after delivery
5. **Debuggable**: Events are visible in the database for troubleshooting

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

This implementation will provide a much more responsive user experience while reducing server load and improving the overall scalability of the pokecode application.