import type React from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../../types/messages';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolResultCard } from './ToolResultCard';

interface UserMessageBubbleProps {
  message: Message;
}

export const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({ message }) => {
  const hasTools = message.toolResults && message.toolResults.length > 0;

  return (
    <View className="mb-2">
      {/* User message content - only show if no tools or if content is meaningful */}
      {!hasTools && message.content.trim() && (
        <View className="mb-1">
          <MarkdownRenderer content={message.content} />
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
