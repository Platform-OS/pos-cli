/**
 * `pos-cli fetch-logs`, driven as a real process against a local instance stand-in.
 *
 * It is the non-interactive counterpart to `pos-cli logs` — it pages `/logs`, writes one JSON
 * object per line and exits — and it had no test at all. Spawned rather than imported because the
 * two defects this covers are both in the wiring commander does: the option name it camel-cases,
 * and which object the parsed flags land on.
 */
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'pos-cli-fetch-logs.js');

let server;
let origin;
let asked;
/** One page of rows, then nothing — the shape the paging loop ends on. */
let pages;
/** Set instead of `pages` when a test needs the answer to depend on the cursor. */
let serve = null;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    asked.push(req.url);
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.endsWith('/logs')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ instance: { id: 1, uuid: 'u' } }));
    }
    const rows = serve ? serve(url.searchParams.get('last_id')) : (pages.shift() ?? []);
    if (rows === undefined) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{}');
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ logs: rows }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => { serve = null; });
afterAll(() => new Promise(resolve => server.close(resolve)));

const run = (args, env = {}) => new Promise(resolve => {
  const child = spawn(process.execPath, [bin, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MPKIT_URL: origin, MPKIT_EMAIL: 'e@x', MPKIT_TOKEN: 'tok', ...env }
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  child.on('exit', code => resolve({ code, stdout, stderr }));
});

describe('pos-cli fetch-logs', () => {
  test('writes one JSON object per row and exits', async () => {
    asked = [];
    pages = [[{ id: '1790097411.216', message: 'first', error_type: 'Liquid error' },
              { id: '1790097411.999', message: 'second', error_type: 'probe' }]];

    const { code, stdout } = await run([]);

    expect(code).toBe(0);
    const lines = stdout.trim().split('\n').filter(Boolean).map(JSON.parse);
    expect(lines.map(r => r.message)).toEqual(['first', 'second']);
  });

  // It used to be read through `options['last-log-id']`, a key commander never sets because it
  // camel-cases option names. It worked by accident.
  test('--last-log-id is sent as the starting cursor', async () => {
    asked = [];
    pages = [[]];

    await run(['--last-log-id', '1790097411.216']);

    expect(asked.some(u => u.includes('last_id=1790097411.216'))).toBe(true);
  });

  // It used to start at `0`, which this API reads as *no cursor* and answers with the newest page
  // — measured 2026-09-25, 20 rows of an instance holding 35. A dump that stops after the tail is
  // not a dump. `1` is 1970-01-01T00:00:01Z, older than any row that can exist.
  test('without it the read starts at the oldest row kept, not the tail', async () => {
    asked = [];
    pages = [[]];

    await run([]);

    expect(asked.some(u => u.includes('last_id=1'))).toBe(true);
    expect(asked.some(u => /last_id=0(&|$)/.test(u))).toBe(false);
  });

  // The tail is still reachable, by asking for it.
  test('--last-log-id 0 still asks for the newest page', async () => {
    asked = [];
    pages = [[]];

    await run(['--last-log-id', '0']);

    expect(asked.some(u => /last_id=0(&|$)/.test(u))).toBe(true);
  });

  // The other defect: the catch read `program.quiet` off the imported commander program rather
  // than the parsed options, so it was always undefined and `-q` suppressed nothing.
  test('-q suppresses the error line; without it the error is reported', async () => {
    const unreachable = { MPKIT_URL: 'http://127.0.0.1:1' };

    const quiet = await run(['-q'], unreachable);
    const loud = await run([], unreachable);

    expect(quiet.code).toBe(2);
    expect(quiet.stderr.trim()).toBe('');
    expect(loud.code).toBe(2);
    expect(loud.stderr).toMatch(/^Error fetching logs: \S/m);
    // The message, not the Error object: printing the object dumps a stack trace at someone who
    // asked for logs.
    expect(loud.stderr).not.toMatch(/^\s+at /m);
  });

  // `!logs` guards a response that carries no logs at all; reading `.length` off it would throw
  // and turn an empty answer into "Error fetching logs".
  test('a response with no logs field ends the run cleanly', async () => {
    serve = () => undefined;

    const { code, stdout, stderr } = await run([]);

    expect(code).toBe(0);
    expect(stdout.trim()).toBe('');
    expect(stderr).not.toContain('Error fetching logs');
  });

  // These differ in the 17th significant digit, which a double cannot hold. Compared as numbers
  // the cursor never moves, and the rest of the log is silently skipped.
  test('two ids that a double cannot tell apart still advance the cursor', async () => {
    expect(Number('1790097411.2168736')).toBe(Number('1790097411.2168737'));
    asked = [];
    pages = [
      [{ id: '1790097411.2168736', message: 'first' }, { id: '1790097411.2168737', message: 'second' }],
      [{ id: '1790097499.5', message: 'third' }],
      []
    ];

    const { code, stdout } = await run([]);

    expect(code).toBe(0);
    expect(stdout.trim().split('\n').map(JSON.parse).map(r => r.message)).toEqual(['first', 'second', 'third']);
    expect(asked.some(u => u.includes('last_id=1790097411.2168737'))).toBe(true);
  });

  // A short fraction is numerically newer than a long one that shares its prefix, and
  // lexicographically older. Ordering these as strings would drop the row.
  test('a short fraction is ordered by value, not by prefix', async () => {
    asked = [];
    pages = [[{ id: '1790097411.7639065', message: 'first' }, { id: '1790097411.77', message: 'second' }], []];

    const { stdout } = await run([]);

    expect(stdout.trim().split('\n').map(JSON.parse).map(r => r.message)).toEqual(['first', 'second']);
    expect(asked.some(u => u.includes('last_id=1790097411.77'))).toBe(true);
  });

  // Rows arriving that are no newer than the cursor means paging cannot continue, so the output is
  // short — which used to be indistinguishable from reaching the end of the log.
  test('a fetch that stops early says so, and a complete one does not', async () => {
    asked = [];
    pages = [[{ id: '1790097411.216', message: 'only' }], [{ id: '1790097411.100', message: 'older' }]];
    const short = await run([]);

    asked = [];
    pages = [[{ id: '1790097411.216', message: 'only' }], []];
    const complete = await run([]);

    expect(short.code).toBe(0);
    expect(short.stderr).toContain('Stopped early');
    expect(complete.stderr).not.toContain('Stopped early');
  });

  // An inclusive `last_id` repeats the cursor row on the final page. Every row is already seen, so
  // the cursor cannot advance — warning there would call a complete fetch a short one.
  test('an inclusive last_id reaching the end is not reported as stopping early', async () => {
    const rows = [{ id: '1790097411.216', message: 'a' }, { id: '1790097411.999', message: 'b' }];
    serve = (cursor) => {
      // The default cursor is now `1`, which is older than every row: the whole list.
      const from = cursor === '1' ? 0 : rows.findIndex(r => r.id === cursor);
      return rows.slice(from === -1 ? rows.length : from);
    };

    const { code, stdout, stderr } = await run([]);

    expect(code).toBe(0);
    expect(stdout.trim().split('\n').map(JSON.parse).map(r => r.message)).toEqual(['a', 'b']);
    expect(stderr).not.toContain('Stopped early');
  });

  test('-q suppresses the early-stop warning too', async () => {
    asked = [];
    pages = [[{ id: '1790097411.216', message: 'only' }], [{ id: '1790097411.100', message: 'older' }]];

    const { stderr } = await run(['-q']);

    expect(stderr.trim()).toBe('');
  });

  // The stored token is sent to whatever host --endpoint names, so the operator is told.
  test('--endpoint reports where the token is being sent', async () => {
    asked = [];
    pages = [[]];

    const named = await run(['--endpoint', origin]);
    asked = [];
    pages = [[]];
    const plain = await run([]);

    expect(named.stderr).toContain(origin);
    expect(named.stderr).toMatch(/token/i);
    expect(plain.stderr).not.toMatch(/token/i);
  });

  test('--help says --endpoint sends the stored token', async () => {
    const { stdout } = await run(['--help']);

    expect(stdout).toMatch(/--endpoint/);
    expect(stdout).toMatch(/token/i);
  });
});
