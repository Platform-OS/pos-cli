/**
 * A deploy finishes twice: the release is imported, then the assets are unpacked onto the CDN.
 * `getStatus` reports the two independently, so a deploy that carried assets is only `completed`
 * once both are in.
 */
import log from '../../log.js';
import { statusRequest } from '../errors.js';
import { uploadPhase } from '../local-phases.js';

const RELEASE_RUNNING = new Set(['ready_for_import', 'in_progress']);

/** The release itself, ignoring assets: 'running' | 'failed' | 'done'. */
export function releaseState(status) {
  if (RELEASE_RUNNING.has(status)) return 'running';
  if (status === 'error') return 'failed';

  // Anything else is a finished release, as `lib/push.js` also reads it — but an unfamiliar one is
  // worth saying once, because this is the decision the asset upload waits on.
  if (status !== 'success' && !warned.has(status)) {
    warned.add(status);
    log.warn('mcp-min: deploy reported an unfamiliar status, treating it as finished', { status });
  }
  return 'done';
}

const warned = new Set();

/** Naming the file the instance blamed, when it named one. */
function releaseError(response) {
  const body = response?.error ?? {};
  const message = body.error || 'the deploy failed';
  return body.details?.file_path ? `${message}\n${body.details.file_path}` : message;
}

/** Warnings ride along with a failure the same way `lib/push.js` prints them. */
const releaseWarnings = response =>
  Array.isArray(response?.error?.warnings) && response.error.warnings.length > 0 ? response.error.warnings : undefined;

/**
 * Where the assets are, from two observers in order: this process knows about an upload it
 * started, and nothing on the instance does until the manifest arrives. `unknown` is a real
 * answer — a restarted server cannot see an upload it never started, and saying so beats a guess.
 */
function assetPhase(response, { origin, id }) {
  const local = uploadPhase(origin, id);
  if (local.phase === 'uploading') return { phase: 'uploading' };
  if (local.phase === 'failed') return { phase: 'failed', error: `the asset upload failed: ${local.error}` };

  const { asset_error, asset_report, asset_status } = response ?? {};
  if (asset_error) return { phase: 'failed', error: `asset deploy failed: ${asset_error.error ?? asset_error}` };
  if (asset_report) return { phase: 'done', report: asset_report };
  if (asset_status === 'in_progress') return { phase: 'processing' };
  return local.phase === 'done' ? { phase: 'done' } : { phase: 'unknown' };
}

// `unknown` counts as settled: nothing here will ever learn more about it.
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

    const release = releaseState(status);
    if (release === 'running') return { state: 'running', status, result: { release: response } };
    if (release === 'failed') {
      const warnings = releaseWarnings(response);
      return { state: 'failed', status, error: releaseError(response), ...(warnings && { warnings }), result: { release: response } };
    }

    // A deploy that carried no assets is finished here; the handle's `assets: false` is the only
    // way a process that did not start it can tell that from "an upload I cannot see". An absent
    // flag is the starter saying it never found out, which is that second case, not this one.
    const assets = flags.assets === false ? { phase: 'none' } : assetPhase(response, { origin, id });
    return {
      state: ASSET_STATES[assets.phase],
      status,
      ...(assets.error && { error: assets.error }),
      result: { release: response, assets }
    };
  }
};
