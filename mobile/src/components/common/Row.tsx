import { AntDesign, Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import type React from 'react';
import { Switch, Text, TouchableOpacity, type TouchableOpacityProps, View } from 'react-native';
import { cn } from '@/utils/cn';

type IconLibrary = 'MaterialIcons' | 'Ionicons' | 'Feather' | 'AntDesign';

type LeadingElement =
  | {
      type: 'icon';
      library: IconLibrary;
      name: string;
      size?: number;
      color?: string;
      className?: string;
    }
  | { type: 'text'; content: string; className?: string }
  | {
      type: 'avatar';
      initials: string;
      backgroundColor?: string;
      textColor?: string;
      size?: 'small' | 'medium' | 'large';
    }
  | {
      type: 'badge';
      count: number;
      backgroundColor?: string;
      textColor?: string;
      maxCount?: number;
    };

type TrailingElement =
  | { type: 'text'; content: string; className?: string }
  | { type: 'switch'; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }
  | {
      type: 'icon';
      library: IconLibrary;
      name: string;
      size?: number;
      color?: string;
      className?: string;
    }
  | {
      type: 'badge';
      count: number;
      backgroundColor?: string;
      textColor?: string;
      maxCount?: number;
    }
  | { type: 'progress'; value: number; max?: number; showPercentage?: boolean; className?: string }
  | { type: 'status'; variant: 'online' | 'offline' | 'away' | 'busy'; label?: string };

interface RowProps extends TouchableOpacityProps {
  title: string;
  titleClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
  leading?: LeadingElement;
  trailing?: TrailingElement;
  showCaret?: boolean;
  caretClassName?: string;
  className?: string;
  contentClassName?: string;
}

export const Row: React.FC<RowProps> = ({
  title,
  titleClassName,
  subtitle,
  subtitleClassName,
  leading,
  trailing,
  showCaret = false,
  caretClassName,
  className,
  contentClassName,
  ...props
}) => {
  const Component = props.onPress ? TouchableOpacity : View;

  const baseClasses = 'flex-row items-center py-3 px-4';
  const rowClasses = cn(baseClasses, className);

  const defaultTitleClasses = 'text-base font-medium text-foreground';
  const defaultSubtitleClasses = 'text-sm text-muted-foreground mt-1';
  const defaultCaretClasses = 'text-muted-foreground text-lg';

  const titleClasses = cn(defaultTitleClasses, titleClassName);
  const subtitleClasses = cn(defaultSubtitleClasses, subtitleClassName);
  const caretClasses = cn(defaultCaretClasses, caretClassName);

  const renderIcon = (params: {
    library: IconLibrary;
    name: string;
    size?: number;
    color?: string;
    className?: string;
  }) => {
    const { library, name, size = 20, color = '#666', className } = params;
    const iconProps = { name: name as any, size, color };

    const iconElement = (() => {
      switch (library) {
        case 'MaterialIcons':
          return <MaterialIcons {...iconProps} />;
        case 'Ionicons':
          return <Ionicons {...iconProps} />;
        case 'Feather':
          return <Feather {...iconProps} />;
        case 'AntDesign':
          return <AntDesign {...iconProps} />;
        default:
          return <MaterialIcons {...iconProps} />;
      }
    })();

    return className ? <View className={className}>{iconElement}</View> : iconElement;
  };

  const renderAvatar = (params: {
    initials: string;
    backgroundColor?: string;
    textColor?: string;
    size?: 'small' | 'medium' | 'large';
  }) => {
    const { initials, backgroundColor = '#528bff', textColor = 'white', size = 'medium' } = params;

    const sizeClasses = {
      small: 'w-6 h-6 text-xs',
      medium: 'w-8 h-8 text-sm',
      large: 'w-10 h-10 text-base',
    };

    return (
      <View
        className={cn('rounded-full flex items-center justify-center', sizeClasses[size])}
        style={{ backgroundColor }}
      >
        <Text className="font-semibold" style={{ color: textColor }}>
          {initials.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  };

  const renderBadge = (params: {
    count: number;
    backgroundColor?: string;
    textColor?: string;
    maxCount?: number;
  }) => {
    const { count, backgroundColor = '#ff4444', textColor = 'white', maxCount = 99 } = params;
    const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

    return (
      <View
        className="rounded-full px-1.5 py-0.5 min-w-[18px] items-center justify-center"
        style={{ backgroundColor }}
      >
        <Text className="text-xs font-medium" style={{ color: textColor }}>
          {displayCount}
        </Text>
      </View>
    );
  };

  const renderLeading = () => {
    if (!leading) return null;

    return (
      <View className="mr-3">
        {(() => {
          switch (leading.type) {
            case 'icon':
              return renderIcon(leading);
            case 'text':
              return (
                <Text className={cn('text-base text-foreground', leading.className)}>
                  {leading.content}
                </Text>
              );
            case 'avatar':
              return renderAvatar(leading);
            case 'badge':
              return renderBadge(leading);
            default:
              return null;
          }
        })()}
      </View>
    );
  };

  const renderProgress = (params: {
    value: number;
    max?: number;
    showPercentage?: boolean;
    className?: string;
  }) => {
    const { value, max = 100, showPercentage = true, className } = params;
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <View className={cn('items-end', className)}>
        {showPercentage && (
          <Text className="text-sm font-medium text-foreground mb-1">
            {Math.round(percentage)}%
          </Text>
        )}
        <View className="w-16 h-1 bg-muted rounded-full">
          <View className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
        </View>
      </View>
    );
  };

  const renderStatus = (params: {
    variant: 'online' | 'offline' | 'away' | 'busy';
    label?: string;
  }) => {
    const { variant, label } = params;

    const statusConfig = {
      online: { color: '#22c55e', label: label || 'Online' },
      offline: { color: '#94a3b8', label: label || 'Offline' },
      away: { color: '#f59e0b', label: label || 'Away' },
      busy: { color: '#ef4444', label: label || 'Busy' },
    };

    const config = statusConfig[variant];

    return (
      <View className="flex-row items-center">
        <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: config.color }} />
        <Text className="text-xs text-muted-foreground font-mono">{config.label}</Text>
      </View>
    );
  };

  const renderTrailing = () => {
    if (!trailing) return null;

    return (
      <View className="ml-3">
        {(() => {
          switch (trailing.type) {
            case 'text':
              return (
                <Text className={cn('text-base text-muted-foreground', trailing.className)}>
                  {trailing.content}
                </Text>
              );
            case 'switch':
              return (
                <Switch
                  value={trailing.value}
                  onValueChange={trailing.onValueChange}
                  disabled={trailing.disabled}
                />
              );
            case 'icon':
              return renderIcon(trailing);
            case 'badge':
              return renderBadge(trailing);
            case 'progress':
              return renderProgress(trailing);
            case 'status':
              return renderStatus(trailing);
            default:
              return null;
          }
        })()}
      </View>
    );
  };

  const renderCaret = () => {
    if (!showCaret) return null;

    return (
      <View className="ml-2">
        <Text className={caretClasses}>›</Text>
      </View>
    );
  };

  return (
    <Component className={rowClasses} activeOpacity={props.onPress ? 0.7 : 1} {...props}>
      {renderLeading()}

      <View className={cn('flex-1', contentClassName)}>
        <Text className={titleClasses}>{title}</Text>
        {subtitle && <Text className={subtitleClasses}>{subtitle}</Text>}
      </View>

      {renderTrailing()}
      {renderCaret()}
    </Component>
  );
};
