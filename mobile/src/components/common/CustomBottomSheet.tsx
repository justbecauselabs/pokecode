import { BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type React from 'react';
import { forwardRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomBottomModalSheet } from './CustomBottomModalSheet';

interface CustomBottomSheetProps {
  children: React.ReactNode;
  onClose?: () => void;
  onDismiss?: () => void;
  snapPoints?: string[];
  enablePanDownToClose?: boolean;
  paddingTop?: number;
}

export const CustomBottomSheet = forwardRef<BottomSheetModal, CustomBottomSheetProps>(
  (props, ref) => {
    const { children, paddingTop = 12, ...modalProps } = props;
    const insets = useSafeAreaInsets();

    return (
      <CustomBottomModalSheet ref={ref} {...modalProps}>
        <BottomSheetView style={{ paddingTop, paddingBottom: 12 + insets.bottom }}>
          {children}
        </BottomSheetView>
      </CustomBottomModalSheet>
    );
  },
);

CustomBottomSheet.displayName = 'CustomBottomSheet';
