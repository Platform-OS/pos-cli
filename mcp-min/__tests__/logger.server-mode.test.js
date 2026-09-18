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

// logger.Error is the CLI's single process-exit choke point, and the MCP server loads it
// in-process: a process.exit(1) there tears down every tool the server serves. In server mode it
// must throw instead, while the standalone CLI keeps the exit contract.
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

// stdout is the MCP JSON-RPC channel. `logger.Info`, `Success`, `Log`, `News` and `Print` all
// write there by default — a Partner Portal retry notice (lib/proxy.js) or a two-factor session
// message (lib/twoFactorSession.js) arrives mid-response and the client sees malformed JSON.
describe('server mode keeps stdout for the protocol', () => {
  const write = (stream) => vi.spyOn(process[stream], 'write').mockReturnValue(true);

  test.each(['Info', 'Success', 'Log', 'News'])('%s writes to stderr, not stdout', async (method) => {
    const stdout = write('stdout');
    const stderr = write('stderr');
    setServerMode(true);

    await logger[method]('a message');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr.mock.calls.map(([line]) => line).join('')).toContain('a message');
  });

  test('Print keeps its contract of writing raw text, on stderr', async () => {
    const stdout = write('stdout');
    const stderr = write('stderr');
    setServerMode(true);

    await logger.Print('raw');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith('raw');
  });

  // Outside the server this is a command-line tool: its output belongs on stdout, which the
  // backends reach through console.log (vitest intercepts that, so it is what to watch).
  test('the CLI still writes to stdout', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    setServerMode(false);

    await logger.Info('a message');

    expect(consoleLog.mock.calls.flat().join('')).toContain('a message');
  });
});
