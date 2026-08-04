/**
 * Unit tests for the ora wrapper
 * Tests that spinners never put the terminal into raw mode, which is what
 * silently disables Ctrl+C for the whole time a spinner is on screen.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fg from 'fast-glob';
import { makeSpinner } from '#test/utils/spinnerMock.js';

const oraFactory = vi.fn(() => makeSpinner());
vi.mock('ora', () => ({ default: (...args) => oraFactory(...args) }));

const spinner = (await import('#lib/ora.js')).default;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('ora wrapper', () => {
  beforeEach(() => {
    oraFactory.mockClear();
  });

  // Exact match rather than objectContaining: it pins the caller options through *and*
  // proves nothing else is injected — notably that hideCursor is left at ora's default.
  test('disables discardStdin alongside the caller options', () => {
    spinner({ text: 'Exporting', stream: process.stdout, interval: 500 });

    expect(oraFactory).toHaveBeenCalledWith({
      discardStdin: false,
      text: 'Exporting',
      stream: process.stdout,
      interval: 500
    });
  });

  test('works with no options', () => {
    spinner();

    expect(oraFactory).toHaveBeenCalledWith({ discardStdin: false });
  });

  test('lets a caller opt back into discarding stdin', () => {
    spinner({ text: 'Prompting', discardStdin: true });

    expect(oraFactory).toHaveBeenCalledWith(expect.objectContaining({ discardStdin: true }));
  });

  // The wrapper only helps where it is actually used, so guard the import itself:
  // a command that reaches for 'ora' directly gets the raw-mode default back and
  // becomes impossible to interrupt.
  test('no command imports ora directly', async () => {
    const files = await fg(['bin/**/*.js', 'lib/**/*.js', 'mcp-min/**/*.js', 'scripts/**/*.js'], {
      cwd: repoRoot,
      ignore: ['**/node_modules/**', 'lib/ora.js']
    });

    const offenders = files.filter(file =>
      /^\s*import\s+.*\sfrom\s+['"]ora['"]/m.test(fs.readFileSync(path.join(repoRoot, file), 'utf8'))
    );

    expect(offenders, `import from '#lib/ora.js' instead in: ${offenders.join(', ')}`).toEqual([]);
  });
});
