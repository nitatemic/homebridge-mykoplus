import { MykoClient } from '../src/api/client';

describe('MykoClient device parsing', () => {
  it('should parse outlet device list correctly from payload', () => {
    const client = new MykoClient({ email: 'test@example.com', password: 'test' });
    const mockRawDevice = {
      id: 'plug-123',
      name: 'Salon Plug',
      category: 'cz', // Tuya standard category for socket/plug
      is_online: true,
      status: [{ code: 'switch_1', value: true }]
    };
    const parsed = client.parseRawDevice(mockRawDevice);
    expect(parsed.id).toBe('plug-123');
    expect(parsed.name).toBe('Salon Plug');
    expect(parsed.type).toBe('outlet');
    expect(parsed.power).toBe(true);
    expect(parsed.online).toBe(true);
  });

  it('should parse native Myko+ plug payload correctly', () => {
    const client = new MykoClient({ email: 'test@example.com', password: 'test' });
    const mockNativeDevice = {
      _id: '690c72f4446fd6f984e14dff',
      name: 'Bureau',
      profile_name: 'PLUG',
      model: 'PLUG',
      reference: 'Leedarson Smart Plug',
      connected: true,
      state: {
        power: false,
        rssi: -67
      }
    };
    const parsed = client.parseRawDevice(mockNativeDevice);
    expect(parsed.id).toBe('690c72f4446fd6f984e14dff');
    expect(parsed.name).toBe('Bureau');
    expect(parsed.type).toBe('outlet');
    expect(parsed.power).toBe(false);
    expect(parsed.online).toBe(true);
    expect(parsed.model).toBe('PLUG');
  });

  it('should handle offline device and missing power state defaults', () => {
    const client = new MykoClient({ email: 'test@example.com', password: 'test' });
    const mockDevice = {
      id: 'plug-offline',
      name: 'Offline Plug',
      type: 5,
      connected: false
    };
    const parsed = client.parseRawDevice(mockDevice);
    expect(parsed.id).toBe('plug-offline');
    expect(parsed.online).toBe(false);
    expect(parsed.power).toBe(false);
    expect(parsed.type).toBe('outlet');
  });
});
