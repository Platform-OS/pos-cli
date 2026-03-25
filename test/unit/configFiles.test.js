import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readPosModulesLock, readRepositoryUrl, readLocalModules, writePosModules, writePosModulesLock, DEFAULT_REPOSITORY_URL } from '#lib/modules/configFiles.js';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Error: vi.fn(), Info: vi.fn(), Warn: vi.fn(), Success: vi.fn() }
}));

// All tests use a temporary directory so the real project files are never touched.
let tmpDir;
let originalCwd;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-test-'));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.PARTNER_PORTAL_HOST;
});

// readPosModulesLock reads from process.cwd()/app/pos-modules.lock.json.
describe('readPosModulesLock', () => {
  test('returns empty object when the lock file does not exist', () => {
    expect(readPosModulesLock()).toEqual({});
  });

  test('returns the modules map from an existing lock file', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));
    fs.writeFileSync(
      path.join(tmpDir, 'app', 'pos-modules.lock.json'),
      JSON.stringify({ modules: { core: '2.0.6', user: '5.1.2' } }, null, 2)
    );

    expect(readPosModulesLock()).toEqual({ core: '2.0.6', user: '5.1.2' });
  });

  test('returns empty object when the lock file exists but has no modules key', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));
    fs.writeFileSync(path.join(tmpDir, 'app', 'pos-modules.lock.json'), JSON.stringify({}));

    expect(readPosModulesLock()).toEqual({});
  });
});

// readRepositoryUrl reads from process.cwd()/app/pos-modules.json.
describe('readRepositoryUrl', () => {
  test('returns DEFAULT_REPOSITORY_URL when pos-modules.json does not exist', () => {
    expect(readRepositoryUrl()).toBe(DEFAULT_REPOSITORY_URL);
  });

  test('returns the repository_url from pos-modules.json when present', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));
    fs.writeFileSync(
      path.join(tmpDir, 'app', 'pos-modules.json'),
      JSON.stringify({ repository_url: 'https://custom.registry.example.com', modules: {} }, null, 2)
    );

    expect(readRepositoryUrl()).toBe('https://custom.registry.example.com');
  });

  test('returns DEFAULT_REPOSITORY_URL when pos-modules.json has no repository_url', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));
    fs.writeFileSync(
      path.join(tmpDir, 'app', 'pos-modules.json'),
      JSON.stringify({ modules: { core: '2.0.6' } }, null, 2)
    );

    expect(readRepositoryUrl()).toBe(DEFAULT_REPOSITORY_URL);
  });

  test('PARTNER_PORTAL_HOST env var takes precedence over pos-modules.json', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));
    fs.writeFileSync(
      path.join(tmpDir, 'app', 'pos-modules.json'),
      JSON.stringify({ repository_url: 'https://custom.registry.example.com', modules: {} }, null, 2)
    );
    process.env.PARTNER_PORTAL_HOST = 'https://env-override.example.com';

    expect(readRepositoryUrl()).toBe('https://env-override.example.com');
  });
});

// writePosModules writes to process.cwd()/app/pos-modules.json.
describe('writePosModules', () => {
  test('writes repository_url and modules to pos-modules.json', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));

    writePosModules({ core: '2.0.6' });

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'app', 'pos-modules.json'), 'utf8'));
    expect(written).toEqual({ repository_url: DEFAULT_REPOSITORY_URL, modules: { core: '2.0.6' } });
  });

  test('writes a custom repository_url when provided', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));

    writePosModules({ core: '2.0.6' }, 'https://custom.registry.example.com');

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'app', 'pos-modules.json'), 'utf8'));
    expect(written.repository_url).toBe('https://custom.registry.example.com');
  });

  test('written file is readable by readLocalModules', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));

    writePosModules({ core: '2.0.6', user: '5.1.2' });

    expect(readLocalModules()).toEqual({ core: '2.0.6', user: '5.1.2' });
  });

  test('written repository_url is readable by readRepositoryUrl', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));

    writePosModules({ core: '2.0.6' }, 'https://custom.registry.example.com');

    expect(readRepositoryUrl()).toBe('https://custom.registry.example.com');
  });
});

// writePosModulesLock writes to process.cwd()/app/pos-modules.lock.json.
describe('writePosModulesLock', () => {
  test('writes repository_url and modules to pos-modules.lock.json', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));

    writePosModulesLock({ core: '2.0.6', user: '5.1.2' });

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'app', 'pos-modules.lock.json'), 'utf8'));
    expect(written).toEqual({
      repository_url: DEFAULT_REPOSITORY_URL,
      modules: { core: '2.0.6', user: '5.1.2' }
    });
  });

  test('writes a custom repository_url when provided', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));

    writePosModulesLock({ core: '2.0.6' }, 'https://custom.registry.example.com');

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'app', 'pos-modules.lock.json'), 'utf8'));
    expect(written.repository_url).toBe('https://custom.registry.example.com');
  });

  test('round-trip: written lock file is readable by readPosModulesLock', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));

    writePosModulesLock({ core: '2.0.6', user: '5.1.2' });

    expect(readPosModulesLock()).toEqual({ core: '2.0.6', user: '5.1.2' });
  });
});

// readLocalModules reads from process.cwd()/app/pos-modules.json.
describe('readLocalModules', () => {
  test('returns empty object when pos-modules.json does not exist', () => {
    expect(readLocalModules()).toEqual({});
  });

  test('returns the modules map from an existing file', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));
    fs.writeFileSync(
      path.join(tmpDir, 'app', 'pos-modules.json'),
      JSON.stringify({ repository_url: 'https://partners.platformos.com', modules: { core: '2.0.6', user: '5.1.2' } }, null, 2)
    );

    expect(readLocalModules()).toEqual({ core: '2.0.6', user: '5.1.2' });
  });

  test('returns empty object when file exists but has no modules key', () => {
    fs.mkdirSync(path.join(tmpDir, 'app'));
    fs.writeFileSync(
      path.join(tmpDir, 'app', 'pos-modules.json'),
      JSON.stringify({ repository_url: 'https://partners.platformos.com' })
    );

    expect(readLocalModules()).toEqual({});
  });
});
