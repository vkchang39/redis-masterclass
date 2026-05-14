import express from "express";
import { config } from "./config/env.js";
import { redis, publisher, subscriber } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.routes.js";
import { taskRouter } from "./modules/tasks/task.routes.js";
import { NotificationService } from "./modules/notifications/notification.service.js";
import { leaderboardRouter } from "./modules/leaderboard/leaderboard.routes.js";
import { LeaderBoardService } from "./modules/leaderboard/leaderboard.service.js";

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
} else {
    console.log("✅ All connections established successfully");
}

const notificationService = new NotificationService();
const leaderboardService = new LeaderBoardService();

await notificationService.initializeSubscribers();
await leaderboardService.rebuildLeaderBoard();

console.log("✅ Notification subscribers initialized");
console.log("✅ Leaderboard rebuilt");

app.use("/api/auth", authRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/leaderboard", leaderboardRouter);

app.listen(config.PORT, () =>
    console.log(`✅ Server is running on port ${config.PORT}`),
);
