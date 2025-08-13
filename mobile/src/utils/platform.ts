import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

type PlatformSelectOptions<T> = {
  ios?: T;
  android?: T;
  default?: T;
  native?: T;
  web?: T;
  windows?: T;
  macos?: T;
};

export const platformSelect = <T>(params: { options: PlatformSelectOptions<T> }): T | undefined => {
  return Platform.select(params.options);
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
