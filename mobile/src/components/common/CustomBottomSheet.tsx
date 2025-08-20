import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { BottomSheetBackdrop, BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, type ReactNode, useMemo } from 'react';
import { backgroundColors } from '@/utils/styleUtils';

interface CustomBottomSheetProps {
  children: ReactNode;
  onClose: () => void;
  snapPoints?: string[];
}

export const CustomBottomSheet = forwardRef<BottomSheetModal, CustomBottomSheetProps>(
  ({ children, onClose, snapPoints: customSnapPoints }, ref) => {
    // Bottom sheet snap points
    const snapPoints = useMemo(() => customSnapPoints || ['50%', '90%'], [customSnapPoints]);

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

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={onClose}
        backdropComponent={renderBackdrop}
        stackBehavior="replace"
        backgroundStyle={{
          backgroundColor: backgroundColors.background, // Using design token equivalent of bg-background
        }}
        handleIndicatorStyle={{
          backgroundColor: backgroundColors.foreground, // Using design token equivalent of text-foreground
        }}
      >
        {children}
      </BottomSheetModal>
    );
  }
);

CustomBottomSheet.displayName = 'CustomBottomSheet';
