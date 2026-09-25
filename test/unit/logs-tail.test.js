/**
 * `pos-cli logs`, driven as a real process against a local instance stand-in.
 *
 * It had no test at all. Spawned rather than imported because the bin builds its stream, its
 * storage and its commander wiring at module scope, and because the defect these cover is in how
 * far the command *reads*, which is only observable from the requests it makes.
 */
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'pos-cli-logs.js');

let server;
let origin;
let asked;
/** Answers each poll from the cursor it was given. */
let serve = null;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.endsWith('/logs')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ instance: { id: 1, uuid: 'u' } }));
    }
    const cursor = url.searchParams.get('last_id');
    asked.push(cursor);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ logs: serve(cursor, asked.length - 1) }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => { serve = null; });
afterAll(() => new Promise(resolve => server.close(resolve)));

/**
 * Runs the tail until `until` is satisfied, then stops it: it polls for ever by design.
 *
 * Driven by the condition rather than by a fixed span. These files run in parallel, each in its
 * own process, so a wall-clock window that is generous on an idle machine is not one under load —
 * which is how this suite passed alone and failed beside the others.
 */
const tail = (args, until, capMs = 20000) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [bin, '-i', '60', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MPKIT_URL: origin, MPKIT_EMAIL: 'e@x', MPKIT_TOKEN: 'tok', CI: '1', NO_COLOR: '1' }
  });
  let stdout = '', stderr = '', settled = false;
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });

  const stop = (fail) => {
    if (settled) return;
    settled = true;
    clearInterval(poll);
    clearTimeout(cap);
    child.kill('SIGKILL');
    if (fail) reject(new Error(`${fail}\nasked: ${JSON.stringify(asked)}\nstdout: ${stdout}\nstderr: ${stderr}`));
    else resolve({ stdout, stderr, out: stdout + stderr });
  };

  const poll = setInterval(() => { if (until({ stdout, stderr, asked })) stop(); }, 20);
  const cap = setTimeout(() => stop('the tail never reached the state this test waits for'), capMs);
  child.on('error', () => stop('the tail could not be spawned'));
});

/** It has polled at least `n` times. */
const polls = (n) => ({ asked: a }) => a.length >= n;

const BASE = 1790200000;

/**
 * Five rows newer than the cursor it was given — `row 0` upwards, id `BASE + n`.
 *
 * Keyed on the cursor, not on how many times it has been asked: a poller that never advances must
 * keep receiving the same rows, or a test cannot tell "it read on" from "it asked again". The
 * command polls on an interval without waiting for the previous response, so two polls in flight
 * together really do carry the same cursor, and this answers them the way an instance would.
 */
const rowsAfter = (type) => (cursor) => {
  const next = cursor === '0' ? 0 : Number(cursor.split('.')[0]) - BASE + 1;
  return Array.from({ length: 5 }, (_v, i) => ({
    id: `${BASE + next + i}.5`,
    error_type: type,
    message: `row ${next + i}`,
    created_at: '2026-09-23T00:00:00'
  }));
};

describe('how far the tail reads', () => {
  /**
   * The defect. `--filter` decided both what was printed *and* how far the stream had read,
   * because only a row that survived the filter advanced the cursor. A run whose filter matched
   * nothing therefore re-read one page for ever, and `last_id=0` is a sliding window of the newest
   * rows — so anything that scrolled out of it between polls was never examined.
   */
  test('a filter that matches nothing still advances the cursor', async () => {
    asked = [];
    serve = rowsAfter('info');

    await tail(['--filter', 'error'], polls(4));

    // The cursor moved. Not "every cursor is distinct": the poller fires on an interval without
    // waiting for the previous response, so two polls in flight together carry the same one —
    // harmless, since a row already read is dropped by `seen`.
    expect(asked[0]).toBe('0');
    expect(new Set(asked).size).toBeGreaterThan(1);
    expect(asked[asked.length - 1]).not.toBe('0');
  });

  test('without a filter it advances too, and prints what it read', async () => {
    asked = [];
    serve = rowsAfter('info');

    const { out } = await tail([], ({ stdout: o }) => o.includes('row 5'));

    expect(new Set(asked).size).toBeGreaterThan(1);
    expect(out).toContain('row 0');
  });

  /**
   * The cursor is the newest row read, not the last one iterated. They differ only when a page
   * does not arrive in ascending order — and a cursor set from the last row would then point
   * *behind* rows already read, which on a stream that only ever polls forward never recovers.
   */
  test('a page out of order leaves the cursor at its newest row', async () => {
    asked = [];
    serve = (cursor) => (cursor === '0'
      ? [
        { id: `${BASE + 9}.5`, error_type: 'info', message: 'newest', created_at: '2026-09-23T00:00:00' },
        { id: `${BASE + 1}.5`, error_type: 'info', message: 'oldest', created_at: '2026-09-23T00:00:00' }
      ]
      : []);

    await tail([], ({ asked: a }) => a.some(c => c !== '0'));

    const advanced = asked.filter(c => c !== '0');
    expect(advanced[0]).toBe(`${BASE + 9}.5`);
  });

  // Rows already handled must not be printed twice, however often the instance repeats them.
  test('a page that repeats rows already read is not printed again', async () => {
    asked = [];
    serve = () => [{ id: '1790200001.5', error_type: 'info', message: 'only', created_at: '2026-09-23T00:00:00' }];

    const { out } = await tail([], polls(4));

    expect(asked.length).toBeGreaterThan(2);
    expect(out.split('only').length - 1).toBe(1);
  });
});

describe('what it prints', () => {
  test('a filter keeps the matching rows and drops the rest', async () => {
    asked = [];
    serve = (cursor) => {
      const n = cursor === '0' ? 0 : Number(cursor.split('.')[0]) - BASE + 1;
      return [
        { id: `${BASE + n}.5`, error_type: 'error', message: `kept ${n}`, created_at: '2026-09-23T00:00:00' },
        { id: `${BASE + n + 1}.5`, error_type: 'info', message: `dropped ${n}`, created_at: '2026-09-23T00:00:00' }
      ];
    };

    const { out } = await tail(['--filter', 'error'], ({ stderr: e }) => e.includes('kept 2'));

    expect(out).toContain('kept 0');
    expect(out).not.toContain('dropped');
  });

  /**
   * The structured Liquid diagnostic is the compiler-style location of a failure, and it used to
   * print only for rows that were *not* errors — the branch an error row could never reach anyway,
   * since `isError` was handed the message string rather than the row's type.
   */
  test('an error row prints its diagnostic', async () => {
    asked = [];
    serve = () => [{
      id: '1790200001.5',
      error_type: 'Liquid error',
      message: 'undefined filter',
      created_at: '2026-09-23T00:00:00',
      data: { schema_version: 1, type: 'Liquid::UndefinedFilter', message: 'undefined filter nosuch', stack: [{ path: 'app/views/pages/x.liquid', line: 7 }] }
    }];

    const { stdout, stderr } = await tail([], ({ stderr: e }) => e.includes('x.liquid:7'));

    // An error row prints through logger.Error, which is red and goes to stderr; an ordinary row
    // goes to stdout. That is the distinction `isError` exists to make, and it was reading the
    // message string rather than the row's type, so no row ever took this path.
    expect(stderr).toContain('Liquid error: undefined filter');
    expect(stdout).not.toContain('Liquid error: undefined filter');

    // The detail block follows its line onto the same stream rather than being split across two.
    expect(stderr).toContain('app/views/pages/x.liquid:7');
    expect(stderr).toContain('Liquid::UndefinedFilter');
    expect(stderr.indexOf('undefined filter')).toBeLessThan(stderr.indexOf('app/views/pages/x.liquid:7'));
  });

  test('an ordinary row stays on stdout', async () => {
    asked = [];
    serve = rowsAfter('info');

    const { stdout, stderr } = await tail([], ({ stdout: o }) => o.includes('row 0'));

    expect(stdout).toContain('row 0');
    expect(stderr).not.toContain('row 0');
  });

  test('-q leaves the diagnostic out', async () => {
    asked = [];
    serve = () => [{
      id: '1790200001.5',
      error_type: 'Liquid error',
      message: 'undefined filter',
      created_at: '2026-09-23T00:00:00',
      data: { schema_version: 1, type: 'Liquid::UndefinedFilter', message: 'm', stack: [{ path: 'app/views/pages/x.liquid', line: 7 }] }
    }];

    const { out } = await tail(['-q'], ({ stderr: e }) => e.includes('undefined filter'));

    expect(out).toContain('undefined filter');
    expect(out).not.toContain('app/views/pages/x.liquid:7');
  });
});
