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

/**
 * Paths in the build that matched no part of the platformOS layout. The deploy converter drops
 * them and the release still reports `status: 'success'` — measured against a live instance on
 * 2026-09-22, a file at `app/tests/…` is discarded exactly this way.
 *
 * Exported because `deploy-dry-run` answers the same question before the deploy, and one reader of
 * the platform's shape is the point.
 */
export const filesNotMatched = (release) =>
  (Array.isArray(release?.warning?.files_not_matched) ? release.warning.files_not_matched : []);

// A misplaced directory drops every file under it, so the readable form is bounded. The whole
// record stays on `result.release.warning` for anyone who wants all of it.
const MAX_LISTED = 10;

const listOf = (values) => (values.length > MAX_LISTED
  ? `${values.slice(0, MAX_LISTED).join(', ')}, and ${values.length - MAX_LISTED} more`
  : values.join(', '));

/**
 * Everything the instance warned about, as sentences beside `state` rather than four levels inside
 * the release record.
 *
 * This is the whole of TASK-43: the platform *does* report a file it discarded, and every field
 * above it said the deploy succeeded — `ok`, `state`, `status` and `done` — so an agent making any
 * reasonable check concluded the file was on the instance. `state` is still `completed`, because it
 * is: the deploy finished and the converter's verdict is a fact about the project, not a failed
 * operation. What changes is that the fact is no longer reachable only by walking into the record.
 *
 * A key this does not recognise is passed through rather than dropped, so the next one the platform
 * adds is not invisible for a release.
 */
const releaseWarnings = (response) => {
  const discarded = filesNotMatched(response);
  const other = Object.entries(response?.warning ?? {})
    .filter(([key]) => key !== 'files_not_matched')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? listOf(value) : JSON.stringify(value)}`);

  const warnings = [
    ...(Array.isArray(response?.error?.warnings) ? response.error.warnings : []),
    ...(discarded.length > 0
      ? [`${discarded.length} file${discarded.length === 1 ? '' : 's'} matched no part of the platformOS layout, `
        + `so the deploy did not put ${discarded.length === 1 ? 'it' : 'them'} on the instance: ${listOf(discarded)}`]
      : []),
    ...other
  ];

  return warnings.length > 0 ? warnings : undefined;
};

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
    // Beside `state`, not under `result`: a deploy that discarded a file reads as an unqualified
    // success on every other field here.
    const warnings = releaseWarnings(response);
    return {
      state: ASSET_STATES[assets.phase],
      status,
      ...(assets.error && { error: assets.error }),
      ...(warnings && { warnings }),
      result: { release: response, assets }
    };
  }
};
