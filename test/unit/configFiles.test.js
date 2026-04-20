import { describe, test, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

import logger from '#lib/logger.js';

import {
  readConfig,
  readPosModulesLock,
  readLocalModules,
  writePosModules,
  writePosModulesLock,
  FALLBACK_REGISTRY_URL
} from '#lib/modules/configFiles.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import { makeFileHelpers } from '#test/utils/fileHelpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getTmpDir = withTmpDir();

const { writeManifest, writeLegacyManifest, writeLock, writeLegacyLock } = makeFileHelpers(getTmpDir);

// ---------------------------------------------------------------------------
// readLocalModules
// ---------------------------------------------------------------------------

describe('readLocalModules', () => {
  test('returns {} when neither pos-module.json nor legacy file exists', () => {
    expect(readLocalModules()).toEqual({});
  });

  test('reads dependencies key from pos-module.json', () => {
    writeManifest({ dependencies: { core: '2.0.6', user: '5.1.2' } });
    expect(readLocalModules()).toEqual({ core: '2.0.6', user: '5.1.2' });
  });

  test('returns {} when pos-module.json has no dependencies key', () => {
    writeManifest({ name: 'My App' });
    expect(readLocalModules()).toEqual({});
  });

  test('includeDev:false returns only dependencies (default)', () => {
    writeManifest({
      dependencies: { core: '2.0.6' },
      devDependencies: { tests: '1.0.1' }
    });
    expect(readLocalModules()).toEqual({ core: '2.0.6' });
    expect(readLocalModules({ includeDev: false })).toEqual({ core: '2.0.6' });
  });

  test('includeDev:true returns merged dependencies + devDependencies', () => {
    writeManifest({
      dependencies: { core: '2.0.6' },
      devDependencies: { tests: '1.0.1' }
    });
    expect(readLocalModules({ includeDev: true })).toEqual({ core: '2.0.6', tests: '1.0.1' });
  });

  test('includeDev:true when only devDependencies exist returns them', () => {
    writeManifest({ devDependencies: { tests: '1.0.1' } });
    expect(readLocalModules({ includeDev: true })).toEqual({ tests: '1.0.1' });
  });

  test('dev key collision: production version wins over devDependencies version in merge', () => {
    writeManifest({
      dependencies: { core: '1.0.0' },
      devDependencies: { core: '2.0.0' }
    });
    // prod deps win: a module in both sections is treated as a prod dep in the merged view.
    expect(readLocalModules({ includeDev: true })).toEqual({ core: '1.0.0' });
  });
});

// ---------------------------------------------------------------------------
// Legacy backward compat: app/pos-modules.json fallback (read-only)
// ---------------------------------------------------------------------------

describe('readLocalModules — legacy fallback', () => {
  test('reads from app/pos-modules.json (modules key) when pos-module.json absent', () => {
    writeLegacyManifest({ modules: { core: '2.0.6', user: '5.1.2' } });
    expect(readLocalModules()).toEqual({ core: '2.0.6', user: '5.1.2' });
  });

  test('emits a Warn when falling back to legacy file', () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    readLocalModules();
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('app/pos-modules.json'));
  });

  test('pos-module.json takes precedence over app/pos-modules.json when both exist', () => {
    writeManifest({ dependencies: { core: '3.0.0' } });
    writeLegacyManifest({ modules: { core: '2.0.0' } });
    expect(readLocalModules()).toEqual({ core: '3.0.0' });
    expect(logger.Warn).not.toHaveBeenCalled();
  });

  test('legacy fallback is read-only: no file is written to app/ after reading', () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    readLocalModules();
    // Only app/pos-modules.json should exist — no new pos-module.json yet
    expect(fs.existsSync(path.join(getTmpDir(), 'pos-module.json'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// writePosModules
// ---------------------------------------------------------------------------

describe('writePosModules', () => {
  test('writes dependencies to pos-module.json (no repository_url when file had none)', () => {
    writePosModules({ core: '2.0.6' });
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.dependencies).toEqual({ core: '2.0.6' });
    expect(written).not.toHaveProperty('repository_url');
  });

  test('writes devDependencies when non-empty', () => {
    writePosModules({ core: '2.0.6' }, { tests: '1.0.1' });
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.devDependencies).toEqual({ tests: '1.0.1' });
  });

  test('omits devDependencies key when empty and no existing devDependencies', () => {
    writePosModules({ core: '2.0.6' }, {});
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.devDependencies).toBeUndefined();
  });

  test('clears devDependencies when caller explicitly passes {}', () => {
    writeManifest({ dependencies: {}, devDependencies: { tests: '1.0.1' } });
    writePosModules({ core: '2.0.6' }, {});
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.devDependencies).toBeUndefined();
  });

  test('preserves publishing fields (name, machine_name, version) when updating deps', () => {
    writeManifest({
      name: 'User',
      machine_name: 'user',
      version: '5.1.2',
      dependencies: { core: '1.0.0' }
    });
    writePosModules({ core: '2.0.0' });
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.name).toBe('User');
    expect(written.machine_name).toBe('user');
    expect(written.version).toBe('5.1.2');
    expect(written.dependencies).toEqual({ core: '2.0.0' });
  });

  test('preserves existing repository_url as publishing metadata', () => {
    writeManifest({ repository_url: 'https://custom.example.com', dependencies: { core: '1.0.0' } });
    writePosModules({ core: '2.0.0' });
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.repository_url).toBe('https://custom.example.com');
  });

  test('round-trip: written file is readable by readLocalModules', () => {
    writePosModules({ core: '2.0.6', user: '5.1.2' });
    expect(readLocalModules()).toEqual({ core: '2.0.6', user: '5.1.2' });
  });
});

// ---------------------------------------------------------------------------
// writePosModulesLock
// ---------------------------------------------------------------------------

describe('writePosModulesLock', () => {
  test('writes dependencies and devDependencies to pos-module.lock.json', () => {
    writePosModulesLock({ core: '2.0.6' }, { tests: '1.0.1' });
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.lock.json'), 'utf8'));
    expect(written).toEqual({
      dependencies: { core: '2.0.6' },
      devDependencies: { tests: '1.0.1' }
    });
  });

  test('writes empty devDependencies when not provided', () => {
    writePosModulesLock({ core: '2.0.6' });
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.lock.json'), 'utf8'));
    expect(written.devDependencies).toEqual({});
  });

  test('writes registries when provided', () => {
    writePosModulesLock({ core: '2.0.6' }, {}, { core: FALLBACK_REGISTRY_URL });
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.lock.json'), 'utf8'));
    expect(written.registries).toEqual({ core: FALLBACK_REGISTRY_URL });
  });

  test('omits registries key when empty', () => {
    writePosModulesLock({ core: '2.0.6' });
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.lock.json'), 'utf8'));
    expect(written).not.toHaveProperty('registries');
  });

  test('round-trip: written lock is readable by readPosModulesLock', () => {
    writePosModulesLock({ core: '2.0.6', user: '5.1.2' }, { tests: '1.0.1' });
    expect(readPosModulesLock()).toMatchObject({
      dependencies: { core: '2.0.6', user: '5.1.2' },
      devDependencies: { tests: '1.0.1' }
    });
  });
});

// ---------------------------------------------------------------------------
// readPosModulesLock
// ---------------------------------------------------------------------------

describe('readPosModulesLock', () => {
  test('returns { dependencies:{}, devDependencies:{} } when lock file does not exist', () => {
    expect(readPosModulesLock()).toMatchObject({ dependencies: {}, devDependencies: {} });
  });

  test('reads new-format lock file with separate sections', () => {
    writeLock({ dependencies: { core: '2.0.6' }, devDependencies: { tests: '1.0.1' } });
    expect(readPosModulesLock()).toMatchObject({
      dependencies: { core: '2.0.6' },
      devDependencies: { tests: '1.0.1' }
    });
  });

  test('returns empty sections when keys are absent', () => {
    writeLock({});
    expect(readPosModulesLock()).toMatchObject({ dependencies: {}, devDependencies: {} });
  });

  test('legacy fallback: reads app/pos-modules.lock.json with flat modules key as dependencies', () => {
    writeLegacyLock({ repository_url: FALLBACK_REGISTRY_URL, modules: { core: '2.0.6', user: '5.1.2' } });
    expect(readPosModulesLock()).toMatchObject({
      dependencies: { core: '2.0.6', user: '5.1.2' },
      devDependencies: {}
    });
  });

  test('new pos-module.lock.json takes precedence over legacy lock', () => {
    writeLock({ dependencies: { core: '3.0.0' }, devDependencies: {} });
    writeLegacyLock({ modules: { core: '2.0.0' } });
    expect(readPosModulesLock().dependencies).toEqual({ core: '3.0.0' });
  });
});

// ---------------------------------------------------------------------------
// Malformed JSON — configFiles must not crash when a file contains invalid JSON
// ---------------------------------------------------------------------------

describe('readLocalModules — malformed JSON', () => {
  test('returns {} without throwing when pos-module.json contains invalid JSON', () => {
    fs.writeFileSync(path.join(getTmpDir(), 'pos-module.json'), '{ not valid json }');
    expect(() => readLocalModules()).not.toThrow();
    expect(readLocalModules()).toEqual({});
  });

  test('includeDev:true also returns {} without throwing on malformed JSON', () => {
    fs.writeFileSync(path.join(getTmpDir(), 'pos-module.json'), '{ not valid json }');
    expect(() => readLocalModules({ includeDev: true })).not.toThrow();
    expect(readLocalModules({ includeDev: true })).toEqual({});
  });
});

describe('readPosModulesLock — malformed JSON', () => {
  test('returns default empty sections without throwing when lock file contains invalid JSON', () => {
    fs.writeFileSync(path.join(getTmpDir(), 'pos-module.lock.json'), '{ not valid json }');
    expect(() => readPosModulesLock()).not.toThrow();
    expect(readPosModulesLock()).toMatchObject({ dependencies: {}, devDependencies: {} });
  });
});

