import { forwardRef, useState } from 'react';
import { TextInput, type TextInputProps, View, type StyleProp, type TextStyle } from 'react-native';
import { cn } from '@/utils/cn';

interface TextFieldProps extends TextInputProps {
  variant?: 'default' | 'bordered';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  containerClassName?: string;
  // Auto-grow configuration (multiline only)
  minLines?: number; // default 1
  maxLines?: number; // default 6
  lineHeight?: number; // default 20 (match text style)
  autoGrow?: boolean; // default true for multiline
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
    // auto-grow options
    minLines = 1,
    maxLines = 6,
    lineHeight = 20,
    autoGrow = true,
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
  
  // Multiline auto-grow state
  const minContentHeight = Math.max(lineHeight, minLines * lineHeight);
  const maxContentHeight = Math.max(minContentHeight, maxLines * lineHeight);
  const [contentHeight, setContentHeight] = useState<number>(minContentHeight);
  const scrollEnabled = multiline && autoGrow && contentHeight >= maxContentHeight;

  // Container handles spacing and border. For multiline+autogrow, let height be intrinsic.
  const containerStyle = (
    multiline && autoGrow
      ? {
          paddingHorizontal: 16,
          paddingVertical: 12,
        }
      : {
          height: currentSize.minHeight,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 12 : (currentSize.minHeight - 24) / 2,
        }
  );

  // TextInput: zero padding for multiline to avoid double padding/caret jumps
  const inputStyle: StyleProp<TextStyle> = (
    multiline && autoGrow
      ? [{ height: contentHeight, padding: 0, lineHeight, textAlignVertical: 'top' }, style]
      : [{ textAlignVertical: multiline ? 'top' : 'center' }, style]
  );

  return (
    <View className={containerClasses} style={containerStyle}>
      <TextInput
        ref={ref}
        {...textInputProps}
        multiline={multiline}
        onContentSizeChange={
          multiline && autoGrow
            ? (e) => {
                const h = Math.round(e.nativeEvent.contentSize.height);
                const next = Math.max(minContentHeight, Math.min(h, maxContentHeight));
                if (next !== contentHeight) setContentHeight(next);
              }
            : undefined
        }
        scrollEnabled={scrollEnabled}
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
