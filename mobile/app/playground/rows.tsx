import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Row, SafeAreaView } from '@/components/common';

/**
 * Row components playground screen
 */
export default function RowsPlaygroundScreen() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const handleRowPress = (title: string) => {
    Alert.alert('Row Pressed', `You tapped: ${title}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground mb-1">Rows Playground</Text>
            <Text className="text-muted-foreground">Flexible row components showcase</Text>
          </View>
          <Pressable onPress={() => router.back()} className="ml-4 p-2 rounded-lg bg-muted">
            <Text className="text-muted-foreground text-sm font-medium font-mono">Back</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Basic Rows */}
          <View className="bg-card rounded-lg border border-border mb-4 overflow-hidden">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                Basic Rows
              </Text>
            </View>
            <View>
              <Row
                title="Simple Row"
                className="border-b border-border/50"
                onPress={() => handleRowPress('Simple Row')}
              />
              <Row
                title="Row with Subtitle"
                subtitle="This is a subtitle that provides additional context"
                className="border-b border-border/50"
                onPress={() => handleRowPress('Row with Subtitle')}
              />
              <Row
                title="Row with Caret"
                showCaret
                onPress={() => handleRowPress('Row with Caret')}
              />
            </View>
          </View>

          {/* Leading Elements */}
          <View className="bg-card rounded-lg border border-border mb-4 overflow-hidden">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                Leading Elements
              </Text>
            </View>
            <View>
              <Row
                title="Settings"
                subtitle="App preferences and configuration"
                leading={{
                  type: 'icon',
                  library: 'MaterialIcons',
                  name: 'settings',
                  size: 22,
                  color: '#528bff',
                }}
                showCaret
                className="border-b border-border/50"
                onPress={() => handleRowPress('Settings')}
              />
              <Row
                title="Notifications"
                subtitle="Push notifications and alerts"
                leading={{
                  type: 'icon',
                  library: 'Ionicons',
                  name: 'notifications',
                  size: 20,
                  color: '#f59e0b',
                }}
                showCaret
                className="border-b border-border/50"
                onPress={() => handleRowPress('Notifications')}
              />
              <Row
                title="With Text Leading"
                subtitle="Leading text element"
                leading={{ type: 'text', content: 'A', className: 'font-bold text-primary' }}
                showCaret
                className="border-b border-border/50"
                onPress={() => handleRowPress('With Text Leading')}
              />
              <Row
                title="John Smith"
                subtitle="john.smith@example.com"
                leading={{
                  type: 'avatar',
                  initials: 'JS',
                  backgroundColor: '#528bff',
                  size: 'medium',
                }}
                showCaret
                className="border-b border-border/50"
                onPress={() => handleRowPress('John Smith')}
              />
              <Row
                title="Messages"
                subtitle="Unread conversations"
                leading={{ type: 'badge', count: 5, backgroundColor: '#ef4444' }}
                showCaret
                onPress={() => handleRowPress('Messages')}
              />
            </View>
          </View>

          {/* Trailing Elements */}
          <View className="bg-card rounded-lg border border-border mb-4 overflow-hidden">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                Trailing Elements
              </Text>
            </View>
            <View>
              <Row
                title="Storage Used"
                subtitle="Documents and media files"
                trailing={{ type: 'text', content: '2.4 GB' }}
                showCaret
                className="border-b border-border/50"
                onPress={() => handleRowPress('Storage Used')}
              />
              <Row
                title="App Version"
                subtitle="Current installed version"
                trailing={{
                  type: 'text',
                  content: 'v1.2.3',
                  className: 'font-mono text-muted-foreground',
                }}
                className="border-b border-border/50"
                onPress={() => handleRowPress('App Version')}
              />
              <Row
                title="Dark Mode"
                subtitle="Toggle dark theme appearance"
                trailing={{
                  type: 'switch',
                  value: darkMode,
                  onValueChange: setDarkMode,
                }}
                onPress={() => handleRowPress('Dark Mode')}
                className="border-b border-border/50"
              />
              <Row
                title="Download Progress"
                subtitle="App update in progress"
                trailing={{
                  type: 'progress',
                  value: 73,
                  showPercentage: true,
                }}
                className="border-b border-border/50"
                onPress={() => handleRowPress('Download Progress')}
              />
              <Row
                title="User Status"
                subtitle="Current availability"
                trailing={{
                  type: 'status',
                  variant: 'online',
                }}
                className="border-b border-border/50"
                onPress={() => handleRowPress('User Status')}
              />
              <Row
                title="Unread Count"
                subtitle="New messages received"
                trailing={{
                  type: 'badge',
                  count: 12,
                  backgroundColor: '#22c55e',
                }}
                className="border-b border-border/50"
                onPress={() => handleRowPress('Unread Count')}
              />
              <Row
                title="Favorite"
                subtitle="Add to favorites"
                trailing={{
                  type: 'icon',
                  library: 'MaterialIcons',
                  name: 'favorite-border',
                  size: 20,
                  color: '#ef4444',
                }}
                onPress={() => handleRowPress('Favorite')}
              />
            </View>
          </View>

          {/* Complex Combinations */}
          <View className="bg-card rounded-lg border border-border mb-4 overflow-hidden">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                Complex Combinations
              </Text>
            </View>
            <View>
              <Row
                title="Notifications"
                subtitle="Push notifications and alerts"
                leading={{
                  type: 'icon',
                  library: 'Ionicons',
                  name: 'notifications',
                  color: '#f59e0b',
                }}
                trailing={{
                  type: 'switch',
                  value: notifications,
                  onValueChange: setNotifications,
                }}
                showCaret
                className="border-b border-border/50"
                onPress={() => handleRowPress('Notifications')}
              />
              <Row
                title="Jane Cooper"
                subtitle="jane.cooper@example.com • Designer"
                leading={{
                  type: 'avatar',
                  initials: 'JC',
                  backgroundColor: '#8b5cf6',
                  size: 'large',
                }}
                trailing={{ type: 'status', variant: 'online' }}
                showCaret
                className="border-b border-border/50"
                onPress={() => handleRowPress('Jane Cooper')}
              />
              <Row
                title="Team Chat"
                subtitle="5 new messages from the team"
                leading={{ type: 'badge', count: 5, backgroundColor: '#3b82f6' }}
                trailing={{ type: 'status', variant: 'away', label: '2h ago' }}
                showCaret
                className="border-b border-border/50"
                onPress={() => handleRowPress('Team Chat')}
              />
              <Row
                title="Photo Backup"
                subtitle="Uploading 127 photos to cloud"
                leading={{
                  type: 'icon',
                  library: 'MaterialIcons',
                  name: 'cloud-upload',
                  color: '#22c55e',
                }}
                trailing={{ type: 'progress', value: 45, showPercentage: true }}
                className="border-b border-border/50"
                onPress={() => handleRowPress('Photo Backup')}
              />
              <Row
                title="VIP Messages"
                subtitle="Priority conversations"
                leading={{ type: 'icon', library: 'MaterialIcons', name: 'star', color: '#f59e0b' }}
                trailing={{ type: 'badge', count: 99, backgroundColor: '#ef4444', maxCount: 99 }}
                showCaret
                onPress={() => handleRowPress('VIP Messages')}
              />
            </View>
          </View>

          {/* Custom Styling */}
          <View className="bg-card rounded-lg border border-border mb-4 overflow-hidden">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                Custom Styling
              </Text>
            </View>
            <View>
              <Row
                title="Custom Title Style"
                titleClassName="text-lg font-bold text-primary"
                subtitle="Custom subtitle styling"
                subtitleClassName="text-xs text-destructive font-mono"
                className="border-b border-border/50"
                onPress={() => handleRowPress('Custom Title Style')}
              />
              <Row
                title="Danger Zone"
                subtitle="Destructive actions"
                titleClassName="text-destructive font-semibold"
                leading={{ type: 'icon', content: <Text className="text-xl">⚠️</Text> }}
                showCaret
                caretClassName="text-destructive"
                className="border-b border-border/50"
                onPress={() => handleRowPress('Danger Zone')}
              />
              <Row
                title="Compact Row"
                subtitle="Reduced padding"
                className="py-2 border-b border-border/50"
                showCaret
                onPress={() => handleRowPress('Compact Row')}
              />
            </View>
          </View>

          {/* All Element Types Showcase */}
          <View className="bg-card rounded-lg border border-border mb-4 overflow-hidden">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                All Element Types
              </Text>
              <Text className="text-sm text-muted-foreground font-mono mt-1">
                Showcase of all supported element types
              </Text>
            </View>
            <View>
              <Row
                title="Status Variants"
                subtitle="Online, Offline, Away, Busy"
                trailing={{ type: 'status', variant: 'busy' }}
                className="border-b border-border/50"
              />
              <Row
                title="Progress Bars"
                subtitle="With and without percentages"
                trailing={{ type: 'progress', value: 25, showPercentage: false }}
                className="border-b border-border/50"
              />
              <Row
                title="Badge Overflow"
                subtitle="Count exceeds maximum"
                leading={{ type: 'badge', count: 150, maxCount: 99 }}
                trailing={{ type: 'badge', count: 5, backgroundColor: '#8b5cf6' }}
                className="border-b border-border/50"
              />
              <Row
                title="Avatar Sizes"
                subtitle="Small, medium, large avatars"
                leading={{
                  type: 'avatar',
                  initials: 'SM',
                  size: 'small',
                  backgroundColor: '#ef4444',
                }}
                trailing={{
                  type: 'icon',
                  library: 'Feather',
                  name: 'user',
                  size: 18,
                  color: '#6b7280',
                }}
                className="border-b border-border/50"
              />
              <Row
                title="Icon Libraries"
                subtitle="MaterialIcons, Ionicons, Feather, AntDesign"
                leading={{
                  type: 'icon',
                  library: 'AntDesign',
                  name: 'appstore-o',
                  color: '#3b82f6',
                }}
                trailing={{
                  type: 'icon',
                  library: 'Feather',
                  name: 'chevron-right',
                  color: '#6b7280',
                }}
              />
            </View>
          </View>

          {/* Non-interactive Rows */}
          <View className="bg-card rounded-lg border border-border">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                Non-interactive Rows
              </Text>
              <Text className="text-sm text-muted-foreground font-mono mt-1">
                These rows have no onPress handler
              </Text>
            </View>
            <View>
              <Row
                title="System Information"
                subtitle="iOS 17.0 • iPhone 15 Pro"
                leading={{
                  type: 'icon',
                  library: 'MaterialIcons',
                  name: 'phone-iphone',
                  color: '#6b7280',
                }}
                trailing={{ type: 'text', content: 'Read-only' }}
                className="border-b border-border/50"
              />
              <Row
                title="Build Number"
                subtitle="Internal build identifier"
                leading={{
                  type: 'icon',
                  library: 'MaterialIcons',
                  name: 'info-outline',
                  size: 18,
                  color: '#6b7280',
                }}
                trailing={{ type: 'text', content: '2024.01.15.1', className: 'font-mono text-xs' }}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
