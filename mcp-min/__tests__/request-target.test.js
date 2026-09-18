/**
 * A tool's request goes where the resolved credentials say and nowhere else — on MCP the caller is
 * a model choosing a value from whatever it has just read. The explicit-credentials trio
 * (`mcp-min/schemas/auth.js`) is the one legitimate way to aim a call elsewhere, because there the
 * caller supplies the credential along with the host.
 */
import fs from 'fs';
import path from 'path';
import { describe, test, expect, vi } from 'vitest';
import registry from '../tools.js';
import { rejectionFor } from '../validate-params.js';

const AUTH = { url: 'https://staging.example.com', email: 'a@b.c', token: 'staging-token' };
const ELSEWHERE = 'https://evil.example.com';

// Names that would move a request off the resolved instance. `url` is absent on purpose: it only
// ever arrives with `email` and `token`, which is the explicit-credentials path.
const REDIRECTING_NAMES = [
  'endpoint', 'endpointurl', 'baseurl', 'apiurl', 'apibase', 'basepath', 'host', 'hostname',
  'origin', 'instanceurl', 'server', 'serverurl', 'target', 'targeturl', 'upstream', 'proxy'
];

const normalise = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');

// A call that reaches the Gateway, for each tool that used to carry `endpoint`.
const REDIRECTABLE_TOOLS = [
  ['liquid-exec', { template: '{{ 1 }}' }],
  ['graphql-exec', { query: '{ __typename }' }],
  ['migrations-list', {}],
  ['migrations-generate', { name: 'add_thing', skipWrite: true }],
  ['migrations-run', { timestamp: '20260101120000' }]
];

describe('no tool can be pointed at another host', () => {
  test.each([...registry.keys()])('%s declares no redirecting parameter', (name) => {
    const properties = registry.get(name).inputSchema?.properties ?? {};

    const redirecting = Object.keys(properties).filter(property => REDIRECTING_NAMES.includes(normalise(property)));

    expect(redirecting, `${name} would let a caller choose where its request goes`).toEqual([]);
  });

  // The schema is the contract, but the handler is what runs: a tool reading `params.endpoint`
  // would still redirect if its schema were ever opened up.
  test('no tool module reads an endpoint parameter', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
      }
    };
    walk(root);

    const offenders = files.filter(file => /params\??\.endpoint\b/.test(fs.readFileSync(file, 'utf8')));

    expect(offenders.map(file => path.relative(root, file))).toEqual([]);
  });
});

describe('a call that names another host', () => {
  test.each(REDIRECTABLE_TOOLS)('%s rejects it rather than ignoring it', (name, params) => {
    const tool = registry.get(name);

    const rejection = rejectionFor(name, tool, { ...AUTH, ...params, endpoint: ELSEWHERE });

    expect(rejection?.jsonRpcCode).toBe(-32602);
    expect(rejection.message).toContain('endpoint');
  });

  // Second lock: the handler ignores the argument even if something hands it through.
  test.each(REDIRECTABLE_TOOLS)('%s still talks to the resolved instance if one reaches the handler', async (name, params) => {
    const constructedWith = [];
    const gatewayCall = vi.fn(async () => ({}));
    class Gateway {
      constructor(options) { constructedWith.push(options); }
      graph = gatewayCall;
      liquid = gatewayCall;
      listMigrations = gatewayCall;
      generateMigration = gatewayCall;
      runMigration = gatewayCall;
    }

    await registry.get(name).handler({ ...AUTH, ...params, endpoint: ELSEWHERE }, { Gateway });

    expect(constructedWith).not.toHaveLength(0);
    for (const options of constructedWith) {
      expect(options.url).toBe(AUTH.url);
      expect(options.token).toBe(AUTH.token);
    }
  });
});

describe('the explicit-credentials path still works', () => {
  // Removing `endpoint` must not take the supported way of calling another instance with it.
  test('url + email + token sends the caller\'s own credential to the host they named', async () => {
    const constructedWith = [];
    class Gateway {
      constructor(options) { constructedWith.push(options); }
      graph = async () => ({ data: {} });
    }

    await registry.get('graphql-exec').handler(
      { url: ELSEWHERE, email: 'someone@example.com', token: 'their-token', query: '{ __typename }' },
      { Gateway }
    );

    expect(constructedWith[0]).toMatchObject({ url: ELSEWHERE, email: 'someone@example.com', token: 'their-token' });
  });
});
