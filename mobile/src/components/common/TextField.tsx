import { forwardRef, useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';
import { cn } from '@/utils/cn';

interface TextFieldProps extends TextInputProps {
  variant?: 'default' | 'bordered';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  containerClassName?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>((props, ref) => {
  const {
    variant = 'bordered',
    size = 'medium',
    className,
    containerClassName,
    style,
    onFocus,
    onBlur,
    multiline = false,
    ...textInputProps
  } = props;

  // Visual-only configuration
  const sizeConfig = {
    small: { minHeight: 40 },
    medium: { minHeight: 48 },
    large: { minHeight: 56 },
  } as const;
  const currentSize = sizeConfig[size];

  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  // Base classes
  const containerBaseClasses = 'border rounded-md';
  const variantClasses = {
    default: 'bg-transparent border-transparent',
    bordered: isFocused ? 'border-white bg-background' : 'border-border bg-background',
  };

  const containerClasses = cn(containerBaseClasses, variantClasses[variant], containerClassName);

  const inputClasses = cn('text-base text-foreground font-mono leading-normal', className);

  const containerStyle = {
    height: currentSize.minHeight,
    paddingHorizontal: 16,
    paddingVertical: multiline ? 12 : (currentSize.minHeight - 24) / 2,
  } as const;

  const inputStyle = {
    height: '100%',
    textAlignVertical: multiline ? 'top' : 'center',
    ...style,
  } as const;

  return (
    <View className={containerClasses} style={containerStyle}>
      <TextInput
        ref={ref}
        {...textInputProps}
        multiline={multiline}
        scrollEnabled={multiline}
        style={inputStyle}
        className={inputClasses}
        placeholderTextColor="#9da5b4"
        onFocus={handleFocus}
        onBlur={handleBlur}
        blurOnSubmit={!multiline}
      />
    </View>
  );
});
