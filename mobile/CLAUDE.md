# Expo & React Native Best Practices

## Project Setup

### Expo SDK & Dependencies
- Always use the latest stable Expo SDK version
- Use `bunx expo install` instead of `bun install` for Expo-compatible packages
- Check package compatibility at https://reactnative.directory
- Use `expo-doctor` to validate project health
- Prefer Expo SDK packages over community packages when available

### Development Tools
- Use `bunx expo start` for development server
- Use `bunx expo run:ios` or `bunx expo run:android` for native builds
- Use EAS Build for production builds: `eas build`
- Use EAS Update for over-the-air updates: `eas update`

## Code Organization

### File Structure
```
mobile/
├── app/                 # Expo Router screens
│   ├── (tabs)/         # Tab navigation screens
│   ├── (modals)/       # Modal screens
│   └── _layout.tsx     # Root layout
├── src/
│   ├── components/     # Component organization
│   │   ├── common/     # All reusable components
│   │   ├── session/    # Session-specific components
│   │   └── debug/      # Development components
│   ├── hooks/          # Custom hooks
│   ├── api/            # API client and endpoints
│   ├── stores/         # State management (Zustand)
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript types
│   └── constants/      # App constants
├── assets/             # Images, fonts, etc.
└── scripts/            # Build and utility scripts
```

## Navigation

### Expo Router Best Practices
- Use file-based routing with Expo Router
- Group routes with parentheses: `(tabs)`, `(auth)`, `(modals)`
- Use `_layout.tsx` files for nested layouts
- Implement type-safe navigation with `useLocalSearchParams` and `useGlobalSearchParams`
- Use `Link` component for navigation instead of imperative navigation
- Handle deep linking with `app.json` configuration

### Navigation Patterns
```typescript
// Type-safe route params
import { useLocalSearchParams } from 'expo-router';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // ...
}
```

## Components

### UI Development Guidelines
- Keep shared components like rows, cards, or smaller reusable things in the `src/components/` directory
- For full screens, keep that code in the `app/<page>.tsx` file itself
- If we end up having shared screens across multiple routes, we can reevaluate for those
- This approach reduces unnecessary abstractions and keeps screen logic close to the route

### Component Reuse Rule
**CRITICAL**: Before creating any new UI component, ALWAYS check the existing components directory structure first:
- `src/components/common/` - All reusable components (buttons, inputs, pills, cards, modals, etc.)
- `src/components/session/` - Session-specific components  
- `src/components/debug/` - Development and debugging components

If a similar component already exists, use it instead of creating a duplicate. If you need slight modifications, extend the existing component with new props or variants rather than creating a new one. This ensures consistency and reduces code duplication.

### Component Best Practices
- Create functional components with TypeScript
- Use React.memo for expensive components
- Implement proper loading and error states
- Use Expo components when available (e.g., expo-image, expo-av)
- Prefer NativeWind `className` for layout/spacing/typography
- Use `style` only for unsupported props or dynamic styles not expressible with Tailwind utilities
- Centralize design tokens in `tailwind.config.js` and avoid hardcoded hex values
- Use theme constants for consistent styling

### Styling with NativeWind
**CRITICAL RULE**: Always prioritize Tailwind CSS over manual inline styles. Only use inline styles for dynamic values that cannot be expressed with Tailwind utilities.

Use Tailwind utility classes via `className` on React Native components. Keep classes as string literals; for conditional cases, concatenate known class names.

```tsx
// Before - DON'T DO THIS
import { View, Text, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
});

export function Example() {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: dynamicColor }]}>Hello</Text>
    </View>
  );
}

// After - DO THIS
export function Example() {
  return (
    <View className="flex-1 px-4 pt-6">
      <Text className="text-2xl font-bold mb-3" style={{ color: dynamicColor }}>Hello</Text>
    </View>
  );
}
```

**Styling Priority Order:**
1. **First**: Use Tailwind utility classes (`className`)
2. **Second**: Use Tailwind config extensions for custom values
3. **Last Resort**: Use inline `style` only for truly dynamic values (colors from API, calculated dimensions, etc.)

**Never do:**
- Mix multiple styling approaches for the same property
- Use inline styles for static values that could be Tailwind classes
- Define font families, colors, or spacing in inline styles

Tokens are defined in `tailwind.config.js` (`theme.extend`). Avoid hardcoding colors/sizes; reference tokens like `bg-background`, `text-primary`, etc.

### Component Structure
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { memo } from 'react';

interface ComponentProps {
  title: string;
  onPress?: () => void;
}

export const Component = memo(({ title, onPress }: ComponentProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    fontSize: 16,
  },
});
```

## State Management

### Zustand Best Practices
- Use Zustand for global state management
- Create separate stores for different domains
- Implement persistence with MMKV or AsyncStorage
- Use immer for immutable updates
- Subscribe to specific slices to prevent unnecessary re-renders

### Store Pattern
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface StoreState {
  items: Item[];
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
}

export const useStore = create<StoreState>()(
  immer((set) => ({
    items: [],
    addItem: (item) =>
      set((state) => {
        state.items.push(item);
      }),
    removeItem: (id) =>
      set((state) => {
        state.items = state.items.filter((item) => item.id !== id);
      }),
  }))
);
```

## Performance

### Optimization Techniques
- Use FlashList instead of FlatList for large lists
- Implement lazy loading for heavy components
- Use React.lazy and Suspense for code splitting
- Optimize images with expo-image and proper caching
- Minimize re-renders with proper memoization
- Use InteractionManager for expensive operations
- Profile with React DevTools and Flipper

### Image Optimization
```typescript
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  placeholder={blurhash}
  contentFit="cover"
  transition={1000}
  cachePolicy="memory-disk"
/>
```

## Platform-Specific Code

### Platform Handling
```typescript
import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: {
    marginTop: Platform.select({
      ios: 20,
      android: 0,
      default: 0,
    }),
  },
});

// Platform-specific files
// Component.ios.tsx
// Component.android.tsx
```

## API Integration

### Network Requests
- Use expo-constants for API URLs
- Implement proper error handling and retry logic
- Use React Query or SWR for data fetching
- Handle offline scenarios with NetInfo
- Implement request/response interceptors
- Use proper authentication with SecureStore

### API Client Pattern
```typescript
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.example.com';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_URL;
  }

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }
}
```

## Security

### Security Best Practices
- Store sensitive data in expo-secure-store
- Never hardcode API keys or secrets
- Use environment variables with expo-constants
- Implement certificate pinning for sensitive apps
- Validate all user inputs
- Use HTTPS for all network requests
- Implement proper authentication flows

### Secure Storage
```typescript
import * as SecureStore from 'expo-secure-store';

// Store sensitive data
await SecureStore.setItemAsync('token', authToken);

// Retrieve sensitive data
const token = await SecureStore.getItemAsync('token');
```

## Testing

### Testing Strategy
- Unit tests with Jest and React Native Testing Library
- Component testing with @testing-library/react-native
- E2E testing with Detox or Maestro
- Snapshot testing for UI consistency
- Mock native modules properly
- Test on both iOS and Android

### Test Example
```typescript
import { render, fireEvent } from '@testing-library/react-native';

describe('Component', () => {
  it('should render correctly', () => {
    const { getByText } = render(<Component title="Test" />);
    expect(getByText('Test')).toBeTruthy();
  });
});
```

## Build & Deployment

### EAS Build Configuration
```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### Build Commands
```bash
# Development build
eas build --profile development --platform ios

# Preview build
eas build --profile preview

# Production build
eas build --profile production

# Submit to stores
eas submit
```

## Error Handling

### Error Boundaries
```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <View>
      <Text>Something went wrong:</Text>
      <Text>{error.message}</Text>
      <Button title="Try again" onPress={resetErrorBoundary} />
    </View>
  );
}

<ErrorBoundary FallbackComponent={ErrorFallback}>
  <App />
</ErrorBoundary>
```

## Accessibility

### Accessibility Best Practices
- Add accessibilityLabel to all interactive elements
- Use accessibilityRole for semantic meaning
- Implement accessibilityHint for complex interactions
- Test with screen readers (VoiceOver/TalkBack)
- Ensure proper color contrast ratios
- Support dynamic font sizes

```typescript
<TouchableOpacity
  accessibilityLabel="Submit form"
  accessibilityRole="button"
  accessibilityHint="Double tap to submit the form"
  onPress={handleSubmit}
>
  <Text>Submit</Text>
</TouchableOpacity>
```

## Animations

### Animation Libraries
- Use react-native-reanimated for performance
- Implement gestures with react-native-gesture-handler
- Use Lottie for complex animations
- Prefer native driver when possible

```typescript
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const offset = useSharedValue(0);

const animatedStyles = useAnimatedStyle(() => {
  return {
    transform: [{ translateX: offset.value }],
  };
});
```

## Debugging

### Debugging Tools
- Use Expo Dev Tools for debugging
- Enable React DevTools
- Use Flipper for network inspection
- Implement custom logging with expo-dev-client
- Use remote debugging sparingly (performance impact)
- Console.log with proper formatting

## Common Patterns

### Custom Hooks
```typescript
// useDebounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

### HOC Pattern
```typescript
export function withLoading<P>(Component: React.ComponentType<P>) {
  return (props: P & { loading?: boolean }) => {
    if (props.loading) {
      return <LoadingState />;
    }
    return <Component {...props} />;
  };
}
```

## TypeScript Configuration

### Strict TypeScript Settings
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Environment Variables

### Using expo-constants
```typescript
import Constants from 'expo-constants';

const ENV = {
  dev: {
    apiUrl: 'http://localhost:3000',
  },
  staging: {
    apiUrl: 'https://staging.api.com',
  },
  prod: {
    apiUrl: 'https://api.com',
  },
};

const getEnvVars = (env = Constants.manifest?.releaseChannel) => {
  if (env === 'staging') return ENV.staging;
  if (env === 'prod') return ENV.prod;
  return ENV.dev;
};

export default getEnvVars();
```

## Push Notifications

### Expo Notifications Setup
```typescript
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

## Biometrics

### Local Authentication
```typescript
import * as LocalAuthentication from 'expo-local-authentication';

async function authenticate() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (hasHardware && isEnrolled) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      fallbackLabel: 'Use passcode',
    });
    return result.success;
  }
  return false;
}
```

## Important Reminders

- NEVER use `any` or `unknown` types in TypeScript
- Always handle loading and error states
- Test on real devices before release
- Monitor performance with React DevTools
- Use Expo SDK packages when available
- Follow platform-specific guidelines (iOS HIG, Material Design)
- Implement proper offline support
- Optimize bundle size with Metro configuration
- Use proper git branching strategy for app releases
- Document complex business logic
