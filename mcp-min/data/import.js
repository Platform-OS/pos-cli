// platformos.data.import - start a data import from JSON or ZIP
// JSON is converted to CSV/ZIP format internally (JSON import is deprecated)
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { jsonToZipBuffer } from './json-to-csv.js';
import { validateRecords, validateJsonStructure } from './validate.js';
import { authProperties } from '../schemas/auth.js';
import { recordCheckProperties } from '../schemas/record-checks.js';
import log from '../log.js';
import { ToolError } from '../tool-error.js';
import { resolveAuth } from '../auth.js';
import { mintFor } from '../jobs/handle.js';
import Gateway from '../../lib/proxy.js';
import isValidJSON from '../../lib/data/isValidJSON.js';
import { presignUrl } from '../../lib/presignUrl.js';
import { uploadFile } from '../../lib/s3UploadFile.js';

async function uploadZipBuffer(buffer, gateway, presignUrlFn, uploadFileFn) {
  // Write buffer to temp file for upload
  const tmpFile = path.join(os.tmpdir(), `pos-import-${crypto.randomBytes(8).toString('hex')}.zip`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const instanceId = (await gateway.getInstance()).id;
    const s3Path = `instances/${instanceId}/data_imports/${crypto.randomBytes(32).toString('hex')}.zip`;
    const { uploadUrl, accessUrl } = await presignUrlFn(s3Path, tmpFile);
    await uploadFileFn(tmpFile, uploadUrl);
    return accessUrl;
  } finally {
    // Cleanup temp file
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
}

/**
 * The record checks in `validate.js` are shared with `data-validate` and answer with their own
 * `{ ok, error }` result rather than by throwing, because that tool reports findings instead of
 * failing on them. Here they are a gate: records the caller has to fix before anything is sent,
 * so the check's own code and details travel out as an input error.
 */
function checked(result) {
  if (result.ok) return result;
  throw ToolError.input(result.error.code, result.error.message, result.error.details);
}

const dataImportTool = {
  description: 'Import records into an instance from a JSON object, a local JSON or ZIP file, or a remote ZIP URL. Returns a job_id to poll with job-status.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      filePath: { type: 'string', description: 'JSON or ZIP file to import.' },
      jsonData: { type: 'object', description: 'Records to import, as an object with records and users.' },
      zipFileUrl: { type: 'string', description: 'Remote ZIP to import.' },
      validate: { type: 'boolean', description: 'Check the records before importing them.', default: true },
      ...recordCheckProperties
    }
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:data-import invoked', { env: params.env });

    const auth = await resolveAuth(params, ctx);
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    // Passed, not exported: MARKETPLACE_* is process-wide, so this call and a deploy's
    // background upload could each restore the other's values.
    const presignUrlFn = ctx.presignUrl || ((s3Path, filePath) => presignUrl(s3Path, filePath, { url: auth.url, token: auth.token }));
    const uploadFileFn = ctx.uploadFile || uploadFile;

    const {
      filePath,
      jsonData,
      zipFileUrl,
      validate = true,
      strictTypes = true,
      strictProperties = false,
      appPath = '.'
    } = params;

    // Validate: exactly one data source must be provided
    const sources = [filePath, jsonData, zipFileUrl].filter(Boolean);
    if (sources.length === 0) {
      throw ToolError.input('VALIDATION_ERROR', 'Provide one of: filePath, jsonData, or zipFileUrl');
    }
    if (sources.length > 1) {
      throw ToolError.input('VALIDATION_ERROR', 'Provide only one of: filePath, jsonData, or zipFileUrl');
    }

    let zipUrl;

    if (zipFileUrl) {
      // Remote ZIP URL provided directly
      zipUrl = zipFileUrl;
    } else if (filePath) {
      const resolved = path.resolve(String(filePath));
      if (!fs.existsSync(resolved)) {
        throw ToolError.not_found('FILE_NOT_FOUND', `File not found: ${resolved}`);
      }

      const ext = path.extname(resolved).toLowerCase();
      if (ext === '.zip') {
        // Upload ZIP directly
        const instanceId = (await gateway.getInstance()).id;
        const s3Path = `instances/${instanceId}/data_imports/${crypto.randomBytes(32).toString('hex')}.zip`;
        const { uploadUrl, accessUrl } = await presignUrlFn(s3Path, resolved);
        await uploadFileFn(resolved, uploadUrl);
        zipUrl = accessUrl;
      } else {
        // Assume JSON file - convert to ZIP
        const data = fs.readFileSync(resolved, 'utf8');
        if (!isValidJSON(data)) {
          throw ToolError.input('INVALID_JSON', `Invalid JSON in file: ${resolved}`);
        }
        const parsed = JSON.parse(data);

        if (validate) checked(validateJsonStructure(parsed));
        if (validate && parsed.records && Array.isArray(parsed.records)) {
          checked(await validateRecords(parsed.records, { appPath, strictTypes, strictProperties }));
        }

        const zipBuffer = await jsonToZipBuffer(parsed);
        zipUrl = await uploadZipBuffer(zipBuffer, gateway, presignUrlFn, uploadFileFn);
      }
    } else if (jsonData) {
      if (validate) checked(validateJsonStructure(jsonData));
      if (validate && jsonData.records && Array.isArray(jsonData.records)) {
        checked(await validateRecords(jsonData.records, { appPath, strictTypes, strictProperties }));
      }

      // JSON data provided directly - convert to ZIP
      const zipBuffer = await jsonToZipBuffer(jsonData);
      zipUrl = await uploadZipBuffer(zipBuffer, gateway, presignUrlFn, uploadFileFn);
    }

    const formData = { zip_file_url: zipUrl };
    const importTask = await gateway.dataImportStart(formData);

    return {
      id: importTask.id,
      job_id: mintFor({ kind: 'data-import', id: importTask.id, origin: auth.url }),
      instanceStatus: importTask.status
    };
  }
};

export default dataImportTool;
