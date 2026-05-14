import { redis } from "../../lib/redis.js";
import { CacheKeys } from "../../lib/cacheKeys.js";
import { prisma } from "../../lib/prisma.js";

export class LeaderBoardService {
    async incrementScore(userId: string): Promise<void> {
        const key = CacheKeys.leaderboard.global();
        await redis.zincrby(key, 1, userId);
    }
    async getTopUsers(
        limit: number,
    ): Promise<{ userId: string; score: number; rank: number }[]> {
        const key = CacheKeys.leaderboard.global();
        const topUsers = await redis.zrevrange(key, 0, limit - 1, "WITHSCORES");
        const result = [];
        for (let i = 0; i < topUsers.length; i += 2) {
            result.push({
                userId: topUsers[i],
                score: Number(topUsers[i + 1]),
                rank: i / 2 + 1,
            });
        }
        return result;
    }
    async getUserRank(
        userId: string,
    ): Promise<{ rank: number; score: number } | null> {
        const key = CacheKeys.leaderboard.global();
        const rank = await redis.zrevrank(key, userId);
        if (rank === null) return null;
        const score = await redis.zscore(key, userId);
        return {
            rank: rank + 1,
            score: score ? Number(score) : 0,
        };
    }

    async rebuildLeaderBoard(): Promise<void> {
        // 1. query DB for completed task counts per user
        const scores = await prisma.task.groupBy({
            by: ["userId"],
            where: { status: "completed" },
            _count: { id: true },
        });

        // 2. clear existing leaderboard
        await redis.del(CacheKeys.leaderboard.global());

        // 3. populate Redis
        const pipeline = redis.pipeline();
        for (const { userId, _count } of scores) {
            pipeline.zadd(CacheKeys.leaderboard.global(), _count.id, userId);
        }
        await pipeline.exec();
    }
}
