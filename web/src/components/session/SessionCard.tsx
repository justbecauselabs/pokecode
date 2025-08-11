import type { Session } from '../../types/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatDistanceToNow } from 'date-fns'
import { Folder, Clock, MessageSquare } from 'lucide-react'

interface SessionCardProps {
  session: Session
  onSelect: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  isSelected?: boolean
}

export function SessionCard({ session, onSelect, onDelete, isSelected }: SessionCardProps) {
  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500'
      case 'inactive':
        return 'bg-gray-500'
      case 'archived':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'inactive':
        return 'Inactive'
      case 'archived':
        return 'Archived'
      default:
        return 'Unknown'
    }
  }

  const truncatePath = (path: string, maxLength: number = 40) => {
    if (path.length <= maxLength) return path
    return '...' + path.slice(-(maxLength - 3))
  }

  return (
    <Card 
      className={`cursor-pointer transition-colors hover:bg-accent/50 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => onSelect(session.id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Folder className="h-4 w-4 flex-shrink-0" />
              <span className="truncate" title={session.projectPath}>
                {truncatePath(session.projectPath)}
              </span>
            </CardTitle>
            {session.context && (
              <CardDescription className="text-xs mt-1 line-clamp-2">
                {session.context}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge 
              variant="outline" 
              className={`text-xs px-2 py-0 ${getStatusColor(session.status)}`}
            >
              {getStatusLabel(session.status)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(session.lastAccessedAt), { addSuffix: true })}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>Session</span>
            </div>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(session.id)
              }}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            >
              ×
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}