/**
 * Internal type definitions for the CLI application
 */

export interface Config {
  serverUrl: string;
  auth?: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name?: string;
    };
  };
  recentSessions?: RecentSession[];
  debug?: boolean;
  verbose?: boolean;
}

export interface RecentSession {
  id: string;
  projectPath: string;
  lastUsedAt: string;
  context?: string;
}

export interface AppState {
  isAuthenticated: boolean;
  currentSession?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface SSEMessage {
  type: 'connected' | 'message' | 'complete' | 'error';
  data?: string;
  error?: string;
}

export type Screen = 'auth' | 'session' | 'chat';

export interface NavigationState {
  currentScreen: Screen;
  previousScreen?: Screen;
}