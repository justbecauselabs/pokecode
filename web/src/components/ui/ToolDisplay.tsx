import { Card, CardContent } from './Card'
import { Badge } from './Badge'
import { 
  Wrench, 
  FileEdit, 
  Terminal, 
  Search, 
  Globe,
  FolderOpen,
  GitBranch,
  Database
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface ToolDisplayProps {
  content: string
  metadata?: Record<string, any>
  className?: string
}

export function ToolDisplay({ content, metadata, className }: ToolDisplayProps) {
  const getToolIcon = (content: string) => {
    if (content.includes('file') || content.includes('edit') || content.includes('write')) {
      return FileEdit
    }
    if (content.includes('terminal') || content.includes('command') || content.includes('bash')) {
      return Terminal
    }
    if (content.includes('search') || content.includes('grep') || content.includes('find')) {
      return Search
    }
    if (content.includes('web') || content.includes('http') || content.includes('fetch')) {
      return Globe
    }
    if (content.includes('folder') || content.includes('directory')) {
      return FolderOpen
    }
    if (content.includes('git')) {
      return GitBranch
    }
    if (content.includes('database') || content.includes('sql')) {
      return Database
    }
    return Wrench
  }

  const getToolInfo = (content: string) => {
    // Extract tool name and action from content
    const toolMatch = content.match(/🔧\s*(?:Using tool:|Tool:)?\s*([^:]+)/)
    const tool = toolMatch?.[1]?.trim() || 'Unknown Tool'
    
    return {
      name: tool,
      action: content.replace(/🔧\s*(?:Using tool:|Tool:)?\s*[^:]*:?\s*/, '').trim() || 'Executing...',
    }
  }

  const toolInfo = getToolInfo(content)
  const ToolIcon = getToolIcon(content.toLowerCase())

  return (
    <Card className={cn(
      'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
      className
    )}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <ToolIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                Tool Usage
              </Badge>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {toolInfo.name}
              </span>
            </div>
            
            {toolInfo.action && (
              <p className="text-sm text-muted-foreground">
                {toolInfo.action}
              </p>
            )}
            
            {metadata?.params && (
              <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                {JSON.stringify(metadata.params, null, 2)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}