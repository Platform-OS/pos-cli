import logger from '../logger.js';
import downloadFile from '../downloadFile.js';
import { unzip } from '../unzip.js';
import Portal from '../portal.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const downloadModule = async (moduleName, version, registryUrl) => {
  const moduleWithVersion = `${moduleName}@${version}`;
  const tmpFile = path.join(os.tmpdir(), `pos-module-${moduleName}-${Date.now()}.zip`);
  try {
    logger.Info(`Downloading ${moduleWithVersion}...`);
    const moduleVersion = await Portal.moduleVersionsSearch(moduleWithVersion, registryUrl);
    const modulePath = path.join(process.cwd(), 'modules', moduleName);
    await fs.promises.rm(modulePath, { recursive: true, force: true });
    await downloadFile(moduleVersion['public_archive'], tmpFile);
    await unzip(tmpFile, path.join(process.cwd(), 'modules'));
  } catch (error) {
    if (error.statusCode === 404) {
      throw new Error(`${moduleWithVersion}: 404 not found`);
    } else {
      throw new Error(`${moduleWithVersion}: ${error.message}`);
    }
  } finally {
    await fs.promises.rm(tmpFile, { force: true });
  }
};

const downloadAllModules = async (modules, registryUrl) => {
  for (const [moduleName, version] of Object.entries(modules)) {
    await downloadModule(moduleName, version, registryUrl);
  }
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
      return !fs.existsSync(path.join(process.cwd(), 'modules', name));
    })
  );

export { downloadModule, downloadAllModules, modulesToDownload };
