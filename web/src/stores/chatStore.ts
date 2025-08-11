import { create } from 'zustand'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ChatMessage, Prompt, SSEMessage, StreamMessage, HistoryResponse } from '../types/chat'
import { apiService } from '../services/api'
import { useAuthStore } from './authStore'

interface ChatState {
  messages: ChatMessage[]
  prompts: Prompt[]
  currentPrompt: Prompt | null
  isConnected: boolean
  isStreaming: boolean
  connectionError: string | null
  isLoading: boolean
  error: string | null
  streamMessages: Map<string, StreamMessage[]>
  
  // Actions
  sendMessage: (sessionId: string, content: string) => Promise<string>
  connectSSE: (sessionId: string, promptId: string) => EventSource | null
  addMessage: (message: ChatMessage) => void
  updateStreamingMessage: (content: string, complete?: boolean) => void
  addStreamMessage: (promptId: string, streamMessage: StreamMessage) => void
  loadPromptHistory: (sessionId: string) => Promise<void>
  setConnectionStatus: (connected: boolean, error?: string) => void
  clearMessages: () => void
  clearError: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  prompts: [],
  currentPrompt: null,
  isConnected: false,
  isStreaming: false,
  connectionError: null,
  isLoading: false,
  error: null,
  streamMessages: new Map(),

  sendMessage: async (sessionId: string, content: string) => {
    set({ isLoading: true, error: null })
    
    try {
      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      }
      
      get().addMessage(userMessage)
      
      // Create prompt on backend
      const prompt = await apiService.post<Prompt>(
        `/api/claude-code/sessions/${sessionId}/prompts`,
        { prompt: content }
      )
      
      set(state => ({
        prompts: [...state.prompts, prompt],
        currentPrompt: prompt,
        isLoading: false,
      }))
      
      return prompt.id
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to send message',
        isLoading: false,
      })
      throw error
    }
  },

  connectSSE: (sessionId: string, promptId: string) => {
    const { setConnectionStatus, updateStreamingMessage, addMessage, addStreamMessage } = get()
    
    try {
      // Use proxy-aware URL for Vite development
      const url = `/api/claude-code/sessions/${sessionId}/prompts/${promptId}/stream`
      
      // Get token from auth store
      const { tokens } = useAuthStore.getState()
      
      let assistantMessage: ChatMessage | null = null
      let controller: AbortController | null = new AbortController()
      let streamMessageCounter = 0
      
      // Use fetch-based EventSource that supports Authorization headers
      fetchEventSource(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
          'Accept': 'text/event-stream',
        },
        signal: controller.signal,
        
        async onopen(response) {
          if (response.ok) {
            setConnectionStatus(true)
            set({ isStreaming: true })
            console.log('SSE connected successfully')
          } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            // Client error, don't retry
            setConnectionStatus(false, `Authentication error: ${response.status}`)
            throw new Error(`HTTP ${response.status}`)
          } else {
            // Server error, will retry
            setConnectionStatus(false, `Server error: ${response.status}`)
            throw new Error(`HTTP ${response.status}`)
          }
        },
        
        onmessage(event) {
          try {
            const data: SSEMessage = JSON.parse(event.data)
            
            // Add all stream messages to the store
            const streamMessage: StreamMessage = {
              id: `stream-${promptId}-${streamMessageCounter++}`,
              type: data.type,
              data: data.data,
              timestamp: data.timestamp || new Date().toISOString(),
              promptId,
            }
            addStreamMessage(promptId, streamMessage)
            
            switch (data.type) {
              case 'connected':
                console.log('SSE connected:', data.data)
                break
                
              case 'message':
                if (!assistantMessage) {
                  assistantMessage = {
                    id: `assistant-${promptId}`,
                    role: 'assistant',
                    content: String(data.data || ''),
                    timestamp: new Date(),
                    isStreaming: true,
                    promptId,
                  }
                  addMessage(assistantMessage)
                } else {
                  updateStreamingMessage(String(data.data || ''))
                }
                break
                
              case 'tool_use':
                // Don't add tool messages to main chat - they're in the stream sidebar
                break
                
              case 'tool_result':
                // Don't add result messages to main chat - they're in the stream sidebar
                break
                
              case 'complete':
                // Refetch the message to get the final response
                apiService.get<HistoryResponse>(`/api/claude-code/sessions/${sessionId}/history`)
                  .then((historyResponse) => {
                    const prompt = historyResponse.prompts.find(p => p.id === promptId)
                    if (prompt?.response && assistantMessage) {
                      // Update the assistant message with the final response
                      set(state => ({
                        messages: state.messages.map(msg => 
                          msg.id === assistantMessage!.id
                            ? { ...msg, content: prompt.response!, isStreaming: false }
                            : msg
                        )
                      }))
                    }
                  })
                  .catch(console.error)
                
                set({ isStreaming: false })
                controller?.abort()
                controller = null
                break
                
              case 'error':
                console.error('SSE error:', data.data)
                const errorData = data.data as { error?: string } | string | undefined
                const errorMessage = typeof errorData === 'object' && errorData?.error ? errorData.error 
                  : typeof errorData === 'string' ? errorData 
                  : 'Unknown error'
                setConnectionStatus(false, errorMessage)
                set({ isStreaming: false })
                controller?.abort()
                controller = null
                break
            }
          } catch (parseError) {
            console.error('Failed to parse SSE message:', parseError)
          }
        },
        
        onerror(error) {
          console.error('SSE connection error:', error)
          setConnectionStatus(false, 'Connection error')
          set({ isStreaming: false })
          // fetchEventSource will handle retries automatically
        },
        
        onclose() {
          console.log('SSE connection closed')
          set({ isStreaming: false })
          controller = null
        }
      })
      
      // Return a mock EventSource-like object for compatibility
      return {
        close: () => {
          controller?.abort()
          controller = null
        }
      } as EventSource
      
    } catch (error) {
      console.error('Failed to connect SSE:', error)
      setConnectionStatus(false, 'Failed to connect')
      return null
    }
  },

  addMessage: (message: ChatMessage) => {
    set(state => ({
      messages: [...state.messages, message]
    }))
  },

  addStreamMessage: (promptId: string, streamMessage: StreamMessage) => {
    set(state => {
      const currentMessages = state.streamMessages.get(promptId) || []
      const newStreamMessages = new Map(state.streamMessages)
      newStreamMessages.set(promptId, [...currentMessages, streamMessage])
      return { streamMessages: newStreamMessages }
    })
  },

  updateStreamingMessage: (content: string, complete = false) => {
    set(state => ({
      messages: state.messages.map(msg => 
        msg.isStreaming 
          ? { 
              ...msg, 
              content: complete ? msg.content : content,
              isStreaming: !complete 
            }
          : msg
      )
    }))
  },

  loadPromptHistory: async (sessionId: string) => {
    set({ isLoading: true, error: null })
    
    try {
      const historyResponse = await apiService.get<HistoryResponse>(
        `/api/claude-code/sessions/${sessionId}/history`
      )
      
      // Extract prompts array from the response object
      const { prompts } = historyResponse
      
      // Convert prompts to messages (reverse order to show oldest first)
      const messages: ChatMessage[] = []
      
      prompts.reverse().forEach(prompt => {
        // Add user message
        messages.push({
          id: `user-${prompt.id}`,
          role: 'user',
          content: prompt.prompt,
          timestamp: new Date(prompt.createdAt),
        })
        
        // Add assistant response if available
        if (prompt.response) {
          messages.push({
            id: `assistant-${prompt.id}`,
            role: 'assistant',
            content: prompt.response,
            timestamp: new Date(prompt.completedAt || prompt.createdAt),
          })
        }
      })
      
      set({
        prompts,
        messages,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to load history',
        isLoading: false,
      })
    }
  },

  setConnectionStatus: (connected: boolean, error?: string) => {
    set({
      isConnected: connected,
      connectionError: error || null,
    })
  },

  clearMessages: () => {
    set({
      messages: [],
      prompts: [],
      currentPrompt: null,
      streamMessages: new Map(),
    })
  },

  clearError: () => set({ error: null }),
}))