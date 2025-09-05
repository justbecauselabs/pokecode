import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { CustomBottomSheet } from '@/components/common';
import { Row } from '@/components/common/Row';

interface FileExplorerFilterBottomSheetProps {
  showHidden: boolean;
  onToggleShowHidden: (value: boolean) => void;
  onClose?: () => void;
}

export const FileExplorerFilterBottomSheet = forwardRef<
  BottomSheetModal,
  FileExplorerFilterBottomSheetProps
>(({ showHidden, onToggleShowHidden, onClose }, ref) => {
  return (
    <CustomBottomSheet ref={ref} onClose={onClose} snapPoints={["30%"]}>
      <View className="px-4">
        <View className="py-3 border-b border-border mb-2">
          <Text className="text-lg font-semibold text-center text-foreground font-mono">
            Filters
          </Text>
          <Text className="text-sm text-center text-muted-foreground mt-1 font-mono">
            Adjust what directories are shown
          </Text>
        </View>

        <Row
          title="Show hidden items"
          className="border-b border-border"
          leading={{ type: 'icon', library: 'Feather', name: 'eye-off', color: '#666' }}
          trailing={{ type: 'switch', value: showHidden, onValueChange: onToggleShowHidden }}
        />
      </View>
    </CustomBottomSheet>
  );
});

FileExplorerFilterBottomSheet.displayName = 'FileExplorerFilterBottomSheet';

