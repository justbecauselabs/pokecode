# Pokecode Web

A React web application for interacting with the Claude Code backend, providing the same functionality as the CLI with an enhanced web UI.

## Features

- 🔐 **Authentication**: Secure JWT-based login and registration
- 📁 **Session Management**: Create, manage, and organize coding sessions
- 💬 **Real-time Chat**: Stream responses from Claude Code with SSE
- 🎨 **Enhanced UI**: Beautiful message parsing with syntax highlighting
- 📂 **Directory Picker**: GUI-based project path selection
- 🛠️ **Tool Visualization**: Rich displays for tool usage, file operations, and errors

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand
- **HTTP Client**: Axios with automatic token refresh
- **Syntax Highlighting**: Prism.js via react-syntax-highlighter
- **Icons**: Lucide React

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env to set VITE_API_URL to your backend URL (default: http://localhost:3001)
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Environment Variables

- `VITE_API_URL`: Backend API URL (default: `http://localhost:3001`)
- `VITE_DEBUG`: Enable debug mode (default: `false`)

## Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── chat/           # Chat interface components
│   ├── session/        # Session management
│   └── ui/             # Reusable UI components
├── hooks/              # Custom React hooks
├── pages/              # Route pages
├── services/           # API and external services
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Key Components

### Authentication
- Login and registration forms with validation
- JWT token management with automatic refresh
- Protected routes with auth guards

### Session Management
- Create sessions with directory picker
- List and filter existing sessions
- Session status management

### Chat Interface
- Real-time message streaming via SSE
- Message history with pagination
- Rich message parsing for code blocks, tool usage, and file operations
- Input with history navigation and keyboard shortcuts

### Message Parsing
The app intelligently parses Claude Code responses to display:
- **Code blocks**: Syntax-highlighted with copy buttons
- **Tool usage**: Visual indicators for tool execution
- **File operations**: Styled displays for file create/edit/delete
- **Errors**: Color-coded error messages

## Backend Integration

This web app connects to the Pokecode backend API:
- Authentication via `/api/auth/*` endpoints
- Session management via `/api/claude-code/sessions/*`
- Real-time chat via SSE streams
- File operations integration

## Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Preview production build
npm run preview
```

## Browser Support

- Chrome/Edge 88+ (File System Access API for directory picker)
- Firefox/Safari (fallback directory selection)