import React, { useRef, useEffect } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { Message } from '../../types/messages';
import { MessageBubble } from './MessageBubble';
import { LoadingState } from '../ui/LoadingState';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  error,
  onRefresh,
}) => {
  const flashListRef = useRef<FlashList<Message>>(null);
  const isInitialLoad = useRef(true);

  // Process messages to include latest child of last message
  const processedMessages = React.useMemo(() => {
    if (messages.length === 0) return messages;
    
    const lastMessage = messages[messages.length - 1];
    
    // If last message has children, replace it with the latest child
    if (lastMessage.children && lastMessage.children.length > 0) {
      const latestChild = lastMessage.children[lastMessage.children.length - 1];
      
      // Create a new message object from the latest child
      const latestChildAsMessage: Message = {
        ...lastMessage, // Start with parent message structure
        id: latestChild.id,
        role: latestChild.role,
        content: latestChild.content,
        timestamp: latestChild.timestamp,
        children: [], // Children don't have nested children
      };
      
      // Return all messages except the last one, plus the latest child as the new last message
      return [...messages.slice(0, -1), latestChildAsMessage];
    }
    
    return messages;
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (processedMessages.length > 0 && flashListRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: !isInitialLoad.current });
        isInitialLoad.current = false;
      }, 100);
    }
  }, [processedMessages.length]);

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  );


  const renderEmpty = () => (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-center">
        No messages yet
      </Text>
    </View>
  );

  const renderError = () => (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-center mb-2">
        Error loading messages
      </Text>
      <Text className="text-center text-sm">
        {error?.message || 'Unknown error occurred'}
      </Text>
    </View>
  );

  if (error) {
    return renderError();
  }

  return (
    <View className="flex-1">
      {isLoading && messages.length === 0 ? (
        <LoadingState />
      ) : (
        <FlashList
          ref={flashListRef}
          data={processedMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
          }}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
            />
          }
        />
      )}
    </View>
  );
};