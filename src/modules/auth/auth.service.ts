import { DeviceContext, LoginDto, RegisterDto } from "./auth.types.js";
import { AuthRepository } from "./auth.repository.js";
import { Session } from "../../generated/prisma/client.js";
import { config } from "../../config/env.js";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { CacheKeys } from "../../lib/cacheKeys.js";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { redis } from "../../lib/redis.js";

export class AuthService {
    private readonly authRepository = new AuthRepository();

    private generateTokens(
        userId: string,
        sessionId: string,
    ): { accessToken: string; refreshToken: string } {
        const accessToken = jwt.sign(
            { userId, sessionId },
            config.JWT_ACCESS_SECRET,
            {
                expiresIn:
                    config.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
            },
        );
        const refreshToken = jwt.sign(
            { userId, sessionId },
            config.JWT_REFRESH_SECRET,
            {
                expiresIn:
                    config.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
            },
        );
        return { accessToken, refreshToken };
    }

    private async getCachedSessionByRefreshToken(
        userId: string,
        refreshToken: string,
    ): Promise<Session | null> {
        const key = CacheKeys.auth.userSessions(userId);
        const all = await redis.hgetall(key);
        if (!all) return null;
        for (const raw of Object.values(all)) {
            try {
                const session = JSON.parse(raw) as Session;
                if (session.refreshToken === refreshToken) return session;
            } catch {
                return null;
            }
        }
        return null;
    }
    private async cacheSession(userId: string, session: Session) {
        const key = CacheKeys.auth.userSessions(userId);
        await redis.hset(key, {
            [session.deviceId]: JSON.stringify(session),
        });
    }
    private async getCachedSession(userId: string, deviceId: string) {
        const key = CacheKeys.auth.userSessions(userId);
        const raw = await redis.hget(key, deviceId);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as Session;
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    private async deleteCachedSession(userId: string, deviceId: string) {
        const key = CacheKeys.auth.userSessions(userId);
        await redis.hdel(key, deviceId);
    }
    private async deleteAllCachedSessions(userId: string) {
        const key = CacheKeys.auth.userSessions(userId);
        await redis.del(key);
    }

    // Public methods:
    async register(dto: RegisterDto, device: DeviceContext) {
        const existing = await this.authRepository.findUserByEmail(dto.email);
        if (existing) throw new Error("Email already in use");
        const hashedPassword = await bcrypt.hash(dto.password, 12);
        const user = await this.authRepository.createUser(
            dto.email,
            hashedPassword,
        );
        const sessionId = nanoid(10);
        const { accessToken, refreshToken } = this.generateTokens(
            user.id,
            sessionId,
        );
        const session = await this.authRepository.createSession(
            sessionId,
            user.id,
            device.deviceId,
            device.userAgent ?? null,
            device.ipAddress ?? null,
            refreshToken,
        );
        await this.cacheSession(user.id, session);
        return { accessToken, refreshToken };
    }
    async login(dto: LoginDto, device: DeviceContext) {
        const user = await this.authRepository.findUserByEmail(dto.email);
        if (!user) throw new Error("Invalid credentials");
        const isPasswordValid = await bcrypt.compare(
            dto.password,
            user.password,
        );
        if (!isPasswordValid) throw new Error("Invalid credentials");
        let existingSession = await this.getCachedSession(
            user.id,
            device.deviceId,
        );
        if (!existingSession) {
            existingSession =
                await this.authRepository.findSessionByUserIdAndDeviceId(
                    user.id,
                    device.deviceId,
                );
        }
        if (existingSession) {
            const { accessToken, refreshToken } = this.generateTokens(
                user.id,
                existingSession.id,
            );
            existingSession = await this.authRepository.updateRefreshToken(
                existingSession.id,
                refreshToken,
            );
            await this.cacheSession(user.id, existingSession);
            return { accessToken, refreshToken };
        } else {
            const sessionId = nanoid(10);
            const { accessToken, refreshToken } = this.generateTokens(
                user.id,
                sessionId,
            );
            const session = await this.authRepository.createSession(
                sessionId,
                user.id,
                device.deviceId,
                device.userAgent ?? null,
                device.ipAddress ?? null,
                refreshToken,
            );
            await this.cacheSession(user.id, session);
            return { accessToken, refreshToken };
        }
    }
    async refresh(refreshToken: string) {
        // 1. decode token to get userId (even if session is deleted)
        const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as {
            userId: string;
            sessionId: string;
        };

        // 2. check Redis first
        let session = await this.getCachedSessionByRefreshToken(
            decoded.userId,
            refreshToken,
        );
        if (!session) {
            session =
                await this.authRepository.findSessionByRefreshToken(
                    refreshToken,
                );
            if (!session) {
                await this.deleteAllCachedSessions(decoded.userId);
                await this.authRepository.deleteAllUserSessions(decoded.userId);
                throw new Error("Theft detected");
            }
        }
        const { accessToken, refreshToken: newRefreshToken } =
            this.generateTokens(decoded.userId, session.id);
        session = await this.authRepository.updateRefreshToken(
            session.id,
            newRefreshToken,
        );
        await this.cacheSession(decoded.userId, session);
        return { accessToken, refreshToken: newRefreshToken };
    }
    async logout(refreshToken: string, userId: string) {
        const session =
            await this.authRepository.findSessionByRefreshToken(refreshToken);
        if (!session) throw new Error("Session not found");
        await this.authRepository.deleteSession(session.id);
        await this.deleteCachedSession(userId, session!.deviceId);
    }
    async logoutAll(userId: string) {
        await this.authRepository.deleteAllUserSessions(userId);
        await this.deleteAllCachedSessions(userId);
    }
}
