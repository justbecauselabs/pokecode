import type React from 'react';
import type { Message } from '../../types/messages';
import { AssistantMessageBubble, UserMessageBubble } from './message-types';

interface EnhancedMessageBubbleProps {
  message: Message;
}

export const EnhancedMessageBubble: React.FC<EnhancedMessageBubbleProps> = ({ message }) => {
  if (message.role === 'user') {
    return <UserMessageBubble message={message} />;
  }

  return <AssistantMessageBubble message={message} />;
};