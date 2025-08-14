import { useRouter } from 'expo-router';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from '@/components/common';
import {
  UserMessageBubble,
  AssistantMessageBubble,
  ToolCallCard,
  ToolResultCard,
  ThinkingCard,
} from '@/components/session/message-types';
import type { Message } from '@/types/messages';

/**
 * Message types playground screen
 */
export default function MessageTypesPlaygroundScreen() {
  const router = useRouter();

  // Sample message data for demonstrations
  const sampleUserMessage: Message = {
    id: 'user-1',
    content: 'Can you help me create a React component for displaying user profiles?',
    role: 'user',
    timestamp: new Date().toISOString(),
  };

  const sampleUserWithToolsMessage: Message = {
    id: 'user-2',
    content: '',
    role: 'user',
    timestamp: new Date().toISOString(),
    toolResults: [
      {
        name: 'Read',
        input: { file_path: '/src/components/Profile.tsx' },
        output: 'export const Profile = ({ user }) => {\n  return <div>{user.name}</div>;\n};',
        success: true,
      },
    ],
  };

  const sampleAssistantMessage: Message = {
    id: 'assistant-1',
    content: "I'll help you create a React component for displaying user profiles. Let me start by examining your current components structure.",
    role: 'assistant',
    timestamp: new Date().toISOString(),
  };

  const sampleAssistantWithThinking: Message = {
    id: 'assistant-2',
    content: "Based on the existing Profile component, I can help you enhance it with additional features like avatar display, contact information, and responsive design.",
    role: 'assistant',
    timestamp: new Date().toISOString(),
    thinking: "The user is asking for help with a React component for user profiles. I should first understand what they currently have by reading any existing profile-related components, then provide a comprehensive solution that includes:\n\n1. Avatar display\n2. User information layout\n3. Responsive design\n4. Accessibility features\n5. TypeScript types\n\nLet me start by reading their current codebase to understand the existing structure.",
  };

  const sampleAssistantWithTools: Message = {
    id: 'assistant-3',
    content: '',
    role: 'assistant',
    timestamp: new Date().toISOString(),
    toolCalls: [
      {
        name: 'Read',
        input: { file_path: '/src/components/Profile.tsx' },
      },
      {
        name: 'Glob',
        input: { pattern: '**/*profile*', path: '/src' },
      },
    ],
    toolResults: [
      {
        name: 'Read',
        input: { file_path: '/src/components/Profile.tsx' },
        output: 'export const Profile = ({ user }) => {\n  return (\n    <div className="profile">\n      <h2>{user.name}</h2>\n      <p>{user.email}</p>\n    </div>\n  );\n};',
        success: true,
      },
      {
        name: 'Glob',
        input: { pattern: '**/*profile*', path: '/src' },
        output: 'Found 3 files:\n- /src/components/Profile.tsx\n- /src/types/profile.ts\n- /src/pages/ProfilePage.tsx',
        success: true,
      },
    ],
  };

  const sampleToolCalls = [
    {
      name: 'Edit',
      input: {
        file_path: '/src/components/Profile.tsx',
        old_string: 'export const Profile = ({ user }) => {',
        new_string: 'interface User {\n  id: string;\n  name: string;\n  email: string;\n  avatar?: string;\n}\n\nexport const Profile = ({ user }: { user: User }) => {',
      },
    },
    {
      name: 'Write',
      input: {
        file_path: '/src/components/Avatar.tsx',
        content: 'import React from "react";\n\ninterface AvatarProps {\n  src?: string;\n  alt: string;\n  size?: "small" | "medium" | "large";\n}\n\nexport const Avatar: React.FC<AvatarProps> = ({ src, alt, size = "medium" }) => {\n  // Avatar component implementation\n};',
      },
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground mb-1">Message Types Playground</Text>
            <Text className="text-muted-foreground">Chat message components showcase</Text>
          </View>
          <Pressable onPress={() => router.back()} className="ml-4 p-2 rounded-lg bg-muted">
            <Text className="text-muted-foreground text-sm font-medium font-mono">Back</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* User Messages */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              User Messages
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  Basic User Message
                </Text>
                <View className="bg-muted p-3 rounded border">
                  <UserMessageBubble message={sampleUserMessage} />
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  User Message with Tool Results
                </Text>
                <View className="bg-muted p-3 rounded border">
                  <UserMessageBubble message={sampleUserWithToolsMessage} />
                </View>
              </View>
            </View>
          </View>

          {/* Assistant Messages */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Assistant Messages
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  Basic Assistant Message
                </Text>
                <View className="bg-muted p-3 rounded border">
                  <AssistantMessageBubble message={sampleAssistantMessage} />
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  Assistant Message with Thinking
                </Text>
                <View className="bg-muted p-3 rounded border">
                  <AssistantMessageBubble message={sampleAssistantWithThinking} />
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  Assistant Message with Tool Calls & Results
                </Text>
                <View className="bg-muted p-3 rounded border">
                  <AssistantMessageBubble message={sampleAssistantWithTools} />
                </View>
              </View>
            </View>
          </View>

          {/* Individual Components */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Individual Message Components
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  Thinking Card (Expandable)
                </Text>
                <View className="bg-muted p-3 rounded border">
                  <ThinkingCard
                    thinking="I need to analyze the user's request carefully. They want a React component for displaying user profiles. Let me think about the best approach:\n\n1. First, I should check if there's an existing Profile component\n2. Understand the current structure and requirements\n3. Design a comprehensive solution that includes proper TypeScript types\n4. Consider accessibility and responsive design\n5. Make sure it integrates well with their existing codebase"
                    timestamp={new Date().toISOString()}
                  />
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  Tool Call Card (Expandable)
                </Text>
                <View className="bg-muted p-3 rounded border">
                  <ToolCallCard
                    toolCalls={sampleToolCalls}
                    timestamp={new Date().toISOString()}
                  />
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  Tool Result Card
                </Text>
                <View className="bg-muted p-3 rounded border">
                  <ToolResultCard
                    toolResults={[
                      {
                        name: 'Read',
                        input: { file_path: '/src/components/Profile.tsx' },
                        output: 'export const Profile = ({ user }) => {\n  return (\n    <div className="profile">\n      <img src={user.avatar} alt={user.name} />\n      <h2>{user.name}</h2>\n      <p>{user.email}</p>\n      <p>{user.bio}</p>\n    </div>\n  );\n};',
                        success: true,
                      },
                    ]}
                    timestamp={new Date().toISOString()}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Message Flow Example */}
          <View className="bg-card rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Typical Message Flow Example
            </Text>
            <Text className="text-sm text-muted-foreground font-mono mb-4">
              This shows how messages typically flow in a conversation
            </Text>
            
            <View className="space-y-3">
              {/* User starts conversation */}
              <View className="bg-muted/50 p-3 rounded border-l-4 border-l-blue-500">
                <UserMessageBubble message={sampleUserMessage} />
              </View>

              {/* Assistant thinks and responds */}
              <View className="bg-muted/50 p-3 rounded border-l-4 border-l-green-500">
                <AssistantMessageBubble message={sampleAssistantWithThinking} />
              </View>

              {/* Assistant uses tools */}
              <View className="bg-muted/50 p-3 rounded border-l-4 border-l-green-500">
                <AssistantMessageBubble message={sampleAssistantWithTools} />
              </View>

              {/* User provides additional context */}
              <View className="bg-muted/50 p-3 rounded border-l-4 border-l-blue-500">
                <UserMessageBubble message={sampleUserWithToolsMessage} />
              </View>
            </View>

            <View className="mt-4 p-3 bg-background border border-border rounded">
              <Text className="text-xs text-muted-foreground font-mono">
                • Blue border: User messages{'\n'}
                • Green border: Assistant messages{'\n'}
                • Components are fully interactive (tap to expand thinking/tool details)
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}