// → extract deviceId from cookie (or generate new one)
// → extract userAgent from headers
// → extract ipAddress from req.ip
// → set refreshToken as httpOnly cookie
// → set deviceId as httpOnly cookie
// → set accessToken as httpOnly cookie
// POST /auth/register   → extract device context → call service → set cookies
// POST /auth/login      → extract device context → call service → set cookies
// POST /auth/refresh    → read refreshToken cookie → call service → set new cookies
// POST /auth/logout     → read refreshToken cookie → call service → clear cookies
// POST /auth/logout-all → read userId from req → call service → clear cookies

import { AuthService } from "./auth.service.js";
import { Request, Response } from "express";
import { DeviceContext } from "./auth.types.js";
import { config } from "../../config/env.js";
import { nanoid } from "nanoid";
import { setAuthCookies } from "../../lib/cookies.js";

export class AuthController {
    constructor(private readonly authService: AuthService) {}
    private getDeviceContext(req: Request): DeviceContext {
        const deviceId = req.cookies.deviceId ?? nanoid();
        const userAgent = req.headers["user-agent"];
        const ipAddress = req.ip;
        return {
            deviceId: deviceId ?? null,
            userAgent: userAgent ?? null,
            ipAddress: ipAddress ?? null,
        };
    }

    // private setAuthCookies(
    //     res: Response,
    //     accessToken: string,
    //     refreshToken: string,
    //     deviceId: string,
    // ) {
    //     res.cookie("refreshToken", refreshToken, {
    //         httpOnly: true,
    //         secure: config.NODE_ENV === "production",
    //         maxAge: config.JWT_REFRESH_EXPIRES_MS as unknown as number,
    //         sameSite: config.NODE_ENV === "production" ? "none" : "lax",
    //     });
    //     res.cookie("deviceId", deviceId, {
    //         httpOnly: true,
    //         secure: config.NODE_ENV === "production",
    //         sameSite: config.NODE_ENV === "production" ? "none" : "lax",
    //     });
    //     res.cookie("accessToken", accessToken, {
    //         httpOnly: true,
    //         secure: config.NODE_ENV === "production",
    //         maxAge: config.JWT_ACCESS_EXPIRES_MS as unknown as number,
    //         sameSite: config.NODE_ENV === "production" ? "none" : "lax",
    //     });
    // }

    async register(req: Request, res: Response) {
        const { email, password } = req.body;
        const device = this.getDeviceContext(req);
        const result = await this.authService.register(
            { email, password },
            device,
        );
        setAuthCookies(
            res,
            result.accessToken,
            result.refreshToken,
            device.deviceId,
        );
        res.status(201).json({
            message: "User registered successfully",
            data: {
                deviceId: device.deviceId,
            },
            success: true,
        });
    }

    async login(req: Request, res: Response) {
        const { email, password } = req.body;
        const device = this.getDeviceContext(req);
        const result = await this.authService.login(
            { email, password },
            device,
        );
        setAuthCookies(
            res,
            result.accessToken,
            result.refreshToken,
            device.deviceId,
        );
        res.status(200).json({
            message: "User logged in successfully",
        });
    }

    async refresh(req: Request, res: Response) {
        const refreshToken = req.cookies.refreshToken;
        const device = this.getDeviceContext(req);
        const result = await this.authService.refresh(refreshToken);
        setAuthCookies(
            res,
            result.accessToken,
            result.refreshToken,
            device.deviceId,
        );
        res.status(200).json({
            message: "User refreshed successfully",
        });
    }

    async logout(req: Request, res: Response) {
        const refreshToken = req.cookies.refreshToken;
        const userId = req.user?.id;
        if (!userId) throw new Error("User not found");
        await this.authService.logout(refreshToken, userId);
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
        res.status(200).json({
            message: "User logged out successfully",
        });
    }

    async logoutAll(req: Request, res: Response) {
        const userId = req.user?.id;
        if (!userId) throw new Error("User not found");
        await this.authService.logoutAll(userId);
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
        res.status(200).json({
            message: "User logged out from all devices successfully",
        });
    }
}
