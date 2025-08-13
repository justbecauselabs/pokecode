import type React from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';
import { cn } from '@/utils/cn';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className,
  containerClassName,
  ...props
}) => {
  const containerClasses = cn('mb-4', containerClassName);

  const inputClasses = cn(
    'border rounded-lg px-3 py-2.5 text-base bg-input text-foreground',
    error ? 'border-destructive' : 'border-border',
    'focus:border-ring focus:ring-2 focus:ring-ring focus:ring-opacity-20',
    className
  );

  return (
    <View className={containerClasses}>
      {label && <Text className="text-sm font-semibold mb-1.5 text-foreground">{label}</Text>}
      <TextInput
        className={inputClasses}
        placeholderTextColor="#9da5b4" // muted-foreground color
        {...props}
      />
      {error && <Text className="text-xs mt-1 text-destructive">{error}</Text>}
    </View>
  );
};
