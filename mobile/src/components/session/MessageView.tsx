import type {
  AssistantMessage,
  AssistantMessageToolResult,
  Message,
  UserMessage,
} from '@pokecode/api';
import type React from 'react';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageToolView } from './MessageToolView';
import { textStyles } from '../../utils/styleUtils';

interface MessageViewProps {
  message: Message;
  toolResults?: Record<string, AssistantMessageToolResult>;
  taskMessages?: Record<string, Message[]>;
  onLongPress?: () => void;
  onToolResultPress?: (result: AssistantMessageToolResult) => void;
  onTaskToolPress?: (toolId: string, agentName: string, messages: Message[]) => void;
  agentColors?: Record<string, string>;
}

export const MessageView: React.FC<MessageViewProps> = memo(
  ({ message, toolResults, taskMessages, onLongPress, onToolResultPress, onTaskToolPress, agentColors }) => {
    if (!message || !message.data) {
      return (
        <View className="mb-2">
          <Text className={textStyles.error}>
            [Error: Invalid message data]
          </Text>
        </View>
      );
    }

    const isUser = message.type === 'user';
    const isAssistant = message.type === 'assistant';

    const renderUserMessage = (userMessage: UserMessage) => {
      return (
        <View className="p-3 bg-background">
          <Text className={textStyles.messageContentSm}>
            {userMessage.content}
          </Text>
        </View>
      );
    };

    const renderAssistantMessage = (assistantMessage: AssistantMessage) => {
      // Handle tool_use messages
      if (assistantMessage.type === 'tool_use') {
        const toolData = assistantMessage.data;
        // Find the corresponding tool result
        const toolResult = toolResults ? toolResults[toolData.toolId] : undefined;

        return (
          <View className="bg-background">
            <MessageToolView
              toolUse={toolData}
              toolResult={toolResult}
              taskMessages={taskMessages}
              onResultPress={onToolResultPress}
              onTaskToolPress={onTaskToolPress}
              agentColors={agentColors}
            />
          </View>
        );
      }

      // Handle regular message content
      if (assistantMessage.type === 'message') {
        const messageData = assistantMessage.data;

        return (
          <View className="p-3 bg-background">
            <MarkdownRenderer content={messageData.content} />
          </View>
        );
      }

      // Handle tool results (though these should be filtered out)
      if (assistantMessage.type === 'tool_result') {
        return null; // Tool results are displayed inline with their tool use
      }

      return (
        <View className="p-3 bg-background">
          <Text className={textStyles.messageContent}>
            [Unknown assistant message type]
          </Text>
        </View>
      );
    };

    const renderGenericMessage = (content: string) => {
      return (
        <View className="p-3 bg-background">
          <Text className={textStyles.messageContent}>
            {content}
          </Text>
        </View>
      );
    };

    return (
      <View>
        {isUser && renderUserMessage(message.data as UserMessage)}
        {isAssistant && renderAssistantMessage(message.data as AssistantMessage)}
        {!isUser &&
          !isAssistant &&
          renderGenericMessage(
            typeof message.data === 'string' ? message.data : JSON.stringify(message.data)
          )}
      </View>
    );
  }
);
