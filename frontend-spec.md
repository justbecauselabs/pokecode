# Claude Code Mobile Frontend Specification

## Project Setup and Structure

### Technology Stack

- **React Native 0.75+** with Expo SDK 52
- **TypeScript 5.3+** for type safety
- **Expo Router v4** for file-based navigation
- **React Query v5** for server state management
- **Zustand** for client state management
- **React Hook Form** for form handling
- **React Native Reanimated 3** for animations
- **React Native Gesture Handler** for gestures

### Project Structure

```
claude-code-mobile/
├── app/                          # Expo Router app directory
│   ├── (auth)/                   # Authentication flow
│   │   ├── login.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/                   # Main tab navigation
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Home/Projects
│   │   ├── chat/
│   │   │   ├── [sessionId].tsx  # Chat interface
│   │   │   └── _layout.tsx
│   │   ├── files/
│   │   │   ├── index.tsx         # File browser
│   │   │   └── [...path].tsx    # File viewer
│   │   └── history.tsx           # Conversation history
│   ├── _layout.tsx               # Root layout
│   └── +not-found.tsx
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── PromptInput.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── ToolExecutionView.tsx
│   │   │   └── StreamingIndicator.tsx
│   │   ├── code/
│   │   │   ├── CodeViewer.tsx
│   │   │   ├── DiffViewer.tsx
│   │   │   └── SyntaxHighlighter.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   └── LoadingState.tsx
│   │   └── shared/
│   │       ├── ErrorBoundary.tsx
│   │       └── SafeAreaView.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useClaudeCode.ts
│   │   ├── useSSE.ts
│   │   └── useFileSystem.ts
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── sessions.ts
│   │   │   ├── prompts.ts
│   │   │   └── files.ts
│   │   ├── sse/
│   │   │   └── eventSource.ts
│   │   └── storage/
│   │       └── asyncStorage.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── sessionStore.ts
│   │   └── uiStore.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── claude.ts
│   │   └── navigation.ts
│   ├── utils/
│   │   ├── markdown.ts
│   │   ├── format.ts
│   │   └── platform.ts
│   └── constants/
│       ├── api.ts
│       └── theme.ts
├── app.json
├── babel.config.js
├── tsconfig.json
└── package.json
```

## Component Architecture

### Core Components

#### 1. Chat Interface Components

```typescript
// PromptInput.tsx
interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  onCancel?: () => void;
  templates?: PromptTemplate[];
}

// Features:
// - Multiline text input with auto-grow
// - Voice input with speech-to-text
// - Prompt templates dropdown
// - Cancel button when processing
// - Character count indicator
// - Keyboard avoiding view
```

#### 2. Message Display Components

```typescript
// MessageItem.tsx
interface MessageItemProps {
  message: ClaudeMessage;
  isStreaming: boolean;
  onToolClick?: (tool: ToolUse) => void;
  onFileClick?: (path: string) => void;
}

// Features:
// - Markdown rendering with react-native-markdown-display
// - Syntax highlighting for code blocks
// - Collapsible tool execution blocks
// - File path detection and linking
// - Copy code functionality
// - Animated streaming indicator
```

#### 3. File Management Components

```typescript
// FileExplorer.tsx
interface FileExplorerProps {
  sessionId: string;
  currentPath: string;
  onFileSelect: (file: FileNode) => void;
  recentFiles?: string[];
}

// Features:
// - Tree view with expand/collapse
// - File icons based on extension
// - Search/filter functionality
// - Recent files section
// - Pull-to-refresh
// - Long press context menu
```

## State Management

### Zustand Stores

```typescript
// sessionStore.ts
interface SessionStore {
  currentSession: Session | null;
  sessions: Session[];
  messages: Record<string, Message[]>;
  
  // Actions
  createSession: (projectPath: string) => Promise<Session>;
  loadSession: (sessionId: string) => Promise<void>;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, update: Partial<Message>) => void;
}

// authStore.ts
interface AuthStore {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// uiStore.ts
interface UIStore {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  syntaxTheme: string;
  
  // Actions
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
}
```

### React Query Setup

```typescript
// queries/sessions.ts
export const useSession = (sessionId: string) => {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.sessions.get(sessionId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreatePrompt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreatePromptData) => api.prompts.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['session', data.sessionId] });
    },
  });
};

// queries/files.ts
export const useFiles = (sessionId: string, path: string) => {
  return useQuery({
    queryKey: ['files', sessionId, path],
    queryFn: () => api.files.list(sessionId, path),
    staleTime: 30 * 1000, // 30 seconds
  });
};
```

## API Client Implementation

### Base API Client

```typescript
// api/client.ts
import axios, { AxiosInstance } from 'axios';
import { getAuthToken, refreshAuthToken } from '../storage/asyncStorage';

class APIClient {
  private instance: AxiosInstance;
  
  constructor() {
    this.instance = axios.create({
      baseURL: process.env.EXPO_PUBLIC_API_URL,
      timeout: 30000,
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    // Request interceptor for auth
    this.instance.interceptors.request.use(async (config) => {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    
    // Response interceptor for token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          const newToken = await refreshAuthToken();
          if (newToken) {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return this.instance.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }
  
  get<T>(url: string, config?: any) {
    return this.instance.get<T>(url, config);
  }
  
  post<T>(url: string, data?: any, config?: any) {
    return this.instance.post<T>(url, data, config);
  }
}

export const apiClient = new APIClient();
```

## Real-time Streaming with SSE

### SSE Implementation

```typescript
// services/sse/eventSource.ts
import { NativeEventSource, EventSourcePolyfill } from 'react-native-sse';

interface SSEOptions {
  onMessage: (data: any) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class ClaudeCodeSSE {
  private eventSource: EventSourcePolyfill | null = null;
  
  connect(url: string, options: SSEOptions) {
    const token = getAuthToken();
    
    this.eventSource = new EventSourcePolyfill(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    this.eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        options.onMessage(data);
      } catch (error) {
        console.error('SSE parse error:', error);
      }
    });
    
    this.eventSource.addEventListener('error', (event) => {
      options.onError?.(new Error('SSE connection error'));
    });
    
    this.eventSource.addEventListener('complete', () => {
      options.onComplete?.();
      this.disconnect();
    });
  }
  
  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

// Hook usage
export const useSSEStream = (sessionId: string, promptId: string) => {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  useEffect(() => {
    if (!promptId) return;
    
    const sse = new ClaudeCodeSSE();
    const url = `/api/claude-code/sessions/${sessionId}/prompts/${promptId}/stream`;
    
    sse.connect(url, {
      onMessage: (data) => {
        setMessages(prev => [...prev, data]);
        
        if (data.type === 'tool_use') {
          // Handle tool execution visualization
        }
      },
      onComplete: () => {
        setIsStreaming(false);
      },
      onError: (error) => {
        console.error('Stream error:', error);
        setIsStreaming(false);
      },
    });
    
    setIsStreaming(true);
    
    return () => {
      sse.disconnect();
    };
  }, [sessionId, promptId]);
  
  return { messages, isStreaming };
};
```

## UI/UX Implementation

### Theme System

```typescript
// constants/theme.ts
export const lightTheme = {
  colors: {
    primary: '#0066CC',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    error: '#DC3545',
    success: '#28A745',
    warning: '#FFC107',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: 'bold' },
    h2: { fontSize: 24, fontWeight: 'bold' },
    h3: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, lineHeight: 24 },
    caption: { fontSize: 14, color: '#666666' },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
};

export const darkTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    primary: '#4A9EFF',
    background: '#000000',
    surface: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#999999',
    border: '#333333',
  },
};
```

### Gesture Handling

```typescript
// components/chat/MessageList.tsx
import { FlatList } from 'react-native-gesture-handler';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const scrollY = useSharedValue(0);
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  
  return (
    <AnimatedFlatList
      data={messages}
      renderItem={({ item }) => <MessageItem message={item} />}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      inverted
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: 20 }}
    />
  );
};
```

## Performance Optimizations

### 1. List Virtualization

```typescript
// Optimized message list with FlashList
import { FlashList } from '@shopify/flash-list';

export const OptimizedMessageList = ({ messages }) => {
  const getItemType = useCallback((item: Message) => {
    if (item.type === 'tool_use') return 'tool';
    if (item.content.includes('```')) return 'code';
    return 'text';
  }, []);
  
  return (
    <FlashList
      data={messages}
      renderItem={({ item }) => <MessageItem message={item} />}
      estimatedItemSize={200}
      getItemType={getItemType}
      keyExtractor={(item) => item.id}
      inverted
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 100,
      }}
    />
  );
};
```

### 2. Code Splitting

```typescript
// Lazy load heavy components
const CodeViewer = lazy(() => import('./components/code/CodeViewer'));
const MarkdownRenderer = lazy(() => import('./components/shared/MarkdownRenderer'));

// Use with Suspense
<Suspense fallback={<LoadingState />}>
  <CodeViewer code={code} language={language} />
</Suspense>
```

### 3. Memoization Strategy

```typescript
// Memoize expensive renders
export const MessageItem = memo(({ message, isStreaming }) => {
  const formattedContent = useMemo(() => 
    formatMarkdown(message.content), 
    [message.content]
  );
  
  const syntaxHighlightedCode = useMemo(() => 
    message.codeBlocks?.map(block => 
      highlightCode(block.code, block.language)
    ), 
    [message.codeBlocks]
  );
  
  return (
    <View style={styles.container}>
      {/* Render optimized content */}
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for streaming messages
  if (nextProps.isStreaming) return false;
  return prevProps.message.id === nextProps.message.id;
});
```

### 4. Image and Asset Optimization

```typescript
// Optimize images with expo-image
import { Image } from 'expo-image';

export const FileIcon = ({ extension, size = 24 }) => {
  const source = useMemo(() => 
    getFileIconSource(extension), 
    [extension]
  );
  
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={200}
    />
  );
};
```

## Testing Strategy

### 1. Unit Tests

```typescript
// __tests__/hooks/useClaudeCode.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useClaudeCode } from '../../src/hooks/useClaudeCode';

describe('useClaudeCode', () => {
  it('should handle prompt submission', async () => {
    const { result } = renderHook(() => useClaudeCode());
    
    await act(async () => {
      await result.current.submitPrompt('Test prompt');
    });
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.messages).toHaveLength(1);
  });
});
```

### 2. Component Tests

```typescript
// __tests__/components/PromptInput.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PromptInput } from '../../src/components/chat/PromptInput';

describe('PromptInput', () => {
  it('should submit prompt on button press', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <PromptInput onSubmit={onSubmit} isLoading={false} />
    );
    
    const input = getByTestId('prompt-input');
    const button = getByTestId('submit-button');
    
    fireEvent.changeText(input, 'Test prompt');
    fireEvent.press(button);
    
    expect(onSubmit).toHaveBeenCalledWith('Test prompt');
  });
});
```

### 3. Integration Tests

```typescript
// __tests__/integration/chat-flow.test.tsx
import { render, waitFor } from '@testing-library/react-native';
import { ChatScreen } from '../../app/(tabs)/chat/[sessionId]';
import { mockServer } from '../mocks/server';

describe('Chat Flow', () => {
  beforeAll(() => mockServer.listen());
  afterEach(() => mockServer.resetHandlers());
  afterAll(() => mockServer.close());
  
  it('should display streamed responses', async () => {
    const { getByText, getByTestId } = render(
      <ChatScreen route={{ params: { sessionId: 'test-session' } }} />
    );
    
    // Submit prompt
    fireEvent.changeText(getByTestId('prompt-input'), 'Test prompt');
    fireEvent.press(getByTestId('submit-button'));
    
    // Wait for streaming response
    await waitFor(() => {
      expect(getByText(/Processing/)).toBeTruthy();
    });
    
    await waitFor(() => {
      expect(getByText(/Response content/)).toBeTruthy();
    });
  });
});
```

### 4. E2E Tests with Detox

```typescript
// e2e/chat.e2e.ts
describe('Chat E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });
  
  it('should complete a full chat interaction', async () => {
    // Navigate to chat
    await element(by.id('chat-tab')).tap();
    
    // Enter prompt
    await element(by.id('prompt-input')).typeText('Create a hello world function');
    await element(by.id('submit-button')).tap();
    
    // Wait for response
    await waitFor(element(by.text('def hello_world():')))
      .toBeVisible()
      .withTimeout(10000);
    
    // Verify code block
    await expect(element(by.id('code-block-0'))).toBeVisible();
  });
});
```

## Security Implementation

### 1. Secure Storage

```typescript
// services/storage/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  async setToken(token: string) {
    await SecureStore.setItemAsync('auth_token', token);
  },
  
  async getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('auth_token');
  },
  
  async removeToken() {
    await SecureStore.deleteItemAsync('auth_token');
  },
  
  async setRefreshToken(token: string) {
    await SecureStore.setItemAsync('refresh_token', token);
  },
};
```

### 2. API Security

```typescript
// Certificate pinning for production
import { NetworkingModule } from 'react-native-ssl-pinning';

export const secureApiClient = {
  async request(url: string, options: RequestOptions) {
    return NetworkingModule.sendRequest({
      url,
      method: options.method,
      headers: {
        ...options.headers,
        'X-Client-Version': Constants.expoConfig.version,
      },
      sslPinning: {
        certs: ['cert1', 'cert2'], // Production certificates
      },
      timeout: 30000,
    });
  },
};
```

## Build and Deployment

### Development Setup

```json
// package.json
{
  "name": "claude-code-mobile",
  "version": "1.0.0",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "test": "jest",
    "test:e2e": "detox test",
    "lint": "eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "eas:build:preview": "eas build --profile preview",
    "eas:build:production": "eas build --profile production"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "react": "18.3.1",
    "react-native": "0.76.3",
    "@tanstack/react-query": "^5.32.0",
    "zustand": "^4.5.2",
    "react-native-reanimated": "~3.16.1",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-safe-area-context": "4.14.0",
    "react-native-screens": "~4.1.0",
    "@shopify/flash-list": "1.7.2",
    "expo-secure-store": "~14.0.0",
    "expo-speech": "~13.0.0",
    "react-native-markdown-display": "^7.0.2",
    "react-native-syntax-highlighter": "^2.1.0",
    "react-native-sse": "^1.2.1"
  },
  "devDependencies": {
    "@types/react": "~18.3.12",
    "typescript": "~5.7.2",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.8.1",
    "detox": "^20.27.6",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^8.15.0"
  }
}
```

### EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging-api.claudecode.app"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.claudecode.app"
      },
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "team@claudecode.app",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json"
      }
    }
  }
}
```

## Monitoring and Analytics

### Performance Monitoring

```typescript
// utils/performance.ts
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableAutoPerformanceTracing: true,
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.2,
});

export const trackPerformance = {
  startTransaction(name: string) {
    return Sentry.startTransaction({ name });
  },
  
  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const transaction = Sentry.startTransaction({ name });
    return fn().finally(() => transaction.finish());
  },
};

// Usage in components
const loadSession = async (sessionId: string) => {
  return trackPerformance.measureAsync('load-session', async () => {
    const session = await api.sessions.get(sessionId);
    return session;
  });
};
```

This comprehensive frontend specification provides a complete roadmap for implementing the Claude Code Mobile app with React Native and Expo, focusing on performance, user experience, and maintainability.