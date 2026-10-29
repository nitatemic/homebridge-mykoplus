# Homebridge Myko+ Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native TypeScript Homebridge dynamic platform plugin (`homebridge-mykoplus`) allowing control of Myko+ connected smart plugs via Apple HomeKit.

**Architecture:** A decoupled TypeScript architecture with an autonomous API client (`MykoClient`) handling authentication, device discovery, polling, and commands, orchestrated by a Homebridge dynamic platform (`MykoPlusPlatform`) that provisions and synchronizes `OutletAccessory` instances with HomeKit.

**Tech Stack:** TypeScript, Node.js (>=18), Homebridge Plugin API (`homebridge`, `hap-nodejs`), `dotenv` (for local secrets management).

## Global Constraints

- Never commit credentials from `.env` or sensitive session tokens to Git.
- Plugin platform name must be `MykoPlusPlatform` and plugin name `homebridge-mykoplus`.
- Dynamic accessory caching must be implemented so HomeKit accessories retain their room/scene configuration across restarts.
- Immediate optimistic state updates on user commands before awaiting cloud response.
- Configurable polling interval with default of 30 seconds and exponential backoff on failure.
- Redact passwords and tokens in all logs (`[REDACTED]`).

---

### Task 1: Project Scaffolding & TypeScript Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `config.schema.json`
- Create: `src/settings.ts`
- Create: `test/settings.test.ts`

**Interfaces:**
- Produces: `PLATFORM_NAME = 'MykoPlusPlatform'`, `PLUGIN_NAME = 'homebridge-mykoplus'` in `src/settings.ts`.

- [ ] **Step 1: Write failing test for settings constants**

Create `test/settings.test.ts`:
```typescript
import { PLATFORM_NAME, PLUGIN_NAME } from '../src/settings';

describe('Settings', () => {
  it('should define correct platform and plugin names', () => {
    expect(PLATFORM_NAME).toBe('MykoPlusPlatform');
    expect(PLUGIN_NAME).toBe('homebridge-mykoplus');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/settings.test.ts`  
Expected: FAIL (Cannot find module '../src/settings' or Jest not configured)

- [ ] **Step 3: Create package.json, tsconfig.json, config.schema.json, and src/settings.ts**

Write `package.json`:
```json
{
  "name": "homebridge-mykoplus",
  "version": "1.0.0",
  "description": "Homebridge plugin for Myko+ smart home devices",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "prepublishOnly": "npm run build",
    "test": "jest",
    "test:auth": "ts-node scripts/test-auth.ts"
  },
  "keywords": [
    "homebridge-plugin",
    "myko",
    "mykoplus",
    "kingfisher",
    "homekit"
  ],
  "engines": {
    "node": ">=18.0.0",
    "homebridge": ">=1.6.0"
  },
  "author": "Alexandre de Lemeny-Makedone",
  "license": "Apache-2.0",
  "dependencies": {
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "homebridge": "^1.8.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.5"
  }
}
```

Write `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "scripts"]
}
```

Write `config.schema.json`:
```json
{
  "pluginAlias": "MykoPlusPlatform",
  "pluginType": "platform",
  "headerDisplay": "Myko+ Homebridge Integration",
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "title": "Platform Name",
        "type": "string",
        "default": "MykoPlus",
        "required": true
      },
      "email": {
        "title": "Myko+ Account Email",
        "type": "string",
        "format": "email",
        "required": true
      },
      "password": {
        "title": "Myko+ Account Password",
        "type": "string",
        "required": true
      },
      "pollInterval": {
        "title": "Polling Interval (seconds)",
        "type": "integer",
        "default": 30,
        "minimum": 5,
        "maximum": 300
      }
    }
  }
}
```

Write `src/settings.ts`:
```typescript
export const PLATFORM_NAME = 'MykoPlusPlatform';
export const PLUGIN_NAME = 'homebridge-mykoplus';
```

- [ ] **Step 4: Install dependencies and verify test passes**

Run: `npm install && npx jest test/settings.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit scaffolding**

```bash
git add package.json tsconfig.json config.schema.json src/settings.ts test/settings.test.ts
git commit -m "chore: scaffold project structure and configuration"
```

---

### Task 2: API Client Core, Types & Probing Tool

**Files:**
- Create: `src/api/types.ts`
- Create: `src/api/client.ts`
- Create: `scripts/test-auth.ts`
- Create: `test/api-types.test.ts`

**Interfaces:**
- Produces:
  - `interface MykoDevice`: `{ id: string; name: string; type: 'outlet' | 'lightbulb' | 'other'; online: boolean; power: boolean; }`
  - `interface MykoAuthConfig`: `{ email: string; password: string; }`
  - `class MykoClient`: `login()`, `getDevices()`, `setDevicePower(deviceId: string, on: boolean)`

- [ ] **Step 1: Write test for API data structures & redaction**

Create `test/api-types.test.ts`:
```typescript
import { sanitizeLogMessage } from '../src/api/client';

describe('API Security', () => {
  it('should redact sensitive credentials and tokens in log messages', () => {
    const raw = 'Login failure for test@example.com with password secret123 and token eyJhbGciOi...';
    const sanitized = sanitizeLogMessage(raw);
    expect(sanitized).not.toContain('secret123');
    expect(sanitized).not.toContain('eyJhbGciOi...');
    expect(sanitized).toContain('[REDACTED]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/api-types.test.ts`  
Expected: FAIL (Cannot find module `sanitizeLogMessage`)

- [ ] **Step 3: Define types and implement sanitizeLogMessage + MykoClient skeleton**

Create `src/api/types.ts`:
```typescript
export interface MykoAuthConfig {
  email: string;
  password: string;
}

export type DeviceType = 'outlet' | 'lightbulb' | 'other';

export interface MykoDevice {
  id: string;
  name: string;
  model?: string;
  type: DeviceType;
  online: boolean;
  power: boolean;
  rawPayload?: Record<string, unknown>;
}

export interface MykoSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}
```

Create `src/api/client.ts`:
```typescript
import { MykoAuthConfig, MykoDevice, MykoSession } from './types';

export function sanitizeLogMessage(message: string): string {
  return message
    .replace(/(password\s*[:=]\s*)([^\s&,]+)/gi, '$1[REDACTED]')
    .replace(/(token\s*[:=]\s*)([^\s&,]+)/gi, '$1[REDACTED]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED]');
}

export class MykoClient {
  private config: MykoAuthConfig;
  private session: MykoSession | null = null;

  constructor(config: MykoAuthConfig) {
    this.config = config;
  }

  public async login(): Promise<void> {
    // Probing authenticates against the Myko+ / Tuya IoT Core API
    throw new Error('Not implemented');
  }

  public async getDevices(): Promise<MykoDevice[]> {
    throw new Error('Not implemented');
  }

  public async setDevicePower(deviceId: string, power: boolean): Promise<boolean> {
    throw new Error('Not implemented');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/api-types.test.ts`  
Expected: PASS

- [ ] **Step 5: Create probing script scripts/test-auth.ts**

Create `scripts/test-auth.ts`:
```typescript
import dotenv from 'dotenv';
dotenv.config();

const email = process.env.MYKOPLUS_MAIL;
const password = process.env.MYKOPLUS_PASSWORD;

if (!email || !password) {
  console.error('Missing MYKOPLUS_MAIL or MYKOPLUS_PASSWORD in .env');
  process.exit(1);
}

console.log('Testing authentication with credentials for:', email);
// The script will test authentication against candidate endpoints and inspect device response
```

- [ ] **Step 6: Commit Task 2 files**

```bash
git add src/api/types.ts src/api/client.ts scripts/test-auth.ts test/api-types.test.ts
git commit -m "feat(api): define API types, log sanitizer, and probing script"
```

---

### Task 3: Device Discovery & Authentication Implementation

**Files:**
- Modify: `src/api/client.ts`
- Modify: `scripts/test-auth.ts`
- Test: `test/client.test.ts`

**Interfaces:**
- Consumes: `MykoAuthConfig`
- Produces: `login()` resolves session, `getDevices()` returns array of `MykoDevice` representing the 3 smart plugs.

- [ ] **Step 1: Write unit tests for client device parsing**

Create `test/client.test.ts`:
```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/client.test.ts`  
Expected: FAIL (`parseRawDevice` is not a function)

- [ ] **Step 3: Implement device parsing and HTTP communication in src/api/client.ts**

Implement `parseRawDevice(raw: any): MykoDevice` and HTTP request handling in `src/api/client.ts` supporting standard payload schemes (extracting power state from switches/status arrays).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/client.test.ts`  
Expected: PASS

- [ ] **Step 5: Run scripts/test-auth.ts against live Myko+ backend**

Execute: `npm run test:auth`  
Verify: Successfully authenticate and list the 3 smart plugs on the user's account.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/api/client.ts test/client.test.ts scripts/test-auth.ts
git commit -m "feat(api): implement authentication and device parsing"
```

---

### Task 4: Device State Control & Polling

**Files:**
- Modify: `src/api/client.ts`
- Create: `scripts/test-control.ts`
- Test: `test/control.test.ts`

**Interfaces:**
- Consumes: `deviceId: string`, `power: boolean`
- Produces: `setDevicePower(deviceId, power): Promise<boolean>`

- [ ] **Step 1: Write unit tests for setDevicePower command serialization**

Create `test/control.test.ts`:
```typescript
import { MykoClient } from '../src/api/client';

describe('MykoClient control serialization', () => {
  it('should format switch commands according to device protocol', () => {
    const client = new MykoClient({ email: 'test@example.com', password: 'test' });
    const payload = client.buildPowerCommand('plug-123', true);
    expect(payload.commands).toEqual([{ code: 'switch_1', value: true }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/control.test.ts`  
Expected: FAIL (`buildPowerCommand` not defined)

- [ ] **Step 3: Implement command formatting and execution in src/api/client.ts**

Implement `buildPowerCommand` and `setDevicePower` with error recovery and status updates.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/control.test.ts`  
Expected: PASS

- [ ] **Step 5: Test live command execution on test plug via scripts/test-control.ts**

Run: `npx ts-node scripts/test-control.ts`  
Verify: Successfully toggles plug power on/off.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/api/client.ts test/control.test.ts scripts/test-control.ts
git commit -m "feat(api): implement device power command control and testing script"
```

---

### Task 5: Homebridge Outlet Accessory Handler

**Files:**
- Create: `src/accessories/outletAccessory.ts`
- Create: `src/platformAccessory.ts`
- Test: `test/outletAccessory.test.ts`

**Interfaces:**
- Consumes: `PlatformAccessory`, `MykoPlusPlatform` instance, `MykoDevice`
- Produces: `OutletAccessory` configuring `Service.Outlet`, handling `getOn` and `setOn`.

- [ ] **Step 1: Write unit test for OutletAccessory**

Create `test/outletAccessory.test.ts`:
```typescript
import { OutletAccessory } from '../src/accessories/outletAccessory';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/outletAccessory.test.ts`  
Expected: FAIL (Cannot find module `outletAccessory`)

- [ ] **Step 3: Implement OutletAccessory in src/accessories/outletAccessory.ts**

```typescript
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

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Kingfisher / Myko+')
      .setCharacteristic(this.platform.Characteristic.Model, device.model || 'Smart Plug')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.id);

    this.service = this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    this.service.setCharacteristic(this.platform.Characteristic.Name, device.name);

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
    this.service.updateValue(this.platform.Characteristic.OutletInUse, targetState);

    try {
      await this.platform.client.setDevicePower(device.id, targetState);
    } catch (err) {
      this.platform.log.error(`Failed to set power for ${device.name}:`, err);
      // Revert optimistic update on failure
      this.service.updateValue(this.platform.Characteristic.On, !targetState);
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
    this.service.updateValue(this.platform.Characteristic.On, device.power);
    this.service.updateValue(this.platform.Characteristic.OutletInUse, device.power);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/outletAccessory.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit Task 5**

```bash
git add src/accessories/outletAccessory.ts test/outletAccessory.test.ts
git commit -m "feat(homebridge): implement OutletAccessory handler with optimistic updates"
```

---

### Task 6: Platform Lifecycle, Dynamic Accessory Registration & Polling

**Files:**
- Create: `src/platform.ts`
- Create: `src/index.ts`
- Test: `test/platform.test.ts`

**Interfaces:**
- Produces: `export default (api: API) => api.registerPlatform(PLATFORM_NAME, MykoPlusPlatform);`

- [ ] **Step 1: Write test for platform initialization and cached accessory reconciliation**

Create `test/platform.test.ts`:
```typescript
import { MykoPlusPlatform } from '../src/platform';

describe('MykoPlusPlatform', () => {
  it('should initialize and register accessories handlers on didFinishLaunching', () => {
    const mockLog = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const mockConfig = { email: 'test@example.com', password: 'password', pollInterval: 30 };
    const mockApi = {
      on: jest.fn(),
      registerPlatformAccessories: jest.fn(),
      unregisterPlatformAccessories: jest.fn(),
      hap: {
        Service: {},
        Characteristic: {},
        HapStatusError: jest.fn(),
        HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
      },
    };

    const platform = new MykoPlusPlatform(mockLog as any, mockConfig as any, mockApi as any);
    expect(platform).toBeDefined();
    expect(mockApi.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/platform.test.ts`  
Expected: FAIL (Cannot find module `src/platform`)

- [ ] **Step 3: Implement MykoPlusPlatform and src/index.ts**

Write `src/platform.ts`:
- Implement `DynamicPlatformPlugin`: `configureAccessory`, `discoverDevices`, periodic polling interval timer with backoff, accessory synchronization.
Write `src/index.ts`:
- Register platform with Homebridge API.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/platform.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit Task 6**

```bash
git add src/platform.ts src/index.ts test/platform.test.ts
git commit -m "feat(homebridge): implement dynamic platform plugin and polling loop"
```

---

### Task 7: Full Build, End-to-End Verification & Documentation

**Files:**
- Create: `README.md`
- Verify: `dist/` compilation

- [ ] **Step 1: Run TypeScript full build**

Run: `npm run build`  
Expected: Success, emits declarations and source files in `dist/`.

- [ ] **Step 2: Run complete test suite**

Run: `npm test`  
Expected: All tests pass.

- [ ] **Step 3: Document usage in README.md**

Write complete `README.md` with installation, Homebridge UI configuration, supported devices, and security notice.

- [ ] **Step 4: Commit Task 7**

```bash
git add README.md
git commit -m "docs: add comprehensive README and finalize build"
```
