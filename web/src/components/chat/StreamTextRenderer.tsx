import type { StreamMessage } from '../../types/chat'
import { CodeBlock } from '../ui/CodeBlock'
import { useMemo } from 'react'

interface StreamTextRendererProps {
  streamMessages: StreamMessage[]
}

interface TextBlock {
  type: 'text' | 'thinking' | 'code' | 'system' | 'error'
  content: string
  language?: string
  timestamp: string
}

export function StreamTextRenderer({ streamMessages }: StreamTextRendererProps) {
  const textBlocks = useMemo(() => {
    const blocks: TextBlock[] = []
    
    console.log('StreamTextRenderer processing', streamMessages.length, 'messages:', streamMessages)
    
    // Process messages chronologically
    const sortedMessages = [...streamMessages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    
    for (const message of sortedMessages) {
      const timestamp = message.timestamp
      console.log('Processing message:', message.type, message.data)
      
      switch (message.type) {
        case 'text_delta': {
          const textDeltaData = message.data as { text?: string } | undefined
          if (textDeltaData?.text) {
            blocks.push({
              type: 'text',
              content: textDeltaData.text,
              timestamp
            })
          }
          break
        }
          
        case 'thinking_delta': {
          const thinkingDeltaData = message.data as { thinking?: string } | undefined
          if (thinkingDeltaData?.thinking) {
            blocks.push({
              type: 'thinking',
              content: thinkingDeltaData.thinking,
              timestamp
            })
          }
          break
        }
          
        case 'message': {
          // Handle both old format (string) and new format (object with content)
          const messageData = message.data as { content?: string; type?: string } | string | undefined
          let content: string | undefined
          
          if (typeof messageData === 'string') {
            content = messageData
          } else if (messageData && typeof messageData === 'object' && messageData.content) {
            content = messageData.content
          }
          
          if (content) {
            blocks.push({
              type: 'text',
              content: content,
              timestamp
            })
          }
          break
        }
          
        case 'thinking': {
          const thinkingData = message.data as { thinking?: string } | undefined
          if (thinkingData?.thinking) {
            blocks.push({
              type: 'thinking',
              content: thinkingData.thinking,
              timestamp
            })
          }
          break
        }
          
        case 'tool_use': {
          // Show what tool is being used
          const toolData = message.data as { 
            tool?: string; 
            params?: unknown; 
            type?: string;
          } | undefined
          
          if (toolData?.tool) {
            const paramsText = toolData.params 
              ? '\n\nParameters:\n' + JSON.stringify(toolData.params, null, 2)
              : ''
              
            blocks.push({
              type: 'system',
              content: `🔧 Using tool: ${toolData.tool}${paramsText}`,
              timestamp
            })
          }
          break
        }
        
        case 'tool_result': {
          // Handle both Claude Code format and your format
          const resultData = message.data as { 
            result?: unknown; 
            is_error?: boolean;
            tool?: string;
            type?: string;
          } | undefined
          
          let resultString: string | undefined
          
          // Check if this is Claude Code format (has result field)
          if (resultData?.result) {
            resultString = typeof resultData.result === 'string' 
              ? resultData.result 
              : JSON.stringify(resultData.result, null, 2)
          }
          // Check if this is your format (data is the result itself)  
          else if (typeof message.data === 'string') {
            resultString = message.data
          }
          // Try to extract any string content from the data object
          else if (message.data && typeof message.data === 'object') {
            resultString = JSON.stringify(message.data, null, 2)
          }
          
          if (resultString) {
            // Check if this looks like code
            const isCode = resultString.includes('```') || 
                          resultString.includes('function ') ||
                          resultString.includes('class ') ||
                          resultString.trim().startsWith('{') ||
                          resultString.trim().startsWith('[') ||
                          resultString.includes('- /Users/') // File listings
            
            if (resultData?.is_error) {
              blocks.push({
                type: 'error',
                content: resultString,
                timestamp
              })
            } else if (isCode) {
              blocks.push({
                type: 'code',
                content: resultString,
                language: 'text',
                timestamp
              })
            } else {
              blocks.push({
                type: 'text',
                content: resultString,
                timestamp
              })
            }
          }
          break
        }
          
        case 'system': {
          const systemData = message.data
          if (systemData) {
            const systemContent = typeof systemData === 'string' 
              ? systemData 
              : JSON.stringify(systemData, null, 2)
            blocks.push({
              type: 'system',
              content: systemContent,
              timestamp
            })
          }
          break
        }
          
        case 'error': {
          const errorData = message.data as { error?: string } | string | undefined
          const errorMessage = typeof errorData === 'object' && errorData?.error 
            ? errorData.error 
            : typeof errorData === 'string' 
            ? errorData 
            : 'Unknown error'
          blocks.push({
            type: 'error',
            content: errorMessage,
            timestamp
          })
          break
        }
        
        case 'connected': {
          // Skip connection messages - they're not content
          break
        }
        
        default: {
          // Handle any unrecognized message types
          console.log('Unhandled message type:', message.type, message.data)
          if (message.data && typeof message.data === 'object') {
            const dataStr = JSON.stringify(message.data, null, 2)
            blocks.push({
              type: 'system',
              content: `[${message.type}]: ${dataStr}`,
              timestamp
            })
          }
          break
        }
      }
    }
    
    return blocks
  }, [streamMessages])
  
  // Group consecutive blocks of the same type for better rendering
  const groupedBlocks = useMemo(() => {
    const grouped: Array<{
      type: TextBlock['type']
      content: string
      language?: string
      startTime: string
      endTime: string
    }> = []
    
    let currentGroup: TextBlock[] = []
    
    for (const block of textBlocks) {
      if (currentGroup.length === 0 || currentGroup[0].type === block.type) {
        currentGroup.push(block)
      } else {
        // Process current group
        if (currentGroup.length > 0) {
          grouped.push({
            type: currentGroup[0].type,
            content: currentGroup.map(b => b.content).join(''),
            language: currentGroup[0].language,
            startTime: currentGroup[0].timestamp,
            endTime: currentGroup[currentGroup.length - 1].timestamp
          })
        }
        currentGroup = [block]
      }
    }
    
    // Process final group
    if (currentGroup.length > 0) {
      grouped.push({
        type: currentGroup[0].type,
        content: currentGroup.map(b => b.content).join(''),
        language: currentGroup[0].language,
        startTime: currentGroup[0].timestamp,
        endTime: currentGroup[currentGroup.length - 1].timestamp
      })
    }
    
    return grouped
  }, [textBlocks])
  
  console.log('StreamTextRenderer final blocks:', textBlocks.length, 'textBlocks,', groupedBlocks.length, 'groupedBlocks')
  
  if (groupedBlocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        <div className="text-center">
          <div>No text content available</div>
          <div className="text-xs mt-2">
            Processed {streamMessages.length} stream messages, found {textBlocks.length} text blocks
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-4 text-sm">
      {groupedBlocks.map((group, index) => {
        switch (group.type) {
          case 'text':
            return (
              <div key={index} className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap leading-relaxed text-foreground">
                  {group.content}
                </div>
              </div>
            )
            
          case 'thinking':
            return (
              <div key={index} className="bg-purple-50 border-l-4 border-purple-300 p-4 rounded-r-md">
                <div className="text-xs text-purple-600 font-medium mb-2 flex items-center gap-1">
                  <span>💭</span> Thinking
                </div>
                <div className="text-purple-800 whitespace-pre-wrap leading-relaxed font-mono text-xs">
                  {group.content}
                </div>
              </div>
            )
            
          case 'code': {
            // Try to extract language from markdown code blocks
            const codeBlockMatch = group.content.match(/```(\w*)\n?([\s\S]*?)```/)
            if (codeBlockMatch) {
              return (
                <div key={index} className="my-4">
                  <CodeBlock
                    code={codeBlockMatch[2]}
                    language={codeBlockMatch[1] || 'text'}
                  />
                </div>
              )
            }
            
            // Check if it looks like JSON
            const isJSON = group.content.trim().startsWith('{') || group.content.trim().startsWith('[')
            
            return (
              <div key={index} className="my-4">
                <CodeBlock
                  code={group.content}
                  language={isJSON ? 'json' : 'text'}
                />
              </div>
            )
          }
            
          case 'system': {
            return (
              <div key={index} className="bg-gray-50 border-l-4 border-gray-300 p-4 rounded-r-md">
                <div className="text-xs text-gray-600 font-medium mb-2 flex items-center gap-1">
                  <span>⚙️</span> System
                </div>
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {group.content}
                </div>
              </div>
            )
          }
            
          case 'error': {
            return (
              <div key={index} className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md">
                <div className="text-xs text-red-600 font-medium mb-2 flex items-center gap-1">
                  <span>❌</span> Error
                </div>
                <div className="text-red-800 whitespace-pre-wrap leading-relaxed">
                  {group.content}
                </div>
              </div>
            )
          }
            
          default:
            return null
        }
      })}
    </div>
  )
}