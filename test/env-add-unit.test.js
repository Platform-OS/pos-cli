import { vi, describe, test, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { settingsFromDotPos } from '../lib/settings.js';

let addEnv;
let storeEnvironment;

vi.mock('../lib/data/waitForStatus.js', () => ({
  default: () => Promise.resolve({ access_token: '12345', status: 'success' })
}));

vi.mock('../lib/portal.js', async () => {
  const original = await vi.importActual('../lib/portal.js');
  return {
    default: {
      ...original,
      requestDeviceAuthorization: () => Promise.resolve({verification_uri_complete: "http://example.com/xxxx", device_code: "device_code"}),
      fetchDeviceAccessToken: () => Promise.resolve({access_token: "12345"})
    }
  };
});

vi.mock('../lib/logger.js', async () => {
  const module = await vi.importActual('../lib/logger.js');
  return {
    default: {
      ...module.default,
      Success: () => {},
      Debug: () => {},
      Info: () => {},
      Error: () => {}
    }
  };
});

vi.mock('../lib/validators/index.js', () => ({
  existence: { directoryExists: () => true, fileExists: () => true },
  url: () => true,
  email: () => true,
  directoryExists: () => true,
  directoryEmpty: () => true
}));

beforeAll(async () => {
  const envMod = await import('../lib/environments.js');
  storeEnvironment = envMod.storeEnvironment;
  
  const addMod = await import('../lib/envs/add.js');
  addEnv = addMod.default;
});

afterEach(() => {
  try {
    fs.unlinkSync('.pos');
  } catch (e) {}
});

describe('env add with mocked portal', () => {
  test('with --partner_portal_url', async () => {
    const environment = 'e1';
    const params = {
      partnerPortalUrl: "http://portal.example.com",
      url: "http://instance.example.com"
    };

    await addEnv(environment, params);
    const settings = settingsFromDotPos(environment);
    expect(settings['token']).toMatch('12345');
    expect(settings['partner_portal_url']).toMatch('http://portal.example.com');
  });
});
