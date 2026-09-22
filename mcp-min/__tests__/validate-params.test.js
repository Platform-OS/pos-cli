import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fg from 'fast-glob';
import registry from '../tools.js';
import { validateToolParams, TOOL_SCHEMA_DIALECT } from '../validate-params.js';
import { runTool } from '../run-tool.js';
import { authProperties } from '../schemas/auth.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const authFileList = fg
  .sync('mcp-min/**/*.js', { cwd: repoRoot, absolute: true, ignore: ['**/__tests__/**', '**/node_modules/**'] })
  .filter(file => !file.endsWith(`${path.sep}auth.js`))
  .filter(file => /\bresolveAuth\(/.test(fs.readFileSync(file, 'utf8')));

// Imported once at module scope so test.each can be built from real tool objects.
const authTools = await Promise.all(
  authFileList.map(file => import(pathToFileURL(file).href).then(mod => mod.default))
);

const check = (name, params) => validateToolParams(name, registry.get(name), params);

describe('tool input schemas', () => {
  test('every registered tool has a schema Ajv can compile', () => {
    const uncompilable = [...registry]
      .filter(([name, tool]) => validateToolParams(name, tool, {}).schemaError)
      .map(([name]) => name);

    expect(uncompilable).toEqual([]);
  });

  test('every registered tool declares an object schema', () => {
    for (const [name, tool] of registry) {
      expect(tool.inputSchema?.type, `${name} inputSchema.type`).toBe('object');
    }
  });
});

// MCP 2026-07-28 assigns JSON Schema 2020-12 to a schema without `$schema`, which is how tool
// schemas are published, so that is the dialect they are enforced in. Draft-07 in strict mode
// does not know `prefixItems` and would refuse to compile this schema.
describe('tool schema dialect', () => {
  const tuple = { inputSchema: { type: 'object', properties: { pair: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'integer' }], items: false, minItems: 2 } } } };

  test('is JSON Schema 2020-12', () => {
    expect(TOOL_SCHEMA_DIALECT).toBe('2020-12');
    expect(validateToolParams('tuple', tuple, { pair: ['a', 1] })).toEqual({ valid: true });

    const wrong = validateToolParams('tuple', tuple, { pair: [1, 'a'] });
    expect(wrong.valid).toBe(false);
    expect(wrong.schemaError).toBeUndefined();
    expect(validateToolParams('tuple', tuple, { pair: ['a', 1, 'extra'] }).valid).toBe(false);
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

// resolveAuth has four supported call styles and only one of them names `env`, so a schema that
// made it mandatory would reject the other three.
describe('authentication params stay accepted', () => {
  // Derived from the source rather than hand-listed, so a tool added later is covered the moment
  // it calls resolveAuth.
  const authenticatingFiles = authFileList;

  // A floor, so the scan cannot pass by finding nothing. Lowered from 20 when the six deprecated
  // status tools were removed in 6.6.0; five of them authenticated.
  test('the scan finds the authenticating tools', () => {
    expect(authenticatingFiles.length).toBeGreaterThanOrEqual(18);
  });

  test.each(authenticatingFiles.map((file, i) => [path.relative(repoRoot, file), i]))(
    '%s declares url, email and token on a closed schema',
    (_label, index) => {
      const schema = authTools[index]?.inputSchema;

      // Only closed schemas can reject unknown properties, so only they can make the
      // explicit-credentials path unreachable by omitting these three.
      if (!schema || schema.additionalProperties !== false) return;

      for (const property of ['url', 'email', 'token']) {
        expect(Object.keys(schema.properties || {}), `${_label} inputSchema.properties`)
          .toContain(property);
      }
    }
  );

  // The three credential parameters shipped undescribed on every tool that authenticates, one of
  // which deploys. Checked on the shared object because that is the only copy: a description
  // dropped from it goes quiet on all twenty-one at once.
  test.each(['env', 'url', 'email', 'token'])('the shared %s property is published with a description', (name) => {
    const property = authProperties[name];

    expect(property, `authProperties.${name}`).toBeDefined();
    expect(typeof property.description, `authProperties.${name}.description`).toBe('string');
    expect(property.description.length).toBeGreaterThan(8);
  });

  // The rule an agent cannot infer from three separate parameters, and the reason `url` carries
  // more words than the other two: it is the one filled in first.
  test('the credential triple says it is a triple, and that it beats env', () => {
    const said = ['url', 'email', 'token'].map(name => authProperties[name].description).join(' ');

    expect(said).toMatch(/with email and token/);
    expect(said).toMatch(/with url and token/);
    expect(said).toMatch(/with url and email/);
    expect(authProperties.url.description).toMatch(/instead of env/);
  });

  const requiredExtras = {
    'constants-set': { name: 'A', value: '1' },
    'constants-unset': { name: 'A' },

    'uploads-push': { filePath: 'uploads.zip' },
    'unit-tests-run': { name: 'example_test' },

    'data-clean': { confirmation: 'yes' },

    'migrations-generate': { name: 'add_thing' },
    'liquid-exec': { template: '{{ 1 }}' },
    'page-fetch': { path: '/' },
    'graphql-exec': { query: '{ a }' },
    'sync-file': { filePath: 'app/views/a.liquid' }
  };

  // Matched on the inputSchema object, not the tool object: an exposed tool is a copy when the
  // tools config overrides its description, and the copy keeps the same schema. A name-based
  // heuristic would sweep in env-add, whose `token` is data it sends, not credentials.
  const authSchemas = new Set(authTools.map(tool => tool?.inputSchema).filter(Boolean));
  const registeredAuthTools = [...registry].filter(([, tool]) => authSchemas.has(tool.inputSchema)).map(([name]) => name);

  test.each(registeredAuthTools)('%s accepts explicit url/email/token without env', name => {
    const params = { url: 'https://example.com', email: 'a@b.c', token: 'tok', ...requiredExtras[name] };
    const result = check(name, params);

    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test.each(registeredAuthTools)('%s accepts env alone', name => {
    expect(check(name, { env: 'staging', ...requiredExtras[name] }).valid).toBe(true);
  });

  test.each(registeredAuthTools)('%s accepts no auth params (MPKIT_* / default .pos entry)', name => {
    expect(check(name, { ...requiredExtras[name] }).valid).toBe(true);
  });
});

// `required` on these two matches what the handler actually needs; without an assertion the
// relaxation could be reverted unnoticed.
describe('required relaxations', () => {
  test('data-validate requires nothing: validation runs locally and env is context only', () => {
    expect(registry.get('data-validate').inputSchema.required).toBeUndefined();
  });

  test('unit-tests-run requires only name', () => {
    expect(registry.get('unit-tests-run').inputSchema.required).toEqual(['name']);
  });

  test.each([
    ['constants-list', undefined],
    ['constants-set', ['name', 'value']],
    ['constants-unset', ['name']],
    ['data-import', undefined],
    ['uploads-push', ['filePath']]
  ])('%s no longer requires env', (name, expected) => {
    expect(registry.get(name).inputSchema.required).toEqual(expected);
  });
});

/**
 * `logs-fetch` documents `lastId` as the cursor to hand back, so the schema it publishes has to
 * accept the value it returns, or paging fails with -32602.
 *
 * This check existed while the tool was broken and passed anyway, because its rows were
 * `{ id: 41 }`: an integer survives `Number()` and satisfies an `integer` schema, so the fixture
 * agreed with the bug. A real row id is a microsecond epoch the instance sends as a string.
 */
describe('logs-fetch cursor round-trips', () => {
  const ROWS = [{ id: '1790008519.397928', message: 'a' }, { id: '1790008926.7639065', message: 'b' }];

  const fetched = (rows) => {
    let call = 0;
    class MockGateway {
      async logs() { return { logs: ++call === 1 ? rows : [] }; }
    }
    return runTool(registry.get('logs-fetch'),
      { url: 'https://example.com', email: 'a@b.c', token: 'tok' },
      { Gateway: MockGateway }
    );
  };

  test('the returned cursor is accepted as the next request cursor', async () => {
    const result = await fetched(ROWS);

    expect(result.ok).toBe(true);
    expect(result.data.lastId).toBe('1790008926.7639065');
    expect(check('logs-fetch', { lastId: result.data.lastId }).valid).toBe(true);
  });

  test('the default cursor is also a valid next cursor', async () => {
    const result = await fetched([]);

    expect(result.data.lastId).toBe('0');
    expect(check('logs-fetch', { lastId: result.data.lastId }).valid).toBe(true);
  });
});
