/**
 * Server-Sent Events service for real-time streaming
 */

import { ConfigService } from './config.service';
import { Logger } from '../utils/logger';
import type { SSEMessage } from '../types';

export class SSEService {
  private static instance: SSEService;
  private configService: ConfigService;
  private logger: Logger;
  private activeConnections: Map<string, AbortController> = new Map();

  private constructor() {
    this.configService = ConfigService.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  /**
   * Connect to SSE stream for a prompt
   */
  public async streamPrompt(
    sessionId: string,
    promptId: string,
    onMessage: (message: SSEMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<() => void> {
    const auth = this.configService.getAuth();
    if (!auth?.accessToken) {
      const error = new Error('Not authenticated');
      onError?.(error);
      throw error;
    }

    const serverUrl = this.configService.getServerUrl();
    const url = `${serverUrl}/api/claude-code/sessions/${sessionId}/prompts/${promptId}/stream`;
    
    // Create abort controller for this connection
    const abortController = new AbortController();
    const connectionKey = `${sessionId}-${promptId}`;
    this.activeConnections.set(connectionKey, abortController);

    this.logger.debug('Opening SSE stream', { url });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        let errorMessage = `SSE connection failed: ${response.status}`;
        
        // Add more context based on status code
        if (response.status === 401) {
          errorMessage = 'Authentication failed (401). Please check your API key.';
        } else if (response.status === 500) {
          errorMessage = 'Internal server error (500). Backend worker may not be running.';
        } else if (response.status === 503) {
          errorMessage = 'Service unavailable (503). Backend worker is not available.';
        }
        
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('No response body for SSE stream');
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Start reading
      const read = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              this.logger.debug('SSE stream ended');
              onComplete?.();
              break;
            }

            // Decode and add to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete SSE messages
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              this.processSSELine(line, onMessage, onError, onComplete);
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            this.logger.debug('SSE stream aborted');
          } else {
            this.logger.error('Error reading SSE stream', error);
            onError?.(error instanceof Error ? error : new Error('Stream read error'));
          }
        } finally {
          reader.releaseLock();
          this.activeConnections.delete(connectionKey);
        }
      };

      // Start reading in background
      read();

      // Return cleanup function
      return () => {
        this.closeConnection(connectionKey);
      };
    } catch (error) {
      this.logger.error('Failed to establish SSE connection', error);
      this.activeConnections.delete(connectionKey);
      
      if (error instanceof Error) {
        onError?.(error);
      } else {
        onError?.(new Error('Failed to connect to stream'));
      }
      
      throw error;
    }
  }

  /**
   * Process a single SSE line
   */
  private processSSELine(
    line: string,
    onMessage: (message: SSEMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): void {
    // Skip empty lines and comments
    if (!line || line.startsWith(':')) {
      return;
    }

    // Parse SSE format
    if (line.startsWith('event:')) {
      const eventType = line.substring(6).trim();
      this.lastEventType = eventType;
    } else if (line.startsWith('data:')) {
      const data = line.substring(5).trim();
      
      try {
        const parsed = JSON.parse(data);
        
        // Handle based on event type or data structure
        if (this.lastEventType === 'connected') {
          onMessage({ type: 'connected' });
        } else if (this.lastEventType === 'complete') {
          onMessage({ type: 'complete' });
          onComplete?.();
        } else if (this.lastEventType === 'error') {
          onMessage({ 
            type: 'error', 
            error: parsed.error || 'Stream error' 
          });
          onError?.(new Error(parsed.error || 'Stream error'));
        } else if (this.lastEventType === 'token' || this.lastEventType === 'message') {
          // Handle token streaming
          onMessage({
            type: 'message',
            data: parsed.content || parsed.token || parsed.data || '',
          });
        } else {
          // Default: treat as message
          onMessage({
            type: 'message',
            data: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
          });
        }
      } catch (e) {
        // If not JSON, treat as plain text message
        if (data) {
          onMessage({
            type: 'message',
            data: data,
          });
        }
      }
      
      // Reset event type after processing
      this.lastEventType = undefined;
    }
  }

  private lastEventType?: string;

  /**
   * Close a specific connection
   */
  public closeConnection(connectionKey: string): void {
    const controller = this.activeConnections.get(connectionKey);
    if (controller) {
      controller.abort();
      this.activeConnections.delete(connectionKey);
      this.logger.debug('Closed SSE connection', { connectionKey });
    }
  }

  /**
   * Close all active connections
   */
  public closeAllConnections(): void {
    for (const [key, controller] of this.activeConnections) {
      controller.abort();
      this.logger.debug('Closed SSE connection', { key });
    }
    this.activeConnections.clear();
  }
}