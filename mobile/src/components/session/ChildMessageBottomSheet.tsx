import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { Text, View } from 'react-native';
import type { ChildMessage } from '../../types/messages';
import { ChildMessageItem } from './ChildMessageItem';

interface ChildMessageBottomSheetProps {
  messages: ChildMessage[];
  onClose: () => void;
}

export const ChildMessageBottomSheet = forwardRef<BottomSheetModal, ChildMessageBottomSheetProps>(
  ({ messages, onClose }, ref) => {
    // Bottom sheet snap points
    const snapPoints = useMemo(() => ['50%', '90%'], []);

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

    // Reverse messages so newest appears at bottom (like MessageList)
    const reversedMessages = useMemo(() => {
      return [...messages].reverse();
    }, [messages]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: '#282c34', // One Dark Pro background
        }}
        handleIndicatorStyle={{
          backgroundColor: '#abb2bf', // One Dark Pro foreground
        }}
      >
        <View className="flex-1 px-4">
          {/* Header */}
          <View className="py-3 border-b border-border mb-3">
            <Text className="text-lg font-semibold text-center text-foreground font-mono">
              Messages ({messages.length})
            </Text>
            <Text className="text-sm text-center text-muted-foreground mt-1 font-mono">
              Child messages for this conversation
            </Text>
          </View>

          {/* Messages list */}
          <BottomSheetScrollView
            contentContainerStyle={{
              paddingBottom: 20,
            }}
            showsVerticalScrollIndicator={false}
          >
            {reversedMessages.length > 0 ? (
              reversedMessages.map((message) => (
                <ChildMessageItem key={message.id} message={message} />
              ))
            ) : (
              <View className="justify-center items-center py-8">
                <Text className="text-center text-muted-foreground font-mono">No child messages found</Text>
              </View>
            )}
          </BottomSheetScrollView>
        </View>
      </BottomSheetModal>
    );
  }
);
