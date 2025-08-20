import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from '@/components/common';

export default function TextFieldPlayground() {
  const router = useRouter();
  const [text, setText] = useState('');
  const maxHeight = 100; // Approximately 5 lines

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground mb-1">TextField Playground</Text>
            <Text className="text-muted-foreground">Simple multiline text input</Text>
          </View>
          <Pressable onPress={() => router.back()} className="ml-4 p-2 rounded-lg bg-muted">
            <Text className="text-muted-foreground text-sm font-medium font-mono">Back</Text>
          </Pressable>
        </View>

        <View className="flex-1 p-4">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type something here..."
            multiline
            className="p-4 border border-white rounded-lg text-foreground min-h-[40px]"
            placeholderTextColor="#666"
            style={{ maxHeight: maxHeight }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
