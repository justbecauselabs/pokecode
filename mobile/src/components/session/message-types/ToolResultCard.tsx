import type React from 'react';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface ToolResultCardProps {
  toolResults: Array<{ tool_use_id: string; content: string }>;
  timestamp: string;
}

export const ToolResultCard: React.FC<ToolResultCardProps> = ({ toolResults, timestamp }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const formatResultSummary = (content: string) => {
    // Create natural language summaries like in the screenshot
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Try to detect the type of content and create appropriate summaries
    if (content.includes('- /') || content.includes('├──') || content.includes('└──')) {
      // File listing
      const fileCount = lines.filter(
        (line) => line.trim() && !line.includes('├──') && !line.includes('└──')
      ).length;
      return `Listed ${fileCount} paths (tap to expand)`;
    } else if (content.includes('.tsx') || content.includes('.ts') || content.includes('.js')) {
      // File search results
      const fileMatches = content.match(/\.tsx?|\.jsx?|\.ts|\.js/g);
      const count = fileMatches ? fileMatches.length : totalLines;
      return `Found ${count} files (tap to expand)`;
    } else if (totalLines > 3) {
      // Generic multi-line content
      return `${totalLines} lines of output (tap to expand)`;
    } else {
      // Short content, show first line with ellipsis if needed
      const firstLine = lines[0] || '';
      return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
    }
  };

  return (
    <View>
      {toolResults.map((toolResult, index) => (
        <View key={`${toolResult.tool_use_id}-${index}`} className="mb-1">
          <TouchableOpacity
            className="active:opacity-70"
            onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
            accessibilityRole="button"
            accessibilityLabel="Toggle tool result details"
          >
            <Text className="text-base font-mono text-foreground">
              {formatResultSummary(toolResult.content)}
            </Text>
          </TouchableOpacity>

          {/* Full result content (expandable) */}
          {expandedIndex === index && (
            <ScrollView className="mt-2 mb-2 max-h-80" showsVerticalScrollIndicator={true}>
              <Text className="text-sm font-mono text-muted-foreground">{toolResult.content}</Text>
            </ScrollView>
          )}
        </View>
      ))}
    </View>
  );
};
