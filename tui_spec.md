# PokeCode CLI - Technical Specification

## Overview
A Terminal User Interface (TUI) application for interacting with the PokeCode backend API, providing an interactive chat interface with real-time Server-Sent Events (SSE) streaming support.

## Technology Stack

### Core Technologies
- **Runtime**: Bun (latest)
- **Language**: TypeScript
- **UI Framework**: Hybrid approach
  - **Clack** (@clack/prompts) - Authentication and setup flows
  - **Ink** (v3+) - Main chat interface with React-based components
- **HTTP Client**: Native fetch API (Bun built-in)
- **SSE Client**: EventSource API with reconnection logic
- **Syntax Highlighting**: Prism.js or Shiki for code blocks
- **Configuration**: JSON-based local config (~/.pokecode-cli/)

## Architecture

### Directory Structure
```
/cli
├── src/
│   ├── commands/          # CLI command entry points
│   │   ├── index.ts       # Main entry
│   │   ├── login.ts       # Authentication command
│   │   ├── chat.ts        # Chat session command
│   │   ├── logout.ts      # Logout command
│   │   └── config.ts      # Configuration management
│   ├── components/        # Ink React components
│   │   ├── ChatInterface.tsx
│   │   ├── MessageList.tsx
│   │   ├── InputBox.tsx
│   │   ├── StatusBar.tsx
│   │   ├── CodeBlock.tsx  # Syntax highlighted code
│   │   └── LoadingSpinner.tsx
│   ├── services/          # Business logic
│   │   ├── api.ts         # API client wrapper
│   │   ├── auth.ts        # Authentication service
│   │   ├── session.ts     # Session management
│   │   ├── sse.ts         # SSE streaming handler
│   │   └── config.ts      # Config file management
│   ├── utils/
│   │   ├── logger.ts      # Debug/verbose logging
│   │   ├── errors.ts      # Error handling
│   │   ├── validators.ts  # Input validation
│   │   └── formatting.ts  # Text formatting utilities
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   └── index.ts           # CLI entry point
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

## Features

### 1. Authentication Flow

#### Login Command (`pokecode login`)
```typescript
// Using Clack for clean authentication prompts
interface LoginFlow {
  - Email input with validation
  - Password input (masked)
  - Optional: Remember credentials (Y/n)
  - Server URL configuration (default: http://localhost:3001)
}
```

**Token Management:**
- Store tokens in `~/.pokecode-cli/config.json`
- Automatic token refresh on 401 responses
- Secure storage with file permissions (600)

### 2. Chat Interface

#### Main Chat View (Ink Components)
```
┌─────────────────────────────────────────────────────┐
│ PokeCode CLI v1.0.0 | Session: project-xyz          │
├─────────────────────────────────────────────────────┤
│                                                      │
│ User: How do I create a new component?              │
│                                                      │
│ Assistant: To create a new component, you can...    │
│ ```jsx                                              │
│ const MyComponent = () => {                         │
│   return <div>Hello World</div>;                    │
│ }                                                    │
│ ```                                                  │
│                                                      │
│ User: Thanks! Can you show me hooks?                │
│                                                      │
│ Assistant: ▊ (streaming...)                         │
│                                                      │
├─────────────────────────────────────────────────────┤
│ > Type your message... (Ctrl+Enter to send)         │
└─────────────────────────────────────────────────────┘
 [Ctrl+C: Cancel] [Ctrl+L: Clear] [Ctrl+D: Exit]
```

### 3. Session Management

**Single Session Focus:**
- Auto-create or resume most recent session
- Display current project path and context
- Session metadata in status bar
- Graceful session cleanup on exit

### 4. Real-time SSE Streaming

**Implementation:**
```typescript
interface SSEHandler {
  - Automatic reconnection with exponential backoff
  - Event type handling: connected, message, complete, error
  - Heartbeat monitoring (30s timeout)
  - Graceful degradation on connection loss
  - Stream cancellation support
}
```

**Visual Feedback:**
- Streaming indicator (animated cursor)
- Partial message rendering
- Error state visualization
- Connection status in status bar

### 5. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Send message |
| Ctrl+C | Cancel current operation |
| Ctrl+L | Clear chat history (visual only) |
| Ctrl+D | Exit application |
| Tab | Navigate between UI elements |
| Escape | Cancel input/close dialogs |
| ↑/↓ | Navigate message history |

### 6. Syntax Highlighting

**Code Block Rendering:**
- Language detection from markdown fence
- Theme: OneDark or Dracula (dark terminal friendly)
- Line numbers for multi-line blocks
- Copy indicator on hover/focus

**Supported Languages:**
- JavaScript/TypeScript
- Python
- Go
- Rust
- HTML/CSS
- JSON/YAML
- Bash/Shell
- SQL

### 7. Debug/Verbose Mode

**Debug Levels:**
```bash
pokecode chat --debug        # Show API calls
pokecode chat --verbose      # Show all internal operations
pokecode chat --trace        # Include request/response bodies
```

**Debug Output:**
- API request/response logging
- SSE event stream raw data
- Token refresh attempts
- Connection state changes
- Error stack traces

## API Integration

### Endpoints Used

1. **Authentication**
   - POST `/api/auth/login`
   - POST `/api/auth/refresh`
   - POST `/api/auth/logout`
   - GET `/api/auth/me`

2. **Session Management**
   - POST `/api/claude-code/sessions`
   - GET `/api/claude-code/sessions`
   - PATCH `/api/claude-code/sessions/:sessionId`

3. **Chat/Prompts**
   - POST `/api/claude-code/sessions/:sessionId/prompts`
   - GET `/api/claude-code/sessions/:sessionId/prompts/:promptId/stream` (SSE)

### Request Headers
```typescript
{
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'X-Client-Version': 'cli-1.0.0',
  'X-Debug-Mode': debugMode ? 'true' : 'false'
}
```

## Error Handling

### User-Friendly Error Messages
```typescript
ErrorType -> User Message Mapping:
- NetworkError: "Connection failed. Check your internet connection."
- AuthError: "Authentication failed. Please login again."
- SessionError: "Session expired. Creating new session..."
- StreamError: "Message stream interrupted. Reconnecting..."
- ValidationError: "Invalid input. Please check and try again."
```

### Recovery Strategies
1. **Auto-retry** with exponential backoff for network errors
2. **Token refresh** on 401 responses
3. **Session recreation** on session errors
4. **Graceful degradation** for SSE failures

## Configuration

### Config File Structure (`~/.pokecode-cli/config.json`)
```json
{
  "auth": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "2024-01-01T00:00:00Z"
  },
  "server": {
    "url": "http://localhost:3001",
    "timeout": 30000
  },
  "session": {
    "lastSessionId": "...",
    "projectPath": "/path/to/project"
  },
  "preferences": {
    "theme": "dark",
    "syntaxTheme": "onedark",
    "debugMode": false,
    "autoReconnect": true
  }
}
```

## Performance Considerations

1. **Streaming Optimization**
   - Chunk processing for large responses
   - Virtual scrolling for long chat histories
   - Debounced UI updates during streaming

2. **Memory Management**
   - Message buffer limit (last 100 messages)
   - Periodic garbage collection
   - Stream cleanup on component unmount

3. **Network Efficiency**
   - Request deduplication
   - Smart polling vs SSE selection
   - Connection pooling

## Security

1. **Token Storage**
   - File permissions: 600 (user read/write only)
   - Never log tokens in debug mode
   - Clear tokens on logout

2. **Input Sanitization**
   - Escape special characters in display
   - Validate all user inputs
   - Prevent injection attacks

3. **SSL/TLS**
   - Support for HTTPS endpoints
   - Certificate validation
   - Configurable SSL options

## Testing Strategy

1. **Unit Tests**
   - Service layer logic
   - API client methods
   - Utility functions

2. **Integration Tests**
   - Authentication flow
   - Session management
   - SSE streaming

3. **E2E Tests**
   - Complete user workflows
   - Error recovery scenarios
   - Keyboard navigation

## Development Workflow

### Setup
```bash
cd cli
bun install
bun run dev
```

### Build
```bash
bun run build
bun link  # For global installation
```

### Commands
```bash
pokecode login                    # Authenticate
pokecode chat                     # Start chat session
pokecode chat --debug            # Debug mode
pokecode logout                   # Clear credentials
pokecode config get              # View config
pokecode config set server.url   # Update config
```

## Dependencies

### Production
```json
{
  "ink": "^3.2.0",
  "@clack/prompts": "^0.7.0",
  "ink-syntax-highlight": "^1.0.0",
  "eventsource": "^2.0.0",
  "chalk": "^5.0.0",
  "commander": "^11.0.0"
}
```

### Development
```json
{
  "@types/node": "^20.0.0",
  "typescript": "^5.0.0",
  "@types/react": "^18.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0"
}
```

## Future Enhancements

1. **File Operations** (Phase 2)
   - Upload/download capabilities
   - File tree navigation
   - Inline file editing

2. **Multiple Sessions** (Phase 3)
   - Session switching
   - Concurrent chat windows
   - Session comparison

3. **Export Features** (Phase 4)
   - Markdown export
   - PDF generation
   - Code extraction

4. **Collaboration** (Phase 5)
   - Shared sessions
   - Real-time collaboration
   - Team workspaces

## Success Metrics

1. **Performance**
   - SSE connection < 500ms
   - Message rendering < 50ms
   - Token refresh < 1s

2. **Reliability**
   - 99% uptime for SSE connection
   - Automatic recovery from errors
   - Zero data loss

3. **User Experience**
   - Intuitive keyboard navigation
   - Clear error messages
   - Responsive UI updates

## Conclusion

This CLI tool provides a robust, user-friendly interface for interacting with the PokeCode backend. The hybrid approach using Clack for authentication and Ink for the chat interface ensures the best user experience while maintaining code simplicity. The focus on single-session interaction, syntax highlighting, and comprehensive keyboard shortcuts makes it an efficient tool for API testing and development workflows.