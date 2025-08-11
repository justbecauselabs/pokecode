import { ChatContainer } from '../components/chat/ChatContainer'
import { AuthGuard } from '../components/auth/AuthGuard'

export function ChatPage() {
  return (
    <AuthGuard>
      <ChatContainer />
    </AuthGuard>
  )
}