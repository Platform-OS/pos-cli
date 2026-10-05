// platformos.deploy.start - create archive and deploy to platformOS instance
import fs from 'fs';
import path from 'path';
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import { ToolError } from '../tool-error.js';
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
import jobStatusTool, { MAX_WAIT_MS } from '../jobs/status.js';

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
      // `true`, where `pos-cli deploy` defaults to the deleting mode. The two surfaces differ on
      // purpose: a person running the CLI has the project in front of them and a shell to put
      // things back with, and an agent reached through this tool has neither. Measured 2026-10-01
      // in an agent evaluation — told to keep what was live, an agent deployed by omission and
      // destroyed two pages it had never discovered, with the description warning of exactly that.
      //
      // Deleting is still one argument away, and `deploy-dry-run` defaults the same way so that a
      // preview describes the deploy that would actually happen. What changed is which of the two
      // you get by not deciding.
      partial: { type: 'boolean', description: 'Leave files that are missing from the build in place.', default: true },
      // Moves the first status read into this call; the handle still comes back.
      wait_ms: { type: 'integer', minimum: 0, maximum: MAX_WAIT_MS, description: 'Wait until the deploy is done or this long, whichever comes first.' }
    }
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:deploy-start invoked', { env: params?.env, partial: params?.partial });

    const auth = await resolveAuth(params, ctx);
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    // Absent means partial, matching the schema default: omission must not be the deleting mode.
    const partial = params.partial === undefined ? true : !!params.partial;

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

    const answer = {
      id: releaseId,
      // Which project this deployed. Nothing in the call can choose it — the directories are
      // resolved against the server's own working directory — so the answer is where a caller
      // finds out, rather than inferring it from `check-run`, the one tool that happened to say.
      appPath: process.cwd(),
      // `assets` is whether there is a separate phase to wait for, which a server that did not
      // start this deploy cannot know. Assets inside the release are not one.
      job_id: mintFor({ kind: 'deploy', id: releaseId, origin: auth.url, flags: { assets: plan.mode === 'direct' } }),
      // The instance's word for the release it just accepted, not a verdict on the deploy, which
      // is still running. `job-status` publishes the same value under the same name.
      instanceStatus: pushResponse.status,
      // No path: the archive is removed when the deploy is done, so naming it invites a caller
      // to depend on a file that will not be there.
      archive: { fileCount: numberOfFiles, assetsIncluded: plan.mode === 'in-archive' },
      assets: assetsReport(plan),
      params: { partial }
    };

    const waitMs = Number.isInteger(params?.wait_ms) ? params.wait_ms : 0;
    if (waitMs <= 0) return answer;

    // job-status's own handler, so the polling and its error diagnosis have one implementation.
    // A child context: `runTool` reads `resolvedAuth` back off ctx for meta.auth and job-status
    // assigns to it, and `mayChangeInstance` must be what job-status is, not what this tool is.
    const waitCtx = { ...ctx, mayChangeInstance: false, resolvedAuth: undefined };
    const credentials = ['env', 'url', 'email', 'token']
      .filter((key) => params?.[key] !== undefined)
      .reduce((carried, key) => ({ ...carried, [key]: params[key] }), {});

    try {
      answer.job = await jobStatusTool.handler({ job_id: answer.job_id, wait_ms: waitMs, ...credentials }, waitCtx);
    } catch (err) {
      // A cancelled client must not be reported as a deploy whose status merely could not be read.
      if (err?.kind === 'cancelled') throw err;
      // The deploy started, so a failed status read cannot fail the call — nor be silent, or an
      // absent `job` reads as a deploy that finished.
      log.debug('tool:deploy-start wait failed', { error: String(err) });
      answer.jobWaitError = { code: err?.code ?? 'STATUS_UNREADABLE', message: String(err?.message ?? err) };
    }
    return answer;
  }
};

export default startDeployTool;
