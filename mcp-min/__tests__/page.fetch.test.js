/**
 * `page-fetch`, and the one rule it has to keep: the host is the resolved credentials' host and
 * nothing a caller passes can move it.
 *
 * It exists because the admin GraphQL API cannot answer "is it live?". `admin_pages { content }`
 * proves the source reached the instance; routing, the layout, the authorization policies and every
 * partial the page renders sit between that and a URL a visitor opens. An evaluation of this server
 * had to leave the server to check a deploy.
 *
 * It is also the first tool here that makes an arbitrary HTTP request, so most of what follows is
 * about what it refuses.
 */
import { describe, test, expect } from 'vitest';
import { runTool } from '../run-tool.js';
import { rejectionFor } from '../validate-params.js';
import tool, { MAX_BODY_BYTES } from '../page/fetch.js';

const AUTH = { url: 'https://staging.example.com', email: 'e@example.com', token: 'tok' };

/** Records what was asked for, and answers what the case under test wants. */
const instance = ({ status = 200, headers = { 'content-type': 'text/html; charset=utf-8' }, body = '<h1>ok</h1>' } = {}) => {
  const asked = [];
  const fetch = async (url, options) => {
    asked.push({ url, options });
    // A Buffer body, not a string: `new Response('x')` is given `text/plain` by undici, so a case
    // about a response with no content-type cannot be written with one.
    return new Response(Buffer.from(body), { status, headers });
  };
  return { fetch, asked };
};

const call = (params, seam) => runTool(tool, { ...AUTH, ...params }, seam);

/** What a client does: validate against the published schema, then call. */
const validate = (params) => rejectionFor('page-fetch', tool, { ...AUTH, ...params });

describe('the host comes from the credentials and nowhere else', () => {
  test('the path is joined to the resolved instance', async () => {
    const { fetch, asked } = instance();

    const { data } = await call({ path: '/eval-page' }, { fetch });

    expect(asked[0].url).toBe('https://staging.example.com/eval-page');
    expect(data.url).toBe('https://staging.example.com/eval-page');
  });

  /**
   * The schema stops the obvious ones. `//elsewhere` is the one that reads as a path and is not:
   * `new URL('//evil.example.com/x', 'https://staging.example.com')` is another origin entirely.
   */
  test.each([
    ['an absolute URL', 'https://evil.example.com/x'],
    ['a protocol-relative host', '//evil.example.com/x'],
    ['a scheme with no slashes', 'javascript:alert(1)'],
    ['a bare relative path', 'eval-page'],
    ['an empty path', '']
  ])('the schema refuses %s', (_label, path) => {
    expect(validate({ path })).not.toBeNull();
  });

  test('a path that is only a slash is allowed: it is the instance root', () => {
    expect(validate({ path: '/' })).toBeNull();
  });

  /**
   * The check the pattern cannot make, and the one that actually holds the rule: whatever the path
   * resolved to, the origin has to be the instance's. Belt to the schema's braces, and the same
   * comparison `authForJob` makes before it will poll a job.
   */
  test('a path that resolves off the instance is refused before any request', async () => {
    const { fetch, asked } = instance();

    const result = await runTool(tool, { ...AUTH, path: '//evil.example.com/x' }, { fetch });

    expect(result.error).toMatchObject({ kind: 'input', code: 'PATH_NOT_ON_INSTANCE' });
    expect(result.error.message).toContain('evil.example.com');
    expect(asked).toEqual([]);
  });

  // A `.pos` url with a trailing slash or a path on it is ordinary; the origin is what counts.
  test('the instance url is reduced to its origin', async () => {
    const { fetch, asked } = instance();

    await call({ path: '/a' }, { fetch, settings: {}, files: {} });
    await runTool(tool, { ...AUTH, url: 'https://staging.example.com/sub/dir/', path: '/a' }, { fetch });

    expect(asked.map(a => a.url)).toEqual(['https://staging.example.com/a', 'https://staging.example.com/a']);
  });
});

describe('what it sends', () => {
  // A page that only renders for a holder of the instance API token is not a page that is live.
  // It also means a redirect, reported rather than followed, cannot carry a credential anywhere.
  test('no credentials, under any header', async () => {
    const { fetch, asked } = instance();

    await call({ path: '/eval-page' }, { fetch });

    const headers = asked[0].options?.headers;
    expect(headers === undefined || Object.keys(headers).length === 0).toBe(true);
    expect(JSON.stringify(asked[0])).not.toContain('tok');
  });

  test('it does not follow a redirect', async () => {
    const { fetch, asked } = instance();

    await call({ path: '/a' }, { fetch });

    expect(asked[0].options.redirect).toBe('manual');
  });

  // Asserting that the request was never made, not just that the call came back cancelled: the
  // catch below the fetch reports a cancellation too, so a test that only checked the kind passed
  // whether or not anything had already been asked of the instance.
  test('a client that has already cancelled gets no request made for it', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetch, asked } = instance();

    const result = await runTool(tool, { ...AUTH, path: '/a' }, { fetch, signal: controller.signal });

    expect(result.error.kind).toBe('cancelled');
    expect(asked).toEqual([]);
  });

  // And one that cancels while the request is in flight is still a cancellation, not the transport
  // failure the abort looks like from underneath.
  test('a cancellation during the request is reported as one', async () => {
    const controller = new AbortController();
    const fetch = async () => { controller.abort(); throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }); };

    const result = await runTool(tool, { ...AUTH, path: '/a' }, { fetch, signal: controller.signal });

    expect(result.error.kind).toBe('cancelled');
  });
});

describe('what it reports', () => {
  test('the status, the body and the headers worth reading', async () => {
    const { fetch } = instance({ headers: { 'content-type': 'text/html', 'cache-control': 'max-age=0', 'set-cookie': 'a=b' }, body: '<h1>MARKER</h1>' });

    const { data } = await call({ path: '/eval-page' }, { fetch });

    expect(data).toMatchObject({ status: 200, body: '<h1>MARKER</h1>', truncated: false, contentBytes: 15 });
    expect(data.headers).toEqual({ 'content-type': 'text/html', 'cache-control': 'max-age=0' });
  });

  // A 404 is an answer about the deploy, not a failure of the call: the agent asked whether the
  // page is live and it is not.
  test('a 404 is a successful call reporting a page that is not there', async () => {
    const { fetch } = instance({ status: 404, body: 'not found' });

    const result = await call({ path: '/missing' }, { fetch });

    expect(result.ok).toBe(true);
    expect(result.data.status).toBe(404);
  });

  test('a redirect is reported with where it points, not chased', async () => {
    const { fetch } = instance({ status: 301, headers: { location: 'https://elsewhere.example.com/' } });

    const { data } = await call({ path: '/old' }, { fetch });

    expect(data).toMatchObject({ status: 301, redirected: true });
    expect(data.headers.location).toBe('https://elsewhere.example.com/');
  });

  test('a 200 is not reported as a redirect', async () => {
    const { fetch } = instance();

    const { data } = await call({ path: '/a' }, { fetch });

    expect(data.redirected).toBe(false);
  });
});

describe('what comes back is bounded', () => {
  test('a body over the ceiling is cut, and says so with its real size', async () => {
    const body = 'x'.repeat(MAX_BODY_BYTES * 2);
    const { fetch } = instance({ body });

    const { data } = await call({ path: '/big' }, { fetch });

    expect(data.truncated).toBe(true);
    expect(Buffer.byteLength(data.body)).toBe(MAX_BODY_BYTES);
    expect(data.contentBytes).toBe(MAX_BODY_BYTES * 2);
  });

  // Cut by bytes, so the ceiling means what it says on a page that is not ASCII — and cut on a
  // character boundary, so what comes back is still a string a model can read.
  test('a multi-byte page is cut by bytes without splitting a character', async () => {
    const { fetch } = instance({ body: '€'.repeat(MAX_BODY_BYTES) });

    const { data } = await call({ path: '/utf8' }, { fetch });

    expect(Buffer.byteLength(data.body)).toBeLessThanOrEqual(MAX_BODY_BYTES);
    // The naive slice emitted a replacement character for the one it cut — three bytes where one
    // was dropped, so the "bounded" body came back corrupt and over the ceiling it enforced.
    expect(data.body).not.toContain('�');
  });

  // An image or a zip is megabytes of noise to a model, and says nothing a status and a size do not.
  test.each([
    ['an image', 'image/png'],
    ['a font', 'font/woff2'],
    ['an archive', 'application/zip'],
    ['no content-type at all', undefined]
  ])('%s is described rather than returned', async (_label, contentType) => {
    const { fetch } = instance({ headers: contentType ? { 'content-type': contentType } : {}, body: 'BINARY' });

    const { data } = await call({ path: '/a.png' }, { fetch });

    expect(data.body).toBeUndefined();
    expect(data.bodyOmitted).toContain(contentType ?? 'no content-type');
    expect(data.contentBytes).toBe(6);
  });

  test.each([
    ['html', 'text/html; charset=utf-8'],
    ['json', 'application/json'],
    ['a json suffix type', 'application/problem+json'],
    ['plain text', 'text/plain']
  ])('%s is returned', async (_label, contentType) => {
    const { fetch } = instance({ headers: { 'content-type': contentType }, body: 'CONTENT' });

    const { data } = await call({ path: '/a' }, { fetch });

    expect(data.body).toBe('CONTENT');
  });
});

describe('an instance that did not answer', () => {
  // Routed through `classify`, so the host is named and a DNS failure reads differently from a
  // refused connection (TASK-40).
  test('is a connection failure naming the instance, not an internal error', async () => {
    const fetch = async () => { throw Object.assign(new Error('fetch failed'), { cause: Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }) }); };

    const result = await runTool(tool, { ...AUTH, path: '/a' }, { fetch });

    expect(result.error).toMatchObject({ kind: 'unavailable', code: 'ECONNREFUSED' });
    expect(result.error.details.host).toBe('https://staging.example.com');
  });
});

/**
 * MCP reads a missing `readOnlyHint` as "may change things", which is the honest answer here: a GET
 * on a platformOS page runs that page's Liquid, and this tool cannot know what it does. Claiming
 * read-only would let a client run it unprompted on the strength of a promise nothing can keep.
 */
describe('its annotations', () => {
  test('it does not claim to be read-only', () => {
    expect(tool.annotations?.readOnlyHint).toBeUndefined();
  });
});
