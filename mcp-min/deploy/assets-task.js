/**
 * The asset half of an MCP deploy, run in the background after `deploy-start` has answered.
 *
 * It waits for the release import to settle before uploading, because the manifest is sent *for a
 * release id* and the CLI only ever sends one for a release that has already settled
 * (`lib/push.js` polls the status before `directAssetsUploadStrategy` calls `deployAssets`).
 * Sending one mid-import is untested against the API, and a deploy is the wrong place to find out.
 *
 * Passing the release id is also what makes the asset phase observable at all: without it the
 * instance never associates the manifest with the release, so `asset_status` and `asset_report`
 * stay empty and nothing can tell an agent that the assets are still going up.
 */
import log from '../log.js';
import { releaseState } from '../jobs/adapters/deploy.js';

const POLL_INTERVAL_MS = 1000;
// Long enough for an import of any size; the session's own shutdown deadline is the real bound.
const RELEASE_TIMEOUT_MS = 5 * 60 * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** The same two failures `lib/push.js` retries: a network failure, or the instance's own 5xx. */
const isTransient = err => err?.name === 'RequestError' || err?.statusCode >= 500;

/**
 * Waits for the release to leave `ready_for_import`/`in_progress`.
 *
 * @returns {Promise<'done'|'failed'>}
 */
async function waitForRelease(gateway, releaseId, { pollIntervalMs, timeoutMs, wait, now }) {
  const deadline = now() + timeoutMs;
  let last;
  for (;;) {
    let state;
    try {
      const response = await gateway.getStatus(releaseId);
      last = response?.status;
      // A response with no status in it says nothing about the release; only an answer does.
      state = last === undefined ? 'running' : releaseState(last);
      if (state !== 'running') return state;
    } catch (err) {
      // The upload is worth more than one failed poll: `lib/push.js` retries the same two while
      // it waits for a deploy, and here giving up means the assets are never uploaded at all.
      if (!isTransient(err)) throw err;
      log.debug('release status poll failed, still waiting', { releaseId, error: String(err.message || err) });
      last = `unreadable (${err.message})`;
    }

    if (now() + pollIntervalMs > deadline) {
      throw new Error(`the release was still ${last} after ${timeoutMs}ms, so the asset manifest was not sent`);
    }
    await wait(pollIntervalMs);
  }
}

/**
 * @param {object} gateway
 * @param {string|number} releaseId
 * @param {object} deps
 * @param {(gateway: object, options: object) => Promise<unknown>} deps.deployAssets
 * @param {number} [deps.pollIntervalMs]
 * @param {number} [deps.timeoutMs]
 * @param {(ms: number) => Promise<void>} [deps.wait]
 * @param {() => number} [deps.now] - the clock the deadline is measured on; paired with `wait`,
 *   so a caller that fakes the waiting fakes the passing of time with it
 */
export async function deployAssetsForRelease(gateway, releaseId, {
  deployAssets,
  pollIntervalMs = POLL_INTERVAL_MS,
  timeoutMs = RELEASE_TIMEOUT_MS,
  wait = sleep,
  now = Date.now
}) {
  const state = await waitForRelease(gateway, releaseId, { pollIntervalMs, timeoutMs, wait, now });
  if (state === 'failed') {
    // The release is what the assets would be served with; there is nothing to upload them for.
    throw new Error("the release failed, so its assets were not uploaded");
  }
  log.debug('release settled, uploading assets', { releaseId });
  return deployAssets(gateway, { releaseId });
}

export default deployAssetsForRelease;
