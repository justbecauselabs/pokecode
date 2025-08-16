import { FlashList } from '@shopify/flash-list';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../types/messages';
import { LoadingState } from '../common';
import { MessageView } from './MessageView';
import { MESSAGE_TYPE_STYLES } from './messageColors';

// Type header component
const TypeHeader: React.FC<{ type: Message['type'] }> = ({ type }) => {
  const styles = MESSAGE_TYPE_STYLES[type] || MESSAGE_TYPE_STYLES.assistant;
  const displayName = type.charAt(0).toUpperCase() + type.slice(1);
  
  return (
    <View className={`px-3 py-1 pt-3 ${styles.background}`} style={{ backgroundColor: styles.backgroundColor }}>
      <Text style={{
        color: styles.headerTextColor,
        fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
        fontSize: 12,
        fontWeight: '600'
      }}>
        {displayName}
      </Text>
    </View>
  );
};

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
      // Get current scroll offset directly from the ref
      const scrollMetrics = flashListRef.current.getScrollableNode()?.getScrollMetrics?.();
      const currentOffset = scrollMetrics?.offset?.y || 0;
      
      // Only auto-scroll if user is near the bottom (scroll offset <= 50)
      if (currentOffset <= 50) {
        // Small delay to ensure content is rendered
        setTimeout(() => {
          flashListRef.current?.scrollToIndex({ index: 0, animated: !isInitialLoad.current });
          isInitialLoad.current = false;
        }, 100);
      }
    }
  }, [messages.length]);

  const finalMessages = useMemo(() => {
    return messages.toReversed();
  }, [messages]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // Since the list is inverted, we need to check the next item (which is actually the previous message)
    const nextMessage = finalMessages[index + 1];
    const shouldShowHeader = !nextMessage || nextMessage.type !== item.type;
    
    return (
      <View>
        {shouldShowHeader && <TypeHeader type={item.type} />}
        <MessageView message={item} onLongPress={() => onMessageLongPress?.(item)} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View>
      <Text>No messages yet</Text>
    </View>
  );

  const renderError = () => (
    <View>
      <Text>Error loading messages</Text>
      <Text>
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
          ListEmptyComponent={renderEmpty}
          estimatedItemSize={100}
        />
      )}
    </View>
  );
};
