import {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';
import { MykoClient } from './api/client';

/**
 * Platform stub for MykoPlusPlatform.
 * Full lifecycle, accessory discovery, and polling loop are implemented in Task 6.
 */
export class MykoPlusPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  public client!: MykoClient;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api?.hap?.Service;
    this.Characteristic = this.api?.hap?.Characteristic;
  }

  configureAccessory(_accessory: PlatformAccessory): void {
    // Stub: to be fully implemented in Task 6
  }
}
