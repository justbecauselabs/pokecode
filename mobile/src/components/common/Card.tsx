import type React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { cn, cnSafe } from '@/utils/cn';
import { cardVariants, cardPadding, type CardVariant, type CardPadding } from '@/utils/styleUtils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  padding?: CardPadding;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className, 
  variant = 'default',
  padding = 'medium', 
  onPress 
}) => {
  const cardClasses = cn(
    cnSafe(cardVariants, variant),
    cnSafe(cardPadding, padding),
    className
  );

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
