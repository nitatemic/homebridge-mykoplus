import { DeviceType, MykoAuthConfig, MykoDevice, MykoSession } from './types';

const DEFAULT_BASE_URL = 'https://mobileapi1.mykoapp.kingfisher.com';

export function sanitizeLogMessage(message: string): string {
  return message
    .replace(/(password\s*[:=]?\s*)([^\s&,]+)/gi, '$1[REDACTED]')
    .replace(/(token\s*[:=]?\s*)([^\s&,]+)/gi, '$1[REDACTED]')
    .replace(/eyJ[a-zA-Z0-9_.-]+/g, '[REDACTED]');
}

export class MykoClient {
  private config: MykoAuthConfig;
  private baseUrl: string;
  private session: MykoSession | null = null;
  private userId: string | null = null;

  constructor(config: MykoAuthConfig, baseUrl: string = DEFAULT_BASE_URL) {
    this.config = config;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public getSession(): MykoSession | null {
    return this.session;
  }

  public getUserId(): string | null {
    return this.userId;
  }

  public async login(): Promise<void> {
    const payloadCandidates = [
      { email: this.config.email, password: this.config.password },
      { username: this.config.email, password: this.config.password },
    ];

    let lastError: Error | null = null;
    for (const body of payloadCandidates) {
      try {
        const response = await fetch(`${this.baseUrl}/v1/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'homebridge-mykoplus/1.0.0',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Authentication failed with status ${response.status}: ${sanitizeLogMessage(errText)}`);
        }

        const data = (await response.json()) as Record<string, unknown>;
        const accessToken = (data.token || data.access_token || data.accessToken || (data.data as any)?.token) as string | undefined;
        const refreshToken = (data.refresh_token || data.refreshToken || (data.data as any)?.refreshToken) as string | undefined;
        let userId = (data.id || data.userId || data.user_id || (data.user as any)?.id) as string | undefined;

        if (!accessToken) {
          throw new Error('Authentication succeeded but no access token returned');
        }

        if (!userId) {
          userId = this.extractUserIdFromJwt(accessToken) || undefined;
        }

        this.userId = userId || null;
        this.session = {
          accessToken,
          refreshToken,
          expiresAt: Date.now() + 3600 * 1000,
        };
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(`Myko+ login failed: ${sanitizeLogMessage(lastError?.message || 'Unknown error')}`);
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.session || !this.session.accessToken || Date.now() >= this.session.expiresAt - 60000) {
      await this.login();
    }
  }

  public async getDevices(): Promise<MykoDevice[]> {
    await this.ensureAuthenticated();

    try {
      return await this.fetchDevicesWithAuth();
    } catch (err: any) {
      if (err?.status === 401) {
        await this.login();
        return await this.fetchDevicesWithAuth();
      }
      throw err;
    }
  }

  public async getDevice(deviceId: string): Promise<MykoDevice | null> {
    await this.ensureAuthenticated();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.session!.accessToken}`,
      'User-Agent': 'homebridge-mykoplus/1.0.0',
    };

    let response = await fetch(`${this.baseUrl}/v1/devices/${deviceId}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401) {
      await this.login();
      headers['Authorization'] = `Bearer ${this.session!.accessToken}`;
      response = await fetch(`${this.baseUrl}/v1/devices/${deviceId}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
    }

    if (!response.ok) {
      return null;
    }

    const raw = await response.json();
    return this.parseRawDevice(raw);
  }

  public buildPowerCommand(deviceId: string, power: boolean): { commands: Array<{ code: string; value: boolean }>; parameters: { power: boolean } } {
    return {
      commands: [{ code: 'switch_1', value: power }],
      parameters: { power },
    };
  }

  public async setDevicePower(deviceId: string, power: boolean): Promise<boolean> {
    await this.ensureAuthenticated();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.session!.accessToken}`,
      'User-Agent': 'homebridge-mykoplus/1.0.0',
    };

    const payload = this.buildPowerCommand(deviceId, power);
    const body = JSON.stringify({ parameters: payload.parameters });

    let response = await fetch(`${this.baseUrl}/v1/devices/${deviceId}/state`, {
      method: 'PATCH',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401) {
      await this.login();
      headers['Authorization'] = `Bearer ${this.session!.accessToken}`;
      response = await fetch(`${this.baseUrl}/v1/devices/${deviceId}/state`, {
        method: 'PATCH',
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to set device power: HTTP ${response.status} ${sanitizeLogMessage(errText)}`);
    }

    return true;
  }

  public parseRawDevice(raw: any): MykoDevice {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid raw device payload: payload must be an object');
    }

    const id = String(raw._id || raw.id || raw.deviceId || (raw.data && (raw.data._id || raw.data.id)) || '');
    const name = String(raw.name || raw.deviceName || (raw.state && raw.state.deviceName) || raw.label || 'Myko Device');
    const model = (raw.model || raw.reference || raw.profile_name || (raw.state && raw.state.deviceName) || undefined) as string | undefined;

    // Determine device category / type
    const category = String(raw.category || '').toLowerCase();
    const profile = String(raw.profile_name || '').toUpperCase();
    const modelStr = String(raw.model || '').toUpperCase();
    const refStr = String(raw.reference || '').toLowerCase();
    const nameStr = name.toLowerCase();
    const stateDevName = String(raw.state?.deviceName || '').toUpperCase();

    let type: DeviceType = 'other';
    if (
      category === 'cz' ||
      raw.type === 5 ||
      profile === 'PLUG' ||
      profile === 'PLUG_EM' ||
      modelStr === 'PLUG' ||
      modelStr === 'PLUG_EM' ||
      stateDevName === 'PLUG' ||
      stateDevName === 'PLUG_EM' ||
      refStr.includes('plug') ||
      nameStr.includes('plug') ||
      refStr.includes('prise')
    ) {
      type = 'outlet';
    } else if (
      category === 'dj' ||
      profile === 'LIGHT' ||
      profile === 'BULB' ||
      refStr.includes('light') ||
      refStr.includes('bulb') ||
      refStr.includes('ampoule')
    ) {
      type = 'lightbulb';
    }

    // Determine online connectivity status
    let online = true;
    if (typeof raw.connected === 'boolean') {
      online = raw.connected;
    } else if (typeof raw.is_online === 'boolean') {
      online = raw.is_online;
    } else if (typeof raw.online === 'boolean') {
      online = raw.online;
    }

    // Determine current power state
    let power = false;
    if (raw.state && typeof raw.state.power === 'boolean') {
      power = raw.state.power;
    } else if (typeof raw.power === 'boolean') {
      power = raw.power;
    } else if (Array.isArray(raw.status)) {
      const switchItem = raw.status.find(
        (item: any) => item && (item.code === 'switch_1' || item.code === 'switch' || item.code === 'power'),
      );
      if (switchItem && typeof switchItem.value === 'boolean') {
        power = switchItem.value;
      }
    } else if (raw.dps && typeof raw.dps['1'] === 'boolean') {
      power = raw.dps['1'];
    }

    return {
      id,
      name,
      model,
      type,
      online,
      power,
      rawPayload: raw as Record<string, unknown>,
    };
  }

  private async fetchDevicesWithAuth(): Promise<MykoDevice[]> {
    if (!this.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.session.accessToken}`,
      'User-Agent': 'homebridge-mykoplus/1.0.0',
    };

    // 1. Direct user devices endpoint /v1/users/{userId}/devices
    if (this.userId) {
      const response = await fetch(`${this.baseUrl}/v1/users/${this.userId}/devices`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 401) {
        const error = new Error('Unauthorized');
        (error as any).status = 401;
        throw error;
      }

      if (response.ok) {
        const data = (await response.json()) as any;
        const rawDevices = Array.isArray(data) ? data : (data.devices || data.items || data.data || []);
        if (Array.isArray(rawDevices) && rawDevices.length > 0) {
          return rawDevices.map((d: any) => this.parseRawDevice(d));
        }
      }
    }

    // 2. Fallback: query homes -> devices in each home
    if (this.userId) {
      const homesRes = await fetch(`${this.baseUrl}/v1/users/${this.userId}/homes`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (homesRes.status === 401) {
        const error = new Error('Unauthorized');
        (error as any).status = 401;
        throw error;
      }

      if (homesRes.ok) {
        const homesData = (await homesRes.json()) as any;
        const homes = Array.isArray(homesData) ? homesData : (homesData.homes || homesData.data || []);
        const devices: MykoDevice[] = [];

        for (const home of homes) {
          const homeId = home._id || home.id;
          if (!homeId) continue;

          const devRes = await fetch(`${this.baseUrl}/v1/homes/${homeId}/devices`, {
            headers,
            signal: AbortSignal.timeout(10000),
          });

          if (devRes.ok) {
            const devData = (await devRes.json()) as any;
            const rawList = Array.isArray(devData) ? devData : (devData.devices || devData.data || []);
            for (const item of rawList) {
              devices.push(this.parseRawDevice(item));
            }
          }
        }

        if (devices.length > 0) {
          return devices;
        }
      }
    }

    return [];
  }

  private extractUserIdFromJwt(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const decoded = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(decoded);
        return payload.sub || payload.userId || payload.user_id || payload.id || null;
      }
    } catch {
      // ignore
    }
    return null;
  }
}
