import packAssets from './assets/packAssets.js';
import { manifestGenerate } from './assets/manifest.js';
import logger from './logger.js';
import { uploadFile } from './s3UploadFile.js';
import { presignUrl, presignDirectory, isDirectUploadUnavailable } from './presignUrl.js';
import files from './files.js';
import ServerError, { getNetworkErrorCode } from './ServerError.js';
import { pauseActiveSpinners } from './ora.js';
import sleep from './utils/sleep.js';
import { isTransientStatus } from './utils/transientStatus.js';
import { parseRetryAfter, clampRetrySeconds } from './utils/retryAfter.js';

const UNPACK_CHECK_INTERVAL_MS = 1000;
// Was "90 checks", which was also 90 seconds because every check took a fixed second.
// Neither is fixed any more — a check can now take up to UNPACK_CHECK_TIMEOUT_MS and a
// retry is backed off — so a count would no longer bound anything an operator cares
// about. The wall clock is the budget that was always meant.
const UNPACK_TIMEOUT_MS = 90 * 1000;
// Per check. Without it, a connection that is accepted and then goes silent — a firewall
// dropping packets after the handshake — sits in undici's 300s headers timeout, so a
// single such check would eat the whole budget above behind an unchanging spinner.
const UNPACK_CHECK_TIMEOUT_MS = 10 * 1000;
const UNPACK_MAX_FAILURES_IN_A_ROW = 3;
const UNPACK_MAX_BACKOFF_MS = 8 * 1000;

// What one HEAD of the uploaded archive settled.
const GONE = 'gone';           // it is not there any more: the platform unpacked it
const PRESENT = 'present';     // it is still there: keep waiting
const NO_ANSWER = 'no-answer'; // nothing was settled either way

// fetch() only ever says "fetch failed"; what happened is on its cause chain. A dual-stack
// connect failure is an AggregateError with an empty message, so read its first attempt.
// The code comes from getNetworkErrorCode, which takes the first one at any depth because
// the depth varies between Node versions and platforms (see lib/ServerError.js).
const failureReason = error => {
  if (error?.name === 'TimeoutError') return `no answer within ${UNPACK_CHECK_TIMEOUT_MS / 1000}s`;

  let inner = error;
  for (let depth = 0; inner?.cause && depth < 5; depth++) inner = inner.cause;
  const message = inner?.message || inner?.errors?.[0]?.message || error?.message || String(error);
  const code = getNetworkErrorCode(error);

  return typeof code === 'string' && !message.includes(code) ? `${message} (${code})` : message;
};

// Clamped rather than obeyed, on the same grounds as the Partner Portal client: a CDN that
// is rate-limiting a HEAD may well ask for a minute, and the whole wait is 90 seconds.
const retryAfterMs = response => {
  const seconds = parseRetryAfter(response.headers?.get?.('retry-after'));
  if (seconds === null) return null;

  const bounds = { min: UNPACK_CHECK_INTERVAL_MS / 1000, max: UNPACK_MAX_BACKOFF_MS / 1000 };
  return clampRetrySeconds(seconds, bounds) * 1000;
};

// Doubles per consecutive check that settled nothing, so a CDN that is rate-limiting or
// briefly down is not polled at the pace it is failing at — and three unanswered checks
// are seven seconds of trying rather than two.
const backoffMs = noAnswers =>
  Math.min(UNPACK_CHECK_INTERVAL_MS * 2 ** (noAnswers - 1), UNPACK_MAX_BACKOFF_MS);

// One HEAD, classified. Anything that is neither 2xx nor transient means the archive is
// gone — a 404, or the 403 that storage hiding its missing keys answers instead.
const checkArchive = async fileUrl => {
  try {
    const response = await fetch(fileUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(UNPACK_CHECK_TIMEOUT_MS)
    });

    if (response.ok) return { verdict: PRESENT };
    if (!isTransientStatus(response.status)) return { verdict: GONE };

    // It answered, so it is reachable: it is declining to say, not absent.
    return { verdict: NO_ANSWER, reachable: true, reason: `HTTP ${response.status}`, retryAfter: retryAfterMs(response) };
  } catch (error) {
    return { verdict: NO_ANSWER, reachable: false, reason: failureReason(error), error };
  }
};

/**
 * The platform unpacks the uploaded archive and then deletes it, and the manifest must not
 * be sent before that, so this waits while the archive is still there — for at most
 * UNPACK_TIMEOUT_MS, after which the deploy goes on as it always has.
 *
 * Two kinds of check settle nothing, and they are not the same thing:
 *
 *  - the CDN answers 429 or 5xx. It is reachable and is asking to be asked again, so the
 *    check is retried — backed off, and on its Retry-After where it sent one — until the
 *    budget runs out. This never fails the deploy: a proxy rate-limiting the poll produces
 *    exactly this, deploy after deploy, at whatever pace we poll.
 *  - the request got no answer at all: a dropped connection, a refused one, DNS, silence.
 *    One such check used to be passed to logger.Error with its default `exit: true`, which
 *    ended the whole deploy with nothing but "fetch failed" after the release had already
 *    been applied. Several in a row mean the CDN cannot be reached, and that throws, with
 *    the CDN and the cause named, rather than sending a manifest for assets nobody saw
 *    unpacked.
 *
 * Running out of the budget is the one remaining way the manifest goes out with nothing
 * having confirmed the archive was unpacked. That is the old behaviour and it is kept on
 * purpose — a platform having a slow minute must not fail a deploy — but it says so, since
 * it is not the same outcome as having watched the archive go.
 */
const waitForUnpack = async fileUrl => {
  logger.Debug('Waiting for assets to be propagated to CDN');

  const origin = new URL(fileUrl).origin;
  const deadline = Date.now() + UNPACK_TIMEOUT_MS;

  let noAnswers = 0;
  let unreachableInARow = 0;
  let lastState = 'the archive was still there';
  let check = 0;
  let delay = 0;

  for (;;) {
    if (delay > 0) await sleep(Math.max(0, Math.min(delay, deadline - Date.now())));
    if (Date.now() >= deadline) break;

    check += 1;
    logger.Debug(`Waiting for: ${fileUrl} to be deleted.`);
    const { verdict, reachable, reason, retryAfter, error } = await checkArchive(fileUrl);

    if (verdict === GONE) return;

    if (verdict === PRESENT) {
      noAnswers = 0;
      unreachableInARow = 0;
      lastState = 'the archive was still there';
      delay = UNPACK_CHECK_INTERVAL_MS;
      continue;
    }

    noAnswers += 1;
    unreachableInARow = reachable ? 0 : unreachableInARow + 1;
    lastState = `the last check failed with: ${reason}`;

    if (unreachableInARow >= UNPACK_MAX_FAILURES_IN_A_ROW) {
      throw new Error(
        `The CDN at ${origin} did not answer ${UNPACK_MAX_FAILURES_IN_A_ROW} checks in a row; the last one failed with: ${reason}. ` +
        'It is not known whether the uploaded assets were unpacked, so the asset manifest was not sent. Run the deploy again.',
        { cause: error }
      );
    }

    // Once per run of them, so a CDN failing a third of its checks — adding a minute to
    // every deploy without ever crossing the limit above — is visible without DEBUG=1.
    if (noAnswers === 1) logger.Warn(`The CDN at ${origin} did not answer a check (${reason}); retrying.`);
    else logger.Debug(`Check ${check} of ${fileUrl} got no answer (${reason}); retrying.`);

    delay = retryAfter ?? backoffMs(noAnswers);
  }

  // Running out of budget is not the same as seeing the archive go, and the manifest is
  // sent either way, so say so: this is the one path where assets can be deployed without
  // anything having confirmed they were unpacked.
  logger.Warn(
    `Waited ${UNPACK_TIMEOUT_MS / 1000}s for the CDN at ${origin} to stop serving the uploaded assets archive and ${lastState}. ` +
    'Sending the asset manifest anyway, as earlier versions did — if the deployed assets look stale, run the deploy again.'
  );
};

// Whether this instance can take a direct asset upload at all. An instance with no object
// storage configured cannot presign one (isDirectUploadUnavailable); its assets have to
// travel inside the release archive instead, which is what the default strategy already
// does for `--old-assets-upload`. Everything else is left for the caller to report.
//
// The policy this signs is discarded — presigning creates nothing, it only signs.
const canPresignAssetUpload = async gateway => {
  const instance = await gateway.getInstance();
  try {
    await presignDirectory(`instances/${instance.id}/assets`);
    return true;
  } catch (e) {
    if (!isDirectUploadUnavailable(e)) throw e;
    return false;
  }
};

const deployAssets = async (gateway, { releaseId } = {}) => {
  logger.Debug('Generating and uploading new assets manifest...');
  const assetsArchiveName = './tmp/assets.zip';
  const instance = await gateway.getInstance();
  const now = Math.floor(new Date());
  const remoteAssetsArchiveName = `instances/${instance.id}/assets/${now}.assets_deploy.zip`;
  logger.Debug(remoteAssetsArchiveName);
  try {
    await packAssets(assetsArchiveName);
    const data = await presignUrl(remoteAssetsArchiveName, assetsArchiveName);
    logger.Debug(data);
    logger.Debug(assetsArchiveName);
    await uploadFile(assetsArchiveName, data.uploadUrl);
    logger.Debug('Assets uploaded to S3.');
    await waitForUnpack(data.accessUrl);
    const manifest = await manifestGenerate();
    logger.Debug(manifest);
    files.writeJSON('tmp/assets_manifest.json', manifest);
    const response = await gateway.sendManifest(manifest, releaseId);
    logger.Debug('Uploading assets');
    return response;
  } catch (e) {
    logger.Debug(e);
    logger.Debug(e.message);
    logger.Debug(e.stack);
    // The caller's spinner is still drawing on this line — directAssetsUploadStrategy keeps
    // one up for the whole deploy and only stops it on success — and what follows is
    // several sentences long, so it would be repainted over as it is read.
    const resumeSpinners = pauseActiveSpinners();
    try {
      if (ServerError.isNetworkError(e)) {
        await logger.Error('Deploy assets failed.');
        await ServerError.handler(e);
      } else {
        await logger.Error(`Deploy assets failed: ${e.message || e}`);
      }
    } finally {
      resumeSpinners();
    }
  }
};

export { deployAssets, canPresignAssetUpload };
