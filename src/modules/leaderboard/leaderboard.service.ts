import { redis } from "../../lib/redis.js";
import { CacheKeys } from "../../lib/cacheKeys.js";
import { TaskService } from "../tasks/task.service.js";

export class LeaderBoardService {
    private taskService = new TaskService();

    async incrementScore(userId: string): Promise<void> {
        const key = CacheKeys.leaderboard.global();
        await redis.zincrby(key, 1, userId);
    }

    async getTopUsers(
        limit: number,
    ): Promise<{ userId: string; score: number; rank: number }[]> {
        const key = CacheKeys.leaderboard.global();
        // ioredis uses 'WITHSCORES' as an argument to the standard zrevrange method
        const results = await redis.zrevrange(key, 0, limit - 1, "WITHSCORES");

        const leaderboard: { userId: string; score: number; rank: number }[] = [];

        // results is a flat array: [member1, score1, member2, score2, ...]
        for (let i = 0; i < results.length; i += 2) {
            leaderboard.push({
                userId: results[i],
                score: Number(results[i + 1]),
                rank: Math.floor(i / 2) + 1,
            });
        }

        return leaderboard;
    }

    async getUserRank(
        userId: string,
    ): Promise<{ rank: number; score: number } | null> {
        const key = CacheKeys.leaderboard.global();
        const [rank, score] = await Promise.all([
            redis.zrevrank(key, userId),
            redis.zscore(key, userId),
        ]);

        if (rank === null || score === null) return null;

        return {
            rank: rank + 1, // Redis ranks are 0-indexed
            score: Number(score),
        };
    }

    async rebuildLeaderBoard(): Promise<void> {
        const tasks = await this.taskService.findAll();
        const key = CacheKeys.leaderboard.global();

        // Clear existing leaderboard and rebuild from task counts
        await redis.del(key);

        const userScores = new Map<string, number>();
        tasks.forEach((task) => {
            userScores.set(task.userId, (userScores.get(task.userId) || 0) + 1);
        });

        for (const [userId, score] of userScores.entries()) {
            await redis.zadd(key, score, userId);
        }
    }
}
