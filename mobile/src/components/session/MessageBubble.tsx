import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Message } from '../../types/messages';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  onShowChildMessages?: (message: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onShowChildMessages }) => {
  const isUser = message.role === 'user';

  return (
    <View className="mb-6">
      <Text className="text-sm font-mono font-medium mb-2 text-foreground">
        {isUser ? 'User' : 'Assistant'}
      </Text>

      <View>
        {message.content.trim() ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <Text className="text-muted-foreground italic font-mono">[No content]</Text>
        )}
      </View>

      {/* Child messages indicator */}
      {message.children && message.children.length > 0 && (
        <TouchableOpacity
          className="mt-3 flex-row items-center bg-secondary px-3 py-2 rounded-lg self-start active:opacity-80"
          onPress={() => onShowChildMessages?.(message)}
          accessibilityLabel={`Show ${message.children.length} child messages`}
          accessibilityRole="button"
        >
          <Text className="text-sm text-foreground font-mono font-medium">
            Messages ({message.children.length})
          </Text>
          <Text className="ml-2 text-muted-foreground text-base font-mono">›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
