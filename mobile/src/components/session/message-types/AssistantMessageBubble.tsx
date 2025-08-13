import type React from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../../types/messages';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ThinkingCard } from './ThinkingCard';
import { ToolCallCard } from './ToolCallCard';

interface AssistantMessageBubbleProps {
  message: Message;
}

export const AssistantMessageBubble: React.FC<AssistantMessageBubbleProps> = ({ message }) => {
  return (
    <View className="mb-6">
      {/* Assistant header */}
      <View className="flex-row items-center mb-2">
        <View className="w-2 h-2 bg-purple-500 rounded-full mr-2" />
        <Text className="text-sm font-mono font-medium text-foreground">Assistant</Text>
      </View>

      {/* Thinking content */}
      {message.thinking && (
        <View className="ml-4 mb-3">
          <ThinkingCard thinking={message.thinking} timestamp={message.timestamp} />
        </View>
      )}

      {/* Assistant message content */}
      <View className="bg-card border border-border rounded-lg p-4 ml-4">
        {message.content.trim() ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <Text className="text-muted-foreground italic font-mono">[No content]</Text>
        )}
      </View>

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <View className="ml-4 mt-3">
          <ToolCallCard toolCalls={message.toolCalls} timestamp={message.timestamp} />
        </View>
      )}
    </View>
  );
};