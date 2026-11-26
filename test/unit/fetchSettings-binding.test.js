import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn(), Success: vi.fn() }
}));

vi.mock('#lib/files.js', () => ({ default: { readJSON: vi.fn(), getConfig: vi.fn() } }));

vi.mock('#lib/globalBinding.js', () => ({ bindToInstance: vi.fn(async settings => settings) }));

import { fetchSettings } from '#lib/settings.js';
import { bindToInstance } from '#lib/globalBinding.js';
import files from '#lib/files.js';
import logger from '#lib/logger.js';

// fetchSettings is where every CLI command gets its credentials, so it is where a global token
// is traded for one bound to the instance -- with the command's --otp-code, for a token that
// needs a two-factor session to be bound.
describe('fetchSettings binds what it resolves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MPKIT_URL', undefined);
    vi.stubEnv('MPKIT_EMAIL', undefined);
    vi.stubEnv('MPKIT_TOKEN', undefined);
    files.getConfig.mockReturnValue({ staging: { url: 'https://staging.example.com', token: 'posg_root' } });
  });
  afterEach(() => vi.unstubAllEnvs());

  test('a .pos environment, keeping its bound token where the environment is', async () => {
    bindToInstance.mockResolvedValueOnce({ url: 'https://staging.example.com', token: 'posg_bound', bound: true });

    expect(await fetchSettings('staging')).toMatchObject({ token: 'posg_bound' });
    expect(bindToInstance).toHaveBeenCalledWith(expect.objectContaining({ token: 'posg_root' }), 'staging', { otpCode: undefined });
  });

  // MPKIT_* has no .pos entry to keep a bound token on: null tells bindToInstance to keep it in memory.
  test('MPKIT_*, naming no environment to keep the bound token on', async () => {
    vi.stubEnv('MPKIT_URL', 'https://ci.example.com');
    vi.stubEnv('MPKIT_EMAIL', 'a@b.c');
    vi.stubEnv('MPKIT_TOKEN', 'posg_root');

    await fetchSettings('staging');

    expect(bindToInstance).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://ci.example.com' }), null, { otpCode: undefined });
  });

  test.each([
    ['a commander program', { opts: () => ({ otpCode: '123456' }) }],
    ['plain options', { otpCode: '123456' }]
  ])('passes --otp-code from %s', async (_, options) => {
    await fetchSettings('staging', options);

    expect(bindToInstance).toHaveBeenCalledWith(expect.anything(), 'staging', { otpCode: '123456' });
  });

  test('a bind that fails ends the command with its message', async () => {
    bindToInstance.mockRejectedValueOnce(new Error('The global token was refused by https://portal.example.com.'));
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exited'); });

    await expect(fetchSettings('staging')).rejects.toThrow('exited');

    expect(logger.Error).toHaveBeenCalledWith('The global token was refused by https://portal.example.com.');
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
  });

  // The MCP server and other long-lived callers turn it into an error of their own.
  test('a bind that fails is thrown to a caller that asked not to exit', async () => {
    bindToInstance.mockRejectedValueOnce(new Error('refused'));
    const exit = vi.spyOn(process, 'exit');

    await expect(fetchSettings('staging', { exit: false })).rejects.toThrow('refused');
    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
  });
});
