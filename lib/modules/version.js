import semver from 'semver';
import files from '../files.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import { moduleConfig } from '../modules.js';
import { POS_MODULE_FILE as moduleManifestFileName } from './paths.js';

const readVersionFromPackage = (options) => {
  let packageJSONPath = 'package.json';
  if (typeof options.package === 'string') {
    packageJSONPath = options.package;
  }
  return files.readJSON(packageJSONPath, { throwDoesNotExistError: true }).version;
};

const storeNewVersion = (config, version) => {
  files.writeJSON(moduleManifestFileName, { ...config, version });
};

const validateVersions = (config, version, moduleName) => {
  if (!semver.valid(config.version)) {
    report('[ERR] The current version is not valid');
    logger.Error(`The "${moduleName}" module's version ("${config.version}") is not valid`);
    return;
  }
  if (!semver.valid(version)) {
    report('[ERR] The given version is not valid');
    logger.Error(`The "${moduleName}" module's new version ("${version}") is not valid`);
    return;
  }
  if (!semver.gt(version, config.version)) {
    report('[ERR] The given version is not greater than the current version');
    logger.Error(
      `The new version "${version}" must be greater than the current version "${config.version}" for module "${moduleName}". ` +
      `Use a higher version number to avoid accidental downgrades.`
    );
    return;
  }
  return true;
};

const createNewVersion = async (version, options) => {
  const config = await moduleConfig();
  const moduleName = config['machine_name'];
  const finalVersion = options.package ? readVersionFromPackage(options) : version;
  if (!validateVersions(config, finalVersion, moduleName)) {
    process.exitCode = 1;
    return;
  }
  storeNewVersion(config, finalVersion);
};

export { createNewVersion };
