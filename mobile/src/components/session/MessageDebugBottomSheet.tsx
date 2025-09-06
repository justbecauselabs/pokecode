import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { forwardRef, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../types/messages';
import { CustomScrollableBottomSheet } from '../common';

interface MessageDebugBottomSheetProps {
  message: Message | null;
  isVisible: boolean;
  onClose: () => void;
}

export const MessageDebugBottomSheet = forwardRef<BottomSheetModal, MessageDebugBottomSheetProps>(
  ({ message, isVisible, onClose }, _ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    // Control bottom sheet visibility
    useEffect(() => {
      if (isVisible && message) {
        bottomSheetRef.current?.present();
      } else {
        bottomSheetRef.current?.dismiss();
      }
    }, [isVisible, message]);

    return (
      <CustomScrollableBottomSheet
        ref={bottomSheetRef}
        onClose={onClose}
        header={
          <View className="px-4 py-2">
            <Text className="text-lg font-semibold text-foreground mb-4 text-center">
              Message Debug Info
            </Text>
          </View>
        }
      >
        {message && (
          <View className="px-4">
            <View className="bg-muted rounded-lg p-3">
              <Text className="text-xs font-mono text-foreground leading-5">
                {JSON.stringify(message, null, 2)}
              </Text>
            </View>
          </View>
        )}
      </CustomScrollableBottomSheet>
    );
  },
);

MessageDebugBottomSheet.displayName = 'MessageDebugBottomSheet';
