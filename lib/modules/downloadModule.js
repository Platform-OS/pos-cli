import logger from '../logger.js';
import downloadFile from '../downloadFile.js';
import { unzip } from '../unzip.js';
import Portal from '../portal.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const downloadModule = async (moduleName, version) => {
  const moduleWithVersion = `${moduleName}@${version}`;
  const tmpFile = path.join(os.tmpdir(), `pos-module-${moduleName}-${Date.now()}.zip`);
  try {
    logger.Info(`Downloading ${moduleWithVersion}...`);
    const moduleVersion = await Portal.moduleVersionsSearch(moduleWithVersion);
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

const downloadAllModules = async (modules) => {
  for (const [moduleName, version] of Object.entries(modules)) {
    await downloadModule(moduleName, version);
  }
};

export { downloadModule, downloadAllModules };
