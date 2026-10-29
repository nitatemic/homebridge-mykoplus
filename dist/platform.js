"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MykoPlusPlatform = void 0;
const settings_1 = require("./settings");
const client_1 = require("./api/client");
const outletAccessory_1 = require("./accessories/outletAccessory");
class MykoPlusPlatform {
    log;
    config;
    api;
    Service;
    Characteristic;
    accessories = [];
    handlers = new Map();
    client;
    pollTimer;
    consecutivePollFailures = 0;
    isStopped = false;
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api?.hap?.Service;
        this.Characteristic = this.api?.hap?.Characteristic;
        if (this.config?.email && this.config?.password) {
            this.client = new client_1.MykoClient({
                email: this.config.email,
                password: this.config.password,
            });
        }
        if (!this.api) {
            return;
        }
        this.api.on('didFinishLaunching', () => {
            this.log.debug('Executed didFinishLaunching callback');
            this.discoverDevices();
        });
        this.api.on('shutdown', () => {
            this.stopPolling();
        });
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    async discoverDevices() {
        if (this.isStopped) {
            return;
        }
        if (!this.config?.email || !this.config?.password) {
            this.log.error('Missing email or password in configuration. Plugin disabled.');
            return;
        }
        if (!this.client) {
            this.client = new client_1.MykoClient({
                email: this.config.email,
                password: this.config.password,
            });
        }
        try {
            const devices = await this.client.getDevices();
            const discoveredUuids = new Set();
            for (const device of devices) {
                if (device.type && device.type !== 'outlet') {
                    this.log.debug(`Skipping unsupported device type "${device.type}" for ${device.name}`);
                    continue;
                }
                const uuid = this.api.hap.uuid.generate(device.id);
                discoveredUuids.add(uuid);
                const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);
                if (existingAccessory) {
                    this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
                    existingAccessory.context.device = device;
                    if (typeof this.api.updatePlatformAccessories === 'function') {
                        this.api.updatePlatformAccessories([existingAccessory]);
                    }
                    const handler = new outletAccessory_1.OutletAccessory(this, existingAccessory);
                    this.handlers.set(uuid, handler);
                }
                else {
                    this.log.info('Adding new accessory:', device.name);
                    const accessory = new this.api.platformAccessory(device.name, uuid);
                    accessory.context.device = device;
                    const handler = new outletAccessory_1.OutletAccessory(this, accessory);
                    this.handlers.set(uuid, handler);
                    this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
                    this.accessories.push(accessory);
                }
            }
            // Unregister orphaned accessories that are no longer present
            const orphanedAccessories = this.accessories.filter(acc => !discoveredUuids.has(acc.UUID));
            if (orphanedAccessories.length > 0) {
                this.log.info(`Removing ${orphanedAccessories.length} orphaned accessories from cache:`, orphanedAccessories.map(a => a.displayName).join(', '));
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, orphanedAccessories);
                for (const orphan of orphanedAccessories) {
                    this.handlers.delete(orphan.UUID);
                    const index = this.accessories.indexOf(orphan);
                    if (index !== -1) {
                        this.accessories.splice(index, 1);
                    }
                }
            }
            this.consecutivePollFailures = 0;
            if (!this.isStopped) {
                this.startPolling();
            }
        }
        catch (err) {
            this.consecutivePollFailures++;
            this.log.error('Failed to discover devices:', (0, client_1.sanitizeLogMessage)(err?.message || String(err)));
            if (!this.isStopped) {
                this.clearTimer();
                const delayMs = this.getNextPollDelayMs();
                this.pollTimer = setTimeout(() => this.discoverDevices(), delayMs);
            }
        }
    }
    startPolling() {
        this.clearTimer();
        this.isStopped = false;
        const delayMs = this.getNextPollDelayMs();
        this.pollTimer = setTimeout(() => this.pollDevices(), delayMs);
    }
    stopPolling() {
        this.isStopped = true;
        this.clearTimer();
    }
    clearTimer() {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
    }
    async pollDevices() {
        if (this.isStopped) {
            return;
        }
        if (this.handlers.size === 0) {
            this.log.debug('No active handlers in pollDevices; delegating to discoverDevices');
            await this.discoverDevices();
            return;
        }
        try {
            if (!this.client) {
                return;
            }
            const devices = await this.client.getDevices();
            this.consecutivePollFailures = 0;
            for (const device of devices) {
                const uuid = this.api.hap.uuid.generate(device.id);
                const handler = this.handlers.get(uuid);
                if (handler) {
                    handler.updateState(device);
                }
            }
        }
        catch (err) {
            this.consecutivePollFailures++;
            this.log.warn('Failed to refresh device states:', (0, client_1.sanitizeLogMessage)(err?.message || String(err)));
        }
        finally {
            if (!this.isStopped) {
                this.startPolling();
            }
        }
    }
    getPollIntervalMs() {
        const rawInterval = Number(this.config?.pollInterval);
        const seconds = Number.isFinite(rawInterval) ? Math.max(5, rawInterval) : 30;
        return seconds * 1000;
    }
    getNextPollDelayMs() {
        const baseIntervalMs = this.getPollIntervalMs();
        if (this.consecutivePollFailures <= 0) {
            return baseIntervalMs;
        }
        // Exponential backoff: base * 2^failures, capped at 300,000 ms (5 minutes)
        const factor = Math.min(Math.pow(2, this.consecutivePollFailures), 16);
        return Math.min(baseIntervalMs * factor, 300000);
    }
}
exports.MykoPlusPlatform = MykoPlusPlatform;
//# sourceMappingURL=platform.js.map