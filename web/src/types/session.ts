export interface Session {
  id: string
  userId: string
  projectPath: string
  context?: string
  status: 'active' | 'inactive' | 'archived'
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  lastAccessedAt: string
}

export interface CreateSessionData {
  projectPath: string
  context?: string
}

export interface UpdateSessionData {
  context?: string
  status?: 'active' | 'inactive' | 'archived'
  metadata?: Record<string, unknown>
}