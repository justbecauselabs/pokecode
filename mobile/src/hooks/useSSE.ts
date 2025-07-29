import { useEffect, useState, useRef, useCallback } from 'react';
import { getSSEInstance } from '@/sse/eventSource';
import { StreamMessage } from '@/types/claude';

interface UseSSEOptions {
  sessionId: string;
  promptId: string | null;
  onMessage?: (message: StreamMessage) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

export function useSSE({
  sessionId,
  promptId,
  onMessage,
  onComplete,
  onError,
  autoConnect = true,
}: UseSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const sseRef = useRef<ReturnType<typeof getSSEInstance> | null>(null);

  const connect = useCallback(async () => {
    if (!promptId || isConnected) return;

    sseRef.current = getSSEInstance();
    setIsConnected(true);

    await sseRef.current.connect(sessionId, promptId, {
      onMessage: (data) => {
        setMessages(prev => [...prev, data]);
        onMessage?.(data);
      },
      onComplete: () => {
        setIsConnected(false);
        onComplete?.();
      },
      onError: (error) => {
        setIsConnected(false);
        onError?.(error);
      },
    });
  }, [sessionId, promptId, isConnected, onMessage, onComplete, onError]);

  const disconnect = useCallback(() => {
    sseRef.current?.disconnect();
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect && promptId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [promptId, autoConnect]);

  return {
    messages,
    isConnected,
    connect,
    disconnect,
  };
}