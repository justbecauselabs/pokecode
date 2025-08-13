import type React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, padding = 'medium', onPress }) => {
  const baseClasses = 'bg-card rounded-xl shadow-lg';

  const paddingClasses = {
    none: '',
    small: 'p-2',
    medium: 'p-4',
    large: 'p-6',
  };

  const cardClasses = cn(baseClasses, paddingClasses[padding], className);

  const cardContent = <View className={cardClasses}>{children}</View>;

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};
