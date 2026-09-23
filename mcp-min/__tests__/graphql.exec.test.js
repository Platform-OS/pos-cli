
import { pathToFileURL } from 'url';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { runTool } from '../run-tool.js';
import registry from '../tools.js';

vi.mock('../../lib/proxy', () => {
  class GatewayMock {
    constructor() {}
    async graph(body) {
      if (body.query.includes('throw')) throw new Error('GQL');
      if (body.query.includes('gql_error')) return { errors: [{ message: 'Bad input' }], data: null };
      return { data: { ok: true } };
    }
  }
  return { default: GatewayMock, __esModule: true };
});

const toolUrl = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'graphql', 'exec.js')).href;

describe('platformos.graphql.exec', () => {
  let tool;
  beforeAll(async () => {
    const mod = await import(toolUrl);
    tool = mod.default;
  });

  test('success returns data', async () => {
    class LocalGateway { async graph(body) { return { data: { ok: true } }; } }
    const res = await runTool(tool, { url: 'https://x', email: 'e', token: 't', query: 'query { ok }' }, { Gateway: LocalGateway });
    expect(res.ok).toBe(true);
    expect(res.data.data.ok).toBe(true);
  });

  test('an instance that never answered is reported as unavailable, not as our defect', async () => {
    // A gateway that fails carries a status or a network code. A bare Error would be classified
    // `internal`, which is right for a pos-cli bug and wrong for an instance that is down.
    class LocalGateway { async graph() { throw Object.assign(new Error('Bad gateway'), { statusCode: 502 }); } }
    const res = await runTool(tool, { url: 'https://x', email: 'e', token: 't', query: 'throw' }, { Gateway: LocalGateway });
    expect(res.ok).toBe(false);
    expect(res.error).toMatchObject({ kind: 'unavailable', details: { statusCode: 502 } });
  });

  test('returns error object when GraphQL response contains errors', async () => {
    class LocalGateway { async graph() { return { errors: [{ message: 'Bad input' }], data: null }; } }
    const res = await runTool(tool, { url: 'https://x', email: 'e', token: 't', query: 'gql_error' }, { Gateway: LocalGateway });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('GRAPHQL_EXEC_ERROR');
  });
});

/**
 * Which failures the caller can fix by changing what it sent.
 *
 * `kind` is the machine-readable next step, so a malformed document answering `instance` — "read
 * the message rather than retrying unchanged" — sends a client the wrong way about the one failure
 * it can always correct itself.
 *
 * The signal is whether the response carries a `data` key at all. GraphQL requires it once
 * execution has begun and forbids it when the request failed before that, so it separates the two
 * without reading a word of the message. Every payload below was measured against a live instance
 * on 2026-09-23; `extensions` was rejected as the signal because a parse error and an invalid
 * variable carry none.
 */
describe('a document the instance never ran is the caller\'s to fix', () => {
  const answering = (payload) => class { async graph() { return payload; } };
  const call = (payload) => runTool(tool, { url: 'https://x', email: 'e', token: 't', query: 'q' }, { Gateway: answering(payload) });

  let tool;
  beforeAll(async () => { tool = (await import(toolUrl)).default; });

  // No `data` key: parse and validation failures, which never reached execution.
  test.each([
    ['a syntax error', { errors: [{ message: 'syntax error, unexpected end of file at [1, 30]', locations: [{ line: 1, column: 30 }] }] }],
    ['a field the type does not have', { errors: [{ message: "Field 'nosuchfield' doesn't exist on type 'Page'", locations: [{ line: 1, column: 40 }], path: ['query', 'admin_pages', 'results', 'nosuchfield'], extensions: { code: 'undefinedField', typeName: 'Page', fieldName: 'nosuchfield' } }] }],
    ['an argument of the wrong type', { errors: [{ message: "Argument 'per_page' on Field 'admin_pages' has an invalid value (\"lots\"). Expected type 'Int'.", extensions: { code: 'argumentLiteralsIncompatible' } }] }],
    // Carries `extensions` with no `code`, so reading `extensions.code` would have missed it.
    ['a variable given an invalid value', { errors: [{ message: 'Variable $n of type Int! was provided invalid value', extensions: { value: null, problems: [{ path: [], explanation: 'Expected value to not be null' }] } }] }],
    ['more than one operation and none named', { errors: [{ message: 'Operation name is required when multiple operations are present' }] }]
  ])('%s is input', async (_label, payload) => {
    const res = await call(payload);

    expect(res.error.kind).toBe('input');
    expect(res.error.code).toBe('GRAPHQL_DOCUMENT_ERROR');
  });

  // `data` present, null included: execution began and the instance refused on its own rules.
  test.each([
    ['a mutation the data rules refused', { data: null, errors: [{ message: 'GraphQLMutationError: "Could not find Table with name: no_such_table_xyz"', path: ['record_create'] }] }],
    ['one field that failed beside others that did not', { data: { admin_pages: { total_entries: 0 } }, errors: [{ message: 'You must specify table to which the record should belong.', path: ['record_delete'] }] }]
  ])('%s stays instance', async (_label, payload) => {
    const res = await call(payload);

    expect(res.error.kind).toBe('instance');
    expect(res.error.code).toBe('GRAPHQL_EXEC_ERROR');
  });

  // `data: null` is a value, not an absence — the difference between the two branches.
  test('a null data is execution having begun, not a document that never ran', async () => {
    const res = await call({ data: null, errors: [{ message: 'refused' }] });

    expect(res.error.kind).toBe('instance');
  });

  test('the message and the position the instance gave are kept either way', async () => {
    const res = await call({ errors: [{ message: 'syntax error, unexpected end of file at [1, 30]', locations: [{ line: 1, column: 30 }] }] });

    expect(res.error.message).toBe('GraphQLError: syntax error, unexpected end of file at [1, 30]');
    expect(res.error.details.errors[0].locations[0]).toEqual({ line: 1, column: 30 });
  });

  // Nothing ran, so there is no data to report; saying `data: null` would claim otherwise.
  test('a document error reports no data, an execution error reports what there was', async () => {
    const document = await call({ errors: [{ message: 'syntax error' }] });
    const execution = await call({ data: null, errors: [{ message: 'refused' }] });

    expect(Object.hasOwn(document.error.details, 'data')).toBe(false);
    expect(Object.hasOwn(execution.error.details, 'data')).toBe(true);
  });
});

/**
 * What the description has to say, because an agent evaluation lost calls to both.
 *
 * The `admin_*` pointer was added after round 1 reported the read-back capability as missing; round
 * 2 then reached `admin_liquid_partials` unprompted, so the family names did their job — and died
 * on `Field 'name' doesn't exist on type 'LiquidPartial'`, recovering via `__type` only because it
 * thought to try. Naming the other five families would have bought nothing; saying the schema
 * answers introspection is what was missing, at 90 bytes against a wasted round trip on a first
 * call.
 */
describe('the description answers what an agent cannot find out for itself', () => {
  // Read from the registry, so this holds for the tool as clients actually receive it.
  const description = () => registry.get('graphql-exec').description;

  test.each([
    ['it names the family that reads an instance back', /admin_\*/],
    ['it names enough of that family to start from', /admin_pages/],
    ['it says the field names can be discovered rather than guessed', /introspect/i],
    ['and names the operator that does it', /__type/]
  ])('%s', (_label, pattern) => {
    expect(description()).toMatch(pattern);
  });
});
