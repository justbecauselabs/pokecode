/**
 * Message component for displaying chat messages
 */

import React from 'react';
import { Box, Text } from 'ink';
import { CodeBlock } from './CodeBlock';
import type { ChatMessage } from '../types';

interface MessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export const Message: React.FC<MessageProps> = ({ message, isStreaming }) => {
  const roleColor = message.role === 'user' ? 'cyan' : 'green';
  const roleLabel = message.role === 'user' ? 'You' : 'Assistant';
  
  // Parse message content for code blocks
  const renderContent = () => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = codeBlockRegex.exec(message.content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(
          <Text key={`text-${lastIndex}`} wrap="wrap">
            {message.content.slice(lastIndex, match.index)}
          </Text>
        );
      }
      
      // Add code block
      const language = match[1] || undefined;
      const code = match[2] || '';
      parts.push(
        <CodeBlock key={`code-${match.index}`} code={code.trim()} language={language} />
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < message.content.length) {
      parts.push(
        <Text key={`text-${lastIndex}`} wrap="wrap">
          {message.content.slice(lastIndex)}
          {isStreaming && <Text color="cyan">▊</Text>}
        </Text>
      );
    } else if (isStreaming) {
      parts.push(<Text key="cursor" color="cyan">▊</Text>);
    }
    
    return parts;
  };
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={roleColor}>
          {roleLabel}:
        </Text>
        {message.timestamp && (
          <Text dimColor> {formatTime(message.timestamp)}</Text>
        )}
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {renderContent()}
      </Box>
    </Box>
  );
};

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}