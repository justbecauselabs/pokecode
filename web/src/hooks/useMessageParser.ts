import { useMemo } from 'react'
import { parseMessageContent, detectCodeLanguage } from '../utils/messageParser'

export function useMessageParser() {
  const parser = useMemo(() => ({
    parseMessageContent,
    detectCodeLanguage,
  }), [])

  return parser
}