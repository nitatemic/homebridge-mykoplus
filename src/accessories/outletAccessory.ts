import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MykoPlusPlatform } from '../platform';
import { MykoDevice } from '../api/types';

export class OutletAccessory {
  private service: Service;

  constructor(
    private readonly platform: MykoPlusPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    const device: MykoDevice = accessory.context.device;

    const infoService = this.accessory.getService(this.platform.Service.AccessoryInformation) ||
      this.accessory.addService(this.platform.Service.AccessoryInformation);

    if (infoService && typeof infoService.setCharacteristic === 'function') {
      infoService
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Kingfisher / Myko+')
        .setCharacteristic(this.platform.Characteristic.Model, device.model || 'Smart Plug')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, device.id);
    }

    this.service = this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    if (typeof this.service.setCharacteristic === 'function') {
      this.service.setCharacteristic(this.platform.Characteristic.Name, device.name);
    }

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.OutletInUse)
      .onGet(this.getOn.bind(this));
  }

  async setOn(value: CharacteristicValue): Promise<void> {
    const targetState = value as boolean;
    const device: MykoDevice = this.accessory.context.device;

    // Optimistic local update
    device.power = targetState;
    this.updateCharacteristicValue(this.platform.Characteristic.OutletInUse, targetState);

    try {
      await this.platform.client.setDevicePower(device.id, targetState);
    } catch (err) {
      this.platform.log.error(`Failed to set power for ${device.name}:`, err);
      // Revert optimistic update on failure
      device.power = !targetState;
      this.updateCharacteristicValue(this.platform.Characteristic.On, !targetState);
      this.updateCharacteristicValue(this.platform.Characteristic.OutletInUse, !targetState);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  async getOn(): Promise<CharacteristicValue> {
    const device: MykoDevice = this.accessory.context.device;
    return device.power;
  }

  public updateState(device: MykoDevice): void {
    this.accessory.context.device = device;
    this.updateCharacteristicValue(this.platform.Characteristic.On, device.power);
    this.updateCharacteristicValue(this.platform.Characteristic.OutletInUse, device.power);
  }

  private updateCharacteristicValue(characteristic: any, value: CharacteristicValue): void {
    if (typeof (this.service as any).updateValue === 'function') {
      (this.service as any).updateValue(characteristic, value);
    }
    if (typeof this.service.updateCharacteristic === 'function') {
      this.service.updateCharacteristic(characteristic, value);
    }
  }
}
