import { describe, test, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Capture logger.Print output so we can assert on what reaches the terminal.
vi.mock('#lib/logger.js', () => ({
  default: {
    Print: vi.fn(),
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Info: vi.fn()
  }
}));

import logger from '#lib/logger.js';
import {
  readPostInstall,
  printPostInstallMessages,
  normalize,
  stripUnsafe
} from '#lib/modules/postInstall.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';

const getTmpDir = withTmpDir();

const writeModuleManifest = (name, manifest) => {
  const dir = path.join(getTmpDir(), 'modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pos-module.json'), JSON.stringify(manifest, null, 2));
};

const writeModuleFile = (name, file, content) => {
  const dir = path.join(getTmpDir(), 'modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), content);
};

const ESC = '\u001b'; // escape char

// ---------------------------------------------------------------------------
// stripUnsafe / normalize
// ---------------------------------------------------------------------------

describe('stripUnsafe', () => {
  test('removes ANSI colour (CSI) sequences', () => {
    expect(stripUnsafe(`${ESC}[31mred${ESC}[0m`)).toBe('red');
  });

  test('removes OSC sequences (e.g. terminal hyperlinks)', () => {
    expect(stripUnsafe(`${ESC}]8;;http://evil${ESC}\\click`)).toBe('click');
  });

  test('removes carriage returns and other control chars but keeps tab and newline', () => {
    expect(stripUnsafe('a\r\nb\tcd')).toBe('a\nb\tc' + 'd');
  });
});

describe('normalize', () => {
  test('returns null for non-strings', () => {
    expect(normalize(42)).toBeNull();
    expect(normalize(undefined)).toBeNull();
    expect(normalize({ message: 'x' })).toBeNull();
  });

  test('returns null for blank/whitespace-only messages', () => {
    expect(normalize('   \n\t ')).toBeNull();
    expect(normalize(`${ESC}[0m`)).toBeNull();
  });

  test('trims trailing whitespace but preserves internal formatting', () => {
    expect(normalize('line one\nline two   \n\n')).toBe('line one\nline two');
  });

  test('truncates very long messages and appends a pointer', () => {
    const long = 'x'.repeat(5000);
    const out = normalize(long);
    expect(out.length).toBeLessThan(5000);
    expect(out).toMatch(/truncated/);
  });
});

// ---------------------------------------------------------------------------
// readPostInstall
// ---------------------------------------------------------------------------

describe('readPostInstall', () => {
  test('returns null when the module is not on disk', () => {
    expect(readPostInstall('ghost')).toBeNull();
  });

  test('returns null when the module declares no postInstall', () => {
    writeModuleManifest('core', { machine_name: 'core', version: '2.0.0' });
    expect(readPostInstall('core')).toBeNull();
  });

  test('reads postInstall.message from the module manifest', () => {
    writeModuleManifest('common-styling', {
      machine_name: 'common-styling',
      postInstall: { message: 'Run the install generator next.' }
    });
    expect(readPostInstall('common-styling')).toBe('Run the install generator next.');
  });

  test('sanitizes the manifest message', () => {
    writeModuleManifest('common-styling', {
      postInstall: { message: `${ESC}[31mDanger${ESC}[0m text` }
    });
    expect(readPostInstall('common-styling')).toBe('Danger text');
  });

  test('falls back to POST_INSTALL.md when manifest has no message', () => {
    writeModuleManifest('docs-module', { machine_name: 'docs-module' });
    writeModuleFile('docs-module', 'POST_INSTALL.md', '# Setup\nDo the thing.\n');
    expect(readPostInstall('docs-module')).toBe('# Setup\nDo the thing.');
  });

  test('manifest message wins over POST_INSTALL.md', () => {
    writeModuleManifest('both', { postInstall: { message: 'from manifest' } });
    writeModuleFile('both', 'POST_INSTALL.md', 'from markdown');
    expect(readPostInstall('both')).toBe('from manifest');
  });

  test('does not throw on malformed manifest JSON', () => {
    const dir = path.join(getTmpDir(), 'modules', 'broken');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'pos-module.json'), '{ not valid json ');
    expect(readPostInstall('broken')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// printPostInstallMessages
// ---------------------------------------------------------------------------

describe('printPostInstallMessages', () => {
  test('prints nothing and returns [] when no module has a message', () => {
    const printed = printPostInstallMessages(['a', 'b'], { read: () => null });
    expect(printed).toEqual([]);
    expect(logger.Print).not.toHaveBeenCalled();
  });

  test('prints only modules that have a message, in order, de-duplicated', () => {
    const read = (name) => (name === 'core' ? null : `msg for ${name}`);
    const printed = printPostInstallMessages(['user', 'core', 'user', 'chat'], { read, isTTY: false });
    expect(printed).toEqual(['user', 'chat']);
    expect(logger.Print).toHaveBeenCalledTimes(2);
  });

  test('non-TTY output is a plain labelled block (no box drawing)', () => {
    printPostInstallMessages(['user'], { read: () => 'hello', isTTY: false });
    const out = logger.Print.mock.calls[0][0];
    expect(out).toContain('post-install (user):');
    expect(out).toContain('hello');
    expect(out).not.toContain('─');
  });

  test('TTY output draws a bordered box', () => {
    printPostInstallMessages(['user'], { read: () => 'hello', isTTY: true });
    const out = logger.Print.mock.calls[0][0];
    expect(out).toContain('─');
    expect(out).toContain('user');
    expect(out).toContain('hello');
  });
});
