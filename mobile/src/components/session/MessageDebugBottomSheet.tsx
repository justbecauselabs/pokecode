import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../types/messages';

interface MessageDebugBottomSheetProps {
  message: Message | null;
  isVisible: boolean;
  onClose: () => void;
}

export const MessageDebugBottomSheet = forwardRef<BottomSheetModal, MessageDebugBottomSheetProps>(
  ({ message, isVisible, onClose }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    
    // Bottom sheet snap points
    const snapPoints = useMemo(() => ['50%', '70%', '90%'], []);

    // Render backdrop
    const renderBackdrop = (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        onPress={onClose}
      />
    );

    const handleSheetChanges = (index: number) => {
      if (index === -1) {
        onClose();
      }
    };

    // Control bottom sheet visibility
    useEffect(() => {
      if (isVisible && message) {
        bottomSheetRef.current?.present();
      } else {
        bottomSheetRef.current?.dismiss();
      }
    }, [isVisible, message]);

    return (
      <BottomSheetModal
        ref={ref || bottomSheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backgroundStyle={{ backgroundColor: '#282c34' }}
      handleIndicatorStyle={{ backgroundColor: '#61dafb' }}
      enablePanDownToClose={true}
      enableDismissOnClose={true}
      backdropComponent={renderBackdrop}
    >
      <View className="flex-1 px-4 py-2">
        <Text className="text-lg font-semibold text-foreground mb-4 text-center">
          Message Debug Info
        </Text>

        {message && (
          <BottomSheetScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="bg-muted rounded-lg p-3">
              <Text className="text-xs font-mono text-foreground leading-5">
                {JSON.stringify(message, null, 2)}
              </Text>
            </View>
          </BottomSheetScrollView>
        )}
      </View>
    </BottomSheetModal>
  );
});

MessageDebugBottomSheet.displayName = 'MessageDebugBottomSheet';
