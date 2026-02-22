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

const startDeployTool = {
  description: 'Deploy to platformOS instance. Creates archive from app/ and modules/ directories, uploads it, and deploys assets directly to S3.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      url: { type: 'string', description: 'Instance URL (alternative to env)' },
      email: { type: 'string', description: 'Account email (alternative to env)' },
      token: { type: 'string', description: 'API token (alternative to env)' },
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
      const { numberOfFiles, pushResponse } = await runWithAuth(auth, async () => {
        const n = await archive.makeArchive(env, { withoutAssets: true });
        const fd = {
          'marketplace_builder[partial_deploy]': String(partial),
          'marketplace_builder[zip_file]': fs.createReadStream(archivePath)
        };
        const pr = await gateway.push(fd);
        return { numberOfFiles: n, pushResponse: pr };
      });

      if (numberOfFiles === 0 || numberOfFiles === false) {
        return {
          ok: false,
          error: { code: 'EMPTY_ARCHIVE', message: 'No files to deploy. Archive would be empty.' }
        };
      }

      // Deploy assets in the background (S3 upload + CDN wait can take 90s+)
      let assetsInfo = null;
      try {
        const assetsToDeploy = await files.getAssets();
        if (assetsToDeploy.length > 0) {
          // Fire and forget - don't block the MCP response
          runWithAuth(auth, () => assets.deployAssets(gateway)).then(() => {
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
          id: pushResponse.id,
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
