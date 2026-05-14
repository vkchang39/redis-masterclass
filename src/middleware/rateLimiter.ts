import { NextFunction } from "express";
import { redis } from "../lib/redis.js";
import type { Request, Response } from "express";

interface RateLimitOptions {
    windowMs: number;
    max: number;
    keyGenerator?: (req: Request) => string;
    message?: string;
}

export class RateLimiterFactory {
    static create(options: RateLimitOptions) {
        return async (req: Request, res: Response, next: NextFunction) => {
            const key = options.keyGenerator?.(req) || req.ip;
            const windowStart = Date.now() - options.windowMs;
            const windowSec = options.windowMs / 1000;
            const max = options.max;
            const luaScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

            const count = await redis.eval(
                luaScript,
                1,
                key!,
                String(windowSec),
            );

            if (Number(count) > max) {
                return res.status(429).json({
                    message:
                        options.message ??
                        "Too many requests. Please try again later.",
                    retryAfter: windowSec,
                });
            }

            res.setHeader("X-RateLimit-Limit", max);
            res.setHeader(
                "X-RateLimit-Remaining",
                Math.max(0, max - Number(count)),
            );
            next();
        };
    }
}
