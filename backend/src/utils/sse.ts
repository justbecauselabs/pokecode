import type { FastifyReply } from 'fastify';

// Type definitions for SSE events
export interface SSEEvent<T = any> {
  id?: string;
  event: string;
  data: T;
  retry?: number;
}

// Enhanced SSE utilities using fastify-sse-v2 plugin
export class EnhancedSSEStream {
  private reply: FastifyReply;
  private closed: boolean = false;

  constructor(reply: FastifyReply) {
    this.reply = reply;
  }

  /**
   * Send an SSE event using the fastify-sse-v2 plugin
   */
  send(event: string, data: any, id?: string) {
    if (this.closed) {
      return;
    }

    try {
      this.reply.sse({
        event,
        data: JSON.stringify(data),
        id,
      });
    } catch (error) {
      this.closed = true;
      throw error;
    }
  }

  /**
   * Send data without specifying an event type
   */
  sendData(data: any, id?: string) {
    if (this.closed) {
      return;
    }

    try {
      this.reply.sse({
        data: JSON.stringify(data),
        id,
      });
    } catch (error) {
      this.closed = true;
      throw error;
    }
  }

  /**
   * Create an async generator from Redis messages for streaming
   */
  static async *fromRedisChannel(redis: any, channel: string) {
    try {
      await redis.subscribe(channel);

      while (true) {
        const message = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Redis message timeout'));
          }, 30000); // 30 second timeout

          redis.once('message', (receivedChannel: string, msg: string) => {
            clearTimeout(timeout);
            if (receivedChannel === channel) {
              resolve(msg);
            }
          });

          redis.once('error', (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          });
        }).catch((error) => {
          console.warn('Redis subscription error:', error.message);
          throw error; // Re-throw to break the loop
        });

        try {
          // Validate message is not empty
          if (!message || message.trim() === '') {
            continue;
          }

          const event = JSON.parse(message);

          // Validate event has required properties
          if (!event || typeof event.type !== 'string') {
            console.warn('Invalid event format from Redis:', event);
            continue;
          }

          yield {
            id: event.id || undefined,
            event: event.type,
            data: JSON.stringify(event.data || null),
          };

          // End stream on completion or error
          if (event.type === 'complete' || event.type === 'error') {
            break;
          }
        } catch (_parseError) {
          yield {
            event: 'error',
            data: JSON.stringify({ error: 'Failed to parse message' }),
          };
          break;
        }
      }
    } finally {
      try {
        await redis.unsubscribe(channel);
        await redis.quit();
      } catch (cleanupError) {
        console.warn('Redis cleanup error:', cleanupError);
      }
    }
  }

  get isClosed() {
    return this.closed;
  }

  close() {
    this.closed = true;
  }
}

/**
 * Create a Redis-based SSE stream using fastify-sse-v2
 */
export async function createRedisSSEStream(
  reply: FastifyReply,
  redis: any,
  channel: string,
  initialEvent?: { event: string; data: any; id?: string },
) {
  // Send initial event if provided
  if (initialEvent) {
    reply.sse({
      event: initialEvent.event,
      data: JSON.stringify(initialEvent.data),
      id: initialEvent.id,
    });
  }

  // Stream from Redis channel
  reply.sse(EnhancedSSEStream.fromRedisChannel(redis, channel));
}
