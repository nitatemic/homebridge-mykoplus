import { MykoClient } from '../src/api/client';

describe('MykoClient control serialization and execution', () => {
  let client: MykoClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new MykoClient({ email: 'test@example.com', password: 'test' }, 'https://test.myko.api');
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('buildPowerCommand', () => {
    it('should format switch commands according to device protocol when true', () => {
      const payload = client.buildPowerCommand('plug-123', true);
      expect(payload.commands).toEqual([{ code: 'switch_1', value: true }]);
      expect(payload.parameters).toEqual({ power: true });
    });

    it('should format switch commands according to device protocol when false', () => {
      const payload = client.buildPowerCommand('plug-123', false);
      expect(payload.commands).toEqual([{ code: 'switch_1', value: false }]);
      expect(payload.parameters).toEqual({ power: false });
    });
  });

  describe('setDevicePower', () => {
    it('should send PATCH request with parameters and bearer token', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      // 1. Mock login response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'mock-access-token', id: 'user-123' }),
      } as any);

      // 2. Mock PATCH response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      } as any);

      const result = await client.setDevicePower('device-abc', true);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Check PATCH call
      const [url, options] = mockFetch.mock.calls[1];
      expect(url).toBe('https://test.myko.api/v1/devices/device-abc/state');
      expect(options.method).toBe('PATCH');
      expect(options.headers['Authorization']).toBe('Bearer mock-access-token');
      expect(JSON.parse(options.body)).toEqual({ parameters: { power: true } });
    });

    it('should retry after re-authenticating on 401 response', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      // 1. Mock initial login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'initial-token', id: 'user-123' }),
      } as any);

      await client.login();

      // 2. Mock PATCH returning 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as any);

      // 3. Mock re-login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'refreshed-token', id: 'user-123' }),
      } as any);

      // 4. Mock PATCH retry returning 200
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      } as any);

      const result = await client.setDevicePower('device-abc', false);

      expect(result).toBe(true);
      // Calls: 1 (login) + 1 (401 patch) + 1 (re-login) + 1 (retry patch) = 4
      expect(mockFetch).toHaveBeenCalledTimes(4);
      const [retryUrl, retryOptions] = mockFetch.mock.calls[3];
      expect(retryUrl).toBe('https://test.myko.api/v1/devices/device-abc/state');
      expect(retryOptions.headers['Authorization']).toBe('Bearer refreshed-token');
      expect(JSON.parse(retryOptions.body)).toEqual({ parameters: { power: false } });
    });

    it('should throw an error when API returns non-ok status code', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'mock-token', id: 'user-123' }),
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as any);

      await expect(client.setDevicePower('device-abc', true)).rejects.toThrow('HTTP 500');
    });

    it('should proactively re-authenticate if session is within 60s of expiration', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      // 1. Initial login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'token-1', id: 'user-123' }),
      } as any);

      await client.login();

      // Manipulate session expiresAt to expire in 30 seconds (< 60s buffer)
      const session = client.getSession();
      expect(session).not.toBeNull();
      session!.expiresAt = Date.now() + 30000;

      // 2. Mock second login (proactive refresh)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'token-2', id: 'user-123' }),
      } as any);

      // 3. Mock PATCH request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      } as any);

      await client.setDevicePower('device-abc', true);

      // Should have triggered login again before PATCH
      // Call 0: initial login
      // Call 1: proactive login
      // Call 2: PATCH
      expect(mockFetch).toHaveBeenCalledTimes(3);
      const [patchUrl, patchOptions] = mockFetch.mock.calls[2];
      expect(patchUrl).toBe('https://test.myko.api/v1/devices/device-abc/state');
      expect(patchOptions.headers['Authorization']).toBe('Bearer token-2');
    });
  });
});
