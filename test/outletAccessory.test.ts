import { OutletAccessory } from '../src/accessories/outletAccessory';
import { MykoDevice } from '../src/api/types';

describe('OutletAccessory', () => {
  it('should initialize Outlet service and setup Characteristic handlers', () => {
    const mockService = {
      getCharacteristic: jest.fn().mockReturnThis(),
      onGet: jest.fn().mockReturnThis(),
      onSet: jest.fn().mockReturnThis(),
      updateValue: jest.fn(),
    };
    const mockAccessory = {
      getService: jest.fn().mockReturnValue(mockService),
      addService: jest.fn().mockReturnValue(mockService),
      context: {
        device: { id: 'plug-1', name: 'Outlet 1', type: 'outlet', online: true, power: false },
      },
    };
    const mockPlatform = {
      Service: { Outlet: 'Outlet', AccessoryInformation: 'AccessoryInformation' },
      Characteristic: { On: 'On', OutletInUse: 'OutletInUse', Manufacturer: 'Manufacturer', Model: 'Model', SerialNumber: 'SerialNumber' },
      log: { info: jest.fn(), debug: jest.fn(), error: jest.fn() },
      client: { setDevicePower: jest.fn().mockResolvedValue(true) },
    };

    const handler = new OutletAccessory(mockPlatform as any, mockAccessory as any);
    expect(handler).toBeDefined();
    expect(mockService.onSet).toHaveBeenCalled();
    expect(mockService.onGet).toHaveBeenCalled();
  });

  describe('Device information and handlers configuration', () => {
    let mockOutletService: any;
    let mockInfoService: any;
    let mockAccessory: any;
    let mockPlatform: any;
    let device: MykoDevice;

    beforeEach(() => {
      device = {
        id: 'plug-100',
        name: 'Kitchen Socket',
        model: 'MYKO-PLUG-V2',
        type: 'outlet',
        online: true,
        power: false,
      };

      mockOutletService = {
        getCharacteristic: jest.fn().mockReturnThis(),
        setCharacteristic: jest.fn().mockReturnThis(),
        onGet: jest.fn().mockReturnThis(),
        onSet: jest.fn().mockReturnThis(),
        updateValue: jest.fn(),
      };

      mockInfoService = {
        setCharacteristic: jest.fn().mockReturnThis(),
      };

      mockAccessory = {
        getService: jest.fn().mockImplementation((service: string) => {
          if (service === 'AccessoryInformation') {
            return mockInfoService;
          }
          if (service === 'Outlet') {
            return mockOutletService;
          }
          return undefined;
        }),
        addService: jest.fn().mockReturnValue(mockOutletService),
        context: {
          device,
        },
      };

      class MockHapStatusError extends Error {
        constructor(public status: number) {
          super(`HAP error status: ${status}`);
        }
      }

      mockPlatform = {
        Service: {
          Outlet: 'Outlet',
          AccessoryInformation: 'AccessoryInformation',
        },
        Characteristic: {
          On: 'On',
          OutletInUse: 'OutletInUse',
          Manufacturer: 'Manufacturer',
          Model: 'Model',
          SerialNumber: 'SerialNumber',
          Name: 'Name',
        },
        log: {
          info: jest.fn(),
          debug: jest.fn(),
          error: jest.fn(),
        },
        client: {
          setDevicePower: jest.fn().mockResolvedValue(true),
        },
        api: {
          hap: {
            HapStatusError: MockHapStatusError,
            HAPStatus: {
              SERVICE_COMMUNICATION_FAILURE: -70402,
            },
          },
        },
      };
    });

    it('should configure AccessoryInformation with device metadata', () => {
      new OutletAccessory(mockPlatform as any, mockAccessory as any);

      expect(mockInfoService.setCharacteristic).toHaveBeenCalledWith('Manufacturer', 'Kingfisher / Myko+');
      expect(mockInfoService.setCharacteristic).toHaveBeenCalledWith('Model', 'MYKO-PLUG-V2');
      expect(mockInfoService.setCharacteristic).toHaveBeenCalledWith('SerialNumber', 'plug-100');
      expect(mockOutletService.setCharacteristic).toHaveBeenCalledWith('Name', 'Kitchen Socket');
    });

    it('should use fallback model Smart Plug when device.model is not provided', () => {
      delete device.model;
      new OutletAccessory(mockPlatform as any, mockAccessory as any);

      expect(mockInfoService.setCharacteristic).toHaveBeenCalledWith('Model', 'Smart Plug');
    });

    it('should return current power state via getOn', async () => {
      device.power = true;
      const handler = new OutletAccessory(mockPlatform as any, mockAccessory as any);

      const state = await handler.getOn();
      expect(state).toBe(true);
    });

    it('should optimistically update state and call setDevicePower on setOn', async () => {
      const handler = new OutletAccessory(mockPlatform as any, mockAccessory as any);

      await handler.setOn(true);

      expect(device.power).toBe(true);
      expect(mockOutletService.updateValue).toHaveBeenCalledWith('OutletInUse', true);
      expect(mockPlatform.client.setDevicePower).toHaveBeenCalledWith('plug-100', true);
    });

    it('should revert state and throw HapStatusError if setDevicePower fails', async () => {
      mockPlatform.client.setDevicePower.mockRejectedValueOnce(new Error('Network timeout'));
      const handler = new OutletAccessory(mockPlatform as any, mockAccessory as any);

      await expect(handler.setOn(true)).rejects.toThrow(mockPlatform.api.hap.HapStatusError);

      expect(mockPlatform.log.error).toHaveBeenCalled();
      expect(mockOutletService.updateValue).toHaveBeenCalledWith('On', false);
      expect(mockOutletService.updateValue).toHaveBeenCalledWith('OutletInUse', false);
      expect(device.power).toBe(false);
    });

    it('should synchronize state on updateState call', () => {
      const handler = new OutletAccessory(mockPlatform as any, mockAccessory as any);

      const updatedDevice: MykoDevice = {
        ...device,
        power: true,
      };

      handler.updateState(updatedDevice);

      expect(mockAccessory.context.device).toEqual(updatedDevice);
      expect(mockOutletService.updateValue).toHaveBeenCalledWith('On', true);
      expect(mockOutletService.updateValue).toHaveBeenCalledWith('OutletInUse', true);
    });
  });
});
