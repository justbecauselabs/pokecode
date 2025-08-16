# Agent Development Guide

## Build/Lint/Test Commands
```bash
bun test                    # Run all tests
bun test <file>            # Run single test file
bun run lint               # Check code with Biome
bun run lint:fix           # Auto-fix linting issues
bun run format             # Format code with Biome
bun run type-check         # TypeScript type checking
bun run dev:server         # Start dev server with hot reload
bun run dev:worker         # Start worker with hot reload
```

## Code Style Guidelines
- **Runtime**: Use Bun APIs (Bun.file(), Bun.$, etc.) instead of Node.js equivalents
- **Imports**: Use absolute imports with `@/` prefix for src files
- **Types**: NEVER use `any` or `unknown`. Use strict TypeScript with all checks enabled
- **Functions**: Use object params: `function foo(params: { name: string, age: number })`
- **Formatting**: 2 spaces, single quotes, trailing commas, 100 char line width
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Errors**: Throw custom error classes (ValidationError, NotFoundError) from @/types
- **Services**: Use singleton pattern with exported instances (e.g., `export const sessionService = new SessionService()`)
- **Async**: Always use async/await, never callbacks or raw promises
- **Validation**: Use TypeBox schemas for API validation, Zod for internal validation