// platformos.deploy.start - create archive and deploy to platformOS instance
import fs from 'fs';
import log from '../log.js';
import { resolveAuth, maskToken, runWithAuth } from '../auth.js';
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
  description: 'Deploy to platformOS instance. Creates archive from app/ and modules/ directories, uploads it, and deploys assets directly to S3. Returns a job_id: the deploy is still running when this answers, and job-status reports when its release and assets are both in.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties,
      partial: { type: 'boolean', description: 'Partial deploy - does not remove files missing from build', default: false }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    log.debug('tool:deploy-start invoked', { env: params?.env, partial: params?.partial });

    try {
      const auth = await resolveAuth(params, ctx);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const partial = !!params.partial;
      const archivePath = './tmp/release.zip';

      // Check for deployable directories
      const availableDirs = dir.available();
      if (availableDirs.length === 0) {
        return {
          ok: false,
          error: {
            code: 'NO_DIRECTORIES',
            message: `No deployable directories found. Need at least one of: ${dir.ALLOWED.join(', ')}`
          }
        };
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
        return {
          ok: false,
          error: { code: 'EMPTY_ARCHIVE', message: 'No files to deploy. Archive would be empty.' }
        };
      }

      const pushResponse = await runWithAuth(auth, () => gateway.push({
        'marketplace_builder[partial_deploy]': String(partial),
        'marketplace_builder[zip_file]': fs.createReadStream(archivePath)
      }));

      // In the background: release import + S3 upload + CDN wait can take minutes. Registered
      // under the release id, so `job-status` does not report the deploy finished while it runs.
      const releaseId = pushResponse.id;
      const origin = originOf(auth.url);
      let assetsInfo = null;
      let hasAssets = false;
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
        assetsInfo = { error: String(assetErr) };
      }

      return {
        ok: true,
        data: {
          id: releaseId,
          // `assets` records whether there was an upload at all, which a server that did not
          // start this deploy cannot otherwise know.
          job_id: mintFor({ kind: 'deploy', id: releaseId, origin: auth.url, flags: { assets: hasAssets } }),
          status: pushResponse.status
        },
        archive: { path: archivePath, fileCount: numberOfFiles },
        assets: assetsInfo,
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source },
          params: { partial }
        }
      };
    } catch (e) {
      log.error('tool:deploy-start error', { error: String(e) });
      return { ok: false, error: { code: 'DEPLOY_START_ERROR', message: String(e.message || e) } };
    }
  }
};

export default startDeployTool;
