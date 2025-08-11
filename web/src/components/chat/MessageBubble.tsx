import type { ChatMessage } from '../../types/chat'
import { Card, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { CodeBlock } from '../ui/CodeBlock'
import { ToolDisplay } from '../ui/ToolDisplay'
import { ErrorDisplay } from '../ui/ErrorDisplay'
import { FileOperationDisplay } from '../ui/FileOperationDisplay'
import { useMessageParser } from '../../hooks/useMessageParser'
import { cn } from '../../lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { User, Bot, Settings, Copy, Activity } from 'lucide-react'
import { Button } from '../ui/Button'

interface MessageBubbleProps {
  message: ChatMessage
  onShowStream?: (promptId: string) => void
}

export function MessageBubble({ message, onShowStream }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  
  const getRoleIcon = () => {
    switch (message.role) {
      case 'user':
        return <User className="h-4 w-4" />
      case 'assistant':
        return <Bot className="h-4 w-4" />
      case 'system':
        return <Settings className="h-4 w-4" />
      default:
        return null
    }
  }

  const getRoleLabel = () => {
    switch (message.role) {
      case 'user':
        return 'You'
      case 'assistant':
        return 'Claude'
      case 'system':
        return 'System'
      default:
        return 'Unknown'
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <Badge variant="outline" className="text-xs">
          {getRoleIcon()}
          <span className="ml-1">{message.content}</span>
        </Badge>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm',
        isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-secondary text-secondary-foreground'
      )}>
        {getRoleIcon()}
      </div>
      
      <div className={cn('flex-1 max-w-[80%]', isUser ? 'text-right' : 'text-left')}>
        <div className={cn(
          'flex items-center gap-2 mb-1',
          isUser ? 'justify-end' : 'justify-start'
        )}>
          <span className="text-sm font-medium">{getRoleLabel()}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
          </span>
          {message.isStreaming && (
            <Badge variant="outline" className="text-xs">
              <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
              <span className="ml-1">Typing...</span>
            </Badge>
          )}
        </div>
        
        <Card className={cn(
          'relative group',
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-card'
        )}>
          <CardContent className="p-3">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <MessageContent content={message.content} />
            </div>
            
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {message.promptId && onShowStream && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onShowStream(message.promptId!)}
                  className={cn(
                    'h-6 w-6 p-0',
                    isUser ? 'text-primary-foreground/70 hover:text-primary-foreground' : ''
                  )}
                  title="Show stream messages"
                >
                  <Activity className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={copyToClipboard}
                className={cn(
                  'h-6 w-6 p-0',
                  isUser ? 'text-primary-foreground/70 hover:text-primary-foreground' : ''
                )}
                title="Copy message"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  const { parseMessageContent } = useMessageParser()
  const blocks = parseMessageContent(content)

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'code':
            return (
              <CodeBlock
                key={index}
                language={block.language || 'text'}
                code={block.content}
                showLineNumbers={block.content.split('\n').length > 5}
              />
            )
          case 'tool':
            return (
              <ToolDisplay
                key={index}
                content={block.content}
                metadata={block.metadata}
              />
            )
          case 'error':
            return (
              <ErrorDisplay
                key={index}
                content={block.content}
                severity={block.content.includes('Warning') ? 'warning' : 'error'}
              />
            )
          case 'file':
            return (
              <FileOperationDisplay
                key={index}
                content={block.content}
                metadata={block.metadata}
              />
            )
          case 'text':
          default:
            return (
              <div key={index} className="whitespace-pre-wrap break-words">
                {block.content}
              </div>
            )
        }
      })}
    </div>
  )
}