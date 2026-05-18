# Redis Masterclass with TypeScript & Express

A comprehensive guide to Redis — from zero to production. Built through a real NestJS-style TypeScript project covering every major Redis concept, data structure, and production pattern.

---

## Table of Contents

1. [What is Redis?](#what-is-redis)
2. [Project Setup](#project-setup)
3. [Redis Client Setup](#redis-client-setup)
4. [Data Structure 1 — Strings (Caching)](#data-structure-1--strings-caching)
5. [Data Structure 2 — Hashes (Sessions)](#data-structure-2--hashes-sessions)
6. [Data Structure 3 — Lists (BullMQ Job Queues)](#data-structure-3--lists-bullmq-job-queues)
7. [Data Structure 4 — Sorted Sets (Leaderboard)](#data-structure-4--sorted-sets-leaderboard)
8. [Data Structure 5 — Pub/Sub (Real-time Notifications)](#data-structure-5--pubsub-real-time-notifications)
9. [Rate Limiting with Lua Scripts](#rate-limiting-with-lua-scripts)
10. [Auth System — JWT + Refresh Token Rotation](#auth-system--jwt--refresh-token-rotation)
11. [Production Concerns](#production-concerns)

---

## What is Redis?

> **Redis is not a cache. Redis is a data structure server that lives entirely in RAM.**

"Cache" is just one way you can use it. The reason it's fast isn't magic — it's physics:

```
RAM access time:     ~100 nanoseconds
SSD access time:     ~100 microseconds   (1,000x slower)
PostgreSQL query:    ~1–200 milliseconds  (up to 2,000,000x slower)
```

PostgreSQL reads from disk (even with its own caching). Redis reads from RAM. That's the entire secret.

### The 5 Core Data Structures

| Structure   | Use Case                | Key Commands              |
| ----------- | ----------------------- | ------------------------- |
| Strings     | Caching, rate limiting  | GET, SET, INCR            |
| Hashes      | Sessions, objects       | HSET, HGET, HGETALL, HDEL |
| Lists       | Job queues              | LPUSH, BRPOP              |
| Sorted Sets | Leaderboards, rankings  | ZADD, ZINCRBY, ZREVRANGE  |
| Pub/Sub     | Real-time notifications | PUBLISH, SUBSCRIBE        |

---

## Project Setup

### Stack

```
typescript 5.x
express 5.x          ← stable, async error handling built-in
ioredis 5.x          ← best Redis client for Node.js
prisma 7.x           ← type-safe ORM
tsx                  ← fast TypeScript runner
@biomejs/biome       ← replaces eslint + prettier
pnpm                 ← faster, stricter than npm
```

### Folder Structure (NestJS-style)

```
src/
├── modules/
│   ├── tasks/
│   │   ├── task.controller.ts
│   │   ├── task.service.ts
│   │   ├── task.repository.ts
│   │   ├── task.routes.ts
│   │   └── task.types.ts
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.routes.ts
│   │   └── auth.types.ts
│   ├── notifications/
│   │   └── notification.service.ts
│   └── leaderboard/
│       ├── leaderboard.controller.ts
│       ├── leaderboard.service.ts
│       └── leaderboard.routes.ts
├── lib/
│   ├── redis.ts            ← Redis client factory
│   ├── prisma.ts           ← Prisma singleton
│   ├── cache.service.ts    ← Generic cache wrapper
│   ├── cacheKeys.ts        ← Key namespace utility
│   ├── pubsub.ts           ← Pub/Sub wrapper
│   └── cookies.ts          ← Cookie helpers
├── middleware/
│   ├── authenticate.ts
│   └── rateLimiter.ts
├── jobs/
│   ├── queue.ts
│   └── workers/
│       ├── email.worker.ts
│       └── notification.worker.ts
├── config/
│   └── env.ts              ← Zod env validation
├── types/
│   └── express.d.ts        ← Express type augmentation
├── app.ts                  ← API server
└── worker.ts               ← Worker process
```

### Installation

```bash
mkdir redis-masterclass && cd redis-masterclass
git init
pnpm init

pnpm add express ioredis pg dotenv prisma @prisma/client zod bcrypt jsonwebtoken cookie-parser nanoid bullmq
pnpm add -D typescript tsx @types/express @types/node @types/pg @biomejs/biome @types/bcrypt @types/jsonwebtoken @types/cookie-parser

./node_modules/.bin/tsc --init
./node_modules/.bin/biome init
```

### `tsconfig.json`

```json
{
    "compilerOptions": {
        "target": "ESNext",
        "module": "NodeNext",
        "lib": ["ESNext"],
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "moduleResolution": "NodeNext"
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist"]
}
```

### `.env`

```env
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/redis_masterclass
NODE_ENV=development
JWT_ACCESS_SECRET=your-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ACCESS_EXPIRES_MS=900000
JWT_REFRESH_EXPIRES_MS=604800000
```

### `src/config/env.ts` — Zod Env Validation

Always validate env variables at startup. Use `safeParse` so you can format readable errors before crashing.

```typescript
import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

const envSchema = z.object({
    PORT: z.coerce.number(),
    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number(),
    REDIS_PASSWORD: z.string().min(1),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "staging", "production"]),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    JWT_ACCESS_EXPIRES_MS: z.coerce.number().default(900000),
    JWT_REFRESH_EXPIRES_MS: z.coerce.number().default(604800000),
});

const env = envSchema.safeParse(process.env);

if (!env.success) {
    console.error("❌ Invalid environment variables:");
    console.error(
        JSON.stringify(z.flattenError(env.error).fieldErrors, null, 2),
    );
    process.exit(1);
}

export const config = env.data;
```

**Why `safeParse` over `parse`?** `parse` throws a cryptic Zod error. `safeParse` lets you format a human-readable message showing exactly which variables are wrong before calling `process.exit(1)`.

---

## Redis Client Setup

### `src/lib/redis.ts` — Factory Pattern

Never share your app's Redis connection with BullMQ. Use separate connections for different concerns.

```typescript
import { config } from "../config/env.js";
import { Redis } from "ioredis";

const createRedisClient = (name: string = "default") => {
    const redis = new Redis({
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD,
        maxRetriesPerRequest: 3, // fail fast on operations
        enableReadyCheck: true, // verify truly ready before use
        lazyConnect: true, // don't connect until explicitly called
        retryStrategy(times) {
            if (times > 10) {
                console.error("❌ Redis retry limit reached, giving up");
                return null;
            }
            const delay = Math.min(times * 200, 2000); // exponential backoff, max 2s
            console.warn(`🔄 Redis retry attempt ${times}, waiting ${delay}ms`);
            return delay;
        },
    });

    redis.on("connect", () => console.log(`✅ Redis connected: ${name}`));
    redis.on("ready", () => console.log(`✅ Redis ready: ${name}`));
    redis.on("error", (err: Error) =>
        console.error(`❌ Redis error [${name}]:`, err.message),
    );
    redis.on("close", () =>
        console.warn(`⚠️  Redis connection closed: ${name}`),
    );
    redis.on("reconnecting", () =>
        console.warn(`🔄 Redis reconnecting: ${name}`),
    );

    return redis;
};

// Three separate connections for different purposes
export const redis = createRedisClient("main"); // general use
export const publisher = createRedisClient("publisher"); // pub/sub publishing
export const subscriber = createRedisClient("subscriber"); // pub/sub subscribing
```

**Why three connections?**

- `main` — all regular Redis operations (GET, SET, HGET etc.)
- `publisher` — dedicated so real-time messages aren't queued behind cache ops
- `subscriber` — **required** to be separate; a connection in subscriber mode can ONLY do Pub/Sub commands

**Why `lazyConnect: true`?** So you can explicitly `await redis.connect()` at startup. If Redis is down, the app refuses to start entirely — loud failure, not silent failure.

**Why exponential backoff?** Without it, multiple server instances hammering Redis every 100ms can crash it the moment it comes back online. This is called the **thundering herd problem**.

### `src/app.ts` — Startup with Parallel Connections

```typescript
import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config/env.js";
import { redis, publisher, subscriber } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";

const app = express();
app.use(express.json());
app.set("trust proxy", 1);
app.use(cookieParser());

const getFailureReason = (result: PromiseRejectedResult): string =>
    result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);

const [redisResult, prismaResult, publisherResult, subscriberResult] =
    await Promise.allSettled([
        redis.connect(),
        prisma.$connect(),
        publisher.connect(),
        subscriber.connect(),
    ]);

const connections = {
    redis: redisResult,
    prisma: prismaResult,
    publisher: publisherResult,
    subscriber: subscriberResult,
};
const failures = Object.entries(connections)
    .filter(([_, result]) => result.status === "rejected")
    .map(
        ([name, result]) =>
            `${name}: ${getFailureReason(result as PromiseRejectedResult)}`,
    );

if (failures.length > 0) {
    console.error(`❌ Failed to connect: ${failures.join(" | ")}`);
    process.exit(1);
}

console.log("✅ All connections established successfully");

app.listen(config.PORT, () =>
    console.log(`✅ Server running on port ${config.PORT}`),
);
```

**Why `Promise.allSettled` over `Promise.all`?** `Promise.all` fails on the first rejection — you won't know if both Redis AND Postgres failed. `Promise.allSettled` waits for all, giving you a complete failure report.

---

## Data Structure 1 — Strings (Caching)

### The Cache-Aside Pattern

The most common caching pattern. Redis is checked first; database is only hit on a miss.

```
Request → check Redis → HIT? → return cached data
                      → MISS? → query DB → store in Redis → return data
```

### Key Namespacing

Redis has no tables or namespaces — everything lives in the same flat key space. Use colons as separators, like a file path:

```
tasks:all              → all tasks
tasks:id:123           → specific task
tasks:user:456         → all tasks for user
auth:sessions:user-123 → all sessions for user
auth:user:user-123     → cached user object
leaderboard:global     → sorted leaderboard
```

Redis GUI tools like **RedisInsight** use colons to create a folder-like tree view.

### `src/lib/cacheKeys.ts`

Never scatter key strings across your codebase. One source of truth:

```typescript
export const CacheKeys = {
    tasks: {
        all: () => "tasks:all",
        byId: (id: string | number) => `tasks:id:${id}`,
        byUser: (userId: string | number) => `tasks:user:${userId}`,
    },
    auth: {
        userSessions: (userId: string) => `auth:sessions:${userId}`,
        user: (userId: string) => `auth:user:${userId}`,
    },
    leaderboard: {
        global: () => "leaderboard:global",
    },
} as const;
```

### `src/lib/cache.service.ts`

A generic wrapper that handles JSON serialization internally. The caller never thinks about `JSON.parse` / `JSON.stringify`:

```typescript
import redis from "./redis.js";

export class CacheService {
    async get<T>(key: string): Promise<T | null> {
        const raw = await redis.get(key);
        if (raw === null) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }

    async set<T>(
        key: string,
        value: T,
        ttlSeconds: number = 3600,
    ): Promise<void> {
        const payload = JSON.stringify(value);
        await redis.set(key, payload, "EX", ttlSeconds);
    }

    async del(key: string): Promise<void> {
        await redis.del(key);
    }

    async delMany(keys: string[]): Promise<void> {
        if (keys.length === 0) return; // guard: redis.del() with no args throws
        await redis.del(keys);
    }
}
```

**Why default TTL of 3600?** Without a TTL, keys live forever. Redis memory fills up silently. Always set a TTL unless you have a specific reason not to.

### Cache Invalidation Rules

> When data changes, delete every key that could contain that data. Don't try to update them — just delete. They'll repopulate on the next read.

```
create task → invalidate: tasks:all, tasks:user:{userId}
update task → invalidate: tasks:all, tasks:user:{userId}, tasks:id:{id}
delete task → invalidate: tasks:all, tasks:user:{userId}, tasks:id:{id}
```

### Task Service Example

```typescript
export class TaskService {
    private readonly cacheService = new CacheService();
    private readonly taskRepository = new TaskRepository();

    async findAll(): Promise<Task[]> {
        const cached = await this.cacheService.get<Task[]>(
            CacheKeys.tasks.all(),
        );
        if (cached) return cached;

        const tasks = await this.taskRepository.findAll();
        await this.cacheService.set(CacheKeys.tasks.all(), tasks);
        return tasks;
    }

    async create(data: CreateTaskDto): Promise<Task> {
        const task = await this.taskRepository.create(data);
        await this.cacheService.set(CacheKeys.tasks.byId(task.id), task);
        await this.cacheService.delMany([
            CacheKeys.tasks.all(),
            CacheKeys.tasks.byUser(task.userId),
        ]);
        return task;
    }

    async update(id: string, data: UpdateTaskDto): Promise<Task> {
        const task = await this.taskRepository.update(id, data);
        await this.cacheService.delMany([
            CacheKeys.tasks.all(),
            CacheKeys.tasks.byId(id),
            CacheKeys.tasks.byUser(task.userId),
        ]);
        return task;
    }

    async delete(id: string): Promise<Task> {
        const task = await this.taskRepository.delete(id);
        await this.cacheService.delMany([
            CacheKeys.tasks.all(),
            CacheKeys.tasks.byId(id),
            CacheKeys.tasks.byUser(task.userId),
        ]);
        return task;
    }
}
```

---

## Data Structure 2 — Hashes (Sessions)

### Why Hashes for Sessions?

A user can have multiple active sessions (phone, laptop, tablet). You need to:

1. Get one specific session by `deviceId` — O(1)
2. Get ALL sessions for a user — O(n) where n = device count
3. Delete one specific session — O(1)
4. Delete ALL sessions — O(1)

With plain String keys (one key per session), operations 2 and 4 require scanning all keys. With a Hash, one key per user holds all their sessions as fields:

```
HSET auth:sessions:user-123  iphone-abc   "{...session data...}"
HSET auth:sessions:user-123  android-xyz  "{...session data...}"
HSET auth:sessions:user-123  web-def      "{...session data...}"

HGET    auth:sessions:user-123 iphone-abc   → one session, O(1)
HGETALL auth:sessions:user-123              → all sessions, O(n)
HDEL    auth:sessions:user-123 iphone-abc   → delete one, O(1)
DEL     auth:sessions:user-123              → delete all (theft!), O(1)
```

### Hash Commands

```typescript
// Store a session (field = deviceId, value = JSON)
await redis.hset("auth:sessions:user-123", {
    "iphone-abc": JSON.stringify(session),
});

// Get one session
const raw = await redis.hget("auth:sessions:user-123", "iphone-abc");
const session = raw ? JSON.parse(raw) : null;

// Get all sessions
const all = await redis.hgetall("auth:sessions:user-123");
// Returns: { 'iphone-abc': '{"..."}', 'android-xyz': '{"..."}' }

// Delete one session (logout from one device)
await redis.hdel("auth:sessions:user-123", "iphone-abc");

// Delete all sessions (theft detected!)
await redis.del("auth:sessions:user-123");
```

---

## Data Structure 3 — Lists (BullMQ Job Queues)

### Why Not Handle Everything Synchronously?

```typescript
// ❌ Bad — client waits for ALL of this
async confirmBooking() {
  await sendEmail();        // 2s
  await generateLetter();   // 3s
  await updateUnit();       // 1s
  await notifyAgent();      // 1s
  return response;          // client waited 7s — likely timed out
}

// ✅ Good — client gets response in milliseconds
async confirmBooking() {
  await updateUnit();                          // 100ms — only critical part
  await emailQueue.add('booking-confirmed', payload); // fire and forget
  return response;
}
```

### How BullMQ Uses Redis Lists

BullMQ internally maintains multiple Redis Lists per queue:

```
bull:email:waiting   → jobs waiting to be picked up  (LPUSH here)
bull:email:active    → jobs being processed right now (BRPOP moves here)
bull:email:completed → successfully finished jobs
bull:email:failed    → jobs that exhausted retries
bull:email:delayed   → scheduled for future execution
```

`BRPOP` (Blocking Right Pop) means workers **wait** for jobs instead of polling — no CPU waste.

A job is never truly gone until explicitly marked completed. If a worker crashes mid-job, the job stays in `active` and gets retried.

### `src/jobs/queue.ts`

**Never pass your app's Redis instance to BullMQ.** BullMQ needs `maxRetriesPerRequest: null` for blocking commands, which conflicts with your app's `maxRetriesPerRequest: 3`. Pass raw config instead:

```typescript
import { Queue } from "bullmq";
import { config } from "../config/env.js";

const connection = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
};

export const emailQueue = new Queue("email", { connection });
export const notificationQueue = new Queue("notification", { connection });
```

### `src/jobs/workers/email.worker.ts`

Workers start automatically on import — no manual `.run()` needed:

```typescript
import { Worker } from "bullmq";
import { config } from "../../config/env.js";

const connection = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
};

export const emailWorker = new Worker(
    "email",
    async (job) => {
        switch (job.name) {
            case "send-welcome":
                console.log("Sending welcome email to", job.data.email);
                break;
            case "task-created":
                console.log("Sending task created email to", job.data.email);
                break;
            case "task-updated":
                console.log("Sending task updated email to", job.data.email);
                break;
            case "task-deleted":
                console.log("Sending task deleted email to", job.data.email);
                break;
            default:
                console.warn("Unknown job type:", job.name);
        }
    },
    { connection },
);

emailWorker.on("completed", (job) =>
    console.log(`✅ Email job ${job.id} completed`),
);
emailWorker.on("failed", (job, err) =>
    console.error(`❌ Email job ${job?.id} failed:`, err.message),
);
```

### `src/worker.ts` — Separate Worker Process

Run workers in a **separate process** from the API server. CPU-heavy jobs (PDF generation, email sending) block the event loop — you don't want that on your API server.

```typescript
// Use dynamic imports so workers start AFTER env is loaded
await import("./jobs/workers/email.worker.js");
await import("./jobs/workers/notification.worker.js");

console.log("✅ Workers running");
```

```json
// package.json scripts
{
    "dev": "tsx watch src/app.ts",
    "worker": "tsx watch src/worker.ts"
}
```

```bash
# Run in separate terminals
pnpm dev      # API server
pnpm worker   # Worker process
```

### Eviction Policy Warning

BullMQ requires `noeviction` policy. With `allkeys-lru`, Redis can silently delete pending jobs when memory is full — they're gone forever with no retry, no failure event.

```bash
# Fix locally
docker exec -it <container> redis-cli CONFIG SET maxmemory-policy noeviction
```

---

## Data Structure 4 — Sorted Sets (Leaderboard)

### Why Not PostgreSQL for Leaderboards?

```sql
-- This re-sorts on EVERY read and re-indexes on EVERY write
SELECT userId, COUNT(*) as score
FROM tasks WHERE status = 'completed'
GROUP BY userId
ORDER BY score DESC
LIMIT 10;
```

At 1,000,000 users this becomes a serious bottleneck.

### Redis Sorted Sets

Redis maintains sort order internally using a **skip list** — O(log n) for every operation, always sorted.

```typescript
// Add/update a member's score
await redis.zadd("leaderboard:global", 42, "user-123");

// Increment score (atomic — safe under concurrent requests)
await redis.zincrby("leaderboard:global", 1, "user-123");

// Top 10 with scores (highest first)
const raw = await redis.zrevrange("leaderboard:global", 0, 9, "WITHSCORES");
// Returns flat array: ['user-456', '87', 'user-123', '43', ...]

// Get rank (0-based, add 1 for human-readable)
const rank = await redis.zrevrank("leaderboard:global", "user-123");

// Get score
const score = await redis.zscore("leaderboard:global", "user-123");
```

### Parsing WITHSCORES Response

`WITHSCORES` returns a **flat** alternating array — not nested pairs:

```typescript
const raw = await redis.zrevrange("leaderboard:global", 0, 9, "WITHSCORES");
// ['user-456', '87', 'user-123', '43']  ← flat, not [['user-456', '87'], ...]

const result = [];
for (let i = 0; i < raw.length; i += 2) {
    result.push({
        userId: raw[i],
        score: Number(raw[i + 1]),
        rank: i / 2 + 1, // 1-based
    });
}
```

### No DB Model Needed — Rebuild from Existing Data

Scores are derived from your tasks table, so no extra model is needed. On Redis restart, rebuild:

```typescript
async rebuildLeaderboard(): Promise<void> {
  const scores = await prisma.task.groupBy({
    by: ['userId'],
    where: { status: 'completed' },
    _count: { id: true },
  });

  await redis.del(CacheKeys.leaderboard.global());

  // Use pipeline for bulk operations — one round trip instead of N
  const pipeline = redis.pipeline();
  for (const { userId, _count } of scores) {
    pipeline.zadd(CacheKeys.leaderboard.global(), _count.id, userId);
  }
  await pipeline.exec();
}
```

**Why pipeline?** Each Redis command is a network round trip. With 10,000 users, `zadd` in a loop = 10,000 round trips. A pipeline batches all commands into one.

---

## Data Structure 5 — Pub/Sub (Real-time Notifications)

### Pub/Sub vs Job Queues — When to Use Which

|                  | Pub/Sub                            | BullMQ                            |
| ---------------- | ---------------------------------- | --------------------------------- |
| Delivery         | At-most-once                       | At-least-once                     |
| Persistence      | No — message lost if no subscriber | Yes — job survives restarts       |
| Use for          | Real-time UI updates, presence     | Emails, PDF generation, payments  |
| Subscriber down? | Messages lost forever              | Jobs retry when worker comes back |

### The Critical Limitation

> **If no subscriber is listening when a message is published, the message is gone forever.**

This is why Pub/Sub is only appropriate for "nice to have" real-time features, never for critical operations.

### Connection Constraint

A Redis connection in subscriber mode can **only** do Pub/Sub commands — no GET, SET, etc. This is why you need a dedicated `subscriber` connection.

### `src/lib/pubsub.ts`

```typescript
import { publisher, subscriber } from "./redis.js";

type MessageHandler = (channel: string, message: string) => void;

// Map of channel → handler (registered once at module level)
const handlers = new Map<string, MessageHandler>();

// Register ONE listener for ALL channels
subscriber.on("message", (channel: string, message: string) => {
    const handler = handlers.get(channel);
    if (handler) handler(channel, message);
});

export const publish = async (
    channel: string,
    message: unknown,
): Promise<void> => {
    await publisher.publish(channel, JSON.stringify(message));
};

export const subscribe = async (
    channel: string,
    handler: MessageHandler,
): Promise<void> => {
    handlers.set(channel, handler);
    await subscriber.subscribe(channel);
};

export const unsubscribe = async (channel: string): Promise<void> => {
    handlers.delete(channel);
    await subscriber.unsubscribe(channel);
};
```

**Why one `on('message')` listener?** Calling `subscriber.on('message', handler)` inside a function that's called multiple times stacks up listeners. Each new channel subscription would fire ALL previous handlers. Register once at module level and route by channel name.

---

## Rate Limiting with Lua Scripts

### The Atomicity Problem

```typescript
// ❌ Dangerous — two separate operations
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, windowSec);
// If process crashes between these two lines:
// key exists forever → user permanently rate-limited
```

### The Solution — Lua Scripts

Redis executes Lua scripts as a **single atomic operation**. Nothing can interrupt them — not even a process crash.

```typescript
const luaScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

// redis.eval(script, numkeys, ...keys, ...args)
const count = await redis.eval(luaScript, 1, key, String(windowSec));
```

### `src/middleware/rateLimiter.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { redis } from "../lib/redis.js";

interface RateLimitOptions {
    windowMs: number;
    max: number;
    keyGenerator?: (req: Request) => string;
    message?: string;
}

const luaScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

export class RateLimiterFactory {
    static create(options: RateLimitOptions) {
        return async (req: Request, res: Response, next: NextFunction) => {
            const key = options.keyGenerator?.(req) ?? req.ip ?? "unknown";
            const windowSec = Math.ceil(options.windowMs / 1000);

            const count = await redis.eval(
                luaScript,
                1,
                key,
                String(windowSec),
            );

            res.setHeader("X-RateLimit-Limit", options.max);
            res.setHeader(
                "X-RateLimit-Remaining",
                Math.max(0, options.max - Number(count)),
            );

            if (Number(count) > options.max) {
                return res.status(429).json({
                    message:
                        options.message ??
                        "Too many requests. Please try again later.",
                    retryAfter: windowSec,
                });
            }

            next();
        };
    }
}
```

### Usage

```typescript
// Global limit — all routes
app.use(RateLimiterFactory.create({ windowMs: 15 * 60 * 1000, max: 100 }));

// Stricter limit — auth routes
app.use(
    "/api/auth",
    RateLimiterFactory.create({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: "Too many auth attempts.",
    }),
);

// Per-user limit — after authenticate middleware
app.use(
    "/api/tasks",
    RateLimiterFactory.create({
        windowMs: 60 * 1000,
        max: 30,
        keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
    }),
);
```

---

## Auth System — JWT + Refresh Token Rotation

### The Full Pattern

```
Access Token   → short-lived JWT (15min), stateless, httpOnly cookie
Refresh Token  → long-lived JWT (7d), stored in Redis + DB, httpOnly cookie
Sessions       → per-device, Hash in Redis, one user = one Hash key
```

### Refresh Token Rotation with Theft Detection

Every refresh request:

1. Old refresh token → deleted
2. New refresh token → issued

If a refresh token is used **twice** (reuse detected):

- The session was already deleted on first use
- Token not found in Redis or DB
- Decode JWT to get `userId`
- Delete ALL sessions for that user
- Force re-login on all devices

```typescript
async refresh(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as { userId: string };

  // Check Redis first (fast path)
  let session = await this.getCachedSessionByRefreshToken(decoded.userId, refreshToken);

  // Miss → check DB (slow path)
  if (!session) {
    session = await this.authRepository.findSessionByRefreshToken(refreshToken);
  }

  // Still not found → THEFT DETECTED
  if (!session) {
    await this.authRepository.deleteAllUserSessions(decoded.userId);
    await this.deleteAllCachedSessions(decoded.userId);
    throw new Error('Token reuse detected. All sessions invalidated.');
  }

  // Rotate tokens
  const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(decoded.userId, session.id);
  const updatedSession = await this.authRepository.updateRefreshToken(session.id, newRefreshToken);
  await this.cacheSession(decoded.userId, updatedSession);

  return { accessToken, refreshToken: newRefreshToken };
}
```

### Cookie Security

```typescript
res.cookie("refreshToken", token, {
    httpOnly: true, // JS can't read it
    secure: config.NODE_ENV === "production", // HTTPS only in prod
    sameSite: config.NODE_ENV === "production" ? "none" : "lax", // cross-origin in prod
    maxAge: config.JWT_REFRESH_EXPIRES_MS, // milliseconds
});
```

| Option             | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `httpOnly`         | Prevents XSS — JS cannot access the cookie       |
| `secure`           | Cookie only sent over HTTPS                      |
| `sameSite: strict` | Safest, but breaks OAuth flows                   |
| `sameSite: lax`    | Good default — same-site + top-level navigations |
| `sameSite: none`   | Cross-origin — requires `secure: true`           |

### `authenticate` Middleware

Handles both missing and expired access tokens transparently:

```typescript
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    let accessToken =
        req.cookies.accessToken ?? req.headers.authorization?.split(" ")[1];

    // Try to verify — if expired/invalid, set to null and try refresh
    if (accessToken) {
        try {
            jwt.verify(accessToken, config.JWT_ACCESS_SECRET);
        } catch {
            accessToken = null;
        }
    }

    // No valid access token → try refresh
    if (!accessToken) {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken)
            return res.status(401).json({ message: "Unauthorized" });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            await authService.refresh(refreshToken);
        setAuthCookies(
            res,
            newAccessToken,
            newRefreshToken,
            req.cookies?.deviceId ?? "",
        );
        accessToken = newAccessToken;
    }

    // Decode and attach user
    try {
        const decoded = jwt.verify(accessToken, config.JWT_ACCESS_SECRET) as {
            userId: string;
        };

        // Redis first
        const cachedUser = await redis.get(CacheKeys.auth.user(decoded.userId));
        if (cachedUser) {
            req.user = JSON.parse(cachedUser);
            return next();
        }

        // DB fallback
        const user = await prisma.user.findFirst({
            where: { id: decoded.userId },
        });
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        await redis.set(
            CacheKeys.auth.user(user.id),
            JSON.stringify(user),
            "EX",
            3600,
        );
        req.user = user;
        next();
    } catch {
        return res.status(401).json({ message: "Unauthorized" });
    }
};
```

---

## Production Concerns

### Eviction Policy

```bash
# Never use allkeys-lru with BullMQ — jobs get silently deleted
redis-cli CONFIG SET maxmemory-policy noeviction
```

| Policy         | Behavior                   | Use When             |
| -------------- | -------------------------- | -------------------- |
| `noeviction`   | Reject writes when full    | Job queues, sessions |
| `allkeys-lru`  | Delete least recently used | Pure cache           |
| `volatile-lru` | Delete LRU keys with TTL   | Mixed workloads      |

### Pipelines for Bulk Operations

```typescript
// ❌ N round trips
for (const item of items) {
    await redis.zadd("leaderboard", item.score, item.userId);
}

// ✅ 1 round trip
const pipeline = redis.pipeline();
for (const item of items) {
    pipeline.zadd("leaderboard", item.score, item.userId);
}
await pipeline.exec();
```

### Separation of Concerns

```
task.repository.ts  → only talks to PostgreSQL, always fresh data
task.service.ts     → decides when/what/how long to cache
cache.service.ts    → wraps Redis, one place to swap implementations
```

If you swap Redis for Memcached tomorrow, only `cache.service.ts` changes.

### Fail Open on Redis Errors

```typescript
try {
    const cached = await cacheService.get(key);
    if (cached) return cached;
} catch {
    // Redis down? Continue to DB — don't block the request
}
const data = await repository.findAll();
```

A Redis outage should degrade performance (more DB queries), not take down your entire API.

### Key TTL Design

| Data                | TTL             | Reasoning                       |
| ------------------- | --------------- | ------------------------------- |
| Task lists          | 1 hour          | Changes infrequently            |
| User object         | 1 hour          | Cleared on session invalidation |
| Rate limit counters | window duration | Auto-expires with window        |
| Sessions            | 7 days          | Matches refresh token expiry    |
| Leaderboard         | No TTL          | Rebuilt from DB on restart      |

---

## Summary — Which Data Structure for What?

```
Strings      → Any single value: cached queries, user objects, counters
Hashes       → Object with multiple fields you access individually
Lists        → Ordered jobs/tasks, queues (BullMQ uses this)
Sorted Sets  → Rankings, leaderboards, scheduled jobs by timestamp
Pub/Sub      → Real-time broadcast where missing a message is acceptable
```

> The key principle: **let the access pattern drive the data structure choice**, not familiarity.

---

## Quick Reference — ioredis Commands

```typescript
// Strings
await redis.set(key, value, "EX", ttlSeconds);
await redis.get(key);
await redis.del(key);
await redis.incr(key);
await redis.expire(key, seconds);

// Hashes
await redis.hset(key, { field: value });
await redis.hget(key, field);
await redis.hgetall(key);
await redis.hdel(key, field);

// Sorted Sets
await redis.zadd(key, score, member);
await redis.zincrby(key, increment, member);
await redis.zrevrange(key, 0, 9, "WITHSCORES");
await redis.zrevrank(key, member);
await redis.zscore(key, member);

// Pub/Sub
await publisher.publish(channel, message);
await subscriber.subscribe(channel);
subscriber.on("message", (channel, message) => {});

// Utilities
const pipeline = redis.pipeline();
pipeline.set(key1, val1);
pipeline.set(key2, val2);
await pipeline.exec(); // one round trip

await redis.eval(luaScript, numkeys, ...keys, ...args);
```
