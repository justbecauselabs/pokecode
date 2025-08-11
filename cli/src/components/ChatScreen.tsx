/**
 * Main chat screen component
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import { StatusBar } from './StatusBar';
import { ChatView } from './ChatView';
import { PromptInput } from './PromptInput';
import type { ChatMessage } from '../types';
import type { Session } from '../types/api';
import { SessionService } from '../services/session.service';
// import { SSEService } from '../services/sse.service'; // Removed SSE
import { ConfigService } from '../services/config.service';
import { Logger } from '../utils/logger';

interface ChatScreenProps {
  session: Session;
  onExit?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ session, onExit }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [streamingMessageId, setStreamingMessageId] = useState<string | undefined>();
  
  const { exit } = useApp();
  const { stdout } = useStdout();
  const sessionService = SessionService.getInstance();
  // const sseService = SSEService.getInstance(); // Removed SSE
  const configService = ConfigService.getInstance();
  const logger = Logger.getInstance();
  
  const auth = configService.getAuth();
  const terminalHeight = stdout?.rows || 24;

  // Load session history on mount
  useEffect(() => {
    loadHistory();
    
    // Cleanup on unmount
    return () => {
      // sseService.closeAllConnections(); // Removed SSE
    };
  }, [session.id]);

  const loadHistory = async () => {
    try {
      const history = await sessionService.getSessionHistory(session.id);
      const loadedMessages: ChatMessage[] = history
        .filter(prompt => prompt.status === 'completed' && prompt.response)
        .flatMap(prompt => [
          {
            id: `${prompt.id}-user`,
            role: 'user' as const,
            content: prompt.prompt,
            timestamp: new Date(prompt.createdAt),
          },
          {
            id: `${prompt.id}-assistant`,
            role: 'assistant' as const,
            content: prompt.response || '',
            timestamp: new Date(prompt.updatedAt),
          }
        ]);
      
      setMessages(loadedMessages);
    } catch (error) {
      logger.error('Failed to load history', error);
    }
  };

  const handleSubmit = useCallback(async (message: string) => {
    if (isProcessing) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    setConnectionStatus('connecting');

    try {
      // Create prompt
      const prompt = await sessionService.createPrompt(session.id, message);
      
      // Add placeholder for assistant response
      const assistantMessage: ChatMessage = {
        id: prompt.id,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingMessageId(prompt.id);
      
      // Start SSE streaming
      let accumulatedContent = '';
      
      // SSE streaming removed - CLI not functional until polling implemented
      console.warn('SSE streaming removed from CLI');
      const cleanup = () => {}; // await sseService.streamPrompt(
        session.id,
        prompt.id,
        (sseMessage) => {
          if (sseMessage.type === 'connected') {
            setConnectionStatus('connected');
            logger.debug('SSE connected');
          } else if (sseMessage.type === 'message' && sseMessage.data) {
            // Accumulate content
            accumulatedContent += sseMessage.data;
            
            // Update message with accumulated content
            setMessages(prev => 
              prev.map(msg => 
                msg.id === prompt.id 
                  ? { ...msg, content: accumulatedContent, isStreaming: true }
                  : msg
              )
            );
          } else if (sseMessage.type === 'complete') {
            // Mark as complete
            setMessages(prev => 
              prev.map(msg => 
                msg.id === prompt.id 
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
            setStreamingMessageId(undefined);
            setIsProcessing(false);
            setConnectionStatus('connected');
            logger.debug('SSE stream complete');
          } else if (sseMessage.type === 'error') {
            logger.error('SSE error', sseMessage.error);
            setConnectionStatus('error');
            setIsProcessing(false);
            setStreamingMessageId(undefined);
          }
        },
        (error) => {
          logger.error('SSE connection error', error);
          setConnectionStatus('error');
          setIsProcessing(false);
          setStreamingMessageId(undefined);
          
          // Update message to show specific error
          let errorContent = 'Failed to get response';
          
          if (error.message.includes('401') || error.message.includes('authentication')) {
            errorContent = 'Authentication failed. Please check your API key.';
          } else if (error.message.includes('500') || error.message.includes('worker')) {
            errorContent = 'Backend worker is not running. Please ensure the worker process is started.';
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorContent = 'Network error. Please check your connection and backend server.';
          } else {
            errorContent = `Error: ${error.message}`;
          }
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === prompt.id 
                ? { ...msg, content: errorContent, isStreaming: false }
                : msg
            )
          );
        },
        () => {
          // On complete
          setStreamingMessageId(undefined);
          setIsProcessing(false);
        }
      );
      
    } catch (error) {
      logger.error('Failed to send message', error);
      setConnectionStatus('error');
      setIsProcessing(false);
      
      // Determine specific error message
      let errorContent = 'Failed to send message.';
      
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorContent = 'Authentication failed. Please check your API key configuration.';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          errorContent = 'Backend server error. Please ensure the worker process is running.';
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          errorContent = 'Cannot connect to backend server. Please check if the server is running.';
        } else {
          errorContent = `Error: ${error.message}`;
        }
      }
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [isProcessing, session.id, logger, sessionService]);

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <StatusBar
        sessionPath={session.projectPath}
        sessionContext={session.context}
        connectionStatus={connectionStatus}
        userName={auth?.user.email}
      />
      
      <Box flexGrow={1} flexDirection="column">
        <ChatView
          messages={messages}
          streamingMessageId={streamingMessageId}
          height={terminalHeight - 6} // Account for status bar and input
        />
      </Box>
      
      <Box flexDirection="column">
        <PromptInput
          onSubmit={handleSubmit}
          isDisabled={isProcessing}
          placeholder="Type your message... (Enter to send, Ctrl+D to exit)"
        />
        
        <Box paddingX={1}>
          <Text dimColor fontSize={10}>
            [Ctrl+C: Clear] [Ctrl+L: Clear Screen] [Ctrl+D: Exit] [↑↓: History]
          </Text>
        </Box>
      </Box>
    </Box>
  );
};