# Mobile App Development Specification

## Project Overview
This document tracks the development progress, learnings, and specifications for the Pokecode Mobile app, a React Native + Expo application that provides mobile access to Claude Code functionality.

## Tech Stack
- **Framework**: React Native with Expo SDK 52
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Query + Zustand
- **Styling**: NativeWind (Tailwind for React Native)
- **API**: TypeScript client generated from OpenAPI schema
- **Storage**: AsyncStorage for persistence
- **Build Tool**: Bun (preferred over npm/yarn)

## Current Implementation Status

### ✅ Completed Features

#### Session Management (Sprint 1)
- **Session List Display**: Implemented home screen with session fetching and display
- **Session Card Component**: Shows project path, context, status, and last accessed time
- **Search & Filter**: Search by project path/context, filter by recent/all/active sessions
- **Delete Functionality**: Long-press to delete sessions with confirmation
- **React Query Integration**: Optimistic updates, background refetching, and caching
- **Error Handling**: Proper error states and retry mechanisms

**Implementation Details:**
- `useSessions()` hook with React Query for data fetching
- `SessionCard` component with NativeWind styling
- `SessionList` component with search, filter, and FlatList
- Updated home screen (`app/index.tsx`) to use SessionList
- Leverages existing API client (`src/api/rn-client.ts`)

### 🚧 In Progress
- None currently

### 📋 Planned Features

#### Chat Interface (Sprint 2)
- Chat screen implementation with message display
- Real-time message streaming 
- Tool execution visualization
- File attachment support

#### File Explorer (Sprint 3)
- Project file browsing
- File editing capabilities
- Syntax highlighting
- File operations (create, delete, rename)

#### Authentication (Sprint 4)
- User authentication flow
- Secure token storage
- Session persistence

#### Advanced Features (Future)
- Offline support for reading sessions/messages
- Push notifications for session updates
- Dark mode improvements
- Performance optimizations

## Architecture Decisions

### State Management Pattern
**Decision**: React Query + Lightweight Zustand
**Rationale**: 
- React Query provides superior caching, background refetching, and offline support
- Aligns with mobile best practices from CLAUDE.md
- Zustand used only for UI state (theme, navigation state)
- Avoids duplication of web app's Zustand session store

### Component Structure
**Decision**: Functional components with TypeScript, React.memo for performance
**Pattern**:
```typescript
// Component with proper typing and memoization
export const Component = memo(({ prop }: ComponentProps) => {
  // Implementation
});
```

### Styling Approach
**Decision**: NativeWind with className over StyleSheet
**Rationale**:
- Consistent with Tailwind patterns from web app
- Better design token usage
- Easier responsive design
- Follows mobile CLAUDE.md recommendations

### API Integration
**Decision**: Generated TypeScript client with React Query
**Benefits**:
- Type safety from OpenAPI schema
- Automatic API updates when backend changes
- Optimistic updates and caching
- Background sync capabilities

## Development Learnings

### Sprint 1 Learnings
1. **Generated Types**: The OpenAPI code generation works well - all session endpoints were immediately available with proper TypeScript types
2. **NativeWind Setup**: Works smoothly with React Native - no additional configuration needed
3. **React Query Migration**: Moving from Zustand to React Query for data fetching provides much better UX with caching and background updates
4. **Existing Utils**: The mobile app already has utility functions (like `formatRelativeTime`) that eliminate the need for additional dependencies

### Best Practices Established
1. **Hook Pattern**: Create custom hooks (e.g., `useSessions`) that wrap React Query mutations and queries
2. **Component Memoization**: Use `React.memo` for all components to prevent unnecessary re-renders
3. **Error Handling**: Always implement proper loading, error, and empty states
4. **Type Safety**: Leverage generated types from OpenAPI schema for all API interactions
5. **Utility Functions**: Use existing utility functions before adding new dependencies

## File Structure
```
mobile/
├── app/                     # Expo Router screens
│   └── index.tsx           # Home screen with SessionList
├── src/
│   ├── components/
│   │   ├── session/        # Session-related components
│   │   │   ├── SessionCard.tsx
│   │   │   └── SessionList.tsx
│   │   ├── shared/         # Shared UI components
│   │   └── ui/             # Basic UI components
│   ├── hooks/
│   │   └── useSessions.ts  # Session data management hook
│   ├── api/
│   │   ├── client.ts       # API client exports
│   │   ├── rn-client.ts    # React Native API client
│   │   └── generated/      # Auto-generated from OpenAPI
│   ├── stores/             # Zustand stores for UI state
│   ├── utils/              # Utility functions
│   └── constants/          # App constants and theme
```

## API Integration

### Endpoints Used
- `GET /api/claude-code/sessions` - Fetch all sessions
- `POST /api/claude-code/sessions` - Create new session
- `PATCH /api/claude-code/sessions/:id` - Update session
- `DELETE /api/claude-code/sessions/:id` - Delete session

### Type Safety
All API calls use generated TypeScript types:
```typescript
type Session = GetApiClaudeCodeSessionsResponse[0];
```

## Performance Considerations

### Implemented Optimizations
1. **React.memo**: All components are memoized to prevent unnecessary re-renders
2. **FlatList**: Used for session list rendering with proper keyExtractor
3. **React Query Caching**: Sessions cached for 30 seconds with background refetching
4. **Debounced Search**: Search input naturally debounced by React Query stale time

### Future Optimizations
1. **Virtualization**: Implement FlashList for very large session lists
2. **Image Optimization**: Use expo-image for any future image content
3. **Bundle Optimization**: Code splitting for chat features when implemented

## Testing Strategy

### Current Coverage
- Component unit tests planned for Session components
- Hook testing with React Query Test Utils
- API integration testing with MSW

### Testing Approach
```typescript
// Example test pattern for hooks
describe('useSessions', () => {
  it('should fetch and cache sessions', async () => {
    // Test with React Query Test Utils
  });
});
```

## Deployment & Build

### Build Commands
```bash
# Development
bun start                 # Start Expo dev server
bun ios                   # iOS simulator
bun android               # Android emulator

# Production  
bun eas:build:preview     # Preview build
bun eas:build:production  # Production build
```

### Environment Configuration
- API URL configured via expo-constants
- Supports development, staging, and production environments

## Next Sprint Planning

### Sprint 2 Goals: Chat Interface
1. Implement chat screen with Expo Router navigation
2. Message display with tool execution visualization  
3. Real-time message updates (polling initially)
4. Basic message input and sending

### Technical Debt
1. Add comprehensive error boundaries
2. Implement proper accessibility labels
3. Add loading skeletons for better UX
4. Set up automated testing pipeline

## Conclusion
The session management feature successfully replicates the web app's functionality with mobile-optimized patterns. React Query integration provides superior data management compared to manual Zustand stores. The foundation is solid for building additional features.

---
*Last Updated: Sprint 1 - Session Management Complete*