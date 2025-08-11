import React, { useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { DirectoryPicker } from './DirectoryPicker'
import type { CreateSessionData } from '../../types/session'
import { X } from 'lucide-react'

interface CreateSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (sessionId: string) => void
}

export function CreateSessionModal({ isOpen, onClose, onSuccess }: CreateSessionModalProps) {
  const { createSession, isLoading, error, clearError } = useSessionStore()
  const [formData, setFormData] = useState<CreateSessionData>({
    projectPath: '',
    context: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    
    if (!formData.projectPath.trim()) {
      return
    }
    
    try {
      const session = await createSession({
        projectPath: formData.projectPath.trim(),
        context: formData.context?.trim() || undefined,
      })
      onSuccess(session.id)
      onClose()
      setFormData({ projectPath: '', context: '' })
    } catch (error) {
      // Error is handled by the store
    }
  }

  const handleClose = () => {
    onClose()
    clearError()
    setFormData({ projectPath: '', context: '' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Create New Session</CardTitle>
              <CardDescription>
                Start a new coding session with Claude Code
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="projectPath" className="text-sm font-medium">
                Project Path *
              </label>
              <DirectoryPicker
                value={formData.projectPath}
                onChange={(path) => setFormData(prev => ({ ...prev, projectPath: path }))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="context" className="text-sm font-medium">
                Context (optional)
              </label>
              <Input
                id="context"
                name="context"
                type="text"
                value={formData.context}
                onChange={(e) => setFormData(prev => ({ ...prev, context: e.target.value }))}
                placeholder="Describe what you're working on..."
                disabled={isLoading}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Add context to help Claude understand your project better
              </p>
            </div>
            {error && (
              <div className="text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.projectPath.trim()}
                className="flex-1"
              >
                {isLoading ? 'Creating...' : 'Create Session'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}