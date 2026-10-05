/**
 * Asset uploads this process started, so `job-status` can say a deploy is not finished while its
 * assets are still going up. `deploy-start` returns as soon as the release is accepted, and the
 * instance knows nothing of the upload until the manifest arrives — so only the process that
 * started one can report it, and a server restarted in between reports `unknown`.
 */

// origin + release id → { phase: 'uploading' | 'done' | 'failed', error? }, bounded so a
// long-lived HTTP server does not grow forever.
export const MAX_TRACKED = 200;
const phases = new Map();

const key = (origin, releaseId) => `${origin}#${releaseId}`;

export function trackUpload(origin, releaseId, upload) {
  const id = key(origin, releaseId);
  phases.set(id, { phase: 'uploading' });
  if (phases.size > MAX_TRACKED) phases.delete(phases.keys().next().value);

  return upload.then(
    () => phases.set(id, { phase: 'done' }),
    // The reason, not just the fact: `deployAssets` can fail at packing, at S3, at the manifest
    // or at the CDN wait.
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
