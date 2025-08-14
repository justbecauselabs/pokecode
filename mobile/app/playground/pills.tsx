import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Pill, SafeAreaView } from '@/components/common';

/**
 * Pill components playground screen
 */
export default function PillsPlaygroundScreen() {
  const router = useRouter();
  const [selectedPills, setSelectedPills] = useState<string[]>([]);

  const handlePillPress = (pillId: string) => {
    if (selectedPills.includes(pillId)) {
      setSelectedPills(prev => prev.filter(id => id !== pillId));
    } else {
      setSelectedPills(prev => [...prev, pillId]);
    }
  };

  const isPillSelected = (pillId: string) => selectedPills.includes(pillId);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground mb-1">Pills Playground</Text>
            <Text className="text-muted-foreground">Interactive pill components</Text>
          </View>
          <Pressable onPress={() => router.back()} className="ml-4 p-2 rounded-lg bg-muted">
            <Text className="text-muted-foreground text-sm font-medium font-mono">Back</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Pill Variants */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Pill Variants
            </Text>
            <View className="space-y-4">
              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Default</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pill variant="default" onPress={() => Alert.alert('Pill Pressed', 'Default pill')}>
                    Default
                  </Pill>
                  <Pill variant="default" onPress={() => Alert.alert('Pill Pressed', 'Tag pill')}>
                    Tag
                  </Pill>
                  <Pill variant="default" onPress={() => Alert.alert('Pill Pressed', 'Category pill')}>
                    Category
                  </Pill>
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Active</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pill variant="active" onPress={() => Alert.alert('Pill Pressed', 'Active pill')}>
                    Active
                  </Pill>
                  <Pill variant="active" onPress={() => Alert.alert('Pill Pressed', 'Selected pill')}>
                    Selected
                  </Pill>
                  <Pill variant="active" onPress={() => Alert.alert('Pill Pressed', 'Enabled pill')}>
                    Enabled
                  </Pill>
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Secondary</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pill variant="secondary" onPress={() => Alert.alert('Pill Pressed', 'Secondary pill')}>
                    Secondary
                  </Pill>
                  <Pill variant="secondary" onPress={() => Alert.alert('Pill Pressed', 'Subtle pill')}>
                    Subtle
                  </Pill>
                  <Pill variant="secondary" onPress={() => Alert.alert('Pill Pressed', 'Muted pill')}>
                    Muted
                  </Pill>
                </View>
              </View>
            </View>
          </View>

          {/* Pill Sizes */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Pill Sizes
            </Text>
            <View className="space-y-4">
              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Small</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pill size="small" variant="default">Small Default</Pill>
                  <Pill size="small" variant="active">Small Active</Pill>
                  <Pill size="small" variant="secondary">Small Secondary</Pill>
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Medium (Default)</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pill size="medium" variant="default">Medium Default</Pill>
                  <Pill size="medium" variant="active">Medium Active</Pill>
                  <Pill size="medium" variant="secondary">Medium Secondary</Pill>
                </View>
              </View>
            </View>
          </View>

          {/* Interactive Filter Demo */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Interactive Filter Demo
            </Text>
            <Text className="text-sm text-muted-foreground font-mono mb-3">
              Tap pills to toggle selection state (simulating filters)
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-card-foreground mb-2">Categories</Text>
                <View className="flex-row flex-wrap gap-2">
                  {['Frontend', 'Backend', 'Mobile', 'Design'].map((category) => (
                    <Pill
                      key={category}
                      variant={isPillSelected(category) ? 'active' : 'default'}
                      onPress={() => handlePillPress(category)}
                    >
                      {category}
                    </Pill>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-card-foreground mb-2">Technologies</Text>
                <View className="flex-row flex-wrap gap-2">
                  {['React', 'TypeScript', 'Node.js', 'Python', 'Swift'].map((tech) => (
                    <Pill
                      key={tech}
                      size="small"
                      variant={isPillSelected(tech) ? 'active' : 'secondary'}
                      onPress={() => handlePillPress(tech)}
                    >
                      {tech}
                    </Pill>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-card-foreground mb-2">Priority Levels</Text>
                <View className="flex-row flex-wrap gap-2">
                  {['Low', 'Medium', 'High', 'Critical'].map((priority) => (
                    <Pill
                      key={priority}
                      variant={isPillSelected(priority) ? 'active' : 'default'}
                      onPress={() => handlePillPress(priority)}
                    >
                      {priority}
                    </Pill>
                  ))}
                </View>
              </View>
            </View>

            {selectedPills.length > 0 && (
              <View className="mt-4 p-3 bg-muted rounded border">
                <Text className="text-sm font-medium text-card-foreground mb-1">Selected:</Text>
                <Text className="text-sm text-muted-foreground font-mono">
                  {selectedPills.join(', ')}
                </Text>
                <Pressable 
                  onPress={() => setSelectedPills([])}
                  className="mt-2 self-start"
                >
                  <Text className="text-xs text-primary font-mono">Clear all</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Disabled State */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Disabled State
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Pill disabled variant="default">Disabled Default</Pill>
              <Pill disabled variant="active">Disabled Active</Pill>
              <Pill disabled variant="secondary">Disabled Secondary</Pill>
              <Pill disabled size="small" variant="default">Small Disabled</Pill>
            </View>
          </View>

          {/* Custom Content */}
          <View className="bg-card rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Pills with Custom Content
            </Text>
            <Text className="text-sm text-muted-foreground font-mono mb-3">
              Pills can contain custom React nodes, not just strings
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Pill variant="default" onPress={() => Alert.alert('Custom', 'Emoji pill')}>
                <View className="flex-row items-center">
                  <Text className="text-white mr-1">🚀</Text>
                  <Text className="text-white text-sm font-medium">Deploy</Text>
                </View>
              </Pill>
              
              <Pill variant="active" onPress={() => Alert.alert('Custom', 'Count pill')}>
                <View className="flex-row items-center">
                  <Text className="text-white text-sm font-medium mr-1">Messages</Text>
                  <View className="bg-white/20 rounded-full px-1.5 py-0.5">
                    <Text className="text-white text-xs font-bold">3</Text>
                  </View>
                </View>
              </Pill>

              <Pill variant="secondary" onPress={() => Alert.alert('Custom', 'Status pill')}>
                <View className="flex-row items-center">
                  <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  <Text className="text-white text-sm font-medium">Online</Text>
                </View>
              </Pill>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}