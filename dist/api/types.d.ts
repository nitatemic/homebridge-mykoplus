export interface MykoAuthConfig {
    email: string;
    password: string;
}
export type DeviceType = 'outlet' | 'lightbulb' | 'other';
export interface MykoDevice {
    id: string;
    name: string;
    model?: string;
    type: DeviceType;
    online: boolean;
    power: boolean;
    rawPayload?: Record<string, unknown>;
}
export interface MykoSession {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
}
//# sourceMappingURL=types.d.ts.map