import type { StreamMessage as StreamMessageType } from '../../types/chat'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { CodeBlock } from '../ui/CodeBlock'
import { Clock, Settings, CheckCircle, AlertCircle, MessageCircle, Link } from 'lucide-react'

interface StreamMessageProps {
  message: StreamMessageType
}

export function StreamMessage({ message }: StreamMessageProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'connected':
        return <Link className="h-4 w-4" />
      case 'message':
        return <MessageCircle className="h-4 w-4" />
      case 'tool_use':
        return <Settings className="h-4 w-4" />
      case 'tool_result':
        return <CheckCircle className="h-4 w-4" />
      case 'complete':
        return <CheckCircle className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'connected':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'message':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'tool_use':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'tool_result':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'complete':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const renderContent = () => {
    switch (message.type) {
      case 'connected':
        const connectData = message.data as { promptId?: string } | undefined
        return (
          <div className="text-sm text-muted-foreground">
            Connected to stream {connectData?.promptId && `(${connectData.promptId})`}
          </div>
        )
      
      case 'message':
        return (
          <div className="space-y-2">
            <div className="text-sm font-medium">Assistant Response</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {String(message.data || 'Empty message')}
            </div>
          </div>
        )
      
      case 'tool_use':
        const toolData = message.data as { tool?: string; params?: unknown } | undefined
        return (
          <div className="space-y-2">
            <div className="text-sm font-medium">Tool: {toolData?.tool || 'Unknown'}</div>
            {toolData?.params ? (
              <CodeBlock
                code={JSON.stringify(toolData.params, null, 2)}
                language="json"
              />
            ) : null}
          </div>
        )
      
      case 'tool_result':
        const resultData = message.data as { result?: unknown } | undefined
        return (
          <div className="space-y-2">
            <div className="text-sm font-medium">Tool Result</div>
            {resultData?.result ? (
              <ToolResultDisplay result={resultData.result} />
            ) : null}
          </div>
        )
      
      case 'complete':
        const summaryData = message.data as { summary?: { duration?: number; toolCallCount?: number } } | undefined
        return (
          <div className="space-y-2">
            <div className="text-sm font-medium text-green-600">Stream Complete</div>
            {summaryData?.summary && (
              <div className="text-sm text-muted-foreground">
                Duration: {summaryData.summary.duration}ms | 
                Tools: {summaryData.summary.toolCallCount}
              </div>
            )}
          </div>
        )
      
      case 'error':
        const errorData = message.data as { error?: string } | string | undefined
        const errorMessage = typeof errorData === 'object' && errorData?.error ? errorData.error 
          : typeof errorData === 'string' ? errorData 
          : 'Unknown error'
        return (
          <div className="space-y-2">
            <div className="text-sm font-medium text-red-600">Error</div>
            <div className="text-sm text-red-600">
              {errorMessage}
            </div>
          </div>
        )
      
      default:
        return (
          <div className="text-sm text-muted-foreground">
            {JSON.stringify(message.data, null, 2)}
          </div>
        )
    }
  }

  return (
    <Card className="text-xs border-l-4 border-l-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={`${getTypeColor(message.type)} text-xs`}>
            {getTypeIcon(message.type)}
            <span className="ml-1 capitalize">{message.type.replace('_', ' ')}</span>
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {renderContent()}
      </CardContent>
    </Card>
  )
}

interface ToolResultDisplayProps {
  result: unknown
}

function ToolResultDisplay({ result }: ToolResultDisplayProps) {
  const resultString = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  
  // Check if this looks like a file diff or code
  const isFileDiff = resultString.includes('---') && resultString.includes('+++') && resultString.includes('@@')
  const hasCodeBlocks = resultString.includes('```')
  const isJSON = resultString.trim().startsWith('{') || resultString.trim().startsWith('[')
  
  if (hasCodeBlocks) {
    // Parse markdown code blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
    const parts = []
    let lastIndex = 0
    let match
    
    while ((match = codeBlockRegex.exec(resultString)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = resultString.slice(lastIndex, match.index)
        if (textBefore.trim()) {
          parts.push({ type: 'text', content: textBefore })
        }
      }
      
      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2]
      })
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text
    if (lastIndex < resultString.length) {
      const remaining = resultString.slice(lastIndex)
      if (remaining.trim()) {
        parts.push({ type: 'text', content: remaining })
      }
    }
    
    return (
      <div className="space-y-2">
        {parts.map((part, index) => (
          part.type === 'code' ? (
            <CodeBlock
              key={index}
              code={part.content}
              language={part.language || 'text'}
            />
          ) : (
            <div key={index} className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
              {part.content}
            </div>
          )
        ))}
      </div>
    )
  }
  
  if (isFileDiff) {
    return (
      <div className="text-sm bg-muted p-3 rounded-md overflow-auto max-h-48">
        <pre className="whitespace-pre text-xs font-mono">
          {resultString.split('\n').map((line, index) => (
            <div
              key={index}
              className={`${
                line.startsWith('+') && !line.startsWith('+++') 
                  ? 'bg-green-50 text-green-800' 
                  : line.startsWith('-') && !line.startsWith('---')
                  ? 'bg-red-50 text-red-800'
                  : line.startsWith('@@')
                  ? 'bg-blue-50 text-blue-800 font-semibold'
                  : ''
              }`}
            >
              {line || ' '}
            </div>
          ))}
        </pre>
      </div>
    )
  }
  
  if (isJSON) {
    return (
      <CodeBlock
        code={resultString}
        language="json"
      />
    )
  }
  
  // Default rendering for other content
  return (
    <div className="text-sm bg-muted p-3 rounded-md overflow-auto max-h-32">
      <pre className="whitespace-pre-wrap text-xs">
        {resultString}
      </pre>
    </div>
  )
}