/**
 * No test writes a configuration into the repository root. Files run in parallel processes, all
 * with the root as their working directory, so a `.pos` written there is read by whatever else is
 * running. Save-and-restore does not fix it: each process restores what it saw, and the last
 * writer leaves a gitignored `.pos` behind that every later run reads.
 *
 * Use `CONFIG_FILE_PATH` with a temp directory (`mcp-min/__tests__/helpers/dot-pos.js`), or give
 * the command a temp `cwd`.
 */
import fs from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';

const REPO = path.resolve(import.meta.dirname, '../..');
const TEST_DIRECTORIES = ['test', 'mcp-min/__tests__'];

// `path.resolve('.pos')`, `writeFileSync('.pos', …)`, `join(process.cwd(), '.pos')`: every way of
// naming a config in the working directory, which for a test is the repository root. Naming them
// here is why this file excludes itself below.
const REPO_ROOT_CONFIG = [
  /resolve\(\s*['"`]\.(pos|marketplace-kit|posignore)/,
  /writeFileSync\(\s*['"`]\.(pos|marketplace-kit|posignore)/,
  /cwd\(\)\s*,\s*['"`]\.(pos|marketplace-kit|posignore)/
];

const SELF = path.resolve(import.meta.filename);

function testFiles(dir) {
  const root = path.join(REPO, dir);
  if (!fs.existsSync(root)) return [];
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'fixtures') walk(full);
      else if (entry.isFile() && full.endsWith('.js') && full !== SELF) found.push(full);
    }
  };
  walk(root);
  return found;
}

describe('tests keep out of the repository root', () => {
  test.each(TEST_DIRECTORIES)('nothing under %s writes a config there', (dir) => {
    const offenders = testFiles(dir)
      .filter(file => REPO_ROOT_CONFIG.some(pattern => pattern.test(fs.readFileSync(file, 'utf8'))))
      .map(file => path.relative(REPO, file));

    expect(offenders, 'use CONFIG_FILE_PATH with a temp directory, or run the command with a temp cwd').toEqual([]);
  });

  // The helper that made this possible: it assumed it was the only writer.
  test('the shared .pos fixture helper is gone', () => {
    expect(fs.existsSync(path.join(REPO, 'test/utils/fixtures.js'))).toBe(false);
  });
});
