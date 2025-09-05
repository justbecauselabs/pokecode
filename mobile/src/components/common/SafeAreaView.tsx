import type React from 'react';
import { StatusBar, useColorScheme, type ViewStyle } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useUIStore } from '@/stores/uiStore';

interface CustomSafeAreaViewProps {
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  children?: React.ReactNode;
  style?: ViewStyle;
  className?: string;
}

export const SafeAreaView: React.FC<CustomSafeAreaViewProps> = ({
  children,
  edges,
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
        // Important: default to excluding the top edge because
        // the Stack header already accounts for top safe area.
        // Screens that need top insets (e.g., headerTransparent modals)
        // can pass `edges` explicitly.
        edges={edges ?? ['left', 'right', 'bottom']}
        {...props}
      >
        {children}
      </RNSafeAreaView>
    </>
  );
};
