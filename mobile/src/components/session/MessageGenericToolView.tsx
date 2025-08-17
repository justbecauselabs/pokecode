import type React from 'react';
import { Text, View, Pressable } from 'react-native';
import { memo } from 'react';
import { darkTheme } from '../../constants/theme';

interface MessageGenericToolViewProps {
  title: string;
  text: string;
  result?: {
    tool_use_id: string;
    content: string;
    is_error?: boolean;
  };
  onResultPress?: (result: { tool_use_id: string; content: string; is_error?: boolean }) => void;
}

export const MessageGenericToolView: React.FC<MessageGenericToolViewProps> = memo(({ 
  title, 
  text, 
  result, 
  onResultPress 
}) => {
  return (
    <View className="p-3">
      <View className="flex-row items-center">
        <Text style={{
          color: darkTheme.colors.text,
          fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 4,
        }}>
          {title}
        </Text>
        
        {result && onResultPress && (
          <Pressable 
            onPress={() => onResultPress(result)}
            className="ml-2 flex-row items-center"
          >
            <Text style={{
              color: darkTheme.colors.primary,
              fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
              fontSize: 12,
              textDecorationLine: 'underline',
            }}>
              result
            </Text>
            <Text style={{
              color: darkTheme.colors.primary,
              fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
              fontSize: 12,
              marginLeft: 2,
            }}>
              ›
            </Text>
          </Pressable>
        )}
      </View>
      
      <Text style={{
        color: darkTheme.colors.textSecondary,
        fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
        fontSize: 14,
        lineHeight: 20,
      }}>
        {text}
      </Text>
    </View>
  );
});