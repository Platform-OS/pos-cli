import { describe, test, expect, vi } from 'vitest';
import { resolveSource, runExec } from '#lib/exec/run.js';

describe('resolveSource', () => {
  test('returns the inline source when no file given', () => {
    expect(resolveSource({ source: 'query { ok }' })).toBe('query { ok }');
  });

  test('returns undefined when neither source nor file given', () => {
    expect(resolveSource({})).toBeUndefined();
  });

  test('reads the source from a file when --file given', () => {
    const fileReader = {
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue('contents from file'),
    };
    expect(resolveSource({ file: '/tmp/q.graphql', fileReader })).toBe('contents from file');
    expect(fileReader.readFileSync).toHaveBeenCalledWith('/tmp/q.graphql', 'utf8');
  });

  test('throws when the file does not exist', () => {
    const fileReader = { existsSync: vi.fn().mockReturnValue(false), readFileSync: vi.fn() };
    expect(() => resolveSource({ file: '/tmp/missing.graphql', fileReader })).toThrow(/File not found/);
    expect(fileReader.readFileSync).not.toHaveBeenCalled();
  });
});

describe('runExec', () => {
  const baseDeps = (overrides = {}) => {
    const execute = vi.fn(async () => ({ data: { ok: true } }));
    const deps = {
      GatewayCtor: class {
        constructor(auth) {
          this.auth = auth;
        }
      },
      fetchSettingsFn: vi.fn().mockResolvedValue({ url: 'https://x', token: 't', email: 'e' }),
      isProductionEnvironmentFn: vi.fn().mockReturnValue(false),
      confirmProductionExecutionFn: vi.fn().mockResolvedValue(true),
      fileReader: { existsSync: vi.fn().mockReturnValue(true), readFileSync: vi.fn() },
      ...overrides,
    };
    return { execute, deps };
  };

  test('resolves the source and passes it to execute with the gateway', async () => {
    const { execute, deps } = baseDeps();
    const { response } = await runExec({
      environment: 'dev',
      source: 'inline source',
      missingArgName: 'code',
      execute,
      deps,
    });

    expect(deps.fetchSettingsFn).toHaveBeenCalledWith('dev', undefined);
    const [gatewayArg, sourceArg] = execute.mock.calls[0];
    expect(gatewayArg).toBeInstanceOf(deps.GatewayCtor);
    expect(gatewayArg.auth).toEqual({ url: 'https://x', token: 't', email: 'e' });
    expect(sourceArg).toBe('inline source');
    expect(response.data.ok).toBe(true);
  });

  test('reads the source from --file', async () => {
    const { execute, deps } = baseDeps();
    deps.fileReader.readFileSync.mockReturnValue('from file');
    await runExec({ environment: 'dev', file: '/tmp/x', missingArgName: 'code', execute, deps });
    expect(execute.mock.calls[0][1]).toBe('from file');
  });

  test('throws with the supplied argument name when nothing resolves', async () => {
    const { execute, deps } = baseDeps();
    await expect(
      runExec({ environment: 'dev', missingArgName: 'graphql', execute, deps })
    ).rejects.toThrow(/missing required argument 'graphql'/);
    expect(execute).not.toHaveBeenCalled();
  });

  test('propagates file-not-found errors', async () => {
    const { execute, deps } = baseDeps();
    deps.fileReader.existsSync.mockReturnValue(false);
    await expect(
      runExec({ environment: 'dev', file: '/tmp/missing', missingArgName: 'code', execute, deps })
    ).rejects.toThrow(/File not found/);
    expect(execute).not.toHaveBeenCalled();
  });

  describe('production protection', () => {
    test('prompts for confirmation on production environments', async () => {
      const { execute, deps } = baseDeps();
      deps.isProductionEnvironmentFn.mockReturnValue(true);
      deps.confirmProductionExecutionFn.mockResolvedValue(true);

      await runExec({ environment: 'production', source: 'q', missingArgName: 'code', execute, deps });

      expect(deps.confirmProductionExecutionFn).toHaveBeenCalledWith('production');
      expect(execute).toHaveBeenCalled();
    });

    test('cancels without executing when production confirmation is declined', async () => {
      const { execute, deps } = baseDeps();
      deps.isProductionEnvironmentFn.mockReturnValue(true);
      deps.confirmProductionExecutionFn.mockResolvedValue(false);

      const result = await runExec({
        environment: 'production',
        source: 'q',
        missingArgName: 'code',
        execute,
        deps,
      });

      expect(result).toEqual({ cancelled: true });
      expect(execute).not.toHaveBeenCalled();
    });

    test('does not prompt on non-production environments', async () => {
      const { execute, deps } = baseDeps();
      deps.isProductionEnvironmentFn.mockReturnValue(false);

      await runExec({ environment: 'staging', source: 'q', missingArgName: 'code', execute, deps });

      expect(deps.confirmProductionExecutionFn).not.toHaveBeenCalled();
      expect(execute).toHaveBeenCalled();
    });
  });
});
