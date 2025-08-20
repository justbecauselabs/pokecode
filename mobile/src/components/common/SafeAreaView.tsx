import type React from 'react';
import {
  SafeAreaView as RNSafeAreaView,
  StatusBar,
  useColorScheme,
  type ViewStyle,
} from 'react-native';
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

  // Using TailwindCSS design tokens
  const backgroundColor = '#282c34'; // bg-background

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundColor}
      />
      <RNSafeAreaView
        className={`flex-1 ${className || ''}`}
        style={[{ backgroundColor }, style]}
        {...props}
      >
        {children}
      </RNSafeAreaView>
    </>
  );
};
