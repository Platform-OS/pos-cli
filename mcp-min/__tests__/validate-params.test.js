import { describe, test, expect } from 'vitest';
import tools from '../tools.js';
import { validateToolParams } from '../validate-params.js';

const check = (name, params) => validateToolParams(name, tools[name], params);

describe('tool input schemas', () => {
  test('every registered tool has a schema Ajv can compile', () => {
    const uncompilable = Object.entries(tools)
      .filter(([name, tool]) => validateToolParams(name, tool, {}).schemaError)
      .map(([name]) => name);

    expect(uncompilable).toEqual([]);
  });

  test('every registered tool declares an object schema', () => {
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.inputSchema?.type, `${name} inputSchema.type`).toBe('object');
    }
  });
});

describe('validateToolParams', () => {
  test('accepts params that match the schema', () => {
    expect(check('constants-set', { env: 'staging', name: 'API_KEY', value: 'x' }).valid).toBe(true);
  });

  test('rejects missing required params', () => {
    const result = check('constants-set', { env: 'staging' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("missing required property 'name'");
  });

  test('rejects unknown params on a closed schema', () => {
    const result = check('constants-list', { env: 'staging', dropTable: true });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("unknown property 'dropTable'");
  });

  test('rejects a param of the wrong type', () => {
    const result = check('logs-fetch', { limit: 'all' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('/limit');
  });

  test('rejects a param outside its declared range', () => {
    expect(check('logs-fetch', { limit: 999999 }).valid).toBe(false);
  });

  test('rejects params that are not an object at all', () => {
    expect(check('constants-list', 'staging').valid).toBe(false);
    expect(check('constants-list', ['staging']).valid).toBe(false);
  });

  test('treats absent params as an empty object', () => {
    expect(check('envs-list', undefined).valid).toBe(true);
    expect(check('constants-set', undefined).valid).toBe(false);
  });
});

// resolveAuth resolves credentials from params, then MPKIT_* env vars, then .pos — so a
// schema that made `env` mandatory would reject two of its three supported call styles.
describe('authentication params stay accepted', () => {
  const authenticating = [
    'constants-list',
    'constants-set',
    'constants-unset',
    'data-import',
    'data-import-status',
    'uploads-push',
    'unit-tests-run'
  ];

  const requiredExtras = {
    'constants-set': { name: 'A', value: '1' },
    'constants-unset': { name: 'A' },
    'data-import-status': { jobId: '1' },
    'uploads-push': { filePath: 'uploads.zip' },
    'unit-tests-run': { name: 'example_test' }
  };

  test.each(authenticating)('%s accepts explicit url/email/token without env', name => {
    const params = { url: 'https://example.com', email: 'a@b.c', token: 'tok', ...requiredExtras[name] };
    const result = check(name, params);

    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test.each(authenticating)('%s accepts env alone', name => {
    expect(check(name, { env: 'staging', ...requiredExtras[name] }).valid).toBe(true);
  });

  test.each(authenticating)('%s accepts no auth params (MPKIT_* / default .pos entry)', name => {
    expect(check(name, { ...requiredExtras[name] }).valid).toBe(true);
  });
});
