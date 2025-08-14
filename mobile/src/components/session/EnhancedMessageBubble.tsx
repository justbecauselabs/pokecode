import type React from 'react';
import type { Message } from '../../types/messages';
import { MessageBubble } from './MessageBubble';

interface EnhancedMessageBubbleProps {
  message: Message;
}

export const EnhancedMessageBubble: React.FC<EnhancedMessageBubbleProps> = ({ message }) => {
  // Use the updated MessageBubble component that handles all message types
  return <MessageBubble message={message} />;
};