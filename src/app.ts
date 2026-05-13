import express from "express";
import { config } from "./config/env.js";
import redis from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.routes.js";
import { taskRouter } from "./modules/tasks/task.routes.js";

const app = express();
app.use(express.json());
app.set("trust proxy", 1);
app.use(cookieParser());

const [redisResult, prismaResult] = await Promise.allSettled([
    redis.connect(),
    prisma.$connect(),
]);

if (redisResult.status === "rejected" || prismaResult.status === "rejected") {
    const failures: string[] = [];

    if (redisResult.status === "rejected") {
        const redisReason =
            redisResult.reason instanceof Error
                ? redisResult.reason.message
                : String(redisResult.reason);
        failures.push(`Redis: ${redisReason}`);
    }

    if (prismaResult.status === "rejected") {
        const prismaReason =
            prismaResult.reason instanceof Error
                ? prismaResult.reason.message
                : String(prismaResult.reason);
        failures.push(`Prisma: ${prismaReason}`);
    }

    console.error(
        `❌ Failed to connect to required services. ${failures.join(" | ")}`,
    );
    process.exit(1);
} else {
    console.log("✅ Database connections established");
}

app.use("/api/auth", authRouter);
app.use("/api/tasks", taskRouter);

app.listen(config.PORT, () =>
    console.log(`✅ Server is running on port ${config.PORT}`),
);
