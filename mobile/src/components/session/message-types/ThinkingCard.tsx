import type React from 'react';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface ThinkingCardProps {
  thinking: string;
  timestamp: string;
}

export const ThinkingCard: React.FC<ThinkingCardProps> = ({ thinking, timestamp }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className="mb-3">
      {/* Thinking header */}
      <TouchableOpacity
        className="flex-row items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-t-lg px-3 py-2 active:opacity-80"
        onPress={() => setIsExpanded(!isExpanded)}
        accessibilityRole="button"
        accessibilityLabel="Toggle thinking content"
      >
        <View className="flex-row items-center">
          <View className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
          <Text className="text-sm font-mono font-semibold text-yellow-600">
            Thinking
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-xs text-muted-foreground font-mono mr-2">
            {formatTime(timestamp)}
          </Text>
          <Text className="text-yellow-600 font-mono">
            {isExpanded ? '−' : '+'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Thinking content (expandable) */}
      {isExpanded && (
        <View className="bg-muted border-l border-r border-b border-yellow-500/20 rounded-b-lg p-3 max-h-96">
          <ScrollView
            className="bg-background border border-border rounded p-3"
            style={{ maxHeight: 300 }}
            showsVerticalScrollIndicator={true}
          >
            <MarkdownRenderer content={thinking} />
          </ScrollView>
        </View>
      )}
    </View>
  );
};