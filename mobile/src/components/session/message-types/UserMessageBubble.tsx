import type React from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../../types/messages';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolResultCard } from './ToolResultCard';

interface UserMessageBubbleProps {
  message: Message;
}

export const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({ message }) => {
  return (
    <View className="mb-6">
      {/* User header */}
      <View className="flex-row items-center mb-2">
        <View className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
        <Text className="text-sm font-mono font-medium text-foreground">User</Text>
      </View>

      {/* User message content */}
      <View className="bg-card border border-border rounded-lg p-4 ml-4">
        {message.content.trim() ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <Text className="text-muted-foreground italic font-mono">[No content]</Text>
        )}
      </View>

      {/* Tool results */}
      {message.toolResults && message.toolResults.length > 0 && (
        <View className="ml-4 mt-3">
          <ToolResultCard toolResults={message.toolResults} timestamp={message.timestamp} />
        </View>
      )}
    </View>
  );
};