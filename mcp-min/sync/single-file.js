// sync.singleFile tool extracted from tools.js for maintainability
import fs from 'fs';
import path from 'path';

// Reuse pos-cli internals (ESM)
import files from '../../lib/files.js';
import { loadSettingsFileForModule } from '../../lib/settings.js';
import shouldBeSynced from '../../lib/shouldBeSynced.js';
import Gateway from '../../lib/proxy.js';
import { presignDirectory } from '../../lib/presignUrl.js';
import { uploadFileFormData } from '../../lib/s3UploadFile.js';
import { manifestGenerateForAssets } from '../../lib/assets/manifest.js';
import { fillInTemplateValues } from '../../lib/templates.js';
import dir from '../../lib/directories.js';
import log from '../log.js';
import { resolveAuth, runWithAuth } from '../auth.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError, kindForStatus } from '../tool-error.js';

// Alias for backwards compatibility
const templates = { fillInTemplateValues };

function toPosix(p) {
  return p.replace(/\\/g, '/');
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
  const key = data.fields.key.replace('assets/${filename}', `assets${fileSubdir}/${filename}`);
  data.fields.key = key;

  log?.(`[sync-file] Uploading asset to S3: ${relPath}`);
  log?.(`[sync-file] Presigned URL: ${data.url}`);
  log?.(`[sync-file] FormData fields: ${JSON.stringify(Object.keys(data.fields))}`);

  await uploadFileFormData(relPath, data);
  const manifest = manifestGenerateForAssets([relPath]);
  await gateway.sendManifest(manifest);
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
  return gateway.sync(formData);
}

async function deleteRemote({ gateway, relPath }) {
  const remotePath = computeRemotePath(relPath);
  const formData = { path: remotePath, primary_key: remotePath };
  return gateway.delete(formData);
}

const singleFileTool = {
  description: 'Upload one file to an instance, or delete it there. Deleting needs confirmDelete. To send a whole project, use deploy-start.',
  annotations: { destructiveHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      filePath: { type: 'string', description: 'File to sync; must be inside app/, marketplace_builder/ or modules/.' },
      ...authProperties,
      op: { type: 'string', enum: ['upload', 'delete'], description: 'Omit it to follow whether the file exists locally.' },
      dryRun: { type: 'boolean', description: 'Check the path, credentials and rules without sending anything.', default: false },
      confirmDelete: { type: 'boolean', description: 'Required before a delete will run.', default: false }
    },
    required: ['filePath']
  },
  handler: async (params, ctx) => {
    const logFn = ctx?.log || log.info.bind(log);
    const { filePath, op: opParam, dryRun = false, confirmDelete = false } = params || {};
    if (!filePath || typeof filePath !== 'string') {
      throw ToolError.input('INVALID_PARAM', 'filePath is required');
    }

    const relPath = normalizeLocalPath(filePath);
    const absPath = path.resolve(filePath);

    logFn(`[sync-file] Processing file: ${filePath} (normalized: ${relPath})`);

    // Validate location
    const allowedPrefixes = [dir.APP + '/', dir.LEGACY_APP + '/', dir.MODULES + '/'];
    const inAllowedDir = allowedPrefixes.some((p) => toPosix(relPath).startsWith(p));
    if (!inAllowedDir) {
      logFn(`[sync-file] File outside allowed directories: ${relPath}`);
      throw ToolError.input(
        'FILE_OUTSIDE_ALLOWED_DIRECTORIES',
        `File must be inside ${allowedPrefixes.join(', ')}`,
        { operation: 'noop', file: { localPath: filePath, normalizedPath: relPath } }
      );
    }

    const ignoreList = files.getIgnoreList();
    const should = shouldBeSynced(relPath, ignoreList);
    logFn(`[sync-file] Sync check for ${relPath}: shouldSync=${should}, ignoreList rules=${ignoreList.length}`);
    if (!should && opParam !== 'delete') {
      throw ToolError.input(
        'IGNORED_BY_RULES',
        'File is ignored by .posignore or rules',
        { operation: 'noop', file: { localPath: filePath, normalizedPath: relPath } }
      );
    }

    const exists = fs.existsSync(absPath);
    const op = opParam || (exists ? 'upload' : 'delete');
    logFn(`[sync-file] Operation determined: ${op} (file exists: ${exists})`);

    // Resolve auth
    const auth = await resolveAuth(params, ctx);
    logFn(`[sync-file] Auth resolved from: ${auth.source}, URL: ${auth.url}`);

    if (dryRun) {
      return {
        operation: op,
        file: {
          localPath: filePath,
          normalizedPath: relPath,
          isAsset: isAssetsPath(relPath),
          size: exists ? fs.statSync(absPath).size : null
        },
        server: { responseCode: null, method: null }
      };
    }

    const gateway = new Gateway({ url: auth.url, token: auth.token, email: auth.email });

    try {
      return await runWithAuth(auth, async () => {
        process.env.SYNC_SINGLE = 'true';

        if (op === 'delete') {
          logFn(`[sync-file] Starting delete operation for: ${relPath}`);
          if (!confirmDelete) {
            throw ToolError.input(
              'DELETE_PROTECTED',
              'confirmDelete=true is required to delete',
              { operation: 'delete', file: { localPath: filePath, normalizedPath: relPath } }
            );
          }
          const result = await deleteRemote({ gateway, relPath });
          logFn(`[sync-file] Delete completed for: ${relPath}`);
          return {
            operation: 'delete',
            file: { localPath: filePath, normalizedPath: computeRemotePath(relPath) },
            server: { responseCode: 200, method: 'gateway.delete', gatewayResponse: result || null }
          };
        }

        if (!exists) {
          throw ToolError.not_found(
            'FILE_NOT_FOUND',
            `Local file not found: ${filePath}`,
            { operation: 'upload', file: { localPath: filePath, normalizedPath: relPath } }
          );
        }

        if (isAssetsPath(relPath)) {
          logFn(`[sync-file] Uploading asset: ${relPath}`);
          await uploadAsset({ gateway, relPath, log: logFn });
          logFn(`[sync-file] Asset upload completed: ${relPath}`);
          return {
            operation: 'update',
            file: { localPath: filePath, normalizedPath: relPath, isAsset: true, size: fs.statSync(absPath).size }
          };
        } else {
          logFn(`[sync-file] Uploading non-asset: ${relPath}`);
          const res = await uploadNonAsset({ gateway, relPath, log: logFn });
          logFn(`[sync-file] Non-asset upload completed: ${relPath}, response status: ${res?.status || 'unknown'}`);
          return {
            operation: 'update',
            file: { localPath: filePath, normalizedPath: computeRemotePath(relPath), isAsset: false, size: fs.statSync(absPath).size }
          };
        }
      });
    } catch (e) {
      // Extract response body details (422 validation errors, etc.)
      const body = e?.response?.body;
      const serverError = body?.error || (Array.isArray(body?.errors) && body.errors.join(', ')) || null;
      const serverDetails = body?.details || null;
      const statusCode = e?.statusCode || e?.response?.statusCode || null;

      const detail = serverError || String(e?.message || e);
      logFn(`[sync-file] Error during ${op} for ${relPath} (${statusCode}): ${detail}`);

      // Kept because it reads the server's own error body out of the response, which the invoker
      // cannot see. The kind still follows the status, from the same table the invoker uses.
      if (e instanceof ToolError) throw e;
      throw new ToolError(kindForStatus(statusCode), 'GATEWAY_ERROR', detail, {
        statusCode,
        operation: op,
        file: { localPath: filePath, normalizedPath: relPath },
        ...(serverDetails && { server: serverDetails })
      });
    }
  }
};

export default singleFileTool;
export { computeRemotePath, normalizeLocalPath, toPosix };
