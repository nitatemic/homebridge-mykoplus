import { PLATFORM_NAME, PLUGIN_NAME } from '../src/settings';

describe('Settings', () => {
  it('should define correct platform and plugin names', () => {
    expect(PLATFORM_NAME).toBe('MykoPlusPlatform');
    expect(PLUGIN_NAME).toBe('homebridge-mykoplus');
  });
});
