/**
 * Which requests are uploads, and the pieces that decide what happens to one.
 *
 * The predicate is the load-bearing part: it has to agree with `apiRequest`'s body-building, or a
 * request is given the ceiling meant for the other kind — an upload cut off at five minutes, or an
 * ordinary call left waiting twenty.
 */
import { describe, test, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  carriesAFile,
  hitTheCeiling,
  isRawBody,
  uploadDispatcher,
  UPLOAD_HEADERS_TIMEOUT_MS
} from '#lib/requestCeiling.js';

describe('carriesAFile', () => {
  // A presigned S3 POST: the caller builds the FormData itself, because the policy signed its
  // field order. `Object.values` over one of these yields nothing, so it has to be recognised by
  // its type or it reads as an ordinary request.
  test('a FormData the caller built is an upload', () => {
    const formData = new FormData();
    formData.append('key', 'assets/${filename}');
    formData.append('file', new Blob(['zip']), 'assets.zip');

    expect(carriesAFile({ formData })).toBe(true);
  });

  test('an empty FormData is still an upload, because it is still sent as one', () => {
    expect(carriesAFile({ formData: new FormData() })).toBe(true);
  });

  // A presigned PUT: the file's bytes are the body. No `path` to recognise it by either.
  test.each([
    ['a Buffer', Buffer.from('zip')],
    ['a Uint8Array', new Uint8Array([1, 2, 3])],
    ['an ArrayBuffer', new ArrayBuffer(8)]
  ])('%s body is an upload', (_label, body) => {
    expect(carriesAFile({ body })).toBe(true);
  });

  // The two values buildFormData turns into a file part.
  test('a form field naming a file on disk is an upload', () => {
    expect(carriesAFile({ formData: { marketplace_builder_file: { path: '/tmp/release.zip' } } })).toBe(true);
  });

  test('a form field holding bytes is an upload', () => {
    expect(carriesAFile({ formData: { file: Buffer.from('zip') } })).toBe(true);
  });

  test.each([
    ['a JSON body', { body: { query: '{ x }' } }],
    ['a form of plain strings', { formData: { name: 'staging', page: '2' } }],
    ['a GET with nothing to send', {}],
    ['no arguments at all', undefined]
  ])('%s is not an upload', (_label, request) => {
    expect(carriesAFile(request)).toBe(false);
  });

  // null is a legal value in a form pos-cli builds; reading `.path` off it would throw here rather
  // than where the request is made, which is the worst place to find out.
  test('a form holding null does not throw', () => {
    expect(carriesAFile({ formData: { maybe: null, name: 'x' } })).toBe(false);
  });
});

describe('isRawBody', () => {
  test.each([
    ['a Buffer', Buffer.from('x'), true],
    ['a Uint8Array', new Uint8Array(1), true],
    ['an ArrayBuffer', new ArrayBuffer(1), true],
    ['a string', 'x', false],
    ['a plain object', { a: 1 }, false],
    ['undefined', undefined, false]
  ])('%s', (_label, value, expected) => {
    expect(isRawBody(value)).toBe(expected);
  });
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const urlOf = (...parts) => pathToFileURL(path.join(repoRoot, ...parts)).href;

describe('the upload dispatcher', () => {
  // An Agent owns a connection pool. One per request would leave a pool behind for every upload in
  // the MCP server, which runs for days.
  test('is built once and reused', async () => {
    expect(await uploadDispatcher()).toBe(await uploadDispatcher());
  });

  // Two uploads starting together must not race to build two Agents and leak the loser's pool,
  // which is why the promise is what gets memoised rather than the Agent.
  test('is one Agent even when two uploads ask at the same time', async () => {
    const [first, second] = await Promise.all([uploadDispatcher(), uploadDispatcher()]);

    expect(first).toBe(second);
    expect(typeof first.dispatch).toBe('function');
  });

  /**
   * `apiRequest` is on the path of every command, and loading undici costs ~125ms measured, so
   * `pos-cli env list` must not pay it for a library only an upload uses.
   *
   * Spawned, because this is about what a fresh process loads, and the two answers together are
   * what make it meaningful: `afterUse` proves the check can see undici at all, so `afterImport`
   * being false is evidence rather than a broken probe passing vacuously.
   */
  test('does not load undici until a file is actually sent', () => {
    const probe = `
      const Module = require('module');
      const loaded = () => Object.keys(Module._cache).some(name => name.includes('undici'));
      import(${JSON.stringify(urlOf('lib', 'apiRequest.js'))}).then(async () => {
        const afterImport = loaded();
        const { uploadDispatcher } = await import(${JSON.stringify(urlOf('lib', 'requestCeiling.js'))});
        await uploadDispatcher();
        process.stdout.write(JSON.stringify({ afterImport, afterUse: loaded() }));
      });
    `;

    const { stdout, status, stderr } = spawnSync(process.execPath, ['-e', probe], { encoding: 'utf8' });

    expect(status, stderr).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ afterImport: false, afterUse: true });
  }, 30000);

  test('is built with the ceiling this module names', () => {
    expect(UPLOAD_HEADERS_TIMEOUT_MS).toBe(20 * 60 * 1000);
  });

  // `0` disables the timeout outright. Nothing else bounds a transfer, so a socket that died
  // mid-upload would hold a deploy for ever — the failure this must not trade itself for.
  test('never disables the timeout', () => {
    expect(UPLOAD_HEADERS_TIMEOUT_MS).toBeGreaterThan(0);
    expect(Number.isFinite(UPLOAD_HEADERS_TIMEOUT_MS)).toBe(true);
  });
});

describe('hitTheCeiling', () => {
  const wrap = (cause) => Object.assign(new TypeError('fetch failed'), { cause });

  test.each([
    ['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'],
    ['UND_ERR_BODY_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']
  ])('finds %s under the wrapper fetch throws', (_label, code) => {
    expect(hitTheCeiling(wrap(Object.assign(new Error('Headers Timeout Error'), { code })))).toBe(true);
  });

  // The depth varies between Node versions, which is why this walks rather than indexes.
  test('finds it several levels down', () => {
    const deep = wrap(wrap(wrap(Object.assign(new Error('t'), { code: 'UND_ERR_HEADERS_TIMEOUT' }))));

    expect(hitTheCeiling(deep)).toBe(true);
  });

  test.each([
    ['a refused connection', 'ECONNREFUSED'],
    ['a name that did not resolve', 'ENOTFOUND'],
    ['a reset', 'ECONNRESET']
  ])('%s is not a ceiling', (_label, code) => {
    expect(hitTheCeiling(wrap(Object.assign(new Error('x'), { code })))).toBe(false);
  });

  test.each([
    ['nothing', undefined],
    ['null', null],
    ['an error with no cause and no code', new Error('plain')]
  ])('%s is not a ceiling', (_label, error) => {
    expect(hitTheCeiling(error)).toBe(false);
  });

  // A cause chain that points at itself must not take the process down with it.
  test('a cycle in the cause chain terminates', () => {
    const looping = new Error('round');
    looping.cause = looping;

    expect(hitTheCeiling(looping)).toBe(false);
  });
});
