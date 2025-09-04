import type React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import { cn, cnSafe } from '@/utils/cn';
import {
  type ButtonSize,
  type ButtonVariant,
  buttonSizes,
  buttonVariants,
  indicatorColors,
} from '@/utils/styleUtils';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className,
  ...props
}) => {
  const baseClasses = 'flex-row items-center justify-center rounded-lg active:opacity-80';

  const textVariantClasses = {
    primary: 'text-primary-foreground',
    secondary: 'text-primary',
    ghost: 'text-primary',
    destructive: 'text-destructive-foreground',
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  const buttonClasses = cn(
    baseClasses,
    cnSafe(buttonVariants, variant),
    cnSafe(buttonSizes, size),
    fullWidth && 'w-full',
    disabled && 'opacity-60',
    className,
  );

  const textClasses = cn(
    'font-semibold text-center',
    textVariantClasses[variant],
    textSizeClasses[size],
    icon && 'ml-2',
  );

  // Use design tokens for ActivityIndicator colors
  const getIndicatorColor = () => {
    switch (variant) {
      case 'secondary':
      case 'ghost':
        return indicatorColors.primary;
      case 'destructive':
        return indicatorColors.destructive;
      default:
        return indicatorColors.primaryForeground;
    }
  };

  return (
    <TouchableOpacity
      className={buttonClasses}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getIndicatorColor()} size="small" />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text className={textClasses}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
