// sync.singleFile tool extracted from tools.js for maintainability
import fs from 'fs';
import path from 'path';

// Reuse pos-cli internals (ESM)
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import shouldBeSynced from '../../lib/shouldBeSynced.js';
import Gateway from '../../lib/proxy.js';
import { presignDirectory } from '../../lib/presignUrl.js';
import { uploadFileFormData } from '../../lib/s3UploadFile.js';
import { manifestGenerateForAssets } from '../../lib/assets/manifest.js';
import { fillInTemplateValues } from '../../lib/templates.js';
import dir from '../../lib/directories.js';

// Alias for backwards compatibility
const settings = { fetchSettings };
const templates = { fillInTemplateValues };

// Helpers (kept local to this module)
function maskToken(token) {
  if (!token) return token;
  return token.slice(0, 3) + '...' + token.slice(-3);
}

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function resolveAuth(params) {
  // precedence: explicit params -> env (MPKIT_*) -> .pos
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = settings.fetchSettings(params.env);
    if (found) return { ...found, source: `.pos(${params.env})` };
  }
  // fallback: first env from .pos if present
  const conf = files.getConfig();
  const firstEnv = Object.keys(conf || {})[0];
  if (firstEnv) {
    const found = conf[firstEnv];
    if (found) return { ...found, source: `.pos(${firstEnv})` };
  }
  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

function normalizeLocalPath(filePathParam) {
  const abs = path.resolve(filePathParam);
  const rel = path.relative(process.cwd(), abs);
  return toPosix(rel);
}

function computeRemotePath(relPath) {
  // remove leading app/ or marketplace_builder/ like pos-cli watch.filePathUnixified
  const posix = toPosix(relPath);
  const reApp = new RegExp(`^${dir.APP}/`);
  const reLegacy = new RegExp(`^${dir.LEGACY_APP}/`);
  return posix.replace(reApp, '').replace(reLegacy, '');
}

function isAssetsPath(relPath) {
  return relPath.startsWith('app/assets') || /^modules\/\w+\/public\/assets/.test(relPath);
}

async function uploadAsset({ gateway, relPath }) {
  // Prepare direct upload data
  const instance = await gateway.getInstance();
  const remoteAssetsDir = `instances/${instance.id}/assets`;
  const data = await presignDirectory(remoteAssetsDir);

  const dirname = path.posix.dirname(relPath);
  const fileSubdir = relPath.startsWith('app/assets')
    ? dirname.replace('app/assets', '')
    : '/' + dirname.replace('/public/assets', '');
  const key = data.fields.key.replace('assets/${filename}', `assets${fileSubdir}/\${filename}`);
  data.fields.key = key;

  await uploadFileFormData(relPath, data);
  const manifest = manifestGenerateForAssets([relPath]);
  await gateway.sendManifest(manifest);
  return { ok: true };
}

async function uploadNonAsset({ gateway, relPath }) {
  const remotePath = computeRemotePath(relPath);
  const processTemplate = remotePath.startsWith('modules');
  let body;
  if (processTemplate) {
    const moduleName = relPath.split('/')[1];
    const moduleData = settings.loadSettingsFileForModule(moduleName);
    body = templates.fillInTemplateValues(relPath, moduleData);
  } else {
    body = fs.createReadStream(relPath);
  }
  const formData = { path: remotePath, marketplace_builder_file_body: body };
  const resp = await gateway.sync(formData);
  return { ok: true, response: resp };
}

async function deleteRemote({ gateway, relPath }) {
  const remotePath = computeRemotePath(relPath);
  const formData = { path: remotePath, primary_key: remotePath };
  const resp = await gateway.delete(formData);
  return { ok: true, response: resp };
}

const singleFileTool = {
  description: 'Sync a file with a platformOS instance (upload or delete).',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      filePath: { type: 'string' },
      env: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      token: { type: 'string' },
      op: { type: 'string', enum: ['upload', 'delete'] },
      dryRun: { type: 'boolean' },
      confirmDelete: { type: 'boolean' }
    },
    required: ['filePath']
  },
  handler: async (params, ctx) => {
    const startedAt = new Date().toISOString();
    const { filePath, op: opParam, dryRun = false, confirmDelete = false } = params || {};
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('INVALID_PARAM: filePath is required');
    }

    const relPath = normalizeLocalPath(filePath);
    const absPath = path.resolve(filePath);

    // Validate location
    const allowedPrefixes = [dir.APP + '/', dir.LEGACY_APP + '/', dir.MODULES + '/'];
    const inAllowedDir = allowedPrefixes.some((p) => toPosix(relPath).startsWith(p));
    if (!inAllowedDir) {
      return {
        success: false,
        operation: 'noop',
        error: { code: 'FILE_OUTSIDE_ALLOWED_DIRECTORIES', message: `File must be inside ${allowedPrefixes.join(', ')}` },
        file: { localPath: filePath, normalizedPath: relPath }
      };
    }

    const ignoreList = files.getIgnoreList();
    const should = shouldBeSynced(relPath, ignoreList);
    if (!should && opParam !== 'delete') {
      return {
        success: false,
        operation: 'noop',
        error: { code: 'IGNORED_BY_RULES', message: 'File is ignored by .posignore or rules' },
        file: { localPath: filePath, normalizedPath: relPath }
      };
    }

    const exists = fs.existsSync(absPath);
    const op = opParam || (exists ? 'upload' : 'delete');

    // Resolve auth and prepare Gateway
    const auth = resolveAuth(params);
    // set env vars expected by pos-cli internals (presignDirectory)
    process.env.MARKETPLACE_EMAIL = auth.email;
    process.env.MARKETPLACE_TOKEN = auth.token;
    process.env.MARKETPLACE_URL = auth.url;
    process.env.SYNC_SINGLE = 'true';

    if (dryRun) {
      return {
        success: true,
        operation: op,
        file: {
          localPath: filePath,
          normalizedPath: relPath,
          isAsset: isAssetsPath(relPath),
          size: exists ? fs.statSync(absPath).size : null
        },
        server: { responseCode: null, method: null },
        timings: { startedAt, finishedAt: new Date().toISOString(), durationMs: 0 },
        auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
      };
    }

    const gateway = new Gateway({ url: auth.url, token: auth.token, email: auth.email });

    try {
      if (op === 'delete') {
        if (!confirmDelete) {
          return {
            success: false,
            operation: 'delete',
            error: { code: 'DELETE_PROTECTED', message: 'confirmDelete=true is required to delete' },
            file: { localPath: filePath, normalizedPath: relPath }
          };
        }
        const result = await deleteRemote({ gateway, relPath });
        return {
          success: true,
          operation: 'delete',
          file: { localPath: filePath, normalizedPath: computeRemotePath(relPath) },
          server: { responseCode: 200, method: 'gateway.delete', gatewayResponse: result.response || null },
          timings: { startedAt, finishedAt: new Date().toISOString() }
        };
      }

      if (!exists) {
        return {
          success: false,
          operation: 'upload',
          error: { code: 'FILE_NOT_FOUND', message: `Local file not found: ${filePath}` },
          file: { localPath: filePath, normalizedPath: relPath }
        };
      }

      if (isAssetsPath(relPath)) {
        await uploadAsset({ gateway, relPath });
        return {
          success: true,
          operation: 'update',
          file: { localPath: filePath, normalizedPath: relPath, isAsset: true, size: fs.statSync(absPath).size },
          // server: { responseCode: 200, method: 'asset.directUpload+manifest' },
          timings: { startedAt, finishedAt: new Date().toISOString() }
        };
      } else {
        const res = await uploadNonAsset({ gateway, relPath });
        return {
          success: true,
          operation: 'update',
          file: { localPath: filePath, normalizedPath: computeRemotePath(relPath), isAsset: false, size: fs.statSync(absPath).size },
          // server: { responseCode: 200, method: 'gateway.sync', gatewayResponse: res.response || null },
          timings: { startedAt, finishedAt: new Date().toISOString() }
        };
      }
    } catch (e) {
      // Fail hard: surface the underlying request error to the caller to allow pipelines to stop
      const errPayload = {
        code: 'GATEWAY_ERROR',
        message: String(e?.message || e),
        details: {
          operation: op,
          file: { localPath: filePath, normalizedPath: relPath }
        }
      };
      const err = new Error(`${errPayload.code}: ${errPayload.message}`);
      // Attach structured info for HTTP/JSON-RPC layers that may include it in responses
      err._pos = errPayload;
      throw err;
    }
  }
};

export default singleFileTool;
export { computeRemotePath, normalizeLocalPath, toPosix };
