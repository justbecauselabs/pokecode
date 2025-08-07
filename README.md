# Claude Code Mobile

A native mobile application for interacting with Claude Code, providing a mobile-optimized interface for AI-powered coding assistance.

## Project Structure

This is a monorepo containing:

- `/backend` - Fastify API server
- `/mobile` - React Native Expo application

## Prerequisites

- Node.js >= 18.0.0
- bun >= 1.0.0
- PostgreSQL
- Redis
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

## Quick Start

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set up environment variables:**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration

   # Mobile
   cp mobile/.env.example mobile/.env
   # Edit mobile/.env if needed (default points to localhost:3001)
   ```

3. **Run database migrations:**
   ```bash
   bun --filter @claude-code-mobile/backend migrate
   ```

4. **Start development servers:**
   ```bash
   # Start both backend and mobile
   bun dev

   # Or start individually
   bun dev:backend  # Backend on http://localhost:3001
   bun dev:mobile   # Mobile with Expo
   ```

## Development

### Backend Development

The backend provides:
- REST API with Fastify
- PostgreSQL database with Drizzle ORM
- JWT authentication
- Server-Sent Events for streaming
- BullMQ job queue integration
- File system access with sandboxing

```bash
cd backend
bun dev        # Start development server
bun test       # Run tests
bun build      # Build for production
```

API documentation available at: http://localhost:3001/docs

### Mobile Development

The mobile app features:
- React Native with Expo SDK 52
- TypeScript for type safety
- Expo Router for navigation
- React Query for server state
- Zustand for client state
- Real-time streaming with SSE

```bash
cd mobile
bun start      # Start Expo development server
bun ios        # Run on iOS simulator
bun android    # Run on Android emulator
```

## Architecture

### Backend Architecture
- **Framework**: Fastify with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Queue**: BullMQ with Redis
- **Authentication**: JWT with refresh tokens
- **Validation**: TypeBox for JSON Schema validation

### Mobile Architecture
- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based)
- **State Management**: React Query + Zustand
- **UI Components**: Custom components with React Native Paper
- **Real-time**: Server-Sent Events (SSE)

## Scripts

### Root Commands
- `bun dev` - Start all services in development mode
- `bun build` - Build all packages
- `bun test` - Run all tests
- `bun lint` - Lint all packages
- `bun type-check` - Type check all packages

### Backend Commands
- `bun dev:backend` - Start backend development server
- `bun --filter @claude-code-mobile/backend migrate` - Run database migrations
- `bun --filter @claude-code-mobile/backend test` - Run backend tests

### Mobile Commands
- `bun dev:mobile` - Start Expo development server
- `bun --filter @claude-code-mobile/mobile ios` - Run on iOS
- `bun --filter @claude-code-mobile/mobile android` - Run on Android

## Testing

### Backend Testing
```bash
cd backend
bun test        # Run unit tests
bun test:ui     # Run tests with UI
bun test:coverage  # Generate coverage report
```

### Mobile Testing
```bash
cd mobile
bun test        # Run Jest tests
```

## Deployment

### Backend Deployment
The backend includes a Dockerfile for containerized deployment:

```bash
cd backend
docker build -t claude-code-mobile-backend .
docker run -p 3001:3001 claude-code-mobile-backend
```

### Mobile Deployment
Use EAS Build for creating production builds:

```bash
cd mobile
bun eas:build:production
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT