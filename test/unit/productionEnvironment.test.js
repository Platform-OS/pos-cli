import { vi, describe, test, expect, beforeEach } from 'vitest';

const prompts = vi.fn();
vi.mock('prompts', () => ({
  default: prompts
}));

const logger = {
  Warn: vi.fn(),
  Info: vi.fn(),
  Error: vi.fn()
};
vi.mock('#lib/logger.js', () => ({
  default: logger
}));

const { isProductionEnvironment, confirmProductionExecution } = await import('#lib/productionEnvironment.js');

describe('isProductionEnvironment', () => {
  describe('returns true for production environments', () => {
    test('detects "production"', () => {
      expect(isProductionEnvironment('production')).toBe(true);
    });

    test('detects "prod"', () => {
      expect(isProductionEnvironment('prod')).toBe(true);
    });

    test('detects "PRODUCTION" (uppercase)', () => {
      expect(isProductionEnvironment('PRODUCTION')).toBe(true);
    });

    test('detects "PROD" (uppercase)', () => {
      expect(isProductionEnvironment('PROD')).toBe(true);
    });

    test('detects "Production" (mixed case)', () => {
      expect(isProductionEnvironment('Production')).toBe(true);
    });

    test('detects environment containing "prod" (e.g., "my-prod-server")', () => {
      expect(isProductionEnvironment('my-prod-server')).toBe(true);
    });

    test('detects environment containing "production" (e.g., "production-us-east")', () => {
      expect(isProductionEnvironment('production-us-east')).toBe(true);
    });

    test('detects "preprod" as production (contains "prod")', () => {
      expect(isProductionEnvironment('preprod')).toBe(true);
    });

    test('detects "prod-replica" as production', () => {
      expect(isProductionEnvironment('prod-replica')).toBe(true);
    });
  });

  describe('returns false for non-production environments', () => {
    test('returns false for "staging"', () => {
      expect(isProductionEnvironment('staging')).toBe(false);
    });

    test('returns false for "development"', () => {
      expect(isProductionEnvironment('development')).toBe(false);
    });

    test('returns false for "dev"', () => {
      expect(isProductionEnvironment('dev')).toBe(false);
    });

    test('returns false for "test"', () => {
      expect(isProductionEnvironment('test')).toBe(false);
    });

    test('returns false for "qa"', () => {
      expect(isProductionEnvironment('qa')).toBe(false);
    });

    test('returns false for "local"', () => {
      expect(isProductionEnvironment('local')).toBe(false);
    });

    test('returns false for "sandbox"', () => {
      expect(isProductionEnvironment('sandbox')).toBe(false);
    });

    test('returns false for "demo"', () => {
      expect(isProductionEnvironment('demo')).toBe(false);
    });
  });

  describe('handles edge cases', () => {
    test('returns false for null', () => {
      expect(isProductionEnvironment(null)).toBe(false);
    });

    test('returns false for undefined', () => {
      expect(isProductionEnvironment(undefined)).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(isProductionEnvironment('')).toBe(false);
    });

    test('returns false for whitespace-only string', () => {
      expect(isProductionEnvironment('   ')).toBe(false);
    });

    test('returns false for number', () => {
      expect(isProductionEnvironment(123)).toBe(false);
    });

    test('returns false for object', () => {
      expect(isProductionEnvironment({})).toBe(false);
    });
  });
});

describe('confirmProductionExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns true when user confirms', async () => {
    prompts.mockResolvedValue({ confirmed: true });

    const result = await confirmProductionExecution('production');

    expect(result).toBe(true);
    expect(prompts).toHaveBeenCalledWith(expect.objectContaining({
      type: 'confirm',
      name: 'confirmed',
      initial: false
    }));
  });

  test('returns false when user declines', async () => {
    prompts.mockResolvedValue({ confirmed: false });

    const result = await confirmProductionExecution('production');

    expect(result).toBe(false);
  });

  test('returns undefined when user cancels (Ctrl+C)', async () => {
    prompts.mockResolvedValue({});

    const result = await confirmProductionExecution('production');

    expect(result).toBeUndefined();
  });

  test('includes environment name in prompt message', async () => {
    prompts.mockResolvedValue({ confirmed: true });

    await confirmProductionExecution('my-prod-server');

    expect(prompts).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('my-prod-server')
    }));
  });
});
