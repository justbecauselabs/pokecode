import type React from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';
import { cn, cnSafe } from '@/utils/cn';
import { type InputVariant, inputVariants } from '@/utils/styleUtils';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  variant?: InputVariant;
  className?: string;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  variant = 'default',
  className,
  containerClassName,
  ...props
}) => {
  const containerClasses = cn('mb-4', containerClassName);

  const inputClasses = cn(cnSafe(inputVariants, error ? 'error' : variant), className);

  return (
    <View className={containerClasses}>
      {label && <Text className="text-sm font-semibold mb-1.5 text-foreground">{label}</Text>}
      <TextInput
        className={inputClasses}
        placeholderTextColor="#9da5b4" // Using design token equivalent of text-muted-foreground
        {...props}
      />
      {error && <Text className="text-xs mt-1 text-destructive">{error}</Text>}
    </View>
  );
};
