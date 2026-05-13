import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

// src/config/env.ts should:
// - Define a Zod schema for all env variables in your .env
// - PORT should be a number (coerce it)
// - REDIS_PORT should be a number (coerce it)
// - NODE_ENV should only accept 'development' | 'staging' | 'production'
// - Everything else is a string
// - Parse process.env through the schema
// - Export the result as typed config object
// - If validation fails, log exactly WHICH variables are wrong and EXIT the process

// safeParse → if failed → log formatted errors → process.exit(1)

const envSchema = z.object({
    PORT: z.coerce.number(),
    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().min(1),
    REDIS_PASSWORD: z.string().min(1),
    POSTGRES_URL: z.url().min(1),
    NODE_ENV: z.enum(["development", "staging", "production"]),
    DATABASE_URL: z.url().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    JWT_ACCESS_EXPIRES_MS: z.coerce.number().default(15 * 60 * 1000), // 15 min
    JWT_REFRESH_EXPIRES_MS: z.coerce.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
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
