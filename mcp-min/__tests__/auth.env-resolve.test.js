import fs from 'fs';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { fetchSettings } from '../../lib/settings.js';
import { resolveAuth } from '../auth.js';

// Regression guard for the "env not found kills the MCP server" crash.
//
// The server resolves auth via resolveAuth -> fetchSettings. Historically
// fetchSettings did process.exit(1) on an unknown environment, which killed
// the whole in-process server before auth.js could throw its catchable error.
// The fix: fetchSettings(env, { exit:false }) returns null so resolveAuth can
// throw a normal Error the per-request handler turns into an MCP error.
const CONFIG_FILE = path.resolve(`.pos.test-auth-resolve`);

describe('env resolution never exits the process', () => {
  beforeAll(() => {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ staging: { url: 'https://staging.example.com', email: 'e@x', token: 't' } }, null, 2)
    );
    process.env.CONFIG_FILE_PATH = CONFIG_FILE;
  });

  afterAll(() => {
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
    delete process.env.CONFIG_FILE_PATH;
  });

  beforeEach(() => {
    // MPKIT_* would short-circuit settingsFromEnv(); keep resolution on .pos.
    delete process.env.MPKIT_URL;
    delete process.env.MPKIT_EMAIL;
    delete process.env.MPKIT_TOKEN;
  });

  test('fetchSettings(unknown, {exit:false}) returns null instead of exiting', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit must not be called with {exit:false}');
    });

    const found = await fetchSettings('does-not-exist', { exit: false });
    expect(found).toBeNull();
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  test('fetchSettings(known, {exit:false}) returns the settings', async () => {
    const found = await fetchSettings('staging', { exit: false });
    expect(found).toMatchObject({ url: 'https://staging.example.com' });
  });

  test('resolveAuth throws a catchable error for an unknown env (no exit)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit must not be called from resolveAuth');
    });

    await expect(resolveAuth({ env: 'ps' })).rejects.toThrow(/Environment 'ps' not found/);
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  test('resolveAuth resolves a known env from .pos', async () => {
    const auth = await resolveAuth({ env: 'staging' });
    expect(auth).toMatchObject({ url: 'https://staging.example.com', source: '.pos(staging)' });
  });

  test('explicit url/email/token params bypass .pos resolution', async () => {
    const auth = await resolveAuth({ url: 'https://direct', email: 'e@x', token: 'tok' });
    expect(auth).toMatchObject({ url: 'https://direct', source: 'params' });
  });
});
