
import { pathToFileURL } from 'url';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

vi.useFakeTimers();
vi.spyOn(global, 'setTimeout');

// Mock Gateway.logs
vi.mock('../../lib/proxy', () => {
  class GatewayMock {
    constructor() { this.calls = 0; }
    async logs({ lastId }) {
      this.calls++;
      if (this.calls === 1) return { logs: [{ id: '1', message: 'a', error_type: 'info' }] };
      if (this.calls === 2) return { logs: [{ id: '2', message: 'b', error_type: 'error' }] };
      return { logs: [] };
    }
  }
  return { default: GatewayMock, __esModule: true };
});

const toolUrl = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'logs', 'stream.js')).href;

describe('platformos.logs.stream', () => {
  let tool;
  beforeAll(async () => {
    const mod = await import(toolUrl);
    tool = mod.default;
  });

  test('emits data events and respects maxDuration', async () => {
    const events = [];
    const writer = (evt) => events.push(evt);
    class LocalGateway { constructor(){ this.calls=0;} async logs(){ this.calls++; if (this.calls===1) return { logs:[{id:'1',error_type:'info'}]}; if(this.calls===2) return { logs:[{id:'2',error_type:'error'}]}; return { logs: []}; } }
    const p = tool.streamHandler({ url: 'https://x', email: 'e', token: 't', interval: 50, maxDuration: 60 }, { writer, Gateway: LocalGateway });
    // flush initial tick
    await Promise.resolve();
    // advance enough to include at least one scheduled tick and done
    vi.advanceTimersByTime(1000);
    // Give microtasks a chance
    await Promise.resolve();
    expect(events.filter(e => e.event === 'data').length).toBeGreaterThanOrEqual(2);
    expect(events.some(e => e.event === 'done')).toBe(true);
  });
});
