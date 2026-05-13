export interface LoginDto {
    email: string;
    password: string;
}

export interface RegisterDto {
    email: string;
    password: string;
}

export interface AuthResponse {
    accessToken: string;
    sessionInfo: SessionInfo;
}

export interface SessionInfo {
    id: string;
    deviceId: string;
    deviceInfo: string | null;
    createdAt: Date;
}

export interface RefreshResponse {
    accessToken: string;
    sessionInfo: SessionInfo;
}

export interface DeviceContext {
    deviceId: string;
    userAgent: string | null;
    ipAddress: string | null;
}
