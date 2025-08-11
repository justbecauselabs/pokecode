import { useState } from 'react'
import type { Citation } from '../../types/chat'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Quote, FileText, Search, Globe, ChevronDown, ChevronRight } from 'lucide-react'

interface CitationDisplayProps {
  citations: Citation[]
}

export function CitationDisplay({ citations }: CitationDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!citations || citations.length === 0) return null

  const getCitationIcon = (citation: Citation) => {
    switch (citation.type) {
      case 'char_location':
      case 'page_location':
      case 'content_block_location':
        return <FileText className="h-3 w-3" />
      case 'search_result_location':
        return <Search className="h-3 w-3" />
      case 'web_search_result_location':
        return <Globe className="h-3 w-3" />
      default:
        return <Quote className="h-3 w-3" />
    }
  }

  const getCitationTitle = (citation: Citation) => {
    switch (citation.type) {
      case 'char_location':
        return citation.document_title || citation.file_id || `Document ${citation.document_index}`
      case 'page_location':
        return `${citation.document_title || `Document ${citation.document_index}`} (Page ${citation.start_page_number})`
      case 'content_block_location':
        return citation.document_title || citation.file_id || `Document ${citation.document_index}`
      case 'search_result_location':
        return citation.title || citation.source
      case 'web_search_result_location':
        return citation.title || citation.url
      default:
        return 'Citation'
    }
  }

  const getCitationSubtitle = (citation: Citation) => {
    switch (citation.type) {
      case 'char_location':
        return `Characters ${citation.start_char_index}-${citation.end_char_index}`
      case 'page_location':
        return citation.start_page_number === citation.end_page_number 
          ? `Page ${citation.start_page_number}`
          : `Pages ${citation.start_page_number}-${citation.end_page_number}`
      case 'content_block_location':
        return `Blocks ${citation.start_block_index}-${citation.end_block_index}`
      case 'search_result_location':
        return `Result ${citation.search_result_index}, Blocks ${citation.start_block_index}-${citation.end_block_index}`
      case 'web_search_result_location':
        return citation.url
      default:
        return ''
    }
  }

  const groupedCitations = citations.reduce((groups, citation) => {
    const key = getCitationTitle(citation)
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(citation)
    return groups
  }, {} as Record<string, Citation[]>)

  return (
    <Card className="border-amber-200 bg-amber-50/50 mt-3">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-900">
              Sources ({citations.length})
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
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {Object.entries(groupedCitations).map(([title, citationGroup], index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-start gap-2">
                  {getCitationIcon(citationGroup[0])}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {title}
                    </div>
                    <div className="text-xs text-gray-600">
                      {getCitationSubtitle(citationGroup[0])}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {citationGroup.length} ref{citationGroup.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                {/* Show cited text samples */}
                <div className="pl-5 space-y-1">
                  {citationGroup.slice(0, 3).map((citation, citIndex) => (
                    <div key={citIndex} className="text-xs bg-white/60 p-2 rounded border-l-2 border-amber-300">
                      <span className="text-gray-700 italic">
                        "{citation.cited_text}"
                      </span>
                    </div>
                  ))}
                  {citationGroup.length > 3 && (
                    <div className="text-xs text-gray-500 pl-2">
                      +{citationGroup.length - 3} more citations
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface InlineCitationProps {
  citationIndex: number
  citation: Citation
  onClick?: () => void
}

export function InlineCitation({ citationIndex, citation, onClick }: InlineCitationProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1 py-0.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded border border-amber-300 transition-colors"
      title={`Citation: "${citation.cited_text}"`}
    >
      <Quote className="h-3 w-3" />
      {citationIndex + 1}
    </button>
  )
}

// Helper function to parse text with inline citations
export function parseTextWithCitations(text: string, citations: Citation[] = []): React.ReactNode[] {
  if (!citations.length) {
    return [text]
  }

  const elements: React.ReactNode[] = []
  let lastIndex = 0

  // Sort citations by their position in the text (if we can determine it)
  const sortedCitations = [...citations].sort((a, b) => {
    const aPos = text.indexOf(a.cited_text)
    const bPos = text.indexOf(b.cited_text)
    return aPos - bPos
  })

  sortedCitations.forEach((citation, index) => {
    const citationPos = text.indexOf(citation.cited_text, lastIndex)
    
    if (citationPos >= 0) {
      // Add text before citation
      if (citationPos > lastIndex) {
        elements.push(text.slice(lastIndex, citationPos))
      }
      
      // Add cited text with inline citation
      elements.push(
        <span key={`citation-${index}`} className="relative">
          {citation.cited_text}
          <InlineCitation 
            citationIndex={index} 
            citation={citation}
          />
        </span>
      )
      
      lastIndex = citationPos + citation.cited_text.length
    }
  })

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex))
  }

  return elements.length > 0 ? elements : [text]
}