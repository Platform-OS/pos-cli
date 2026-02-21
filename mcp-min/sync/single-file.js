// sync.singleFile tool extracted from tools.js for maintainability
import fs from 'fs';
import path from 'path';

// Reuse pos-cli internals (ESM)
import files from '../../lib/files.js';
import { fetchSettings, loadSettingsFileForModule } from '../../lib/settings.js';
import shouldBeSynced from '../../lib/shouldBeSynced.js';
import Gateway from '../../lib/proxy.js';
import { presignDirectory } from '../../lib/presignUrl.js';
import { uploadFileFormData } from '../../lib/s3UploadFile.js';
import { manifestGenerateForAssets } from '../../lib/assets/manifest.js';
import { fillInTemplateValues } from '../../lib/templates.js';
import dir from '../../lib/directories.js';
import log from '../log.js';

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

async function resolveAuth(params) {
  // precedence: explicit params -> env (MPKIT_*) -> .pos
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

async function uploadAsset({ gateway, relPath, log }) {
  // Prepare direct upload data
  const instance = await gateway.getInstance();
  const remoteAssetsDir = `instances/${instance.id}/assets`;
  const data = await presignDirectory(remoteAssetsDir);

  const dirname = path.posix.dirname(relPath);
  const fileSubdir = relPath.startsWith('app/assets')
    ? dirname.replace('app/assets', '')
    : '/' + dirname.replace('/public/assets', '');
  const key = data.fields.key.replace('assets/\${filename}', `assets${fileSubdir}/\${filename}`);
  data.fields.key = key;

  log?.(`[sync-file] Uploading asset to S3: ${relPath}`);
  log?.(`[sync-file] Presigned URL: ${data.url}`);
  log?.(`[sync-file] FormData fields: ${JSON.stringify(Object.keys(data.fields))}`);

  await uploadFileFormData(relPath, data);
  const manifest = manifestGenerateForAssets([relPath]);
  await gateway.sendManifest(manifest);
  return { ok: true };
}

async function uploadNonAsset({ gateway, relPath, log }) {
  const remotePath = computeRemotePath(relPath);
  const processTemplate = remotePath.startsWith('modules');
  let body;
  if (processTemplate) {
    const moduleName = relPath.split('/')[1];
    const moduleData = loadSettingsFileForModule(moduleName);
    body = templates.fillInTemplateValues(relPath, moduleData);
    log?.(`[sync-file] Processing template for module: ${moduleName}`);
  } else {
    body = fs.createReadStream(relPath);
    log?.(`[sync-file] Streaming file: ${relPath}`);
  }
  const formData = { path: remotePath, marketplace_builder_file_body: body };
  log?.(`[sync-file] Sync formData: path=${remotePath}, body type=${processTemplate ? 'template' : 'stream'}`);
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
  description: 'Sync a single file to a platformOS instance (upload or delete). Handles assets (direct S3 upload + manifest) and non-assets (gateway sync) automatically. Respects .posignore rules. Auth resolved from: explicit params > MPKIT_* env vars > .pos config. Use dryRun to validate without sending.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      filePath: { type: 'string', description: 'Absolute or relative path to the file to sync. Must be inside app/, marketplace_builder/, or modules/.' },
      env: { type: 'string', description: 'Environment name from .pos config (e.g., staging, production). Used to resolve auth when url/email/token are not provided.' },
      url: { type: 'string', description: 'Instance URL (e.g., https://my-app.staging.oregon.platform-os.com). Requires email and token.' },
      email: { type: 'string', description: 'Email for instance authentication. Required with url and token.' },
      token: { type: 'string', description: 'API token for instance authentication. Required with url and email.' },
      op: { type: 'string', enum: ['upload', 'delete'], description: 'Operation: "upload" to push file, "delete" to remove from instance. Auto-detected from file existence if omitted.' },
      dryRun: { type: 'boolean', description: 'Validate file path, auth, and sync rules without actually uploading. Default: false.' },
      confirmDelete: { type: 'boolean', description: 'Safety flag — must be true to execute delete operations. Default: false.' }
    },
    required: ['filePath']
  },
handler: async (params, ctx) => {
    const startedAt = new Date().toISOString();
    const logFn = ctx?.log || log.info.bind(log);
    const { filePath, op: opParam, dryRun = false, confirmDelete = false } = params || {};
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('INVALID_PARAM: filePath is required');
    }

    const relPath = normalizeLocalPath(filePath);
    const absPath = path.resolve(filePath);

    logFn(`[sync-file] Processing file: ${filePath} (normalized: ${relPath})`);

    // Validate location
    const allowedPrefixes = [dir.APP + '/', dir.LEGACY_APP + '/', dir.MODULES + '/'];
    const inAllowedDir = allowedPrefixes.some((p) => toPosix(relPath).startsWith(p));
    if (!inAllowedDir) {
      logFn(`[sync-file] File outside allowed directories: ${relPath}`);
      return {
        success: false,
        operation: 'noop',
        error: { code: 'FILE_OUTSIDE_ALLOWED_DIRECTORIES', message: `File must be inside ${allowedPrefixes.join(', ')}` },
        file: { localPath: filePath, normalizedPath: relPath }
      };
    }

    const ignoreList = files.getIgnoreList();
    const should = shouldBeSynced(relPath, ignoreList);
    logFn(`[sync-file] Sync check for ${relPath}: shouldSync=${should}, ignoreList rules=${ignoreList.length}`);
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
    logFn(`[sync-file] Operation determined: ${op} (file exists: ${exists})`);

    // Resolve auth and prepare Gateway
    const auth = await resolveAuth(params);
    logFn(`[sync-file] Auth resolved from: ${auth.source}, URL: ${auth.url}`);
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
        logFn(`[sync-file] Starting delete operation for: ${relPath}`);
        if (!confirmDelete) {
          return {
            success: false,
            operation: 'delete',
            error: { code: 'DELETE_PROTECTED', message: 'confirmDelete=true is required to delete' },
            file: { localPath: filePath, normalizedPath: relPath }
          };
        }
        const result = await deleteRemote({ gateway, relPath });
        logFn(`[sync-file] Delete completed for: ${relPath}`);
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
        logFn(`[sync-file] Uploading asset: ${relPath}`);
        await uploadAsset({ gateway, relPath, log: logFn });
        logFn(`[sync-file] Asset upload completed: ${relPath}`);
        return {
          success: true,
          operation: 'update',
          file: { localPath: filePath, normalizedPath: relPath, isAsset: true, size: fs.statSync(absPath).size },
          // server: { responseCode: 200, method: 'asset.directUpload+manifest' },
          timings: { startedAt, finishedAt: new Date().toISOString() }
        };
      } else {
        logFn(`[sync-file] Uploading non-asset: ${relPath}`);
        const res = await uploadNonAsset({ gateway, relPath, log: logFn });
        logFn(`[sync-file] Non-asset upload completed: ${relPath}, response status: ${res.response?.status || 'unknown'}`);
        return {
          success: true,
          operation: 'update',
          file: { localPath: filePath, normalizedPath: computeRemotePath(relPath), isAsset: false, size: fs.statSync(absPath).size },
          // server: { responseCode: 200, method: 'gateway.sync', gatewayResponse: res.response || null },
          timings: { startedAt, finishedAt: new Date().toISOString() }
        };
      }
    } catch (e) {
      // Extract response body details (422 validation errors, etc.)
      const body = e?.response?.body;
      const serverError = body?.error || (Array.isArray(body?.errors) && body.errors.join(', ')) || null;
      const serverDetails = body?.details || null;
      const statusCode = e?.statusCode || e?.response?.statusCode || null;

      const detail = serverError || String(e?.message || e);
      logFn(`[sync-file] Error during ${op} for ${relPath} (${statusCode}): ${detail}`);

      const errPayload = {
        code: 'GATEWAY_ERROR',
        message: detail,
        statusCode,
        details: {
          operation: op,
          file: { localPath: filePath, normalizedPath: relPath },
          ...(serverDetails && { server: serverDetails })
        }
      };
      const err = new Error(`${errPayload.code}: ${detail}`);
      err._pos = errPayload;
      throw err;
    }
  }
};

export default singleFileTool;
export { computeRemotePath, normalizeLocalPath, toPosix };
