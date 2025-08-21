# PokéCode

A CLI tool and mobile application for AI-powered coding assistance.

## Project Structure

This is a monorepo containing:

- `/packages/api` - Shared API schemas and types
- `/packages/core` - Core business logic and database operations
- `/packages/server` - Fastify HTTP server
- `/packages/cli` - Command-line interface
- `/mobile` - React Native Expo application

## Prerequisites

- Bun >= 1.0.0
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

## Quick Start

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start development server:**
   ```bash
   bun dev
   ```

3. **Build CLI:**
   ```bash
   bun run cli:compile
   ```

## Development

### Server Development

The server provides:
- REST API with Fastify
- SQLite database with Drizzle ORM
- JWT authentication
- Real-time streaming capabilities

```bash
bun dev:server  # Start development server
```

API documentation available at development server endpoint.

### CLI Development

```bash
bun dev:cli     # Start CLI in development mode
```

### Mobile Development

The mobile app features:
- React Native with Expo SDK 52
- TypeScript for type safety
- Expo Router for navigation
- React Query for server state
- Zustand for client state

```bash
cd mobile
bun start      # Start Expo development server
bun ios        # Run on iOS simulator
bun android    # Run on Android emulator
```

## Architecture

### Server Architecture
- **Framework**: Fastify with TypeScript
- **Database**: SQLite with Drizzle ORM
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schemas

### Mobile Architecture
- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based)
- **State Management**: React Query + Zustand
- **UI Components**: Custom components with React Native Paper

## Scripts

### Root Commands
- `bun dev` - Start server in development mode
- `bun build` - Build all packages
- `bun test` - Run all tests
- `bun lint` - Lint all packages
- `bun typecheck` - Type check all packages

### CLI Commands
- `bun dev:cli` - Start CLI in development mode
- `bun cli:compile` - Compile CLI to executable

### Mobile Commands
- `bun dev:mobile` - Start Expo development server

## Testing

```bash
bun test        # Run all tests
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT