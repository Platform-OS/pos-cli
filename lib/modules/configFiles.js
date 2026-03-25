import files from '../files.js';
import fs from 'fs';
import path from 'path';

const posConfigDirectory = 'app';
const posModulesFilePath = `${posConfigDirectory}/pos-modules.json`;
const posModulesLockFilePath = `${posConfigDirectory}/pos-modules.lock.json`;
const DEFAULT_REPOSITORY_URL = 'https://partners.platformos.com';

const readLocalModules = () => {
  const config = files.readJSON(posModulesFilePath, { throwDoesNotExistError: false });
  return config['modules'] || {};
};

/**
 * Returns the repository URL for the module registry.
 * Reads from pos-modules.json, falling back to the default Partners Portal URL.
 * The PARTNER_PORTAL_HOST environment variable takes precedence over both.
 */
const readRepositoryUrl = () => {
  if (process.env.PARTNER_PORTAL_HOST) return process.env.PARTNER_PORTAL_HOST;
  const config = files.readJSON(posModulesFilePath, { throwDoesNotExistError: false });
  return config['repository_url'] || DEFAULT_REPOSITORY_URL;
};

const readPosModulesLock = () => {
  const config = files.readJSON(posModulesLockFilePath, { throwDoesNotExistError: false });
  return config['modules'] || {};
};

const writePosModules = (modules, repositoryUrl = DEFAULT_REPOSITORY_URL) => {
  fs.writeFileSync(
    path.join(process.cwd(), posModulesFilePath),
    JSON.stringify({ repository_url: repositoryUrl, modules }, null, 2)
  );
};

const writePosModulesLock = (modules, repositoryUrl = DEFAULT_REPOSITORY_URL) => {
  fs.writeFileSync(
    path.join(process.cwd(), posModulesLockFilePath),
    JSON.stringify({ repository_url: repositoryUrl, modules }, null, 2)
  );
};

export { posModulesFilePath, posModulesLockFilePath, DEFAULT_REPOSITORY_URL, readLocalModules, readRepositoryUrl, readPosModulesLock, writePosModules, writePosModulesLock, posConfigDirectory };
