import fs from 'fs';
import { execSync } from 'child_process';
import semver from 'semver';
import files from '../files.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import { moduleConfig } from '../modules.js';
import { POS_MODULE_FILE as moduleManifestFileName } from './paths.js';

const BUMP_TYPES = ['major', 'minor', 'patch'];
const TEMPLATE_VALUES_FILE = 'template-values.json';

const readVersionFromPackage = (options) => {
  let packageJSONPath = 'package.json';
  if (typeof options.package === 'string') {
    packageJSONPath = options.package;
  }
  return files.readJSON(packageJSONPath, { throwDoesNotExistError: true }).version;
};

const resolveVersion = (currentVersion, versionArg) => {
  if (!versionArg || BUMP_TYPES.includes(versionArg)) {
    const bumpType = versionArg || 'patch';
    return semver.inc(currentVersion, bumpType);
  }
  return versionArg;
};

const storeNewVersion = (config, version) => {
  files.writeJSON(moduleManifestFileName, { ...config, version });
};

const updateTemplateValues = (version) => {
  if (!fs.existsSync(TEMPLATE_VALUES_FILE)) return;
  const tv = files.readJSON(TEMPLATE_VALUES_FILE, { exit: false });
  if (!tv || !('version' in tv)) return;
  files.writeJSON(TEMPLATE_VALUES_FILE, { ...tv, version });
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

const isGitRepo = () => {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

const isWorkingTreeClean = () => {
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  return status.length === 0;
};

const commitAndTag = (version) => {
  const filesToAdd = [moduleManifestFileName];
  if (fs.existsSync(TEMPLATE_VALUES_FILE)) {
    filesToAdd.push(TEMPLATE_VALUES_FILE);
  }
  execSync(`git add ${filesToAdd.join(' ')}`, { stdio: 'pipe' });
  execSync(`git commit -m "${version}"`, { stdio: 'pipe' });
  execSync(`git tag ${version}`, { stdio: 'pipe' });
};

const createNewVersion = async (version, options) => {
  const useGit = options.git !== false && isGitRepo();

  if (useGit && !isWorkingTreeClean()) {
    report('[ERR] Working tree is not clean');
    logger.Error('There are uncommitted changes. Please commit or stash them before bumping the version.');
    process.exitCode = 1;
    return;
  }

  const config = await moduleConfig();
  const moduleName = config['machine_name'];

  let finalVersion;
  if (options.package) {
    finalVersion = readVersionFromPackage(options);
  } else {
    finalVersion = resolveVersion(config.version, version);
  }

  if (!validateVersions(config, finalVersion, moduleName)) {
    process.exitCode = 1;
    return;
  }
  storeNewVersion(config, finalVersion);
  updateTemplateValues(finalVersion);

  if (useGit) {
    commitAndTag(finalVersion);
  }
};

export { createNewVersion };
