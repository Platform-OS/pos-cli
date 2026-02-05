// platformos.deploy.start - create archive and deploy to platformOS instance
import fs from 'fs';
import { DEBUG, debugLog } from '../config.js';
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';
import { makeArchive } from '../../lib/archive.js';
import { deployAssets } from '../../lib/assets.js';

// Aliases for backwards compatibility
const archive = { makeArchive };
const assets = { deployAssets };
import dir from '../../lib/directories.js';

const settings = { fetchSettings };

function maskToken(token) {
  if (!token) return token;
  return token.slice(0, 3) + '...' + token.slice(-3);
}

async function resolveAuth(params) {
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = await settings.fetchSettings(params.env);
    if (found) return { ...found, source: `.pos(${params.env})` };
  }
  const conf = files.getConfig();
  const firstEnv = conf && Object.keys(conf)[0];
  if (firstEnv) {
    const found = conf[firstEnv];
    if (found) return { ...found, source: `.pos(${firstEnv})` };
  }
  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

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
    DEBUG && debugLog('tool:deploy-start invoked', { env: params?.env, partial: params?.partial });

    try {
      const auth = await resolveAuth(params);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      // Set env vars needed by archive and assets modules
      process.env.MARKETPLACE_EMAIL = auth.email;
      process.env.MARKETPLACE_TOKEN = auth.token;
      process.env.MARKETPLACE_URL = auth.url;

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

      if (numberOfFiles === 0 || numberOfFiles === false) {
        return {
          ok: false,
          error: { code: 'EMPTY_ARCHIVE', message: 'No files to deploy. Archive would be empty.' }
        };
      }

      // Push the archive
      const formData = {
        'marketplace_builder[partial_deploy]': String(partial),
        'marketplace_builder[zip_file]': fs.createReadStream(archivePath)
      };

      const pushResponse = await gateway.push(formData);

      // Deploy assets directly to S3
      let assetsDeployed = null;
      try {
        const assetsToDeploy = await files.getAssets();
        if (assetsToDeploy.length > 0) {
          await assets.deployAssets(gateway);
          assetsDeployed = { count: assetsToDeploy.length };
        } else {
          assetsDeployed = { count: 0, skipped: true };
        }
      } catch (assetErr) {
        assetsDeployed = { error: String(assetErr) };
      }

      return {
        ok: true,
        data: {
          id: pushResponse.id,
          status: pushResponse.status
        },
        archive: { path: archivePath, fileCount: numberOfFiles },
        assets: assetsDeployed,
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source },
          params: { partial }
        }
      };
    } catch (e) {
      DEBUG && debugLog('tool:deploy-start error', { error: String(e) });
      return { ok: false, error: { code: 'DEPLOY_START_ERROR', message: String(e.message || e) } };
    }
  }
};

export default startDeployTool;
