import files from '../files.js';
import fs from 'fs';
import path from 'path';
import { MANIFEST_STRATEGIES } from './manifest/strategies.js';
import {
  POS_MODULE_FILE,
  POS_MODULE_LOCK_FILE,
  LEGACY_POS_MODULES_FILE,
  LEGACY_POS_MODULES_LOCK_FILE,
  FALLBACK_REGISTRY_URL,
} from './paths.js';

// Read the manifest file using the strategy that matches the current project layout.
// The fallback is intentionally read-only: writes always go to POS_MODULE_FILE.
const readManifest = () => MANIFEST_STRATEGIES.find(s => s.canHandle()).read();

/**
 * Returns install/update context from pos-module.json in a single file read:
 * { dependencies, devDependencies, registries }.
 * Use this in commands that need more than one of these values.
 */
const readConfig = () => {
  const config = readManifest();
  return {
    dependencies: config['dependencies'] || {},
    devDependencies: config['devDependencies'] || {},
    registries: config['registries'] || {}
  };
};

/**
 * Returns the production (or merged) dependencies from pos-module.json.
 *
 * @param {Object} [options]
 * @param {boolean} [options.includeDev=false] When true, merges devDependencies into the result.
 */
const readLocalModules = ({ includeDev = false } = {}) => {
  const { dependencies, devDependencies } = readConfig();
  // prod deps win on collision: spread devDependencies first so dependencies overwrites.
  // Having the same module in both sections is a user error; prod takes precedence.
  return includeDev ? { ...devDependencies, ...dependencies } : dependencies;
};

/** Normalises a raw lock-file object into the canonical shape, filling in defaults. */
const normalizeLock = (raw = {}) => ({
  dependencies: raw['dependencies'] || {},
  devDependencies: raw['devDependencies'] || {},
  registries: raw['registries'] || {},
});

/**
 * Returns the full lock file as { dependencies, devDependencies, registries }.
 * Falls back to the legacy app/pos-modules.lock.json (read-only).
 */
const readPosModulesLock = () => {
  if (fs.existsSync(POS_MODULE_LOCK_FILE)) {
    const lock = files.readJSON(POS_MODULE_LOCK_FILE, { throwDoesNotExistError: false });
    return normalizeLock(lock);
  }
  if (fs.existsSync(LEGACY_POS_MODULES_LOCK_FILE)) {
    const legacy = files.readJSON(LEGACY_POS_MODULES_LOCK_FILE, { throwDoesNotExistError: false }) ?? {};
    return normalizeLock({ dependencies: legacy['modules'] });
  }
  return normalizeLock();
};

/** Returns the default registry URL, respecting the PARTNER_PORTAL_HOST env var. */
const getRegistryUrl = () => process.env.PARTNER_PORTAL_HOST || FALLBACK_REGISTRY_URL;

/**
 * Writes dependencies (and optionally devDependencies) to pos-module.json.
 * Preserves all other existing fields (name, machine_name, version, repository_url, etc.) so that
 * module repos don't lose their publishing metadata when dependencies are updated.
 *
 * @param {Object} dependencies
 * @param {Object} [devDependencies={}]
 */
const writePosModules = (dependencies, devDependencies = {}) => {
  let existing = {};
  if (fs.existsSync(POS_MODULE_FILE)) {
    existing = files.readJSON(POS_MODULE_FILE, { throwDoesNotExistError: false }) ?? {};
  }
  // Strip the dep keys we are about to (re)write; preserve everything else
  // (including repository_url, which is publishing metadata, not our concern here).
  const { dependencies: _d, devDependencies: _dd, modules: _m, ...rest } = existing;
  const content = { ...rest, dependencies };
  if (Object.keys(devDependencies).length > 0) content.devDependencies = devDependencies;
  fs.writeFileSync(
    path.join(process.cwd(), POS_MODULE_FILE),
    JSON.stringify(content, null, 2)
  );
};

/**
 * Writes the lock file with separate dependencies, devDependencies, and per-module registries.
 * Every resolved module should have an explicit entry in registries so that --frozen
 * knows exactly where to fetch each module from without any global fallback.
 *
 * @param {Object} dependencies         Resolved production dep versions (flat map).
 * @param {Object} [devDependencies={}] Resolved dev-exclusive dep versions (flat map).
 * @param {Object} [registries={}]      Per-module registry URL — one entry per resolved module.
 */
const writePosModulesLock = (dependencies, devDependencies = {}, registries = {}) => {
  const content = { dependencies, devDependencies };
  if (Object.keys(registries).length > 0) content.registries = registries;
  fs.writeFileSync(
    path.join(process.cwd(), POS_MODULE_LOCK_FILE),
    JSON.stringify(content, null, 2)
  );
};

export {
  getRegistryUrl,
  readManifest,
  readConfig,
  readLocalModules,
  readPosModulesLock,
  writePosModules,
  writePosModulesLock
};
