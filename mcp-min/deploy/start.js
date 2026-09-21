// platformos.deploy.start - create archive and deploy to platformOS instance
import fs from 'fs';
import path from 'path';
import log from '../log.js';
import { resolveAuth, runWithAuth } from '../auth.js';
import { ToolError } from '../tool-error.js';
import files from '../../lib/files.js';
import Gateway from '../../lib/proxy.js';
import { makeArchive } from '../../lib/archive.js';
import { deployAssets } from '../../lib/assets.js';

// Aliases for backwards compatibility
const archive = { makeArchive };
const assets = { deployAssets };
import dir from '../../lib/directories.js';
import { authProperties } from '../schemas/auth.js';
import { mintFor, originOf } from '../jobs/handle.js';
import { trackUpload } from '../jobs/local-phases.js';
import { deployAssetsForRelease } from './assets-task.js';

const startDeployTool = {
  description: 'Deploy the project to an instance. Everything missing from the build is deleted there unless partial is set; deploy-dry-run reports that list first, changing nothing. Returns a job_id: the deploy is still running when this answers, and job-status reports when its release and its assets are both in.',
  annotations: { destructiveHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      partial: { type: 'boolean', description: 'Leave files that are missing from the build in place.', default: false }
    }
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:deploy-start invoked', { env: params?.env, partial: params?.partial });

    const auth = await resolveAuth(params, ctx);
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    const partial = !!params.partial;
    const archivePath = './tmp/release.zip';

    // Nothing here is deployable, so there is nothing to send: the project is not ready.
    const availableDirs = dir.available();
    if (availableDirs.length === 0) {
      throw ToolError.project('NO_DIRECTORIES', `No deployable directories found. Need at least one of: ${dir.ALLOWED.join(', ')}`);
    }

    // Ensure tmp directory exists
    if (!fs.existsSync('./tmp')) {
      fs.mkdirSync('./tmp', { recursive: true });
    }

    // Create archive (without assets - they're uploaded directly)
    const env = { TARGET: archivePath };
    const numberOfFiles = await archive.makeArchive(env, { withoutAssets: true });

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
    let pushResponse;
    try {
      pushResponse = await runWithAuth(auth, () => gateway.push({
        'marketplace_builder[partial_deploy]': String(partial),
        'marketplace_builder[zip_file]': archiveStream
      }));
    } finally {
      archiveStream.destroy();
    }

    // In the background: release import + S3 upload + CDN wait can take minutes. Registered
    // under the release id, so `job-status` does not report the deploy finished while it runs.
    const releaseId = pushResponse.id;
    const origin = originOf(auth.url);
    let assetsInfo = null;
    // Undefined until we know. Enumeration that throws must not leave this `false`: the handle
    // would then claim the deploy carried no assets, and job-status reads that as an asset phase
    // that finished — reporting a deploy complete when nothing ever looked for an asset.
    let hasAssets;
    try {
      const assetsToDeploy = await files.getAssets();
      hasAssets = assetsToDeploy.length > 0;
      if (hasAssets) {
        const upload = runWithAuth(auth, () => deployAssetsForRelease(gateway, releaseId, { deployAssets: assets.deployAssets }));
        trackUpload(origin, releaseId, upload);
        upload.then(() => {
          log.info('Background asset deployment completed');
        }).catch(err => {
          log.error('Background asset deployment failed', { error: String(err) });
        });
        assetsInfo = { count: assetsToDeploy.length, status: 'deploying_in_background' };
      } else {
        assetsInfo = { count: 0, skipped: true };
      }
    } catch (assetErr) {
      // The release is already in. Failing the whole call now would report a deploy that did
      // happen as one that did not, so this is carried in the answer instead.
      assetsInfo = { error: String(assetErr) };
    }

    return {
      id: releaseId,
      // `assets` records whether there was an upload at all, which a server that did not start
      // this deploy cannot otherwise know. Left out when we never found out, which the adapter
      // answers as an asset phase it cannot see rather than as one there was none of.
      job_id: mintFor({ kind: 'deploy', id: releaseId, origin: auth.url, flags: hasAssets === undefined ? {} : { assets: hasAssets } }),
      status: pushResponse.status,
      archive: { path: archivePath, fileCount: numberOfFiles },
      assets: assetsInfo,
      params: { partial }
    };
  }
};

export default startDeployTool;
