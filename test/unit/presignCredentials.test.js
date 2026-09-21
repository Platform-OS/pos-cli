/**
 * Whose credentials the presign service is given. Reading `MARKETPLACE_*` off the process is fine
 * for a CLI that runs one deploy and exits, and not for a server whose asset upload runs in the
 * background while other calls set and restore those same variables. So both take the credentials
 * as an argument, with the environment as the fallback that keeps CLI callers unchanged.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { presignUrl, presignDirectory } from '#lib/presignUrl.js';

const PASSED = { url: 'https://passed-in.example.com', token: 'passed-in-token' };

let calls;
let filePath;
let tmpDir;

beforeEach(() => {
  calls = [];
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-presign-'));
  filePath = path.join(tmpDir, 'assets.zip');
  fs.writeFileSync(filePath, 'zip');

  vi.stubGlobal('fetch', async (url, options) => {
    calls.push({ url: String(url), headers: options.headers });
    return { ok: true, json: async () => ({ url: 'https://s3.example.com/put', accessUrl: 'https://cdn.example.com/a.zip' }) };
  });

  vi.stubEnv('MARKETPLACE_URL', 'https://from-the-environment.example.com');
  vi.stubEnv('MARKETPLACE_TOKEN', 'environment-token');
  vi.stubEnv('DEPLOY_SERVICE_URL', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('credentials passed to the presign service', () => {
  test('presignUrl asks the instance it was given, with the token it was given', async () => {
    await presignUrl('instances/1/assets/a.zip', filePath, PASSED);

    expect(calls[0].headers.token).toBe('passed-in-token');
    expect(calls[0].headers.marketplace_domain).toBe('passed-in.example.com');
    expect(calls[0].url).toContain('passed-in.example.com');
  });

  test('presignDirectory does the same', async () => {
    await presignDirectory('instances/1/assets', PASSED);

    expect(calls[0].headers.token).toBe('passed-in-token');
    expect(calls[0].headers.marketplace_domain).toBe('passed-in.example.com');
  });

  // The whole point: what the environment says at the moment of the call is not consulted, so
  // another call changing it mid-upload cannot reach this one.
  test('the environment is ignored when credentials were passed', async () => {
    await presignUrl('instances/1/assets/a.zip', filePath, PASSED);

    expect(calls[0].headers.token).not.toBe('environment-token');
    expect(calls[0].url).not.toContain('from-the-environment');
  });

  // Every CLI path supplies them this way and must keep working.
  test.each([
    ['presignUrl', () => presignUrl('instances/1/assets/a.zip', filePath)],
    ['presignDirectory', () => presignDirectory('instances/1/assets')]
  ])('%s still falls back to MARKETPLACE_* when it is given none', async (_label, call) => {
    await call();

    expect(calls[0].headers.token).toBe('environment-token');
    expect(calls[0].headers.marketplace_domain).toBe('from-the-environment.example.com');
  });

  // Credentials only decide where the request goes; an explicit deploy service still wins.
  test('DEPLOY_SERVICE_URL still overrides the instance the credentials name', async () => {
    vi.stubEnv('DEPLOY_SERVICE_URL', 'https://deploy-service.example.com/urls');

    await presignDirectory('instances/1/assets', PASSED);

    expect(calls[0].url).toContain('deploy-service.example.com');
    expect(calls[0].headers.token).toBe('passed-in-token');
  });
});
