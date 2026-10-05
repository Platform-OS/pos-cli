// platformos.deploy.start - create archive and deploy to platformOS instance
import fs from 'fs';
import path from 'path';
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import { ToolError, classify } from '../tool-error.js';
import files from '../../lib/files.js';
import Gateway from '../../lib/proxy.js';
import { makeArchive } from '../../lib/archive.js';
import { deployAssets, canPresignAssetUpload } from '../../lib/assets.js';

// Aliases for backwards compatibility
const archive = { makeArchive };
const assets = { deployAssets, canPresignAssetUpload };
import dir from '../../lib/directories.js';
import { authProperties } from '../schemas/auth.js';
import { mintFor, originOf } from '../jobs/handle.js';
import { trackUpload } from '../jobs/local-phases.js';
import { deployAssetsForRelease } from './assets-task.js';
import { makeWorkDir, removeWorkDir } from './work-dir.js';
import { waitForJob, waitMsProperty } from '../jobs/status.js';
import { partialProperty, partialOf } from './partial.js';

/**
 * Where this deploy's assets travel, asked before the archive is built because it decides what goes
 * into it — the same order as `lib/deploy/directAssetsUploadStrategy`. An instance with no object
 * storage cannot presign an upload (501), and its assets ride inside the release instead.
 *
 * Skipped with no assets, where the two archives are equal. Anything it throws leaves this call
 * having changed nothing, which is why it is asked before the release goes in and not after.
 */
async function planAssets(gateway, assetsToDeploy) {
  if (assetsToDeploy.length === 0) return { mode: 'none', count: 0 };

  const direct = await assets.canPresignAssetUpload(gateway);
  return { mode: direct ? 'direct' : 'in-archive', count: assetsToDeploy.length };
}

/** What the caller is told about the asset half, per plan. */
const assetsReport = (plan) => ({
  none: { count: 0, skipped: true },
  direct: { count: plan.count, status: 'deploying_in_background' },
  'in-archive': {
    count: plan.count,
    status: 'in_release_archive',
    reason: 'this instance cannot presign a direct upload, so the assets were deployed inside the release archive'
  }
}[plan.mode]);

const startDeployTool = {
  description: "Deploy the project to an instance. When: after check-run passes and deploy-dry-run shows the intended change. Mode: files on the instance that are missing from the build are left in place. Set partial: false to deploy the full intended state, which deletes them. Set wait_ms to wait here; job then carries what job-status would say. Caveat: without wait_ms, or when job says done false, the deploy is still running and job-status reads it back from job_id.",
  annotations: { destructiveHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      partial: partialProperty('Leave files that are missing from the build in place.'),
      // Moves the first status read into this call; the handle still comes back.
      wait_ms: { ...waitMsProperty, description: 'Wait until the deploy is done or this long, whichever comes first.' }
    }
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:deploy-start invoked', { env: params?.env, partial: params?.partial });

    const auth = await resolveAuth(params, ctx);
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    const partial = partialOf(params);

    // Nothing here is deployable, so there is nothing to send: the project is not ready.
    const availableDirs = dir.available();
    if (availableDirs.length === 0) {
      throw ToolError.project('NO_DIRECTORIES', `No deployable directories found. Need at least one of: ${dir.ALLOWED.join(', ')}`);
    }

    // Both before the push, so a failure to enumerate fails a call that has deployed nothing —
    // and the handle's `assets` flag below is never a guess.
    const assetsToDeploy = await files.getAssets();
    const plan = await planAssets(gateway, assetsToDeploy);

    const workDir = makeWorkDir('release');
    const archivePath = path.join(workDir, 'release.zip');

    // One cleanup site for everything that fails before a release exists. After the push the
    // directory belongs to the deploy, and goes with it.
    let numberOfFiles;
    let pushResponse;
    try {
      // The assets ride inside the release exactly when there is no direct upload to make.
      numberOfFiles = await archive.makeArchive({ TARGET: archivePath }, { withoutAssets: plan.mode !== 'in-archive' });

      // Before the upload: a release that is not partial is the whole intended state of the
      // instance, so an empty archive asks it to delete every file it has. `pos-cli deploy` skips
      // the upload the same way.
      if (numberOfFiles === 0 || numberOfFiles === false) {
        throw ToolError.project('EMPTY_ARCHIVE', 'No files to deploy. Archive would be empty.');
      }

      // Absolute because that path, not the stream, is what gets read: `buildFormData`
      // (lib/apiRequest.js) sees `.path` on a read stream and reads the file itself. The stream is
      // therefore never consumed, so `finally` destroys it to close the descriptor, and the `error`
      // listener is not optional — a read stream without one raises an uncaught exception, which in
      // a server is the process rather than the call.
      const archiveStream = fs.createReadStream(path.resolve(archivePath));
      archiveStream.on('error', (err) => log.debug('deploy archive stream error', { error: String(err) }));
      try {
        // No `runWithAuth`: the Gateway carries its own credentials and `lib/assets.js` passes
        // them on, so nothing here needs MARKETPLACE_* set process-wide.
        pushResponse = await gateway.push({
          'marketplace_builder[partial_deploy]': String(partial),
          'marketplace_builder[zip_file]': archiveStream
        });
      } finally {
        // Before the directory can go: Windows will not remove a file with a handle still open.
        archiveStream.destroy();
      }
    } catch (err) {
      removeWorkDir(workDir);
      throw err;
    }

    // In the background: release import + S3 upload + CDN wait can take minutes. Registered
    // under the release id, so `job-status` does not report the deploy finished while it runs.
    const releaseId = pushResponse.id;
    const origin = originOf(auth.url);

    if (plan.mode === 'direct') {
      const upload = deployAssetsForRelease(gateway, releaseId, { deployAssets: assets.deployAssets, workDir });
      trackUpload(origin, releaseId, upload);
      upload
        .then(() => log.info('Background asset deployment completed'))
        .catch(err => log.error('Background asset deployment failed', { error: String(err) }))
        // The zip is packed into workDir by the upload itself, so it cannot go before this.
        .finally(() => removeWorkDir(workDir));
    } else {
      // The release archive has been read and sent; nothing else will look at it.
      removeWorkDir(workDir);
    }

    // What `parse` would read back out of the handle, so the wait below polls exactly that job.
    // `assets` is whether there is a separate phase to wait for, which a server that did not
    // start this deploy cannot know. Assets inside the release are not one.
    const job = { kind: 'deploy', id: String(releaseId), origin, flags: { assets: plan.mode === 'direct' } };

    const answer = {
      id: releaseId,
      // Which project this deployed. Nothing in the call can choose it — the directories are
      // resolved against the server's own working directory — so the answer is where a caller
      // finds out, rather than inferring it from `check-run`, the one tool that happened to say.
      appPath: process.cwd(),
      job_id: mintFor(job),
      // The instance's word for the release it just accepted, not a verdict on the deploy, which
      // is still running. `job-status` publishes the same value under the same name.
      instanceStatus: pushResponse.status,
      // No path: the archive is removed when the deploy is done, so naming it invites a caller
      // to depend on a file that will not be there.
      archive: { fileCount: numberOfFiles, assetsIncluded: plan.mode === 'in-archive' },
      assets: assetsReport(plan),
      params: { partial }
    };

    if (!params.wait_ms) return answer;

    // The credentials and Gateway this deploy was pushed with: the job is on their instance by
    // construction, so there is nothing for job-status's `authForJob` to resolve or compare.
    try {
      answer.job = {
        job_id: answer.job_id,
        ...await waitForJob(job, auth, {
          gateway,
          waitMs: params.wait_ms,
          request: ctx.request,
          pollIntervalMs: ctx.pollIntervalMs,
          signal: ctx.signal,
          sendProgress: ctx.sendProgress
        })
      };
    } catch (err) {
      const failure = classify(err);
      // A cancelled client must not be reported as a deploy whose status merely could not be read.
      if (failure.kind === 'cancelled') throw failure;
      // The deploy started, so a failed status read cannot fail the call — nor be silent, or an
      // absent `job` reads as a deploy that finished. Classified as `job-status` would answer it.
      log.debug('tool:deploy-start wait failed', { error: String(err) });
      answer.jobWaitError = failure.toResult();
    }
    return answer;
  }
};

export default startDeployTool;
