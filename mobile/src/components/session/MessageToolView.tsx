import type { AssistantMessageToolResult, AssistantMessageToolUse } from '@pokecode/api';
import type React from 'react';
import { memo } from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../types/messages';
import { MessageGenericToolView } from './MessageGenericToolView';
import { MessageTaskToolView } from './MessageTaskToolView';
import { MessageToolTodoView } from './MessageToolTodoView';

interface MessageToolViewProps {
  toolUse: AssistantMessageToolUse;
  toolResult?: AssistantMessageToolResult;
  taskMessages?: Record<string, Message[]>;
  onResultPress?: (result: AssistantMessageToolResult) => void;
  onTaskToolPress?: (toolId: string, agentName: string, messages: Message[]) => void;
  agentColors?: Record<string, string>;
}

export const MessageToolView: React.FC<MessageToolViewProps> = memo(
  ({ toolUse, toolResult, taskMessages, onResultPress, onTaskToolPress, agentColors }) => {
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
          if (
            'filePath' in toolUse.data &&
            'oldString' in toolUse.data &&
            'newString' in toolUse.data
          ) {
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
        case 'multiedit':
          // For multiedit tools, use generic tool view
          if ('filePath' in toolUse.data && 'edits' in toolUse.data) {
            const editsCount = toolUse.data.edits.length;
            return (
              <MessageGenericToolView
                title="multiedit"
                text={`${toolUse.data.filePath} (${editsCount} edits)`}
                result={toolResult}
                onResultPress={onResultPress}
              />
            );
          }
          break;
        case 'grep':
          // For grep tools, use generic tool view
          if ('pattern' in toolUse.data && 'path' in toolUse.data) {
            return (
              <MessageGenericToolView
                title="grep"
                text={`${toolUse.data.pattern} in ${toolUse.data.path}`}
                result={toolResult}
                onResultPress={onResultPress}
              />
            );
          }
          break;
        case 'ls':
          // For ls tools, use generic tool view
          if ('path' in toolUse.data) {
            return (
              <MessageGenericToolView
                title="ls"
                text={toolUse.data.path}
                result={toolResult}
                onResultPress={onResultPress}
              />
            );
          }
          break;
        case 'glob':
          // For glob tools, use generic tool view
          if ('pattern' in toolUse.data) {
            const pathText =
              'path' in toolUse.data && toolUse.data.path ? ` in ${toolUse.data.path}` : '';
            return (
              <MessageGenericToolView
                title="glob"
                text={`${toolUse.data.pattern}${pathText}`}
                result={toolResult}
                onResultPress={onResultPress}
              />
            );
          }
          break;
        case 'task':
          // For task tools, use the special task tool view
          console.log('🔧 Task tool case hit!', {
            toolId: toolUse.toolId,
            hasSubagentType: 'subagentType' in toolUse.data,
            hasTaskMessages: !!taskMessages,
            taskMessagesKeys: taskMessages ? Object.keys(taskMessages) : [],
          });

          if ('subagentType' in toolUse.data && taskMessages) {
            const relatedMessages = taskMessages[toolUse.toolId] || [];
            console.log('🔧 Creating MessageTaskToolView with:', {
              agentName: toolUse.data.subagentType,
              messageCount: relatedMessages.length,
              hasOnTaskToolPress: !!onTaskToolPress,
            });

            return (
              <MessageTaskToolView
                agentName={toolUse.data.subagentType}
                messageCount={relatedMessages.length}
                agentColors={agentColors}
                onPress={() => {
                  console.log('🔧 MessageTaskToolView onPress called');
                  onTaskToolPress?.(toolUse.toolId, toolUse.data.subagentType, relatedMessages);
                }}
              />
            );
          } else {
            // Fallback for debugging
            console.log('🔧 Task tool fallback case');
            return (
              <MessageGenericToolView
                title="task (fallback)"
                text={`Agent: ${toolUse.data.subagentType || 'unknown'}`}
                result={toolResult}
                onResultPress={onResultPress}
              />
            );
          }
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

    return <View>{renderToolByType()}</View>;
  }
);
