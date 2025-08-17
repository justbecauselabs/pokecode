import type React from 'react';
import { Text, View } from 'react-native';
import { memo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageToolView } from './MessageToolView';
import { MESSAGE_TYPE_STYLES } from './messageColors';
import type {
  Message,
  AssistantMessage,
  UserMessage,
  AssistantMessageToolResult
} from '../../schemas/message.schema';

interface MessageViewProps {
  message: Message;
  toolResults?: Record<string, AssistantMessageToolResult>;
  onLongPress?: () => void;
  onToolResultPress?: (result: AssistantMessageToolResult) => void;
}

export const MessageView: React.FC<MessageViewProps> = memo(({ message, toolResults, onLongPress, onToolResultPress }) => {
  if (!message || !message.data) {
    return (
      <View className="mb-2">
        <Text style={{
          color: '#e06c75',
          fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          fontSize: 16,
          lineHeight: 24
        }}>
          [Error: Invalid message data]
        </Text>
      </View>
    );
  }

  const isUser = message.type === 'user';
  const isAssistant = message.type === 'assistant';

  const renderUserMessage = (userMessage: UserMessage) => {
    const styles = MESSAGE_TYPE_STYLES.user;

    return (
      <View className={`p-3 ${styles.background}`} style={{ backgroundColor: styles.backgroundColor }}>
        <Text style={{
          color: styles.textColor,
          fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          fontSize: 16,
          lineHeight: 24
        }}>{userMessage.content}</Text>
      </View>
    );
  };

  const renderAssistantMessage = (assistantMessage: AssistantMessage) => {
    const styles = MESSAGE_TYPE_STYLES.assistant;

    // Handle tool_use messages
    if (assistantMessage.type === 'tool_use') {
      const toolData = assistantMessage.data;
      // Find the corresponding tool result
      const toolResult = toolResults ? toolResults[message.id] : undefined;

      return (
        <View className={`${styles.background}`} style={{ backgroundColor: styles.backgroundColor }}>
          <MessageToolView toolUse={toolData} toolResult={toolResult} onResultPress={onToolResultPress} />
        </View>
      );
    }

    // Handle regular message content
    if (assistantMessage.type === 'message') {
      const messageData = assistantMessage.data;

      return (
        <View className={`p-3 ${styles.background}`} style={{ backgroundColor: styles.backgroundColor }}>
          <MarkdownRenderer content={messageData.content} />
        </View>
      );
    }

    // Handle tool results (though these should be filtered out)
    if (assistantMessage.type === 'tool_result') {
      return null; // Tool results are displayed inline with their tool use
    }

    return (
      <View className={`p-3 ${styles.background}`} style={{ backgroundColor: styles.backgroundColor }}>
        <Text style={{
          color: styles.textColor,
          fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          fontSize: 16,
          lineHeight: 24
        }}>[Unknown assistant message type]</Text>
      </View>
    );
  };

  const renderGenericMessage = (content: string) => {
    const styles = MESSAGE_TYPE_STYLES[message.type] || MESSAGE_TYPE_STYLES.assistant;
    return (
      <View className={`p-3 ${styles.background}`} style={{ backgroundColor: styles.backgroundColor }}>
        <Text style={{
          color: styles.textColor,
          fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          fontSize: 16,
          lineHeight: 24
        }}>{content}</Text>
      </View>
    );
  };

  return (
    <View>
      {isUser && renderUserMessage(message.data as UserMessage)}
      {isAssistant && renderAssistantMessage(message.data as AssistantMessage)}
      {!isUser && !isAssistant && renderGenericMessage(
        typeof message.data === 'string' ? message.data :
        JSON.stringify(message.data)
      )}
    </View>
  );
});
