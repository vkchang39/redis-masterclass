// GET /api/leaderboard?limit=10  → getTopUsers
// GET /api/leaderboard/me        → getUserRank for logged in user

import { LeaderBoardService } from "./leaderboard.service.js";
import type { Request, Response } from "express";

export class LeaderBoardController {
    constructor(
        private readonly leaderboardService = new LeaderBoardService(),
    ) {
        this.getTopUsers = this.getTopUsers.bind(this);
        this.getUserRank = this.getUserRank.bind(this);
    }

    async getTopUsers(req: Request, res: Response) {
        const { limit } = req.query;
        if (!limit || typeof limit !== "string") {
            res.status(400).json({ error: "Invalid limit" });
            return;
        }
        const result = await this.leaderboardService.getTopUsers(Number(limit));
        return res.status(200).json(result);
    }
    async getUserRank(req: Request, res: Response) {
        const userId = req.user?.id!;
        const result = await this.leaderboardService.getUserRank(userId);
        return res.status(200).json(result);
    }
}
