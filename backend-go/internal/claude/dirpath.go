package claude

import (
    "os"
    "path/filepath"
    "strings"
)

// ClaudeDirectoryPath builds ~/.claude/projects/<projectKey>/<sessionId>
func ClaudeDirectoryPath(projectPath string, sessionID string) string {
    home, _ := os.UserHomeDir()
    base := filepath.Join(home, ".claude", "projects")
    projectKey := strings.ReplaceAll(projectPath, "/", "-")
    projectKey = strings.ReplaceAll(projectKey, "_", "-")
    return filepath.Join(base, projectKey, sessionID)
}

