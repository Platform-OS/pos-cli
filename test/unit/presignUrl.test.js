/**
 * Signing a URL is a small JSON call to the deploy service or the Partner Portal. It used
 * to be made with a bare fetch, which meant it had no deadline -- five minutes of undici
 * default before a stalled one was reported -- and that its failures arrived shaped
 * differently from every other HTTP failure pos-cli makes, so ServerError could not
 * explain them and the body the service sent was discarded unread.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn(), Success: vi.fn() }
}));

global.fetch = vi.fn();

const PORTAL_URL = 'https://partners.platformos.com';

const answer = (body) => ({
  ok: true,
  status: 200,
  text: vi.fn().mockResolvedValue(JSON.stringify(body))
});

const refusal = (status, body = '') => ({
  ok: false,
  status,
  headers: new Headers(),
  text: vi.fn().mockResolvedValue(body)
});

describe('presignUrlForPortal', () => {
  let presignUrlForPortal;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch.mockReset();
    process.env.PARTNER_PORTAL_HOST = PORTAL_URL;

    ({ presignUrlForPortal } = await import('#lib/presignUrl.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.PARTNER_PORTAL_HOST;
  });

  test('returns the signed pair the portal answered with', async () => {
    global.fetch.mockResolvedValue(answer({
      upload_url: 'https://s3.example.com/upload?signature=abc',
      access_url: 'https://s3.example.com/release.zip'
    }));

    await expect(presignUrlForPortal('jwt-token', 150, 'release.zip')).resolves.toEqual({
      uploadUrl: 'https://s3.example.com/upload?signature=abc',
      accessUrl: 'https://s3.example.com/release.zip'
    });
  });

  // The portal and the deploy service are what ServerError's messages are written about,
  // so their refusals belong in the shape it reads: `StatusCodeError` picks the branch,
  // and the body travels with it instead of being dropped on the floor.
  test('fails in the shape ServerError knows how to explain', async () => {
    global.fetch.mockResolvedValue(refusal(504, '<html>504 Gateway Time-out</html>'));

    const error = await presignUrlForPortal('jwt-token', 150, 'release.zip').catch((e) => e);

    expect(error.name).toBe('StatusCodeError');
    expect(error.statusCode).toBe(504);
    expect(error.response.body).toContain('Gateway Time-out');
  });

  test('gives up on a signing call that never answers', async () => {
    vi.useFakeTimers();
    global.fetch.mockImplementation((_uri, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('This operation was aborted')));
    }));

    const failure = presignUrlForPortal('jwt-token', 150, 'release.zip').catch((e) => e);

    await vi.advanceTimersByTimeAsync(30000);
    const error = await failure;

    expect(error.name).toBe('RequestError');
    expect(error.code).toBe('ETIMEDOUT');
  });
});

describe('presignDirectory', () => {
  let presignDirectory, isDirectUploadUnavailable;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch.mockReset();
    process.env.MARKETPLACE_URL = 'https://instance.example.com';
    process.env.MARKETPLACE_TOKEN = 'instance-token';

    ({ presignDirectory, isDirectUploadUnavailable } = await import('#lib/presignUrl.js'));
  });

  afterEach(() => {
    delete process.env.MARKETPLACE_URL;
    delete process.env.MARKETPLACE_TOKEN;
  });

  // An instance with no object storage configured says 501, and deploy reads that to send
  // assets inside the release archive instead. The status has to survive the new error
  // shape, or every such deploy fails instead of falling back.
  test('still identifies an instance that cannot presign at all', async () => {
    global.fetch.mockResolvedValue(refusal(501));

    const error = await presignDirectory('instances/1/assets').catch((e) => e);

    expect(isDirectUploadUnavailable(error)).toBe(true);
  });

  test('does not mistake any other refusal for that one', async () => {
    global.fetch.mockResolvedValue(refusal(403));

    const error = await presignDirectory('instances/1/assets').catch((e) => e);

    expect(isDirectUploadUnavailable(error)).toBe(false);
    expect(error.statusCode).toBe(403);
  });
});
