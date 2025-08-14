import type React from 'react';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ToolCallCardProps {
  toolCalls: Array<{ name: string; input: any }>;
  timestamp: string;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCalls, timestamp }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const formatToolCall = (toolCall: { name: string; input: any }) => {
    // Format like ToolName(param: "value", param2: "value")
    const params = Object.entries(toolCall.input)
      .map(([key, value]) => {
        const valueStr = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
        return `${key}: ${valueStr}`;
      })
      .join(', ');
    
    return `${toolCall.name}(${params})`;
  };

  const formatCompactToolCall = (toolCall: { name: string; input: any }) => {
    // Create a compact version for the first line display
    const formatted = formatToolCall(toolCall);
    return formatted.length > 80 ? formatted.substring(0, 77) + '...' : formatted;
  };

  return (
    <View>
      {toolCalls.map((toolCall, index) => (
        <View key={`${toolCall.name}-${index}`} className="mb-1">
          <TouchableOpacity
            className="active:opacity-70"
            onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
            accessibilityRole="button"
            accessibilityLabel={`Toggle ${toolCall.name} tool details`}
          >
            <Text className="text-base font-mono text-foreground">
              {formatCompactToolCall(toolCall)}
            </Text>
          </TouchableOpacity>

          {/* Full tool call details (expandable) */}
          {expandedIndex === index && (
            <View className="mt-2 mb-2">
              <Text className="text-sm font-mono text-muted-foreground">
                {formatToolCall(toolCall)}
              </Text>
              <Text className="text-xs font-mono text-muted-foreground mt-1">
                {JSON.stringify(toolCall.input, null, 2)}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};