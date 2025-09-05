import type { BottomSheetModal as BottomSheetModalType } from '@gorhom/bottom-sheet';
 
import type { AssistantMessageToolResult } from '@pokecode/api';
import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { textStyles } from '../../utils/styleUtils';
import { CustomScrollableBottomSheet } from '../common';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ToolResultBottomSheetProps {
  result: AssistantMessageToolResult | null;
  onClose: () => void;
}

export const ToolResultBottomSheet = forwardRef<BottomSheetModalType, ToolResultBottomSheetProps>(
  ({ result, onClose }, ref) => {

    return (
      <CustomScrollableBottomSheet
        ref={ref}
        onClose={onClose}
        header={
          <View className="px-4 pt-2">
            <Text className={`${textStyles.messageContent} font-semibold mb-4`}>Tool Result</Text>
          </View>
        }
      >
        {result ? (
          <View className="px-4">
            {result.isError ? (
              <View className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 mb-4">
                <Text className={`${textStyles.error} font-semibold mb-2`}>Error</Text>
                <Text className={textStyles.error}>{result.content}</Text>
              </View>
            ) : (
              <View>
                <MarkdownRenderer content={result.content} />
              </View>
            )}
          </View>
        ) : (
          <Text className={`${textStyles.messageContentSm} text-center mt-8`}>
            No result available
          </Text>
        )}
      </CustomScrollableBottomSheet>
    );
  },
);

ToolResultBottomSheet.displayName = 'ToolResultBottomSheet';
