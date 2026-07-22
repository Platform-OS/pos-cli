import fs from 'fs';
import path from 'path';

import files from '../files.js';
import dir from '../directories.js';
import { POS_MODULE_LOCK_FILE } from '../modules/paths.js';

const readLock = (lockPath) => {
  const raw = files.readJSON(lockPath, { exit: false }) || {};
  return {
    dependencies: raw.dependencies || {},
    devDependencies: raw.devDependencies || {},
    registries: raw.registries || {}
  };
};

/**
 * Builds the pos-module.lock.json content to embed at the deploy archive root, so the
 * instance can install the full module dependency tree itself instead of pos-cli shipping
 * per-module manifests or re-resolving anything over the network at deploy time.
 *
 * Prefers the project's own root pos-module.lock.json when present — the standard case,
 * where `pos-cli modules install` already resolved the full tree for this project. Falls
 * back to merging per-module modules/<name>/pos-module.lock.json files, which ship inside
 * a module's own release.zip (see `pos-cli modules push`) and land on disk when a module
 * is dropped into a bare modules/ directory with no root manifest — e.g. a Partner Portal
 * single-module deploy.
 *
 * Returns null when no lock file is available anywhere.
 */
const resolveDeployLock = (moduleNames) => {
  if (fs.existsSync(POS_MODULE_LOCK_FILE)) {
    return readLock(POS_MODULE_LOCK_FILE);
  }

  const merged = { dependencies: {}, devDependencies: {}, registries: {} };
  let found = false;
  for (const name of moduleNames) {
    const nestedLockPath = path.join(dir.MODULES, name, POS_MODULE_LOCK_FILE);
    if (!fs.existsSync(nestedLockPath)) continue;
    found = true;
    const lock = readLock(nestedLockPath);
    Object.assign(merged.dependencies, lock.dependencies);
    Object.assign(merged.devDependencies, lock.devDependencies);
    Object.assign(merged.registries, lock.registries);
  }

  return found ? merged : null;
};

export { resolveDeployLock };
