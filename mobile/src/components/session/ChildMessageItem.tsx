import type React from 'react';
import { Text, View } from 'react-native';
import type { ChildMessage } from '../../types/messages';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChildMessageItemProps {
  message: ChildMessage;
}

export const ChildMessageItem: React.FC<ChildMessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className="p-3 bg-card border border-border rounded-lg mb-2">
      {/* Header with role and timestamp */}
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-xs font-medium text-muted-foreground font-mono">{isUser ? 'User' : 'Assistant'}</Text>
        <Text className="text-xs text-muted-foreground font-mono">{formatTime(message.timestamp)}</Text>
      </View>

      {/* Message content */}
      <View>
        {message.content.trim() ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <Text className="text-muted-foreground italic text-sm font-mono">[No content]</Text>
        )}
      </View>

      {/* Tool calls if present */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <View className="mt-3 p-2 bg-secondary border border-border rounded">
          <Text className="text-xs font-semibold text-accent mb-1 font-mono">
            Tool Calls ({message.toolCalls.length})
          </Text>
          {message.toolCalls.map((toolCall, index) => (
            <View key={index} className="mb-1">
              <Text className="text-xs text-primary font-medium font-mono">{toolCall.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};
