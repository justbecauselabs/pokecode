import React, { useCallback, useRef } from 'react';
import { FlashList } from '@shopify/flash-list';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { ClaudeMessage } from '@/types/claude';
import { MessageItem } from './MessageItem';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';

interface MessageListProps {
  messages: ClaudeMessage[];
  isStreaming: boolean;
  streamingMessageId?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  onToolClick?: (tool: any) => void;
  onFileClick?: (path: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming,
  streamingMessageId,
  onRefresh,
  refreshing = false,
  onToolClick,
  onFileClick,
}) => {
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  const listRef = useRef<FlashList<ClaudeMessage>>(null);

  const getItemType = useCallback((item: ClaudeMessage) => {
    if (item.toolUses && item.toolUses.length > 0) return 'tool';
    if (item.content.includes('```')) return 'code';
    return 'text';
  }, []);

  const renderItem = useCallback(({ item }: { item: ClaudeMessage }) => {
    return (
      <MessageItem
        message={item}
        isStreaming={isStreaming && item.id === streamingMessageId}
        onToolClick={onToolClick}
        onFileClick={onFileClick}
      />
    );
  }, [isStreaming, streamingMessageId, onToolClick, onFileClick]);

  const keyExtractor = useCallback((item: ClaudeMessage) => item.id, []);

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
    />
  ) : undefined;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlashList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={200}
        getItemType={getItemType}
        inverted
        refreshControl={refreshControl}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 100,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 20,
    paddingHorizontal: 16,
  },
});