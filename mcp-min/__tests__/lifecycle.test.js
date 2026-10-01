/**
 * The rules that decide when the MCP server process ends. Behaviour of a real process is in
 * cli-invocation.test.js; these pin the decisions themselves, including the orderings a
 * spawned process cannot be made to hit on demand.
 */
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { createShutdown, stdinEndEndsSession, SHUTDOWN_DEADLINE_MS } from '../lifecycle.js';

const silentLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe('stdinEndEndsSession', () => {
  // A pipe from an MCP client is a net.Socket, whatever is at the other end.
  const pipe = () => new net.Socket();
  const tty = () => Object.assign(new net.Socket(), { isTTY: true });

  let fileStream;
  afterEach(() => fileStream?.destroy());

  test('a client pipe ends the session even before any message: the client quit right after starting us', () => {
    expect(stdinEndEndsSession(pipe(), 0)).toBe(true);
    expect(stdinEndEndsSession(pipe(), 3)).toBe(true);
  });

  test('/dev/null or a file ends the session only after stdio was used', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-lifecycle-')), 'empty');
    fs.writeFileSync(file, '');
    fileStream = fs.createReadStream(file);

    expect(stdinEndEndsSession(fileStream, 0)).toBe(false);
    expect(stdinEndEndsSession(fileStream, 1)).toBe(true);
    expect(stdinEndEndsSession(new PassThrough(), 0)).toBe(false);
  });

  test('a terminal is not a client pipe, although it is a net.Socket', () => {
    expect(stdinEndEndsSession(tty(), 0)).toBe(false);
    expect(stdinEndEndsSession(tty(), 1)).toBe(true);
  });
});

describe('createShutdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('the default deadline covers deploy-start\'s background asset upload', () => {
    // lib/assets.js waitForUnpack polls up to 90 x 1 s after the upload itself.
    expect(SHUTDOWN_DEADLINE_MS).toBe(120_000);
  });

  test('begin runs every registered closer exactly once, however often it is called', () => {
    const shutdown = createShutdown({ exit: vi.fn(), logger: silentLogger() });
    const first = vi.fn();
    const second = vi.fn();
    shutdown.onShutdown(first);
    shutdown.onShutdown(second);

    expect(shutdown.started).toBe(false);
    expect(first).not.toHaveBeenCalled();

    expect(shutdown.begin('stdin closed')).toBe(true);
    expect(shutdown.begin('stdin closed again')).toBe(false);

    expect(shutdown.started).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  // The HTTP bind can complete after the client has already closed stdin; that listener must
  // be stopped, not left serving for nobody.
  test('a closer registered after shutdown began runs at once', () => {
    const shutdown = createShutdown({ exit: vi.fn(), logger: silentLogger() });
    shutdown.begin('stdin closed');

    const late = vi.fn();
    shutdown.onShutdown(late);

    expect(late).toHaveBeenCalledTimes(1);
  });

  test('a closer that throws or rejects is logged and does not stop the others', async () => {
    const logger = silentLogger();
    const shutdown = createShutdown({ exit: vi.fn(), logger });
    const after = vi.fn();
    shutdown.onShutdown(() => { throw new Error('sync boom'); });
    shutdown.onShutdown(() => Promise.reject(new Error('async boom')));
    shutdown.onShutdown(after);

    shutdown.begin('stdin closed');
    await new Promise(resolve => setImmediate(resolve));

    expect(after).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logger.error.mock.calls)).toContain('sync boom');
    expect(JSON.stringify(logger.error.mock.calls)).toContain('async boom');
  });

  test('exits 0 when the deadline passes, and not a moment before', () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    const logger = silentLogger();
    const shutdown = createShutdown({ deadlineMs: 5000, exit, logger });

    shutdown.begin('stdin closed');
    vi.advanceTimersByTime(4999);
    expect(exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test('no deadline is armed until shutdown begins', () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    createShutdown({ deadlineMs: 10, exit, logger: silentLogger() });

    vi.advanceTimersByTime(60_000);
    expect(exit).not.toHaveBeenCalled();
  });

  test('the reason and the deadline are logged when shutdown begins', () => {
    const logger = silentLogger();
    createShutdown({ deadlineMs: 120_000, exit: vi.fn(), logger }).begin('stdin closed by the MCP client');

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('stdin closed by the MCP client'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('120s'));
  });
});
