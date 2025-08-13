# JSONL Processing Documentation

## Overview

The backend implements a sophisticated JSONL (JSON Lines) processing system for handling Claude Code conversation data. JSONL format is used to store structured conversation histories with one JSON object per line, enabling efficient streaming and processing.

## File Structure

### JSONL Storage Location
```
~/.claude/projects/{project-key}/{sessionId}/{claudeSessionId}.jsonl
```

- **project-key**: Sanitized project path
- **sessionId**: Database session UUID for isolation
- **claudeSessionId**: Claude Code session identifier

## Core Components

### 1. Message Parser (`src/utils/message-parser.ts`)

The main utility for reading and parsing JSONL files.

```typescript
export function parseJsonlFile(filePath: string): JsonlMessage[]
```

**Features:**
- Line-by-line parsing with error recovery
- Zod schema validation per line
- Graceful handling of malformed lines
- Detailed error logging with line numbers

### 2. Message Validator (`src/utils/message-validator.ts`)

Strict validation using Zod schemas for type safety.

**Validation Levels:**
- JSON syntax validation
- Schema structure validation
- Field type validation
- Tool input validation

### 3. Type Definitions (`src/types/claude-messages.ts`)

Comprehensive TypeScript types for all message formats.

## Message Types

### Base Message Structure
```typescript
{
  uuid: string,              // Unique message identifier
  parentUuid: string | null, // Parent message for threading
  sessionId: string,         // Claude session ID
  timestamp: string,         // ISO 8601 datetime
  type: "user" | "assistant",
  isSidechain: boolean,      // Alternative conversation branch
  userType: "external",      // User type identifier
  cwd: string,              // Working directory
  version: string,          // Claude Code version
  gitBranch: string         // Active Git branch
}
```

### User Message
```typescript
{
  ...baseFields,
  type: "user",
  message: {
    content: string | MessageContent[]
  }
}
```

### Assistant Message
```typescript
{
  ...baseFields,
  type: "assistant",
  message: {
    content: Array<
      | { type: "text", text: string }
      | { type: "tool_use", name: string, input: object }
      | { type: "thinking", thinking: string }
    >
  }
}
```

## Tool Support

### Supported Tools
The system validates inputs for Claude Code tools:

- **LS**: List directory contents
- **Read**: Read file content
- **Write**: Write file content
- **Edit**: Edit file content
- **MultiEdit**: Multiple edits in one operation
- **NotebookEdit**: Jupyter notebook editing
- **Bash**: Execute shell commands
- **Grep**: Search file contents
- **Glob**: File pattern matching
- **WebFetch**: Fetch web content
- **WebSearch**: Search the web
- **TodoWrite**: Manage todo lists
- **ExitPlanMode**: Exit planning mode
- **KillBash**: Terminate bash processes
- **BashOutput**: Get bash output

### Tool Message Format
```typescript
{
  type: "tool_use",
  name: "Edit",
  input: {
    file_path: "/path/to/file",
    old_string: "original",
    new_string: "replacement"
  }
}
```

## Processing Pipeline

### 1. Reading JSONL Files
```typescript
// Read and parse entire file
const messages = parseJsonlFile(filePath);

// Process line by line
const lines = content.split('\n').filter(line => line.trim());
for (const line of lines) {
  const parsed = JSON.parse(line);
  const validated = JsonlMessageSchema.parse(parsed);
  // Process validated message
}
```

### 2. Message Conversion
```typescript
// Convert JSONL to API format
const apiChildren = jsonlToApiChildren(jsonlMessages);

// Extract specific content
const textContent = extractContent(message);
const toolCalls = extractToolCalls(message);
const toolResults = extractToolResults(message);
const thinking = extractThinking(message);
```

### 3. Error Handling
```typescript
try {
  const parsed = JSON.parse(line);
  const validated = JsonlMessageSchema.parse(parsed);
  messages.push(validated);
} catch (error) {
  if (error instanceof SyntaxError) {
    // JSON parsing error
    logger.error({ lineNumber, error }, 'JSON syntax error');
  } else if (error instanceof ZodError) {
    // Schema validation error
    logger.error({ lineNumber, error }, 'Schema validation failed');
  }
  // Skip invalid line and continue
}
```

## Database Integration

### Hybrid Storage Model
- **PostgreSQL**: Message metadata and relationships
- **JSONL Files**: Complete conversation content
- **Linking**: `claudeSessionId` field connects both

### Database Schema
```sql
CREATE TABLE session_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  text TEXT NOT NULL,
  type VARCHAR(10) NOT NULL, -- 'user' or 'assistant'
  claude_session_id TEXT,     -- Links to JSONL file
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Performance Considerations

### Current Implementation
- **Synchronous Reading**: Uses `readFileSync` for simplicity
- **In-Memory Processing**: Entire file loaded into memory
- **No Chunking**: Files processed as single units

### Optimization Opportunities
```typescript
// Stream processing for large files
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const stream = createReadStream(filePath);
const rl = createInterface({ input: stream });

rl.on('line', (line) => {
  // Process each line as it's read
  const message = JSON.parse(line);
  processMessage(message);
});
```

## Best Practices

### 1. File Management
- Use session-specific directories for isolation
- Implement file rotation for large conversations
- Regular cleanup of old session files

### 2. Error Recovery
- Log parsing errors with context
- Skip invalid lines rather than failing
- Maintain partial conversation recovery

### 3. Validation
- Always validate with Zod schemas
- Type-check at compile time
- Runtime validation for external data

### 4. Performance
- Consider streaming for files >10MB
- Implement pagination for large conversations
- Cache frequently accessed conversations

## Utilities

### Content Extraction
```typescript
// Extract text content from messages
function extractContent(msg: JsonlMessage): string

// Extract tool calls from assistant messages
function extractToolCalls(msg: AssistantJsonlMessage): ToolCall[]

// Extract tool results from user messages
function extractToolResults(msg: UserJsonlMessage): ToolResult[]

// Extract thinking content
function extractThinking(msg: AssistantJsonlMessage): string
```

### Message Transformation
```typescript
// Convert JSONL to API format
function jsonlToApiChildren(messages: JsonlMessage[]): ApiChild[]

// Convert to intermediate format
function toIntermediateMessage(msg: JsonlMessage): IntermediateMessage

// Build message tree structure
function buildMessageTree(messages: JsonlMessage[]): MessageTree
```

## Security Considerations

### Path Validation
- Absolute path requirements
- Directory traversal prevention
- Session-based access control

### Content Sanitization
- HTML escaping for web display
- JSON injection prevention
- Size limits on file processing

### Access Control
- Session-based file isolation
- User authentication required
- Project boundary enforcement

## Monitoring & Debugging

### Logging Strategy
```typescript
logger.debug({ filePath }, 'Parsing JSONL file');
logger.warn({ lineNumber, error }, 'Failed to parse line');
logger.error({ filePath, error }, 'File read failed');
```

### Debug Information
- Line numbers in error messages
- Partial line content in logs
- Validation error details
- Performance metrics for large files

## Future Enhancements

### Planned Improvements
1. **Streaming Parser**: For real-time processing
2. **Compression**: GZIP support for storage efficiency
3. **Indexing**: Fast message lookup
4. **Incremental Updates**: Append-only operations
5. **WebSocket Streaming**: Real-time client updates
6. **Search Capabilities**: Full-text search in conversations
7. **Export Formats**: Convert to Markdown, HTML, PDF