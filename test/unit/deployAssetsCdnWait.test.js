/**
 * After the asset archive is uploaded, deployAssets polls the CDN until the platform has
 * unpacked it (and deleted it), and only then sends the manifest.
 *
 * A single check that got no answer — a connection the CDN dropped — used to be passed to
 * logger.Error with its default `exit: true`, which ended the whole deploy with nothing but
 * `"fetch failed"` after the release had already been applied. Such a check is now retried
 * at the same pace; only several in a row stop the deploy, with the CDN and the cause named,
 * and never by going on to send the manifest.
 */
import http from 'http';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const { ProcessExit } = vi.hoisted(() => ({
  // What logger.Error does by default is process.exit(1). Modelled as a throw, so a test
  // cannot pass because code after an "exit" went on running.
  ProcessExit: class ProcessExit extends Error {}
}));

vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Info: vi.fn(),
    Success: vi.fn(),
    Error: vi.fn(async (message, opts) => {
      if (opts?.exit ?? true) throw new ProcessExit(String(message));
    })
  }
}));
vi.mock('#lib/logger/report.js', () => ({ default: vi.fn() }));
vi.mock('#lib/assets/packAssets.js', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('#lib/assets/manifest.js', () => ({ manifestGenerate: vi.fn() }));
vi.mock('#lib/s3UploadFile.js', () => ({ uploadFile: vi.fn().mockResolvedValue(undefined) }));
vi.mock('#lib/files.js', () => ({ default: { writeJSON: vi.fn() } }));
vi.mock('#lib/presignUrl.js', async () => ({
  ...(await vi.importActual('#lib/presignUrl.js')),
  presignUrl: vi.fn()
}));

import logger from '#lib/logger.js';
import files from '#lib/files.js';
import { manifestGenerate } from '#lib/assets/manifest.js';
import { presignUrl } from '#lib/presignUrl.js';
import { deployAssets } from '#lib/assets.js';

const CDN = 'https://cdn.example.test';
const ACCESS_URL = `${CDN}/instances/470/assets/1789000000000.assets_deploy.zip`;
const MANIFEST = { 'app.css': { physical_file_path: 'app/assets/app.css', updated_at: 1 } };
const RELEASE_ID = 4242;

// The shapes Node 22 and 25 fetch() actually rejects with, captured from real failures.
const withCause = cause => new TypeError('fetch failed', { cause });
const socketClosed = () =>
  withCause(Object.assign(new Error('other side closed'), { name: 'SocketError', code: 'UND_ERR_SOCKET' }));
const refused = () =>
  withCause(Object.assign(new Error('connect ECONNREFUSED 104.21.18.43:443'), { code: 'ECONNREFUSED' }));
const dualStackRefused = () =>
  withCause(Object.assign(
    new AggregateError([
      Object.assign(new Error('connect ECONNREFUSED ::1:443'), { code: 'ECONNREFUSED' }),
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' })
    ], ''),
    { code: 'ECONNREFUSED' }
  ));
const notFound = () =>
  withCause(Object.assign(new Error('getaddrinfo ENOTFOUND cdn.example.test'), { code: 'ENOTFOUND' }));

const failureMessage = reason =>
  `Deploy assets failed: The CDN at ${CDN} did not answer 3 checks in a row; the last one failed with: ${reason}. ` +
  'It is not known whether the uploaded assets were unpacked, so the asset manifest was not sent. Run the deploy again.';

/** Scripts the CDN: a number is an HTTP status, an Error is a request that got no answer. */
function cdnAnswers(...answers) {
  const fetchMock = vi.fn();
  for (const answer of answers) {
    if (answer instanceof Error) fetchMock.mockRejectedValueOnce(answer);
    else fetchMock.mockResolvedValueOnce({ ok: answer >= 200 && answer < 300, status: answer });
  }
  fetchMock.mockImplementation(() => {
    throw new Error('test: the CDN was checked more times than scripted');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function startDeploy() {
  const gateway = {
    getInstance: vi.fn().mockResolvedValue({ id: 470 }),
    sendManifest: vi.fn().mockResolvedValue({ ok: true })
  };
  const outcome = deployAssets(gateway, { releaseId: RELEASE_ID }).then(value => ({ value }), error => ({ error }));
  return { gateway, outcome };
}

async function deploy() {
  const { gateway, outcome } = startDeploy();
  await vi.runAllTimersAsync();
  return { gateway, ...(await outcome) };
}

function expectManifestSent(result) {
  expect(result.error).toBeUndefined();
  expect(logger.Error).not.toHaveBeenCalled();
  expect(result.gateway.sendManifest).toHaveBeenCalledTimes(1);
  expect(result.gateway.sendManifest).toHaveBeenCalledWith(MANIFEST, RELEASE_ID);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(presignUrl).mockResolvedValue({ uploadUrl: 'https://upload.example.test/signed', accessUrl: ACCESS_URL });
  vi.mocked(manifestGenerate).mockResolvedValue(MANIFEST);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('deployAssets waiting for the CDN to unpack the archive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('checks with HEAD once a second while the archive is there, then sends the manifest', async () => {
    const fetchMock = cdnAnswers(200, 200, 404);
    const { gateway, outcome } = startDeploy();

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(ACCESS_URL, { method: 'HEAD' });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(gateway.sendManifest).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    expectManifestSent({ gateway, ...(await outcome) });
  });

  test('a check that got no answer is retried a second later instead of ending the deploy', async () => {
    const fetchMock = cdnAnswers(socketClosed(), 200, 404);
    const { gateway, outcome } = startDeploy();

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    expectManifestSent({ gateway, ...(await outcome) });
  });

  test('two checks in a row without an answer are still tolerated', async () => {
    const fetchMock = cdnAnswers(socketClosed(), refused(), 404);

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('an answer in between starts the count again', async () => {
    const fetchMock = cdnAnswers(socketClosed(), socketClosed(), 200, socketClosed(), socketClosed(), 404);

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  test('three in a row stop the deploy before the manifest, naming the CDN and the last failure', async () => {
    const fetchMock = cdnAnswers(socketClosed(), socketClosed(), socketClosed());

    const { gateway, error } = await deploy();

    expect(error).toBeInstanceOf(ProcessExit);
    expect(error.message).toBe(failureMessage('other side closed (UND_ERR_SOCKET)'));
    expect(logger.Error).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(manifestGenerate).not.toHaveBeenCalled();
    expect(files.writeJSON).not.toHaveBeenCalled();
    expect(gateway.sendManifest).not.toHaveBeenCalled();
  });

  test.each([
    ['a socket the CDN closed', socketClosed, 'other side closed (UND_ERR_SOCKET)'],
    ['a refused connection, whose message already names its code', refused, 'connect ECONNREFUSED 104.21.18.43:443'],
    ['a dual-stack connect failure: an AggregateError with an empty message', dualStackRefused, 'connect ECONNREFUSED ::1:443'],
    ['a DNS failure', notFound, 'getaddrinfo ENOTFOUND cdn.example.test'],
    ['an error with no cause', () => new Error('something else'), 'something else'],
    ['an HTTP status that is no answer', () => 503, 'HTTP 503']
  ])('the reason given for %s is the cause, not "fetch failed"', async (_name, lastFailure, reason) => {
    cdnAnswers(502, notFound(), lastFailure());

    const { error } = await deploy();

    expect(error.message).toBe(failureMessage(reason));
  });

  test.each([500, 502, 503, 520, 408, 425, 429])('HTTP %i is no answer: the archive is checked again', async (status) => {
    const fetchMock = cdnAnswers(status, 404);

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test.each([404, 403, 400])('HTTP %i means the archive is gone: the manifest is sent at once', async (status) => {
    const fetchMock = cdnAnswers(status);

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('stops waiting after 90 checks and sends the manifest, as it always has', async () => {
    const fetchMock = cdnAnswers(...Array(90).fill(200));

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(90);
  });

  test('checks without an answer count toward the 90, including the last one', async () => {
    const fetchMock = cdnAnswers(...Array.from({ length: 90 }, (_, i) => (i % 2 === 0 ? 200 : socketClosed())));

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(90);
  });
});

describe('deployAssets against a CDN that really drops the connection', () => {
  let server;
  let heads;

  beforeEach(async () => {
    heads = 0;
    server = http.createServer((req) => {
      if (req.method === 'HEAD') heads += 1;
      req.socket.destroy();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  // Real fetch, real timers: guards the reason against the error shape Node actually produces.
  test('is reported with what happened, after three checks a second apart', async () => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    vi.mocked(presignUrl).mockResolvedValue({ uploadUrl: 'https://upload.example.test/signed', accessUrl: `${origin}/assets.zip` });

    const started = Date.now();
    const { gateway, outcome } = startDeploy();
    const { error } = await outcome;

    expect(error).toBeInstanceOf(ProcessExit);
    expect(error.message).toBe(failureMessage('other side closed (UND_ERR_SOCKET)').replace(CDN, origin));
    expect(heads).toBe(3);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1950);
    expect(gateway.sendManifest).not.toHaveBeenCalled();
  });
});
