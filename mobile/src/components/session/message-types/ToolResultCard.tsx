import type React from 'react';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface ToolResultCardProps {
  toolResults: Array<{ tool_use_id: string; content: string }>;
  timestamp: string;
}

export const ToolResultCard: React.FC<ToolResultCardProps> = ({ toolResults, timestamp }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className="mb-3">
      {toolResults.map((toolResult, index) => (
        <View key={`${toolResult.tool_use_id}-${index}`} className="mb-2">
          {/* Tool result header */}
          <TouchableOpacity
            className="flex-row items-center justify-between bg-green-500/10 border border-green-500/20 rounded-t-lg px-3 py-2 active:opacity-80"
            onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
            accessibilityRole="button"
            accessibilityLabel="Toggle tool result details"
          >
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              <Text className="text-sm font-mono font-semibold text-green-600">
                Tool Result
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-xs text-muted-foreground font-mono mr-2">
                {formatTime(timestamp)}
              </Text>
              <Text className="text-green-600 font-mono">
                {expandedIndex === index ? '−' : '+'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Tool result content (expandable) */}
          {expandedIndex === index && (
            <View className="bg-muted border-l border-r border-b border-green-500/20 rounded-b-lg p-3 max-h-96">
              <Text className="text-xs font-mono font-medium text-muted-foreground mb-2">
                Result:
              </Text>
              <ScrollView
                className="bg-background border border-border rounded p-2"
                style={{ maxHeight: 300 }}
                showsVerticalScrollIndicator={true}
              >
                <Text className="text-xs font-mono text-foreground">
                  {toolResult.content}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};