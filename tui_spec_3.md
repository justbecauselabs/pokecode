# PokeCode CLI - Final Technical Specification

## 1. Overview & Goals

This document specifies a Terminal User Interface (TUI) for interacting with the PokeCode backend API.

- **Primary Goal**: To serve as an efficient internal tool for testing the backend API end-to-end via an interactive terminal interface.
- **Core Experience**: A responsive chat interface with real-time streaming of assistant responses.
- **Scope**: This spec focuses on an initial MVP. Advanced features like file operations or multi-session management are considered future enhancements.

## 2. Technology Stack

- **Runtime**: Bun (v1.0+)
- **Language**: TypeScript
- **UI Framework (Hybrid)**:
  - **@clack/prompts**: For simple, clean, and guided flows like login, registration, and initial setup.
  - **Ink (v4+)**: For the main interactive chat interface, leveraging its React-based component model.
- **HTTP Client**: Native `fetch` API provided by Bun.
- **SSE Parser**: `eventsource-parser` for lightweight and efficient Server-Sent Event stream handling.
- **Syntax Highlighting**: A library like `ink-syntax-highlight` to render code blocks clearly within the terminal.
- **Styling**: `chalk` for terminal colors and styling.

## 3. Architecture

### Project Structure (within `/cli`)

A simplified structure focused on the MVP, balancing separation of concerns with ease of navigation.

```
/cli
├── src/
│   ├── index.ts           # CLI entry point, starts Ink app
│   ├── app.tsx            # Top-level Ink component, handles routing
│   ├── components/        # Reusable Ink components
│   │   ├── ChatView.tsx
│   │   ├── Message.tsx
│   │   ├── PromptInput.tsx
│   │   ├── StatusBar.tsx
│   │   └── CodeBlock.tsx
│   ├── screens/           # Top-level views for different states
│   │   ├── AuthScreen.tsx
│   │   ├── SessionScreen.tsx
│   │   └── ChatScreen.tsx
│   ├── services/          # Core logic (API, auth, config)
│   │   ├── api.ts         # Backend API client
│   │   ├── auth.service.ts # Authentication logic
│   │   ├── sse.service.ts # SSE connection management
│   │   └── config.service.ts # Manages local config file
│   └── types/
│       ├── api.ts         # Types related to the backend API
│       └── index.ts       # General internal types
├── package.json
├── tsconfig.json
└── README.md
```

## 4. Features & UX Flow

### Step 1: Initial Startup
- On first run (or after logout), the app checks for `~/.pokecode-cli/config.json`.
- If no token is found, it presents the **Auth Screen** using Clack prompts: `[Login]`, `[Register]`.

### Step 2: Authentication (`@clack/prompts`)
- **Register**: Prompts for `email`, `password` (masked), and `name` (optional). On success, stores tokens and proceeds.
- **Login**: Prompts for `email` and `password`. On success, stores tokens and proceeds.
- **Token Management**:
  - Access and refresh tokens are stored in `~/.pokecode-cli/config.json`.
  - The API service will automatically attempt to refresh the access token upon receiving a `401 Unauthorized` response. If the refresh fails, the user is prompted to log in again.
  - On logout, tokens are cleared from the config file and revoked via the API.

### Step 3: Session Management
- After login, the user is presented with the **Session Screen**.
- **Options**:
  - **[Create New Session]**: Prompts the user for a `projectPath`.
  - **[Select Recent Session]**: Lists the 5 most recent sessions for quick re-entry.
- The chosen `sessionId` is stored in memory for the duration of the app's run.

### Step 4: Chat Interface (`Ink`)
- The main view for interacting with the assistant.

**Layout:**
```
┌───────────────────────────────────────────────────────────────┐
│ PokeCode | Session: /path/to/project | user@email.com          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ > How do I write a component in React?                        │
│                                                               │
│ Assistant: Sure, here is a simple functional component:       │
│ ```tsx                                                        │
│ export const MyComponent = () => (                            │
│   <div>Hello, World!</div>                                    │
│ );                                                             │
│ ```                                                            │
│                                                               │
│ Assistant: ▊ (streaming...)                                  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ > Type a message...                                           │
└───────────────────────────────────────────────────────────────┘
 [Ctrl+C: Exit] [Ctrl+L: Clear] [Esc: New Session]
```

**Functionality**:
- **Real-time Streaming**: Assistant responses are streamed token-by-token and appended to the message view in real-time.
- **Syntax Highlighting**: Code blocks in Markdown fences are automatically highlighted.
- **Status Bar**: Displays the current session path and logged-in user.

### 5. Keyboard Shortcuts

| Shortcut | Action                               |
|----------|--------------------------------------|
| `Enter`    | Send message from input box          |
| `Ctrl+C`   | Exit the application                 |
| `Ctrl+L`   | Clear the chat history (visual only) |
| `Esc`      | Return to the Session Screen       |
| `↑`/`↓`    | Navigate command history in input box|

### 6. API Integration

- **Base URL**: Configurable, defaults to `http://localhost:3001`.
- **Endpoints**:
  - **Auth**: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/refresh`, `POST /api/auth/logout`
  - **Sessions**: `POST /api/claude-code/sessions`
  - **Prompts**: `POST /api/claude-code/sessions/:sessionId/prompts`
  - **Streaming**: `GET /api/claude-code/sessions/:sessionId/prompts/:promptId/stream` (SSE)
- **Headers**: All authenticated requests will include `Authorization: Bearer <accessToken>`.

### 7. Error Handling

- **Connection Errors**: A non-blocking message will appear if the API is unreachable.
- **Auth Errors (`401`)**: Trigger automatic token refresh. If refresh fails, transition to the Login screen.
- **Stream Errors**: If the SSE connection is interrupted, a message will indicate the issue, and the system will attempt a graceful reconnection if possible.

### 8. Configuration

- **Location**: `~/.pokecode-cli/config.json`
- **Permissions**: The file should be created with `600` permissions (read/write for user only).
- **Structure**:
  ```json
  {
    "serverUrl": "http://localhost:3001",
    "auth": {
      "accessToken": "...",
      "refreshToken": "...",
      "user": { "id": "...", "email": "..." }
    },
    "recentSessions": [
      { "id": "<uuid>", "projectPath": "/path/to/project", "lastUsedAt": "..." }
    ]
  }
  ```

## 9. MVP Checklist

- [ ] **1. Setup**: Create the `/cli` directory with `package.json` and `tsconfig.json`.
- [ ] **2. Config Service**: Implement `config.service.ts` to handle read/write of the JSON config.
- [ ] **3. Auth Flow**: Build the Clack-based `AuthScreen` for login and registration.
- [ ] **4. API Service**: Create `api.ts` with a `fetch` wrapper that handles base URL, headers, and automatic token refresh.
- [ ] **5. Session Flow**: Build the `SessionScreen` to create or select a session.
- [ ] **6. Chat UI**: Implement the core `ChatScreen` using Ink, including `ChatView`, `PromptInput`, and `StatusBar`.
- [ ] **7. SSE Integration**: Implement `sse.service.ts` and connect it to the `ChatView` to stream responses.
- [ ] **8. Syntax Highlighting**: Integrate a syntax highlighting component for code blocks.
- [ ] **9. Entry Point**: Tie everything together in `index.ts` and `app.tsx`.

## 10. Implementation TODO & Milestones

### Milestone 1: Project Setup & Configuration Service
- [ ] Create `/cli` directory structure
- [ ] Initialize `package.json` with Bun and dependencies
- [ ] Configure `tsconfig.json` with strict TypeScript settings
- [ ] Create types directory with API and internal types
- [ ] Implement `config.service.ts` for local config management
- [ ] Add config file permissions (600) handling
- [ ] Create base error handling utilities

### Milestone 2: Authentication Flow
- [ ] Implement `auth.service.ts` with token management
- [ ] Create Clack-based login flow
- [ ] Create Clack-based registration flow
- [ ] Implement automatic token refresh logic
- [ ] Add logout functionality with token cleanup
- [ ] Handle auth error states and user feedback

### Milestone 3: API Service & Session Management
- [ ] Create `api.ts` with fetch wrapper
- [ ] Add request/response interceptors for auth
- [ ] Implement session creation endpoint integration
- [ ] Implement session listing endpoint integration
- [ ] Create SessionScreen component with Clack
- [ ] Add recent sessions storage in config

### Milestone 4: Chat UI Components
- [ ] Create base Ink app structure (`app.tsx`)
- [ ] Implement `ChatScreen.tsx` main container
- [ ] Create `ChatView.tsx` for message display
- [ ] Implement `Message.tsx` component
- [ ] Create `PromptInput.tsx` with command history
- [ ] Implement `StatusBar.tsx` with session info
- [ ] Add `CodeBlock.tsx` with syntax highlighting

### Milestone 5: SSE Integration & Real-time Streaming
- [ ] Implement `sse.service.ts` with eventsource-parser
- [ ] Add SSE connection management with reconnection
- [ ] Integrate streaming into ChatView component
- [ ] Handle stream interruptions gracefully
- [ ] Add streaming visual indicators
- [ ] Implement message buffering and rendering

### Milestone 6: Polish & Testing
- [ ] Add keyboard shortcuts (Ctrl+C, Ctrl+L, Esc)
- [ ] Implement command history navigation
- [ ] Add debug/verbose mode support
- [ ] Create comprehensive error messages
- [ ] Add connection status indicators
- [ ] Write README with usage instructions
- [ ] Manual testing checklist completion

## 11. Dependencies

### Production
```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "chalk": "^5.3.0",
    "eventsource-parser": "^1.1.2",
    "ink": "^4.4.1",
    "ink-syntax-highlight": "^2.0.0",
    "react": "^18.2.0"
  }
}
```

### Development
```json
{
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```
