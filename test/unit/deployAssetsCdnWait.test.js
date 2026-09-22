/**
 * After the asset archive is uploaded, deployAssets polls the CDN until the platform has
 * unpacked it (and deleted it), and only then sends the manifest.
 *
 * Two things that settle nothing are told apart there, and these tests are mostly about
 * that line. A check the CDN *answers* with 429 or 5xx is retried with a backoff and never
 * fails the deploy — a proxy rate-limiting the poll produces exactly that, every deploy. A
 * check that gets no answer at all used to be passed to logger.Error with its default
 * `exit: true`, ending the deploy with nothing but `"fetch failed"` after the release had
 * already been applied; it is now retried too, and only several in a row stop the deploy,
 * with the CDN and the cause named, and never by going on to send the manifest.
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
import { getNetworkErrorCode } from '#lib/ServerError.js';
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
// What AbortSignal.timeout aborts a stalled HEAD with.
const timedOut = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

// The three messages the code produces, so every assertion about one can be an equality.
const failureMessage = (reason, origin = CDN) =>
  `Deploy assets failed: The CDN at ${origin} did not answer 3 checks in a row; the last one failed with: ${reason}. ` +
  'It is not known whether the uploaded assets were unpacked, so the asset manifest was not sent. Run the deploy again.';

const noAnswerWarning = reason => `The CDN at ${CDN} did not answer a check (${reason}); retrying.`;

const timeoutWarning = lastState =>
  `Waited 90s for the CDN at ${CDN} to stop serving the uploaded assets archive and ${lastState}. ` +
  'Sending the asset manifest anyway, as earlier versions did — if the deployed assets look stale, run the deploy again.';

/** The fetch mock the current test scripted, for the assertions that are made about it. */
let cdn;

const httpAnswer = answer => {
  const { status, retryAfter } = typeof answer === 'number' ? { status: answer } : answer;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => (name === 'retry-after' && retryAfter !== undefined ? String(retryAfter) : null) }
  };
};

/**
 * Scripts the CDN. An answer is an HTTP status, `{ status, retryAfter }` for one that asks
 * for a wait, or anything else to reject the request with.
 */
function cdnAnswers(...answers) {
  const fetchMock = vi.fn();
  const isHttp = answer =>
    typeof answer === 'number' || (answer !== null && typeof answer === 'object' && typeof answer.status === 'number');

  for (const answer of answers) {
    if (isHttp(answer)) fetchMock.mockResolvedValueOnce(httpAnswer(answer));
    else fetchMock.mockRejectedValueOnce(answer);
  }

  // A check beyond the script lands in waitForUnpack's own catch, where it is
  // indistinguishable from the CDN failing — so it is counted rather than thrown, and
  // asserted on separately. Otherwise a regression that polls too often is diagnosed as a
  // CDN problem instead of the extra poll it is.
  fetchMock.unscripted = 0;
  fetchMock.mockImplementation(() => {
    fetchMock.unscripted += 1;
    return Promise.reject(new Error('test: the CDN was checked more times than scripted'));
  });

  vi.stubGlobal('fetch', fetchMock);
  cdn = fetchMock;
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

const expectNoUnscriptedChecks = () => expect(cdn?.unscripted ?? 0).toBe(0);

function expectManifestSent(result) {
  expectNoUnscriptedChecks();
  expect(result.error).toBeUndefined();
  expect(logger.Error).not.toHaveBeenCalled();
  expect(result.gateway.sendManifest).toHaveBeenCalledTimes(1);
  expect(result.gateway.sendManifest).toHaveBeenCalledWith(MANIFEST, RELEASE_ID);
}

const warnings = () => vi.mocked(logger.Warn).mock.calls.map(([message]) => String(message));

beforeEach(() => {
  vi.clearAllMocks();
  cdn = null;
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
    expect(fetchMock).toHaveBeenCalledWith(ACCESS_URL, { method: 'HEAD', signal: expect.any(AbortSignal) });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(gateway.sendManifest).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    expectManifestSent({ gateway, ...(await outcome) });
  });

  test('every check is given a deadline of its own, so a silent connection cannot hold the deploy', async () => {
    const fetchMock = cdnAnswers(200, 404);

    expectManifestSent(await deploy());
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.signal.aborted).toBe(false);
    }
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

  test('the first check of a failing run is reported without DEBUG=1', async () => {
    cdnAnswers(socketClosed(), socketClosed(), 200, 404);

    expectManifestSent(await deploy());
    expect(warnings()).toEqual([noAnswerWarning('other side closed (UND_ERR_SOCKET)')]);
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

  test('retries back off, so three unanswered checks are seven seconds of trying', async () => {
    const fetchMock = cdnAnswers(socketClosed(), socketClosed(), socketClosed());
    const { outcome } = startDeploy();

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    expect((await outcome).error).toBeInstanceOf(ProcessExit);
  });

  test('three in a row stop the deploy before the manifest, naming the CDN and the last failure', async () => {
    const fetchMock = cdnAnswers(socketClosed(), socketClosed(), socketClosed());

    const { gateway, error } = await deploy();

    expectNoUnscriptedChecks();
    expect(error).toBeInstanceOf(ProcessExit);
    expect(error.message).toBe(failureMessage('other side closed (UND_ERR_SOCKET)'));
    expect(logger.Error).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(manifestGenerate).not.toHaveBeenCalled();
    expect(files.writeJSON).not.toHaveBeenCalled();
    expect(gateway.sendManifest).not.toHaveBeenCalled();
  });

  test('the thrown error carries the last failure as its cause, so the chain survives for DEBUG=1', async () => {
    const last = refused();
    cdnAnswers(socketClosed(), socketClosed(), last);

    await deploy();

    const thrown = vi.mocked(logger.Debug).mock.calls.map(([arg]) => arg).find(arg => arg instanceof Error);
    expect(thrown.cause).toBe(last);
    // The point of keeping it: ServerError's own walk can still reach the code.
    expect(getNetworkErrorCode(thrown)).toBe('ECONNREFUSED');
  });

  test.each([
    ['a socket the CDN closed', socketClosed, 'other side closed (UND_ERR_SOCKET)'],
    ['a refused connection, whose message already names its code', refused, 'connect ECONNREFUSED 104.21.18.43:443'],
    ['a dual-stack connect failure: an AggregateError with an empty message', dualStackRefused, 'connect ECONNREFUSED ::1:443'],
    ['a DNS failure', notFound, 'getaddrinfo ENOTFOUND cdn.example.test'],
    ['a check that ran out of time', timedOut, 'no answer within 10s'],
    ['an error with no cause', () => new Error('something else'), 'something else']
  ])('the reason given for %s is the cause, not "fetch failed"', async (_name, lastFailure, reason) => {
    cdnAnswers(notFound(), notFound(), lastFailure());

    const { error } = await deploy();

    expect(error.message).toBe(failureMessage(reason));
  });

  test.each([500, 502, 503, 520, 408, 425, 429])('HTTP %i settles nothing: the archive is checked again', async (status) => {
    const fetchMock = cdnAnswers(status, 404);

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test.each([404, 403, 400])('HTTP %i means the archive is gone: the manifest is sent at once', async (status) => {
    const fetchMock = cdnAnswers(status);

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // The regression this guards: a CDN that answers 429 is reachable, and treating it as a
  // check that got no answer made three rate-limited polls in a row — which is what rate
  // limiting produces by construction — fail a deploy that used to succeed.
  test('a CDN that only ever rate-limits does not fail the deploy', async () => {
    const fetchMock = cdnAnswers(...Array(20).fill(429));

    expectManifestSent(await deploy());
    // 1s, 2s, 4s, then the 8s cap: 14 checks fit in the 90s budget.
    expect(fetchMock).toHaveBeenCalledTimes(14);
    expect(warnings()).toEqual([
      noAnswerWarning('HTTP 429'),
      timeoutWarning('the last check failed with: HTTP 429')
    ]);
  });

  test('an answered check resets the run that stops the deploy, however it answered', async () => {
    const fetchMock = cdnAnswers(refused(), 503, refused(), refused(), 404);

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test('a Retry-After is waited out instead of the backoff', async () => {
    const fetchMock = cdnAnswers({ status: 429, retryAfter: 5 }, 404);
    const { gateway, outcome } = startDeploy();

    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expectManifestSent({ gateway, ...(await outcome) });
  });

  test.each([
    ['longer than the cap', 600, 8000],
    ['zero, which would make the retry a hot loop', 0, 1000]
  ])('a Retry-After %s is clamped', async (_name, retryAfter, expected) => {
    const fetchMock = cdnAnswers({ status: 503, retryAfter }, 404);
    const { gateway, outcome } = startDeploy();

    await vi.advanceTimersByTimeAsync(expected - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expectManifestSent({ gateway, ...(await outcome) });
  });

  test('stops waiting after 90 seconds and sends the manifest, as it always has — but says so', async () => {
    const fetchMock = cdnAnswers(...Array(90).fill(200));

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(90);
    expect(warnings()).toEqual([timeoutWarning('the archive was still there')]);
  });

  test('checks without an answer count toward the budget, including the last one', async () => {
    const fetchMock = cdnAnswers(...Array.from({ length: 90 }, (_, i) => (i % 2 === 0 ? 200 : socketClosed())));

    expectManifestSent(await deploy());
    expect(fetchMock).toHaveBeenCalledTimes(90);
    expect(warnings().at(-1)).toBe(timeoutWarning('the last check failed with: other side closed (UND_ERR_SOCKET)'));
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

  // Real fetch, real timers: guards the reason against the error shape Node actually
  // produces. What that shape says is deliberately not asserted word for word — a dropped
  // socket reaches undici as "other side closed" on one platform and as ECONNRESET on
  // another, and undici is free to reword either between minors. What has to hold is that
  // the reason is the cause rather than fetch()'s own "fetch failed".
  test('is reported with what happened, after three checks a few seconds apart', async () => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    vi.mocked(presignUrl).mockResolvedValue({ uploadUrl: 'https://upload.example.test/signed', accessUrl: `${origin}/assets.zip` });

    const started = Date.now();
    const { gateway, outcome } = startDeploy();
    const { error } = await outcome;

    expect(error).toBeInstanceOf(ProcessExit);
    // Everything around the reason is asserted exactly; the reason itself is read back out
    // of the message, since only what it must not be is fixed across platforms.
    const reason = error.message.match(/the last one failed with: (.+)\. It is not known/)?.[1];
    expect(typeof reason).toBe('string');
    expect(reason).not.toBe('fetch failed');
    expect(error.message).toBe(failureMessage(reason, origin));
    expect(heads).toBe(3);
    // 1s and then 2s of backoff between the three checks.
    expect(Date.now() - started).toBeGreaterThanOrEqual(2950);
    expect(gateway.sendManifest).not.toHaveBeenCalled();
  });
});
