import type React from 'react';
import { Text, View } from 'react-native';
import { memo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MESSAGE_TYPE_STYLES } from './messageColors';

interface UserMessage {
  content: string;
}

interface AssistantMessage {
  type: 'message' | 'tool_use' | 'tool_result';
  data: {
    content: string;
  };
}

interface Message {
  id: string;
  type: 'assistant' | 'user' | 'system' | 'result';
  data: UserMessage | AssistantMessage;
  parentToolUseId: string | null;
}

interface MessageViewProps {
  message: Message;
  onLongPress?: () => void;
}

export const MessageView: React.FC<MessageViewProps> = memo(({ message, onLongPress }) => {
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
    
    if (!assistantMessage.data || !assistantMessage.data.content) {
      return (
        <View className={`p-3 ${styles.background}`} style={{ backgroundColor: styles.backgroundColor }}>
          <Text style={{
            color: styles.textColor,
            fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
            fontSize: 16,
            lineHeight: 24
          }}>[No content]</Text>
        </View>
      );
    }

    return (
      <View className={`p-3 ${styles.background}`} style={{ backgroundColor: styles.backgroundColor }}>
        <MarkdownRenderer content={assistantMessage.data.content} />
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
        (message.data as any)?.content || JSON.stringify(message.data)
      )}
    </View>
  );
});
