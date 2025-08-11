# Filesystem Safety: Prevent Escapes and Constrain Project Roots

This document explains the current risks around filesystem access in the API and shows concrete changes to harden the implementation.

## Problems

- Symlink escape: The file service uses `path.resolve()` for containment checks, but does not verify real (symlink-resolved) paths. A symlink inside the project can point outside and still pass checks, enabling reads/writes outside the intended workspace.
- Unbounded project roots: `POST /api/claude-code/sessions` accepts arbitrary absolute `projectPath` values from clients. A client can point sessions at any path readable by the server process (e.g., `/etc`, `/home/*`, other app data).
- Overly strict regex: The `projectPath` schema requires `^[a-zA-Z0-9._/-]+$`, which excludes valid characters (spaces, Unicode), and all Windows-style paths. Decide on OS support; if Unix-only, still consider allowing spaces. If cross-platform, support `C:\...`-style paths.

## Goals

- Ensure any file operation stays within the intended session root, even when symlinks are involved.
- Restrict session project roots to a configured allowlist, typically under a single `PROJECTS_ROOT` directory.
- Validate that project roots exist and are directories; persist the canonical real path.
- Keep schema constraints accurate and user-friendly.

## Recommended Changes

1) Add `PROJECTS_ROOT` to the environment and config

```ts
// backend/src/config/env.schema.ts
export const envSchema = z.object({
  // ...existing...
  PROJECTS_ROOT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
```

```ts
// backend/src/config/index.ts
export const getProjectsRoot = () => config.PROJECTS_ROOT;
```

Notes:
- If your deployment requires strict confinement, make `PROJECTS_ROOT` required. During local dev you may keep it optional, but the service should behave safely either way.

2) Resolve and store canonical project roots in sessions

```ts
// backend/src/services/session.service.ts (excerpt)
import fs from 'node:fs/promises';

private async canonicalizeProjectPath(inputPath: string): Promise<string> {
  const raw = inputPath.trim();
  // If Unix-only, allow spaces and common chars; adjust as needed
  if (!/^[\w\-./ ~]+$/.test(raw)) {
    throw new ValidationError('Invalid project path');
  }

  const normalized = path.normalize(raw);
  if (!path.isAbsolute(normalized)) {
    throw new ValidationError('Project path must be absolute');
  }

  // Must exist and be a directory
  const stats = await fs.stat(normalized).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new ValidationError('Project path must be an existing directory');
  }

  // Resolve symlinks to canonical path
  const real = await fs.realpath(normalized);

  // If configured, ensure under PROJECTS_ROOT
  const projectsRoot = getProjectsRoot();
  if (projectsRoot) {
    const realRoot = await fs.realpath(projectsRoot);
    const prefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
    if (real !== realRoot && !real.startsWith(prefix)) {
      throw new ValidationError('Project path must be inside PROJECTS_ROOT');
    }
  }
  return real;
}

async createSession(userId: string, data: { projectPath: string; context?: string; metadata?: any; }) {
  const projectPath = await this.canonicalizeProjectPath(data.projectPath);
  const [session] = await db.insert(sessions).values({
    userId,
    projectPath, // store canonical realpath
    context: data.context,
    metadata: data.metadata,
    status: 'active',
  }).returning();
  return this.formatSession(session);
}
```

3) Enforce realpath-based containment for all file operations

```ts
// backend/src/services/file.service.ts (replace validatePath)
import fsp from 'node:fs/promises';

async validatePath(sessionPath: string, requestedPath: string): Promise<string> {
  const normalizedPath = path.normalize(requestedPath);
  if (path.isAbsolute(normalizedPath) || normalizedPath.includes('..')) {
    throw new ValidationError('Invalid file path');
  }

  // Resolve real paths for base and target (symlink-aware)
  const realBase = await fsp.realpath(path.resolve(sessionPath));
  const realTarget = await fsp.realpath(path.resolve(realBase, normalizedPath)).catch(async (e) => {
    // For create operations the file may not exist yet; realpath the parent
    if ((e as any)?.code === 'ENOENT') {
      const parent = path.dirname(path.resolve(realBase, normalizedPath));
      const realParent = await fsp.realpath(parent);
      const candidate = path.resolve(realParent, path.basename(normalizedPath));
      return candidate; // not guaranteed to exist yet
    }
    throw e;
  });

  const prefix = realBase.endsWith(path.sep) ? realBase : realBase + path.sep;
  if (realTarget !== realBase && !String(realTarget).startsWith(prefix)) {
    throw new AuthorizationError('Path traversal attempt detected');
  }
  return realTarget;
}
```

4) Relax the `projectPath` schema or document OS support

If Unix-only, allow spaces and common safe characters:

```ts
// backend/src/schemas/session.schema.ts
export const CreateSessionRequestSchema = Type.Object({
  projectPath: Type.String({
    // allow letters, digits, underscore, dash, dot, slash, space, and tilde
    pattern: '^[\\w\-./ ~]+$',
    minLength: 1,
    maxLength: 4096,
  }),
  // ...
});
```

If cross-platform, consider omitting the regex entirely and rely on service-level validation (above) to enforce existence and realpath confinement.

## Testing Tips

- Create a symlink inside a valid session root to a path outside (e.g., `/etc/hosts`). Verify that reads or writes through the symlink fail with AuthorizationError.
- Attempt creating a session pointing to `/` or another system path; verify rejection when `PROJECTS_ROOT` is configured.
- Attempt file creation on a non-existent path; ensure the directory traversal rules still hold.

