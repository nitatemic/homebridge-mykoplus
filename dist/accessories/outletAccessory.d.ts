import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MykoPlusPlatform } from '../platform';
import { MykoDevice } from '../api/types';
export declare class OutletAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    constructor(platform: MykoPlusPlatform, accessory: PlatformAccessory);
    setOn(value: CharacteristicValue): Promise<void>;
    getOn(): Promise<CharacteristicValue>;
    updateState(device: MykoDevice): void;
    private updateCharacteristicValue;
}
//# sourceMappingURL=outletAccessory.d.ts.map