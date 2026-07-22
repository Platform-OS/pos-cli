import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import semver from 'semver';
import files from '../files.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import { moduleConfig } from '../modules.js';
import { POS_MODULE_FILE as moduleManifestFileName, TEMPLATE_VALUES_FILE } from './paths.js';

const BUMP_TYPES = ['major', 'minor', 'patch'];

const templateValuesPath = (moduleName) =>
  path.join('modules', moduleName, TEMPLATE_VALUES_FILE);

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

const updateTemplateValues = (version, moduleName) => {
  const filePath = templateValuesPath(moduleName);
  if (!fs.existsSync(filePath)) return;
  const tv = files.readJSON(filePath, { exit: false });
  if (!tv || !('version' in tv)) return;
  files.writeJSON(filePath, { ...tv, version });
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

const commitAndTag = (version, moduleName) => {
  const filesToAdd = [moduleManifestFileName];
  const tvPath = templateValuesPath(moduleName);
  if (fs.existsSync(tvPath)) filesToAdd.push(tvPath);
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
  updateTemplateValues(finalVersion, moduleName);

  if (useGit) {
    commitAndTag(finalVersion, moduleName);
  }
};

export { createNewVersion };
