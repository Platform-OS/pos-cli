/**
 * Unit tests for lib/dns/guard.js
 * Write protection for legacy production portals + plan-then-confirm gate.
 */
import { describe, test, expect, vi } from 'vitest';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn() }
}));

const mockPrompts = vi.fn();
vi.mock('prompts', () => ({ default: (...args) => mockPrompts(...args) }));

import { assertWritablePortal, confirmApply, PROTECTED_TARGET_HOSTS } from '#lib/dns/guard.js';

describe('assertWritablePortal', () => {
  test('partners.platformos.com is never writable by default (migrate target/source swap guard)', () => {
    expect(PROTECTED_TARGET_HOSTS).toContain('partners.platformos.com');
    expect(() => assertWritablePortal('https://partners.platformos.com'))
      .toThrow(/read-only.*never a target/s);
    expect(() => assertWritablePortal('https://partners.platformos.com/'))
      .toThrow('--unsafe-allow-protected-target');
  });

  test('explicit override allows it', () => {
    expect(() => assertWritablePortal('https://partners.platformos.com', { allowProtectedTarget: true }))
      .not.toThrow();
  });

  test('private-stack portals are writable', () => {
    expect(() => assertWritablePortal('https://portal.ps-01-platformos.com')).not.toThrow();
    expect(() => assertWritablePortal('https://portal.uk-siteglide.com')).not.toThrow();
  });
});

describe('confirmApply', () => {
  test('--yes skips the prompt', async () => {
    await expect(confirmApply({ yes: true, interactive: false, target: 'x' })).resolves.toBe(true);
    expect(mockPrompts).not.toHaveBeenCalled();
  });

  test('non-interactive without --yes refuses to apply', async () => {
    await expect(confirmApply({ yes: false, interactive: false, target: 'x' }))
      .rejects.toThrow('--yes');
  });

  test('--json without --yes refuses even interactively — never a blind confirmation (TASK-1.12)', async () => {
    await expect(confirmApply({ json: true, interactive: true, target: 'x' }))
      .rejects.toThrow(/--json.*--yes/s);
    expect(mockPrompts).not.toHaveBeenCalled();

    await expect(confirmApply({ json: true, yes: true, interactive: true, target: 'x' })).resolves.toBe(true);
  });

  test('interactive prompt result decides', async () => {
    mockPrompts.mockResolvedValueOnce({ confirmed: true });
    await expect(confirmApply({ interactive: true, target: 'https://portal.test' })).resolves.toBe(true);

    mockPrompts.mockResolvedValueOnce({ confirmed: false });
    await expect(confirmApply({ interactive: true, target: 'https://portal.test' })).resolves.toBe(false);

    // Ctrl-C during the prompt resolves to an empty answer — treated as "no"
    mockPrompts.mockResolvedValueOnce({});
    await expect(confirmApply({ interactive: true, target: 'https://portal.test' })).resolves.toBe(false);
  });
});
