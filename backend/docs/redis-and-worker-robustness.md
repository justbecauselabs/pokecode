# Redis and Worker Robustness: Fewer Connections, Better Lifecycle

This guide covers improvements to Redis client usage across the API, queue, and worker, and clarifies stream cancellation semantics.

## Problems

- Connection sprawl: Multiple modules create their own Redis clients (`jwtService`, rate-limit hook, queue, stream route, health route). This increases connection counts and complicates lifecycle management.
- Early connections: Some services (e.g., `jwtService`) connect during module import, not tied to Fastify lifecycle. If the server shuts down, that connection may linger.
- Cancel semantics: `cancelJob` publishes a `type: 'complete'` event, conflating cancellation with completion. Clients cannot distinguish and may mis-handle UI.

## Goals

- Reduce the number of Redis connections; reuse where appropriate.
- Ensure all Redis clients connect lazily and are closed on server shutdown.
- Emit distinct stream events for `cancelled` and finalize streams consistently.

## Recommended Changes

1) Introduce a Redis provider to centralize clients

```ts
// backend/src/utils/redis.ts
import { Redis } from 'ioredis';
import { config } from '@/config';

class RedisProvider {
  private _pub?: Redis;
  private _sub?: Redis;
  private _general?: Redis;

  get general() {
    if (!this._general) this._general = new Redis(config.REDIS_URL);
    return this._general;
  }

  get pub() {
    if (!this._pub) this._pub = new Redis(config.REDIS_URL);
    return this._pub;
  }

  get sub() {
    if (!this._sub) this._sub = new Redis(config.REDIS_URL);
    return this._sub;
  }

  async quitAll() {
    await Promise.all([
      this._pub?.quit(),
      this._sub?.quit(),
      this._general?.quit(),
    ].filter(Boolean) as Promise<any>[]);
  }
}

export const redisProvider = new RedisProvider();
```

Usage examples:

```ts
// queue.service.ts
import { redisProvider } from '@/utils/redis';
this.queue = new Queue('claude-code-jobs', { connection: redisProvider.general });
this.redis = redisProvider.pub;
```

```ts
// routes/sessions/stream.ts
const redis = redisProvider.sub; // subscribe client
```

Add a server lifecycle hook to close on shutdown:

```ts
// backend/src/app.ts
import { redisProvider } from '@/utils/redis';
fastify.addHook('onClose', async () => { await redisProvider.quitAll(); });
```

2) Tie jwtService to lifecycle or make it lazy

- Option A: Inject a Redis client into `JWTService` from the provider instead of constructing on import.

```ts
// backend/src/utils/jwt.ts
constructor(redis?: Redis) {
  this.redis = redis ?? redisProvider.general;
}

export const jwtService = new JWTService(redisProvider.general);
```

- Option B: Create the Redis client on first use (lazy) and close it in `onClose`.

3) Emit explicit `cancelled` events

```ts
// backend/src/services/queue.service.ts (cancelJob)
await db.update(prompts).set({ status: 'cancelled', completedAt: new Date() }).where(eq(prompts.id, promptId));
if (sessionId) {
  await this.publishEvent(sessionId, promptId, {
    type: 'cancelled',
    data: { type: 'cancelled', timestamp: new Date().toISOString() },
  });
}
```

Then, ensure the SSE route ends the stream on any terminal event:

```ts
// backend/src/routes/sessions/stream.ts
if (['complete', 'error', 'cancelled'].includes(event.type)) {
  await cleanupRedis();
  reply.raw.end();
}
```

4) Health checks with lazy, short-lived clients

- The health route already creates short-lived clients with timeouts; keep them lazy and always `quit()`.

## Testing Tips

- Start the server, hit `/health`, open/close multiple streams; watch Redis connection count in `INFO clients` and ensure it stays bounded.
- Trigger `cancelPrompt` and verify clients receive `cancelled` and the stream closes.
- Stop the server (SIGINT/SIGTERM) and check that all clients disconnect and Redis shows no lingering connections from the process.

