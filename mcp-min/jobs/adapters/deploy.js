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
 * Paths in the build that matched no part of the platformOS layout. The converter drops them and
 * the release still reports `status: 'success'`. Exported: `deploy-dry-run` answers the same
 * question before the deploy, from one reader of the platform's shape.
 */
export const filesNotMatched = (release) =>
  (Array.isArray(release?.warning?.files_not_matched) ? release.warning.files_not_matched : []);

// A misplaced directory drops every file under it, so the readable form is bounded; the whole
// record stays on `result.release.warning`.
const MAX_LISTED = 10;

const listOf = (values) => (values.length > MAX_LISTED
  ? `${values.slice(0, MAX_LISTED).join(', ')}, and ${values.length - MAX_LISTED} more`
  : values.join(', '));

// `Object.entries` over a string yields one entry per character, so only a real object is walked.
const warningEntries = (warning) =>
  (warning !== null && typeof warning === 'object' && !Array.isArray(warning) ? Object.entries(warning) : []);

/** The platform answers a report category with either the paths or a number, so both are counted. */
export const toCount = (value) =>
  (Array.isArray(value) ? value.length : (typeof value === 'number' ? value : 0));

/**
 * A file report reduced to its counts.
 *
 * The release record is otherwise forwarded verbatim, and stays that way: an allowlist has to be
 * maintained and a field the platform adds goes silently missing, which is how a discarded file
 * stayed invisible for a release. This is not an allowlist — it is one named field whose cost was
 * measured. On a deploy where **nothing changed**, `result.release.report` is 3,660 of the answer's
 * 4,438 bytes; the whole of the rest of the record is 427. What it holds is the list of files that
 * did not change, after the deploy, when nothing can be done about them — `deploy-dry-run` reports
 * the same paths *before* the deploy, which is when they are worth reading.
 */
const reportCounts = (report) => {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) return report;

  return Object.fromEntries(Object.entries(report).map(([category, data]) => [
    category,
    (data !== null && typeof data === 'object' && !Array.isArray(data))
      ? Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toCount(value)]))
      : data
  ]));
};

/** The record as it goes out: everything the platform sent, with the two file reports counted. */
const forwarded = (response) => {
  if (response === null || typeof response !== 'object') return response;

  return {
    ...response,
    ...(response.report !== undefined && { report: reportCounts(response.report) }),
    ...(response.asset_report !== undefined && { asset_report: reportCounts(response.asset_report) })
  };
};

const errorWarnings = (response) => (Array.isArray(response?.error?.warnings) ? response.error.warnings : []);

// An unrecognised key is passed through, so the next one the platform adds is not invisible.
const otherWarnings = (response) => warningEntries(response?.warning)
  .filter(([key]) => key !== 'files_not_matched')
  .map(([key, value]) => `${key}: ${Array.isArray(value) ? listOf(value) : JSON.stringify(value)}`);

/**
 * Everything the instance warned about except the discarded files. Exported for `deploy-dry-run`,
 * which names those paths in `discarded` — printing them again as prose would be the same list
 * twice. Same reason `filesNotMatched` is exported: one reader of the platform's shape.
 */
export const warningsExceptDiscarded = (response) => {
  const warnings = [...errorWarnings(response), ...otherWarnings(response)];
  return warnings.length > 0 ? warnings : undefined;
};

/**
 * Everything the instance warned about, as sentences beside `state` rather than four levels inside
 * the release record — a discarded file used to read as an unqualified success on every field an
 * agent would check.
 */
const releaseWarnings = (response) => {
  const discarded = filesNotMatched(response);

  const warnings = [
    ...errorWarnings(response),
    ...(discarded.length > 0
      ? [`${discarded.length} file${discarded.length === 1 ? '' : 's'} matched no part of the platformOS layout, `
        + `so the deploy did not put ${discarded.length === 1 ? 'it' : 'them'} on the instance: ${listOf(discarded)}`]
      : []),
    ...otherWarnings(response)
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
  if (asset_report) return { phase: 'done', report: reportCounts(asset_report) };
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
    if (release === 'running') return { state: 'running', status, result: { release: forwarded(response) } };
    if (release === 'failed') {
      const warnings = releaseWarnings(response);
      return { state: 'failed', status, error: releaseError(response), ...(warnings && { warnings }), result: { release: forwarded(response) } };
    }

    // A deploy that carried no assets is finished here; the handle's `assets: false` is the only
    // way a process that did not start it can tell that from "an upload I cannot see". An absent
    // flag is the starter saying it never found out, which is that second case, not this one.
    const assets = flags.assets === false ? { phase: 'none' } : assetPhase(response, { origin, id });
    const warnings = releaseWarnings(response);
    return {
      state: ASSET_STATES[assets.phase],
      status,
      ...(assets.error && { error: assets.error }),
      ...(warnings && { warnings }),
      result: { release: forwarded(response), assets }
    };
  }
};
