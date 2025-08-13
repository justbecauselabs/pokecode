import type React from 'react';
import { Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { cn } from '@/utils/cn';

interface PillProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: 'default' | 'active' | 'secondary';
  size?: 'small' | 'medium';
  className?: string;
}

export const Pill: React.FC<PillProps> = ({
  children,
  variant = 'default',
  size = 'medium',
  disabled,
  className,
  ...props
}) => {
  const baseClasses = 'rounded-full items-center justify-center active:opacity-70';

  const variantClasses = {
    default: 'bg-gray-500',
    active: 'bg-green-500',
    secondary: 'bg-gray-400',
  };

  const sizeClasses = {
    small: 'px-3 py-1',
    medium: 'px-4 py-2',
  };

  const pillClasses = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabled && 'opacity-60',
    className
  );

  return (
    <TouchableOpacity className={pillClasses} disabled={disabled} activeOpacity={0.7} {...props}>
      {typeof children === 'string' ? (
        <Text className="text-white text-sm font-medium">{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};
