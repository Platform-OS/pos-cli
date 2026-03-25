import { describe, test, expect } from 'vitest';
import { formatModulesDiff } from '#lib/modules/formatModulesDiff.js';

describe('formatModulesDiff', () => {
  test('returns empty array when nothing changed', () => {
    const modules = { core: '1.0.0', tests: '2.3.0' };
    expect(formatModulesDiff(modules, modules)).toEqual([]);
  });

  test('marks a new module as added (+)', () => {
    const lines = formatModulesDiff({}, { core: '1.0.0' });
    expect(lines).toEqual(['  + core@1.0.0']);
  });

  test('marks a missing module as removed (-)', () => {
    const lines = formatModulesDiff({ core: '1.0.0' }, {});
    expect(lines).toEqual(['  - core@1.0.0']);
  });

  test('marks a version change as updated (~)', () => {
    const lines = formatModulesDiff({ core: '1.0.0' }, { core: '2.0.0' });
    expect(lines).toEqual(['  ~ core: 1.0.0 → 2.0.0']);
  });

  test('omits modules whose version did not change', () => {
    const lines = formatModulesDiff({ core: '1.0.0', tests: '1.0.0' }, { core: '2.0.0', tests: '1.0.0' });
    expect(lines).not.toContain(expect.stringContaining('tests'));
    expect(lines).toEqual(['  ~ core: 1.0.0 → 2.0.0']);
  });

  test('sorts output by module name', () => {
    const lines = formatModulesDiff({}, { zebra: '1.0.0', alpha: '1.0.0', mango: '1.0.0' });
    expect(lines).toEqual([
      '  + alpha@1.0.0',
      '  + mango@1.0.0',
      '  + zebra@1.0.0',
    ]);
  });

  test('handles a mixed scenario: added, removed, updated, and unchanged in one call', () => {
    const prev = { core: '1.0.0', helper: '2.0.0', old: '3.0.0' };
    const next = { core: '1.5.0', helper: '2.0.0', fresh: '1.0.0' };

    const lines = formatModulesDiff(prev, next);

    expect(lines).toContain('  ~ core: 1.0.0 → 1.5.0');
    expect(lines).toContain('  + fresh@1.0.0');
    expect(lines).toContain('  - old@3.0.0');
    expect(lines).not.toContain(expect.stringContaining('helper'));
    expect(lines).toHaveLength(3);
  });

  test('output lines appear in alphabetical order across all change types', () => {
    const prev = { bravo: '1.0.0', delta: '1.0.0' };
    const next  = { alpha: '1.0.0', bravo: '2.0.0' };

    const lines = formatModulesDiff(prev, next);

    expect(lines[0]).toMatch(/alpha/);
    expect(lines[1]).toMatch(/bravo/);
    expect(lines[2]).toMatch(/delta/);
  });
});
