
import { pathToFileURL } from 'url';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/proxy', () => {
  class GatewayMock {
    constructor() {}
    async liquid(body) {
      if (body.template.includes('throw')) throw new Error('boom');
      if (body.template.includes('logical_error')) return { result: 'Liquid error', error: "Liquid error: Couldn't find \"questions/search.graphql\"." };
      return { output: 'Hello ' + (body.locals?.name || 'World') };
    }
  }
  return { default: GatewayMock, __esModule: true };
});

const toolUrl = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'liquid', 'exec.js')).href;

describe('platformos.liquid.exec', () => {
  let tool;
  beforeAll(async () => {
    const mod = await import(toolUrl);
    tool = mod.default;
  });

  test('success path returns result', async () => {
    class LocalGateway { async liquid(body) { return { output: 'Hello ' + (body.locals?.name || 'World') }; } }
    const res = await tool.handler({ url: 'https://x', email: 'e', token: 't', template: 'Hi {{name}}', locals: { name: 'Bob' } }, { Gateway: LocalGateway });
    expect(res.success).toBe(true);
    expect(res.result.output).toMatch(/Hello/);
  });

  test('logical liquid error returns error object', async () => {
    class LocalGateway { async liquid(_body) { return { result: 'Liquid error', error: "Liquid error: Couldn't find \"questions/search.graphql\"." }; } }
    const res = await tool.handler({ url: 'https://x', email: 'e', token: 't', template: 'logical_error' }, { Gateway: LocalGateway });
    expect(res.success).toBe(false);
    expect(String(res.error.message)).toMatch(/Couldn't find/);
  });

  test('Gateway error returns error object', async () => {
    class LocalGateway { async liquid() { throw new Error('boom'); } }
    const res = await tool.handler({ url: 'https://x', email: 'e', token: 't', template: 'throw' }, { Gateway: LocalGateway });
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('LIQUID_EXEC_ERROR');
  });
});
