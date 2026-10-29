import { API } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { MykoPlusPlatform } from './platform';

export { MykoPlusPlatform, PLATFORM_NAME, PLUGIN_NAME };

export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, MykoPlusPlatform);
};
