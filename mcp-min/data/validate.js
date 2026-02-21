// Core validation module for platformOS data import
// Validates JSON records against schema definitions

import { loadSchema, loadAllSchemas, getUploadVersions } from './validate-schemas.js';

// UUID v4 regex pattern
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 datetime regex (flexible)
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Validate UUID v4 format
 */
function isValidUUID(value) {
  return typeof value === 'string' && UUID_V4_REGEX.test(value);
}

/**
 * Validate ISO 8601 datetime format
 */
function isValidDatetime(value) {
  if (typeof value !== 'string') return false;
  if (!ISO_DATETIME_REGEX.test(value)) return false;
  // Also verify it parses to a valid date
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Check if a JS value matches a schema type
 */
function matchesSchemaType(value, schemaType) {
  if (value === null || value === undefined) {
    // null/undefined allowed for optional fields
    return true;
  }

  switch (schemaType) {
    case 'string':
    case 'text':
      return typeof value === 'string';

    case 'integer':
      return Number.isInteger(value);

    case 'float':
      return typeof value === 'number' && !isNaN(value);

    case 'boolean':
      return typeof value === 'boolean';

    case 'datetime':
      return isValidDatetime(value);

    case 'array':
      return Array.isArray(value);

    case 'upload':
      // Upload can be object with path, or null
      if (typeof value !== 'object' || value === null) return false;
      // Must have path property
      return typeof value.path === 'string' || value.path === undefined;

    default:
      // Unknown type - be permissive
      return true;
  }
}

/**
 * Validate upload property versions against schema
 */
function validateUploadVersions(value, schemaProperty) {
  const errors = [];
  if (!value || typeof value !== 'object') return errors;

  const expectedVersions = getUploadVersions(schemaProperty);
  if (expectedVersions.length === 0) return errors;

  const providedVersions = (value.versions && typeof value.versions === 'object')
    ? Object.keys(value.versions)
    : [];

  // Check for missing versions (defined in schema but not provided)
  for (const version of expectedVersions) {
    if (!providedVersions.includes(version)) {
      errors.push({
        field: `versions.${version}`,
        code: 'MISSING_VERSION',
        message: `Missing required version "${version}". Expected versions: ${expectedVersions.join(', ')}`,
        value: undefined
      });
    }
  }

  // Check for unknown versions (provided but not in schema)
  for (const version of providedVersions) {
    if (!expectedVersions.includes(version)) {
      errors.push({
        field: `versions.${version}`,
        code: 'INVALID_VERSIONS',
        message: `Unknown version "${version}". Expected one of: ${expectedVersions.join(', ')}`,
        value: version
      });
    }
  }

  return errors;
}

/**
 * Validate a single record against schema
 */
function validateRecord(record, index, schemas, options) {
  const errors = [];
  const { strictTypes = true, strictProperties = false } = options;

  // Required field: id (any non-empty value)
  if (!record.id && record.id !== 0) {
    errors.push({
      field: 'id',
      code: 'MISSING_ID',
      message: 'Record is missing required field "id"',
      value: undefined
    });
  }

  // Required field: type
  if (!record.type) {
    errors.push({
      field: 'type',
      code: 'MISSING_TYPE',
      message: 'Record is missing required field "type"',
      value: undefined
    });
  }

  // Required field: properties
  if (!record.properties) {
    errors.push({
      field: 'properties',
      code: 'MISSING_PROPERTIES',
      message: 'Record is missing required field "properties"',
      value: undefined
    });
  } else if (typeof record.properties !== 'object' || Array.isArray(record.properties)) {
    errors.push({
      field: 'properties',
      code: 'INVALID_PROPERTIES',
      message: 'Field "properties" must be an object',
      value: typeof record.properties
    });
  }

  // Required field: created_at
  if (!record.created_at) {
    errors.push({
      field: 'created_at',
      code: 'MISSING_CREATED_AT',
      message: 'Record is missing required field "created_at"',
      value: undefined
    });
  } else if (!isValidDatetime(record.created_at)) {
    errors.push({
      field: 'created_at',
      code: 'INVALID_DATETIME',
      message: `Invalid datetime format for "created_at": "${record.created_at}"`,
      value: record.created_at
    });
  }

  // Required field: updated_at
  if (!record.updated_at) {
    errors.push({
      field: 'updated_at',
      code: 'MISSING_UPDATED_AT',
      message: 'Record is missing required field "updated_at"',
      value: undefined
    });
  } else if (!isValidDatetime(record.updated_at)) {
    errors.push({
      field: 'updated_at',
      code: 'INVALID_DATETIME',
      message: `Invalid datetime format for "updated_at": "${record.updated_at}"`,
      value: record.updated_at
    });
  }

  // Schema validation (only if type is present and schemas are loaded)
  if (record.type && schemas) {
    const schema = schemas.get(record.type);

    if (!schema) {
      errors.push({
        field: 'type',
        code: 'UNKNOWN_TYPE',
        message: `No schema found for type "${record.type}"`,
        value: record.type
      });
    } else if (record.properties && typeof record.properties === 'object') {
      // Build property map from schema
      const schemaProps = new Map();
      for (const prop of schema.properties || []) {
        schemaProps.set(prop.name, prop);
      }

      // Validate each property in the record
      for (const [propName, propValue] of Object.entries(record.properties)) {
        const schemaProp = schemaProps.get(propName);

        if (!schemaProp) {
          if (strictProperties) {
            errors.push({
              field: `properties.${propName}`,
              code: 'UNKNOWN_PROPERTY',
              message: `Property "${propName}" is not defined in schema "${record.type}"`,
              value: propValue
            });
          }
          continue;
        }

        // Type validation
        if (strictTypes && propValue !== null && propValue !== undefined) {
          if (!matchesSchemaType(propValue, schemaProp.type)) {
            errors.push({
              field: `properties.${propName}`,
              code: 'TYPE_MISMATCH',
              message: `Property "${propName}" has wrong type. Expected "${schemaProp.type}", got "${typeof propValue}"`,
              value: propValue
            });
          }

          // Upload version validation
          if (schemaProp.type === 'upload' && typeof propValue === 'object') {
            const versionErrors = validateUploadVersions(propValue, schemaProp);
            errors.push(...versionErrors.map(e => ({
              ...e,
              field: `properties.${propName}.${e.field}`
            })));
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate an array of records against platformOS schemas
 *
 * @param {Array} records - Array of record objects to validate
 * @param {Object} options - Validation options
 * @param {string} options.appPath - Path to the app directory (default: '.')
 * @param {boolean} options.strictTypes - Enforce type checking (default: true)
 * @param {boolean} options.strictProperties - Error on unknown properties (default: false)
 * @param {number} options.maxErrors - Maximum errors to collect (default: 100)
 * @param {Map} options.schemas - Pre-loaded schemas (optional, will load if not provided)
 * @returns {Object} Validation result { ok, data?, error? }
 */
export async function validateRecords(records, options = {}) {
  const {
    appPath = '.',
    strictTypes = true,
    strictProperties = false,
    maxErrors = 100,
    schemas: preloadedSchemas
  } = options;

  // Input validation
  if (!Array.isArray(records)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Records must be an array',
        details: []
      }
    };
  }

  if (records.length === 0) {
    return {
      ok: true,
      data: {
        valid: true,
        recordsValidated: 0
      }
    };
  }

  // Load schemas
  const schemas = preloadedSchemas || loadAllSchemas(appPath);

  const allErrors = [];
  let totalErrors = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordErrors = validateRecord(record, i, schemas, { strictTypes, strictProperties });

    if (recordErrors.length > 0) {
      allErrors.push({
        recordIndex: i,
        recordId: record.id || '(no id)',
        recordType: record.type || '(no type)',
        errors: recordErrors
      });

      totalErrors += recordErrors.length;
      if (totalErrors >= maxErrors) {
        break;
      }
    }
  }

  if (allErrors.length > 0) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Validation failed with ${totalErrors} error(s) in ${allErrors.length} record(s)`,
        details: allErrors
      }
    };
  }

  return {
    ok: true,
    data: {
      valid: true,
      recordsValidated: records.length
    }
  };
}

const VALID_TOP_LEVEL_KEYS = ['records', 'users'];

/**
 * Validate the top-level structure of import JSON data
 * Must have at least one of: records, users
 * @param {any} data - The parsed JSON data
 * @returns {Object} { ok: true } or { ok: false, error: { code, message } }
 */
function validateJsonStructure(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STRUCTURE',
        message: 'Import data must be an object with "records" and/or "users" keys'
      }
    };
  }

  const topKeys = Object.keys(data);
  const validKeys = topKeys.filter(k => VALID_TOP_LEVEL_KEYS.includes(k));
  const invalidKeys = topKeys.filter(k => !VALID_TOP_LEVEL_KEYS.includes(k));

  if (validKeys.length === 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STRUCTURE',
        message: `Import data must contain at least one of: ${VALID_TOP_LEVEL_KEYS.join(', ')}. Found keys: ${topKeys.join(', ') || '(none)'}`
      }
    };
  }

  if (invalidKeys.length > 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STRUCTURE',
        message: `Unknown top-level keys: ${invalidKeys.join(', ')}. Valid keys are: ${VALID_TOP_LEVEL_KEYS.join(', ')}`
      }
    };
  }

  return { ok: true };
}

// Export helper functions for testing
export { isValidUUID, isValidDatetime, matchesSchemaType, validateRecord, validateJsonStructure };
