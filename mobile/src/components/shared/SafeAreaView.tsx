import React from 'react';
import {
  SafeAreaView as RNSafeAreaView,
  StyleSheet,
  StatusBar,
  Platform,
  ViewStyle,
} from 'react-native';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';

interface CustomSafeAreaViewProps {
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const SafeAreaView: React.FC<CustomSafeAreaViewProps> = ({
  children,
  style,
  edges = ['top', 'right', 'bottom', 'left'],
  ...props
}) => {
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <RNSafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background },
          style,
        ]}
        {...props}
      >
        {children}
      </RNSafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});