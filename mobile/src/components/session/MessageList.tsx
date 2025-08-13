import React, { useRef, useEffect } from 'react';
import { FlatList, View, Text, RefreshControl } from 'react-native';
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
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

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
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            flexGrow: 1,
          }}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
            />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}
    </View>
  );
};