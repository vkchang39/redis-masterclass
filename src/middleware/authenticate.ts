// 1. get access token from cookie or header
// 2. if exists → try verify → if fails → set to null
// 3. if null → try refresh token → rotate → set new access token
// 4. if no refresh either → 401
// 5. decode access token → get userId
// 6. check user cache → hit? → attach → next()
// 7. miss → check session in Redis → miss? → check DB session
// 8. fetch user from DB → cache user → attach → next()
import type { NextFunction, Request, Response } from "express";
import { config } from "../config/env.js";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { setAuthCookies } from "../lib/cookies.js";
import { redis } from "../lib/redis.js";
import { CacheKeys } from "../lib/cacheKeys.js";

const authService = new AuthService();

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    // 1. try access token first
    // 2. if missing/expired → try refresh token
    // 3. if refresh valid → rotate → attach user → next()
    // 4. if both missing/invalid → 401
    let accessToken =
        req.cookies.accessToken ?? req.headers.authorization?.split(" ")[1];

    if (accessToken) {
        try {
            jwt.verify(accessToken, config.JWT_ACCESS_SECRET);
        } catch {
            accessToken = null; // expired or invalid → fall through to refresh
        }
    }

    if (!accessToken) {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            await authService.refresh(refreshToken);
        setAuthCookies(
            res,
            newAccessToken,
            newRefreshToken,
            req.cookies?.deviceId ?? "",
        );
        accessToken = newAccessToken;
    }
    try {
        const decoded = jwt.decode(accessToken) as {
            userId: string;
        };
        if (!decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const cachedSessions = await redis.hgetall(
            CacheKeys.auth.userSessions(decoded.userId),
        );

        if (!cachedSessions || !cachedSessions[req.cookies.deviceId]) {
            // fall back to DB session check
            const session = await prisma.session.findFirst({
                where: {
                    userId: decoded.userId,
                    deviceId: req.cookies.deviceId,
                },
            });
            if (!session)
                return res.status(401).json({ message: "Unauthorized" });
            // re-cache the session
            await redis.hset(CacheKeys.auth.userSessions(decoded.userId), {
                [session.deviceId]: JSON.stringify(session),
            });
        }

        // user has active sessions → they exist → fetch from DB once and attach
        const cachedUser = await redis.get(CacheKeys.auth.user(decoded.userId));
        if (cachedUser) {
            req.user = JSON.parse(cachedUser);
            return next();
        }

        // fallback to DB
        const user = await prisma.user.findFirst({
            where: { id: decoded.userId },
        });
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        // cache for next time
        await redis.set(
            CacheKeys.auth.user(user.id),
            JSON.stringify(user),
            "EX",
            3600,
        );
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized" });
    }
};
