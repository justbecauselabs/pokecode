# Claude Code Mobile App

React Native Expo application for Claude Code - AI-powered coding assistant on mobile.

## Features

- **Native Performance** with React Native and Expo SDK 52
- **Real-time Chat** with Claude via Server-Sent Events
- **Code Viewer** with syntax highlighting
- **File Explorer** for browsing project files
- **Conversation History** with search
- **Dark/Light Theme** support
- **Offline Support** with local caching

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Default points to http://localhost:3001
   ```

3. **Start development:**
   ```bash
   pnpm start
   ```

4. **Run on devices:**
   ```bash
   pnpm ios      # iOS Simulator
   pnpm android  # Android Emulator
   ```

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication flow
│   ├── (tabs)/            # Main app tabs
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # UI components
│   ├── services/          # API and SSE clients
│   ├── stores/            # Zustand stores
│   ├── hooks/             # Custom hooks
│   ├── types/             # TypeScript types
│   └── constants/         # App constants
└── assets/                # Images and fonts
```

## Key Components

### Authentication
- JWT token management with Expo SecureStore
- Auto token refresh
- Protected routes with Expo Router

### Chat Interface
- Real-time streaming with SSE
- Markdown rendering
- Syntax highlighting for code blocks
- Tool execution visualization

### State Management
- **Zustand** for client state (auth, UI preferences)
- **React Query** for server state and caching
- **AsyncStorage** for persistence

## Development

### Running Tests
```bash
pnpm test
```

### Type Checking
```bash
pnpm type-check
```

### Linting
```bash
pnpm lint
```

## Building for Production

### Preview Builds
```bash
pnpm eas:build:preview
```

### Production Builds
```bash
pnpm eas:build:production
```

### Local Builds
```bash
pnpm prebuild
```

## Performance Optimizations

- **FlashList** for efficient list rendering
- **Memoization** of expensive components
- **Lazy loading** for code viewers
- **Image caching** with expo-image

## Debugging

1. **Expo Dev Tools:**
   - Press `j` in terminal to open debugger
   - Press `m` to open menu

2. **React Native Debugger:**
   - Install from: https://github.com/jhen0409/react-native-debugger
   - Enable from dev menu

3. **Performance Monitor:**
   - Shake device or press `⌘D` in iOS simulator
   - Enable "Show Perf Monitor"

## Troubleshooting

### Clear Cache
```bash
pnpm start --clear
```

### Reset Metro
```bash
rm -rf .expo
pnpm start
```

### iOS Issues
```bash
cd ios && pod install
```

### Android Issues
```bash
cd android && ./gradlew clean
```