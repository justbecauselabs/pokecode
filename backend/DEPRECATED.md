# 🚨 DEPRECATED: Legacy Backend

⚠️ **This backend directory is deprecated and should not be used for new development.**

## Migration Status

This directory contains the original monolithic backend that has been **migrated to a modular workspace architecture**:

- ✅ **API types** → `packages/api`
- ✅ **Core business logic** → `packages/core` 
- ✅ **HTTP server** → `packages/server`
- ✅ **CLI tool** → `packages/cli`

## What to Use Instead

### For Development
```bash
# Use the modular workspace
bun run dev  # Starts server from packages/server
```

### For CLI Usage  
```bash
# Use the CLI package
cd packages/cli
bun run build
./dist/cli.js serve --port 3001
```

### For Integration
```typescript
// Import from packages instead
import { DatabaseManager } from '@pokecode/core';
import { createServer } from '@pokecode/server';
```

## Removal Timeline

- **Current**: Legacy backend kept for reference
- **Next release**: Backend directory will be removed
- **Migration complete**: All functionality available in packages/

## Legacy Usage (Deprecated)

If you absolutely need to use the legacy backend:

```bash
cd backend
bun install
bun run dev
```

⚠️ **Warning**: This may break in future releases. Please migrate to the modular packages.

---

**See `cli.md` for the complete migration plan and new architecture details.**