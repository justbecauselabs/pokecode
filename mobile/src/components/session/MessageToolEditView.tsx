import type { AssistantMessageToolResult } from '@pokecode/api';
import type React from 'react';
import { memo, useMemo } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { InlineDiffBlock } from '../diff/InlineDiffBlock';

interface MessageToolEditViewProps {
  title: 'edit' | 'multiedit';
  filePath: string;
  oldNewPairs: ReadonlyArray<{ oldString: string; newString: string }>;
  toolResult?: AssistantMessageToolResult;
  onResultPress?: (result: AssistantMessageToolResult) => void;
}

function prefixLines(text: string, prefix: string): string {
  if (text.length === 0) return '';
  const lines = text.split('\n');
  return lines.map((l) => `${prefix}${l}`).join('\n');
}

export const MessageToolEditView: React.FC<MessageToolEditViewProps> = memo(
  ({ title, filePath, oldNewPairs, toolResult, onResultPress }) => {
    const diffText = useMemo(() => {
      // Build minimal patch body (no file headers, no hunk headers)
      const blocks: string[] = [];
      for (const pair of oldNewPairs) {
        const del = prefixLines(pair.oldString, '-');
        const add = prefixLines(pair.newString, '+');
        const body = [del, add].filter((s) => s.length > 0).join('\n');
        blocks.push(body);
      }
      return blocks.join('\n');
    }, [filePath, oldNewPairs]);

    return (
      <View className="p-3">
        {/* Header row with tool name and result link */}
        <View className="flex-row items-center mb-2">
          <View className="bg-gray-700 px-2 py-1 rounded">
            <Text className="text-xs font-mono text-gray-300 font-semibold">{title}</Text>
          </View>
          <View className="ml-3 flex-1">
            {toolResult ? (
              onResultPress ? (
                <TouchableOpacity onPress={() => onResultPress(toolResult)} activeOpacity={0.7}>
                  <Text className="text-xs text-gray-500 font-mono">Click to see result</Text>
                </TouchableOpacity>
              ) : null
            ) : (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#6b7280" className="mr-2" />
                <Text className="text-xs text-gray-500 font-mono">Running...</Text>
              </View>
            )}
          </View>
        </View>

        {/* File path */}
        <Text className="text-xs font-mono text-gray-400 mb-2">{filePath}</Text>

        {/* Inline diff */}
        <InlineDiffBlock diffText={diffText} />
      </View>
    );
  },
);
