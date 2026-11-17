import fs from 'fs';
import logger from './logger.js';

// Windows has no POSIX permission bits. fs.chmod there collapses the whole mode onto the
// single read-only attribute — clearing every write bit sets it, leaving one set clears it
// — so a file asked for 0600 still reports 0666, and there is no way to hide it from other
// accounts through the mode. Everything below therefore has one behaviour on POSIX and a
// documented no-op on Windows; callers ask this question here instead of testing
// process.platform themselves, so the platform rule lives in one place (tests included).
const supportsPosixPermissions = process.platform !== 'win32';

// The mode for a file that holds a credential: owner reads and writes, nobody else on the
// machine sees it.
const OWNER_ONLY = 0o600;

// The one writer for files holding credentials — today every writer of .pos.
//
// Two steps, because neither covers the other: the mode passed to writeFileSync applies
// only when the file is created, which is what stops a new file existing world-readable
// even for an instant, and the chmod is what tightens a file that was already there —
// .pos predates holding anything shorter-lived than a year-long token, so the ones written
// by earlier versions are 0644.
//
// Write errors propagate to the caller; only the tightening is best effort.
const writeFileOwnerOnly = (filePath, contents) => {
  fs.writeFileSync(filePath, contents, { mode: OWNER_ONLY });
  restrictToOwner(filePath);
};

// The permission bits of a file, for asserting on what the two writers above did. Only
// meaningful where supportsPosixPermissions is true — guard with it rather than reading a
// number Windows never had.
const permissionsOf = filePath => fs.statSync(filePath).mode & 0o777;

// Sets a file's mode: for a writer that renames a new file over an old one, which takes the new
// file's umask-default mode — a config kept at 0600 must not come back 0644. Best effort by design:
// the mode of a file just written successfully is not worth failing a command over (a filesystem
// that ignores modes, a file owned by another account, an exotic mount), and the caller has no
// better answer than carrying on. Returns whether the mode was actually applied; a no-op on Windows.
const applyPermissions = (filePath, mode) => {
  if (!supportsPosixPermissions || mode === undefined) return false;

  try {
    fs.chmodSync(filePath, mode);
    return true;
  } catch (error) {
    logger.Debug(`[filePermissions] Could not set ${filePath} to ${mode.toString(8).padStart(4, '0')}: ${error.message}`);
    return false;
  }
};

// Tightens a file that already exists to OWNER_ONLY.
const restrictToOwner = filePath => applyPermissions(filePath, OWNER_ONLY);

export { OWNER_ONLY, applyPermissions, permissionsOf, restrictToOwner, supportsPosixPermissions, writeFileOwnerOnly };
