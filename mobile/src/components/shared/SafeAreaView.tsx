import type React from 'react';
import {
  SafeAreaView as RNSafeAreaView,
  StatusBar,
  StyleSheet,
  useColorScheme,
  type ViewStyle,
} from 'react-native';
import { darkTheme, lightTheme } from '@/constants/theme';
import { useUIStore } from '@/stores/uiStore';

interface CustomSafeAreaViewProps {
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  children?: React.ReactNode;
  style?: ViewStyle;
  className?: string;
}

export const SafeAreaView: React.FC<CustomSafeAreaViewProps> = ({
  children,
  style,
  className,
  ...props
}) => {
  const colorScheme = useColorScheme();
  const { theme } = useUIStore();
  const isDark = theme === 'dark' || (theme === 'system' && colorScheme === 'dark');
  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={currentTheme.colors.background}
      />
      <RNSafeAreaView
        className={className}
        style={[styles.container, { backgroundColor: currentTheme.colors.background }, style]}
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
