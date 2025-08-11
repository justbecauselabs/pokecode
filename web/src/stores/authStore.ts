import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import type { User, Tokens, LoginData, RegisterData, AuthResponse } from '../types/auth'
import { apiService } from '../services/api'

interface AuthState {
  user: User | null
  tokens: Tokens | null
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (data: LoginData) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isLoading: false,
      error: null,

      login: async (data: LoginData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await apiService.post<AuthResponse>('/api/auth/login', data)
          set({
            user: response.user,
            tokens: {
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
            },
            isLoading: false,
          })
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Login failed',
            isLoading: false,
          })
          throw error
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await apiService.post<AuthResponse>('/api/auth/register', data)
          set({
            user: response.user,
            tokens: {
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
            },
            isLoading: false,
          })
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Registration failed',
            isLoading: false,
          })
          throw error
        }
      },

      logout: () => {
        const { tokens } = get()
        if (tokens?.refreshToken) {
          // Fire-and-forget logout request
          apiService.post('/api/auth/logout', { refreshToken: tokens.refreshToken }).catch(() => {})
        }
        set({
          user: null,
          tokens: null,
          error: null,
        })
      },

      refreshToken: async () => {
        const { tokens } = get()
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token available')
        }

        try {
          // Use direct axios call to avoid interceptor loops
          const response = await axios.post<{ accessToken: string; refreshToken: string }>(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/refresh`,
            {
              refreshToken: tokens.refreshToken,
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 30000,
            }
          )
          set({
            tokens: {
              accessToken: response.data.accessToken,
              refreshToken: response.data.refreshToken,
            },
          })
        } catch (error) {
          set({
            user: null,
            tokens: null,
          })
          throw error
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
      }),
    }
  )
)