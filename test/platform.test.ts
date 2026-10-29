import { MykoPlusPlatform } from '../src/platform';
import pluginInit from '../src/index';
import { PLATFORM_NAME, PLUGIN_NAME } from '../src/settings';
import { MykoClient } from '../src/api/client';
import { MykoDevice } from '../src/api/types';

jest.mock('../src/api/client', () => {
  const actual = jest.requireActual('../src/api/client');
  return {
    ...actual,
    MykoClient: jest.fn(),
  };
});

describe('MykoPlusPlatform', () => {
  let mockLog: any;
  let mockConfig: any;
  let mockApi: any;
  let mockClientInstance: any;

  function createMockService() {
    return {
      setCharacteristic: jest.fn().mockReturnThis(),
      getCharacteristic: jest.fn().mockReturnValue({
        onSet: jest.fn().mockReturnThis(),
        onGet: jest.fn().mockReturnThis(),
      }),
      updateValue: jest.fn(),
      updateCharacteristic: jest.fn(),
    };
  }

  function createMockAccessory(name: string, uuid: string) {
    const infoService = createMockService();
    const outletService = createMockService();
    return {
      displayName: name,
      UUID: uuid,
      context: {} as any,
      getService: jest.fn((serviceType: any) => {
        if (serviceType === 'AccessoryInformation') return infoService;
        if (serviceType === 'Outlet') return outletService;
        return undefined;
      }),
      addService: jest.fn((serviceType: any) => {
        if (serviceType === 'AccessoryInformation') return infoService;
        return outletService;
      }),
      _infoService: infoService,
      _outletService: outletService,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockLog = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockConfig = {
      name: 'MykoPlus',
      email: 'test@example.com',
      password: 'secret-password',
      pollInterval: 30,
    };

    mockClientInstance = {
      getDevices: jest.fn().mockResolvedValue([]),
      setDevicePower: jest.fn().mockResolvedValue(true),
    };

    (MykoClient as unknown as jest.Mock).mockImplementation(() => mockClientInstance);

    mockApi = {
      on: jest.fn(),
      registerPlatform: jest.fn(),
      registerPlatformAccessories: jest.fn(),
      unregisterPlatformAccessories: jest.fn(),
      updatePlatformAccessories: jest.fn(),
      platformAccessory: jest.fn().mockImplementation((name: string, uuid: string) => {
        return createMockAccessory(name, uuid);
      }),
      hap: {
        Service: {
          AccessoryInformation: 'AccessoryInformation',
          Outlet: 'Outlet',
        },
        Characteristic: {
          Manufacturer: 'Manufacturer',
          Model: 'Model',
          SerialNumber: 'SerialNumber',
          Name: 'Name',
          On: 'On',
          OutletInUse: 'OutletInUse',
        },
        uuid: {
          generate: jest.fn((id: string) => `mock-uuid-${id}`),
        },
        HapStatusError: jest.fn(),
        HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
      },
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Plugin Initialization (src/index.ts)', () => {
    it('should register platform with Homebridge API via default export', () => {
      pluginInit(mockApi);
      expect(mockApi.registerPlatform).toHaveBeenCalledWith(PLATFORM_NAME, MykoPlusPlatform);
    });
  });

  describe('Platform Lifecycle & Constructor', () => {
    it('should initialize and register didFinishLaunching handler', () => {
      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      expect(platform).toBeDefined();
      expect(mockApi.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
    });

    it('should initialize HAP Service and Characteristic from api.hap', () => {
      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      expect(platform.Service).toBe(mockApi.hap.Service);
      expect(platform.Characteristic).toBe(mockApi.hap.Characteristic);
    });

    it('should handle undefined api gracefully', () => {
      const platform = new MykoPlusPlatform(mockLog, mockConfig, undefined as any);
      expect(platform).toBeDefined();
    });
  });

  describe('configureAccessory (Cache Restoration)', () => {
    it('should capture restored cached accessories into platform collection', () => {
      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      const cachedAccessory = createMockAccessory('Cached Plug', 'mock-uuid-cached-1');

      platform.configureAccessory(cachedAccessory as any);

      expect(platform.accessories).toContain(cachedAccessory);
      expect(mockLog.info).toHaveBeenCalledWith('Loading accessory from cache:', 'Cached Plug');
    });
  });

  describe('discoverDevices', () => {
    it('should log an error and halt if email or password is missing in configuration', async () => {
      const invalidConfig = { ...mockConfig, email: '' };
      const platform = new MykoPlusPlatform(mockLog, invalidConfig, mockApi);

      await platform.discoverDevices();

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing email or password'),
      );
      expect(mockClientInstance.getDevices).not.toHaveBeenCalled();
      expect(mockApi.registerPlatformAccessories).not.toHaveBeenCalled();
    });

    it('should discover new devices and register them as accessories', async () => {
      const mockDevices: MykoDevice[] = [
        {
          id: 'plug-1',
          name: 'Living Room Plug',
          type: 'outlet',
          online: true,
          power: true,
        },
      ];
      mockClientInstance.getDevices.mockResolvedValueOnce(mockDevices);

      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      await platform.discoverDevices();

      expect(mockApi.hap.uuid.generate).toHaveBeenCalledWith('plug-1');
      expect(mockApi.platformAccessory).toHaveBeenCalledWith('Living Room Plug', 'mock-uuid-plug-1');
      expect(mockApi.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [expect.objectContaining({ UUID: 'mock-uuid-plug-1' })],
      );
      expect(platform.accessories).toHaveLength(1);
      expect(platform.accessories[0].context.device).toEqual(mockDevices[0]);
      expect(platform.handlers.has('mock-uuid-plug-1')).toBe(true);
    });

    it('should restore existing cached accessories without re-registering', async () => {
      const cachedAccessory = createMockAccessory('Old Name', 'mock-uuid-plug-2');
      cachedAccessory.context = {
        device: { id: 'plug-2', name: 'Old Name', type: 'outlet', online: true, power: false },
      };

      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      platform.configureAccessory(cachedAccessory as any);

      const discoveredDevice: MykoDevice = {
        id: 'plug-2',
        name: 'Updated Plug Name',
        type: 'outlet',
        online: true,
        power: true,
      };
      mockClientInstance.getDevices.mockResolvedValueOnce([discoveredDevice]);

      await platform.discoverDevices();

      expect(mockApi.registerPlatformAccessories).not.toHaveBeenCalled();
      expect(mockApi.updatePlatformAccessories).toHaveBeenCalledWith([cachedAccessory]);
      expect(cachedAccessory.context.device).toEqual(discoveredDevice);
      expect(platform.handlers.has('mock-uuid-plug-2')).toBe(true);
      expect(mockLog.info).toHaveBeenCalledWith(
        'Restoring existing accessory from cache:',
        'Old Name',
      );
    });

    it('should unregister orphaned accessories from cache that no longer exist in cloud', async () => {
      const orphanAccessory = createMockAccessory('Deleted Plug', 'mock-uuid-orphan');
      orphanAccessory.context = {
        device: { id: 'orphan', name: 'Deleted Plug', type: 'outlet', online: true, power: false },
      };

      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      platform.configureAccessory(orphanAccessory as any);

      mockClientInstance.getDevices.mockResolvedValueOnce([]); // No devices in cloud

      await platform.discoverDevices();

      expect(mockApi.unregisterPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [orphanAccessory],
      );
      expect(platform.accessories).toHaveLength(0);
      expect(platform.handlers.has('mock-uuid-orphan')).toBe(false);
    });

    it('should ignore non-outlet devices', async () => {
      const mockDevices: MykoDevice[] = [
        { id: 'light-1', name: 'Ceiling Bulb', type: 'lightbulb', online: true, power: true },
        { id: 'sensor-1', name: 'Temp Sensor', type: 'other', online: true, power: false },
      ];
      mockClientInstance.getDevices.mockResolvedValueOnce(mockDevices);

      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      await platform.discoverDevices();

      expect(mockApi.registerPlatformAccessories).not.toHaveBeenCalled();
      expect(platform.accessories).toHaveLength(0);
    });

    it('should handle discovery error gracefully without crashing and sanitize error log', async () => {
      mockClientInstance.getDevices.mockRejectedValueOnce(
        new Error('Network error with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae and password secret-password'),
      );

      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      await platform.discoverDevices();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to discover devices:',
        expect.not.stringContaining('secret-password'),
      );
      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to discover devices:',
        expect.stringContaining('[REDACTED]'),
      );
    });

    it('should execute discoverDevices when didFinishLaunching event is emitted', () => {
      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      const discoverSpy = jest.spyOn(platform, 'discoverDevices').mockImplementation(async () => {});

      // Retrieve registered listener
      const didFinishLaunchingCallback = mockApi.on.mock.calls.find(
        (call: any[]) => call[0] === 'didFinishLaunching',
      )[1];

      didFinishLaunchingCallback();
      expect(discoverSpy).toHaveBeenCalled();
    });
  });

  describe('Polling Loop & Backoff', () => {
    it('should use default 30s poll interval and minimum 5s constraint', () => {
      const platformDefault = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      expect((platformDefault as any).getPollIntervalMs()).toBe(30000);

      const platformLow = new MykoPlusPlatform(
        mockLog,
        { ...mockConfig, pollInterval: 2 },
        mockApi,
      );
      expect((platformLow as any).getPollIntervalMs()).toBe(5000);

      const platformCustom = new MykoPlusPlatform(
        mockLog,
        { ...mockConfig, pollInterval: 45 },
        mockApi,
      );
      expect((platformCustom as any).getPollIntervalMs()).toBe(45000);
    });

    it('should poll devices and invoke updateState on handlers', async () => {
      const mockDevice: MykoDevice = {
        id: 'plug-1',
        name: 'Plug 1',
        type: 'outlet',
        online: true,
        power: false,
      };
      mockClientInstance.getDevices.mockResolvedValue([mockDevice]);

      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      await platform.discoverDevices();

      const handler = platform.handlers.get('mock-uuid-plug-1')!;
      expect(handler).toBeDefined();
      const updateStateSpy = jest.spyOn(handler, 'updateState');

      const updatedDevice = { ...mockDevice, power: true };
      mockClientInstance.getDevices.mockResolvedValueOnce([updatedDevice]);

      await platform.pollDevices();

      expect(updateStateSpy).toHaveBeenCalledWith(updatedDevice);
    });

    it('should handle poll error gracefully with log sanitization and exponential backoff', async () => {
      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      await platform.discoverDevices();

      mockClientInstance.getDevices.mockRejectedValueOnce(
        new Error('Polling failed token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae password=secret-password'),
      );

      await platform.pollDevices();

      expect(mockLog.warn).toHaveBeenCalledWith(
        'Failed to refresh device states:',
        expect.not.stringContaining('secret-password'),
      );
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Failed to refresh device states:',
        expect.stringContaining('[REDACTED]'),
      );

      expect((platform as any).consecutivePollFailures).toBe(1);
      // Next delay should be base * 2^1 = 30000 * 2 = 60000
      expect((platform as any).getNextPollDelayMs()).toBe(60000);
    });

    it('should reset consecutive failures on successful poll', async () => {
      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      await platform.discoverDevices();

      (platform as any).consecutivePollFailures = 3;

      mockClientInstance.getDevices.mockResolvedValueOnce([]);
      await platform.pollDevices();

      expect((platform as any).consecutivePollFailures).toBe(0);
      expect((platform as any).getNextPollDelayMs()).toBe(30000);
    });

    it('should stop polling when stopPolling is called', async () => {
      const platform = new MykoPlusPlatform(mockLog, mockConfig, mockApi);
      platform.startPolling();

      expect((platform as any).pollTimer).toBeDefined();

      platform.stopPolling();

      expect((platform as any).pollTimer).toBeUndefined();
    });
  });
});
