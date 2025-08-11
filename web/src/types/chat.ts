export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
  promptId?: string
  streamMessages?: StreamMessage[]
}

export interface Prompt {
  id: string
  sessionId: string
  prompt: string
  response?: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  jobId?: string
  error?: string
  metadata?: {
    toolCalls?: number
    duration?: number
    tokenCount?: number
  }
  createdAt: string
  completedAt?: string
}

export interface StreamMessage {
  id: string
  type: 'connected' | 'message' | 'tool_use' | 'tool_result' | 'complete' | 'error'
  data?: unknown
  timestamp: string
  promptId: string
}

export interface SSEMessage {
  type: 'connected' | 'message' | 'tool_use' | 'tool_result' | 'complete' | 'error'
  data?: unknown
  timestamp?: string
}

export interface HistoryResponse {
  prompts: Prompt[]
  total: number
  limit: number
  offset: number
}