import { vi, describe, test, expect, beforeAll, afterEach } from 'vitest';

// The global test setup (test/vitest-setup.js) mocks #lib/logger.js to silence
// output. This file must exercise the REAL logger to verify server-mode
// behavior, so pull the actual implementation via importActual.
let logger;
let setServerMode;
let isServerMode;

beforeAll(async () => {
  const actual = await vi.importActual('../../lib/logger.js');
  logger = actual.default;
  setServerMode = actual.setServerMode;
  isServerMode = actual.isServerMode;
});

// Regression guard for the MCP-server crash: logger.Error is the single
// process-exit choke point in the CLI. Loaded in-process by the long-lived
// MCP server, a process.exit(1) there tears down the whole server and every
// tool it serves. In server mode Error must THROW (catchable per-request)
// instead; standalone CLI must keep the process.exit(1) contract.
describe('logger server-mode hardening', () => {
  afterEach(() => {
    setServerMode(false);
    vi.restoreAllMocks();
  });

  test('setServerMode toggles the flag', () => {
    setServerMode(false);
    expect(isServerMode()).toBe(false);
    setServerMode(true);
    expect(isServerMode()).toBe(true);
    setServerMode(false);
    expect(isServerMode()).toBe(false);
  });

  test('server mode: Error({exit:true}) throws and does NOT call process.exit', async () => {
    setServerMode(true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit must not be called in server mode');
    });

    await expect(
      logger.Error('boom in server mode', { notify: false })
    ).rejects.toThrow(/boom in server mode/);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('CLI mode: Error({exit:true}) still calls process.exit(1)', async () => {
    setServerMode(false);
    // Mock exit to a no-op so vitest itself survives; assert it was invoked.
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

    const ret = await logger.Error('cli fatal', { notify: false });

    expect(exitSpy).toHaveBeenCalledWith(1);
    // After the (mocked) exit, control falls through to `return false`.
    expect(ret).toBe(false);
  });

  test('exit:false: Error never throws and never exits, in either mode', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit must not be called for exit:false');
    });

    setServerMode(true);
    await expect(
      logger.Error('soft error', { exit: false, notify: false })
    ).resolves.toBe(false);

    setServerMode(false);
    await expect(
      logger.Error('soft error', { exit: false, notify: false })
    ).resolves.toBe(false);

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
