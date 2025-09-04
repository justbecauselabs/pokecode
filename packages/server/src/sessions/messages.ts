import type { SSEEvent } from '@pokecode/api';
import {
  CreateMessageBodySchema,
  type CreateMessageRequest,
  ErrorResponseSchema,
  GetMessagesQuerySchema,
  GetMessagesResponseSchema,
  SessionIdParamsSchema,
  SSEEventSchema,
} from '@pokecode/api';
import { logger, messageEvents, messageService, sessionService } from '@pokecode/core';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Simple event queue for SSE events
class EventQueue {
  private queue: Array<SSEEvent> = [];
  private resolvers: Array<(value: SSEEvent | null) => void> = [];
  private aborted = false;
  constructor(
    private sessionId: string,
    private max: number = 200,
  ) {}

  push(event: SSEEvent) {
    if (this.aborted) return;

    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver(event);
    } else {
      this.queue.push(event);
      if (this.queue.length > this.max) {
        // Drop oldest to prevent unbounded memory
        this.queue.shift();
        logger.warn(
          { sessionId: this.sessionId, max: this.max },
          'SSE queue overflow: dropped oldest event',
        );
      }
    }
  }

  async next(): Promise<SSEEvent | null> {
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

  get size(): number {
    return this.queue.length;
  }

  abort() {
    this.aborted = true;
    // Resolve all pending promises with null
    this.resolvers.forEach((resolve) => {
      resolve(null);
    });
    this.resolvers.length = 0;
    this.queue.length = 0;
  }
}

const messageRoutes: FastifyPluginAsync = async (fastify) => {
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

        // Set up SSE stream via async generator
        // Fastify v5: ensure the reply is not auto-closed
        if (!reply.sent) {
          reply.hijack();
        }
        return reply.sse(
          (async function* () {
            const eventQueue = new EventQueue(sessionId);

            // Set up event listener for SSE events
            const onSSEEvent = (data: { sessionId: string; event: SSEEvent }) => {
              logger.debug(
                {
                  eventSessionId: data.sessionId,
                  targetSessionId: sessionId,
                  eventType: data.event.type,
                  matches: data.sessionId === sessionId,
                },
                'SSE endpoint received event',
              );

              if (data.sessionId === sessionId) {
                eventQueue.push(data.event);
                logger.debug(
                  {
                    sessionId,
                    eventType: data.event.type,
                    queueLength: eventQueue.size,
                  },
                  'Event added to SSE queue',
                );
              }
            };

            // Register listener
            messageEvents.on('sse-event', onSSEEvent);
            logger.debug(
              { sessionId, totalListeners: messageEvents.listenerCount('sse-event') },
              'SSE endpoint registered event listener',
            );

            // Clean up on client disconnect
            let cleaned = false;
            const cleanup = (why?: string) => {
              if (cleaned) return;
              cleaned = true;
              logger.info({ sessionId, why }, 'SSE connection closed');
              messageEvents.off('sse-event', onSSEEvent);
              eventQueue.abort();
            };

            // Prefer reply/request lifecycle events only
            reply.raw.once('close', () => cleanup('reply.close'));
            reply.raw.once('error', () => cleanup('reply.error'));
            (request.raw as { once?: (ev: string, cb: () => void) => void }).once?.('aborted', () =>
              cleanup('request.aborted'),
            );

            try {
              // Send heartbeat every 25 seconds to keep connection alive
              const heartbeatInterval = setInterval(() => {
                const heartbeatEvent: SSEEvent = {
                  type: 'heartbeat',
                  data: {},
                };
                eventQueue.push(heartbeatEvent);
              }, 25000);

              // Process events from the queue
              while (true) {
                const event = await eventQueue.next();
                if (!event) break; // Aborted

                // Validate the event before sending
                try {
                  const validatedEvent = SSEEventSchema.parse(event);
                  yield {
                    data: JSON.stringify(validatedEvent),
                  };
                } catch (validationError) {
                  logger.error(
                    { sessionId, event, validationError },
                    'Failed to validate SSE event',
                  );
                }
              }

              clearInterval(heartbeatInterval);
            } finally {
              cleanup();
            }
          })(),
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

  // POST /sessions/:sessionId/messages - Create new message
  fastify.post<{
    Params: { sessionId: string };
    Body: CreateMessageRequest;
  }>(
    '/messages',
    {
      schema: {
        params: SessionIdParamsSchema,
        body: CreateMessageBodySchema,
        response: {
          202: z.object({}), // Empty response
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { content, model } = request.body;

      try {
        // Verify session exists
        const session = await sessionService.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            error: 'Session not found',
            code: 'NOT_FOUND',
          });
        }

        // Save user message first
        await messageService.saveUserMessage(sessionId, content);

        // Queue prompt for processing (SDK will create assistant messages)
        await messageService.queuePrompt(sessionId, content, model);

        // Track metrics - TODO: implement proper metrics
        // Metrics tracking disabled for now

        logger.debug(
          {
            sessionId,
            content: content.substring(0, 100),
          },
          'Prompt queued for processing',
        );

        return reply.code(202).send();
      } catch (error) {
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to create message',
        );
        throw error;
      }
    },
  );

  // GET /sessions/:sessionId/messages - Get messages with optional cursor pagination
  fastify.get<{
    Params: { sessionId: string };
    Querystring: { after?: string; limit?: number };
  }>(
    '/messages',
    {
      schema: {
        params: SessionIdParamsSchema,
        querystring: GetMessagesQuerySchema,
        response: {
          200: GetMessagesResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { after, limit } = request.query;

      try {
        // Verify session exists
        const session = await sessionService.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            error: 'Session not found',
            code: 'NOT_FOUND',
          });
        }

        // Get messages with cursor pagination
        const result = await messageService.getMessages({
          sessionId,
          projectPath: session.projectPath,
          ...(after && { cursor: after }),
          ...(limit && { limit }),
        });

        const { messages, pagination } = result;

        logger.debug(
          {
            sessionId,
            messageCount: messages.length,
            cursor: after,
            limit,
            hasNextPage: pagination?.hasNextPage,
          },
          'Retrieved messages',
        );

        // Include full session info in response
        const response = {
          messages,
          session: {
            id: session.id,
            provider: session.provider,
            projectPath: session.projectPath,
            name: session.name,
            claudeDirectoryPath: session.claudeDirectoryPath,
            context: session.context,
            state: session.state,
            metadata: session.metadata,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            lastAccessedAt: session.lastAccessedAt,
            isWorking: session.isWorking,
            currentJobId: session.currentJobId,
            lastJobStatus: session.lastJobStatus,
            messageCount: session.messageCount,
            tokenCount: session.tokenCount,
          },
          pagination,
        };

        return reply.send(response);
      } catch (error) {
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to get messages',
        );

        if (error instanceof Error && error.message === 'Session not found') {
          return reply.code(404).send({
            error: 'Session not found',
            code: 'NOT_FOUND',
          });
        }
        throw error;
      }
    },
  );

  // GET /sessions/:sessionId/messages/raw - Get raw messages from DB with parsed content_data
  fastify.get<{
    Params: { sessionId: string };
  }>(
    '/messages/raw',
    {
      schema: {
        params: SessionIdParamsSchema,
        // No response validation - return raw data
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

        // Get raw messages from database with parsed content_data
        const rawMessages = await messageService.getRawMessages(sessionId);

        // Extract only the contentData from each message
        const contentDataOnly = rawMessages
          .map((msg: { contentData: unknown }) => msg.contentData)
          .filter(Boolean);

        logger.debug(
          {
            sessionId,
            messageCount: contentDataOnly.length,
          },
          'Retrieved raw messages contentData',
        );

        return reply.send(contentDataOnly);
      } catch (error) {
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to get raw messages',
        );

        if (error instanceof Error && error.message === 'Session not found') {
          return reply.code(404).send({
            error: 'Session not found',
            code: 'NOT_FOUND',
          });
        }
        throw error;
      }
    },
  );

  // POST /sessions/:sessionId/cancel - Cancel current session processing
  fastify.post<{
    Params: { sessionId: string };
  }>(
    '/cancel',
    {
      schema: {
        params: SessionIdParamsSchema,
        response: {
          200: z.object({ success: z.boolean() }),
          404: ErrorResponseSchema,
        },
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

        // Cancel the current session processing
        await messageService.cancelSession(sessionId);

        logger.debug(
          {
            sessionId,
          },
          'Session cancelled successfully',
        );

        return reply.send({ success: true });
      } catch (error) {
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to cancel session',
        );
        throw error;
      }
    },
  );
};

export default messageRoutes;
