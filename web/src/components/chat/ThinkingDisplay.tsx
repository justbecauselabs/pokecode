import { useState } from 'react'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Brain, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { CodeBlock } from '../ui/CodeBlock'

interface ThinkingDisplayProps {
  thinking: string
  signature?: string
  isStreaming?: boolean
}

export function ThinkingDisplay({ thinking, signature, isStreaming = false }: ThinkingDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  if (!thinking) return null

  const formatThinking = (content: string) => {
    // Basic formatting - split into paragraphs and handle common patterns
    const paragraphs = content.split('\n\n').filter(p => p.trim())
    
    return paragraphs.map((paragraph, index) => {
      // Check if this looks like a code block
      if (paragraph.includes('```')) {
        return (
          <div key={index} className="mb-4">
            <CodeBlock code={paragraph} language="text" />
          </div>
        )
      }
      
      // Check if this is a reasoning step (starts with number or bullet)
      const isStep = /^\d+\.|\*|-/.test(paragraph.trim())
      
      return (
        <div key={index} className={`mb-3 ${isStep ? 'pl-4 border-l-2 border-primary/20' : ''}`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {paragraph}
          </p>
        </div>
      )
    })
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Claude's Thinking</span>
            {isStreaming && (
              <Badge variant="secondary" className="text-xs">
                Streaming...
              </Badge>
            )}
            {signature && (
              <Badge variant="outline" className="text-xs font-mono">
                {signature}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRaw(!showRaw)}
              className="h-8 w-8 p-0"
              title={showRaw ? 'Show formatted' : 'Show raw'}
            >
              {showRaw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="max-h-96 overflow-y-auto">
            {showRaw ? (
              <pre className="text-xs font-mono bg-muted p-3 rounded-md whitespace-pre-wrap">
                {thinking}
              </pre>
            ) : (
              <div className="prose prose-sm max-w-none">
                {formatThinking(thinking)}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}