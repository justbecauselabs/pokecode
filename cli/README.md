# PokeCode CLI

A Terminal User Interface (TUI) client for interacting with the PokeCode backend API, featuring real-time chat with Server-Sent Events (SSE) streaming.

## Features

- 🔐 **Secure Authentication**: Login/register with JWT token management
- 💬 **Real-time Chat Interface**: Interactive chat with streaming responses
- 📁 **Session Management**: Create, resume, and manage multiple sessions
- 🎨 **Syntax Highlighting**: Beautiful code block rendering
- ⌨️ **Keyboard Shortcuts**: Efficient navigation and control
- 🔄 **Auto-reconnection**: Resilient SSE connection handling
- 🐛 **Debug Mode**: Verbose logging for troubleshooting

## Installation

```bash
# Install dependencies
bun install

# Build the CLI
bun run build
```

## Usage

### Basic Commands

```bash
# Show help
bun run dev help

# Login to your account
bun run dev login

# Start a chat session
bun run dev chat

# Logout
bun run dev logout
```

### Debug Mode

```bash
# Run with debug logging
bun run dev chat --debug

# Run with verbose logging
bun run dev chat --verbose
```

## Chat Interface

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Ctrl+C` | Clear current input |
| `Ctrl+L` | Clear screen |
| `Ctrl+D` | Exit application |
| `↑/↓` | Navigate message history |
| `←/→` | Move cursor |
| `Home/End` | Jump to start/end of input |

### Session Management

When you run `bun run dev chat`, you can:
- Resume your most recent session
- Create a new session with a project path
- Choose from existing sessions

Sessions are automatically saved and can be resumed later.

## Configuration

Configuration is stored in `~/.pokecode-cli/config.json`:

```json
{
  "serverUrl": "http://localhost:3001",
  "auth": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { ... }
  },
  "recentSessions": [...],
  "debug": false,
  "verbose": false
}
```

### Environment Variables

- `POKECODE_API_URL`: Override the default API server URL

## Architecture

### Technology Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **UI Framework**: Ink (React for CLI) + Clack (prompts)
- **Streaming**: Server-Sent Events (SSE)

### Project Structure

```
cli/
├── src/
│   ├── components/     # Ink React components
│   ├── screens/        # Screen components
│   ├── services/       # Business logic
│   ├── types/          # TypeScript types
│   ├── utils/          # Utilities
│   └── index.ts        # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Running in Development

```bash
# Start with hot reload
bun run dev

# Type checking
bun run typecheck

# Linting
bun run lint
```

### Testing

```bash
# Manual testing with debug mode
bun run dev chat --debug

# Test authentication flow
bun run dev login

# Test with verbose logging
bun run dev chat --verbose
```

## Troubleshooting

### Connection Issues

If you see "Connecting..." forever:
1. Check if the backend server is running (`http://localhost:3001`)
2. Verify your authentication token is valid
3. Run with `--debug` to see detailed logs

### No AI Responses

The backend requires a worker process to handle AI prompts. If you're getting mock responses:
1. Check if the backend worker is running
2. Verify Redis is running for queue management
3. Check backend logs for queue processing errors

### Authentication Errors

If you get authentication errors:
1. Try logging out and logging in again: `bun run dev logout && bun run dev login`
2. Check if your tokens have expired
3. Verify the backend server is accessible

## Known Limitations

- **Backend Worker Required**: Real AI responses require the backend worker to be running
- **Single Session Focus**: Currently optimized for single active session
- **Text Only**: File upload/download not yet supported

## Future Enhancements

- [ ] Multiple concurrent sessions
- [ ] File upload/download capabilities
- [ ] Export conversation history
- [ ] Custom themes
- [ ] Plugin system

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues or questions, please check the backend documentation or create an issue in the repository.