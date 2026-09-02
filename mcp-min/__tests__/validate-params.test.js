import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fg from 'fast-glob';
import tools from '../tools.js';
import { validateToolParams } from '../validate-params.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const authFileList = fg
  .sync('mcp-min/**/*.js', { cwd: repoRoot, absolute: true, ignore: ['**/__tests__/**', '**/node_modules/**'] })
  .filter(file => !file.endsWith(`${path.sep}auth.js`))
  .filter(file => /\bresolveAuth\(/.test(fs.readFileSync(file, 'utf8')));

// Imported once at module scope so test.each can be built from real tool objects.
const authTools = await Promise.all(
  authFileList.map(file => import(pathToFileURL(file).href).then(mod => mod.default))
);

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

// resolveAuth (mcp-min/auth.js) resolves credentials in this order: explicit
// url+email+token params, then the named `.pos` environment, then MPKIT_* env vars, then
// the first `.pos` entry. A schema that made `env` mandatory would reject three of those
// four supported call styles.
describe('authentication params stay accepted', () => {
  // Derived from the source rather than hand-listed: a tool added later is covered the
  // moment it calls resolveAuth. A hand-written list silently stopped guarding tools it
  // did not happen to name.
  const authenticatingFiles = authFileList;

  test('the scan finds the authenticating tools', () => {
    expect(authenticatingFiles.length).toBeGreaterThanOrEqual(20);
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

  const requiredExtras = {
    'constants-set': { name: 'A', value: '1' },
    'constants-unset': { name: 'A' },
    'data-import-status': { jobId: '1' },
    'uploads-push': { filePath: 'uploads.zip' },
    'unit-tests-run': { name: 'example_test' },
    'deploy-status': { id: '1' },
    'deploy-wait': { id: '1' },
    'data-export-status': { jobId: '1' },
    'data-clean-status': { jobId: '1' },
    'data-clean': { confirmation: 'yes' },
    'tests-run-async-result': { id: '1' },
    'migrations-generate': { name: 'add_thing' },
    'liquid-exec': { template: '{{ 1 }}' },
    'graphql-exec': { query: '{ a }' },
    'sync-file': { filePath: 'app/views/a.liquid' }
  };

  // Registry entries whose schema is the one exported by an authenticating file. Matched
  // on the inputSchema object rather than the tool object, because applyConfig copies the
  // tool when a config overrides its description but keeps the same schema reference.
  // A name-based heuristic would wrongly sweep in portal tools like env-add, whose
  // `token` parameter is data it sends rather than credentials it authenticates with.
  const authSchemas = new Set(authTools.map(tool => tool?.inputSchema).filter(Boolean));
  const registeredAuthTools = Object.keys(tools).filter(name => authSchemas.has(tools[name].inputSchema));

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

// The branch relaxed `required` on these two so the schema matches what the handler
// actually needs; without an assertion the relaxation could be reverted unnoticed.
describe('required relaxations', () => {
  test('data-validate requires nothing: validation runs locally and env is context only', () => {
    expect(tools['data-validate'].inputSchema.required).toBeUndefined();
  });

  test('unit-tests-run requires only name', () => {
    expect(tools['unit-tests-run'].inputSchema.required).toEqual(['name']);
  });

  test.each([
    ['constants-list', undefined],
    ['constants-set', ['name', 'value']],
    ['constants-unset', ['name']],
    ['data-import', undefined],
    ['data-import-status', ['jobId']],
    ['uploads-push', ['filePath']]
  ])('%s no longer requires env', (name, expected) => {
    expect(tools[name].inputSchema.required).toEqual(expected);
  });
});

// logs-fetch documents `lastId` as the cursor to hand back on the next call, so what it
// returns has to satisfy the schema it accepts. It previously returned a string while the
// schema demanded an integer, which broke paging with -32602.
describe('logs-fetch cursor round-trips', () => {
  test('the returned cursor is accepted as the next request cursor', async () => {
    const rows = [{ id: 41, message: 'a' }, { id: 42, message: 'b' }];
    let call = 0;
    class MockGateway {
      async logs() {
        call += 1;
        return { logs: call === 1 ? rows : [] };
      }
    }

    const result = await tools['logs-fetch'].handler(
      { url: 'https://example.com', email: 'a@b.c', token: 'tok' },
      { Gateway: MockGateway }
    );

    expect(result.ok).toBe(true);
    expect(result.lastId).toBe(42);
    expect(check('logs-fetch', { lastId: result.lastId }).valid).toBe(true);
  });

  test('the default cursor is also a valid next cursor', async () => {
    class MockGateway {
      async logs() { return { logs: [] }; }
    }

    const result = await tools['logs-fetch'].handler(
      { url: 'https://example.com', email: 'a@b.c', token: 'tok' },
      { Gateway: MockGateway }
    );

    expect(result.lastId).toBe(0);
    expect(check('logs-fetch', { lastId: result.lastId }).valid).toBe(true);
  });
});
