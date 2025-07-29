# Claude Code Mobile App - MVP Implementation Spec

## Overview

Claude Code Mobile is a native mobile application that provides a mobile-optimized interface for interacting with Claude Code through the claude-linear backend. Instead of terminal-based interactions, users can send prompts and receive structured responses through a native UI.

## Architecture

### Backend Integration

The mobile app will leverage the existing claude-linear backend infrastructure:
- **Claude Code SDK Integration**: Already implemented in `src/worker/queue/job-processor.ts`
- **API Endpoints**: Extend existing Next.js API routes for mobile client needs
- **Queue System**: Reuse BullMQ/Redis for async prompt processing
- **Storage**: PostgreSQL for conversation history, R2 for artifacts

### Mobile Client Architecture

**Technology Stack**:
- **React Native** with Expo for cross-platform development
- **TypeScript** for type safety
- **React Query** for server state management
- **React Navigation** for routing
- **Async Storage** for local persistence
- **WebSocket/SSE** for real-time streaming

**Core Components**:
1. **Prompt Interface**: Text input with voice-to-text support
2. **Response Viewer**: Markdown renderer with syntax highlighting
3. **File Browser**: Navigate and view code files
4. **Tool Execution Viewer**: Visual representation of tool calls
5. **Conversation History**: Persistent chat interface

## API Design

### New Endpoints Required

```typescript
// Start a new Claude Code session
POST /api/claude-code/sessions
Body: { projectPath: string, context?: string }
Response: { sessionId: string, status: 'created' }

// Send a prompt to Claude Code
POST /api/claude-code/sessions/:sessionId/prompts
Body: { prompt: string, allowedTools?: string[] }
Response: { promptId: string, status: 'queued' }

// Stream responses (Server-Sent Events)
GET /api/claude-code/sessions/:sessionId/prompts/:promptId/stream
Response: EventStream of:
  - { type: 'message', content: string }
  - { type: 'tool_use', tool: string, params: object }
  - { type: 'tool_result', result: string }
  - { type: 'complete', summary: object }

// Get session history
GET /api/claude-code/sessions/:sessionId/history
Response: { prompts: Prompt[], messages: Message[] }

// File operations
GET /api/claude-code/sessions/:sessionId/files
GET /api/claude-code/sessions/:sessionId/files/*path
POST /api/claude-code/sessions/:sessionId/files/*path
```

### Backend Modifications

1. **New Worker Type**: Create `claude-code-processor.ts` alongside existing job processor
2. **Session Management**: Add session table to track active Claude Code sessions
3. **Streaming Support**: Implement SSE endpoint for real-time message streaming
4. **File Access API**: Secure file browsing/editing within project boundaries

## Mobile App Features

### MVP Features

1. **Project Selection**
   - List available repositories (from GITHUB_REPO config)
   - Clone/pull latest changes
   - Select working directory

2. **Prompt Interface**
   - Text input with multiline support
   - Voice input with speech-to-text
   - Prompt templates/shortcuts
   - Cancel/interrupt running prompts

3. **Response Display**
   - Markdown rendering with syntax highlighting
   - Collapsible tool execution blocks
   - File diff viewer for edits
   - Copy code blocks

4. **File Management**
   - Browse project files
   - View file contents with syntax highlighting
   - See recent file changes
   - Quick jump to edited files

5. **Session Management**
   - Conversation history
   - Resume previous sessions
   - Export conversation as markdown

### UI/UX Design

**Main Screens**:
1. **Home**: Project selector and recent sessions
2. **Chat**: Primary interface with prompt input and response stream
3. **Files**: File browser with code viewer
4. **History**: Browse and search previous conversations

**Key Interactions**:
- Swipe gestures for navigation
- Pull-to-refresh for file updates
- Long-press for context menus
- Pinch-to-zoom for code viewing

## Implementation Plan

### Phase 1: Backend API (Week 1)
- [ ] Create claude-code session management schema
- [ ] Implement session and prompt API endpoints
- [ ] Add SSE streaming for real-time responses
- [ ] Create file access API with security boundaries
- [ ] Extend worker to handle claude-code jobs

### Phase 2: Mobile App Foundation (Week 2)
- [ ] Initialize React Native/Expo project
- [ ] Set up TypeScript and core dependencies
- [ ] Implement API client with React Query
- [ ] Create basic navigation structure
- [ ] Build authentication flow

### Phase 3: Core Features (Week 3-4)
- [ ] Develop prompt input interface
- [ ] Implement response streaming and display
- [ ] Build markdown renderer with syntax highlighting
- [ ] Create file browser and viewer
- [ ] Add conversation history

### Phase 4: Polish & Testing (Week 5)
- [ ] Implement error handling and offline support
- [ ] Add loading states and animations
- [ ] Create onboarding flow
- [ ] Performance optimization
- [ ] Beta testing and bug fixes

## Security Considerations

1. **Authentication**: JWT tokens with refresh mechanism
2. **File Access**: Sandbox file operations to project directory
3. **Rate Limiting**: Prevent API abuse
4. **Input Validation**: Sanitize prompts and file paths
5. **Secure Storage**: Encrypt sensitive data locally

## Future Enhancements

- Multiple project support
- Collaborative sessions
- Custom tool integration
- Offline mode with sync
- iPad/tablet optimized UI
- GitHub integration for commits/PRs
- Terminal emulator for bash commands
- Plugin system for extensions