import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from '@/components/common';

export default function TextFieldPlayground() {
  const [text, setText] = useState('');
  const maxHeight = 100; // Approximately 5 lines

  return (
    <SafeAreaView className="flex-1 bg-background">
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
    </SafeAreaView>
  );
}
