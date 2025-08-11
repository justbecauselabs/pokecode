import { Link, Navigate } from 'react-router-dom'
import { RegisterForm } from '../components/auth/RegisterForm'
import { useAuthStore } from '../stores/authStore'

export function RegisterPage() {
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
        <RegisterForm />
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link to="/login" className="text-primary hover:underline">
            Login here
          </Link>
        </div>
      </div>
    </div>
  )
}