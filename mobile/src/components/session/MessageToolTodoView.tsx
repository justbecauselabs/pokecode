import type React from 'react';
import { Text, View } from 'react-native';
import { memo } from 'react';
import { textStyles } from '../../utils/styleUtils';

interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface MessageToolTodoViewProps {
  todos: TodoItem[];
}

const getStatusIcon = (status: TodoItem['status']): string => {
  switch (status) {
    case 'completed':
      return '✓';
    case 'in_progress':
      return '•';
    case 'pending':
      return '○';
    default:
      return '○';
  }
};

const getStatusClasses = (status: TodoItem['status']): string => {
  switch (status) {
    case 'completed':
      return 'text-success';
    case 'in_progress':
      return 'text-primary';
    case 'pending':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
};

const getTextClasses = (status: TodoItem['status']): string => {
  const base = textStyles.messageContentSm;
  
  switch (status) {
    case 'completed':
      return `${base} line-through opacity-75`;
    case 'in_progress':
      return `${base} font-semibold text-foreground`;
    case 'pending':
      return `${base} text-muted-foreground`;
    default:
      return `${base} text-muted-foreground`;
  }
};

export const MessageToolTodoView: React.FC<MessageToolTodoViewProps> = memo(({ todos }) => {
  if (!todos || todos.length === 0) {
    return (
      <View className="bg-gray-800 p-3 rounded-lg mx-3">
        <Text className={`${textStyles.messageContentSm} text-muted-foreground italic`}>
          No todos
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-gray-800 p-3 rounded-lg mx-3">
      <Text className={`${textStyles.header} mb-2`}>
        Tasks ({todos.filter(t => t.status === 'completed').length}/{todos.length})
      </Text>
      
      {todos.map((todo, index) => (
        <View key={index} className="flex-row items-start mb-2">
          <Text className={`${getStatusClasses(todo.status)} font-mono text-base mr-2 min-w-[16px]`}>
            {getStatusIcon(todo.status)}
          </Text>
          
          <View className="flex-1">
            <Text className={getTextClasses(todo.status)}>
              {todo.content}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
});