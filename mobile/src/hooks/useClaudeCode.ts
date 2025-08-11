import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '@/stores/sessionStore';
import { promptsApi } from '@/api/prompts';
// import { getSSEInstance } from '@/sse/eventSource'; // Removed SSE
import { ClaudeMessage, StreamMessage, CreatePromptData, ToolUse } from '@/types/claude';
import { QUERY_KEYS } from '@/constants/api';

interface UseClaudeCodeOptions {
  sessionId: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
}

export function useClaudeCode({
  sessionId,
  onStreamStart,
  onStreamEnd,
  onError,
}: UseClaudeCodeOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  // const sseRef = useRef<ReturnType<typeof getSSEInstance> | null>(null); // Removed SSE
  const queryClient = useQueryClient();
  
  const { addMessage, updateMessage, appendToMessage } = useSessionStore();

  const createPromptMutation = useMutation({
    mutationFn: (data: Omit<CreatePromptData, 'sessionId'>) => 
      promptsApi.create({ ...data, sessionId }),
    onSuccess: (prompt) => {
      // Add user message
      const userMessage: ClaudeMessage = {
        id: `user-${prompt.id}`,
        role: 'user',
        content: prompt.prompt,
        createdAt: prompt.createdAt,
      };
      addMessage(sessionId, userMessage);

      // Start streaming
      handleStream(prompt.id);
    },
    onError: (error) => {
      setIsStreaming(false);
      onError?.(error as Error);
    },
  });

  const handleStream = useCallback(async (promptId: string) => {
    setIsStreaming(true);
    onStreamStart?.();

    const messageId = `assistant-${promptId}`;
    setStreamingMessageId(messageId);

    // Add initial assistant message
    const assistantMessage: ClaudeMessage = {
      id: messageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      toolUses: [],
    };
    addMessage(sessionId, assistantMessage);

    // SSE streaming removed - mobile now uses polling
    // TODO: Implement mobile polling if needed
    console.warn('SSE streaming removed - mobile chat not functional until polling implemented');
    
    setIsStreaming(false);
    setStreamingMessageId(null);
    onStreamEnd?.();
  }, [sessionId, addMessage, updateMessage, appendToMessage, onStreamStart, onStreamEnd, onError, queryClient]);

  const submitPrompt = useCallback(async (prompt: string, templates?: any[]) => {
    if (!prompt.trim() || isStreaming) return;

    createPromptMutation.mutate({ prompt, templates });
  }, [createPromptMutation, isStreaming]);

  const cancelStream = useCallback(() => {
    // sseRef.current?.disconnect(); // Removed SSE
    setIsStreaming(false);
    setStreamingMessageId(null);
    onStreamEnd?.();
  }, [onStreamEnd]);

  return {
    submitPrompt,
    cancelStream,
    isStreaming,
    streamingMessageId,
    isLoading: createPromptMutation.isPending,
    error: createPromptMutation.error,
  };
}