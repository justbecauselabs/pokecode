import { FlashList } from '@shopify/flash-list';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../types/messages';
import { LoadingState } from '../common';
import { EnhancedMessageBubble } from './EnhancedMessageBubble';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  onMessageLongPress?: (message: Message) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  error,
  onMessageLongPress,
}) => {
  const flashListRef = useRef<FlashList<Message>>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (messages.length > 0 && flashListRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        flashListRef.current?.scrollToIndex({ index: 0, animated: !isInitialLoad.current });
        isInitialLoad.current = false;
      }, 100);
    }
  }, [messages.length]);

  const finalMessages = useMemo(() => {
    return messages.toReversed();
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => (
    <EnhancedMessageBubble message={item} onLongPress={() => onMessageLongPress?.(item)} />
  );

  const renderEmpty = () => (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-center font-mono text-muted-foreground">No messages yet</Text>
    </View>
  );

  const renderError = () => (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-center mb-2 font-mono text-destructive">Error loading messages</Text>
      <Text className="text-center text-sm font-mono text-muted-foreground">
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
          data={finalMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted={true}
          contentContainerStyle={{
            padding: 16,
          }}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
};
