import packAssets from './assets/packAssets.js';
import { manifestGenerate } from './assets/manifest.js';
import logger from './logger.js';
import { uploadFile } from './s3UploadFile.js';
import { presignUrl, presignDirectory, isDirectUploadUnavailable } from './presignUrl.js';
import files from './files.js';
import ServerError from './ServerError.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const UNPACK_CHECK_INTERVAL_MS = 1000;
const UNPACK_MAX_CHECKS = 90;
const UNPACK_MAX_FAILURES_IN_A_ROW = 3;

// Answers that say nothing about whether the archive is still there: the CDN, or the proxy
// in front of it, failed or asked to be left alone. Any other non-2xx means it is gone —
// a 404, or the 403 that storage hiding its missing keys answers instead.
const NO_ANSWER_STATUSES = [408, 425, 429];
const isNoAnswer = status => status >= 500 || NO_ANSWER_STATUSES.includes(status);

// fetch() only ever says "fetch failed"; what happened is on its innermost cause. A dual-stack
// connect failure is an AggregateError with an empty message, so read its first attempt.
const failureReason = error => {
  let inner = error;
  for (let depth = 0; inner?.cause && depth < 5; depth++) inner = inner.cause;
  const message = inner?.message || inner?.errors?.[0]?.message || error?.message || String(error);
  const code = inner?.code;
  return typeof code === 'string' && !message.includes(code) ? `${message} (${code})` : message;
};

// The platform unpacks the uploaded archive and then deletes it, and the manifest must not be
// sent before that, so this waits while the archive is still there — for at most
// UNPACK_MAX_CHECKS checks, after which the deploy goes on as it always has.
//
// A check the CDN does not answer is retried at the same pace and counts toward that limit:
// one dropped connection used to end the whole deploy. Several in a row mean the CDN cannot be
// reached, and that throws instead of sending a manifest for assets nobody saw unpacked.
const waitForUnpack = async fileUrl => {
  logger.Debug('Waiting for assets to be propagated to CDN');

  let failuresInARow = 0;
  for (let check = 1; check <= UNPACK_MAX_CHECKS; check++) {
    if (check > 1) await sleep(UNPACK_CHECK_INTERVAL_MS);
    logger.Debug(`Waiting for: ${fileUrl} to be deleted.`);

    let reason;
    try {
      const response = await fetch(fileUrl, { method: 'HEAD' });
      if (response.ok) {
        failuresInARow = 0;
        continue;
      }
      if (!isNoAnswer(response.status)) return;
      reason = `HTTP ${response.status}`;
    } catch (error) {
      reason = failureReason(error);
    }

    failuresInARow += 1;
    if (failuresInARow >= UNPACK_MAX_FAILURES_IN_A_ROW) {
      throw new Error(
        `The CDN at ${new URL(fileUrl).origin} did not answer ${failuresInARow} checks in a row; the last one failed with: ${reason}. ` +
        'It is not known whether the uploaded assets were unpacked, so the asset manifest was not sent. Run the deploy again.'
      );
    }
    logger.Debug(`Check ${check} of ${fileUrl} got no answer (${reason}); retrying.`);
  }
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
    if (ServerError.isNetworkError(e)) {
      await logger.Error('Deploy assets failed.');
      await ServerError.handler(e);
    } else {
      await logger.Error(`Deploy assets failed: ${e.message || e}`);
    }
  }
};

export { deployAssets, canPresignAssetUpload };
