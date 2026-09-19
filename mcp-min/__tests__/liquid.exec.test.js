
import { pathToFileURL } from 'url';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { runTool } from '../run-tool.js';

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

  // The failure marker is `Liquid error`, and it used to be enough for the output to contain the
  // word `error` anywhere — so a page that renders the word was reported as a call that failed.
  test.each([
    ['an ordinary render that mentions the word', 'Sorry, there was no error on this page.', true],
    ['output that partly rendered before failing', '<h1>Title</h1>Liquid error: undefined variable', false]
  ])('%s', async (_label, result, shouldSucceed) => {
    class LocalGateway { async liquid() { return { result }; } }

    const res = await runTool(tool, { url: "https://x.example.com", email: "e@example.com", token: "t", template: "{{ x }}" }, { Gateway: LocalGateway });

    expect(res.ok).toBe(shouldSucceed);
  });

  test('success path returns result', async () => {
    class LocalGateway { async liquid(body) { return { output: 'Hello ' + (body.locals?.name || 'World') }; } }
    const res = await runTool(tool, { url: 'https://x', email: 'e', token: 't', template: 'Hi {{name}}', locals: { name: 'Bob' } }, { Gateway: LocalGateway });
    expect(res.ok).toBe(true);
    expect(res.data.output).toMatch(/Hello/);
  });

  test('logical liquid error returns error object', async () => {
    class LocalGateway { async liquid(_body) { return { result: 'Liquid error', error: "Liquid error: Couldn't find \"questions/search.graphql\"." }; } }
    const res = await runTool(tool, { url: 'https://x', email: 'e', token: 't', template: 'logical_error' }, { Gateway: LocalGateway });
    expect(res.ok).toBe(false);
    expect(String(res.error.message)).toMatch(/Couldn't find/);
  });

  test('an instance that refused is reported as the instance refusing', async () => {
    class LocalGateway { async liquid() { throw Object.assign(new Error('Unprocessable'), { statusCode: 422 }); } }
    const res = await runTool(tool, { url: 'https://x', email: 'e', token: 't', template: 'throw' }, { Gateway: LocalGateway });
    expect(res.ok).toBe(false);
    expect(res.error).toMatchObject({ kind: 'instance', details: { statusCode: 422 } });
  });
});
