import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const platformSelect = <T>(options: { ios?: T; android?: T; default?: T }): T | undefined => {
  return Platform.select({
    ios: options.ios,
    android: options.android,
    default: options.default,
  });
};

export const getKeyboardAvoidingViewBehavior = () => {
  return isIOS ? 'padding' : 'height';
};

export const getStatusBarHeight = () => {
  return isIOS ? 20 : 0;
};

export const hapticFeedback = {
  light: () => {
    if (isIOS) {
      // iOS haptic feedback implementation
      // Would require expo-haptics
    }
  },
  medium: () => {
    if (isIOS) {
      // iOS haptic feedback implementation
    }
  },
  heavy: () => {
    if (isIOS) {
      // iOS haptic feedback implementation
    }
  },
};