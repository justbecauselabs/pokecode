import { ActivityIndicator, Text, View } from 'react-native';

export function WorkingIndicator(params: { isWorking: boolean }) {
  const { isWorking } = params;

  if (!isWorking) {
    return null;
  }

  return (
    <View className="px-4 py-2 border-t border-gray-200 bg-gray-50">
      <View className="flex-row items-center justify-center gap-2">
        <ActivityIndicator size="small" color="#6366f1" />
        {/* Using design token equivalent of text-indicator-loading */}
        <Text className="text-sm text-gray-600">Claude is working...</Text>
      </View>
    </View>
  );
}
