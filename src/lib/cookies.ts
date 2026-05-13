// src/lib/cookies.ts
import { Response } from "express";
import { config } from "../config/env.js";

export const setAuthCookies = (
    res: Response,
    accessToken: string,
    refreshToken: string,
    deviceId: string,
) => {
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        maxAge: config.JWT_REFRESH_EXPIRES_MS as unknown as number,
            sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        });
        res.cookie("deviceId", deviceId, {
            httpOnly: true,
            secure: config.NODE_ENV === "production",
            sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        });
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: config.NODE_ENV === "production",
            maxAge: config.JWT_ACCESS_EXPIRES_MS as unknown as number,
            sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        });
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
};