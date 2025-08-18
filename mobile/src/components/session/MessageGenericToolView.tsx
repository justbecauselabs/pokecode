import type React from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { memo } from 'react';
import { textStyles } from '../../utils/styleUtils';

interface MessageGenericToolViewProps {
  title: string;
  text: string;
  result?: {
    toolUseId: string;
    content: string;
    isError?: boolean;
  };
  onResultPress?: (result: { toolUseId: string; content: string; isError?: boolean }) => void;
}

export const MessageGenericToolView: React.FC<MessageGenericToolViewProps> = memo(({ 
  title, 
  text, 
  result, 
  onResultPress 
}) => {
  return (
    <View className="p-3">
      {/* Tool name and status row */}
      <View className="flex-row items-center mb-2">
        {/* Tool name in small box */}
        <View className="bg-gray-700 px-2 py-1 rounded">
          <Text className="text-xs font-mono text-gray-300 font-semibold">
            {title}
          </Text>
        </View>

        {/* Loading indicator or result text */}
        <View className="ml-3 flex-1">
          {!result ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#6b7280" className="mr-2" />
              <Text className="text-xs text-gray-500 font-mono">Running...</Text>
            </View>
          ) : (
            onResultPress && (
              <TouchableOpacity 
                onPress={() => onResultPress(result)} 
                activeOpacity={0.7}
              >
                <Text className="text-xs text-gray-500 font-mono">
                  Click to see result
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* Tool text/command in code block */}
      <View className="bg-gray-800 px-3 py-2 rounded mt-1">
        <Text className={`${textStyles.messageContentSm} text-gray-300 font-mono`}>
          {text}
        </Text>
      </View>
    </View>
  );
});