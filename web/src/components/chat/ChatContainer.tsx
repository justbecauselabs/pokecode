import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../stores/sessionStore'
import { useChatStore } from '../../stores/chatStore'
import { useSSE } from '../../hooks/useSSE'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'
import { StatusBar } from './StatusBar'
import { StreamSidebar } from './StreamSidebar'
import { Button } from '../ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { ArrowLeft, AlertCircle } from 'lucide-react'

export function ChatContainer() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  
  const { currentSession, selectSession, sessions } = useSessionStore()
  const { currentPrompt, clearMessages, streamMessages } = useChatStore()
  
  const [selectedStreamPromptId, setSelectedStreamPromptId] = useState<string | null>(null)
  
  const { disconnect } = useSSE({
    sessionId: sessionId || '',
    promptId: currentPrompt?.id || null,
    enabled: Boolean(sessionId && currentPrompt?.id)
  })

  // Use refs to store functions to avoid dependency issues
  const disconnectRef = useRef(disconnect)
  const clearMessagesRef = useRef(clearMessages)
  const selectSessionRef = useRef(selectSession)
  
  // Update refs when functions change
  disconnectRef.current = disconnect
  clearMessagesRef.current = clearMessages
  selectSessionRef.current = selectSession

  useEffect(() => {
    if (sessionId) {
      // If we don't have the current session or it doesn't match, try to find and select it
      if (!currentSession || currentSession.id !== sessionId) {
        const session = sessions.find(s => s.id === sessionId)
        if (session) {
          selectSessionRef.current(sessionId)
        }
      }
    }

    return () => {
      // Use ref values to avoid function dependencies
      disconnectRef.current()
      clearMessagesRef.current()
    }
  }, [sessionId, currentSession, sessions])

  const handleMessageSent = () => {
    // SSE connection will be established automatically via the useSSE hook
    // when currentPrompt is updated
  }

  const handleBackToSessions = () => {
    disconnect()
    navigate('/')
  }

  const handleShowStream = (promptId: string) => {
    setSelectedStreamPromptId(promptId)
  }

  const handleCloseSidebar = () => {
    setSelectedStreamPromptId(null)
  }

  const selectedStreamMessages = selectedStreamPromptId 
    ? streamMessages.get(selectedStreamPromptId) || []
    : []

  if (!sessionId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Invalid Session
            </CardTitle>
            <CardDescription>
              No session ID provided in the URL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToSessions}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentSession) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Session Not Found
            </CardTitle>
            <CardDescription>
              The requested session could not be found or loaded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToSessions}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <StatusBar />
        
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToSessions}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Sessions
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate" title={currentSession.projectPath}>
              {currentSession.projectPath.split('/').pop() || currentSession.projectPath}
            </h1>
            {currentSession.context && (
              <p className="text-sm text-muted-foreground truncate">
                {currentSession.context}
              </p>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <MessageList sessionId={sessionId} onShowStream={handleShowStream} />

        {/* Input Bar */}
        <InputBar
          sessionId={sessionId}
          onMessageSent={handleMessageSent}
          disabled={currentSession.status !== 'active'}
        />
      </div>
      
      {/* Stream Sidebar */}
      {selectedStreamPromptId && (
        <StreamSidebar
          promptId={selectedStreamPromptId}
          streamMessages={selectedStreamMessages}
          onClose={handleCloseSidebar}
        />
      )}
    </div>
  )
}