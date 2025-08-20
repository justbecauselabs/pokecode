import type { BottomSheetModal as BottomSheetModalType } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { AssistantMessageToolResult } from '@pokecode/api';
import { forwardRef, useMemo } from 'react';
import { Text, View } from 'react-native';
import { textStyles } from '../../utils/styleUtils';
import { CustomBottomSheet } from '../common';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ToolResultBottomSheetProps {
  result: AssistantMessageToolResult | null;
  onClose: () => void;
}

export const ToolResultBottomSheet = forwardRef<BottomSheetModalType, ToolResultBottomSheetProps>(
  ({ result, onClose }, ref) => {
    const snapPoints = useMemo(() => ['50%', '90%'], []);

    return (
      <CustomBottomSheet ref={ref} onClose={onClose} snapPoints={snapPoints}>
        <View className="flex-1 px-4 pt-2">
          <Text className={`${textStyles.messageContent} font-semibold mb-4`}>Tool Result</Text>

          {result ? (
            <BottomSheetScrollView
              contentContainerClassName="pb-5"
              showsVerticalScrollIndicator={false}
            >
              {result.isError ? (
                <View className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 mb-4">
                  <Text className={`${textStyles.error} font-semibold mb-2`}>Error</Text>
                  <Text className={textStyles.error}>{result.content}</Text>
                </View>
              ) : (
                <View className="flex-1">
                  <MarkdownRenderer content={result.content} />
                </View>
              )}
            </BottomSheetScrollView>
          ) : (
            <Text className={`${textStyles.messageContentSm} text-center mt-8`}>
              No result available
            </Text>
          )}
        </View>
      </CustomBottomSheet>
    );
  }
);

ToolResultBottomSheet.displayName = 'ToolResultBottomSheet';
