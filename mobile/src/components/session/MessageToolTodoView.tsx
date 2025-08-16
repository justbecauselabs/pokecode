import type React from 'react';
import { Text, View } from 'react-native';
import { memo } from 'react';
import { darkTheme } from '../../constants/theme';

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

const getStatusColor = (status: TodoItem['status']): string => {
  switch (status) {
    case 'completed':
      return darkTheme.colors.success;
    case 'in_progress':
      return darkTheme.colors.primary;
    case 'pending':
      return darkTheme.colors.textTertiary;
    default:
      return darkTheme.colors.textTertiary;
  }
};

const getTextStyle = (status: TodoItem['status']) => {
  const baseStyle = {
    fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
    fontSize: 14,
    lineHeight: 20,
  };

  switch (status) {
    case 'completed':
      return {
        ...baseStyle,
        color: darkTheme.colors.textSecondary,
        textDecorationLine: 'line-through' as const,
      };
    case 'in_progress':
      return {
        ...baseStyle,
        color: darkTheme.colors.text,
        fontWeight: '600' as const,
      };
    case 'pending':
      return {
        ...baseStyle,
        color: darkTheme.colors.textSecondary,
      };
    default:
      return {
        ...baseStyle,
        color: darkTheme.colors.textSecondary,
      };
  }
};

export const MessageToolTodoView: React.FC<MessageToolTodoViewProps> = memo(({ todos }) => {
  if (!todos || todos.length === 0) {
    return (
      <View className="p-3">
        <Text style={{
          color: darkTheme.colors.textTertiary,
          fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          fontSize: 14,
          fontStyle: 'italic',
        }}>
          No todos
        </Text>
      </View>
    );
  }

  return (
    <View className="p-3">
      <Text style={{
        color: darkTheme.colors.text,
        fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        Tasks ({todos.filter(t => t.status === 'completed').length}/{todos.length})
      </Text>
      
      {todos.map((todo, index) => (
        <View key={index} className="flex-row items-start mb-2">
          <Text style={{
            color: getStatusColor(todo.status),
            fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
            fontSize: 16,
            lineHeight: 20,
            marginRight: 8,
            minWidth: 16,
          }}>
            {getStatusIcon(todo.status)}
          </Text>
          
          <View className="flex-1">
            <Text style={getTextStyle(todo.status)}>
              {todo.content}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
});