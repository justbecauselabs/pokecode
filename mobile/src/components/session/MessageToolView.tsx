import type React from 'react';
import { View } from 'react-native';
import { memo } from 'react';
import { MessageToolTodoView } from './MessageToolTodoView';

interface TodoToolUse {
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}

interface AssistantMessageToolUse {
  type: 'todo';
  data: TodoToolUse;
}

interface MessageToolViewProps {
  toolUse: AssistantMessageToolUse;
}

export const MessageToolView: React.FC<MessageToolViewProps> = memo(({ toolUse }) => {
  const renderToolByType = () => {
    switch (toolUse.type) {
      case 'todo':
        return <MessageToolTodoView todos={toolUse.data.todos} />;
      default:
        return (
          <View className="p-3">
            <View>Unknown tool type: {toolUse.type}</View>
          </View>
        );
    }
  };

  return (
    <View>
      {renderToolByType()}
    </View>
  );
});