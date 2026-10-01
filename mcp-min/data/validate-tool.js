// platformos.data.validate - Validate JSON data against platformOS schemas
import fs from 'fs';
import path from 'path';
import { validateRecords, validateJsonStructure } from './validate.js';
import log from '../log.js';
import { ToolError } from '../tool-error.js';
import { recordCheckProperties } from '../schemas/record-checks.js';

const dataValidateTool = {
  description: 'Check records against the schema files in this project before importing them. Answers valid, with the problems when it is false: records that fail are the finding, not a failed call. Local only, nothing is sent to an instance. To lint Liquid and JSON source instead, use check-run.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    // Nothing is required, and nothing authenticates: validation reads the schema files in the
    // project and sends nothing. It used to accept `env`, which reached one debug line and
    // otherwise did nothing — a parameter that invites a caller to believe the check is
    // instance-aware.
    properties: {
      filePath: { type: 'string', description: 'JSON file holding the records.' },
      jsonData: { type: 'object', description: 'Records to check, as an object with a records array.' },
      ...recordCheckProperties,
      maxErrors: { type: 'integer', minimum: 1, description: 'Stop reporting after this many errors.', default: 100 }
    }
  },
  handler: async (params) => {
    log.debug('tool:data-validate invoked', { appPath: params.appPath });

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
      throw ToolError.input('VALIDATION_ERROR', 'Provide one of: filePath or jsonData');
    }
    if (sources.length > 1) {
      throw ToolError.input('VALIDATION_ERROR', 'Provide only one of: filePath or jsonData');
    }

    let data;

    if (filePath) {
      const resolved = path.resolve(String(filePath));
      if (!fs.existsSync(resolved)) {
        throw ToolError.not_found('FILE_NOT_FOUND', `File not found: ${resolved}`);
      }

      try {
        data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      } catch (e) {
        // The file could not be read as JSON, so there was nothing to check. That is a failure of
        // the call, unlike records that were checked and found wanting.
        throw ToolError.input('INVALID_JSON', `Invalid JSON in file: ${e.message}`);
      }
    } else {
      data = jsonData;
    }

    const structureResult = validateJsonStructure(data);
    if (!structureResult.ok) {
      throw ToolError.input(structureResult.error.code, structureResult.error.message, structureResult.error.details);
    }

    const records = data.records || [];
    if (!Array.isArray(records)) {
      throw ToolError.input('INVALID_FORMAT', 'Expected "records" field to be an array');
    }

    const result = await validateRecords(records, { appPath, strictTypes, strictProperties, maxErrors });

    // Records that fail the check are the answer, not a failure to produce one: this tool was
    // asked whether they are valid and it found out. It used to report them as `ok: false`, which
    // reached the client as a failed call and made the finding indistinguishable from the checker
    // itself breaking — and disagreed with check-run, which reports violations from a run that
    // worked. `valid` is what a caller branches on.
    if (result.ok) return { valid: true, ...result.data };
    return {
      valid: false,
      code: result.error.code,
      message: result.error.message,
      errors: result.error.details ?? []
    };
  }
};

export default dataValidateTool;
