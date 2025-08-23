import { EventEmitter } from 'node:events';
import type { Message, SSEEvent } from '@pokecode/api';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('event-bus');

// Type-safe event definitions
interface EventBusEvents {
  'sse-event': { sessionId: string; event: SSEEvent };
}

class TypedEventEmitter extends EventEmitter {
  override emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): boolean {
    return super.emit(event, data);
  }

  override on<K extends keyof EventBusEvents>(
    event: K,
    listener: (data: EventBusEvents[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  override off<K extends keyof EventBusEvents>(
    event: K,
    listener: (data: EventBusEvents[K]) => void,
  ): this {
    return super.off(event, listener);
  }
}

// Global event bus for real-time updates
export const messageEvents = new TypedEventEmitter();

// Helper functions to emit SSE events
export function emitNewMessage(sessionId: string, message: Message) {
  logger.debug(
    { sessionId, messageId: message.id, messageType: message.type },
    'Emitting new message event to SSE clients',
  );

  const success = messageEvents.emit('sse-event', {
    sessionId,
    event: {
      type: 'update',
      data: {
        state: 'running',
        message,
      },
    },
  });

  logger.debug(
    {
      sessionId,
      messageId: message.id,
      success,
      listenerCount: messageEvents.listenerCount('sse-event'),
    },
    'SSE event emission result',
  );
}

export function emitSessionDone(sessionId: string) {
  logger.debug({ sessionId }, 'Emitting session done event to SSE clients');

  const success = messageEvents.emit('sse-event', {
    sessionId,
    event: {
      type: 'update',
      data: {
        state: 'done',
        message: null,
      },
    },
  });

  logger.debug(
    { sessionId, success, listenerCount: messageEvents.listenerCount('sse-event') },
    'Session done event emission result',
  );
}

export function emitHeartbeat(sessionId: string) {
  messageEvents.emit('sse-event', {
    sessionId,
    event: {
      type: 'heartbeat',
      data: {},
    },
  });
}
