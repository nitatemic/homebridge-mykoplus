import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { MykoClient } from './api/client';
import { OutletAccessory } from './accessories/outletAccessory';
export declare class MykoPlusPlatform implements DynamicPlatformPlugin {
    readonly log: Logging;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory[];
    readonly handlers: Map<string, OutletAccessory>;
    client: MykoClient;
    private pollTimer?;
    private consecutivePollFailures;
    private isStopped;
    constructor(log: Logging, config: PlatformConfig, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    discoverDevices(): Promise<void>;
    startPolling(): void;
    stopPolling(): void;
    private clearTimer;
    pollDevices(): Promise<void>;
    private getPollIntervalMs;
    private getNextPollDelayMs;
}
//# sourceMappingURL=platform.d.ts.map