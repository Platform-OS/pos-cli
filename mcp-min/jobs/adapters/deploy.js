/**
 * A deploy finishes twice: the release is imported, and then the assets are unpacked onto the CDN.
 * `getStatus` reports the two independently — by the time the manifest is accepted the release
 * already reads `success` — so a deploy that carried assets is only `completed` once both are in.
 */
import { statusRequest } from '../errors.js';
import { uploadPhase } from '../local-phases.js';

const RELEASE_RUNNING = new Set(['ready_for_import', 'in_progress']);

/**
 * The release itself, ignoring assets: 'running' | 'failed' | 'done'.
 *
 * Also what the background asset upload waits on — the manifest is sent for a release id, and the
 * CLI only ever sends one after the import has settled (`lib/push.js` polls before
 * `deployAssets`), so nothing here sends one earlier.
 */
export function releaseState(status) {
  if (RELEASE_RUNNING.has(status)) return 'running';
  return status === 'error' ? 'failed' : 'done';
}

/** The release's own error, naming the file the instance blamed when it named one. */
function releaseError(response) {
  const body = response?.error ?? {};
  const message = body.error || 'the deploy failed';
  return body.details?.file_path ? `${message}\n${body.details.file_path}` : message;
}

/** Warnings ride along with a failure the same way `lib/push.js` prints them. */
const releaseWarnings = response =>
  Array.isArray(response?.error?.warnings) && response.error.warnings.length > 0 ? response.error.warnings : undefined;

/**
 * Where the assets are.
 *
 * Two observers, in order. This process knows whether the upload it started has reached the
 * instance yet — nothing on the instance does, until the manifest arrives. After that the release
 * record is the only observer, and `asset_status` missing altogether means an instance that does
 * not report on assets (`waitForAssetReport` reads it the same way).
 *
 * `unknown` is a real answer, not a failure: a server restarted mid-deploy, or a job_id handed to
 * a second server, cannot see an upload it never started, and saying so beats both guesses.
 */
function assetPhase(response, { origin, id }) {
  const local = uploadPhase(origin, id);
  if (local === 'uploading') return { phase: 'uploading' };
  if (local === 'failed') return { phase: 'failed', error: 'the asset upload failed before the manifest was sent' };

  const { asset_error, asset_report, asset_status } = response ?? {};
  if (asset_error) return { phase: 'failed', error: `asset deploy failed: ${asset_error.error ?? asset_error}` };
  if (asset_report) return { phase: 'done', report: asset_report };
  if (asset_status === 'in_progress') return { phase: 'processing' };
  return local === 'done' ? { phase: 'done' } : { phase: 'unknown' };
}

// The deploy is done once the release is in and the assets are no longer moving; `unknown` is
// not moving either — nothing here will ever learn more about it.
const ASSET_STATES = Object.freeze({
  uploading: 'running',
  processing: 'running',
  failed: 'failed',
  done: 'completed',
  unknown: 'completed',
  none: 'completed'
});

export default {
  kind: 'deploy',
  poll: async ({ gateway, origin }, id, flags = {}) => {
    const response = await statusRequest(() => gateway.getStatus(id), { kind: 'deploy', id });
    const status = response?.status;

    if (releaseState(status) === 'running') return { state: 'running', status, result: { release: response } };
    if (releaseState(status) === 'failed') {
      return {
        state: 'failed',
        status,
        error: releaseError(response),
        ...(releaseWarnings(response) && { warnings: releaseWarnings(response) }),
        result: { release: response }
      };
    }

    // The release is in; whether the deploy is done now depends on the assets. A deploy that had
    // none is finished here — that is what the handle's `assets: false` records, and it is the
    // only way a process that did not start the deploy can tell "nothing to upload" from
    // "an upload I cannot see".
    const assets = flags.assets === false ? { phase: 'none' } : assetPhase(response, { origin, id });
    return {
      state: ASSET_STATES[assets.phase],
      status,
      ...(assets.error && { error: assets.error }),
      result: { release: response, assets }
    };
  }
};
