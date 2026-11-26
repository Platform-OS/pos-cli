import crypto from 'crypto';
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

// The one writer for files holding credentials — every writer of .pos and portals.json.
//
// Atomic: the contents go to a new file next to the target, which is then renamed over it.
// Several pos-cli processes can rewrite the same file at once — parallel commands, CI jobs
// sharing $HOME, each caching a bound token or a two-factor session — and writing in place
// let one of them read a half-written file, which fails as invalid JSON and reads like a
// corrupt config the user then deletes, token and all. A rename is all or nothing: a reader
// sees the old file or the new one.
//
// The new file is created owner-only (mode on creation, so it never exists readable by others
// even for an instant) and chmodded to make the mode exact whatever the umask; the rename keeps
// that mode, which also tightens a file earlier versions wrote 0644. A symlink is written
// through, not replaced: the rename lands on the file it points at.
//
// Write errors propagate to the caller, and leave no temporary file behind; only the
// tightening is best effort.
const writeFileOwnerOnly = (filePath, contents) => {
  let target = filePath;
  try {
    target = fs.realpathSync(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const temporary = `${target}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { mode: OWNER_ONLY, flag: 'wx' });
    restrictToOwner(temporary);
    fs.renameSync(temporary, target);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
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
