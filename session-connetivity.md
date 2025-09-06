**Session Connectivity — Spec (Drizzle + Fastify)**

- **Goal:** Device↔server connectivity using a 5s heartbeat to `POST /api/connect`, client-side UX for failures, and server-side upsert to a `devices` table with `last_connected_at`.
- **Infra Fit:** Uses existing `@pokecode/core` Drizzle ORM (bun-sqlite) and `@pokecode/server` Fastify stack with Zod schemas from `@pokecode/api`.

**Scope**
- **Included:** API contract (schemas in `@pokecode/api`), Drizzle table + migration in `@pokecode/core`, service method for upsert, Fastify route in `@pokecode/server`, client polling + modal, testing and rollout steps.
- **Excluded:** Auth beyond optional shared secret, background tasks, push notifications, multi-tenant concerns.

**API Contract**
- **Method/Path:** `POST /api/connect` (alias optional: `/connect`)
- **Request (JSON):**
  - `device_id`: string (1–128). Stable, unique per device.
  - `device_name`: string (1–128). Trimmed; human-friendly.
  - `platform` (optional): `"ios" | "android"`.
  - `app_version` (optional): string (≤64).
- **Success 200:**
  - Body: `{ "status": "ok", "poll_interval_s": 5, "server_time": "<ISO-8601 UTC>" }`
- **Validation error 422:**
  - Body: `{ "error": { "code": "INVALID_BODY", "message": "…" } }`
- **Server error 500:**
  - Body: `{ "error": { "code": "INTERNAL", "message": "…" } }`

Implementation uses Fastify with `fastify-type-provider-zod`; schemas live in `@pokecode/api` to keep server and mobile aligned.

**Client Behavior (React Native + TypeScript)**
- **Identity:**
  - Generate a stable `device_id` once (e.g., `crypto.randomUUID()`), persist via `@react-native-async-storage/async-storage`.
  - Derive `device_name` via `react-native-device-info` or a user-provided label. Trim and cap to 128 chars.
- **Polling:**
  - Start a 5s interval when app is foregrounded; stop when backgrounded (`AppState`).
  - POST to `/api/connect` with `device_id`, `device_name`, and optional `platform`, `app_version`.
  - Respect `poll_interval_s` from the server if provided.
- **Failure UX:**
  - Treat network failures and non-2xx as failure.
  - Show a “Run the server on your computer” modal after ≥2 consecutive failures to avoid flicker; hide on first success.

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

type PollerConfig = {
  serverBaseUrl: string;
  deviceId: string;
  deviceName: string;
  platform: "ios" | "android";
  appVersion?: string;
};

type PollState = {
  isConnected: boolean;
  showServerNeededModal: boolean;
  lastServerTime?: string;
  pollIntervalMs: number;
};

export function useConnectivityPoller(config: PollerConfig): PollState {
  const [state, setState] = useState<PollState>({ isConnected: false, showServerNeededModal: false, pollIntervalMs: 5000 });
  const failuresRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const appStateRef = useRef<string>(AppState.currentState);

  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch(`${config.serverBaseUrl}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: config.deviceId, device_name: config.deviceName, platform: config.platform, app_version: config.appVersion })
      });
      if (!res.ok) {
        failuresRef.current += 1;
      } else {
        const data: { status: "ok"; poll_interval_s: number; server_time: string } = await res.json();
        failuresRef.current = 0;
        setState((prev) => ({ ...prev, isConnected: true, showServerNeededModal: false, lastServerTime: data.server_time, pollIntervalMs: data.poll_interval_s * 1000 }));
      }
    } catch {
      failuresRef.current += 1;
    }
    if (failuresRef.current > 0) {
      const shouldShow = failuresRef.current >= 2;
      setState((prev) => ({ ...prev, isConnected: false, showServerNeededModal: shouldShow }));
    }
  }, [config]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    const start = () => {
      clearTimer();
      timerRef.current = setInterval(() => { void pollOnce(); }, state.pollIntervalMs);
      void pollOnce();
    };
    if (appStateRef.current === "active") start();
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
      if (next === "active") start(); else clearTimer();
    });
    return () => { sub.remove(); clearTimer(); };
  }, [pollOnce, state.pollIntervalMs, clearTimer]);

  return state;
}
```

**Modal Copy (Client)**
- Title: “Connect to Your Computer”
- Body: “We couldn’t reach the local server. Please run it on your computer and ensure your phone is on the same network.”
- Action: “Got it” dismisses.

**Error Handling Rules**
- **Validation:** Body must be valid JSON; fields within specified lengths; optional fields constrained.
- **Client treat-as-failure:** Network errors or `!res.ok` (non-2xx).
- **Debounce modal:** Show after ≥2 consecutive failures; hide on first success.
 
**Security (Optional for local dev)**
- **Shared secret header:** Client includes `X-Connect-Secret: <value>`; server checks against `CONNECT_SECRET` env.
- **Rate limiting:** Lightweight in-memory counter keyed by `device_id` per minute to mitigate abuse.

**Observability**
- **Logging:** Log truncated device ID (first 6–8 chars) and platform. Avoid full PII in logs.
- **Stats (optional):** Count new vs returning devices; track last seen.

**Testing (`bun test`)**
- **Core (service):**
  - Upsert creates on first call, preserves `created_at` on subsequent heartbeats, updates `device_name`, `last_connected_at`, `updated_at`.
- **Server (route):**
  - Invalid body → `422`, no DB write.
  - Valid body → `200` with `status: ok` and `poll_interval_s`.
- **Client:**
  - Mock `fetch` success/failure sequences; assert modal visibility toggles and interval adjustments.

**Build Checklist (Infra-Aligned)**

1) API schemas (packages/api)
- Add `src/schemas/device.schema.ts`:
  - `ConnectRequestSchema = z.object({ device_id: z.string().min(1).max(128), device_name: z.string().min(1).max(128).transform((s) => s.trim()), platform: z.enum(['ios','android']).optional(), app_version: z.string().max(64).optional() })`
  - `ConnectResponseSchema = z.object({ status: z.literal('ok'), poll_interval_s: z.number().int().positive(), server_time: z.string() })`
  - `ErrorResponseSchema = z.object({ error: z.string(), code: z.string().optional() })`
- Export from `src/index.ts`:
  - `export * from './schemas/device.schema';`

2) Drizzle schema + migration (packages/core)
- Add `src/database/schema-sqlite/devices.ts`:
  - `devices` table via `sqliteTable('devices', { deviceId: text('device_id').primaryKey(), deviceName: text('device_name').notNull(), platform: text('platform'), appVersion: text('app_version'), createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()), lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull() }, (t) => ({ lastConnectedIdx: index('idx_devices_last_connected_at').on(t.lastConnectedAt) }))`
- Export table from `src/database/schema-sqlite/index.ts`.
- Generate + push migration:
  - `bun run -w @pokecode/core db:generate`
  - `bun run -w @pokecode/core db:push`

3) Core service (packages/core)
- Add `src/services/device.service.ts`:
  - `class DeviceService { async upsertHeartbeat(p: { deviceId: string; deviceName: string; platform?: 'ios' | 'android'; appVersion?: string }): Promise<void> { const now = new Date(); await db.insert(devices).values({ deviceId: p.deviceId, deviceName: p.deviceName, platform: p.platform ?? null, appVersion: p.appVersion ?? null, lastConnectedAt: now }).onConflictDoUpdate({ target: devices.deviceId, set: { deviceName: sql\`excluded.device_name\`, platform: sql\`excluded.platform\`, appVersion: sql\`excluded.app_version\`, lastConnectedAt: now, updatedAt: now } }); } }`
  - Export instance: `export const deviceService = new DeviceService();`
- Re-export from `src/index.ts`:
  - `export * from './services/device.service'; export { deviceService } from './services/device.service';`

4) Server route (packages/server)
- Add `src/connect.ts` (Fastify plugin):
  - `fastify.post('/', { schema: { body: ConnectRequestSchema, response: { 200: ConnectResponseSchema, 422: ErrorResponseSchema } } }, async (req, reply) => { try { await deviceService.upsertHeartbeat({ deviceId: req.body.device_id, deviceName: req.body.device_name, platform: req.body.platform, appVersion: req.body.app_version }); return reply.send({ status: 'ok', poll_interval_s: 5, server_time: new Date().toISOString() }); } catch (e) { fastify.log.error({ err: e, deviceId: req.body.device_id?.slice(0,8) }, 'connect upsert failed'); return reply.code(500).send({ error: 'Unexpected server error', code: 'INTERNAL' }); } });`
- Register in `src/index.ts`:
  - `await fastify.register(import('./connect'), { prefix: '/api/connect' });`
  - Optional alias: `await fastify.register(import('./connect'), { prefix: '/connect' });`

5) Client wiring (mobile)
- Use server base URL + `/api/connect` in the poller.
- Keep the modal threshold at ≥2 consecutive failures.

6) Tests
- Core: add `tests/device.service.test.ts` (use `NODE_ENV=test` in-memory DB via existing test setup) validating first insert and subsequent update behavior.
- Server: add route tests hitting `/api/connect` and asserting 422 vs 200 and response shape.
- Mobile: mock `fetch` to simulate success/failure sequences.

7) Rollout
- Build core and server: `bun run -w @pokecode/core build && bun run -w @pokecode/server build`.
- Start server (through your existing CLI/start flow).
- Verify with curl: `curl -X POST http://localhost:3001/api/connect -H 'Content-Type: application/json' -d '{"device_id":"abc123","device_name":"Billy iPhone"}'`.
- Confirm DB row in `~/.pokecode/pokecode.db` (Drizzle Studio or sqlite3).

**Operational Notes**
- Intended for local dev or same-network workflows. For broader exposure, add TLS and auth.
- Consider a daily cleanup job to remove devices not seen in N days if the table grows.

**Appendix — Example Code Snippets (Infra-Compatible)**

- Drizzle table (packages/core/src/database/schema-sqlite/devices.ts)
```ts
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const devices = sqliteTable(
  'devices',
  {
    deviceId: text('device_id').primaryKey(),
    deviceName: text('device_name').notNull(),
    platform: text('platform'),
    appVersion: text('app_version'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()),
    lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({ lastConnectedIdx: index('idx_devices_last_connected_at').on(t.lastConnectedAt) }),
);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
```

- Core service (packages/core/src/services/device.service.ts)
```ts
import { sql } from 'drizzle-orm';
import { db } from '../database';
import { devices } from '../database/schema-sqlite/devices';

export class DeviceService {
  async upsertHeartbeat(params: { deviceId: string; deviceName: string; platform?: 'ios' | 'android'; appVersion?: string }): Promise<void> {
    const now = new Date();
    await db
      .insert(devices)
      .values({
        deviceId: params.deviceId,
        deviceName: params.deviceName,
        platform: params.platform ?? null,
        appVersion: params.appVersion ?? null,
        lastConnectedAt: now,
      })
      .onConflictDoUpdate({
        target: devices.deviceId,
        set: {
          deviceName: sql`excluded.device_name`,
          platform: sql`excluded.platform`,
          appVersion: sql`excluded.app_version`,
          lastConnectedAt: now,
          updatedAt: now,
        },
      });
  }
}

export const deviceService = new DeviceService();
```

- API schemas (packages/api/src/schemas/device.schema.ts)
```ts
import { z } from 'zod';

export const ConnectRequestSchema = z.object({
  device_id: z.string().min(1).max(128),
  device_name: z.string().min(1).max(128).transform((s) => s.trim()),
  platform: z.enum(['ios', 'android']).optional(),
  app_version: z.string().max(64).optional(),
});
export type ConnectRequest = z.infer<typeof ConnectRequestSchema>;

export const ConnectResponseSchema = z.object({
  status: z.literal('ok'),
  poll_interval_s: z.number().int().positive(),
  server_time: z.string(),
});
export type ConnectResponse = z.infer<typeof ConnectResponseSchema>;

export const ErrorResponseSchema = z.object({ error: z.string(), code: z.string().optional() });
```

- Fastify route (packages/server/src/connect.ts)
```ts
import type { FastifyPluginAsync } from 'fastify';
import { deviceService } from '@pokecode/core';
import { ConnectRequestSchema, ConnectResponseSchema } from '@pokecode/api';
import { z } from 'zod';

const connectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof ConnectRequestSchema> }>(
    '/',
    {
      schema: {
        body: ConnectRequestSchema,
        response: {
          200: ConnectResponseSchema,
          422: z.object({ error: z.string(), code: z.string().optional() }),
          500: z.object({ error: z.string(), code: z.string().optional() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await deviceService.upsertHeartbeat({
          deviceId: request.body.device_id,
          deviceName: request.body.device_name,
          platform: request.body.platform,
          appVersion: request.body.app_version,
        });
        return reply.send({ status: 'ok', poll_interval_s: 5, server_time: new Date().toISOString() });
      } catch (error) {
        fastify.log.error({ error, device: request.body.device_id?.slice(0, 8) }, 'connect upsert failed');
        return reply.code(500).send({ error: 'Unexpected server error', code: 'INTERNAL' });
      }
    },
  );
};

export default connectRoutes;
```

- Server registration (packages/server/src/index.ts)
```ts
await fastify.register(import('./connect'), { prefix: '/api/connect' });
// Optional alias for legacy path
// await fastify.register(import('./connect'), { prefix: '/connect' });
```
