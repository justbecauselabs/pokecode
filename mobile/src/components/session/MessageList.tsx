import type { AssistantMessageToolResult } from '@pokecode/api';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Message } from '../../types/messages';
import { textStyles } from '../../utils/styleUtils';
import { MessageView } from './MessageView';

// Type header component using pure TailwindCSS
const TypeHeader: React.FC<{ type: Message['type'] }> = ({ type }) => {
  const displayName = type.charAt(0).toUpperCase() + type.slice(1);

  // Define colors based on message type
  const getHeaderColor = (msgType: Message['type']): string => {
    switch (msgType) {
      case 'user':
        return '!text-blue-400';
      case 'assistant':
        return '!text-green-400';
      default:
        return '!text-gray-400';
    }
  };

  return (
    <View className="px-3 py-1 pt-3 bg-background">
      <Text className={`${textStyles.header} ${getHeaderColor(type)}`}>{displayName}</Text>
    </View>
  );
};

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  onMessageLongPress?: (message: Message) => void;
  onToolResultPress?: (result: AssistantMessageToolResult) => void;
  onTaskToolPress?: (toolId: string, agentName: string, messages: Message[]) => void;
  agentColors?: Record<string, string>;
  showAllMessages?: boolean; // When true, don't filter out messages with parentToolUseId
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  error,
  onMessageLongPress, // unused in test mode
  onToolResultPress, // unused in test mode
  onTaskToolPress, // unused in test mode
  agentColors, // unused in test mode
  showAllMessages = false,
}) => {
  const listRef = useRef<FlashListRef<Message>>(null);
  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const [_didInitialFetch, _setDidInitialFetch] = useState(false);

  const { finalMessages, toolResults, taskMessages } = useMemo(() => {
    const toolResultsDict: Record<string, AssistantMessageToolResult> = {};
    const taskMessagesDict: Record<string, Message[]> = {};
    const toolIds: string[] = [];
    const isAssistantToolResult = (data: unknown): data is { type: 'tool_result'; data: AssistantMessageToolResult } => {
      if (!data || typeof data !== 'object' || !('type' in data)) return false;
      const maybe = data as { type?: unknown; data?: unknown };
      if (maybe.type !== 'tool_result' || !maybe.data || typeof maybe.data !== 'object') return false;
      const res = maybe.data as { toolUseId?: unknown; content?: unknown };
      return typeof res.toolUseId === 'string' && typeof res.content === 'string';
    };

    const isAssistantToolUse = (data: unknown): data is { type: 'tool_use'; data: { toolId: string } } => {
      if (!data || typeof data !== 'object' || !('type' in data)) return false;
      const maybe = data as { type?: unknown; data?: unknown };
      if (maybe.type !== 'tool_use' || !maybe.data || typeof maybe.data !== 'object') return false;
      const res = maybe.data as { toolId?: unknown };
      return typeof res.toolId === 'string';
    };

    const filteredMessages = messages.filter((message) => {
      // Always capture assistant tool_result messages so we can pair them with tool_use
      if (message.type === 'assistant' && isAssistantToolResult(message.data)) {
        const toolResultData = message.data.data;
        toolResultsDict[toolResultData.toolUseId] = toolResultData;
        return false; // Do not render standalone; shown with its tool_use
      }

      // Group messages that belong to a task/tool thread (child messages)
      if (message.parentToolUseId && !showAllMessages) {
        const parentToolUseId = message.parentToolUseId;
        if (!taskMessagesDict[parentToolUseId]) {
          taskMessagesDict[parentToolUseId] = [];
        }
        taskMessagesDict[parentToolUseId].push(message);
        return false; // Hide child messages by default
      }

      // Track tool_use IDs so UI can look up matching results
      if (message.type === 'assistant' && isAssistantToolUse(message.data)) {
        toolIds.push(message.data.data.toolId);
      }

      return true; // Keep all other messages
    });

    // Debug logging
    console.log('MessageList processing:', {
      totalMessages: messages.length,
      filteredMessages: filteredMessages.length,
      toolIds,
      toolResultsKeys: Object.keys(toolResultsDict),
    });

    return {
      finalMessages: filteredMessages,
      toolResults: toolResultsDict,
      taskMessages: taskMessagesDict,
    };
  }, [messages, showAllMessages]);

  // Always fade in once the initial fetch completes, regardless of message count
  useEffect(() => {
    if (messages.length > 0 && opacity.value === 0) {
      listRef.current?.scrollToEnd({ animated: false });
      opacity.value = withDelay(250, withTiming(1, { duration: 250 }));
    }
    return undefined;
  }, [messages, opacity]);

  // Do not imperatively scroll here; v2's MVCP handles anchoring when has data

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const nextMessage = finalMessages[index + 1];
    const shouldShowHeader = !nextMessage || nextMessage.type !== item.type;

    return (
      <View>
        {shouldShowHeader && <TypeHeader type={item.type} />}
        <MessageView
          message={item}
          toolResults={toolResults}
          taskMessages={taskMessages}
          onLongPress={() => onMessageLongPress?.(item)}
          onToolResultPress={onToolResultPress}
          onTaskToolPress={onTaskToolPress}
          agentColors={agentColors}
        />
      </View>
    );
  };

  const renderError = () => (
    <View>
      <Text>Error loading messages</Text>
      <Text>{error?.message || 'Unknown error occurred'}</Text>
    </View>
  );

  if (error) {
    return renderError();
  }

  return (
    <Animated.View className="flex-1" style={fadeStyle}>
      <FlashList
        ref={listRef}
        data={finalMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{
          startRenderingFromBottom: true,
          autoscrollToBottomThreshold: 0.25,
          animateAutoScrollToBottom: true,
        }}
        style={styles.list}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
});
