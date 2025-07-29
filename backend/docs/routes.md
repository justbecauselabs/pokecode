# Routes Documentation

This guide covers how to create and structure routes in the Claude Code Mobile backend using Fastify.

## Route Structure

Routes in this application follow a modular pattern where each route file exports a `FastifyPluginAsync` function.

### Basic Route Structure

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';

const myRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: {
        200: Type.Object({
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    return { message: 'Hello World' };
  });
};

export default myRoute;
```

## Route Registration

Routes are registered in `/src/app.ts` with prefixes:

```typescript
// Register routes with prefixes
await fastify.register(healthRoutes, { prefix: '/health' });
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(sessionRoutes, { prefix: '/api/claude-code/sessions' });
```

## Schema Validation with TypeBox

This project uses `@sinclair/typebox` for runtime and compile-time type safety:

```typescript
import { Type } from '@sinclair/typebox';

const CreateUserSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  name: Type.String({ minLength: 1 }),
  password: Type.String({ minLength: 8 })
});

// Use in route
fastify.post('/', {
  schema: {
    body: CreateUserSchema,
    response: {
      200: UserResponseSchema,
      400: ErrorSchema
    }
  }
}, async (request, reply) => {
  // TypeScript knows the shape of request.body
  const { email, name, password } = request.body;
  // ...
});
```

## Protected Routes

For authenticated routes, use the `onRequest` hook with the auth handler:

```typescript
fastify.get('/profile', {
  onRequest: [fastify.authenticate], // Auth middleware
  schema: {
    headers: Type.Object({
      authorization: Type.String()
    }),
    response: {
      200: UserProfileSchema
    }
  }
}, async (request, reply) => {
  // request.user is available here
  const user = request.user;
  return { user };
});
```

## Route Parameters

Handle dynamic route parameters:

```typescript
fastify.get('/:sessionId', {
  schema: {
    params: Type.Object({
      sessionId: Type.String({ format: 'uuid' })
    }),
    response: {
      200: SessionSchema,
      404: ErrorSchema
    }
  }
}, async (request, reply) => {
  const { sessionId } = request.params;
  // ...
});
```

## Query Parameters

Handle query string parameters:

```typescript
fastify.get('/', {
  schema: {
    querystring: Type.Object({
      page: Type.Optional(Type.Integer({ minimum: 1 })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      search: Type.Optional(Type.String())
    })
  }
}, async (request, reply) => {
  const { page = 1, limit = 20, search } = request.query;
  // ...
});
```

## Error Handling

Use the custom error utilities:

```typescript
import { createError } from '@/utils/errors';

fastify.get('/:id', async (request, reply) => {
  const item = await findItem(request.params.id);
  
  if (!item) {
    throw createError('NOT_FOUND', 'Item not found');
  }
  
  return item;
});
```

## File Uploads

Handle file uploads with multipart:

```typescript
fastify.post('/upload', {
  schema: {
    consumes: ['multipart/form-data'],
    response: {
      200: Type.Object({
        fileId: Type.String(),
        url: Type.String()
      })
    }
  }
}, async (request, reply) => {
  const data = await request.file();
  // Process file
  return { fileId: '...', url: '...' };
});
```

## Server-Sent Events (SSE)

For real-time streaming responses:

```typescript
import { createSSEStream } from '@/utils/sse';

fastify.get('/stream', async (request, reply) => {
  const stream = createSSEStream();
  
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send events
  stream.write({ event: 'message', data: { text: 'Hello' } });
  
  return reply.send(stream);
});
```

## Best Practices

1. **Always define schemas** for request/response validation
2. **Use TypeBox** for type-safe schemas
3. **Organize routes** by feature/domain (auth, sessions, etc.)
4. **Handle errors** consistently using error utilities
5. **Add authentication** to protected routes
6. **Document endpoints** with OpenAPI schemas
7. **Test routes** with integration tests

## Example: Complete CRUD Route

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { createError } from '@/utils/errors';
import * as itemService from '@/services/item.service';

const itemRoutes: FastifyPluginAsync = async (fastify) => {
  // List items
  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
      }),
      response: {
        200: Type.Object({
          items: Type.Array(ItemSchema),
          total: Type.Integer(),
          page: Type.Integer(),
          limit: Type.Integer()
        })
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 20 } = request.query;
    const result = await itemService.listItems({ page, limit });
    return result;
  });

  // Get single item
  fastify.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        200: ItemSchema,
        404: ErrorSchema
      }
    }
  }, async (request, reply) => {
    const item = await itemService.getItem(request.params.id);
    if (!item) {
      throw createError('NOT_FOUND', 'Item not found');
    }
    return item;
  });

  // Create item
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: CreateItemSchema,
      response: {
        201: ItemSchema,
        400: ErrorSchema
      }
    }
  }, async (request, reply) => {
    const item = await itemService.createItem({
      ...request.body,
      userId: request.user.id
    });
    return reply.code(201).send(item);
  });

  // Update item
  fastify.put('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: UpdateItemSchema,
      response: {
        200: ItemSchema,
        404: ErrorSchema
      }
    }
  }, async (request, reply) => {
    const item = await itemService.updateItem(
      request.params.id,
      request.body,
      request.user.id
    );
    if (!item) {
      throw createError('NOT_FOUND', 'Item not found');
    }
    return item;
  });

  // Delete item
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        204: Type.Null(),
        404: ErrorSchema
      }
    }
  }, async (request, reply) => {
    const deleted = await itemService.deleteItem(
      request.params.id,
      request.user.id
    );
    if (!deleted) {
      throw createError('NOT_FOUND', 'Item not found');
    }
    return reply.code(204).send();
  });
};

export default itemRoutes;
```