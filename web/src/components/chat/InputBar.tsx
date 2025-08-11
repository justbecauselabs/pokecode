import React, { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Send, Square } from 'lucide-react'
import { cn } from '../../lib/utils'

interface InputBarProps {
  sessionId: string
  onMessageSent?: (promptId: string) => void
  disabled?: boolean
}

export function InputBar({ sessionId, onMessageSent, disabled }: InputBarProps) {
  const { sendMessage, isLoading, isStreaming, error, clearError } = useChatStore()
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isSending = isLoading || isStreaming

  useEffect(() => {
    if (textareaRef.current) {
      // Auto-resize textarea
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [message])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isSending || disabled) return

    clearError()
    
    try {
      // Add to history
      setHistory(prev => [trimmedMessage, ...prev.slice(0, 49)]) // Keep last 50
      setHistoryIndex(-1)
      
      const promptId = await sendMessage(sessionId, trimmedMessage)
      setMessage('')
      
      if (onMessageSent) {
        onMessageSent(promptId)
      }
    } catch (error) {
      // Error is handled by the store
      console.error('Failed to send message:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    } else if (e.key === 'ArrowUp' && (e.currentTarget as HTMLTextAreaElement).selectionStart === 0) {
      e.preventDefault()
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setMessage(history[newIndex] || '')
      }
    } else if (e.key === 'ArrowDown' && (e.currentTarget as HTMLTextAreaElement).selectionStart === message.length) {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setMessage(history[newIndex] || '')
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setMessage('')
      }
    }
  }

  const handleStopGeneration = () => {
    // TODO: Implement stop generation API call
    console.log('Stop generation requested')
  }

  return (
    <div className="border-t bg-background p-4">
      {error && (
        <div className="mb-3 text-sm text-destructive">
          {error}
        </div>
      )}
      
      <Card className="overflow-hidden">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3">
          <div className="flex-1 min-h-0">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Claude Code..."
              className={cn(
                'w-full resize-none border-0 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0',
                'min-h-[20px] max-h-[200px] overflow-y-auto'
              )}
              rows={1}
              disabled={disabled || isSending}
              style={{ scrollbarWidth: 'thin' }}
            />
          </div>
          
          <div className="flex gap-1">
            {isStreaming && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleStopGeneration}
                disabled={disabled}
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              type="submit"
              size="sm"
              disabled={disabled || !message.trim() || isSending}
              className="flex-shrink-0"
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </Card>
      
      <div className="mt-2 text-xs text-muted-foreground">
        Press <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">Enter</kbd> to send, 
        <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground ml-1">Shift+Enter</kbd> for new line, 
        <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground ml-1">↑↓</kbd> for history
      </div>
    </div>
  )
}