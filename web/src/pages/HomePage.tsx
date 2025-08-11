import { useNavigate } from 'react-router-dom'
import { SessionList } from '../components/session/SessionList'
import { AuthGuard } from '../components/auth/AuthGuard'

export function HomePage() {
  const navigate = useNavigate()

  const handleSessionSelect = (sessionId: string) => {
    navigate(`/chat/${sessionId}`)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <SessionList onSessionSelect={handleSessionSelect} />
      </div>
    </AuthGuard>
  )
}