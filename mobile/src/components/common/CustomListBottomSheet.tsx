import { FlashList } from '@shopify/flash-list';
import type React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomBottomModalSheet } from './CustomBottomModalSheet';

interface ListRenderParams<T extends object> {
  item: T;
  index: number;
}

interface CustomListBottomSheetProps<T extends object> {
  data: readonly T[];
  renderItem: (params: ListRenderParams<T>) => React.ReactElement;
  keyExtractor: (item: T, index: number) => string;
  header?: React.ReactElement | null;
  footer?: React.ReactElement | null;
  onClose?: () => void;
  onDismiss?: () => void;
  snapPoints?: string[];
  enablePanDownToClose?: boolean;
  paddingTop?: number;
}

export function CustomListBottomSheet<T extends object>(
  props: CustomListBottomSheetProps<T>,
): React.ReactElement {
  const { data, renderItem, keyExtractor, header, footer, paddingTop = 12, ...modalProps } = props;
  const insets = useSafeAreaInsets();

  return (
    <CustomBottomModalSheet {...modalProps}>
      {header}
      <FlashList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingTop, paddingBottom: 12 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      />
      {footer}
    </CustomBottomModalSheet>
  );
}
