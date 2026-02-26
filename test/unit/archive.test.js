import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import unzipper from 'unzipper';

vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));

const fixturesPath = path.join(process.cwd(), 'test', 'fixtures', 'deploy');

const listZipEntries = async zipPath => {
  const directory = await unzipper.Open.file(zipPath);
  return directory.files.map(f => f.path);
};

const readZipEntry = async (zipPath, entryPath) => {
  const directory = await unzipper.Open.file(zipPath);
  const entry = directory.files.find(f => f.path === entryPath);
  if (!entry) return null;
  return (await entry.buffer()).toString('utf8');
};

describe('Archive utilities', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-test-'));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('prepareArchive', () => {
    test('addFile adds a real file to the zip', async () => {
      process.chdir(path.join(fixturesPath, 'correct'));
      const { default: prepareArchive } = await import('#lib/prepareArchive.js');
      const zipPath = path.join(tmpDir, 'test.zip');

      const archive = prepareArchive(zipPath);
      archive.addFile('app/views/pages/hello.liquid', 'app/views/pages/hello.liquid');
      archive.finalize();

      const count = await archive.done;
      expect(count).toBe(1);

      const entries = await listZipEntries(zipPath);
      expect(entries).toContain('app/views/pages/hello.liquid');
    });

    test('addBuffer adds buffer content to the zip', async () => {
      process.chdir(path.join(fixturesPath, 'correct'));
      const { default: prepareArchive } = await import('#lib/prepareArchive.js');
      const zipPath = path.join(tmpDir, 'test.zip');

      const archive = prepareArchive(zipPath);
      const content = 'Hello from buffer!';
      archive.addBuffer(Buffer.from(content), 'buffer-file.txt');
      archive.finalize();

      const count = await archive.done;
      expect(count).toBe(1);

      const fileContent = await readZipEntry(zipPath, 'buffer-file.txt');
      expect(fileContent).toBe(content);
    });

    test('done resolves with total file count', async () => {
      process.chdir(path.join(fixturesPath, 'correct'));
      const { default: prepareArchive } = await import('#lib/prepareArchive.js');
      const zipPath = path.join(tmpDir, 'test.zip');

      const archive = prepareArchive(zipPath);
      archive.addBuffer(Buffer.from('file 1'), 'a.txt');
      archive.addBuffer(Buffer.from('file 2'), 'b.txt');
      archive.addBuffer(Buffer.from('file 3'), 'c.txt');
      archive.finalize();

      const count = await archive.done;
      expect(count).toBe(3);
    });

    test('appendTemplated renders template variables into zip entry content', async () => {
      process.chdir(path.join(fixturesPath, 'correct'));
      const { default: prepareArchive } = await import('#lib/prepareArchive.js');
      const zipPath = path.join(tmpDir, 'test.zip');

      const tempFile = path.join(tmpDir, 'template.liquid');
      fs.writeFileSync(tempFile, 'Hello <%= name =%>!');

      const archive = prepareArchive(zipPath);
      archive.appendTemplated(tempFile, 'out/template.liquid', { name: 'World' });
      archive.finalize();

      await archive.done;

      const content = await readZipEntry(zipPath, 'out/template.liquid');
      expect(content).toBe('Hello World!');
    });

    test('appendTemplated uses file directly when no template data provided', async () => {
      process.chdir(path.join(fixturesPath, 'correct'));
      const { default: prepareArchive } = await import('#lib/prepareArchive.js');
      const zipPath = path.join(tmpDir, 'test.zip');

      const archive = prepareArchive(zipPath);
      archive.appendTemplated('app/views/pages/hello.liquid', 'app/views/pages/hello.liquid', {});
      archive.finalize();

      const count = await archive.done;
      expect(count).toBe(1);

      const entries = await listZipEntries(zipPath);
      expect(entries).toContain('app/views/pages/hello.liquid');
    });
  });

  describe('makeArchive', () => {
    test('creates zip file with app files', async () => {
      process.chdir(path.join(fixturesPath, 'correct'));
      const { makeArchive } = await import('#lib/archive.js');
      const zipPath = path.join(tmpDir, 'release.zip');

      const count = await makeArchive({ TARGET: zipPath }, { withoutAssets: false });

      expect(count).toBeGreaterThan(0);
      expect(fs.existsSync(zipPath)).toBe(true);
    });

    test('app files are stored with app/ prefix in archive', async () => {
      process.chdir(path.join(fixturesPath, 'correct'));
      const { makeArchive } = await import('#lib/archive.js');
      const zipPath = path.join(tmpDir, 'release.zip');

      await makeArchive({ TARGET: zipPath }, { withoutAssets: false });

      const entries = await listZipEntries(zipPath);
      expect(entries).toContain('app/views/pages/hello.liquid');
    });

    test('module files are stored under modules/ prefix in archive', async () => {
      process.chdir(path.join(fixturesPath, 'correct'));
      const { makeArchive } = await import('#lib/archive.js');
      const zipPath = path.join(tmpDir, 'release.zip');

      await makeArchive({ TARGET: zipPath }, { withoutAssets: false });

      const entries = await listZipEntries(zipPath);
      expect(entries.some(e => e.startsWith('modules/'))).toBe(true);
      expect(entries.some(e => e.includes('hello-test-module.liquid'))).toBe(true);
    });

    test('excludes asset files when withoutAssets is true', async () => {
      process.chdir(path.join(fixturesPath, 'correct_with_assets'));
      const { makeArchive } = await import('#lib/archive.js');
      const zipPath = path.join(tmpDir, 'release.zip');

      await makeArchive({ TARGET: zipPath }, { withoutAssets: true });

      const entries = await listZipEntries(zipPath);
      expect(entries.some(e => e.includes('/assets/'))).toBe(false);
    });

    test('only includes module files under public/ or private/, not sibling directories', async () => {
      // fixture has testModule/generators/crud.js and testModule/react-app/node_modules/.../page.png
      // alongside testModule/public/ — neither should appear in the archive
      process.chdir(path.join(fixturesPath, 'correct'));
      const { makeArchive } = await import('#lib/archive.js');
      const zipPath = path.join(tmpDir, 'release.zip');

      await makeArchive({ TARGET: zipPath }, { withoutAssets: false });

      const entries = await listZipEntries(zipPath);
      expect(entries.some(e => e.includes('generators'))).toBe(false);
      expect(entries.some(e => e.includes('node_modules'))).toBe(false);
      expect(entries.some(e => e.includes('hello-test-module.liquid'))).toBe(true);
    });
  });

  describe('packAssets', () => {
    test('creates zip with app assets stored at root (no prefix)', async () => {
      process.chdir(path.join(fixturesPath, 'correct_with_assets'));
      const { default: packAssets } = await import('#lib/assets/packAssets.js');
      const zipPath = path.join(tmpDir, 'assets.zip');

      await packAssets(zipPath);

      expect(fs.existsSync(zipPath)).toBe(true);
      const entries = await listZipEntries(zipPath);
      expect(entries).toContain('foo.js');
      expect(entries).toContain('bar.js');
    });

    test('module assets strip public/private/assets prefix', async () => {
      process.chdir(path.join(fixturesPath, 'correct_with_assets'));
      const { default: packAssets } = await import('#lib/assets/packAssets.js');
      const zipPath = path.join(tmpDir, 'assets.zip');

      await packAssets(zipPath);

      const entries = await listZipEntries(zipPath);
      // modules/testModule/public/assets/bar.js → modules/testModule/bar.js
      expect(entries).toContain('modules/testModule/bar.js');
      expect(entries.some(e => e.includes('public/assets'))).toBe(false);
    });
  });
});
