import { describe, test, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getStagingBase, createStagingDir, clearStagingBase } from '#lib/modules/staging.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';

withTmpDir();

describe('getStagingBase', () => {
  // Not os.tmpdir(): publishing a module ends in a rename() onto modules/<name>, which
  // fails with EXDEV across filesystems, so staging has to live under the project root.
  test('is a directory under the project, inside pos-cli\'s existing tmp/ scratch area', () => {
    expect(getStagingBase()).toBe(path.join(process.cwd(), 'tmp', 'pos-cli-module-staging'));
  });
});

describe('createStagingDir', () => {
  const created = [];
  const create = async (name) => {
    const dir = await createStagingDir(name);
    created.push(dir);
    return dir;
  };

  afterEach(() => {
    while (created.length) fs.rmSync(created.pop(), { recursive: true, force: true });
  });

  test('creates an empty directory named for the module, inside the staging base', async () => {
    const dir = await create('core');

    expect(fs.readdirSync(dir)).toEqual([]);
    expect(path.dirname(dir)).toBe(getStagingBase());
    expect(path.basename(dir)).toMatch(/^pos-cli-unpack-core-\w+$/);
  });

  test('creates the staging base on demand', async () => {
    expect(fs.existsSync(getStagingBase())).toBe(false);

    await create('core');

    expect(fs.existsSync(getStagingBase())).toBe(true);
  });

  test('never collides, so concurrent installs of the same module cannot share a directory', async () => {
    const dirs = await Promise.all(['core', 'core', 'core'].map(() => create('core')));

    expect(new Set(dirs).size).toBe(3);
  });

  test('stages outside modules/, so a half-extracted tree is never enumerated as a module', async () => {
    await create('core');

    expect(fs.existsSync(path.join(process.cwd(), 'modules'))).toBe(false);
  });
});

describe('clearStagingBase', () => {
  test('removes the base along with leftovers from an earlier killed run', async () => {
    fs.mkdirSync(path.join(getStagingBase(), 'pos-cli-unpack-core-leftover'), { recursive: true });

    await clearStagingBase();

    expect(fs.existsSync(getStagingBase())).toBe(false);
  });

  test('is a no-op when the base was never created', async () => {
    await expect(clearStagingBase()).resolves.toBeUndefined();
  });
});
