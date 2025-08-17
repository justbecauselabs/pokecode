import type React from 'react';
import { memo, forwardRef } from 'react';
import { View, Text } from 'react-native';
import BottomSheet, { type BottomSheetModal } from '@gorhom/bottom-sheet';
import { MarkdownRenderer } from './MarkdownRenderer';
import { darkTheme } from '../../constants/theme';
import type { AssistantMessageToolResult } from '../../schemas/message.schema';

interface ToolResultBottomSheetProps {
  result: AssistantMessageToolResult | null;
}

export const ToolResultBottomSheet = memo(forwardRef<BottomSheetModal, ToolResultBottomSheetProps>(
  ({ result }, ref) => {
    const snapPoints = ['50%', '90%'];

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: darkTheme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: darkTheme.colors.textSecondary }}
      >
        <View className="flex-1 px-4 pt-2">
          <Text style={{
            color: darkTheme.colors.text,
            fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 16,
          }}>
            Tool Result
          </Text>
          
          {result ? (
            <View className="flex-1">
              {result.is_error ? (
                <View className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 mb-4">
                  <Text style={{
                    color: darkTheme.colors.error,
                    fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
                    fontSize: 14,
                    fontWeight: '600',
                    marginBottom: 8,
                  }}>
                    Error
                  </Text>
                  <Text style={{
                    color: darkTheme.colors.error,
                    fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
                    fontSize: 14,
                    lineHeight: 20,
                  }}>
                    {result.content}
                  </Text>
                </View>
              ) : (
                <View className="flex-1">
                  <MarkdownRenderer content={result.content} />
                </View>
              )}
            </View>
          ) : (
            <Text style={{
              color: darkTheme.colors.textSecondary,
              fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
              fontSize: 14,
              textAlign: 'center',
              marginTop: 32,
            }}>
              No result available
            </Text>
          )}
        </View>
      </BottomSheet>
    );
  }
));

ToolResultBottomSheet.displayName = 'ToolResultBottomSheet';