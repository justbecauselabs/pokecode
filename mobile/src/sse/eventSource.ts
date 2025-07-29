import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';
import { getAuthToken } from '../storage/asyncStorage';
import { StreamMessage } from '@/types/claude';

interface SSEOptions {
  onMessage: (data: StreamMessage) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class ClaudeCodeSSE {
  private eventSource: EventSource | null = null;
  private controller: AbortController | null = null;

  async connect(sessionId: string, promptId: string, options: SSEOptions) {
    const token = await getAuthToken();
    if (!token) {
      options.onError?.(new Error('No authentication token'));
      return;
    }

    const url = `${API_BASE_URL}${API_ENDPOINTS.prompts.stream(sessionId, promptId)}`;
    
    try {
      // For React Native, we'll use fetch with text/event-stream
      this.controller = new AbortController();
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: this.controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          options.onComplete?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last line if it's incomplete
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              options.onComplete?.();
              this.disconnect();
              return;
            }

            try {
              const parsed = JSON.parse(data) as StreamMessage;
              options.onMessage(parsed);
            } catch (error) {
              console.error('SSE parse error:', error);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        options.onError?.(error);
      }
    }
  }

  disconnect() {
    this.controller?.abort();
    this.controller = null;
    this.eventSource?.close();
    this.eventSource = null;
  }
}

// Singleton instance
let sseInstance: ClaudeCodeSSE | null = null;

export function getSSEInstance(): ClaudeCodeSSE {
  if (!sseInstance) {
    sseInstance = new ClaudeCodeSSE();
  }
  return sseInstance;
}