#!/usr/bin/env node

const program = require('commander');
const semver = require('semver');

const dir = require('../lib/directories');
const files = require('../lib/files');
const logger = require('../lib/logger');
const report = require('../lib/logger/report');
const settings = require('../lib/settings');
const { moduleConfig, moduleConfigFilePath } = require('../lib/modules');

const readVersionFromPackage = (options, version) => {
  let packageJSONPath = `package.json`;
  if (typeof options.package === 'string') {
    packageJSONPath = `${options.package}`;
  }
  return files.readJSON(packageJSONPath, { throwDoesNotExistError: true }).version;
};

const storeNewVersion = async (config, version) => {
  config.version = version;
  const filePath = await moduleConfigFilePath();
  files.writeJSON(filePath, config);
};

const validateVersions = (config, version, moduleName) => {
  // Validate versions.
  if (!semver.valid(config.version)) {
    report('[ERR] The current version is not valid');
    logger.Error(`The "${moduleName}" module's version ("${config.version}") is not valid`);
    return
  }
  if (!semver.valid(version)) {
    report('[ERR] The given version is not valid');
    logger.Error(`The "${moduleName}" module's new version ("${version}") is not valid`);
    return
  }

  return true;
};

async function crateNewVersion(version, options) {
  let config = await moduleConfig();
  const moduleName = config['machine_name'];

  if (options.package) version = readVersionFromPackage(options);
  if (!validateVersions(config, version, moduleName)) return;

  await storeNewVersion(config, version);
}

program
  .name('pos-cli modules version')
  .arguments('[version]', 'a valid semver version')
  .option('-p, --package [file]', 'use version from file as latest release, default: package.json')
  .option('--path <path>', 'module root directory, default is current directory')
  .action(async (version, options) => {
    if (options.path) process.chdir(options.path);
    await crateNewVersion(version, options);
  });

program.parse(process.argv);
