import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, CreateSessionData, UpdateSessionData } from '../types/session'
import { apiService } from '../services/api'

interface SessionState {
  currentSession: Session | null
  sessions: Session[]
  recentSessions: Session[]
  isLoading: boolean
  error: string | null
  
  // Actions
  createSession: (data: CreateSessionData) => Promise<Session>
  selectSession: (id: string) => void
  loadSessions: () => Promise<void>
  updateSession: (id: string, data: UpdateSessionData) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  clearError: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessions: [],
      recentSessions: [],
      isLoading: false,
      error: null,

      createSession: async (data: CreateSessionData) => {
        set({ isLoading: true, error: null })
        try {
          const session = await apiService.post<Session>('/api/claude-code/sessions', data)
          
          set(state => ({
            sessions: [session, ...state.sessions],
            recentSessions: [session, ...state.recentSessions.slice(0, 4)],
            currentSession: session,
            isLoading: false,
          }))
          
          return session
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Failed to create session',
            isLoading: false,
          })
          throw error
        }
      },

      selectSession: (id: string) => {
        const { sessions } = get()
        const session = sessions.find(s => s.id === id)
        if (session) {
          set({ currentSession: session })
          // Update recent sessions
          set(state => ({
            recentSessions: [
              session,
              ...state.recentSessions.filter(s => s.id !== id).slice(0, 4)
            ]
          }))
        }
      },

      loadSessions: async () => {
        set({ isLoading: true, error: null })
        try {
          const sessions = await apiService.get<Session[]>('/api/claude-code/sessions')
          set({
            sessions: sessions.sort((a, b) => 
              new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
            ),
            isLoading: false,
          })
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Failed to load sessions',
            isLoading: false,
          })
        }
      },

      updateSession: async (id: string, data: UpdateSessionData) => {
        try {
          const updatedSession = await apiService.patch<Session>(`/api/claude-code/sessions/${id}`, data)
          
          set(state => ({
            sessions: state.sessions.map(s => s.id === id ? updatedSession : s),
            currentSession: state.currentSession?.id === id ? updatedSession : state.currentSession,
          }))
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Failed to update session',
          })
          throw error
        }
      },

      deleteSession: async (id: string) => {
        try {
          await apiService.delete(`/api/claude-code/sessions/${id}`)
          
          set(state => ({
            sessions: state.sessions.filter(s => s.id !== id),
            recentSessions: state.recentSessions.filter(s => s.id !== id),
            currentSession: state.currentSession?.id === id ? null : state.currentSession,
          }))
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Failed to delete session',
          })
          throw error
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'session-storage',
      partialize: (state) => ({
        currentSession: state.currentSession,
        recentSessions: state.recentSessions,
      }),
    }
  )
)