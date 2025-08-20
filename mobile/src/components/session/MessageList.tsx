import type { AssistantMessageToolResult } from '@pokecode/api';
import { FlashList } from '@shopify/flash-list';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../types/messages';
import { textStyles } from '../../utils/styleUtils';
import { LoadingState } from '../common';
import { MessageView } from './MessageView';

// Type header component using pure TailwindCSS
const TypeHeader: React.FC<{ type: Message['type'] }> = ({ type }) => {
  const displayName = type.charAt(0).toUpperCase() + type.slice(1);

  // Define colors based on message type
  const getHeaderColor = (type: Message['type']): string => {
    switch (type) {
      case 'user':
        return '!text-blue-400'; // Nice blue for user
      case 'assistant':
        return '!text-green-400'; // Nice green for assistant
      default:
        return '!text-gray-400'; // Default for other types
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
  isLoading,
  error,
  onMessageLongPress,
  onToolResultPress,
  onTaskToolPress,
  agentColors,
  showAllMessages = false,
}) => {
  const flashListRef = useRef<FlashList<Message>>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (messages.length > 0 && flashListRef.current) {
      // Get current scroll offset directly from the ref
      // FlashList doesn't provide direct access to scroll metrics in this way
      // We'll track scroll position manually
      const currentOffset = 0; // Default to 0 for auto-scroll

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

  const { finalMessages, toolResults, taskMessages } = useMemo(() => {
    // Create a dictionary of tool results keyed by toolUseId
    const toolResultsDict: Record<string, AssistantMessageToolResult> = {};

    // Create a dictionary of messages organized by parent tool use id
    const taskMessagesDict: Record<string, Message[]> = {};

    // Filter out tool result messages and collect them in the dictionary
    const filteredMessages = messages.filter((message) => {
      // Check if message has a parent tool use id
      if (message.parentToolUseId && !showAllMessages) {
        const parentToolUseId = message.parentToolUseId;
        if (!taskMessagesDict[parentToolUseId]) {
          taskMessagesDict[parentToolUseId] = [];
        }
        taskMessagesDict[parentToolUseId].push(message);
        return false; // Filter out messages with parent tool use id
      }

      if (
        message.type === 'assistant' &&
        message.data &&
        typeof message.data === 'object' &&
        'type' in message.data
      ) {
        const assistantData = message.data;
        if (assistantData.type === 'tool_result') {
          const toolResultData = assistantData.data;
          toolResultsDict[toolResultData.toolUseId] = toolResultData;
          return false; // Filter out tool result messages
        }
      }
      return true; // Keep all other messages
    });

    // Debug logging
    console.log('MessageList processing:', {
      totalMessages: messages.length,
      filteredMessages: filteredMessages.length,
      taskMessagesKeys: Object.keys(taskMessagesDict),
      taskMessagesContent: Object.entries(taskMessagesDict).map(([key, msgs]) => ({
        toolId: key,
        messageCount: msgs.length,
      })),
    });

    return {
      finalMessages: filteredMessages.toReversed(),
      toolResults: toolResultsDict,
      taskMessages: taskMessagesDict,
    };
  }, [messages, showAllMessages]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // Since the list is inverted, we need to check the next item (which is actually the previous message)
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

  const renderEmpty = () => (
    <View>
      <Text>No messages yet</Text>
    </View>
  );

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
