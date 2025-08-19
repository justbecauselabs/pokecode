import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import type { GetMessagesResponse, Message } from '../types/messages';

export function useSessionMessages(sessionId: string) {
  const queryClient = useQueryClient();
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const lastPollingStateRef = useRef<'working' | 'finished' | 'no-session' | null>(null);
  const isSendingRef = useRef(false); // Track if we're sending a message
  
  // Track cursor for incremental loading
  const lastCursorRef = useRef<string | null>(null);
  const allMessagesRef = useRef<Message[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Conditional polling function - improved to handle race conditions
  const getRefetchInterval = useCallback((data: GetMessagesResponse | undefined) => {
    // Enhanced logging for debugging
    console.log('[Polling Debug]', {
      hasData: !!data,
      hasSession: !!data?.session,
      isWorking: data?.session?.isWorking,
      isSending: isSendingRef.current,
      lastState: lastPollingStateRef.current,
      timestamp: new Date().toISOString(),
    });

    if (!data?.session) {
      if (lastPollingStateRef.current !== 'no-session') {
        console.log('[Polling] No session data, stopping polling');
        lastPollingStateRef.current = 'no-session';
      }
      return false;
    }

    // If we're sending a message or Claude is working, continue polling
    if (data.session.isWorking || isSendingRef.current) {
      if (lastPollingStateRef.current !== 'working') {
        console.log('[Polling] Claude is working or sending message, continuing polling every 1s');
        lastPollingStateRef.current = 'working';
      }
      retryCountRef.current = 0; // Reset retry count on successful poll
      return 1000; // Poll every 1 second as requested
    }

    // Only stop polling if we're certain Claude is finished AND we're not sending
    if (!isSendingRef.current && !data.session.isWorking) {
      if (lastPollingStateRef.current !== 'finished') {
        console.log('[Polling] Claude finished working and not sending, stopping polling');
        lastPollingStateRef.current = 'finished';
      }
      return false;
    }

    // Default: continue polling if uncertain
    console.log('[Polling] Uncertain state, continuing polling as fallback');
    return 1000; // Poll every 1 second as requested
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sessionMessages', sessionId],
    queryFn: async (): Promise<GetMessagesResponse> => {
      console.log('[API] Fetching messages for session:', sessionId, isInitialLoad ? '(initial)' : '(incremental)');
      try {
        let response: GetMessagesResponse;

        if (isInitialLoad) {
          // Initial load: fetch all messages without cursor
          response = await apiClient.getMessages({ sessionId });
          allMessagesRef.current = response.messages;
          
          // Set cursor based on API pagination data or current timestamp
          lastCursorRef.current = response.pagination?.nextCursor || new Date().toISOString();
          setIsInitialLoad(false);
          
          console.log('[API] Initial load completed, cursor set to:', lastCursorRef.current);
        } else {
          // Incremental load: fetch only new messages since cursor
          if (lastCursorRef.current) {
            response = await apiClient.getMessages({ 
              sessionId, 
              query: { after: lastCursorRef.current, limit: 50 } 
            });
            
            console.log('[API] Incremental fetch with cursor:', lastCursorRef.current, 'found:', response.messages.length, 'new messages');
            
            // Append new messages to existing ones
            if (response.messages.length > 0) {
              allMessagesRef.current = [...allMessagesRef.current, ...response.messages];
              
              // Update cursor using API pagination data or fallback to timestamp
              lastCursorRef.current = response.pagination?.nextCursor || new Date().toISOString();
              
              console.log('[API] Updated cursor to:', lastCursorRef.current);
            }
          } else {
            // Fallback: no cursor available, fetch all messages
            response = await apiClient.getMessages({ sessionId });
            allMessagesRef.current = response.messages;
            lastCursorRef.current = response.pagination?.nextCursor || new Date().toISOString();
          }
          
          // Create response with all accumulated messages and preserve pagination info
          response = {
            ...response,
            messages: allMessagesRef.current,
            // Keep original pagination info for debugging/monitoring
            pagination: {
              ...response.pagination,
              totalFetched: allMessagesRef.current.length, // Override with total accumulated count
            },
          };
        }

        retryCountRef.current = 0; // Reset retry count on success
        console.log('[API] Messages fetched successfully, total:', response.messages.length, 'isWorking:', response.session?.isWorking);
        return response;
      } catch (error) {
        retryCountRef.current += 1;
        console.error(
          '[API] Message fetch failed, attempt',
          retryCountRef.current,
          'of',
          maxRetries
        );
        if (retryCountRef.current >= maxRetries) {
          console.error('Message polling failed after max retries');
          throw error;
        }
        throw error;
      }
    },
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh for real-time feel
    gcTime: 0, // Don't keep stale data in cache
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when app regains focus
    refetchInterval: (query) => getRefetchInterval(query.state.data), // Conditional polling
    refetchIntervalInBackground: true, // Continue polling in background
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (params: { content: string }) => {
      return apiClient.sendMessage({
        sessionId,
        data: { content: params.content },
      });
    },
    onMutate: async (params) => {
      // Set sending state to prevent premature polling termination
      isSendingRef.current = true;
      console.log('[Mutation] Starting message send, setting isSending=true');

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sessionMessages', sessionId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<GetMessagesResponse>([
        'sessionMessages',
        sessionId,
      ]);

      // Optimistically update with user message and working state
      if (previousMessages) {
        const optimisticUserMessage: Message = {
          id: `temp-${Date.now()}`,
          type: 'user',
          data: {
            content: params.content,
          },
          parentToolUseId: null,
        };

        // Add optimistic message to local cache
        allMessagesRef.current = [...allMessagesRef.current, optimisticUserMessage];

        queryClient.setQueryData<GetMessagesResponse>(['sessionMessages', sessionId], {
          ...previousMessages,
          messages: [...previousMessages.messages, optimisticUserMessage],
          session: {
            ...previousMessages.session,
            isWorking: true, // Optimistically set working state
          },
        });
      }

      return { previousMessages };
    },
    onError: (_, __, context) => {
      // Clear sending state and rollback on error
      isSendingRef.current = false;
      console.log('[Mutation] Message send failed, setting isSending=false');

      // Rollback local cache by removing the last optimistic message
      if (allMessagesRef.current.length > 0) {
        const lastMessage = allMessagesRef.current[allMessagesRef.current.length - 1];
        if (lastMessage.id.startsWith('temp-')) {
          allMessagesRef.current = allMessagesRef.current.slice(0, -1);
        }
      }

      if (context?.previousMessages) {
        queryClient.setQueryData(['sessionMessages', sessionId], context.previousMessages);
      }
    },
    onSuccess: () => {
      // Clear sending state but keep polling until server confirms work is done
      isSendingRef.current = false;
      console.log(
        '[Mutation] Message sent successfully, setting isSending=false and invalidating query'
      );

      // Remove optimistic message from local cache - the real message will be fetched by polling
      if (allMessagesRef.current.length > 0) {
        const lastMessage = allMessagesRef.current[allMessagesRef.current.length - 1];
        if (lastMessage.id.startsWith('temp-')) {
          allMessagesRef.current = allMessagesRef.current.slice(0, -1);
          console.log('[Mutation] Removed optimistic message from local cache');
        }
      }

      // Invalidate to get fresh data from server, polling will continue based on isWorking
      queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      return apiClient.cancelSession({ sessionId });
    },
    onMutate: async () => {
      console.log('[Cancel Mutation] Starting session cancellation');

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sessionMessages', sessionId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<GetMessagesResponse>([
        'sessionMessages',
        sessionId,
      ]);

      // Optimistically update session state to not working
      if (previousMessages?.session) {
        queryClient.setQueryData<GetMessagesResponse>(['sessionMessages', sessionId], {
          ...previousMessages,
          session: {
            ...previousMessages.session,
            isWorking: false,
            lastJobStatus: 'cancelled',
          },
        });
      }

      return { previousMessages };
    },
    onError: (_, __, context) => {
      console.log('[Cancel Mutation] Session cancellation failed');

      if (context?.previousMessages) {
        queryClient.setQueryData(['sessionMessages', sessionId], context.previousMessages);
      }
    },
    onSuccess: () => {
      console.log('[Cancel Mutation] Session cancelled successfully, invalidating query');

      // Invalidate to get fresh data from server
      queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
    },
  });

  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
  };

  const sendMessage = async (params: { content: string }) => {
    const result = await sendMessageMutation.mutateAsync(params);

    // No need to call refetch() here - onSuccess already invalidates the query
    // which triggers a refetch and starts the polling cycle

    return result;
  };

  const cancelSession = async () => {
    const result = await cancelSessionMutation.mutateAsync();
    return result;
  };

  return {
    messages: data?.messages || [],
    session: data?.session,
    isLoading,
    error,
    refetch,
    invalidateMessages,
    sendMessage,
    cancelSession,
    isSending: sendMessageMutation.isPending,
    isCancelling: cancelSessionMutation.isPending,
    isWorking: data?.session?.isWorking || false, // Use server state
  };
}
