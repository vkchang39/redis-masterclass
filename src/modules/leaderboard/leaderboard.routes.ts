import { Router } from "express";
import { LeaderBoardController } from "./leaderboard.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

export const leaderboardRouter = Router();

const controller = new LeaderBoardController();

leaderboardRouter.get("/", authenticate, controller.getTopUsers);
leaderboardRouter.get("/me", authenticate, controller.getUserRank);
