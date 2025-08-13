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
    onContentSizeChange,
    ...textInputProps
  } = props;
  const [isFocused, setIsFocused] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);

  // Base input classes - using only Tailwind
  const baseClasses = 'text-base text-foreground font-mono leading-normal flex-1';

  const variantClasses = {
    default: 'bg-transparent',
    bordered: `bg-background border ${isFocused ? 'border-white' : 'border-border'}`,
  };

  // Base sizing for minimum heights and padding
  const sizeConfig = {
    small: { minHeight: 36, paddingX: 'px-3', paddingY: 'py-2', radius: 'rounded' },
    medium: { minHeight: 44, paddingX: 'px-4', paddingY: 'py-2', radius: 'rounded-md' },
    large: { minHeight: 48, paddingX: 'px-5', paddingY: 'py-3', radius: 'rounded-lg' },
  };

  const currentSize = sizeConfig[size];

  // For multiline inputs, use dynamic height; for single-line, use fixed min-height
  const heightClass =
    textInputProps.multiline && height
      ? '' // Dynamic height will be handled by inline style
      : `min-h-[${currentSize.minHeight}px]`;

  const sizeClasses = `${heightClass} ${currentSize.paddingX} ${currentSize.paddingY} ${currentSize.radius}`;

  const containerClasses = cn(variantClasses[variant], sizeClasses, containerClassName);

  // Dynamic height style for multiline inputs
  const dynamicContainerStyle =
    textInputProps.multiline && height ? { height: Math.max(height, currentSize.minHeight) } : {};

  const inputClasses = cn(baseClasses, className);

  // Minimal inline styles - only for truly dynamic values that can't be Tailwind
  const dynamicStyle = {
    textAlignVertical: textInputProps.multiline
      ? textInputProps.textAlignVertical || 'top'
      : 'center',
    ...style,
  };

  const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleContentSizeChange = (e: Parameters<NonNullable<TextInputProps['onContentSizeChange']>>[0]) => {
    if (textInputProps.multiline) {
      setHeight(e.nativeEvent.contentSize.height);
    }
    onContentSizeChange?.(e);
  };

  return (
    <View className={containerClasses} style={dynamicContainerStyle}>
      <TextInput
        ref={ref}
        className={inputClasses}
        style={dynamicStyle}
        placeholderTextColor="#9da5b4"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onContentSizeChange={handleContentSizeChange}
        {...textInputProps}
      />
    </View>
  );
});
