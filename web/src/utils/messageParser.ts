export interface ParsedBlock {
  type: 'text' | 'code' | 'tool' | 'error' | 'file'
  content: string
  language?: string
  metadata?: Record<string, any>
}

export function parseMessageContent(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const lines = content.split('\n')
  let currentBlock: ParsedBlock | null = null
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block detection
    const codeBlockMatch = line.match(/^```(\w+)?/)
    if (codeBlockMatch) {
      // If we have a current text block, push it
      if (currentBlock?.type === 'text') {
        blocks.push(currentBlock)
        currentBlock = null
      }

      const language = codeBlockMatch[1] || 'text'
      const codeLines: string[] = []
      i++ // Move past opening ```

      // Collect code lines until closing ```
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i])
        i++
      }

      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        language,
      })

      i++ // Move past closing ```
      continue
    }

    // Tool usage detection (Looking for specific patterns)
    if (line.includes('🔧') || line.match(/Using tool:|Tool:|Executing:/)) {
      if (currentBlock?.type === 'text') {
        blocks.push(currentBlock)
      }

      blocks.push({
        type: 'tool',
        content: line,
        metadata: {
          isToolUse: true,
        },
      })

      currentBlock = null
      i++
      continue
    }

    // Error detection
    if (line.includes('❌') || line.includes('Error:') || line.includes('Failed:')) {
      if (currentBlock?.type === 'text') {
        blocks.push(currentBlock)
      }

      blocks.push({
        type: 'error',
        content: line,
      })

      currentBlock = null
      i++
      continue
    }

    // File operation detection
    if (line.match(/^(Created|Modified|Deleted|Updated).*\.(js|ts|jsx|tsx|py|java|cpp|c|go|rs|rb|php|html|css|json|md|txt)$/)) {
      if (currentBlock?.type === 'text') {
        blocks.push(currentBlock)
      }

      blocks.push({
        type: 'file',
        content: line,
        metadata: {
          isFileOperation: true,
        },
      })

      currentBlock = null
      i++
      continue
    }

    // Regular text
    if (!currentBlock || currentBlock.type !== 'text') {
      if (currentBlock) {
        blocks.push(currentBlock)
      }
      currentBlock = {
        type: 'text',
        content: line,
      }
    } else {
      currentBlock.content += '\n' + line
    }

    i++
  }

  // Push any remaining block
  if (currentBlock) {
    blocks.push(currentBlock)
  }

  return blocks
}

export function detectCodeLanguage(content: string): string {
  const firstLine = content.split('\n')[0].toLowerCase()

  // Common patterns to detect language
  if (firstLine.includes('import ') || firstLine.includes('export ') || firstLine.includes('const ') || firstLine.includes('function ')) {
    if (firstLine.includes('react') || content.includes('jsx') || content.includes('<')) {
      return 'jsx'
    }
    return 'javascript'
  }

  if (firstLine.includes('interface ') || firstLine.includes('type ') || content.includes(': ')) {
    return 'typescript'
  }

  if (firstLine.includes('def ') || firstLine.includes('import ') || firstLine.includes('from ')) {
    return 'python'
  }

  if (firstLine.includes('package ') || firstLine.includes('public class')) {
    return 'java'
  }

  if (firstLine.includes('#include') || firstLine.includes('int main')) {
    return 'cpp'
  }

  if (firstLine.includes('func ') || firstLine.includes('package main')) {
    return 'go'
  }

  if (firstLine.includes('fn ') || firstLine.includes('let mut')) {
    return 'rust'
  }

  if (firstLine.includes('<!DOCTYPE') || firstLine.includes('<html')) {
    return 'html'
  }

  if (firstLine.includes('{') && content.includes('":')) {
    return 'json'
  }

  if (firstLine.includes('SELECT') || firstLine.includes('CREATE TABLE')) {
    return 'sql'
  }

  return 'text'
}