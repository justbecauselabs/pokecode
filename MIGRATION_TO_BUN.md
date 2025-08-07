# Bun-Only Project Configuration

## ⚠️ IMPORTANT: This project requires Bun

This project has been configured to use **Bun exclusively** as its JavaScript runtime and package manager. Node.js, npm, yarn, and pnpm are **NOT supported**.

## Installation

### Install Bun (Required)
```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (WSL required)
curl -fsSL https://bun.sh/install | bash

# Homebrew
brew install oven-sh/bun/bun

# Docker
docker run --rm --init --ulimit memlock=-1:-1 oven/bun
```

### Verify Installation
```bash
bun --version  # Should output 1.0.0 or higher
```

## Project Setup

### 1. Install Dependencies
```bash
# Install all dependencies (root, backend, mobile)
bun install:all

# Or install individually
bun install              # Root dependencies
cd backend && bun install  # Backend dependencies
cd mobile && bun install   # Mobile dependencies
```

### 2. Development Commands

#### Backend
```bash
cd backend
bun dev          # Start development server with hot reload
bun build        # Build for production
bun start        # Run production build
bun test         # Run tests
bun test:e2e     # Run E2E tests
bun migrate      # Run database migrations
bun seed         # Seed database
```

#### Mobile
```bash
cd mobile
bun start        # Start Expo development server
bun ios          # Start iOS simulator
bun android      # Start Android emulator
bun test         # Run tests
bun type-check   # TypeScript type checking
bun prebuild     # Generate native code
```

#### Root Commands
```bash
bun dev          # Start both backend and mobile
bun build        # Build all projects
bun test         # Run all tests
bun lint         # Lint all code
bun type-check   # Type check all code
```

## Key Features of Bun

### Built-in Features
- **TypeScript Support**: Native TypeScript execution without configuration
- **Test Runner**: Built-in test runner (replaces Jest/Vitest)
- **Package Manager**: Fast package installation (replaces npm/yarn/pnpm)
- **Bundler**: Built-in bundler for production builds
- **Watch Mode**: Built-in file watcher for development

### Performance
- **10x faster** package installation
- **4x faster** test execution
- **3x faster** TypeScript transpilation
- Native ESM and CommonJS support

## Migration Notes

### Removed Dependencies
The following Node.js-specific dependencies have been removed:
- `tsx` - Bun natively executes TypeScript
- `vitest` - Replaced with Bun's test runner
- `@vitest/*` - No longer needed
- `dotenv` - Bun has built-in .env support
- `@types/node` - Replaced with `@types/bun`

### Script Changes
All scripts now use Bun commands:
- `npm/yarn/pnpm` → `bun`
- `npx` → `bunx`
- `node` → `bun`
- `tsx` → `bun`
- `vitest` → `bun test`

### Docker Configuration
The Docker image has been updated to use `oven/bun:1-alpine` instead of Node.js base images.

## Testing with Bun

### Write Tests
```javascript
// test.spec.ts
import { describe, it, expect } from "bun:test";

describe("Example", () => {
  it("should work", () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Run Tests
```bash
bun test                 # Run all tests
bun test --watch        # Watch mode
bun test --coverage     # Coverage report
bun test file.test.ts   # Run specific file
```

## Environment Variables

Bun automatically loads `.env` files:
```bash
# .env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Access in code
console.log(Bun.env.DATABASE_URL);
console.log(process.env.DATABASE_URL); # Also works
```

## Common Issues & Solutions

### Issue: "bun: command not found"
**Solution**: Add Bun to your PATH:
```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

### Issue: Module not found errors
**Solution**: Clear cache and reinstall:
```bash
rm -rf node_modules bun.lockb
bun install --force
```

### Issue: TypeScript errors
**Solution**: Bun uses its own TypeScript config:
```bash
bunx tsc --noEmit  # For type checking only
```

### Issue: Test files not found
**Solution**: Bun looks for:
- `*.test.ts`, `*.test.tsx`, `*.test.js`, `*.test.jsx`
- `*.spec.ts`, `*.spec.tsx`, `*.spec.js`, `*.spec.jsx`
- Files in `__tests__` directories

## CI/CD Configuration

### GitHub Actions
```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bun test
      - run: bun run build
```

### GitLab CI
```yaml
image: oven/bun:1-alpine

stages:
  - test
  - build

test:
  stage: test
  script:
    - bun install
    - bun test

build:
  stage: build
  script:
    - bun install
    - bun run build
```

## Production Deployment

### Dockerfile
```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY . .
RUN bun run build
CMD ["bun", "run", "start"]
```

### PM2 Alternative
Use Bun's built-in process manager:
```bash
bun --watch src/server.ts  # Development
bun src/server.ts          # Production
```

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [Bun API Reference](https://bun.sh/docs/api)
- [Bun Runtime APIs](https://bun.sh/docs/runtime)
- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Bun Package Manager](https://bun.sh/docs/cli/install)
- [Discord Community](https://discord.gg/bun)

## ⛔ NOT SUPPORTED

The following tools are **NOT supported** in this project:
- ❌ Node.js
- ❌ npm
- ❌ yarn  
- ❌ pnpm
- ❌ npx (use `bunx` instead)

**Only Bun is supported. Please ensure Bun is installed before proceeding.**