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

// Tightens a file that already exists. Best effort by design — the mode of a file we just
// wrote successfully is not worth failing a command over (a filesystem that ignores modes,
// a file owned by another account, an exotic mount), and the caller has no better answer
// than carrying on. Returns whether the mode was actually applied.
const restrictToOwner = filePath => {
  if (!supportsPosixPermissions) return false;

  try {
    fs.chmodSync(filePath, OWNER_ONLY);
    return true;
  } catch (error) {
    logger.Debug(`[filePermissions] Could not restrict ${filePath} to 0600: ${error.message}`);
    return false;
  }
};

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

export { OWNER_ONLY, permissionsOf, restrictToOwner, supportsPosixPermissions, writeFileOwnerOnly };
