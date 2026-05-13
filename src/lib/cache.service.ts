// get<T>(key: string): Promise<T | null>
// set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
// del(key: string): Promise<void>
// delMany(keys: string[]): Promise<void>

import { redis } from "./redis.js";

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
        if (ttlSeconds !== undefined) {
            await redis.set(key, payload, "EX", ttlSeconds);
        } else {
            await redis.set(key, payload);
        }
    }

    async del(key: string): Promise<void> {
        await redis.del(key);
    }

    async delMany(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        await redis.del(keys);
    }
}
