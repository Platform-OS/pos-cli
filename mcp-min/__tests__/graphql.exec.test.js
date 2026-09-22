
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
