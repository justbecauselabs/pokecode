import type React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import { cn } from '@/utils/cn';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'small' | 'medium' | 'large';
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

  const variantClasses = {
    primary: 'bg-primary border border-primary',
    secondary: 'bg-transparent border border-primary',
    ghost: 'bg-transparent border border-transparent',
    destructive: 'bg-destructive border border-destructive',
  };

  const sizeClasses = {
    small: 'px-2 py-1 min-h-[32px]',
    medium: 'px-4 py-2 min-h-[44px]',
    large: 'px-6 py-4 min-h-[56px]',
  };

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
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    disabled && 'opacity-60',
    className
  );

  const textClasses = cn(
    'font-semibold text-center',
    textVariantClasses[variant],
    textSizeClasses[size],
    icon && 'ml-2'
  );

  const getIndicatorColor = () => {
    switch (variant) {
      case 'secondary':
      case 'ghost':
        return '#528bff'; // primary color
      case 'destructive':
        return '#abb2bf'; // destructive-foreground
      default:
        return '#282c34'; // primary-foreground
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
