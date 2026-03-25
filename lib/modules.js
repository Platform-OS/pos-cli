import fs from 'fs';
import path from 'path';
import semver from 'semver';
import glob from 'fast-glob';

import files from './files.js';
import logger from './logger.js';
import Portal from './portal.js';
import prepareArchive from './prepareArchive.js';
import { presignUrlForPortal } from './presignUrl.js';
import { uploadFile } from './s3UploadFile.js';
import waitForStatus from './data/waitForStatus.js';
import { readPassword } from './utils/password.js';
import ServerError from './ServerError.js';
import { POS_MODULE_FILE as moduleManifestFileName } from './modules/paths.js';

let moduleId;
const archiveFileName = 'release.zip';
const archivePath = `./tmp/${archiveFileName}`;

// Legacy file — still supported for reading (template substitution only) and archive glob.
const moduleConfigFileName = 'template-values.json';

/**
 * Reads and returns the module config from pos-module.json.
 * Throws with a migration hint when pos-module.json is absent.
 *
 * @returns {Object}
 */
const moduleConfig = () => {
  if (!fs.existsSync(moduleManifestFileName)) {
    throw new Error(
      `${moduleManifestFileName} not found.\n` +
      `Run: pos-cli modules migrate`
    );
  }
  return files.readJSON(moduleManifestFileName, { throwDoesNotExistError: true, exit: true });
};

const createArchive = async (moduleName) => {
  const archive = prepareArchive(archivePath, true);

  if (fs.existsSync(moduleManifestFileName) && !fs.existsSync('modules/')) {
    logger.Warn(`Cannot find modules/${moduleName}, creating archive with the current directory.`);
    const moduleFiles = await glob(['**/**', moduleManifestFileName, moduleConfigFileName], {
      ignore: ['**/node_modules/**', '**/tmp/**', 'app/**'],
      onlyFiles: true
    });
    for (const f of moduleFiles) {
      archive.addFile(f, `${moduleName}/${f}`);
    }
  } else if (fs.existsSync(`modules/${moduleName}/`)) {
    logger.Info(`Creating archive for modules/${moduleName}`);
    const moduleDir = path.join(process.cwd(), 'modules', moduleName);
    const moduleFiles = await glob(['**/**', moduleConfigFileName], {
      ignore: ['**/node_modules/**', '**/tmp/**'],
      cwd: moduleDir,
      onlyFiles: true
    });
    for (const f of moduleFiles) {
      archive.addFile(path.join('modules', moduleName, f), `${moduleName}/${f}`);
    }
    // pos-module.json is required in the archive: the portal reads it to register
    // this module's transitive dependencies in the marketplace registry.
    archive.addFile(moduleManifestFileName, `${moduleName}/${moduleManifestFileName}`);
  } else {
    throw new Error(
      `There is no directory modules/${moduleName} - please double check the machine_name property in ${moduleManifestFileName}`
    );
  }

  archive.finalize();
  return archive.done;
};

/**
 * Validates the module manifest, creates the release archive, and returns
 * { moduleName, moduleVersionName, numberOfFiles }.  Throws on any failure —
 * callers are responsible for top-level error handling.
 */
const prepareRelease = async () => {
  const config = moduleConfig();
  const moduleName = config['machine_name'];
  const moduleVersionName = config['version'];

  if (!moduleName) {
    throw new Error(`'machine_name' is required in ${moduleManifestFileName} to publish a module.`);
  }
  if (!moduleVersionName) {
    throw new Error(
      `'version' is required in ${moduleManifestFileName} to publish a module.\n` +
      `Run: pos-cli modules version`
    );
  }
  if (!semver.valid(moduleVersionName)) {
    throw new Error(
      `'version' "${moduleVersionName}" in ${moduleManifestFileName} is not a valid semver string.`
    );
  }
  // Only check module directory when modules/ exists (no-modules/ is the single-dir publish workflow).
  if (fs.existsSync('modules/') && !fs.existsSync(`modules/${moduleName}/`)) {
    throw new Error(
      `Directory modules/${moduleName}/ not found.\n` +
      `Check the 'machine_name' value in ${moduleManifestFileName} matches an existing modules/ subdirectory.`
    );
  }

  const numberOfFiles = await createArchive(moduleName);
  if (numberOfFiles === 0) {
    throw new Error('There are no files in module release');
  }

  return { moduleName, moduleVersionName, numberOfFiles };
};

const handleError = async (e) => {
  if (ServerError.isNetworkError(e))
    await ServerError.handler(e);
  else if (e.message)
    await logger.Error(e.message);
  else
    await logger.Error('Error');
  process.exit(1);
};

const uploadArchive = async (token) => {
  const data = await presignUrlForPortal(token, moduleId, archiveFileName);
  logger.Debug(data);
  await uploadFile(archivePath, data.uploadUrl);
  logger.Info('Release Uploaded');
  return data.accessUrl;
};

const createVersion = async (token, accessUrl, moduleVersionName) => {
  const version = await Portal.createVersion(token, accessUrl, moduleVersionName, moduleId);
  return version.id;
};

const waitForPublishing = async (token, moduleVersionId) => {
  try {
    await waitForStatus(() => Portal.moduleVersionStatus(token, moduleId, moduleVersionId), 'pending', 'accepted');
    logger.Success('Module uploaded.');
  } catch {
    throw new Error('Module not uploaded. Check email for errors.');
  }
};

const getModule = async (token, name) => {
  const module = (await Portal.findModules(token, name))[0];
  if (!module) throw new Error(`Module "${name}" not found`);
  return module;
};

const getToken = async (params) => {
  const password = process.env.POS_PORTAL_PASSWORD || await readPassword();
  logger.Info(`Asking ${Portal.url()} for access token...`);
  return portalAuthToken(params.email, password);
};

const portalAuthToken = async (email, password) => {
  try {
    const token = await Portal.jwtToken(email, password);
    return token.auth_token;
  } catch (e) {
    if (ServerError.isNetworkError(e))
      await ServerError.handler(e);
    else
      process.exit(1);
  }
};

const buildArchive = async () => {
  try {
    const { numberOfFiles } = await prepareRelease();
    logger.Success(`Module archive created: ${archivePath} (${numberOfFiles} files)`);
    return true;
  } catch (e) {
    await handleError(e);
  }
};

const publishVersion = async (params) => {
  try {
    const { moduleName, moduleVersionName } = await prepareRelease();
    const token = await getToken(params);
    const module = await getModule(token, moduleName);
    moduleId = module.id;
    const archiveUrl = await uploadArchive(token);
    const posModuleVersionId = await createVersion(token, archiveUrl, moduleVersionName);
    await waitForPublishing(token, posModuleVersionId);
    return true;
  } catch (e) {
    await handleError(e);
  }
};

export { publishVersion, buildArchive, moduleConfig, moduleConfigFileName, moduleManifestFileName };
