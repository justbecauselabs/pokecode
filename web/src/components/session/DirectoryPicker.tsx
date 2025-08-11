import React, { useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { FolderOpen } from 'lucide-react'

interface DirectoryPickerProps {
  value: string
  onChange: (path: string) => void
  disabled?: boolean
}

export function DirectoryPicker({ value, onChange, disabled }: DirectoryPickerProps) {
  const [manualPath, setManualPath] = useState(value)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDirectorySelect = async () => {
    try {
      // Check if the File System Access API is available (Chrome/Edge)
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker()
        if (dirHandle) {
          // For security reasons, we can't get the actual path, 
          // but we can use the directory name
          onChange(dirHandle.name)
          setManualPath(dirHandle.name)
        }
      } else {
        // Fallback: trigger file input for directory selection
        fileInputRef.current?.click()
      }
    } catch (error) {
      console.log('Directory selection cancelled or failed:', error)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // Get the common path from the first file
      const firstFile = files[0]
      const path = firstFile.webkitRelativePath || firstFile.name
      const directoryPath = path.split('/')[0] || '.'
      onChange(directoryPath)
      setManualPath(directoryPath)
    }
  }

  const handleManualPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const path = e.target.value
    setManualPath(path)
    onChange(path)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          value={manualPath}
          onChange={handleManualPathChange}
          placeholder="/path/to/your/project"
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleDirectorySelect}
          disabled={disabled}
          className="px-3"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        // @ts-ignore - webkitdirectory is not in the types but is supported
        webkitdirectory=""
        onChange={handleFileInputChange}
        className="hidden"
      />
      <p className="text-xs text-muted-foreground">
        Enter the project path manually or click the folder icon to browse
      </p>
    </div>
  )
}