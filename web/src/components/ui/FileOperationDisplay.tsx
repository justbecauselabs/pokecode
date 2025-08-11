import { Card, CardContent } from './Card'
import { Badge } from './Badge'
import { 
  FileText, 
  FilePlus, 
  FileX, 
  FileEdit
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface FileOperationDisplayProps {
  content: string
  metadata?: Record<string, any>
  className?: string
}

export function FileOperationDisplay({ content, className }: FileOperationDisplayProps) {
  const getOperationInfo = (content: string) => {
    const operations = [
      { pattern: /^Created\s+(.+)$/, type: 'created', icon: FilePlus, color: 'green' },
      { pattern: /^Modified\s+(.+)$/, type: 'modified', icon: FileEdit, color: 'blue' },
      { pattern: /^Updated\s+(.+)$/, type: 'updated', icon: FileEdit, color: 'blue' },
      { pattern: /^Deleted\s+(.+)$/, type: 'deleted', icon: FileX, color: 'red' },
      { pattern: /^Added\s+(.+)$/, type: 'added', icon: FilePlus, color: 'green' },
      { pattern: /^Removed\s+(.+)$/, type: 'removed', icon: FileX, color: 'red' },
    ]
    
    for (const op of operations) {
      const match = content.match(op.pattern)
      if (match) {
        return {
          type: op.type,
          file: match[1],
          icon: op.icon,
          color: op.color
        }
      }
    }
    
    return {
      type: 'unknown',
      file: content,
      icon: FileText,
      color: 'gray'
    }
  }

  const getColorConfig = (color: string) => {
    switch (color) {
      case 'green':
        return {
          borderColor: 'border-l-green-500',
          bgColor: 'bg-green-50/50 dark:bg-green-950/20',
          iconBg: 'bg-green-100 dark:bg-green-900/50',
          iconColor: 'text-green-600 dark:text-green-400',
          badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          textColor: 'text-green-700 dark:text-green-300',
        }
      case 'blue':
        return {
          borderColor: 'border-l-blue-500',
          bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
          iconBg: 'bg-blue-100 dark:bg-blue-900/50',
          iconColor: 'text-blue-600 dark:text-blue-400',
          badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          textColor: 'text-blue-700 dark:text-blue-300',
        }
      case 'red':
        return {
          borderColor: 'border-l-red-500',
          bgColor: 'bg-red-50/50 dark:bg-red-950/20',
          iconBg: 'bg-red-100 dark:bg-red-900/50',
          iconColor: 'text-red-600 dark:text-red-400',
          badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
          textColor: 'text-red-700 dark:text-red-300',
        }
      default:
        return {
          borderColor: 'border-l-gray-500',
          bgColor: 'bg-gray-50/50 dark:bg-gray-950/20',
          iconBg: 'bg-gray-100 dark:bg-gray-900/50',
          iconColor: 'text-gray-600 dark:text-gray-400',
          badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
          textColor: 'text-gray-700 dark:text-gray-300',
        }
    }
  }

  const getFileExtension = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext || ''
  }

  const getFileType = (filename: string) => {
    const ext = getFileExtension(filename)
    const typeMap: Record<string, string> = {
      js: 'JavaScript',
      jsx: 'React JSX',
      ts: 'TypeScript',
      tsx: 'React TSX',
      py: 'Python',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      go: 'Go',
      rs: 'Rust',
      rb: 'Ruby',
      php: 'PHP',
      html: 'HTML',
      css: 'CSS',
      json: 'JSON',
      md: 'Markdown',
      txt: 'Text',
      yml: 'YAML',
      yaml: 'YAML',
    }
    
    return typeMap[ext] || ext.toUpperCase()
  }

  const operation = getOperationInfo(content)
  const config = getColorConfig(operation.color)
  const OperationIcon = operation.icon

  return (
    <Card className={cn(
      'border-l-4',
      config.borderColor,
      config.bgColor,
      className
    )}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              config.iconBg
            )}>
              <OperationIcon className={cn('h-4 w-4', config.iconColor)} />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn('text-xs', config.badgeColor)}>
                {operation.type.charAt(0).toUpperCase() + operation.type.slice(1)}
              </Badge>
              {getFileExtension(operation.file) && (
                <Badge variant="outline" className="text-xs">
                  {getFileType(operation.file)}
                </Badge>
              )}
            </div>
            
            <div className={cn('text-sm font-mono break-all', config.textColor)}>
              {operation.file}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}