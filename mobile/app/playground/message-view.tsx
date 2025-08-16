import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common';
import { MessageView } from '@/components/session/MessageView';
import type { Message } from '@/api/generated/types.gen';

const sampleUserMessage: Message = {
  id: "4cd7cf3b-26fa-4eb1-ba23-fe50ce956034",
  type: "claude-code",
  data: {
    type: "user",
    message: {
      role: "user",
      content: "hello"
    },
    parent_tool_use_id: null,
    session_id: "3617cee3-314b-4f48-b530-47fa61f2dc39"
  }
};

const sampleAssistantMessage: Message = {
  id: "94018025-4a30-422f-9c95-3b6a3f74bbdd",
  type: "claude-code",
  data: {
    type: "assistant",
    message: {
      id: "msg_016KPxgSjM4E4ofkGQGEHLy4",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-20250514",
      content: [
        {
          type: "text",
          text: "Hello! I'm Claude Code, ready to help you with your software engineering tasks. What would you like to work on today?"
        }
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 4,
        cache_creation_input_tokens: 19578,
        cache_read_input_tokens: 0,
        cache_creation: {
          ephemeral_5m_input_tokens: 19578,
          ephemeral_1h_input_tokens: 0
        },
        output_tokens: 29,
        service_tier: "standard"
      }
    },
    parent_tool_use_id: null,
    session_id: "3617cee3-314b-4f48-b530-47fa61f2dc39"
  }
};

const sampleLongUserMessage: Message = {
  id: "long-user-message",
  type: "claude-code",
  data: {
    type: "user",
    message: {
      role: "user",
      content: "I need help with a complex React Native component that handles user authentication, state management with Zustand, and integrates with a REST API. Can you help me implement proper error handling and loading states? I want to make sure the component is robust and follows best practices for mobile development."
    },
    parent_tool_use_id: null,
    session_id: "3617cee3-314b-4f48-b530-47fa61f2dc39"
  }
};

const sampleShortAssistantMessage: Message = {
  id: "short-assistant-message",
  type: "claude-code",
  data: {
    type: "assistant",
    message: {
      id: "msg_short_response",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-20250514",
      content: [
        {
          type: "text",
          text: "Sure! I can help with that."
        }
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 15,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation: {
          ephemeral_5m_input_tokens: 0,
          ephemeral_1h_input_tokens: 0
        },
        output_tokens: 8,
        service_tier: "standard"
      }
    },
    parent_tool_use_id: null,
    session_id: "3617cee3-314b-4f48-b530-47fa61f2dc39"
  }
};

const sampleMultiBlockAssistantMessage: Message = {
  id: "multi-block-assistant-message",
  type: "claude-code",
  data: {
    type: "assistant",
    message: {
      id: "msg_multi_block",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-20250514",
      content: [
        {
          type: "text",
          text: "I'll help you with that authentication component. Let me think through this step by step."
        },
        {
          type: "thinking",
          thinking: "The user wants help with React Native authentication. I should provide a comprehensive solution covering hooks, state management, and error handling.",
          signature: "thinking"
        },
        {
          type: "text",
          text: "Here's a robust approach:\n\n## 1. Custom Hook\n\n```typescript\nconst useAuth = () => {\n  const [loading, setLoading] = useState(false);\n  return { login, loading };\n};\n```\n\n## 2. Error Handling\n\nAlways wrap API calls in try-catch blocks for proper error management."
        }
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 152,
        cache_creation_input_tokens: 19578,
        cache_read_input_tokens: 0,
        cache_creation: {
          ephemeral_5m_input_tokens: 19578,
          ephemeral_1h_input_tokens: 0
        },
        output_tokens: 145,
        service_tier: "standard"
      }
    },
    parent_tool_use_id: null,
    session_id: "3617cee3-314b-4f48-b530-47fa61f2dc39"
  }
};

const sampleLongAssistantMessage: Message = {
  id: "long-assistant-message",
  type: "claude-code",
  data: {
    type: "assistant",
    message: {
      id: "msg_long_response",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-20250514",
      content: [
        {
          type: "text",
          text: "I'll help you implement a robust React Native authentication component with proper state management and error handling. Here's a comprehensive approach:\n\n## 1. Authentication Hook\n\nFirst, let's create a custom hook that handles authentication logic:\n\n```typescript\nconst useAuth = () => {\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<string | null>(null);\n  \n  const login = async (credentials: LoginCredentials) => {\n    setLoading(true);\n    setError(null);\n    \n    try {\n      const response = await authAPI.login(credentials);\n      // Handle success\n    } catch (err) {\n      setError(err.message);\n    } finally {\n      setLoading(false);\n    }\n  };\n  \n  return { login, loading, error };\n};\n```\n\n## 2. Zustand Store\n\nSet up your authentication store with proper TypeScript types:\n\n```typescript\ninterface AuthState {\n  user: User | null;\n  token: string | null;\n  isAuthenticated: boolean;\n  setUser: (user: User) => void;\n  logout: () => void;\n}\n```\n\nThis approach ensures type safety, proper error handling, and a clean separation of concerns."
        }
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 152,
        cache_creation_input_tokens: 19578,
        cache_read_input_tokens: 0,
        cache_creation: {
          ephemeral_5m_input_tokens: 19578,
          ephemeral_1h_input_tokens: 0
        },
        output_tokens: 245,
        service_tier: "standard"
      }
    },
    parent_tool_use_id: null,
    session_id: "3617cee3-314b-4f48-b530-47fa61f2dc39"
  }
};

export default function MessageViewPlayground() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        {/* Header */}
        <View className="p-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground mb-1 font-mono">
            Message View
          </Text>
          <Text className="text-muted-foreground font-mono">
            Terminal-style left-aligned messages with caret (>) and dot (●) indicators
          </Text>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 p-4">
          {/* Simple Messages */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3 font-mono">
              Simple Messages
            </Text>
            <Text className="text-sm text-muted-foreground mb-4 font-mono">
              User messages start with > and assistant messages start with ● (aligned at top)
            </Text>
            
            <View className="space-y-3">
              <MessageView message={sampleUserMessage} />
              <MessageView message={sampleAssistantMessage} />
              <MessageView message={sampleShortAssistantMessage} />
            </View>
          </View>

          {/* Multi-Block Messages */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3 font-mono">
              Multi-Block Messages
            </Text>
            <Text className="text-sm text-muted-foreground mb-4 font-mono">
              Assistant messages with multiple content blocks (text, thinking, etc.)
            </Text>
            
            <View className="space-y-3">
              <MessageView message={sampleMultiBlockAssistantMessage} />
            </View>
          </View>

          {/* Long Messages */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3 font-mono">
              Long Messages
            </Text>
            <Text className="text-sm text-muted-foreground mb-4 font-mono">
              Examples with longer content and markdown formatting
            </Text>
            
            <View className="space-y-3">
              <MessageView message={sampleLongUserMessage} />
              <MessageView message={sampleLongAssistantMessage} />
            </View>
          </View>

          {/* Message Conversation */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3 font-mono">
              Conversation Flow
            </Text>
            <Text className="text-sm text-muted-foreground mb-4 font-mono">
              Multiple messages in sequence to test conversation flow
            </Text>
            
            <View className="space-y-3">
              <MessageView message={sampleUserMessage} />
              <MessageView message={sampleAssistantMessage} />
              <MessageView message={sampleLongUserMessage} />
              <MessageView message={sampleLongAssistantMessage} />
            </View>
          </View>

          {/* Component Info */}
          <View className="bg-card rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-card-foreground mb-3 font-mono">
              Component Information
            </Text>
            
            <View className="space-y-3">
              <View>
                <Text className="text-sm font-medium text-card-foreground font-mono">
                  File Location:
                </Text>
                <Text className="text-xs text-muted-foreground font-mono">
                  mobile/src/components/session/MessageView.tsx
                </Text>
              </View>
              
              <View>
                <Text className="text-sm font-medium text-card-foreground font-mono">
                  Features:
                </Text>
                <Text className="text-xs text-muted-foreground font-mono">
                  • Terminal-style left-aligned design{'\n'}
                  • User messages: > prefix{'\n'}
                  • Assistant messages: ● prefix{'\n'}
                  • Markdown support for assistant messages{'\n'}
                  • Token usage display{'\n'}
                  • Error handling for invalid messages{'\n'}
                  • No bubbles or complex styling
                </Text>
              </View>
              
              <View>
                <Text className="text-sm font-medium text-card-foreground font-mono">
                  Message Types Supported:
                </Text>
                <Text className="text-xs text-muted-foreground font-mono">
                  • Simple user messages (text only){'\n'}
                  • Simple assistant messages (text only){'\n'}
                  • No tool calls (as requested)
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}