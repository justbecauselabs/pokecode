# Build stage
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Runtime stage
FROM oven/bun:1-alpine AS runner
ENV NODE_ENV production

# Create app user
RUN addgroup --system --gid 1001 bunjs
RUN adduser --system --uid 1001 fastify

WORKDIR /app

# Copy built application
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle

# Create directories for file storage
RUN mkdir -p /var/claude-code/projects && \
    chown -R fastify:bunjs /var/claude-code

USER fastify

EXPOSE 3001

CMD ["bun", "run", "start"]