import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { BottomSheetBackdrop, BottomSheetModal } from '@gorhom/bottom-sheet';
import type React from 'react';
import { forwardRef, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { backgroundColors } from '@/utils/styleUtils';

interface CustomBottomModalSheetProps {
  children: React.ReactNode;
  onClose?: () => void;
  onDismiss?: () => void;
  snapPoints?: string[];
  enablePanDownToClose?: boolean;
}

export const CustomBottomModalSheet = forwardRef<BottomSheetModal, CustomBottomModalSheetProps>(
  (
    { children, onClose, onDismiss, snapPoints, enablePanDownToClose = true },
    ref,
  ) => {
    const { height: windowHeight } = useWindowDimensions();
    const maxHeight = Math.floor(windowHeight * 0.9);
    const effectiveSnapPoints = useMemo(() => snapPoints, [snapPoints]);

    const dismissHandler = onDismiss || onClose;

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        onPress={dismissHandler}
      />
    );

    return (
      <BottomSheetModal
        ref={ref}
        {...(effectiveSnapPoints ? { snapPoints: effectiveSnapPoints } : {})}
        enableDynamicSizing
        maxDynamicContentSize={maxHeight}
        enablePanDownToClose={enablePanDownToClose}
        onDismiss={dismissHandler}
        backdropComponent={renderBackdrop}
        stackBehavior="replace"
        backgroundStyle={{
          backgroundColor: backgroundColors.background,
        }}
        handleIndicatorStyle={{
          backgroundColor: backgroundColors.foreground,
        }}
      >
        {children}
      </BottomSheetModal>
    );
  },
);

CustomBottomModalSheet.displayName = 'CustomBottomModalSheet';
