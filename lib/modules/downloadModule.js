import { randomUUID } from 'crypto';
import logger from '../logger.js';
import downloadFile from '../downloadFile.js';
import { unzip } from '../unzip.js';
import Portal from '../portal.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getModulesDir, getModulePath } from './paths.js';

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

/**
 * Returns the subset of modulesLocked that actually needs to be downloaded.
 *
 * A module is skipped when BOTH of the following are true:
 *  1. Its version in previousLock matches the newly resolved version (no change).
 *  2. Its directory already exists on disk (a previous download succeeded).
 *
 * The disk check catches the case where the lock file is up-to-date but the
 * module directory was deleted manually — in that case we must re-download.
 */
const modulesToDownload = (modulesLocked, previousLock) =>
  Object.fromEntries(
    Object.entries(modulesLocked).filter(([name, version]) => {
      if (previousLock[name] !== version) return true;
      return !fs.existsSync(getModulePath(name));
    })
  );

/**
 * Returns the subset of modules whose directory is missing from disk.
 * Used by --frozen mode where the lock is already the source of truth and
 * there is no "previous lock" to compare versions against.
 */
const modulesNotOnDisk = (modules) =>
  Object.fromEntries(
    Object.entries(modules).filter(([name]) => !fs.existsSync(getModulePath(name)))
  );

export { downloadModule, downloadAllModules, modulesToDownload, modulesNotOnDisk };
