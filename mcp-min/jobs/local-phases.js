/**
 * Asset uploads this process started, so `job-status` can say a deploy is not finished while its
 * assets are still going up.
 *
 * `deploy-start` returns as soon as the release is accepted and finishes the asset upload in the
 * background, which the instance knows nothing about until the manifest arrives. Only the process
 * that started an upload can report it, so a server restarted in between reports `unknown` rather
 * than claiming the deploy is done.
 */

// origin + release id → 'uploading' | 'done' | 'failed'. Bounded: a deploy is minutes, and a
// process serves one developer, but a long-lived HTTP server would otherwise grow forever.
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
  phases.set(id, 'uploading');
  if (phases.size > MAX_TRACKED) phases.delete(phases.keys().next().value);

  return upload.then(
    () => phases.set(id, 'done'),
    () => phases.set(id, 'failed')
  );
}

/** 'uploading' | 'done' | 'failed' | 'unknown' — the last for a job this process did not start. */
export function uploadPhase(origin, releaseId) {
  return phases.get(key(origin, releaseId)) ?? 'unknown';
}

/** Test seam: forget everything tracked. */
export function forgetUploads() {
  phases.clear();
}
