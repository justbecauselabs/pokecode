import type { Provider } from './index';

export type CreateSessionRequest = {
  projectPath: string;
  provider: Provider;
};

export type Session = {
  id: string;
  provider: Provider;
  projectPath: string;
  name: string;
  claudeDirectoryPath: string | null;
  context?: string;
  state: 'active' | 'inactive';
  metadata?: unknown;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastAccessedAt: string; // ISO
  isWorking: boolean;
  currentJobId: string | null;
  lastJobStatus: string | null;
  messageCount: number;
  tokenCount: number;
};

export type ListSessionsQuery = {
  state?: 'active' | 'inactive' | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export type ListSessionsResponse = {
  sessions: Session[];
  total: number;
  limit: number;
  offset: number;
};

export type UpdateSessionRequest = {
  context?: string | undefined;
  metadata?: unknown;
};

export type SessionParams = { sessionId: string };
