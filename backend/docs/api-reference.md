# API Reference

## Base Configuration

- **Base URL**: `/api/claude-code`
- **Content-Type**: `application/json`
- **Authentication**: JWT Bearer tokens (where required)

## Rate Limits

| Operation Type | Limit | Window |
|---------------|-------|--------|
| Message Creation | 10 requests | 1 minute |
| File Operations | 100 requests | 1 minute |
| Read Operations | 1000 requests | 1 minute |

## Health Endpoints

### System Health Check
```http
GET /health
```

Comprehensive health check for all services.

**Response 200:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "queue": "healthy"
  },
  "version": "1.0.0",
  "uptime": 12345
}
```

### Liveness Probe
```http
GET /health/live
```

Simple liveness check for container orchestration.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Readiness Probe
```http
GET /health/ready
```

Indicates if the service is ready to accept traffic.

**Response 200/503:**
```json
{
  "ready": true,
  "checks": {
    "database": true
  }
}
```

## Repository Management

### List Repositories
```http
GET /api/claude-code/repositories
```

Lists all Git repositories in the configured directory.

**Response 200:**
```json
{
  "repositories": [
    {
      "folderName": "my-project",
      "path": "/path/to/repository",
      "isGitRepository": true
    }
  ],
  "total": 1,
  "githubReposDirectory": "/configured/repos/path"
}
```

## Session Management

### Create Session
```http
POST /api/claude-code/sessions
```

Creates a new Claude Code session.

**Request Body:**
```json
{
  "projectPath": "/path/to/project",
  "folderName": "project-name",
  "context": "Session description",
  "metadata": {
    "repository": "repo-name",
    "branch": "main",
    "allowedTools": ["Read", "Write", "Edit"]
  }
}
```

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "projectPath": "/path/to/project",
  "claudeDirectoryPath": "/home/user/.claude/projects/project-name",
  "claudeCodeSessionId": null,
  "context": "Session description",
  "status": "active",
  "metadata": {},
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### List Sessions
```http
GET /api/claude-code/sessions
```

Lists sessions with pagination and filtering.

**Query Parameters:**
- `status`: `active` | `inactive` | `archived`
- `limit`: 1-100 (default: 20)
- `offset`: Pagination offset (default: 0)

**Response 200:**
```json
{
  "sessions": [...],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

### Get Session
```http
GET /api/claude-code/sessions/:sessionId
```

Retrieves a specific session.

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "projectPath": "/path/to/project",
  "claudeDirectoryPath": "/home/user/.claude/projects/project-name",
  "claudeCodeSessionId": "claude-session-123",
  "context": "Session description",
  "status": "active",
  "metadata": {},
  "isWorking": false,
  "currentJobId": null,
  "lastJobStatus": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "lastAccessedAt": "2024-01-01T00:00:00.000Z"
}
```

### Update Session
```http
PATCH /api/claude-code/sessions/:sessionId
```

Updates session properties.

**Request Body:**
```json
{
  "context": "Updated description",
  "status": "archived",
  "metadata": {
    "tags": ["important"]
  }
}
```

**Response 200:** Updated session object

### Delete Session
```http
DELETE /api/claude-code/sessions/:sessionId
```

Deletes a session.

**Response 200:**
```json
{
  "success": true
}
```

## Message Management

### Message Schema

The message schema includes tool calls and their results:

```typescript
interface ToolCall {
  id?: string;           // Tool use ID for linking
  name: string;          // Tool name (e.g., "Read", "Edit")
  input: any;            // Tool input parameters
  result?: {             // Optional result (when tool has been executed)
    content: string;     // Result content
    isError?: boolean;   // Whether the result is an error
  };
}

interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];     // Tool calls with optional results
  // ... other fields
}
```

**Note:** Tool results are included directly in the `toolCalls` array as an optional `result` field on each tool call. When a tool has been executed, its result will be present in the `result` field.

### Send Message
```http
POST /api/claude-code/sessions/:sessionId/messages
```

Sends a message to Claude Code for processing.

**Rate Limit:** 10 requests per minute

**Request Body:**
```json
{
  "content": "Please help me refactor this function",
  "allowedTools": ["Read", "Edit", "Write"]
}
```

**Response 201:**
```json
{
  "message": {
    "id": "msg-123",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user",
    "content": "Please help me refactor this function",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "claudeSessionId": "claude-session-123"
  }
}
```

### Get Messages
```http
GET /api/claude-code/sessions/:sessionId/messages
```

Retrieves all messages in a session.

**Rate Limit:** 1000 requests per minute

**Response 200:**
```json
{
  "messages": [
    {
      "id": "msg-123",
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "content": "Please help me refactor this function",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "claudeSessionId": "claude-session-123",
      "children": [
        {
          "id": "msg-124",
          "role": "assistant",
          "content": "I'll help you refactor that function...",
          "timestamp": "2024-01-01T00:00:01.000Z",
          "toolCalls": [
            {
              "id": "tool-123",
              "name": "Read",
              "input": {
                "file_path": "/path/to/file.js"
              },
              "result": {
                "content": "File content...",
                "isError": false
              }
            }
          ],
          "thinking": "Let me analyze this function..."
        }
      ]
    }
  ],
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "isWorking": false,
    "currentJobId": null,
    "lastJobStatus": "completed",
    "status": "active"
  }
}
```

## File Management

### List Files
```http
GET /api/claude-code/sessions/:sessionId/files
```

Lists files in the session's project directory.

**Query Parameters:**
- `path`: Directory path (default: ".")
- `recursive`: Include subdirectories (default: false)
- `pattern`: File pattern filter (e.g., "*.js")

**Response 200:**
```json
{
  "files": [
    {
      "path": "src/index.js",
      "name": "index.js",
      "type": "file",
      "size": 1024,
      "modifiedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "path": "src/components",
      "name": "components",
      "type": "directory",
      "size": 0,
      "modifiedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "basePath": "/absolute/project/path"
}
```

### Read File
```http
GET /api/claude-code/sessions/:sessionId/files/*
```

Reads file content.

**Response 200:**
```json
{
  "path": "src/index.js",
  "content": "console.log('Hello World');",
  "encoding": "utf-8",
  "size": 28,
  "mimeType": "text/javascript",
  "modifiedAt": "2024-01-01T00:00:00.000Z"
}
```

### Create File
```http
POST /api/claude-code/sessions/:sessionId/files/*
```

Creates a new file.

**Request Body:**
```json
{
  "content": "console.log('Hello World');",
  "encoding": "utf-8"
}
```

**Response 201:**
```json
{
  "path": "src/new-file.js",
  "size": 28,
  "created": true
}
```

### Update File
```http
PUT /api/claude-code/sessions/:sessionId/files/*
```

Updates existing file content.

**Request Body:**
```json
{
  "content": "console.log('Updated content');",
  "encoding": "utf-8"
}
```

**Response 200:**
```json
{
  "path": "src/existing-file.js",
  "size": 32,
  "updated": true
}
```

### Delete File
```http
DELETE /api/claude-code/sessions/:sessionId/files/*
```

Deletes a file.

**Response 200:**
```json
{
  "success": true,
  "path": "src/deleted-file.js"
}
```

## Error Responses

All endpoints follow a consistent error format:

### Validation Error (400)
```json
{
  "error": "Invalid request parameters",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "projectPath",
    "message": "Project path is required"
  }
}
```

### Not Found (404)
```json
{
  "error": "Session not found",
  "code": "NOT_FOUND"
}
```

### Rate Limit (429)
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "details": {
    "limit": 10,
    "window": 60000,
    "retryAfter": 45
  }
}
```

### Server Error (500)
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

## File Restrictions

### Allowed Extensions
`.js`, `.ts`, `.jsx`, `.tsx`, `.json`, `.md`, `.txt`, `.html`, `.css`, `.scss`, `.less`, `.py`, `.java`, `.cpp`, `.c`, `.h`, `.hpp`, `.rs`, `.go`, `.rb`, `.php`, `.swift`, `.kt`, `.yaml`, `.yml`, `.toml`, `.xml`, `.sh`, `.bash`, `.zsh`, `.fish`, `.gitignore`, `.dockerignore`, `Dockerfile`, `Makefile`

### Limits
- **Maximum file size**: 10MB
- **Maximum path length**: 1000 characters
- **Directory traversal**: Blocked

## WebSocket Events (Future)

The API is designed to support WebSocket connections for real-time updates:

### Event Types
- `message:start` - Message processing started
- `message:delta` - Incremental content updates
- `message:stop` - Message processing completed
- `tool:use` - Tool invocation
- `tool:result` - Tool execution result
- `error` - Processing error

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3001/api/claude-code/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log(event.type, event.data);
});
```