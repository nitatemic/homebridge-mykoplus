import { PlatformAccessory } from 'homebridge';
import { MykoDevice } from './api/types';
export interface MykoPlatformAccessoryContext {
    device: MykoDevice;
}
export type MykoPlatformAccessory = PlatformAccessory<MykoPlatformAccessoryContext>;
export * from './accessories/outletAccessory';
//# sourceMappingURL=platformAccessory.d.ts.map