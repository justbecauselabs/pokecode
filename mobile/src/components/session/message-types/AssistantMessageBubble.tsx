import type React from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../../types/messages';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ThinkingCard } from './ThinkingCard';
import { ToolCallCard } from './ToolCallCard';
import { ToolResultCard } from './ToolResultCard';

interface AssistantMessageBubbleProps {
  message: Message;
}

export const AssistantMessageBubble: React.FC<AssistantMessageBubbleProps> = ({ message }) => {
  const hasTools = (message.toolCalls && message.toolCalls.length > 0) || 
                   (message.toolResults && message.toolResults.length > 0);

  return (
    <View className="mb-2">
      {/* Thinking content */}
      {message.thinking && (
        <View className="mb-1">
          <ThinkingCard thinking={message.thinking} timestamp={message.timestamp} />
        </View>
      )}

      {/* Assistant message content - only show if no tools or if content is meaningful */}
      {!hasTools && message.content.trim() && (
        <View className="mb-1">
          <MarkdownRenderer content={message.content} />
        </View>
      )}

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <View className="mb-1">
          <ToolCallCard toolCalls={message.toolCalls} timestamp={message.timestamp} />
        </View>
      )}

      {/* Tool results */}
      {message.toolResults && message.toolResults.length > 0 && (
        <View className="mb-1">
          <ToolResultCard toolResults={message.toolResults} timestamp={message.timestamp} />
        </View>
      )}
    </View>
  );
};