import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common';

/**
 * Typography and fonts playground screen
 */
export default function FontsPlaygroundScreen() {
  const router = useRouter();

  const fontSizes = [
    { name: 'text-xs', size: '12px', className: 'text-xs' },
    { name: 'text-sm', size: '14px', className: 'text-sm' },
    { name: 'text-base', size: '16px', className: 'text-base' },
    { name: 'text-lg', size: '18px', className: 'text-lg' },
    { name: 'text-xl', size: '20px', className: 'text-xl' },
    { name: 'text-2xl', size: '24px', className: 'text-2xl' },
    { name: 'text-3xl', size: '30px', className: 'text-3xl' },
    { name: 'text-4xl', size: '36px', className: 'text-4xl' },
  ];

  const fontWeights = [
    { name: 'font-normal', className: 'font-normal' },
    { name: 'font-medium', className: 'font-medium' },
    { name: 'font-semibold', className: 'font-semibold' },
    { name: 'font-bold', className: 'font-bold' },
  ];

  const colorVariations = [
    { name: 'text-foreground', className: 'text-foreground' },
    { name: 'text-muted-foreground', className: 'text-muted-foreground' },
    { name: 'text-primary', className: 'text-primary' },
    { name: 'text-destructive', className: 'text-destructive' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground mb-1">Typography Playground</Text>
            <Text className="text-muted-foreground">Explore fonts, sizes, and styles</Text>
          </View>
          <Pressable onPress={() => router.back()} className="ml-4 p-2 rounded-lg bg-muted">
            <Text className="text-muted-foreground text-sm font-medium font-mono">Back</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Font Sizes Section */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Font Sizes
            </Text>
            <View className="space-y-3">
              {fontSizes.map((font) => (
                <View key={font.name} className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground font-mono flex-1">
                    {font.name} ({font.size})
                  </Text>
                  <Text className={`${font.className} text-foreground flex-2`}>
                    The quick brown fox jumps
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Font Weights Section */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Font Weights
            </Text>
            <View className="space-y-3">
              {fontWeights.map((weight) => (
                <View key={weight.name} className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground font-mono flex-1">
                    {weight.name}
                  </Text>
                  <Text className={`text-base ${weight.className} text-foreground flex-2`}>
                    The quick brown fox jumps over the lazy dog
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Color Variations Section */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Text Colors
            </Text>
            <View className="space-y-3">
              {colorVariations.map((color) => (
                <View key={color.name} className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground font-mono flex-1">
                    {color.name}
                  </Text>
                  <Text className={`text-base font-medium ${color.className} flex-2`}>
                    Sample text in this color
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Mono Font Section */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Monospace Font (font-mono)
            </Text>
            <View className="space-y-3">
              <Text className="text-base font-mono text-foreground">
                Regular monospace text - great for code
              </Text>
              <Text className="text-base font-mono font-medium text-foreground">
                Medium weight monospace text
              </Text>
              <Text className="text-base font-mono font-bold text-foreground">
                Bold monospace text
              </Text>
              <View className="bg-muted p-3 rounded border">
                <Text className="text-sm font-mono text-foreground">
                  const example = "Code block example";{'\n'}
                  console.log(example);{'\n'}
                  // This is how code looks
                </Text>
              </View>
            </View>
          </View>

          {/* Typography Hierarchy Example */}
          <View className="bg-card rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Typography Hierarchy
            </Text>
            <View className="space-y-4">
              <Text className="text-3xl font-bold text-foreground">
                Main Heading (text-3xl font-bold)
              </Text>
              <Text className="text-xl font-semibold text-foreground">
                Section Heading (text-xl font-semibold)
              </Text>
              <Text className="text-lg font-medium text-foreground">
                Subsection (text-lg font-medium)
              </Text>
              <Text className="text-base text-foreground">
                Body text (text-base) - This is the default text size used throughout the app for
                regular content. It provides good readability across different device sizes.
              </Text>
              <Text className="text-sm text-muted-foreground">
                Small text (text-sm text-muted-foreground) - Used for captions, secondary
                information, and metadata.
              </Text>
              <Text className="text-xs text-muted-foreground font-mono">
                Fine print (text-xs font-mono) - Used for technical details, timestamps, and debug
                info.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
