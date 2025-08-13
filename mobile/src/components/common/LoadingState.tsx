import type React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'large',
  className,
}) => {
  return (
    <View className={`flex-1 justify-center items-center p-5 ${className || ''}`}>
      <ActivityIndicator size={size} color="#528bff" />
      {message && (
        <Text className="mt-3 text-base text-center text-muted-foreground font-mono">
          {message}
        </Text>
      )}
    </View>
  );
};
