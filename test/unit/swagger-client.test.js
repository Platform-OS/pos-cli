/**
 * Unit tests for SwaggerProxy.client() error handling.
 *
 * Changes covered:
 *  - Network errors now route through ServerError.handler instead of logger.Error
 *  - Generic errors now use e.message || e (previously always passed the full object)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn().mockResolvedValue(undefined),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));

vi.mock('#lib/ServerError.js', () => ({
  default: {
    handler: vi.fn().mockResolvedValue(undefined),
    isNetworkError: vi.fn().mockReturnValue(false)
  }
}));

vi.mock('#lib/settings.js', () => ({
  fetchSettings: vi.fn(),
  loadSettingsFileForModule: vi.fn().mockReturnValue({})
}));

vi.mock('#lib/proxy.js', () => ({
  default: vi.fn().mockImplementation(function() {
    return { getInstance: vi.fn().mockResolvedValue({ id: 'inst-1', uuid: 'uuid-1', url: 'https://test.example.com' }) };
  })
}));

// swagger-client.js imports this for the HTTP client; stub it out
vi.mock('#lib/logsv2/http.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() }
}));

import logger from '#lib/logger.js';
import ServerError from '#lib/ServerError.js';
import { fetchSettings } from '#lib/settings.js';
import api from '#lib/logsv2/http.js';
import { SwaggerProxy, search } from '#lib/swagger-client.js';

describe('SwaggerProxy.client() error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('calls ServerError.handler on network error', async () => {
    const networkErr = Object.assign(new Error('ECONNREFUSED'), { name: 'RequestError' });
    vi.mocked(fetchSettings).mockRejectedValue(networkErr);
    ServerError.isNetworkError.mockReturnValue(true);

    await SwaggerProxy.client('staging');

    expect(ServerError.handler).toHaveBeenCalledWith(networkErr);
    expect(logger.Error).not.toHaveBeenCalled();
  });

  test('does not call ServerError.handler for 401 statusCode', async () => {
    const err = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    vi.mocked(fetchSettings).mockRejectedValue(err);

    await SwaggerProxy.client('staging');

    expect(ServerError.handler).not.toHaveBeenCalled();
    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('Unauthorized')
    );
  });

  test('logs error.message for non-network errors that have a message', async () => {
    const err = new Error('Something broke');
    vi.mocked(fetchSettings).mockRejectedValue(err);
    ServerError.isNetworkError.mockReturnValue(false);

    await SwaggerProxy.client('staging');

    expect(logger.Error).toHaveBeenCalledWith('Something broke');
    expect(ServerError.handler).not.toHaveBeenCalled();
  });

  test('logs the error itself when no message property is present', async () => {
    const err = 'raw error string';
    vi.mocked(fetchSettings).mockRejectedValue(err);
    ServerError.isNetworkError.mockReturnValue(false);

    await SwaggerProxy.client('staging');

    expect(logger.Error).toHaveBeenCalledWith('raw error string');
  });
});

/**
 * `buildQuery` assigned to an undeclared `query`. That is an implicit global, which works in
 * sloppy-mode CommonJS and throws in an ES module — so every `pos-cli logsv2 search` threw
 * `ReferenceError: query is not defined` from the ESM migration (862db40) until it was fixed,
 * and the bin's `catch (e) { logger.Error(e) }` printed it as if the instance had refused.
 * These drive the search path, not just the helper, because the helper alone would not have
 * caught it either: the call site is where the throw surfaced.
 */
describe('logsv2 search builds its query', () => {
  const proxyFor = async () => {
    vi.mocked(fetchSettings).mockResolvedValue({ url: 'https://test.example.com', token: 't', email: 'e@example.com' });
    return SwaggerProxy.client('staging');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ServerError.isNetworkError.mockReturnValue(false);
  });

  test('a search reaches the log API with the query as its body', async () => {
    const proxy = await proxyFor();
    expect(proxy, 'SwaggerProxy.client returned nothing — the test would assert against undefined').toBeDefined();

    await proxy.searchSQL({ from: 0, size: 10, sql: "select * from logs where str_match(message, 'boom')" });

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, options] = api.post.mock.calls[0];
    expect(url).toBe('https://openobserve-proxy.platformos.dev/api/uuid-1/_search');
    expect(options.body).toEqual({
      query: { from: 0, size: 10, sql: "select * from logs where str_match(message, 'boom')" }
    });
  });

  test('defaults to every row, and carries a time range only when one was given', () => {
    expect(search.buildQuery({ from: 0, size: 10 })).toEqual({
      query: { from: 0, size: 10, sql: 'select * from logs' }
    });
    expect(search.buildQuery({ from: 0, size: 10, start_time: 1694694303000000, end_time: 1694694403000000 }).query)
      .toMatchObject({ start_time: 1694694303000000, end_time: 1694694403000000 });
  });

  // The undeclared binding was also module-wide state: two searches shared one object, so a
  // second call could rewrite the first's query between building it and sending it.
  test('two searches do not share one query object', () => {
    const first = search.buildQuery({ from: 0, size: 1, sql: 'select a from logs' });
    const second = search.buildQuery({ from: 9, size: 2, sql: 'select b from logs' });

    expect(first).not.toBe(second);
    expect(first.query).toMatchObject({ from: 0, size: 1, sql: 'select a from logs' });
    expect(second.query).toMatchObject({ from: 9, size: 2, sql: 'select b from logs' });
  });
});
