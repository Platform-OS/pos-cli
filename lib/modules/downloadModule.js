import { randomUUID } from 'crypto';
import logger from '../logger.js';
import downloadFile from '../downloadFile.js';
import { unzip } from '../unzip.js';
import Portal from '../portal.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getModulesDir, getModulePath, POS_MODULE_FILE, TEMPLATE_VALUES_FILE } from './paths.js';
import { safeReadFile } from './postInstall.js';

/**
 * Downloads and extracts a single module archive.
 *
 * @param {string}   moduleName    Module name (e.g. "core").
 * @param {string}   version       Exact version to download.
 * @param {string}   [registryUrl] Registry URL for the download request.
 * @param {Function} [fetchVersions] Optional: replaces Portal.moduleVersionsSearch for testing.
 *                                  Signature: (moduleWithVersion, registryUrl) => Promise<{ public_archive: string }>
 */
const downloadModule = async (moduleName, version, registryUrl, fetchVersions = null) => {
  const fetcher = fetchVersions ?? Portal.moduleVersionsSearch.bind(Portal);
  const moduleWithVersion = `${moduleName}@${version}`;
  // randomUUID() avoids temp-file collisions under concurrent installs of the same module.
  const tmpFile = path.join(os.tmpdir(), `pos-module-${moduleName}-${randomUUID()}.zip`);
  try {
    logger.Info(`Downloading ${moduleWithVersion}...`);
    const moduleVersion = await fetcher(moduleWithVersion, registryUrl);
    await downloadFile(moduleVersion['public_archive'], tmpFile);
    // Remove old dir only after download succeeds — keeps the module directory
    // intact if the network/registry call fails mid-stream.
    await fs.promises.rm(getModulePath(moduleName), { recursive: true, force: true });
    await unzip(tmpFile, getModulesDir());
  } catch (error) {
    throw new Error(`${moduleWithVersion}: ${error.statusCode === 404 ? '404 not found' : error.message}`);
  } finally {
    await fs.promises.rm(tmpFile, { force: true });
  }
};

/**
 * @param {Object}   modules        { name: version } map of modules to download.
 * @param {Function} getRegistryUrl (name) => registryUrl — called per module so each
 *                                  can be fetched from its own registry.
 * @param {Function} [fetchVersions] Optional: injected fetcher forwarded to downloadModule.
 *                                  Useful for testing without a global Portal mock.
 */
const downloadAllModules = async (modules, getRegistryUrl, fetchVersions = null) => {
  await Promise.all(
    Object.entries(modules).map(([moduleName, version]) =>
      downloadModule(moduleName, version, getRegistryUrl(moduleName), fetchVersions)
    )
  );
};

const readJsonVersion = (filePath) => safeReadFile(filePath, (raw) => JSON.parse(raw).version ?? null);

/**
 * Reads the `version` field recorded in an installed module's own manifest:
 * modules/<name>/pos-module.json, falling back to modules/<name>/template-values.json
 * for modules published before the pos-module.json convention existed (many
 * currently-published registry modules still ship this way). Returns null when
 * neither file exists, is readable, or carries a `version` field — treated the
 * same as "not installed" by callers. Uses the same safe-read primitive as
 * postInstall.js's module-manifest lookups (postInstall.js's safeReadFile).
 */
const readInstalledVersion = (name) => {
  const dir = getModulePath(name);
  return readJsonVersion(path.join(dir, POS_MODULE_FILE)) ?? readJsonVersion(path.join(dir, TEMPLATE_VALUES_FILE));
};

/**
 * Returns the subset of modules whose installed disk version does not match
 * the target version — including modules missing from disk entirely. Used by
 * --frozen mode (and smartInstall's fast path) where the lock is already the
 * source of truth and there is no "previous lock" to compare versions against.
 *
 * Checking installed disk version rather than mere directory presence catches
 * modules whose directory exists but whose contents are stale or corrupted —
 * e.g. deleted manually then recreated empty, a failed/partial extraction, or
 * simply never updated after the lock file itself was bumped (by a teammate,
 * a merge, etc.) without the module directory being refreshed locally.
 */
const modulesNotOnDisk = (modules) =>
  Object.fromEntries(
    Object.entries(modules).filter(([name, version]) => readInstalledVersion(name) !== version)
  );

/**
 * Returns the subset of modulesLocked that actually needs to be downloaded:
 * everything modulesNotOnDisk flags, plus any module whose version in
 * previousLock no longer matches the newly resolved version.
 */
const modulesToDownload = (modulesLocked, previousLock) => ({
  ...Object.fromEntries(
    Object.entries(modulesLocked).filter(([name, version]) => previousLock[name] !== version)
  ),
  ...modulesNotOnDisk(modulesLocked),
});

export { downloadModule, downloadAllModules, modulesToDownload, modulesNotOnDisk, readInstalledVersion };
