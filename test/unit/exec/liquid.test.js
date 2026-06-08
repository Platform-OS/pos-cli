import { describe, test, expect, vi } from 'vitest';
import { execLiquid } from '#lib/exec/liquid.js';

describe('execLiquid', () => {
  const baseDeps = (liquidImpl) => {
    const liquid = vi.fn(liquidImpl || (async () => ({ result: 'hello' })));
    return {
      liquid,
      deps: {
        GatewayCtor: class {
          constructor(auth) {
            this.auth = auth;
          }
          liquid(body) {
            return liquid(body);
          }
        },
        fetchSettingsFn: vi.fn().mockResolvedValue({ url: 'https://x', token: 't', email: 'e' }),
        isProductionEnvironmentFn: vi.fn().mockReturnValue(false),
        confirmProductionExecutionFn: vi.fn().mockResolvedValue(true),
        fileReader: { existsSync: vi.fn().mockReturnValue(true), readFileSync: vi.fn() },
      },
    };
  };

  test('sends inline code as the liquid content', async () => {
    const { liquid, deps } = baseDeps();
    const { response } = await execLiquid({ environment: 'dev', code: '{{ 1 | plus: 1 }}', deps });
    expect(liquid).toHaveBeenCalledWith({ content: '{{ 1 | plus: 1 }}' });
    expect(response.result).toBe('hello');
  });

  test('reads the code from --file', async () => {
    const { liquid, deps } = baseDeps();
    deps.fileReader.readFileSync.mockReturnValue('{% assign x = 1 %}');
    await execLiquid({ environment: 'dev', file: '/tmp/s.liquid', deps });
    expect(liquid).toHaveBeenCalledWith({ content: '{% assign x = 1 %}' });
  });

  test('throws when neither code nor file resolves', async () => {
    const { deps } = baseDeps();
    await expect(execLiquid({ environment: 'dev', deps })).rejects.toThrow(/missing required argument 'code'/);
  });

  test('returns the raw liquid response including errors', async () => {
    const { deps } = baseDeps(async () => ({ error: 'Liquid syntax error' }));
    const { response } = await execLiquid({ environment: 'dev', code: '{{ broken', deps });
    expect(response.error).toBe('Liquid syntax error');
  });

  test('cancels on production when confirmation is declined', async () => {
    const { liquid, deps } = baseDeps();
    deps.isProductionEnvironmentFn.mockReturnValue(true);
    deps.confirmProductionExecutionFn.mockResolvedValue(false);
    const result = await execLiquid({ environment: 'production', code: '{{ 1 }}', deps });
    expect(result.cancelled).toBe(true);
    expect(liquid).not.toHaveBeenCalled();
  });
});
