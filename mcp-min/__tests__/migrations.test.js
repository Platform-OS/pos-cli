/**
 * The migrations tools had no behavioural test, which is how they kept a result envelope of their
 * own — `{ status: 'ok' | 'error' }` — long after everything else answered `{ ok }`. The protocol
 * layer derives a failed call from `ok === false`, so `status: 'error'` was never a failure to a
 * client: a migration that did not run reached the agent as a call that had worked.
 *
 * These go through `runTool`, because that is what a client is answered by.
 */
import { describe, test, expect } from 'vitest';
import { runTool } from '../run-tool.js';
import listMigrations from '../migrations/list.js';
import runMigration from '../migrations/run.js';
import generateMigration from '../migrations/generate.js';

const AUTH = { url: 'https://staging.example.com', email: 'a@b.c', token: 'staging-token-123456' };

const gatewayThat = (method, behaviour) => class {
  constructor() { this[method] = behaviour; }
};

const failingWith = (properties) => async () => {
  const error = new Error(properties.message ?? 'it did not work');
  Object.assign(error, properties);
  throw error;
};

describe('a migration that does not run is a failed call', () => {
  test('a rejected token is reported as a failure, and as one re-authenticating would fix', async () => {
    const Gateway = gatewayThat('listMigrations', failingWith({ statusCode: 401, message: '401 Unauthorized' }));

    const result = await runTool(listMigrations, AUTH, { Gateway });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'auth', code: 'UNAUTHORIZED' });
    expect(result.error.details).toMatchObject({ statusCode: 401 });
  });

  test('an instance that cannot be reached is reported as worth retrying', async () => {
    const Gateway = gatewayThat('listMigrations', failingWith({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }));

    const result = await runTool(listMigrations, AUTH, { Gateway });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'unavailable', code: 'ECONNREFUSED' });
  });

  test('a migration run that the instance refuses does not come back as a success', async () => {
    const Gateway = gatewayThat('runMigration', failingWith({ statusCode: 500, message: 'Internal Server Error' }));

    const result = await runTool(runMigration, { ...AUTH, timestamp: '20260101120000' }, { Gateway });

    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('unavailable');
  });
});

describe('the migrations tools answer the way every other tool does', () => {
  test('listing returns the migrations under data, with meta built for it', async () => {
    const Gateway = gatewayThat('listMigrations', async () => ({
      migrations: [{ id: 1, name: '20260101_add_index', state: 'executed', error_messages: null }]
    }));

    const result = await runTool(listMigrations, AUTH, { Gateway });

    expect(result.ok).toBe(true);
    expect(result.data.migrations).toEqual([{ id: 1, name: '20260101_add_index', state: 'executed', error_messages: null }]);
    expect(result.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // The masked credential comes from resolveAuth recording what it resolved, not from the tool.
    expect(result.meta.auth).toMatchObject({ url: AUTH.url, email: AUTH.email, source: 'params' });
    expect(result.meta.auth.token).not.toBe(AUTH.token);
  });

  test('generating without writing returns what was created and no file path', async () => {
    const Gateway = gatewayThat('generateMigration', async () => ({ name: '20260101_thing', body: 'body' }));

    const result = await runTool(generateMigration, { ...AUTH, name: 'thing', skipWrite: true }, { Gateway });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ name: '20260101_thing', bodyLength: 4, filePath: null });
  });
});

describe('what the schema cannot express is still refused', () => {
  test('running a migration without naming one is the caller\'s mistake', async () => {
    const Gateway = gatewayThat('runMigration', async () => ({ name: 'never' }));

    const result = await runTool(runMigration, AUTH, { Gateway });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'input', code: 'INVALID_INPUT' });
  });
});
