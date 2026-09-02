import { describe, test, expect } from 'vitest';
import { validate } from '#lib/validation/index.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1 },
    count: { type: 'integer', minimum: 0 },
    enabled: { type: 'boolean' }
  }
};

describe('validate', () => {
  test('accepts a conforming object', () => {
    const result = validate(schema, { name: 'core', count: 2 });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('reports a missing required property by name', () => {
    const result = validate(schema, { count: 1 });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("missing required property 'name'");
  });

  test('reports an unknown property by name', () => {
    const result = validate(schema, { name: 'core', bogus: true });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("unknown property 'bogus'");
  });

  test('rejects a wrong type and points at the property', () => {
    const result = validate(schema, { name: 'core', count: 'many' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('/count');
  });

  test('rejects a non-object payload', () => {
    expect(validate(schema, 'core').valid).toBe(false);
    expect(validate(schema, ['core']).valid).toBe(false);
    expect(validate(schema, null).valid).toBe(false);
  });

  test('collects every error, not just the first', () => {
    const result = validate(schema, { count: -1, enabled: 'yes' });
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  test('strict mode leaves the caller data untouched', () => {
    const data = { name: 'core', count: 2 };
    validate(schema, data);
    expect(data).toEqual({ name: 'core', count: 2 });
  });

  test('coercing mode converts query-string values in place', () => {
    const data = { name: 'core', count: '42', enabled: 'true' };
    const result = validate(schema, data, { mode: 'coercing' });

    expect(result.valid).toBe(true);
    expect(data.count).toBe(42);
    expect(data.enabled).toBe(true);
  });

  test('coercing mode still rejects values that cannot be coerced', () => {
    const result = validate(schema, { name: 'core', count: 'many' }, { mode: 'coercing' });
    expect(result.valid).toBe(false);
  });

  test('flags an uncompilable schema as our defect rather than bad input', () => {
    const result = validate({ type: 'not-a-real-type' }, {});
    expect(result.valid).toBe(false);
    expect(result.schemaError).toBe(true);
  });

  // schemaError routes to 500 / -32603, which blames our schema. An unknown mode is a
  // caller bug and a boolean schema is perfectly legal, so neither belongs on that path.
  test('throws on an unknown mode rather than blaming the schema', () => {
    expect(() => validate(schema, { name: 'core' }, { mode: 'nope' })).toThrow(RangeError);
    expect(() => validate(schema, { name: 'core' }, { mode: 'nope' })).toThrow(/Unknown validation mode/);
  });

  test('accepts boolean schemas, which cannot key the compile cache', () => {
    expect(validate(true, { anything: 1 })).toEqual({ valid: true });

    const rejected = validate(false, { anything: 1 });
    expect(rejected.valid).toBe(false);
    expect(rejected.schemaError).toBeUndefined();
  });

  test('does not return a data field', () => {
    expect(validate(schema, { name: 'core' })).not.toHaveProperty('data');
    expect(validate(schema, {})).not.toHaveProperty('data');
  });

  test('caps the summary message but keeps every error', () => {
    const wide = {
      type: 'object',
      properties: Object.fromEntries('abcdefgh'.split('').map(k => [k, { type: 'string' }]))
    };
    const data = Object.fromEntries('abcdefgh'.split('').map(k => [k, 1]));
    const result = validate(wide, data);

    expect(result.errors).toHaveLength(8);
    expect(result.message).toContain('(+3 more)');
  });

  test('compiles each schema once and reuses it', () => {
    // Counting compiles directly: a schema object validated twice must reach Ajv once.
    const counted = { type: 'object', properties: { name: { type: 'string' } } };
    const seen = [];
    const proxied = new Proxy(counted, {
      get(target, prop, receiver) {
        seen.push(prop);
        return Reflect.get(target, prop, receiver);
      }
    });

    validate(proxied, { name: 'a' });
    const afterFirst = seen.length;
    validate(proxied, { name: 'b' });

    expect(afterFirst).toBeGreaterThan(0);        // first call compiled, so it read the schema
    expect(seen.length).toBe(afterFirst);         // second call read nothing: cache hit
  });
});
