import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';

interface LoadingStateProps {
  size?: 'small' | 'large';
  text?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  size = 'large',
  text,
  fullScreen = false,
  style,
}) => {
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { backgroundColor: fullScreen ? theme.colors.background : 'transparent' },
        style,
      ]}
    >
      <ActivityIndicator
        size={size}
        color={theme.colors.primary}
      />
      {text && (
        <Text
          style={[
            styles.text,
            { color: theme.colors.textSecondary },
            theme.typography.body,
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
  },
  text: {
    marginTop: 12,
    textAlign: 'center',
  },
});