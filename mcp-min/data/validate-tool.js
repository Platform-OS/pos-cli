// platformos.data.validate - Validate JSON data against platformOS schemas
import { createRequire } from 'module';
import { validateRecords, validateJsonStructure } from './validate.js';
import { DEBUG, debugLog } from '../config.js';

const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

const dataValidateTool = {
  description: 'Validate JSON data against platformOS schemas before import. Checks required fields (id, type, properties, created_at, updated_at), verifies types match schema files in app/schema/, and validates property names and types.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['env'],
    properties: {
      env: {
        type: 'string',
        description: 'Environment name from .pos config (used for context, validation is local)'
      },
      filePath: {
        type: 'string',
        description: 'Path to JSON file containing records to validate'
      },
      jsonData: {
        type: 'object',
        description: 'JSON data object to validate (with "records" array)'
      },
      appPath: {
        type: 'string',
        description: 'Path to the app directory containing schema files (default: ".")'
      },
      strictTypes: {
        type: 'boolean',
        description: 'Enforce type checking against schema (default: true)'
      },
      strictProperties: {
        type: 'boolean',
        description: 'Error on properties not defined in schema (default: false)'
      },
      maxErrors: {
        type: 'integer',
        description: 'Maximum number of errors to report (default: 100)'
      }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    DEBUG && debugLog('tool:data-validate invoked', { env: params.env });

    try {
      const {
        filePath,
        jsonData,
        appPath = '.',
        strictTypes = true,
        strictProperties = false,
        maxErrors = 100
      } = params;

      // Validate: exactly one data source must be provided
      const sources = [filePath, jsonData].filter(Boolean);
      if (sources.length === 0) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Provide one of: filePath or jsonData'
          }
        };
      }
      if (sources.length > 1) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Provide only one of: filePath or jsonData'
          }
        };
      }

      let data;

      if (filePath) {
        const resolved = path.resolve(String(filePath));
        if (!fs.existsSync(resolved)) {
          return {
            ok: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: `File not found: ${resolved}`
            }
          };
        }

        try {
          const content = fs.readFileSync(resolved, 'utf8');
          data = JSON.parse(content);
        } catch (e) {
          return {
            ok: false,
            error: {
              code: 'INVALID_JSON',
              message: `Invalid JSON in file: ${e.message}`
            }
          };
        }
      } else {
        data = jsonData;
      }

      // Validate top-level structure
      const structureResult = validateJsonStructure(data);
      if (!structureResult.ok) {
        return {
          ...structureResult,
          meta: {
            startedAt,
            finishedAt: new Date().toISOString()
          }
        };
      }

      // Extract records array
      const records = data.records || [];

      if (!Array.isArray(records)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Expected "records" field to be an array'
          }
        };
      }

      // Run validation
      const result = await validateRecords(records, {
        appPath,
        strictTypes,
        strictProperties,
        maxErrors
      });

      return {
        ...result,
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    } catch (e) {
      DEBUG && debugLog('tool:data-validate error', { error: String(e) });
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: String(e.message || e)
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    }
  }
};

export default dataValidateTool;
