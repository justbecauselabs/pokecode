import { useState } from 'react'
import type { WebSearchResult, WebSearchToolResultError } from '../../types/chat'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { 
  Globe, 
  ExternalLink, 
  Clock, 
  AlertTriangle, 
  Search,
  ChevronDown, 
  ChevronRight 
} from 'lucide-react'

interface WebSearchDisplayProps {
  toolUseId: string
  results?: WebSearchResult[]
  error?: WebSearchToolResultError
  timestamp: string
}

export function WebSearchDisplay({ toolUseId, results = [], error, timestamp }: WebSearchDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'invalid_tool_input':
        return 'Invalid search query provided'
      case 'unavailable':
        return 'Web search is currently unavailable'
      case 'max_uses_exceeded':
        return 'Maximum web searches exceeded for this session'
      case 'too_many_requests':
        return 'Too many search requests, please wait'
      case 'query_too_long':
        return 'Search query is too long'
      default:
        return 'Web search failed'
    }
  }


  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {error ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <Globe className="h-4 w-4 text-green-600" />
            )}
            <span className="text-sm font-medium text-green-900">
              Web Search {error ? 'Error' : 'Results'}
            </span>
            {!error && (
              <Badge variant="secondary" className="text-xs">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-mono">
              {formatTimestamp(timestamp)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Tool ID: {toolUseId}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          {error ? (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-red-900 mb-1">
                  Search Failed
                </div>
                <div className="text-sm text-red-700">
                  {getErrorMessage(error.error_code)}
                </div>
                <div className="text-xs text-red-600 mt-1 font-mono">
                  Error Code: {error.error_code}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {results.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No search results found
                </div>
              ) : (
                results.map((result, index) => (
                  <SearchResultCard key={index} result={result} index={index} />
                ))
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

interface SearchResultCardProps {
  result: WebSearchResult
  index: number
}

function SearchResultCard({ result, index }: SearchResultCardProps) {
  const [showContent, setShowContent] = useState(false)

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs shrink-0">
                #{index + 1}
              </Badge>
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {result.title}
              </h4>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              <span className="truncate">{result.url}</span>
              {result.page_age && (
                <>
                  <Clock className="h-3 w-3" />
                  <span>{Math.floor(result.page_age / (24 * 60 * 60))} days ago</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(result.url, '_blank')}
              className="h-8 w-8 p-0"
              title="Open in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowContent(!showContent)}
              className="h-8 w-8 p-0"
              title="Toggle content preview"
            >
              {showContent ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {showContent && (
        <CardContent className="pt-0">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Content Preview (Encrypted)
              </span>
            </div>
            <div className="text-xs font-mono bg-white p-2 rounded border">
              <div className="text-muted-foreground">
                Content is encrypted and only accessible to Claude for processing.
              </div>
              <div className="mt-1 text-gray-400">
                Length: {result.encrypted_content.length} characters
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}