import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@/types/api';
import { ClaudeMessage, StreamMessage } from '@/types/claude';
import { sessionsApi } from '@/api/sessions';

interface SessionStore {
  currentSession: Session | null;
  sessions: Session[];
  messages: Record<string, ClaudeMessage[]>;
  isLoading: boolean;
  error: string | null;

  // Actions
  createSession: (projectPath: string, title?: string) => Promise<Session>;
  loadSession: (sessionId: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  addMessage: (sessionId: string, message: ClaudeMessage) => void;
  updateMessage: (sessionId: string, messageId: string, update: Partial<ClaudeMessage>) => void;
  appendToMessage: (sessionId: string, messageId: string, content: string) => void;
  setCurrentSession: (session: Session | null) => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessions: [],
      messages: {},
      isLoading: false,
      error: null,

      createSession: async (projectPath: string, title?: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionsApi.create({ projectPath, title });
          set((state) => ({
            sessions: [session, ...state.sessions],
            currentSession: session,
            messages: { ...state.messages, [session.id]: [] },
            isLoading: false,
          }));
          return session;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create session',
            isLoading: false,
          });
          throw error;
        }
      },

      loadSession: async (sessionId: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionsApi.get(sessionId);
          set((state) => ({
            currentSession: session,
            sessions: state.sessions.some(s => s.id === session.id)
              ? state.sessions.map(s => s.id === session.id ? session : s)
              : [session, ...state.sessions],
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load session',
            isLoading: false,
          });
          throw error;
        }
      },

      loadSessions: async () => {
        set({ isLoading: true, error: null });
        try {
          const sessions = await sessionsApi.list();
          set({ sessions, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load sessions',
            isLoading: false,
          });
          throw error;
        }
      },

      deleteSession: async (sessionId: string) => {
        set({ isLoading: true, error: null });
        try {
          await sessionsApi.delete(sessionId);
          set((state) => ({
            sessions: state.sessions.filter(s => s.id !== sessionId),
            currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
            messages: Object.fromEntries(
              Object.entries(state.messages).filter(([id]) => id !== sessionId)
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete session',
            isLoading: false,
          });
          throw error;
        }
      },

      addMessage: (sessionId: string, message: ClaudeMessage) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: [...(state.messages[sessionId] || []), message],
          },
        }));
      },

      updateMessage: (sessionId: string, messageId: string, update: Partial<ClaudeMessage>) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: (state.messages[sessionId] || []).map(msg =>
              msg.id === messageId ? { ...msg, ...update } : msg
            ),
          },
        }));
      },

      appendToMessage: (sessionId: string, messageId: string, content: string) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: (state.messages[sessionId] || []).map(msg =>
              msg.id === messageId
                ? { ...msg, content: msg.content + content }
                : msg
            ),
          },
        }));
      },

      setCurrentSession: (session: Session | null) => {
        set({ currentSession: session });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'session-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentSession: state.currentSession,
        sessions: state.sessions,
        messages: state.messages,
      }),
    }
  )
);