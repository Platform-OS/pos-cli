/**
 * Asset uploads this process started, so `job-status` can say a deploy is not finished while its
 * assets are still going up.
 *
 * `deploy-start` returns as soon as the release is accepted and finishes the asset upload in the
 * background, which the instance knows nothing about until the manifest arrives. Only the process
 * that started an upload can report it, so a server restarted in between reports `unknown` rather
 * than claiming the deploy is done.
 */

// origin + release id → { phase: 'uploading' | 'done' | 'failed', error? }. Bounded: a deploy is
// minutes, and a process serves one developer, but a long-lived HTTP server would otherwise grow
// forever.
export const MAX_TRACKED = 200;
const phases = new Map();

const key = (origin, releaseId) => `${origin}#${releaseId}`;

/**
 * @param {string} origin
 * @param {string|number} releaseId
 * @param {Promise<unknown>} upload - the background asset upload
 */
export function trackUpload(origin, releaseId, upload) {
  const id = key(origin, releaseId);
  phases.set(id, { phase: 'uploading' });
  if (phases.size > MAX_TRACKED) phases.delete(phases.keys().next().value);

  return upload.then(
    () => phases.set(id, { phase: 'done' }),
    // The reason, not just the fact: `deployAssets` can fail at packing, at S3, at the manifest or
    // at the CDN wait, and "it failed" sends the agent looking in the wrong place.
    err => phases.set(id, { phase: 'failed', error: String(err?.message || err) })
  );
}

/**
 * What this process knows about that upload: `{ phase: 'uploading' | 'done' | 'failed', error? }`,
 * or `{ phase: 'unknown' }` for a job it did not start.
 */
export function uploadPhase(origin, releaseId) {
  return phases.get(key(origin, releaseId)) ?? { phase: 'unknown' };
}

/** Test seam: forget everything tracked. */
export function forgetUploads() {
  phases.clear();
}
