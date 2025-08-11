import { Link, Navigate } from 'react-router-dom'
import { LoginForm } from '../components/auth/LoginForm'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const { user } = useAuthStore()

  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Pokecode</h1>
          <p className="text-muted-foreground mt-2">
            Your Claude Code companion
          </p>
        </div>
        <LoginForm />
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link to="/register" className="text-primary hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  )
}