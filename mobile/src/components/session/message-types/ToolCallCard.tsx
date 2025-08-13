import type React from 'react';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ToolCallCardProps {
  toolCalls: Array<{ name: string; input: any }>;
  timestamp: string;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCalls, timestamp }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className="mb-3">
      {toolCalls.map((toolCall, index) => (
        <View key={`${toolCall.name}-${index}`} className="mb-2">
          {/* Tool header */}
          <TouchableOpacity
            className="flex-row items-center justify-between bg-accent/10 border border-accent/20 rounded-t-lg px-3 py-2 active:opacity-80"
            onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
            accessibilityRole="button"
            accessibilityLabel={`Toggle ${toolCall.name} tool details`}
          >
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-accent rounded-full mr-2" />
              <Text className="text-sm font-mono font-semibold text-accent">
                {toolCall.name}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-xs text-muted-foreground font-mono mr-2">
                {formatTime(timestamp)}
              </Text>
              <Text className="text-accent font-mono">
                {expandedIndex === index ? '−' : '+'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Tool input (expandable) */}
          {expandedIndex === index && (
            <View className="bg-muted border-l border-r border-b border-accent/20 rounded-b-lg p-3">
              <Text className="text-xs font-mono font-medium text-muted-foreground mb-2">
                Input:
              </Text>
              <View className="bg-background border border-border rounded p-2">
                <Text className="text-xs font-mono text-foreground">
                  {JSON.stringify(toolCall.input, null, 2)}
                </Text>
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};