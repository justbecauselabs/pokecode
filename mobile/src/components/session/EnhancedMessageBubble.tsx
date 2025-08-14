import type React from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../types/messages';
import { AssistantMessageBubble, UserMessageBubble } from './message-types';

interface EnhancedMessageBubbleProps {
  message: Message;
}

// System message component with white text
const SystemMessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  return (
    <View className="mb-2">
      <Text className="text-base font-mono text-white">
        {message.content}
      </Text>
    </View>
  );
};

export const EnhancedMessageBubble: React.FC<EnhancedMessageBubbleProps> = ({ message }) => {
  // Check if this is a system message by role or content patterns
  const isSystemMessage = (message as any).role === 'system' || 
                          message.content?.startsWith('System:') ||
                          message.content?.startsWith('[System]');

  if (isSystemMessage) {
    return <SystemMessageBubble message={message} />;
  }

  if (message.role === 'user') {
    return <UserMessageBubble message={message} />;
  }

  return <AssistantMessageBubble message={message} />;
};