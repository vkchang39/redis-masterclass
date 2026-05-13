// setup redis client
import { config } from "../config/env.js";
import { Redis } from "ioredis";
const redis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    maxRetriesPerRequest: 3, // fail fast on operations instead of hanging
    enableReadyCheck: true, // verify connection is truly ready before use
    lazyConnect: true,
    retryStrategy(times) {
        if (times > 10) {
            console.error("❌ Redis retry limit reached, giving up");
            return null; // stop retrying
        }
        const delay = Math.min(times * 200, 2000); // exponential backoff, max 2s
        console.warn(`🔄 Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
    },
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("ready", () => console.log("✅ Redis ready"));
redis.on("error", (err: Error) =>
    console.error("❌ Redis error:", err.message),
);
redis.on("close", () => console.warn("⚠️  Redis connection closed"));
redis.on("reconnecting", () => console.warn("🔄 Redis reconnecting..."));

export default redis;
