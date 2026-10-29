import { MykoAuthConfig, MykoDevice, MykoSession } from './types';
export declare function sanitizeLogMessage(message: string): string;
export declare class MykoClient {
    private config;
    private baseUrl;
    private session;
    private userId;
    constructor(config: MykoAuthConfig, baseUrl?: string);
    getSession(): MykoSession | null;
    getUserId(): string | null;
    login(): Promise<void>;
    private ensureAuthenticated;
    getDevices(): Promise<MykoDevice[]>;
    getDevice(deviceId: string): Promise<MykoDevice | null>;
    buildPowerCommand(deviceId: string, power: boolean): {
        commands: Array<{
            code: string;
            value: boolean;
        }>;
        parameters: {
            power: boolean;
        };
    };
    setDevicePower(deviceId: string, power: boolean): Promise<boolean>;
    parseRawDevice(raw: any): MykoDevice;
    private fetchDevicesWithAuth;
    private extractUserIdFromJwt;
}
//# sourceMappingURL=client.d.ts.map