import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import {
  validateRecords,
  isValidDatetime,
  matchesSchemaType,
  validateJsonStructure
} from '../data/validate.js';
import {
  loadSchema,
  loadAllSchemas,
  parseSchemaYaml,
  getUploadVersions
} from '../data/validate-schemas.js';
import dataValidateTool from '../data/validate-tool.js';

// Path to example schemas
const EXAMPLES_APP_PATH = path.join(process.cwd(), 'examples', 'app');

// Sample valid record
const validRecord = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'photo',
  properties: {
    title: 'Sunset',
    description: 'A beautiful sunset',
    tags: ['nature', 'sunset'],
    file_size: 1024,
    imported_at: '2025-01-01T00:00:00Z',
    image: {
      path: 'photos/sunset.jpg',
      versions: {
        thumbnail: 'photos/sunset_thumb.jpg',
        medium: 'photos/sunset_med.jpg',
        large: 'photos/sunset_lg.jpg',
        full: 'photos/sunset_full.jpg'
      }
    }
  },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

describe('validate-schemas', () => {
  describe('parseSchemaYaml', () => {
    test('parses basic schema with name and properties', () => {
      const yaml = `
name: test
properties:
  - name: title
    type: string
  - name: count
    type: integer
`;
      const schema = parseSchemaYaml(yaml);
      expect(schema.name).toBe('test');
      expect(schema.properties).toHaveLength(2);
      expect(schema.properties[0]).toEqual({ name: 'title', type: 'string' });
      expect(schema.properties[1]).toEqual({ name: 'count', type: 'integer' });
    });

    test('parses schema with upload type and versions', () => {
      const yaml = `
name: photo
properties:
  - name: image
    type: upload
    options:
      versions:
        - name: thumbnail
        - name: large
`;
      const schema = parseSchemaYaml(yaml);
      expect(schema.name).toBe('photo');
      expect(schema.properties[0].type).toBe('upload');
      expect(schema.properties[0].options.versions).toEqual([
        { name: 'thumbnail' },
        { name: 'large' }
      ]);
    });

    test('handles empty properties', () => {
      const yaml = `
name: empty
properties:
`;
      const schema = parseSchemaYaml(yaml);
      expect(schema.name).toBe('empty');
      expect(schema.properties).toEqual([]);
    });
  });

  describe('loadSchema', () => {
    test('loads schema from examples/app/schema', () => {
      const schema = loadSchema('photo', path.join(process.cwd(), 'examples'));
      expect(schema).not.toBeNull();
      expect(schema.name).toBe('photo');
      expect(schema.properties.length).toBeGreaterThan(0);
    });

    test('returns null for non-existent schema', () => {
      const schema = loadSchema('nonexistent', EXAMPLES_APP_PATH);
      expect(schema).toBeNull();
    });
  });

  describe('loadAllSchemas', () => {
    test('loads all schemas from examples app', () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      expect(schemas.size).toBeGreaterThan(0);
      expect(schemas.has('photo')).toBe(true);
    });

    test('returns empty map for non-existent directory', () => {
      const schemas = loadAllSchemas('/nonexistent/path');
      expect(schemas.size).toBe(0);
    });
  });

  describe('getUploadVersions', () => {
    test('extracts version names from upload property', () => {
      const prop = {
        type: 'upload',
        options: {
          versions: [
            { name: 'thumbnail' },
            { name: 'large' }
          ]
        }
      };
      const versions = getUploadVersions(prop);
      expect(versions).toEqual(['thumbnail', 'large']);
    });

    test('returns empty array for non-upload type', () => {
      const prop = { type: 'string' };
      expect(getUploadVersions(prop)).toEqual([]);
    });

    test('returns empty array for upload without versions', () => {
      const prop = { type: 'upload' };
      expect(getUploadVersions(prop)).toEqual([]);
    });
  });
});

describe('validate helpers', () => {
  describe('isValidDatetime', () => {
    test('accepts valid ISO 8601 datetimes', () => {
      expect(isValidDatetime('2025-01-01T00:00:00Z')).toBe(true);
      expect(isValidDatetime('2025-01-01T12:30:45.123Z')).toBe(true);
      expect(isValidDatetime('2025-01-01')).toBe(true);
      expect(isValidDatetime('2025-01-01T00:00:00+00:00')).toBe(true);
    });

    test('rejects invalid datetimes', () => {
      expect(isValidDatetime('not-a-date')).toBe(false);
      expect(isValidDatetime('01/01/2025')).toBe(false);
      expect(isValidDatetime('')).toBe(false);
      expect(isValidDatetime(123)).toBe(false);
    });
  });

  describe('matchesSchemaType', () => {
    test('string type', () => {
      expect(matchesSchemaType('hello', 'string')).toBe(true);
      expect(matchesSchemaType(123, 'string')).toBe(false);
    });

    test('text type (alias for string)', () => {
      expect(matchesSchemaType('hello', 'text')).toBe(true);
      expect(matchesSchemaType(123, 'text')).toBe(false);
    });

    test('integer type', () => {
      expect(matchesSchemaType(42, 'integer')).toBe(true);
      expect(matchesSchemaType(42.5, 'integer')).toBe(false);
      expect(matchesSchemaType('42', 'integer')).toBe(false);
    });

    test('float type', () => {
      expect(matchesSchemaType(42.5, 'float')).toBe(true);
      expect(matchesSchemaType(42, 'float')).toBe(true);
      expect(matchesSchemaType('42.5', 'float')).toBe(false);
    });

    test('boolean type', () => {
      expect(matchesSchemaType(true, 'boolean')).toBe(true);
      expect(matchesSchemaType(false, 'boolean')).toBe(true);
      expect(matchesSchemaType('true', 'boolean')).toBe(false);
    });

    test('datetime type', () => {
      expect(matchesSchemaType('2025-01-01T00:00:00Z', 'datetime')).toBe(true);
      expect(matchesSchemaType('invalid', 'datetime')).toBe(false);
    });

    test('array type', () => {
      expect(matchesSchemaType([], 'array')).toBe(true);
      expect(matchesSchemaType(['a', 'b'], 'array')).toBe(true);
      expect(matchesSchemaType({}, 'array')).toBe(false);
    });

    test('upload type', () => {
      expect(matchesSchemaType({ path: 'file.jpg' }, 'upload')).toBe(true);
      expect(matchesSchemaType({}, 'upload')).toBe(true);
      expect(matchesSchemaType('file.jpg', 'upload')).toBe(false);
    });

    test('null values are allowed', () => {
      expect(matchesSchemaType(null, 'string')).toBe(true);
      expect(matchesSchemaType(undefined, 'integer')).toBe(true);
    });
  });
});

describe('validateJsonStructure', () => {
  test('accepts object with records key', () => {
    const result = validateJsonStructure({ records: [] });
    expect(result.ok).toBe(true);
  });

  test('accepts object with users key', () => {
    const result = validateJsonStructure({ users: [] });
    expect(result.ok).toBe(true);
  });

  test('accepts object with both records and users keys', () => {
    const result = validateJsonStructure({ records: [], users: [] });
    expect(result.ok).toBe(true);
  });

  test('rejects null', () => {
    const result = validateJsonStructure(null);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_STRUCTURE');
  });

  test('rejects array', () => {
    const result = validateJsonStructure([{ id: 1 }]);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_STRUCTURE');
  });

  test('rejects empty object', () => {
    const result = validateJsonStructure({});
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_STRUCTURE');
    expect(result.error.message).toContain('must contain at least one of');
  });

  test('rejects object with only unknown keys', () => {
    const result = validateJsonStructure({ items: [], data: {} });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_STRUCTURE');
    expect(result.error.message).toContain('must contain at least one of');
  });

  test('rejects object with mix of valid and unknown keys', () => {
    const result = validateJsonStructure({ records: [], extra: 'data' });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_STRUCTURE');
    expect(result.error.message).toContain('Unknown top-level keys');
    expect(result.error.message).toContain('extra');
  });

  test('rejects primitive values', () => {
    expect(validateJsonStructure('string').ok).toBe(false);
    expect(validateJsonStructure(123).ok).toBe(false);
    expect(validateJsonStructure(undefined).ok).toBe(false);
  });
});

describe('validateRecords', () => {
  describe('required field validation', () => {
    test('validates complete valid record', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const result = await validateRecords([validRecord], { schemas });
      expect(result.ok).toBe(true);
      expect(result.data.valid).toBe(true);
      expect(result.data.recordsValidated).toBe(1);
    });

    test('fails on missing id', async () => {
      const record = { ...validRecord };
      delete record.id;
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.details[0].errors[0].code).toBe('MISSING_ID');
    });

    test('accepts any non-empty id value', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const record = { ...validRecord, id: 'any-string-value' };
      const result = await validateRecords([record], { schemas });
      expect(result.ok).toBe(true);
    });

    test('fails on missing type', async () => {
      const record = { ...validRecord };
      delete record.type;
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'MISSING_TYPE')).toBe(true);
    });

    test('fails on missing properties', async () => {
      const record = { ...validRecord };
      delete record.properties;
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'MISSING_PROPERTIES')).toBe(true);
    });

    test('fails on non-object properties', async () => {
      const record = { ...validRecord, properties: 'not an object' };
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'INVALID_PROPERTIES')).toBe(true);
    });

    test('fails on missing created_at', async () => {
      const record = { ...validRecord };
      delete record.created_at;
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'MISSING_CREATED_AT')).toBe(true);
    });

    test('fails on invalid created_at format', async () => {
      const record = { ...validRecord, created_at: 'not-a-date' };
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e =>
        e.code === 'INVALID_DATETIME' && e.field === 'created_at'
      )).toBe(true);
    });

    test('fails on missing updated_at', async () => {
      const record = { ...validRecord };
      delete record.updated_at;
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'MISSING_UPDATED_AT')).toBe(true);
    });
  });

  describe('schema validation', () => {
    test('fails on unknown type when schema not found', async () => {
      const schemas = new Map(); // Empty schemas
      const record = { ...validRecord, type: 'nonexistent' };
      const result = await validateRecords([record], { schemas });
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'UNKNOWN_TYPE')).toBe(true);
    });

    test('fails on unknown property with strictProperties', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const record = {
        ...validRecord,
        properties: {
          ...validRecord.properties,
          unknown_field: 'value'
        }
      };
      const result = await validateRecords([record], { schemas, strictProperties: true });
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'UNKNOWN_PROPERTY')).toBe(true);
    });

    test('passes with unknown property when strictProperties is false', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const record = {
        ...validRecord,
        properties: {
          ...validRecord.properties,
          unknown_field: 'value'
        }
      };
      const result = await validateRecords([record], { schemas, strictProperties: false });
      expect(result.ok).toBe(true);
    });

    test('fails on type mismatch', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const record = {
        ...validRecord,
        properties: {
          ...validRecord.properties,
          file_size: 'not an integer' // Should be integer
        }
      };
      const result = await validateRecords([record], { schemas, strictTypes: true });
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'TYPE_MISMATCH')).toBe(true);
    });

    test('passes type mismatch when strictTypes is false', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const record = {
        ...validRecord,
        properties: {
          ...validRecord.properties,
          file_size: 'not an integer'
        }
      };
      const result = await validateRecords([record], { schemas, strictTypes: false });
      expect(result.ok).toBe(true);
    });
  });

  describe('upload version validation', () => {
    test('fails on invalid upload version', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const record = {
        ...validRecord,
        properties: {
          ...validRecord.properties,
          image: {
            path: 'photos/sunset.jpg',
            versions: {
              thumbnail: 'photos/sunset_thumb.jpg',
              invalid_version: 'photos/invalid.jpg'
            }
          }
        }
      };
      const result = await validateRecords([record], { schemas, strictTypes: true });
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'INVALID_VERSIONS')).toBe(true);
    });

    test('fails on missing upload versions', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const record = {
        ...validRecord,
        properties: {
          ...validRecord.properties,
          image: {
            path: 'photos/sunset.jpg',
            versions: {
              thumbnail: 'photos/sunset_thumb.jpg'
              // Missing: medium, large, full
            }
          }
        }
      };
      const result = await validateRecords([record], { schemas, strictTypes: true });
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'MISSING_VERSION')).toBe(true);
    });

    test('fails when versions object is omitted but schema defines versions', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const record = {
        ...validRecord,
        properties: {
          ...validRecord.properties,
          image: {
            path: 'photos/sunset.jpg'
            // versions object completely omitted
          }
        }
      };
      const result = await validateRecords([record], { schemas, strictTypes: true });
      expect(result.ok).toBe(false);
      expect(result.error.details[0].errors.some(e => e.code === 'MISSING_VERSION')).toBe(true);
    });

    test('passes when all required versions are provided', async () => {
      const schemas = loadAllSchemas(path.join(process.cwd(), 'examples'));
      const result = await validateRecords([validRecord], { schemas, strictTypes: true });
      expect(result.ok).toBe(true);
    });
  });

  describe('error limits and aggregation', () => {
    test('validates empty array successfully', async () => {
      const result = await validateRecords([]);
      expect(result.ok).toBe(true);
      expect(result.data.recordsValidated).toBe(0);
    });

    test('respects maxErrors limit', async () => {
      const badRecords = Array.from({ length: 50 }, () => ({
        // Missing all required fields
      }));
      const result = await validateRecords(badRecords, { maxErrors: 10 });
      expect(result.ok).toBe(false);
      // Should stop before processing all records
      const totalErrors = result.error.details.reduce((sum, d) => sum + d.errors.length, 0);
      expect(totalErrors).toBeLessThanOrEqual(15); // Some buffer for multiple errors per record
    });

    test('collects errors from multiple records', async () => {
      const records = [
        { id: 'invalid-uuid' },
        { type: 'test' },
        {}
      ];
      const result = await validateRecords(records);
      expect(result.ok).toBe(false);
      expect(result.error.details.length).toBe(3);
    });

    test('returns error for non-array input', async () => {
      const result = await validateRecords('not an array');
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('error response format', () => {
    test('error details include recordIndex, recordId, recordType', async () => {
      const record = { id: 'invalid', type: 'test' };
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      const detail = result.error.details[0];
      expect(detail.recordIndex).toBe(0);
      expect(detail.recordId).toBe('invalid');
      expect(detail.recordType).toBe('test');
    });

    test('error details include field, code, message, value', async () => {
      const record = { id: 'test', created_at: 'invalid-date' };
      const result = await validateRecords([record]);
      expect(result.ok).toBe(false);
      const error = result.error.details[0].errors.find(e => e.code === 'INVALID_DATETIME');
      expect(error.field).toBe('created_at');
      expect(error.code).toBe('INVALID_DATETIME');
      expect(error.message).toContain('Invalid datetime');
      expect(error.value).toBe('invalid-date');
    });
  });
});

describe('data-validate tool', () => {
  test('has correct description and inputSchema', () => {
    expect(dataValidateTool.description).toContain('Validate');
    expect(dataValidateTool.inputSchema.properties).toHaveProperty('env');
    expect(dataValidateTool.inputSchema.properties).toHaveProperty('filePath');
    expect(dataValidateTool.inputSchema.properties).toHaveProperty('jsonData');
    expect(dataValidateTool.inputSchema.properties).toHaveProperty('appPath');
    expect(dataValidateTool.inputSchema.properties).toHaveProperty('strictTypes');
    expect(dataValidateTool.inputSchema.properties).toHaveProperty('strictProperties');
    expect(dataValidateTool.inputSchema.properties).toHaveProperty('maxErrors');
  });

  test('returns error when no data source provided', async () => {
    const result = await dataValidateTool.handler({ env: 'staging' });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.message).toContain('Provide one of');
  });

  test('returns error when multiple data sources provided', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      filePath: '/path/to/file.json',
      jsonData: { records: [] }
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.message).toContain('only one');
  });

  test('returns error when file not found', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      filePath: '/nonexistent/file.json'
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('FILE_NOT_FOUND');
  });

  test('validates jsonData with valid records', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { records: [validRecord] },
      appPath: path.join(process.cwd(), 'examples')
    });
    expect(result.ok).toBe(true);
    expect(result.data.valid).toBe(true);
    expect(result.data.recordsValidated).toBe(1);
  });

  test('validates jsonData with invalid records', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { records: [{ id: 'invalid' }] }
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  test('validates file with valid JSON', async () => {
    const tmpFile = path.join(os.tmpdir(), 'test-validate.json');
    fs.writeFileSync(tmpFile, JSON.stringify({ records: [validRecord] }));

    try {
      const result = await dataValidateTool.handler({
        env: 'staging',
        filePath: tmpFile,
        appPath: path.join(process.cwd(), 'examples')
      });
      expect(result.ok).toBe(true);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('returns error for invalid JSON file', async () => {
    const tmpFile = path.join(os.tmpdir(), 'test-invalid.json');
    fs.writeFileSync(tmpFile, 'not json');

    try {
      const result = await dataValidateTool.handler({
        env: 'staging',
        filePath: tmpFile
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('INVALID_JSON');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('returns error when records is not an array', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { records: 'not an array' }
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_FORMAT');
  });

  test('includes meta timestamps', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { records: [] }
    });
    expect(result.meta).toBeDefined();
    expect(result.meta.startedAt).toBeDefined();
    expect(result.meta.finishedAt).toBeDefined();
  });

  test('respects strictProperties option', async () => {
    const recordWithUnknown = {
      ...validRecord,
      properties: {
        ...validRecord.properties,
        unknown_field: 'value'
      }
    };

    // Should pass without strictProperties
    const resultLax = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { records: [recordWithUnknown] },
      appPath: path.join(process.cwd(), 'examples'),
      strictProperties: false
    });
    expect(resultLax.ok).toBe(true);

    // Should fail with strictProperties
    const resultStrict = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { records: [recordWithUnknown] },
      appPath: path.join(process.cwd(), 'examples'),
      strictProperties: true
    });
    expect(resultStrict.ok).toBe(false);
  });

  test('rejects jsonData with invalid top-level structure', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { items: [] }
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_STRUCTURE');
    expect(result.meta).toBeDefined();
  });

  test('rejects jsonData with mix of valid and unknown keys', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { records: [], extra: 'data' }
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_STRUCTURE');
    expect(result.error.message).toContain('Unknown top-level keys');
  });

  test('accepts jsonData with only users key', async () => {
    const result = await dataValidateTool.handler({
      env: 'staging',
      jsonData: { users: [] }
    });
    expect(result.ok).toBe(true);
  });
});
