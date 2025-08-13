import React from 'react';
import { View, Text } from 'react-native';
import type { Message } from '../../types/messages';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium mb-1">
        {isUser ? 'User' : 'Assistant'}
      </Text>
      
      <View>
        {message.content.trim() ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <Text className="text-gray-500 italic">
            [No content]
          </Text>
        )}
      </View>
    </View>
  );
};