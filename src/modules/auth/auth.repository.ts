import { Session, User } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

// User operations
// createUser(email: string, hashedPassword: string): Promise<User>
// findUserByEmail(email: string): Promise<User | null>
// findUserById(id: string): Promise<User | null>

// Session operations
// createSession(userId: string, deviceId: string, deviceInfo: string | null, refreshToken: string): Promise<Session>
// findSessionByRefreshToken(refreshToken: string): Promise<Session | null>
// findSessionsByUserId(userId: string): Promise<Session[]>
// deleteSession(id: string): Promise<void>
// deleteAllUserSessions(userId: string): Promise<void>
// updateRefreshToken(sessionId: string, newRefreshToken: string): Promise<Session>

export class AuthRepository {
    async createUser(email: string, hashedPassword: string): Promise<User> {
        return await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
            },
        });
    }

    async findUserByEmail(email: string): Promise<User | null> {
        return await prisma.user.findUnique({
            where: { email },
        });
    }

    async findUserById(id: string): Promise<User | null> {
        return await prisma.user.findUnique({ where: { id } });
    }

    async createSession(
        id: string,
        userId: string,
        deviceId: string,
        deviceInfo: string | null,
        ipAddress: string | null,
        refreshToken: string,
    ): Promise<Session> {
        return await prisma.session.create({
            data: {
                id,
                userId,
                deviceId,
                deviceInfo,
                ipAddress,
                refreshToken,
            },
        });
    }

    async findSessionByRefreshToken(
        refreshToken: string,
    ): Promise<Session | null> {
        return await prisma.session.findUnique({
            where: { refreshToken },
        });
    }

    async findSessionsByUserId(userId: string): Promise<Session[]> {
        return await prisma.session.findMany({ where: { userId } });
    }

    async deleteSession(id: string): Promise<void> {
        await prisma.session.delete({ where: { id } });
    }

    async deleteAllUserSessions(userId: string): Promise<void> {
        await prisma.session.deleteMany({ where: { userId } });
    }

    async updateRefreshToken(
        sessionId: string,
        newRefreshToken: string,
    ): Promise<Session> {
        return await prisma.session.update({
            where: { id: sessionId },
            data: { refreshToken: newRefreshToken },
        });
    }

    async findSessionByUserIdAndDeviceId(
        userId: string,
        deviceId: string,
    ): Promise<Session | null> {
        return await prisma.session.findUnique({
            where: { userId_deviceId: { userId, deviceId } },
        });
    }
}
