import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type React from 'react';
import { forwardRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomBottomModalSheet } from './CustomBottomModalSheet';

interface CustomScrollableBottomSheetProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  onDismiss?: () => void;
  snapPoints?: string[];
  enablePanDownToClose?: boolean;
  paddingTop?: number;
}

export const CustomScrollableBottomSheet = forwardRef<
  BottomSheetModal,
  CustomScrollableBottomSheetProps
>((props, ref) => {
  const { children, header, footer, paddingTop = 12, ...modalProps } = props;
  const insets = useSafeAreaInsets();

  return (
    <CustomBottomModalSheet ref={ref} {...modalProps}>
      {header}
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop, paddingBottom: 12 + insets.bottom }}
      >
        {children}
        {footer}
      </BottomSheetScrollView>
    </CustomBottomModalSheet>
  );
});

CustomScrollableBottomSheet.displayName = 'CustomScrollableBottomSheet';
