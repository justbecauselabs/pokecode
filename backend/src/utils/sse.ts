import type { FastifyReply } from 'fastify';

export class SSEStream {
  private reply: FastifyReply;
  private isConnected: boolean = true;

  constructor(reply: FastifyReply) {
    this.reply = reply;
    this.setupHeaders();
  }

  private setupHeaders() {
    this.reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
  }

  send(event: string, data: any, id?: string) {
    if (!this.isConnected) {
      return;
    }

    try {
      if (id) {
        this.reply.raw.write(`id: ${id}\n`);
      }
      this.reply.raw.write(`event: ${event}\n`);
      this.reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  sendData(data: any, id?: string) {
    if (!this.isConnected) {
      return;
    }

    try {
      if (id) {
        this.reply.raw.write(`id: ${id}\n`);
      }
      this.reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  sendComment(comment: string) {
    if (!this.isConnected) {
      return;
    }

    try {
      this.reply.raw.write(`: ${comment}\n\n`);
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  sendHeartbeat() {
    this.sendComment('heartbeat');
  }

  close() {
    if (!this.isConnected) {
      return;
    }

    this.isConnected = false;
    this.reply.raw.end();
  }

  get connected() {
    return this.isConnected;
  }
}

// Helper function to format SSE events
export function formatSSEMessage(event: string, data: any, id?: string): string {
  let message = '';

  if (id) {
    message += `id: ${id}\n`;
  }

  if (event) {
    message += `event: ${event}\n`;
  }

  message += `data: ${JSON.stringify(data)}\n\n`;

  return message;
}

// Helper to create a heartbeat interval
export function createSSEHeartbeat(stream: SSEStream, interval = 30000): NodeJS.Timeout {
  return setInterval(() => {
    if (stream.connected) {
      stream.sendHeartbeat();
    }
  }, interval);
}

// Type definitions for SSE events
export interface SSEEvent<T = any> {
  id?: string;
  event: string;
  data: T;
  retry?: number;
}
