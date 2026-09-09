import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  OWNER_ONLY,
  permissionsOf,
  restrictToOwner,
  supportsPosixPermissions,
  writeFileOwnerOnly
} from '#lib/filePermissions.js';

let workdir;
let filePath;

beforeEach(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-perms-'));
  filePath = path.join(workdir, '.pos');
});

afterEach(() => {
  fs.rmSync(workdir, { recursive: true, force: true });
});

// The half of the contract that holds everywhere: whatever the platform does with the mode,
// the file is written and the caller hears about a failed write.
describe('everywhere', () => {
  test('writes the contents', () => {
    writeFileOwnerOnly(filePath, '{"staging":{}}');

    expect(fs.readFileSync(filePath, 'utf8')).toBe('{"staging":{}}');
  });

  test('overwrites an existing file rather than appending', () => {
    fs.writeFileSync(filePath, 'stale');

    writeFileOwnerOnly(filePath, 'fresh');

    expect(fs.readFileSync(filePath, 'utf8')).toBe('fresh');
  });

  // Only the tightening is best effort — a write that cannot happen at all is the caller's
  // problem, and .pos writers report it.
  test('propagates a failed write', () => {
    const unwritable = path.join(workdir, 'no', 'such', 'dir', '.pos');

    expect(() => writeFileOwnerOnly(unwritable, 'x')).toThrow(/ENOENT/);
  });

  // The reason restrictToOwner returns a boolean instead of throwing: a file that vanished
  // under us, or a filesystem that refuses the call, must not fail the command that just
  // wrote credentials successfully.
  test('reports rather than throws when the mode cannot be applied', () => {
    expect(restrictToOwner(path.join(workdir, 'missing'))).toBe(false);
  });
});

describe.skipIf(!supportsPosixPermissions)('on a platform with permission bits', () => {
  test('creates the file owner-only', () => {
    writeFileOwnerOnly(filePath, '{}');

    expect(permissionsOf(filePath)).toBe(OWNER_ONLY);
  });

  // writeFileSync's mode applies to creation only, so an existing file keeps whatever it
  // had — .pos files written before pos-cli cached anything short-lived are 0644.
  test('tightens a file that already exists', () => {
    fs.writeFileSync(filePath, '{}', { mode: 0o644 });

    writeFileOwnerOnly(filePath, '{"staging":{}}');

    expect(permissionsOf(filePath)).toBe(OWNER_ONLY);
  });

  test('restrictToOwner tightens on its own and says it did', () => {
    fs.writeFileSync(filePath, '{}', { mode: 0o644 });

    expect(restrictToOwner(filePath)).toBe(true);
    expect(permissionsOf(filePath)).toBe(OWNER_ONLY);
  });
});

// Windows collapses the mode onto a read-only attribute, so there is no owner-only to
// reach: the helpers must stay quiet about it rather than throw or claim success.
describe.skipIf(supportsPosixPermissions)('on a platform without permission bits', () => {
  test('writes the file and reports that no mode was applied', () => {
    writeFileOwnerOnly(filePath, '{}');

    expect(fs.existsSync(filePath)).toBe(true);
    expect(restrictToOwner(filePath)).toBe(false);
  });

  // Still writable afterwards: a mode with the owner-write bit set must not leave the
  // read-only attribute behind, or the next write to .pos would fail with EPERM.
  test('leaves the file writable', () => {
    writeFileOwnerOnly(filePath, '{}');

    expect(() => fs.writeFileSync(filePath, '{"staging":{}}')).not.toThrow();
  });
});
