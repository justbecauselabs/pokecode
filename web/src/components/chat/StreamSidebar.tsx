import type { StreamMessage as StreamMessageType } from '../../types/chat'
import { StreamMessage } from './StreamMessage'
import { Badge } from '../ui/Badge'
import { X, Activity, Clock } from 'lucide-react'
import { Button } from '../ui/Button'

interface StreamSidebarProps {
  promptId: string | null
  streamMessages: StreamMessageType[]
  onClose: () => void
}

export function StreamSidebar({ promptId, streamMessages, onClose }: StreamSidebarProps) {
  if (!promptId || streamMessages.length === 0) {
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
    <div className="w-80 border-l bg-muted/20 flex flex-col h-full">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Stream Messages
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
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
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {streamMessages.map((message) => (
          <StreamMessage key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}