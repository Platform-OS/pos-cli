import { describe, test, expect, vi } from 'vitest';
import { parseParams, execGraphql } from '#lib/exec/graphql.js';

describe('parseParams', () => {
  test('returns {} when nothing provided', () => {
    expect(parseParams(undefined)).toEqual({});
    expect(parseParams(null)).toEqual({});
    expect(parseParams('')).toEqual({});
  });

  test('parses a JSON object of variables', () => {
    expect(parseParams('{"id":"42","tags":["a","b"]}')).toEqual({ id: '42', tags: ['a', 'b'] });
  });

  test('throws on invalid JSON', () => {
    expect(() => parseParams('{not json')).toThrow(/expected a JSON object of variables/);
  });

  test('throws when JSON is not an object', () => {
    expect(() => parseParams('[1,2]')).toThrow(/expected a JSON object of variables/);
    expect(() => parseParams('"foo"')).toThrow(/expected a JSON object of variables/);
    expect(() => parseParams('null')).toThrow(/expected a JSON object of variables/);
  });
});

describe('execGraphql', () => {
  const baseDeps = (graphImpl) => {
    const graph = vi.fn(graphImpl || (async () => ({ data: { ok: true } })));
    return {
      graph,
      deps: {
        GatewayCtor: class {
          constructor(auth) {
            this.auth = auth;
          }
          graph(body) {
            return graph(body);
          }
        },
        fetchSettingsFn: vi.fn().mockResolvedValue({ url: 'https://x', token: 't', email: 'e' }),
        isProductionEnvironmentFn: vi.fn().mockReturnValue(false),
        confirmProductionExecutionFn: vi.fn().mockResolvedValue(true),
        fileReader: { existsSync: vi.fn().mockReturnValue(true), readFileSync: vi.fn() },
      },
    };
  };

  test('passes parsed params as GraphQL variables', async () => {
    const { graph, deps } = baseDeps();
    const { response } = await execGraphql({
      environment: 'dev',
      query: 'query q($id: ID) { record(id: $id) { id } }',
      params: '{"id":"42"}',
      deps,
    });

    expect(graph).toHaveBeenCalledWith({
      query: 'query q($id: ID) { record(id: $id) { id } }',
      variables: { id: '42' },
    });
    expect(response.data.ok).toBe(true);
  });

  test('defaults variables to {} when no params given', async () => {
    const { graph, deps } = baseDeps();
    await execGraphql({ environment: 'dev', query: 'query { ok }', deps });
    expect(graph).toHaveBeenCalledWith({ query: 'query { ok }', variables: {} });
  });

  test('reads the query from --file', async () => {
    const { graph, deps } = baseDeps();
    deps.fileReader.readFileSync.mockReturnValue('query FromFile { ok }');
    await execGraphql({ environment: 'dev', file: '/tmp/q.graphql', params: '{"x":1}', deps });
    expect(graph).toHaveBeenCalledWith({ query: 'query FromFile { ok }', variables: { x: 1 } });
  });

  test('throws when neither query nor file resolves a query', async () => {
    const { deps } = baseDeps();
    await expect(execGraphql({ environment: 'dev', deps })).rejects.toThrow(/missing required argument 'graphql'/);
  });

  test('propagates invalid --params error before any API call', async () => {
    const { graph, deps } = baseDeps();
    await expect(
      execGraphql({ environment: 'dev', query: 'query { ok }', params: '{bad', deps })
    ).rejects.toThrow(/expected a JSON object of variables/);
    expect(graph).not.toHaveBeenCalled();
  });

  test('returns the raw GraphQL response including errors', async () => {
    const { deps } = baseDeps(async () => ({ errors: [{ message: 'boom' }], data: null }));
    const { response } = await execGraphql({ environment: 'dev', query: 'query { ok }', deps });
    expect(response.errors[0].message).toBe('boom');
  });

  test('cancels on production when confirmation is declined', async () => {
    const { graph, deps } = baseDeps();
    deps.isProductionEnvironmentFn.mockReturnValue(true);
    deps.confirmProductionExecutionFn.mockResolvedValue(false);
    const result = await execGraphql({ environment: 'production', query: 'query { ok }', deps });
    expect(result.cancelled).toBe(true);
    expect(graph).not.toHaveBeenCalled();
  });
});
