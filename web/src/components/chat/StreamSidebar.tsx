import type { StreamMessage as StreamMessageType } from '../../types/chat'
import { StreamMessage } from './StreamMessage'
import { StreamTextRenderer } from './StreamTextRenderer'
import { Badge } from '../ui/Badge'
import { StreamMessageErrorBoundary } from '../ui/StreamMessageErrorBoundary'
import { Activity, Clock, ChevronRight, Minimize2, Maximize2, FileText, List } from 'lucide-react'
import { Button } from '../ui/Button'
import { useState, useEffect } from 'react'

interface StreamSidebarProps {
  promptId: string | null
  streamMessages: StreamMessageType[]
  onToggle: () => void
  isStreaming?: boolean
  isCollapsed?: boolean
}

export function StreamSidebar({ promptId, streamMessages, onToggle, isStreaming = false }: StreamSidebarProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [viewMode, setViewMode] = useState<'text' | 'events'>('text')
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && streamMessages.length > 0) {
      const element = document.getElementById('stream-messages-container')
      if (element) {
        element.scrollTop = element.scrollHeight
      }
    }
  }, [streamMessages.length, autoScroll])

  if (!promptId) {
    return null
  }

  const messageTypes = streamMessages.reduce((acc, msg) => {
    acc[msg.type] = (acc[msg.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const startTime = streamMessages[0]?.timestamp
  const endTime = streamMessages[streamMessages.length - 1]?.timestamp
  const duration = startTime && endTime 
    ? new Date(endTime).getTime() - new Date(startTime).getTime()
    : 0

  return (
    <div className={`
      border-l bg-background md:bg-muted/20 
      flex flex-col h-full transition-all duration-300 
      ${isMinimized ? 'w-16' : 'w-full'}
      md:relative z-50 md:z-auto
    `}>
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-medium flex items-center gap-2 ${
            isMinimized ? 'hidden' : ''
          }`}>
            <Activity className={`h-4 w-4 ${
              isStreaming ? 'animate-pulse text-blue-500' : ''
            }`} />
            Live Stream
            {isStreaming && (
              <Badge variant="outline" className="text-xs animate-pulse">
                Active
              </Badge>
            )}
          </h3>
          <div className="flex items-center gap-1">
            {!isMinimized && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setViewMode(viewMode === 'text' ? 'events' : 'text')}
                  className="h-8 w-8 p-0"
                  title={viewMode === 'text' ? 'Switch to events view' : 'Switch to text view'}
                >
                  {viewMode === 'text' ? (
                    <List className="h-3 w-3 text-blue-500" />
                  ) : (
                    <FileText className="h-3 w-3 text-blue-500" />
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="h-8 w-8 p-0"
                  title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
                >
                  <Clock className={`h-3 w-3 ${
                    autoScroll ? 'text-blue-500' : 'text-gray-400'
                  }`} />
                </Button>
              </>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsMinimized(!isMinimized)}
              className="h-8 w-8 p-0"
              title={isMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
            >
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onToggle}
              className="h-8 w-8 p-0"
              title="Hide sidebar"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {!isMinimized && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-mono">
              Prompt: {promptId.slice(0, 8)}...
            </div>
            
            <div className="flex flex-wrap gap-1">
              {Object.entries(messageTypes).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type}: {count}
                </Badge>
              ))}
            </div>
            
            {duration > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {(duration / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        )}
      </div>
      
      {!isMinimized && (
        <div 
          id="stream-messages-container"
          className="flex-1 overflow-y-auto p-4"
          onScroll={(e) => {
            const element = e.currentTarget
            const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10
            setAutoScroll(isAtBottom)
          }}
        >
          {streamMessages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              {isStreaming ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Waiting for stream messages...
                </div>
              ) : (
                'No stream messages yet'
              )}
            </div>
          ) : viewMode === 'text' ? (
            <StreamTextRenderer streamMessages={streamMessages} />
          ) : (
            <div className="space-y-3">
              {streamMessages.map((message) => (
                <StreamMessageErrorBoundary 
                  key={message.id} 
                  messageId={message.id}
                  messageType={message.type}
                >
                  <StreamMessage message={message} />
                </StreamMessageErrorBoundary>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Minimized state indicator */}
      {isMinimized && (
        <div className="flex-1 flex flex-col items-center justify-center p-2 space-y-2">
          <Activity className={`h-6 w-6 ${
            isStreaming ? 'animate-pulse text-blue-500' : 'text-gray-400'
          }`} />
          <div className="text-xs text-muted-foreground text-center">
            {streamMessages.length}
          </div>
          {isStreaming && (
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
        </div>
      )}
    </div>
  )
}