# @pokecode/api

Shared API schemas and TypeScript types for the PokéCode project.

## Overview

This package contains all the Zod schemas and TypeScript types used across the PokéCode backend and mobile applications. It serves as the single source of truth for API contracts and data validation.

## Installation

Since this is a workspace package, it's automatically linked when you run `bun install` from the repository root.

## Usage

### Import individual schemas

```typescript
import { SessionSchema, CreateSessionRequestSchema } from '@pokecode/api';
```

### Import by namespace

```typescript
import { SessionSchemas, MessageSchemas } from '@pokecode/api';

const session = SessionSchemas.SessionSchema.parse(data);
```

### Import specific schema files

```typescript
import { MessageSchema } from '@pokecode/api/schemas/message.schema';
```

## Available Schemas

### Agent Schemas
- `AgentSchema` - Individual agent definition
- `ListAgentsResponseSchema` - API response for listing agents
- `ListAgentsQuerySchema` - Query parameters for filtering agents

### Command Schemas  
- `CommandSchema` - Individual command definition
- `ListCommandsResponseSchema` - API response for listing commands
- `ListCommandsQuerySchema` - Query parameters for filtering commands

### Message Schemas
- `MessageSchema` - Core message structure
- `CreateMessageBodySchema` - Request body for creating messages
- `GetMessagesResponseSchema` - API response for retrieving messages
- Tool-specific schemas for various Claude Code tools

### Repository Schemas
- `RepositoryResponseSchema` - Repository information
- `ListRepositoriesResponseSchema` - API response for listing repositories

### Session Schemas
- `SessionSchema` - Session data structure
- `CreateSessionRequestSchema` - Request body for creating sessions
- `ListSessionsResponseSchema` - API response for listing sessions
- `UpdateSessionRequestSchema` - Request body for updating sessions

## Development

### Build the package

```bash
bun run build
```

### Type checking

```bash
bun run typecheck
```

### Watch mode

```bash
bun run dev
```

## Design Principles

- **Single Source of Truth**: All schemas are defined once and shared across projects
- **Strict TypeScript**: Full type safety with strict compiler settings
- **Zod Validation**: Runtime validation and type inference
- **Backward Compatibility**: Changes should be additive when possible