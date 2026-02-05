// platformos.data.import - start a data import from JSON or ZIP
// JSON is converted to CSV/ZIP format internally (JSON import is deprecated)
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { jsonToZipBuffer } from './json-to-csv.js';
import { validateRecords, validateJsonStructure } from './validate.js';
import { DEBUG, debugLog } from '../config.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';
import isValidJSON from '../../lib/data/isValidJSON.js';
import { presignUrl } from '../../lib/presignUrl.js';
import { uploadFile } from '../../lib/s3UploadFile.js';

const settings = { fetchSettings };

async function resolveAuth(env, settingsModule = settings) {
  const found = await settingsModule.fetchSettings(env);
  if (found) return { ...found, source: `.pos(${env})` };
  throw new Error(`Environment "${env}" not found in .pos config`);
}

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

const dataImportTool = {
  description: 'Import data to platformOS instance. Accepts JSON (converted to CSV internally) or ZIP file with CSV files.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['env'],
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      filePath: { type: 'string', description: 'Path to JSON or ZIP file to import' },
      jsonData: { type: 'object', description: 'JSON data object to import (records, users)' },
      zipFileUrl: { type: 'string', description: 'Remote URL of ZIP archive to import' },
      validate: { type: 'boolean', description: 'Validate records before import (default: true)' },
      strictTypes: { type: 'boolean', description: 'Enforce type checking against schema (default: true)' },
      strictProperties: { type: 'boolean', description: 'Error on properties not defined in schema (default: false)' },
      appPath: { type: 'string', description: 'Path to the app directory containing schema files (default: ".")' }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    DEBUG && debugLog('tool:data-import invoked', { env: params.env });

    try {
      const auth = await resolveAuth(params.env, ctx.settings || settings);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      // Set env vars needed by presignUrl
      process.env.MARKETPLACE_TOKEN = auth.token;
      process.env.MARKETPLACE_URL = auth.url;

      const presignUrlFn = ctx.presignUrl || presignUrl;
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
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Provide one of: filePath, jsonData, or zipFileUrl' }
        };
      }
      if (sources.length > 1) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Provide only one of: filePath, jsonData, or zipFileUrl' }
        };
      }

      let zipUrl;

      if (zipFileUrl) {
        // Remote ZIP URL provided directly
        zipUrl = zipFileUrl;
      } else if (filePath) {
        const resolved = path.resolve(String(filePath));
        if (!fs.existsSync(resolved)) {
          return { ok: false, error: { code: 'FILE_NOT_FOUND', message: `File not found: ${resolved}` } };
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
            return {
              ok: false,
              error: { code: 'INVALID_JSON', message: `Invalid JSON in file: ${resolved}` }
            };
          }
          const parsed = JSON.parse(data);

          // Validate top-level structure
          if (validate) {
            const structureResult = validateJsonStructure(parsed);
            if (!structureResult.ok) {
              return structureResult;
            }
          }

          // Validate records before import if enabled
          if (validate && parsed.records && Array.isArray(parsed.records)) {
            const validationResult = await validateRecords(parsed.records, {
              appPath,
              strictTypes,
              strictProperties
            });
            if (!validationResult.ok) {
              return validationResult;
            }
          }

          const zipBuffer = await jsonToZipBuffer(parsed);
          zipUrl = await uploadZipBuffer(zipBuffer, gateway, presignUrlFn, uploadFileFn);
        }
      } else if (jsonData) {
        // Validate top-level structure
        if (validate) {
          const structureResult = validateJsonStructure(jsonData);
          if (!structureResult.ok) {
            return structureResult;
          }
        }

        // Validate records before import if enabled
        if (validate && jsonData.records && Array.isArray(jsonData.records)) {
          const validationResult = await validateRecords(jsonData.records, {
            appPath,
            strictTypes,
            strictProperties
          });
          if (!validationResult.ok) {
            return validationResult;
          }
        }

        // JSON data provided directly - convert to ZIP
        const zipBuffer = await jsonToZipBuffer(jsonData);
        zipUrl = await uploadZipBuffer(zipBuffer, gateway, presignUrlFn, uploadFileFn);
      }

      const formData = { zip_file_url: zipUrl };
      const importTask = await gateway.dataImportStart(formData);

      return {
        ok: true,
        data: {
          id: importTask.id,
          status: importTask.status
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    } catch (e) {
      DEBUG && debugLog('tool:data-import error', { error: String(e) });
      return {
        ok: false,
        error: { code: 'DATA_IMPORT_ERROR', message: String(e.message || e) },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    }
  }
};

export default dataImportTool;
