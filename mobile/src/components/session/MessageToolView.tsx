import type React from 'react';
import { View, Text } from 'react-native';
import { memo } from 'react';
import { MessageToolTodoView } from './MessageToolTodoView';
import { MessageGenericToolView } from './MessageGenericToolView';
import type {
  AssistantMessageToolUse,
  AssistantMessageToolResult
} from '../../schemas/message.schema';

interface MessageToolViewProps {
  toolUse: AssistantMessageToolUse;
  toolResult?: AssistantMessageToolResult;
  onResultPress?: (result: AssistantMessageToolResult) => void;
}

export const MessageToolView: React.FC<MessageToolViewProps> = memo(({ toolUse, toolResult, onResultPress }) => {
  const renderToolByType = () => {
    switch (toolUse.type) {
      case 'todo':
        // For todo tools, check if data is TodoToolUse type
        if ('todos' in toolUse.data) {
          return <MessageToolTodoView todos={toolUse.data.todos} />;
        }
        break;
      case 'read':
        // For read tools, check if data is ReadToolUse type
        if ('filePath' in toolUse.data) {
          return (
            <MessageGenericToolView
              title="read"
              text={toolUse.data.filePath}
              result={toolResult}
              onResultPress={onResultPress}
            />
          );
        }
        break;
      case 'bash':
        // For bash tools, use generic tool view
        if ('command' in toolUse.data) {
          return (
            <MessageGenericToolView
              title="bash"
              text={toolUse.data.command}
              result={toolResult}
              onResultPress={onResultPress}
            />
          );
        }
        break;
      case 'edit':
        // For edit tools, use generic tool view
        if ('filePath' in toolUse.data && 'oldString' in toolUse.data && 'newString' in toolUse.data) {
          return (
            <MessageGenericToolView
              title="edit"
              text={`${toolUse.data.filePath}: ${toolUse.data.oldString} → ${toolUse.data.newString}`}
              result={toolResult}
              onResultPress={onResultPress}
            />
          );
        }
        break;
      default:
        return (
          <View className="p-3">
            <Text>Unknown tool type: {toolUse.type}</Text>
          </View>
        );
    }

    // Fallback if data structure doesn't match expected type
    return (
      <View className="p-3">
        <Text>Invalid tool data for type: {toolUse.type}</Text>
      </View>
    );
  };

  return (
    <View>
      {renderToolByType()}
    </View>
  );
});
