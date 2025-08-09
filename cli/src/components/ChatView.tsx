/**
 * Chat view component for displaying messages
 */

import React, { useEffect, useRef } from 'react';
import { Box, Text, useStdout } from 'ink';
import { Message } from './Message';
import type { ChatMessage } from '../types';

interface ChatViewProps {
  messages: ChatMessage[];
  streamingMessageId?: string;
  height: number;
}

export const ChatView: React.FC<ChatViewProps> = ({ 
  messages, 
  streamingMessageId,
  height 
}) => {
  const { stdout } = useStdout();
  const scrollRef = useRef<boolean>(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && stdout) {
      // In a real terminal app, we'd implement scrolling
      // For now, Ink handles overflow automatically
    }
  }, [messages, stdout]);

  // Calculate available height for messages
  const messageHeight = Math.max(1, height - 4); // Reserve space for borders and input

  return (
    <Box 
      flexDirection="column" 
      height={messageHeight}
      overflow="hidden"
      paddingX={1}
    >
      {messages.length === 0 ? (
        <Box justifyContent="center" alignItems="center" height="100%">
          <Text dimColor>Start typing to begin the conversation...</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              isStreaming={message.id === streamingMessageId}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};